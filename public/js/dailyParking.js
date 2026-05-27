// ============================================================
//  DAILY PARKING PAGE
// ============================================================
const DailyParkingPage = {
  title: 'Daily Parking',
  data: [],
  activeTab: 'checkin',

  async render() {
    this.data = await API.get('/daily-parking');
    const parked    = this.data.filter(d => d.parking_status === 'parked');
    const completed = this.data.filter(d => d.parking_status === 'completed');
    return `
      <div class="page-header">
        <div class="page-title"><h2>Daily Parking</h2><p>Manage non-subscription vehicle check-ins</p></div>
        <div class="page-actions" id="dp-header-actions">
          ${this.activeTab === 'checkin' ? `<button class="btn btn-primary" onclick="DailyParkingPage.showCheckIn()"><i class="fas fa-car"></i> Check In</button>` : ''}
        </div>
      </div>

      <div class="page-tabs">
        <button class="page-tab-btn ${this.activeTab === 'checkin' ? 'active' : ''}" onclick="DailyParkingPage.switchTab('checkin')">
          <i class="fas fa-sign-in-alt"></i> Check In
          <span class="page-tab-badge">${parked.length}</span>
        </button>
        <button class="page-tab-btn ${this.activeTab === 'checkout' ? 'active' : ''}" onclick="DailyParkingPage.switchTab('checkout')">
          <i class="fas fa-sign-out-alt"></i> Check Out
          <span class="page-tab-badge">${parked.length}</span>
        </button>
      </div>

      <div class="filters-bar">
        <input type="text" class="search-input" id="dp-search" placeholder="Search plate number…">
        <label style="font-size:13px;color:var(--text-muted);white-space:nowrap">From</label>
        <input type="date" id="dp-from" style="padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px">
        <label style="font-size:13px;color:var(--text-muted);white-space:nowrap">To</label>
        <input type="date" id="dp-to" style="padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px">
        <button class="btn btn-outline" onclick="DailyParkingPage.clearFilter()"><i class="fas fa-times"></i> Clear</button>
      </div>

      <!-- Check In Tab -->
      <div id="dp-tab-checkin" style="${this.activeTab === 'checkin' ? '' : 'display:none'}">
        <div class="card">
          <div class="card-header">
            <span class="card-title"><i class="fas fa-car text-info" style="margin-right:8px"></i> Currently Parked (${parked.length})</span>
          </div>
          <div class="table-wrap" id="parked-table">${this.renderParked(parked)}</div>
        </div>
      </div>

      <!-- Check Out Tab -->
      <div id="dp-tab-checkout" style="${this.activeTab === 'checkout' ? '' : 'display:none'}">
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <span class="card-title"><i class="fas fa-sign-out-alt" style="color:var(--warning);margin-right:8px"></i> Pending Check Out (${parked.length})</span>
          </div>
          <div class="table-wrap" id="pending-checkout-table">${this.renderPendingCheckout(parked)}</div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title"><i class="fas fa-check-circle text-success" style="margin-right:8px"></i> Completed Records</span>
          </div>
          <div class="table-wrap" id="completed-table">${this.renderCompleted(completed)}</div>
        </div>
      </div>`;
  },

  init() {
    document.getElementById('dp-search').addEventListener('keypress', e => { if (e.key === 'Enter') this.applyFilter(); });
    document.getElementById('dp-from').addEventListener('change', () => this.applyFilter());
    document.getElementById('dp-to').addEventListener('change', () => this.applyFilter());
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.page-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${tab}'`));
    });
    document.getElementById('dp-tab-checkin').style.display  = tab === 'checkin'  ? '' : 'none';
    document.getElementById('dp-tab-checkout').style.display = tab === 'checkout' ? '' : 'none';
    const actions = document.getElementById('dp-header-actions');
    if (actions) actions.innerHTML = tab === 'checkin'
      ? `<button class="btn btn-primary" onclick="DailyParkingPage.showCheckIn()"><i class="fas fa-car"></i> Check In</button>`
      : '';
  },

  // Check In tab: currently parked — edit/delete only
  renderParked(rows) {
    if (!rows.length) return `<div class="empty-state" style="padding:30px"><i class="fas fa-parking"></i><h4>No vehicles parked</h4><p>Currently the lot is empty.</p></div>`;
    return `<table>
      <thead><tr><th>Plate</th><th>Vehicle</th><th>Entry Time</th><th>Duration</th><th>Notes</th><th>Actions</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td><strong>${escHtml(r.plate_number)}</strong>${r.third_party_company ? ` <span class="badge badge-purple" style="font-size:10px">${escHtml(r.third_party_company)}</span>` : ''}</td>
        <td>${vehicleBadge(r.vehicle_type)}</td>
        <td>${fmtDateTime(r.entry_time)}</td>
        <td class="text-muted">${this.liveDuration(r.entry_time)}</td>
        <td class="text-muted">${escHtml(r.notes || '—')}</td>
        <td class="actions">
          <button class="btn btn-sm btn-outline btn-icon" onclick="DailyParkingPage.showEdit(${r.id})" title="Edit"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-outline btn-icon" onclick="DailyParkingPage.deleteRecord(${r.id})" title="Delete"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('')}</tbody>
    </table>`;
  },

  // Check Out tab: currently parked — with checkout button
  renderPendingCheckout(rows) {
    if (!rows.length) return `<div class="empty-state" style="padding:30px"><i class="fas fa-sign-out-alt"></i><h4>No vehicles pending checkout</h4><p>All vehicles have been checked out.</p></div>`;
    return `<table>
      <thead><tr><th>Plate</th><th>Vehicle</th><th>Entry Time</th><th>Duration</th><th>Notes</th><th>Actions</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td><strong>${escHtml(r.plate_number)}</strong>${r.third_party_company ? ` <span class="badge badge-purple" style="font-size:10px">${escHtml(r.third_party_company)}</span>` : ''}</td>
        <td>${vehicleBadge(r.vehicle_type)}</td>
        <td>${fmtDateTime(r.entry_time)}</td>
        <td class="text-muted">${this.liveDuration(r.entry_time)}</td>
        <td class="text-muted">${escHtml(r.notes || '—')}</td>
        <td class="actions">
          <button class="btn btn-sm btn-success" onclick="DailyParkingPage.showCheckOut(${r.id})"><i class="fas fa-sign-out-alt"></i> Check Out</button>
          <button class="btn btn-sm btn-outline btn-icon" onclick="DailyParkingPage.showEdit(${r.id})" title="Edit"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-outline btn-icon" onclick="DailyParkingPage.deleteRecord(${r.id})" title="Delete"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('')}</tbody>
    </table>`;
  },

  renderCompleted(rows) {
    if (!rows.length) return `<div class="empty-state" style="padding:30px"><i class="fas fa-history"></i><h4>No completed records</h4><p>Completed records will appear here.</p></div>`;
    return `<table>
      <thead><tr><th>Plate</th><th>Vehicle</th><th>Entry</th><th>Exit</th><th>Duration</th><th>Amount</th><th>Payment</th><th>Actions</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td><strong>${escHtml(r.plate_number)}</strong>${r.third_party_company ? ` <span class="badge badge-purple" style="font-size:10px">${escHtml(r.third_party_company)}</span>` : ''}</td>
        <td>${vehicleBadge(r.vehicle_type)}</td>
        <td>${fmtDateTime(r.entry_time)}</td>
        <td>${fmtDateTime(r.exit_time)}</td>
        <td>${fmtDuration(r.duration_minutes)}</td>
        <td class="fw-bold">${fmtAmt(r.amount, r.currency)}</td>
        <td>${statusBadge(r.payment_status)}</td>
        <td class="actions">
          <button class="btn btn-sm btn-outline btn-icon" onclick="DailyParkingPage.showEdit(${r.id})" title="Edit"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-outline btn-icon" onclick="DailyParkingPage.deleteRecord(${r.id})" title="Delete"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('')}</tbody>
    </table>`;
  },

  liveDuration(entry) {
    const mins = Math.round((Date.now() - new Date(entry)) / 60000);
    return fmtDuration(mins);
  },

  showCheckIn() {
    const now = nowLebanon();
    Modal.show({ title: 'Check In Vehicle', body: `<form id="modal-form">
      <div class="form-row cols-2">
        <div class="form-group"><label>Plate Number *</label><input name="plate_number" required placeholder="ABC 1234" style="text-transform:uppercase"></div>
        <div class="form-group"><label>Vehicle Type *</label>
          <select name="vehicle_type" required>${vehicleTypeOptions('car')}</select>
        </div>
        <div class="form-group" style="grid-column:1/-1"><label>Entry Time</label><input name="entry_time" type="datetime-local" value="${now}"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Notes</label><textarea name="notes" placeholder="Optional notes…"></textarea></div>
        <div class="form-group" style="grid-column:1/-1"><label><i class="fas fa-building" style="color:var(--primary);margin-right:6px"></i>Third Party Company</label>
          <select name="third_party_company"><option value="">— Not Third Party —</option>${(() => { try { const p = JSON.parse(window.appSettings?.custom_rates||'{}'); return (Array.isArray(p.__thirdParties)?p.__thirdParties:[]).map(c=>`<option value="${escHtml(c.name)}">${escHtml(c.name)}</option>`).join(''); } catch { return ''; } })()}</select>
        </div>
      </div>
    </form>`, saveLabel: 'Check In', onSave: async () => {
      if (!Modal.validate()) throw new Error('Plate number and vehicle type required');
      const data = Modal.getFormData();
      data.plate_number = data.plate_number.toUpperCase();
      await API.post('/daily-parking', data);
      Modal.close(); Toast.success('Vehicle checked in'); Router.navigate('daily-parking');
    }});
  },

  showCheckOut(id) {
    const record = this.data.find(r => r.id === id);
    const mins = Math.round((Date.now() - new Date(record?.entry_time)) / 60000);

    let autoCurrency, multiplier, inputAmount, calcNote;
    if (record?.third_party_company) {
      try {
        const parsed = JSON.parse(window.appSettings?.custom_rates || '{}');
        const company = (parsed.__thirdParties || []).find(c => c.name === record.third_party_company);
        if (company) {
          autoCurrency = company.currency || 'USD';
          multiplier = (_getCurrencyMap()[autoCurrency] || {}).multiplier || 1;
          inputAmount = Number(company.rate);
          calcNote = `<div style="margin-top:6px;padding:6px 10px;background:var(--bg);border-radius:6px;font-size:12px;color:var(--text-muted)"><i class="fas fa-building" style="margin-right:4px"></i>${escHtml(company.name)} — ${fmtRaw(company.rate, autoCurrency)} / month (flat rate)</div>`;
        } else {
          autoCurrency = 'USD'; multiplier = 1; inputAmount = 0;
          calcNote = `<div style="margin-top:6px;font-size:12px;color:var(--text-muted)">Third party company not found — enter manually</div>`;
        }
      } catch {
        autoCurrency = 'USD'; multiplier = 1; inputAmount = 0;
        calcNote = `<div style="margin-top:6px;font-size:12px;color:var(--text-muted)">Enter amount manually</div>`;
      }
    } else {
      const calc = calcParkingAmount(record?.vehicle_type, mins);
      autoCurrency = calc ? calc.currency : 'USD';
      multiplier = (_getCurrencyMap()[autoCurrency] || {}).multiplier || 1;
      inputAmount = calc ? Math.round(calc.amount * multiplier) : 0;
      calcNote = calc
        ? `<div style="margin-top:6px;padding:6px 10px;background:var(--bg);border-radius:6px;font-size:12px;color:var(--text-muted)"><i class="fas fa-calculator" style="margin-right:4px"></i>${fmtDuration(mins)} → tier ${calc.tier.from}h–${calc.tier.to != null ? calc.tier.to + 'h' : '∞'} = ${fmtAmt(calc.amount, calc.currency)}</div>`
        : `<div style="margin-top:6px;font-size:12px;color:var(--text-muted)">No rate tier set — enter manually</div>`;
    }
    Modal.show({ title: `Check Out — ${record?.plate_number}`, body: `
      <div style="background:var(--bg);border-radius:8px;padding:14px;margin-bottom:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div><small class="text-muted">Entry</small><div>${fmtDateTime(record?.entry_time)}</div></div>
          <div><small class="text-muted">Duration</small><div>${fmtDuration(mins)}</div></div>
        </div>
      </div>
      <form id="modal-form">
        <div class="form-row cols-2">
          <div class="form-group"><label>Amount *</label><input name="amount" type="number" step="1" min="0" required placeholder="0" value="${inputAmount}">${calcNote}</div>
          <div class="form-group"><label>Currency</label>${currencySelect('currency', autoCurrency)}</div>
          <div class="form-group"><label>Payment Status</label>
            <select name="payment_status"><option value="paid">Paid</option><option value="unpaid">Unpaid</option></select>
          </div>
          ${record?.third_party_company ? `<div class="form-group" style="grid-column:1/-1"><label><i class="fas fa-credit-card" style="color:var(--primary);margin-right:6px"></i>Card Number</label><input name="card_number" placeholder="Enter card number…" style="letter-spacing:1px"></div>` : ''}
        </div>
      </form>`, saveLabel: 'Check Out', onSave: async () => {
      if (!Modal.validate()) throw new Error('Amount is required');
      const data = Modal.getFormData();
      const saveCfg = _getCurrencyMap()[data.currency] || {};
      const saveMult = saveCfg.multiplier || 1;
      await API.post(`/daily-parking/${id}/checkout`, { amount: Number(data.amount) / saveMult, payment_status: data.payment_status, currency: data.currency || 'USD', card_number: data.card_number || null });
      Modal.close(); Toast.success('Vehicle checked out'); Router.navigate('daily-parking');
    }});
  },

  showEdit(id) {
    const r = this.data.find(x => x.id === id);
    if (!r) return;
    Modal.show({ title: 'Edit Record', body: `<form id="modal-form">
      <div class="form-row cols-2">
        <div class="form-group"><label>Plate Number</label><input name="plate_number" value="${escHtml(r.plate_number)}"></div>
        <div class="form-group"><label>Vehicle Type</label>
          <select name="vehicle_type">${vehicleTypeOptions(r.vehicle_type)}</select>
        </div>
        <div class="form-group"><label>Amount</label><input name="amount" type="number" step="0.01" value="${r.amount || 0}"></div>
        <div class="form-group"><label>Currency</label>${currencySelect('currency', r.currency)}</div>
        <div class="form-group"><label>Payment Status</label>
          <select name="payment_status"><option value="paid" ${r.payment_status==='paid'?'selected':''}>Paid</option><option value="unpaid" ${r.payment_status==='unpaid'?'selected':''}>Unpaid</option></select>
        </div>
        <div class="form-group"><label>Parking Status</label>
          <select name="parking_status"><option value="parked" ${r.parking_status==='parked'?'selected':''}>Parked</option><option value="completed" ${r.parking_status==='completed'?'selected':''}>Completed</option></select>
        </div>
        <div class="form-group" style="grid-column:1/-1"><label>Notes</label><textarea name="notes">${escHtml(r.notes || '')}</textarea></div>
      </div>
    </form>`, onSave: async () => {
      const data = Modal.getFormData();
      await API.put(`/daily-parking/${id}`, { ...r, ...data, amount: Number(data.amount) });
      Modal.close(); Toast.success('Updated'); Router.navigate('daily-parking');
    }});
  },

  async applyFilter() {
    const search = document.getElementById('dp-search').value;
    const from   = document.getElementById('dp-from').value;
    const to     = document.getElementById('dp-to').value;
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (from)   params.set('date_from', from);
    if (to)     params.set('date_to', to);
    this.data = await API.get(`/daily-parking?${params}`);
    const parked    = this.data.filter(d => d.parking_status === 'parked');
    const completed = this.data.filter(d => d.parking_status === 'completed');
    document.getElementById('parked-table').innerHTML           = this.renderParked(parked);
    document.getElementById('pending-checkout-table').innerHTML = this.renderPendingCheckout(parked);
    document.getElementById('completed-table').innerHTML        = this.renderCompleted(completed);
  },

  clearFilter() {
    document.getElementById('dp-search').value = '';
    document.getElementById('dp-from').value   = '';
    document.getElementById('dp-to').value     = '';
    Router.navigate('daily-parking');
  },

  async deleteRecord(id) {
    if (!confirmDelete()) return;
    await API.delete(`/daily-parking/${id}`);
    Toast.success('Record deleted'); Router.navigate('daily-parking');
  }
};

Router.register('daily-parking', DailyParkingPage);
