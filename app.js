const state = {
  currentView: 'dialpad',
  phoneNumber: '',
  isInCall: false,
  isMuted: false,
  isOnHold: false
};

function init() {
  loadSettings();
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
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${viewName}`).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
  state.currentView = viewName;
}

function loadSettings() {
  const sid = localStorage.getItem('twilio_sid');
  const token = localStorage.getItem('twilio_token');
  const callerId = localStorage.getItem('twilio_callerid');
  if (sid) document.getElementById('setting-sid').value = sid;
  if (token) document.getElementById('setting-token').value = token;
  if (callerId) document.getElementById('setting-callerid').value = callerId;
}

function saveSettings() {
  const sid = document.getElementById('setting-sid').value;
  const token = document.getElementById('setting-token').value;
  const callerId = document.getElementById('setting-callerid').value;
  localStorage.setItem('twilio_sid', sid);
  localStorage.setItem('twilio_token', token);
  localStorage.setItem('twilio_callerid', callerId);
  alert('Settings saved');
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
  document.querySelector('.save-settings-btn')?.addEventListener('click', saveSettings);

  document.querySelector('.call-btn')?.addEventListener('click', () => {
    if (state.phoneNumber) {
      startCall();
    }
  });

  document.querySelector('.end-call-btn')?.addEventListener('click', endCall);
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