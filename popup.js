function waitForPageLoad(tabId, callback) {
    let retries = 0;
    const maxRetries = 20;

    const interval = setInterval(() => {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
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
let trackedSkills = [];

document.addEventListener('DOMContentLoaded', function () {
    const settingsBtn = document.getElementById('settingsBtn');
    const trackBtn = document.getElementById('trackBtn');
    const clearBtn = document.getElementById('clearBtn');
    const copyBtn = document.getElementById('copyBtn');
    const status = document.getElementById('status');
    const results = document.getElementById('results');
    const resultsList = document.getElementById('resultsList');
    const playerNameInput = document.getElementById('playerName');
    const rawTrackBtn = document.getElementById('rawTrackBtn');

    let currentResults = [];

    chrome.storage.local.get(['trackedSkills'], function (data) {
        const rawSkills = data.trackedSkills || {};
        trackedSkills = Object.entries(rawSkills)
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

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const currentTab = tabs[0];
        try {
            const url = new URL(currentTab.url);
            const params = url.searchParams;

            const isReportPath = url.pathname.startsWith('/reports/');
            const hasFight = params.has('fight');
            const hasSource = params.has('source');

            if (!isReportPath) {
                status.textContent = '❌ 잘못된 경로 입니다: 추출 하고 싶은 페이지로 이동하세요.';
                status.style.background = 'rgba(220, 53, 69, 0.3)';
                toggleTrackBtn(false)
                return;
            }
            if (!hasFight) {
                status.textContent = '❌ 분석 실패: 추출 하고 싶은 전투를 선택 해주세요.';
                status.style.background = 'rgba(220, 53, 69, 0.3)';
                toggleTrackBtn(false)
                return;
            }
            /*if (!hasSource) {
                status.textContent = '❌ 분석 실패: 추출 하고 싶은 유저를 선택해주세요.';
                status.style.background = 'rgba(220, 53, 69, 0.3)';
                toggleTrackBtn(false)
                return;
            }*/

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
                let trackedSkillNames = new Set();
                let currentSkillIds = new Set();
                let trackedSkillIds = new Set();
                // 스킬 검사
                if (pinsParam) {
                    try {
                        const decoded = decodeURIComponent(pinsParam);
                        console.log(decoded);

                        // --------------------------
                        // ability.name IN (...)
                        // --------------------------
                        const nameIndex = decoded.search(/ability\.name\s+IN\s*\(/i);
                        if (nameIndex !== -1) {
                            // ability.id IN (...) 절이 있으면 그 앞까지만 nameSegment로 사용
                            const idIndex = decoded.search(/ability\.id\s+IN\s*\(/i);
                            const nameSegment = idIndex !== -1
                                ? decoded.slice(nameIndex, idIndex)
                                : decoded.slice(nameIndex);

                            // " 로 감싸진 부분만 추출
                            const nameMatches = [...nameSegment.matchAll(/"([^"]+)"/g)];
                            nameMatches.forEach(m => currentSkillNames.add(m[1]));
                        }

                        // --------------------------
                        // ability.id IN (...)
                        // --------------------------
                        const idInMatch = decoded.match(/ability\.id\s+IN\s*\(([^)]*)\)/i);
                        if (idInMatch) {
                            const idListStr = idInMatch[1]; // "123, 456, ..."
                            const ids = (idListStr.match(/\d+/g) || []);
                            ids.forEach(id => currentSkillIds.add(id));
                        }
                    } catch (e) {
                        console.error('pins 파싱 중 오류', e);
                    }
                }

                trackedSkills.forEach(m => {
                    if (m.extractBySpellId) {
                        trackedSkillIds.add(String(m.id));
                    }else {
                        trackedSkillNames.add(m.en);
                        trackedSkillNames.add(m.ko);
                    }
                })

                const trackedNamesArr = Array.from(trackedSkillNames);
                const currentNamesArr = Array.from(currentSkillNames);
                const trackedIdsArr   = Array.from(trackedSkillIds);
                const currentIdsArr   = Array.from(currentSkillIds);


                console.log(trackedNamesArr)
                console.log(currentNamesArr)

                const namesEqual = trackedNamesArr.length === currentNamesArr.length &&
                    trackedNamesArr.every(name => currentNamesArr.includes(name));
                const idsEqual   = trackedIdsArr.length === currentIdsArr.length &&
                    trackedIdsArr.every(id => currentIdsArr.includes(id));
                const isSame = namesEqual && idsEqual;

                if (!isSame) {
                    // 새로운 pins 파라미터 생성
                    const parts = [];
                    if (trackedSkillNames.size > 0) {
                        const nameClause = [...trackedSkillNames]
                            .map(name => `"${name.replace(/"/g, '\\"')}"`)
                        .join(', ');
                        parts.push(`ability.name IN (${nameClause})`);
                        }
                    if (trackedSkillIds.size > 0) {
                        // 숫자 목록, 따옴표 없음
                        const idClause = [...trackedSkillIds].join(', ');
                        parts.push(`ability.id IN (${idClause})`);
                    }
                    let expr = parts.join(' OR ');
                    if (expr) {
                        expr = `type="cast" AND (${expr})`;
                    } else {
                        expr = `type="cast"`; // 스킬 조건이 없더라도 cast만 필터링
                    }
                    const pinsString = `2$Off$#244F4B$expression$${expr}`;
                    //console.log(pinsString)
                    const encodedPins = pinsString;
                    params.set('pins', encodedPins);
                    shouldRedirect = true;
                }



                if (shouldRedirect) {
                    const newUrl = `${url.origin}${url.pathname}?${params.toString()}`;
                    status.textContent = '🔁 필요한 파라미터를 추가하고 다시 이동합니다...';
                    status.style.background = 'rgba(255, 193, 7, 0.3)';
                    toggleTrackBtn(false);


                    chrome.tabs.update(currentTab.id, { url: newUrl }, function (updatedTab) {
                        status.textContent = '🔄 페이지 이동 중...';
                        status.style.background = 'rgba(255, 193, 7, 0.3)';
                        toggleTrackBtn(false);

                        waitForPageLoad(updatedTab.id, (loaded) => {
                            if (loaded) {
                                status.textContent = '✅ 페이지 로드 완료. 분석 준비 완료';
                                status.style.background = 'rgba(40, 167, 69, 0.3)';
                                toggleTrackBtn(true);
                                // trackBtn.click(); // 자동 분석 시작 원할 경우
                            } else {
                                status.textContent = '⚠️ 페이지 로딩이 실패 했습니다';
                                status.style.background = 'rgba(220, 53, 69, 0.3)';
                                toggleTrackBtn(false);
                            }
                        });
                    });
                } else {
                    status.textContent = '✅ 분석 준비 완료';
                    status.style.background = 'rgba(40, 167, 69, 0.3)';
                    toggleTrackBtn(true);
                }
            });
        } catch (e) {
            status.textContent = '❌ URL 분석 중 오류 발생';
            status.style.background = 'rgba(220, 53, 69, 0.3)';
            toggleTrackBtn(false);
        }
    });

    function runExtraction({ useOriginalName }) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['exportOptions'], function (data) {
                const opts = data.exportOptions || {};
                const trackingOpts = {
                    options: {
                        tipTheScales: opts.tipTheScales || false,
                        includeRank: opts.includeRank || false,
                        appendDisplay: opts.appendDisplay || false
                    }
                };

                chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
                    chrome.scripting.executeScript({
                        target: {tabId: tabs[0].id},
                        func: async function (trackedSkills, trackingOpts, useOriginalName, playerName) {
                            function toMinuteSeconds(rawTime) {
                                const parts = rawTime.split(':');
                                const minutes = String(parseInt(parts[0])).padStart(2, '0');
                                const seconds = Math.floor(parseFloat(parts[1]));
                                return minutes + ':' + String(seconds).padStart(2, '0');
                            }

                            const entries = [];
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            let rows = document.querySelectorAll('tr[id^="event-row"]');
                            if (rows.length === 0) rows = document.querySelectorAll('tr[class*="event"]');
                            if (rows.length === 0) rows = document.querySelectorAll('table tr');
                            if (rows.length === 0) return [];

                            let tipTheScalesActive = false;

                            for (let i = 0; i < rows.length; i++) {
                                const row = rows[i];
                                const timeCell = row.querySelector('.main-table-number');
                                const eventCell = row.querySelector('.event-description-cell');
                                if (!timeCell || !eventCell) continue;

                                const rawTime = timeCell.textContent.trim();
                                const time = toMinuteSeconds(rawTime);
                                const cleanText = eventCell.textContent.replace(/\s+/g, '').toLowerCase();

                                if (cleanText.includes('caststipthescales')) {
                                    tipTheScalesActive = true;
                                    continue;
                                }

                                for (const skill of trackedSkills) {
                                    let Skill_En = skill.en.replace(/\s+/g, '').toLowerCase().trim();
                                    let Skill_Ko = skill.ko.replace(/\s+/g, '').trim();

                                    if (
                                        cleanText.includes('casts' + Skill_En) ||
                                        cleanText.includes('casts' + Skill_Ko)
                                    ) {
                                        let result;
                                        const tipMatch = (
                                            Skill_En === 'firebreath' || Skill_En === 'eternitysurge' ||
                                            Skill_Ko === '불의숨결' || Skill_Ko === '영원의쇄도'
                                        );

                                        // ✅ 캐릭터명 결정 로직
                                        let targetName = useOriginalName
                                            ? cleanText.split("casts")[0]
                                            : playerName;

                                        if (tipTheScalesActive && tipMatch && trackingOpts.options.tipTheScales) {
                                            result = `{time:${time}} - ${targetName} {spell:${skill.id}} - tip the scales`;
                                            tipTheScalesActive = false;
                                        } else {
                                            let level = 'N/A';
                                            for (let j = i + 1; j < Math.min(i + 10, rows.length); j++) {
                                                const nextEvent = rows[j].querySelector('.event-description-cell');
                                                if (!nextEvent) continue;
                                                const nextText = nextEvent.textContent.replace(/\s+/g, '').toLowerCase();
                                                if (
                                                    nextText.includes('releases' + Skill_En + 'atempowermentlevel') ||
                                                    nextText.includes('releases' + Skill_Ko + 'atempowermentlevel')
                                                ) {
                                                    const match = nextText.match(/level(\d+)/);
                                                    if (match) level = match[1];
                                                    break;
                                                }
                                            }
                                            result = level === 'N/A' || !trackingOpts.options.includeRank
                                                ? `{time:${time}} - ${targetName} {spell:${skill.id}}`
                                                : `{time:${time}} - ${targetName} {spell:${skill.id}} - level ${level}`;

                                            result = trackingOpts.options.appendDisplay
                                                ? result.concat(` - ${skill.display}`)
                                                : result;
                                        }

                                        entries.push(result);
                                        break;
                                    }
                                }
                            }
                            return entries;
                        },
                        args: [trackedSkills, trackingOpts, useOriginalName, document.getElementById('playerName')?.value || '']
                    }).then(res => {
                        resolve(res && res[0] ? res[0].result : []);
                    }).catch(reject);
                });
            });
        });
    }



    trackBtn.addEventListener('click', function () {
        toggleTrackBtn(false);
        trackBtn.textContent = '분석 중...';
        status.textContent = '🔄 로그 분석 중...';
        status.className = 'status loading';

        runExtraction({ useOriginalName: false })
            .then(skillEvents => {
                toggleTrackBtn(true);
                trackBtn.textContent = '스킬 추적';
                currentResults = skillEvents;
                if (!skillEvents || skillEvents.length === 0) {
                    status.textContent = '⚠️ 추적 가능한 스킬이 없습니다';
                    return;
                }
                status.textContent = `✅ ${skillEvents.length}개의 스킬 이벤트 발견`;
                displayResults(skillEvents);
            })
            .catch(err => {
                console.error(err);
                toggleTrackBtn(true);
                trackBtn.textContent = '스킬 추적';
                status.textContent = '❌ 오류 발생';
            });
    });

    rawTrackBtn.addEventListener('click', function () {
        toggleTrackBtn(false);
        rawTrackBtn.textContent = '분석 중...';
        status.textContent = '🔄 원본 로그 분석 중...';
        status.className = 'status loading';

        runExtraction({ useOriginalName: true })
            .then(skillEvents => {
                toggleTrackBtn(true);
                rawTrackBtn.textContent = '원본 추출';
                currentResults = skillEvents;
                if (!skillEvents || skillEvents.length === 0) {
                    status.textContent = '⚠️ 추적 가능한 원본 스킬이 없습니다';
                    return;
                }
                status.textContent = `✅ ${skillEvents.length}개의 원본 스킬 이벤트 발견`;
                displayResults(skillEvents);
            })
            .catch(err => {
                console.error(err);
                toggleTrackBtn(true);
                rawTrackBtn.textContent = '원본 추출';
                status.textContent = '❌ 오류 발생';
            });
    });

    clearBtn.addEventListener('click', function () {
        results.classList.add('hidden');
        copyBtn.classList.add('hidden');
        resultsList.innerHTML = '';
        currentResults = [];
        status.textContent = '결과가 지워졌습니다';
        status.className = 'status';
    });

    copyBtn.addEventListener('click', function () {
        console.log(currentResults);
        if (currentResults.length === 0) return;
        const textToCopy = currentResults.join('\n');
        navigator.clipboard.writeText(textToCopy).then(function () {
            copyBtn.textContent = '복사됨!';
            setTimeout(() => copyBtn.textContent = '결과 복사', 1000);
        }).catch(function () {
            const textArea = document.createElement('textarea');
            textArea.value = textToCopy;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            copyBtn.textContent = '복사됨!';
            setTimeout(() => copyBtn.textContent = '결과 복사', 1000);
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
    function toggleTrackBtn(toggle) {
        if(toggle == true) {
            rawTrackBtn.disabled = false;
            trackBtn.disabled = false;
        }else{
            rawTrackBtn.disabled = true;
            trackBtn.disabled = true;
        }
    }
});