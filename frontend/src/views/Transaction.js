import React, { useEffect, useState } from "react";
import "./style/Transaction.css";
import notify from "../utils/notify";
import confirmAction from "../utils/confirm";
import api from "../auth/api";

function Transaction() {
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [orInput, setOrInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const res = await api.get("/transactions");
      setTransactions(res.data.transactions || []);
    } catch (err) {
      console.error("Error fetching transactions:", err);
      notify.error("Failed to fetch transactions.");
    }
  };

  const getDateValue = (t) => {
    if (!t.transaction_date) return 0;
    const d = new Date(t.transaction_date);
    const time = d.getTime();
    return isNaN(time) ? 0 : time;
  };

  // 💡 Derive statusFilter + sortBy from filterMode
  let statusFilter = "all";
  let sortBy = "latest";

  switch (filterMode) {
    case "all":
      statusFilter = "all";
      sortBy = "latest";
      break;
    case "completed":
      statusFilter = "completed";
      sortBy = "latest";
      break;
    case "pending":
      statusFilter = "pending";
      sortBy = "latest";
      break;
    case "latest":
      statusFilter = "all";
      sortBy = "latest";
      break;
    case "oldest":
      statusFilter = "all";
      sortBy = "oldest";
      break;
    default:
      statusFilter = "all";
      sortBy = "latest";
  }

  const filteredTransactions = transactions
    // 🔍 search by customer name
    .filter((t) =>
      (t.customer_name || "").toLowerCase().includes(search.toLowerCase())
    )
    // 🎯 filter by status based on filterMode
    .filter((t) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "pending") return !t.OR_number;
      if (statusFilter === "completed") return !!t.OR_number;
      return true;
    })
    // 🔃 sort by date, pending first
    .sort((a, b) => {
      const aHasOR = !!a.OR_number;
      const bHasOR = !!b.OR_number;

      // Pending first
      if (!aHasOR && bHasOR) return -1;
      if (aHasOR && !bHasOR) return 1;

      if (sortBy === "latest") return getDateValue(b) - getDateValue(a);
      if (sortBy === "oldest") return getDateValue(a) - getDateValue(b);

      return 0;
    });

  const handleAddOR = (transaction) => {
    setSelectedTransaction(transaction);
    setOrInput(transaction.OR_number || "");
    setErrorMsg("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTransaction(null);
    setOrInput("");
    setErrorMsg("");
  };

  const handleConfirm = async () => {
    if (!selectedTransaction) return;

    const trimmed = orInput.trim();
    if (!trimmed) {
      const msg = "Please enter an O.R number before confirming.";
      setErrorMsg(msg);
      notify.error(msg);
      return;
    }

    const id = selectedTransaction.order_id;
    const payload = { OR_number: trimmed };

    try {
      const res = await api.post(`/orders/${id}/add_or`, payload);
      const json = res.data || {};

      setTransactions((prev) =>
        prev.map((t) =>
          t.order_id === id
            ? {
                ...t,
                OR_number: json.order?.OR_number ?? trimmed,
                transaction_date:
                  json.order?.transaction_date || t.transaction_date || null,
              }
            : t
        )
      );
      notify.success("O.R# updated successfully");
      closeModal();
    } catch (err) {
      const json = err?.response?.data;
      let msg = err?.message || "Unexpected error occurred";

      if (json?.detail) {
        if (Array.isArray(json.detail)) {
          msg = json.detail.map((e) => e.msg || JSON.stringify(e)).join(" | ");
        } else if (typeof json.detail === "string") {
          msg = json.detail;
        } else if (json.detail?.msg) {
          msg = json.detail.msg;
        }
      } else if (json?.message) {
        msg = json.message;
      }

      setErrorMsg(msg);
      notify.error(msg);
    }
  };

  // 🔴 Row-level delete (red minus beside ADD O.R#)
  const handleDeleteRow = async (transaction) => {
    if (!transaction) return;
    const id = transaction.order_id;

    const ok = await confirmAction(
      `Are you sure you want to delete this transaction (TR# ${id})?`
    );
    if (!ok) return;

    try {
      await api.delete(`/orders/${id}`);
      setTransactions((prev) => prev.filter((t) => t.order_id !== id));
      notify.success("Transaction deleted successfully");
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err.message ||
        "Error deleting transaction";
      setErrorMsg(msg);
      notify.error(msg);
    }
  };

  return (
    <div className="inventory-page">
      {/* ===== Header ===== */}
      <div className="inventory-header no-print">
        <div>
          <h2>Transaction History</h2>
          <p className="inventory-subtitle">
            {filteredTransactions.length} record
            {filteredTransactions.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* ===== Table ===== */}
      <div className="inventory-table-card">
        {/* Search & Combined Filter */}
        <div className="filters-row no-print">
          <div className="filter-group">
            <input
              type="text"
              placeholder="Search transactions..."
              className="search-field"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {/* Single dropdown: All / Completed / Pending / Latest / Oldest */}
            <select
              className="sort-select"
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
            >
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="latest">Latest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
        </div>

        <div className="inventory-table-scroll">
          <table className="inventory-table">
            <thead>
              <tr>
                <th style={{ width: "15%" }}>O.R#</th>
                <th style={{ width: "28%" }}>Customer</th>
                <th style={{ width: "15%" }}>Total Price</th>
                <th style={{ width: "10%", whiteSpace: "nowrap" }}>Date</th>
                <th className="no-print" style={{ width: "12%" }}>
                  Processed By
                </th>
                <th className="no-print" style={{ width: "8%" }}>
                  Status
                </th>
                <th className="no-print" style={{ width: "12%" }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((t) => (
                <tr key={t.order_id}>
                  <td>{t.OR_number || "-"}</td>
                  <td style={{ textAlign: "left" }}>{t.customer_name}</td>
                  <td>₱{Number(t.total_price).toFixed(2)}</td>
                  <td className="date-col">
                    {t.transaction_date
                      ? new Date(t.transaction_date).toLocaleString()
                      : "-"}
                  </td>
                  <td className="no-print">{t.username || "-"}</td>
                  <td className="no-print">
                    {t.OR_number ? (
                      <span className="status-pill status-done">Done</span>
                    ) : (
                      <span className="status-pill status-pending">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="no-print">
                    {!t.OR_number ? (
                      <div className="action-buttons">
                        <button
                          className="add-btn"
                          onClick={() => handleAddOR(t)}
                        >
                          ADD O.R#
                        </button>
                        <button
                          className="icon-delete-btn"
                          title="Delete transaction"
                          onClick={() => handleDeleteRow(t)}
                        >
                          −
                        </button>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}

              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "12px", textAlign: "center" }}>
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== Modal ===== */}
      {showModal && selectedTransaction && (
        <div className="modal-overlay no-print" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Book Center</h3>
            <p className="modal-date">{new Date().toLocaleDateString()}</p>

            <div className="modal-info">
              <p>
                <b>TR#:</b> {selectedTransaction.order_id}
              </p>
              <p>
                <b>Name:</b> {selectedTransaction.customer_name}
              </p>
              <p>
                <b>Total:</b> ₱
                {Number(selectedTransaction.total_price).toFixed(2)}
              </p>

              <div className="modal-input">
                <label>
                  <b>O.R#:</b>
                </label>
                <input
                  type="text"
                  placeholder="Enter O.R number"
                  value={orInput}
                  onChange={(e) => {
                    setOrInput(e.target.value);
                    setErrorMsg("");
                  }}
                />
              </div>

              {errorMsg && <p className="error-text">{errorMsg}</p>}
            </div>

            <div className="modal-buttons">
              <button className="confirm-btn" onClick={handleConfirm}>
                CONFIRM
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Transaction;
