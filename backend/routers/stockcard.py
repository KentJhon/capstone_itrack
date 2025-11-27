# stockcard.py
from datetime import datetime, date
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
    date: str                        # transaction_date (YYYY-MM-DD or "")
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
    # we'll keep the field, but often set it to None to avoid risky date math
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


# ---------- HELPER TO EXTRACT ACTOR FROM COOKIE ----------

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
def get_stock_card(
    item_id: int,
    access_token: str | None = Cookie(default=None, alias=COOKIE_NAME_AT),
):
    """
    Returns:
    - header: item info + opening_balance + current_stock
    - movements: one row per order_line for this item
    Balance per row is computed in the frontend.

    This version is deliberately defensive to avoid 500 errors
    from weird DB values (especially in garments).
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

        # Make sure these are plain ints
        try:
            current_stock = int(item["stock_quantity"] or 0)
        except Exception:
            current_stock = 0

        try:
            reorder_level = int(item["reorder_level"] or 0)
        except Exception:
            reorder_level = 0

        # 2️⃣ Get all issuance history (order_line) with LEFT JOIN to avoid dropping rows
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
            LEFT JOIN `order` o ON o.order_id = ol.order_id
            WHERE ol.item_id = %s
            ORDER BY 
                o.transaction_date IS NULL,         -- rows without date go last
                o.transaction_date ASC,
                ol.order_line_id ASC
            """,
            (item_id,),
        )

        rows = cur.fetchall() or []

        movements: List[StockCardMovement] = []

        # 3️⃣ Compute total_issued in a very defensive way
        total_issued = 0
        for r in rows:
            qty_raw = r.get("quantity")
            if qty_raw is None:
                continue
            try:
                qty_int = int(qty_raw)
            except Exception:
                continue
            if qty_int <= 0:
                continue
            total_issued += qty_int

        # 4️⃣ opening_balance = stock before any issuance
        opening_balance = current_stock + total_issued

        # For now, don't risk weird date math → keep estimated_days_to_consume = None
        est_days_to_consume = None

        # 5️⃣ Build movement rows (one row per order_line)
        for r in rows:
            # issuance quantity (for display)
            qty_raw = r.get("quantity")
            try:
                qty_int = int(qty_raw) if qty_raw is not None else 0
            except Exception:
                qty_int = 0

            # transaction date → safe string
            tx_date = r.get("transaction_date")
            if isinstance(tx_date, (datetime, date)):
                date_str = tx_date.strftime("%Y-%m-%d")
            elif isinstance(tx_date, str):
                # assume it's already in a printable format
                date_str = tx_date
            else:
                date_str = ""

            movements.append(
                StockCardMovement(
                    id=int(r["order_line_id"]),
                    date=date_str,
                    reference_no=r.get("reference_no") or "",
                    receipt_qty=(
                        float(r["receipt_qty"])
                        if r.get("receipt_qty") is not None
                        else None
                    ),
                    issuance_qty=qty_int,
                    office=r.get("office") or "",
                    days_to_consume=(
                        float(r["days_to_consume"])
                        if r.get("days_to_consume") is not None
                        else None
                    ),
                )
            )

        header = StockCardHeader(
            item_id=int(item["item_id"]),
            name=str(item["name"]),
            unit=item.get("unit"),
            category=item.get("category"),
            stock_no=str(item["item_id"]),  # adjust if you have a stock_no col
            reorder_level=reorder_level,
            current_stock=current_stock,
            opening_balance=opening_balance,
            estimated_days_to_consume=est_days_to_consume,
        )

        # 🔍 Log who generated the stock card
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
