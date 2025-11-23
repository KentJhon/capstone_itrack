import React, { useEffect, useState } from "react";
import "../JobOrder/style/JobOrderTransactions.css";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";

const API_BASE = "http://127.0.0.1:8000";

function JobOrderTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("latest");
  const navigate = useNavigate();

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = () => {
    fetch(`${API_BASE}/job-orders/transactions`)
      .then((res) => res.json())
      .then((data) => setTransactions(data.transactions || []))
      .catch((err) =>
        console.error("Error fetching job order transactions:", err)
      );
  };

  const getDateValue = (t) => {
    if (!t.transaction_date) return 0;
    const d = new Date(t.transaction_date);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  const filteredTransactions = transactions
    .filter((t) =>
      (t.customer_name || "").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "latest") return getDateValue(b) - getDateValue(a);
      if (sortBy === "oldest") return getDateValue(a) - getDateValue(b);
      return 0;
    });

  return (
    <div className="inventory-page">
      {/* ===== Header & Back Button ===== */}
      <div className="inventory-header no-print">
        <div className="inventory-header-left">
          <button className="back-btn" onClick={() => navigate("/joborder")}>
            <FiArrowLeft className="back-icon" />
            Back
          </button>

          <div className="inventory-title-group">
            <h2>Job Order Transactions</h2>
            <p className="inventory-subtitle">
              {filteredTransactions.length} record
              {filteredTransactions.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="inventory-actions">
          <button className="btn btn-primary" onClick={fetchTransactions}>
            Refresh
          </button>
        </div>
      </div>

      {/* ===== Floating Card + Scrollable Table ===== */}
      <div className="inventory-table-card">
        {/* Filters Row */}
        <div className="filters-row no-print">
          <div className="filter-group">
            <input
              type="text"
              placeholder="Search transactions..."
              className="search-field"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="latest">Latest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
        </div>

        {/* Scrollable table area */}
        <div className="inventory-table-scroll">
          <table className="inventory-table">
            <thead>
              <tr>
                <th style={{ width: "40%" }}>Customer</th>
                <th style={{ width: "20%" }}>Total Price</th>
                <th style={{ width: "25%" }}>Date</th>
                <th className="no-print" style={{ width: "15%" }}>
                  Processed By
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((t) => (
                <tr key={t.order_id}>
                  <td style={{ textAlign: "left" }}>{t.customer_name}</td>
                  <td>₱{Number(t.total_price).toFixed(2)}</td>
                  <td>
                    {t.transaction_date
                      ? new Date(t.transaction_date).toLocaleString()
                      : "Null"}
                  </td>
                  <td className="no-print">{t.username || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredTransactions.length === 0 && (
            <p className="no-print empty-text">
              No Job Order transactions found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default JobOrderTransactions;
