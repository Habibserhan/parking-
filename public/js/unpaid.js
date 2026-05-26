// ============================================================
//  UNPAID SUBSCRIPTIONS PAGE
// ============================================================
const UnpaidPage = {
  title: 'Unpaid Subscriptions',
  data: [],

  async render() {
    const month = currentMonth();
    this.data = await API.get(`/invoices/unpaid/subscriptions?invoice_month=${month}`);
    return `
      <div class="page-header">
        <div class="page-title">
          <h2>Unpaid Subscriptions</h2>
          <p>Active clients without payment for the selected month</p>
        </div>
        <div class="page-actions">
          <div class="month-selector">
            <label>Month:</label>
            <input type="month" id="unpaid-month" value="${month}">
          </div>
          <button class="btn btn-outline" onclick="UnpaidPage.reload()"><i class="fas fa-sync"></i> Refresh</button>
        </div>
      </div>
      <div class="d-flex align-center gap-2" style="margin-bottom:16px">
        <span id="unpaid-badge" class="badge badge-danger" style="font-size:14px;padding:8px 14px">
          <i class="fas fa-exclamation-circle"></i> ${this.data.length} Unpaid
        </span>
      </div>
      <div class="card">
        <div class="table-wrap" id="unpaid-table">${this.renderTable(this.data)}</div>
      </div>`;
  },

  init() {
    document.getElementById('unpaid-month').addEventListener('change', () => this.reload());
  },

  renderTable(rows) {
    if (!rows.length) return `<div class="empty-state"><i class="fas fa-check-circle text-success"></i><h4>All Paid!</h4><p>All active clients have paid for this month.</p></div>`;
    return `<table>
      <thead><tr>
        <th>Client</th><th>Mobile</th><th>Plate</th><th>Vehicle</th><th>Plan</th>
        <th>Amount Due</th><th>Due Date</th><th>Invoice</th><th>Actions</th>
      </tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td><strong>${escHtml(r.full_name)}</strong></td>
        <td>${escHtml(r.mobile || '—')}</td>
        <td><strong>${escHtml(r.plate_number)}</strong></td>
        <td>${vehicleBadge(r.vehicle_type)}</td>
        <td class="text-muted">${escHtml(r.plan_name || '—')}</td>
        <td class="fw-bold text-danger">${fmtCurrency(r.final_amount || r.amount)}</td>
        <td>${r.due_date ? `<span class="${r.due_date < today() ? 'text-danger' : ''}">${fmtDate(r.due_date)}</span>` : '—'}</td>
        <td>${r.invoice_number ? `<span class="badge badge-warning">${escHtml(r.invoice_number)}</span>` : '<span class="badge badge-gray">No Invoice</span>'}</td>
        <td class="actions">
          ${r.invoice_id
            ? `<button class="btn btn-sm btn-success" onclick="UnpaidPage.markPaid(${r.invoice_id})"><i class="fas fa-check"></i> Mark Paid</button>`
            : `<button class="btn btn-sm btn-primary" onclick="UnpaidPage.createInvoice(${r.client_id},${r.vehicle_id})"><i class="fas fa-file-invoice"></i> Create Invoice</button>`
          }
        </td>
      </tr>`).join('')}</tbody>
    </table>`;
  },

  async reload() {
    const month = document.getElementById('unpaid-month')?.value || currentMonth();
    this.data = await API.get(`/invoices/unpaid/subscriptions?invoice_month=${month}`);
    document.getElementById('unpaid-table').innerHTML = this.renderTable(this.data);
    const badge = document.getElementById('unpaid-badge');
    if (badge) badge.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${this.data.length} Unpaid`;
  },

  async markPaid(invoiceId) {
    Modal.show({ title: 'Mark as Paid', size: 'sm', body: `<form id="modal-form">
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
      const d = Modal.getFormData();
      // Get invoice to update
      const inv = await API.get(`/invoices/${invoiceId}`);
      await API.put(`/invoices/${invoiceId}`, { ...inv, payment_status: 'paid', payment_date: d.payment_date, payment_method: d.payment_method });
      Modal.close(); Toast.success('Marked as paid'); this.reload();
    }});
  },

  async createInvoice(clientId, vehicleId) {
    const month = document.getElementById('unpaid-month')?.value || currentMonth();
    const vehicle = this.data.find(r => r.vehicle_id === vehicleId);
    Modal.show({ title: 'Create Invoice', size: 'sm', body: `<form id="modal-form">
      <div class="form-row">
        <div class="form-group"><label>Amount</label><input name="amount" type="number" step="0.01" value="${vehicle?.amount || 0}"></div>
        <div class="form-group"><label>Discount</label><input name="discount" type="number" step="0.01" value="0"></div>
        <div class="form-group"><label>Due Date</label><input name="due_date" type="date" value="${month}-28"></div>
      </div>
    </form>`, saveLabel: 'Create', onSave: async () => {
      const data = Modal.getFormData();
      await API.post('/invoices', {
        client_id: clientId, vehicle_id: vehicleId,
        invoice_month: month, amount: Number(data.amount), discount: Number(data.discount) || 0,
        due_date: data.due_date, payment_status: 'unpaid'
      });
      Modal.close(); Toast.success('Invoice created'); this.reload();
    }});
  },

  async printInvoice(id) {
    // Delegate to InvoicesPage
    await InvoicesPage.printInvoice(id);
  }
};

Router.register('unpaid', UnpaidPage);
