// src/components/ActivityLog.jsx
import React, { useCallback, useEffect, useState } from "react";
import api from "../auth/api";
import "../views/style/ActivityLog.css";

export default function ActivityLog() {

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = {
        page,
        page_size: pageSize,
      };
      if (userId) params.user_id = userId;
      if (action) params.action = action;
      if (search) params.search = search;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const { data } = await api.get("/activity-logs", { params });

      setRows(Array.isArray(data?.data) ? data.data : []);
      setTotal(Number.isFinite(data?.total) ? data.total : 0);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to fetch activity logs.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, userId, action, search, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const formatUser = (row) => {
    if (row.user_name) return row.user_name;
    if (row.user_id === 0 || row.user_id === null) return "System";
    if (row.user_id) return `User #${row.user_id}`;
    return "Unknown";
  };

  return (
    <div className="activity-container">
      <div className="activity-header">
        <h2>Activity Logs</h2>
        {/* optional subtitle */}
        {/* <p className="activity-subtitle">
          View detailed user actions and system events.
        </p> */}

        <div className="filters">
          <input
            className="input"
            placeholder="User ID"
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
              setPage(1);
            }}
          />

          <select
            className="select"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Actions</option>
            <option value="Login">Login</option>
            <option value="Logout">Logout</option>
            <option value="Inventory">Inventory</option>
            <option value="Account">Account</option>
            <option value="Predictive">Predictive</option>
            <option value="Predictive Restock">Predictive Restock</option>
            <option value="Stock Card">Stock Card</option>
            <option value="Monthly Report">Monthly Report</option>
            <option value="Report">Report</option>
            {/* Legacy options for compatibility */}
            <option value="Create">Create</option>
            <option value="Update">Update</option>
            <option value="Delete">Delete</option>
            <option value="Transaction">Transaction</option>
          </select>

          <input
            className="input"
            placeholder="Search description…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />

          <input
            className="input"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            title="From (inclusive)"
          />

          <input
            className="input"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            title="To (inclusive)"
          />
        </div>
      </div>

      <div className="table-wrap">
        <table className="activity-table">
          <thead>
            <tr>
              <th>LOG#</th>
              <th>User</th>
              <th>Action</th>
              <th>Description</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="5" className="muted">
                  Loading…
                </td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td colSpan="5" className="error">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan="5" className="muted">
                  No activity found.
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              rows.map((r, idx) => (
                <tr key={r.id ?? `${r.user_id}-${idx}-${r.timestamp}`}>
                  <td>#{r.id ?? idx + 1 + (page - 1) * pageSize}</td>
                  <td>{formatUser(r)}</td>
                  <td>{r.action}</td>
                  <td className="desc">{r.description}</td>
                  <td>
                    {r.timestamp ? new Date(r.timestamp).toLocaleString() : ""}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="footer-bar">
        <div className="left">
          <label>
            Rows{" "}
            <select
              className="select"
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setPage(1);
              }}
            >
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <span className="muted">{total} total</span>
        </div>

        <div className="right">
          <button
            className="btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!canPrev}
          >
            Prev
          </button>
          <span className="muted">
            Page {page} / {totalPages}
          </span>
          <button
            className="btn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={!canNext}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}










