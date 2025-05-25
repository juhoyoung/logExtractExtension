document.addEventListener('DOMContentLoaded', function () {
  const skillListElement = document.getElementById('skillList');
  const addSkillBtn = document.getElementById('addSkill');

  const defaultSkills = {
    "357208": { display: "Fire Breath", en: "firebreath", ko: "불의숨결", enabled: true },
    "359073": { display: "Eternity Surge", en: "eternitysurge", ko: "영원의쇄도", enabled: true },
    "443328": { display: "Engulf", en: "engulf", ko: "업화", enabled: true },
    "375087": { display: "Dragonrage", en: "dragonrage", ko: "용의분노", enabled: true }
  };

  function initializeDefaultSkills(skills) {
    if (Object.keys(skills).length === 0) {
      chrome.storage.local.set({ trackedSkills: defaultSkills }, loadSkills);
      return true;
    }
    return false;
  }

  function loadSkills() {
    chrome.storage.local.get('trackedSkills', (data) => {
      const skills = data.trackedSkills || {};
      if (initializeDefaultSkills(skills)) return;

      skillListElement.innerHTML = '';
      for (const [id, value] of Object.entries(skills)) {
        const li = document.createElement('li');
        li.innerHTML = `
          <input type="checkbox" ${value.enabled ? 'checked' : ''} data-id="${id}" />
          <strong>${value.display}</strong> 
          <span class="skill-id">(ID: ${id})</span>
          <span class="skill-details">en: ${value.en || 'N/A'} | ko: ${value.ko || 'N/A'}</span>
          <button data-remove="${id}">삭제</button>
        `;
        skillListElement.appendChild(li);
      }
    });
  }

  skillListElement.addEventListener('click', (e) => {
    const removeId = e.target.dataset.remove;
    if (removeId) {
      chrome.storage.local.get('trackedSkills', (data) => {
        const skills = data.trackedSkills || {};
        delete skills[removeId];
        chrome.storage.local.set({ trackedSkills: skills }, loadSkills);
      });
    }

    if (e.target.type === 'checkbox') {
      const id = e.target.dataset.id;
      chrome.storage.local.get('trackedSkills', (data) => {
        const skills = data.trackedSkills || {};
        if (skills[id]) {
          skills[id].enabled = e.target.checked;
          chrome.storage.local.set({ trackedSkills: skills });
        }
      });
    }
  });

  addSkillBtn.addEventListener('click', () => {
    const id = document.getElementById('spellId').value.trim();
    let displayName = document.getElementById('displayName').value.trim();
    const en = document.getElementById('englishName').value.replace(/\s/g, '').trim().toLowerCase();
    const ko = document.getElementById('koreanName').value.replace(/\s/g, '').trim();

    // Check if ID is provided
    if (!id) {
      alert('Spell ID는 필수입니다.');
      return;
    }

    // Check if at least one of EN or KO is provided
    if (!en && !ko) {
      alert('영문명 또는 한글명 중 하나는 반드시 입력해야 합니다.');
      return;
    }

    // Auto-fill displayName if not provided
    if (!displayName) {
      displayName = en || ko;
    }

    chrome.storage.local.get('trackedSkills', (data) => {
      const skills = data.trackedSkills || {};
      skills[id] = { 
        display: displayName, 
        en: en || '', 
        ko: ko || '', 
        enabled: true 
      };
      chrome.storage.local.set({ trackedSkills: skills }, () => {
        document.getElementById('displayName').value = '';
        document.getElementById('spellId').value = '';
        document.getElementById('englishName').value = '';
        document.getElementById('koreanName').value = '';
        loadSkills();
      });
    });
  });

  loadSkills();
});