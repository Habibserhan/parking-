require('dotenv').config();
const { sb } = require('./database/supabase');

async function fixInvoicePlans() {
  // Find invoices with no subscription_plan_id
  const { data: invoices, error: invErr } = await sb
    .from('invoices')
    .select('id, invoice_number, vehicle_id, subscription_plan_id')
    .is('subscription_plan_id', null);

  if (invErr) { console.error('Error fetching invoices:', invErr.message); process.exit(1); }
  if (!invoices || !invoices.length) { console.log('No invoices missing a plan.'); return; }

  console.log(`Found ${invoices.length} invoice(s) without a plan:`);

  for (const inv of invoices) {
    if (!inv.vehicle_id) {
      console.log(`  [SKIP] Invoice ${inv.invoice_number} — no vehicle linked`);
      continue;
    }

    const { data: vehicle } = await sb
      .from('client_vehicles')
      .select('subscription_plan_id, subscription_plans(name)')
      .eq('id', inv.vehicle_id)
      .maybeSingle();

    if (!vehicle?.subscription_plan_id) {
      console.log(`  [SKIP] Invoice ${inv.invoice_number} — vehicle has no plan either`);
      continue;
    }

    const { error: updErr } = await sb
      .from('invoices')
      .update({ subscription_plan_id: vehicle.subscription_plan_id })
      .eq('id', inv.id);

    if (updErr) {
      console.log(`  [FAIL] Invoice ${inv.invoice_number} — ${updErr.message}`);
    } else {
      const planName = vehicle.subscription_plans?.name || vehicle.subscription_plan_id;
      console.log(`  [OK]   Invoice ${inv.invoice_number} → plan: ${planName}`);
    }
  }

  console.log('Done.');
}

fixInvoicePlans().catch(e => { console.error(e); process.exit(1); });
