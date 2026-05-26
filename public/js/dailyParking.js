// ============================================================
//  DAILY PARKING PAGE
// ============================================================
const DailyParkingPage = {
  title: 'Daily Parking',
  data: [],

  async render() {
    this.data = await API.get('/daily-parking');
    const parked    = this.data.filter(d => d.parking_status === 'parked');
    const completed = this.data.filter(d => d.parking_status === 'completed');
    return `
      <div class="page-header">
        <div class="page-title"><h2>Daily Parking</h2><p>Manage non-subscription vehicle check-ins</p></div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="DailyParkingPage.showCheckIn()"><i class="fas fa-car"></i> Check In</button>
        </div>
      </div>

      <div class="filters-bar">
        <input type="text" class="search-input" id="dp-search" placeholder="Search plate number…">
        <input type="date" id="dp-from" value="${today()}">
        <input type="date" id="dp-to"   value="${today()}">
        <button class="btn btn-outline" onclick="DailyParkingPage.applyFilter()"><i class="fas fa-search"></i> Filter</button>
        <button class="btn btn-outline" onclick="DailyParkingPage.clearFilter()">Clear</button>
      </div>

      <!-- Currently Parked -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-header">
          <span class="card-title"><i class="fas fa-car text-info" style="margin-right:8px"></i> Currently Parked (${parked.length})</span>
        </div>
        <div class="table-wrap" id="parked-table">${this.renderParked(parked)}</div>
      </div>

      <!-- Completed -->
      <div class="card">
        <div class="card-header">
          <span class="card-title"><i class="fas fa-check-circle text-success" style="margin-right:8px"></i> Completed Records</span>
        </div>
        <div class="table-wrap" id="completed-table">${this.renderCompleted(completed)}</div>
      </div>`;
  },

  init() {
    document.getElementById('dp-search').addEventListener('keypress', e => { if (e.key === 'Enter') this.applyFilter(); });
  },

  renderParked(rows) {
    if (!rows.length) return `<div class="empty-state" style="padding:30px"><i class="fas fa-parking"></i><h4>No vehicles parked</h4><p>Currently the lot is empty.</p></div>`;
    return `<table>
      <thead><tr><th>Plate</th><th>Vehicle</th><th>Entry Time</th><th>Duration</th><th>Notes</th><th>Actions</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td><strong>${escHtml(r.plate_number)}</strong>${r.is_third_party ? ' <span class="badge badge-purple" style="font-size:10px">3rd Party</span>' : ''}</td>
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
        <td><strong>${escHtml(r.plate_number)}</strong>${r.is_third_party ? ' <span class="badge badge-purple" style="font-size:10px">3rd Party</span>' : ''}</td>
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
        <div class="form-group" style="grid-column:1/-1"><label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:600"><input type="checkbox" name="is_third_party" style="width:16px;height:16px"> <i class="fas fa-building" style="color:var(--primary)"></i> Third Party Vehicle</label></div>
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
    const calc = calcParkingAmount(record?.vehicle_type, mins);
    const autoCurrency = calc ? calc.currency : 'USD';
    const curCfg = _getCurrencyMap()[autoCurrency] || {};
    const multiplier = curCfg.multiplier || 1;
    const inputAmount = calc ? Math.round(calc.amount * multiplier) : 0;
    const ratePerHour = getParkingRates()[record?.vehicle_type]?.rate;
    const calcNote = calc
      ? `<div style="margin-top:6px;padding:6px 10px;background:var(--bg);border-radius:6px;font-size:12px;color:var(--text-muted)"><i class="fas fa-calculator" style="margin-right:4px"></i>${fmtDuration(mins)} × ${fmtAmt(ratePerHour, calc.currency)}/hr = ${fmtAmt(calc.amount, calc.currency)}</div>`
      : `<div style="margin-top:6px;font-size:12px;color:var(--text-muted)">No rate set — enter manually</div>`;
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
        </div>
      </form>`, saveLabel: 'Check Out', onSave: async () => {
      if (!Modal.validate()) throw new Error('Amount is required');
      const data = Modal.getFormData();
      const saveCfg = _getCurrencyMap()[data.currency] || {};
      const saveMult = saveCfg.multiplier || 1;
      await API.post(`/daily-parking/${id}/checkout`, { amount: Number(data.amount) / saveMult, payment_status: data.payment_status, currency: data.currency || 'USD' });
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
    document.getElementById('parked-table').innerHTML    = this.renderParked(parked);
    document.getElementById('completed-table').innerHTML = this.renderCompleted(completed);
  },

  clearFilter() {
    document.getElementById('dp-search').value = '';
    document.getElementById('dp-from').value   = today();
    document.getElementById('dp-to').value     = today();
    Router.navigate('daily-parking');
  },

  async deleteRecord(id) {
    if (!confirmDelete()) return;
    await API.delete(`/daily-parking/${id}`);
    Toast.success('Record deleted'); Router.navigate('daily-parking');
  }
};

Router.register('daily-parking', DailyParkingPage);
