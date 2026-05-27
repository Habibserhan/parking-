const express = require('express');
const router = express.Router();
const { sb } = require('../database/supabase');
const { authenticate } = require('../middleware/auth');

function sum(arr, key) { return arr.reduce((s, r) => s + (Number(r[key]) || 0), 0); }


router.get('/', authenticate, async (req, res) => {
  try {
    const mode = req.query.mode || 'date';
    const date  = req.query.date || new Date().toISOString().slice(0, 10);
    const month = date.slice(0, 7);
    const dayStart = `${date}T00:00:00`;
    const dayEnd   = `${date}T23:59:59`;
    const all = mode === 'all';

    let parkQ      = sb.from('daily_parking').select('amount').eq('payment_status', 'paid');
    let svcQ       = sb.from('service_transactions').select('final_amount').eq('payment_status', 'paid');
    let expQ       = sb.from('expenses').select('amount');
    let invQ       = sb.from('invoices').select('final_amount').eq('payment_status', 'paid');
    let unpaidInvQ = sb.from('invoices').select('id').eq('payment_status', 'unpaid');

    if (!all) {
      parkQ      = parkQ.gte('entry_time', dayStart).lte('entry_time', dayEnd);
      svcQ       = svcQ.eq('service_date', date);
      expQ       = expQ.eq('expense_date', date);
      invQ       = invQ.eq('invoice_month', month);
      unpaidInvQ = unpaidInvQ.eq('invoice_month', month);
    }

    let activeQ      = sb.from('client_vehicles').select('id').lte('start_date', date);
    let parkedQ      = sb.from('daily_parking').select('id');
    let thirdPartyQ  = sb.from('daily_parking').select('id').not('third_party_company', 'is', null);

    if (all) {
      activeQ     = sb.from('client_vehicles').select('id').eq('status', 'active');
      parkedQ     = parkedQ.eq('parking_status', 'parked');
      thirdPartyQ = thirdPartyQ.eq('parking_status', 'parked');
    } else {
      activeQ     = activeQ.or(`end_date.gte.${date},end_date.is.null`);
      parkedQ     = parkedQ.gte('entry_time', dayStart).lte('entry_time', dayEnd);
      thirdPartyQ = thirdPartyQ.gte('entry_time', dayStart).lte('entry_time', dayEnd);
    }

    const [paidInvResult, parkResult, svcResult, expResult, activeVehicleResult, unpaidInvResult, parkedResult, thirdPartyResult] = await Promise.all([
      invQ,
      parkQ,
      svcQ,
      expQ,
      activeQ,
      unpaidInvQ,
      parkedQ,
      thirdPartyQ
    ]);

    const subRevenue      = sum(paidInvResult.data || [], 'final_amount');
    const parkingRevenue  = sum(parkResult.data    || [], 'amount');
    const servicesRevenue = sum(svcResult.data     || [], 'final_amount');
    const totalRevenue    = subRevenue + parkingRevenue + servicesRevenue;
    const totalExpenses   = sum(expResult.data     || [], 'amount');
    const netProfit       = totalRevenue - totalExpenses;

    const activeClients    = (activeVehicleResult.data || []).length;
    const unpaidClients    = (unpaidInvResult.data || []).length;
    const currentlyParked  = (parkedResult.data || []).length;
    const thirdPartyParked = (thirdPartyResult.data || []).length;

    res.json({
      stats: { totalRevenue, subRevenue, parkingRevenue, servicesRevenue, totalExpenses, netProfit, activeClients, unpaidClients, currentlyParked, thirdPartyParked }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/details', authenticate, async (req, res) => {
  try {
    const { type, date, mode } = req.query;
    const d        = date || new Date().toISOString().slice(0, 10);
    const month    = d.slice(0, 7);
    const dayStart = `${d}T00:00:00`;
    const dayEnd   = `${d}T23:59:59`;
    const all = mode === 'all';

    if (type === 'sub-revenue') {
      let q = sb.from('invoices')
        .select('invoice_number, final_amount, currency, invoice_month, clients(full_name, mobile), client_vehicles(plate_number, vehicle_type), subscription_plans(name)')
        .eq('payment_status', 'paid').order('final_amount', { ascending: false });
      if (!all) q = q.eq('invoice_month', month);
      const { data } = await q;
      return res.json(data || []);
    }

    if (type === 'parking-revenue') {
      let q = sb.from('daily_parking')
        .select('plate_number, vehicle_type, entry_time, exit_time, duration_minutes, amount, currency, third_party_company')
        .eq('payment_status', 'paid').order('entry_time', { ascending: false });
      if (!all) q = q.gte('entry_time', dayStart).lte('entry_time', dayEnd);
      const { data } = await q;
      return res.json(data || []);
    }

    if (type === 'services-revenue') {
      let q = sb.from('service_transactions')
        .select('service_date, final_amount, currency, services(name), clients(full_name)')
        .eq('payment_status', 'paid').order('service_date', { ascending: false });
      if (!all) q = q.eq('service_date', d);
      const { data } = await q;
      return res.json(data || []);
    }

    if (type === 'expenses') {
      let q = sb.from('expenses')
        .select('title, expense_type, amount, currency, expense_date, paid_to, payment_method')
        .order('expense_date', { ascending: false });
      if (!all) q = q.eq('expense_date', d);
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
        q = q.lte('start_date', d).or(`end_date.gte.${d},end_date.is.null`);
      }
      const { data } = await q;
      return res.json(data || []);
    }

    if (type === 'unpaid-subscribers') {
      let q = sb.from('invoices')
        .select('invoice_number, final_amount, currency, invoice_month, due_date, clients(full_name, mobile), client_vehicles(plate_number, vehicle_type), subscription_plans(name)')
        .eq('payment_status', 'unpaid').order('due_date', { ascending: true });
      if (!all) q = q.eq('invoice_month', month);
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
