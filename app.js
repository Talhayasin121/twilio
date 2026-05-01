const state = {
  currentView: 'dialpad',
  phoneNumber: '',
  isInCall: false,
  isMuted: false,
  isOnHold: false,
  contacts: [],
  history: []
};

function callNumber(phone) {
  state.phoneNumber = phone;
  updateDisplay();
  startCall();
}

function htmlEscape(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function loadContacts() {
  try {
    const saved = localStorage.getItem('twilio_contacts');
    state.contacts = saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error('Failed to load contacts:', e);
    state.contacts = [];
  }
  renderContacts();
}

function saveContacts() {
  try {
    localStorage.setItem('twilio_contacts', JSON.stringify(state.contacts));
  } catch (e) {
    console.error('Failed to save contacts:', e);
  }
}

function addContact(name, phone) {
  state.contacts.push({ id: Date.now(), name, phone });
  saveContacts();
  renderContacts();
}

function deleteContact(id) {
  state.contacts = state.contacts.filter(c => c.id !== id);
  saveContacts();
  renderContacts();
}

function renderContacts() {
  const list = document.querySelector('.contacts-list');
  if (!list) return;
  
  list.innerHTML = state.contacts.map(contact => `
    <div class="contact-item" data-id="${contact.id}">
      <div class="contact-info">
        <div class="contact-name">${htmlEscape(contact.name)}</div>
        <div class="contact-phone">${htmlEscape(contact.phone)}</div>
      </div>
      <button class="call-contact-btn">Call</button>
      <button class="edit-contact-btn">Edit</button>
      <button class="delete-contact-btn">Delete</button>
    </div>
  `).join('');
  
  list.querySelectorAll('.call-contact-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.target.closest('.contact-item').dataset.id);
      const contact = state.contacts.find(c => c.id === id);
      callNumber(contact.phone);
    });
  });
  
  list.querySelectorAll('.edit-contact-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.target.closest('.contact-item').dataset.id);
      const contact = state.contacts.find(c => c.id === id);
      showAddContactForm(contact.id);
    });
  });
  
  list.querySelectorAll('.delete-contact-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.target.closest('.contact-item').dataset.id);
      deleteContact(id);
    });
  });
}

function loadHistory() {
  try {
    const saved = localStorage.getItem('twilio_history');
    state.history = saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error('Failed to load history:', e);
    state.history = [];
  }
  renderHistory();
}

function saveHistory() {
  try {
    localStorage.setItem('twilio_history', JSON.stringify(state.history));
  } catch (e) {
    console.error('Failed to save history:', e);
  }
}

function addToHistory(number, type) {
  const entry = {
    id: Date.now(),
    number,
    type,
    timestamp: new Date().toISOString(),
    duration: 0
  };
  state.history.unshift(entry);
  if (state.history.length > 50) state.history.pop();
  saveHistory();
  renderHistory();
}

function renderHistory() {
  const list = document.querySelector('.history-list');
  if (!list) return;
  
  list.innerHTML = state.history.map(entry => `
    <div class="history-item" data-id="${entry.id}">
      <div class="history-info">
        <div class="history-number">${htmlEscape(entry.number)}</div>
        <div class="history-meta">${htmlEscape(entry.type)} • ${new Date(entry.timestamp).toLocaleString()}</div>
      </div>
      <button class="call-back-btn">Call</button>
    </div>
  `).join('');
  
  list.querySelectorAll('.call-back-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.target.closest('.history-item').dataset.id);
      const entry = state.history.find(h => h.id === id);
      if (entry) callNumber(entry.number);
    });
  });
}

function showAddContactForm(contactId = null) {
  let name = '';
  let phone = '';
  
  if (contactId) {
    const contact = state.contacts.find(c => c.id === contactId);
    if (contact) {
      name = prompt('Contact name:', contact.name) || '';
      phone = prompt('Phone number:', contact.phone) || '';
    }
  } else {
    name = prompt('Contact name:') || '';
    phone = prompt('Phone number:') || '';
  }
  
  if (!name || !phone) return;
  
  if (contactId) {
    const contact = state.contacts.find(c => c.id === contactId);
    if (contact) {
      contact.name = name;
      contact.phone = phone;
      saveContacts();
      renderContacts();
    }
  } else {
    addContact(name, phone);
  }
}

function init() {
  loadSettings();
  loadContacts();
  loadHistory();
  setupNavigation();
  renderDialpad();
  setupEventListeners();
}

function setupNavigation() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });
}

function switchView(viewName) {
  const viewEl = document.getElementById(`view-${viewName}`);
  const tabBtn = document.querySelector(`[data-view="${viewName}"]`);
  if (!viewEl || !tabBtn) return;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  viewEl.classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  tabBtn.classList.add('active');
  state.currentView = viewName;
}

function loadSettings() {
  try {
    const sid = localStorage.getItem('twilio_sid');
    const token = localStorage.getItem('twilio_token');
    const callerId = localStorage.getItem('twilio_callerid');
    if (sid) document.getElementById('setting-sid').value = sid;
    if (token) document.getElementById('setting-token').value = token;
    if (callerId) document.getElementById('setting-callerid').value = callerId;
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

function saveSettings() {
  const sid = document.getElementById('setting-sid').value.trim();
  const token = document.getElementById('setting-token').value.trim();
  const callerId = document.getElementById('setting-callerid').value.trim();

  if (!sid || !token || !callerId) {
    alert('All fields are required');
    return;
  }

  try {
    localStorage.setItem('twilio_sid', sid);
    localStorage.setItem('twilio_token', token);
    localStorage.setItem('twilio_callerid', callerId);
    alert('Settings saved');
  } catch (e) {
    console.error('Failed to save settings:', e);
    alert('Failed to save settings');
  }
}

function renderDialpad() {
  const grid = document.querySelector('.dialpad-grid');
  const keys = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    '*', '0', '#'
  ];
  grid.innerHTML = keys.map(key => `
    <button class="dialpad-key" data-key="${key}">${key}</button>
  `).join('');

  grid.querySelectorAll('.dialpad-key').forEach(key => {
    key.addEventListener('click', () => {
      state.phoneNumber += key.dataset.key;
      updateDisplay();
    });
  });

  const clearBtn = document.createElement('button');
  clearBtn.className = 'dialpad-clear';
  clearBtn.textContent = 'Clear';
  clearBtn.addEventListener('click', () => {
    state.phoneNumber = '';
    updateDisplay();
  });
  grid.appendChild(clearBtn);
}

function updateDisplay() {
  const display = document.querySelector('.dialpad-display');
  display.textContent = state.phoneNumber || 'Enter number';
}

function setupEventListeners() {
  document.getElementById('settings-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings();
  });

  document.querySelector('.call-btn')?.addEventListener('click', () => {
    if (state.phoneNumber) {
      startCall();
    }
  });

  document.querySelector('.end-call-btn')?.addEventListener('click', endCall);

  document.querySelector('.add-contact-btn')?.addEventListener('click', showAddContactForm);
}

function startCall() {
  if (state.phoneNumber) {
    addToHistory(state.phoneNumber, 'outbound');
  }
  state.isInCall = true;
  switchView('call');
  document.querySelector('.call-status').textContent = 'Connecting...';
}

function endCall() {
  state.isInCall = false;
  switchView('dialpad');
}

document.addEventListener('DOMContentLoaded', init);