import logging
from fastapi import APIRouter, HTTPException, Query, Cookie

from db import get_db
from security.jwt_tools import verify_token
from security.deps import COOKIE_NAME_AT
from routers.activity_logger import log_activity

router = APIRouter(prefix="/reports", tags=["Reports"])


def _actor_id_from_cookie(access_token: str | None) -> int | None:
    if not access_token:
        return None
    try:
        claims = verify_token(access_token)
        if claims.get("type") == "access":
            return int(claims["sub"])
    except Exception:
        return None
    return None


@router.get("/monthly")
def get_monthly_report(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    access_token: str | None = Cookie(default=None, alias=COOKIE_NAME_AT),
):
    """
    Monthly report based on ORDER + ORDER_LINE + ITEM.
    """
    conn = get_db()
    cur = conn.cursor(dictionary=True)

    try:
        cur.execute(
            """
            SELECT
                DATE(o.transaction_date)      AS date,
                o.customer_name               AS payer,
                ol.quantity                   AS qty_sold,
                COALESCE(i.unit, 'pcs')       AS unit,
                i.name                        AS description,
                i.price                       AS unit_cost,
                (i.price * ol.quantity)       AS total_cost,
                CASE
                    WHEN i.category = 'Souvenir' THEN '-'
                    ELSE o.OR_number
                END                           AS or_number
            FROM `order` o
            JOIN order_line ol ON ol.order_id = o.order_id
            JOIN item i        ON i.item_id = ol.item_id
            WHERE YEAR(o.transaction_date) = %s
              AND MONTH(o.transaction_date) = %s
              AND (
                    (o.OR_number IS NOT NULL AND o.OR_number <> '-')
                    OR i.category = 'Souvenir'
                  )
            ORDER BY o.transaction_date ASC,
                     o.order_id,
                     ol.order_line_id
            """,
            (year, month),
        )
        rows = cur.fetchall()

        actor_id = _actor_id_from_cookie(access_token)
        log_activity(
            actor_id,
            "Monthly Report",
            f"Generated monthly sales and issuance report for {year:04d}-{month:02d}.",
        )

        return {"rows": rows}
    except Exception as e:
        logging.exception("Error fetching monthly report")
        raise HTTPException(status_code=500, detail=f"Server error: {e}")
    finally:
        try:
            cur.close()
        except Exception:
            pass
        conn.close()
