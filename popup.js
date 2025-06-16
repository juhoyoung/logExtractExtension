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

document.addEventListener('DOMContentLoaded', function () {
    const settingsBtn = document.getElementById('settingsBtn');
    const trackBtn = document.getElementById('trackBtn');
    const clearBtn = document.getElementById('clearBtn');
    const copyBtn = document.getElementById('copyBtn');
    const status = document.getElementById('status');
    const results = document.getElementById('results');
    const resultsList = document.getElementById('resultsList');
    const playerNameInput = document.getElementById('playerName');

    let currentResults = [];


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
                trackBtn.disabled = true;
                return;
            }
            if (!hasFight) {
                status.textContent = '❌ 분석 실패: 추출 하고 싶은 전투를 선택 해주세요.';
                status.style.background = 'rgba(220, 53, 69, 0.3)';
                trackBtn.disabled = true;
                return;
            }
            if (!hasSource) {
                status.textContent = '❌ 분석 실패: 추출 하고 싶은 유저를 선택해주세요.';
                status.style.background = 'rgba(220, 53, 69, 0.3)';
                trackBtn.disabled = true;
                return;
            }

            // exportOptions에서 translatePage 가져오기
            chrome.storage.local.get('exportOptions', function (data) {
                const translatePage = data.exportOptions?.translatePage === true;

                console.log(translatePage);

                let shouldRedirect = false;

                const typeParam = params.get('type');
                const viewParam = params.get('view');
                const hasTranslate = params.get('translate') === 'true';

                // type, view 검사
                if (typeParam !== 'casts') {
                    params.set('type', 'casts');
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

                if (shouldRedirect) {
                    const newUrl = `${url.origin}${url.pathname}?${params.toString()}`;
                    status.textContent = '🔁 필요한 파라미터를 추가하고 다시 이동합니다...';
                    status.style.background = 'rgba(255, 193, 7, 0.3)';
                    trackBtn.disabled = true;

                    chrome.tabs.update(currentTab.id, { url: newUrl }, function (updatedTab) {
                        status.textContent = '🔄 페이지 이동 중...';
                        status.style.background = 'rgba(255, 193, 7, 0.3)';
                        trackBtn.disabled = true;

                        waitForPageLoad(updatedTab.id, (loaded) => {
                            if (loaded) {
                                status.textContent = '✅ 페이지 로드 완료. 분석 준비 완료';
                                status.style.background = 'rgba(40, 167, 69, 0.3)';
                                trackBtn.disabled = false;
                                // trackBtn.click(); // 자동 분석 시작 원할 경우
                            } else {
                                status.textContent = '⚠️ 페이지 로딩이 실패 했습니다';
                                status.style.background = 'rgba(220, 53, 69, 0.3)';
                                trackBtn.disabled = true;
                            }
                        });
                    });
                } else {
                    status.textContent = '✅ 분석 준비 완료';
                    status.style.background = 'rgba(40, 167, 69, 0.3)';
                    trackBtn.disabled = false;
                }
            });
        } catch (e) {
            status.textContent = '❌ URL 분석 중 오류 발생';
            status.style.background = 'rgba(220, 53, 69, 0.3)';
            trackBtn.disabled = true;
        }
    });


    trackBtn.addEventListener('click', function () {
        const playerName = playerNameInput.value.trim() || '';

        // 플레이어 이름을 다시 한번 저장 (버튼 클릭 시)
        chrome.storage.local.set({playerName: playerName});

        trackBtn.disabled = true;
        trackBtn.textContent = '분석 중...';
        status.textContent = '🔄 로그 분석 중...';
        status.className = 'status loading';

        chrome.storage.local.get(['trackedSkills', 'exportOptions'], function (data) {
            const rawSkills = data.trackedSkills || {};
            const opts = data.exportOptions || {};

            const trackedSkills = Object.entries(rawSkills)
                .filter(([_, value]) => value.enabled)
                .map(([id, value]) => ({
                    id,
                    display: value.display,
                    en: value.en.toLowerCase(),
                    ko: value.ko
                }));
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
                    func: async function (playerName, trackedSkills, trackingOpts) {
                        function toMinuteSeconds(rawTime) {
                            const parts = rawTime.split(':');
                            const minutes = String(parseInt(parts[0])).padStart(2, '0');
                            const seconds = Math.floor(parseFloat(parts[1]));
                            return minutes + ':' + String(seconds).padStart(2, '0');
                        }

                        const entries = [];

                        try {
                            if (typeof selectTextEventsView === 'function') {
                                selectTextEventsView();
                            }
                        } catch (_) {
                        }

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
                                //console.log(skill);
                                let Skill_En = skill.en.replace(/\s+/g, '').toLowerCase().trim();
                                let Skill_Ko = skill.ko.replace(/\s+/g, '').trim();
                                if (
                                    cleanText.includes('casts' + Skill_En) ||
                                    cleanText.includes('casts' + skill.ko)
                                ) {
                                    let result;
                                    const tipMatch = (
                                        Skill_En === 'firebreath' || Skill_En === 'eternitysurge' ||
                                        Skill_Ko === '불의숨결' || Skill_Ko === '영원의쇄도'
                                    );

                                    if (tipTheScalesActive && tipMatch && trackingOpts.options.tipTheScales) {
                                        result = `{time:${time}} - ${playerName} {spell:${skill.id}} - tip the scales`;
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
                                            ? `{time:${time}} - ${playerName} {spell:${skill.id}}`
                                            : `{time:${time}} - ${playerName} {spell:${skill.id}} - level ${level}`;

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
                    args: [playerName, trackedSkills, trackingOpts]
                }).then(function (results) {
                    console.log(results);
                    trackBtn.disabled = false;
                    trackBtn.textContent = '스킬 추적';

                    if (chrome.runtime.lastError) {
                        status.textContent = '❌ 오류 발생: ' + chrome.runtime.lastError.message;
                        status.className = 'status error';
                        return;
                    }

                    if (results && results[0] && results[0].result) {
                        const skillEvents = results[0].result;
                        currentResults = skillEvents;

                        if (skillEvents.length === 0) {
                            status.textContent = '⚠️ 추적 가능한 스킬이 없습니다';
                            status.className = 'status';
                            return;
                        }

                        status.textContent = `✅ ${skillEvents.length}개의 스킬 이벤트 발견`;
                        status.className = 'status';
                        status.style.background = 'rgba(40, 167, 69, 0.3)';
                        displayResults(skillEvents);
                    } else {
                        status.textContent = '❌ 결과를 가져올 수 없습니다';
                        status.className = 'status error';
                    }
                }).catch(function (error) {
                    console.error('executeScript 오류:', error);
                    trackBtn.disabled = false;
                    trackBtn.textContent = '스킬 추적';
                    status.textContent = '❌ 스크립트 실행 중 오류 발생';
                    status.className = 'status error';
                });
            });
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
});