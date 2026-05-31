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
          <button class="btn btn-outline" onclick="TransactionsPage.showBulkTip()"><i class="fas fa-coins"></i> Record Tips</button>
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
        <select id="tx-type">
          <option value="">All</option>
          <option value="services">Services Only (no tip)</option>
          <option value="tips">Tips Only</option>
        </select>
      </div>
      <div class="card">
        <div class="table-wrap" id="tx-table">${this.renderTable(this.data)}</div>
      </div>`;
  },

  init() {
    document.getElementById('tx-search').addEventListener('keypress', e => { if (e.key === 'Enter') this.applyFilter(); });
    document.getElementById('tx-from').addEventListener('change',   () => this.applyFilter());
    document.getElementById('tx-to').addEventListener('change',     () => this.applyFilter());
    document.getElementById('tx-status').addEventListener('change', () => this.applyFilter());
    document.getElementById('tx-vehicle').addEventListener('change',() => this.applyFilter());
    document.getElementById('tx-service').addEventListener('change',() => this.applyFilter());
    document.getElementById('tx-type').addEventListener('change',   () => this.applyFilter());
  },

  _fmtTotal(data) {
    const cur  = this._currency;
    const paid = data.filter(t => t.payment_status === 'paid');
    return fmtRaw(sumConverted(paid, cur, 'final_amount') + sumConverted(paid, cur, 'tip_amount'), cur);
  },

  setCurrency(cur) {
    this._currency = cur;
    const uBtn = document.getElementById('tx-btn-usd');
    const lBtn = document.getElementById('tx-btn-lbp');
    if (uBtn) { uBtn.style.background = cur==='USD'?'var(--primary)':'transparent'; uBtn.style.color = cur==='USD'?'#fff':'var(--text-muted)'; }
    if (lBtn) { lBtn.style.background = cur==='LBP'?'var(--primary)':'transparent'; lBtn.style.color = cur==='LBP'?'#fff':'var(--text-muted)'; }
    this._updateTotals();
  },

  _updateTotals() {
    const badge = document.getElementById('tx-total');
    if (badge) badge.textContent = this._fmtTotal(this.data);
  },

  renderTable(rows) {
    if (!rows.length) return `<div class="empty-state"><i class="fas fa-shower"></i><h4>No service records</h4><p>Record a new wash or cleaning service.</p></div>`;
    return `<table>
      <thead><tr><th>Date</th><th>Client</th><th>Plate</th><th>Vehicle</th><th>Service</th><th>Unit Price</th><th>Qty</th><th>Service Total</th><th>Payment</th><th>Actions</th></tr></thead>
      <tbody>${rows.map(t => {
        const tip    = Number(t.tip_amount) || 0;
        const payCur = t.payment_currency || t.currency;
        const isCross = payCur && payCur !== t.currency;
        let tipHtml = '';
        if (tip > 0) {
          const paidInfo = isCross
            ? ` <span style="font-weight:400;color:var(--text-muted);font-size:10px">(paid ${fmtRaw(t.amount_received, payCur)})</span>`
            : '';
          tipHtml = `<br><span style="font-size:11px;font-weight:600;color:var(--success)">+${fmtRaw(tip, t.currency)} tip${paidInfo}</span>`;
        }
        return `<tr>
          <td>${fmtDate(t.service_date)}</td>
          <td>${escHtml(t.client_name || '—')}</td>
          <td>${escHtml(t.plate_number || '—')}</td>
          <td>${vehicleBadge(t.vehicle_type)}</td>
          <td>${escHtml(t.service_name || '—')}</td>
          <td>${fmtRaw(t.price, t.currency)}</td>
          <td class="text-muted">${t.quantity > 1 ? `<strong>${t.quantity}</strong>` : (t.quantity || 1)}</td>
          <td class="fw-bold">${fmtRaw(t.final_amount, t.currency)}${tipHtml}</td>
          <td>${statusBadge(t.payment_status)}</td>
          <td class="actions">
            <button class="btn btn-sm btn-outline btn-icon" onclick="TransactionsPage.showEdit(${t.id})"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm btn-outline btn-icon" onclick="TransactionsPage.deleteRecord(${t.id})"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  },

  _payCurOpts(selected) {
    const map = _getCurrencyMap();
    return Object.entries(map).map(([c, cfg]) =>
      `<option value="${c}" ${c === selected ? 'selected' : ''}>${cfg.symbol} ${c}</option>`
    ).join('');
  },

  _formHtml(t = {}) {
    const defaultSvc   = t.service_id ? this.services.find(s => s.id == t.service_id) : this.services[0];
    const svcCur       = t.currency || defaultSvc?.currency || 'USD';
    const payCur       = t.payment_currency || svcCur;
    const unitPrice    = t.price ?? defaultSvc?.price ?? 0;
    const qty          = t.quantity || 1;
    const serviceTotal = unitPrice * qty;
    const payStatus    = t.payment_status || 'unpaid';
    const isPaid       = payStatus === 'paid';
    const isCross      = svcCur !== payCur;
    const lbpRate      = getLbpRate();
    const exchRate     = (t.exchange_rate && t.exchange_rate !== 1) ? t.exchange_rate : lbpRate;

    // Amount received stored in payment currency
    const amtReceived = (isPaid && t.amount_received) ? t.amount_received
      : (isPaid && !isCross ? serviceTotal : 0);

    // Convert received amount to service currency for tip calc
    let converted = amtReceived;
    if (isCross && amtReceived) {
      if      (payCur === 'USD' && svcCur === 'LBP') converted = amtReceived * exchRate;
      else if (payCur === 'LBP' && svcCur === 'USD') converted = amtReceived / exchRate;
    }
    const tipAmount = isPaid ? Math.max(0, converted - serviceTotal) : 0;

    const defaultVt  = t.vehicle_type || 'car';
    const filteredSvcs = this.services.filter(s => s.vehicle_type === defaultVt || s.vehicle_type === 'both');
    const svcSSOpts  = filteredSvcs.map(s => ({ value: String(s.id), label: `${s.name} (${fmtRaw(s.price, s.currency)})` }));
    const selSvcId   = t.service_id ? String(t.service_id) : (svcSSOpts[0]?.value || '');

    return `<form id="modal-form"><div class="form-row cols-2">
      <div class="form-group"><label>Service Date</label>
        <input name="service_date" type="date" value="${t.service_date || today()}">
      </div>
      <div class="form-group"><label>Client Name</label>
        <input name="client_name" value="${escHtml(t.client_name||'')}" placeholder="Optional">
      </div>
      <div class="form-group"><label>Mobile</label>
        <input name="mobile" value="${escHtml(t.mobile||'')}" placeholder="Optional">
      </div>
      <div class="form-group"><label>Plate Number</label>
        <input name="plate_number" value="${escHtml(t.plate_number||'')}" placeholder="ABC 1234">
      </div>
      <div class="form-group"><label>Vehicle Type</label>
        <select name="vehicle_type" id="tx-veh-type" onchange="TransactionsPage.onVehicleTypeChange()">${vehicleTypeOptions(defaultVt)}</select>
      </div>
      <div class="form-group" style="grid-column:1/-1"><label>Service</label>
        ${SS.html('service_id', svcSSOpts, selSvcId, { id: 'tx-service-ss', onchange: 'TransactionsPage.fillPrice()' })}
      </div>
      <div class="form-group"><label>Unit Price</label>
        <input name="price" type="text" inputmode="numeric" id="tx-price"
          value="${fmtAmountInput(unitPrice, svcCur)}" oninput="TransactionsPage._calcTxTotal()">
      </div>
      <div class="form-group"><label>Quantity</label>
        <input name="quantity" type="number" min="1" step="1" id="tx-qty"
          value="${qty}" oninput="TransactionsPage._calcTxTotal()">
      </div>
      <div class="form-group"><label>Service Currency</label>
        <select name="currency" id="tx-svc-currency" onchange="TransactionsPage._onSvcCurrencyChange()">
          ${this._payCurOpts(svcCur)}
        </select>
      </div>
      <div class="form-group"><label>Payment Status</label>
        <select name="payment_status" id="tx-payment-status" onchange="TransactionsPage._onStatusChange()">
          <option value="paid"   ${isPaid  ?'selected':''}>Paid</option>
          <option value="unpaid" ${!isPaid ?'selected':''}>Unpaid</option>
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <div id="tx-total-display" style="padding:12px 16px;background:var(--bg);border-radius:8px;font-size:15px;font-weight:700;border:1.5px solid var(--border)">
          Service Total: <span style="color:var(--primary)">${fmtRaw(serviceTotal, svcCur)}</span>
        </div>
      </div>

      <!-- ── Amount Received ── -->
      <div id="tx-amt-recv-row" class="form-group" style="grid-column:1/-1${!isPaid?';display:none':''}">
        <label>Amount Received</label>
        <div style="display:flex;gap:8px;align-items:stretch">
          <input name="amount_received" id="tx-amt-recv" type="text" inputmode="numeric"
            style="flex:1;min-width:0;width:auto"
            value="${isPaid ? fmtAmountInput(amtReceived, payCur) : ''}"
            oninput="TransactionsPage._calcTip()"
            placeholder="0">
          <select name="payment_currency" id="tx-pay-currency"
            onchange="TransactionsPage._onCurrencyChange()"
            style="width:140px;flex-shrink:0">
            ${this._payCurOpts(payCur)}
          </select>
        </div>
      </div>

      <!-- ── Exchange Rate (cross-currency only) ── -->
      <div id="tx-rate-row" class="form-group" style="grid-column:1/-1${!isCross?';display:none':''}">
        <label><i class="fas fa-exchange-alt" style="margin-right:5px;color:var(--primary)"></i>Exchange Rate <span style="font-weight:400;color:var(--text-muted)">(1 USD = X LBP)</span></label>
        <input name="exchange_rate" id="tx-exchange-rate" type="text" inputmode="numeric"
          value="${isCross ? fmtAmountInput(exchRate, 'LBP') : ''}"
          oninput="TransactionsPage._calcTip()" placeholder="e.g. 89,500">
        <span style="font-size:11px;color:var(--text-muted);margin-top:2px">
          <i class="fas fa-info-circle"></i> Amount received converts automatically.
        </span>
      </div>

      <!-- ── Converted amount (cross-currency only) ── -->
      <div id="tx-converted-display" class="form-group" style="grid-column:1/-1${!(isCross && isPaid && amtReceived)?';display:none':''}">
        <div style="padding:10px 14px;background:var(--bg);border-radius:8px;border:1.5px solid var(--border);font-size:13px">
          <span style="color:var(--text-muted)">Converted to service currency: </span>
          <strong style="color:var(--primary)">${isCross && isPaid && amtReceived ? fmtRaw(converted, svcCur) : ''}</strong>
        </div>
      </div>

      <!-- ── Tip ── -->
      <div id="tx-tip-display" class="form-group" style="grid-column:1/-1${!isPaid?';display:none':''}">
        <div style="padding:12px 16px;border-radius:8px;font-size:15px;font-weight:700;border:1.5px solid ${tipAmount>0?'#86efac':'var(--border)'};background:${tipAmount>0?'#f0fdf4':'var(--bg)'};color:${tipAmount>0?'var(--success)':'var(--text-muted)'}">
          ${tipAmount > 0
            ? `<i class="fas fa-coins" style="margin-right:8px"></i>Tip: ${fmtRaw(tipAmount, svcCur)}`
            : '<i class="fas fa-minus-circle" style="margin-right:6px;opacity:.4"></i>No tip'}
        </div>
      </div>
    </div></form>`;
  },

  _calcTxTotal() {
    const priceEl = document.getElementById('tx-price');
    const qtyEl   = document.getElementById('tx-qty');
    const totalEl = document.getElementById('tx-total-display');
    if (!priceEl || !qtyEl || !totalEl) return;
    const price  = parseAmountInput(priceEl.value);
    const qty    = Math.max(1, Number(qtyEl.value) || 1);
    const svcCur = document.getElementById('tx-svc-currency')?.value || 'USD';
    totalEl.innerHTML = `Service Total: <span style="color:var(--primary)">${fmtRaw(price * qty, svcCur)}</span>`;
    this._calcTip();
  },

  _calcTip() {
    const priceEl   = document.getElementById('tx-price');
    const qtyEl     = document.getElementById('tx-qty');
    const amtRecvEl = document.getElementById('tx-amt-recv');
    const rateEl    = document.getElementById('tx-exchange-rate');
    const tipEl     = document.getElementById('tx-tip-display');
    const convEl    = document.getElementById('tx-converted-display');
    if (!priceEl || !amtRecvEl || !tipEl) return;

    const price        = parseAmountInput(priceEl.value);
    const qty          = Math.max(1, Number(qtyEl?.value) || 1);
    const svcCur       = document.getElementById('tx-svc-currency')?.value || 'USD';
    const payCur       = document.getElementById('tx-pay-currency')?.value || svcCur;
    const serviceTotal = price * qty;
    const isCross      = svcCur !== payCur;
    const rawRecv      = amtRecvEl.value.trim();
    const amtReceived  = rawRecv ? parseAmountInput(rawRecv) : 0;
    const rate         = parseAmountInput(rateEl?.value) || getLbpRate();

    // Convert received amount to service currency
    let converted = amtReceived;
    if (isCross && amtReceived) {
      if      (payCur === 'USD' && svcCur === 'LBP') converted = amtReceived * rate;
      else if (payCur === 'LBP' && svcCur === 'USD') converted = amtReceived / rate;
    }

    // Show/hide converted display (the inner div)
    if (convEl) {
      if (isCross && amtReceived > 0) {
        convEl.style.display = '';
        const inner = convEl.querySelector('div');
        if (inner) inner.innerHTML = `<span style="color:var(--text-muted)">Converted to service currency: </span><strong style="color:var(--primary)">${fmtRaw(converted, svcCur)}</strong>`;
      } else {
        convEl.style.display = 'none';
      }
    }

    // Tip = converted - service total (only if amount was actually entered)
    const tip = amtReceived > 0 ? Math.max(0, converted - serviceTotal) : 0;
    if (tipEl) {
      const inner = tipEl.querySelector('div');
      if (inner) {
        inner.style.borderColor = tip > 0 ? '#86efac'        : 'var(--border)';
        inner.style.background  = tip > 0 ? '#f0fdf4'        : 'var(--bg)';
        inner.style.color       = tip > 0 ? 'var(--success)' : 'var(--text-muted)';
        inner.innerHTML = tip > 0
          ? `<i class="fas fa-coins" style="margin-right:8px"></i>Tip: ${fmtRaw(tip, svcCur)}`
          : '<i class="fas fa-minus-circle" style="margin-right:6px;opacity:.4"></i>No tip';
      }
    }
  },

  // Called when payment currency dropdown changes
  _onCurrencyChange() {
    const svcCur  = document.getElementById('tx-svc-currency')?.value || 'USD';
    const payCur  = document.getElementById('tx-pay-currency')?.value || svcCur;
    const isCross = svcCur !== payCur;
    const rateRow = document.getElementById('tx-rate-row');
    const rateEl  = document.getElementById('tx-exchange-rate');
    if (rateRow) rateRow.style.display = isCross ? '' : 'none';
    if (rateEl) {
      if (isCross && !rateEl.value.trim()) rateEl.value = fmtAmountInput(getLbpRate(), 'LBP');
      else if (!isCross) rateEl.value = '';
    }
    this._calcTip();
  },

  // Called when service currency changes
  _onSvcCurrencyChange() {
    this._calcTxTotal();   // updates total display with new currency
    this._onCurrencyChange(); // recalculate cross-currency state
  },

  _onStatusChange() {
    const ps      = document.getElementById('tx-payment-status')?.value;
    const row     = document.getElementById('tx-amt-recv-row');
    const rateRow = document.getElementById('tx-rate-row');
    const convEl  = document.getElementById('tx-converted-display');
    const tipEl   = document.getElementById('tx-tip-display');
    const amtRecv = document.getElementById('tx-amt-recv');
    if (!row) return;
    if (ps === 'paid') {
      row.style.display = '';
      tipEl && (tipEl.style.display = '');
      this._onCurrencyChange(); // re-evaluate rate row visibility
      this._calcTip();
    } else {
      row.style.display  = 'none';
      if (rateRow) rateRow.style.display = 'none';
      if (convEl)  convEl.style.display  = 'none';
      if (tipEl)   tipEl.style.display   = 'none';
      if (amtRecv) amtRecv.value = '';
    }
  },

  fillPrice() {
    const svcId = document.querySelector('#tx-service-ss input[type=hidden]')?.value;
    const svc   = this.services.find(s => String(s.id) === String(svcId));
    if (!svc) return;
    const cur    = svc.currency || 'USD';
    const svcSel = document.getElementById('tx-svc-currency');
    const paySel = document.getElementById('tx-pay-currency');
    document.getElementById('tx-price').value = fmtAmountInput(svc.price, cur);
    if (svcSel) svcSel.value = cur;
    if (paySel) paySel.value = cur;
    const qtyEl = document.getElementById('tx-qty');
    if (qtyEl) qtyEl.value = 1;
    this._calcTxTotal();
    this._onCurrencyChange();
  },

  onVehicleTypeChange() {
    const vt       = document.getElementById('tx-veh-type')?.value || 'car';
    const filtered = this.services.filter(s => s.vehicle_type === vt || s.vehicle_type === 'both');
    const opts     = filtered.map(s => ({ value: String(s.id), label: `${s.name} (${fmtRaw(s.price, s.currency)})` }));
    SS.update('tx-service-ss', opts, opts[0]?.value || '');
    this.fillPrice();
  },

  showBulkTip() {
    Modal.show({ title: 'Record Bulk Tips', size: 'sm', body: `<form id="modal-form">
      <p class="text-muted" style="margin-bottom:16px;font-size:13px"><i class="fas fa-coins" style="color:var(--warning);margin-right:5px"></i>Record a collective tip total without linking to a specific service.</p>
      <div class="form-row cols-2">
        <div class="form-group"><label>Date</label><input name="service_date" type="date" value="${today()}"></div>
        <div class="form-group"><label>Tip Amount *</label><input name="tip_total" type="text" inputmode="numeric" required placeholder="0"></div>
        <div class="form-group"><label>Currency</label>${currencySelect('tip_currency', 'USD', { id: 'tip-cur-ss' })}</div>
        <div class="form-group"><label>Notes</label><input name="notes" placeholder="Optional…"></div>
      </div>
    </form>`, saveLabel: 'Record Tips', onSave: async () => {
      if (!Modal.validate()) throw new Error('Please fill required fields');
      const data   = Modal.getFormData();
      const tipAmt = parseAmountInput(data.tip_total);
      if (!tipAmt) throw new Error('Tip amount is required');
      const cur    = data.tip_currency || 'USD';
      await API.post('/transactions', {
        service_date: data.service_date || today(),
        client_name: '', plate_number: '', vehicle_type: 'car',
        service_id: null, price: 0, quantity: 1, discount: 0,
        currency: cur, payment_status: 'paid',
        payment_currency: cur, amount_received: tipAmt, exchange_rate: 1,
        notes: data.notes || 'Bulk tips'
      });
      Modal.close(); Toast.success('Tips recorded'); this.applyFilter();
    }});
  },

  showAdd() {
    Modal.show({ title: 'New Service Transaction', size: 'sm', body: this._formHtml(), onSave: async () => {
      const data       = Modal.getFormData();
      const price      = parseAmountInput(data.price);
      const qty        = Math.max(1, Number(data.quantity) || 1);
      const exchRate   = parseAmountInput(data.exchange_rate) || 1;
      const isPaid     = data.payment_status === 'paid';
      const amtRecv    = isPaid ? (parseAmountInput(data.amount_received) || 0) : 0;
      await API.post('/transactions', { ...data, price, quantity: qty, discount: 0, amount_received: amtRecv, exchange_rate: exchRate });
      Modal.close(); Toast.success('Service recorded'); this.applyFilter();
    }});
  },

  showEdit(id) {
    const t = this.data.find(x => x.id === id);
    Modal.show({ title: 'Edit Transaction', size: 'sm', body: this._formHtml(t), onSave: async () => {
      const data     = Modal.getFormData();
      const price    = parseAmountInput(data.price);
      const qty      = Math.max(1, Number(data.quantity) || 1);
      const exchRate = parseAmountInput(data.exchange_rate) || 1;
      const isPaid   = data.payment_status === 'paid';
      const amtRecv  = isPaid ? (parseAmountInput(data.amount_received) || 0) : 0;
      await API.put(`/transactions/${id}`, { ...data, price, quantity: qty, discount: 0, amount_received: amtRecv, exchange_rate: exchRate });
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
    let data = await API.get(`/transactions?${params}`);

    const typeFilter = document.getElementById('tx-type')?.value;
    if (typeFilter === 'tips')          data = data.filter(t => (Number(t.tip_amount)||0) > 0);
    else if (typeFilter === 'services') data = data.filter(t => !((Number(t.tip_amount)||0) > 0));

    this.data = data;
    document.getElementById('tx-table').innerHTML = this.renderTable(this.data);
    this._updateTotals();
  },

  async deleteRecord(id) {
    if (!await confirmDelete()) return;
    await API.delete(`/transactions/${id}`);
    Toast.success('Deleted'); this.applyFilter();
  }
};

Router.register('transactions', TransactionsPage);
