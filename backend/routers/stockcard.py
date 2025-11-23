# stockcard.py
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Cookie
from pydantic import BaseModel

from db import get_db  # your existing get_db()
from security.jwt_tools import verify_token
from security.deps import COOKIE_NAME_AT
from routers.activity_logger import log_activity

router = APIRouter(prefix="/stockcard", tags=["Stock Card"])


# ---------- MODELS FOR GET ----------

class StockCardMovement(BaseModel):
    # order_line_id
    id: int

    # UI fields
    date: str                        # transaction_date (YYYY-MM-DD)
    reference_no: Optional[str] = None
    receipt_qty: Optional[float] = None
    issuance_qty: Optional[int] = None
    office: Optional[str] = None
    days_to_consume: Optional[float] = None


class StockCardHeader(BaseModel):
    item_id: int
    name: str
    unit: Optional[str] = None
    category: Optional[str] = None
    stock_no: str
    reorder_level: int
    current_stock: int           # real-time from item.stock_quantity
    opening_balance: int         # first balance (row 0 in UI)
    estimated_days_to_consume: Optional[float] = None


class StockCardResponse(BaseModel):
    header: StockCardHeader
    movements: List[StockCardMovement]


# ---------- MODELS FOR PUT (SAVE ONLY EDITABLE FIELDS) ----------

class StockCardUpdateMovement(BaseModel):
    id: int                       # order_line_id
    reference_no: Optional[str] = None
    office: Optional[str] = None
    days_to_consume: Optional[float] = None
    receipt_qty: Optional[float] = None


class StockCardUpdateRequest(BaseModel):
    movements: List[StockCardUpdateMovement]

def _actor_id_from_cookie(access_token: str | None) -> Optional[int]:
    if not access_token:
        return None
    try:
        claims = verify_token(access_token)
        if claims.get("type") == "access":
            return int(claims["sub"])
    except Exception:
        return None
    return None

# ---------- GET /stockcard/{item_id} ----------

@router.get("/{item_id}", response_model=StockCardResponse)
def get_stock_card(item_id: int, access_token: str | None = Cookie(default=None, alias=COOKIE_NAME_AT)):
    """
    Returns:
    - header: item info + opening_balance + current_stock
    - movements: one row per order_line for this item
    Balance per row is computed in the frontend.
    """
    conn = get_db()
    try:
        cur = conn.cursor(dictionary=True)

        # 1️⃣ Get item
        cur.execute(
            """
            SELECT item_id, name, unit, category, stock_quantity, reorder_level
            FROM item
            WHERE item_id = %s
            """,
            (item_id,),
        )
        item = cur.fetchone()
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        current_stock = int(item["stock_quantity"] or 0)
        reorder_level = int(item["reorder_level"] or 0)

        # 2️⃣ Get all issuance history (order_line)
        #    reference_no is taken ONLY from order_line.reference_no
        cur.execute(
            """
            SELECT 
                o.order_id,
                o.transaction_date,
                ol.order_line_id,
                ol.quantity,
                ol.reference_no,
                ol.office,
                ol.days_to_consume,
                ol.receipt_qty
            FROM `order_line` ol
            JOIN `order` o ON o.order_id = ol.order_id
            WHERE ol.item_id = %s
            ORDER BY o.transaction_date ASC, o.order_id ASC
            """,
            (item_id,),
        )

        # If you really want to order by reference_no DESC instead:
        # cur.execute(
        #     """
        #     SELECT 
        #         o.order_id,
        #         o.transaction_date,
        #         ol.order_line_id,
        #         ol.quantity,
        #         ol.reference_no,
        #         ol.office,
        #         ol.days_to_consume,
        #         ol.receipt_qty
        #     FROM `order_line` ol
        #     JOIN `order` o ON o.order_id = ol.order_id
        #     WHERE ol.item_id = %s
        #     ORDER BY ol.reference_no DESC
        #     """,
        #     (item_id,),
        # )

        rows = cur.fetchall()

        movements: List[StockCardMovement] = []

        if rows:
            total_issued = sum(int(r["quantity"]) for r in rows)

            # opening_balance = stock before any issuance
            # current_stock   = opening_balance - total_issued
            # => opening_balance = current_stock + total_issued
            opening_balance = current_stock + total_issued

            first_date = rows[0]["transaction_date"]
            last_date = rows[-1]["transaction_date"]
            days_span = max((last_date - first_date).days, 1)
            daily_usage = total_issued / days_span if days_span > 0 else 0
            est_days_to_consume = (
                round(current_stock / daily_usage, 2) if daily_usage > 0 else None
            )
        else:
            opening_balance = current_stock
            est_days_to_consume = None

        # Build movement rows (one row per order_line)
        for r in rows:
            qty = int(r["quantity"])
            movements.append(
                StockCardMovement(
                    id=r["order_line_id"],
                    date=r["transaction_date"].strftime("%Y-%m-%d"),
                    # ✅ ONLY from order_line.reference_no
                    reference_no=r.get("reference_no") or "",
                    receipt_qty=(
                        float(r["receipt_qty"])
                        if r.get("receipt_qty") is not None
                        else None
                    ),
                    issuance_qty=qty,
                    office=r.get("office") or "",
                    days_to_consume=(
                        float(r["days_to_consume"])
                        if r.get("days_to_consume") is not None
                        else None
                    ),
                )
            )

        header = StockCardHeader(
            item_id=item["item_id"],
            name=item["name"],
            unit=item.get("unit"),
            category=item.get("category"),
            stock_no=str(item["item_id"]),  # adjust if you have a stock_no col
            reorder_level=reorder_level,
            current_stock=current_stock,
            opening_balance=opening_balance,
            estimated_days_to_consume=est_days_to_consume,
        )

        actor_id = _actor_id_from_cookie(access_token)
        log_activity(
            actor_id,
            "Stock Card",
            f"Generated stock card for item #{item['item_id']} ({item['name']}).",
        )

        return StockCardResponse(header=header, movements=movements)
    finally:
        conn.close()


# ---------- PUT /stockcard/{item_id} ----------

@router.put("/{item_id}")
def update_stock_card(item_id: int, payload: StockCardUpdateRequest):
    """
    Save manual edits from the Stock Card into order_line.
    Only updates existing rows (by order_line_id).
    """
    conn = get_db()
    try:
        cur = conn.cursor()

        for m in payload.movements:
            reference_no = m.reference_no if m.reference_no else None
            office = m.office if m.office else None
            days_to_consume = m.days_to_consume
            receipt_qty = m.receipt_qty

            cur.execute(
                """
                UPDATE `order_line`
                SET reference_no = %s,
                    office = %s,
                    days_to_consume = %s,
                    receipt_qty = %s
                WHERE order_line_id = %s
                  AND item_id = %s
                """,
                (
                    reference_no,
                    office,
                    days_to_consume,
                    receipt_qty,
                    m.id,
                    item_id,
                ),
            )

        conn.commit()
        return {"status": "ok", "updated": True}
    finally:
        conn.close()
