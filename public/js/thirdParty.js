// ============================================================
//  THIRD PARTY PAGE
// ============================================================
const ThirdPartyPage = {
  title: 'Third Party',
  data: [],
  settings: {},

  async render() {
    this.settings = await API.get('/settings');
    return `
      <div class="page-header">
        <div class="page-title"><h2>Third Party</h2><p>Monthly billing per company</p></div>
        <div class="page-actions" style="flex-wrap:wrap;gap:8px">
          <input type="text" id="tp-search" class="search-input" placeholder="Search for vehicle…" style="height:38px">
          <label style="font-size:13px;color:var(--text-muted);white-space:nowrap;line-height:38px">From</label>
          <input type="date" id="tp-from" value="${new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10)}" style="padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;height:38px">
          <label style="font-size:13px;color:var(--text-muted);white-space:nowrap;line-height:38px">To</label>
          <input type="date" id="tp-to" value="${today()}" style="padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;height:38px">
        </div>
      </div>
      <div id="tp-content"><div class="loading"><div class="spinner"></div> Loading…</div></div>`;
  },

  async init() {
    this.loadData();
    document.getElementById('tp-search').addEventListener('input', () => this.loadData());
    document.getElementById('tp-from').addEventListener('change', () => this.loadData());
    document.getElementById('tp-to').addEventListener('change',   () => this.loadData());
  },

  _getCompanies() {
    try {
      const parsed = JSON.parse(this.settings.custom_rates || '{}');
      return Array.isArray(parsed.__thirdParties) ? parsed.__thirdParties : [];
    } catch { return []; }
  },

  async loadData() {
    const from = document.getElementById('tp-from')?.value || (currentMonth() + '-01');
    const to   = document.getElementById('tp-to')?.value   || today();
    try {
      const search = document.getElementById('tp-search')?.value;
      const params = new URLSearchParams({ date_from: from, date_to: to, is_third_party: 'true' });
      if (search) params.set('search', search);
      this.data = await API.get(`/daily-parking?${params}`);
      this.renderContent(from, to);
    } catch (e) {
      document.getElementById('tp-content').innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h4>${escHtml(e.message)}</h4></div>`;
    }
  },

  renderContent(from, to) {
    const companies = this._getCompanies();
    if (!companies.length) {
      document.getElementById('tp-content').innerHTML = `<div class="empty-state"><i class="fas fa-building"></i><h4>No third party companies configured</h4><p>Go to Users &amp; Settings to add companies.</p></div>`;
      return;
    }

    const html = companies.map(company => {
      const rows  = this.data.filter(r => r.third_party_company === company.name);
      const rate  = Number(company.rate);
      const total = rows.length * rate;

      const plateSet    = new Set(rows.map(r => (r.plate_number || '').trim().toUpperCase()));
      const uniquePlates = plateSet.size;
      const dupPlates   = rows.length - uniquePlates;

      // Track how many times each plate appears to mark duplicates
      const plateCount = {};
      rows.forEach(r => {
        const p = (r.plate_number || '').trim().toUpperCase();
        plateCount[p] = (plateCount[p] || 0) + 1;
      });

      return `<div class="card" style="margin-bottom:16px">
        <div class="card-header">
          <span class="card-title"><i class="fas fa-building" style="color:var(--primary);margin-right:8px"></i>${escHtml(company.name)}</span>
          ${rows.length ? `<button class="btn btn-sm btn-outline" onclick="ThirdPartyPage.printInvoice('${escHtml(company.name)}')"><i class="fas fa-print"></i> Print Invoice</button>` : ''}
        </div>
        <div class="card-body">
          <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:${rows.length ? '20px' : '0'}">
            <div class="stat-card"><div class="stat-icon blue"><i class="fas fa-car"></i></div><div class="stat-info"><div class="stat-label">Unique Vehicles</div><div class="stat-value">${uniquePlates}</div></div></div>
            <div class="stat-card"><div class="stat-icon amber"><i class="fas fa-copy"></i></div><div class="stat-info"><div class="stat-label">Duplicate Plates</div><div class="stat-value">${dupPlates}</div></div></div>
            <div class="stat-card"><div class="stat-icon purple"><i class="fas fa-calendar-check"></i></div><div class="stat-info"><div class="stat-label">Sessions</div><div class="stat-value">${rows.length}</div></div></div>
            <div class="stat-card"><div class="stat-icon green"><i class="fas ${company.currency === 'LBP' ? 'fa-money-bill-wave' : 'fa-dollar-sign'}"></i></div><div class="stat-info"><div class="stat-label">Amount Due (${company.currency === 'LBP' ? 'LL' : '$'})</div><div class="stat-value" style="font-size:16px;word-break:break-word">${fmtRaw(total, company.currency)}</div></div></div>
          </div>
          ${rows.length ? `<table>
            <thead><tr><th>#</th><th>Plate</th><th>Vehicle</th><th>Entry Time</th><th>Rate / Entry</th><th>Amount</th></tr></thead>
            <tbody>${rows.map((r, i) => {
              const plate = (r.plate_number || '').trim().toUpperCase();
              const isDup = plateCount[plate] > 1;
              return `<tr${isDup ? ' style="background:var(--bg-alt,#f8fafc)"' : ''}>
                <td>${i + 1}</td>
                <td><strong>${escHtml(plate)}</strong>${isDup ? ' <span class="badge badge-warning" style="font-size:10px">dup</span>' : ''}</td>
                <td>${vehicleBadge(r.vehicle_type)}</td>
                <td class="text-muted">${fmtDateTime(r.entry_time)}</td>
                <td>${fmtRaw(rate, company.currency)}</td>
                <td class="fw-bold">${fmtRaw(rate, company.currency)}</td>
              </tr>`;
            }).join('')}</tbody>
            <tfoot><tr style="background:var(--bg)">
              <td colspan="5" style="text-align:right;padding:12px 16px;font-weight:700">${uniquePlates} unique plate${uniquePlates !== 1 ? 's' : ''}${dupPlates ? ` · ${dupPlates} duplicate${dupPlates !== 1 ? 's' : ''}` : ''} · ${rows.length} session${rows.length !== 1 ? 's' : ''}</td>
              <td style="padding:12px 16px;font-weight:700">${fmtRaw(total, company.currency)}</td>
            </tr></tfoot>
          </table>` : `<div class="empty-state" style="padding:20px"><i class="fas fa-car"></i><p>No vehicles for this company this month.</p></div>`}
        </div>
      </div>`;
    }).join('');

    document.getElementById('tp-content').innerHTML = html;
  },

  printInvoice(companyName) {
    const company = this._getCompanies().find(c => c.name === companyName);
    if (!company) return;
    const from   = document.getElementById('tp-from')?.value || (currentMonth() + '-01');
    const to     = document.getElementById('tp-to')?.value   || today();
    const period = `${from} → ${to}`;
    const rate   = Number(company.rate);
    const fmt    = n => new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(n) || 0);

    const rows         = this.data.filter(r => r.third_party_company === company.name);
    const uniquePlates = new Set(rows.map(r => (r.plate_number || '').trim().toUpperCase())).size;
    const dupPlates    = rows.length - uniquePlates;
    const total        = rows.length * rate;
    const plateCount   = {};
    rows.forEach(r => { const p = (r.plate_number||'').trim().toUpperCase(); plateCount[p] = (plateCount[p]||0)+1; });

    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head>
      <title>Invoice — ${escHtml(company.name)} — ${period}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; padding: 40px; color: #111; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 3px solid #1e3a5f; padding-bottom: 20px; }
        h1 { font-size: 36px; color: #1e3a5f; }
        h2 { font-size: 22px; color: #1e3a5f; }
        p { margin-top: 6px; color: #555; font-size: 14px; }
        .summary { display: flex; gap: 24px; margin-bottom: 24px; }
        .sum-box { background: #f5f7fa; border-radius: 8px; padding: 12px 20px; }
        .sum-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .5px; }
        .sum-val { font-size: 20px; font-weight: 800; color: #1e3a5f; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #1e3a5f; color: white; padding: 12px 16px; text-align: left; font-size: 13px; }
        td { padding: 12px 16px; border-bottom: 1px solid #eee; font-size: 14px; }
        tr.dup { background: #fffbeb; }
        tfoot td { background: #f5f7fa; font-weight: bold; font-size: 15px; }
        .total-box { margin-top: 28px; text-align: right; font-size: 20px; color: #1e3a5f; }
        .print-btn { margin-top: 30px; padding: 10px 24px; background: #1e3a5f; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
        @media print { .print-btn { display: none; } }
      </style>
    </head><body>
      <div class="header">
        <div><h1>INVOICE</h1><p>Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p><p>Period: ${period}</p></div>
        <div style="text-align:right"><h2>${escHtml(company.name)}</h2><p>Third Party Monthly Billing</p></div>
      </div>
      <div class="summary">
        <div class="sum-box"><div class="sum-label">Unique Vehicles</div><div class="sum-val">${uniquePlates}</div></div>
        ${dupPlates > 0 ? `<div class="sum-box"><div class="sum-label">Duplicate Plates</div><div class="sum-val">${dupPlates}</div></div>` : ''}
        <div class="sum-box"><div class="sum-label">Total Rows</div><div class="sum-val">${billingRows.length}</div></div>
        <div class="sum-box"><div class="sum-label">Amount Due</div><div class="sum-val">${escHtml(company.currency)} ${fmt(total)}</div></div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Plate Number</th><th>Vehicle Type</th><th>Entry Time</th><th>Rate / Entry</th><th>Amount</th></tr></thead>
        <tbody>${rows.map((r, i) => {
          const plate = (r.plate_number || '').trim().toUpperCase();
          const isDup = plateCount[plate] > 1;
          return `<tr${isDup ? ' class="dup"' : ''}>
            <td>${i + 1}</td>
            <td><strong>${escHtml(plate)}</strong></td>
            <td>${escHtml(r.vehicle_type || '—')}</td>
            <td>${r.entry_time ? new Date(r.entry_time).toLocaleString('en-US', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'}</td>
            <td>${escHtml(company.currency)} ${fmt(rate)}</td>
            <td><strong>${escHtml(company.currency)} ${fmt(rate)}</strong></td>
          </tr>`;
        }).join('')}</tbody>
        <tfoot><tr>
          <td colspan="5" style="text-align:right">${uniquePlates} unique plate${uniquePlates !== 1 ? 's' : ''}${dupPlates ? ` · ${dupPlates} dup` : ''} · ${rows.length} session${rows.length !== 1 ? 's' : ''}</td>
          <td>${escHtml(company.currency)} ${fmt(total)}</td>
        </tr></tfoot>
      </table>
      <div class="total-box">Amount Due: <strong>${escHtml(company.currency)} ${fmt(total)}</strong></div>
      <br><button class="print-btn" onclick="window.print()">Print Invoice</button>
    </body></html>`);
    w.document.close();
  }
};

Router.register('third-party', ThirdPartyPage);
