const express = require('express');
const router = express.Router();
const { sb } = require('../database/supabase');
const { authenticate } = require('../middleware/auth');

function sum(arr, key) { return arr.reduce((s, r) => s + (Number(r[key]) || 0), 0); }

function getMonthBounds(month) {
  const [year, mon] = month.split('-').map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  return {
    start: `${month}-01`,
    end:   `${month}-${String(lastDay).padStart(2, '0')}`
  };
}

function twelveMonthsAgoStr() {
  const d = new Date();
  d.setMonth(d.getMonth() - 11);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

router.get('/', authenticate, async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const { start: monthStart, end: monthEnd } = getMonthBounds(month);
    const today = new Date().toISOString().slice(0, 10);
    const oldestMonth = twelveMonthsAgoStr();

    // Run all data fetches in parallel
    const [
      paidInvResult,
      parkResult,
      svcResult,
      expResult,
      activeVehicleResult,
      paidThisMonthResult,
      parkedResult,
      revByMonthResult,
      expByMonthResult,
      parkByMonthResult,
      svcByTypeResult
    ] = await Promise.all([
      // Subscription revenue this month
      sb.from('invoices').select('final_amount').eq('invoice_month', month).eq('payment_status', 'paid'),
      // Parking revenue this month
      sb.from('daily_parking').select('amount').eq('payment_status', 'paid').gte('entry_time', `${monthStart}T00:00:00`).lte('entry_time', `${monthEnd}T23:59:59`),
      // Service revenue this month
      sb.from('service_transactions').select('final_amount').eq('payment_status', 'paid').gte('service_date', monthStart).lte('service_date', monthEnd),
      // Expenses this month
      sb.from('expenses').select('amount').gte('expense_date', monthStart).lte('expense_date', monthEnd),
      // Active vehicles (for count + unpaid calc)
      sb.from('client_vehicles').select('id').eq('status', 'active'),
      // Paid invoices this month (to calc unpaid)
      sb.from('invoices').select('vehicle_id').eq('invoice_month', month).eq('payment_status', 'paid'),
      // Currently parked
      sb.from('daily_parking').select('id').eq('parking_status', 'parked'),
      // Revenue chart: invoices last 12 months
      sb.from('invoices').select('invoice_month, final_amount').eq('payment_status', 'paid').gte('invoice_month', oldestMonth),
      // Expenses chart: last 12 months
      sb.from('expenses').select('expense_date, amount').gte('expense_date', `${oldestMonth}-01`),
      // Parking chart: last 12 months
      sb.from('daily_parking').select('entry_time, amount').eq('payment_status', 'paid').gte('entry_time', `${oldestMonth}-01T00:00:00`),
      // Services by type this month
      sb.from('service_transactions').select('final_amount, services(name)').eq('payment_status', 'paid').gte('service_date', monthStart).lte('service_date', monthEnd).not('service_id', 'is', null)
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

    // Revenue by month chart
    const revMap = {};
    (revByMonthResult.data || []).forEach(i => {
      revMap[i.invoice_month] = (revMap[i.invoice_month] || 0) + Number(i.final_amount);
    });
    const revenueByMonth = Object.entries(revMap)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Expenses by month chart
    const expMap = {};
    (expByMonthResult.data || []).forEach(e => {
      const m = (e.expense_date || '').slice(0, 7);
      if (m) expMap[m] = (expMap[m] || 0) + Number(e.amount);
    });
    const expensesByMonth = Object.entries(expMap)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Parking by month chart
    const parkMap = {};
    (parkByMonthResult.data || []).forEach(p => {
      const m = (p.entry_time || '').slice(0, 7);
      if (m) parkMap[m] = (parkMap[m] || 0) + Number(p.amount);
    });
    const parkingByMonth = Object.entries(parkMap)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Services by type chart
    const svcMap = {};
    (svcByTypeResult.data || []).forEach(st => {
      const name = st.services?.name || 'Unknown';
      svcMap[name] = (svcMap[name] || 0) + Number(st.final_amount);
    });
    const servicesByType = Object.entries(svcMap).map(([name, amount]) => ({ name, amount }));

    res.json({
      stats: { totalRevenue, subRevenue, parkingRevenue, servicesRevenue, totalExpenses, netProfit, activeClients, unpaidClients, currentlyParked },
      charts: { revenueByMonth, expensesByMonth, parkingByMonth, servicesByType }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
