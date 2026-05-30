const express = require('express');
const router = express.Router();
const { sb } = require('../database/supabase');
const { authenticate, adminOnly } = require('../middleware/auth');

function calcEndDate(startDate, duration) {
  if (!startDate || !duration) return null;
  const d = new Date(startDate);
  if (duration === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (duration === 'weekly') d.setDate(d.getDate() + 7);
  else if (duration === 'daily') d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function flattenVehicle(v) {
  return {
    ...v,
    full_name:           v.clients?.full_name           || '',
    mobile:              v.clients?.mobile              || '',
    plan_name: v.subscription_plans?.name     || null,
    duration:  v.subscription_plans?.duration || null,
    plan_price: v.subscription_plans?.price   || null,
    clients: undefined,
    subscription_plans: undefined
  };
}

// ---- SPECIFIC ROUTES BEFORE PARAMETERIZED ----

router.get('/all/vehicles', authenticate, async (req, res) => {
  try {
    const { search, status } = req.query;

    // Fetch all clients (LEFT JOIN — we want clients even with no vehicles)
    const { data: clients } = await sb.from('clients')
      .select('id, full_name, mobile, notes')
      .order('full_name');

    // Fetch all vehicles
    let vehQuery = sb.from('client_vehicles')
      .select('*, subscription_plans(name, duration)');
    if (status) vehQuery = vehQuery.eq('status', status);
    const { data: vehicles } = await vehQuery;

    // Group vehicles by client_id
    const vehicleMap = {};
    (vehicles || []).forEach(v => {
      (vehicleMap[v.client_id] = vehicleMap[v.client_id] || []).push(v);
    });

    // Build rows: one per vehicle, or one placeholder row per client with no vehicles
    const rows = [];
    (clients || []).forEach(client => {
      const cvs = vehicleMap[client.id] || [];
      if (!cvs.length) {
        // Client with no vehicles — placeholder row
        rows.push({
          id:           null,
          client_id:    client.id,
          full_name:    client.full_name,
          mobile:       client.mobile || '',
          plate_number: null,
          vehicle_type: null,
          plan_name:    null,
          status:       'no_vehicle',
          amount:       null,
          currency:     'USD',
          start_date:   null
        });
      } else {
        cvs.forEach(v => rows.push({
          ...v,
          full_name:  client.full_name,
          mobile:     client.mobile || '',
          plan_name:  v.subscription_plans?.name     || null,
          duration:   v.subscription_plans?.duration || null,
          subscription_plans: undefined
        }));
      }
    });

    // Apply search (name, mobile, plate)
    let result = rows;
    if (search) {
      const s = search.toLowerCase();
      result = rows.filter(v =>
        (v.full_name    || '').toLowerCase().includes(s) ||
        (v.mobile       || '').toLowerCase().includes(s) ||
        (v.plate_number || '').toLowerCase().includes(s)
      );
    }

    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/vehicles/:vehicleId', authenticate, async (req, res) => {
  try {
    const { plate_number, vehicle_type, vehicle_model, subscription_plan_id, start_date, amount, status, currency } = req.body;
    let end_date = null;
    if (subscription_plan_id) {
      const { data: plan } = await sb.from('subscription_plans').select('duration').eq('id', subscription_plan_id).maybeSingle();
      if (plan) end_date = calcEndDate(start_date, plan.duration);
    }
    await sb.from('client_vehicles').update({
      plate_number, vehicle_type,
      vehicle_model: vehicle_model || '',
      subscription_plan_id: subscription_plan_id || null,
      start_date: start_date || null,
      end_date,
      amount: amount || 0,
      currency: currency || 'USD',
      status: status || 'active'
    }).eq('id', req.params.vehicleId);
    res.json({ message: 'Vehicle updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/vehicles/:vehicleId', authenticate, adminOnly, async (req, res) => {
  try {
    await sb.from('client_vehicles').delete().eq('id', req.params.vehicleId);
    res.json({ message: 'Vehicle deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- CLIENT CRUD ----

router.get('/', authenticate, async (req, res) => {
  try {
    const { search } = req.query;
    let query = sb.from('clients').select('*, client_vehicles(id)').order('full_name');
    if (search) query = query.or(`full_name.ilike.%${search}%,mobile.ilike.%${search}%`);
    const { data } = await query;
    const result = (data || []).map(c => ({
      ...c,
      vehicle_count: c.client_vehicles ? c.client_vehicles.length : 0,
      client_vehicles: undefined
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const { data: client } = await sb.from('clients').select('*').eq('id', req.params.id).maybeSingle();
    if (!client) return res.status(404).json({ error: 'Client not found' });
    const { data: vehicles } = await sb.from('client_vehicles')
      .select('*, subscription_plans(name, duration)')
      .eq('client_id', req.params.id);
    const mappedVehicles = (vehicles || []).map(v => ({
      ...v,
      plan_name: v.subscription_plans?.name     || null,
      duration:  v.subscription_plans?.duration || null,
      subscription_plans: undefined
    }));
    res.json({ ...client, vehicles: mappedVehicles });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { full_name, mobile, notes } = req.body;
    if (!full_name) return res.status(400).json({ error: 'Full name required' });
    const { data, error } = await sb.from('clients')
      .insert({ full_name, mobile: mobile || '', notes: notes || '' })
      .select('id').single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ id: data.id, message: 'Client created' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { full_name, mobile, notes } = req.body;
    await sb.from('clients').update({ full_name, mobile: mobile || '', notes: notes || '' }).eq('id', req.params.id);
    res.json({ message: 'Client updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    await sb.from('clients').delete().eq('id', req.params.id);
    res.json({ message: 'Client deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- VEHICLE ROUTES FOR A CLIENT ----

router.get('/:id/vehicles', authenticate, async (req, res) => {
  try {
    const { data } = await sb.from('client_vehicles')
      .select('*, subscription_plans(name, duration, price)')
      .eq('client_id', req.params.id);
    const result = (data || []).map(v => ({
      ...v,
      plan_name:  v.subscription_plans?.name     || null,
      duration:   v.subscription_plans?.duration || null,
      plan_price: v.subscription_plans?.price    || null,
      subscription_plans: undefined
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/vehicles', authenticate, async (req, res) => {
  try {
    const { plate_number, vehicle_type, vehicle_model, subscription_plan_id, start_date, amount, currency } = req.body;
    if (!plate_number || !vehicle_type) return res.status(400).json({ error: 'Plate number and vehicle type required' });

    const { data: existing } = await sb.from('client_vehicles').select('id').eq('plate_number', plate_number).maybeSingle();
    if (existing) return res.status(400).json({ error: 'Plate number already registered' });

    let end_date = null;
    if (subscription_plan_id) {
      const { data: plan } = await sb.from('subscription_plans').select('duration').eq('id', subscription_plan_id).maybeSingle();
      if (plan) end_date = calcEndDate(start_date, plan.duration);
    }

    const { data, error } = await sb.from('client_vehicles').insert({
      client_id: req.params.id,
      plate_number, vehicle_type,
      vehicle_model: vehicle_model || '',
      subscription_plan_id: subscription_plan_id || null,
      start_date: start_date || null,
      end_date,
      amount: amount || 0,
      currency: currency || 'USD'
    }).select('id').single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ id: data.id, message: 'Vehicle added', end_date });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
