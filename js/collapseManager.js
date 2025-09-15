import { StorageManager } from './storageManager.js';

export class CollapseManager {
    constructor() {
        this.collapsedSections = {};
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        this.collapsedSections = await StorageManager.getCollapsedSections();
        this._addGlobalToggleListener();
        this.initialized = true;
    }

    async applyCollapsedState() {
        const headers = document.querySelectorAll('.class-header');
        headers.forEach(header => {
            const className = header.dataset.class;
            const container = document.querySelector(`[data-skills="${className}"]`);
            const toggle = header.querySelector('.class-toggle');
            if (!container || !toggle) return;

            // 저장된 값이 true면 접힘, false면 펼침. (undefined면 템플릿 기본 상태 유지)
            const state = this.collapsedSections[className];
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

    _addGlobalToggleListener() {
        document.addEventListener('click', (e) => {
            const header = e.target.closest('.class-header');
            if (!header) return;

            this._handleToggleClick(header);
        });
    }

    async _handleToggleClick(header) {
        const className = header.dataset.class;
        const skillsContainer = document.querySelector(`[data-skills="${className}"]`);
        const toggle = header.querySelector('.class-toggle');
        if (!skillsContainer || !toggle) return;

        // 현재 상태 기준으로 "이후 상태"를 명확히 계산
        const willCollapse = !skillsContainer.classList.contains('collapsed'); // 펼쳐진 상태면 접히도록

        skillsContainer.classList.toggle('collapsed', willCollapse);
        toggle.classList.toggle('collapsed', willCollapse);
        toggle.textContent = willCollapse ? '▶' : '▼';

        // 섹션별로 상태 저장
        this.collapsedSections[className] = willCollapse;
        await StorageManager.saveCollapsedSections(this.collapsedSections);
    }
}