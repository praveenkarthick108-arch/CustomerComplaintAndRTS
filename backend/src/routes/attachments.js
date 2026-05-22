const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// POST /api/attachments/complaint/:id - upload file
router.post('/complaint/:id', authenticate, upload.single('file'), (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
    if (!complaint) {
      // Clean up uploaded file
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Access check
    const user = req.user;
    if (user.role === 'customer' && complaint.customer_id !== user.id) {
      fs.unlink(req.file.path, () => {});
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const attachmentId = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO attachments (id, complaint_id, filename, original_name, file_size, mime_type, uploaded_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      attachmentId,
      id,
      req.file.filename,
      req.file.originalname,
      req.file.size,
      req.file.mimetype,
      user.id,
      now
    );

    // Add history entry
    db.prepare(`
      INSERT INTO complaint_history (id, complaint_id, updated_by, old_status, new_status, comment, action, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'attachment_added', ?)
    `).run(
      uuidv4(), id, user.id, complaint.status, complaint.status,
      `Attachment uploaded: ${req.file.originalname}`, now
    );

    const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(attachmentId);

    return res.status(201).json({
      success: true,
      message: 'File uploaded successfully.',
      data: attachment
    });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error('[Attachments] Upload error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error during file upload.' });
  }
});

// Handle multer errors
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File size exceeds 5MB limit.' });
  }
  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
});

// GET /api/attachments/complaint/:id - list attachments
router.get('/complaint/:id', authenticate, (req, res) => {
  try {
    const { id } = req.params;

    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const user = req.user;
    if (user.role === 'customer' && complaint.customer_id !== user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const attachments = db.prepare(`
      SELECT a.*, u.name as uploader_name
      FROM attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.complaint_id = ?
      ORDER BY a.created_at ASC
    `).all(id);

    return res.json({ success: true, data: attachments });
  } catch (err) {
    console.error('[Attachments] List error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/attachments/:id/download - download file
router.get('/:id/download', authenticate, (req, res) => {
  try {
    const { id } = req.params;

    const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id);
    if (!attachment) {
      return res.status(404).json({ success: false, message: 'Attachment not found.' });
    }

    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(attachment.complaint_id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Associated complaint not found.' });
    }

    const user = req.user;
    if (user.role === 'customer' && complaint.customer_id !== user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const filePath = path.join(__dirname, '..', '..', 'uploads', attachment.filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found on server.' });
    }

    return res.download(filePath, attachment.original_name);
  } catch (err) {
    console.error('[Attachments] Download error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /api/attachments/:id - delete attachment
router.delete('/:id', authenticate, (req, res) => {
  try {
    const { id } = req.params;

    const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id);
    if (!attachment) {
      return res.status(404).json({ success: false, message: 'Attachment not found.' });
    }

    const user = req.user;
    // Only uploader or admin can delete
    if (user.role !== 'admin' && attachment.uploaded_by !== user.id) {
      return res.status(403).json({ success: false, message: 'Access denied. Only the uploader or admin can delete attachments.' });
    }

    // Delete file from disk
    const filePath = path.join(__dirname, '..', '..', 'uploads', attachment.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    db.prepare('DELETE FROM attachments WHERE id = ?').run(id);

    // Add history entry
    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(attachment.complaint_id);
    if (complaint) {
      db.prepare(`
        INSERT INTO complaint_history (id, complaint_id, updated_by, old_status, new_status, comment, action, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'attachment_removed', ?)
      `).run(
        uuidv4(), attachment.complaint_id, user.id,
        complaint.status, complaint.status,
        `Attachment removed: ${attachment.original_name}`,
        new Date().toISOString()
      );
    }

    return res.json({ success: true, message: 'Attachment deleted successfully.' });
  } catch (err) {
    console.error('[Attachments] Delete error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
