// ============================================================
//  SERVICES PAGE
// ============================================================
const ServicesPage = {
  title: 'Services',
  adminOnly: false,
  data: [],
  _txData: [],
  _currency: 'USD',

  async render() {
    [this.data, this._txData] = await Promise.all([
      API.get('/services'),
      API.get('/transactions?payment_status=paid')
    ]);
    return `
      <div class="page-header">
        <div class="page-title"><h2>Services</h2><p>Manage available wash and cleaning services</p></div>
        <div class="page-actions" style="gap:8px">
          <div style="display:flex;border:1.5px solid var(--border);border-radius:8px;overflow:hidden;height:38px">
            <button id="svc-btn-usd" onclick="ServicesPage.setCurrency('USD')"
              style="padding:0 14px;border:none;background:${this._currency==='USD'?'var(--primary)':'transparent'};color:${this._currency==='USD'?'#fff':'var(--text-muted)'};font-weight:700;cursor:pointer;font-size:13px;transition:.15s">$ USD</button>
            <button id="svc-btn-lbp" onclick="ServicesPage.setCurrency('LBP')"
              style="padding:0 14px;border:none;background:${this._currency==='LBP'?'var(--primary)':'transparent'};color:${this._currency==='LBP'?'#fff':'var(--text-muted)'};font-weight:700;cursor:pointer;font-size:13px;transition:.15s">LL LBP</button>
          </div>
          <span id="svc-total-badge" class="badge badge-success" style="font-size:14px;padding:8px 14px">${this._fmtTotal()}</span>
          ${Auth.isAdmin() ? '<button class="btn btn-primary" onclick="ServicesPage.showAdd()"><i class="fas fa-plus"></i> Add Service</button>' : ''}
        </div>
      </div>
      <div class="filters-bar">
        <input type="text" class="search-input" id="svc-search" placeholder="Search services…">
        <select id="svc-active">
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
      <div class="card">
        <div class="table-wrap" id="services-table">${this.renderTable(this.data)}</div>
      </div>`;
  },

  init() {
    document.getElementById('svc-search').addEventListener('input', () => this.filter());
    document.getElementById('svc-active').addEventListener('change', () => this.filter());
  },

  _fmtTotal() {
    return fmtRaw(sumConverted(this._txData, this._currency, 'final_amount'), this._currency);
  },

  setCurrency(cur) {
    this._currency = cur;
    const uBtn = document.getElementById('svc-btn-usd');
    const lBtn = document.getElementById('svc-btn-lbp');
    if (uBtn) { uBtn.style.background = cur === 'USD' ? 'var(--primary)' : 'transparent'; uBtn.style.color = cur === 'USD' ? '#fff' : 'var(--text-muted)'; }
    if (lBtn) { lBtn.style.background = cur === 'LBP' ? 'var(--primary)' : 'transparent'; lBtn.style.color = cur === 'LBP' ? '#fff' : 'var(--text-muted)'; }
    const badge = document.getElementById('svc-total-badge');
    if (badge) badge.textContent = this._fmtTotal();
  },

  renderTable(rows) {
    if (!rows.length) return `<div class="empty-state"><i class="fas fa-shower"></i><h4>No services found</h4><p>Add wash and cleaning services.</p></div>`;
    return `<table>
      <thead><tr><th>Service Name</th><th>Vehicle Type</th><th>Price</th><th>Description</th><th>Status</th>${Auth.isAdmin() ? '<th>Actions</th>' : ''}</tr></thead>
      <tbody>${rows.map(s => `<tr>
        <td><strong>${escHtml(s.name)}</strong></td>
        <td>${s.vehicle_type === 'both' ? '<span class="badge badge-purple">Both</span>' : vehicleBadge(s.vehicle_type)}</td>
        <td class="fw-bold">${fmtRaw(s.price, s.currency)}</td>
        <td class="text-muted">${escHtml(s.description || '—')}</td>
        <td>${statusBadge(s.is_active ? 'active' : 'expired')}</td>
        ${Auth.isAdmin() ? `<td class="actions">
          <button class="btn btn-sm btn-outline btn-icon" onclick="ServicesPage.showEdit(${s.id})" title="Edit"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-outline btn-icon" onclick="ServicesPage.toggleActive(${s.id},${s.is_active})" title="${s.is_active ? 'Deactivate' : 'Activate'}"><i class="fas fa-${s.is_active ? 'ban' : 'check'}"></i></button>
          <button class="btn btn-sm btn-outline btn-icon" onclick="ServicesPage.deleteService(${s.id})" title="Delete"><i class="fas fa-trash"></i></button>
        </td>` : ''}
      </tr>`).join('')}</tbody>
    </table>`;
  },

  async filter() {
    const search = document.getElementById('svc-search').value;
    const active = document.getElementById('svc-active').value;
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (active !== '') params.set('active', active);
    this.data = await API.get(`/services?${params}`);
    document.getElementById('services-table').innerHTML = this.renderTable(this.data);
  },

  _formHtml(s = {}) {
    return `<form id="modal-form"><div class="form-row cols-2">
      <div class="form-group" style="grid-column:1/-1"><label>Service Name *</label><input name="name" required value="${escHtml(s.name || '')}"></div>
      <div class="form-group"><label>Vehicle Type *</label>
        <select name="vehicle_type" required>${vehicleTypeOptions(s.vehicle_type || 'both', true)}</select>
      </div>
      <div class="form-group"><label>Price *</label><input name="price" type="text" inputmode="numeric" required value="${fmtAmountInput(s.price, s.currency)}"></div>
      <div class="form-group"><label>Currency</label>${currencySelect('currency', s.currency)}</div>
      <div class="form-group"><label>Status</label>
        <select name="is_active"><option value="1" ${s.is_active!==0?'selected':''}>Active</option><option value="0" ${s.is_active===0?'selected':''}>Inactive</option></select>
      </div>
      <div class="form-group" style="grid-column:1/-1"><label>Description</label><textarea name="description">${escHtml(s.description || '')}</textarea></div>
    </div></form>`;
  },

  showAdd() {
    Modal.show({ title: 'Add Service', body: this._formHtml(), onSave: async () => {
      if (!Modal.validate()) throw new Error('Please fill required fields');
      const data = Modal.getFormData();
      await API.post('/services', { ...data, price: parseAmountInput(data.price), is_active: Number(data.is_active) });
      Modal.close(); Toast.success('Service added'); Router.navigate('services');
    }});
  },

  showEdit(id) {
    const s = this.data.find(x => x.id === id);
    Modal.show({ title: 'Edit Service', body: this._formHtml(s), onSave: async () => {
      if (!Modal.validate()) throw new Error('Please fill required fields');
      const data = Modal.getFormData();
      await API.put(`/services/${id}`, { ...data, price: parseAmountInput(data.price), is_active: Number(data.is_active) });
      Modal.close(); Toast.success('Service updated'); Router.navigate('services');
    }});
  },

  async toggleActive(id, current) {
    await API.put(`/services/${id}`, { ...this.data.find(s => s.id === id), is_active: current ? 0 : 1 });
    Toast.success(current ? 'Service deactivated' : 'Service activated');
    Router.navigate('services');
  },

  async deleteService(id) {
    if (!confirmDelete('Delete this service permanently? This cannot be undone.')) return;
    try {
      await API.delete(`/services/${id}`);
      Toast.success('Service deleted');
      Router.navigate('services');
    } catch (e) {
      Toast.error(e.message);
    }
  }
};

Router.register('services', ServicesPage);
