const express = require('express');
const router  = express.Router();
const { sb }  = require('../database/supabase');
const { authenticate, adminOnly } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    let q = sb.from('employees').select('*').order('name');
    if (status) q = q.eq('status', status);
    const { data } = await q;
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, adminOnly, async (req, res) => {
  try {
    const { name, monthly_salary, currency, start_date, status, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Employee name required' });
    const { data, error } = await sb.from('employees')
      .insert({ name, monthly_salary: monthly_salary || 0, currency: currency || 'USD', start_date: start_date || null, status: status || 'active', notes: notes || '' })
      .select('id').single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ id: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { name, monthly_salary, currency, start_date, status, notes } = req.body;
    await sb.from('employees').update({ name, monthly_salary: monthly_salary || 0, currency: currency || 'USD', start_date: start_date || null, status: status || 'active', notes: notes || '' }).eq('id', req.params.id);
    res.json({ message: 'Updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    await sb.from('employees').delete().eq('id', req.params.id);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
