import React, { useEffect, useMemo, useRef, useState } from "react";
import "../OrderSlip/style/Slips.css";
// dY-" printer helpers
import {
  isWebUsbSupported,
  connectPrinter,
  printGarmentReceipt,
} from "../../printing/pos58Printer";
import { useAuth } from "../../auth/useAuth";
import notify from "../../utils/notify";
import API_BASE_URL from "../../config";

export default function GarmentSlip({ onClose }) {
  const API = useMemo(() => API_BASE_URL, []);
  const today = new Date().toLocaleDateString("en-US", {
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

  // dY-" printer state
  const [printerConnected, setPrinterConnected] = useState(false);
  const [connectingPrinter, setConnectingPrinter] = useState(false);
  const [printingPos, setPrintingPos] = useState(false);
  const [printerError, setPrinterError] = useState("");
  const { user } = useAuth();

  // Hidden buffer for scanner input
  const scanBuffer = useRef("");
  const lastKeyTime = useRef(0);

  // ---------- helper: parse QR ----------
  const isLikelyId = (val) => {
    const s = String(val || "").trim();
    if (!s) return false;
    const digits = (s.match(/\d/g) || []).length;
    const letters = (s.match(/[A-Za-z]/g) || []).length;
    if (/^\d{4,}$/.test(s)) return true; // numeric IDs
    if (/^\d{2,}[-/][A-Za-z0-9]+/.test(s)) return true; // dash/slash IDs
    if (s.includes("-") && digits >= 4 && s.length >= 8) return true;
    if (digits >= 6 && digits >= letters) return true;
    return false;
  };

  const isCourseLike = (val) => {
    const s = String(val || "").trim();
    if (!s) return false;
    if (/\d/.test(s)) return false; // block numbers entirely
    if (!/[A-Za-z]/.test(s)) return false;
    if (s.length > 12) return false;
    if (isLikelyId(s)) return false;
    return true;
  };

  const parseQrValue = (raw) => {
    if (!raw) return { name: "", course: "" };

    const cleaned = String(raw).replace(/\r?\n/g, "").trim();

    // Prefer tab-delimited payloads: Name \t Course \t ID
    const tabParts = cleaned
      .split("\t")
      .map((p) => p.trim())
      .filter(Boolean);
    if (tabParts.length >= 2) {
      const name = tabParts[0];
      const rest = tabParts.slice(1);
      const course =
        rest.find((p) => isCourseLike(p)) ||
        rest.find((p) => !isLikelyId(p) && !/\d/.test(p)) ||
        "";
      return { name, course };
    }

    // Fallback: space-delimited tokens
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return { name: "", course: "" };

    // Scan from the end to find a course-like token
    for (let i = tokens.length - 1; i >= 1; i -= 1) {
      if (isCourseLike(tokens[i])) {
        return { name: tokens.slice(0, i).join(" "), course: tokens[i] };
      }
    }

    // If the last token is not an ID, treat it as course; otherwise leave blank
    if (
      tokens.length >= 2 &&
      !isLikelyId(tokens[tokens.length - 1]) &&
      !/\d/.test(tokens[tokens.length - 1])
    ) {
      return {
        name: tokens.slice(0, -1).join(" "),
        course: tokens[tokens.length - 1],
      };
    }

    return { name: tokens.join(" "), course: "" };
  };

  // ---------- load items (only Garments, with dummy fallback) ----------
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API}/items`);
        const data = await res.json();

        const garments = (data || []).filter((item) => {
          return (
            String(item.category || "")
              .trim()
              .toLowerCase() === "garments"
          );
        });

        if (garments.length > 0) {
          setCatalog(garments);
        } else {
          setCatalog([
            { item_id: 9991, name: "USTP Polo Shirt", price: 350 },
            { item_id: 9992, name: "USTP Hoodie", price: 600 },
            { item_id: 9993, name: "USTP Lanyard", price: 80 },
          ]);
          setError("No garments found from API. Using dummy items.");
        }
      } catch (e) {
        notify.error("Failed to load garments. Using fallback.");
        setCatalog([
          { item_id: 9991, name: "USTP Polo Shirt", price: 350 },
          { item_id: 9992, name: "USTP Hoodie", price: 600 },
          { item_id: 9993, name: "USTP Lanyard", price: 80 },
        ]);
        setError("Failed to load items. Using dummy garments.");
      } finally {
        setLoading(false);
      }
    })();
  }, [API]);

  // ---------- GLOBAL scanner listener (but *not* when typing in fields) ----------
  useEffect(() => {
    const isFormElement = (el) =>
      el &&
      (el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT" ||
        el.isContentEditable);

    const handleKeydown = (e) => {
      const now = Date.now();
      const delta = now - lastKeyTime.current;
      if (delta > 200) {
        scanBuffer.current = "";
      }
      lastKeyTime.current = now;

      const isChar =
        e.key &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey;
      const hasBuffer = scanBuffer.current.length > 0;
      const rapid = delta < 25;
      const likelyScan = rapid || hasBuffer;
      const activeIsForm = isFormElement(document.activeElement);

      if (activeIsForm) {
        // Let normal typing through; only intercept very rapid scan bursts
        if (e.key === "Enter" && scanBuffer.current.length > 0) {
          e.preventDefault();
          const raw = scanBuffer.current.trim();
          scanBuffer.current = "";
          if (!raw) return;
          const parsed = parseQrValue(raw);
          if (parsed.name) setCustomerName(parsed.name);
          if (parsed.course) setCourse(parsed.course);
          return;
        }

        if (rapid && isChar) {
          e.preventDefault();
          scanBuffer.current += e.key;
          return;
        }

        if (isChar) {
          scanBuffer.current = "";
        }
        return;
      }

      // Outside inputs: only handle scans / buffered chars
      if (!likelyScan && !isChar) return;

      e.preventDefault();

      if (e.key === "Escape") {
        scanBuffer.current = "";
        return;
      }

      if (e.key === "Enter") {
        const raw = scanBuffer.current.trim();
        scanBuffer.current = "";
        if (!raw) return;

        const parsed = parseQrValue(raw);
        if (parsed.name) setCustomerName(parsed.name);
        if (parsed.course) setCourse(parsed.course);
        return;
      }

      if (e.key === "Tab") {
        scanBuffer.current += "\t";
        return;
      }

      if (e.key && e.key.length === 1) {
        scanBuffer.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  // ---------- line item operations ----------
  const addLine = () => setLines((l) => [...l, { item_id: "", quantity: 1 }]);
  const removeLine = (idx) => setLines((l) => l.filter((_, i) => i !== idx));
  const updateLine = (idx, field, value) =>
    setLines((l) =>
      l.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );

  const total = lines.reduce((sum, row) => {
    const found = catalog.find(
      (c) => String(c.item_id) === String(row.item_id)
    );
    if (!found) return sum;
    const price = Number(found.price || 0);
    const qty = Number(row.quantity || 0);
    return sum + price * qty;
  }, 0);

  // ---------- printer handlers ----------

  const handleConnectPrinter = async () => {
    setPrinterError("");
    if (!isWebUsbSupported()) {
      setPrinterError(
        "WebUSB not supported. Please use Chrome or Edge on desktop (HTTPS/localhost)."
      );
      return false;
    }

    try {
      setConnectingPrinter(true);
      await connectPrinter();
      setPrinterConnected(true);
      return true;
    } catch (e) {
      notify.error("Failed to connect to printer.");

      if (String(e).includes("Access denied")) {
        setPrinterError(
          "Access denied by Windows driver. This USB device is using a standard printer driver. " +
            "To use WebUSB, you must switch it to a WinUSB driver (e.g., with Zadig), " +
            "or use a local printing service instead."
        );
      } else {
        setPrinterError(e.message || "Failed to connect to printer.");
      }
      setPrinterConnected(false);
      return false;
    } finally {
      setConnectingPrinter(false);
    }
  };

  const ensurePrinterConnected = async () => {
    if (printerConnected) return true;
    const ok = await handleConnectPrinter();
    return ok;
  };

  const printReceiptToPos = async () => {
    try {
      const ok = await ensurePrinterConnected();
      if (!ok) return;

      setPrintingPos(true);

      const itemsForReceipt = lines
        .filter((r) => r.item_id && Number(r.quantity) > 0)
        .map((r) => {
          const found = catalog.find(
            (c) => String(c.item_id) === String(r.item_id)
          );
          const name = found?.name || "";
          const price = Number(found?.price || 0);
          const qty = Number(r.quantity || 0);
          return { name, qty, price };
        });

      await printGarmentReceipt({
        date: today,
        customerName,
        course,
        items: itemsForReceipt,
        total,
      });
    } catch (e) {
      notify.error("Failed to print to POS58.");
      setPrinterError(e.message || "Failed to print to POS58.");
    } finally {
      setPrintingPos(false);
    }
  };

  // ---------- submit ----------
  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setPrinterError("");

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
      OR_number: null,
      student_id: null,
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
      const amount = data.total_price ?? 0;

      notify.success(`Order #${id} saved. Total ₱ ${Number(amount).toFixed(2)}`);

      // dY-" print text receipt to POS58 instead of window.print()
      await printReceiptToPos();

      onClose();
    } catch (e) {
      notify.error(e?.message || "Failed to submit order.");
      setError(e?.message || "Failed to submit order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="orderslip-overlay">
      <div className="orderslip-container">
        <div className="orderslip-header">
          <h3>Garment Slip</h3>
        </div>

        <div className="orderslip-doccode">
          Document Code: FM-USTP-ED-018
        </div>
        <div className="orderslip-date">{today}</div>
        <div className="orderslip-or-line">
          <span>OR#:</span>
          <div className="orderslip-or-blank" aria-hidden="true" />
          <span className="orderslip-or-note">(handwritten)</span>
        </div>

        {error && <div className="orderslip-error">{error}</div>}
        {printerError && (
          <div className="orderslip-error">{printerError}</div>
        )}

        <form className="orderslip-form" onSubmit={onSubmit}>
          <label>
            Name:
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter name"
              required
            />
          </label>

          <label>
            Course:
            <input
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              placeholder="e.g. BSIT"
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
                    <option value="">
                      {loading ? "Loading garments..." : "Select garment"}
                    </option>
                    {catalog.map((it) => (
                      <option key={it.item_id} value={it.item_id}>
                        {it.name} - ₱{Number(it.price).toFixed(2)}
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
            <strong>Total:</strong> ₱{total.toFixed(2)}
          </div>

          {error && <div className="orderslip-error">{error}</div>}
          {printerError && (
            <div className="orderslip-error">{printerError}</div>
          )}

          <div className="orderslip-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn-print"
              disabled={submitting || printingPos}
            >
              {submitting
                ? "Saving..."
                : printingPos
                ? "Printing..."
                : "Save & Print"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
