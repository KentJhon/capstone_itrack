import React, { useState } from "react";
import GarmentSlip from "./GarmentSlip";
import BookSlip from "./BookSlip";
import JobOrderSlip from "./JobOrderSlip";
import { FiShoppingBag, FiBookOpen, FiClipboard } from "react-icons/fi";
import "../OrderSlip/style/OrderSlip.css";

function OrderSlipPage() {
  const [activeSlip, setActiveSlip] = useState(null);
  const closeModal = () => setActiveSlip(null);

  const renderSlip = () => {
    switch (activeSlip) {
      case "garment":
        return <GarmentSlip onClose={closeModal} />;
      case "book":
        return <BookSlip onClose={closeModal} />;
      case "jobOrder":
        return <JobOrderSlip onClose={closeModal} />;
      default:
        return null;
    }
  };

  return (
    <div className="orderslip-layout">
      {/* Page content */}
      <div className="orderslip-content">
        <header className="orderslip-header">
          <h2 className="orderslip-title">Order Slip</h2>
          <p className="orderslip-subtitle">
            Select a category to create or print an order slip
          </p>
        </header>

        <div className="orderslip-cards">
          <div
            className="orderslip-card garments"
            onClick={() => setActiveSlip("garment")}
          >
            <FiShoppingBag className="icon" />
            <p>Garments</p>
          </div>

          <div
            className="orderslip-card book"
            onClick={() => setActiveSlip("book")}
          >
            <FiBookOpen className="icon" />
            <p>Book</p>
          </div>

          <div
            className="orderslip-card joborder"
            onClick={() => setActiveSlip("jobOrder")}
          >
            <FiClipboard className="icon" />
            <p>Job Order</p>
          </div>
        </div>
      </div>

      {/* Modal for slips */}
      {activeSlip && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {renderSlip()}
          </div>
        </div>
      )}
    </div>
  );
}

export default OrderSlipPage;
