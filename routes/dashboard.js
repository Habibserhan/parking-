const express = require('express');
const router = express.Router();
const { sb } = require('../database/supabase');
const { authenticate } = require('../middleware/auth');

function sum(arr, key) { return arr.reduce((s, r) => s + (Number(r[key]) || 0), 0); }


router.get('/', authenticate, async (req, res) => {
  try {
    const date  = req.query.date  || new Date().toISOString().slice(0, 10);
    const month = date.slice(0, 7);
    const dayStart = `${date}T00:00:00`;
    const dayEnd   = `${date}T23:59:59`;

    // Run all data fetches in parallel
    const [
      paidInvResult,
      parkResult,
      svcResult,
      expResult,
      activeVehicleResult,
      paidThisMonthResult,
      parkedResult
    ] = await Promise.all([
      // Subscription revenue this month (invoices are monthly)
      sb.from('invoices').select('final_amount').eq('invoice_month', month).eq('payment_status', 'paid'),
      // Parking revenue this day
      sb.from('daily_parking').select('amount').eq('payment_status', 'paid').gte('entry_time', dayStart).lte('entry_time', dayEnd),
      // Service revenue this day
      sb.from('service_transactions').select('final_amount').eq('payment_status', 'paid').eq('service_date', date),
      // Expenses this day
      sb.from('expenses').select('amount').eq('expense_date', date),
      // Active vehicles (for count + unpaid calc)
      sb.from('client_vehicles').select('id').eq('status', 'active'),
      // Paid invoices this month (to calc unpaid)
      sb.from('invoices').select('vehicle_id').eq('invoice_month', month).eq('payment_status', 'paid'),
      // Currently parked
      sb.from('daily_parking').select('id').eq('parking_status', 'parked')
    ]);

    const subRevenue      = sum(paidInvResult.data || [], 'final_amount');
    const parkingRevenue  = sum(parkResult.data    || [], 'amount');
    const servicesRevenue = sum(svcResult.data     || [], 'final_amount');
    const totalRevenue    = subRevenue + parkingRevenue + servicesRevenue;
    const totalExpenses   = sum(expResult.data     || [], 'amount');
    const netProfit       = totalRevenue - totalExpenses;

    const activeVehicleIds = (activeVehicleResult.data || []).map(v => v.id);
    const activeClients    = activeVehicleIds.length;

    const paidVehicleIds = new Set((paidThisMonthResult.data || []).map(i => i.vehicle_id));
    const unpaidClients  = activeVehicleIds.filter(id => !paidVehicleIds.has(id)).length;

    const currentlyParked = (parkedResult.data || []).length;

    res.json({
      stats: { totalRevenue, subRevenue, parkingRevenue, servicesRevenue, totalExpenses, netProfit, activeClients, unpaidClients, currentlyParked }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/details', authenticate, async (req, res) => {
  try {
    const { type, date } = req.query;
    const d = date || new Date().toISOString().slice(0, 10);
    const month = d.slice(0, 7);
    const dayStart = `${d}T00:00:00`;
    const dayEnd   = `${d}T23:59:59`;

    if (type === 'sub-revenue') {
      const { data } = await sb.from('invoices')
        .select('invoice_number, final_amount, currency, invoice_month, clients(full_name, mobile), client_vehicles(plate_number, vehicle_type), subscription_plans(name)')
        .eq('invoice_month', month).eq('payment_status', 'paid').order('final_amount', { ascending: false });
      return res.json(data || []);
    }

    if (type === 'parking-revenue') {
      const { data } = await sb.from('daily_parking')
        .select('plate_number, vehicle_type, entry_time, exit_time, duration_minutes, amount, currency, third_party_company')
        .eq('payment_status', 'paid')
        .gte('entry_time', dayStart).lte('entry_time', dayEnd)
        .order('entry_time', { ascending: false });
      return res.json(data || []);
    }

    if (type === 'services-revenue') {
      const { data } = await sb.from('service_transactions')
        .select('service_date, final_amount, currency, services(name), clients(full_name)')
        .eq('payment_status', 'paid').eq('service_date', d)
        .order('service_date', { ascending: false });
      return res.json(data || []);
    }

    if (type === 'expenses') {
      const { data } = await sb.from('expenses')
        .select('title, expense_type, amount, currency, expense_date, paid_to, payment_method')
        .eq('expense_date', d)
        .order('expense_date', { ascending: false });
      return res.json(data || []);
    }

    if (type === 'active-subscribers') {
      const { data } = await sb.from('client_vehicles')
        .select('plate_number, vehicle_type, amount, currency, clients(full_name, mobile), subscription_plans(name)')
        .eq('status', 'active').order('plate_number');
      return res.json(data || []);
    }

    if (type === 'unpaid-subscribers') {
      const { data: vehicles } = await sb.from('client_vehicles')
        .select('id, plate_number, vehicle_type, amount, currency, clients(full_name, mobile), subscription_plans(name)')
        .eq('status', 'active');
      const { data: paidInvs } = await sb.from('invoices')
        .select('vehicle_id').eq('invoice_month', month).eq('payment_status', 'paid');
      const paidSet = new Set((paidInvs || []).map(i => i.vehicle_id));
      return res.json((vehicles || []).filter(v => !paidSet.has(v.id)));
    }

    if (type === 'currently-parked') {
      const { data } = await sb.from('daily_parking')
        .select('plate_number, vehicle_type, entry_time, notes, third_party_company')
        .eq('parking_status', 'parked').order('entry_time', { ascending: false });
      return res.json(data || []);
    }

    res.status(400).json({ error: 'Unknown type' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
