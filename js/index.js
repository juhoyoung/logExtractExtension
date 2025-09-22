import { StorageManager } from '/js/storageManager.js';
import { SkillRenderer } from '/js/skillRenderer.js';
import { CollapseManager } from '/js/collapseManager.js';
import { ImportExportManager } from '/js/importExportManager.js';
import { defaultSkills } from '/init/defaultSkills.js'
import { classInfo } from '/init/classInfo.js';

document.addEventListener('DOMContentLoaded', function () {
    // DOM 요소들
    const skillsByClassElement = document.getElementById('skillsByClass');
    const addSkillBtn = document.getElementById('addSkill');
    const cancelEditBtn = document.getElementById('cancelEdit');
    const editingIndicator = document.getElementById('editingIndicator');
    const editingSkillName = document.getElementById('editingSkillName');
    const skillTextArea = document.getElementById('skillTextArea');
    const showExportBtn = document.getElementById('showExport');
    const showImportBtn = document.getElementById('showImport');
    const resetListBtn = document.getElementById('resetList');
    const executeBtn = document.getElementById('executeSkillJsonAction');
    const hideBtn = document.getElementById('HideSkillTextAreaContainer');
    const skillJsonContainer = document.getElementById('skillJsonContainer');
    const displayCheckbox = document.getElementById('optionAppendDisplay');
    const translateCheckbox = document.getElementById('optionTranslate');
    const exportClassSelect = document.getElementById('exportClassSelect');

    const classSelect = document.getElementById('classSelect');
    const specSelect = document.getElementById('specSelect');

    const toggleAllBtn = document.getElementById('toggleAllSkills');

    // 매니저 인스턴스 생성
    const skillRenderer = new SkillRenderer(skillsByClassElement);
    const collapseManager = new CollapseManager();
    const importExportManager = new ImportExportManager(skillTextArea, skillJsonContainer, exportClassSelect);

    // 상태 관리
    let isEditing = false;
    let editingSkillId = null;


    toggleAllBtn.addEventListener('click', async () => {
        const skills = await StorageManager.getSkills();
        const skillArray = Object.entries(skills);

        if (skillArray.length === 0) return;

        // 현재 전체가 켜져있는지 확인
        const allChecked = skillArray.every(([id, skill]) => skill.enabled);

        // 반대로 토글할 상태
        const newState = !allChecked;

        skillArray.forEach(([id, skill]) => {
            skill.enabled = newState;
        });

        await StorageManager.saveSkills(skills);
        await loadSkills(); // UI 갱신
    });

    // 활성 스킬 현황을 업데이트하는 함수
    function updateActiveSkillsStatus(skills) {
        const statusContent = document.getElementById('activeSkillsStatus');
        const totalActiveCount = document.getElementById('totalActiveCount');
        const totalActiveDisplay = document.getElementById('totalActiveDisplay');

        // 활성화된 스킬만 필터링하고 클래스별, 특성별로 그룹화
        const activeSkills = Object.entries(skills).filter(([id, skill]) => skill.enabled);
        const groupedSkills = {};

        activeSkills.forEach(([id, skill]) => {
            const className = skill.class || 'UNKNOWN';
            const specName = skill.spec || 'General';

            if (!groupedSkills[className]) {
                groupedSkills[className] = {};
            }
            if (!groupedSkills[className][specName]) {
                groupedSkills[className][specName] = 0;
            }
            groupedSkills[className][specName]++;
        });

        const totalCount = activeSkills.length;

        if (totalActiveCount) {
            totalActiveCount.textContent = `${t('skill_count',[totalCount])}`;
        }
        if (totalActiveDisplay) {
            totalActiveDisplay.innerHTML = `${t('all_active_skills')}: <strong>${t('skill_count',[totalCount])}</strong>`;
        }

        if (!statusContent) return;

        if (totalCount === 0) {
            statusContent.innerHTML = `<div class="no-active-skills">${t('status_no_skills_active')}</div>`;
            return;
        }

        // 결과 HTML 생성
        let html = '';
        Object.entries(groupedSkills).forEach(([className, specs]) => {
            let displayClassName; // = `${classInfo[className].korean} (${classInfo[className].english})` || className;

            if (i18n.detectBrowserLanguage() === 'ko') {
                displayClassName = `${classInfo[className].korean} (${classInfo[className].english})`;
            } else {
                displayClassName = classInfo[className].english;
            }

            html += `<div class="status-item">`;
            html += `<span class="status-class">${displayClassName}</span>`;

            Object.entries(specs).forEach(([specName, count]) => {
                html += `<span class="status-spec">${specName}</span>`;
                html += `<span class="status-count">${t('skill_count',[count])}</span>`;
            });

            html += `</div>`;
        });

        statusContent.innerHTML = html;
    }

    // 기본 스킬 초기화
    async function initializeDefaultSkills() {

        const isFirstInstall = !(await StorageManager.keyExists('extractedSkills'));

        if (isFirstInstall) {
            await StorageManager.saveSkills(defaultSkills);
            await loadSkills();
            return true; // UI 재호출 필요
        }

        return false; // 스킬 비움과 상관없이 더 이상 덮어쓰기 안 함
    }

    // 클래스 선택 시 특성 옵션 채우기
    classSelect.addEventListener('change', () => {
        const selectedClass = classSelect.value;

        specSelect.innerHTML = '';
        if (classInfo[selectedClass]?.specs) {
            for (const spec of classInfo[selectedClass].specs) {
                const opt = document.createElement('option');

                let displayName;
                if (spec) {
                    if (i18n.detectBrowserLanguage() === 'ko') {
                        displayName = `${spec.ko} (${spec.en})`;
                    } else {
                        displayName = spec.en;
                    }
                } else {
                    displayName = "General";
                }


                opt.value = spec.en;
                opt.textContent = displayName;
                specSelect.appendChild(opt);
                specSelect.value = "General";
                specSelect.disabled = false;
            }
        }
    });

    // 수정 모드 진입
    async function enterEditMode(skillId) {
        const skills = await StorageManager.getSkills();
        const skill = skills[skillId];
        if (!skill) return;

        isEditing = true;
        editingSkillId = skillId;

        classSelect.value = skill.class || '';
        classSelect.dispatchEvent(new Event('change')); // 특성 채우기
        specSelect.value = skill.spec || 'General';
        document.getElementById('displayName').value = skill.display || '';
        document.getElementById('spellId').value = skillId;
        document.getElementById('englishName').value = skill.en || '';
        document.getElementById('koreanName').value = skill.ko || '';

        addSkillBtn.textContent = t('btn_edit_complete');
        cancelEditBtn.style.display = 'inline-block';
        editingIndicator.style.display = 'block';
        editingSkillName.textContent = skill.display;

        document.getElementById('spellId').disabled = true;

        await loadSkills();
    }

    // 수정 모드 종료
    function exitEditMode() {
        isEditing = false;
        editingSkillId = null;

        classSelect.value = '';
        specSelect.innerHTML = '';
        document.getElementById('displayName').value = '';
        document.getElementById('spellId').value = '';
        document.getElementById('englishName').value = '';
        document.getElementById('koreanName').value = '';

        addSkillBtn.textContent = t('btn_add');
        cancelEditBtn.style.display = 'none';
        editingIndicator.style.display = 'none';

        document.getElementById('spellId').disabled = false;

        loadSkills();
    }

    // 스킬 로드
    async function loadSkills() {
        const skills = await StorageManager.getSkills();
        if (await initializeDefaultSkills(skills)) return;

        skillRenderer.renderSkills(skills, isEditing ? editingSkillId : null);

        // 활성 스킬 현황 업데이트
        updateActiveSkillsStatus(skills);

        // 접기/펼치기 상태 복원
        await collapseManager.initialize();
        await collapseManager.applyCollapsedState();
    }

    // 스킬 관련 이벤트 처리
    skillsByClassElement.addEventListener('click', async (e) => {
        // 수정 버튼 클릭
        const editId = e.target.dataset.edit;
        if (editId) {
            await enterEditMode(editId);
            return;
        }

        // 삭제 버튼 클릭
        const removeId = e.target.dataset.remove;
        if (removeId) {
            if (confirm(t('confirm_delete'))) {
                await StorageManager.removeSkill(removeId);

                // 수정 중인 스킬이 삭제된 경우 수정 모드 종료
                if (isEditing && editingSkillId === removeId) {
                    exitEditMode();
                } else {
                    await loadSkills();
                }
            }
            return;
        }

        // 체크박스 변경 (enabled)
        if (e.target.type === 'checkbox' && e.target.dataset.id) {
            const id = e.target.dataset.id;
            await StorageManager.updateSkillEnabled(id, e.target.checked);

            // 활성 스킬 현황 업데이트
            setTimeout(async () => {
                const skills = await StorageManager.getSkills();
                updateActiveSkillsStatus(skills);
            }, 100);

            return;
        }

        // 체크박스 변경 (extractBySpellId)
        if (e.target.dataset.extract) {
            const id = e.target.dataset.extract;
            await StorageManager.updateSkillExtractBySpellId(id, e.target.checked);
            return;
        }

        const toggleAllSpec = e.target.dataset.toggleAll;
        if (toggleAllSpec) {
            const container = document.querySelector(`[data-spec-skills="${toggleAllSpec}"]`);
            if (!container) return;

            const checkboxes = container.querySelectorAll('.enabled-toggle');
            const allChecked = [...checkboxes].every(cb => cb.checked);
            const newState = !allChecked;

            const skills = await StorageManager.getSkills();
            const promises = [];

            checkboxes.forEach(cb => {
                cb.checked = newState;

                const id = cb.dataset.id;
                if (skills[id]) {
                    skills[id].enabled = newState;
                }
            });

            await StorageManager.saveSkills(skills);
            await Promise.all(promises);

            // 활성 스킬 현황 업데이트
            updateActiveSkillsStatus(skills);
        }
    });

    // 추가/수정 버튼 이벤트
    addSkillBtn.addEventListener('click', async () => {
        const classCode = classSelect.value.trim();
        const spec = specSelect.value.trim() || 'General';
        const id = document.getElementById('spellId').value.trim();
        let displayName = document.getElementById('displayName').value.trim();
        const en = document.getElementById('englishName').value.trim();
        const ko = document.getElementById('koreanName').value.trim();

        if (!classCode) { alert(t('alert_select_class')); return; }
        if (!id) { alert(t('alert_spell_id_required')); return; }
        if (!/^\d+$/.test(id)) { alert(t('alert_spell_id_numeric')); return; }
        if (!en) { alert(t('alert_name_required')); return; }

        if (!displayName) displayName = en || ko;

        const skills = await StorageManager.getSkills();

        // 기본값은 신규 추가용
        let enabled = true;
        let extractBySpellId = false;

        // 수정 모드일 경우 기존 값 유지
        if (isEditing && skills[id]) {
            enabled = skills[id].enabled ?? true;
            extractBySpellId = skills[id].extractBySpellId ?? false;
        }

        const skillData = {
            display: displayName,
            en: en || '',
            ko: ko || '',
            enabled,
            class: classCode,
            spec: spec || 'General',
            extractBySpellId
        };

        await StorageManager.addSkill(id, skillData);

        if (isEditing) {
            exitEditMode();
        } else {
            classSelect.value = '';
            specSelect.innerHTML = '';
            document.getElementById('displayName').value = '';
            document.getElementById('spellId').value = '';
            document.getElementById('englishName').value = '';
            document.getElementById('koreanName').value = '';
            await loadSkills();
        }
    });

    // 수정 취소 버튼 이벤트
    cancelEditBtn.addEventListener('click', () => {
        exitEditMode();
    });

    // 가져오기/내보내기 이벤트
    showExportBtn.addEventListener('click', () => {
        importExportManager.openSkillJsonArea('export');
    });

    showImportBtn.addEventListener('click', () => {
        importExportManager.openSkillJsonArea('import');
    });

    resetListBtn.addEventListener('click', async () => {
        const confirmReset = confirm(t('confirmResetSkills'));

        if (!confirmReset) return;

        const success = await StorageManager.resetSkills();

        if (success) {
            await loadSkills();
            alert(t('resetSkillsCompleted'));
        }
    });



    executeBtn.addEventListener('click', async () => {
        const success = await importExportManager.executeAction();
        await exitEditMode();
        //await loadSkills();
    });
    hideBtn.addEventListener('click', async () => {
        importExportManager.hideSkillContainer();
    });

    // 추출 옵션 초기화 및 이벤트
    async function initializeExportOptions() {
        const opts = await StorageManager.getExportOptions();
        displayCheckbox.checked = opts.appendDisplay || false;
        translateCheckbox.checked = opts.translatePage || false;
    }

    [displayCheckbox, translateCheckbox].forEach(cb => {
        cb.addEventListener('change', async () => {
            await StorageManager.saveExportOptions({
                appendDisplay: displayCheckbox.checked,
                translatePage: translateCheckbox.checked
            });
        });
    });

    // 초기화
    async function initialize() {
        await initializeExportOptions();
        await loadSkills();
    }

    initialize();
});