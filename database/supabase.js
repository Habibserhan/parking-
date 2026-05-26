require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

async function seedDatabase() {
  // Seed admin users
  const { data: admin } = await sb.from('users').select('id').eq('email', 'admin@parking.com').maybeSingle();
  if (!admin) {
    await sb.from('users').insert([
      { name: 'Admin', email: 'admin@parking.com', password: bcrypt.hashSync('admin123', 10), role: 'admin' },
      { name: 'Employee', email: 'employee@parking.com', password: bcrypt.hashSync('emp123', 10), role: 'cashier' }
    ]);
  }

  // Seed settings
  const { data: settings } = await sb.from('settings').select('id').eq('id', 1).maybeSingle();
  if (!settings) {
    await sb.from('settings').insert({
      id: 1,
      business_name: 'My Parking Business',
      currency: 'LBP',
      invoice_prefix: 'INV',
      custom_rates: JSON.stringify({ LBP: 89500, IQD: 1310, SYP: 14000 })
    });
  } else {
    // Ensure default custom rates exist
    const { data: s } = await sb.from('settings').select('custom_rates').eq('id', 1).single();
    if (s) {
      let rates = {};
      try { rates = JSON.parse(s.custom_rates || '{}'); } catch {}
      const defaults = { LBP: 89500, IQD: 1310, SYP: 14000 };
      let changed = false;
      for (const [k, v] of Object.entries(defaults)) {
        if (!rates[k]) { rates[k] = v; changed = true; }
      }
      if (changed) await sb.from('settings').update({ custom_rates: JSON.stringify(rates) }).eq('id', 1);
    }
  }

  // Seed subscription plans
  const { data: plans } = await sb.from('subscription_plans').select('id').limit(1);
  if (!plans || plans.length === 0) {
    await sb.from('subscription_plans').insert([
      { name: 'Monthly Car Parking',        vehicle_type: 'car',        duration: 'monthly', price: 150, description: 'Monthly subscription for car parking' },
      { name: 'Monthly Motorcycle Parking', vehicle_type: 'motorcycle', duration: 'monthly', price: 80,  description: 'Monthly subscription for motorcycle parking' },
      { name: 'Weekly Car Parking',         vehicle_type: 'car',        duration: 'weekly',  price: 50,  description: 'Weekly subscription for car parking' },
      { name: 'Weekly Motorcycle Parking',  vehicle_type: 'motorcycle', duration: 'weekly',  price: 30,  description: 'Weekly subscription for motorcycle parking' },
      { name: 'Daily Car Parking',          vehicle_type: 'car',        duration: 'daily',   price: 10,  description: 'Daily subscription for car parking' }
    ]);
  }

  // Seed services
  const { data: services } = await sb.from('services').select('id').limit(1);
  if (!services || services.length === 0) {
    await sb.from('services').insert([
      { name: 'Car Wash',          vehicle_type: 'car',        price: 25, description: 'Basic exterior car wash' },
      { name: 'Motorcycle Wash',   vehicle_type: 'motorcycle', price: 15, description: 'Basic motorcycle wash' },
      { name: 'Interior Cleaning', vehicle_type: 'car',        price: 40, description: 'Full interior cleaning' },
      { name: 'Exterior Cleaning', vehicle_type: 'both',       price: 20, description: 'Exterior cleaning' },
      { name: 'Full Wash Package', vehicle_type: 'both',       price: 55, description: 'Complete wash and clean package' }
    ]);
  }

  console.log('Supabase connection verified and seed data checked.');
}

module.exports = { sb, seedDatabase };
