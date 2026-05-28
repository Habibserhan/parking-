const express = require('express');
const router = express.Router();
const { sb } = require('../database/supabase');
const { authenticate } = require('../middleware/auth');

function sum(arr, key) { return arr.reduce((s, r) => s + (Number(r[key]) || 0), 0); }


router.get('/', authenticate, async (req, res) => {
  try {
    const mode    = req.query.mode || 'date';
    const todayStr = new Date().toISOString().slice(0, 10);
    const dateFrom = req.query.date_from || req.query.date || todayStr;
    const dateTo   = req.query.date_to   || dateFrom;
    const monthFrom = dateFrom.slice(0, 7);
    const monthTo   = dateTo.slice(0, 7);
    const dayStart  = `${dateFrom}T00:00:00`;
    const dayEnd    = `${dateTo}T23:59:59`;
    const all = mode === 'all';

    let parkQ      = sb.from('daily_parking').select('amount, currency').eq('parking_status', 'completed').eq('payment_status', 'paid');
    let svcQ       = sb.from('service_transactions').select('final_amount, currency').eq('payment_status', 'paid');
    let expQ       = sb.from('expenses').select('amount, currency');
    let invQ       = sb.from('invoices').select('final_amount, currency');
    let unpaidInvQ = sb.from('invoices').select('id').eq('payment_status', 'unpaid');

    if (!all) {
      parkQ      = parkQ.gte('entry_time', dayStart).lte('entry_time', dayEnd);
      svcQ       = svcQ.gte('service_date', dateFrom).lte('service_date', dateTo);
      expQ       = expQ.gte('expense_date', dateFrom).lte('expense_date', dateTo);
      invQ       = invQ.gte('invoice_month', monthFrom).lte('invoice_month', monthTo);
      unpaidInvQ = unpaidInvQ.gte('invoice_month', monthFrom).lte('invoice_month', monthTo);
    }

    let activeQ      = sb.from('client_vehicles').select('id').lte('start_date', dateTo);
    let parkedQ      = sb.from('daily_parking').select('id');
    let thirdPartyQ  = sb.from('daily_parking').select('id').not('third_party_company', 'is', null);

    if (all) {
      activeQ     = sb.from('client_vehicles').select('id').eq('status', 'active');
      parkedQ     = parkedQ.eq('parking_status', 'parked');
      thirdPartyQ = thirdPartyQ.eq('parking_status', 'parked');
    } else {
      activeQ     = activeQ.or(`end_date.gte.${dateFrom},end_date.is.null`);
      parkedQ     = parkedQ.gte('entry_time', dayStart).lte('entry_time', dayEnd);
      thirdPartyQ = thirdPartyQ.gte('entry_time', dayStart).lte('entry_time', dayEnd);
    }

    const [paidInvResult, parkResult, svcResult, expResult, activeVehicleResult, unpaidInvResult, parkedResult, thirdPartyResult, settingsResult] = await Promise.all([
      invQ,
      parkQ,
      svcQ,
      expQ,
      activeQ,
      unpaidInvQ,
      parkedQ,
      thirdPartyQ,
      sb.from('settings').select('custom_rates').eq('id', 1).maybeSingle()
    ]);

    // Build currency multiplier map from settings (daily_parking.amount is stored ÷ multiplier)
    let currencyMultipliers = { LBP: 1000 };
    try {
      const cr = JSON.parse(settingsResult.data?.custom_rates || '{}');
      Object.entries(cr).forEach(([k, v]) => {
        if (!k.startsWith('__') && typeof v === 'object' && v !== null && v.multiplier) {
          currencyMultipliers[k] = v.multiplier;
        }
      });
    } catch {}

    const byCur = (arr, key) => arr.reduce((acc, r) => {
      const cur = r.currency || 'USD';
      acc[cur] = (acc[cur] || 0) + (Number(r[key]) || 0);
      return acc;
    }, {});

    // daily_parking.amount is stored as base units (÷ multiplier on save) — normalize to raw values
    const normalizedParkingData = (parkResult.data || []).map(r => ({
      currency: r.currency,
      amount: (Number(r.amount) || 0) * (currencyMultipliers[r.currency || 'USD'] || 1)
    }));

    const subRevenueByCurrency      = byCur(paidInvResult.data || [], 'final_amount');
    const parkingRevenueByCurrency  = byCur(normalizedParkingData, 'amount');
    const servicesRevenueByCurrency = byCur(svcResult.data     || [], 'final_amount');
    const expensesByCurrency        = byCur(expResult.data     || [], 'amount');

    const allCurs = new Set([
      ...Object.keys(subRevenueByCurrency),
      ...Object.keys(parkingRevenueByCurrency),
      ...Object.keys(servicesRevenueByCurrency),
      ...Object.keys(expensesByCurrency)
    ]);
    const totalRevenueByCurrency = {}, netProfitByCurrency = {};
    for (const cur of allCurs) {
      totalRevenueByCurrency[cur] = (subRevenueByCurrency[cur] || 0) + (parkingRevenueByCurrency[cur] || 0) + (servicesRevenueByCurrency[cur] || 0);
      netProfitByCurrency[cur]    = totalRevenueByCurrency[cur] - (expensesByCurrency[cur] || 0);
    }

    const activeClients    = (activeVehicleResult.data || []).length;
    const unpaidClients    = (unpaidInvResult.data || []).length;
    const currentlyParked  = (parkedResult.data || []).length;
    const thirdPartyParked = (thirdPartyResult.data || []).length;

    res.json({
      stats: { totalRevenueByCurrency, subRevenueByCurrency, parkingRevenueByCurrency, servicesRevenueByCurrency, expensesByCurrency, netProfitByCurrency, activeClients, unpaidClients, currentlyParked, thirdPartyParked }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/details', authenticate, async (req, res) => {
  try {
    const { type, mode } = req.query;
    const todayStr  = new Date().toISOString().slice(0, 10);
    const dateFrom  = req.query.date_from || req.query.date || todayStr;
    const dateTo    = req.query.date_to   || dateFrom;
    const monthFrom = dateFrom.slice(0, 7);
    const monthTo   = dateTo.slice(0, 7);
    const dayStart  = `${dateFrom}T00:00:00`;
    const dayEnd    = `${dateTo}T23:59:59`;
    const all = mode === 'all';

    if (type === 'sub-revenue') {
      let q = sb.from('invoices')
        .select('invoice_number, final_amount, currency, invoice_month, payment_status, clients(full_name, mobile), client_vehicles(plate_number, vehicle_type), subscription_plans(name)')
        .order('final_amount', { ascending: false });
      if (!all) q = q.gte('invoice_month', monthFrom).lte('invoice_month', monthTo);
      const { data } = await q;
      return res.json(data || []);
    }

    if (type === 'parking-revenue') {
      let q = sb.from('daily_parking')
        .select('plate_number, vehicle_type, entry_time, exit_time, duration_minutes, amount, currency, third_party_company, card_number')
        .eq('parking_status', 'completed').eq('payment_status', 'paid').order('entry_time', { ascending: false });
      if (!all) q = q.gte('entry_time', dayStart).lte('entry_time', dayEnd);
      const { data } = await q;
      return res.json(data || []);
    }

    if (type === 'services-revenue') {
      let q = sb.from('service_transactions')
        .select('service_date, final_amount, currency, services(name), clients(full_name)')
        .eq('payment_status', 'paid').order('service_date', { ascending: false });
      if (!all) q = q.gte('service_date', dateFrom).lte('service_date', dateTo);
      const { data } = await q;
      return res.json(data || []);
    }

    if (type === 'expenses') {
      let q = sb.from('expenses')
        .select('title, expense_type, amount, currency, expense_date, paid_to, payment_method')
        .order('expense_date', { ascending: false });
      if (!all) q = q.gte('expense_date', dateFrom).lte('expense_date', dateTo);
      const { data } = await q;
      return res.json(data || []);
    }

    if (type === 'active-subscribers') {
      let q = sb.from('client_vehicles')
        .select('plate_number, vehicle_type, amount, currency, start_date, end_date, clients(full_name, mobile), subscription_plans(name)')
        .order('plate_number');
      if (all) {
        q = q.eq('status', 'active');
      } else {
        q = q.lte('start_date', dateTo).or(`end_date.gte.${dateFrom},end_date.is.null`);
      }
      const { data } = await q;
      return res.json(data || []);
    }

    if (type === 'unpaid-subscribers') {
      let q = sb.from('invoices')
        .select('invoice_number, final_amount, currency, invoice_month, due_date, clients(full_name, mobile), client_vehicles(plate_number, vehicle_type), subscription_plans(name)')
        .eq('payment_status', 'unpaid').order('due_date', { ascending: true });
      if (!all) q = q.gte('invoice_month', monthFrom).lte('invoice_month', monthTo);
      const { data } = await q;
      return res.json(data || []);
    }

    if (type === 'currently-parked') {
      let q = sb.from('daily_parking')
        .select('plate_number, vehicle_type, entry_time, exit_time, parking_status, notes, third_party_company')
        .order('entry_time', { ascending: false });
      if (all) {
        q = q.eq('parking_status', 'parked');
      } else {
        q = q.gte('entry_time', dayStart).lte('entry_time', dayEnd);
      }
      const { data } = await q;
      return res.json(data || []);
    }

    if (type === 'third-party-parked') {
      let q = sb.from('daily_parking')
        .select('plate_number, vehicle_type, entry_time, exit_time, parking_status, notes, third_party_company')
        .not('third_party_company', 'is', null)
        .order('entry_time', { ascending: false });
      if (all) {
        q = q.eq('parking_status', 'parked');
      } else {
        q = q.gte('entry_time', dayStart).lte('entry_time', dayEnd);
      }
      const { data } = await q;
      return res.json(data || []);
    }

    res.status(400).json({ error: 'Unknown type' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
