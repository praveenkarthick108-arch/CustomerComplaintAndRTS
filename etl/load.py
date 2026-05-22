import os
import sqlite3
import math
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'backend', 'complaint_tracker.db')

ANALYTICS_TABLES_DDL = """
CREATE TABLE IF NOT EXISTS etl_run_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_at TEXT NOT NULL,
  status TEXT NOT NULL,
  rows_extracted INTEGER DEFAULT 0,
  rows_loaded INTEGER DEFAULT 0,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS analytics_complaints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  complaint_id INTEGER NOT NULL,
  complaint_number TEXT,
  complaint_category TEXT,
  priority TEXT,
  status TEXT,
  agent_name TEXT,
  created_date TEXT,
  resolved_date TEXT,
  sla_hours INTEGER,
  resolution_time_hours REAL,
  resolution_days REAL,
  is_sla_breached INTEGER DEFAULT 0,
  customer_region TEXT,
  product_line TEXT,
  feedback_rating REAL,
  month_year TEXT
);

CREATE TABLE IF NOT EXISTS analytics_sla_report (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  priority TEXT NOT NULL,
  sla_hours INTEGER NOT NULL,
  total_complaints INTEGER DEFAULT 0,
  breached_count INTEGER DEFAULT 0,
  within_sla_count INTEGER DEFAULT 0,
  breach_rate_pct REAL DEFAULT 0.0,
  avg_resolution_hours REAL,
  last_updated TEXT
);

CREATE TABLE IF NOT EXISTS analytics_category_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  total_complaints INTEGER DEFAULT 0,
  resolved_count INTEGER DEFAULT 0,
  escalated_count INTEGER DEFAULT 0,
  breached_count INTEGER DEFAULT 0,
  avg_resolution_hours REAL,
  avg_feedback_rating REAL,
  last_updated TEXT
);

CREATE TABLE IF NOT EXISTS analytics_agent_performance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_name TEXT NOT NULL,
  total_assigned INTEGER DEFAULT 0,
  resolved_count INTEGER DEFAULT 0,
  escalated_count INTEGER DEFAULT 0,
  breached_count INTEGER DEFAULT 0,
  avg_resolution_hours REAL,
  avg_feedback_rating REAL,
  resolution_rate_pct REAL DEFAULT 0.0,
  last_updated TEXT
);

CREATE TABLE IF NOT EXISTS analytics_monthly_trends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_year TEXT NOT NULL,
  total_complaints INTEGER DEFAULT 0,
  resolved_count INTEGER DEFAULT 0,
  escalated_count INTEGER DEFAULT 0,
  breached_count INTEGER DEFAULT 0,
  avg_resolution_hours REAL,
  new_complaints INTEGER DEFAULT 0,
  last_updated TEXT
);
"""


def get_connection():
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(
            f"SQLite database not found at: {os.path.abspath(DB_PATH)}\n"
            "Start the backend server at least once to create the database."
        )
    return sqlite3.connect(DB_PATH)


def create_analytics_tables(conn):
    conn.executescript(ANALYTICS_TABLES_DDL)
    conn.commit()
    print("[Load] Analytics tables created/verified.")


def load_etl_run_log(conn, status, rows_extracted, rows_loaded, error_message=None):
    run_at = datetime.now(timezone.utc).isoformat()
    cur = conn.execute(
        "INSERT INTO etl_run_log (run_at, status, rows_extracted, rows_loaded, error_message) VALUES (?,?,?,?,?)",
        (run_at, status, rows_extracted, rows_loaded, error_message)
    )
    conn.commit()
    return cur.lastrowid


def _safe(val):
    """Convert pandas NaN/NaT and Python float nan to None for SQLite."""
    if val is None:
        return None
    try:
        if math.isnan(float(val)):
            return None
    except (TypeError, ValueError):
        pass
    if str(val) in ('nan', 'NaT', '', 'None'):
        return None
    return val


def load_analytics_complaints(conn, df):
    conn.execute("DELETE FROM analytics_complaints")
    rows = []
    for _, row in df.iterrows():
        rows.append((
            _safe(row.get('complaint_id')),
            _safe(row.get('complaint_number')),
            _safe(row.get('complaint_category')),
            _safe(row.get('priority')),
            _safe(row.get('status')),
            _safe(row.get('agent_name')),
            _safe(row.get('created_date')),
            _safe(row.get('resolved_date')) or None,
            _safe(row.get('sla_hours')),
            _safe(row.get('resolution_time_hours')),
            _safe(row.get('resolution_days')),
            int(_safe(row.get('is_sla_breached')) or 0),
            _safe(row.get('customer_region')),
            _safe(row.get('product_line')),
            _safe(row.get('feedback_rating')),
            _safe(row.get('month_year')),
        ))

    conn.executemany("""
        INSERT INTO analytics_complaints (
          complaint_id, complaint_number, complaint_category, priority, status,
          agent_name, created_date, resolved_date, sla_hours, resolution_time_hours,
          resolution_days, is_sla_breached, customer_region, product_line, feedback_rating, month_year
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, rows)
    conn.commit()
    print(f"[Load] Inserted {len(rows)} rows into analytics_complaints.")
    return len(rows)


def load_aggregated_tables(conn):
    _populate_sla_report(conn)
    _populate_category_stats(conn)
    _populate_agent_performance(conn)
    _populate_monthly_trends(conn)
    conn.commit()
    print("[Load] All aggregated analytics tables populated.")


def _populate_sla_report(conn):
    conn.execute("DELETE FROM analytics_sla_report")
    conn.execute("""
        INSERT INTO analytics_sla_report
          (priority, sla_hours, total_complaints, breached_count, within_sla_count,
           breach_rate_pct, avg_resolution_hours, last_updated)
        SELECT
          priority,
          sla_hours,
          COUNT(*) AS total_complaints,
          SUM(is_sla_breached) AS breached_count,
          COUNT(*) - SUM(is_sla_breached) AS within_sla_count,
          ROUND(CAST(SUM(is_sla_breached) AS REAL) / COUNT(*) * 100, 2) AS breach_rate_pct,
          ROUND(AVG(CASE WHEN resolution_time_hours IS NOT NULL THEN resolution_time_hours END), 2) AS avg_resolution_hours,
          datetime('now')
        FROM analytics_complaints
        GROUP BY priority, sla_hours
    """)


def _populate_category_stats(conn):
    conn.execute("DELETE FROM analytics_category_stats")
    conn.execute("""
        INSERT INTO analytics_category_stats
          (category, total_complaints, resolved_count, escalated_count, breached_count,
           avg_resolution_hours, avg_feedback_rating, last_updated)
        SELECT
          complaint_category,
          COUNT(*) AS total_complaints,
          SUM(CASE WHEN status IN ('resolved','closed') THEN 1 ELSE 0 END) AS resolved_count,
          SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END) AS escalated_count,
          SUM(is_sla_breached) AS breached_count,
          ROUND(AVG(CASE WHEN resolution_time_hours IS NOT NULL THEN resolution_time_hours END), 2) AS avg_resolution_hours,
          ROUND(AVG(CASE WHEN feedback_rating IS NOT NULL THEN feedback_rating END), 2) AS avg_feedback_rating,
          datetime('now')
        FROM analytics_complaints
        GROUP BY complaint_category
    """)


def _populate_agent_performance(conn):
    conn.execute("DELETE FROM analytics_agent_performance")
    conn.execute("""
        INSERT INTO analytics_agent_performance
          (agent_name, total_assigned, resolved_count, escalated_count, breached_count,
           avg_resolution_hours, avg_feedback_rating, resolution_rate_pct, last_updated)
        SELECT
          agent_name,
          COUNT(*) AS total_assigned,
          SUM(CASE WHEN status IN ('resolved','closed') THEN 1 ELSE 0 END) AS resolved_count,
          SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END) AS escalated_count,
          SUM(is_sla_breached) AS breached_count,
          ROUND(AVG(CASE WHEN resolution_time_hours IS NOT NULL THEN resolution_time_hours END), 2) AS avg_resolution_hours,
          ROUND(AVG(CASE WHEN feedback_rating IS NOT NULL THEN feedback_rating END), 2) AS avg_feedback_rating,
          ROUND(CAST(SUM(CASE WHEN status IN ('resolved','closed') THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 2) AS resolution_rate_pct,
          datetime('now')
        FROM analytics_complaints
        GROUP BY agent_name
    """)


def _populate_monthly_trends(conn):
    conn.execute("DELETE FROM analytics_monthly_trends")
    conn.execute("""
        INSERT INTO analytics_monthly_trends
          (month_year, total_complaints, resolved_count, escalated_count, breached_count,
           avg_resolution_hours, new_complaints, last_updated)
        SELECT
          month_year,
          COUNT(*) AS total_complaints,
          SUM(CASE WHEN status IN ('resolved','closed') THEN 1 ELSE 0 END) AS resolved_count,
          SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END) AS escalated_count,
          SUM(is_sla_breached) AS breached_count,
          ROUND(AVG(CASE WHEN resolution_time_hours IS NOT NULL THEN resolution_time_hours END), 2) AS avg_resolution_hours,
          COUNT(*) AS new_complaints,
          datetime('now')
        FROM analytics_complaints
        GROUP BY month_year
        ORDER BY month_year
    """)
