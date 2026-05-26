require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Supabase connection and seed data
const { seedDatabase } = require('./database/supabase');
seedDatabase().catch(err => console.error('Seed error:', err.message));

// API Routes
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/dashboard',     require('./routes/dashboard'));
app.use('/api/plans',         require('./routes/plans'));
app.use('/api/clients',       require('./routes/clients'));
app.use('/api/daily-parking', require('./routes/dailyParking'));
app.use('/api/services',      require('./routes/services'));
app.use('/api/transactions',  require('./routes/transactions'));
app.use('/api/expenses',      require('./routes/expenses'));
app.use('/api/invoices',      require('./routes/invoices'));
app.use('/api/reports',       require('./routes/reports'));
app.use('/api/settings',      require('./routes/settings'));
app.use('/api/users',         require('./routes/users'));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n==============================================');
  console.log(`  Parking Management System (Supabase)`);
  console.log(`  http://localhost:${PORT}`);
  console.log('==============================================');
  console.log('  Admin:    admin@parking.com   / admin123');
  console.log('  Employee: employee@parking.com / emp123');
  console.log('==============================================\n');
});
