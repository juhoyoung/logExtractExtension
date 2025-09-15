function waitForPageLoad(tabId, callback) {
    let retries = 0;
    const maxRetries = 20;

    const interval = setInterval(() => {
        chrome.scripting.executeScript({
            target: {tabId: tabId},
            func: () => document.readyState === 'complete'
        }, (results) => {
            if (chrome.runtime.lastError) {
                console.warn('탭 검사 중 오류:', chrome.runtime.lastError.message);
                clearInterval(interval);
                return;
            }

            if (results && results[0] && results[0].result === true) {
                clearInterval(interval);
                callback(true);
            } else if (++retries >= maxRetries) {
                clearInterval(interval);
                callback(false);
            }
        });
    }, 500);
}

// 저장된 스킬 목록
let extractedSkills = [];

document.addEventListener('DOMContentLoaded', function () {
    // i18n 초기화 완료 후 실행
    const initializeAfterI18n = () => {
        const settingsBtn = document.getElementById('settingsBtn');
        const extractBtn = document.getElementById('extractBtn');
        const clearBtn = document.getElementById('clearBtn');
        const copyBtn = document.getElementById('copyBtn');
        const status = document.getElementById('status');
        const results = document.getElementById('results');
        const resultsList = document.getElementById('resultsList');
        const playerNameInput = document.getElementById('playerName');
        const rawExtractBtn = document.getElementById('rawExtractBtn');

        let currentResults = [];

        chrome.storage.local.get(['extractedSkills'], function (data) {
            const rawSkills = data.extractedSkills || {};
            extractedSkills = Object.entries(rawSkills)
                .filter(([_, value]) => value.enabled)
                .map(([id, value]) => ({
                    id,
                    display: value.display,
                    en: value.en,
                    ko: value.ko,
                    extractBySpellId: value.extractBySpellId
                }));
        });

        // 페이지 로드 시 저장된 플레이어 이름 불러오기
        chrome.storage.local.get('playerName', function (data) {
            if (data.playerName) {
                playerNameInput.value = data.playerName;
            }
        });

        // 플레이어 이름 입력 시 자동 저장
        playerNameInput.addEventListener('input', function () {
            const playerName = playerNameInput.value.trim();
            chrome.storage.local.set({playerName: playerName});
        });

        // 포커스 아웃 시에도 저장 (안전장치)
        playerNameInput.addEventListener('blur', function () {
            const playerName = playerNameInput.value.trim();
            chrome.storage.local.set({playerName: playerName});
        });

        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
            const currentTab = tabs[0];
            try {
                const url = new URL(currentTab.url);
                const params = url.searchParams;

                const isReportPath = url.pathname.startsWith('/reports/');
                const hasFight = params.has('fight');
                const hasSource = params.has('source');

                if (!isReportPath) {
                    status.textContent = t('status_invalid_path');
                    status.style.background = 'rgba(220, 53, 69, 0.3)';
                    toggleExtractBtn(false)
                    return;
                }
                if (!hasFight) {
                    status.textContent = t('status_no_fight');
                    status.style.background = 'rgba(220, 53, 69, 0.3)';
                    toggleExtractBtn(false)
                    return;
                }

                // exportOptions에서 translatePage 가져오기
                chrome.storage.local.get('exportOptions', function (data) {
                    const translatePage = data.exportOptions?.translatePage === true;

                    let shouldRedirect = false;

                    const typeParam = params.get('type');
                    const viewParam = params.get('view');
                    const hasTranslate = params.get('translate') === 'true';
                    const pinsParam = params.get('pins');

                    // type, view 검사
                    if (typeParam !== 'summary') {
                        params.set('type', 'summary');
                        shouldRedirect = true;
                    }
                    if (viewParam !== 'events') {
                        params.set('view', 'events');
                        shouldRedirect = true;
                    }
                    // translate 검사
                    if (translatePage && !hasTranslate) {
                        params.set('translate', 'true');
                        shouldRedirect = true;
                    }

                    let currentSkillNames = new Set();
                    let extractedSkillNames = new Set();
                    let currentSkillIds = new Set();
                    let extractedSkillIds = new Set();
                    let hasTypeCast = false;
                    let hasSourcePlayer = false;

                    // 스킬 검사
                    if (pinsParam) {
                        try {
                            const decoded = decodeURIComponent(pinsParam);

                            // type="cast" 포함 여부 체크
                            hasTypeCast = /type\s*=\s*"cast"/i.test(decoded);

                            // source.type="player" 포함 여부 체크
                            hasSourcePlayer = /source\.type\s*=\s*"player"/i.test(decoded);

                            // ability.name IN (...)
                            const nameIndex = decoded.search(/ability\.name\s+IN\s*\(/i);
                            if (nameIndex !== -1) {
                                const idIndex = decoded.search(/ability\.id\s+IN\s*\(/i);
                                const nameSegment = idIndex !== -1
                                    ? decoded.slice(nameIndex, idIndex)
                                    : decoded.slice(nameIndex);

                                const nameMatches = [...nameSegment.matchAll(/"([^"]+)"/g)];
                                nameMatches.forEach(m => currentSkillNames.add(m[1]));
                            }

                            // ability.id IN (...)
                            const idInMatch = decoded.match(/ability\.id\s+IN\s*\(([^)]*)\)/i);
                            if (idInMatch) {
                                const idListStr = idInMatch[1];
                                const ids = (idListStr.match(/\d+/g) || []);
                                ids.forEach(id => currentSkillIds.add(id));
                            }
                        } catch (e) {
                            console.error('pins 파싱 중 오류', e);
                        }
                    }

                    extractedSkills.forEach(m => {
                        if (m.extractBySpellId) {
                            extractedSkillIds.add(String(m.id));
                        } else {
                            if (isValidString(m.en)) {
                                extractedSkillNames.add(m.en);
                            }
                            if (!translatePage && isValidString(m.ko))
                                extractedSkillNames.add(m.ko);
                        }
                    })

                    const extractedNamesArr = Array.from(extractedSkillNames);
                    const currentNamesArr = Array.from(currentSkillNames);
                    const extractedIdsArr = Array.from(extractedSkillIds);
                    const currentIdsArr = Array.from(currentSkillIds);

                    const namesEqual = extractedNamesArr.length === currentNamesArr.length &&
                        extractedNamesArr.every(name => currentNamesArr.includes(name));
                    const idsEqual = extractedIdsArr.length === currentIdsArr.length &&
                        extractedIdsArr.every(id => currentIdsArr.includes(id));
                    const isSame = namesEqual && idsEqual & hasTypeCast && hasSourcePlayer;

                    if (!isSame) {
                        // 새로운 pins 파라미터 생성
                        const parts = [];
                        if (extractedSkillNames.size > 0) {
                            const nameClause = [...extractedSkillNames]
                                .map(name => `"${name.replace(/"/g, '\\"')}"`)
                                .join(', ');
                            parts.push(`ability.name IN (${nameClause})`);
                        }
                        if (extractedSkillIds.size > 0) {
                            const idClause = [...extractedSkillIds].join(', ');
                            parts.push(`ability.id IN (${idClause})`);
                        }
                        let expr = parts.join(' OR ');
                        if (expr) {
                            expr = `type="cast" AND source.type="player" AND (${expr})`;
                        } else {
                            expr = `type="cast AND source.type="player"`;
                        }
                        const pinsString = `2$Off$#244F4B$expression$${expr}`;
                        const encodedPins = pinsString;
                        params.set('pins', encodedPins);
                        shouldRedirect = true;
                    }

                    if (shouldRedirect) {
                        const newUrl = `${url.origin}${url.pathname}?${params.toString()}`;
                        status.textContent = t('status_adding_params');
                        status.style.background = 'rgba(255, 193, 7, 0.3)';
                        toggleExtractBtn(false);

                        chrome.tabs.update(currentTab.id, {url: newUrl}, function (updatedTab) {
                            status.textContent = t('status_redirecting');
                            status.style.background = 'rgba(255, 193, 7, 0.3)';
                            toggleExtractBtn(false);

                            waitForPageLoad(updatedTab.id, (loaded) => {
                                if (loaded) {
                                    status.textContent = t('status_page_loaded');
                                    status.style.background = 'rgba(40, 167, 69, 0.3)';
                                    toggleExtractBtn(true);
                                } else {
                                    status.textContent = t('status_page_load_failed');
                                    status.style.background = 'rgba(220, 53, 69, 0.3)';
                                    toggleExtractBtn(false);
                                }
                            });
                        });
                    } else {
                        status.textContent = t('status_ready');
                        status.style.background = 'rgba(40, 167, 69, 0.3)';
                        toggleExtractBtn(true);
                    }
                });
            } catch (e) {
                status.textContent = t('status_url_error');
                status.style.background = 'rgba(220, 53, 69, 0.3)';
                toggleExtractBtn(false);
            }
        });

        function isValidString(str) {
            return typeof str === 'string' && str.trim() !== '';
        }

        function runExtraction({useOriginalName}) {
            return new Promise((resolve, reject) => {
                chrome.storage.local.get(['exportOptions'], function (data) {
                    const opts = data.exportOptions || {};
                    const extractingOpts = {
                        options: {appendDisplay: opts.appendDisplay || false}
                    };

                    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
                        chrome.scripting.executeScript({
                            target: {tabId: tabs[0].id},
                            func: async function (extractedSkills, extractingOpts, useOriginalName, playerName) {
                                function toMinuteSeconds(rawTime) {
                                    const parts = rawTime.split(':');
                                    const minutes = String(parseInt(parts[0])).padStart(2, '0');
                                    const seconds = Math.floor(parseFloat(parts[1]));
                                    return minutes + ':' + String(seconds).padStart(2, '0');
                                }

                                // 시간을 초로 변환하는 함수 추가
                                function timeToSeconds(timeStr) {
                                    const [minutes, seconds] = timeStr.split(':').map(Number);
                                    return minutes * 60 + seconds;
                                }

                                // 중복 체크 함수
                                function isDuplicate(entries, newEntry, skillId) {
                                    const newTime = timeToSeconds(newEntry.match(/time:(\d+:\d+)/)[1]);

                                    return entries.some(entry => {
                                        if (!entry.includes(`{spell:${skillId}}`)) return false;

                                        const entryTime = timeToSeconds(entry.match(/time:(\d+:\d+)/)[1]);
                                        const timeDiff = Math.abs(newTime - entryTime);

                                        return timeDiff < 0.1; // 0.1초 미만 차이면 중복으로 간주
                                    });
                                }

                                const entries = [];
                                await new Promise(resolve => setTimeout(resolve, 2000));

                                let rows = document.querySelectorAll('tr[id^="event-row"]');
                                if (rows.length === 0) rows = document.querySelectorAll('tr[class*="event"]');
                                if (rows.length === 0) rows = document.querySelectorAll('table tr');
                                if (rows.length === 0) return [];

                                for (let i = 0; i < rows.length; i++) {
                                    const row = rows[i];
                                    const timeCell = row.querySelector('.main-table-number');
                                    const eventCell = row.querySelector('.event-description-cell');

                                    if (!timeCell || !eventCell) continue;

                                    const rawTime = timeCell.textContent.trim();
                                    const time = toMinuteSeconds(rawTime);
                                    const cleanText = eventCell.textContent.replace(/\s+/g, '').toLowerCase();

                                    for (const skill of extractedSkills) {
                                        let Skill_En = skill.en.replace(/\s+/g, '').toLowerCase().trim();
                                        let Skill_Ko = skill.ko.replace(/\s+/g, '').trim();

                                        if (
                                            cleanText.includes('casts' + Skill_En) ||
                                            cleanText.includes('casts' + Skill_Ko)
                                        ) {
                                            let result;
                                            let targetName = useOriginalName ? cleanText.split("casts")[0] : playerName;
                                            result = `{time:${time}} - ${targetName} {spell:${skill.id}}`;
                                            result = extractingOpts.options.appendDisplay ? result.concat(` - ${skill.display}`) : result;

                                            // 중복 체크 후 추가
                                            if (!isDuplicate(entries, result, skill.id)) {
                                                entries.push(result);
                                            }
                                            break;
                                        }
                                    }
                                }
                                return entries;
                            },
                            args: [extractedSkills, extractingOpts, useOriginalName, document.getElementById('playerName')?.value || '']
                        }).then(res => {
                            resolve(res && res[0] ? res[0].result : []);
                        }).catch(reject);
                    });
                });
            });
        }

        extractBtn.addEventListener('click', function () {
            toggleExtractBtn(false);
            extractBtn.textContent = t('btn_analyzing');
            status.textContent = t('status_analyzing');
            status.className = 'status loading';

            runExtraction({useOriginalName: false})
                .then(skillEvents => {
                    toggleExtractBtn(true);
                    extractBtn.textContent = t('btn_extract_skills');
                    currentResults = skillEvents;
                    if (!skillEvents || skillEvents.length === 0) {
                        status.textContent = t('status_no_skills_found');
                        return;
                    }
                    status.textContent = t('status_skills_found', [skillEvents.length]);
                    displayResults(skillEvents);
                })
                .catch(err => {
                    console.error(err);
                    toggleExtractBtn(true);
                    extractBtn.textContent = t('btn_extract_skills');
                    status.textContent = t('status_error');
                });
        });

        rawExtractBtn.addEventListener('click', function () {
            toggleExtractBtn(false);
            rawExtractBtn.textContent = t('btn_analyzing');
            status.textContent = t('status_analyzing_raw');
            status.className = 'status loading';

            runExtraction({useOriginalName: true})
                .then(skillEvents => {
                    toggleExtractBtn(true);
                    rawExtractBtn.textContent = t('btn_extract_raw');
                    currentResults = skillEvents;
                    if (!skillEvents || skillEvents.length === 0) {
                        status.textContent = t('status_no_raw_skills_found');
                        return;
                    }
                    status.textContent = t('status_raw_skills_found', [skillEvents.length]);
                    displayResults(skillEvents);
                })
                .catch(err => {
                    console.error(err);
                    toggleExtractBtn(true);
                    rawExtractBtn.textContent = t('btn_extract_raw');
                    status.textContent = t('status_error');
                });
        });

        clearBtn.addEventListener('click', function () {
            results.classList.add('hidden');
            copyBtn.classList.add('hidden');
            resultsList.innerHTML = '';
            currentResults = [];
            status.textContent = t('status_results_cleared');
            status.className = 'status';
        });

        copyBtn.addEventListener('click', function () {
            console.log(currentResults);
            if (currentResults.length === 0) return;
            const textToCopy = currentResults.join('\n');
            navigator.clipboard.writeText(textToCopy).then(function () {
                copyBtn.textContent = t('btn_copied');
                setTimeout(() => copyBtn.textContent = t('btn_copy_results'), 1000);
            }).catch(function () {
                const textArea = document.createElement('textarea');
                textArea.value = textToCopy;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                copyBtn.textContent = t('btn_copied');
                setTimeout(() => copyBtn.textContent = t('btn_copy_results'), 1000);
            });
        });

        settingsBtn.addEventListener('click', function () {
            chrome.runtime.openOptionsPage();
        });

        function displayResults(skillEvents) {
            resultsList.innerHTML = '';
            skillEvents.forEach(event => {
                const item = document.createElement('div');
                item.className = 'result-item';
                item.textContent = event;
                resultsList.appendChild(item);
            });
            results.classList.remove('hidden');
            copyBtn.classList.remove('hidden');
        }

        // 1 == on // 2 == off
        function toggleExtractBtn(toggle) {
            if (toggle == true) {
                rawExtractBtn.disabled = false;
                extractBtn.disabled = false;
            } else {
                rawExtractBtn.disabled = true;
                extractBtn.disabled = true;
            }
        }
    };

    // i18n 초기화를 기다린 후 실행
    if (window.i18n && window.i18n.messages) {
        initializeAfterI18n();
    } else {
        // i18n이 아직 로드되지 않은 경우 잠시 기다림
        setTimeout(() => {
            initializeAfterI18n();
        }, 100);
    }
});