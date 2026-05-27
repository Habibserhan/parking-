// ============================================================
//  REPORTS PAGE
// ============================================================
const ReportsPage = {
  title: 'Reports',
  currentReport: 'revenue',

  async render() {
    return `
      <div class="page-header">
        <div class="page-title"><h2>Reports</h2><p>Business analytics and data export</p></div>
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="card-body">
          <div class="d-flex flex-wrap gap-2">
            ${[
              ['revenue',    'fas fa-chart-line', 'Revenue Summary'],
              ['parking',    'fas fa-car',         'Daily Parking'],
              ['services',   'fas fa-shower',      'Services'],
              ['expenses',   'fas fa-receipt',     'Expenses'],
              ['invoices',   'fas fa-file-invoice','Unpaid Invoices'],
              ['clients',    'fas fa-users',       'Active Clients'],
              ['expired',    'fas fa-clock',       'Expired Subscriptions'],
            ].map(([key, icon, label]) =>
              `<button class="btn ${this.currentReport===key?'btn-primary':'btn-outline'}" onclick="ReportsPage.switchReport('${key}')"><i class="${icon}"></i> ${label}</button>`
            ).join('')}
          </div>
        </div>
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="card-body">
          <div class="filters-bar">
            <div>
              <label style="font-size:12px;font-weight:500">From:</label>
              <input type="date" id="rpt-from" value="${new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)}">
            </div>
            <div>
              <label style="font-size:12px;font-weight:500">To:</label>
              <input type="date" id="rpt-to" value="${today()}">
            </div>
            <button class="btn btn-primary" onclick="ReportsPage.loadReport()"><i class="fas fa-search"></i> Run Report</button>
            <button class="btn btn-outline" onclick="ReportsPage.exportData()"><i class="fas fa-download"></i> Export CSV</button>
            <button class="btn btn-outline" onclick="window.print()"><i class="fas fa-print"></i> Print</button>
          </div>
        </div>
      </div>
      <div id="report-content"><div class="loading"><div class="spinner"></div> Loading…</div></div>`;
  },

  init() {
    this.loadReport();
  },

  switchReport(key) {
    this.currentReport = key;
    Router.navigate('reports');
  },

  async loadReport() {
    const from = document.getElementById('rpt-from')?.value;
    const to   = document.getElementById('rpt-to')?.value;
    const el   = document.getElementById('report-content');
    el.innerHTML = '<div class="loading"><div class="spinner"></div> Loading…</div>';

    try {
      switch (this.currentReport) {
        case 'revenue':  await this.renderRevenue(from, to, el); break;
        case 'parking':  await this.renderParking(from, to, el); break;
        case 'services': await this.renderServices(from, to, el); break;
        case 'expenses': await this.renderExpenses(from, to, el); break;
        case 'invoices': await this.renderUnpaidInvoices(el); break;
        case 'clients':  await this.renderActiveClients(el); break;
        case 'expired':  await this.renderExpiredSubs(el); break;
      }
    } catch (e) { el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h4>Error</h4><p>${escHtml(e.message)}</p></div>`; }
  },

  async renderRevenue(from, to, el) {
    const d = await API.get(`/reports/revenue?date_from=${from}&date_to=${to}`);
    this._exportData = [{ Subscriptions: d.subscriptions, Parking: d.parking, Services: d.services, Total: d.total, Expenses: d.expenses, Profit: d.profit }];
    el.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon blue"><i class="fas fa-file-invoice"></i></div><div class="stat-info"><div class="stat-label">Subscription Revenue</div><div class="stat-value">${fmtCurrency(d.subscriptions)}</div></div></div>
        <div class="stat-card"><div class="stat-icon cyan"><i class="fas fa-car"></i></div><div class="stat-info"><div class="stat-label">Parking Revenue</div><div class="stat-value">${fmtCurrency(d.parking)}</div></div></div>
        <div class="stat-card"><div class="stat-icon purple"><i class="fas fa-shower"></i></div><div class="stat-info"><div class="stat-label">Services Revenue</div><div class="stat-value">${fmtCurrency(d.services)}</div></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="fas fa-dollar-sign"></i></div><div class="stat-info"><div class="stat-label">Total Revenue</div><div class="stat-value">${fmtCurrency(d.total)}</div></div></div>
        <div class="stat-card"><div class="stat-icon red"><i class="fas fa-receipt"></i></div><div class="stat-info"><div class="stat-label">Total Expenses</div><div class="stat-value">${fmtCurrency(d.expenses)}</div></div></div>
        <div class="stat-card"><div class="stat-icon ${d.profit>=0?'green':'red'}"><i class="fas fa-chart-line"></i></div><div class="stat-info"><div class="stat-label">Net Profit</div><div class="stat-value">${fmtCurrency(d.profit)}</div></div></div>
      </div>`;
  },

  async renderParking(from, to, el) {
    const rows = await API.get(`/reports/daily-parking?date_from=${from}&date_to=${to}`);
    this._exportData = rows;
    const total = rows.filter(r => r.payment_status === 'paid').reduce((s, r) => s + r.amount, 0);
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Daily Parking Report (${rows.length} records)</span>
          <span class="badge badge-success">Paid Total: ${fmtCurrency(total)}</span>
        </div>
        <div class="table-wrap">${this._parkingTable(rows)}</div>
      </div>`;
  },

  _parkingTable(rows) {
    if (!rows.length) return '<div class="empty-state" style="padding:30px"><i class="fas fa-car"></i><h4>No records</h4></div>';
    return `<table>
      <thead><tr><th>Plate</th><th>Vehicle</th><th>Entry</th><th>Exit</th><th>Duration</th><th>Amount</th><th>Payment</th><th>Status</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td><strong>${escHtml(r.plate_number)}</strong></td>
        <td>${vehicleBadge(r.vehicle_type)}</td>
        <td>${fmtDateTime(r.entry_time)}</td>
        <td>${r.exit_time ? fmtDateTime(r.exit_time) : '—'}</td>
        <td>${fmtDuration(r.duration_minutes)}</td>
        <td class="fw-bold">${fmtRaw(r.amount, r.currency)}</td>
        <td>${statusBadge(r.payment_status)}</td>
        <td>${statusBadge(r.parking_status)}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  },

  async renderServices(from, to, el) {
    const rows = await API.get(`/reports/services?date_from=${from}&date_to=${to}`);
    this._exportData = rows;
    const total = rows.filter(r => r.payment_status === 'paid').reduce((s, r) => s + r.final_amount, 0);
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Services Report (${rows.length} records)</span>
          <span class="badge badge-success">Total: ${fmtCurrency(total)}</span>
        </div>
        <div class="table-wrap">
          ${rows.length ? `<table>
            <thead><tr><th>Date</th><th>Service</th><th>Client</th><th>Plate</th><th>Price</th><th>Discount</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>${rows.map(r => `<tr>
              <td>${fmtDate(r.service_date)}</td>
              <td>${escHtml(r.service_name || '—')}</td>
              <td>${escHtml(r.client_name || '—')}</td>
              <td>${escHtml(r.plate_number || '—')}</td>
              <td>${fmtCurrency(r.price)}</td>
              <td>${r.discount > 0 ? fmtCurrency(r.discount) : '—'}</td>
              <td class="fw-bold">${fmtRaw(r.final_amount, r.currency)}</td>
              <td>${statusBadge(r.payment_status)}</td>
            </tr>`).join('')}</tbody>
          </table>` : '<div class="empty-state" style="padding:30px"><i class="fas fa-shower"></i><h4>No records</h4></div>'}
        </div>
      </div>`;
  },

  async renderExpenses(from, to, el) {
    const rows = await API.get(`/reports/expenses?date_from=${from}&date_to=${to}`);
    this._exportData = rows;
    const total = rows.reduce((s, r) => s + r.amount, 0);
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Expenses Report (${rows.length} records)</span>
          <span class="badge badge-danger">Total: ${fmtCurrency(total)}</span>
        </div>
        <div class="table-wrap">
          ${rows.length ? `<table>
            <thead><tr><th>Date</th><th>Type</th><th>Title</th><th>Amount</th><th>Paid To</th><th>Method</th></tr></thead>
            <tbody>${rows.map(r => `<tr>
              <td>${fmtDate(r.expense_date)}</td>
              <td><span class="badge badge-orange">${escHtml(r.expense_type)}</span></td>
              <td>${escHtml(r.title)}</td>
              <td class="fw-bold text-danger">${fmtRaw(r.amount, r.currency)}</td>
              <td>${escHtml(r.paid_to || '—')}</td>
              <td>${escHtml(r.payment_method || '—')}</td>
            </tr>`).join('')}</tbody>
          </table>` : '<div class="empty-state" style="padding:30px"><i class="fas fa-receipt"></i><h4>No records</h4></div>'}
        </div>
      </div>`;
  },

  async renderUnpaidInvoices(el) {
    const rows = await API.get('/reports/unpaid-invoices');
    this._exportData = rows;
    const total = rows.reduce((s, r) => s + r.final_amount, 0);
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Unpaid Invoices (${rows.length})</span>
          <span class="badge badge-danger">Total: ${fmtCurrency(total)}</span>
        </div>
        <div class="table-wrap">
          ${rows.length ? `<table>
            <thead><tr><th>Invoice #</th><th>Client</th><th>Mobile</th><th>Plate</th><th>Month</th><th>Amount</th><th>Due</th><th>Status</th></tr></thead>
            <tbody>${rows.map(r => `<tr>
              <td><strong>${escHtml(r.invoice_number)}</strong></td>
              <td>${escHtml(r.full_name)}</td>
              <td>${escHtml(r.mobile || '—')}</td>
              <td>${escHtml(r.plate_number)}</td>
              <td>${escHtml(r.invoice_month)}</td>
              <td class="fw-bold text-danger">${fmtRaw(r.final_amount, r.currency)}</td>
              <td>${r.due_date && r.due_date < today() ? `<span class="text-danger">${fmtDate(r.due_date)}</span>` : fmtDate(r.due_date)}</td>
              <td>${statusBadge(r.payment_status)}</td>
            </tr>`).join('')}</tbody>
          </table>` : '<div class="empty-state" style="padding:30px"><i class="fas fa-check-circle"></i><h4>No unpaid invoices</h4></div>'}
        </div>
      </div>`;
  },

  async renderActiveClients(el) {
    const rows = await API.get('/reports/active-clients');
    this._exportData = rows;
    el.innerHTML = `
      <div class="card">
        <div class="card-header"><span class="card-title">Active Subscription Clients (${rows.length})</span></div>
        <div class="table-wrap">
          ${rows.length ? `<table>
            <thead><tr><th>Name</th><th>Mobile</th><th>Plate</th><th>Vehicle</th><th>Plan</th><th>End Date</th><th>Amount</th></tr></thead>
            <tbody>${rows.map(r => `<tr>
              <td>${escHtml(r.full_name)}</td>
              <td>${escHtml(r.mobile || '—')}</td>
              <td><strong>${escHtml(r.plate_number)}</strong></td>
              <td>${vehicleBadge(r.vehicle_type)}</td>
              <td>${escHtml(r.plan_name || '—')}</td>
              <td>${fmtDate(r.end_date)}</td>
              <td>${fmtRaw(r.amount, r.currency)}</td>
            </tr>`).join('')}</tbody>
          </table>` : '<div class="empty-state" style="padding:30px"><i class="fas fa-users"></i><h4>No active clients</h4></div>'}
        </div>
      </div>`;
  },

  async renderExpiredSubs(el) {
    const rows = await API.get('/reports/expired-subscriptions');
    this._exportData = rows;
    el.innerHTML = `
      <div class="card">
        <div class="card-header"><span class="card-title">Expired Subscriptions (${rows.length})</span></div>
        <div class="table-wrap">
          ${rows.length ? `<table>
            <thead><tr><th>Name</th><th>Mobile</th><th>Plate</th><th>Vehicle</th><th>Plan</th><th>Expired On</th><th>Amount</th></tr></thead>
            <tbody>${rows.map(r => `<tr class="row-expired">
              <td>${escHtml(r.full_name)}</td>
              <td>${escHtml(r.mobile || '—')}</td>
              <td><strong>${escHtml(r.plate_number)}</strong></td>
              <td>${vehicleBadge(r.vehicle_type)}</td>
              <td>${escHtml(r.plan_name || '—')}</td>
              <td class="text-danger">${fmtDate(r.end_date)}</td>
              <td>${fmtRaw(r.amount, r.currency)}</td>
            </tr>`).join('')}</tbody>
          </table>` : '<div class="empty-state" style="padding:30px"><i class="fas fa-clock"></i><h4>No expired subscriptions</h4></div>'}
        </div>
      </div>`;
  },

  exportData() {
    if (!this._exportData || !this._exportData.length) { Toast.warning('No data to export'); return; }
    exportCSV(this._exportData, `report-${this.currentReport}-${today()}.csv`);
  }
};

Router.register('reports', ReportsPage);
