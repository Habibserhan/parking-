const express = require('express');
const router = express.Router();
const { sb } = require('../database/supabase');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const { search, parking_status, date_from, date_to } = req.query;
    let query = sb.from('daily_parking').select('*').order('entry_time', { ascending: false });
    if (search)         query = query.ilike('plate_number', `%${search}%`);
    if (parking_status) query = query.eq('parking_status', parking_status);
    if (date_from)      query = query.gte('entry_time', `${date_from}T00:00:00`);
    if (date_to)        query = query.lte('entry_time', `${date_to}T23:59:59`);
    const { data } = await query;
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { plate_number, vehicle_type, entry_time, notes } = req.body;
    if (!plate_number || !vehicle_type) return res.status(400).json({ error: 'Plate number and vehicle type required' });
    const { data, error } = await sb.from('daily_parking')
      .insert({ plate_number: plate_number.toUpperCase(), vehicle_type, entry_time: entry_time || new Date().toISOString(), notes: notes || '' })
      .select('id').single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ id: data.id, message: 'Vehicle checked in' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/checkout', authenticate, async (req, res) => {
  try {
    const { amount, payment_status, currency } = req.body;
    const { data: entry } = await sb.from('daily_parking').select('*').eq('id', req.params.id).maybeSingle();
    if (!entry) return res.status(404).json({ error: 'Record not found' });
    if (entry.parking_status === 'completed') return res.status(400).json({ error: 'Already checked out' });

    const exit_time = new Date().toISOString();
    const duration_minutes = Math.round((new Date(exit_time) - new Date(entry.entry_time)) / 60000);

    await sb.from('daily_parking').update({
      exit_time, duration_minutes,
      amount: amount || 0,
      payment_status: payment_status || 'paid',
      parking_status: 'completed',
      currency: currency || 'USD'
    }).eq('id', req.params.id);
    res.json({ message: 'Checked out', duration_minutes });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { plate_number, vehicle_type, entry_time, exit_time, amount, payment_status, parking_status, notes, currency } = req.body;
    await sb.from('daily_parking').update({
      plate_number, vehicle_type, entry_time,
      exit_time: exit_time || null,
      amount: amount || 0,
      payment_status: payment_status || 'unpaid',
      parking_status: parking_status || 'parked',
      notes: notes || '',
      currency: currency || 'USD'
    }).eq('id', req.params.id);
    res.json({ message: 'Updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await sb.from('daily_parking').delete().eq('id', req.params.id);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
