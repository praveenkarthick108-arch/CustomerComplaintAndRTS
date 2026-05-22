const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// Use bun:sqlite if running under Bun, otherwise fall back to better-sqlite3
let Database;
try {
  // Bun's built-in SQLite
  const bunSqlite = require('bun:sqlite');
  // Wrap bun:sqlite to match better-sqlite3 API (only difference: db.pragma())
  const OriginalDatabase = bunSqlite.Database;
  Database = class BetterSQLite3Compat {
    constructor(filename, opts) {
      this._db = new OriginalDatabase(filename, opts);
    }
    pragma(str) { this._db.run('PRAGMA ' + str); return this; }
    exec(sql) { return this._db.exec(sql); }
    prepare(sql) { return this._db.prepare(sql); }
    transaction(fn) { return this._db.transaction(fn); }
    close() { return this._db.close(); }
  };
} catch (_e) {
  // Fall back to better-sqlite3 (Node.js)
  Database = require('better-sqlite3');
}

const DB_PATH = path.join(__dirname, '..', '..', 'complaint_tracker.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      phone TEXT,
      department TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id TEXT PRIMARY KEY,
      complaint_number TEXT UNIQUE NOT NULL,
      customer_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open',
      assigned_to TEXT,
      sla_deadline TEXT,
      escalated_at TEXT,
      escalation_reason TEXT,
      resolved_at TEXT,
      resolution_notes TEXT,
      closed_at TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES users(id),
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS complaint_history (
      id TEXT PRIMARY KEY,
      complaint_id TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT,
      comment TEXT,
      action TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id),
      FOREIGN KEY (updated_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      complaint_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      uploaded_by TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      complaint_id TEXT UNIQUE NOT NULL,
      customer_id TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comments TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id),
      FOREIGN KEY (customer_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      complaint_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (complaint_id) REFERENCES complaints(id)
    );

    CREATE TABLE IF NOT EXISTS etl_run_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_at TEXT NOT NULL,
      status TEXT NOT NULL,
      rows_extracted INTEGER DEFAULT 0,
      rows_loaded INTEGER DEFAULT 0,
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS analytics_complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      complaint_number TEXT,
      complaint_category TEXT,
      priority TEXT,
      status TEXT,
      agent_name TEXT,
      created_date TEXT,
      resolved_date TEXT,
      sla_hours INTEGER,
      resolution_time_hours REAL,
      resolution_days REAL,
      is_sla_breached INTEGER DEFAULT 0,
      customer_region TEXT,
      product_line TEXT,
      feedback_rating REAL,
      month_year TEXT
    );

    CREATE TABLE IF NOT EXISTS analytics_sla_report (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      priority TEXT NOT NULL,
      sla_hours INTEGER NOT NULL,
      total_complaints INTEGER DEFAULT 0,
      breached_count INTEGER DEFAULT 0,
      within_sla_count INTEGER DEFAULT 0,
      breach_rate_pct REAL DEFAULT 0.0,
      avg_resolution_hours REAL,
      last_updated TEXT
    );

    CREATE TABLE IF NOT EXISTS analytics_category_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      total_complaints INTEGER DEFAULT 0,
      resolved_count INTEGER DEFAULT 0,
      escalated_count INTEGER DEFAULT 0,
      breached_count INTEGER DEFAULT 0,
      avg_resolution_hours REAL,
      avg_feedback_rating REAL,
      last_updated TEXT
    );

    CREATE TABLE IF NOT EXISTS analytics_agent_performance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_name TEXT NOT NULL,
      total_assigned INTEGER DEFAULT 0,
      resolved_count INTEGER DEFAULT 0,
      escalated_count INTEGER DEFAULT 0,
      breached_count INTEGER DEFAULT 0,
      avg_resolution_hours REAL,
      avg_feedback_rating REAL,
      resolution_rate_pct REAL DEFAULT 0.0,
      last_updated TEXT
    );

    CREATE TABLE IF NOT EXISTS analytics_monthly_trends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month_year TEXT NOT NULL,
      total_complaints INTEGER DEFAULT 0,
      resolved_count INTEGER DEFAULT 0,
      escalated_count INTEGER DEFAULT 0,
      breached_count INTEGER DEFAULT 0,
      avg_resolution_hours REAL,
      new_complaints INTEGER DEFAULT 0,
      last_updated TEXT
    );
  `);

  seedData();
}

function seedData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count > 0) return;

  console.log('Seeding initial data...');

  const hashedPassword = bcrypt.hashSync('Admin@123', 10);

  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password, role, phone, department, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  const adminId = uuidv4();
  const supervisorId = uuidv4();
  const agent1Id = uuidv4();
  const agent2Id = uuidv4();
  const customerId = uuidv4();
  const qualityId = uuidv4();

  insertUser.run(adminId, 'Admin User', 'admin@system.com', hashedPassword, 'admin', '+1-555-0001', 'IT');
  insertUser.run(supervisorId, 'Sarah Johnson', 'supervisor@system.com', hashedPassword, 'supervisor', '+1-555-0002', 'Support');
  insertUser.run(agent1Id, 'John Smith', 'agent1@system.com', hashedPassword, 'agent', '+1-555-0003', 'Support');
  insertUser.run(agent2Id, 'Emily Davis', 'agent2@system.com', hashedPassword, 'agent', '+1-555-0004', 'Support');
  insertUser.run(customerId, 'Mike Wilson', 'customer@system.com', hashedPassword, 'customer', '+1-555-0005', null);
  insertUser.run(qualityId, 'Lisa Chen', 'quality@system.com', hashedPassword, 'quality', '+1-555-0006', 'Quality Assurance');

  const insertCategory = db.prepare(`
    INSERT INTO categories (id, name, description, is_active, created_at)
    VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
  `);

  const billingCatId = uuidv4();
  const serviceDisruptionCatId = uuidv4();
  const productDefectsCatId = uuidv4();
  const techProblemsCatId = uuidv4();
  const deliveryCatId = uuidv4();
  const accountCatId = uuidv4();
  const csCatId = uuidv4();

  insertCategory.run(billingCatId, 'Billing Issues', 'Issues related to billing, invoices, and payments');
  insertCategory.run(serviceDisruptionCatId, 'Service Disruption', 'Issues related to service outages and disruptions');
  insertCategory.run(productDefectsCatId, 'Product Defects', 'Issues related to defective or damaged products');
  insertCategory.run(techProblemsCatId, 'Technical Problems', 'General technical issues and troubleshooting');
  insertCategory.run(deliveryCatId, 'Delivery Delays', 'Issues related to delayed or missing deliveries');
  insertCategory.run(accountCatId, 'Account Issues', 'Issues related to account access and management');
  insertCategory.run(csCatId, 'Customer Service Complaints', 'Complaints about customer service quality');

  const now = new Date();

  function slaDeadline(priority, baseDate) {
    const hoursMap = { critical: 4, high: 24, medium: 48, low: 72 };
    const d = new Date(baseDate);
    d.setHours(d.getHours() + (hoursMap[priority] || 48));
    return d.toISOString();
  }

  const insertComplaint = db.prepare(`
    INSERT INTO complaints (id, complaint_number, customer_id, category_id, title, description, priority, status,
      assigned_to, sla_deadline, escalated_at, escalation_reason, resolved_at, resolution_notes,
      contact_email, contact_phone, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertHistory = db.prepare(`
    INSERT INTO complaint_history (id, complaint_id, updated_by, old_status, new_status, comment, action, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const c1Id = uuidv4();
  const c1Date = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
  insertComplaint.run(
    c1Id, 'CCR-' + now.getFullYear() + '-0001', customerId, serviceDisruptionCatId,
    'Internet connection keeps dropping',
    'My internet connection has been dropping repeatedly for the past 3 days. It disconnects every 30 minutes and requires a router restart.',
    'high', 'in_progress', agent1Id, slaDeadline('high', c1Date), null, null, null, null,
    'customer@system.com', '+1-555-0005', c1Date, c1Date
  );
  insertHistory.run(uuidv4(), c1Id, customerId, null, 'open', 'Complaint created', 'created', c1Date);
  insertHistory.run(uuidv4(), c1Id, adminId, 'open', 'assigned', 'Assigned to John Smith', 'assigned', c1Date);
  insertHistory.run(uuidv4(), c1Id, agent1Id, 'assigned', 'in_progress', 'Started investigating the issue', 'status_change', c1Date);

  const c2Id = uuidv4();
  const c2Date = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const c2EscalatedDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
  insertComplaint.run(
    c2Id, 'CCR-' + now.getFullYear() + '-0002', customerId, billingCatId,
    'Wrong billing amount charged',
    'I was charged $150 extra on my last invoice. The charge appears under "miscellaneous fees" but I have not signed up for any additional services.',
    'critical', 'escalated', agent1Id, slaDeadline('critical', c2Date), c2EscalatedDate,
    'No resolution provided within SLA timeframe. Customer has been waiting for 5 days.',
    null, null, 'customer@system.com', '+1-555-0005', c2Date, c2EscalatedDate
  );
  insertHistory.run(uuidv4(), c2Id, customerId, null, 'open', 'Complaint created', 'created', c2Date);
  insertHistory.run(uuidv4(), c2Id, adminId, 'open', 'assigned', 'Assigned to John Smith', 'assigned', c2Date);
  insertHistory.run(uuidv4(), c2Id, supervisorId, 'assigned', 'escalated', 'No resolution provided within SLA timeframe.', 'escalated', c2EscalatedDate);

  const c3Id = uuidv4();
  const c3Date = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
  insertComplaint.run(
    c3Id, 'CCR-' + now.getFullYear() + '-0003', customerId, productDefectsCatId,
    'Product damaged on delivery',
    'The laptop I ordered arrived with a cracked screen. The packaging appeared intact but the product inside was clearly damaged.',
    'medium', 'open', null, slaDeadline('medium', c3Date), null, null, null, null,
    'customer@system.com', '+1-555-0005', c3Date, c3Date
  );
  insertHistory.run(uuidv4(), c3Id, customerId, null, 'open', 'Complaint created', 'created', c3Date);

  const c4Id = uuidv4();
  const c4Date = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const c4ResolvedDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
  insertComplaint.run(
    c4Id, 'CCR-' + now.getFullYear() + '-0004', customerId, accountCatId,
    'Cannot login to account',
    'I am unable to login to my online account. The system shows "Invalid credentials" even though I am using the correct password.',
    'high', 'resolved', agent2Id, slaDeadline('high', c4Date), null, null, c4ResolvedDate,
    'Account access was restored after resetting the authentication tokens. Customer verified successful login.',
    'customer@system.com', '+1-555-0005', c4Date, c4ResolvedDate
  );
  insertHistory.run(uuidv4(), c4Id, customerId, null, 'open', 'Complaint created', 'created', c4Date);
  insertHistory.run(uuidv4(), c4Id, adminId, 'open', 'assigned', 'Assigned to Emily Davis', 'assigned', c4Date);
  insertHistory.run(uuidv4(), c4Id, agent2Id, 'assigned', 'in_progress', 'Investigating authentication issue', 'status_change', c4Date);
  insertHistory.run(uuidv4(), c4Id, agent2Id, 'in_progress', 'resolved', 'Account access was restored after resetting the authentication tokens.', 'resolved', c4ResolvedDate);

  const c5Id = uuidv4();
  const c5Date = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  insertComplaint.run(
    c5Id, 'CCR-' + now.getFullYear() + '-0005', customerId, deliveryCatId,
    'Delivery 2 weeks overdue',
    'My order placed 3 weeks ago has still not arrived. The tracking shows it has been sitting at the distribution center for 2 weeks.',
    'critical', 'pending_customer', agent2Id, slaDeadline('critical', c5Date), null, null, null, null,
    'customer@system.com', '+1-555-0005', c5Date, c5Date
  );
  insertHistory.run(uuidv4(), c5Id, customerId, null, 'open', 'Complaint created', 'created', c5Date);
  insertHistory.run(uuidv4(), c5Id, adminId, 'open', 'assigned', 'Assigned to Emily Davis', 'assigned', c5Date);
  insertHistory.run(uuidv4(), c5Id, agent2Id, 'assigned', 'pending_customer', 'Waiting for customer to provide order confirmation number', 'status_change', c5Date);

  console.log('Seed data inserted successfully.');
  console.log('Default credentials: admin@system.com / Admin@123');
}

initializeDatabase();

module.exports = db;
