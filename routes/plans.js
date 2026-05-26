const express = require('express');
const router = express.Router();
const { sb } = require('../database/supabase');
const { authenticate, adminOnly } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const { search, active } = req.query;
    let query = sb.from('subscription_plans').select('*').order('name');
    if (search) query = query.ilike('name', `%${search}%`);
    if (active !== undefined && active !== '') query = query.eq('is_active', active === 'true' ? 1 : 0);
    const { data } = await query;
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const { data } = await sb.from('subscription_plans').select('*').eq('id', req.params.id).maybeSingle();
    if (!data) return res.status(404).json({ error: 'Plan not found' });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, adminOnly, async (req, res) => {
  try {
    const { name, vehicle_type, duration, price, description, currency } = req.body;
    if (!name || !vehicle_type || !duration || price == null) return res.status(400).json({ error: 'Required fields missing' });
    const { data, error } = await sb.from('subscription_plans')
      .insert({ name, vehicle_type, duration, price, description: description || '', currency: currency || 'USD' })
      .select('id').single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ id: data.id, message: 'Plan created' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { name, vehicle_type, duration, price, description, is_active, currency } = req.body;
    await sb.from('subscription_plans').update({
      name, vehicle_type, duration, price,
      description: description || '',
      is_active: is_active != null ? is_active : 1,
      currency: currency || 'USD'
    }).eq('id', req.params.id);
    res.json({ message: 'Plan updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { error } = await sb.from('subscription_plans').delete().eq('id', req.params.id);
    if (error) {
      if (error.code === '23503') return res.status(400).json({ error: 'Cannot delete this plan — it is linked to existing clients or invoices. Deactivate it instead.' });
      return res.status(400).json({ error: error.message });
    }
    res.json({ message: 'Plan deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
