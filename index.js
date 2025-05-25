document.addEventListener('DOMContentLoaded', function () {
  const skillListElement = document.getElementById('skillList');
  const addSkillBtn = document.getElementById('addSkill');

  const defaultSkills = {
    firebreath: { id: '357208', enabled: true },
    eternitysurge: { id: '359073', enabled: true },
    engulf: { id: '443328', enabled: true },
    dragonrage: { id: '375087', enabled: true }
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
      for (const [name, value] of Object.entries(skills)) {
        const li = document.createElement('li');
        li.innerHTML = `
          <input type="checkbox" ${value.enabled ? 'checked' : ''} data-name="${name}" />
          <strong>${name}</strong> (ID: ${value.id})
          <button data-remove="${name}">삭제</button>
        `;
        skillListElement.appendChild(li);
      }
    });
  }

  skillListElement.addEventListener('click', (e) => {
    const removeName = e.target.dataset.remove;
    if (removeName) {
      chrome.storage.local.get('trackedSkills', (data) => {
        const skills = data.trackedSkills || {};
        delete skills[removeName];
        chrome.storage.local.set({ trackedSkills: skills }, loadSkills);
      });
    }

    if (e.target.type === 'checkbox') {
      const name = e.target.dataset.name;
      chrome.storage.local.get('trackedSkills', (data) => {
        const skills = data.trackedSkills || {};
        if (skills[name]) {
          skills[name].enabled = e.target.checked;
          chrome.storage.local.set({ trackedSkills: skills });
        }
      });
    }
  });

  addSkillBtn.addEventListener('click', () => {
    const name = document.getElementById('skillName').value.trim().toLowerCase();
    const id = document.getElementById('spellId').value.trim();
    if (!name || !id) return;

    chrome.storage.local.get('trackedSkills', (data) => {
      const skills = data.trackedSkills || {};
      skills[name] = { id, enabled: true };
      chrome.storage.local.set({ trackedSkills: skills }, () => {
        document.getElementById('skillName').value = '';
        document.getElementById('spellId').value = '';
        loadSkills();
      });
    });
  });

  loadSkills();
});
