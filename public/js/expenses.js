// ============================================================
//  EXPENSES PAGE
// ============================================================
const ExpensesPage = {
  title: 'Expenses',
  adminOnly: true,
  data: [],

  TYPES: ['salary', 'rent', 'electricity', 'water', 'maintenance', 'other'],

  async render() {
    this.data = await API.get('/expenses');
    const total = this.data.reduce((s, e) => s + e.amount, 0);
    return `
      <div class="page-header">
        <div class="page-title"><h2>Expenses</h2><p>Track business expenses</p></div>
        <div class="page-actions">
          <span class="badge badge-danger" style="font-size:14px;padding:8px 14px">Total: ${fmtCurrency(total)}</span>
          <button class="btn btn-primary" onclick="ExpensesPage.showAdd()"><i class="fas fa-plus"></i> Add Expense</button>
        </div>
      </div>
      <div class="filters-bar">
        <input type="text" class="search-input" id="exp-search" placeholder="Search expenses…">
        <select id="exp-type">
          <option value="">All Types</option>
          ${this.TYPES.map(t => `<option value="${t}">${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('')}
        </select>
        <input type="date" id="exp-from">
        <input type="date" id="exp-to">
        <button class="btn btn-outline" onclick="ExpensesPage.exportReport()"><i class="fas fa-download"></i> Export</button>
      </div>
      <div class="card">
        <div class="table-wrap" id="exp-table">${this.renderTable(this.data)}</div>
      </div>`;
  },

  init() {
    document.getElementById('exp-search').addEventListener('input', () => this.applyFilter());
    document.getElementById('exp-type').addEventListener('change', () => this.applyFilter());
    document.getElementById('exp-from').addEventListener('change', () => this.applyFilter());
    document.getElementById('exp-to').addEventListener('change',   () => this.applyFilter());
  },

  renderTable(rows) {
    if (!rows.length) return `<div class="empty-state"><i class="fas fa-receipt"></i><h4>No expenses found</h4><p>Record business expenses here.</p></div>`;
    const total = rows.reduce((s, r) => s + r.amount, 0);
    return `<table>
      <thead><tr><th>Date</th><th>Type</th><th>Title</th><th>Amount</th><th>Paid To</th><th>Method</th><th>Notes</th><th>Actions</th></tr></thead>
      <tbody>${rows.map(e => `<tr>
        <td>${fmtDate(e.expense_date)}</td>
        <td><span class="badge badge-orange">${escHtml(e.expense_type)}</span></td>
        <td><strong>${escHtml(e.title)}</strong></td>
        <td class="fw-bold text-danger">${fmtAmt(e.amount, e.currency)}</td>
        <td>${escHtml(e.paid_to || '—')}</td>
        <td>${escHtml(e.payment_method || '—')}</td>
        <td class="text-muted">${escHtml(e.notes || '—')}</td>
        <td class="actions">
          <button class="btn btn-sm btn-outline btn-icon" onclick="ExpensesPage.showEdit(${e.id})"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-outline btn-icon" onclick="ExpensesPage.deleteRecord(${e.id})"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('')}
      <tr style="background:#fef2f2">
        <td colspan="3" class="fw-bold text-right">Total</td>
        <td class="fw-bold text-danger">${fmtCurrency(total)}</td>
        <td colspan="4"></td>
      </tr>
      </tbody>
    </table>`;
  },

  _formHtml(e = {}) {
    return `<form id="modal-form"><div class="form-row cols-2">
      <div class="form-group"><label>Expense Type *</label>
        <select name="expense_type" required>
          <option value="">Select type</option>
          ${this.TYPES.map(t => `<option value="${t}" ${e.expense_type===t?'selected':''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Date *</label><input name="expense_date" type="date" required value="${e.expense_date || today()}"></div>
      <div class="form-group" style="grid-column:1/-1"><label>Title *</label><input name="title" required value="${escHtml(e.title || '')}" placeholder="Expense description"></div>
      <div class="form-group"><label>Amount *</label><input name="amount" type="number" step="0.01" min="0" required value="${e.amount || ''}"></div>
      <div class="form-group"><label>Currency</label>${currencySelect('currency', e.currency)}</div>
      <div class="form-group"><label>Paid To</label><input name="paid_to" value="${escHtml(e.paid_to || '')}" placeholder="Vendor / person"></div>
      <div class="form-group"><label>Payment Method</label>
        <select name="payment_method">
          <option value="cash" ${e.payment_method==='cash'||!e.payment_method?'selected':''}>Cash</option>
          <option value="bank_transfer" ${e.payment_method==='bank_transfer'?'selected':''}>Bank Transfer</option>
          <option value="other" ${e.payment_method==='other'?'selected':''}>Other</option>
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1"><label>Notes</label><textarea name="notes">${escHtml(e.notes || '')}</textarea></div>
    </div></form>`;
  },

  showAdd() {
    Modal.show({ title: 'Add Expense', body: this._formHtml(), onSave: async () => {
      if (!Modal.validate()) throw new Error('Please fill required fields');
      const data = Modal.getFormData();
      await API.post('/expenses', { ...data, amount: Number(data.amount) });
      Modal.close(); Toast.success('Expense added'); Router.navigate('expenses');
    }});
  },

  showEdit(id) {
    const e = this.data.find(x => x.id === id);
    Modal.show({ title: 'Edit Expense', body: this._formHtml(e), onSave: async () => {
      if (!Modal.validate()) throw new Error('Please fill required fields');
      const data = Modal.getFormData();
      await API.put(`/expenses/${id}`, { ...data, amount: Number(data.amount) });
      Modal.close(); Toast.success('Expense updated'); Router.navigate('expenses');
    }});
  },

  async applyFilter() {
    const params = new URLSearchParams();
    const search = document.getElementById('exp-search')?.value;
    const type   = document.getElementById('exp-type')?.value;
    const from   = document.getElementById('exp-from')?.value;
    const to     = document.getElementById('exp-to')?.value;
    if (search) params.set('search', search);
    if (type)   params.set('expense_type', type);
    if (from)   params.set('date_from', from);
    if (to)     params.set('date_to', to);
    try {
      this.data = await API.get(`/expenses?${params}`);
      document.getElementById('exp-table').innerHTML = this.renderTable(this.data);
      const total = this.data.reduce((s, e) => s + e.amount, 0);
      const totalBadge = document.querySelector('.badge.badge-danger');
      if (totalBadge) totalBadge.textContent = `Total: ${fmtCurrency(total)}`;
    } catch (e) {
      Toast.error('Filter failed: ' + e.message);
    }
  },

  async deleteRecord(id) {
    if (!confirmDelete()) return;
    await API.delete(`/expenses/${id}`);
    Toast.success('Deleted'); Router.navigate('expenses');
  },

  exportReport() {
    const rows = this.data;
    if (!rows.length) { Toast.warning('No data to export'); return; }

    const bizName = window.appSettings?.business_name || 'My Parking';
    const total   = rows.reduce((s, r) => s + r.amount, 0);

    const typeColors = {
      salary:      '#3b82f6',
      rent:        '#8b5cf6',
      electricity: '#f59e0b',
      water:       '#06b6d4',
      maintenance: '#f97316',
      other:       '#6b7280'
    };

    const byType = {};
    rows.forEach(r => { byType[r.expense_type] = (byType[r.expense_type] || 0) + r.amount; });

    const summaryCards = Object.entries(byType).map(([type, amt]) => `
      <div class="s-card" style="border-left-color:${typeColors[type] || '#6b7280'}">
        <div class="s-label">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
        <div class="s-val" style="color:${typeColors[type] || '#6b7280'}">${fmtCurrency(amt)}</div>
      </div>`).join('') + `
      <div class="s-card" style="border-left-color:#ef4444">
        <div class="s-label">Grand Total</div>
        <div class="s-val" style="color:#ef4444">${fmtCurrency(total)}</div>
      </div>`;

    const tableRows = rows.map((e, i) => `
      <tr class="${i % 2 === 0 ? 'even' : ''}">
        <td style="color:#94a3b8;text-align:center">${i + 1}</td>
        <td>${e.expense_date}</td>
        <td><span class="badge" style="background:${typeColors[e.expense_type] || '#6b7280'}">${e.expense_type}</span></td>
        <td><strong>${e.title}</strong></td>
        <td class="amt">${fmtCurrency(e.amount)}</td>
        <td>${e.paid_to || '—'}</td>
        <td>${e.payment_method || '—'}</td>
        <td style="color:#64748b;font-size:12px">${e.notes || '—'}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Expenses Report — ${bizName}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;color:#1e293b;padding:32px}
  .header{background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);color:#fff;border-radius:14px;padding:28px 32px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center}
  .header h1{font-size:22px;font-weight:800;letter-spacing:-.3px}
  .header p{font-size:13px;opacity:.65;margin-top:4px}
  .header .meta{text-align:right;font-size:12px;opacity:.75;line-height:1.8}
  .cards{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px}
  .s-card{background:#fff;border-radius:10px;padding:14px 18px;flex:1;min-width:130px;box-shadow:0 1px 4px rgba(0,0,0,.07);border-left:4px solid}
  .s-label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.6px;font-weight:600}
  .s-val{font-size:19px;font-weight:800;margin-top:5px}
  .card{background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden}
  table{width:100%;border-collapse:collapse}
  thead tr{background:linear-gradient(90deg,#1e293b,#334155)}
  thead th{padding:13px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;font-weight:700}
  tbody td{padding:11px 14px;font-size:13px;border-bottom:1px solid #f1f5f9}
  tr.even{background:#f8fafc}
  tr:hover{background:#eff6ff}
  .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;color:#fff;text-transform:capitalize}
  .amt{font-weight:700;color:#ef4444;font-size:14px}
  .total-row{background:linear-gradient(90deg,#fef2f2,#fff0f0) !important}
  .total-row td{font-weight:800;font-size:14px;padding:14px}
  .footer{text-align:center;margin-top:20px;font-size:12px;color:#94a3b8}
  @media print{
    body{background:#fff;padding:16px}
    .header,.cards,.total-row{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    thead tr{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .badge{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  }
</style></head><body>
  <div class="header">
    <div>
      <h1>💰 Expenses Report</h1>
      <p>${bizName}</p>
    </div>
    <div class="meta">
      <div>Generated: ${new Date().toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})}</div>
      <div>${rows.length} record${rows.length !== 1 ? 's' : ''}</div>
    </div>
  </div>
  <div class="cards">${summaryCards}</div>
  <div class="card">
    <table>
      <thead><tr>
        <th style="width:36px">#</th>
        <th>Date</th><th>Type</th><th>Title</th>
        <th>Amount</th><th>Paid To</th><th>Method</th><th>Notes</th>
      </tr></thead>
      <tbody>
        ${tableRows}
        <tr class="total-row">
          <td colspan="4" style="text-align:right;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:.5px">Total</td>
          <td class="amt" style="font-size:16px">${fmtCurrency(total)}</td>
          <td colspan="3"></td>
        </tr>
      </tbody>
    </table>
  </div>
  <div class="footer">${bizName} &nbsp;·&nbsp; Parking Management System &nbsp;·&nbsp; ${new Date().getFullYear()}</div>
</body></html>`;

    const blob     = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    const datePart = new Date().toISOString().slice(0, 10);
    a.href         = url;
    a.download     = `expenses-report-${datePart}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
};

Router.register('expenses', ExpensesPage);
