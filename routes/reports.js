const express = require('express');
const router = express.Router();
const { sb } = require('../database/supabase');
const { authenticate } = require('../middleware/auth');

function todayStr() { return new Date().toISOString().slice(0, 10); }
function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function sum(arr, key) { return arr.reduce((s, r) => s + (Number(r[key]) || 0), 0); }

router.get('/revenue', authenticate, async (req, res) => {
  try {
    const from = req.query.date_from || monthStartStr();
    const to   = req.query.date_to   || todayStr();

    const { data: invData }  = await sb.from('invoices').select('final_amount').eq('payment_status', 'paid').gte('invoice_month', from.slice(0,7)).lte('invoice_month', to.slice(0,7));
    const { data: parkData } = await sb.from('daily_parking').select('amount').eq('payment_status', 'paid').gte('entry_time', `${from}T00:00:00`).lte('entry_time', `${to}T23:59:59`);
    const { data: svcData }  = await sb.from('service_transactions').select('final_amount, tip_amount').eq('payment_status', 'paid').gte('service_date', from).lte('service_date', to);
    const { data: expData }  = await sb.from('expenses').select('amount').gte('expense_date', from).lte('expense_date', to);

    const sub  = sum(invData  || [], 'final_amount');
    const park = sum(parkData || [], 'amount');
    const svcBase = sum(svcData || [], 'final_amount');
    const tips    = sum(svcData || [], 'tip_amount');
    const svc     = svcBase + tips;
    const exp  = sum(expData  || [], 'amount');
    res.json({ subscriptions: sub, parking: park, services: svc, tips, total: sub + park + svc, expenses: exp, profit: sub + park + svc - exp });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/daily-parking', authenticate, async (req, res) => {
  try {
    const from = req.query.date_from || todayStr();
    const to   = req.query.date_to   || todayStr();
    const { data } = await sb.from('daily_parking').select('*').gte('entry_time', `${from}T00:00:00`).lte('entry_time', `${to}T23:59:59`).order('entry_time', { ascending: false });
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/subscriptions', authenticate, async (req, res) => {
  try {
    const { date_from, date_to, status } = req.query;
    let query = sb.from('client_vehicles').select('*, clients(full_name, mobile), subscription_plans(name)');
    if (date_from) query = query.gte('start_date', date_from);
    if (date_to)   query = query.lte('start_date', date_to);
    if (status)    query = query.eq('status', status);
    const { data } = await query;
    const result = (data || []).map(v => ({
      ...v,
      full_name: v.clients?.full_name || '',
      mobile:    v.clients?.mobile    || '',
      plan_name: v.subscription_plans?.name || null,
      clients: undefined, subscription_plans: undefined
    })).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/services', authenticate, async (req, res) => {
  try {
    const from = req.query.date_from || monthStartStr();
    const to   = req.query.date_to   || todayStr();
    const { data } = await sb.from('service_transactions').select('*, services(name)').gte('service_date', from).lte('service_date', to).order('service_date', { ascending: false });
    const result = (data || []).map(st => ({ ...st, service_name: st.services?.name || null, services: undefined }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/expenses', authenticate, async (req, res) => {
  try {
    const from = req.query.date_from || monthStartStr();
    const to   = req.query.date_to   || todayStr();
    let query = sb.from('expenses').select('*').gte('expense_date', from).lte('expense_date', to).order('expense_date', { ascending: false });
    if (req.query.expense_type) query = query.eq('expense_type', req.query.expense_type);
    const { data } = await query;
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/unpaid-invoices', authenticate, async (req, res) => {
  try {
    const { data } = await sb.from('invoices')
      .select('*, clients(full_name, mobile), client_vehicles(plate_number)')
      .neq('payment_status', 'paid')
      .order('due_date', { ascending: true });
    const result = (data || []).map(i => ({
      ...i,
      full_name:    i.clients?.full_name            || '',
      mobile:       i.clients?.mobile               || '',
      plate_number: i.client_vehicles?.plate_number || '',
      clients: undefined, client_vehicles: undefined
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/partial-invoices', authenticate, async (req, res) => {
  try {
    const { data } = await sb.from('invoices')
      .select('invoice_number, invoice_month, final_amount, paid_amount, currency, payment_status, due_date, clients(full_name, mobile), client_vehicles(plate_number)')
      .neq('payment_status', 'paid')
      .order('due_date', { ascending: true });
    const result = (data || []).map(i => {
      const invoiceTotal = Number(i.final_amount) || 0;
      const paidAmt      = Number(i.paid_amount)  || 0;
      return {
        invoice_number: i.invoice_number,
        invoice_month:  i.invoice_month,
        invoice_total:  invoiceTotal,
        paid_amount:    paidAmt,
        remaining:      invoiceTotal - paidAmt,
        currency:       i.currency,
        payment_status: i.payment_status,
        due_date:       i.due_date,
        full_name:      i.clients?.full_name            || '',
        mobile:         i.clients?.mobile               || '',
        plate_number:   i.client_vehicles?.plate_number || ''
      };
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/active-clients', authenticate, async (req, res) => {
  try {
    const { data } = await sb.from('client_vehicles')
      .select('*, clients(full_name, mobile), subscription_plans(name)')
      .eq('status', 'active');
    const result = (data || []).map(v => ({
      ...v,
      full_name: v.clients?.full_name || '',
      mobile:    v.clients?.mobile    || '',
      plan_name: v.subscription_plans?.name || null,
      clients: undefined, subscription_plans: undefined
    })).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/tips', authenticate, async (req, res) => {
  try {
    const from = req.query.date_from || monthStartStr();
    const to   = req.query.date_to   || todayStr();
    let { data, error } = await sb.from('service_transactions')
      .select('*, services(name)')
      .eq('payment_status', 'paid')
      .gt('tip_amount', 0)
      .gte('service_date', from)
      .lte('service_date', to)
      .order('service_date', { ascending: false });
    if (error?.code === '42703') return res.json([]); // column not yet added
    if (error) return res.status(400).json({ error: error.message });
    const result = (data || []).map(st => ({ ...st, service_name: st.services?.name || null, services: undefined }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/expired-subscriptions', authenticate, async (req, res) => {
  try {
    const { data } = await sb.from('client_vehicles')
      .select('*, clients(full_name, mobile), subscription_plans(name)')
      .eq('status', 'expired');
    const result = (data || []).map(v => ({
      ...v,
      full_name: v.clients?.full_name || '',
      mobile:    v.clients?.mobile    || '',
      plan_name: v.subscription_plans?.name || null,
      clients: undefined, subscription_plans: undefined
    })).sort((a, b) => (b.end_date || '').localeCompare(a.end_date || ''));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
