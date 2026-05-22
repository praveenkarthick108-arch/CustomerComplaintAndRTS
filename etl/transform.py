import pandas as pd
import numpy as np

SLA_MAP = {'critical': 4, 'high': 24, 'medium': 48, 'low': 72}

STATUS_MAP = {
    'open': 'open',
    'assigned': 'assigned',
    'in progress': 'in_progress',
    'in_progress': 'in_progress',
    'pending_customer': 'pending_customer',
    'pending customer': 'pending_customer',
    'escalated': 'escalated',
    'resolved': 'resolved',
    'closed': 'closed',
}

VALID_PRIORITIES = set(SLA_MAP.keys())

COLUMN_ORDER = [
    'complaint_id', 'complaint_number', 'complaint_category', 'priority', 'status',
    'agent_name', 'created_date', 'resolved_date', 'sla_hours', 'resolution_time_hours',
    'resolution_days', 'is_sla_breached', 'customer_region', 'product_line',
    'feedback_rating', 'month_year',
]


def transform(df):
    """Clean, validate, and enrich the raw complaints DataFrame."""
    df = df.copy()
    initial_count = len(df)

    # Strip whitespace from string columns
    str_cols = df.select_dtypes(include='object').columns
    for col in str_cols:
        df[col] = df[col].astype(str).str.strip()
        df[col] = df[col].replace('nan', np.nan)

    # Normalize text columns to lowercase
    for col in ['priority', 'status', 'complaint_category']:
        if col in df.columns:
            df[col] = df[col].str.lower().str.strip()

    # Parse dates
    df['created_date'] = pd.to_datetime(df['created_date'], errors='coerce')
    df['resolved_date'] = pd.to_datetime(df['resolved_date'], errors='coerce')

    # Coerce numeric columns
    df['sla_hours'] = pd.to_numeric(df['sla_hours'], errors='coerce')
    df['resolution_time_hours'] = pd.to_numeric(df['resolution_time_hours'], errors='coerce')
    df['is_sla_breached'] = pd.to_numeric(df['is_sla_breached'], errors='coerce').fillna(0).astype(int)
    df['feedback_rating'] = pd.to_numeric(df['feedback_rating'], errors='coerce')

    # Enforce SLA hours from priority (fix dirty data)
    df['sla_hours'] = df['priority'].map(SLA_MAP).fillna(df['sla_hours']).astype('Int64')

    # Normalize status values
    df['status'] = df['status'].map(STATUS_MAP).fillna(df['status'])

    # Drop invalid rows
    before_drop = len(df)
    df = df.dropna(subset=['complaint_id'])
    df = df[df['priority'].isin(VALID_PRIORITIES)]
    df = df.dropna(subset=['created_date'])
    dropped = before_drop - len(df)
    if dropped > 0:
        print(f"[Transform] Dropped {dropped} invalid rows (missing complaint_id, bad priority, or bad created_date)")

    # Add derived columns
    df['month_year'] = df['created_date'].dt.strftime('%Y-%m')
    df['resolution_days'] = (df['resolution_time_hours'] / 24.0).round(2)

    # Format dates back to ISO strings
    df['created_date'] = df['created_date'].dt.strftime('%Y-%m-%d')
    df['resolved_date'] = df['resolved_date'].dt.strftime('%Y-%m-%d').where(df['resolved_date'].notna(), '')

    # Reorder columns
    existing = [c for c in COLUMN_ORDER if c in df.columns]
    df = df[existing]

    final_count = len(df)
    print(f"[Transform] {initial_count} raw rows -> {final_count} clean rows")

    breached = df['is_sla_breached'].sum()
    print(f"[Transform] SLA breached: {breached} ({breached/final_count*100:.1f}%)")
    print(f"[Transform] Priority breakdown: {df['priority'].value_counts().to_dict()}")

    return df
