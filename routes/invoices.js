const express = require('express');
const router = express.Router();
const { sb } = require('../database/supabase');
const { authenticate, adminOnly } = require('../middleware/auth');

function isMissingColumnError(err) {
  if (!err) return false;
  return err.code === '42703' || err.code === 'PGRST204' ||
    (err.message || '').includes('Could not find') ||
    (err.message || '').includes('schema cache');
}

async function nextInvoiceNumber() {
  const { data: settings } = await sb.from('settings').select('invoice_prefix').eq('id', 1).maybeSingle();
  const prefix = settings?.invoice_prefix || 'INV';
  const { data: allInvs } = await sb.from('invoices').select('invoice_number').ilike('invoice_number', `${prefix}-%`);
  let maxNum = 0;
  (allInvs || []).forEach(inv => {
    const num = parseInt(inv.invoice_number.substring(prefix.length + 1), 10);
    if (!isNaN(num) && num > maxNum) maxNum = num;
  });
  return `${prefix}-${String(maxNum + 1).padStart(5, '0')}`;
}

function flattenInvoice(i) {
  return {
    ...i,
    full_name:    i.clients?.full_name             || '',
    mobile:       i.clients?.mobile                || '',
    plate_number: i.client_vehicles?.plate_number  || '',
    vehicle_type: i.client_vehicles?.vehicle_type  || '',
    plan_name:    i.subscription_plans?.name       || null,
    clients:           undefined,
    client_vehicles:   undefined,
    subscription_plans: undefined
  };
}

// SPECIFIC ROUTES FIRST

router.get('/unpaid/subscriptions', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const dateFrom = req.query.date_from || new Date().toISOString().slice(0, 7) + '-01';
    const dateTo   = req.query.date_to   || today;
    const monthFrom = dateFrom.slice(0, 7);
    const monthTo   = dateTo.slice(0, 7);

    const { data: vehicles } = await sb.from('client_vehicles')
      .select('id, plate_number, vehicle_type, amount, currency, client_id, start_date, clients(id, full_name, mobile), subscription_plans(name)')
      .eq('status', 'active');

    if (!vehicles || !vehicles.length) return res.json([]);

    const vehicleIds = vehicles.map(v => v.id);
    const { data: invoices } = await sb.from('invoices')
      .select('id, vehicle_id, invoice_number, payment_status, final_amount, currency, due_date, invoice_month')
      .in('vehicle_id', vehicleIds);

    // Map invoices by vehicle_id + invoice_month
    const invoiceMap = {};
    (invoices || []).forEach(i => { invoiceMap[`${i.vehicle_id}:${i.invoice_month}`] = i; });

    const currentMonth = new Date().toISOString().slice(0, 7);
    const rows = vehicles
      .map(v => {
        const vehicleMonth = v.start_date ? v.start_date.slice(0, 7) : currentMonth;
        const inv = invoiceMap[`${v.id}:${vehicleMonth}`] || null;
        return {
          vehicle_id:     v.id,
          plate_number:   v.plate_number,
          vehicle_type:   v.vehicle_type,
          amount:         v.amount,
          client_id:      v.clients?.id,
          full_name:      v.clients?.full_name || '',
          mobile:         v.clients?.mobile    || '',
          plan_name:      v.subscription_plans?.name || null,
          invoice_id:     inv?.id             || null,
          invoice_number: inv?.invoice_number || null,
          payment_status: inv?.payment_status || null,
          final_amount:   inv?.final_amount   || null,
          due_date:       inv?.due_date       || null
        };
      })
      .filter(r => r.invoice_id && r.payment_status !== 'paid');

    rows.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/generate-monthly', authenticate, adminOnly, async (req, res) => {
  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 7); // current YYYY-MM
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonth = nextMonthDate.toISOString().slice(0, 7); // next YYYY-MM

    const { data: vehicles } = await sb.from('client_vehicles')
      .select('id, client_id, subscription_plan_id, amount, start_date, subscription_plans(price)')
      .eq('status', 'active');

    if (!vehicles || !vehicles.length) return res.json({ generated: 0, skipped: 0 });

    const vehicleIds = vehicles.map(v => v.id);

    // Fetch all existing invoices for these vehicles so we can skip duplicates per vehicle+month
    const { data: existing } = await sb.from('invoices')
      .select('vehicle_id, invoice_month')
      .in('vehicle_id', vehicleIds);
    const existingSet = new Set((existing || []).map(i => `${i.vehicle_id}:${i.invoice_month}`));

    const { data: settings } = await sb.from('settings').select('invoice_prefix').eq('id', 1).maybeSingle();
    const prefix = settings?.invoice_prefix || 'INV';
    const { data: allInvs } = await sb.from('invoices').select('invoice_number').ilike('invoice_number', `${prefix}-%`);
    let maxNum = 0;
    (allInvs || []).forEach(inv => {
      const num = parseInt(inv.invoice_number.substring(prefix.length + 1), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    });

    let generated = 0, skipped = 0;
    const toInsert = [];

    for (const v of vehicles) {
      const invoice_month = v.start_date ? v.start_date.slice(0, 7) : today;
      // Only generate if vehicle's start_date is this month or later (not past)
      if (invoice_month < today) { skipped++; continue; }
      if (existingSet.has(`${v.id}:${invoice_month}`)) { skipped++; continue; }
      maxNum++;
      const inv_num = `${prefix}-${String(maxNum).padStart(5, '0')}`;
      const amount = Number(v.amount) || Number(v.subscription_plans?.price) || 0;
      toInsert.push({
        invoice_number: inv_num,
        client_id: v.client_id,
        vehicle_id: v.id,
        subscription_plan_id: v.subscription_plan_id,
        invoice_month,
        amount,
        discount: 0,
        final_amount: amount,
        due_date: v.start_date ? v.start_date.slice(0, 7) + '-28' : `${today}-28`,
        payment_status: 'unpaid'
      });
      generated++;
    }

    if (toInsert.length) await sb.from('invoices').insert(toInsert);
    res.json({ generated, skipped });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// LIST invoices
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, invoice_month, payment_status, client_id } = req.query;
    let query = sb.from('invoices')
      .select('*, clients(full_name, mobile), client_vehicles(plate_number, vehicle_type), subscription_plans(name)')
      .order('created_at', { ascending: false });
    if (invoice_month)  query = query.eq('invoice_month', invoice_month);
    if (payment_status) query = query.eq('payment_status', payment_status);
    if (client_id)      query = query.eq('client_id', client_id);
    const { data } = await query;

    let result = (data || []).map(flattenInvoice);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(i =>
        (i.invoice_number || '').toLowerCase().includes(s) ||
        (i.full_name      || '').toLowerCase().includes(s) ||
        (i.plate_number   || '').toLowerCase().includes(s)
      );
    }
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single invoice
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { data: inv } = await sb.from('invoices')
      .select('*, clients(full_name, mobile), client_vehicles(plate_number, vehicle_type), subscription_plans(name)')
      .eq('id', req.params.id).maybeSingle();
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    const { data: settings } = await sb.from('settings').select('*').eq('id', 1).maybeSingle();
    res.json({ ...flattenInvoice(inv), settings });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { client_id, vehicle_id, subscription_plan_id, invoice_month, amount, discount, due_date, payment_status, payment_date, payment_method, notes, currency, paid_amount } = req.body;
    if (!client_id || !vehicle_id || !invoice_month || amount == null) return res.status(400).json({ error: 'Required fields missing' });

    const { data: existing } = await sb.from('invoices').select('id').eq('vehicle_id', vehicle_id).eq('invoice_month', invoice_month).maybeSingle();
    if (existing) return res.status(400).json({ error: 'Invoice already exists for this vehicle and month' });

    const inv_num = await nextInvoiceNumber();
    const { is_prorated, prorated_start_date, final_amount: final_amount_body } = req.body;
    // Allow caller to pass pre-calculated final_amount (e.g. prorated), else compute
    const final_amount = (Number(final_amount_body) > 0) ? Number(final_amount_body) : (Number(amount) || 0) - (Number(discount) || 0);
    const paidAmt = Number(paid_amount) || 0;
    // Auto-determine payment status from amounts
    let ps = final_amount > 0 && paidAmt >= final_amount ? 'paid'
           : paidAmt > 0 ? 'partially_paid'
           : (payment_status || 'unpaid');
    const resolved_paid = ps === 'paid' ? final_amount : paidAmt;

    const baseInsert = {
      invoice_number: inv_num, client_id, vehicle_id,
      subscription_plan_id: (subscription_plan_id && subscription_plan_id !== 'null') ? Number(subscription_plan_id) : null,
      invoice_month, amount, discount: discount || 0, final_amount,
      due_date: due_date || null,
      payment_status: ps,
      payment_date: payment_date || null,
      payment_method: payment_method || 'cash',
      notes: notes || '',
      currency: currency || 'USD',
      is_prorated: !!is_prorated,
      prorated_start_date: prorated_start_date || null
    };

    // Try with all optional columns; strip all that don't exist in the DB yet
    let { data, error } = await sb.from('invoices').insert({ ...baseInsert, paid_amount: resolved_paid }).select('id').single();
    if (isMissingColumnError(error)) {
      const { currency: _c, is_prorated: _ip, prorated_start_date: _psd, paid_amount: _pa, ...safeInsert } = { ...baseInsert, paid_amount: resolved_paid };
      ({ data, error } = await sb.from('invoices').insert(safeInsert).select('id').single());
    }
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ id: data.id, invoice_number: inv_num });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { amount, discount, due_date, invoice_month, payment_status, payment_date, payment_method, notes, currency, paid_amount, is_prorated, prorated_start_date, final_amount: final_amount_body } = req.body;
    // Use provided final_amount (e.g. prorated) or compute from amount - discount
    const final_amount = (Number(final_amount_body) > 0) ? Number(final_amount_body) : (Number(amount) || 0) - (Number(discount) || 0);
    const paidAmt = Number(paid_amount) || 0;
    // Auto-determine payment status from amounts
    let ps = final_amount > 0 && paidAmt >= final_amount ? 'paid'
           : paidAmt > 0 ? 'partially_paid'
           : (payment_status || 'unpaid');
    const resolved_paid = ps === 'paid' ? final_amount : paidAmt;

    const baseFields = {
      amount: amount || 0, discount: discount || 0, final_amount,
      ...(invoice_month ? { invoice_month } : {}),
      due_date: due_date || null,
      payment_status: ps,
      payment_date: payment_date || null,
      payment_method: payment_method || 'cash',
      notes: notes || '',
      currency: currency || 'USD',
      is_prorated: !!is_prorated,
      prorated_start_date: prorated_start_date || null
    };

    // Try with all optional columns; strip all that don't exist in the DB yet
    let result = await sb.from('invoices').update({ ...baseFields, paid_amount: resolved_paid }).eq('id', req.params.id);
    if (isMissingColumnError(result.error)) {
      const { currency: _c, is_prorated: _ip, prorated_start_date: _psd, paid_amount: _pa, ...safeFields } = { ...baseFields, paid_amount: resolved_paid };
      result = await sb.from('invoices').update(safeFields).eq('id', req.params.id);
    }
    if (result.error) return res.status(400).json({ error: result.error.message });
    res.json({ message: 'Invoice updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    await sb.from('invoices').delete().eq('id', req.params.id);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
