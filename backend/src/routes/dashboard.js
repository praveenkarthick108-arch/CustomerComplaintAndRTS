const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const dashboardAuth = [authenticate, authorize('admin', 'supervisor', 'quality')];

// GET /api/dashboard/stats — all authenticated users; customers get their own stats
router.get('/stats', authenticate, (req, res) => {
  try {
    const now = new Date().toISOString();
    const user = req.user;

    // Customers see only their own complaints
    const customerFilter = user.role === 'customer' ? 'WHERE customer_id = ?' : '';
    const customerParam = user.role === 'customer' ? [user.id] : [];

    const statusCounts = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM complaints ${customerFilter}
      GROUP BY status
    `).all(...customerParam);

    const statusMap = {};
    for (const row of statusCounts) {
      statusMap[row.status] = row.count;
    }

    const totalRow = db.prepare(`SELECT COUNT(*) as count FROM complaints ${customerFilter}`).get(...customerParam);

    const slaBreached = user.role === 'customer'
      ? db.prepare(`SELECT COUNT(*) as count FROM complaints WHERE customer_id = ? AND sla_deadline IS NOT NULL AND sla_deadline < ? AND status NOT IN ('resolved','closed')`).get(user.id, now)
      : db.prepare(`SELECT COUNT(*) as count FROM complaints WHERE sla_deadline IS NOT NULL AND sla_deadline < ? AND status NOT IN ('resolved','closed')`).get(now);

    const avgResolution = user.role === 'customer'
      ? db.prepare(`SELECT AVG((julianday(resolved_at)-julianday(created_at))*24) as avg_hours FROM complaints WHERE customer_id = ? AND resolved_at IS NOT NULL`).get(user.id)
      : db.prepare(`SELECT AVG((julianday(resolved_at)-julianday(created_at))*24) as avg_hours FROM complaints WHERE resolved_at IS NOT NULL`).get();

    return res.json({
      success: true,
      data: {
        total: totalRow.count,
        open: statusMap['open'] || 0,
        assigned: statusMap['assigned'] || 0,
        in_progress: statusMap['in_progress'] || 0,
        pending_customer: statusMap['pending_customer'] || 0,
        escalated: statusMap['escalated'] || 0,
        resolved: statusMap['resolved'] || 0,
        closed: statusMap['closed'] || 0,
        sla_breached: slaBreached.count,
        avg_resolution_hours: avgResolution.avg_hours
          ? Math.round(avgResolution.avg_hours * 10) / 10
          : null
      }
    });
  } catch (err) {
    console.error('[Dashboard] Stats error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/dashboard/agent-performance
router.get('/agent-performance', ...dashboardAuth, (req, res) => {
  try {
    const agents = db.prepare(`
      SELECT u.id, u.name
      FROM users u
      WHERE u.role = 'agent' AND u.is_active = 1
    `).all();

    const performance = agents.map(agent => {
      const stats = db.prepare(`
        SELECT
          COUNT(*) as total_assigned,
          SUM(CASE WHEN status = 'resolved' OR status = 'closed' THEN 1 ELSE 0 END) as resolved,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END) as escalated
        FROM complaints
        WHERE assigned_to = ?
      `).get(agent.id);

      const avgResolution = db.prepare(`
        SELECT AVG((julianday(resolved_at) - julianday(created_at)) * 24) as avg_hours
        FROM complaints
        WHERE assigned_to = ? AND resolved_at IS NOT NULL
      `).get(agent.id);

      const avgRating = db.prepare(`
        SELECT AVG(f.rating) as avg_rating
        FROM feedback f
        INNER JOIN complaints c ON f.complaint_id = c.id
        WHERE c.assigned_to = ?
      `).get(agent.id);

      return {
        agent_id: agent.id,
        agent_name: agent.name,
        total_assigned: stats.total_assigned || 0,
        resolved: stats.resolved || 0,
        in_progress: stats.in_progress || 0,
        escalated: stats.escalated || 0,
        avg_resolution_hours: avgResolution.avg_hours
          ? Math.round(avgResolution.avg_hours * 10) / 10
          : null,
        avg_rating: avgRating.avg_rating
          ? Math.round(avgRating.avg_rating * 10) / 10
          : null
      };
    });

    return res.json({ success: true, data: performance });
  } catch (err) {
    console.error('[Dashboard] Agent performance error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/dashboard/trends - monthly complaint counts for last 6 months
router.get('/trends', ...dashboardAuth, (req, res) => {
  try {
    // Generate last 6 months
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      months.push(`${year}-${month}`);
    }

    const trends = months.map(month => {
      const start = `${month}-01`;
      const endDate = new Date(`${month}-01`);
      endDate.setMonth(endDate.getMonth() + 1);
      const end = endDate.toISOString().slice(0, 10);

      const total = db.prepare(`
        SELECT COUNT(*) as count FROM complaints
        WHERE date(created_at) >= ? AND date(created_at) < ?
      `).get(start, end);

      const resolved = db.prepare(`
        SELECT COUNT(*) as count FROM complaints
        WHERE date(created_at) >= ? AND date(created_at) < ?
        AND status IN ('resolved', 'closed')
      `).get(start, end);

      const escalated = db.prepare(`
        SELECT COUNT(*) as count FROM complaints
        WHERE date(created_at) >= ? AND date(created_at) < ?
        AND (status = 'escalated' OR escalated_at IS NOT NULL)
      `).get(start, end);

      return {
        month,
        total: total.count,
        resolved: resolved.count,
        escalated: escalated.count
      };
    });

    return res.json({ success: true, data: trends });
  } catch (err) {
    console.error('[Dashboard] Trends error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/dashboard/category-breakdown
router.get('/category-breakdown', ...dashboardAuth, (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM complaints').get().count;

    const breakdown = db.prepare(`
      SELECT cat.name as category, COUNT(c.id) as total
      FROM categories cat
      LEFT JOIN complaints c ON c.category_id = cat.id
      WHERE cat.is_active = 1
      GROUP BY cat.id, cat.name
      ORDER BY total DESC
    `).all();

    const result = breakdown.map(row => ({
      category: row.category,
      total: row.total,
      percentage: total > 0 ? Math.round((row.total / total) * 1000) / 10 : 0
    }));

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Dashboard] Category breakdown error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/dashboard/sla-report
router.get('/sla-report', ...dashboardAuth, (req, res) => {
  try {
    const now = new Date().toISOString();
    const priorities = ['critical', 'high', 'medium', 'low'];

    const totalRow = db.prepare('SELECT COUNT(*) as count FROM complaints WHERE sla_deadline IS NOT NULL').get();
    const total = totalRow.count;

    // Within SLA: either no breach, or resolved/closed before deadline
    const withinSla = db.prepare(`
      SELECT COUNT(*) as count FROM complaints
      WHERE sla_deadline IS NOT NULL
      AND (
        sla_deadline > ?
        OR (status IN ('resolved', 'closed') AND (resolved_at < sla_deadline OR closed_at < sla_deadline))
      )
    `).get(now).count;

    const breached = total - withinSla;
    const complianceRate = total > 0 ? Math.round((withinSla / total) * 1000) / 10 : 100;

    const byPriority = priorities.map(priority => {
      const priorityTotal = db.prepare(
        'SELECT COUNT(*) as count FROM complaints WHERE priority = ? AND sla_deadline IS NOT NULL'
      ).get(priority).count;

      const priorityWithin = db.prepare(`
        SELECT COUNT(*) as count FROM complaints
        WHERE priority = ? AND sla_deadline IS NOT NULL
        AND (
          sla_deadline > ?
          OR (status IN ('resolved', 'closed') AND (resolved_at < sla_deadline OR closed_at < sla_deadline))
        )
      `).get(priority, now).count;

      const priorityBreached = priorityTotal - priorityWithin;
      const priorityCompliance = priorityTotal > 0
        ? Math.round((priorityWithin / priorityTotal) * 1000) / 10
        : 100;

      return {
        priority,
        total: priorityTotal,
        within_sla: priorityWithin,
        breached: priorityBreached,
        compliance_rate: priorityCompliance
      };
    });

    return res.json({
      success: true,
      data: {
        total_complaints: total,
        within_sla: withinSla,
        breached,
        compliance_rate: complianceRate,
        by_priority: byPriority
      }
    });
  } catch (err) {
    console.error('[Dashboard] SLA report error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
