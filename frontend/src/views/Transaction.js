import React, { useEffect, useState } from "react";
import "./style/Transaction.css";
import notify from "../utils/notify";
import confirmAction from "../utils/confirm";
import api from "../auth/api";

function Transaction() {
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("latest");
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

  const filteredTransactions = transactions
    .filter((t) =>
      (t.customer_name || "").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const aHasOR = !!a.OR_number;
      const bHasOR = !!b.OR_number;

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

    if (!orInput.trim()) {
      const msg = "Please enter an O.R number before confirming.";
      setErrorMsg(msg);
      notify.error(msg);
      return;
    }

    const id = selectedTransaction.order_id;
    const payload = { OR_number: orInput.trim() };

    try {
      const res = await api.post(`/orders/${id}/add_or`, payload);
      const json = res.data || {};

      setTransactions((prev) =>
        prev.map((t) =>
          t.order_id === id
            ? {
                ...t,
                OR_number: json.order?.OR_number,
                transaction_date: json.order?.transaction_date || null,
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

  const handleDelete = async () => {
    if (!selectedTransaction) return;
    const id = selectedTransaction.order_id;

    const ok = await confirmAction(
      "Are you sure you want to delete this transaction?"
    );
    if (!ok) return;

    try {
      await api.delete(`/orders/${id}`);

      setTransactions((prev) => prev.filter((t) => t.order_id !== id));
      notify.success("Transaction deleted successfully");
      closeModal();
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || "Error deleting transaction";
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
        {/* Search & Sort */}
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

        <div className="inventory-table-scroll">
          <table className="inventory-table">
            <thead>
              <tr>
                <th style={{ width: "15%" }}>O.R#</th>
                <th style={{ width: "28%" }}>Customer</th>
                <th style={{ width: "15%" }}>Total Price</th>
                <th style={{ width: "20%" }}>Date</th>
                <th className="no-print" style={{ width: "12%" }}>
                  Processed By
                </th>
                <th className="no-print" style={{ width: "8%" }}>
                  Status
                </th>
                <th className="no-print" style={{ width: "7%" }}>
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
                  <td>
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
                      <button
                        className="add-btn"
                        onClick={() => handleAddOR(t)}
                      >
                        ADD O.R#
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
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
                <b>Total:</b> ₱{Number(selectedTransaction.total_price).toFixed(2)}
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
              <button className="delete-btn" onClick={handleDelete}>
                DELETE
              </button>
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
