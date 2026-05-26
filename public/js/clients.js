// ============================================================
//  CLIENTS PAGE
// ============================================================
const ClientsPage = {
  title: 'Clients',
  data: [],
  plans: [],
  vehicles: [],

  async render() {
    [this.data, this.plans, this.vehicles] = await Promise.all([
      API.get('/clients'),
      API.get('/plans?active=true'),
      API.get('/clients/all/vehicles')
    ]);
    return `
      <div class="page-header">
        <div class="page-title"><h2>Clients</h2><p>Manage subscription clients and their vehicles</p></div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="ClientsPage.showAddClient()"><i class="fas fa-plus"></i> Add Client</button>
        </div>
      </div>
      <div class="filters-bar">
        <input type="text" class="search-input" id="client-search" placeholder="Search by name, mobile, plate…">
      </div>
      <div class="card">
        <div class="table-wrap" id="clients-table">${this.renderTable(this.vehicles)}</div>
      </div>`;
  },

  init() {
    let timer;
    document.getElementById('client-search').addEventListener('input', e => {
      clearTimeout(timer);
      timer = setTimeout(() => this.filter(e.target.value), 300);
    });
  },

  renderTable(rows) {
    if (!rows.length) return `<div class="empty-state"><i class="fas fa-users"></i><h4>No clients found</h4><p>Add your first subscription client.</p></div>`;
    const today_str = today();
    return `<table>
      <thead><tr>
        <th>Client Name</th><th>Mobile</th><th>Plate</th><th>Vehicle</th><th>Plan</th><th>Start</th><th>End Date</th><th>Amount</th><th>Status</th><th>Actions</th>
      </tr></thead>
      <tbody>${rows.map(v => {
        const isExpired = v.end_date && v.end_date < today_str;
        const rowClass = isExpired ? 'row-expired' : '';
        return `<tr class="${rowClass}">
          <td><strong>${escHtml(v.full_name)}</strong>${v.third_party_company ? ` <span class="badge badge-purple" style="font-size:10px">${escHtml(v.third_party_company)}</span>` : ''}</td>
          <td>${escHtml(v.mobile || '—')}</td>
          <td><strong>${escHtml(v.plate_number)}</strong></td>
          <td>${vehicleBadge(v.vehicle_type)}</td>
          <td>${escHtml(v.plan_name || '—')}</td>
          <td>${fmtDate(v.start_date)}</td>
          <td>${isExpired ? `<span class="text-danger">${fmtDate(v.end_date)}</span>` : fmtDate(v.end_date)}</td>
          <td>${fmtAmt(v.amount, v.currency)}</td>
          <td>${statusBadge(isExpired ? 'expired' : v.status)}</td>
          <td class="actions">
            <button class="btn btn-sm btn-outline btn-icon" onclick="ClientsPage.showClientDetail(${v.client_id})" title="View"><i class="fas fa-eye"></i></button>
            <button class="btn btn-sm btn-outline btn-icon" onclick="ClientsPage.showEditVehicle(${v.id})" title="Edit Vehicle"><i class="fas fa-edit"></i></button>
            ${Auth.isAdmin() ? `<button class="btn btn-sm btn-outline btn-icon" onclick="ClientsPage.deleteVehicle(${v.id})" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  },

  async filter(search) {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    this.vehicles = await API.get(`/clients/all/vehicles${params}`);
    document.getElementById('clients-table').innerHTML = this.renderTable(this.vehicles);
  },

  // --- Add Client ---
  _tpOptions(selected = '') {
    try {
      const parsed = JSON.parse(window.appSettings?.custom_rates || '{}');
      const companies = Array.isArray(parsed.__thirdParties) ? parsed.__thirdParties : [];
      return `<option value="">— Not Third Party —</option>${companies.map(c => `<option value="${escHtml(c.name)}" ${c.name === selected ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('')}`;
    } catch { return '<option value="">— Not Third Party —</option>'; }
  },

  showAddClient() {
    Modal.show({ title: 'Add Client', body: `<form id="modal-form">
      <div class="form-row cols-2">
        <div class="form-group" style="grid-column:1/-1"><label>Full Name *</label><input name="full_name" required placeholder="John Doe"></div>
        <div class="form-group"><label>Mobile</label><input name="mobile" placeholder="+1 234 567 8900"></div>
        <div class="form-group"><label><i class="fas fa-building" style="color:var(--primary);margin-right:6px"></i>Third Party Company</label><select name="third_party_company">${this._tpOptions()}</select></div>
        <div class="form-group" style="grid-column:1/-1"><label>Notes</label><textarea name="notes" placeholder="Any notes…"></textarea></div>
      </div>
    </form>`, onSave: async () => {
      if (!Modal.validate()) throw new Error('Full name is required');
      const data = Modal.getFormData();
      const res = await API.post('/clients', data);
      Modal.close();
      this.showAddVehicle(res.id);
      Toast.success('Client created — now add a vehicle');
    }});
  },

  // --- Add Vehicle ---
  showAddVehicle(clientId) {
    const planOpts = this.plans.map(p => `<option value="${p.id}">${escHtml(p.name)} (${p.duration}, ${fmtCurrency(p.price)})</option>`).join('');
    Modal.show({ title: 'Add Vehicle', size: 'lg', body: `<form id="modal-form">
      <div class="form-row cols-2">
        <div class="form-group"><label>Plate Number *</label><input name="plate_number" required placeholder="ABC 1234" style="text-transform:uppercase"></div>
        <div class="form-group"><label>Vehicle Type *</label>
          <select name="vehicle_type" required>${vehicleTypeOptions('car')}</select>
        </div>
        <div class="form-group" style="grid-column:1/-1"><label>Vehicle Model / Brand</label><input name="vehicle_model" placeholder="Toyota Camry, Honda CB…"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Subscription Plan</label>
          <select name="subscription_plan_id" id="veh-plan">
            <option value="">— No Plan —</option>${planOpts}
          </select>
        </div>
        <div class="form-group"><label>Start Date</label><input name="start_date" type="date" value="${today()}"></div>
        <div class="form-group"><label>Monthly Amount</label><input name="amount" type="number" step="0.01" min="0" id="veh-amount" placeholder="0.00"></div>
        <div class="form-group"><label>Currency</label>${currencySelect('currency', 'USD')}</div>
      </div>
    </form>`, onSave: async () => {
      if (!Modal.validate()) throw new Error('Please fill required fields');
      const data = Modal.getFormData();
      if (!data.plate_number) throw new Error('Plate number is required');
      data.plate_number = data.plate_number.toUpperCase();
      await API.post(`/clients/${clientId}/vehicles`, { ...data, amount: Number(data.amount) || 0 });
      Modal.close(); Toast.success('Vehicle added'); Router.navigate('clients');
    }});
    // Auto-fill amount from plan
    setTimeout(() => {
      document.getElementById('veh-plan')?.addEventListener('change', e => {
        const plan = this.plans.find(p => p.id == e.target.value);
        if (plan) document.getElementById('veh-amount').value = plan.price;
      });
    }, 50);
  },

  // --- Client Detail Modal ---
  async showClientDetail(clientId) {
    const c = await API.get(`/clients/${clientId}`);
    const vehicleRows = c.vehicles.map(v => `<tr>
      <td>${escHtml(v.plate_number)}</td>
      <td>${vehicleBadge(v.vehicle_type)}</td>
      <td>${escHtml(v.vehicle_model || '—')}</td>
      <td>${escHtml(v.plan_name || '—')}</td>
      <td>${fmtDate(v.end_date)}</td>
      <td>${fmtAmt(v.amount, v.currency)}</td>
      <td>${statusBadge(v.status)}</td>
      <td>
        <button class="btn btn-sm btn-outline btn-icon" onclick="ClientsPage.showEditVehicle(${v.id})"><i class="fas fa-edit"></i></button>
      </td>
    </tr>`).join('');

    Modal.show({ title: `Client: ${c.full_name}`, size: 'lg', showFooter: false, body: `
      <div class="detail-grid">
        <div class="detail-item"><label>Full Name</label><span>${escHtml(c.full_name)}</span></div>
        <div class="detail-item"><label>Mobile</label><span>${escHtml(c.mobile || '—')}</span></div>
        <div class="detail-item" style="grid-column:1/-1"><label>Notes</label><span>${escHtml(c.notes || '—')}</span></div>
      </div>
      <div class="sub-section">
        <h4>Vehicles <button class="btn btn-sm btn-primary" onclick="Modal.close();ClientsPage.showAddVehicle(${c.id})"><i class="fas fa-plus"></i> Add Vehicle</button></h4>
        ${c.vehicles.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Plate</th><th>Type</th><th>Model</th><th>Plan</th><th>End Date</th><th>Amount</th><th>Status</th><th></th></tr></thead>
          <tbody>${vehicleRows}</tbody>
        </table></div>` : '<p class="text-muted">No vehicles registered.</p>'}
      </div>
      <div class="modal-footer" style="border-top:1px solid var(--border);margin-top:20px;padding-top:16px;display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-outline" onclick="ClientsPage.showEditClient(${c.id})"><i class="fas fa-edit"></i> Edit Client</button>
        ${Auth.isAdmin() ? `<button class="btn btn-danger" onclick="Modal.close();ClientsPage.deleteClient(${c.id})"><i class="fas fa-trash"></i> Delete</button>` : ''}
        <button class="btn btn-outline" onclick="Modal.close()">Close</button>
      </div>`
    });
  },

  async showEditClient(clientId) {
    let c = this.data.find(x => x.id === clientId);
    if (!c) {
      try { const full = await API.get(`/clients/${clientId}`); c = full; }
      catch { Toast.error('Client not found'); return; }
    }
    Modal.show({ title: 'Edit Client', body: `<form id="modal-form">
      <div class="form-row cols-2">
        <div class="form-group" style="grid-column:1/-1"><label>Full Name *</label><input name="full_name" required value="${escHtml(c.full_name)}"></div>
        <div class="form-group"><label>Mobile</label><input name="mobile" value="${escHtml(c.mobile || '')}"></div>
        <div class="form-group"><label><i class="fas fa-building" style="color:var(--primary);margin-right:6px"></i>Third Party Company</label><select name="third_party_company">${this._tpOptions(c.third_party_company || '')}</select></div>
        <div class="form-group" style="grid-column:1/-1"><label>Notes</label><textarea name="notes">${escHtml(c.notes || '')}</textarea></div>
      </div>
    </form>`, onSave: async () => {
      if (!Modal.validate()) throw new Error('Full name is required');
      await API.put(`/clients/${clientId}`, Modal.getFormData());
      Modal.close(); Toast.success('Client updated'); Router.navigate('clients');
    }});
  },

  async showEditVehicle(vehicleId) {
    const v = this.vehicles.find(x => x.id === vehicleId);
    if (!v) return;
    const planOpts = this.plans.map(p => `<option value="${p.id}" ${v.subscription_plan_id==p.id?'selected':''}>${escHtml(p.name)} (${fmtCurrency(p.price)})</option>`).join('');
    Modal.show({ title: 'Edit Vehicle', size: 'lg', body: `<form id="modal-form">
      <div class="form-row cols-2">
        <div class="form-group"><label>Plate Number *</label><input name="plate_number" required value="${escHtml(v.plate_number)}"></div>
        <div class="form-group"><label>Vehicle Type *</label>
          <select name="vehicle_type" required>${vehicleTypeOptions(v.vehicle_type)}</select>
        </div>
        <div class="form-group" style="grid-column:1/-1"><label>Model / Brand</label><input name="vehicle_model" value="${escHtml(v.vehicle_model || '')}"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Subscription Plan</label>
          <select name="subscription_plan_id"><option value="">— No Plan —</option>${planOpts}</select>
        </div>
        <div class="form-group"><label>Start Date</label><input name="start_date" type="date" value="${v.start_date || ''}"></div>
        <div class="form-group"><label>Monthly Amount</label><input name="amount" type="number" step="0.01" value="${v.amount || 0}"></div>
        <div class="form-group"><label>Currency</label>${currencySelect('currency', v.currency)}</div>
        <div class="form-group"><label>Status</label>
          <select name="status">
            <option value="active" ${v.status==='active'?'selected':''}>Active</option>
            <option value="expired" ${v.status==='expired'?'selected':''}>Expired</option>
            <option value="suspended" ${v.status==='suspended'?'selected':''}>Suspended</option>
          </select>
        </div>
      </div>
    </form>`, onSave: async () => {
      if (!Modal.validate()) throw new Error('Please fill required fields');
      const data = Modal.getFormData();
      await API.put(`/clients/vehicles/${vehicleId}`, { ...data, amount: Number(data.amount), currency: data.currency || 'USD' });
      Modal.close(); Toast.success('Vehicle updated'); Router.navigate('clients');
    }});
  },

  async deleteClient(clientId) {
    if (!confirmDelete('Delete this client and all their vehicles?')) return;
    await API.delete(`/clients/${clientId}`);
    Toast.success('Client deleted'); Router.navigate('clients');
  },

  async deleteVehicle(vehicleId) {
    if (!confirmDelete('Delete this vehicle record?')) return;
    await API.delete(`/clients/vehicles/${vehicleId}`);
    Toast.success('Vehicle deleted'); Router.navigate('clients');
  }
};

Router.register('clients', ClientsPage);
