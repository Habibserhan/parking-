// ============================================================
//  THIRD PARTY PAGE
// ============================================================
const ThirdPartyPage = {
  title: 'Third Party',
  data: [],
  clients: [],
  settings: {},

  async render() {
    this.settings = await API.get('/settings');
    return `
      <div class="page-header">
        <div class="page-title"><h2>Third Party</h2><p>Monthly billing per company</p></div>
        <div class="page-actions">
          <input type="month" id="tp-month" value="${currentMonth()}">
          <button class="btn btn-primary" onclick="ThirdPartyPage.loadData()"><i class="fas fa-search"></i> Load</button>
        </div>
      </div>
      <div id="tp-content"><div class="loading"><div class="spinner"></div> Loading…</div></div>`;
  },

  async init() { this.loadData(); },

  _getCompanies() {
    try {
      const parsed = JSON.parse(this.settings.custom_rates || '{}');
      return Array.isArray(parsed.__thirdParties) ? parsed.__thirdParties : [];
    } catch { return []; }
  },

  async loadData() {
    const month = document.getElementById('tp-month')?.value || currentMonth();
    const [year, mon] = month.split('-');
    const lastDay = new Date(Number(year), Number(mon), 0).getDate();
    const from = `${year}-${mon}-01`;
    const to = `${year}-${mon}-${String(lastDay).padStart(2, '0')}`;
    try {
      const params = new URLSearchParams({ date_from: from, date_to: to, is_third_party: 'true' });
      [this.data, this.clients] = await Promise.all([
        API.get(`/daily-parking?${params}`),
        API.get('/clients')
      ]);
      this.renderContent(month);
    } catch (e) {
      document.getElementById('tp-content').innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h4>${escHtml(e.message)}</h4></div>`;
    }
  },

  renderContent(month) {
    const companies = this._getCompanies();
    if (!companies.length) {
      document.getElementById('tp-content').innerHTML = `<div class="empty-state"><i class="fas fa-building"></i><h4>No third party companies configured</h4><p>Go to Users &amp; Settings to add companies.</p></div>`;
      return;
    }

    const html = companies.map(company => {
      // --- Daily parking unique vehicles ---
      const dpRows = this.data.filter(r => r.third_party_company === company.name);
      const vehicleMap = {};
      dpRows.forEach(r => {
        if (!vehicleMap[r.plate_number]) vehicleMap[r.plate_number] = { plate: r.plate_number, type: r.vehicle_type, sessions: 0 };
        vehicleMap[r.plate_number].sessions++;
      });
      const dpVehicles = Object.values(vehicleMap);

      // --- Subscription clients ---
      const subClients = this.clients.filter(c => c.third_party_company === company.name);

      const rate = Number(company.rate);
      const dpTotal  = dpVehicles.length * rate;
      const subTotal = subClients.length * rate;
      const grandTotal = dpTotal + subTotal;
      const hasAny = dpVehicles.length > 0 || subClients.length > 0;

      return `<div class="card" style="margin-bottom:16px">
        <div class="card-header">
          <span class="card-title"><i class="fas fa-building" style="color:var(--primary);margin-right:8px"></i>${escHtml(company.name)}</span>
          ${hasAny ? `<button class="btn btn-sm btn-outline" onclick="ThirdPartyPage.printInvoice('${escHtml(company.name)}')"><i class="fas fa-print"></i> Print Invoice</button>` : ''}
        </div>
        <div class="card-body">
          <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
            <div class="stat-card"><div class="stat-icon blue"><i class="fas fa-car"></i></div><div class="stat-info"><div class="stat-label">Daily Parking</div><div class="stat-value">${dpVehicles.length}</div></div></div>
            <div class="stat-card"><div class="stat-icon purple"><i class="fas fa-id-card"></i></div><div class="stat-info"><div class="stat-label">Subscriptions</div><div class="stat-value">${subClients.length}</div></div></div>
            <div class="stat-card"><div class="stat-icon orange"><i class="fas fa-users"></i></div><div class="stat-info"><div class="stat-label">Total Billable</div><div class="stat-value">${dpVehicles.length + subClients.length}</div></div></div>
            <div class="stat-card"><div class="stat-icon green"><i class="fas fa-dollar-sign"></i></div><div class="stat-info"><div class="stat-label">Amount Due</div><div class="stat-value" style="font-size:15px;word-break:break-word">${fmtAmt(grandTotal, company.currency)}</div></div></div>
          </div>

          ${subClients.length ? `
          <h4 style="margin-bottom:10px;font-size:13px;text-transform:uppercase;color:var(--text-muted);letter-spacing:.5px"><i class="fas fa-id-card" style="margin-right:6px"></i>Subscription Clients</h4>
          <table style="margin-bottom:20px">
            <thead><tr><th>#</th><th>Client Name</th><th>Mobile</th><th>Rate / Month</th><th>Amount</th></tr></thead>
            <tbody>${subClients.map((c, i) => `<tr>
              <td>${i + 1}</td>
              <td><strong>${escHtml(c.full_name)}</strong></td>
              <td class="text-muted">${escHtml(c.mobile || '—')}</td>
              <td>${fmtAmt(rate, company.currency)}</td>
              <td class="fw-bold">${fmtAmt(rate, company.currency)}</td>
            </tr>`).join('')}</tbody>
            <tfoot><tr style="background:var(--bg)">
              <td colspan="4" style="text-align:right;padding:12px 16px;font-weight:700">Subtotal — ${subClients.length} client${subClients.length !== 1 ? 's' : ''}</td>
              <td style="padding:12px 16px;font-weight:700">${fmtAmt(subTotal, company.currency)}</td>
            </tr></tfoot>
          </table>` : ''}

          ${dpVehicles.length ? `
          <h4 style="margin-bottom:10px;font-size:13px;text-transform:uppercase;color:var(--text-muted);letter-spacing:.5px"><i class="fas fa-car" style="margin-right:6px"></i>Daily Parking Vehicles</h4>
          <table style="margin-bottom:20px">
            <thead><tr><th>#</th><th>Plate</th><th>Vehicle</th><th>Sessions</th><th>Rate / Month</th><th>Amount</th></tr></thead>
            <tbody>${dpVehicles.map((v, i) => `<tr>
              <td>${i + 1}</td>
              <td><strong>${escHtml(v.plate)}</strong></td>
              <td>${vehicleBadge(v.type)}</td>
              <td class="text-muted">${v.sessions}</td>
              <td>${fmtAmt(rate, company.currency)}</td>
              <td class="fw-bold">${fmtAmt(rate, company.currency)}</td>
            </tr>`).join('')}</tbody>
            <tfoot><tr style="background:var(--bg)">
              <td colspan="5" style="text-align:right;padding:12px 16px;font-weight:700">Subtotal — ${dpVehicles.length} vehicle${dpVehicles.length !== 1 ? 's' : ''}</td>
              <td style="padding:12px 16px;font-weight:700">${fmtAmt(dpTotal, company.currency)}</td>
            </tr></tfoot>
          </table>` : ''}

          ${!hasAny ? `<div class="empty-state" style="padding:20px"><i class="fas fa-building"></i><p>No vehicles or clients for this company this month.</p></div>` : ''}

          ${hasAny ? `<div style="text-align:right;padding:14px 16px;background:var(--bg);border-radius:8px;font-size:16px;font-weight:700">
            Grand Total — ${fmtAmt(grandTotal, company.currency)}
          </div>` : ''}
        </div>
      </div>`;
    }).join('');

    document.getElementById('tp-content').innerHTML = html;
  },

  printInvoice(companyName) {
    const company = this._getCompanies().find(c => c.name === companyName);
    if (!company) return;
    const month = document.getElementById('tp-month')?.value || currentMonth();
    const rate = Number(company.rate);
    const fmt = (n) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(n) || 0);

    // Daily parking unique vehicles
    const vehicleMap = {};
    this.data.filter(r => r.third_party_company === company.name).forEach(r => {
      if (!vehicleMap[r.plate_number]) vehicleMap[r.plate_number] = { plate: r.plate_number, type: r.vehicle_type };
    });
    const dpVehicles = Object.values(vehicleMap);

    // Subscription clients
    const subClients = this.clients.filter(c => c.third_party_company === company.name);

    const dpTotal  = dpVehicles.length * rate;
    const subTotal = subClients.length * rate;
    const grandTotal = dpTotal + subTotal;

    const subSection = subClients.length ? `
      <h3 style="margin-top:32px;margin-bottom:8px;color:#1e3a5f">Subscription Clients</h3>
      <table>
        <thead><tr><th>#</th><th>Client Name</th><th>Mobile</th><th>Monthly Rate</th></tr></thead>
        <tbody>${subClients.map((c, i) => `<tr>
          <td>${i + 1}</td><td><strong>${escHtml(c.full_name)}</strong></td><td>${escHtml(c.mobile || '—')}</td><td>${escHtml(company.currency)} ${fmt(rate)}</td>
        </tr>`).join('')}</tbody>
        <tfoot><tr>
          <td colspan="3" style="text-align:right">Subtotal — ${subClients.length} client${subClients.length !== 1 ? 's' : ''}</td>
          <td>${escHtml(company.currency)} ${fmt(subTotal)}</td>
        </tr></tfoot>
      </table>` : '';

    const dpSection = dpVehicles.length ? `
      <h3 style="margin-top:32px;margin-bottom:8px;color:#1e3a5f">Daily Parking Vehicles</h3>
      <table>
        <thead><tr><th>#</th><th>Plate Number</th><th>Vehicle Type</th><th>Monthly Rate</th></tr></thead>
        <tbody>${dpVehicles.map((v, i) => `<tr>
          <td>${i + 1}</td><td><strong>${escHtml(v.plate)}</strong></td><td>${escHtml(v.type)}</td><td>${escHtml(company.currency)} ${fmt(rate)}</td>
        </tr>`).join('')}</tbody>
        <tfoot><tr>
          <td colspan="3" style="text-align:right">Subtotal — ${dpVehicles.length} vehicle${dpVehicles.length !== 1 ? 's' : ''}</td>
          <td>${escHtml(company.currency)} ${fmt(dpTotal)}</td>
        </tr></tfoot>
      </table>` : '';

    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head>
      <title>Invoice — ${escHtml(company.name)} — ${month}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; padding: 40px; color: #111; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 3px solid #1e3a5f; padding-bottom: 20px; }
        h1 { font-size: 36px; color: #1e3a5f; }
        h2 { font-size: 22px; color: #1e3a5f; }
        h3 { font-size: 16px; }
        p { margin-top: 6px; color: #555; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #1e3a5f; color: white; padding: 12px 16px; text-align: left; font-size: 13px; }
        td { padding: 12px 16px; border-bottom: 1px solid #eee; font-size: 14px; }
        tfoot td { background: #f5f7fa; font-weight: bold; font-size: 15px; }
        .total-box { margin-top: 28px; padding: 16px 20px; background: #f0f4f8; border-left: 4px solid #1e3a5f; text-align: right; font-size: 20px; color: #1e3a5f; }
        .print-btn { margin-top: 30px; padding: 10px 24px; background: #1e3a5f; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
        @media print { .print-btn { display: none; } }
      </style>
    </head><body>
      <div class="header">
        <div><h1>INVOICE</h1><p>Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p><p>Period: ${month}</p></div>
        <div style="text-align:right"><h2>${escHtml(company.name)}</h2><p>Third Party Monthly Billing</p></div>
      </div>
      ${subSection}
      ${dpSection}
      <div class="total-box">Total Amount Due: <strong>${escHtml(company.currency)} ${fmt(grandTotal)}</strong></div>
      <br><button class="print-btn" onclick="window.print()">Print Invoice</button>
    </body></html>`);
    w.document.close();
  }
};

Router.register('third-party', ThirdPartyPage);
