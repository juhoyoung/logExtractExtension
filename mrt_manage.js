
document.addEventListener('DOMContentLoaded', function () {
    let allLines = [];
    let userDataMap = new Map();

    // 실제 시간 추출 함수 (정렬 기준 시간)
    function extractSortTime(line) {
        // {time:...} 패턴 찾기
        const timeBlockMatch = line.match(/\{time:([^}]+)\}/);
        if (!timeBlockMatch) return null;

        const timeContent = timeBlockMatch[1];

        // 동적 타이머 조건 확인 (SAR, SCC, SCS, SAA 등)
        const hasDynamicCondition = /,(SAR|SCC|SCS|SAA|p):/.test(timeContent);

        if (hasDynamicCondition) {
            // 동적 타이머가 있는 경우 } 다음의 실제 시간 사용
            const realTimeMatch = line.match(/\}(\d+:\d+)/);
            if (realTimeMatch) {
                return realTimeMatch[1];
            }
        } else {
            // 동적 타이머가 없는 경우 time: 안의 시간 사용
            // time:0:37 또는 time:00:27 형태에서 시간 부분만 추출
            const timeMatch = timeContent.match(/^(\d+:\d+)/);
            if (timeMatch) {
                return timeMatch[1];
            }
        }

        return null;
    }

    // 시간을 초 단위로 변환하는 함수
    function timeToSeconds(timeStr) {
        if (!timeStr) return 0;
        const parts = timeStr.split(':');
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }

    // 시간순 정렬 함수
    function sortByTime() {
        const inputText = document.getElementById('inputText').value.trim();
        if (!inputText) {
            alert('정렬할 MRT 텍스트를 입력해주세요.');
            return;
        }

        const lines = inputText.split('\n').filter(line => line.trim());

        // 시간 정보가 있는 라인과 없는 라인 분리
        const linesWithTime = [];
        const linesWithoutTime = [];

        lines.forEach(line => {
            const sortTime = extractSortTime(line);
            if (sortTime) {
                linesWithTime.push({
                    line: line,
                    time: sortTime,
                    seconds: timeToSeconds(sortTime)
                });
            } else {
                linesWithoutTime.push(line);
            }
        });

        // 시간순으로 정렬
        linesWithTime.sort((a, b) => a.seconds - b.seconds);

        // 정렬된 결과 합치기 (시간 있는 라인 + 시간 없는 라인)
        const sortedLines = linesWithTime.map(item => item.line).concat(linesWithoutTime);

        // 결과를 입력창에 다시 설정
        document.getElementById('inputText').value = sortedLines.join('\n');

        // 정렬 완료 알림
        alert(`시간순 정렬 완료!\n- 시간 정보 있는 라인: ${linesWithTime.length}개\n- 시간 정보 없는 라인: ${linesWithoutTime.length}개`);
    }


    // 단일 유저 아이디 추출 함수 (첫 번째 유저만)
    function extractUserId(line) {
        const dashIndex = line.indexOf(' - ');
        if (dashIndex === -1) return null;

        const afterDash = line.substring(dashIndex + 3);

        // 컬러 코드 패턴 확인
        const colorMatch = afterDash.match(/^\|c[a-fA-F0-9]{8}([^|]+)\|r/);
        if (colorMatch) {
            return colorMatch[1].trim();
        }

        // 일반 텍스트 패턴
        const textMatch = afterDash.match(/^([^\s{]+)/);
        if (textMatch) {
            return textMatch[1].trim();
        }

        return null;
    }

    // 유저 아이디 추출 함수 (한 줄에서 여러 유저 추출 가능)
    function extractUserIds(line) {
        const userIds = [];

        // 1. 먼저 - 이후의 텍스트 부분을 찾기
        const dashIndex = line.indexOf(' - ');
        if (dashIndex === -1) return userIds;

        const afterDash = line.substring(dashIndex + 3);

        // 2. - 바로 뒤에 오는 첫 번째 유저 (컬러 코드 또는 일반 텍스트)
        let remaining = afterDash;

        // 컬러 코드 패턴 확인 (- 바로 다음)
        const firstColorMatch = remaining.match(/^\|c[a-fA-F0-9]{8}([^|]+)\|r/);
        if (firstColorMatch) {
            userIds.push(firstColorMatch[1].trim());
            remaining = remaining.substring(firstColorMatch[0].length).trim();
        } else {
            // 일반 텍스트 패턴 (- 바로 다음, 공백이나 {까지)
            const firstTextMatch = remaining.match(/^([^\s{]+)/);
            if (firstTextMatch) {
                userIds.push(firstTextMatch[1].trim());
                remaining = remaining.substring(firstTextMatch[0].length).trim();
            }
        }

        // 3. 나머지 부분에서 추가 유저들 찾기
        // {spell:xxx} 패턴 뒤에 오는 유저들 찾기
        const spellPattern = /\{spell:\d+\}\s*([^\s{]+)/g;
        let spellMatch;

        while ((spellMatch = spellPattern.exec(remaining)) !== null) {
            const candidate = spellMatch[1].trim();
            // 이미 추가된 유저가 아니고, 컬러 코드가 아닌 경우만 추가
            if (candidate && !candidate.startsWith('|cff') && !userIds.includes(candidate)) {
                userIds.push(candidate);
            }
        }

        return userIds;
    }

    // 텍스트 분석 함수
    function analyzeText() {
        const inputText = document.getElementById('inputText').value.trim();
        if (!inputText) {
            alert('MRT 텍스트를 입력해주세요.');
            return;
        }

        allLines = inputText.split('\n').filter(line => line.trim());
        userDataMap.clear();

        // 각 라인에서 유저 아이디 추출 (여러 유저 가능)
        allLines.forEach((line, index) => {
            const userIds = extractUserIds(line);
            userIds.forEach(userId => {
                if (!userDataMap.has(userId)) {
                    userDataMap.set(userId, {
                        count: 0,
                        lines: []
                    });
                }
                userDataMap.get(userId).count++;
                userDataMap.get(userId).lines.push({
                    index: index,
                    content: line
                });
            });
        });

        displayUsers();
    }

    // 유저 목록 표시 함수
    function displayUsers() {
        const userSection = document.getElementById('userSection');
        const userGrid = document.getElementById('userGrid');
        const userStats = document.getElementById('userStats');
        const extractBtn = document.getElementById('extractBtn');

        if (userDataMap.size === 0) {
            userGrid.innerHTML = '<div class="empty-state">발견된 유저 아이디가 없습니다.</div>';
            userStats.innerHTML = '';
            userSection.style.display = 'block';
            return;
        }

        // 통계 정보 업데이트
        const totalLines = allLines.length;
        const linesWithUsers = Array.from(userDataMap.values()).reduce((sum, data) => sum + data.count, 0);
        userStats.innerHTML = `
                <div class="stat-item">전체 라인: ${totalLines}개</div>
                <div class="stat-item">유저 식별 라인: ${linesWithUsers}개</div>
                <div class="stat-item">발견된 유저: ${userDataMap.size}명</div>
            `;

        // 유저 목록을 발생 횟수 순으로 정렬
        const sortedUsers = Array.from(userDataMap.entries()).sort((a, b) => b[1].count - a[1].count);

        // 유저 목록 생성
        userGrid.innerHTML = sortedUsers.map(([userId, data]) => `
                <div class="user-item" data-user="${userId}">
                    <input type="checkbox" id="user_${userId}" data-user="${userId}">
                    <label for="user_${userId}" style="cursor: pointer; flex: 1;">${userId}</label>
                    <span class="user-count">${data.count}회</span>
                </div>
            `).join('');

        // 체크박스 이벤트 리스너 추가
        userGrid.addEventListener('change', updateExtractButton);
        userGrid.addEventListener('click', (e) => {
            if (e.target.classList.contains('user-item')) {
                const checkbox = e.target.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
                e.target.classList.toggle('selected', checkbox.checked);
                updateExtractButton();
            }
        });

        userSection.style.display = 'block';
        updateExtractButton();
    }

    // 추출 버튼 상태 업데이트
    function updateExtractButton() {
        const extractBtn = document.getElementById('extractBtn');
        const checkedBoxes = document.querySelectorAll('#userGrid input[type="checkbox"]:checked');
        extractBtn.disabled = checkedBoxes.length === 0;

        // 선택된 항목 시각적 표시 업데이트
        document.querySelectorAll('.user-item').forEach(item => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            item.classList.toggle('selected', checkbox.checked);
        });
    }

    // 선택된 유저들의 라인 추출
    function extractSelectedUsers() {
        const checkedBoxes = document.querySelectorAll('#userGrid input[type="checkbox"]:checked');
        const selectedUsers = Array.from(checkedBoxes).map(cb => cb.dataset.user);

        if (selectedUsers.length === 0) {
            alert('추출할 유저를 선택해주세요.');
            return;
        }

        const extractedLines = [];

        // 원본 순서를 유지하면서 선택된 유저의 라인만 추출
        allLines.forEach(line => {
            const userIds = extractUserIds(line); // 한 줄에서 여러 유저 추출
            // 선택된 유저 중 하나라도 포함되어 있으면 해당 라인 추가
            if (userIds.some(userId => selectedUsers.includes(userId))) {
                extractedLines.push(line);
            }
        });

        // 결과 표시
        const resultSection = document.getElementById('resultSection');
        const resultText = document.getElementById('resultText');
        const resultStats = document.getElementById('resultStats');
        const copyNotification = document.getElementById('copyNotification');

        const resultString = extractedLines.join('\n');
        resultText.value = resultString;

        // 통계 정보
        const selectedUserStats = selectedUsers.map(userId => {
            const data = userDataMap.get(userId);
            return `${userId}(${data.count})`;
        }).join(', ');

        resultStats.innerHTML = `
                <div class="stat-item">선택된 유저: ${selectedUsers.length}명</div>
                <div class="stat-item">추출된 라인: ${extractedLines.length}개</div>
                <div class="stat-item">유저별 라인수: ${selectedUserStats}</div>
            `;

        // 클립보드에 복사
        navigator.clipboard.writeText(resultString)
            .then(() => {
                copyNotification.style.display = 'block';
                setTimeout(() => {
                    copyNotification.style.display = 'none';
                }, 3000);
            })
            .catch(err => {
                console.error('클립보드 복사 실패:', err);
                alert('클립보드 복사에 실패했습니다.');
            });

        resultSection.style.display = 'block';
        resultSection.scrollIntoView({behavior: 'smooth'});
    }

    // 이벤트 리스너 등록
    document.getElementById('analyzeBtn').addEventListener('click', analyzeText);

    document.getElementById('clearBtn').addEventListener('click', () => {
        document.getElementById('inputText').value = '';
        document.getElementById('userSection').style.display = 'none';
        document.getElementById('resultSection').style.display = 'none';
    });

    document.getElementById('selectAllBtn').addEventListener('click', () => {
        document.querySelectorAll('#userGrid input[type="checkbox"]').forEach(cb => {
            cb.checked = true;
        });
        updateExtractButton();
    });

    document.getElementById('selectNoneBtn').addEventListener('click', () => {
        document.querySelectorAll('#userGrid input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        updateExtractButton();
    });

    document.getElementById('extractBtn').addEventListener('click', extractSelectedUsers);

    document.getElementById('sortBtn').addEventListener('click', sortByTime);
});