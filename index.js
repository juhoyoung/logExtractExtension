import { classInfo } from './classInfo.js';
import { defaultSkills } from './defaultSkills.js';

document.addEventListener('DOMContentLoaded', function () {
    const skillsByClassElement = document.getElementById('skillsByClass');
    const addSkillBtn = document.getElementById('addSkill');
    const cancelEditBtn = document.getElementById('cancelEdit');
    const editingIndicator = document.getElementById('editingIndicator');
    const editingSkillName = document.getElementById('editingSkillName');

    let isEditing = false;
    let editingSkillId = null;


    function initializeDefaultSkills(skills) {
        if (Object.keys(skills).length === 0) {
            chrome.storage.local.set({trackedSkills: defaultSkills}, loadSkills);
            return true;
        }
        return false;
    }

    function enterEditMode(skillId) {
        chrome.storage.local.get('trackedSkills', (data) => {
            const skills = data.trackedSkills || {};
            const skill = skills[skillId];
            if (!skill) return;

            isEditing = true;
            editingSkillId = skillId;

            // 폼에 기존 데이터 채우기
            document.getElementById('classSelect').value = skill.class || '';
            document.getElementById('displayName').value = skill.display || '';
            document.getElementById('spellId').value = skillId;
            document.getElementById('englishName').value = skill.en || '';
            document.getElementById('koreanName').value = skill.ko || '';

            // UI 업데이트
            addSkillBtn.textContent = '수정 완료';
            cancelEditBtn.style.display = 'inline-block';
            editingIndicator.style.display = 'block';
            editingSkillName.textContent = skill.display;

            // Spell ID 필드 비활성화 (수정 시 변경 불가)
            document.getElementById('spellId').disabled = true;

            loadSkills(); // 수정 중인 항목 하이라이트를 위해 다시 로드
        });
    }

    function exitEditMode() {
        isEditing = false;
        editingSkillId = null;

        // 폼 초기화
        document.getElementById('classSelect').value = '';
        document.getElementById('displayName').value = '';
        document.getElementById('spellId').value = '';
        document.getElementById('englishName').value = '';
        document.getElementById('koreanName').value = '';

        // UI 복원
        addSkillBtn.textContent = '추가';
        cancelEditBtn.style.display = 'none';
        editingIndicator.style.display = 'none';

        // Spell ID 필드 활성화
        document.getElementById('spellId').disabled = false;

        loadSkills(); // 하이라이트 제거를 위해 다시 로드
    }

    function loadSkills() {
        chrome.storage.local.get('trackedSkills', (data) => {
            const skills = data.trackedSkills || {};
            if (initializeDefaultSkills(skills)) return;

            // 직업별로 스킬 분류
            const skillsByClass = {};
            for (const [id, skill] of Object.entries(skills)) {
                const className = skill.class || 'UNKNOWN';
                if (!skillsByClass[className]) {
                    skillsByClass[className] = [];
                }
                skillsByClass[className].push({id, ...skill});
            }

            // HTML 생성
            skillsByClassElement.innerHTML = '';

            if (Object.keys(skillsByClass).length === 0) {
                skillsByClassElement.innerHTML = '<div class="empty-state">등록된 스킬이 없습니다.</div>';
                return;
            }

            // 직업별로 정렬하여 표시
            const sortedClasses = Object.keys(skillsByClass).sort((a, b) => {
                if (a === 'UNKNOWN') return 1;
                if (b === 'UNKNOWN') return -1;
                return (classInfo[a]?.korean || a).localeCompare(classInfo[b]?.korean || b);
            });

            for (const className of sortedClasses) {
                const classSkills = skillsByClass[className];
                const classData = classInfo[className];
                const displayName = classData ?
                    `${classData.korean} (${classData.english})` :
                    className;

                const classSection = document.createElement('div');
                classSection.className = 'class-section';
                classSection.innerHTML = `
                <div class="class-header" data-class="${className}">
                    <div>
                        <span class="class-title">${displayName}</span>
                        <span class="skill-count">${classSkills.length}개</span>
                    </div>
                    <span class="class-toggle">▼</span>
                </div>
                <div class="skill-header">
                    <div class="skill-col">
                        <button class="toggle-all" data-toggle-all="${className}">전체</button>
                    </div>
                    <div class="skill-col">이름</div>
                    <div class="skill-col">ID</div>
                    <div class="skill-col">영어명</div>
                    <div class="skill-col">한글명</div>
                    <div class="actions-col">작업</div>
                </div>
                <div class="skills-container" data-skills="${className}">
                    ${classSkills.map(skill => `
                    <div class="skill-item ${isEditing && editingSkillId === skill.id ? 'editing' : ''}">
                        <div class="skill-col">
                            <input type="checkbox" ${skill.enabled ? 'checked' : ''} data-id="${skill.id}" />
                        </div>
                        <div class="skill-col">
                            <strong data-label-for="${skill.id}">${skill.display}</strong>
                        </div>
                        <div class="skill-col">
                            <span class="skill-id">ID: ${skill.id}</span>
                        </div>
                        <div class="skill-col">${skill.en || 'N/A'}</div>
                        <div class="skill-col">${skill.ko || 'N/A'}</div>
                        <div class="actions-col">
                            <button data-edit="${skill.id}">수정</button>
                            <button data-remove="${skill.id}">삭제</button>
                        </div>
                    </div>
                    `).join('')}
                </div>
        `;
                skillsByClassElement.appendChild(classSection);
            }

            // 토글 이벤트 리스너 추가
            addToggleListeners();
        });
    }

    function addToggleListeners() {
        const classHeaders = document.querySelectorAll('.class-header');
        classHeaders.forEach(header => {
            header.addEventListener('click', function () {
                const className = this.dataset.class;
                const skillsContainer = document.querySelector(`[data-skills="${className}"]`);
                const toggle = this.querySelector('.class-toggle');

                if (skillsContainer.classList.contains('collapsed')) {
                    skillsContainer.classList.remove('collapsed');
                    toggle.classList.remove('collapsed');
                    toggle.textContent = '▼';
                } else {
                    skillsContainer.classList.add('collapsed');
                    toggle.classList.add('collapsed');
                    toggle.textContent = '▶';
                }
            });
        });
    }

    // 스킬 관련 이벤트 처리
    skillsByClassElement.addEventListener('click', (e) => {
        // 수정 버튼 클릭
        const editId = e.target.dataset.edit;
        if (editId) {
            enterEditMode(editId);
            return;
        }

        // 삭제 버튼 클릭
        const removeId = e.target.dataset.remove;
        if (removeId) {
            if (confirm('이 스킬을 삭제하시겠습니까?')) {
                chrome.storage.local.get('trackedSkills', (data) => {
                    const skills = data.trackedSkills || {};
                    delete skills[removeId];
                    chrome.storage.local.set({trackedSkills: skills}, () => {
                        // 수정 중인 스킬이 삭제된 경우 수정 모드 종료
                        if (isEditing && editingSkillId === removeId) {
                            exitEditMode();
                        } else {
                            loadSkills();
                        }
                    });
                });
            }
            return;
        }

        // 체크박스 변경
        if (e.target.type === 'checkbox') {
            const id = e.target.dataset.id;
            chrome.storage.local.get('trackedSkills', (data) => {
                const skills = data.trackedSkills || {};
                if (skills[id]) {
                    skills[id].enabled = e.target.checked;
                    chrome.storage.local.set({trackedSkills: skills});
                }
            });
        }

        // 전체 토글
        const toggleAllClass = e.target.dataset.toggleAll;
        if (toggleAllClass) {
            const container = document.querySelector(`[data-skills="${toggleAllClass}"]`);
            if (!container) return;

            const checkboxes = container.querySelectorAll('input[type="checkbox"]');
            const allChecked = [...checkboxes].every(cb => cb.checked);

            // 스토리지에서 현재 저장된 스킬 목록을 한 번만 가져옵니다.
            chrome.storage.local.get('trackedSkills', (data) => {
                const skills = data.trackedSkills || {};

                checkboxes.forEach(cb => {
                    cb.checked = !allChecked;
                    const id = cb.dataset.id;
                    if (skills[id]) {
                        skills[id].enabled = !allChecked; // 가져온 스킬 객체를 업데이트합니다.
                    }
                });
                // 모든 변경 사항을 한 번에 스토리지에 저장합니다.
                chrome.storage.local.set({trackedSkills: skills});
            });
        }
    });

    // 추가/수정 버튼 이벤트
    addSkillBtn.addEventListener('click', () => {
        const classCode = document.getElementById('classSelect').value.trim();
        const id = document.getElementById('spellId').value.trim();
        let displayName = document.getElementById('displayName').value.trim();
        const en = document.getElementById('englishName').value.replace(/\s/g, '').trim().toLowerCase();
        const ko = document.getElementById('koreanName').value.replace(/\s/g, '').trim();

        // 필수 필드 검증
        if (!classCode) {
            alert('직업을 선택해주세요.');
            return;
        }

        if (!id) {
            alert('Spell ID는 필수입니다.');
            return;
        }

        if (!en && !ko) {
            alert('영문명 또는 한글명 중 하나는 반드시 입력해야 합니다.');
            return;
        }

        // Display Name 자동 생성
        if (!displayName) {
            displayName = en || ko;
        }

        chrome.storage.local.get('trackedSkills', (data) => {
            const skills = data.trackedSkills || {};

            // 수정 모드가 아니고 중복 ID가 있는 경우 확인
            if (!isEditing && skills[id]) {
                if (!confirm('같은 Spell ID가 이미 존재합니다. 덮어쓰시겠습니까?')) {
                    return;
                }
            }

            skills[id] = {
                display: displayName,
                en: en || '',
                ko: ko || '',
                enabled: true,
                class: classCode
            };

            chrome.storage.local.set({trackedSkills: skills}, () => {
                if (isEditing) {
                    exitEditMode();
                } else {
                    // 입력 필드 초기화 (추가 모드일 때만)
                    document.getElementById('classSelect').value = '';
                    document.getElementById('displayName').value = '';
                    document.getElementById('spellId').value = '';
                    document.getElementById('englishName').value = '';
                    document.getElementById('koreanName').value = '';
                    loadSkills();
                }
            });
        });
    });

    // 수정 취소 버튼 이벤트
    cancelEditBtn.addEventListener('click', () => {
        exitEditMode();
    });

    // 초기 로드
    loadSkills();
});