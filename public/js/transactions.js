// ============================================================
//  DAILY SERVICES / TRANSACTIONS PAGE
// ============================================================
const TransactionsPage = {
  title: 'Daily Services',
  data: [],
  services: [],
  clients: [],
  _currency: 'USD',

  async render() {
    [this.data, this.services, this.clients] = await Promise.all([
      API.get(`/transactions?date_from=${today()}&date_to=${today()}`),
      API.get('/services?active=true'),
      API.get('/clients')
    ]);
    return `
      <div class="page-header">
        <div class="page-title"><h2>Daily Services</h2><p>Record wash and cleaning transactions</p></div>
        <div class="page-actions">
          <div style="display:flex;border:1.5px solid var(--border);border-radius:8px;overflow:hidden;height:38px">
            <button id="tx-btn-usd" onclick="TransactionsPage.setCurrency('USD')"
              style="padding:0 14px;border:none;background:${this._currency==='USD'?'var(--primary)':'transparent'};color:${this._currency==='USD'?'#fff':'var(--text-muted)'};font-weight:700;cursor:pointer;font-size:13px;transition:.15s">$ USD</button>
            <button id="tx-btn-lbp" onclick="TransactionsPage.setCurrency('LBP')"
              style="padding:0 14px;border:none;background:${this._currency==='LBP'?'var(--primary)':'transparent'};color:${this._currency==='LBP'?'#fff':'var(--text-muted)'};font-weight:700;cursor:pointer;font-size:13px;transition:.15s">LL LBP</button>
          </div>
          <span id="tx-total" class="badge badge-success" style="font-size:14px;padding:8px 14px">${this._fmtTotal(this.data)}</span>
          <button class="btn btn-primary" onclick="TransactionsPage.showAdd()"><i class="fas fa-plus"></i> New Service</button>
        </div>
      </div>
      <div class="filters-bar">
        <input type="text" class="search-input" id="tx-search" placeholder="Search plate, client…">
        <input type="date" id="tx-from" value="${today()}">
        <input type="date" id="tx-to"   value="${today()}">
        <select id="tx-vehicle">
          <option value="">All Vehicles</option>${VEHICLE_TYPES.map(t=>`<option value="${t.value}">${t.label}</option>`).join('')}
        </select>
        <select id="tx-service">
          <option value="">All Services</option>
          ${this.services.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('')}
        </select>
        <select id="tx-status">
          <option value="">All Status</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option>
        </select>
      </div>
      <div class="card">
        <div class="table-wrap" id="tx-table">${this.renderTable(this.data)}</div>
      </div>`;
  },

  init() {
    document.getElementById('tx-search').addEventListener('keypress', e => { if (e.key === 'Enter') this.applyFilter(); });
    document.getElementById('tx-from').addEventListener('change', () => this.applyFilter());
    document.getElementById('tx-to').addEventListener('change', () => this.applyFilter());
    document.getElementById('tx-status').addEventListener('change', () => this.applyFilter());
    document.getElementById('tx-vehicle').addEventListener('change', () => this.applyFilter());
    document.getElementById('tx-service').addEventListener('change', () => this.applyFilter());
  },

  _fmtTotal(data) {
    const cur = this._currency;
    const paid = data.filter(t => t.payment_status === 'paid');
    return fmtRaw(sumConverted(paid, cur, 'final_amount'), cur);
  },

  setCurrency(cur) {
    this._currency = cur;
    const uBtn = document.getElementById('tx-btn-usd');
    const lBtn = document.getElementById('tx-btn-lbp');
    if (uBtn) { uBtn.style.background = cur === 'USD' ? 'var(--primary)' : 'transparent'; uBtn.style.color = cur === 'USD' ? '#fff' : 'var(--text-muted)'; }
    if (lBtn) { lBtn.style.background = cur === 'LBP' ? 'var(--primary)' : 'transparent'; lBtn.style.color = cur === 'LBP' ? '#fff' : 'var(--text-muted)'; }
    this._updateTotals();
  },

  _updateTotals() {
    const badge = document.getElementById('tx-total');
    if (badge) badge.textContent = this._fmtTotal(this.data);
  },

  renderTable(rows) {
    if (!rows.length) return `<div class="empty-state"><i class="fas fa-shower"></i><h4>No service records</h4><p>Record a new wash or cleaning service.</p></div>`;
    return `<table>
      <thead><tr><th>Date</th><th>Client</th><th>Plate</th><th>Vehicle</th><th>Service</th><th>Price</th><th>Discount</th><th>Total</th><th>Payment</th><th>Actions</th></tr></thead>
      <tbody>${rows.map(t => `<tr>
        <td>${fmtDate(t.service_date)}</td>
        <td>${escHtml(t.client_name || '—')}</td>
        <td>${escHtml(t.plate_number || '—')}</td>
        <td>${vehicleBadge(t.vehicle_type)}</td>
        <td>${escHtml(t.service_name || '—')}</td>
        <td>${fmtRaw(t.price, t.currency)}</td>
        <td>${t.discount > 0 ? fmtRaw(t.discount, t.currency) : '—'}</td>
        <td class="fw-bold">${fmtRaw(t.final_amount, t.currency)}</td>
        <td>${statusBadge(t.payment_status)}</td>
        <td class="actions">
          <button class="btn btn-sm btn-outline btn-icon" onclick="TransactionsPage.showEdit(${t.id})"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-outline btn-icon" onclick="TransactionsPage.deleteRecord(${t.id})"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('')}</tbody>
    </table>`;
  },

  _formHtml(t = {}) {
    // Determine which service is pre-selected to infer default currency
    const defaultSvc = t.service_id ? this.services.find(s => s.id == t.service_id) : this.services[0];
    const defaultCurrency = t.currency || defaultSvc?.currency || 'USD';

    const svcOpts = this.services.map(s =>
      `<option value="${s.id}" data-price="${s.price}" data-currency="${s.currency || 'USD'}" ${t.service_id==s.id?'selected':''}>${escHtml(s.name)} (${fmtRaw(s.price, s.currency)})</option>`
    ).join('');

    return `<form id="modal-form"><div class="form-row cols-2">
      <div class="form-group"><label>Service Date</label><input name="service_date" type="date" value="${t.service_date || today()}"></div>
      <div class="form-group"><label>Client Name</label><input name="client_name" value="${escHtml(t.client_name || '')}" placeholder="Optional"></div>
      <div class="form-group"><label>Mobile</label><input name="mobile" value="${escHtml(t.mobile || '')}" placeholder="Optional"></div>
      <div class="form-group"><label>Plate Number</label><input name="plate_number" value="${escHtml(t.plate_number || '')}" placeholder="ABC 1234"></div>
      <div class="form-group"><label>Vehicle Type</label>
        <select name="vehicle_type">${vehicleTypeOptions(t.vehicle_type || 'car')}</select>
      </div>
      <div class="form-group" style="grid-column:1/-1"><label>Service</label>
        <select name="service_id" id="tx-service-sel" onchange="TransactionsPage.fillPrice()">${svcOpts}</select>
      </div>
      <div class="form-group"><label>Price</label><input name="price" type="number" step="0.01" id="tx-price" value="${t.price ?? (defaultSvc?.price ?? 0)}"></div>
      <div class="form-group"><label>Currency</label>${currencySelect('currency', defaultCurrency)}</div>
      <div class="form-group"><label>Payment Status</label>
        <select name="payment_status"><option value="paid" ${t.payment_status==='paid'?'selected':''}>Paid</option><option value="unpaid" ${t.payment_status!=='paid'?'selected':''}>Unpaid</option></select>
      </div>
    </div></form>`;
  },

  fillPrice() {
    const sel = document.getElementById('tx-service-sel');
    const opt = sel?.options[sel.selectedIndex];
    if (!opt) return;
    if (opt.dataset.price !== undefined) document.getElementById('tx-price').value = opt.dataset.price;
    if (opt.dataset.currency) {
      const curSel = document.querySelector('#modal-form select[name="currency"]');
      if (curSel) curSel.value = opt.dataset.currency;
    }
  },

  showAdd() {
    Modal.show({ title: 'New Service Transaction', size: 'sm', body: this._formHtml(), onSave: async () => {
      const data = Modal.getFormData();
      await API.post('/transactions', { ...data, price: Number(data.price), discount: 0, final_amount: Number(data.price) });
      Modal.close(); Toast.success('Service recorded'); this.applyFilter();
    }});
  },

  showEdit(id) {
    const t = this.data.find(x => x.id === id);
    Modal.show({ title: 'Edit Transaction', size: 'sm', body: this._formHtml(t), onSave: async () => {
      const data = Modal.getFormData();
      await API.put(`/transactions/${id}`, { ...data, price: Number(data.price), discount: 0, final_amount: Number(data.price) });
      Modal.close(); Toast.success('Updated'); this.applyFilter();
    }});
  },

  async applyFilter() {
    const params = new URLSearchParams();
    const search = document.getElementById('tx-search')?.value;
    const from   = document.getElementById('tx-from')?.value;
    const to     = document.getElementById('tx-to')?.value;
    const veh    = document.getElementById('tx-vehicle')?.value;
    const svc    = document.getElementById('tx-service')?.value;
    const status = document.getElementById('tx-status')?.value;
    if (search) params.set('search', search);
    if (from)   params.set('date_from', from);
    if (to)     params.set('date_to', to);
    if (veh)    params.set('vehicle_type', veh);
    if (svc)    params.set('service_id', svc);
    if (status) params.set('payment_status', status);
    this.data = await API.get(`/transactions?${params}`);
    document.getElementById('tx-table').innerHTML = this.renderTable(this.data);
    this._updateTotals();
  },

  async deleteRecord(id) {
    if (!confirmDelete()) return;
    await API.delete(`/transactions/${id}`);
    Toast.success('Deleted'); this.applyFilter();
  }
};

Router.register('transactions', TransactionsPage);
