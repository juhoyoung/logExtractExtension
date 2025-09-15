import { StorageManager } from '/js/storageManager.js';
import { SkillRenderer } from '/js/skillRenderer.js';
import { CollapseManager } from '/js/collapseManager.js';
import { ImportExportManager } from '/js/importExportManager.js';
import { defaultSkills } from '/init/defaultSkills.js';

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
    const executeBtn = document.getElementById('executeSkillJsonAction');
    const skillJsonContainer = document.getElementById('skillJsonContainer');
    const displayCheckbox = document.getElementById('optionAppendDisplay');
    const translateCheckbox = document.getElementById('optionTranslate');
    const exportClassSelect = document.getElementById('exportClassSelect');

    // 매니저 인스턴스 생성
    const skillRenderer = new SkillRenderer(skillsByClassElement);
    const collapseManager = new CollapseManager();
    const importExportManager = new ImportExportManager(skillTextArea, skillJsonContainer, exportClassSelect);

    // 상태 관리
    let isEditing = false;
    let editingSkillId = null;

    // 기본 스킬 초기화
    async function initializeDefaultSkills(skills) {
        if (Object.keys(skills).length === 0) {
            await StorageManager.saveSkills(defaultSkills);
            await loadSkills();
            return true;
        }
        return false;
    }

    // 수정 모드 진입
    async function enterEditMode(skillId) {
        const skills = await StorageManager.getSkills();
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

        // Spell ID 필드 비활성화
        document.getElementById('spellId').disabled = true;

        await loadSkills();
    }

    // 수정 모드 종료
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

        loadSkills();
    }

    // 스킬 로드
    async function loadSkills() {
        const skills = await StorageManager.getSkills();
        if (await initializeDefaultSkills(skills)) return;

        skillRenderer.renderSkills(skills, isEditing ? editingSkillId : null);

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
            return;
        }

        // 체크박스 변경 (extractBySpellId)
        if (e.target.dataset.extract) {
            const id = e.target.dataset.extract;
            await StorageManager.updateSkillExtractBySpellId(id, e.target.checked);
            return;
        }

        // 전체 토글
        const toggleAllClass = e.target.dataset.toggleAll;
        if (toggleAllClass) {
            const container = document.querySelector(`[data-skills="${toggleAllClass}"]`);
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
                    promises.push(StorageManager.updateSkillEnabled(id, newState));
                }
            });

            await Promise.all(promises);
        }
    });

    // 추가/수정 버튼 이벤트
    addSkillBtn.addEventListener('click', async () => {
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

        // 중복 확인 (수정 모드가 아닐 때만)
        if (!isEditing) {
            const skills = await StorageManager.getSkills();
            if (skills[id] && !confirm(t('confirm_duplicate_id'))) {
                return;
            }
        }

        const skillData = {
            display: displayName,
            en: en || '',
            ko: ko || '',
            enabled: true,
            class: classCode,
            extractBySpellId: false
        };

        await StorageManager.addSkill(id, skillData);

        if (isEditing) {
            exitEditMode();
        } else {
            // 입력 필드 초기화 (추가 모드일 때만)
            document.getElementById('classSelect').value = '';
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

    executeBtn.addEventListener('click', async () => {
        const success = await importExportManager.executeAction();
        if (success) {
            exitEditMode();
            await loadSkills();
        }
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