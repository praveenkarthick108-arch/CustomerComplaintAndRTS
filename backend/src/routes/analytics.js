const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const analyticsAuth = [authenticate, authorize('admin', 'supervisor', 'quality')];

// GET /api/analytics/summary
router.get('/summary', analyticsAuth, (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT
        COUNT(*) AS total_complaints,
        SUM(is_sla_breached) AS sla_breached,
        SUM(CASE WHEN status IN ('resolved','closed') THEN 1 ELSE 0 END) AS total_resolved,
        SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END) AS total_escalated,
        ROUND(AVG(CASE WHEN resolution_time_hours IS NOT NULL THEN resolution_time_hours END), 2) AS avg_resolution_hours,
        ROUND(AVG(CASE WHEN feedback_rating IS NOT NULL THEN feedback_rating END), 2) AS avg_feedback_rating
      FROM analytics_complaints
    `).get();

    const lastRun = db.prepare(
      'SELECT run_at, status, rows_loaded FROM etl_run_log ORDER BY id DESC LIMIT 1'
    ).get();

    if (!stats || stats.total_complaints === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No ETL data found. Run the ETL pipeline first: cd etl && python run_etl.py'
      });
    }

    const total = stats.total_complaints || 1;
    const breached = stats.sla_breached || 0;

    res.json({
      success: true,
      data: {
        total_complaints: stats.total_complaints,
        sla_breached: breached,
        sla_compliance_rate: Math.round(((total - breached) / total) * 100 * 100) / 100,
        total_resolved: stats.total_resolved,
        total_escalated: stats.total_escalated,
        avg_resolution_hours: stats.avg_resolution_hours,
        avg_feedback_rating: stats.avg_feedback_rating,
        etl_last_run: lastRun ? lastRun.run_at : null,
        etl_status: lastRun ? lastRun.status : null,
        etl_rows_loaded: lastRun ? lastRun.rows_loaded : 0,
      }
    });
  } catch (err) {
    console.error('[Analytics] /summary error:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/analytics/sla-report
router.get('/sla-report', analyticsAuth, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT priority, sla_hours, total_complaints, breached_count, within_sla_count,
             breach_rate_pct, avg_resolution_hours
      FROM analytics_sla_report
      ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END
    `).all();

    const overall = rows.reduce((acc, r) => ({
      total_complaints: (acc.total_complaints || 0) + r.total_complaints,
      breached_count: (acc.breached_count || 0) + r.breached_count,
      within_sla_count: (acc.within_sla_count || 0) + r.within_sla_count,
    }), {});

    if (overall.total_complaints > 0) {
      overall.breach_rate_pct = Math.round((overall.breached_count / overall.total_complaints) * 100 * 100) / 100;
    } else {
      overall.breach_rate_pct = 0;
    }

    res.json({ success: true, data: { overall, by_priority: rows } });
  } catch (err) {
    console.error('[Analytics] /sla-report error:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/analytics/category-stats
router.get('/category-stats', analyticsAuth, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT category, total_complaints, resolved_count, escalated_count, breached_count,
             avg_resolution_hours, avg_feedback_rating
      FROM analytics_category_stats
      ORDER BY total_complaints DESC
    `).all();
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Analytics] /category-stats error:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/analytics/agent-performance
router.get('/agent-performance', analyticsAuth, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT agent_name, total_assigned, resolved_count, escalated_count, breached_count,
             avg_resolution_hours, avg_feedback_rating, resolution_rate_pct
      FROM analytics_agent_performance
      ORDER BY total_assigned DESC
    `).all();
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Analytics] /agent-performance error:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/analytics/monthly-trends
router.get('/monthly-trends', analyticsAuth, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT month_year, total_complaints, resolved_count, escalated_count, breached_count,
             avg_resolution_hours, new_complaints
      FROM analytics_monthly_trends
      ORDER BY month_year ASC
    `).all();
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Analytics] /monthly-trends error:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/analytics/region-stats
router.get('/region-stats', analyticsAuth, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT customer_region AS region, COUNT(*) AS total, SUM(is_sla_breached) AS breached
      FROM analytics_complaints
      GROUP BY customer_region
      ORDER BY total DESC
    `).all();
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Analytics] /region-stats error:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/analytics/etl-log  (admin only)
router.get('/etl-log', authenticate, authorize('admin'), (req, res) => {
  try {
    const rows = db.prepare(
      'SELECT id, run_at, status, rows_extracted, rows_loaded, error_message FROM etl_run_log ORDER BY id DESC LIMIT 20'
    ).all();
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Analytics] /etl-log error:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
