import React, { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./style/StockCard.css";
import logo from "../assets/logo.png";
import api from "../auth/api";
import notify from "../utils/notify";

function StockCard() {
  const [items, setItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [header, setHeader] = useState(null);

  // movements = [openingRow, ...rowsFromBackend]
  const [movements, setMovements] = useState([]);
  const [editableMovements, setEditableMovements] = useState([]);

  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Opening row (Row 0) – only Balance, not editable
  const makeOpeningRow = () => ({
    type: "opening",
    id: null,
    date: "",
    reference_no: "",
    receipt_qty: "",
    issuance_qty: "",
    office: "",
    days_to_consume: "",
  });

  /**
   * 🧮 Compute balance for UI row index.
   *
   * UI rows = [openingRow, ...movementRows]
   * - Row 0: balance = header.opening_balance
   * - Row i>=1: balance = opening_balance - sum(issuance of rows 1..i)
   */
  const getBalanceForIndex = (rows, index) => {
    if (!header) return "";

    const opening = Number(
      header.opening_balance ?? header.current_stock ?? 0
    );

    if (index === 0) return opening;

    let balance = opening;
    for (let i = 1; i <= index; i++) {
      const issuance = Number(rows[i]?.issuance_qty || 0);
      balance -= issuance;
    }
    return balance;
  };

  // 1️⃣ Load all items for dropdown
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await api.get("/items");
        const data = res.data;
        const list = Array.isArray(data) ? data : data.items || [];
        setItems(list);
      } catch (err) {
        console.error("Error fetching items:", err);
        setError(err.message || "Failed to load items");
      }
    };

    fetchItems();
  }, []);

  // 2️⃣ Load stock card data for a given item (header + movements)
  const loadStockCardData = async (itemId) => {
    try {
      const res = await api.get(`/stockcard/${itemId}`);
      const data = res.data;

      // header from backend
      setHeader(data.header);

      // opening row (Row 0)
      const openingRow = makeOpeningRow();

      // movement rows from backend (one per order_line)
      const backendMovements = (data.movements || []).map((m) => ({
        type: "movement",
        id: m.id, // order_line_id
        date: m.date || "",
        reference_no: m.reference_no || "",
        receipt_qty: m.receipt_qty ?? "",
        issuance_qty: m.issuance_qty ?? "",
        office: m.office ?? "",
        days_to_consume: m.days_to_consume ?? "",
      }));

      const allRows = [openingRow, ...backendMovements];

      setMovements(allRows);
      setEditableMovements(allRows);
    } catch (err) {
      console.error("Error fetching stockcard:", err);
      const openingRow = makeOpeningRow();
      setMovements([openingRow]);
      setEditableMovements([openingRow]);
    }
  };

  // 3️⃣ When user picks an item
  const handleItemChange = async (e) => {
    const id = e.target.value;
    setSelectedItemId(id);
    setError("");
    setIsEditing(false);

    if (!id) {
      setHeader(null);
      setMovements([]);
      setEditableMovements([]);
      return;
    }

    const selected = items.find(
      (item) => String(item.item_id) === String(id)
    );
    if (!selected) {
      setHeader(null);
      setMovements([]);
      setEditableMovements([]);
      setError("Selected item not found.");
      return;
    }

    // Temporary header while waiting for backend response
    setHeader((prev) => ({
      ...(prev || {}),
      ...selected,
      current_stock: selected.stock_quantity,
    }));

    await loadStockCardData(selected.item_id);
  };

  // ✏️ Start editing
  const startEditing = () => {
    if (!header) return;

    let rows = movements;
    if (!rows || rows.length === 0) {
      rows = [makeOpeningRow()];
      setMovements(rows);
    }
    setEditableMovements(rows);
    setIsEditing(true);
  };

  // ❌ Cancel editing
  const handleCancel = () => {
    setEditableMovements(movements);
    setIsEditing(false);
  };

  // 💾 Save (frontend + backend update)
  const handleSave = async () => {
    // 1) Update UI state
    setMovements(editableMovements);
    setIsEditing(false);

    // 2) Prepare payload for backend:
    //    Only rows that came from DB (have id)
    const payloadMovements = editableMovements
      .filter((row) => row.type === "movement" && row.id)
      .map((row) => ({
        id: row.id,
        reference_no: row.reference_no || null,
        office: row.office || null,
        days_to_consume:
          row.days_to_consume === "" || row.days_to_consume == null
            ? null
            : Number(row.days_to_consume),
        receipt_qty:
          row.receipt_qty === "" || row.receipt_qty == null
            ? null
            : Number(row.receipt_qty),
      }));

    try {
      if (selectedItemId && payloadMovements.length) {
        await api.put(`/stockcard/${selectedItemId}`, {
          movements: payloadMovements,
        });
        console.log("Stockcard changes saved to backend.");
      }
    } catch (err) {
      console.error("Error saving stockcard changes:", err);
      notify.error("Failed to save stock card changes.");
    }

    console.log("Stock card rows saved:", editableMovements);
  };

  // ➕ Add manual row – only in UI (no DB id, so not saved to DB)
  const handleAddRow = () => {
    setEditableMovements((prev) => [
      ...prev,
      {
        type: "movement",
        id: null, // no DB link; won't be sent in PUT
        date: "",
        reference_no: "",
        receipt_qty: "",
        issuance_qty: "",
        office: "",
        days_to_consume: "",
      },
    ]);
  };

  // Update a single cell (UI only; DB updates happen on Save)
  const handleCellChange = (index, field, value) => {
    setEditableMovements((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    );
  };

  // 🔍 Filter rows but keep index for balance computation
  const sourceRows = isEditing ? editableMovements : movements;
  const rowsWithIndex = (sourceRows || []).map((row, idx) => ({ row, idx }));

  const filteredRows = rowsWithIndex.filter(({ row }) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const dateStr = (row.date || "").toString().toLowerCase();
    const refStr = (row.reference_no || "").toString().toLowerCase();
    return dateStr.includes(term) || refStr.includes(term);
  });

  // ✅ Generate & preview PDF (same balance logic)
  const handlePreviewPDF = () => {
    if (!header) return;

    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();

    // Logo + Header
    const imgWidth = 20;
    const imgHeight = 20;
    doc.addImage(
      logo,
      "PNG",
      pageWidth / 2 - imgWidth / 2,
      10,
      imgWidth,
      imgHeight
    );

    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text(
      "UNIVERSITY OF SCIENCE & TECHNOLOGY OF SOUTHERN PHILIPPINES",
      pageWidth / 2,
      36,
      { align: "center" }
    );
    doc.setFontSize(14);
    doc.text("STOCK CARD", pageWidth / 2, 44, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("times", "italic");
    doc.text("Agency", pageWidth / 2, 50, { align: "center" });

    doc.setFont("times", "normal");

    // Top info from DB
    let y = 58;
    const leftMargin = 14;

    const description = header.category
      ? `${header.category}${header.unit ? " (" + header.unit + ")" : ""}`
      : header.unit || "";

    doc.text(`Item: ${header.name}`, leftMargin, y);

    y += 6;
    doc.text(`Description: ${description}`, leftMargin, y);

    y += 8;
    doc.text("Re-order Point:", leftMargin, y);
    y += 5;

    if (header.estimated_days_to_consume) {
      doc.text(
        `No. of Days to Consume: ${header.estimated_days_to_consume}`,
        pageWidth / 2 + 10,
        y
      );
    }

    y += 8;

    // Build table body using same balance logic
    const tableBody = (movements || []).map((row, index) => [
      row.type === "opening" ? "" : row.date || "",
      row.type === "opening" ? "" : row.reference_no || "",
      row.type === "opening" ? "" : row.receipt_qty ?? "",
      row.type === "opening" ? "" : row.issuance_qty ?? "",
      row.type === "opening" ? "" : row.office ?? "",
      getBalanceForIndex(movements, index),
      row.type === "opening" ? "" : row.days_to_consume ?? "",
    ]);

    const targetRows = 22;
    while (tableBody.length < targetRows) {
      tableBody.push(["", "", "", "", "", "", ""]);
    }

    autoTable(doc, {
      startY: y,
      head: [
        [
          { content: "Date", rowSpan: 2 },
          { content: "Reference", rowSpan: 2 },
          { content: "Receipt", colSpan: 1 },
          { content: "Issuance", colSpan: 2 },
          { content: "Balance Qty.", rowSpan: 2 },
          { content: "No. of Days to Consume", rowSpan: 2 },
        ],
        [
          { content: "Qty." }, // under Receipt
          { content: "Qty." }, // under Issuance
          { content: "Office" }, // under Issuance
        ],
      ],
      body: tableBody,
      styles: {
        fontSize: 9,
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: 0,
        fontStyle: "bold",
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
      },
    });

    const finalY = doc.lastAutoTable.finalY || y + 60;
    doc.setFontSize(9);
    doc.setFont("times", "italic");
    doc.text("For Property Office Use", leftMargin, finalY + 10);

    const pdfBlob = doc.output("blob");
    const pdfURL = URL.createObjectURL(pdfBlob);
    window.open(pdfURL, "_blank");
    notify.success("Stock card downloaded.");
  };

  const uiDescription =
    header &&
    (header.category
      ? `${header.category}${header.unit ? " (" + header.unit + ")" : ""}`
      : header.unit || "");

  return (
    <div className="stockcard-container">
      <h2 className="page-title">Stock Card</h2>

      {/* Item selector */}
      <div className="item-selector-bar no-print">
        <label className="item-selector-label">
          Item:
          <select
            className="item-select"
            value={selectedItemId}
            onChange={handleItemChange}
          >
            <option value="">
              {items.length ? "Select an item" : "Loading items..."}
            </option>
            {items.map((item) => (
              <option key={item.item_id} value={item.item_id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="error-text no-print">Error: {error}</p>}

      {selectedItemId && header && (
        <>
          {/* Header meta */}
          <div className="stockcard-meta no-print">
            <div className="meta-left">
              <div className="meta-row-ui">
                <span className="meta-label-ui">Item:</span>
                <span className="meta-value-ui">{header.name}</span>
              </div>
              <div className="meta-row-ui">
                <span className="meta-label-ui">Description:</span>
                <span className="meta-value-ui">
                  {uiDescription || "-"}
                </span>
              </div>
            </div>

            <div className="meta-right">
              <div className="meta-row-ui">
                <span className="meta-label-ui">Opening Balance:</span>
                <span className="meta-value-ui">
                  {header.opening_balance}
                </span>
              </div>
              <div className="meta-row-ui">
                <span className="meta-label-ui">Current Stock:</span>
                <span className="meta-value-ui">
                  {header.current_stock}
                </span>
              </div>
              <div className="meta-row-ui">
                <span className="meta-label-ui">Re-order Level:</span>
                <span className="meta-value-ui">
                  {header.reorder_level}
                </span>
              </div>
            </div>
          </div>

          {/* Search + buttons */}
          <div className="controls-bar no-print">
            <div className="filter-group">
              <input
                type="text"
                placeholder="Search by date or reference..."
                className="search-field"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="controls-right">
              {isEditing && (
                <button
                  type="button"
                  className="addrow-btn"
                  onClick={handleAddRow}
                >
                  Add Row
                </button>
              )}

              {isEditing && (
                <button
                  type="button"
                  className="save-btn"
                  onClick={handleSave}
                >
                  Save
                </button>
              )}

              {!isEditing ? (
                <button
                  type="button"
                  className="edit-btn"
                  onClick={startEditing}
                  disabled={!header}
                >
                  Edit Table
                </button>
              ) : (
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div
            className={`table-card ${isEditing ? "editing-mode" : ""}`}
          >
            <table className="stockcard-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Receipt Qty.</th>
                  <th>Issuance Qty.</th>
                  <th>Office</th>
                  <th>Balance Qty.</th>
                  <th>No. of Days to Consume</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length ? (
                  filteredRows.map(({ row, idx }) => {
                    const isOpening = row.type === "opening";
                    const balance = getBalanceForIndex(sourceRows, idx);

                    return (
                      <tr key={idx}>
                        {/* Date */}
                        <td>
                          {isEditing && !isOpening ? (
                            <input
                              type="date"
                              className="stockcard-input date-input"
                              value={row.date || ""}
                              onChange={(e) =>
                                handleCellChange(
                                  idx,
                                  "date",
                                  e.target.value
                                )
                              }
                              disabled
                            />
                          ) : (
                            row.date
                          )}
                        </td>

                        {/* Reference No. */}
                        <td className="text-left">
                          {isEditing && !isOpening ? (
                            <input
                              type="text"
                              className="stockcard-input"
                              value={row.reference_no || ""}
                              onChange={(e) =>
                                handleCellChange(
                                  idx,
                                  "reference_no",
                                  e.target.value
                                )
                              }
                            />
                          ) : (
                            row.reference_no
                          )}
                        </td>

                        {/* Receipt Qty */}
                        <td>
                          {isEditing && !isOpening ? (
                            <input
                              type="number"
                              min="0"
                              className="stockcard-input qty-input"
                              value={row.receipt_qty ?? ""}
                              onChange={(e) =>
                                handleCellChange(
                                  idx,
                                  "receipt_qty",
                                  e.target.value
                                )
                              }
                            />
                          ) : (
                            row.receipt_qty ?? ""
                          )}
                        </td>

                        {/* Issuance Qty */}
                        <td>
                          {isEditing && !isOpening ? (
                            <input
                              type="number"
                              min="0"
                              className="stockcard-input qty-input"
                              value={row.issuance_qty ?? ""}
                              onChange={(e) =>
                                handleCellChange(
                                  idx,
                                  "issuance_qty",
                                  e.target.value
                                )
                              }
                              disabled
                            />
                          ) : (
                            row.issuance_qty ?? ""
                          )}
                        </td>

                        {/* Office */}
                        <td className="text-left">
                          {isEditing && !isOpening ? (
                            <input
                              type="text"
                              className="stockcard-input"
                              value={row.office ?? ""}
                              onChange={(e) =>
                                handleCellChange(
                                  idx,
                                  "office",
                                  e.target.value
                                )
                              }
                            />
                          ) : (
                            row.office ?? ""
                          )}
                        </td>

                        {/* Balance Qty */}
                        <td>{balance}</td>

                        {/* No. of Days to Consume */}
                        <td>
                          {isEditing && !isOpening ? (
                            <input
                              type="number"
                              min="0"
                              className="stockcard-input days-input"
                              value={row.days_to_consume ?? ""}
                              onChange={(e) =>
                                handleCellChange(
                                  idx,
                                  "days_to_consume",
                                  e.target.value
                                )
                              }
                            />
                          ) : (
                            row.days_to_consume ?? ""
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center" }}>
                      No movements for this item.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Download PDF */}
          <div className="bottom-action no-print">
            <button
              className="print-btn"
              onClick={handlePreviewPDF}
              disabled={!header}
            >
              Download File
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default StockCard;
