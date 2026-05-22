const { v4: uuidv4 } = require('uuid');

function createNotification(db, userId, complaintId, title, message, type = 'info') {
  try {
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO notifications (id, user_id, complaint_id, title, message, type, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `).run(id, userId, complaintId || null, title, message, type, now);
    return id;
  } catch (err) {
    console.error('[Notification] Error creating notification:', err.message);
    return null;
  }
}

function notifyAdminsAndSupervisors(db, complaintId, title, message, type = 'info') {
  try {
    const users = db.prepare(
      "SELECT id FROM users WHERE role IN ('admin', 'supervisor') AND is_active = 1"
    ).all();
    for (const user of users) {
      createNotification(db, user.id, complaintId, title, message, type);
    }
  } catch (err) {
    console.error('[Notification] Error notifying admins/supervisors:', err.message);
  }
}

function notifyUser(db, userId, complaintId, title, message, type = 'info') {
  return createNotification(db, userId, complaintId, title, message, type);
}

module.exports = { createNotification, notifyAdminsAndSupervisors, notifyUser };
