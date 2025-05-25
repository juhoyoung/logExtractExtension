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

	chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
		const currentTab = tabs[0];
		if (currentTab.url.includes('warcraftlogs.com')) {
			status.textContent = '✅ Warcraft Logs 페이지에서 실행 가능';
			status.style.background = 'rgba(40, 167, 69, 0.3)';
			trackBtn.disabled = false;
		} else {
			status.textContent = '❌ Warcraft Logs 페이지에서만 사용 가능';
			status.style.background = 'rgba(220, 53, 69, 0.3)';
			trackBtn.disabled = true;
		}
	});

	trackBtn.addEventListener('click', function () {
		const playerName = playerNameInput.value.trim() || '';
		trackBtn.disabled = true;
		trackBtn.textContent = '분석 중...';
		status.textContent = '🔄 로그 분석 중...';
		status.className = 'status loading';
		
		chrome.storage.local.get('trackedSkills', function (data) {
			const rawSkills = data.trackedSkills || {};
			const trackedSkills = Object.entries(rawSkills)
				.filter(([_, value]) => value.enabled)
				.map(([id, value]) => ({
					id,
					display: value.display,
					en: value.en.toLowerCase(),
					ko: value.ko
				}));

			console.log('[popup.js] 추적 스킬 목록:', trackedSkills);

			chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
				chrome.scripting.executeScript({
					target: { tabId: tabs[0].id },
					func: async function (playerName, trackedSkills) {
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
						} catch (_) {}

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
								if (
									cleanText.includes('casts' + skill.en) ||
									cleanText.includes('casts' + skill.ko)
								) {
									let result;
									const tipMatch = (
										skill.en === 'firebreath' || skill.en === 'eternitysurge' ||
										skill.ko === '불의숨결' || skill.ko === '영원의쇄도'
									);

									if (tipTheScalesActive && tipMatch) {
										result = `{time:${time}} - ${playerName} {spell:${skill.id}} - tip the scales`;
										tipTheScalesActive = false;
									} else {
										let level = 'N/A';
										for (let j = i + 1; j < Math.min(i + 10, rows.length); j++) {
											const nextEvent = rows[j].querySelector('.event-description-cell');
											if (!nextEvent) continue;
											const nextText = nextEvent.textContent.replace(/\s+/g, '').toLowerCase();
											if (
												nextText.includes('releases' + skill.en + 'atempowermentlevel') ||
												nextText.includes('releases' + skill.ko + 'atempowermentlevel')
											) {
												const match = nextText.match(/level(\d+)/);
												if (match) level = match[1];
												break;
											}
										}
										result = level === 'N/A'
											? `{time:${time}} - ${playerName} {spell:${skill.id}}`
											: `{time:${time}} - ${playerName} {spell:${skill.id}} - level ${level}`;
									}

									entries.push(result);
									break;
								}
							}
						}
						return entries;
					},
					args: [playerName, trackedSkills]
				}).then(function (results) {
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
