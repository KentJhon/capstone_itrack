# backend/db.py
import os
import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv

# ✅ Load .env when running locally
load_dotenv()

def get_db():
    """
    Create and return a MySQL connection using environment variables.

    - Works locally with defaults (XAMPP).
    - Works in deployment when DB_* env vars are set in the host (Render, etc.).
    """
    try:
        host = os.getenv("DB_HOST", "127.0.0.1")
        port = int(os.getenv("DB_PORT", "3306"))  # ✅ defaults to 3306
        user = os.getenv("DB_USER", "root")
        password = os.getenv("DB_PASSWORD", "")
        database = os.getenv("DB_NAME", "itrack")

        conn = mysql.connector.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=database,
        )

        if conn.is_connected():
            return conn

        print("❌ Database connected but connection is not active.")
        raise Error("Connection is not active")

    except Error as e:
        # This will show up in your backend logs
        print("❌ Database connection error:", e)
        # Let FastAPI return 500 instead of silently returning None
        raise
