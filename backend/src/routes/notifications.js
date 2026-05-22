const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

// GET /api/notifications - get user's notifications
router.get('/', authenticate, (req, res) => {
  try {
    const { is_read, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let whereParts = ['n.user_id = ?'];
    let params = [req.user.id];

    if (is_read !== undefined) {
      whereParts.push('n.is_read = ?');
      params.push(is_read === 'true' || is_read === '1' ? 1 : 0);
    }

    const where = 'WHERE ' + whereParts.join(' AND ');

    const total = db.prepare(`SELECT COUNT(*) as count FROM notifications n ${where}`).get(...params).count;

    const notifications = db.prepare(`
      SELECT n.*, c.complaint_number
      FROM notifications n
      LEFT JOIN complaints c ON n.complaint_id = c.id
      ${where}
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    return res.json({
      success: true,
      data: notifications,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('[Notifications] List error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/notifications/unread-count - get unread count
router.get('/unread-count', authenticate, (req, res) => {
  try {
    const result = db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
    ).get(req.user.id);

    return res.json({ success: true, data: { count: result.count } });
  } catch (err) {
    console.error('[Notifications] Unread count error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PATCH /api/notifications/:id/read - mark as read
router.patch('/:id/read', authenticate, (req, res) => {
  try {
    const { id } = req.params;

    const notification = db.prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);

    return res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    console.error('[Notifications] Mark read error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/notifications/read-all - mark all as read
router.post('/read-all', authenticate, (req, res) => {
  try {
    const result = db.prepare(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0'
    ).run(req.user.id);

    return res.json({
      success: true,
      message: `${result.changes} notification(s) marked as read.`,
      data: { updated: result.changes }
    });
  } catch (err) {
    console.error('[Notifications] Read all error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
