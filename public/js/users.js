// ============================================================
//  USERS & SETTINGS PAGE
// ============================================================
const UsersPage = {
  title: 'Users & Settings',
  adminOnly: true,
  data: [],
  settings: {},

  async render() {
    [this.data, this.settings] = await Promise.all([API.get('/users'), API.get('/settings')]);
    let customRates = {};
    try { customRates = JSON.parse(this.settings.custom_rates || '{}'); } catch {}
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
            <div class="form-group"><label>Default Currency</label>
              <select name="currency">
                ${Object.entries(CURRENCIES).map(([code, cfg]) =>
                  `<option value="${code}" ${this.settings.currency===code?'selected':''}>${cfg.symbol} — ${cfg.name} (${code})</option>`
                ).join('')}
              </select>
            </div>
          </div>
          <div style="margin-top:16px">
            <button type="button" class="btn btn-primary" onclick="UsersPage.saveSettings()"><i class="fas fa-save"></i> Save Settings</button>
          </div>
          </form>
        </div>
      </div>

      <!-- Custom Exchange Rates -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <span class="card-title"><i class="fas fa-exchange-alt" style="color:var(--primary);margin-right:8px"></i>Custom Exchange Rates</span>
          <span class="text-muted" style="font-size:12px">How many units equal 1 USD</span>
        </div>
        <div class="card-body">
          <div style="display:flex;flex-direction:column;gap:12px;max-width:380px">
            ${[['LBP','LL Lebanese Pound',customRates.LBP||89500],['IQD','IQD Iraqi Dinar',customRates.IQD||1310],['SYP','SYP Syrian Pound',customRates.SYP||14000]].map(([code,label,val])=>`
            <div style="display:flex;align-items:center;gap:12px">
              <span style="font-weight:700;font-size:13px;width:36px;color:var(--primary)">${code}</span>
              <span style="color:var(--text-muted);font-size:13px;white-space:nowrap">1 USD =</span>
              <input type="number" class="rate-value" data-currency="${code}" value="${val}" min="0" step="any"
                style="flex:1;font-size:15px;font-weight:700;text-align:right">
              <span style="color:var(--text-muted);font-size:12px;white-space:nowrap">${label}</span>
            </div>`).join('')}
          </div>
          <div style="margin-top:16px">
            <button type="button" class="btn btn-primary" onclick="UsersPage.saveCustomRates()">
              <i class="fas fa-save"></i> Save Rates
            </button>
            <span id="rates-saved-msg" style="display:none;margin-left:12px;color:#16a34a;font-size:13px;font-weight:600">
              <i class="fas fa-check-circle"></i> Saved!
            </span>
          </div>
        </div>
      </div>

      <!-- Users -->
      <div class="card">
        <div class="card-header"><span class="card-title"><i class="fas fa-users" style="margin-right:8px"></i>System Users</span></div>
        <div class="table-wrap" id="users-table">${this.renderTable(this.data)}</div>
      </div>`;
  },

  init() {},

  _renderRateRows(rates) {
    const entries = Object.entries(rates);
    if (!entries.length) return `<p class="text-muted" id="rates-empty" style="font-size:13px;margin:0">No custom rates yet. Click "Add Currency" to add one.</p>`;
    return `
      <div style="display:grid;grid-template-columns:auto 32px auto auto;align-items:center;gap:10px 12px;max-width:520px">
        <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">Currency</div>
        <div></div>
        <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">1 USD =</div>
        <div></div>
        ${entries.map(([code, rate]) => this._rateRowHtml(code, rate)).join('')}
      </div>`;
  },

  _rateRowHtml(code = '', rate = '') {
    return `
      <select class="rate-currency" style="font-size:13px;font-weight:600">
        <option value="">— Select —</option>
        ${Object.entries(CURRENCIES).map(([c, cfg]) =>
          `<option value="${c}" ${c === code ? 'selected' : ''}>${cfg.symbol} — ${cfg.name} (${c})</option>`
        ).join('')}
      </select>
      <span style="font-size:16px;color:var(--text-muted);text-align:center">=</span>
      <input type="number" class="rate-value" value="${escHtml(String(rate))}" min="0" step="any"
        placeholder="e.g. 89500" style="font-size:15px;font-weight:700;text-align:right">
      <button type="button" class="btn btn-sm btn-outline btn-icon rate-row" onclick="UsersPage.removeRateRow(this)" title="Remove">
        <i class="fas fa-trash"></i>
      </button>`;
  },

  addRateRow() {
    const list = document.getElementById('custom-rates-list');
    const empty = document.getElementById('rates-empty');
    if (empty) {
      empty.remove();
      // Build the grid wrapper first
      list.innerHTML = `
        <div id="rates-grid" style="display:grid;grid-template-columns:auto 32px auto auto;align-items:center;gap:10px 12px;max-width:520px">
          <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">Currency</div>
          <div></div>
          <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">1 USD =</div>
          <div></div>
        </div>`;
    }
    const grid = document.getElementById('rates-grid') || list.querySelector('div[style*="grid"]');
    grid.insertAdjacentHTML('beforeend', this._rateRowHtml());
  },

  removeRateRow(btn) {
    // Each row is 4 sibling elements in the grid; btn is the 4th
    const siblings = [btn.previousElementSibling, btn.previousElementSibling?.previousElementSibling, btn.previousElementSibling?.previousElementSibling?.previousElementSibling, btn];
    siblings.forEach(el => el?.remove());
    const grid = document.getElementById('rates-grid') || document.querySelector('#custom-rates-list div[style*="grid"]');
    if (grid && !grid.querySelector('.rate-currency')) {
      document.getElementById('custom-rates-list').innerHTML =
        `<p class="text-muted" id="rates-empty" style="font-size:13px;margin:0">No custom rates yet. Click "Add Currency" to add one.</p>`;
    }
  },

  _collectCustomRates() {
    const rates = {};
    document.querySelectorAll('.rate-value[data-currency]').forEach(input => {
      const code = input.dataset.currency;
      const rate = parseFloat(input.value);
      if (code && rate > 0) rates[code] = rate;
    });
    return rates;
  },

  async saveCustomRates() {
    const customRates = this._collectCustomRates();
    const form = document.getElementById('settings-form');
    const data = {};
    new FormData(form).forEach((v, k) => { data[k] = v; });
    data.custom_rates = JSON.stringify(customRates);
    await API.put('/settings', data);
    window.appSettings = { ...window.appSettings, custom_rates: data.custom_rates };

    const msg = document.getElementById('rates-saved-msg');
    if (msg) { msg.style.display = 'inline'; setTimeout(() => { msg.style.display = 'none'; }, 3000); }
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
    data.custom_rates = JSON.stringify(this._collectCustomRates());
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
