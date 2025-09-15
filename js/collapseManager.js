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
        // 클래스 섹션 상태 적용
        const classHeaders = document.querySelectorAll('.class-header');
        classHeaders.forEach(header => {
            const className = header.dataset.class;
            const container = document.querySelector(`[data-skills="${className}"]`);
            const toggle = header.querySelector('.class-toggle');
            if (!container || !toggle) return;

            const state = this.collapsedSections[className];
            if (state === false) {
                container.classList.remove('collapsed');
                toggle.classList.remove('collapsed');
                toggle.textContent = '▼';

            } else{
                container.classList.add('collapsed');
                toggle.classList.add('collapsed');
                toggle.textContent = '▶';
            }
        });

        // 특성 섹션 상태 적용
        const specHeaders = document.querySelectorAll('.spec-header');
        specHeaders.forEach(header => {
            const specKey = header.dataset.spec; // className-specName
            const container = document.querySelector(`[data-spec-skills="${specKey}"]`);
            const toggle = header.querySelector('.spec-toggle');
            if (!container || !toggle) return;

            const state = this.collapsedSections[specKey];
            if (state === false) {
                container.classList.remove('collapsed');
                toggle.classList.remove('collapsed');
                toggle.textContent = '▼';
            } else{
                container.classList.add('collapsed');
                toggle.classList.add('collapsed');
                toggle.textContent = '▶';
            }
        });
    }

    _addGlobalToggleListener() {
        document.addEventListener('click', (e) => {
            const classHeader = e.target.closest('.class-header');
            if (classHeader) {
                this._handleClassToggle(classHeader);
                return;
            }

            const specHeader = e.target.closest('.spec-header');
            if (specHeader) {
                this._handleSpecToggle(specHeader);
                return;
            }
        });
    }

    async _handleClassToggle(header) {
        const className = header.dataset.class;
        const container = document.querySelector(`[data-skills="${className}"]`);
        const toggle = header.querySelector('.class-toggle');
        if (!container || !toggle) return;

        const willCollapse = !container.classList.contains('collapsed');

        container.classList.toggle('collapsed', willCollapse);
        toggle.classList.toggle('collapsed', willCollapse);
        toggle.textContent = willCollapse ? '▶' : '▼';

        this.collapsedSections[className] = willCollapse;
        await StorageManager.saveCollapsedSections(this.collapsedSections);
    }

    async _handleSpecToggle(header) {
        const specKey = header.dataset.spec; // 예: DK-Unholy
        const container = document.querySelector(`[data-spec-skills="${specKey}"]`);
        const toggle = header.querySelector('.spec-toggle');
        if (!container || !toggle) return;

        const willCollapse = !container.classList.contains('collapsed');

        container.classList.toggle('collapsed', willCollapse);
        toggle.classList.toggle('collapsed', willCollapse);
        toggle.textContent = willCollapse ? '▶' : '▼';

        this.collapsedSections[specKey] = willCollapse;
        await StorageManager.saveCollapsedSections(this.collapsedSections);
    }
}
