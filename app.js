// APP STATE
const state = {
  phoneNumber: '',
  isInCall: false,
  isMuted: false,
  isOnHold: false,
  contacts: [],
  history: [],
  twilio: {
    device: null,
    connection: null
  },
  callTimer: null,
  callStartTime: null
};

// INIT
function init() {
  loadSettings();
  loadContacts();
  loadHistory();
  setupNavigation();
  setupDialpad();
  setupCallControls();
  setupContactModal();
  setupSettings();
  updateDisplay();
}

// NAVIGATION
function setupNavigation() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.isInCall) {
        showCallModal();
        return;
      }
      switchView(btn.dataset.view);
    });
  });
}

function switchView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.add('active');
  
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  const tab = document.querySelector(`[data-view="${viewName}"]`);
  if (tab) tab.classList.add('active');
}

// DIALPAD
function setupDialpad() {
  document.querySelectorAll('.key').forEach(key => {
    key.addEventListener('click', () => {
      state.phoneNumber += key.dataset.key;
      vibrate(5);
      updateDisplay();
      playDTMF(key.dataset.key);
    });
  });
  
  document.getElementById('backspace-btn')?.addEventListener('click', () => {
    state.phoneNumber = state.phoneNumber.slice(0, -1);
    updateDisplay();
  });
  
  document.getElementById('backspace-btn')?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    state.phoneNumber = '';
    updateDisplay();
  });
  
  document.getElementById('call-btn')?.addEventListener('click', startCall);
  document.getElementById('add-from-dialpad')?.addEventListener('click', () => {
    if (state.phoneNumber) {
      openContactModal('', state.phoneNumber);
    }
  });
  
  // Keyboard support
  document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT') return;
    if ('0123456789*#'.includes(e.key)) {
      state.phoneNumber += e.key;
      updateDisplay();
    } else if (e.key === 'Backspace') {
      state.phoneNumber = state.phoneNumber.slice(0, -1);
      updateDisplay();
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (state.phoneNumber) startCall();
    }
  });
}

function updateDisplay() {
  const numEl = document.getElementById('dialpad-number');
  const nameEl = document.getElementById('dialpad-name');
  const callBtn = document.getElementById('call-btn');
  const addBtn = document.getElementById('add-from-dialpad');
  const backBtn = document.getElementById('backspace-btn');
  
  if (!numEl) return;
  
  if (state.phoneNumber) {
    const formatted = formatNumber(state.phoneNumber);
    numEl.textContent = formatted;
    numEl.className = 'dialpad-number short';
    
    // Check if number matches a contact
    const contact = findContact(state.phoneNumber);
    nameEl.textContent = contact ? contact.name : '';
    
    callBtn.classList.remove('disabled');
    addBtn.classList.add('visible');
    backBtn.classList.add('visible');
  } else {
    numEl.textContent = 'Enter a number';
    numEl.className = 'dialpad-number';
    nameEl.textContent = '';
    
    callBtn.classList.add('disabled');
    addBtn.classList.remove('visible');
    backBtn.classList.remove('visible');
  }
}

function formatNumber(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

// TWILIO CALL
async function startCall() {
  if (!state.phoneNumber) return;
  
  const settings = getSettings();
  if (!settings.sid || !settings.token || !settings.callerId) {
    alert('Please configure your Twilio settings first');
    switchView('settings');
    return;
  }
  
  try {
    const token = await getTwilioToken(settings.sid, settings.token);
    
    if (!state.twilio.device) {
      state.twilio.device = new Twilio.Device(token, {
        debug: true,
        codecPreferences: ['opus', 'pcmu']
      });
      
      state.twilio.device.on('error', (err) => {
        console.error('Twilio device error:', err);
        endCall('Connection error');
      });
      
      state.twilio.device.on('ready', () => {
        console.log('Twilio device ready');
      });
    }
    
    state.isInCall = true;
    switchView('call');
    
    document.getElementById('call-number').textContent = formatNumber(state.phoneNumber);
    document.querySelector('.call-status').textContent = 'Connecting...';
    
    const connection = await state.twilio.device.connect({ params: { To: state.phoneNumber } });
    state.twilio.connection = connection;
    
    connection.on('accept', () => {
      document.querySelector('.call-status').textContent = 'Connected';
      startCallTimer();
      addToHistory(state.phoneNumber, 'outbound');
    });
    
    connection.on('disconnect', () => {
      const duration = state.twilio.connection?._message?.duration || 0;
      endCall(duration > 0 ? `Call ended (${formatDuration(duration)})` : 'Call ended');
    });
    
    connection.on('error', (err) => {
      console.error('Connection error:', err);
      endCall('Call failed: ' + err.message);
    });
    
  } catch (err) {
    console.error('Failed to start call:', err);
    endCall('Failed to connect: ' + err.message);
  }
}

function endCall(reason = 'Call ended') {
  state.isInCall = false;
  state.isMuted = false;
  state.isOnHold = false;
  
  if (state.twilio.connection) {
    state.twilio.connection.disconnect();
    state.twilio.connection = null;
  }
  
  stopCallTimer();
  updateCallControls();
  
  if (reason) {
    switchView('dialpad');
  }
}

async function getTwilioToken(sid, token) {
  const response = await fetch('https://api.twilio.com/2010-04-Accounts/' + sid + '/Tokens.json', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(sid + ':' + token),
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get token: ${response.status}`);
  }
  
  const data = await response.json();
  return data.token;
}

function toggleMute() {
  if (!state.twilio.connection) return;
  state.isMuted = !state.isMuted;
  state.twilio.connection.isMuted(state.isMuted);
  updateCallControls();
}

function toggleHold() {
  if (!state.twilio.connection) return;
  state.isOnHold = !state.isOnHold;
  state.twilio.connection.isMuted(state.isOnHold);
  updateCallControls();
}

function updateCallControls() {
  const muteBtn = document.getElementById('mute-btn');
  const holdBtn = document.getElementById('hold-btn');
  
  if (muteBtn) muteBtn.classList.toggle('active', state.isMuted);
  if (holdBtn) holdBtn.classList.toggle('active', state.isOnHold);
}

function setupCallControls() {
  document.getElementById('mute-btn')?.addEventListener('click', toggleMute);
  document.getElementById('hold-btn')?.addEventListener('click', toggleHold);
  document.getElementById('end-call-btn')?.addEventListener('click', () => endCall());
  
  // Call timer display
  document.getElementById('call-timer').textContent = '00:00';
}

function startCallTimer() {
  state.callStartTime = Date.now();
  state.callTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - state.callStartTime) / 1000);
    const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const secs = (elapsed % 60).toString().padStart(2, '0');
    document.getElementById('call-timer').textContent = `${mins}:${secs}`;
  }, 1000);
}

function stopCallTimer() {
  if (state.callTimer) {
    clearInterval(state.callTimer);
    state.callTimer = null;
  }
  document.getElementById('call-timer').textContent = '00:00';
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// CONTACTS
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
  state.contacts.sort((a, b) => a.name.localeCompare(b.name));
  saveContacts();
  renderContacts();
}

function deleteContact(id) {
  if (confirm('Delete this contact?')) {
    state.contacts = state.contacts.filter(c => c.id !== id);
    saveContacts();
    renderContacts();
  }
}

function renderContacts(filter = '') {
  const list = document.querySelector('.contacts-list');
  if (!list) return;
  
  const filtered = state.contacts.filter(c => {
    if (!filter) return true;
    return c.name.toLowerCase().includes(filter.toLowerCase()) ||
           c.phone.includes(filter);
  });
  
  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        ${filter ? 'No contacts match your search' : 'No contacts yet.<br>Tap the + button on the dialpad to add one'}
      </div>
    `;
    return;
  }
  
  list.innerHTML = filtered.map(contact => `
    <div class="contact-item" data-id="${contact.id}">
      <div class="contact-avatar">${contact.name.charAt(0).toUpperCase()}</div>
      <div class="contact-info">
        <div class="contact-name">${htmlEscape(contact.name)}</div>
        <div class="contact-phone">${htmlEscape(contact.phone)}</div>
      </div>
      <button class="contact-call-btn" data-phone="${htmlEscape(contact.phone)}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53V3.99c0-.55-.45-1-1-1H4.01c-.55 0-1 .45-1 1v1.01c0 4.41 3.59 8 8 8 .34 0 .67-.04 1-.11.16.53.45 1.02.85 1.44.47.5 1 .73 1.63.73h1.01c.55 0 1 .45 1 1v1.01c0 1.27-.52 2.43-1.37 3.29-.88.88-2.04 1.42-3.28 1.42h-.26c-.55 0-1 .45-1 1v.91c0 .55.45 1 1 1h4.59c.55 0 1-.45 1-1v-.91c0-.82-.4-1.54-1.01-1.97-.63-.45-1.07-.67-1.75-.67-.55 0-1 .45-1 1v.91c0 .55.45 1 1 1h3.93c.55 0 1-.45 1-1v-.91c0-.55-.45-1-1-1-.82 0-1.54.4-1.97 1.01-.45.63-.67 1.07-.67 1.75 0 .55.45 1 1 1v.91c0 .82.4 1.54 1.01 1.97 1.44 1.01 2.96 2.11 4.87 2.11V18c0 .55.45 1 1 1h1.01c.55 0 1-.45 1-1v-.06c1.14-.48 2.16-1.23 2.98-2.22l.57-.7c.37-.47.52-.78.52-1.39V5.39c0-.55-.45-1-1-1h-.01c-.55 0-1 .45-1 1v1.53c0 .67-.14 1.15-.34 1.5-.2.34-.42.6-.72.83-.61.47-1.34.79-2.17.96V9c0 .55.45 1 1 1h1.01z"/></svg>
      </button>
      <button class="contact-delete-btn">Delete</button>
    </div>
  `).join('');
  
  // Event listeners
  list.querySelectorAll('.contact-call-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const phone = btn.dataset.phone;
      if (phone) {
        state.phoneNumber = phone;
        startCall();
      }
    });
  });
  
  list.querySelectorAll('.contact-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.closest('.contact-item').dataset.id);
      deleteContact(id);
    });
  });
}

// Contact search
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('contact-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderContacts(e.target.value);
    });
  }
});

// HISTORY
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
  
  if (state.history.length === 0) {
    list.innerHTML = '<div class="empty-state">No recent calls</div>';
    return;
  }
  
  list.innerHTML = state.history.map(entry => `
    <div class="history-item" data-id="${entry.id}">
      <div class="history-icon ${entry.type}">
        ${entry.type === 'outbound' 
          ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 10l7-7-7 7M5 3v18h18"/></svg>'
          : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14l-7 7-7-7M19 21H1"/></svg>'
        }
      </div>
      <div class="history-info">
        <div class="history-number">${htmlEscape(entry.number)}</div>
        <div class="history-meta">${entry.type} • ${timeAgo(entry.timestamp)}</div>
      </div>
      <button class="history-call-btn" data-phone="${htmlEscape(entry.number)}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53V3.99c0-.55-.45-1-1-1H4.01c-.55 0-1 .45-1 1v1.01c0 4.41 3.59 8 8 8 .34 0 .67-.04 1-.11.16.53.45 1.02.85 1.44.47.5 1 .73 1.63.73h1.01c.55 0 1 .45 1 1v1.01c0 1.27-.52 2.43-1.37 3.29-.88.88-2.04 1.42-3.28 1.42h-.26c-.55 0-1 .45-1 1v.91c0 .55.45 1 1 1h4.59c.55 0 1-.45 1-1v-.91c0-.82-.4-1.54-1.01-1.97-.63-.45-1.07-.67-1.75-.67-.55 0-1 .45-1 1v.91c0 .55.45 1 1 1h3.93c.55 0 1-.45 1-1v-.91c0-.55-.45-1-1-1-.82 0-1.54.4-1.97 1.01-.45.63-.67 1.07-.67 1.75 0 .55.45 1 1 1v.91c0 .82.4 1.54 1.01 1.97 1.44 1.01 2.96 2.11 4.87 2.11V18c0 .55.45 1 1 1h1.01c.55 0 1-.45 1-1v-.06c1.14-.48 2.16-1.23 2.98-2.22l.57-.7c.37-.47.52-.78.52-1.39V5.39c0-.55-.45-1-1-1h-.01c-.55 0-1 .45-1 1v1.53c0 .67-.14 1.15-.34 1.5-.2.34-.42.6-.72.83-.61.47-1.34.79-2.17.96V9c0 .55.45 1 1 1h1.01z"/></svg>
      </button>
    </div>
  `).join('');
  
  list.querySelectorAll('.history-call-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const phone = btn.dataset.phone;
      if (phone) {
        state.phoneNumber = phone;
        startCall();
      }
    });
  });
}

function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

// CONTACT MODAL
function openContactModal(name = '', phone = '') {
  const modal = document.getElementById('contact-modal');
  const nameInput = document.getElementById('modal-name');
  const phoneInput = document.getElementById('modal-phone');
  const confirmBtn = modal.querySelector('.confirm-btn');
  
  nameInput.value = name;
  phoneInput.value = phone;
  confirmBtn.textContent = name ? 'Update Contact' : 'Add Contact';
  
  modal.classList.add('active');
  nameInput.focus();
}

function closeContactModal() {
  document.getElementById('contact-modal').classList.remove('active');
}

function setupContactModal() {
  document.getElementById('contact-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeContactModal();
  });
  
  document.getElementById('contact-modal')?.querySelector('.cancel-btn')?.addEventListener('click', closeContactModal);
  document.getElementById('contact-modal')?.querySelector('.confirm-btn')?.addEventListener('click', () => {
    const name = document.getElementById('modal-name').value.trim();
    const phone = document.getElementById('modal-phone').value.trim();
    
    if (!name || !phone) {
      alert('Both name and phone are required');
      return;
    }
    
    addContact(name, phone);
    closeContactModal();
  });
  
  // FAB button
  document.getElementById('add-contact-btn')?.addEventListener('click', () => {
    openContactModal();
  });
}

// CALL MODAL
function showCallModal() {
  const modal = document.getElementById('call-modal');
  document.getElementById('call-modal-number').textContent = `Calling ${formatNumber(state.phoneNumber)}`;
  modal.classList.add('active');
}

function hideCallModal() {
  document.getElementById('call-modal')?.classList.remove('active');
}

function setupCallModal() {
  document.getElementById('call-modal-continue')?.addEventListener('click', hideCallModal);
  document.getElementById('call-modal-end')?.addEventListener('click', () => {
    endCall();
    hideCallModal();
  });
}

// SETTINGS
function getSettings() {
  return {
    sid: localStorage.getItem('twilio_sid') || '',
    token: localStorage.getItem('twilio_token') || '',
    callerId: localStorage.getItem('twilio_callerid') || ''
  };
}

function loadSettings() {
  const settings = getSettings();
  const sidInput = document.getElementById('setting-sid');
  const tokenInput = document.getElementById('setting-token');
  const callerInput = document.getElementById('setting-callerid');
  
  if (sidInput) sidInput.value = settings.sid;
  if (tokenInput) tokenInput.value = settings.token;
  if (callerInput) callerInput.value = settings.callerId;
}

function setupSettings() {
  document.getElementById('settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const sid = document.getElementById('setting-sid').value.trim();
    const token = document.getElementById('setting-token').value.trim();
    const callerId = document.getElementById('setting-callerid').value.trim();
    
    if (!sid || !token || !callerId) {
      showSettingsStatus('All fields are required', 'error');
      return;
    }
    
    const statusEl = document.getElementById('settings-status');
    statusEl.textContent = 'Verifying...';
    statusEl.className = '';
    statusEl.style.display = 'block';
    
    try {
      // Test by getting a token
      await getTwilioToken(sid, token);
      
      localStorage.setItem('twilio_sid', sid);
      localStorage.setItem('twilio_token', token);
      localStorage.setItem('twilio_callerid', callerId);
      
      showSettingsStatus('Settings saved and verified!', 'success');
      
      // Reset device if configured
      if (state.twilio.device) {
        state.twilio.device = null;
      }
    } catch (err) {
      showSettingsStatus('Verification failed: ' + err.message, 'error');
    }
  });
}

function showSettingsStatus(message, type) {
  const statusEl = document.getElementById('settings-status');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = type;
  }
}

// UTILITIES
function htmlEscape(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function findContact(phone) {
  const digits = phone.replace(/\D/g, '');
  return state.contacts.find(c => {
    const contactDigits = c.phone.replace(/\D/g, '');
    return digits.includes(contactDigits) || contactDigits.includes(digits);
  });
}

function vibrate(duration) {
  if ('vibrate' in navigator) {
    navigator.vibrate(duration);
  }
}

function playDTMF(key) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    const freqs = {
      '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
      '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
      '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
      '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
    };
    
    const freq = freqs[key];
    if (freq) {
      osc.frequency.value = freq[0];
      gain.gain.value = 0.1;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.15);
      osc.stop(ctx.currentTime + 0.15);
    }
  } catch (e) {
    // Audio not available
  }
}

// INIT ON LOAD
document.addEventListener('DOMContentLoaded', init);