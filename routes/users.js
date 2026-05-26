const express = require('express');
const router = express.Router();
const { sb } = require('../database/supabase');
const bcrypt = require('bcryptjs');
const { authenticate, adminOnly } = require('../middleware/auth');

router.get('/', authenticate, adminOnly, async (req, res) => {
  try {
    const { data } = await sb.from('users').select('id, name, email, role, is_active, created_at').order('name');
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, adminOnly, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
    const { data: existing } = await sb.from('users').select('id').eq('email', email).maybeSingle();
    if (existing) return res.status(400).json({ error: 'Email already in use' });
    const { data, error } = await sb.from('users')
      .insert({ name, email, password: bcrypt.hashSync(password, 10), role: role || 'cashier' })
      .select('id').single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ id: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { name, email, role, is_active, password } = req.body;
    const updates = { name, email, role: role || 'cashier', is_active: is_active != null ? is_active : 1 };
    if (password) updates.password = bcrypt.hashSync(password, 10);
    await sb.from('users').update(updates).eq('id', req.params.id);
    res.json({ message: 'User updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    if (String(req.user.id) === String(req.params.id)) return res.status(400).json({ error: 'Cannot delete your own account' });
    await sb.from('users').delete().eq('id', req.params.id);
    res.json({ message: 'User deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
