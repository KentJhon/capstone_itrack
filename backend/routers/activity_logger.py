# backend/routers/activity_logger.py
import logging
from datetime import datetime
from typing import Any

from mysql.connector import IntegrityError
from db import get_db


def log_activity(user_id: Any, action: str, description: str) -> None:
    """
    Insert a row into activity_logs.

    - Safely converts user_id to int or None.
    - If FK/NOT NULL constraints fail, we log the error but DO NOT crash the main request.
    - The ActivityLog frontend treats:
        - user_id == None or 0 => "System"
        - otherwise joins to 'user' table for username.
    """
    # Convert user_id safely
    try:
        uid = int(user_id) if user_id is not None else None
    except (TypeError, ValueError):
        uid = None

    conn = None
    cur = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO activity_logs (user_id, action, description, timestamp)
            VALUES (%s, %s, %s, %s)
            """,
            (uid, action, description, datetime.now()),
        )
        conn.commit()

    except IntegrityError as e:
        # Most likely: FK or NOT NULL violation on user_id
        logging.warning("Failed to log activity due to FK/NULL constraint: %s", e)

    except Exception as e:
        logging.exception("Failed to log activity: %s", e)

    finally:
        if cur is not None:
            try:
                cur.close()
            except Exception:
                pass
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass
