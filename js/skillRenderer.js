import { classInfo } from '/init/classInfo.js';

export class SkillRenderer {
    constructor(containerElement) {
        this.container = containerElement;
    }

    renderSkills(skills, editingSkillId = null) {
        const grouped = this._groupSkillsByClassAndSpec(skills);
        this.container.innerHTML = '';

        if (Object.keys(grouped).length === 0) {
            this.container.innerHTML = `<div class="empty-state">${t('empty_skills')}</div>`;
            return;
        }

        const sortedClasses = this._sortClasses(Object.keys(grouped));
        for (const className of sortedClasses) {

            const classSpecs = grouped[className];
            const classSection = this._createClassSection(className, classSpecs, editingSkillId);
            this.container.appendChild(classSection);
        }
    }

    _groupSkillsByClassAndSpec(skills) {
        const result = {};
        for (const [id, skill] of Object.entries(skills)) {
            const className = skill.class || 'UNKNOWN';
            const specName = skill.spec || 'General';
            if (!result[className]) result[className] = {};
            if (!result[className][specName]) result[className][specName] = [];
            result[className][specName].push({ id, ...skill });
        }
        return result;
    }

    _sortClasses(classes) {
        return classes.sort((a, b) => {
            if (a === 'UNKNOWN') return 1;
            if (b === 'UNKNOWN') return -1;
            return (classInfo[a]?.korean || a).localeCompare(classInfo[b]?.korean || b);
        });
    }

    _createClassSection(className, specs, editingSkillId) {
        const classData = classInfo[className];
        let displayName;
        if (classData) {
            if (i18n.detectBrowserLanguage() === 'ko') {
                displayName = `${classData.korean} (${classData.english})`;
            } else {
                displayName = classData.english;
            }
        } else {
            displayName = className;
        }

        const classSection = document.createElement('div');
        classSection.className = 'class-section';
        classSection.innerHTML = `
            <div class="class-header" data-class="${className}">
                <div><span class="class-title">${displayName}</span></div>
                <span class="class-toggle collapsed">▼</span>
            </div>
            <div class="skills-container collapsed" data-skills="${className}"></div>
        `;

        const container = classSection.querySelector('.skills-container');
        const specOrder = (classInfo[className]?.specs || []).map(s => s.en);

        specOrder.forEach(specName => {
            if (specs[specName]) {
                const specSection = this._createSpecSection(className, specName, specs[specName], editingSkillId);
                container.appendChild(specSection);
            }
        });

        Object.keys(specs).forEach(specName => {
            if (!specOrder.includes(specName)) {
                const specSection = this._createSpecSection(className, specName, specs[specName], editingSkillId);
                container.appendChild(specSection);
            }
        });

        return classSection;
    }


    _createSpecSection(className, specName, skills, editingSkillId) {
        const specInfo = (classInfo[className]?.specs || []).find(s => s.en === specName);
        let displayName;
        if (specInfo) {
            if (i18n.detectBrowserLanguage() === 'ko') {
                displayName = `${specInfo.ko} (${specInfo.en})`;
            } else {
                displayName = specInfo.en;
            }
        } else {
            displayName = className;
        }


        const specSection = document.createElement('div');
        specSection.className = 'spec-section';
        specSection.innerHTML = `
        <div class="spec-header" data-spec="${className}-${specName}">
            <span class="spec-title">${displayName}</span>
            <span class="spec-toggle collapsed">▼</span>
        </div>
        <div class="spec-container collapsed" data-spec-skills="${className}-${specName}">
            ${this._createSkillHeader(className, specName)}
            ${skills.map(skill => this._createSkillItem(skill, editingSkillId)).join('')}
        </div>`;
        return specSection;
    }


    _createSkillHeader(className, specName) {
        return `
        <div class="skill-header">
            <div class="skill-col-check">
                <button class="toggle-all" data-toggle-all="${className}-${specName}">
                    ${t('btn_toggle_all')}
                </button>
            </div>
            <div class="skill-col">${t('col_name_display')}</div>
            <div class="skill-col">${t('col_id')}</div>
            <div class="skill-col">${t('col_english')}</div>
            <div class="skill-col">${t('col_optional')}</div>
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
                <div class="skill-col">${skill.id}</div>
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