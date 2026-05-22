require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// CORS configuration
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploads statically
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Initialize database (runs synchronously, creates tables and seed data)
const db = require('./src/config/database');

// Import routes
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const complaintRoutes = require('./src/routes/complaints');
const categoryRoutes = require('./src/routes/categories');
const attachmentRoutes = require('./src/routes/attachments');
const feedbackRoutes = require('./src/routes/feedback');
const notificationRoutes = require('./src/routes/notifications');
const dashboardRoutes = require('./src/routes/dashboard');
const analyticsRoutes = require('./src/routes/analytics');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Customer Complaint Tracker API is running.',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err.stack || err.message);

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File size exceeds 5MB limit.' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ success: false, message: 'Unexpected file field.' });
  }
  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({ success: false, message: err.message });
  }

  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error.'
    : err.message || 'Internal server error.';

  return res.status(status).json({ success: false, message });
});

// SLA auto-escalation check every 5 minutes
const { checkAndAutoEscalate } = require('./src/utils/sla');

// Run immediately on startup, then every 5 minutes
checkAndAutoEscalate(db);
setInterval(() => {
  checkAndAutoEscalate(db);
}, 5 * 60 * 1000);

// Start server
const PORT = parseInt(process.env.PORT) || 5000;
app.listen(PORT, () => {
  console.log('================================================');
  console.log(`  Customer Complaint Tracker API`);
  console.log(`  Server running on http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Database: complaint_tracker.db`);
  console.log('================================================');
  console.log('  Default credentials:');
  console.log('  admin@system.com       / Admin@123 (admin)');
  console.log('  supervisor@system.com  / Admin@123 (supervisor)');
  console.log('  agent1@system.com      / Admin@123 (agent)');
  console.log('  agent2@system.com      / Admin@123 (agent)');
  console.log('  customer@system.com    / Admin@123 (customer)');
  console.log('  quality@system.com     / Admin@123 (quality)');
  console.log('================================================');
});

module.exports = app;
