import { classInfo } from '/init/classInfo.js';

export class SkillRenderer {
    constructor(containerElement) {
        this.container = containerElement;
    }

    renderSkills(skills, editingSkillId = null) {
        // 직업별로 스킬 분류
        const skillsByClass = this._groupSkillsByClass(skills);

        // HTML 생성
        this.container.innerHTML = '';

        if (Object.keys(skillsByClass).length === 0) {
            this.container.innerHTML = `<div class="empty-state">${t('empty_skills')}</div>`;
            return;
        }

        // 직업별로 정렬하여 표시
        const sortedClasses = this._sortClasses(Object.keys(skillsByClass));

        for (const className of sortedClasses) {
            const classSkills = skillsByClass[className];
            const classSection = this._createClassSection(className, classSkills, editingSkillId);
            this.container.appendChild(classSection);
        }
    }

    _groupSkillsByClass(skills) {
        const skillsByClass = {};
        for (const [id, skill] of Object.entries(skills)) {
            const className = skill.class || 'UNKNOWN';
            if (!skillsByClass[className]) {
                skillsByClass[className] = [];
            }
            skillsByClass[className].push({id, ...skill});
        }
        return skillsByClass;
    }

    _sortClasses(classes) {
        return classes.sort((a, b) => {
            if (a === 'UNKNOWN') return 1;
            if (b === 'UNKNOWN') return -1;
            return (classInfo[a]?.korean || a).localeCompare(classInfo[b]?.korean || b);
        });
    }

    _createClassSection(className, classSkills, editingSkillId) {
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
                ${this._createSkillHeader(className)}
                ${classSkills.map(skill => this._createSkillItem(skill, editingSkillId)).join('')}
            </div>
        `;
        return classSection;
    }

    _createSkillHeader(className) {
        return `
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
        `;
    }

    _createSkillItem(skill, editingSkillId) {
        const isEditing = editingSkillId === skill.id;
        return `
            <div class="skill-item ${isEditing ? 'editing' : ''}">
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
        `;
    }
}