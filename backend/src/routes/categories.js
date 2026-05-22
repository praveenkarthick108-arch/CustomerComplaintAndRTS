const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/categories - list all active categories (public)
router.get('/', (req, res) => {
  try {
    const { include_inactive } = req.query;
    let query = 'SELECT * FROM categories';
    const params = [];

    if (!include_inactive) {
      query += ' WHERE is_active = 1';
    }
    query += ' ORDER BY name ASC';

    const categories = db.prepare(query).all(...params);
    return res.json({ success: true, data: categories });
  } catch (err) {
    console.error('[Categories] List error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/categories - create category (admin only)
router.post('/', authenticate, authorize('admin'), (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required.' });
    }

    const existing = db.prepare('SELECT id FROM categories WHERE name = ?').get(name.trim());
    if (existing) {
      return res.status(400).json({ success: false, message: 'Category with this name already exists.' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare('INSERT INTO categories (id, name, description, is_active, created_at) VALUES (?, ?, ?, 1, ?)')
      .run(id, name.trim(), description || null, now);

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    return res.status(201).json({ success: true, message: 'Category created successfully.', data: category });
  } catch (err) {
    console.error('[Categories] Create error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/categories/:id - update category (admin only)
router.put('/:id', authenticate, authorize('admin'), (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }

    if (name && name.trim() !== category.name) {
      const existing = db.prepare('SELECT id FROM categories WHERE name = ? AND id != ?').get(name.trim(), id);
      if (existing) {
        return res.status(400).json({ success: false, message: 'Category with this name already exists.' });
      }
    }

    db.prepare('UPDATE categories SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?')
      .run(name ? name.trim() : null, description !== undefined ? description : null, id);

    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    return res.json({ success: true, message: 'Category updated successfully.', data: updated });
  } catch (err) {
    console.error('[Categories] Update error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /api/categories/:id - soft delete (admin only)
router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
  try {
    const { id } = req.params;

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }

    const inUse = db.prepare('SELECT COUNT(*) as count FROM complaints WHERE category_id = ?').get(id);
    if (inUse.count > 0) {
      // Soft delete only
      db.prepare('UPDATE categories SET is_active = 0 WHERE id = ?').run(id);
      return res.json({ success: true, message: 'Category deactivated (has existing complaints).' });
    }

    db.prepare('UPDATE categories SET is_active = 0 WHERE id = ?').run(id);
    return res.json({ success: true, message: 'Category deactivated successfully.' });
  } catch (err) {
    console.error('[Categories] Delete error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
