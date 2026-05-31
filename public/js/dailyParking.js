// ============================================================
//  DAILY PARKING PAGE
// ============================================================
const DailyParkingPage = {
  title: 'Daily Parking',
  data: [],
  bulkData: [],
  activeTab: 'checkin',
  _currency: 'USD',

  async render() {
    [this.data, this.bulkData] = await Promise.all([
      API.get('/daily-parking'),
      API.get(`/daily-parking?vehicle_type=bulk_total&date_from=${today()}&date_to=${today()}`)
    ]);
    const parked    = this.data.filter(d => d.parking_status === 'parked');
    const completed = this.data.filter(d => d.parking_status === 'completed');
    return `
      <div class="page-header">
        <div class="page-title"><h2>Daily Parking</h2><p>Manage non-subscription vehicle check-ins</p></div>
        <div class="page-actions" id="dp-header-actions" style="gap:8px">
          <div style="display:flex;border:1.5px solid var(--border);border-radius:8px;overflow:hidden;height:38px">
            <button id="dp-btn-usd" onclick="DailyParkingPage.setCurrency('USD')"
              style="padding:0 14px;border:none;background:${this._currency==='USD'?'var(--primary)':'transparent'};color:${this._currency==='USD'?'#fff':'var(--text-muted)'};font-weight:700;cursor:pointer;font-size:13px;transition:.15s">$ USD</button>
            <button id="dp-btn-lbp" onclick="DailyParkingPage.setCurrency('LBP')"
              style="padding:0 14px;border:none;background:${this._currency==='LBP'?'var(--primary)':'transparent'};color:${this._currency==='LBP'?'#fff':'var(--text-muted)'};font-weight:700;cursor:pointer;font-size:13px;transition:.15s">LL LBP</button>
          </div>
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
        <button class="page-tab-btn ${this.activeTab === 'bulk' ? 'active' : ''}" onclick="DailyParkingPage.switchTab('bulk')">
          <i class="fas fa-calculator"></i> Bulk / Daily Total
          <span class="page-tab-badge">${this.bulkData.length}</span>
        </button>
      </div>

      <div class="filters-bar">
        <input type="text" class="search-input" id="dp-search" placeholder="Search plate number…">
        <label style="font-size:13px;color:var(--text-muted);white-space:nowrap">From</label>
        <input type="date" id="dp-from" value="${today()}" style="padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px">
        <label style="font-size:13px;color:var(--text-muted);white-space:nowrap">To</label>
        <input type="date" id="dp-to" value="${today()}" style="padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px">
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
            <span id="dp-total" class="badge badge-success" style="font-size:13px;padding:6px 12px">${this._fmtTotal(completed)}</span>
          </div>
          <div class="table-wrap" id="completed-table">${this.renderCompleted(completed)}</div>
        </div>
      </div>

      <!-- Bulk / Daily Total Tab -->
      <div id="dp-tab-bulk" style="${this.activeTab === 'bulk' ? '' : 'display:none'}">
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <span class="card-title"><i class="fas fa-calculator" style="color:var(--primary);margin-right:8px"></i>Add Bulk / Daily Total</span>
          </div>
          <div style="padding:20px">
            <p class="text-muted" style="margin-bottom:16px;font-size:13px"><i class="fas fa-info-circle" style="margin-right:5px"></i>Use this when you don't have time to enter every car. Record the total daily parking amount as a single entry.</p>
            <div class="form-row cols-2" style="max-width:640px">
              <div class="form-group"><label>Date *</label><input type="date" id="bulk-date" value="${today()}" style="padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;width:100%"></div>
              <div class="form-group"><label><i class="fas fa-building" style="color:var(--primary);margin-right:5px"></i>Company</label>
                <select id="bulk-company" onchange="DailyParkingPage._onBulkCompanyChange()" style="padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;width:100%">
                  <option value="">— Manual Entry —</option>
                  ${(() => { try { const p = JSON.parse(window.appSettings?.custom_rates||'{}'); return (Array.isArray(p.__thirdParties)?p.__thirdParties:[]).map(c=>`<option value="${escHtml(c.name)}" data-rate="${c.rate||0}" data-currency="${c.currency||'USD'}">${escHtml(c.name)}</option>`).join(''); } catch { return ''; } })()}
                </select>
              </div>
              <div class="form-group" id="bulk-qty-group" style="display:none"><label>Quantity *</label><input type="number" id="bulk-qty" min="1" value="1" oninput="DailyParkingPage._onBulkQtyChange()" style="padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;width:100%"></div>
              <div class="form-group" id="bulk-rate-info" style="display:none;align-items:flex-end"><div style="padding:8px 12px;background:var(--bg);border-radius:8px;border:1.5px solid var(--border);font-size:13px;color:var(--text-muted);width:100%" id="bulk-rate-text"></div></div>
              <div class="form-group"><label>Amount *</label><input type="text" inputmode="numeric" id="bulk-amount" placeholder="Enter total amount" style="padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;width:100%"></div>
              <div class="form-group"><label>Currency</label><select id="bulk-currency" style="padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;width:100%">${Object.entries(_getCurrencyMap()).map(([c,cfg])=>`<option value="${c}">${cfg.symbol} — ${cfg.name||c}</option>`).join('')}</select></div>
              <div class="form-group" style="grid-column:1/-1"><label>Notes</label><input type="text" id="bulk-notes" placeholder="Optional notes…" style="padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;width:100%"></div>
            </div>
            <button class="btn btn-primary" onclick="DailyParkingPage.saveBulk()"><i class="fas fa-plus"></i> Add Entry</button>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title"><i class="fas fa-list" style="margin-right:8px"></i>Bulk Entries</span>
            <span id="bulk-total-badge" class="badge badge-success" style="font-size:13px;padding:6px 12px">${this._fmtTotal(this.bulkData)}</span>
          </div>
          <div class="table-wrap" id="bulk-table">${this.renderBulk(this.bulkData)}</div>
        </div>
      </div>`;
  },

  init() {
    document.getElementById('dp-search').addEventListener('keypress', e => { if (e.key === 'Enter') this.applyFilter(); });
    document.getElementById('dp-from').addEventListener('change', () => this.applyFilter());
    document.getElementById('dp-to').addEventListener('change', () => this.applyFilter());
  },

  // daily_parking.amount is stored ÷ multiplier on save; restore actual amount before converting
  _fmtTotal(rows) {
    const cur = this._currency;
    const paid = rows.filter(r => r.payment_status === 'paid');
    const total = paid.reduce((sum, r) => {
      const cfg = _getCurrencyMap()[r.currency || 'USD'] || {};
      const actual = (Number(r.amount) || 0) * (cfg.multiplier || 1);
      return sum + convertAmount(actual, r.currency, cur);
    }, 0);
    return fmtRaw(total, cur);
  },

  setCurrency(cur) {
    this._currency = cur;
    const uBtn = document.getElementById('dp-btn-usd');
    const lBtn = document.getElementById('dp-btn-lbp');
    if (uBtn) { uBtn.style.background = cur === 'USD' ? 'var(--primary)' : 'transparent'; uBtn.style.color = cur === 'USD' ? '#fff' : 'var(--text-muted)'; }
    if (lBtn) { lBtn.style.background = cur === 'LBP' ? 'var(--primary)' : 'transparent'; lBtn.style.color = cur === 'LBP' ? '#fff' : 'var(--text-muted)'; }
    const completed = this.data.filter(d => d.parking_status === 'completed');
    const badge = document.getElementById('dp-total');
    if (badge) badge.textContent = this._fmtTotal(completed);
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.page-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${tab}'`));
    });
    document.getElementById('dp-tab-checkin').style.display  = tab === 'checkin'  ? '' : 'none';
    document.getElementById('dp-tab-checkout').style.display = tab === 'checkout' ? '' : 'none';
    document.getElementById('dp-tab-bulk').style.display     = tab === 'bulk'     ? '' : 'none';
    if (tab === 'bulk') {
      // Rebuild currency options with latest appSettings (may have loaded after initial render)
      const sel = document.getElementById('bulk-currency');
      if (sel) {
        const cur = sel.value;
        sel.innerHTML = Object.entries(_getCurrencyMap()).map(([c,cfg])=>`<option value="${c}" ${c===cur?'selected':''}>${cfg.symbol} — ${cfg.name||c}</option>`).join('');
      }
      // Rebuild company options
      const compSel = document.getElementById('bulk-company');
      if (compSel) {
        const prev = compSel.value;
        try {
          const p = JSON.parse(window.appSettings?.custom_rates || '{}');
          const opts = (Array.isArray(p.__thirdParties) ? p.__thirdParties : [])
            .map(c => `<option value="${escHtml(c.name)}" data-rate="${c.rate||0}" data-currency="${c.currency||'USD'}" ${c.name===prev?'selected':''}>${escHtml(c.name)}</option>`).join('');
          compSel.innerHTML = `<option value="">— Manual Entry —</option>${opts}`;
        } catch {}
      }
    }
    const cur = this._currency;
    const toggleHtml = `<div style="display:flex;border:1.5px solid var(--border);border-radius:8px;overflow:hidden;height:38px">
      <button id="dp-btn-usd" onclick="DailyParkingPage.setCurrency('USD')" style="padding:0 14px;border:none;background:${cur==='USD'?'var(--primary)':'transparent'};color:${cur==='USD'?'#fff':'var(--text-muted)'};font-weight:700;cursor:pointer;font-size:13px;transition:.15s">$ USD</button>
      <button id="dp-btn-lbp" onclick="DailyParkingPage.setCurrency('LBP')" style="padding:0 14px;border:none;background:${cur==='LBP'?'var(--primary)':'transparent'};color:${cur==='LBP'?'#fff':'var(--text-muted)'};font-weight:700;cursor:pointer;font-size:13px;transition:.15s">LL LBP</button>
    </div>`;
    const actions = document.getElementById('dp-header-actions');
    if (actions) actions.innerHTML = toggleHtml + (tab === 'checkin'
      ? `<button class="btn btn-primary" onclick="DailyParkingPage.showCheckIn()"><i class="fas fa-car"></i> Check In</button>`
      : '');
  },

  _onBulkCompanyChange() {
    const sel       = document.getElementById('bulk-company');
    const qtyGroup  = document.getElementById('bulk-qty-group');
    const rateInfo  = document.getElementById('bulk-rate-info');
    const rateText  = document.getElementById('bulk-rate-text');
    const amountEl  = document.getElementById('bulk-amount');
    const currencyEl = document.getElementById('bulk-currency');
    if (!sel?.value) {
      if (qtyGroup)  qtyGroup.style.display  = 'none';
      if (rateInfo)  rateInfo.style.display  = 'none';
      return;
    }
    try {
      const parsed  = JSON.parse(window.appSettings?.custom_rates || '{}');
      const company = (parsed.__thirdParties || []).find(c => c.name === sel.value);
      if (!company) return;
      const rate = Number(company.rate) || 0;
      const cur  = company.currency || 'USD';
      if (currencyEl) currencyEl.value = cur;
      const qty  = parseInt(document.getElementById('bulk-qty')?.value) || 1;
      if (amountEl)  amountEl.value = fmtAmountInput(rate * qty, cur);
      if (qtyGroup)  qtyGroup.style.display  = '';
      if (rateInfo)  rateInfo.style.display  = 'flex';
      if (rateText)  rateText.textContent = `Rate: ${fmtRaw(rate, cur)} × ${qty} = ${fmtRaw(rate * qty, cur)}`;
    } catch {}
  },

  _onBulkQtyChange() {
    const sel = document.getElementById('bulk-company');
    if (!sel?.value) return;
    try {
      const parsed  = JSON.parse(window.appSettings?.custom_rates || '{}');
      const company = (parsed.__thirdParties || []).find(c => c.name === sel.value);
      if (!company) return;
      const rate     = Number(company.rate) || 0;
      const cur      = company.currency || 'USD';
      const qty      = parseInt(document.getElementById('bulk-qty')?.value) || 1;
      const amountEl = document.getElementById('bulk-amount');
      const rateText = document.getElementById('bulk-rate-text');
      if (amountEl) amountEl.value = fmtAmountInput(rate * qty, cur);
      if (rateText) rateText.textContent = `Rate: ${fmtRaw(rate, cur)} × ${qty} = ${fmtRaw(rate * qty, cur)}`;
    } catch {}
  },

  async saveBulk() {
    const date    = document.getElementById('bulk-date')?.value;
    const amount  = parseAmountInput(document.getElementById('bulk-amount')?.value);
    const cur     = document.getElementById('bulk-currency')?.value || 'USD';
    const notes   = document.getElementById('bulk-notes')?.value || '';
    const company = document.getElementById('bulk-company')?.value || '';
    if (!date)   { Toast.error('Date is required'); return; }
    if (!amount) { Toast.error('Amount is required'); return; }
    const saveCfg  = _getCurrencyMap()[cur] || {};
    const saveMult = saveCfg.multiplier || 1;
    try {
      await API.post('/daily-parking', {
        plate_number:        'BULK',
        vehicle_type:        'bulk_total',
        parking_status:      'completed',
        payment_status:      'paid',
        entry_time:          `${date}T12:00:00`,
        exit_time:           `${date}T12:00:00`,
        duration_minutes:    0,
        amount:              amount / saveMult,
        currency:            cur,
        notes,
        third_party_company: company || null
      });
      document.getElementById('bulk-amount').value  = '';
      document.getElementById('bulk-notes').value   = '';
      document.getElementById('bulk-company').value = '';
      document.getElementById('bulk-qty').value     = '1';
      document.getElementById('bulk-qty-group').style.display  = 'none';
      document.getElementById('bulk-rate-info').style.display  = 'none';
      Toast.success('Bulk entry added');
      await this.loadBulkData();
    } catch (e) { Toast.error(e.message); }
  },

  async loadBulkData() {
    const from = document.getElementById('dp-from')?.value;
    const to   = document.getElementById('dp-to')?.value;
    const params = new URLSearchParams({ vehicle_type: 'bulk_total' });
    if (from) params.set('date_from', from);
    if (to)   params.set('date_to',   to);
    this.bulkData = await API.get(`/daily-parking?${params}`);
    const tableEl = document.getElementById('bulk-table');
    const badgeEl = document.getElementById('bulk-total-badge');
    if (tableEl) tableEl.innerHTML = this.renderBulk(this.bulkData);
    if (badgeEl) badgeEl.textContent = this._fmtTotal(this.bulkData);
  },

  renderBulk(rows) {
    if (!rows.length) return `<div class="empty-state" style="padding:30px"><i class="fas fa-calculator"></i><h4>No bulk entries</h4><p>Use the form above to add a daily total.</p></div>`;
    return `<table>
      <thead><tr><th>Date</th><th>Company</th><th>Amount</th><th>Currency</th><th>Notes</th><th>Actions</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${fmtDate(r.entry_time)}</td>
        <td>${r.third_party_company ? `<span class="badge badge-purple">${escHtml(r.third_party_company)}</span>` : '<span class="text-muted">—</span>'}</td>
        <td class="fw-bold">${fmtAmt(r.amount, r.currency)}</td>
        <td><span class="badge badge-gray">${escHtml(r.currency)}</span></td>
        <td class="text-muted">${escHtml(r.notes || '—')}</td>
        <td class="actions">
          <button class="btn btn-sm btn-outline btn-icon" onclick="DailyParkingPage.deleteBulk(${r.id})" title="Delete"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('')}</tbody>
    </table>`;
  },

  async deleteBulk(id) {
    if (!await confirmDelete()) return;
    await API.delete(`/daily-parking/${id}`);
    Toast.success('Entry deleted');
    await this.loadBulkData();
  },

  // Check In tab: currently parked — edit/delete only
  renderParked(rows) {
    if (!rows.length) return `<div class="empty-state" style="padding:30px"><i class="fas fa-parking"></i><h4>No vehicles parked</h4><p>Currently the lot is empty.</p></div>`;
    return `<table>
      <thead><tr><th>Plate</th><th>Vehicle</th><th>Entry Time</th><th>Duration</th><th>Card #</th><th>Notes</th><th>Actions</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td><strong>${escHtml(r.plate_number)}</strong>${r.third_party_company ? ` <span class="badge badge-purple" style="font-size:10px">${escHtml(r.third_party_company)}</span>` : ''}</td>
        <td>${vehicleBadge(r.vehicle_type)}</td>
        <td>${fmtDateTime(r.entry_time)}</td>
        <td class="text-muted">${this.liveDuration(r.entry_time)}</td>
        <td class="text-muted" style="letter-spacing:1px">${escHtml(r.card_number || '—')}</td>
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
      <thead><tr><th>Plate</th><th>Vehicle</th><th>Entry Time</th><th>Duration</th><th>Card #</th><th>Notes</th><th>Actions</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td><strong>${escHtml(r.plate_number)}</strong>${r.third_party_company ? ` <span class="badge badge-purple" style="font-size:10px">${escHtml(r.third_party_company)}</span>` : ''}</td>
        <td>${vehicleBadge(r.vehicle_type)}</td>
        <td>${fmtDateTime(r.entry_time)}</td>
        <td class="text-muted">${this.liveDuration(r.entry_time)}</td>
        <td class="text-muted" style="letter-spacing:1px">${escHtml(r.card_number || '—')}</td>
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
      <thead><tr><th>Plate</th><th>Vehicle</th><th>Entry</th><th>Exit</th><th>Duration</th><th>Card #</th><th>Amount</th><th>Payment</th><th>Actions</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td><strong>${escHtml(r.plate_number)}</strong>${r.third_party_company ? ` <span class="badge badge-purple" style="font-size:10px">${escHtml(r.third_party_company)}</span>` : ''}</td>
        <td>${vehicleBadge(r.vehicle_type)}</td>
        <td>${fmtDateTime(r.entry_time)}</td>
        <td>${fmtDateTime(r.exit_time)}</td>
        <td>${fmtDuration(r.duration_minutes)}</td>
        <td class="text-muted" style="letter-spacing:1px">${escHtml(r.card_number || '—')}</td>
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
        <div class="form-group" style="grid-column:1/-1"><label id="ci-card-label"><i class="fas fa-credit-card" style="color:var(--primary);margin-right:6px"></i>Card Number</label><input name="card_number" id="ci-card-number" placeholder="Optional — enter card number" style="letter-spacing:1px"></div>
        <div class="form-group" style="grid-column:1/-1"><label><i class="fas fa-building" style="color:var(--primary);margin-right:6px"></i>Third Party Company</label>
          <select name="third_party_company" onchange="DailyParkingPage._onThirdPartyChange()"><option value="">— Not Third Party —</option>${(() => { try { const p = JSON.parse(window.appSettings?.custom_rates||'{}'); return (Array.isArray(p.__thirdParties)?p.__thirdParties:[]).map(c=>`<option value="${escHtml(c.name)}">${escHtml(c.name)}</option>`).join(''); } catch { return ''; } })()}</select>
        </div>
        <div class="form-group" style="grid-column:1/-1"><label>Notes</label><textarea name="notes" placeholder="Optional notes…"></textarea></div>
      </div>
    </form>`, saveLabel: 'Check In', onSave: async () => {
      if (!Modal.validate()) throw new Error('Please fill in all required fields');
      const data = Modal.getFormData();
      data.plate_number = data.plate_number.toUpperCase();
      await API.post('/daily-parking', data);
      Modal.close(); Toast.success('Vehicle checked in'); Router.navigate('daily-parking');
    }});
  },

  showCheckOut(id) {
    const record = this.data.find(r => r.id === id);
    const exitNow = nowLebanon();
    const mins = Math.round((new Date(exitNow) - new Date(record?.entry_time)) / 60000);

    let autoCurrency, inputAmount, calcNote;
    if (record?.third_party_company) {
      try {
        const parsed = JSON.parse(window.appSettings?.custom_rates || '{}');
        const company = (parsed.__thirdParties || []).find(c => c.name === record.third_party_company);
        if (company) {
          autoCurrency = company.currency || 'USD';
          inputAmount = Number(company.rate);
          calcNote = `<div id="co-calc-note" style="margin-top:6px;padding:6px 10px;background:var(--bg);border-radius:6px;font-size:12px;color:var(--text-muted)"><i class="fas fa-building" style="margin-right:4px"></i>${escHtml(company.name)} — ${fmtRaw(company.rate, autoCurrency)} / month (flat rate)</div>`;
        } else {
          autoCurrency = 'USD'; inputAmount = 0;
          calcNote = `<div id="co-calc-note" style="margin-top:6px;font-size:12px;color:var(--text-muted)">Third party company not found — enter manually</div>`;
        }
      } catch {
        autoCurrency = 'USD'; inputAmount = 0;
        calcNote = `<div id="co-calc-note" style="margin-top:6px;font-size:12px;color:var(--text-muted)">Enter amount manually</div>`;
      }
    } else {
      const calc = calcParkingAmount(record?.vehicle_type, mins);
      autoCurrency = calc ? calc.currency : 'USD';
      inputAmount = calc ? calc.amount : 0;
      calcNote = calc
        ? `<div id="co-calc-note" style="margin-top:6px;padding:6px 10px;background:var(--bg);border-radius:6px;font-size:12px;color:var(--text-muted)"><i class="fas fa-calculator" style="margin-right:4px"></i>${fmtDuration(mins)} → tier ${calc.tier.from}h–${calc.tier.to != null ? calc.tier.to + 'h' : '∞'} = ${fmtRaw(calc.amount, calc.currency)}</div>`
        : `<div id="co-calc-note" style="margin-top:6px;font-size:12px;color:var(--text-muted)">No rate tier set — enter manually</div>`;
    }
    Modal.show({ title: `Check Out — ${record?.plate_number}${record?.third_party_company ? ` <span class="badge badge-purple">${escHtml(record.third_party_company)}</span>` : ''}`, body: `
      <div style="background:var(--bg);border-radius:8px;padding:14px;margin-bottom:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div><small class="text-muted">Entry</small><div>${fmtDateTime(record?.entry_time)}</div></div>
          <div><small class="text-muted">Duration</small><div id="co-duration">${fmtDuration(mins)}</div></div>
        </div>
      </div>
      <form id="modal-form">
        <div class="form-row cols-2">
          <div class="form-group" style="grid-column:1/-1">
            <label>Exit Time</label>
            <input name="exit_time" id="co-exit-time" type="datetime-local" value="${exitNow}"
              onchange="DailyParkingPage._onExitTimeChange(${id})">
          </div>
          <div class="form-group" style="grid-column:1/-1"><label><i class="fas fa-credit-card" style="color:var(--primary);margin-right:6px"></i>Card Number${record?.third_party_company ? ' *' : ''}</label><input name="card_number" value="${escHtml(record?.card_number || '')}" placeholder="${record?.third_party_company ? 'Required for third party' : 'Optional — enter card number'}" style="letter-spacing:1px"${record?.third_party_company ? ' required' : ''}></div>
          <div class="form-group"><label>Amount *</label><input name="amount" id="co-amount" type="text" inputmode="numeric" required placeholder="0" value="${fmtAmountInput(inputAmount, autoCurrency)}">${calcNote}</div>
          <div class="form-group"><label>Currency</label>${currencySelect('currency', autoCurrency)}</div>
          <div class="form-group"><label>Payment Status</label>
            <select name="payment_status"><option value="paid">Paid</option><option value="unpaid">Unpaid</option></select>
          </div>
          <div class="form-group" style="grid-column:1/-1"><label>Notes</label><textarea name="notes" placeholder="Optional notes…">${escHtml(record?.notes || '')}</textarea></div>
        </div>
      </form>`, saveLabel: 'Check Out', onSave: async () => {
      if (!Modal.validate()) throw new Error('Amount is required');
      const data = Modal.getFormData();
      const saveCfg = _getCurrencyMap()[data.currency] || {};
      const saveMult = saveCfg.multiplier || 1;
      await API.post(`/daily-parking/${id}/checkout`, {
        amount: parseAmountInput(data.amount) / saveMult,
        payment_status: data.payment_status,
        currency: data.currency || 'USD',
        card_number: data.card_number || null,
        exit_time: data.exit_time || null,
        notes: data.notes || null
      });
      Modal.close(); Toast.success('Vehicle checked out'); Router.navigate('daily-parking');
    }});
  },

  _onThirdPartyChange() {
    const sel = document.querySelector('#modal-form select[name="third_party_company"]');
    const inp = document.getElementById('ci-card-number');
    const lbl = document.getElementById('ci-card-label');
    const isThird = sel && sel.value !== '';
    if (inp) {
      inp.required = isThird;
      inp.placeholder = isThird ? 'Required for third party' : 'Optional — enter card number';
    }
    if (lbl) lbl.innerHTML = `<i class="fas fa-credit-card" style="color:var(--primary);margin-right:6px"></i>Card Number${isThird ? ' *' : ''}`;
  },

  _onExitTimeChange(id) {
    const record = this.data.find(r => r.id === id);
    if (!record) return;
    const exitVal = document.getElementById('co-exit-time')?.value;
    if (!exitVal) return;
    const mins = Math.round((new Date(exitVal) - new Date(record.entry_time)) / 60000);
    if (mins < 0) return;
    const durEl = document.getElementById('co-duration');
    if (durEl) durEl.textContent = fmtDuration(mins);
    if (!record.third_party_company) {
      const calc = calcParkingAmount(record.vehicle_type, mins);
      const amountEl = document.getElementById('co-amount');
      const noteEl   = document.getElementById('co-calc-note');
      if (calc && amountEl) amountEl.value = fmtAmountInput(calc.amount, calc.currency);
      if (noteEl) noteEl.innerHTML = calc
        ? `<i class="fas fa-calculator" style="margin-right:4px"></i>${fmtDuration(mins)} → tier ${calc.tier.from}h–${calc.tier.to != null ? calc.tier.to + 'h' : '∞'} = ${fmtRaw(calc.amount, calc.currency)}`
        : 'No rate tier set — enter manually';
    }
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
        <div class="form-group"><label>Amount</label><input name="amount" type="text" inputmode="numeric" value="${fmtAmountInput(r.amount, r.currency)}"></div>
        <div class="form-group"><label>Currency</label>${currencySelect('currency', r.currency)}</div>
        <div class="form-group"><label>Payment Status</label>
          <select name="payment_status"><option value="paid" ${r.payment_status==='paid'?'selected':''}>Paid</option><option value="unpaid" ${r.payment_status==='unpaid'?'selected':''}>Unpaid</option></select>
        </div>
        <div class="form-group"><label>Parking Status</label>
          <select name="parking_status"><option value="parked" ${r.parking_status==='parked'?'selected':''}>Parked</option><option value="completed" ${r.parking_status==='completed'?'selected':''}>Completed</option></select>
        </div>
        <div class="form-group" style="grid-column:1/-1"><label>Notes</label><textarea name="notes">${escHtml(r.notes || '')}</textarea></div>
        <div class="form-group" style="grid-column:1/-1"><label><i class="fas fa-credit-card" style="color:var(--primary);margin-right:6px"></i>Card Number</label><input name="card_number" value="${escHtml(r.card_number || '')}" placeholder="Optional" style="letter-spacing:1px"></div>
      </div>
    </form>`, onSave: async () => {
      const data = Modal.getFormData();
      await API.put(`/daily-parking/${id}`, { ...r, ...data, amount: parseAmountInput(data.amount) });
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
    const totalBadge = document.getElementById('dp-total');
    if (totalBadge) totalBadge.textContent = this._fmtTotal(completed);
    if (this.activeTab === 'bulk') await this.loadBulkData();
  },

  clearFilter() {
    document.getElementById('dp-search').value = '';
    document.getElementById('dp-from').value   = today();
    document.getElementById('dp-to').value     = today();
    Router.navigate('daily-parking');
  },

  async deleteRecord(id) {
    if (!await confirmDelete()) return;
    await API.delete(`/daily-parking/${id}`);
    Toast.success('Record deleted'); Router.navigate('daily-parking');
  }
};

Router.register('daily-parking', DailyParkingPage);
