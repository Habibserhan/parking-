// ============================================================
//  EMPLOYEE SALARIES PAGE
// ============================================================
const EmployeesPage = {
  title: 'Employee Salaries',
  adminOnly: true,
  data: [],       // employees
  _expenses: [],  // salary expenses for selected month
  _month: '',

  async render() {
    this._month = currentMonth();
    await this._loadData();
    return this._pageHtml();
  },

  async _loadData() {
    [this.data, this._expenses] = await Promise.all([
      API.get('/employees'),
      API.get(`/expenses?salary_month=${this._month}`).catch(() => [])
    ]);
  },

  _pageHtml() {
    const rows   = this._buildRows();
    const totals = this._calcTotals(rows);
    return `
      <div class="page-header">
        <div class="page-title"><h2>Employee Salaries</h2><p>Manage employee salaries and advances</p></div>
        <div class="page-actions" style="flex-wrap:wrap;gap:8px">
          <label style="font-size:13px;color:var(--text-muted);line-height:38px">Month</label>
          <input type="month" id="emp-month" value="${this._month}"
            style="padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;height:38px"
            onchange="EmployeesPage.changeMonth(this.value)">
          <button class="btn btn-primary" onclick="EmployeesPage.showAdd()"><i class="fas fa-plus"></i> Add Employee</button>
        </div>
      </div>

      <!-- Summary cards -->
      <div class="stats-grid" style="margin-bottom:20px">
        <div class="stat-card">
          <div class="stat-icon blue"><i class="fas fa-users"></i></div>
          <div class="stat-info">
            <div class="stat-label">Active Employees</div>
            <div class="stat-value">${this.data.filter(e => e.status === 'active').length}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple"><i class="fas fa-money-bill-wave"></i></div>
          <div class="stat-info">
            <div class="stat-label">Total Monthly Payroll</div>
            <div class="stat-value" style="font-size:16px">${fmtRaw(totals.payroll, 'USD')}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber"><i class="fas fa-hand-holding-usd"></i></div>
          <div class="stat-info">
            <div class="stat-label">Advances This Month</div>
            <div class="stat-value" style="font-size:16px">${fmtRaw(totals.advances, 'USD')}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="fas fa-check-circle"></i></div>
          <div class="stat-info">
            <div class="stat-label">Salary Paid</div>
            <div class="stat-value" style="font-size:16px">${fmtRaw(totals.paid, 'USD')}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red"><i class="fas fa-clock"></i></div>
          <div class="stat-info">
            <div class="stat-label">Total Remaining</div>
            <div class="stat-value" style="font-size:16px">${fmtRaw(totals.remaining, 'USD')}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="table-wrap">${this._renderTable(rows)}</div>
      </div>`;
  },

  // Returns the effective salary for a given month, prorated if the employee started mid-month
  _getProratedSalary(emp, month) {
    const monthly = Number(emp.monthly_salary) || 0;
    if (!emp.start_date) return monthly;
    const startMonth = emp.start_date.slice(0, 7); // "YYYY-MM"
    if (startMonth !== month) return monthly;       // full salary for any month after start
    const [yr, mo]    = month.split('-').map(Number);
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const startDay    = parseInt(emp.start_date.split('-')[2], 10);
    const daysWorked  = daysInMonth - startDay + 1; // inclusive
    return Math.round(monthly * daysWorked / daysInMonth * 100) / 100;
  },

  _buildRows() {
    return this.data.map(emp => {
      const effective = this._getProratedSalary(emp, this._month);
      const isProrated = effective !== (Number(emp.monthly_salary) || 0);
      const empExp    = this._expenses.filter(e => String(e.employee_id) === String(emp.id));
      const advances  = empExp.filter(e => e.expense_type === 'salary_advance').reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const paid      = empExp.filter(e => e.expense_type === 'salary').reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const remaining = Math.max(0, effective - advances - paid);
      return { ...emp, effective_salary: effective, is_prorated: isProrated, advances, paid, remaining };
    });
  },

  _calcTotals(rows) {
    const active = rows.filter(r => r.status === 'active');
    return {
      payroll:   active.reduce((s, r) => s + (r.effective_salary || 0), 0),
      advances:  active.reduce((s, r) => s + r.advances, 0),
      paid:      active.reduce((s, r) => s + r.paid, 0),
      remaining: active.reduce((s, r) => s + r.remaining, 0)
    };
  },

  _renderTable(rows) {
    if (!rows.length) return `<div class="empty-state"><i class="fas fa-user-tie"></i><h4>No employees yet</h4><p>Add your first employee to track salaries.</p></div>`;
    return `<table>
      <thead><tr>
        <th>Employee</th><th>Salary This Month</th><th>Advances</th><th>Salary Paid</th><th>Remaining</th><th>Status</th><th>Actions</th>
      </tr></thead>
      <tbody>${rows.map(r => {
        const fullyPaid = r.status === 'active' && r.remaining === 0 && (r.paid > 0 || r.advances > 0);
        const rowStyle  = fullyPaid ? 'background:#f0fdf4' : '';
        const salaryLabel = r.is_prorated
          ? `${fmtRaw(r.effective_salary, r.currency)} <span style="font-size:10px;font-weight:600;color:var(--primary);background:#eff6ff;padding:2px 6px;border-radius:10px;margin-left:4px">Prorated</span><br><span style="font-size:10px;color:var(--text-muted)">Full: ${fmtRaw(r.monthly_salary, r.currency)}</span>`
          : fmtRaw(r.monthly_salary, r.currency);
        return `<tr style="${rowStyle}">
          <td><strong>${escHtml(r.name)}</strong></td>
          <td class="fw-bold">${salaryLabel}</td>
          <td style="color:${r.advances > 0 ? 'var(--warning)' : 'var(--text-muted)'}">
            ${r.advances > 0 ? fmtRaw(r.advances, r.currency) : '—'}
          </td>
          <td style="color:${r.paid > 0 ? 'var(--success)' : 'var(--text-muted)'}">
            ${r.paid > 0 ? fmtRaw(r.paid, r.currency) : '—'}
          </td>
          <td style="color:${r.remaining > 0 ? 'var(--danger)' : 'var(--success)'}">
            <strong>${r.remaining > 0 ? fmtRaw(r.remaining, r.currency) : '✓ Paid'}</strong>
          </td>
          <td>${statusBadge(r.status)}</td>
          <td class="actions">
            <button class="btn btn-sm btn-outline" onclick="EmployeesPage.showAdvance(${r.id})" title="Add Salary Advance">
              <i class="fas fa-hand-holding-usd"></i> Advance
            </button>
            <button class="btn btn-sm btn-success" onclick="EmployeesPage.showPaySalary(${r.id})" title="Pay Salary" style="font-size:11px">
              <i class="fas fa-dollar-sign"></i> Pay
            </button>
            <button class="btn btn-sm btn-outline btn-icon" onclick="EmployeesPage.showEdit(${r.id})"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm btn-outline btn-icon" onclick="EmployeesPage.deleteRecord(${r.id})"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  },

  async changeMonth(month) {
    this._month = month;
    this._expenses = await API.get(`/expenses?salary_month=${month}`).catch(() => []);
    document.getElementById('page-content').innerHTML = this._pageHtml();
    // Re-attach month input listener
    document.getElementById('emp-month')?.addEventListener('change', e => this.changeMonth(e.target.value));
  },

  // ── Add Salary Advance ──────────────────────────────────
  showAdvance(employeeId) {
    const emp = this.data.find(e => e.id === employeeId);
    if (!emp) return;
    Modal.show({ title: `Salary Advance — ${escHtml(emp.name)}`, body: `<form id="modal-form">
      <div class="form-row cols-2">
        <div class="form-group"><label>Advance Date *</label>
          <input name="expense_date" type="date" required value="${today()}">
        </div>
        <div class="form-group"><label>Salary Month</label>
          <input name="salary_month" type="month" id="adv-month" value="${this._month}"
            onchange="EmployeesPage._recalcAdvanceInfo(${employeeId}, this.value)">
        </div>
        <div class="form-group"><label>Amount *</label>
          <input name="amount" type="text" inputmode="numeric" required placeholder="0">
        </div>
        <div class="form-group"><label>Currency</label>
          ${currencySelect('currency', emp.currency || 'USD')}
        </div>
        <div class="form-group" style="grid-column:1/-1"><label>Notes</label>
          <textarea name="notes" placeholder="Optional note…"></textarea>
        </div>
      </div>
      <div id="adv-info" style="display:none;margin-top:8px"></div>
    </form>`, saveLabel: 'Save Advance', onSave: async () => {
      if (!Modal.validate()) throw new Error('Please fill required fields');
      const data = Modal.getFormData();
      await API.post('/expenses', {
        expense_type:  'salary_advance',
        title:         `Salary Advance — ${emp.name}`,
        amount:        parseAmountInput(data.amount),
        expense_date:  data.expense_date,
        salary_month:  data.salary_month || this._month,
        employee_id:   emp.id,
        paid_to:       emp.name,
        payment_method:'cash',
        notes:         data.notes || '',
        currency:      data.currency || emp.currency || 'USD'
      });
      Modal.close(); Toast.success('Advance recorded');
      await this.changeMonth(this._month);
    }});
    // Show current month info on open
    setTimeout(() => this._recalcAdvanceInfo(employeeId, this._month), 50);
  },

  async _recalcAdvanceInfo(employeeId, month) {
    const emp       = this.data.find(e => e.id === employeeId);
    if (!emp) return;
    const expenses  = await API.get(`/expenses?salary_month=${month}&employee_id=${employeeId}`).catch(() => []);
    const effective = this._getProratedSalary(emp, month);
    const advances  = expenses.filter(e => e.expense_type === 'salary_advance').reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const paid      = expenses.filter(e => e.expense_type === 'salary').reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const remaining = Math.max(0, effective - advances - paid);
    const infoEl    = document.getElementById('adv-info');
    if (!infoEl) return;
    if (advances > 0 || paid > 0) {
      infoEl.style.display = '';
      infoEl.innerHTML = `<div style="padding:10px 14px;background:#fefce8;border-radius:8px;border:1px solid #fde047;font-size:13px">
        <i class="fas fa-info-circle" style="color:var(--warning);margin-right:6px"></i>
        <strong>${month}:</strong>
        Advances: <strong>${fmtRaw(advances, emp.currency)}</strong> &nbsp;·&nbsp;
        Paid: <strong>${fmtRaw(paid, emp.currency)}</strong> &nbsp;·&nbsp;
        Remaining: <strong style="color:${remaining > 0 ? 'var(--danger)' : 'var(--success)'}">${remaining > 0 ? fmtRaw(remaining, emp.currency) : '✓ Fully Paid'}</strong>
      </div>`;
    } else {
      infoEl.style.display = 'none';
    }
  },

  // ── Pay Salary ──────────────────────────────────────────
  showPaySalary(employeeId) {
    const emp = this.data.find(e => e.id === employeeId);
    if (!emp) return;
    const row       = this._buildRows().find(r => r.id === employeeId);
    const remaining = row?.remaining ?? this._getProratedSalary(emp, this._month);
    Modal.show({ title: `Pay Salary — ${escHtml(emp.name)}`, body: `<form id="modal-form">
      <div class="form-row cols-2">
        <div class="form-group"><label>Payment Date *</label>
          <input name="expense_date" type="date" required value="${today()}">
        </div>
        <div class="form-group"><label>Salary Month</label>
          <input name="salary_month" type="month" id="pay-month" value="${this._month}"
            onchange="EmployeesPage._recalcPaySalary(${employeeId}, this.value)">
        </div>
        <div class="form-group"><label>Amount *</label>
          <input name="amount" id="pay-amount" type="text" inputmode="numeric" required
            value="${fmtAmountInput(remaining, emp.currency)}">
        </div>
        <div class="form-group"><label>Currency</label>
          ${currencySelect('currency', emp.currency || 'USD')}
        </div>
        <div class="form-group"><label>Payment Method</label>
          <select name="payment_method">
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1"><label>Notes</label>
          <textarea name="notes" placeholder="Optional note…"></textarea>
        </div>
      </div>
      <div id="pay-salary-info" style="margin-top:8px${row?.advances > 0 ? '' : ';display:none'}">
        ${row?.advances > 0 ? `<div style="padding:10px 14px;background:#fefce8;border-radius:8px;border:1px solid #fde047;font-size:13px">
          <i class="fas fa-info-circle" style="color:var(--warning);margin-right:6px"></i>
          Advances: <strong>${fmtRaw(row.advances, emp.currency)}</strong> &nbsp;·&nbsp;
          Remaining: <strong style="color:var(--danger)">${fmtRaw(remaining, emp.currency)}</strong>
        </div>` : ''}
      </div>
    </form>`, saveLabel: 'Confirm Payment', onSave: async () => {
      if (!Modal.validate()) throw new Error('Please fill required fields');
      const data = Modal.getFormData();
      await API.post('/expenses', {
        expense_type:   'salary',
        title:          `Salary — ${emp.name} — ${data.salary_month || this._month}`,
        amount:         parseAmountInput(data.amount),
        expense_date:   data.expense_date,
        salary_month:   data.salary_month || this._month,
        employee_id:    emp.id,
        paid_to:        emp.name,
        payment_method: data.payment_method || 'cash',
        notes:          data.notes || '',
        currency:       data.currency || emp.currency || 'USD'
      });
      Modal.close(); Toast.success('Salary payment recorded');
      await this.changeMonth(this._month);
    }});
  },

  async _recalcPaySalary(employeeId, month) {
    const emp       = this.data.find(e => e.id === employeeId);
    if (!emp) return;
    const expenses  = await API.get(`/expenses?salary_month=${month}&employee_id=${employeeId}`).catch(() => []);
    const effective = this._getProratedSalary(emp, month);
    const isProrated = effective !== (Number(emp.monthly_salary) || 0);
    const advances  = expenses.filter(e => e.expense_type === 'salary_advance').reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const paid      = expenses.filter(e => e.expense_type === 'salary').reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const remaining = Math.max(0, effective - advances - paid);

    // Update amount field
    const amtEl = document.getElementById('pay-amount');
    if (amtEl) amtEl.value = fmtAmountInput(remaining, emp.currency);

    // Update info banner
    const infoEl = document.getElementById('pay-salary-info');
    if (infoEl) {
      const showBanner = advances > 0 || paid > 0 || isProrated;
      if (showBanner) {
        infoEl.style.display = '';
        const proratedNote = isProrated
          ? `<div style="margin-bottom:6px;color:var(--primary)"><i class="fas fa-calculator" style="margin-right:5px"></i>Prorated salary for start month: <strong>${fmtRaw(effective, emp.currency)}</strong> (full: ${fmtRaw(emp.monthly_salary, emp.currency)})</div>`
          : '';
        const breakdownNote = (advances > 0 || paid > 0)
          ? `Advances: <strong>${fmtRaw(advances, emp.currency)}</strong> &nbsp;·&nbsp; Paid: <strong>${fmtRaw(paid, emp.currency)}</strong> &nbsp;·&nbsp;
             Remaining: <strong style="color:${remaining > 0 ? 'var(--danger)' : 'var(--success)'}">${remaining > 0 ? fmtRaw(remaining, emp.currency) : '✓ Fully Paid'}</strong>`
          : '';
        infoEl.innerHTML = `<div style="padding:10px 14px;background:#fefce8;border-radius:8px;border:1px solid #fde047;font-size:13px">
          <i class="fas fa-info-circle" style="color:var(--warning);margin-right:6px"></i>
          ${proratedNote}${breakdownNote}
        </div>`;
      } else {
        infoEl.style.display = 'none';
      }
    }
  },

  // ── Add / Edit Employee ─────────────────────────────────
  _empForm(emp = {}) {
    return `<form id="modal-form"><div class="form-row cols-2">
      <div class="form-group" style="grid-column:1/-1"><label>Employee Name *</label>
        <input name="name" required value="${escHtml(emp.name || '')}" placeholder="Full name">
      </div>
      <div class="form-group"><label>Monthly Salary *</label>
        <input name="monthly_salary" type="text" inputmode="numeric" required value="${fmtAmountInput(emp.monthly_salary, emp.currency)}">
      </div>
      <div class="form-group"><label>Currency</label>
        ${currencySelect('currency', emp.currency || 'USD')}
      </div>
      <div class="form-group"><label>Start Date</label>
        <input name="start_date" type="date" value="${emp.start_date || today()}">
      </div>
      <div class="form-group"><label>Status</label>
        <select name="status">
          <option value="active"   ${emp.status !== 'inactive' ? 'selected' : ''}>Active</option>
          <option value="inactive" ${emp.status === 'inactive'  ? 'selected' : ''}>Inactive</option>
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1"><label>Notes</label>
        <textarea name="notes">${escHtml(emp.notes || '')}</textarea>
      </div>
    </div></form>`;
  },

  showAdd() {
    Modal.show({ title: 'Add Employee', body: this._empForm(), onSave: async () => {
      if (!Modal.validate()) throw new Error('Please fill required fields');
      const data = Modal.getFormData();
      await API.post('/employees', { ...data, monthly_salary: parseAmountInput(data.monthly_salary) });
      Modal.close(); Toast.success('Employee added');
      await this._loadData();
      document.getElementById('page-content').innerHTML = this._pageHtml();
    }});
  },

  showEdit(id) {
    const emp = this.data.find(e => e.id === id);
    if (!emp) return;
    Modal.show({ title: 'Edit Employee', body: this._empForm(emp), onSave: async () => {
      if (!Modal.validate()) throw new Error('Please fill required fields');
      const data = Modal.getFormData();
      await API.put(`/employees/${id}`, { ...data, monthly_salary: parseAmountInput(data.monthly_salary) });
      Modal.close(); Toast.success('Employee updated');
      await this._loadData();
      document.getElementById('page-content').innerHTML = this._pageHtml();
    }});
  },

  async deleteRecord(id) {
    if (!confirmDelete('Delete this employee? All salary records remain in expenses.')) return;
    await API.delete(`/employees/${id}`);
    Toast.success('Employee deleted');
    await this._loadData();
    document.getElementById('page-content').innerHTML = this._pageHtml();
  }
};

Router.register('employees', EmployeesPage);
