import os
import pandas as pd

RAW_CSV_PATH = os.path.join(os.path.dirname(__file__), '..', 'datasets', 'complaints_data.csv')


def extract(csv_path):
    """Load raw complaint records from CSV into a DataFrame."""
    if not os.path.exists(csv_path):
        raise FileNotFoundError(
            f"Dataset not found at: {os.path.abspath(csv_path)}\n"
            "Make sure the datasets/complaints_data.csv file exists."
        )

    df = pd.read_csv(csv_path)
    print(f"[Extract] Loaded {len(df)} rows, {len(df.columns)} columns from {csv_path}")
    print(f"[Extract] Columns: {list(df.columns)}")
    return df
