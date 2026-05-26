require('dotenv').config();
const { sb } = require('./database/supabase');

async function seed() {
  console.log('Seeding test data...');

  // Get plan IDs
  const { data: plans } = await sb.from('subscription_plans').select('id, name, price').order('name');
  const monthly_car  = plans.find(p => p.name === 'Monthly Car Parking');
  const monthly_moto = plans.find(p => p.name === 'Monthly Motorcycle Parking');
  const weekly_car   = plans.find(p => p.name === 'Weekly Car Parking');

  // Get service IDs
  const { data: services } = await sb.from('services').select('id, name').order('name');
  const carWash     = services.find(s => s.name === 'Car Wash');
  const motoWash    = services.find(s => s.name === 'Motorcycle Wash');
  const interior    = services.find(s => s.name === 'Interior Cleaning');
  const fullPkg     = services.find(s => s.name === 'Full Wash Package');

  // ---- CLIENTS ----
  const { data: clients } = await sb.from('clients').insert([
    { full_name: 'Ahmad Khalil',       mobile: '03-123456', notes: 'Regular client' },
    { full_name: 'Sara Hassan',        mobile: '71-234567', notes: '' },
    { full_name: 'Mohammed Ali',       mobile: '76-345678', notes: 'Prefers spot B4' },
    { full_name: 'Lara Nassar',        mobile: '03-456789', notes: '' },
    { full_name: 'Joseph Bou Khalil',  mobile: '70-567890', notes: 'VIP client' },
  ]).select('id, full_name');
  console.log('Clients created:', clients.length);

  const [ahmad, sara, mohammed, lara, joseph] = clients;
  const today = '2026-05-26';
  const monthStart = '2026-05-01';
  const monthEnd   = '2026-06-01';

  // ---- VEHICLES ----
  const { data: vehicles } = await sb.from('client_vehicles').insert([
    { client_id: ahmad.id,   plate_number: 'ABC-123', vehicle_type: 'car',        vehicle_model: 'Toyota Camry',    subscription_plan_id: monthly_car.id,  start_date: monthStart, end_date: monthEnd, amount: monthly_car.price,  status: 'active' },
    { client_id: sara.id,    plate_number: 'DEF-456', vehicle_type: 'car',        vehicle_model: 'Kia Sportage',    subscription_plan_id: monthly_car.id,  start_date: monthStart, end_date: monthEnd, amount: monthly_car.price,  status: 'active' },
    { client_id: mohammed.id,plate_number: 'GH-7890', vehicle_type: 'motorcycle', vehicle_model: 'Honda CB500',     subscription_plan_id: monthly_moto.id, start_date: monthStart, end_date: monthEnd, amount: monthly_moto.price, status: 'active' },
    { client_id: lara.id,    plate_number: 'JKL-321', vehicle_type: 'car',        vehicle_model: 'Hyundai Tucson',  subscription_plan_id: weekly_car.id,   start_date: '2026-05-20', end_date: '2026-05-27', amount: weekly_car.price, status: 'active' },
    { client_id: joseph.id,  plate_number: 'MNO-654', vehicle_type: 'car',        vehicle_model: 'Mercedes C-Class',subscription_plan_id: monthly_car.id,  start_date: monthStart, end_date: monthEnd, amount: monthly_car.price,  status: 'active' },
  ]).select('id, plate_number, client_id, subscription_plan_id, amount');
  console.log('Vehicles created:', vehicles.length);

  const [vAhmad, vSara, vMohammed, vLara, vJoseph] = vehicles;

  // ---- INVOICES (current month 2026-05) ----
  // Ahmad: paid | Sara: unpaid | Mohammed: paid | Lara: paid | Joseph: unpaid
  await sb.from('invoices').insert([
    { invoice_number: 'INV-00001', client_id: ahmad.id,    vehicle_id: vAhmad.id,    subscription_plan_id: monthly_car.id,  invoice_month: '2026-05', amount: 150, discount: 0, final_amount: 150, due_date: '2026-05-28', payment_status: 'paid',   payment_date: '2026-05-03', payment_method: 'cash' },
    { invoice_number: 'INV-00002', client_id: sara.id,     vehicle_id: vSara.id,     subscription_plan_id: monthly_car.id,  invoice_month: '2026-05', amount: 150, discount: 0, final_amount: 150, due_date: '2026-05-28', payment_status: 'unpaid', payment_date: null,         payment_method: 'cash' },
    { invoice_number: 'INV-00003', client_id: mohammed.id, vehicle_id: vMohammed.id, subscription_plan_id: monthly_moto.id, invoice_month: '2026-05', amount: 80,  discount: 0, final_amount: 80,  due_date: '2026-05-28', payment_status: 'paid',   payment_date: '2026-05-05', payment_method: 'bank_transfer' },
    { invoice_number: 'INV-00004', client_id: lara.id,     vehicle_id: vLara.id,     subscription_plan_id: weekly_car.id,   invoice_month: '2026-05', amount: 50,  discount: 5, final_amount: 45,  due_date: '2026-05-27', payment_status: 'paid',   payment_date: '2026-05-20', payment_method: 'cash' },
    { invoice_number: 'INV-00005', client_id: joseph.id,   vehicle_id: vJoseph.id,   subscription_plan_id: monthly_car.id,  invoice_month: '2026-05', amount: 150, discount: 0, final_amount: 150, due_date: '2026-05-28', payment_status: 'unpaid', payment_date: null,         payment_method: 'cash' },
  ]);
  console.log('Invoices created: 5');

  // ---- DAILY PARKING ----
  await sb.from('daily_parking').insert([
    { plate_number: 'QRS-789', vehicle_type: 'car',        entry_time: '2026-05-26T08:15:00', exit_time: null,              duration_minutes: null, amount: 0,  payment_status: 'unpaid', parking_status: 'parked',    notes: '' },
    { plate_number: 'TUV-012', vehicle_type: 'car',        entry_time: '2026-05-26T07:00:00', exit_time: '2026-05-26T09:30:00', duration_minutes: 150, amount: 15, payment_status: 'paid',   parking_status: 'completed', notes: '' },
    { plate_number: 'WXY-345', vehicle_type: 'car',        entry_time: '2026-05-25T10:00:00', exit_time: '2026-05-25T12:00:00', duration_minutes: 120, amount: 10, payment_status: 'paid',   parking_status: 'completed', notes: '' },
    { plate_number: 'ZAB-678', vehicle_type: 'motorcycle', entry_time: '2026-05-25T09:00:00', exit_time: '2026-05-25T11:00:00', duration_minutes: 120, amount: 5,  payment_status: 'paid',   parking_status: 'completed', notes: '' },
    { plate_number: 'CDE-901', vehicle_type: 'car',        entry_time: '2026-05-24T13:00:00', exit_time: '2026-05-24T17:00:00', duration_minutes: 240, amount: 20, payment_status: 'paid',   parking_status: 'completed', notes: '' },
    { plate_number: 'FGH-234', vehicle_type: 'car',        entry_time: '2026-05-24T08:30:00', exit_time: '2026-05-24T10:00:00', duration_minutes: 90,  amount: 8,  payment_status: 'paid',   parking_status: 'completed', notes: '' },
  ]);
  console.log('Daily parking records created: 6');

  // ---- SERVICE TRANSACTIONS ----
  await sb.from('service_transactions').insert([
    { client_type: 'registered',     client_id: ahmad.id,   client_name: 'Ahmad Khalil',      mobile: '03-123456', plate_number: 'ABC-123', vehicle_type: 'car',        service_id: carWash.id,  price: 25, discount: 0, final_amount: 25, payment_status: 'paid',   service_date: '2026-05-20', notes: '' },
    { client_type: 'registered',     client_id: sara.id,    client_name: 'Sara Hassan',       mobile: '71-234567', plate_number: 'DEF-456', vehicle_type: 'car',        service_id: interior.id, price: 40, discount: 5, final_amount: 35, payment_status: 'paid',   service_date: '2026-05-22', notes: 'Discount applied' },
    { client_type: 'non-registered', client_id: null,       client_name: 'Walk-in Customer',  mobile: '',          plate_number: 'PQR-555', vehicle_type: 'car',        service_id: fullPkg.id,  price: 55, discount: 0, final_amount: 55, payment_status: 'paid',   service_date: '2026-05-23', notes: '' },
    { client_type: 'registered',     client_id: mohammed.id,client_name: 'Mohammed Ali',      mobile: '76-345678', plate_number: 'GH-7890', vehicle_type: 'motorcycle', service_id: motoWash.id, price: 15, discount: 0, final_amount: 15, payment_status: 'unpaid', service_date: '2026-05-24', notes: '' },
    { client_type: 'non-registered', client_id: null,       client_name: 'External Client',   mobile: '01-999999', plate_number: 'STU-777', vehicle_type: 'car',        service_id: carWash.id,  price: 25, discount: 0, final_amount: 25, payment_status: 'paid',   service_date: '2026-05-25', notes: '' },
  ]);
  console.log('Service transactions created: 5');

  // ---- EXPENSES ----
  await sb.from('expenses').insert([
    { expense_type: 'salary',      title: 'Staff Salary — May 2026',    amount: 500, expense_date: '2026-05-01', paid_to: 'Hassan Kassem',   payment_method: 'bank_transfer', notes: 'Monthly salary' },
    { expense_type: 'rent',        title: 'Parking Lot Rent — May 2026',amount: 800, expense_date: '2026-05-01', paid_to: 'Property Owner',  payment_method: 'bank_transfer', notes: '' },
    { expense_type: 'electricity', title: 'Electricity Bill — May',     amount: 150, expense_date: '2026-05-10', paid_to: 'EDL',             payment_method: 'cash',          notes: '' },
    { expense_type: 'water',       title: 'Water Bill — May',           amount: 40,  expense_date: '2026-05-10', paid_to: 'Water Authority',  payment_method: 'cash',          notes: '' },
    { expense_type: 'maintenance', title: 'Gate Repair',                amount: 120, expense_date: '2026-05-15', paid_to: 'Fix-It Workshop', payment_method: 'cash',          notes: 'Sliding gate motor replaced' },
    { expense_type: 'other',       title: 'Cleaning Supplies',          amount: 35,  expense_date: '2026-05-18', paid_to: 'Spinneys',        payment_method: 'cash',          notes: '' },
  ]);
  console.log('Expenses created: 6');

  console.log('\n✅ Test data seeded successfully!');
  console.log('   5 clients · 5 vehicles · 5 invoices · 6 parking records · 5 services · 6 expenses');
  process.exit(0);
}

seed().catch(e => { console.error('Error:', e.message); process.exit(1); });
