const express = require('express');
const router = express.Router();
const { sb } = require('../database/supabase');
const { authenticate, adminOnly } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const { data } = await sb.from('settings').select('*').eq('id', 1).maybeSingle();
    res.json(data || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/', authenticate, adminOnly, async (req, res) => {
  try {
    const { business_name, business_phone, business_address, invoice_prefix, currency, logo_url, custom_rates } = req.body;
    const payload = {
      id: 1,
      business_name:    business_name    || 'My Parking',
      business_phone:   business_phone   || '',
      business_address: business_address || '',
      invoice_prefix:   invoice_prefix   || 'INV',
      currency:         currency         || 'USD',
      logo_url:         logo_url         || '',
      custom_rates:     custom_rates     || '{}'
    };
    await sb.from('settings').upsert(payload, { onConflict: 'id' });
    res.json({ message: 'Settings updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
