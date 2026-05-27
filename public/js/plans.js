// ============================================================
//  SUBSCRIPTION PLANS PAGE
// ============================================================
const PlansPage = {
  title: 'Subscription Plans',
  adminOnly: false,
  data: [],

  async render() {
    this.data = await API.get('/plans');
    return `
      <div class="page-header">
        <div class="page-title"><h2>Subscription Plans</h2><p>Manage parking subscription packages</p></div>
        <div class="page-actions">
          ${Auth.isAdmin() ? '<button class="btn btn-primary" onclick="PlansPage.showAdd()"><i class="fas fa-plus"></i> Add Plan</button>' : ''}
        </div>
      </div>
      <div class="filters-bar">
        <input type="text" class="search-input" id="plan-search" placeholder="Search plans…" value="">
        <select id="plan-active">
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
      <div class="card">
        <div class="table-wrap">${this.renderTable(this.data)}</div>
      </div>`;
  },

  init() {
    document.getElementById('plan-search').addEventListener('input', () => this.filter());
    document.getElementById('plan-active').addEventListener('change', () => this.filter());
  },

  renderTable(rows) {
    if (!rows.length) return `<div class="empty-state"><i class="fas fa-tags"></i><h4>No plans found</h4><p>Add a subscription plan to get started.</p></div>`;
    return `<table>
      <thead><tr>
        <th>Plan Name</th><th>Vehicle</th><th>Duration</th><th>Price</th><th>Description</th><th>Status</th>${Auth.isAdmin() ? '<th>Actions</th>' : ''}
      </tr></thead>
      <tbody>${rows.map(p => `<tr>
        <td><strong>${escHtml(p.name)}</strong></td>
        <td>${vehicleBadge(p.vehicle_type)}</td>
        <td><span class="badge badge-info">${escHtml(p.duration)}</span></td>
        <td class="fw-bold">${fmtRaw(p.price, p.currency)}</td>
        <td class="text-muted">${escHtml(p.description || '—')}</td>
        <td>${statusBadge(p.is_active ? 'active' : 'expired')}</td>
        ${Auth.isAdmin() ? `<td class="actions">
          <button class="btn btn-sm btn-outline btn-icon" onclick="PlansPage.showEdit(${p.id})" title="Edit"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-outline btn-icon" onclick="PlansPage.toggleActive(${p.id},${p.is_active})" title="${p.is_active ? 'Deactivate' : 'Activate'}"><i class="fas fa-${p.is_active ? 'ban' : 'check'}"></i></button>
          <button class="btn btn-sm btn-outline btn-icon" onclick="PlansPage.deletePlan(${p.id})" title="Delete"><i class="fas fa-trash"></i></button>
        </td>` : ''}
      </tr>`).join('')}</tbody>
    </table>`;
  },

  async filter() {
    const search = document.getElementById('plan-search').value;
    const active = document.getElementById('plan-active').value;
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (active !== '') params.set('active', active);
    try {
      this.data = await API.get(`/plans?${params}`);
      document.querySelector('.card .table-wrap').innerHTML = this.renderTable(this.data);
    } catch (e) { Toast.error(e.message); }
  },

  _formHtml(p = {}) {
    return `<form id="modal-form"><div class="form-row cols-2">
      <div class="form-group" style="grid-column:1/-1"><label>Plan Name *</label><input name="name" required value="${escHtml(p.name || '')}"></div>
      <div class="form-group"><label>Vehicle Type *</label>
        <select name="vehicle_type" required>${vehicleTypeOptions(p.vehicle_type || 'car')}</select>
      </div>
      <div class="form-group"><label>Duration *</label>
        <select name="duration" required>
          <option value="monthly" ${p.duration==='monthly'?'selected':''}>Monthly</option>
          <option value="weekly" ${p.duration==='weekly'?'selected':''}>Weekly</option>
          <option value="daily" ${p.duration==='daily'?'selected':''}>Daily</option>
        </select>
      </div>
      <div class="form-group"><label>Price *</label><input name="price" type="number" step="0.01" min="0" required value="${escHtml(p.price || '')}"></div>
      <div class="form-group"><label>Currency</label>${currencySelect('currency', p.currency)}</div>
      <div class="form-group"><label>Status</label>
        <select name="is_active">
          <option value="1" ${p.is_active!==0?'selected':''}>Active</option>
          <option value="0" ${p.is_active===0?'selected':''}>Inactive</option>
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1"><label>Description</label><textarea name="description">${escHtml(p.description || '')}</textarea></div>
    </div></form>`;
  },

  showAdd() {
    Modal.show({ title: 'Add Subscription Plan', body: this._formHtml(), onSave: async () => {
      if (!Modal.validate()) throw new Error('Please fill all required fields');
      const data = Modal.getFormData();
      await API.post('/plans', { ...data, price: Number(data.price), is_active: Number(data.is_active) });
      Modal.close(); Toast.success('Plan created'); await Router.navigate('plans');
    }});
  },

  async showEdit(id) {
    const p = this.data.find(x => x.id === id) || await API.get(`/plans/${id}`);
    Modal.show({ title: 'Edit Plan', body: this._formHtml(p), onSave: async () => {
      if (!Modal.validate()) throw new Error('Please fill all required fields');
      const data = Modal.getFormData();
      await API.put(`/plans/${id}`, { ...data, price: Number(data.price), is_active: Number(data.is_active) });
      Modal.close(); Toast.success('Plan updated'); await Router.navigate('plans');
    }});
  },

  async toggleActive(id, current) {
    const action = current ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} this plan?`)) return;
    await API.put(`/plans/${id}`, { ...this.data.find(p => p.id === id), is_active: current ? 0 : 1 });
    Toast.success(`Plan ${current ? 'deactivated' : 'activated'}`);
    Router.navigate('plans');
  },

  async deletePlan(id) {
    if (!confirmDelete('Delete this plan permanently? This cannot be undone.')) return;
    try {
      await API.delete(`/plans/${id}`);
      Toast.success('Plan deleted');
      Router.navigate('plans');
    } catch (e) {
      Toast.error(e.message);
    }
  }
};

Router.register('plans', PlansPage);
