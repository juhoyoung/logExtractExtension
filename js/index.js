import {classInfo} from '../init/classInfo.js';
import {defaultSkills} from '../init/defaultSkills.js';

document.addEventListener('DOMContentLoaded', function () {
    const skillsByClassElement = document.getElementById('skillsByClass');
    const addSkillBtn = document.getElementById('addSkill');
    const cancelEditBtn = document.getElementById('cancelEdit');
    const editingIndicator = document.getElementById('editingIndicator');
    const editingSkillName = document.getElementById('editingSkillName');
    const skillTextArea = document.getElementById('skillTextArea');
    const showExportBtn = document.getElementById('showExport');
    const showImportBtn = document.getElementById('showImport');
    const executeBtn = document.getElementById('executeSkillJsonAction');
    const skillJsonContainer = document.getElementById('skillJsonContainer');
    const displayCheckbox = document.getElementById('optionAppendDisplay');
    const translateCheckbox = document.getElementById('optionTranslate');

    let currentMode = null; // 'export' or 'import'

    let isEditing = false;
    let editingSkillId = null;

    let collapsedSections = {};
    let toggleListenersInitialized = false; // 전역 토글 리스너 초기화 여부 추적

    // 지원 직업 코드 목록 추출
    const exportClassSelect = document.getElementById('exportClassSelect');

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
            addSkillBtn.textContent = t('btn_edit_complete');
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
        addSkillBtn.textContent = t('btn_add');
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
                skillsByClassElement.innerHTML = `<div class="empty-state">${t('empty_skills')}</div>`;
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
                        <span class="skill-count">${t('skill_count', [classSkills.length])}</span>
                    </div>
                    <span class="class-toggle collapsed">▼</span>
                </div>
                
                <div class="skills-container collapsed" data-skills="${className}">
                    <div class="skill-header">
                        <div class="skill-col-check">
                            <button class="toggle-all" data-toggle-all="${className}">${t('btn_toggle_all')}</button>
                        </div>
                        <div class="skill-col">${t('col_name_display')}</div>
                        <div class="skill-col">${t('col_id')}</div>
                        <div class="skill-col">${t('col_english')}</div>
                        <div class="skill-col">${t('col_korean')}</div>
                        <div class="skill-col">${t('col_spell_id_extract')}</div>
                        <div class="actions-col">${t('col_actions')}</div>
                    </div>
                    ${classSkills.map(skill => `
                    <div class="skill-item ${isEditing && editingSkillId === skill.id ? 'editing' : ''}">
                        <div class="skill-col-check">
                            <input type="checkbox" ${skill.enabled ? 'checked' : ''} data-id="${skill.id}" id="c${skill.id}" class="enabled-toggle"/>
                        </div>
                        <div class="skill-col">
                            <label for="c${skill.id}">
                                <strong data-label-for="${skill.id}">${skill.display}</strong>
                            </label>
                        </div>
                        <div class="skill-col">
                            <span class="skill-col">${skill.id}</span>
                        </div>
                        <div class="skill-col">${skill.en || 'N/A'}</div>
                        <div class="skill-col">${skill.ko || 'N/A'}</div>
                        <div class="skill-col">
                            <input type="checkbox" ${skill.extractBySpellId ? 'checked' : ''} data-extract="${skill.id}"/>
                        </div>
                        <div class="actions-col">
                            <button data-edit="${skill.id}">${t('btn_edit')}</button>
                            <button data-remove="${skill.id}">${t('btn_delete')}</button>
                        </div>
                    </div>
                    `).join('')}
                </div>
        `;
                skillsByClassElement.appendChild(classSection);
            }

            // 토글 이벤트 리스너 추가 (중복 방지)
            restoreCollapseStateThenBind();
        });
    }

    function applyCollapsedState() {
        const headers = document.querySelectorAll('.class-header');
        headers.forEach(header => {
            const className = header.dataset.class;
            const container = document.querySelector(`[data-skills="${className}"]`);
            const toggle = header.querySelector('.class-toggle');
            if (!container || !toggle) return;

            // 저장된 값이 true면 접힘, false면 펼침. (undefined면 템플릿 기본 상태 유지)
            const state = collapsedSections[className];
            if (state === true) {
                container.classList.add('collapsed');
                toggle.classList.add('collapsed');
                toggle.textContent = '▶'; // 접힘 표시
            } else if (state === false) {
                container.classList.remove('collapsed');
                toggle.classList.remove('collapsed');
                toggle.textContent = '▼'; // 펼침 표시
            }
        });
    }

    function restoreCollapseStateThenBind() {
        chrome.storage.local.get('collapsedSections', data => {
            collapsedSections = data.collapsedSections || {};
            applyCollapsedState();

            // 전역 토글 리스너는 한 번만 초기화
            if (!toggleListenersInitialized) {
                addGlobalToggleListener();
                toggleListenersInitialized = true;
            }
        });
    }

    // 이벤트 위임을 사용한 전역 토글 리스너
    function addGlobalToggleListener() {
        document.addEventListener('click', function(e) {
            const header = e.target.closest('.class-header');
            if (!header) return;

            const className = header.dataset.class;
            const skillsContainer = document.querySelector(`[data-skills="${className}"]`);
            const toggle = header.querySelector('.class-toggle');
            if (!skillsContainer || !toggle) return;

            // 현재 상태 기준으로 "이후 상태"를 명확히 계산
            const willCollapse = !skillsContainer.classList.contains('collapsed'); // 펼쳐진 상태면 접히도록

            skillsContainer.classList.toggle('collapsed', willCollapse);
            toggle.classList.toggle('collapsed', willCollapse);
            toggle.textContent = willCollapse ? '▶' : '▼';

            // ☆ 섹션별로 상태 저장
            collapsedSections[className] = willCollapse;
            chrome.storage.local.set({ collapsedSections });
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
            if (confirm(t('confirm_delete'))) {
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

        // ID 기준
        if (e.target.dataset.extract) {
            const id = e.target.dataset.extract;
            chrome.storage.local.get('trackedSkills', (data) => {
                const skills = data.trackedSkills || {};
                if (skills[id]) {
                    skills[id].extractBySpellId = e.target.checked;
                    chrome.storage.local.set({trackedSkills: skills});
                }
            });
        }

        // 전체 토글
        const toggleAllClass = e.target.dataset.toggleAll;
        if (toggleAllClass) {
            const container = document.querySelector(`[data-skills="${toggleAllClass}"]`);
            if (!container) return;

            const checkboxes = container.querySelectorAll('.enabled-toggle');
            const allChecked = [...checkboxes].every(cb => cb.checked);

            chrome.storage.local.get('trackedSkills', (data) => {
                const skills = data.trackedSkills || {};

                checkboxes.forEach(cb => {
                    cb.checked = !allChecked;
                    const id = cb.dataset.id;
                    if (skills[id]) {
                        skills[id].enabled = !allChecked;
                    }
                });
                chrome.storage.local.set({trackedSkills: skills});
            });
        }
    });

    // 추가/수정 버튼 이벤트
    addSkillBtn.addEventListener('click', () => {
        const classCode = document.getElementById('classSelect').value.trim();
        const id = document.getElementById('spellId').value.trim();
        let displayName = document.getElementById('displayName').value.trim();
        const en = document.getElementById('englishName').value.trim();
        const ko = document.getElementById('koreanName').value.trim();

        // 필수 필드 검증
        if (!classCode) {
            alert(t('alert_select_class'));
            return;
        }

        if (!id) {
            alert(t('alert_spell_id_required'));
            return;
        }

        if (!/^\d+$/.test(id)) {
            alert(t('alert_spell_id_numeric'));
            return;
        }

        if (!en && !ko) {
            alert(t('alert_name_required'));
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
                if (!confirm(t('confirm_duplicate_id'))) {
                    return;
                }
            }

            skills[id] = {
                display: displayName,
                en: en || '',
                ko: ko || '',
                enabled: true,
                class: classCode,
                extractBySpellId: false
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

    // textarea 열기 및 모드 설정
    function openSkillJsonArea(mode) {
        currentMode = mode;
        skillJsonContainer.style.display = 'block';
        skillTextArea.value = '';

        if (mode === 'export') {
            skillTextArea.placeholder = t('placeholder_export');
            chrome.storage.local.get('trackedSkills', (data) => {
                const skills = data.trackedSkills || {};
                const selectedClass = exportClassSelect.value;

                const filteredSkills = {};
                for (const [id, skill] of Object.entries(skills)) {
                    if (!selectedClass || skill.class === selectedClass) {
                        filteredSkills[id] = skill;
                    }
                }

                const skillJson = JSON.stringify(filteredSkills, null, 2);
                skillTextArea.value = skillJson;

                navigator.clipboard.writeText(skillJson)
                    .then(() => {
                        alert(t('alert_clipboard_copied'));
                    })
                    .catch(err => {
                        console.error('클립보드 복사 실패:', err);
                    });
            });
        } else if (mode === 'import') {
            skillTextArea.placeholder = t('placeholder_import');
        }
    }

    // 버튼 이벤트 연결
    showExportBtn.addEventListener('click', () => openSkillJsonArea('export'));
    showImportBtn.addEventListener('click', () => openSkillJsonArea('import'));

    // 실행 버튼 동작
    executeBtn.addEventListener('click', () => {
        if (currentMode === 'export') {
            chrome.storage.local.get('trackedSkills', (data) => {
                const skills = data.trackedSkills || {};
                const selectedClass = exportClassSelect.value;

                const filteredSkills = {};
                for (const [id, skill] of Object.entries(skills)) {
                    if (!selectedClass || skill.class === selectedClass) {
                        filteredSkills[id] = skill;
                    }
                }

                const skillJson = JSON.stringify(filteredSkills, null, 2);
                skillTextArea.value = skillJson;

                navigator.clipboard.writeText(skillJson)
                    .then(() => {
                        alert(t('alert_clipboard_copied'));
                    })
                    .catch(err => {
                        console.error('클립보드 복사 실패:', err);
                    });
            });

        } else if (currentMode === 'import') {
            const input = skillTextArea.value.trim();
            if (!input) {
                alert(t('alert_no_input'));
                return;
            }

            try {
                const parsed = JSON.parse(input);
                const validClasses = Object.keys(classInfo);

                const cleanedSkills = {};

                for (const [key, skill] of Object.entries(parsed)) {
                    if (!/^\d+$/.test(key)) {
                        throw new Error(t('alert_invalid_id', [key]));
                    }
                    if (
                        typeof skill.display !== 'string' ||
                        typeof skill.class !== 'string' ||
                        !validClasses.includes(skill.class)
                    ) {
                        throw new Error(t('alert_invalid_skill', [key]));
                    }

                    // en/ko 정리
                    const cleanedEn = skill.en.trim();
                    const cleanedKo = skill.ko.trim();

                    cleanedSkills[key] = {
                        display: skill.display,
                        en: cleanedEn,
                        ko: cleanedKo,
                        enabled: skill.enabled !== false,
                        class: skill.class,
                        extractBySpellId: skill.extractBySpellId !== false
                    };
                }

                // 기존 trackedSkills 가져와 병합 처리
                chrome.storage.local.get('trackedSkills', (data) => {
                    const currentSkills = data.trackedSkills || {};
                    let hasConflict = false;

                    for (const id of Object.keys(cleanedSkills)) {
                        if (currentSkills.hasOwnProperty(id)) {
                            hasConflict = true;
                            break;
                        }
                    }

                    const applyMerge = () => {
                        const merged = {...currentSkills, ...cleanedSkills};
                        chrome.storage.local.set({trackedSkills: merged}, () => {
                            alert(t('alert_import_success'));
                            exitEditMode();
                            loadSkills();
                        });
                    };

                    if (hasConflict) {
                        const confirmOverwrite = confirm(t('confirm_overwrite'));
                        if (confirmOverwrite) {
                            applyMerge(); // 덮어쓰기 허용 → 병합
                        } else {
                            // 기존 ID는 유지하고 새로운 ID만 추가
                            for (const [id, skill] of Object.entries(cleanedSkills)) {
                                if (!currentSkills.hasOwnProperty(id)) {
                                    currentSkills[id] = skill;
                                }
                            }
                            chrome.storage.local.set({trackedSkills: currentSkills}, () => {
                                alert(t('alert_new_skills_only'));
                                exitEditMode();
                                loadSkills();
                            });
                        }
                    } else {
                        applyMerge(); // 중복 없음 → 병합
                    }
                });

            } catch (e) {
                alert(t('error_prefix', [e.message]));
            }
        }
    });

    // 수정 취소 버튼 이벤트
    cancelEditBtn.addEventListener('click', () => {
        exitEditMode();
    });

    // 추출 옵션 불러오기
    chrome.storage.local.get(['exportOptions'], (data) => {
        const opts = data.exportOptions || {};
        displayCheckbox.checked = opts.appendDisplay || false;
        translateCheckbox.checked = opts.translatePage || false;
    });

    // 추출 옵션 변경 시 저장
    [displayCheckbox, translateCheckbox].forEach(cb => {
        cb.addEventListener('change', () => {
            chrome.storage.local.set({
                exportOptions: {
                    appendDisplay: displayCheckbox.checked,
                    translatePage: translateCheckbox.checked
                }
            });
        });
    });

    // 초기 로드
    loadSkills();
});