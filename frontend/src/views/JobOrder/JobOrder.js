import React from "react";
import { useNavigate } from "react-router-dom";
import { FiArchive, FiTrendingUp } from "react-icons/fi";
import "./style/JobOrder.css";

function JobOrder() {
  const navigate = useNavigate();

  return (
    <div className="jo-overview-page">
      <header className="jo-header">
        <h2 className="jo-page-title">Job Order Reports</h2>
        <p className="jo-page-subtitle">
          View and manage Job Order inventory and transactions.
        </p>
      </header>

      <div className="jo-card-grid">
        {/* Card 1: Job Order Inventory */}
        <div
          className="jo-card inventory"
          onClick={() => navigate("/job-orders/inventory")}
        >
          <FiArchive className="jo-icon" />
          <h3 className="jo-card-title">Job Order Inventory</h3>
          <p className="jo-card-subtitle">
            View and manage all Job Order items, stock levels, and low stock
            alerts.
          </p>
        </div>

        {/* Card 2: Job Order Transactions */}
        <div
          className="jo-card transactions"
          onClick={() => navigate("/job-orders/transactions")}
        >
          <FiTrendingUp className="jo-icon" />
          <h3 className="jo-card-title">Job Order Transactions</h3>
          <p className="jo-card-subtitle">
            Review Job Order transaction history, OR numbers, and processed
            staff.
          </p>
        </div>
      </div>
    </div>
  );
}

export default JobOrder;
