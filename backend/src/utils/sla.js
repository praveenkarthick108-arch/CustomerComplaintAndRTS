const { v4: uuidv4 } = require('uuid');

const SLA_HOURS = {
  critical: 4,
  high: 24,
  medium: 48,
  low: 72
};

function calculateSLADeadline(priority, createdAt) {
  const hours = SLA_HOURS[priority] || SLA_HOURS.medium;
  const base = createdAt ? new Date(createdAt) : new Date();
  base.setHours(base.getHours() + hours);
  return base.toISOString();
}

function getSLAStatus(slaDeadline) {
  if (!slaDeadline) {
    return { status: 'unknown', hoursRemaining: null, percentageUsed: null, isBreached: false };
  }

  const now = new Date();
  const deadline = new Date(slaDeadline);
  const hoursRemaining = (deadline - now) / (1000 * 60 * 60);
  const isBreached = hoursRemaining < 0;

  // Figure out the original total hours by checking deadline against known priorities
  // We'll use a heuristic: find which SLA bucket this falls into
  // For percentage: we need the original allocation. Since we don't store priority here,
  // we'll compute percentage based on remaining vs total window.
  // As a fallback, use a 48-hour window if we can't determine.
  let totalHours = 48; // default medium
  for (const [, hours] of Object.entries(SLA_HOURS)) {
    // We can't determine priority without it being passed; caller can use complaint priority
    // For this standalone function, we just compute from a 48h window
  }

  // If caller passes slaDeadline only, derive approximate total hours
  // by assuming deadline - now represents remaining. We'll just flag at_risk if < 20% remains.
  let status;
  if (isBreached) {
    status = 'breached';
  } else {
    // We don't know the total; we'll use a ratio based on absolute hours remaining
    // at_risk: less than 4 hours remaining (conservative threshold)
    // Better approach: accept priority as second param for accurate percentage
    status = hoursRemaining < 4 ? 'at_risk' : 'on_track';
  }

  return {
    status,
    hoursRemaining: Math.round(hoursRemaining * 100) / 100,
    percentageUsed: null,
    isBreached
  };
}

function getSLAStatusWithPriority(slaDeadline, priority) {
  if (!slaDeadline) {
    return { status: 'unknown', hoursRemaining: null, percentageUsed: null, isBreached: false };
  }

  const now = new Date();
  const deadline = new Date(slaDeadline);
  const hoursRemaining = (deadline - now) / (1000 * 60 * 60);
  const isBreached = hoursRemaining < 0;

  const totalHours = SLA_HOURS[priority] || SLA_HOURS.medium;
  const hoursUsed = totalHours - hoursRemaining;
  const percentageUsed = Math.min(100, Math.round((hoursUsed / totalHours) * 100));

  let status;
  if (isBreached) {
    status = 'breached';
  } else if (percentageUsed >= 80) {
    status = 'at_risk';
  } else {
    status = 'on_track';
  }

  return {
    status,
    hoursRemaining: Math.round(hoursRemaining * 100) / 100,
    percentageUsed,
    isBreached
  };
}

function checkAndAutoEscalate(db) {
  try {
    const now = new Date().toISOString();

    // Find complaints that should be escalated
    const overdue = db.prepare(`
      SELECT c.id, c.complaint_number, c.customer_id, c.assigned_to
      FROM complaints c
      WHERE c.status NOT IN ('resolved', 'closed', 'escalated')
        AND c.sla_deadline IS NOT NULL
        AND c.sla_deadline < ?
    `).all(now);

    if (overdue.length === 0) return;

    const updateComplaint = db.prepare(`
      UPDATE complaints
      SET status = 'escalated',
          escalated_at = ?,
          escalation_reason = 'SLA breached - auto-escalated by system',
          updated_at = ?
      WHERE id = ?
    `);

    const insertHistory = db.prepare(`
      INSERT INTO complaint_history (id, complaint_id, updated_by, old_status, new_status, comment, action, created_at)
      SELECT ?, ?, id, ?, 'escalated', 'Auto-escalated by system due to SLA breach', 'escalated', ?
      FROM users WHERE role = 'admin' LIMIT 1
    `);

    const insertHistoryDirect = db.prepare(`
      INSERT INTO complaint_history (id, complaint_id, updated_by, old_status, new_status, comment, action, created_at)
      VALUES (?, ?, ?, ?, 'escalated', 'Auto-escalated by system due to SLA breach', 'escalated', ?)
    `);

    const insertNotification = db.prepare(`
      INSERT INTO notifications (id, user_id, complaint_id, title, message, type, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `);

    const adminsAndSupervisors = db.prepare(
      "SELECT id FROM users WHERE role IN ('admin', 'supervisor') AND is_active = 1"
    ).all();

    const adminUser = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();

    for (const complaint of overdue) {
      const currentComplaint = db.prepare('SELECT status FROM complaints WHERE id = ?').get(complaint.id);
      if (!currentComplaint) continue;

      updateComplaint.run(now, now, complaint.id);

      if (adminUser) {
        insertHistoryDirect.run(
          uuidv4(),
          complaint.id,
          adminUser.id,
          currentComplaint.status,
          now
        );
      }

      const notifTitle = `SLA Breached: ${complaint.complaint_number}`;
      const notifMessage = `Complaint ${complaint.complaint_number} has breached its SLA deadline and has been automatically escalated.`;

      for (const user of adminsAndSupervisors) {
        insertNotification.run(uuidv4(), user.id, complaint.id, notifTitle, notifMessage, 'warning', now);
      }

      if (complaint.assigned_to) {
        insertNotification.run(
          uuidv4(),
          complaint.assigned_to,
          complaint.id,
          notifTitle,
          `Your assigned complaint ${complaint.complaint_number} has breached its SLA and has been escalated.`,
          'warning',
          now
        );
      }
    }

    if (overdue.length > 0) {
      console.log(`[SLA Check] Auto-escalated ${overdue.length} complaint(s) due to SLA breach.`);
    }
  } catch (err) {
    console.error('[SLA Check] Error during auto-escalation:', err.message);
  }
}

module.exports = {
  SLA_HOURS,
  calculateSLADeadline,
  getSLAStatus,
  getSLAStatusWithPriority,
  checkAndAutoEscalate
};
