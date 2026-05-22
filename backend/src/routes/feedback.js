const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { createNotification } = require('../utils/notificationHelper');

// POST /api/feedback/complaint/:id - submit feedback
router.post('/complaint/:id', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comments } = req.body;

    // Validate rating
    if (rating === undefined || rating === null) {
      return res.status(400).json({ success: false, message: 'Rating is required.' });
    }
    const ratingNum = parseInt(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
    }

    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Only the customer who owns the complaint can submit feedback
    if (req.user.role !== 'customer' || complaint.customer_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the customer who filed the complaint can submit feedback.' });
    }

    // Complaint must be resolved or closed
    if (!['resolved', 'closed'].includes(complaint.status)) {
      return res.status(400).json({ success: false, message: 'Feedback can only be submitted for resolved or closed complaints.' });
    }

    // Check if feedback already exists
    const existing = db.prepare('SELECT id FROM feedback WHERE complaint_id = ?').get(id);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Feedback has already been submitted for this complaint.' });
    }

    const feedbackId = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO feedback (id, complaint_id, customer_id, rating, comments, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(feedbackId, id, req.user.id, ratingNum, comments || null, now);

    // Notify assigned agent
    if (complaint.assigned_to) {
      createNotification(
        db, complaint.assigned_to, id,
        `New Feedback for ${complaint.complaint_number}`,
        `Customer submitted a ${ratingNum}-star rating for complaint "${complaint.title}".`,
        ratingNum >= 4 ? 'success' : ratingNum >= 3 ? 'info' : 'warning'
      );
    }

    // Notify supervisors
    const supervisors = db.prepare("SELECT id FROM users WHERE role IN ('supervisor', 'admin') AND is_active = 1").all();
    for (const sup of supervisors) {
      createNotification(
        db, sup.id, id,
        `Customer Feedback: ${complaint.complaint_number}`,
        `${ratingNum}-star rating received for complaint "${complaint.title}".${comments ? ' Comment: ' + comments : ''}`,
        ratingNum >= 4 ? 'success' : ratingNum >= 3 ? 'info' : 'warning'
      );
    }

    const feedback = db.prepare('SELECT * FROM feedback WHERE id = ?').get(feedbackId);
    return res.status(201).json({ success: true, message: 'Feedback submitted successfully.', data: feedback });
  } catch (err) {
    console.error('[Feedback] Submit error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/feedback/complaint/:id - get feedback for complaint
router.get('/complaint/:id', authenticate, (req, res) => {
  try {
    const { id } = req.params;

    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Access control
    if (req.user.role === 'customer' && complaint.customer_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const feedback = db.prepare(`
      SELECT f.*, u.name as customer_name
      FROM feedback f
      LEFT JOIN users u ON f.customer_id = u.id
      WHERE f.complaint_id = ?
    `).get(id);

    return res.json({ success: true, data: feedback || null });
  } catch (err) {
    console.error('[Feedback] Get error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
