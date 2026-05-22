const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { calculateSLADeadline, getSLAStatusWithPriority } = require('../utils/sla');
const { notifyAdminsAndSupervisors, notifyUser } = require('../utils/notificationHelper');

// Helper: build role-based WHERE clause for complaint visibility
function buildAccessFilter(user, tableAlias = 'c') {
  const alias = tableAlias ? `${tableAlias}.` : '';
  if (user.role === 'customer') {
    return { clause: `${alias}customer_id = ?`, params: [user.id] };
  } else if (user.role === 'agent') {
    return {
      clause: `(${alias}assigned_to = ? OR (${alias}assigned_to IS NULL AND ${alias}status = 'open'))`,
      params: [user.id]
    };
  }
  // admin, supervisor, quality: see all
  return { clause: '1=1', params: [] };
}

// GET /api/complaints
router.get('/', authenticate, (req, res) => {
  try {
    const {
      status,
      priority,
      category_id,
      search,
      page = 1,
      limit = 10,
      sort = 'created_at',
      order = 'desc'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const allowedSorts = ['created_at', 'updated_at', 'priority', 'status', 'complaint_number', 'sla_deadline'];
    const allowedOrders = ['asc', 'desc'];
    const safeSort = allowedSorts.includes(sort) ? sort : 'created_at';
    const safeOrder = allowedOrders.includes(order.toLowerCase()) ? order.toUpperCase() : 'DESC';

    const accessFilter = buildAccessFilter(req.user);
    let whereParts = [accessFilter.clause];
    let params = [...accessFilter.params];

    if (status) {
      whereParts.push('c.status = ?');
      params.push(status);
    }
    if (priority) {
      whereParts.push('c.priority = ?');
      params.push(priority);
    }
    if (category_id) {
      whereParts.push('c.category_id = ?');
      params.push(category_id);
    }
    if (search) {
      whereParts.push('(c.title LIKE ? OR c.description LIKE ? OR c.complaint_number LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const where = 'WHERE ' + whereParts.join(' AND ');

    const total = db.prepare(`SELECT COUNT(*) as count FROM complaints c ${where}`).get(...params).count;

    const rows = db.prepare(`
      SELECT
        c.id, c.complaint_number, c.title, c.description, c.priority, c.status,
        c.sla_deadline, c.escalated_at, c.escalation_reason, c.resolved_at,
        c.resolution_notes, c.closed_at, c.contact_email, c.contact_phone,
        c.created_at, c.updated_at,
        u_cust.id as customer_id, u_cust.name as customer_name, u_cust.email as customer_email,
        u_agent.id as agent_id, u_agent.name as agent_name,
        cat.id as category_id, cat.name as category_name
      FROM complaints c
      LEFT JOIN users u_cust ON c.customer_id = u_cust.id
      LEFT JOIN users u_agent ON c.assigned_to = u_agent.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      ${where}
      ORDER BY c.${safeSort} ${safeOrder}
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    const complaints = rows.map(row => ({
      id: row.id,
      complaint_number: row.complaint_number,
      title: row.title,
      description: row.description,
      priority: row.priority,
      status: row.status,
      sla_deadline: row.sla_deadline,
      sla_status: getSLAStatusWithPriority(row.sla_deadline, row.priority),
      escalated_at: row.escalated_at,
      escalation_reason: row.escalation_reason,
      resolved_at: row.resolved_at,
      resolution_notes: row.resolution_notes,
      closed_at: row.closed_at,
      contact_email: row.contact_email,
      contact_phone: row.contact_phone,
      created_at: row.created_at,
      updated_at: row.updated_at,
      customer: { id: row.customer_id, name: row.customer_name, email: row.customer_email },
      agent: row.agent_id ? { id: row.agent_id, name: row.agent_name } : null,
      category: { id: row.category_id, name: row.category_name }
    }));

    return res.json({
      success: true,
      data: complaints,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('[Complaints] List error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/complaints - create complaint
router.post('/', authenticate, (req, res) => {
  try {
    const { category_id, title, description, priority = 'medium', contact_email, contact_phone } = req.body;

    if (!category_id || !title || !description) {
      return res.status(400).json({ success: false, message: 'Category, title, and description are required.' });
    }

    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ success: false, message: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` });
    }

    const category = db.prepare('SELECT id FROM categories WHERE id = ? AND is_active = 1').get(category_id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }

    // Generate complaint number
    const year = new Date().getFullYear();
    const countRow = db.prepare('SELECT COUNT(*) as count FROM complaints').get();
    const seq = String(countRow.count + 1).padStart(4, '0');
    const complaintNumber = `CCR-${year}-${seq}`;

    const id = uuidv4();
    const now = new Date().toISOString();
    const slaDeadline = calculateSLADeadline(priority, now);

    db.prepare(`
      INSERT INTO complaints (id, complaint_number, customer_id, category_id, title, description, priority, status,
        sla_deadline, contact_email, contact_phone, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)
    `).run(
      id, complaintNumber, req.user.id, category_id,
      title.trim(), description.trim(), priority,
      slaDeadline,
      contact_email || req.user.email || null,
      contact_phone || null,
      now, now
    );

    // Add history entry
    db.prepare(`
      INSERT INTO complaint_history (id, complaint_id, updated_by, old_status, new_status, comment, action, created_at)
      VALUES (?, ?, ?, NULL, 'open', 'Complaint created', 'created', ?)
    `).run(uuidv4(), id, req.user.id, now);

    // Notify admins/supervisors
    notifyAdminsAndSupervisors(
      db, id,
      `New Complaint: ${complaintNumber}`,
      `A new complaint "${title}" has been submitted with ${priority} priority.`,
      'info'
    );

    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);

    return res.status(201).json({
      success: true,
      message: 'Complaint created successfully.',
      data: complaint
    });
  } catch (err) {
    console.error('[Complaints] Create error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/complaints/:id - get full complaint details
router.get('/:id', authenticate, (req, res) => {
  try {
    const { id } = req.params;

    const row = db.prepare(`
      SELECT
        c.*,
        u_cust.name as customer_name, u_cust.email as customer_email, u_cust.phone as customer_phone,
        u_agent.name as agent_name, u_agent.email as agent_email,
        cat.name as category_name, cat.description as category_description
      FROM complaints c
      LEFT JOIN users u_cust ON c.customer_id = u_cust.id
      LEFT JOIN users u_agent ON c.assigned_to = u_agent.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.id = ?
    `).get(id);

    if (!row) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Access control
    const user = req.user;
    if (user.role === 'customer' && row.customer_id !== user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (user.role === 'agent' && row.assigned_to !== user.id && row.status !== 'open') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Get history
    const history = db.prepare(`
      SELECT h.*, u.name as updater_name, u.role as updater_role
      FROM complaint_history h
      LEFT JOIN users u ON h.updated_by = u.id
      WHERE h.complaint_id = ?
      ORDER BY h.created_at ASC
    `).all(id);

    // Get attachments
    const attachments = db.prepare(`
      SELECT a.*, u.name as uploader_name
      FROM attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.complaint_id = ?
      ORDER BY a.created_at ASC
    `).all(id);

    // Get feedback
    const feedback = db.prepare('SELECT * FROM feedback WHERE complaint_id = ?').get(id);

    const complaint = {
      id: row.id,
      complaint_number: row.complaint_number,
      title: row.title,
      description: row.description,
      priority: row.priority,
      status: row.status,
      sla_deadline: row.sla_deadline,
      sla_status: getSLAStatusWithPriority(row.sla_deadline, row.priority),
      escalated_at: row.escalated_at,
      escalation_reason: row.escalation_reason,
      resolved_at: row.resolved_at,
      resolution_notes: row.resolution_notes,
      closed_at: row.closed_at,
      contact_email: row.contact_email,
      contact_phone: row.contact_phone,
      created_at: row.created_at,
      updated_at: row.updated_at,
      customer: {
        id: row.customer_id,
        name: row.customer_name,
        email: row.customer_email,
        phone: row.customer_phone
      },
      agent: row.assigned_to ? {
        id: row.assigned_to,
        name: row.agent_name,
        email: row.agent_email
      } : null,
      category: {
        id: row.category_id,
        name: row.category_name,
        description: row.category_description
      },
      history,
      attachments,
      feedback: feedback || null
    };

    return res.json({ success: true, data: complaint });
  } catch (err) {
    console.error('[Complaints] Get detail error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/complaints/:id - update complaint fields
router.put('/:id', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, contact_email, contact_phone } = req.body;

    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Only customer (own) or admin
    if (req.user.role === 'customer' && complaint.customer_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (!['customer', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const now = new Date().toISOString();
    let newSlaDeadline = complaint.sla_deadline;
    if (priority && priority !== complaint.priority) {
      newSlaDeadline = calculateSLADeadline(priority, now);
    }

    db.prepare(`
      UPDATE complaints SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        priority = COALESCE(?, priority),
        sla_deadline = ?,
        contact_email = COALESCE(?, contact_email),
        contact_phone = COALESCE(?, contact_phone),
        updated_at = ?
      WHERE id = ?
    `).run(
      title ? title.trim() : null,
      description ? description.trim() : null,
      priority || null,
      newSlaDeadline,
      contact_email || null,
      contact_phone || null,
      now,
      id
    );

    if (priority && priority !== complaint.priority) {
      db.prepare(`
        INSERT INTO complaint_history (id, complaint_id, updated_by, old_status, new_status, comment, action, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'updated', ?)
      `).run(uuidv4(), id, req.user.id, complaint.priority, priority, `Priority changed from ${complaint.priority} to ${priority}`, now);
    }

    const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
    return res.json({ success: true, message: 'Complaint updated successfully.', data: updated });
  } catch (err) {
    console.error('[Complaints] Update error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PATCH /api/complaints/:id/assign - assign to agent
router.patch('/:id/assign', authenticate, authorize('admin', 'supervisor'), (req, res) => {
  try {
    const { id } = req.params;
    const { agent_id } = req.body;

    if (!agent_id) {
      return res.status(400).json({ success: false, message: 'agent_id is required.' });
    }

    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const agent = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'agent' AND is_active = 1").get(agent_id);
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found or inactive.' });
    }

    const now = new Date().toISOString();
    const newStatus = complaint.status === 'open' ? 'assigned' : complaint.status;

    db.prepare('UPDATE complaints SET assigned_to = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(agent_id, newStatus, now, id);

    db.prepare(`
      INSERT INTO complaint_history (id, complaint_id, updated_by, old_status, new_status, comment, action, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'assigned', ?)
    `).run(uuidv4(), id, req.user.id, complaint.status, newStatus, `Assigned to ${agent.name}`, now);

    notifyUser(
      db, agent_id, id,
      `New Complaint Assigned: ${complaint.complaint_number}`,
      `Complaint "${complaint.title}" has been assigned to you.`,
      'info'
    );

    const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
    return res.json({ success: true, message: `Complaint assigned to ${agent.name}.`, data: updated });
  } catch (err) {
    console.error('[Complaints] Assign error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PATCH /api/complaints/:id/status - update status
router.patch('/:id/status', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment } = req.body;

    const validStatuses = ['open', 'assigned', 'in_progress', 'pending_customer', 'escalated', 'resolved', 'closed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Access control
    if (req.user.role === 'customer' && complaint.customer_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE complaints SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, now, id);

    db.prepare(`
      INSERT INTO complaint_history (id, complaint_id, updated_by, old_status, new_status, comment, action, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'status_change', ?)
    `).run(uuidv4(), id, req.user.id, complaint.status, status, comment || `Status changed to ${status}`, now);

    // Notify customer
    notifyUser(
      db, complaint.customer_id, id,
      `Complaint ${complaint.complaint_number} Status Updated`,
      `Your complaint status has changed from "${complaint.status}" to "${status}".${comment ? ' Note: ' + comment : ''}`,
      'info'
    );

    const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
    return res.json({ success: true, message: 'Status updated successfully.', data: updated });
  } catch (err) {
    console.error('[Complaints] Status update error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PATCH /api/complaints/:id/escalate - escalate complaint
router.patch('/:id/escalate', authenticate, authorize('admin', 'supervisor', 'agent'), (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Escalation reason is required.' });
    }

    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    if (complaint.status === 'escalated') {
      return res.status(400).json({ success: false, message: 'Complaint is already escalated.' });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE complaints SET status = ?, escalated_at = ?, escalation_reason = ?, updated_at = ? WHERE id = ?')
      .run('escalated', now, reason, now, id);

    db.prepare(`
      INSERT INTO complaint_history (id, complaint_id, updated_by, old_status, new_status, comment, action, created_at)
      VALUES (?, ?, ?, ?, 'escalated', ?, 'escalated', ?)
    `).run(uuidv4(), id, req.user.id, complaint.status, reason, now);

    notifyAdminsAndSupervisors(
      db, id,
      `Complaint Escalated: ${complaint.complaint_number}`,
      `Complaint "${complaint.title}" has been escalated. Reason: ${reason}`,
      'warning'
    );

    const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
    return res.json({ success: true, message: 'Complaint escalated successfully.', data: updated });
  } catch (err) {
    console.error('[Complaints] Escalate error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/complaints/:id/resolve - mark as resolved
router.post('/:id/resolve', authenticate, authorize('admin', 'supervisor', 'agent'), (req, res) => {
  try {
    const { id } = req.params;
    const { resolution_notes } = req.body;

    if (!resolution_notes) {
      return res.status(400).json({ success: false, message: 'Resolution notes are required.' });
    }

    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    if (complaint.status === 'resolved' || complaint.status === 'closed') {
      return res.status(400).json({ success: false, message: `Complaint is already ${complaint.status}.` });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE complaints SET status = ?, resolved_at = ?, resolution_notes = ?, updated_at = ? WHERE id = ?')
      .run('resolved', now, resolution_notes, now, id);

    db.prepare(`
      INSERT INTO complaint_history (id, complaint_id, updated_by, old_status, new_status, comment, action, created_at)
      VALUES (?, ?, ?, ?, 'resolved', ?, 'resolved', ?)
    `).run(uuidv4(), id, req.user.id, complaint.status, resolution_notes, now);

    notifyUser(
      db, complaint.customer_id, id,
      `Complaint ${complaint.complaint_number} Resolved`,
      `Your complaint "${complaint.title}" has been resolved. Notes: ${resolution_notes}`,
      'success'
    );

    const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
    return res.json({ success: true, message: 'Complaint marked as resolved.', data: updated });
  } catch (err) {
    console.error('[Complaints] Resolve error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/complaints/:id/close - close complaint
router.post('/:id/close', authenticate, authorize('admin', 'supervisor'), (req, res) => {
  try {
    const { id } = req.params;

    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    if (complaint.status === 'closed') {
      return res.status(400).json({ success: false, message: 'Complaint is already closed.' });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE complaints SET status = ?, closed_at = ?, updated_at = ? WHERE id = ?')
      .run('closed', now, now, id);

    db.prepare(`
      INSERT INTO complaint_history (id, complaint_id, updated_by, old_status, new_status, comment, action, created_at)
      VALUES (?, ?, ?, ?, 'closed', 'Complaint closed', 'closed', ?)
    `).run(uuidv4(), id, req.user.id, complaint.status, now);

    notifyUser(
      db, complaint.customer_id, id,
      `Complaint ${complaint.complaint_number} Closed`,
      `Your complaint "${complaint.title}" has been closed.`,
      'info'
    );

    const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
    return res.json({ success: true, message: 'Complaint closed successfully.', data: updated });
  } catch (err) {
    console.error('[Complaints] Close error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/complaints/:id/reopen - reopen complaint
router.post('/:id/reopen', authenticate, authorize('admin', 'supervisor', 'customer'), (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    if (req.user.role === 'customer' && complaint.customer_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (!['resolved', 'closed'].includes(complaint.status)) {
      return res.status(400).json({ success: false, message: 'Only resolved or closed complaints can be reopened.' });
    }

    const now = new Date().toISOString();
    const newStatus = complaint.assigned_to ? 'assigned' : 'open';

    db.prepare('UPDATE complaints SET status = ?, resolved_at = NULL, closed_at = NULL, updated_at = ? WHERE id = ?')
      .run(newStatus, now, id);

    db.prepare(`
      INSERT INTO complaint_history (id, complaint_id, updated_by, old_status, new_status, comment, action, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'reopened', ?)
    `).run(uuidv4(), id, req.user.id, complaint.status, newStatus, reason || 'Complaint reopened', now);

    if (complaint.assigned_to) {
      notifyUser(
        db, complaint.assigned_to, id,
        `Complaint ${complaint.complaint_number} Reopened`,
        `Complaint "${complaint.title}" has been reopened.${reason ? ' Reason: ' + reason : ''}`,
        'warning'
      );
    }

    notifyAdminsAndSupervisors(
      db, id,
      `Complaint ${complaint.complaint_number} Reopened`,
      `Complaint "${complaint.title}" has been reopened.${reason ? ' Reason: ' + reason : ''}`,
      'warning'
    );

    const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
    return res.json({ success: true, message: 'Complaint reopened successfully.', data: updated });
  } catch (err) {
    console.error('[Complaints] Reopen error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/complaints/:id/history - get complaint history
router.get('/:id/history', authenticate, (req, res) => {
  try {
    const { id } = req.params;

    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    if (req.user.role === 'customer' && complaint.customer_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const history = db.prepare(`
      SELECT h.*, u.name as updater_name, u.role as updater_role
      FROM complaint_history h
      LEFT JOIN users u ON h.updated_by = u.id
      WHERE h.complaint_id = ?
      ORDER BY h.created_at ASC
    `).all(id);

    return res.json({ success: true, data: history });
  } catch (err) {
    console.error('[Complaints] History error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
