const express = require('express');
const router = express.Router();
const { sb } = require('../database/supabase');
const { authenticate } = require('../middleware/auth');

function flattenTx(st) {
  return { ...st, service_name: st.services?.name || null, services: undefined };
}

function isMissingColumnError(err) {
  if (!err) return false;
  return err.code === '42703' || err.code === 'PGRST204' ||
    (err.message || '').includes('Could not find') ||
    (err.message || '').includes('schema cache');
}

function calcTipFields(price, qty, discount, currency, payment_currency, exchange_rate, amount_received, payment_status) {
  const svcCur      = currency || 'USD';
  const payCur      = payment_currency || svcCur;
  const rate        = Number(exchange_rate) || 1;
  const service_total = (Number(price) || 0) * Math.max(1, Number(qty) || 1) - (Number(discount) || 0);
  const isPaid      = (payment_status || 'unpaid') === 'paid';

  if (!isPaid) return { amount_received: 0, converted_received_amount: 0, tip_amount: 0 };

  const amtRaw = Number(amount_received) != null && Number(amount_received) !== 0
    ? Number(amount_received)
    : service_total; // default: exact pay in same currency → no tip

  let converted = amtRaw;
  if (payCur !== svcCur) {
    if      (payCur === 'USD' && svcCur === 'LBP') converted = amtRaw * rate;
    else if (payCur === 'LBP' && svcCur === 'USD') converted = amtRaw / rate;
  }

  const tip = Math.max(0, converted - service_total);
  return { amount_received: amtRaw, converted_received_amount: converted, tip_amount: tip };
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
    const {
      client_type, client_id, client_name, mobile, plate_number, vehicle_type,
      service_id, price, quantity, discount, payment_status, service_date, notes,
      currency, payment_currency, exchange_rate, amount_received
    } = req.body;

    const qty          = Math.max(1, Number(quantity) || 1);
    const service_total = (Number(price) || 0) * qty - (Number(discount) || 0);
    const final_amount  = service_total;
    const tipFields     = calcTipFields(price, qty, discount, currency, payment_currency, exchange_rate, amount_received, payment_status);

    const baseInsert = {
      client_type: client_type || 'non-registered',
      client_id:   client_id   || null,
      client_name: client_name || '',
      mobile:      mobile      || '',
      plate_number: plate_number || '',
      vehicle_type: vehicle_type || 'car',
      service_id:  service_id  || null,
      price:       price       || 0,
      quantity:    qty,
      discount:    discount    || 0,
      final_amount,
      payment_status: payment_status || 'unpaid',
      service_date:   service_date   || new Date().toISOString().slice(0, 10),
      notes:    notes    || '',
      currency: currency || 'USD'
    };

    // Try with all tip/currency columns; strip any that don't exist in the DB yet
    let { data, error } = await sb.from('service_transactions')
      .insert({ ...baseInsert, payment_currency: payment_currency || currency || 'USD', exchange_rate: Number(exchange_rate) || 1, ...tipFields })
      .select('id').single();
    if (isMissingColumnError(error)) {
      const fallback = { ...baseInsert, payment_currency: payment_currency || currency || 'USD', exchange_rate: Number(exchange_rate) || 1, ...tipFields };
      for (const col of ['payment_currency', 'exchange_rate', 'amount_received', 'converted_received_amount', 'tip_amount']) {
        if ((error.message || '').includes(col)) delete fallback[col];
      }
      ({ data, error } = await sb.from('service_transactions').insert(fallback).select('id').single());
    }
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ id: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const {
      client_type, client_id, client_name, mobile, plate_number, vehicle_type,
      service_id, price, quantity, discount, payment_status, service_date, notes,
      currency, payment_currency, exchange_rate, amount_received
    } = req.body;

    const qty          = Math.max(1, Number(quantity) || 1);
    const service_total = (Number(price) || 0) * qty - (Number(discount) || 0);
    const final_amount  = service_total;
    const tipFields     = calcTipFields(price, qty, discount, currency, payment_currency, exchange_rate, amount_received, payment_status);

    const baseFields = {
      client_type: client_type || 'non-registered',
      client_id:   client_id   || null,
      client_name: client_name || '',
      mobile:      mobile      || '',
      plate_number: plate_number || '',
      vehicle_type: vehicle_type || 'car',
      service_id:  service_id  || null,
      price:       price       || 0,
      quantity:    qty,
      discount:    discount    || 0,
      final_amount,
      payment_status: payment_status || 'unpaid',
      service_date,
      notes:    notes    || '',
      currency: currency || 'USD'
    };

    // Try with all tip/currency columns; strip any that don't exist in the DB yet
    let result = await sb.from('service_transactions')
      .update({ ...baseFields, payment_currency: payment_currency || currency || 'USD', exchange_rate: Number(exchange_rate) || 1, ...tipFields })
      .eq('id', req.params.id);
    if (isMissingColumnError(result.error)) {
      const fallback = { ...baseFields, payment_currency: payment_currency || currency || 'USD', exchange_rate: Number(exchange_rate) || 1, ...tipFields };
      for (const col of ['payment_currency', 'exchange_rate', 'amount_received', 'converted_received_amount', 'tip_amount']) {
        if ((result.error.message || '').includes(col)) delete fallback[col];
      }
      result = await sb.from('service_transactions').update(fallback).eq('id', req.params.id);
    }
    if (result.error) return res.status(400).json({ error: result.error.message });
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
