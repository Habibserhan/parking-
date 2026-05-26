const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'parking.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'cashier',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY,
    business_name TEXT DEFAULT 'My Parking Business',
    business_phone TEXT DEFAULT '',
    business_address TEXT DEFAULT '',
    invoice_prefix TEXT DEFAULT 'INV',
    currency TEXT DEFAULT 'USD',
    logo_url TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS subscription_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    duration TEXT NOT NULL,
    price REAL NOT NULL,
    description TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    mobile TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS client_vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    plate_number TEXT UNIQUE NOT NULL,
    vehicle_type TEXT NOT NULL,
    vehicle_model TEXT DEFAULT '',
    subscription_plan_id INTEGER,
    start_date DATE,
    end_date DATE,
    amount REAL DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_plan_id) REFERENCES subscription_plans(id)
  );

  CREATE TABLE IF NOT EXISTS daily_parking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate_number TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    entry_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    exit_time DATETIME,
    duration_minutes INTEGER,
    amount REAL DEFAULT 0,
    payment_status TEXT DEFAULT 'unpaid',
    parking_status TEXT DEFAULT 'parked',
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    vehicle_type TEXT NOT NULL DEFAULT 'both',
    price REAL NOT NULL,
    description TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS service_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_type TEXT NOT NULL DEFAULT 'non-registered',
    client_id INTEGER,
    client_name TEXT DEFAULT '',
    mobile TEXT DEFAULT '',
    plate_number TEXT DEFAULT '',
    vehicle_type TEXT DEFAULT 'car',
    service_id INTEGER,
    price REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    final_amount REAL DEFAULT 0,
    payment_status TEXT DEFAULT 'unpaid',
    service_date DATE NOT NULL,
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (service_id) REFERENCES services(id)
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_type TEXT NOT NULL,
    title TEXT NOT NULL,
    amount REAL NOT NULL,
    expense_date DATE NOT NULL,
    paid_to TEXT DEFAULT '',
    payment_method TEXT DEFAULT 'cash',
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,
    client_id INTEGER NOT NULL,
    vehicle_id INTEGER NOT NULL,
    subscription_plan_id INTEGER,
    invoice_month TEXT NOT NULL,
    amount REAL NOT NULL,
    discount REAL DEFAULT 0,
    final_amount REAL NOT NULL,
    due_date DATE,
    payment_status TEXT DEFAULT 'unpaid',
    payment_date DATE,
    payment_method TEXT DEFAULT 'cash',
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (vehicle_id) REFERENCES client_vehicles(id),
    FOREIGN KEY (subscription_plan_id) REFERENCES subscription_plans(id)
  );
`);

// --- Seed Data ---
const admin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@parking.com');
if (!admin) {
  db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run('Admin', 'admin@parking.com', bcrypt.hashSync('admin123', 10), 'admin');
  db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run('Employee', 'employee@parking.com', bcrypt.hashSync('emp123', 10), 'cashier');
}

// Add custom_rates column if it doesn't exist (safe migration)
try { db.exec('ALTER TABLE settings ADD COLUMN custom_rates TEXT DEFAULT "{}"'); } catch {}

const settings = db.prepare('SELECT id FROM settings WHERE id = 1').get();
if (!settings) {
  db.prepare('INSERT INTO settings (id, business_name, currency, invoice_prefix, custom_rates) VALUES (1, ?, ?, ?, ?)').run('My Parking Business', 'LBP', 'INV', '{"LBP":89500,"IQD":1310,"SYP":14000}');
}

// Ensure default rates for currencies missing from the live Frankfurter feed are present
try {
  const s = db.prepare('SELECT custom_rates FROM settings WHERE id=1').get();
  if (s) {
    let rates = {};
    try { rates = JSON.parse(s.custom_rates || '{}'); } catch {}
    const defaults = { LBP: 89500, IQD: 1310, SYP: 14000 };
    let changed = false;
    for (const [k, v] of Object.entries(defaults)) {
      if (!rates[k]) { rates[k] = v; changed = true; }
    }
    if (changed) db.prepare('UPDATE settings SET custom_rates=? WHERE id=1').run(JSON.stringify(rates));
  }
} catch {}

const plansCount = db.prepare('SELECT COUNT(*) as c FROM subscription_plans').get().c;
if (plansCount === 0) {
  const planStmt = db.prepare('INSERT INTO subscription_plans (name, vehicle_type, duration, price, description) VALUES (?, ?, ?, ?, ?)');
  [
    ['Monthly Car Parking',         'car',        'monthly', 150, 'Monthly subscription for car parking'],
    ['Monthly Motorcycle Parking',  'motorcycle', 'monthly',  80, 'Monthly subscription for motorcycle parking'],
    ['Weekly Car Parking',          'car',        'weekly',   50, 'Weekly subscription for car parking'],
    ['Weekly Motorcycle Parking',   'motorcycle', 'weekly',   30, 'Weekly subscription for motorcycle parking'],
    ['Daily Car Parking',           'car',        'daily',    10, 'Daily subscription for car parking'],
  ].forEach(p => planStmt.run(...p));
}

const servicesCount = db.prepare('SELECT COUNT(*) as c FROM services').get().c;
if (servicesCount === 0) {
  const svcStmt = db.prepare('INSERT INTO services (name, vehicle_type, price, description) VALUES (?, ?, ?, ?)');
  [
    ['Car Wash',           'car',        25, 'Basic exterior car wash'],
    ['Motorcycle Wash',    'motorcycle', 15, 'Basic motorcycle wash'],
    ['Interior Cleaning',  'car',        40, 'Full interior cleaning'],
    ['Exterior Cleaning',  'both',       20, 'Exterior cleaning'],
    ['Full Wash Package',  'both',       55, 'Complete wash and clean package'],
  ].forEach(s => svcStmt.run(...s));
}

module.exports = db;
