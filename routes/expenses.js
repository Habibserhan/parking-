const express = require('express');
const router  = express.Router();
const { sb }  = require('../database/supabase');
const { authenticate, adminOnly } = require('../middleware/auth');

function isMissingColumnError(err) {
  if (!err) return false;
  return err.code === '42703' || err.code === 'PGRST204' ||
    (err.message || '').includes('Could not find') ||
    (err.message || '').includes('schema cache');
}

router.get('/', authenticate, async (req, res) => {
  try {
    const { search, date_from, date_to, expense_type, salary_month, employee_id } = req.query;

    // Try to join employees; fall back gracefully if columns don't exist yet
    let query = sb.from('expenses')
      .select('*, employees(name)')
      .order('expense_date', { ascending: false });

    if (search)       query = query.ilike('title', `%${search}%`);
    if (date_from)    query = query.gte('expense_date', date_from);
    if (date_to)      query = query.lte('expense_date', date_to);
    if (expense_type) query = query.eq('expense_type', expense_type);
    if (salary_month) query = query.eq('salary_month', salary_month);
    if (employee_id)  query = query.eq('employee_id', employee_id);

    let { data, error } = await query;

    // If join fails (employee columns not yet added), retry without join
    if (isMissingColumnError(error)) {
      let fallback = sb.from('expenses').select('*').order('expense_date', { ascending: false });
      if (search)       fallback = fallback.ilike('title', `%${search}%`);
      if (date_from)    fallback = fallback.gte('expense_date', date_from);
      if (date_to)      fallback = fallback.lte('expense_date', date_to);
      if (expense_type) fallback = fallback.eq('expense_type', expense_type);
      ({ data, error } = await fallback);
    }
    if (error) return res.status(400).json({ error: error.message });

    const result = (data || []).map(e => ({
      ...e,
      employee_name: e.employees?.name || null,
      employees: undefined
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, adminOnly, async (req, res) => {
  try {
    const { expense_type, title, amount, expense_date, paid_to, payment_method, notes, currency, employee_id, salary_month } = req.body;
    if (!expense_type || !title || amount == null || !expense_date) return res.status(400).json({ error: 'Required fields missing' });

    const baseInsert = { expense_type, title, amount, expense_date, paid_to: paid_to || '', payment_method: payment_method || 'cash', notes: notes || '', currency: currency || 'USD' };

    let { data, error } = await sb.from('expenses')
      .insert({ ...baseInsert, employee_id: employee_id || null, salary_month: salary_month || null })
      .select('id').single();
    if (isMissingColumnError(error)) {
      ({ data, error } = await sb.from('expenses').insert(baseInsert).select('id').single());
    }
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ id: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { expense_type, title, amount, expense_date, paid_to, payment_method, notes, currency, employee_id, salary_month } = req.body;

    const baseFields = { expense_type, title, amount, expense_date, paid_to: paid_to || '', payment_method: payment_method || 'cash', notes: notes || '', currency: currency || 'USD' };

    let result = await sb.from('expenses')
      .update({ ...baseFields, employee_id: employee_id || null, salary_month: salary_month || null })
      .eq('id', req.params.id);
    if (isMissingColumnError(result.error)) {
      result = await sb.from('expenses').update(baseFields).eq('id', req.params.id);
    }
    if (result.error) return res.status(400).json({ error: result.error.message });
    res.json({ message: 'Updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    await sb.from('expenses').delete().eq('id', req.params.id);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
