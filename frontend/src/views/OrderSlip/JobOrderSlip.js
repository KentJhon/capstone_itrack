// frontend/src/JobOrder/JobOrderSlip.jsx
import React, { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "../OrderSlip/style/Slips.css";
import logo from "../../assets/logo.png";
import { useAuth } from "../../auth/useAuth";
import API_BASE_URL from "../../config";
import notify from "../../utils/notify";

export default function JobOrderSlip({ onClose }) {
  const API = useMemo(() => API_BASE_URL, []);

  const today = new Date();
  const todayDisplay = today.toLocaleDateString("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric",
  });

  const [customerName, setCustomerName] = useState("");
  const [course, setCourse] = useState("");
  const [catalog, setCatalog] = useState([]);
  const [lines, setLines] = useState([{ item_id: "", quantity: 1 }]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();

  // ✅ Fetch ONLY Souvenir items
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API}/items`);
        const data = await res.json();

        const souvenirItems = (data || []).filter((item) => {
          return (
            String(item.category || "")
              .trim()
              .toLowerCase() === "souvenir"
          );
        });

        setCatalog(souvenirItems);
      } catch (e) {
        notify.error(e?.message || "Failed to load Souvenir items");
        setError("Failed to load Souvenir items");
      } finally {
        setLoading(false);
      }
    })();
  }, [API]);

  const addLine = () => setLines((l) => [...l, { item_id: "", quantity: 1 }]);
  const removeLine = (idx) => setLines((l) => l.filter((_, i) => i !== idx));
  const updateLine = (idx, field, value) =>
    setLines((l) =>
      l.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );

  // ✅ Compute total
  const total = lines.reduce((sum, row) => {
    const found = catalog.find(
      (c) => String(c.item_id) === String(row.item_id)
    );
    if (!found) return sum;
    const price = Number(found.price || 0);
    const qty = Number(row.quantity || 0);
    return sum + price * qty;
  }, 0);

  // ✅ Build and open Job Order PDF
  const generateJobOrderPDF = (jobOrderNo) => {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 15;

    const today = new Date();
    const dateStr = today.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });

    // ===== HEADER (LOGO + UNIVERSITY TEXT) =====
    doc.addImage(logo, "PNG", marginLeft, 10, 25, 25);

    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text("UNIVERSITY OF SCIENCE AND TECHNOLOGY", pageWidth / 2, 15, {
      align: "center",
    });
    doc.text("OF SOUTHERN PHILIPPINES", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("times", "normal");
    doc.text(
      "Alubijid | Balubal | Cagayan de Oro | Claveria | Jasaan | Oroquieta | Panaon | Villanueva",
      pageWidth / 2,
      25,
      { align: "center" }
    );
    doc.text("TIN:001-030-959-000  -  Exempt", pageWidth / 2, 30, {
      align: "center",
    });

    // ===== ENTERPRISES BOX (LEFT) =====
    const entX = marginLeft;
    const entY = 40;
    const entW = 40;
    const entH = 45;
    doc.setLineWidth(0.3);
    doc.rect(entX, entY, entW, entH);

    doc.setFont("times", "bold");
    doc.setFontSize(9);
    doc.text("ENTERPRISES", entX + entW / 2, entY + 5, {
      align: "center",
    });

    doc.setFont("times", "normal");
    const opts = [
      "( ) Bookcenter",
      "( ) Garments and Fashion",
      "( ) Facilities for Lease",
      "( ) Printing Press",
    ];
    let lineY = entY + 12;
    opts.forEach((t) => {
      doc.text(t, entX + 3, lineY);
      lineY += 5;
    });

    // ===== MAIN JOB ORDER AREA (RIGHT) =====
    const mainX = entX + entW + 5;
    const mainY = 40;
    const mainW = pageWidth - mainX - marginLeft;

    // Title pill
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    const pillWidth = 40;
    const pillX = mainX + mainW / 2 - pillWidth / 2;
    const pillY = mainY + 5;
    doc.roundedRect(pillX, pillY - 4, pillWidth, 8, 2, 2, "S");
    doc.text("JOB ORDER A", mainX + mainW / 2, pillY + 1, {
      align: "center",
    });

    // No. + Date
    doc.setFontSize(9);
    const noY = mainY + 20;
    doc.text("No.", mainX + 5, noY);
    doc.text(String(jobOrderNo || ""), mainX + 15, noY);
    doc.text(dateStr, mainX + mainW - 25, noY);
    doc.text("Date", mainX + mainW - 25, noY + 4);

    // Customer / Address
    const custY = mainY + 30;
    doc.text("Customer:", mainX + 5, custY);
    doc.text(customerName || "", mainX + 30, custY);
    doc.line(mainX + 30, custY + 1, mainX + mainW - 5, custY + 1);

    doc.text("Address:", mainX + 5, custY + 8);
    doc.text(course || "", mainX + 30, custY + 8);
    doc.line(mainX + 30, custY + 9, mainX + mainW - 5, custY + 9);

    // ===== TABLE (MANUAL) =====
    const tableTopY = custY + 16;
    const rowHeight = 8;

    const qtyW = 15;
    const unitW = 15;
    const unitCostW = 25;
    const totalCostW = 25;
    const descW = mainW - (qtyW + unitW + unitCostW + totalCostW);

    const colWidths = [qtyW, unitW, descW, unitCostW, totalCostW];

    const drawRow = (cells, isHeader = false) => {
      let x = mainX;
      doc.setFont("times", isHeader ? "bold" : "normal");
      doc.setFontSize(9);

      cells.forEach((value, idx) => {
        const w = colWidths[idx];
        doc.rect(x, currentY, w, rowHeight);

        const text = String(value ?? "");
        const textY = currentY + rowHeight / 2 + 2;

        if (idx >= 3) {
          doc.text(text, x + w - 1, textY, { align: "right" });
        } else {
          doc.text(text, x + 1.5, textY);
        }
        x += w;
      });

      currentY += rowHeight;
    };

    let currentY = tableTopY;

    // Header row
    drawRow(
      [
        "Qty.",
        "Unit",
        "Articles/Description/Services",
        "Unit Cost",
        "Total Cost",
      ],
      true
    );

    // Body rows
    const tableRows = lines
      .filter((r) => r.item_id && Number(r.quantity) > 0)
      .map((r) => {
        const found = catalog.find(
          (c) => String(c.item_id) === String(r.item_id)
        );
        const qty = Number(r.quantity || 0);
        const unitPrice = Number(found?.price || 0);
        const lineTotal = qty * unitPrice;
        const unit = found?.unit || found?.type || "pcs";

        return [
          qty,
          unit,
          found?.name || "",
          unitPrice.toFixed(2),
          lineTotal.toFixed(2),
        ];
      });

    tableRows.forEach((row) => drawRow(row, false));

    const totalY = currentY + 5;

    // ===== TOTAL =====
    doc.setFont("times", "bold");
    doc.text("Total", mainX + mainW - 50, totalY);
    doc.text(total.toFixed(2), mainX + mainW - 15, totalY, {
      align: "right",
    });

    // ===== OUTER JOB ORDER RECT =====
    const boxBottom = totalY + 8;
    doc.setLineWidth(0.4);
    doc.rect(mainX, mainY, mainW, boxBottom - mainY);

    // ===== SIGNATURE AREA =====
    const minSigY = boxBottom + 15;
    const sigY = Math.min(pageHeight - 50, minSigY);

    doc.setFont("times", "normal");
    doc.setFontSize(9);

    // Prepared by
    doc.text("Prepared by:", marginLeft + 5, sigY);
    doc.line(marginLeft + 5, sigY + 15, marginLeft + 55, sigY + 15);

    // Requested by
    const reqX = pageWidth / 2;
    doc.text("Requested by:", reqX, sigY);
    doc.line(reqX, sigY + 15, reqX + 50, sigY + 15);

    // Noted
    doc.text("Noted:", marginLeft + 5, sigY + 30);
    doc.line(marginLeft + 5, sigY + 45, marginLeft + 55, sigY + 45);

    // Funds Available
    const fundsX = pageWidth / 2 - 20;
    doc.text("Funds Available :", fundsX, sigY + 30);
    doc.line(fundsX, sigY + 45, fundsX + 50, sigY + 45);

    // Approved by
    const apprX = pageWidth - marginLeft - 55;
    doc.text("Approved by :", apprX, sigY + 30);
    doc.line(apprX, sigY + 45, apprX + 50, sigY + 45);

    // ===== OPEN PDF =====
    const pdfBlob = doc.output("blob");
    const pdfURL = URL.createObjectURL(pdfBlob);
    window.open(pdfURL, "_blank");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const storedUser = localStorage.getItem("user");
    const fallbackUserId = storedUser ? JSON.parse(storedUser)?.id : null;
    const userId = user?.id ?? fallbackUserId;
    if (!userId) return setError("You must be logged in.");

    const validLines = lines
      .filter((r) => r.item_id && Number(r.quantity) > 0)
      .map((r) => ({
        item_id: Number(r.item_id),
        quantity: Number(r.quantity),
      }));

    if (!customerName.trim()) return setError("Customer name is required.");
    if (validLines.length === 0) return setError("Add at least one item.");

    const payload = {
      user_id: userId,
      customer_name: customerName,
      OR_number: null, // ✅ JOB ORDER DOES NOT USE OR
      course: course || null,
      items: validLines,
    };

    try {
      setSubmitting(true);
      const res = await fetch(`${API}/api/sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const id = data.sale_id ?? data.order_id;

      // ✅ THIS CALL IS WHAT SETS transaction_date AND DEDUCTS STOCK
      try {
        await fetch(`${API}/orders/${id}/set_joborder_date`, {
          method: "POST",
          credentials: "include",
        });
      } catch (err) {
        notify.error("Failed to finalize Job Order (date/stock).");
      }

      notify.success(
        `Job Order #${id} saved. Total ${Number(
          data.total_price ?? total
        ).toFixed(2)}`
      );

      generateJobOrderPDF(id);
      onClose();
    } catch (e) {
      notify.error(e?.message || "Failed to submit Job Order.");
      setError(e?.message || "Failed to submit Job Order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="orderslip-overlay">
      <div className="orderslip-container">
        <div className="orderslip-header">
          <h3>Job Order Slip</h3>
        </div>
        <div className="orderslip-date">{todayDisplay}</div>

        <form className="orderslip-form" onSubmit={onSubmit}>
          <label>
            Name:
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name"
              required
            />
          </label>

          <label>
            Address:
            <input
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              placeholder="e.g. USTP Claveria"
            />
          </label>

          <div className="orderslip-lines">
            {lines.map((row, idx) => (
              <div key={idx} className="line-row">
                <label>
                  Item:
                  <select
                    value={row.item_id}
                    onChange={(e) => updateLine(idx, "item_id", e.target.value)}
                    disabled={loading}
                    required
                  >
                    <option value="">Select Souvenir Item</option>
                    {catalog.map((it) => (
                      <option key={it.item_id} value={it.item_id}>
                        {it.name} — {Number(it.price).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Quantity:
                  <input
                    type="number"
                    min="1"
                    value={row.quantity}
                    onChange={(e) =>
                      updateLine(idx, "quantity", e.target.value)
                    }
                    required
                  />
                </label>

                <button
                  type="button"
                  className="btn-remove-line"
                  onClick={() => removeLine(idx)}
                >
                  Remove
                </button>
              </div>
            ))}

            <button type="button" className="btn-add-line" onClick={addLine}>
              + Add another item
            </button>
          </div>

          <div className="orderslip-total">
            <strong>Total:</strong> {total.toFixed(2)}
          </div>

          {error && <div className="orderslip-error">{error}</div>}

          <div className="orderslip-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn-print" disabled={submitting}>
              {submitting ? "Saving..." : "Save & Print"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
