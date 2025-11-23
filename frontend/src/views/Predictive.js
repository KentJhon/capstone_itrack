// src/views/Predictive.js
import React, { useEffect, useMemo, useState } from "react";
import api from "../auth/api";
import API_BASE_URL from "../config";
import "../views/style/Predictive.css";

const MODE_SINGLE = "single";
const MODE_ALL = "all";

export default function Predictive() {
  const API_BASE = api.defaults?.baseURL || API_BASE_URL;
  // Which mode: single-item (6-month plan) or all-items (next-month only)
  const [mode, setMode] = useState(MODE_SINGLE);

  // Items list for dropdown (comes from /items)
  const [items, setItems] = useState([]);
  const itemNames = useMemo(
    () => items.map((it) => (it?.name ?? "").trim()).filter(Boolean),
    [items]
  );
  const [itemName, setItemName] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Single-item (6-month) results
  const [monthlyForecast, setMonthlyForecast] = useState([]); // [{month, forecast_qty}]
  const [restockPlan, setRestockPlan] = useState([]); // [{month, forecast_qty, start_stock, recommended_restock, end_stock}]
  const [currentStock, setCurrentStock] = useState(null);
  const [totals, setTotals] = useState({
    total_6mo_forecast: 0,
    total_recommended_restock: 0,
  });

  // All-items (next month only) results
  const [allRows, setAllRows] = useState([]); // [{item_name, current_stock, next_month_forecast}]

  // Load items from DB once for dropdown
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get("/items");
        if (!alive) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setItems(list);
        if (list.length > 0) setItemName((list[0].name ?? "").trim());
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setItems([]);
        setItemName("");
        setError("Could not load items from database.");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runForecast = async () => {
    setError("");
    setLoading(true);

    // reset all displays
    setMonthlyForecast([]);
    setRestockPlan([]);
    setAllRows([]);
    setTotals({ total_6mo_forecast: 0, total_recommended_restock: 0 });
    setCurrentStock(null);

    try {
      if (mode === MODE_SINGLE) {
        // ---------- SINGLE ITEM: 6-MONTH PLAN ----------
        if (!itemName) {
          setError("Please select an item.");
          return;
        }

        const res = await api.get("/predictive/forecast/item", {
          params: { item_name: itemName },
        });

        setMonthlyForecast(res.data?.monthly_forecast ?? []);
        setRestockPlan(res.data?.restock_plan ?? []);
        setCurrentStock(
          typeof res.data?.current_stock === "number"
            ? res.data.current_stock
            : 0
        );
        setTotals({
          total_6mo_forecast: Number(res.data?.total_6mo_forecast ?? 0),
          total_recommended_restock: Number(
            res.data?.total_recommended_restock ?? 0
          ),
        });
      } else {
        // ---------- ALL ITEMS: NEXT MONTH ONLY ----------
        const res = await api.get("/predictive/next_month/all");
        const rows = Array.isArray(res.data?.rows) ? res.data.rows : [];

        // Optional: sort by highest forecast first
        rows.sort(
          (a, b) => (b.next_month_forecast ?? 0) - (a.next_month_forecast ?? 0)
        );

        setAllRows(rows);
      }
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.detail || "Failed to fetch forecast.");
    } finally {
      setLoading(false);
    }
  };

  // 6-month single-item data exists?
  const hasSingleData = monthlyForecast.length > 0 || restockPlan.length > 0;
  // all-items next-month data exists?
  const hasAllData = allRows.length > 0;

  // Export (still for 6-month single-item plan)
  const handleExport = (type) => {
    if (!itemName) return;
    const url = `${API_BASE}/predictive/export?item_name=${encodeURIComponent(
      itemName
    )}&filetype=${type}`;
    window.open(url, "_blank");
  };

  return (
    <div className="predictive-page">
      {/* Header */}
      <div className="predictive-header">
        <h2>Predictive Restocking</h2>
      </div>

      {/* Scrollable content */}
      <div className="pred-scroll">
        <div className="pred-controls">
          {/* Mode picker */}
          <div className="pred-field">
            <label>Mode</label>
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setError("");
                setMonthlyForecast([]);
                setRestockPlan([]);
                setAllRows([]);
              }}
            >
              <option value={MODE_SINGLE}>Single Item (6-Month Plan)</option>
              <option value={MODE_ALL}>All Items (Next Month Only)</option>
            </select>
          </div>

          {/* Item picker for Single mode */}
          {mode === MODE_SINGLE && (
            <div className="pred-field">
              <label>Item (by name)</label>
              <select
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              >
                {itemNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button className="pred-btn" onClick={runForecast} disabled={loading}>
            {loading ? "Running…" : "Run Forecast"}
          </button>

          {/* Export buttons only make sense for 6-month single-item mode */}
          {mode === MODE_SINGLE && (
            <>
              <button
                className={`pred-btn secondary ${
                  !hasSingleData ? "disabled" : ""
                }`}
                onClick={() => hasSingleData && handleExport("csv")}
                disabled={!hasSingleData}
              >
                Export CSV
              </button>
              <button
                className={`pred-btn secondary ${
                  !hasSingleData ? "disabled" : ""
                }`}
                onClick={() => hasSingleData && handleExport("xlsx")}
                disabled={!hasSingleData}
              >
                Export XLSX
              </button>
            </>
          )}
        </div>

        {error && <div className="pred-error">{error}</div>}

        {/* SINGLE ITEM – KPIs + TABLES (6 months) */}
        {mode === MODE_SINGLE && hasSingleData && (
          <>
            <div className="pred-kpis">
              <div className="kpi">
                <div className="kpi-label">Current Stock</div>
                <div className="kpi-value">{currentStock ?? "—"}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Total 6-Month Forecast</div>
                <div className="kpi-value">{totals.total_6mo_forecast}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Total Recommended Restock</div>
                <div className="kpi-value">
                  {totals.total_recommended_restock}
                </div>
              </div>
            </div>

            <div className="pred-table-wrap">
              <h4>Monthly Forecast (6 months)</h4>
              <table className="pred-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Forecast Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyForecast.map((r) => (
                    <tr key={r.month}>
                      <td>{r.month}</td>
                      <td>{r.forecast_qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h4>Restock Plan</h4>
              <table className="pred-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Forecast Qty</th>
                    <th>Start Stock</th>
                    <th>Recommended Restock</th>
                    <th>End Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {restockPlan.map((r) => (
                    <tr key={r.month}>
                      <td>{r.month}</td>
                      <td>{r.forecast_qty}</td>
                      <td>{r.start_stock}</td>
                      <td style={{ fontWeight: 700 }}>
                        {r.recommended_restock}
                      </td>
                      <td>{r.end_stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ALL ITEMS – NEXT MONTH ONLY */}
        {mode === MODE_ALL && hasAllData && (
          <div className="pred-table-wrap">
            <h4>Next Month Forecast (All Items)</h4>
            <table className="pred-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Current Stock</th>
                  <th>Next Month Forecast</th>
                </tr>
              </thead>
              <tbody>
                {allRows.map((row) => (
                  <tr key={row.item_name}>
                    <td>{row.item_name}</td>
                    <td>{row.current_stock}</td>
                    <td>{row.next_month_forecast}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state */}
        {!loading && !hasSingleData && !(mode === MODE_ALL && hasAllData) && (
          <p className="pred-hint">
            Select a mode, choose an item (for single), then click{" "}
            <b>Run Forecast</b>.
          </p>
        )}
      </div>
    </div>
  );
}

