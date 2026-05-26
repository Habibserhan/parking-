// ============================================================
//  USERS & SETTINGS PAGE
// ============================================================
const UsersPage = {
  title: 'Users & Settings',
  adminOnly: true,
  data: [],
  settings: {},

  // Default currencies always pre-loaded
  DEFAULTS: {
    USD: { symbol: '$',  name: 'US Dollar',       dec: 2, multiplier: 1    },
    LBP: { symbol: 'LL', name: 'Lebanese Pound',  dec: 0, multiplier: 1000 }
  },

  _loadCurrencies() {
    try {
      const parsed = JSON.parse(this.settings.custom_rates || '{}');
      // Only keep object entries (currency definitions, not old number-based rates)
      const result = {};
      Object.entries(parsed).forEach(([k, v]) => { if (!k.startsWith('__') && typeof v === 'object' && v !== null) result[k] = v; });
      // If nothing saved yet, return defaults
      if (!Object.keys(result).length) return { ...this.DEFAULTS };
      return result;
    } catch { return { ...this.DEFAULTS }; }
  },

  async render() {
    [this.data, this.settings] = await Promise.all([API.get('/users'), API.get('/settings')]);
    const currencies = this._loadCurrencies();

    return `
      <div class="page-header">
        <div class="page-title"><h2>Users & Settings</h2><p>Manage system users and business settings</p></div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="UsersPage.showAddUser()"><i class="fas fa-user-plus"></i> Add User</button>
        </div>
      </div>

      <!-- Business Settings -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><span class="card-title"><i class="fas fa-cog" style="margin-right:8px"></i>Business Settings</span></div>
        <div class="card-body">
          <form id="settings-form"><div class="form-row cols-2">
            <div class="form-group"><label>Business Name</label><input name="business_name" value="${escHtml(this.settings.business_name || '')}"></div>
            <div class="form-group"><label>Phone</label><input name="business_phone" value="${escHtml(this.settings.business_phone || '')}" placeholder="+1 234 567 8900"></div>
            <div class="form-group" style="grid-column:1/-1"><label>Address</label><input name="business_address" value="${escHtml(this.settings.business_address || '')}" placeholder="123 Main St, City"></div>
            <div class="form-group"><label>Invoice Prefix</label><input name="invoice_prefix" value="${escHtml(this.settings.invoice_prefix || 'INV')}" placeholder="INV"></div>
          </div>
          <div style="margin-top:16px">
            <button type="button" class="btn btn-primary" onclick="UsersPage.saveSettings()"><i class="fas fa-save"></i> Save Settings</button>
          </div>
          </form>
        </div>
      </div>

      <!-- Currency Management -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <span class="card-title"><i class="fas fa-coins" style="color:var(--warning);margin-right:8px"></i>Currency</span>
          <button class="btn btn-sm btn-primary" onclick="UsersPage.showAddCurrencyModal()"><i class="fas fa-plus"></i> Add Currency</button>
        </div>
        <div class="card-body" style="padding:0">
          <div id="cur-list">
            ${this._renderCurrencyList(currencies)}
          </div>
        </div>
      </div>

      <!-- Parking Rates -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <span class="card-title"><i class="fas fa-parking" style="color:var(--primary);margin-right:8px"></i>Daily Parking Rates</span>
        </div>
        <div class="card-body" style="padding:0">
          ${this._renderParkingRates(this._getParkingRates())}
        </div>
      </div>

      <!-- Users -->
      <div class="card">
        <div class="card-header"><span class="card-title"><i class="fas fa-users" style="margin-right:8px"></i>System Users</span></div>
        <div class="table-wrap" id="users-table">${this.renderTable(this.data)}</div>
      </div>`;
  },

  init() {},

  _renderCurrencyList(currencies) {
    const entries = Object.entries(currencies);
    if (!entries.length) return `<div class="empty-state" style="padding:30px"><i class="fas fa-coins"></i><h4>No currencies</h4><p>Add at least one currency.</p></div>`;
    return `<table>
      <thead><tr>
        <th>Symbol</th><th>Code</th><th>Name</th><th>1 USD =</th><th>Actions</th>
      </tr></thead>
      <tbody>${entries.map(([code, cfg]) => `<tr>
        <td><strong style="font-size:16px">${escHtml(cfg.symbol)}</strong></td>
        <td><span class="badge badge-gray">${escHtml(code)}</span></td>
        <td>${escHtml(cfg.name)}</td>
        <td>
          ${code === 'LBP'
            ? `<span class="text-muted">—</span>`
            : `<input type="number" class="cur-rate-input" data-code="${escHtml(code)}" value="${cfg.rate || ''}" min="0" step="any" placeholder="e.g. 89500" style="width:130px;padding:6px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-weight:600">`
          }
        </td>
        <td class="actions">
          <button class="btn btn-sm btn-outline btn-icon" onclick="UsersPage.deleteCurrency('${escHtml(code)}')" title="Remove"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('')}</tbody>
    </table>
    <div style="padding:16px;border-top:1px solid var(--border);display:flex;align-items:center;gap:12px">
      <button class="btn btn-primary" onclick="UsersPage.saveRates()"><i class="fas fa-save"></i> Save Rates</button>
      <span id="cur-saved-msg" style="display:none;color:#16a34a;font-size:13px;font-weight:600"><i class="fas fa-check-circle"></i> Saved!</span>
    </div>`;
  },

  async saveRates() {
    const currencies = this._loadCurrencies();
    document.querySelectorAll('.cur-rate-input').forEach(input => {
      const code = input.dataset.code;
      const rate = parseFloat(input.value);
      if (code && currencies[code]) currencies[code].rate = rate > 0 ? rate : null;
    });
    await this._saveCurrencyMap(currencies);
    document.getElementById('cur-list').innerHTML = this._renderCurrencyList(currencies);
    const msg = document.getElementById('cur-saved-msg');
    if (msg) { msg.style.display = 'inline'; setTimeout(() => msg.style.display = 'none', 3000); }
    Toast.success('Rates saved');
  },

  showAddCurrencyModal() {
    Modal.show({ title: 'Add Currency', size: 'sm', body: `<form id="modal-form">
      <div class="form-row">
        <div class="form-group"><label>Currency Code *</label><input name="code" required placeholder="e.g. EUR, SAR, AED" style="text-transform:uppercase" maxlength="10"></div>
        <div class="form-group"><label>Symbol *</label><input name="symbol" required placeholder="e.g. €, SAR, AED"></div>
        <div class="form-group"><label>Name *</label><input name="name" required placeholder="e.g. Euro"></div>
        <div class="form-group"><label>Decimal Places</label>
          <select name="dec">
            <option value="2" selected>2 (e.g. $ 10.00)</option>
            <option value="0">0 (e.g. LL 10,000)</option>
            <option value="3">3 (e.g. KD 10.000)</option>
          </select>
        </div>
        <div class="form-group"><label>Display Multiplier</label>
          <select name="multiplier">
            <option value="1" selected>1 — show as entered</option>
            <option value="1000">1000 — enter 150 shows 150,000</option>
          </select>
        </div>
        <div class="form-group"><label>1 USD = ? (exchange rate)</label><input name="rate" type="number" min="0" step="any" placeholder="e.g. 89500"></div>
      </div>
    </form>`, saveLabel: 'Add', onSave: async () => {
      if (!Modal.validate()) throw new Error('Please fill all required fields');
      const data = Modal.getFormData();
      const code = data.code.trim().toUpperCase();
      if (!code || !data.symbol) throw new Error('Code and symbol are required');
      const currencies = this._loadCurrencies();
      const rate = parseFloat(data.rate);
      currencies[code] = { symbol: data.symbol.trim(), name: data.name.trim(), dec: Number(data.dec), multiplier: Number(data.multiplier), rate: rate > 0 ? rate : null };
      await this._saveCurrencyMap(currencies);
      Modal.close();
      Toast.success('Currency added');
      document.getElementById('cur-list').innerHTML = this._renderCurrencyList(currencies);
    }});
  },

  async deleteCurrency(code) {
    if (!confirmDelete(`Remove ${code} from the currency list?`)) return;
    const currencies = this._loadCurrencies();
    delete currencies[code];
    await this._saveCurrencyMap(currencies);
    Toast.success('Currency removed');
    document.getElementById('cur-list').innerHTML = this._renderCurrencyList(currencies);
  },

  async _saveCurrencyMap(currencies) {
    try {
      const existing = JSON.parse(window.appSettings?.custom_rates || '{}');
      if (existing.__parkingRates) currencies.__parkingRates = existing.__parkingRates;
    } catch {}
    const form = document.getElementById('settings-form');
    const data = {};
    new FormData(form).forEach((v, k) => { data[k] = v; });
    data.custom_rates = JSON.stringify(currencies);
    await API.put('/settings', data);
    window.appSettings = { ...window.appSettings, custom_rates: data.custom_rates };
  },

  _getParkingRates() {
    try {
      const parsed = JSON.parse(this.settings.custom_rates || '{}');
      return parsed.__parkingRates || {};
    } catch { return {}; }
  },

  _renderParkingRates(rates) {
    return `<table>
      <thead><tr><th>Vehicle Type</th><th>Rate per Hour</th><th>Currency</th></tr></thead>
      <tbody>${VEHICLE_TYPES.map(vt => {
        const r = rates[vt.value] || {};
        return `<tr>
          <td><i class="fas ${vt.icon}" style="margin-right:6px;color:var(--primary)"></i>${vt.label}</td>
          <td><input type="number" class="pr-rate-input" data-type="${escHtml(vt.value)}" value="${r.rate || ''}" min="0" step="any" placeholder="e.g. 200" style="width:130px;padding:6px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-weight:600"></td>
          <td>${currencySelect('pr_currency_' + vt.value, r.currency || 'USD')}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>
    <div style="padding:12px 16px;background:var(--bg);font-size:12px;color:var(--text-muted);border-top:1px solid var(--border)">
      <i class="fas fa-info-circle"></i> LBP: enter in thousands — 200 = LL 200,000. Calculation: full hours only (6h 15m = 6 hrs).
    </div>
    <div style="padding:16px;border-top:1px solid var(--border);display:flex;align-items:center;gap:12px">
      <button class="btn btn-primary" onclick="UsersPage.saveParkingRates()"><i class="fas fa-save"></i> Save Rates</button>
      <span id="pr-saved-msg" style="display:none;color:#16a34a;font-size:13px;font-weight:600"><i class="fas fa-check-circle"></i> Saved!</span>
    </div>`;
  },

  async saveParkingRates() {
    const rates = {};
    document.querySelectorAll('.pr-rate-input').forEach(input => {
      const type = input.dataset.type;
      const rate = parseFloat(input.value);
      const currSel = document.querySelector(`select[name="pr_currency_${type}"]`);
      rates[type] = { rate: rate > 0 ? rate : null, currency: currSel?.value || 'USD' };
    });
    const currencies = this._loadCurrencies();
    const allData = { ...currencies, __parkingRates: rates };
    const form = document.getElementById('settings-form');
    const data = {};
    new FormData(form).forEach((v, k) => { data[k] = v; });
    data.custom_rates = JSON.stringify(allData);
    await API.put('/settings', data);
    window.appSettings = { ...window.appSettings, custom_rates: data.custom_rates };
    const msg = document.getElementById('pr-saved-msg');
    if (msg) { msg.style.display = 'inline'; setTimeout(() => msg.style.display = 'none', 3000); }
    Toast.success('Parking rates saved');
  },

  renderTable(rows) {
    if (!rows.length) return `<div class="empty-state"><i class="fas fa-users"></i><h4>No users</h4></div>`;
    return `<table>
      <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
      <tbody>${rows.map(u => `<tr>
        <td><div style="display:flex;align-items:center;gap:10px">
          <div class="user-avatar" style="width:32px;height:32px;font-size:13px">${escHtml(u.name.charAt(0).toUpperCase())}</div>
          <strong>${escHtml(u.name)}</strong>
        </div></td>
        <td>${escHtml(u.email)}</td>
        <td><span class="badge ${u.role==='admin'?'badge-purple':'badge-info'}">${escHtml(u.role)}</span></td>
        <td>${statusBadge(u.is_active ? 'active' : 'expired')}</td>
        <td class="text-muted">${fmtDate(u.created_at)}</td>
        <td class="actions">
          <button class="btn btn-sm btn-outline btn-icon" onclick="UsersPage.showEditUser(${u.id})"><i class="fas fa-edit"></i></button>
          ${u.id !== Auth.user?.id ? `<button class="btn btn-sm btn-outline btn-icon" onclick="UsersPage.deleteUser(${u.id})"><i class="fas fa-trash"></i></button>` : ''}
        </td>
      </tr>`).join('')}</tbody>
    </table>`;
  },

  _userFormHtml(u = {}) {
    return `<form id="modal-form"><div class="form-row cols-2">
      <div class="form-group" style="grid-column:1/-1"><label>Full Name *</label><input name="name" required value="${escHtml(u.name || '')}"></div>
      <div class="form-group" style="grid-column:1/-1"><label>Email *</label><input name="email" type="email" required value="${escHtml(u.email || '')}"></div>
      <div class="form-group"><label>${u.id ? 'New Password' : 'Password *'}</label><input name="password" type="password" ${!u.id ? 'required' : ''} placeholder="${u.id ? 'Leave blank to keep current' : 'Min 6 characters'}"></div>
      <div class="form-group"><label>Role</label>
        <select name="role">
          <option value="cashier" ${u.role!=='admin'?'selected':''}>Cashier / Employee</option>
          <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
        </select>
      </div>
      <div class="form-group"><label>Status</label>
        <select name="is_active">
          <option value="1" ${u.is_active!==0?'selected':''}>Active</option>
          <option value="0" ${u.is_active===0?'selected':''}>Inactive</option>
        </select>
      </div>
    </div></form>`;
  },

  showAddUser() {
    Modal.show({ title: 'Add User', body: this._userFormHtml(), onSave: async () => {
      if (!Modal.validate()) throw new Error('Please fill required fields');
      const data = Modal.getFormData();
      await API.post('/users', { ...data, is_active: Number(data.is_active) });
      Modal.close(); Toast.success('User created'); Router.navigate('users');
    }});
  },

  showEditUser(id) {
    const u = this.data.find(x => x.id === id);
    Modal.show({ title: 'Edit User', body: this._userFormHtml(u), onSave: async () => {
      if (!Modal.validate()) throw new Error('Please fill required fields');
      const data = Modal.getFormData();
      if (!data.password) delete data.password;
      await API.put(`/users/${id}`, { ...data, is_active: Number(data.is_active) });
      Modal.close(); Toast.success('User updated'); Router.navigate('users');
    }});
  },

  async saveSettings() {
    const form = document.getElementById('settings-form');
    const data = {};
    new FormData(form).forEach((v, k) => { data[k] = v; });
    data.custom_rates = window.appSettings?.custom_rates || JSON.stringify(this.DEFAULTS);
    await API.put('/settings', data);
    window.appSettings = { ...window.appSettings, ...data };
    const nameEl = document.getElementById('sidebar-business-name');
    if (nameEl) nameEl.textContent = data.business_name || 'My Parking';
    Toast.success('Settings saved');
  },

  async deleteUser(id) {
    if (!confirmDelete('Delete this user account?')) return;
    await API.delete(`/users/${id}`);
    Toast.success('User deleted'); Router.navigate('users');
  }
};

Router.register('users', UsersPage);
