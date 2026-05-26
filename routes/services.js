const express = require('express');
const router = express.Router();
const { sb } = require('../database/supabase');
const { authenticate, adminOnly } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const { search, active } = req.query;
    let query = sb.from('services').select('*').order('name');
    if (search) query = query.ilike('name', `%${search}%`);
    if (active !== undefined && active !== '') query = query.eq('is_active', active === 'true' ? 1 : 0);
    const { data } = await query;
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, adminOnly, async (req, res) => {
  try {
    const { name, vehicle_type, price, description, currency } = req.body;
    if (!name || price == null) return res.status(400).json({ error: 'Name and price required' });
    const { data, error } = await sb.from('services')
      .insert({ name, vehicle_type: vehicle_type || 'both', price, description: description || '', currency: currency || 'USD' })
      .select('id').single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ id: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { name, vehicle_type, price, description, is_active, currency } = req.body;
    await sb.from('services').update({
      name, vehicle_type: vehicle_type || 'both', price,
      description: description || '',
      is_active: is_active != null ? is_active : 1,
      currency: currency || 'USD'
    }).eq('id', req.params.id);
    res.json({ message: 'Service updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { error } = await sb.from('services').delete().eq('id', req.params.id);
    if (error) {
      if (error.code === '23503') return res.status(400).json({ error: 'Cannot delete this service — it is linked to existing transactions. Deactivate it instead.' });
      return res.status(400).json({ error: error.message });
    }
    res.json({ message: 'Service deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
