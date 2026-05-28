// ============================================================
//  DASHBOARD PAGE
// ============================================================
const DashboardPage = {
  title: 'Dashboard',
  _stats: null,
  _currency: 'USD',
  _activeType: null,
  _mode: 'date', // 'date' | 'all'

  async render() {
    return `
      <div class="page-header">
        <div class="page-title"><h2>Dashboard</h2><p>Parking business overview</p></div>
        <div class="page-actions" style="flex-wrap:wrap;gap:8px">
          <!-- Date range -->
          <label style="font-size:13px;color:var(--text-muted);white-space:nowrap;line-height:38px">From</label>
          <input type="date" id="dash-from" value="${today()}" style="padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;height:38px">
          <label style="font-size:13px;color:var(--text-muted);white-space:nowrap;line-height:38px">To</label>
          <input type="date" id="dash-to" value="${today()}" style="padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;height:38px">
          <!-- All Data toggle -->
          <button id="dash-btn-all" onclick="DashboardPage.setMode(DashboardPage._mode==='all'?'date':'all')"
            style="padding:0 16px;border:1.5px solid var(--border);border-radius:8px;background:transparent;color:var(--text-muted);font-weight:600;cursor:pointer;font-size:13px;height:38px;transition:.15s">
            <i class="fas fa-database" style="margin-right:5px"></i>All Data
          </button>
          <!-- Currency toggle -->
          <div style="display:flex;border:1.5px solid var(--border);border-radius:8px;overflow:hidden;height:38px">
            <button id="btn-usd" onclick="DashboardPage.setCurrency('USD')"
              style="padding:0 16px;border:none;background:var(--primary);color:#fff;font-weight:700;cursor:pointer;font-size:13px;transition:.15s">
              $ USD
            </button>
            <button id="btn-lbp" onclick="DashboardPage.setCurrency('LBP')"
              style="padding:0 16px;border:none;background:transparent;color:var(--text-muted);font-weight:700;cursor:pointer;font-size:13px;transition:.15s">
              LL LBP
            </button>
          </div>
        </div>
      </div>
      <div id="dash-content"><div class="loading"><div class="spinner"></div> Loading dashboard…</div></div>`;
  },

  async init() {
    const onChange = () => {
      this._mode = 'date';
      this._updateAllBtn();
      this._activeType = null;
      this.loadData();
    };
    document.getElementById('dash-from').addEventListener('change', onChange);
    document.getElementById('dash-to').addEventListener('change', onChange);
    this.loadData();
  },

  setMode(mode) {
    this._mode = mode;
    this._activeType = null;
    this._updateAllBtn();
    this.loadData();
  },

  _updateAllBtn() {
    const btn = document.getElementById('dash-btn-all');
    if (!btn) return;
    const active = this._mode === 'all';
    btn.style.background = active ? 'var(--primary)' : 'transparent';
    btn.style.color      = active ? '#fff' : 'var(--text-muted)';
    btn.style.border     = active ? '1.5px solid var(--primary)' : '1.5px solid var(--border)';
  },

  async loadData() {
    const mode = this._mode;
    let query = '';
    if (mode === 'all') {
      query = '/dashboard?mode=all';
    } else {
      const from = document.getElementById('dash-from')?.value || today();
      const to   = document.getElementById('dash-to')?.value   || today();
      query = `/dashboard?date_from=${from}&date_to=${to}&mode=date`;
    }
    try {
      const d = await API.get(query);
      this._stats = d.stats;
      document.getElementById('dash-content').innerHTML = `
        <div class="stats-grid" id="stats-grid">${this._statCards(d.stats)}</div>
        <div id="dash-detail-panel"></div>`;
    } catch (e) {
      document.getElementById('dash-content').innerHTML =
        `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h4>Failed to load</h4><p>${escHtml(e.message)}</p></div>`;
    }
  },

  setCurrency(cur) {
    this._currency = cur;
    const btnUsd = document.getElementById('btn-usd');
    const btnLbp = document.getElementById('btn-lbp');
    if (btnUsd) { btnUsd.style.background = cur === 'USD' ? 'var(--primary)' : 'transparent'; btnUsd.style.color = cur === 'USD' ? '#fff' : 'var(--text-muted)'; }
    if (btnLbp) { btnLbp.style.background = cur === 'LBP' ? 'var(--primary)' : 'transparent'; btnLbp.style.color = cur === 'LBP' ? '#fff' : 'var(--text-muted)'; }
    if (this._stats) document.getElementById('stats-grid').innerHTML = this._statCards(this._stats);
  },

  _fmtByCurrency(byCurrency) {
    const cur = this._currency;
    const usd = (byCurrency || {}).USD || 0;
    const lbp = (byCurrency || {}).LBP || 0;
    return fmtRaw(convertAmount(usd, 'USD', cur) + convertAmount(lbp, 'LBP', cur), cur);
  },

  _statCards(s) {
    const from   = document.getElementById('dash-from')?.value || today();
    const to     = document.getElementById('dash-to')?.value   || today();
    const period = this._mode === 'all' ? 'All time' : (from === to ? from : `${from} → ${to}`);
    return `
      ${this._card('fa-dollar-sign',        'blue',   'Total Revenue',        this._fmtByCurrency(s.totalRevenueByCurrency),    period, 'total-revenue')}
      ${this._card('fa-file-invoice',       'purple', 'Subscription Revenue', this._fmtByCurrency(s.subRevenueByCurrency),      period, 'sub-revenue')}
      ${this._card('fa-car',                'cyan',   'Parking Revenue',      this._fmtByCurrency(s.parkingRevenueByCurrency),  period, 'parking-revenue')}
      ${this._card('fa-shower',             'info',   'Services Revenue',     this._fmtByCurrency(s.servicesRevenueByCurrency), period, 'services-revenue')}
      ${this._card('fa-receipt',            'amber',  'Total Expenses',       this._fmtByCurrency(s.expensesByCurrency),        period, 'expenses')}
      ${this._card('fa-chart-line', (() => { const np=s.netProfitByCurrency||{},c=this._currency; return (convertAmount(np.USD||0,'USD',c)+convertAmount(np.LBP||0,'LBP',c))>=0; })() ? 'green' : 'red', 'Net Profit', this._fmtByCurrency(s.netProfitByCurrency), period, 'net-profit')}
      ${this._card('fa-users',              'blue',   'Active Subscribers',   s.activeClients,    this._mode === 'all' ? 'All active clients'   : `Active on ${period}`,       'active-subscribers')}
      ${this._card('fa-exclamation-circle', 'amber',  'Unpaid Subscribers',   s.unpaidClients,    this._mode === 'all' ? 'All unpaid invoices'  : `Unpaid — ${period.slice(0,7)}`, 'unpaid-subscribers')}
      ${this._card('fa-parking',            'cyan',   this._mode === 'all' ? 'Currently Parked' : 'Vehicles Parked', s.currentlyParked, this._mode === 'all' ? 'Live — in lot now' : `Entered on ${period}`, 'currently-parked')}
      ${this._card('fa-building',           'purple', this._mode === 'all' ? 'Third Party Parked' : 'Third Party — This Day', s.thirdPartyParked, this._mode === 'all' ? 'Company vehicles in lot' : `Company vehicles on ${period}`, 'third-party-parked')}`;
  },

  _card(icon, color, label, value, sub, type) {
    const v = String(value);
    const textLen = v.replace(/<[^>]+>/g, '').split('<br>')[0].length;
    const fs = textLen > 14 ? '13px' : textLen > 11 ? '16px' : textLen > 8 ? '20px' : '24px';
    const active = this._activeType === type;
    return `<div class="stat-card dash-stat-clickable${active ? ' dash-stat-active' : ''}" onclick="DashboardPage.showDetails('${type}')" title="Click to view details">
      <div class="stat-icon ${color}"><i class="fas ${icon}"></i></div>
      <div class="stat-info">
        <div class="stat-label">${escHtml(label)}</div>
        <div class="stat-value" style="font-size:${fs};word-break:break-word;line-height:1.5">${v}</div>
        <div class="stat-sub">${escHtml(sub)}</div>
      </div>
    </div>`;
  },

  async showDetails(type) {
    const month = document.getElementById('dash-from')?.value || today();
    const s = this._stats;

    // Toggle off if same card clicked again
    if (this._activeType === type) {
      this._activeType = null;
      document.getElementById('stats-grid').innerHTML = this._statCards(s);
      document.getElementById('dash-detail-panel').innerHTML = '';
      return;
    }

    this._activeType = type;
    document.getElementById('stats-grid').innerHTML = this._statCards(s);

    const panel = document.getElementById('dash-detail-panel');
    panel.innerHTML = `<div class="card" style="margin-top:20px"><div class="card-header"><span class="card-title">${escHtml(this._typeLabel(type))}</span></div><div style="padding:20px"><div class="loading"><div class="spinner"></div> Loading…</div></div></div>`;

    // Local breakdown types — no API needed
    if (type === 'total-revenue') {
      panel.innerHTML = this._panelWrap('Total Revenue Breakdown', this._summaryTable([
        { icon: 'fa-file-invoice', color: 'purple', label: 'Subscription Revenue', value: this._fmtByCurrency(s.subRevenueByCurrency),      type: 'sub-revenue' },
        { icon: 'fa-car',          color: 'cyan',   label: 'Parking Revenue',      value: this._fmtByCurrency(s.parkingRevenueByCurrency),  type: 'parking-revenue' },
        { icon: 'fa-shower',       color: 'info',   label: 'Services Revenue',     value: this._fmtByCurrency(s.servicesRevenueByCurrency), type: 'services-revenue' },
      ], { icon: 'fa-dollar-sign', color: 'blue', label: 'Total Revenue', value: this._fmtByCurrency(s.totalRevenueByCurrency) }));
      return;
    }

    if (type === 'net-profit') {
      panel.innerHTML = this._panelWrap('Net Profit Breakdown', this._summaryTable([
        { icon: 'fa-dollar-sign', color: 'blue',  label: 'Total Revenue',  value: this._fmtByCurrency(s.totalRevenueByCurrency), type: 'total-revenue' },
        { icon: 'fa-receipt',     color: 'amber', label: 'Total Expenses', value: this._fmtByCurrency(s.expensesByCurrency),     type: 'expenses' },
      ], { icon: 'fa-chart-line', color: (() => { const np=s.netProfitByCurrency||{},c=this._currency; return (convertAmount(np.USD||0,'USD',c)+convertAmount(np.LBP||0,'LBP',c))>=0; })() ? 'green' : 'red', label: 'Net Profit', value: this._fmtByCurrency(s.netProfitByCurrency) }));
      return;
    }

    // API-based types
    try {
      const dateFrom = document.getElementById('dash-from')?.value || today();
      const dateTo   = document.getElementById('dash-to')?.value   || today();
      const modeParam = this._mode === 'all' ? 'all' : 'date';
      const data = await API.get(`/dashboard/details?type=${type}&date_from=${dateFrom}&date_to=${dateTo}&mode=${modeParam}`);
      const html = this._buildTable(type, data);
      panel.innerHTML = this._panelWrap(this._typeLabel(type), html, data.length);
    } catch (e) {
      panel.innerHTML = this._panelWrap(this._typeLabel(type), `<p class="text-muted text-center" style="padding:20px">${escHtml(e.message)}</p>`);
    }
  },

  _panelWrap(title, content, count = null) {
    const countBadge = count != null ? `<span class="badge" style="margin-left:8px;background:var(--primary);color:#fff">${count}</span>` : '';
    return `<div class="card" style="margin-top:20px">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between">
        <span class="card-title">${escHtml(title)}${countBadge}</span>
        <button class="btn btn-sm btn-outline" onclick="DashboardPage.showDetails('${this._activeType}')"><i class="fas fa-times"></i> Close</button>
      </div>
      <div class="table-wrap">${content}</div>
    </div>`;
  },

  _summaryTable(rows, total) {
    return `<div style="display:flex;flex-direction:column;gap:10px;padding:20px">
      ${rows.map(r => `
        <div onclick="${r.type ? `DashboardPage.showDetails('${r.type}')` : ''}" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--bg);border-radius:8px;border:1px solid var(--border);${r.type ? 'cursor:pointer;transition:box-shadow .15s,transform .15s' : ''}" ${r.type ? `onmouseover="this.style.boxShadow='0 4px 14px rgba(0,0,0,.1)';this.style.transform='translateY(-1px)'" onmouseout="this.style.boxShadow='';this.style.transform=''"` : ''}>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="stat-icon ${r.color}" style="width:34px;height:34px;font-size:13px"><i class="fas ${r.icon}"></i></div>
            <span style="font-weight:500">${escHtml(r.label)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-weight:600;font-size:15px">${escHtml(r.value)}</span>
            ${r.type ? `<i class="fas fa-chevron-right" style="font-size:11px;color:var(--text-muted)"></i>` : ''}
          </div>
        </div>`).join('')}
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--primary);border-radius:8px;color:#fff">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:34px;height:34px;border-radius:8px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:13px"><i class="fas ${total.icon}"></i></div>
          <span style="font-weight:700">${escHtml(total.label)}</span>
        </div>
        <span style="font-weight:700;font-size:18px">${escHtml(total.value)}</span>
      </div>
    </div>`;
  },

  _buildTable(type, data) {
    if (!data.length) return `<div class="empty-state" style="padding:30px"><i class="fas fa-inbox"></i><h4>No records found</h4></div>`;

    if (type === 'sub-revenue') return `<table>
      <thead><tr><th>Client</th><th>Mobile</th><th>Plate</th><th>Plan</th><th>Month</th><th>Status</th><th>Amount</th></tr></thead>
      <tbody>${data.map(r => `<tr>
        <td><strong>${escHtml(r.clients?.full_name || '—')}</strong></td>
        <td>${escHtml(r.clients?.mobile || '—')}</td>
        <td>${escHtml(r.client_vehicles?.plate_number || '—')}</td>
        <td>${escHtml(r.subscription_plans?.name || '—')}</td>
        <td>${escHtml(r.invoice_month || '—')}</td>
        <td>${statusBadge(r.payment_status)}</td>
        <td class="fw-bold">${fmtRaw(r.final_amount, r.currency)}</td>
      </tr>`).join('')}</tbody></table>`;

    if (type === 'parking-revenue') return `<table>
      <thead><tr><th>Plate</th><th>Type</th><th>Company</th><th>Card #</th><th>Entry</th><th>Exit</th><th>Duration</th><th>Amount</th></tr></thead>
      <tbody>${data.map(r => `<tr>
        <td><strong>${escHtml(r.plate_number)}</strong></td>
        <td>${vehicleBadge(r.vehicle_type)}</td>
        <td>${r.third_party_company ? `<span class="badge badge-purple" style="font-size:10px">${escHtml(r.third_party_company)}</span>` : '<span class="text-muted">—</span>'}</td>
        <td class="text-muted" style="letter-spacing:1px">${escHtml(r.card_number || '—')}</td>
        <td>${fmtDateTime(r.entry_time)}</td>
        <td>${fmtDateTime(r.exit_time)}</td>
        <td>${fmtDuration(r.duration_minutes)}</td>
        <td class="fw-bold">${fmtAmt(r.amount, r.currency)}</td>
      </tr>`).join('')}</tbody></table>`;

    if (type === 'services-revenue') return `<table>
      <thead><tr><th>Service</th><th>Client</th><th>Date</th><th>Amount</th></tr></thead>
      <tbody>${data.map(r => `<tr>
        <td><strong>${escHtml(r.services?.name || '—')}</strong></td>
        <td>${escHtml(r.clients?.full_name || '—')}</td>
        <td>${fmtDate(r.service_date)}</td>
        <td class="fw-bold">${fmtRaw(r.final_amount, r.currency)}</td>
      </tr>`).join('')}</tbody></table>`;

    if (type === 'expenses') return `<table>
      <thead><tr><th>Title</th><th>Type</th><th>Date</th><th>Paid To</th><th>Method</th><th>Amount</th></tr></thead>
      <tbody>${data.map(r => `<tr>
        <td><strong>${escHtml(r.title)}</strong></td>
        <td>${escHtml(r.expense_type || '—')}</td>
        <td>${fmtDate(r.expense_date)}</td>
        <td>${escHtml(r.paid_to || '—')}</td>
        <td>${escHtml(r.payment_method || '—')}</td>
        <td class="fw-bold">${fmtRaw(r.amount, r.currency)}</td>
      </tr>`).join('')}</tbody></table>`;

    if (type === 'active-subscribers') return `<table>
      <thead><tr><th>Client</th><th>Mobile</th><th>Plate</th><th>Vehicle</th><th>Plan</th><th>Start</th><th>End</th><th>Rate</th></tr></thead>
      <tbody>${data.map(r => `<tr>
        <td><strong>${escHtml(r.clients?.full_name || '—')}</strong></td>
        <td>${escHtml(r.clients?.mobile || '—')}</td>
        <td>${escHtml(r.plate_number)}</td>
        <td>${vehicleBadge(r.vehicle_type)}</td>
        <td>${escHtml(r.subscription_plans?.name || '—')}</td>
        <td>${fmtDate(r.start_date)}</td>
        <td>${r.end_date ? fmtDate(r.end_date) : '—'}</td>
        <td class="fw-bold">${fmtRaw(r.amount, r.currency)}</td>
      </tr>`).join('')}</tbody></table>`;

    if (type === 'unpaid-subscribers') return `<table>
      <thead><tr><th>Invoice #</th><th>Client</th><th>Mobile</th><th>Plate</th><th>Plan</th><th>Month</th><th>Due Date</th><th>Amount</th></tr></thead>
      <tbody>${data.map(r => `<tr>
        <td><span class="badge badge-warning">${escHtml(r.invoice_number || '—')}</span></td>
        <td><strong>${escHtml(r.clients?.full_name || '—')}</strong></td>
        <td>${escHtml(r.clients?.mobile || '—')}</td>
        <td>${escHtml(r.client_vehicles?.plate_number || '—')}</td>
        <td>${escHtml(r.subscription_plans?.name || '—')}</td>
        <td>${escHtml(r.invoice_month || '—')}</td>
        <td class="${r.due_date && r.due_date < today() ? 'text-danger' : ''}">${fmtDate(r.due_date)}</td>
        <td class="fw-bold text-danger">${fmtRaw(r.final_amount, r.currency)}</td>
      </tr>`).join('')}</tbody></table>`;

    if (type === 'currently-parked') return `<table>
      <thead><tr><th>Plate</th><th>Type</th><th>Company</th><th>Entry Time</th><th>Exit Time</th><th>Duration</th><th>Status</th><th>Notes</th></tr></thead>
      <tbody>${data.map(r => {
        const endTime = r.exit_time ? new Date(r.exit_time) : Date.now();
        const mins = Math.round((endTime - new Date(r.entry_time)) / 60000);
        return `<tr>
          <td><strong>${escHtml(r.plate_number)}</strong></td>
          <td>${vehicleBadge(r.vehicle_type)}</td>
          <td>${r.third_party_company ? `<span class="badge badge-purple" style="font-size:10px">${escHtml(r.third_party_company)}</span>` : '<span class="text-muted">—</span>'}</td>
          <td>${fmtDateTime(r.entry_time)}</td>
          <td>${r.exit_time ? fmtDateTime(r.exit_time) : '<span class="badge badge-success">Still inside</span>'}</td>
          <td>${fmtDuration(mins)}</td>
          <td>${statusBadge(r.parking_status)}</td>
          <td class="text-muted">${escHtml(r.notes || '—')}</td>
        </tr>`;
      }).join('')}</tbody></table>`;

    if (type === 'third-party-parked') return `<table>
      <thead><tr><th>Plate</th><th>Type</th><th>Company</th><th>Entry Time</th><th>Exit Time</th><th>Duration</th><th>Status</th><th>Notes</th></tr></thead>
      <tbody>${data.map(r => {
        const endTime = r.exit_time ? new Date(r.exit_time) : Date.now();
        const mins = Math.round((endTime - new Date(r.entry_time)) / 60000);
        return `<tr>
          <td><strong>${escHtml(r.plate_number)}</strong></td>
          <td>${vehicleBadge(r.vehicle_type)}</td>
          <td><span class="badge badge-purple">${escHtml(r.third_party_company)}</span></td>
          <td>${fmtDateTime(r.entry_time)}</td>
          <td>${r.exit_time ? fmtDateTime(r.exit_time) : '<span class="badge badge-success">Still inside</span>'}</td>
          <td>${fmtDuration(mins)}</td>
          <td>${statusBadge(r.parking_status)}</td>
          <td class="text-muted">${escHtml(r.notes || '—')}</td>
        </tr>`;
      }).join('')}</tbody></table>`;

    return '';
  },

  _typeLabel(type) {
    const map = {
      'total-revenue': 'Total Revenue', 'sub-revenue': 'Subscription Revenue',
      'parking-revenue': 'Parking Revenue', 'services-revenue': 'Services Revenue',
      'expenses': 'Expenses', 'net-profit': 'Net Profit',
      'active-subscribers': 'Active Subscribers', 'unpaid-subscribers': 'Unpaid Subscribers',
      'currently-parked': 'Vehicles Parked', 'third-party-parked': 'Third Party Vehicles'
    };
    return map[type] || type;
  }
};

Router.register('dashboard', DashboardPage);
