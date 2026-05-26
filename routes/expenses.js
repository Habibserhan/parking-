const express = require('express');
const router = express.Router();
const { sb } = require('../database/supabase');
const { authenticate, adminOnly } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const { search, date_from, date_to, expense_type } = req.query;
    let query = sb.from('expenses').select('*').order('expense_date', { ascending: false });
    if (search)       query = query.ilike('title', `%${search}%`);
    if (date_from)    query = query.gte('expense_date', date_from);
    if (date_to)      query = query.lte('expense_date', date_to);
    if (expense_type) query = query.eq('expense_type', expense_type);
    const { data } = await query;
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, adminOnly, async (req, res) => {
  try {
    const { expense_type, title, amount, expense_date, paid_to, payment_method, notes, currency } = req.body;
    if (!expense_type || !title || amount == null || !expense_date) return res.status(400).json({ error: 'Required fields missing' });
    const { data, error } = await sb.from('expenses')
      .insert({ expense_type, title, amount, expense_date, paid_to: paid_to || '', payment_method: payment_method || 'cash', notes: notes || '', currency: currency || 'USD' })
      .select('id').single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ id: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { expense_type, title, amount, expense_date, paid_to, payment_method, notes, currency } = req.body;
    await sb.from('expenses').update({
      expense_type, title, amount, expense_date,
      paid_to: paid_to || '', payment_method: payment_method || 'cash', notes: notes || '',
      currency: currency || 'USD'
    }).eq('id', req.params.id);
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
