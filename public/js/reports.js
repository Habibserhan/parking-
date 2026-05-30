// ============================================================
//  REPORTS PAGE
// ============================================================
const ReportsPage = {
  title: 'Reports',
  currentReport: 'revenue',
  _viewMode: 'summary',      // 'summary' | 'details'
  _revenueCurrency: 'USD',
  _revenueData: null,
  _exportData: [],

  // Tabs: [key, icon, label, defaultView, hasToggle]
  TABS: [
    ['revenue',  'fas fa-chart-line',         'Revenue Summary',       'summary', false],
    ['parking',  'fas fa-car',                'Daily Parking',         'details', true ],
    ['services', 'fas fa-shower',             'Services',              'details', true ],
    ['tips',     'fas fa-hand-holding-usd',   'Tips Revenue',          'details', true ],
    ['expenses', 'fas fa-receipt',            'Expenses',              'details', true ],
    ['salary',   'fas fa-user-tie',           'Salary Report',         'summary', false],
    ['invoices', 'fas fa-file-invoice',       'Unpaid Invoices',       'details', true ],
    ['partial',  'fas fa-hourglass-half',     'Partial / Remaining',   'details', true ],
    ['clients',  'fas fa-users',              'Active Clients',        'details', true ],
    ['expired',  'fas fa-clock',              'Expired Subscriptions', 'details', true ],
  ],

  _monthStart() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; },

  async render() {
    const tab = this.TABS.find(t => t[0] === this.currentReport);
    this._viewMode = tab?.[3] || 'details';
    return `
      <div class="page-header">
        <div class="page-title"><h2>Reports</h2><p>Business analytics and data export</p></div>
      </div>

      <!-- ── Report Tabs ── -->
      <div class="card" style="margin-bottom:14px">
        <div style="padding:12px 14px;overflow-x:auto">
          <div style="display:flex;gap:6px;min-width:max-content">
            ${this.TABS.map(([key,icon,label]) => `
              <button onclick="ReportsPage.switchReport('${key}')"
                style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;border:1.5px solid ${this.currentReport===key?'var(--primary)':'var(--border)'};background:${this.currentReport===key?'var(--primary)':'transparent'};color:${this.currentReport===key?'#fff':'var(--text)'};font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;transition:.15s">
                <i class="${icon}" style="font-size:11px"></i>${label}
              </button>`).join('')}
          </div>
        </div>
      </div>

      <!-- ── Filters + Controls ── -->
      <div class="card" style="margin-bottom:14px">
        <div style="padding:12px 16px">
          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px">
            <div style="display:flex;align-items:center;gap:6px">
              <label style="font-size:12px;font-weight:600;color:var(--text-muted);white-space:nowrap">From</label>
              <input type="date" id="rpt-from" value="${this._monthStart()}"
                style="padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px">
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <label style="font-size:12px;font-weight:600;color:var(--text-muted);white-space:nowrap">To</label>
              <input type="date" id="rpt-to" value="${today()}"
                style="padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px">
            </div>
            <button class="btn btn-primary" onclick="ReportsPage.loadReport()">
              <i class="fas fa-search"></i> Run Report
            </button>
            <button class="btn btn-outline" onclick="ReportsPage.exportData()">
              <i class="fas fa-download"></i> Export CSV
            </button>
            <!-- View toggle (only for tabs that support it) -->
            ${this.TABS.find(t=>t[0]===this.currentReport)?.[4] ? `
            <div style="margin-left:auto;display:flex;border:1.5px solid var(--border);border-radius:8px;overflow:hidden;height:36px">
              <button id="view-btn-summary" onclick="ReportsPage.setViewMode('summary')"
                style="padding:0 14px;border:none;background:${this._viewMode==='summary'?'var(--primary)':'transparent'};color:${this._viewMode==='summary'?'#fff':'var(--text-muted)'};font-weight:600;cursor:pointer;font-size:12px;transition:.15s;display:flex;align-items:center;gap:5px">
                <i class="fas fa-th-large"></i> Summary
              </button>
              <button id="view-btn-details" onclick="ReportsPage.setViewMode('details')"
                style="padding:0 14px;border:none;background:${this._viewMode==='details'?'var(--primary)':'transparent'};color:${this._viewMode==='details'?'#fff':'var(--text-muted)'};font-weight:600;cursor:pointer;font-size:12px;transition:.15s;display:flex;align-items:center;gap:5px">
                <i class="fas fa-list"></i> Details
              </button>
            </div>` : ''}
          </div>
        </div>
      </div>

      <!-- ── Content ── -->
      <div id="report-content"><div class="loading"><div class="spinner"></div> Loading…</div></div>`;
  },

  init() { this.loadReport(); },

  switchReport(key) {
    this.currentReport = key;
    const tab = this.TABS.find(t => t[0] === key);
    this._viewMode = tab?.[3] || 'details';
    Router.navigate('reports');
  },

  setViewMode(mode) {
    this._viewMode = mode;
    // Update toggle button styles
    const sb = document.getElementById('view-btn-summary');
    const db = document.getElementById('view-btn-details');
    if (sb) { sb.style.background = mode==='summary'?'var(--primary)':'transparent'; sb.style.color = mode==='summary'?'#fff':'var(--text-muted)'; }
    if (db) { db.style.background = mode==='details'?'var(--primary)':'transparent'; db.style.color = mode==='details'?'#fff':'var(--text-muted)'; }
    this.loadReport();
  },

  async loadReport() {
    const from = document.getElementById('rpt-from')?.value || this._monthStart();
    const to   = document.getElementById('rpt-to')?.value   || today();
    const el   = document.getElementById('report-content');
    if (!el) return;
    el.innerHTML = '<div class="loading"><div class="spinner"></div> Loading…</div>';
    try {
      switch (this.currentReport) {
        case 'revenue':  await this.renderRevenue(from, to, el); break;
        case 'parking':  await this.renderParking(from, to, el); break;
        case 'services': await this.renderServices(from, to, el); break;
        case 'tips':     await this.renderTips(from, to, el); break;
        case 'expenses': await this.renderExpenses(from, to, el); break;
        case 'salary':   await this.renderSalary(from, el); break;
        case 'invoices': await this.renderUnpaidInvoices(el); break;
        case 'partial':  await this.renderPartialInvoices(el); break;
        case 'clients':  await this.renderActiveClients(el); break;
        case 'expired':  await this.renderExpiredSubs(el); break;
      }
    } catch (e) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h4>Error</h4><p>${escHtml(e.message)}</p></div>`;
    }
  },

  // ── Shared helpers ─────────────────────────────────────────

  _card(icon, color, label, value, sub='') {
    return `<div class="stat-card">
      <div class="stat-icon ${color}"><i class="fas ${icon}"></i></div>
      <div class="stat-info">
        <div class="stat-label">${escHtml(label)}</div>
        <div class="stat-value">${value}</div>
        ${sub ? `<div class="stat-sub">${escHtml(sub)}</div>` : ''}
      </div>
    </div>`;
  },

  _wrap(title, count, badge, content) {
    const countBadge = count != null
      ? `<span style="background:var(--primary);color:#fff;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:700;margin-left:8px">${count}</span>` : '';
    const rightBadge = badge || '';
    return `<div class="card">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <span class="card-title">${escHtml(title)}${countBadge}</span>
        ${rightBadge}
      </div>
      <div class="table-wrap">${content}</div>
    </div>`;
  },

  _empty(icon, msg) {
    return `<div class="empty-state" style="padding:40px"><i class="fas ${icon}"></i><h4>${msg}</h4></div>`;
  },

  // ── Revenue Summary (always summary, with currency toggle) ──

  async renderRevenue(from, to, el) {
    this._revenueData = await API.get(`/reports/revenue?date_from=${from}&date_to=${to}`);
    this._renderRevenueSummary(el);
  },

  _cvt(byCur) {
    const cur = this._revenueCurrency;
    return Object.entries(byCur || {}).reduce((t, [c, a]) => t + convertAmount(a, c, cur), 0);
  },

  _renderRevenueSummary(el) {
    const d = this._revenueData;
    const cur = this._revenueCurrency;
    const sub    = this._cvt(d.subscriptions);
    const park   = this._cvt(d.parking);
    const svc    = this._cvt(d.services);
    const tips   = this._cvt(d.tips);
    const total  = this._cvt(d.total);
    const exp    = this._cvt(d.expenses);
    const profit = this._cvt(d.profit);
    const pos    = profit >= 0;

    this._exportData = [{ Currency: cur, Subscriptions: sub, Parking: park, Services: svc, Tips: tips, Total: total, Expenses: exp, Profit: profit }];

    // Raw per-currency breakdown rows
    const curs = new Set([...Object.keys(d.subscriptions||{}), ...Object.keys(d.parking||{}), ...Object.keys(d.services||{}), ...Object.keys(d.expenses||{})]);
    const breakdownRows = [...curs].map(c => {
      const s = (d.subscriptions||{})[c]||0, p=(d.parking||{})[c]||0, sv=(d.services||{})[c]||0, ti=(d.tips||{})[c]||0, to=(d.total||{})[c]||0, ex=(d.expenses||{})[c]||0, pr=(d.profit||{})[c]||0;
      return `<tr>
        <td><span class="badge badge-gray">${c}</span></td>
        <td>${fmtRaw(s,c)}</td><td>${fmtRaw(p,c)}</td><td>${fmtRaw(sv,c)}</td>
        <td style="color:${ti>0?'var(--success)':'var(--text-muted)'}">${ti>0?fmtRaw(ti,c):'—'}</td>
        <td class="fw-bold">${fmtRaw(to,c)}</td>
        <td style="color:var(--danger)">${fmtRaw(ex,c)}</td>
        <td class="fw-bold" style="color:${pr>=0?'var(--success)':'var(--danger)'}">${fmtRaw(pr,c)}</td>
      </tr>`;
    }).join('') || `<tr><td colspan="8" style="padding:20px;text-align:center;color:var(--text-muted)">No data for selected period</td></tr>`;

    el.innerHTML = `
      <!-- Currency toggle -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;flex-wrap:wrap">
        <span style="font-size:13px;font-weight:600;color:var(--text-muted)">Display in:</span>
        <div style="display:flex;border:1.5px solid var(--border);border-radius:8px;overflow:hidden;height:36px">
          <button onclick="ReportsPage._setRevenueCurrency('USD')"
            style="padding:0 18px;border:none;background:${cur==='USD'?'var(--primary)':'transparent'};color:${cur==='USD'?'#fff':'var(--text-muted)'};font-weight:700;cursor:pointer;font-size:13px;transition:.15s">$ USD</button>
          <button onclick="ReportsPage._setRevenueCurrency('LBP')"
            style="padding:0 18px;border:none;background:${cur==='LBP'?'var(--primary)':'transparent'};color:${cur==='LBP'?'#fff':'var(--text-muted)'};font-weight:700;cursor:pointer;font-size:13px;transition:.15s">LL LBP</button>
        </div>
        <span style="font-size:11px;color:var(--text-muted)"><i class="fas fa-info-circle"></i> Amounts converted using the system exchange rate.</span>
      </div>

      <!-- Summary cards -->
      <div class="stats-grid" style="margin-bottom:20px">
        ${this._card('fa-file-invoice',       'blue',   'Subscription Revenue', fmtRaw(sub,  cur))}
        ${this._card('fa-car',                'cyan',   'Parking Revenue',      fmtRaw(park, cur))}
        ${this._card('fa-shower',             'purple', 'Services Revenue',     fmtRaw(svc,  cur))}
        ${this._card('fa-hand-holding-usd',   'green',  'Tips Revenue',         fmtRaw(tips, cur))}
        <div class="stat-card" style="border:2px solid var(--primary)">
          <div class="stat-icon blue"><i class="fas fa-dollar-sign"></i></div>
          <div class="stat-info"><div class="stat-label" style="font-weight:700">Total Revenue</div><div class="stat-value" style="color:var(--primary)">${fmtRaw(total, cur)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red"><i class="fas fa-receipt"></i></div>
          <div class="stat-info"><div class="stat-label">Total Expenses</div><div class="stat-value" style="color:var(--danger)">${fmtRaw(exp, cur)}</div></div>
        </div>
        <div class="stat-card" style="border:2px solid ${pos?'var(--success)':'var(--danger)'}">
          <div class="stat-icon ${pos?'green':'red'}"><i class="fas fa-chart-line"></i></div>
          <div class="stat-info"><div class="stat-label" style="font-weight:700">Net Profit</div><div class="stat-value" style="color:${pos?'var(--success)':'var(--danger)'}">${fmtRaw(profit, cur)}</div></div>
        </div>
      </div>

      <!-- Raw breakdown per currency -->
      <div class="card">
        <div class="card-header"><span class="card-title">Breakdown by Currency (native amounts)</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Currency</th><th>Subscriptions</th><th>Parking</th><th>Services</th><th>Tips</th><th>Total Revenue</th><th>Expenses</th><th>Net Profit</th></tr></thead>
            <tbody>${breakdownRows}</tbody>
          </table>
        </div>
      </div>`;
  },

  _setRevenueCurrency(cur) {
    this._revenueCurrency = cur;
    const el = document.getElementById('report-content');
    if (el && this._revenueData) this._renderRevenueSummary(el);
  },

  // ── Daily Parking ──────────────────────────────────────────
  async renderParking(from, to, el) {
    const rows = await API.get(`/reports/daily-parking?date_from=${from}&date_to=${to}`);
    this._exportData = rows;
    const paid   = rows.filter(r => r.payment_status === 'paid');
    const paidAmt = sumConverted(paid, 'USD', 'amount', 'currency');

    if (this._viewMode === 'summary') {
      el.innerHTML = `<div class="stats-grid">
        ${this._card('fa-car',          'cyan',  'Total Records',     rows.length,  `${from} → ${to}`)}
        ${this._card('fa-check-circle', 'green', 'Paid Records',      paid.length,  'Completed & paid')}
        ${this._card('fa-dollar-sign',  'blue',  'Paid Revenue',      fmtRaw(paidAmt,'USD'), 'USD equivalent')}
        ${this._card('fa-clock',        'amber', 'Unpaid / Parked',   rows.length - paid.length, 'Not yet collected')}
      </div>`;
      return;
    }

    const badge = paid.length ? `<span class="badge badge-success">${paid.length} paid &nbsp;·&nbsp; ${fmtRaw(paidAmt,'USD')}</span>` : '';
    el.innerHTML = this._wrap(`Daily Parking`, rows.length, badge,
      rows.length ? `<table>
        <thead><tr><th>Plate</th><th>Vehicle</th><th>Entry</th><th>Exit</th><th>Duration</th><th>Amount</th><th>Payment</th><th>Status</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td><strong>${escHtml(r.plate_number)}</strong></td>
          <td>${vehicleBadge(r.vehicle_type)}</td>
          <td>${fmtDateTime(r.entry_time)}</td>
          <td>${r.exit_time ? fmtDateTime(r.exit_time) : '—'}</td>
          <td>${fmtDuration(r.duration_minutes)}</td>
          <td class="fw-bold">${fmtAmt(r.amount, r.currency)}</td>
          <td>${statusBadge(r.payment_status)}</td>
          <td>${statusBadge(r.parking_status)}</td>
        </tr>`).join('')}</tbody>
      </table>` : this._empty('fa-car', 'No parking records')
    );
  },

  // ── Services ───────────────────────────────────────────────
  async renderServices(from, to, el) {
    const rows = await API.get(`/reports/services?date_from=${from}&date_to=${to}`);
    this._exportData = rows;
    const paid    = rows.filter(r => r.payment_status === 'paid');
    const paidAmt = sumConverted(paid, 'USD', 'final_amount', 'currency');

    if (this._viewMode === 'summary') {
      el.innerHTML = `<div class="stats-grid">
        ${this._card('fa-soap',         'purple','Total Transactions', rows.length)}
        ${this._card('fa-check-circle', 'green', 'Paid',              paid.length, fmtRaw(paidAmt,'USD'))}
        ${this._card('fa-clock',        'amber', 'Unpaid',            rows.length - paid.length)}
      </div>`;
      return;
    }

    const badge = `<span class="badge badge-success">${fmtRaw(paidAmt,'USD')} paid</span>`;
    el.innerHTML = this._wrap('Services', rows.length, badge,
      rows.length ? `<table>
        <thead><tr><th>Date</th><th>Service</th><th>Client</th><th>Plate</th><th>Price</th><th>Qty</th><th>Total</th><th>Status</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td>${fmtDate(r.service_date)}</td>
          <td>${escHtml(r.service_name || '—')}</td>
          <td>${escHtml(r.client_name  || '—')}</td>
          <td>${escHtml(r.plate_number || '—')}</td>
          <td>${fmtRaw(r.price, r.currency)}</td>
          <td class="text-muted">${r.quantity > 1 ? `<strong>${r.quantity}</strong>` : (r.quantity||1)}</td>
          <td class="fw-bold">${fmtRaw(r.final_amount, r.currency)}</td>
          <td>${statusBadge(r.payment_status)}</td>
        </tr>`).join('')}</tbody>
      </table>` : this._empty('fa-shower', 'No service records')
    );
  },

  // ── Tips Revenue ───────────────────────────────────────────
  async renderTips(from, to, el) {
    const rows  = await API.get(`/reports/tips?date_from=${from}&date_to=${to}`);
    this._exportData = rows;
    const tipAmt = sumConverted(rows, 'USD', 'tip_amount', 'currency');

    if (this._viewMode === 'summary') {
      el.innerHTML = `<div class="stats-grid">
        ${this._card('fa-hand-holding-usd','green','Total Tips',        fmtRaw(tipAmt,'USD'), 'USD equivalent')}
        ${this._card('fa-coins',           'amber','Tipped Transactions', rows.length)}
      </div>`;
      return;
    }

    const badge = rows.length ? `<span class="badge badge-success">Total: ${fmtRaw(tipAmt,'USD')}</span>` : '';
    el.innerHTML = this._wrap('Tips Revenue', rows.length, badge,
      rows.length ? `<table>
        <thead><tr><th>Date</th><th>Service</th><th>Client</th><th>Plate</th><th>Service Total</th><th>Received</th><th>Tip</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td>${fmtDate(r.service_date)}</td>
          <td>${escHtml(r.service_name || '—')}</td>
          <td>${escHtml(r.client_name  || '—')}</td>
          <td>${escHtml(r.plate_number || '—')}</td>
          <td>${fmtRaw(r.final_amount,   r.currency)}</td>
          <td>${fmtRaw(r.amount_received, r.payment_currency || r.currency)}</td>
          <td class="fw-bold" style="color:var(--success)">${fmtRaw(r.tip_amount, r.currency)}</td>
        </tr>`).join('')}
        </tbody>
        <tfoot><tr style="background:var(--bg)">
          <td colspan="6" style="text-align:right;padding:12px 16px;font-weight:700">Total Tips</td>
          <td style="padding:12px 16px;font-weight:700;color:var(--success)">${fmtRaw(tipAmt,'USD')}</td>
        </tr></tfoot>
      </table>` : this._empty('fa-hand-holding-usd', 'No tips recorded')
    );
  },

  // ── Expenses ───────────────────────────────────────────────
  async renderExpenses(from, to, el) {
    const rows = await API.get(`/reports/expenses?date_from=${from}&date_to=${to}`);
    this._exportData = rows;
    const totalUSD = sumConverted(rows, 'USD', 'amount', 'currency');

    if (this._viewMode === 'summary') {
      const byType = {};
      rows.forEach(r => { byType[r.expense_type] = (byType[r.expense_type]||0) + convertAmount(Number(r.amount)||0, r.currency||'USD', 'USD'); });
      const typeColors = { salary:'blue', salary_advance:'purple', rent:'amber', electricity:'amber', water:'cyan', maintenance:'orange', other:'gray' };
      const typeIcons  = { salary:'fa-user-tie', salary_advance:'fa-hand-holding-usd', rent:'fa-home', electricity:'fa-bolt', water:'fa-tint', maintenance:'fa-tools', other:'fa-box' };
      el.innerHTML = `
        <div class="stats-grid" style="margin-bottom:16px">
          <div class="stat-card" style="border:2px solid var(--danger)">
            <div class="stat-icon red"><i class="fas fa-receipt"></i></div>
            <div class="stat-info"><div class="stat-label" style="font-weight:700">Total Expenses</div><div class="stat-value" style="color:var(--danger)">${fmtRaw(totalUSD,'USD')}</div></div>
          </div>
          ${this._card('fa-list','gray','Categories',Object.keys(byType).length)}
          ${this._card('fa-file-alt','gray','Records',rows.length)}
        </div>
        <div class="stats-grid">
          ${Object.entries(byType).map(([type,amt]) =>
            this._card(typeIcons[type]||'fa-box', typeColors[type]||'gray', type.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase()), fmtRaw(amt,'USD'))
          ).join('')}
        </div>`;
      return;
    }

    const badge = `<span class="badge badge-danger">${fmtRaw(totalUSD,'USD')}</span>`;
    el.innerHTML = this._wrap('Expenses', rows.length, badge,
      rows.length ? `<table>
        <thead><tr><th>Date</th><th>Type</th><th>Title</th><th>Employee</th><th>Month</th><th>Amount</th><th>Paid To</th><th>Method</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td>${fmtDate(r.expense_date)}</td>
          <td><span class="badge badge-orange" style="white-space:nowrap">${escHtml(r.expense_type.replace('_',' '))}</span></td>
          <td><strong>${escHtml(r.title)}</strong></td>
          <td>${escHtml(r.employee_name || '—')}</td>
          <td class="text-muted">${r.salary_month ? escHtml(r.salary_month) : '—'}</td>
          <td class="fw-bold text-danger">${fmtRaw(r.amount, r.currency)}</td>
          <td>${escHtml(r.paid_to || '—')}</td>
          <td>${escHtml(r.payment_method || '—')}</td>
        </tr>`).join('')}
        </tbody>
        <tfoot><tr style="background:#fef2f2">
          <td colspan="5" style="text-align:right;padding:12px 16px;font-weight:700">Total</td>
          <td style="padding:12px 16px;font-weight:700;color:var(--danger)">${fmtRaw(totalUSD,'USD')}</td>
          <td colspan="2"></td>
        </tr></tfoot>
      </table>` : this._empty('fa-receipt', 'No expenses')
    );
  },

  // ── Salary Report (always summary-style) ───────────────────
  async renderSalary(from, el) {
    const month = (from || today()).slice(0, 7);
    const rows  = await API.get(`/reports/salary?month=${month}`);
    this._exportData = rows;
    const totalPayroll  = rows.filter(r => r.status==='active').reduce((s,r) => s+(Number(r.monthly_salary)||0),0);
    const totalAdvances = rows.reduce((s,r) => s+(r.total_advances||0),0);
    const totalPaid     = rows.reduce((s,r) => s+(r.salary_paid||0),0);
    const totalRemain   = rows.reduce((s,r) => s+(r.remaining||0),0);

    el.innerHTML = `
      <div class="stats-grid" style="margin-bottom:16px">
        ${this._card('fa-money-bill-wave','purple','Total Payroll',   fmtCurrency(totalPayroll))}
        ${this._card('fa-hand-holding-usd','amber','Total Advances',  fmtCurrency(totalAdvances))}
        ${this._card('fa-check-circle',   'green', 'Salary Paid',     fmtCurrency(totalPaid))}
        ${this._card('fa-clock',          'red',   'Total Remaining', fmtCurrency(totalRemain))}
      </div>
      ${this._wrap(`Salary Report — ${escHtml(month)}`, rows.length, null,
        rows.length ? `<table>
          <thead><tr><th>Employee</th><th>Salary This Month</th><th>Advances</th><th>Paid</th><th>Remaining</th><th>Status</th></tr></thead>
          <tbody>${rows.map(r => {
            const done = r.remaining===0 && (r.salary_paid>0||r.total_advances>0);
            const salCell = r.is_prorated
              ? `${fmtRaw(r.effective_salary,r.currency)} <span style="font-size:10px;font-weight:600;color:var(--primary);background:#eff6ff;padding:2px 5px;border-radius:8px">Prorated</span><br><span style="font-size:10px;color:var(--text-muted)">Full: ${fmtRaw(r.monthly_salary,r.currency)}</span>`
              : fmtRaw(r.monthly_salary, r.currency);
            return `<tr style="${done?'background:#f0fdf4':''}">
              <td><strong>${escHtml(r.name)}</strong></td>
              <td class="fw-bold">${salCell}</td>
              <td style="color:${r.total_advances>0?'var(--warning)':'var(--text-muted)'}">${r.total_advances>0?fmtRaw(r.total_advances,r.currency):'—'}</td>
              <td style="color:${r.salary_paid>0?'var(--success)':'var(--text-muted)'}">${r.salary_paid>0?fmtRaw(r.salary_paid,r.currency):'—'}</td>
              <td class="fw-bold" style="color:${r.remaining>0?'var(--danger)':'var(--success)'}">${r.remaining>0?fmtRaw(r.remaining,r.currency):'✓ Paid'}</td>
              <td>${statusBadge(r.status)}</td>
            </tr>`;
          }).join('')}
          </tbody>
          <tfoot><tr style="background:var(--bg)">
            <td style="text-align:right;padding:12px 16px;font-weight:700">Totals</td>
            <td class="fw-bold">${fmtCurrency(totalPayroll)}</td>
            <td style="color:var(--warning);font-weight:700">${totalAdvances>0?fmtCurrency(totalAdvances):'—'}</td>
            <td style="color:var(--success);font-weight:700">${totalPaid>0?fmtCurrency(totalPaid):'—'}</td>
            <td style="color:var(--danger);font-weight:700">${totalRemain>0?fmtCurrency(totalRemain):'✓'}</td>
            <td></td>
          </tr></tfoot>
        </table>` : this._empty('fa-user-tie','No employees found')
      )}`;
  },

  // ── Unpaid Invoices ────────────────────────────────────────
  async renderUnpaidInvoices(el) {
    const rows  = await API.get('/reports/unpaid-invoices');
    this._exportData = rows;
    const totalUSD = sumConverted(rows, 'USD', 'final_amount', 'currency');

    if (this._viewMode === 'summary') {
      const overdue = rows.filter(r => r.due_date && r.due_date < today()).length;
      el.innerHTML = `<div class="stats-grid">
        ${this._card('fa-file-invoice','amber', 'Unpaid Invoices',  rows.length)}
        ${this._card('fa-dollar-sign','red',    'Total Outstanding',fmtRaw(totalUSD,'USD'),'USD equivalent')}
        ${this._card('fa-exclamation-triangle','red','Overdue',     overdue, 'Past due date')}
      </div>`;
      return;
    }

    const badge = rows.length ? `<span class="badge badge-danger">${fmtRaw(totalUSD,'USD')}</span>` : '';
    el.innerHTML = this._wrap('Unpaid Invoices', rows.length, badge,
      rows.length ? `<table>
        <thead><tr><th>Invoice #</th><th>Client</th><th>Mobile</th><th>Plate</th><th>Month</th><th>Amount</th><th>Due</th><th>Status</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td><strong>${escHtml(r.invoice_number)}</strong></td>
          <td>${escHtml(r.full_name)}</td>
          <td class="text-muted">${escHtml(r.mobile||'—')}</td>
          <td>${escHtml(r.plate_number)}</td>
          <td>${escHtml(r.invoice_month)}</td>
          <td class="fw-bold text-danger">${fmtRaw(r.final_amount, r.currency)}</td>
          <td class="${r.due_date&&r.due_date<today()?'text-danger':''}">${fmtDate(r.due_date)}</td>
          <td>${statusBadge(r.payment_status)}</td>
        </tr>`).join('')}</tbody>
      </table>` : this._empty('fa-check-circle','No unpaid invoices')
    );
  },

  // ── Partial / Remaining ────────────────────────────────────
  async renderPartialInvoices(el) {
    const rows = await API.get('/reports/partial-invoices');
    this._exportData = rows;
    const totalRemaining = rows.reduce((s,r) => s+(r.remaining||0),0);

    if (this._viewMode === 'summary') {
      const totalInv  = rows.reduce((s,r) => s+(r.invoice_total||0),0);
      const totalPaid = rows.reduce((s,r) => s+(r.paid_amount||0),0);
      el.innerHTML = `<div class="stats-grid">
        ${this._card('fa-file-invoice','blue',  'Open Invoices',   rows.length)}
        ${this._card('fa-dollar-sign','gray',   'Total Invoiced',  fmtCurrency(totalInv))}
        ${this._card('fa-check-circle','green', 'Total Paid',      fmtCurrency(totalPaid))}
        ${this._card('fa-hourglass-half','red', 'Total Remaining', fmtCurrency(totalRemaining))}
      </div>`;
      return;
    }

    const badge = `<span class="badge badge-danger">Remaining: ${fmtCurrency(totalRemaining)}</span>`;
    el.innerHTML = this._wrap('Partial / Remaining', rows.length, badge,
      rows.length ? `<table>
        <thead><tr><th>Client</th><th>Mobile</th><th>Plate</th><th>Invoice #</th><th>Month</th><th>Due</th><th>Invoice Total</th><th>Paid</th><th>Remaining</th><th>Status</th></tr></thead>
        <tbody>${rows.map(r => {
          const ov = r.due_date && r.due_date < today();
          return `<tr>
            <td><strong>${escHtml(r.full_name||'—')}</strong></td>
            <td class="text-muted">${escHtml(r.mobile||'—')}</td>
            <td>${escHtml(r.plate_number||'—')}</td>
            <td><span class="badge badge-gray">${escHtml(r.invoice_number||'—')}</span></td>
            <td class="text-muted">${escHtml(r.invoice_month||'—')}</td>
            <td class="${ov?'text-danger':''}">${fmtDate(r.due_date)}</td>
            <td>${fmtRaw(r.invoice_total,r.currency)}</td>
            <td class="text-success">${r.paid_amount>0?fmtRaw(r.paid_amount,r.currency):'<span class="text-muted">—</span>'}</td>
            <td class="fw-bold text-danger">${fmtRaw(r.remaining,r.currency)}</td>
            <td>${statusBadge(r.payment_status)}</td>
          </tr>`;
        }).join('')}
        </tbody>
        <tfoot><tr style="background:var(--bg)">
          <td colspan="8" style="text-align:right;padding:12px 16px;font-weight:700">Total Remaining</td>
          <td style="padding:12px 16px;font-weight:700;color:var(--danger)">${fmtCurrency(totalRemaining)}</td>
          <td></td>
        </tr></tfoot>
      </table>` : this._empty('fa-check-circle','All invoices fully paid')
    );
  },

  // ── Active Clients ─────────────────────────────────────────
  async renderActiveClients(el) {
    const rows = await API.get('/reports/active-clients');
    this._exportData = rows;

    if (this._viewMode === 'summary') {
      const totalRevUSD = sumConverted(rows, 'USD', 'amount', 'currency');
      const byType = {};
      rows.forEach(r => { byType[r.vehicle_type] = (byType[r.vehicle_type]||0)+1; });
      el.innerHTML = `<div class="stats-grid">
        ${this._card('fa-users','blue',   'Active Subscribers', rows.length)}
        ${this._card('fa-dollar-sign','green','Monthly Revenue', fmtRaw(totalRevUSD,'USD'),'USD equivalent')}
        ${Object.entries(byType).map(([t,c]) => this._card('fa-car','cyan',t.charAt(0).toUpperCase()+t.slice(1),c)).join('')}
      </div>`;
      return;
    }

    el.innerHTML = this._wrap('Active Clients', rows.length, null,
      rows.length ? `<table>
        <thead><tr><th>Name</th><th>Mobile</th><th>Plate</th><th>Vehicle</th><th>Plan</th><th>End Date</th><th>Amount</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td><strong>${escHtml(r.full_name)}</strong></td>
          <td class="text-muted">${escHtml(r.mobile||'—')}</td>
          <td>${escHtml(r.plate_number)}</td>
          <td>${vehicleBadge(r.vehicle_type)}</td>
          <td>${escHtml(r.plan_name||'—')}</td>
          <td>${fmtDate(r.end_date)}</td>
          <td class="fw-bold">${fmtRaw(r.amount,r.currency)}</td>
        </tr>`).join('')}</tbody>
      </table>` : this._empty('fa-users','No active clients')
    );
  },

  // ── Expired Subscriptions ──────────────────────────────────
  async renderExpiredSubs(el) {
    const rows = await API.get('/reports/expired-subscriptions');
    this._exportData = rows;

    if (this._viewMode === 'summary') {
      el.innerHTML = `<div class="stats-grid">
        ${this._card('fa-clock','red',   'Expired Subscriptions', rows.length)}
        ${this._card('fa-calendar-times','amber','Most Recent',   rows[0]?fmtDate(rows[0].end_date):'—')}
      </div>`;
      return;
    }

    el.innerHTML = this._wrap('Expired Subscriptions', rows.length, null,
      rows.length ? `<table>
        <thead><tr><th>Name</th><th>Mobile</th><th>Plate</th><th>Vehicle</th><th>Plan</th><th>Expired On</th><th>Amount</th></tr></thead>
        <tbody>${rows.map(r => `<tr class="row-expired">
          <td><strong>${escHtml(r.full_name)}</strong></td>
          <td class="text-muted">${escHtml(r.mobile||'—')}</td>
          <td>${escHtml(r.plate_number)}</td>
          <td>${vehicleBadge(r.vehicle_type)}</td>
          <td>${escHtml(r.plan_name||'—')}</td>
          <td class="text-danger">${fmtDate(r.end_date)}</td>
          <td>${fmtRaw(r.amount,r.currency)}</td>
        </tr>`).join('')}</tbody>
      </table>` : this._empty('fa-clock','No expired subscriptions')
    );
  },

  // ── Export ─────────────────────────────────────────────────
  exportData() {
    if (!this._exportData?.length) { Toast.warning('No data to export'); return; }
    exportCSV(this._exportData, `report-${this.currentReport}-${today()}.csv`);
  }
};

Router.register('reports', ReportsPage);
