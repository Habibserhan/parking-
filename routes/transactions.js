const express = require('express');
const router = express.Router();
const { sb } = require('../database/supabase');
const { authenticate } = require('../middleware/auth');

function flattenTx(st) {
  return { ...st, service_name: st.services?.name || null, services: undefined };
}

router.get('/', authenticate, async (req, res) => {
  try {
    const { search, date_from, date_to, vehicle_type, service_id, payment_status } = req.query;
    let query = sb.from('service_transactions')
      .select('*, services(name)')
      .order('created_at', { ascending: false });
    if (date_from)      query = query.gte('service_date', date_from);
    if (date_to)        query = query.lte('service_date', date_to);
    if (vehicle_type)   query = query.eq('vehicle_type', vehicle_type);
    if (service_id)     query = query.eq('service_id', service_id);
    if (payment_status) query = query.eq('payment_status', payment_status);
    const { data } = await query;

    let result = (data || []).map(flattenTx);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(r =>
        (r.plate_number || '').toLowerCase().includes(s) ||
        (r.client_name  || '').toLowerCase().includes(s)
      );
    }
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { client_type, client_id, client_name, mobile, plate_number, vehicle_type, service_id, price, discount, payment_status, service_date, notes, currency } = req.body;
    const final_amount = (Number(price) || 0) - (Number(discount) || 0);
    const { data, error } = await sb.from('service_transactions').insert({
      client_type: client_type || 'non-registered',
      client_id: client_id || null,
      client_name: client_name || '',
      mobile: mobile || '',
      plate_number: plate_number || '',
      vehicle_type: vehicle_type || 'car',
      service_id: service_id || null,
      price: price || 0,
      discount: discount || 0,
      final_amount,
      payment_status: payment_status || 'unpaid',
      service_date: service_date || new Date().toISOString().slice(0, 10),
      notes: notes || '',
      currency: currency || 'USD'
    }).select('id').single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ id: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { client_type, client_id, client_name, mobile, plate_number, vehicle_type, service_id, price, discount, payment_status, service_date, notes, currency } = req.body;
    const final_amount = (Number(price) || 0) - (Number(discount) || 0);
    await sb.from('service_transactions').update({
      client_type: client_type || 'non-registered',
      client_id: client_id || null,
      client_name: client_name || '',
      mobile: mobile || '',
      plate_number: plate_number || '',
      vehicle_type: vehicle_type || 'car',
      service_id: service_id || null,
      price: price || 0,
      discount: discount || 0,
      final_amount,
      payment_status: payment_status || 'unpaid',
      service_date,
      notes: notes || '',
      currency: currency || 'USD'
    }).eq('id', req.params.id);
    res.json({ message: 'Updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await sb.from('service_transactions').delete().eq('id', req.params.id);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
