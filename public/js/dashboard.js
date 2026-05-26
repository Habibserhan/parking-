// ============================================================
//  DASHBOARD PAGE
// ============================================================
const DashboardPage = {
  title: 'Dashboard',
  _charts: [],
  _stats: null,
  _currency: 'USD',

  async render() {
    return `
      <div class="page-header">
        <div class="page-title"><h2>Dashboard</h2><p>Parking business overview</p></div>
        <div class="page-actions">
          <div class="month-selector">
            <label>Month:</label>
            <input type="month" id="dash-month" value="${currentMonth()}">
          </div>
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
    document.getElementById('dash-month').addEventListener('change', () => this.loadData());
    this.loadData();
  },

  async loadData() {
    const month = document.getElementById('dash-month').value || currentMonth();
    try {
      const d = await API.get(`/dashboard?month=${month}`);
      this._stats = d.stats;
      this.renderStats(d.stats);
      this.renderCharts(d.charts);
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
    if (this._stats) this._redrawStatCards();
  },

  _getLbpRate() {
    try { const r = JSON.parse(window.appSettings?.custom_rates || '{}'); return r.LBP || 89500; } catch { return 89500; }
  },

  _fmtMoney(value) {
    if (this._currency === 'LBP') {
      const lbp = (Number(value) || 0) * this._getLbpRate();
      return 'LL ' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(lbp);
    }
    return '$ ' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
  },

  renderStats(s) {
    document.getElementById('dash-content').innerHTML = `
      <div class="stats-grid" id="stats-grid">${this._statCards(s)}</div>
      <div class="charts-grid">
        <div class="chart-card"><h4>Subscription Revenue — Last 12 Months</h4><div class="chart-wrap"><canvas id="ch-revenue"></canvas></div></div>
        <div class="chart-card"><h4>Expenses — Last 12 Months</h4><div class="chart-wrap"><canvas id="ch-expenses"></canvas></div></div>
        <div class="chart-card"><h4>Daily Parking Revenue — Last 12 Months</h4><div class="chart-wrap"><canvas id="ch-parking"></canvas></div></div>
        <div class="chart-card"><h4>Services Revenue This Month</h4><div class="chart-wrap"><canvas id="ch-services"></canvas></div></div>
      </div>`;
  },

  _redrawStatCards() {
    const grid = document.getElementById('stats-grid');
    if (grid) grid.innerHTML = this._statCards(this._stats);
  },

  _statCards(s) {
    return `
      ${this._card('fa-dollar-sign',        'blue',   'Total Revenue',        this._fmtMoney(s.totalRevenue),    'Paid invoices + parking + services')}
      ${this._card('fa-file-invoice',       'purple', 'Subscription Revenue', this._fmtMoney(s.subRevenue),      'Paid invoices this month')}
      ${this._card('fa-car',                'cyan',   'Parking Revenue',      this._fmtMoney(s.parkingRevenue),  'Daily parking income')}
      ${this._card('fa-shower',             'info',   'Services Revenue',     this._fmtMoney(s.servicesRevenue), 'Wash & cleaning income')}
      ${this._card('fa-receipt',            'amber',  'Total Expenses',       this._fmtMoney(s.totalExpenses),   'All expenses this month')}
      ${this._card('fa-chart-line', s.netProfit >= 0 ? 'green' : 'red', 'Net Profit', this._fmtMoney(s.netProfit), 'Revenue minus expenses')}
      ${this._card('fa-users',              'blue',   'Active Subscribers',   s.activeClients,   'Active subscription clients')}
      ${this._card('fa-exclamation-circle', 'amber',  'Unpaid Subscribers',   s.unpaidClients,   'Not paid this month')}
      ${this._card('fa-parking',            'cyan',   'Currently Parked',     s.currentlyParked, 'Vehicles in lot now')}`;
  },

  _card(icon, color, label, value, sub) {
    const v = String(value);
    const fs = v.length > 14 ? '13px' : v.length > 11 ? '16px' : v.length > 8 ? '20px' : '24px';
    return `<div class="stat-card">
      <div class="stat-icon ${color}"><i class="fas ${icon}"></i></div>
      <div class="stat-info">
        <div class="stat-label">${escHtml(label)}</div>
        <div class="stat-value" style="font-size:${fs};word-break:break-word;line-height:1.2">${escHtml(v)}</div>
        <div class="stat-sub">${escHtml(sub)}</div>
      </div>
    </div>`;
  },

  renderCharts(charts) {
    this._charts.forEach(c => c.destroy());
    this._charts = [];
    const opts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };

    const mkBar = (id, labels, data, color) => {
      const ctx = document.getElementById(id);
      if (!ctx) return;
      this._charts.push(new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ data, backgroundColor: color + '99', borderColor: color, borderWidth: 2, borderRadius: 6 }] },
        options: { ...opts, scales: { y: { beginAtZero: true } } }
      }));
    };

    mkBar('ch-revenue',  charts.revenueByMonth.map(r => r.month),  charts.revenueByMonth.map(r => r.amount),  '#3b82f6');
    mkBar('ch-expenses', charts.expensesByMonth.map(r => r.month), charts.expensesByMonth.map(r => r.amount), '#ef4444');
    mkBar('ch-parking',  charts.parkingByMonth.map(r => r.month),  charts.parkingByMonth.map(r => r.amount),  '#06b6d4');

    const svcCtx = document.getElementById('ch-services');
    if (svcCtx && charts.servicesByType.length) {
      const colors = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];
      this._charts.push(new Chart(svcCtx, {
        type: 'doughnut',
        data: {
          labels: charts.servicesByType.map(s => s.name),
          datasets: [{ data: charts.servicesByType.map(s => s.amount), backgroundColor: colors, borderWidth: 2 }]
        },
        options: { ...opts, plugins: { legend: { display: true, position: 'bottom', labels: { font: { size: 11 } } } } }
      }));
    } else if (svcCtx) {
      svcCtx.parentElement.innerHTML += '<p class="text-muted text-center" style="font-size:13px;margin-top:16px">No service data this month</p>';
    }
  }
};

Router.register('dashboard', DashboardPage);
