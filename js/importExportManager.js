import { StorageManager } from './storageManager.js';
import { classInfo } from '/init/classInfo.js';

export class ImportExportManager {
    constructor(skillTextArea, skillJsonContainer, exportClassSelect) {
        this.skillTextArea = skillTextArea;
        this.skillJsonContainer = skillJsonContainer;
        this.exportClassSelect = exportClassSelect;
        this.currentMode = null;
    }

    openSkillJsonArea(mode) {
        this.currentMode = mode;
        this.skillJsonContainer.style.display = 'block';
        this.skillTextArea.value = '';

        if (mode === 'export') {
            this._handleExportMode();
        } else if (mode === 'import') {
            this.skillTextArea.placeholder = t('placeholder_import');
        }
    }

    async _handleExportMode() {
        this.skillTextArea.placeholder = t('placeholder_export');
        const skills = await StorageManager.getSkills();
        const selectedClass = this.exportClassSelect.value;

        const filteredSkills = this._filterSkillsByClass(skills, selectedClass);
        const skillJson = JSON.stringify(filteredSkills, null, 2);
        this.skillTextArea.value = skillJson;

        try {
            await navigator.clipboard.writeText(skillJson);
            alert(t('alert_clipboard_copied'));
        } catch (err) {
            console.error('클립보드 복사 실패:', err);
        }
    }

    _filterSkillsByClass(skills, selectedClass) {
        const filteredSkills = {};
        for (const [id, skill] of Object.entries(skills)) {
            if (!selectedClass || skill.class === selectedClass) {
                filteredSkills[id] = skill;
            }
        }
        return filteredSkills;
    }

    async executeAction() {
        if (this.currentMode === 'export') {
            await this._executeExport();
        } else if (this.currentMode === 'import') {
            await this._executeImport();
        }
    }

    async _executeExport() {
        const skills = await StorageManager.getSkills();
        const selectedClass = this.exportClassSelect.value;
        const filteredSkills = this._filterSkillsByClass(skills, selectedClass);
        const skillJson = JSON.stringify(filteredSkills, null, 2);

        this.skillTextArea.value = skillJson;

        try {
            await navigator.clipboard.writeText(skillJson);
            alert(t('alert_clipboard_copied'));
        } catch (err) {
            console.error('클립보드 복사 실패:', err);
        }
    }

    async _executeImport() {
        const input = this.skillTextArea.value.trim();
        if (!input) {
            alert(t('alert_no_input'));
            return;
        }

        try {
            const parsed = JSON.parse(input);
            const cleanedSkills = this._validateAndCleanSkills(parsed);
            await this._mergeSkills(cleanedSkills);
        } catch (e) {
            alert(t('error_prefix', [e.message]));
        }
    }

    _validateAndCleanSkills(parsed) {
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

        return cleanedSkills;
    }

    async _mergeSkills(cleanedSkills) {
        const currentSkills = await StorageManager.getSkills();
        let hasConflict = false;

        for (const id of Object.keys(cleanedSkills)) {
            if (currentSkills.hasOwnProperty(id)) {
                hasConflict = true;
                break;
            }
        }

        const applyMerge = async () => {
            const merged = {...currentSkills, ...cleanedSkills};
            await StorageManager.saveSkills(merged);
            alert(t('alert_import_success'));
            return true; // 성공 표시
        };

        if (hasConflict) {
            const confirmOverwrite = confirm(t('confirm_overwrite'));
            if (confirmOverwrite) {
                return await applyMerge();
            } else {
                // 기존 ID는 유지하고 새로운 ID만 추가
                for (const [id, skill] of Object.entries(cleanedSkills)) {
                    if (!currentSkills.hasOwnProperty(id)) {
                        currentSkills[id] = skill;
                    }
                }
                await StorageManager.saveSkills(currentSkills);
                alert(t('alert_new_skills_only'));
                return true; // 성공 표시
            }
        } else {
            return await applyMerge();
        }
    }
}