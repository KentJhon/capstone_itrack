// src/views/Dashboard.js
import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import "../views/style/Dashboard.css";

import { useNavigate } from "react-router-dom";
import api from "../auth/api";

// Base URL for backend API (Render / local)
const API_BASE =
  process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000";

const LOW_STOCK_PERCENT_OF_FORECAST = 0.7;

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function Dashboard() {
  const now = new Date();
  const navigate = useNavigate();

  // ---- SUMMARY / ERROR ----
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState("");

  // ---- LOW STOCK (same logic as Inventory) ----
  const [lowStockItems, setLowStockItems] = useState([]);
  const [loadingLowStock, setLoadingLowStock] = useState(true);

  // Full items list from /items (Garments + Stationery)
  const [items, setItems] = useState([]);

  // Forecast map from /predictive/next_month/all
  // { "item name (lowercase)": { item_name, current_stock, next_month_forecast } }
  const [forecastMap, setForecastMap] = useState({});

  // ---- TOP ITEMS / SALES ----
  const [topYear, setTopYear] = useState(now.getFullYear());
  const [topMonth, setTopMonth] = useState("");
  const [topItemsData, setTopItemsData] = useState([]);
  const [loadingTop, setLoadingTop] = useState(true);

  const [salesYear, setSalesYear] = useState(now.getFullYear());
  const [salesData, setSalesData] = useState([]);
  const [loadingSales, setLoadingSales] = useState(true);

  const truncate = (str, maxLen = 12) =>
    str?.length > maxLen ? str.substring(0, maxLen) + "…" : str || "";

  // ---------- HELPERS (same as Inventory) ----------

  const computeDynamicReorderLevel = (item) => {
    const key = String(item.name).trim().toLowerCase();
    const fcRow = forecastMap[key];
    const forecast = fcRow ? Number(fcRow.next_month_forecast || 0) : 0;

    if (!forecast || forecast <= 0) {
      // No meaningful forecast: fall back to stored reorder_level or 0
      return Number(item.reorder_level || 0);
    }

    const level = Math.round(LOW_STOCK_PERCENT_OF_FORECAST * forecast);
    return Math.max(level, 1);
  };

  const isLowStock = (item) => {
    const level = computeDynamicReorderLevel(item);
    return item.stock_quantity <= level;
  };

  // ---------- FETCH SUMMARY STATS ----------

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoadingStats(true);
        const res = await api.get("/dashboard");
        setStats(res.data);
      } catch (err) {
        setError(err?.response?.data?.detail || err.message);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, []);

  // ---------- FETCH ITEMS (Garments + Stationery) ----------

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch(`${API_BASE}/items`);
        if (!res.ok) throw new Error("Failed to load items");

        const data = await res.json();
        const itemsArray = Array.isArray(data) ? data : data.items || [];

        const allowed = itemsArray.filter(
          (it) => it.category === "Garments" || it.category === "Stationery"
        );

        setItems(allowed);
      } catch (err) {
        console.error("Error loading items:", err);
      }
    };

    fetchItems();
  }, []);

  // ---------- FETCH FORECASTS ----------

  useEffect(() => {
    const fetchForecasts = async () => {
      try {
        const res = await fetch(`${API_BASE}/predictive/next_month/all`);
        if (!res.ok) throw new Error("Failed to load predictive data");

        const data = await res.json();
        const rows = Array.isArray(data.rows) ? data.rows : [];

        const map = {};
        rows.forEach((row) => {
          const key = String(row.item_name).trim().toLowerCase();
          map[key] = row;
        });

        setForecastMap(map);
      } catch (err) {
        console.error("Error loading forecasts:", err);
      }
    };

    fetchForecasts();
  }, []);

  // ---------- COMPUTE LOW STOCK ITEMS (from items + forecastMap) ----------

  useEffect(() => {
    if (items.length === 0) return;

    try {
      setLoadingLowStock(true);
      const lows = items.filter((item) => isLowStock(item));
      setLowStockItems(lows);
    } finally {
      setLoadingLowStock(false);
    }
  }, [items, forecastMap]); // recompute whenever items or forecasts change

  // ---------- FETCH MOST SOLD ITEMS ----------

  useEffect(() => {
    const fetchTopItems = async () => {
      try {
        setLoadingTop(true);
        let url = `${API_BASE}/dashboard/top-items?year=${topYear}`;
        if (topMonth !== "") url += `&month=${topMonth}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load top sold items");

        const data = await res.json();
        setTopItemsData(
          (data.top_items || []).map((item) => ({
            name: truncate(item.name),
            fullName: item.name,
            sold: Number(item.total_sold) || 0,
          }))
        );
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingTop(false);
      }
    };
    fetchTopItems();
  }, [topYear, topMonth]);

  // ---------- FETCH SALES REPORT ----------

  useEffect(() => {
    const fetchSales = async () => {
      try {
        setLoadingSales(true);
        const res = await fetch(
          `${API_BASE}/dashboard/sales?year=${salesYear}`
        );
        if (!res.ok) throw new Error("Failed to load sales report");

        const data = await res.json();
        setSalesData(
          (data.sales || []).map((row, idx) => ({
            month: monthNames[row.month ? row.month - 1 : idx],
            total: Number(row.total) || 0,
          }))
        );
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingSales(false);
      }
    };
    fetchSales();
  }, [salesYear]);

  const totalRevenue = stats?.total_revenue || 0;
  const totalItemsSold = stats?.total_items_sold || 0;

  return (
    <div className="dashboard">
      {/* SUMMARY CARDS */}
      <div className="cards">
        {/* Total Revenue */}
        <div className="card">
          <p>Total Revenue</p>
          <h2>{loadingStats ? "…" : `₱${totalRevenue.toFixed(2)}`}</h2>
          {!loadingStats && (
            <span className="card-sub">All completed transactions</span>
          )}
        </div>

        {/* Total Items Sold */}
        <div className="card">
          <p>Total Items Sold</p>
          <h2>{loadingStats ? "…" : totalItemsSold}</h2>
          {!loadingStats && (
            <span className="card-sub">Total quantity of items sold</span>
          )}
        </div>

        {/* LOW STOCK CARD — CLICKABLE NUMBER */}
        <div className="card">
          <p>Low Stock Items</p>

          <h2
            onClick={() => navigate("/inventory")}
            style={{ cursor: "pointer", color: "#000000ff" }}
          >
            {loadingLowStock ? "…" : lowStockItems.length}
          </h2>

          {!loadingLowStock && (
            <span className="card-sub">
              Stock ≤ {Math.round(LOW_STOCK_PERCENT_OF_FORECAST * 100)}% of next
              month&apos;s forecast
            </span>
          )}
        </div>
      </div>

      {/* CHARTS ROW */}
      <div className="dashboard-charts-row">
        {/* Most Sold Items */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Most Sold Items</h3>
            <div className="chart-filters">
              <select
                value={topYear}
                onChange={(e) => setTopYear(Number(e.target.value))}
              >
                {[0, 1, 2].map((i) => (
                  <option key={i} value={now.getFullYear() - i}>
                    {now.getFullYear() - i}
                  </option>
                ))}
              </select>

              <select
                value={topMonth}
                onChange={(e) => setTopMonth(e.target.value)}
              >
                <option value="">Yearly</option>
                {monthNames.map((m, idx) => (
                  <option key={idx} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loadingTop ? (
            <div className="chart-placeholder">[ Loading… ]</div>
          ) : topItemsData.length === 0 ? (
            <div className="chart-placeholder">[ No sales data yet ]</div>
          ) : (
            <div className="chart-body">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topItemsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" interval={0} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="sold">
                    {topItemsData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={
                          index === 0
                            ? "#ff4d4f"
                            : index === 1
                            ? "#ffa940"
                            : "#69c0ff"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Sales Report */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Sales Report</h3>
            <div className="chart-filters">
              <select
                value={salesYear}
                onChange={(e) => setSalesYear(Number(e.target.value))}
              >
                {[0, 1, 2].map((i) => (
                  <option key={i} value={now.getFullYear() - i}>
                    {now.getFullYear() - i}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loadingSales ? (
            <div className="chart-placeholder">[ Loading… ]</div>
          ) : salesData.length === 0 ? (
            <div className="chart-placeholder">[ No sales data yet ]</div>
          ) : (
            <div className="chart-body">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="#82ca9d" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {error && <p style={{ color: "black" }}>{error}</p>}
    </div>
  );
}

export default Dashboard;
