// chrome-i18n.js - Chrome 내장 i18n API 사용

class ChromeI18n {
    constructor() {
        this.init();
    }
    init() {
        // DOM이 로드되면 번역 적용
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.translatePage());
        } else {
            this.translatePage();
        }
    }

    // Chrome i18n API를 사용한 메시지 가져오기
    getMessage(key, substitutions = []) {
        return chrome.i18n.getMessage(key, substitutions) || key;
    }

    // 현재 UI 언어 가져오기
    getCurrentLanguage() {
        return chrome.i18n.getUILanguage();
    }

    // 페이지의 모든 data-i18n 속성을 가진 요소들을 번역
    translatePage() {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translatedText = this.getMessage(key);

            // input의 placeholder인 경우
            if (element.hasAttribute('data-i18n-placeholder')) {
                element.placeholder = translatedText;
            } else {
                // 일반 텍스트
                element.textContent = translatedText;
            }
        });

        // title 속성 번역
        const titleElements = document.querySelectorAll('[data-i18n-title]');
        titleElements.forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.title = this.getMessage(key);
        });
    }

    // 동적으로 생성된 요소에 번역 적용
    translateElement(element) {
        if (element.hasAttribute('data-i18n')) {
            const key = element.getAttribute('data-i18n');
            const translatedText = this.getMessage(key);

            if (element.hasAttribute('data-i18n-placeholder')) {
                element.placeholder = translatedText;
            } else {
                element.textContent = translatedText;
            }
        }
    }

    // 브라우저 언어 감지
    detectBrowserLanguage() {
        return chrome.i18n.getUILanguage();
    }
}

// 전역 i18n 인스턴스
const i18n = new ChromeI18n();

// 전역으로 사용할 수 있도록 함수 export
window.i18n = i18n;
window.t = (key, substitutions) => i18n.getMessage(key, substitutions);