const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/users - list users with pagination (admin only)
router.get('/', authenticate, authorize('admin'), (req, res) => {
  try {
    const {
      role,
      search,
      page = 1,
      limit = 10,
      is_active
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = [];
    let params = [];

    if (role) {
      whereClause.push('role = ?');
      params.push(role);
    }

    if (search) {
      whereClause.push('(name LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (is_active !== undefined) {
      whereClause.push('is_active = ?');
      params.push(is_active === 'true' || is_active === '1' ? 1 : 0);
    }

    const where = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';

    const total = db.prepare(`SELECT COUNT(*) as count FROM users ${where}`).get(...params).count;
    const users = db.prepare(
      `SELECT id, name, email, role, phone, department, is_active, created_at, updated_at FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limitNum, offset);

    return res.json({
      success: true,
      data: users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('[Users] List error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/users/agents - list agents (admin or supervisor)
router.get('/agents', authenticate, authorize('admin', 'supervisor'), (req, res) => {
  try {
    const agents = db.prepare(
      "SELECT id, name, email, role, phone, department, is_active FROM users WHERE role = 'agent' AND is_active = 1 ORDER BY name ASC"
    ).all();

    return res.json({ success: true, data: agents });
  } catch (err) {
    console.error('[Users] Agents error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/users/:id - get user by id (admin only)
router.get('/:id', authenticate, authorize('admin'), (req, res) => {
  try {
    const user = db.prepare(
      'SELECT id, name, email, role, phone, department, is_active, created_at, updated_at FROM users WHERE id = ?'
    ).get(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.json({ success: true, data: user });
  } catch (err) {
    console.error('[Users] Get by id error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/users - create user (admin only)
router.post('/', authenticate, authorize('admin'), (req, res) => {
  try {
    const { name, email, password, role = 'customer', phone, department } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const validRoles = ['admin', 'supervisor', 'agent', 'customer', 'quality'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, name, email, password, role, phone, department, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, name.trim(), email.toLowerCase(), hashedPassword, role, phone || null, department || null, now, now);

    const user = db.prepare(
      'SELECT id, name, email, role, phone, department, is_active, created_at FROM users WHERE id = ?'
    ).get(id);

    return res.status(201).json({ success: true, message: 'User created successfully.', data: user });
  } catch (err) {
    console.error('[Users] Create error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/users/:id - update user (admin only)
router.put('/:id', authenticate, authorize('admin'), (req, res) => {
  try {
    const { name, email, role, phone, department } = req.body;
    const { id } = req.params;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (email && email.toLowerCase() !== user.email) {
      const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.toLowerCase(), id);
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email already in use.' });
      }
    }

    const validRoles = ['admin', 'supervisor', 'agent', 'customer', 'quality'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE users SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        role = COALESCE(?, role),
        phone = COALESCE(?, phone),
        department = COALESCE(?, department),
        updated_at = ?
      WHERE id = ?
    `).run(
      name ? name.trim() : null,
      email ? email.toLowerCase() : null,
      role || null,
      phone !== undefined ? phone : null,
      department !== undefined ? department : null,
      now,
      id
    );

    const updated = db.prepare(
      'SELECT id, name, email, role, phone, department, is_active, created_at, updated_at FROM users WHERE id = ?'
    ).get(id);

    return res.json({ success: true, message: 'User updated successfully.', data: updated });
  } catch (err) {
    console.error('[Users] Update error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PATCH /api/users/:id/toggle-status - toggle is_active (admin only)
router.patch('/:id/toggle-status', authenticate, authorize('admin'), (req, res) => {
  try {
    const { id } = req.params;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot deactivate your own account.' });
    }

    const newStatus = user.is_active ? 0 : 1;
    db.prepare('UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?')
      .run(newStatus, new Date().toISOString(), id);

    return res.json({
      success: true,
      message: `User ${newStatus ? 'activated' : 'deactivated'} successfully.`,
      data: { is_active: newStatus }
    });
  } catch (err) {
    console.error('[Users] Toggle status error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /api/users/:id - soft delete (admin only)
router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
  try {
    const { id } = req.params;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account.' });
    }

    db.prepare('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id);

    return res.json({ success: true, message: 'User deactivated (soft deleted) successfully.' });
  } catch (err) {
    console.error('[Users] Delete error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
