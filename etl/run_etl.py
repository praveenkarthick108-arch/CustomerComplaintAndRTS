"""
Customer Complaint ETL Pipeline
Run from the etl/ directory:  python run_etl.py
"""
import sys
import os

# Allow imports from the etl folder regardless of CWD
sys.path.insert(0, os.path.dirname(__file__))

import extract as ext
import transform as tfm
import load as ldr

def main():
    print("=" * 52)
    print("  Customer Complaint ETL Pipeline Starting...")
    print("=" * 52)

    raw_df = None
    conn = None

    try:
        # --- Extract ---
        print("\n[Step 1/3] Extracting data from CSV...")
        raw_df = ext.extract(ext.RAW_CSV_PATH)
        rows_extracted = len(raw_df)

        # --- Transform ---
        print("\n[Step 2/3] Transforming and validating data...")
        clean_df = tfm.transform(raw_df)
        rows_clean = len(clean_df)

        # --- Load ---
        print("\n[Step 3/3] Loading data into SQLite analytics tables...")
        conn = ldr.get_connection()
        ldr.create_analytics_tables(conn)
        rows_loaded = ldr.load_analytics_complaints(conn, clean_df)
        ldr.load_aggregated_tables(conn)
        ldr.load_etl_run_log(conn, 'success', rows_extracted, rows_loaded)

        print("\n" + "=" * 52)
        print(f"  ETL Pipeline Complete!")
        print(f"  Extracted : {rows_extracted} rows")
        print(f"  Cleaned   : {rows_clean} rows")
        print(f"  Loaded    : {rows_loaded} rows into analytics tables")
        print("  Status    : SUCCESS")
        print("=" * 52)

    except Exception as e:
        print(f"\n[ERROR] ETL Pipeline Failed: {e}")
        if conn is not None:
            try:
                ldr.load_etl_run_log(
                    conn, 'failed',
                    rows_extracted=len(raw_df) if raw_df is not None else 0,
                    rows_loaded=0,
                    error_message=str(e)
                )
            except Exception:
                pass
        raise

    finally:
        if conn is not None:
            conn.close()


if __name__ == '__main__':
    main()
