// ============================================================
//  INVOICES PAGE
// ============================================================
const InvoicesPage = {
  title: 'Invoices',
  data: [],
  clients: [],
  vehicles: [],
  plans: [],

  async render() {
    [this.data, this.clients, this.vehicles, this.plans] = await Promise.all([
      API.get(`/invoices?invoice_month=${currentMonth()}`),
      API.get('/clients'),
      API.get('/clients/all/vehicles'),
      API.get('/plans?active=true')
    ]);
    return `
      <div class="page-header">
        <div class="page-title"><h2>Invoices</h2><p>Manage subscription billing and payments</p></div>
        <div class="page-actions">
          ${Auth.isAdmin() ? `
            <button class="btn btn-outline" onclick="InvoicesPage.generateMonthly()"><i class="fas fa-magic"></i> Generate Monthly</button>
          ` : ''}
          <button class="btn btn-primary" onclick="InvoicesPage.showAdd()"><i class="fas fa-plus"></i> New Invoice</button>
        </div>
      </div>
      <div class="filters-bar">
        <input type="text" class="search-input" id="inv-search" placeholder="Search client, plate, invoice#…">
        <input type="month" id="inv-month" value="${currentMonth()}">
        <select id="inv-status">
          <option value="">All Status</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
          <option value="partially_paid">Partial</option>
        </select>
        <button class="btn btn-outline" onclick="InvoicesPage.exportReport()"><i class="fas fa-download"></i> Export</button>
      </div>
      <div class="card">
        <div class="table-wrap" id="inv-table">${this.renderTable(this.data)}</div>
      </div>`;
  },

  init() {
    document.getElementById('inv-search').addEventListener('input',  () => this.applyFilter());
    document.getElementById('inv-month').addEventListener('change',  () => this.applyFilter());
    document.getElementById('inv-status').addEventListener('change', () => this.applyFilter());
  },

  renderTable(rows) {
    if (!rows.length) return `<div class="empty-state"><i class="fas fa-file-invoice"></i><h4>No invoices found</h4><p>Generate monthly invoices or create one manually.</p></div>`;
    return `<table>
      <thead><tr><th>Invoice #</th><th>Client</th><th>Plate</th><th>Plan</th><th>Month</th><th>Amount</th><th>Discount</th><th>Total</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${rows.map(i => {
        const isOverdue = i.payment_status !== 'paid' && i.due_date && i.due_date < today();
        return `<tr class="${isOverdue ? 'row-warning' : ''}">
          <td><strong>${escHtml(i.invoice_number)}</strong></td>
          <td>${escHtml(i.full_name)}</td>
          <td>${escHtml(i.plate_number)}</td>
          <td class="text-muted">${escHtml(i.plan_name || '—')}</td>
          <td>${escHtml(i.invoice_month)}</td>
          <td>${fmtAmt(i.amount, i.currency)}</td>
          <td>${i.discount > 0 ? fmtAmt(i.discount, i.currency) : '—'}</td>
          <td class="fw-bold">${fmtAmt(i.final_amount, i.currency)}</td>
          <td>${isOverdue ? `<span class="text-danger">${fmtDate(i.due_date)}</span>` : fmtDate(i.due_date)}</td>
          <td>${statusBadge(i.payment_status)}</td>
          <td class="actions">
            ${i.payment_status !== 'paid' ? `<button class="btn btn-sm btn-success" onclick="InvoicesPage.markPaid(${i.id})"><i class="fas fa-check"></i> Pay</button>` : ''}
            <button class="btn btn-sm btn-outline btn-icon" onclick="InvoicesPage.showEdit(${i.id})"><i class="fas fa-edit"></i></button>
            ${Auth.isAdmin() ? `<button class="btn btn-sm btn-outline btn-icon" onclick="InvoicesPage.deleteRecord(${i.id})"><i class="fas fa-trash"></i></button>` : ''}
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  },

  _formHtml(inv = {}) {
    const clientOpts = this.clients.map(c => `<option value="${c.id}" ${inv.client_id==c.id?'selected':''}>${escHtml(c.full_name)}</option>`).join('');
    return `<form id="modal-form"><div class="form-row cols-2">
      <div class="form-group"><label>Client *</label>
        <select name="client_id" required id="inv-client" onchange="InvoicesPage.loadClientVehicles()">${clientOpts ? `<option value="">Select client</option>${clientOpts}` : '<option>No clients</option>'}</select>
      </div>
      <div class="form-group"><label>Vehicle *</label>
        <select name="vehicle_id" required id="inv-vehicle" onchange="InvoicesPage.fillFromVehicle()"><option value="">Select vehicle</option></select>
      </div>
      <div class="form-group"><label>Invoice Month *</label><input name="invoice_month" type="month" required value="${inv.invoice_month || currentMonth()}"></div>
      <div class="form-group"><label>Amount *</label><input name="amount" type="number" step="0.01" min="0" required value="${inv.amount || ''}" id="inv-amount" oninput="InvoicesPage.calcFinal()"></div>
      <div class="form-group"><label>Currency</label>${currencySelect('currency', inv.currency)}</div>
      <div class="form-group"><label>Discount</label><input name="discount" type="number" step="0.01" min="0" value="${inv.discount || 0}" oninput="InvoicesPage.calcFinal()"></div>
      <div class="form-group"><label>Final Amount</label><input id="inv-final" type="number" step="0.01" value="${inv.final_amount || ''}" readonly style="background:#f8fafc"></div>
      <div class="form-group"><label>Due Date</label><input name="due_date" type="date" value="${inv.due_date || ''}"></div>
      <div class="form-group"><label>Payment Status</label>
        <select name="payment_status">
          <option value="unpaid" ${inv.payment_status!=='paid'?'selected':''}>Unpaid</option>
          <option value="paid" ${inv.payment_status==='paid'?'selected':''}>Paid</option>
          <option value="partially_paid" ${inv.payment_status==='partially_paid'?'selected':''}>Partially Paid</option>
        </select>
      </div>
      <div class="form-group"><label>Payment Date</label><input name="payment_date" type="date" value="${inv.payment_date || ''}"></div>
      <div class="form-group"><label>Payment Method</label>
        <select name="payment_method">
          <option value="cash" ${!inv.payment_method||inv.payment_method==='cash'?'selected':''}>Cash</option>
          <option value="bank_transfer" ${inv.payment_method==='bank_transfer'?'selected':''}>Bank Transfer</option>
          <option value="other" ${inv.payment_method==='other'?'selected':''}>Other</option>
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1"><label>Notes</label><textarea name="notes">${escHtml(inv.notes || '')}</textarea></div>
    </div></form>`;
  },

  loadClientVehicles() {
    const clientId = document.getElementById('inv-client')?.value;
    const vehSel   = document.getElementById('inv-vehicle');
    if (!vehSel) return;
    const veh = this.vehicles.filter(v => v.client_id == clientId);
    vehSel.innerHTML = '<option value="">Select vehicle</option>' + veh.map(v => `<option value="${v.id}" data-amount="${v.amount}" data-plan="${v.subscription_plan_id}">${escHtml(v.plate_number)} (${escHtml(v.vehicle_type)})</option>`).join('');
  },

  fillFromVehicle() {
    const opt = document.getElementById('inv-vehicle')?.options[document.getElementById('inv-vehicle').selectedIndex];
    if (opt && opt.dataset.amount) {
      document.getElementById('inv-amount').value = opt.dataset.amount;
      this.calcFinal();
    }
  },

  calcFinal() {
    const amount   = Number(document.getElementById('inv-amount')?.value) || 0;
    const discount = Number(document.querySelector('#modal-form [name=discount]')?.value) || 0;
    const el = document.getElementById('inv-final');
    if (el) el.value = Math.max(0, amount - discount).toFixed(2);
  },

  showAdd() {
    Modal.show({ title: 'New Invoice', size: 'lg', body: this._formHtml(), onSave: async () => {
      if (!Modal.validate()) throw new Error('Please fill required fields');
      const data = Modal.getFormData();
      const vehOpt = document.getElementById('inv-vehicle')?.options[document.getElementById('inv-vehicle').selectedIndex];
      await API.post('/invoices', {
        ...data,
        subscription_plan_id: vehOpt?.dataset.plan || null,
        amount: Number(data.amount),
        discount: Number(data.discount) || 0,
        final_amount: Number(data.amount) - (Number(data.discount) || 0)
      });
      Modal.close(); Toast.success('Invoice created'); Router.navigate('invoices');
    }});
  },

  showEdit(id) {
    const inv = this.data.find(x => x.id === id);
    Modal.show({ title: 'Edit Invoice', size: 'lg', body: this._formHtml(inv), onSave: async () => {
      const data = Modal.getFormData();
      await API.put(`/invoices/${id}`, { ...data, amount: Number(data.amount), discount: Number(data.discount) || 0 });
      Modal.close(); Toast.success('Invoice updated'); Router.navigate('invoices');
    }});
    setTimeout(() => { this.loadClientVehicles(); this.calcFinal(); }, 50);
  },

  async markPaid(id) {
    Modal.show({ title: 'Mark Invoice as Paid', size: 'sm', body: `<form id="modal-form">
      <div class="form-row">
        <div class="form-group"><label>Payment Date</label><input name="payment_date" type="date" value="${today()}"></div>
        <div class="form-group"><label>Payment Method</label>
          <select name="payment_method">
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
    </form>`, saveLabel: 'Mark Paid', onSave: async () => {
      const data = Modal.getFormData();
      const inv = this.data.find(x => x.id === id);
      await API.put(`/invoices/${id}`, { ...inv, payment_status: 'paid', payment_date: data.payment_date, payment_method: data.payment_method });
      Modal.close(); Toast.success('Invoice marked as paid'); this.applyFilter();
    }});
  },

  async generateMonthly() {
    const month = document.getElementById('inv-month')?.value || currentMonth();
    if (!confirm(`Generate invoices for all active clients for ${month}?`)) return;
    try {
      const res = await API.post('/invoices/generate-monthly', { invoice_month: month });
      Toast.success(`Generated: ${res.generated} invoices, Skipped: ${res.skipped}`);
      this.applyFilter();
    } catch (e) { Toast.error(e.message); }
  },

  async applyFilter() {
    const params = new URLSearchParams();
    const search = document.getElementById('inv-search')?.value;
    const month  = document.getElementById('inv-month')?.value;
    const status = document.getElementById('inv-status')?.value;
    if (search) params.set('search', search);
    if (month)  params.set('invoice_month', month);
    if (status) params.set('payment_status', status);
    this.data = await API.get(`/invoices?${params}`);
    document.getElementById('inv-table').innerHTML = this.renderTable(this.data);
  },

  async printInvoice(id) {
    try {
      const inv = await API.get(`/invoices/${id}`);
      const win = window.open('', '_blank', 'width=800,height=600');
      win.document.write(this.buildPrintHTML(inv));
      win.document.close();
      setTimeout(() => win.print(), 500);
    } catch (e) { Toast.error(e.message); }
  },

  buildPrintHTML(inv) {
    const s = inv.settings || {};
    return `<!DOCTYPE html><html><head><title>Invoice ${escHtml(inv.invoice_number)}</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;max-width:700px;margin:40px auto;padding:40px}
      .header{display:flex;justify-content:space-between;margin-bottom:32px}
      .business-name{font-size:22px;font-weight:800;color:#3b82f6}
      .inv-title{font-size:32px;font-weight:800;color:#3b82f6;text-align:right}
      .inv-num{color:#64748b;text-align:right;font-size:14px}
      .section{margin:20px 0}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
      .label{font-size:11px;text-transform:uppercase;color:#94a3b8;font-weight:600;margin-bottom:4px}
      .value{font-size:15px;font-weight:500}
      table{width:100%;border-collapse:collapse;margin:24px 0}
      th{background:#f1f5f9;padding:10px 14px;text-align:left;font-size:12px;text-transform:uppercase;color:#64748b}
      td{padding:14px;border-bottom:1px solid #e2e8f0;font-size:14px}
      .total-section{text-align:right;margin-top:16px}
      .total-row{display:flex;justify-content:flex-end;gap:60px;padding:6px 0;font-size:14px}
      .total-final{border-top:2px solid #1e293b;padding-top:10px;font-weight:700;font-size:18px}
      .status{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}
      .paid{background:#dcfce7;color:#15803d}.unpaid{background:#fee2e2;color:#dc2626}
      .signatures{display:flex;justify-content:space-between;margin-top:60px}
      .sig{border-top:1px solid #333;width:180px;text-align:center;padding-top:8px;font-size:12px;color:#64748b}
      @media print{body{margin:0}}
    </style></head><body>
    <div class="header">
      <div>
        <div class="business-name">${escHtml(s.business_name || 'My Parking Business')}</div>
        <div style="font-size:13px;color:#64748b;margin-top:4px">${escHtml(s.business_address || '')}</div>
        <div style="font-size:13px;color:#64748b">${escHtml(s.business_phone || '')}</div>
      </div>
      <div>
        <div class="inv-title">INVOICE</div>
        <div class="inv-num">${escHtml(inv.invoice_number)}</div>
        <div style="margin-top:8px;text-align:right"><span class="status ${inv.payment_status}">${inv.payment_status.toUpperCase()}</span></div>
      </div>
    </div>
    <div class="grid section">
      <div>
        <div class="label">Billed To</div>
        <div class="value">${escHtml(inv.full_name)}</div>
        <div style="color:#64748b;font-size:13px">${escHtml(inv.mobile || '')}</div>
      </div>
      <div>
        <div class="label">Invoice Details</div>
        <div>Month: <strong>${escHtml(inv.invoice_month)}</strong></div>
        <div>Due: <strong>${fmtDate(inv.due_date)}</strong></div>
        <div>Created: <strong>${fmtDate(inv.created_at)}</strong></div>
      </div>
    </div>
    <table>
      <thead><tr><th>Description</th><th>Vehicle</th><th>Plate</th><th>Plan</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        <tr>
          <td>Parking Subscription — ${escHtml(inv.invoice_month)}</td>
          <td>${escHtml(inv.vehicle_type || '')}</td>
          <td>${escHtml(inv.plate_number)}</td>
          <td>${escHtml(inv.plan_name || '—')}</td>
          <td style="text-align:right">${fmtAmt(inv.amount, inv.currency)}</td>
        </tr>
      </tbody>
    </table>
    <div class="total-section">
      <div class="total-row"><span>Subtotal</span><span>${fmtAmt(inv.amount, inv.currency)}</span></div>
      ${inv.discount > 0 ? `<div class="total-row"><span>Discount</span><span>-${fmtAmt(inv.discount, inv.currency)}</span></div>` : ''}
      <div class="total-row total-final"><span>Total Due</span><span>${fmtAmt(inv.final_amount, inv.currency)}</span></div>
    </div>
    ${inv.payment_status === 'paid' ? `<div style="margin-top:20px;color:#15803d;font-weight:600">✓ Paid on ${fmtDate(inv.payment_date)} via ${escHtml(inv.payment_method || '')}</div>` : ''}
    <div class="signatures">
      <div class="sig">Client Signature</div>
      <div class="sig">Authorized Signature</div>
    </div>
    </body></html>`;
  },

  async deleteRecord(id) {
    if (!confirmDelete()) return;
    await API.delete(`/invoices/${id}`);
    Toast.success('Deleted'); this.applyFilter();
  },

  exportReport() {
    const rows = this.data;
    if (!rows.length) { Toast.warning('No data to export'); return; }

    const bizName  = window.appSettings?.business_name || 'My Parking';
    const total    = rows.reduce((s, r) => s + r.final_amount, 0);
    const paid     = rows.filter(r => r.payment_status === 'paid').reduce((s, r) => s + r.final_amount, 0);
    const unpaid   = rows.filter(r => r.payment_status !== 'paid').reduce((s, r) => s + r.final_amount, 0);
    const month    = document.getElementById('inv-month')?.value || currentMonth();

    const statusColor = { paid: '#16a34a', unpaid: '#dc2626', partially_paid: '#d97706' };
    const statusBg    = { paid: '#dcfce7', unpaid: '#fee2e2', partially_paid: '#fef3c7' };

    const tableRows = rows.map((inv, i) => {
      const overdue = inv.payment_status !== 'paid' && inv.due_date && inv.due_date < today();
      return `<tr class="${i % 2 === 0 ? 'even' : ''}" style="${overdue ? 'background:#fff7ed' : ''}">
        <td style="color:#94a3b8;text-align:center">${i + 1}</td>
        <td><strong>${inv.invoice_number}</strong></td>
        <td>${inv.full_name}</td>
        <td>${inv.plate_number || '—'}</td>
        <td style="color:#64748b">${inv.plan_name || '—'}</td>
        <td>${inv.invoice_month}</td>
        <td>${fmtAmt(inv.amount, inv.currency)}</td>
        <td style="color:#d97706">${inv.discount > 0 ? fmtAmt(inv.discount, inv.currency) : '—'}</td>
        <td style="font-weight:700">${fmtAmt(inv.final_amount, inv.currency)}</td>
        <td style="color:${overdue ? '#dc2626' : '#64748b'}">${inv.due_date || '—'}${overdue ? ' ⚠' : ''}</td>
        <td><span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${statusBg[inv.payment_status] || '#f1f5f9'};color:${statusColor[inv.payment_status] || '#64748b'}">${inv.payment_status.replace('_', ' ').toUpperCase()}</span></td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Invoices Report — ${bizName}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;color:#1e293b;padding:32px}
  .header{background:linear-gradient(135deg,#1e3a5f 0%,#1e293b 100%);color:#fff;border-radius:14px;padding:28px 32px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center}
  .header h1{font-size:22px;font-weight:800}
  .header p{font-size:13px;opacity:.65;margin-top:4px}
  .header .meta{text-align:right;font-size:12px;opacity:.75;line-height:1.8}
  .cards{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px}
  .s-card{background:#fff;border-radius:10px;padding:14px 20px;flex:1;min-width:140px;box-shadow:0 1px 4px rgba(0,0,0,.07);border-left:4px solid}
  .s-label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.6px;font-weight:600}
  .s-val{font-size:20px;font-weight:800;margin-top:5px}
  .card{background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden}
  table{width:100%;border-collapse:collapse}
  thead tr{background:linear-gradient(90deg,#1e3a5f,#1e293b)}
  thead th{padding:12px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;font-weight:700}
  tbody td{padding:10px 12px;font-size:13px;border-bottom:1px solid #f1f5f9}
  tr.even{background:#f8fafc}
  .total-row{background:linear-gradient(90deg,#eff6ff,#f0fdf4) !important}
  .total-row td{font-weight:800;font-size:14px;padding:13px 12px}
  .footer{text-align:center;margin-top:20px;font-size:12px;color:#94a3b8}
  @media print{
    body{background:#fff;padding:16px}
    .header,.cards{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    thead tr{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    span[style]{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  }
</style></head><body>
  <div class="header">
    <div>
      <h1>🧾 Invoices Report</h1>
      <p>${bizName} &nbsp;·&nbsp; ${month}</p>
    </div>
    <div class="meta">
      <div>Generated: ${new Date().toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})}</div>
      <div>${rows.length} invoice${rows.length !== 1 ? 's' : ''}</div>
    </div>
  </div>
  <div class="cards">
    <div class="s-card" style="border-left-color:#3b82f6">
      <div class="s-label">Total Billed</div>
      <div class="s-val" style="color:#3b82f6">${fmtCurrency(total)}</div>
    </div>
    <div class="s-card" style="border-left-color:#16a34a">
      <div class="s-label">Collected</div>
      <div class="s-val" style="color:#16a34a">${fmtCurrency(paid)}</div>
    </div>
    <div class="s-card" style="border-left-color:#dc2626">
      <div class="s-label">Outstanding</div>
      <div class="s-val" style="color:#dc2626">${fmtCurrency(unpaid)}</div>
    </div>
    <div class="s-card" style="border-left-color:#8b5cf6">
      <div class="s-label">Invoices</div>
      <div class="s-val" style="color:#8b5cf6">${rows.length}</div>
    </div>
  </div>
  <div class="card">
    <table>
      <thead><tr>
        <th style="width:32px">#</th>
        <th>Invoice #</th><th>Client</th><th>Plate</th><th>Plan</th>
        <th>Month</th><th>Amount</th><th>Discount</th><th>Total</th><th>Due Date</th><th>Status</th>
      </tr></thead>
      <tbody>
        ${tableRows}
        <tr class="total-row">
          <td colspan="8" style="text-align:right;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.5px">Grand Total</td>
          <td style="color:#1e293b;font-size:15px">${fmtCurrency(total)}</td>
          <td colspan="2"></td>
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
    a.download     = `invoices-report-${month}-${datePart}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
};

Router.register('invoices', InvoicesPage);
