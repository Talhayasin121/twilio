const state = {
  currentView: 'dialpad',
  phoneNumber: '',
  isInCall: false,
  isMuted: false,
  isOnHold: false,
  contacts: []
};

function callNumber(phone) {
  state.phoneNumber = phone;
  updateDisplay();
  startCall();
}

function loadContacts() {
  const saved = localStorage.getItem('twilio_contacts');
  state.contacts = saved ? JSON.parse(saved) : [];
  renderContacts();
}

function saveContacts() {
  localStorage.setItem('twilio_contacts', JSON.stringify(state.contacts));
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
        <div class="contact-name">${contact.name}</div>
        <div class="contact-phone">${contact.phone}</div>
      </div>
      <button class="call-contact-btn">Call</button>
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
  
  list.querySelectorAll('.delete-contact-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.target.closest('.contact-item').dataset.id);
      deleteContact(id);
    });
  });
}

function showAddContactForm() {
  const name = prompt('Contact name:');
  if (!name) return;
  const phone = prompt('Phone number:');
  if (!phone) return;
  addContact(name, phone);
}

function init() {
  loadSettings();
  loadContacts();
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
  state.isInCall = true;
  switchView('call');
  document.querySelector('.call-status').textContent = 'Connecting...';
}

function endCall() {
  state.isInCall = false;
  switchView('dialpad');
}

document.addEventListener('DOMContentLoaded', init);