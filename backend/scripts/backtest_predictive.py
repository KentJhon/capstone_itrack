"""
Backtest the predictive restocking models using your historical data.

Run from backend/:
  python -m scripts.backtest_predictive --horizon 3 --min-months 6
"""
from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path
from typing import Dict, List, Tuple

import pandas as pd

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.append(str(BACKEND_ROOT))

from services.predictive_service import (  # noqa: E402
    load_history_from_db,
    load_history_from_excel,
    to_monthly,
    fallback_next_month,
    _fit_monthly_prophet,
)


def safe_mape(actuals: List[float], preds: List[float]) -> float | None:
    nums = []
    for a, p in zip(actuals, preds):
        if a == 0:
            continue
        nums.append(abs(a - p) / a)
    if not nums:
        return None
    return round(100 * sum(nums) / len(nums), 2)


def safe_mae(actuals: List[float], preds: List[float]) -> float | None:
    if not actuals:
        return None
    return round(sum(abs(a - p) for a, p in zip(actuals, preds)) / len(actuals), 2)


def forecast_from_train(train_df: pd.DataFrame, horizon: int) -> List[Tuple[str, int]]:
    """
    Mirror the app's logic: Prophet when history is rich; fallback otherwise.
    train_df must have ['month', 'ds', 'y'].
    """
    n_months = train_df["y"].dropna().shape[0]
    last_month = train_df["month"].max()

    # Fallback path (sparse)
    if n_months < 12:
        base = fallback_next_month(train_df)
        rows = []
        cursor = last_month
        for _ in range(horizon):
            cursor = cursor + 1
            rows.append((str(cursor), int(base)))
        return rows

    # Prophet path
    if n_months < 2:
        base = fallback_next_month(train_df)
        return [(str(last_month + i + 1), int(base)) for i in range(horizon)]

    model = _fit_monthly_prophet(train_df[["ds", "y"]])
    future = model.make_future_dataframe(periods=horizon, freq="MS", include_history=False)
    fc = model.predict(future)[["ds", "yhat"]].copy()
    fc["month"] = fc["ds"].dt.to_period("M")
    fc["forecast_qty"] = (
        fc["yhat"]
        .fillna(0.0)
        .clip(lower=0.0)
        .round(0)
        .astype(int)
    )
    return list(zip(fc["month"].astype(str).tolist(), fc["forecast_qty"].tolist()))


def backtest(monthly: pd.DataFrame, horizon: int, min_months: int) -> List[Dict[str, object]]:
    results: List[Dict[str, object]] = []
    for name in sorted(monthly["item_name"].unique().tolist(), key=str.casefold):
        item_df = monthly.loc[monthly["item_name"].str.casefold() == name.casefold()].copy()
        item_df = item_df.sort_values("month").reset_index(drop=True)
        total_months = item_df["y"].dropna().shape[0]
        if total_months < max(min_months, horizon + 1):
            continue

        train_df = item_df.iloc[:-horizon]
        test_df = item_df.iloc[-horizon:]

        preds = forecast_from_train(train_df, horizon=horizon)
        pred_map = {m: q for m, q in preds}

        actuals: List[float] = []
        preds_aligned: List[float] = []
        for _, row in test_df.iterrows():
            m = str(row["month"])
            actuals.append(float(row["y"]))
            preds_aligned.append(float(pred_map.get(m, 0.0)))

        mae = safe_mae(actuals, preds_aligned)
        mape = safe_mape(actuals, preds_aligned)

        results.append(
            {
                "item_name": name,
                "horizon": horizon,
                "train_months": int(total_months - horizon),
                "mae": mae,
                "mape": mape,
                "last_train_month": str(train_df["month"].max()),
            }
        )
    return results


def main():
    parser = argparse.ArgumentParser(description="Backtest predictive models.")
    parser.add_argument("--horizon", type=int, default=3, help="Holdout months")
    parser.add_argument("--min-months", type=int, default=6, help="Minimum months to include an item")
    parser.add_argument(
        "--source",
        choices=["auto", "db", "csv"],
        default="auto",
        help="Where to load history from (auto tries DB then CSV).",
    )
    args = parser.parse_args()

    # Load history
    hist = None
    if args.source in ("auto", "db"):
        hist = load_history_from_db()
    if (hist is None or hist.empty) and args.source in ("auto", "csv"):
        hist = load_history_from_excel()

    if hist is None or hist.empty:
        print("No history found (DB/CSV). Aborting.")
        sys.exit(1)

    monthly = to_monthly(hist)
    results = backtest(monthly, horizon=args.horizon, min_months=args.min_months)

    if not results:
        print("No items met the minimum history requirement.")
        return

    # Compute aggregate metrics
    maes = [r["mae"] for r in results if r["mae"] is not None]
    mapes = [r["mape"] for r in results if r["mape"] is not None]
    agg_mae = round(sum(maes) / len(maes), 2) if maes else None
    agg_mape = round(sum(mapes) / len(mapes), 2) if mapes else None

    print(f"Items evaluated: {len(results)} (horizon={args.horizon}, min_months={args.min_months})")
    print(f"Aggregate MAE: {agg_mae}, Aggregate MAPE: {agg_mape}")
    print("Top errors (by MAPE):")
    for r in sorted(results, key=lambda x: (x["mape"] is None, x["mape"] or 0), reverse=True)[:10]:
        print(
            f" - {r['item_name']}: MAPE={r['mape']}, MAE={r['mae']}, "
            f"train_months={r['train_months']}, last_train_month={r['last_train_month']}"
        )


if __name__ == "__main__":
    main()
