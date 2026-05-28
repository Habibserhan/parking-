// ============================================================
//  CORE APP — API client, Auth, Router, Modal, Toast, Helpers
// ============================================================

const TOKEN_KEY = 'parking_token';
const USER_KEY  = 'parking_user';

// ---------- API ----------
const API = {
  base: '/api',
  _headers() {
    const t = localStorage.getItem(TOKEN_KEY);
    return { 'Content-Type': 'application/json', ...(t ? { 'Authorization': `Bearer ${t}` } : {}) };
  },
  async _req(method, path, body) {
    const opts = { method, headers: this._headers() };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const r = await fetch(this.base + path, opts);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 401) { Auth.logout(); return; }
      throw new Error(data.error || `HTTP ${r.status}`);
    }
    return data;
  },
  get(path)         { return this._req('GET',    path); },
  post(path, body)  { return this._req('POST',   path, body); },
  put(path, body)   { return this._req('PUT',    path, body); },
  delete(path)      { return this._req('DELETE', path); },
};

// ---------- Auth ----------
const Auth = {
  user: null,
  init() {
    const u = localStorage.getItem(USER_KEY);
    if (u) this.user = JSON.parse(u);
  },
  isLoggedIn() { return !!localStorage.getItem(TOKEN_KEY); },
  isAdmin()    { return this.user?.role === 'admin'; },
  async login(email, password) {
    const data = await API.post('/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    this.user = data.user;
    return data;
  },
  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.user = null;
    showLogin();
  }
};

// ---------- Toast ----------
const Toast = {
  show(msg, type = 'default', duration = 3500) {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-circle', default: 'fa-info-circle' };
    t.innerHTML = `<i class="fas ${icons[type] || icons.default}"></i><span class="toast-msg">${escHtml(msg)}</span>`;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, duration);
  },
  success(m) { this.show(m, 'success'); },
  error(m)   { this.show(m, 'error'); },
  warning(m) { this.show(m, 'warning'); },
};

// ---------- Modal ----------
const Modal = {
  _resolve: null,
  show({ title, body, size = '', onSave, saveLabel = 'Save', showFooter = true }) {
    this.close();
    const el = document.createElement('div');
    el.className = 'modal-overlay';
    el.id = 'modal-overlay';
    el.innerHTML = `
      <div class="modal-box ${size ? 'modal-' + size : ''}">
        <div class="modal-header">
          <h3>${escHtml(title)}</h3>
          <button class="modal-close" onclick="Modal.close()"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">${body}</div>
        ${showFooter ? `<div class="modal-footer">
          <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-primary" id="modal-save-btn">${escHtml(saveLabel)}</button>
        </div>` : ''}
      </div>`;
    document.body.appendChild(el);
    if (onSave) {
      const saveBtn = document.getElementById('modal-save-btn');
      saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner"></span> Saving…';
        try { await onSave(); }
        catch (e) { Toast.error(e.message); saveBtn.disabled = false; saveBtn.textContent = saveLabel; }
      });
    }
    el.addEventListener('click', e => { if (e.target === el) this.close(); });
    // Focus first input
    setTimeout(() => { const f = el.querySelector('input,select,textarea'); if (f) f.focus(); }, 50);
  },
  close() {
    const el = document.getElementById('modal-overlay');
    if (el) el.remove();
  },
  getFormData(formId = 'modal-form') {
    const form = document.getElementById(formId);
    if (!form) return {};
    const data = {};
    new FormData(form).forEach((v, k) => { data[k] = v; });
    // Also capture unchecked checkboxes
    form.querySelectorAll('input[type=checkbox]').forEach(cb => { if (!data.hasOwnProperty(cb.name)) data[cb.name] = 0; });
    return data;
  },
  validate(formId = 'modal-form') {
    const form = document.getElementById(formId);
    if (!form) return true;
    let valid = true;
    form.querySelectorAll('[required]').forEach(el => {
      el.style.borderColor = '';
      if (!el.value.trim()) {
        el.style.borderColor = 'var(--danger)';
        valid = false;
      }
    });
    return valid;
  }
};

// ---------- Router ----------
const Router = {
  pages: {},
  currentPage: null,
  register(name, module) { this.pages[name] = module; },
  async navigate(page, params = {}) {
    const module = this.pages[page];
    if (!module) return;

    // Check permissions
    if (module.adminOnly && !Auth.isAdmin()) {
      Toast.error('Admin access required');
      return;
    }

    this.currentPage = page;
    params.page = page;

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));

    // Update title
    const titleEl = document.getElementById('topbar-title');
    if (titleEl) titleEl.textContent = module.title || page;

    // Render
    const content = document.getElementById('page-content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div> Loading…</div>';
    try {
      const html = await module.render(params);
      content.innerHTML = html;
      if (module.init) module.init(params);
    } catch (e) {
      console.error(e);
      content.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h4>Error loading page</h4><p>${escHtml(e.message)}</p></div>`;
    }

    // Close sidebar on mobile
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('active');
  }
};

// ---------- Helpers ----------
function escHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Currency config: symbol, decimal places, name
const CURRENCIES = {
  USD: { symbol: '$',     dec: 2, name: 'US Dollar' },
  EUR: { symbol: '€',     dec: 2, name: 'Euro' },
  GBP: { symbol: '£',     dec: 2, name: 'British Pound' },
  LBP: { symbol: 'LL',    dec: 0, name: 'Lebanese Pound', multiplier: 1000 },
  LYD: { symbol: 'LD',    dec: 3, name: 'Libyan Dinar' },
  AED: { symbol: 'AED',   dec: 2, name: 'UAE Dirham' },
  SAR: { symbol: 'SAR',   dec: 2, name: 'Saudi Riyal' },
  KWD: { symbol: 'KD',    dec: 3, name: 'Kuwaiti Dinar' },
  BHD: { symbol: 'BD',    dec: 3, name: 'Bahraini Dinar' },
  QAR: { symbol: 'QAR',   dec: 2, name: 'Qatari Riyal' },
  OMR: { symbol: 'OMR',   dec: 3, name: 'Omani Rial' },
  MAD: { symbol: 'MAD',   dec: 2, name: 'Moroccan Dirham' },
  EGP: { symbol: 'EGP',   dec: 2, name: 'Egyptian Pound' },
  JOD: { symbol: 'JD',    dec: 3, name: 'Jordanian Dinar' },
  TRY: { symbol: '₺',     dec: 2, name: 'Turkish Lira' },
  IQD: { symbol: 'IQD',   dec: 0, name: 'Iraqi Dinar' },
  SYP: { symbol: 'SYP',   dec: 0, name: 'Syrian Pound' },
  SDG: { symbol: 'SDG',   dec: 2, name: 'Sudanese Pound' },
  DZD: { symbol: 'DZD',   dec: 2, name: 'Algerian Dinar' },
  TND: { symbol: 'TND',   dec: 3, name: 'Tunisian Dinar' },
  YER: { symbol: 'YER',   dec: 0, name: 'Yemeni Rial' },
  INR: { symbol: '₹',     dec: 2, name: 'Indian Rupee' },
  PKR: { symbol: '₨',     dec: 0, name: 'Pakistani Rupee' },
  CAD: { symbol: 'CA$',   dec: 2, name: 'Canadian Dollar' },
  AUD: { symbol: 'A$',    dec: 2, name: 'Australian Dollar' },
};

function fmtCurrency(v, currency) {
  const cur = currency || (window.appSettings?.currency) || 'USD';
  const cfg = CURRENCIES[cur] || { symbol: cur, dec: 2 };
  const amount = Number(v) || 0;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: cfg.dec,
    maximumFractionDigits: cfg.dec
  }).format(amount);
  return `${cfg.symbol} ${formatted}`;
}

// Get the active currency map from settings (falls back to USD+LBP)
function _getCurrencyMap() {
  try {
    const parsed = JSON.parse(window.appSettings?.custom_rates || '{}');
    const result = {};
    Object.entries(parsed).forEach(([k, v]) => { if (!k.startsWith('__') && typeof v === 'object' && v !== null) result[k] = v; });
    if (Object.keys(result).length) return result;
  } catch {}
  return {
    USD: { symbol: '$',  name: 'US Dollar',      dec: 2, multiplier: 1    },
    LBP: { symbol: 'LL', name: 'Lebanese Pound', dec: 0, multiplier: 1000 }
  };
}

// Format amount using a specific currency stored per-record
function fmtAmt(amount, currency) {
  const cur = currency || 'USD';
  const map = _getCurrencyMap();
  const cfg = map[cur] || CURRENCIES[cur] || { symbol: cur, dec: 2, multiplier: 1 };
  const multiplier = cfg.multiplier || 1;
  const n = (Number(amount) || 0) * multiplier;
  return cfg.symbol + ' ' + new Intl.NumberFormat('en-US', {
    minimumFractionDigits: cfg.dec ?? 2,
    maximumFractionDigits: cfg.dec ?? 2
  }).format(n);
}

// Format a raw amount in a given currency WITHOUT applying the stored multiplier.
// Use for values already stored in their natural unit (e.g. company flat rates).
function fmtRaw(amount, currency) {
  const cur = currency || 'USD';
  const map = _getCurrencyMap();
  const cfg = map[cur] || CURRENCIES[cur] || { symbol: cur, dec: 2 };
  const n = Number(amount) || 0;
  return cfg.symbol + ' ' + new Intl.NumberFormat('en-US', {
    minimumFractionDigits: cfg.dec ?? 2,
    maximumFractionDigits: cfg.dec ?? 2
  }).format(n);
}

// ---- Shared currency conversion helpers ----

// Returns the LBP exchange rate (1 USD = N LBP) from settings, fallback 89500
function getLbpRate() {
  try {
    const r = JSON.parse(window.appSettings?.custom_rates || '{}');
    if (r.USD && typeof r.USD === 'object' && r.USD.rate) return Number(r.USD.rate);
    if (typeof r.LBP === 'number') return r.LBP;
  } catch {}
  return 89500;
}

// Convert a raw amount from one currency to another (USD ↔ LBP)
function convertAmount(amount, fromCurrency, toCurrency) {
  const value = Number(amount) || 0;
  const from  = String(fromCurrency || 'USD').toUpperCase();
  const to    = String(toCurrency   || 'USD').toUpperCase();
  if (from === to) return value;
  const rate = getLbpRate();
  if (from === 'USD' && to === 'LBP') return value * rate;
  if (from === 'LBP' && to === 'USD') return value / rate;
  return value; // unsupported pair — return as-is
}

// Sum records after converting each record's amount to selectedCurrency
function sumConverted(records, selectedCurrency, amountField = 'amount', currencyField = 'currency') {
  return records.reduce((total, r) =>
    total + convertAmount(r[amountField], r[currencyField], selectedCurrency), 0);
}

// ---- Build <select> for per-record currency using the active currency list
function currencySelect(name, selected) {
  const sel = selected || 'USD';
  const map = _getCurrencyMap();
  const opts = Object.entries(map).map(([c, cfg]) =>
    `<option value="${c}" ${c === sel ? 'selected' : ''}>${cfg.symbol} — ${cfg.name || c}</option>`
  ).join('');
  return `<select name="${name}">${opts}</select>`;
}

// Get parking rates configured by admin
function getParkingRates() {
  try {
    const parsed = JSON.parse(window.appSettings?.custom_rates || '{}');
    return parsed.__parkingRates || {};
  } catch { return {}; }
}

// Returns null if no rate configured, otherwise { amount, currency, hours }
function calcParkingAmount(vehicle_type, duration_minutes) {
  const rates = getParkingRates();
  const tiers = rates[vehicle_type];
  if (!Array.isArray(tiers) || !tiers.length) return null;
  const hours = duration_minutes / 60;
  // Find matching tier: from <= hours < to (null to = and above)
  const tier = tiers.slice().sort((a, b) => b.from - a.from).find(t => hours >= t.from);
  if (!tier) return null;
  return { amount: Number(tier.price), currency: tier.currency || 'USD', hours, tier };
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(mins) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Returns current date-time string in Lebanon timezone (Asia/Beirut)
// formatted as YYYY-MM-DDTHH:mm for datetime-local inputs
function nowLebanon() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Beirut' }).slice(0, 16).replace(' ', 'T');
}

// Returns today's date in Lebanon timezone as YYYY-MM-DD
function todayLebanon() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Beirut' });
}

function statusBadge(status) {
  const map = {
    active: ['badge-success', 'Active'],
    expired: ['badge-danger', 'Expired'],
    suspended: ['badge-warning', 'Suspended'],
    paid: ['badge-success', 'Paid'],
    unpaid: ['badge-danger', 'Unpaid'],
    partially_paid: ['badge-warning', 'Partial'],
    parked: ['badge-info', 'Parked'],
    completed: ['badge-success', 'Completed'],
    'non-registered': ['badge-gray', 'Walk-in'],
    registered: ['badge-info', 'Registered'],
  };
  const [cls, label] = map[status] || ['badge-gray', status || '—'];
  return `<span class="badge ${cls}">${escHtml(label)}</span>`;
}

// All supported vehicle types — add/remove here to update the whole app
const VEHICLE_TYPES = [
  { value: 'car',        label: 'Car',        icon: 'fa-car' },
  { value: 'motorcycle', label: 'Motorcycle',  icon: 'fa-motorcycle' },
  { value: 'range',      label: 'Range',       icon: 'fa-car-side' },
];

// Returns <select> options HTML for vehicle types
function vehicleTypeOptions(selected = '', includeBoth = false) {
  let opts = '';
  if (includeBoth) opts += `<option value="both" ${selected === 'both' ? 'selected' : ''}>All / Both</option>`;
  opts += VEHICLE_TYPES.map(t =>
    `<option value="${t.value}" ${selected === t.value ? 'selected' : ''}>${t.label}</option>`
  ).join('');
  return opts;
}

function vehicleBadge(type) {
  const t = VEHICLE_TYPES.find(v => v.value === type);
  const icon  = t ? t.icon  : 'fa-car-side';
  const label = t ? t.label : (type || '—');
  return `<span class="badge badge-info"><i class="fas ${icon}"></i> ${escHtml(label)}</span>`;
}

function confirmDelete(msg = 'Are you sure you want to delete this record?') {
  return window.confirm(msg);
}

function exportCSV(rows, filename = 'export.csv') {
  if (!rows.length) { Toast.warning('No data to export'); return; }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function printPage() { window.print(); }

// ---------- App Bootstrap ----------
let appSettings = {};

async function loadSettings() {
  try {
    appSettings = await API.get('/settings');
    window.appSettings = appSettings;
    const nameEl = document.getElementById('sidebar-business-name');
    if (nameEl) nameEl.textContent = appSettings.business_name || 'My Parking';
  } catch { /* ignore */ }
}

function renderUserInfo() {
  const u = Auth.user;
  if (!u) return;
  const av = document.getElementById('user-avatar');
  const nm = document.getElementById('user-name');
  const rl = document.getElementById('user-role');
  if (av) av.textContent = u.name.charAt(0).toUpperCase();
  if (nm) nm.textContent = u.name;
  if (rl) rl.textContent = u.role;

  // Hide admin-only nav items for non-admins
  if (!Auth.isAdmin()) {
    document.querySelectorAll('[data-admin]').forEach(el => el.style.display = 'none');
  }

  // Apply per-user page permissions (employees only)
  if (!Auth.isAdmin()) {
    const perms = Auth.user?.page_permissions;
    if (Array.isArray(perms)) {
      document.querySelectorAll('.nav-item[data-page]').forEach(el => {
        const page = el.dataset.page;
        if (!perms.includes(page)) el.style.display = 'none';
      });
    }
  }
}

function showLogin() {
  document.getElementById('login-page').style.display = '';
  document.getElementById('login-page').classList.add('active');
  document.getElementById('app').classList.remove('active');
}

function showApp() {
  document.getElementById('login-page').classList.remove('active');
  document.getElementById('app').classList.add('active');
  renderUserInfo();
  loadSettings();
  const perms = Auth.user?.page_permissions;
  const startPage = (Array.isArray(perms) && !perms.includes('dashboard'))
    ? (perms[0] || 'dashboard')
    : 'dashboard';
  Router.navigate(startPage);
}

// ---------- Login ----------
document.addEventListener('DOMContentLoaded', () => {
  Auth.init();

  // Login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = loginForm.querySelector('button[type=submit]');
      const err = document.getElementById('login-error');
      btn.disabled = true; btn.textContent = 'Logging in…';
      if (err) err.textContent = '';
      try {
        await Auth.login(loginForm.email.value, loginForm.password.value);
        showApp();
      } catch (ex) {
        Toast.error(ex.message || 'Login failed');
      } finally {
        btn.disabled = false; btn.textContent = 'Login';
      }
    });
  }

  // Logout
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to log out?')) Auth.logout();
  });

  // Nav clicks
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.addEventListener('click', () => Router.navigate(el.dataset.page));
  });

  // Mobile hamburger
  document.getElementById('hamburger')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
    document.getElementById('sidebar-overlay')?.classList.toggle('active');
  });
  document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('active');
  });

  // Boot
  if (Auth.isLoggedIn()) showApp();
  else showLogin();
});
