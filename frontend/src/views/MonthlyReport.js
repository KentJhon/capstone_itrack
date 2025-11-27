import React, { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./style/MonthlyReport.css";
import logo from "../assets/logo.png";
import api from "../auth/api";
import { formatDate } from "../utils/datetime";

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function MonthlyReport() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1–12
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMonthly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const fetchMonthly = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/reports/monthly", { params: { year, month } });
      const data = res.data;

      // ✅ TRUST BACKEND:
      // - Non-Souvenir items: already filtered to have valid OR
      // - Souvenir items: allowed without OR and returned as or_number = '-'
      setRows(data.rows || []);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  // filter by payer or description
  const filteredRows = rows.filter((r) => {
    const term = search.toLowerCase();
    return (
      (r.payer || "").toLowerCase().includes(term) ||
      (r.description || "").toLowerCase().includes(term)
    );
  });

  const currentMonthLabel = `${monthNames[month - 1]} ${year}`;

  // ✅ PDF generation (Monthly Report)
  const handlePreviewPDF = () => {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();

    // Logo
    const imgWidth = 25;
    const imgHeight = 25;
    doc.addImage(
      logo,
      "PNG",
      pageWidth / 2 - imgWidth / 2,
      10,
      imgWidth,
      imgHeight
    );

    // Header
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.text("USTP Display Center", pageWidth / 2, 42, { align: "center" });
    doc.setFontSize(12);
    doc.setFont("times", "normal");
    doc.text(`Monthly Sales Report - ${currentMonthLabel}`, pageWidth / 2, 50, {
      align: "center",
    });

    const tableData = filteredRows.map((r) => [
      r.or_number,
      formatDate(r.date),
      r.payer,
      r.qty_sold,
      r.unit,
      r.description,
      Number(r.unit_cost || 0).toFixed(2),
      Number(r.total_cost || 0).toFixed(2),
    ]);

    autoTable(doc, {
      startY: 58,
      head: [
        [
          "O.R#",
          "DATE",
          "PAYER",
          "QTY. SOLD",
          "UNIT",
          "DESCRIPTION",
          "UNIT COST",
          "TOTAL COST",
        ],
      ],
      body: tableData,
      styles: {
        fontSize: 10,
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
      columnStyles: {
        3: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right" },
      },
    });

    const genDate = formatDate(new Date());
    doc.setFontSize(10);
    doc.text(`Generated on: ${genDate}`, 14, 290);

    const pdfBlob = doc.output("blob");
    const pdfURL = URL.createObjectURL(pdfBlob);
    window.open(pdfURL, "_blank");
  };

  // simple year options (adjust as you like)
  const yearOptions = [];
  for (let y = 2020; y <= now.getFullYear() + 1; y++) {
    yearOptions.push(y);
  }

  return (
    <div className="inventory-page">
      {/* ===== Header & Actions ===== */}
      <div className="inventory-header no-print">
        <div>
          <h2>Monthly Reports</h2>
          <p className="inventory-subtitle">
            {currentMonthLabel} · {filteredRows.length} record
            {filteredRows.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="inventory-actions">
         
          <button
            className="btn btn-primary"
            onClick={handlePreviewPDF}
            disabled={filteredRows.length === 0}
          >
            Download File
          </button>
        </div>
      </div>

      {/* ===== Floating Card + Scrollable Table ===== */}
      <div className="inventory-table-card">
        {/* Filters (month/year/search) */}
        <div className="filters-row no-print">
          <div className="filter-group">
            {/* Month selector */}
            <select
              className="sort-select"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {monthNames.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>

            {/* Year selector */}
            <select
              className="sort-select"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            {/* Search */}
            <input
              type="text"
              placeholder="Search by payer or description..."
              className="search-field"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="error-message no-print">
            <span>{error}</span>
          </div>
        )}

        <div className="inventory-table-scroll">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>O.R#</th>
                <th>DATE</th>
                <th>PAYER</th>
                <th>QTY. SOLD</th>
                <th>UNIT</th>
                <th>DESCRIPTION</th>
                <th>UNIT COST</th>
                <th>TOTAL COST</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r, index) => (
                <tr key={`${r.date}-${r.or_number}-${index}`}>
                  <td>{r.or_number}</td>
                  <td>{formatDate(r.date)}</td>
                  <td>{r.payer}</td>
                  <td>{r.qty_sold}</td>
                  <td>{r.unit}</td>
                  <td>{r.description}</td>
                  <td>₱{Number(r.unit_cost).toFixed(2)}</td>
                  <td>₱{Number(r.total_cost).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default MonthlyReport;

