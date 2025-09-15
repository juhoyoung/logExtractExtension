// 스토리지 관련 모든 작업을 담당하는 모듈
export class StorageManager {

    static async getSkills() {
        return new Promise((resolve) => {
            chrome.storage.local.get('extractedSkills', (data) => {
                resolve(data.extractedSkills || {});
            });
        });
    }

    static async saveSkills(skills) {
        return new Promise((resolve) => {
            chrome.storage.local.set({extractedSkills: skills}, resolve);
        });
    }

    static async resetSkills() {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set({extractedSkills: {}}, () => {
                if (chrome.runtime.lastError) {
                    console.error('resetSkills 오류:', chrome.runtime.lastError);
                    reject(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

    static async keyExists(searchKey) {
        return new Promise((resolve) => {
            chrome.storage.local.get(null, (data) => {
                resolve(Object.prototype.hasOwnProperty.call(data, searchKey));
            });
        });
    }

    static async getCollapsedSections() {
        return new Promise((resolve) => {
            chrome.storage.local.get('collapsedSections', (data) => {
                resolve(data.collapsedSections || {});
            });
        });
    }

    static async saveCollapsedSections(sections) {
        return new Promise((resolve) => {
            chrome.storage.local.set({collapsedSections: sections}, resolve);
        });
    }

    static async getExportOptions() {
        return new Promise((resolve) => {
            chrome.storage.local.get('exportOptions', (data) => {
                resolve(data.exportOptions || {});
            });
        });
    }

    static async saveExportOptions(options) {
        return new Promise((resolve) => {
            chrome.storage.local.set({exportOptions: options}, resolve);
        });
    }

    static async addSkill(id, skillData) {
        const skills = await this.getSkills();
        skills[id] = skillData;
        await this.saveSkills(skills);
    }

    static async removeSkill(id) {
        const skills = await this.getSkills();
        delete skills[id];
        await this.saveSkills(skills);
    }

    static async updateSkillEnabled(id, enabled) {
        const skills = await this.getSkills();
        if (skills[id]) {
            skills[id].enabled = enabled;
            await this.saveSkills(skills);
        }
    }

    static async updateSkillExtractBySpellId(id, extractBySpellId) {
        const skills = await this.getSkills();
        if (skills[id]) {
            skills[id].extractBySpellId = extractBySpellId;
            await this.saveSkills(skills);
        }
    }
}