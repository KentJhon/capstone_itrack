import React, { useState, useEffect } from "react";
import api from "../auth/api";
import "../views/style/Inventory.css";
import notify from "../utils/notify";
import confirmAction from "../utils/confirm";


// 🔧 Tune this to change how aggressive the reorder threshold is
// e.g. 0.7 = 70% of predicted next-month issuance
const LOW_STOCK_PERCENT_OF_FORECAST = 0.7;

function Inventory() {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null); // use ID instead of index
  const [newItem, setNewItem] = useState({
    name: "",
    price: "",
    type: "",
    stock: "",
    size: "",
    alert: "Sufficient",
  });

  // 🔹 Add Stock modal state
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [stockForm, setStockForm] = useState({
    category: "",
    itemId: "",
    amount: "",
  });

  // 🔹 Forecast map from /predictive/next_month/all
  // { "item name (lowercase)": { item_name, current_stock, next_month_forecast } }
  const [forecastMap, setForecastMap] = useState({});

  // 🔹 Search text
  const [searchTerm, setSearchTerm] = useState("");

  // ---------------- FETCHERS ----------------

  useEffect(() => {
    fetchItems();
    fetchForecasts();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await api.get("/items");

      // ✅ Support both array and {items: []} formats
      const data = Array.isArray(response.data)
        ? response.data
        : response.data.items || [];

      // ✅ Only keep Garments and Stationery items
      const filtered = data.filter(
        (item) => item.category === "Garments" || item.category === "Stationery"
      );

      setItems(filtered);
    } catch (error) {
      notify.error("Error fetching items");
    }
  };

  const fetchForecasts = async () => {
    try {
      const res = await api.get("/predictive/next_month/all");

      const rows = res.data?.rows || [];
      const map = {};

      rows.forEach((row) => {
        const key = String(row.item_name).trim().toLowerCase();
        map[key] = row; // { item_name, current_stock, next_month_forecast }
      });

      setForecastMap(map);
    } catch (err) {
      notify.error("Error fetching forecasts");
    }
  };

  // -------------- DYNAMIC REORDER LEVEL --------------

  const computeDynamicReorderLevel = (item) => {
    const key = String(item.name).trim().toLowerCase();
    const fcRow = forecastMap[key];
    const forecast = fcRow ? Number(fcRow.next_month_forecast || 0) : 0;

    if (!forecast || forecast <= 0) {
      // No meaningful forecast: fall back to stored reorder_level or 0
      return Number(item.reorder_level || 0);
    }

    const level = Math.round(LOW_STOCK_PERCENT_OF_FORECAST * forecast);

    // Make sure it’s at least 1
    return Math.max(level, 1);
  };

  const isLowStock = (item) => {
    const level = computeDynamicReorderLevel(item);
    return item.stock_quantity <= level;
  };

  // 🔹 Recommended restock count based on forecast – current stock
  const getRecommendedRestock = (item) => {
    const key = String(item.name).trim().toLowerCase();
    const fcRow = forecastMap[key];

    if (!fcRow) return 0;

    const forecast = Number(fcRow.next_month_forecast || 0);
    const stock = Number(item.stock_quantity || 0);

    const restock = forecast - stock;
    return restock > 0 ? restock : 0;
  };

  // ---------------- MODALS: ADD / EDIT ITEM ----------------

  // Open Add Modal
  const openAddModal = () => {
    setEditingId(null);
    setNewItem({
      name: "",
      price: "",
      type: "",
      stock: "",
      size: "",
      alert: "Sufficient",
    });
    setShowModal(true);
  };

  // Open Edit Modal
  const openEditModal = (item) => {
    const dynamicLevel = computeDynamicReorderLevel(item);

    setEditingId(item.item_id);
    setNewItem({
      name: item.name,
      price: item.price,
      type: item.unit,
      stock: item.stock_quantity,
      size: item.category, // "Stationery" or "Garments"
      alert: item.stock_quantity > dynamicLevel ? "Sufficient" : "Low Stock",
    });
    setShowModal(true);
  };

  // Save (Add or Edit)
  const handleSave = async () => {
    try {
      const formData = new FormData();
      formData.append("name", newItem.name);
      formData.append("unit", newItem.type);
      formData.append("category", newItem.size); // only Stationery / Garments from dropdown
      formData.append("price", parseFloat(newItem.price));
      formData.append("stock_quantity", parseInt(newItem.stock, 10));

      // We are now using dynamic reorder level from forecast,
      // but DB column can stay 0 as a placeholder.
      formData.append("reorder_level", 0);

      if (editingId !== null) {
        await api.put(`/items/${editingId}`, formData);
      } else {
        await api.post("/items", formData);
      }

      setShowModal(false);
      setNewItem({
        name: "",
        price: "",
        type: "",
        stock: "",
        size: "",
        alert: "Sufficient",
      });
      setEditingId(null);
      fetchItems();
      fetchForecasts(); // refresh forecasts too (optional but safe)
      notify.success(editingId !== null ? "Item updated" : "Item created");
    } catch (error) {
      notify.error("Failed to save item");
    }
  };

  // ---------------- DELETE ITEM ----------------

  const handleDelete = async (itemId) => {
    const ok = await confirmAction("Are you sure you want to delete this item?");
    if (!ok) return;
    try {
      await api.delete(`/items/${itemId}`);
      fetchItems();
      fetchForecasts();
      notify.success("Item deleted");
    } catch (error) {
      notify.error("Error deleting item");
    }
  };

  // ---------------- ADD STOCK FLOW ----------------

  // 🔹 Open Add Stock modal
  const openAddStockModal = () => {
    setStockForm({
      category: "",
      itemId: "",
      amount: "",
    });
    setShowAddStockModal(true);
  };

  // 🔹 Items filtered by selected category for the Item dropdown
  const stockCategoryItems = stockForm.category
    ? items.filter((item) => item.category === stockForm.category)
    : [];

  // 🔹 Handle Add Stock submit
  const handleAddStock = async () => {
    try {
      const { category, itemId, amount } = stockForm;

      if (!category || !itemId || !amount) {
        notify.error("Please fill in all fields.");
        return;
      }

      const addAmount = parseInt(amount, 10);
      if (isNaN(addAmount) || addAmount <= 0) {
        notify.error("Add Stock Amount must be a positive number.");
        return;
      }

      const selectedItem = items.find(
        (it) => it.item_id === parseInt(itemId, 10)
      );
      if (!selectedItem) {
        notify.error("Item not found.");
        return;
      }

      const newStock = selectedItem.stock_quantity + addAmount;

      // Build form data using existing item values, only changing stock_quantity
      const formData = new FormData();
      formData.append("name", selectedItem.name);
      formData.append("unit", selectedItem.unit);
      formData.append("category", selectedItem.category); // Stationery / Garments only
      formData.append("price", selectedItem.price);
      formData.append("stock_quantity", newStock);
      // keep DB reorder_level as-is (0), we compute dynamic in UI
      formData.append("reorder_level", selectedItem.reorder_level);

      await api.put(`/items/${selectedItem.item_id}`, formData);

      notify.success("Stock successfully updated");
      setShowAddStockModal(false);
      setStockForm({
        category: "",
        itemId: "",
        amount: "",
      });
      fetchItems();
      fetchForecasts();
    } catch (error) {
      notify.error("Failed to add stock");
    }
  };

  // ---------------- FILTER + SORT FOR DISPLAY ----------------

  const displayItems = [...items]
    // 1) Apply search filter
    .filter((item) => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        String(item.item_id).includes(q) ||
        item.name.toLowerCase().includes(q) ||
        (item.category || "").toLowerCase().includes(q)
      );
    })
    // 2) Low stock first, then by reorder level
    .sort((a, b) => {
      const aLow = isLowStock(a);
      const bLow = isLowStock(b);

      // Low Stock rows on top
      if (aLow && !bLow) return -1;
      if (!aLow && bLow) return 1;

      // If both are Low Stock, sort by dynamic reorder level (highest first)
      if (aLow && bLow) {
        const aLevel = computeDynamicReorderLevel(a);
        const bLevel = computeDynamicReorderLevel(b);
        if (bLevel !== aLevel) return bLevel - aLevel;
      }

      // Otherwise keep their relative order (0 = no preference)
      return 0;
    });

  // ---------------- RENDER ----------------

  return (
    <div className="inventory-page">
      {/* Header + actions (fixed) */}
      <div className="inventory-header">
        <div>
          <h2>Inventory Items</h2>
          <p className="inventory-subtitle">
            Manage and monitor Garments &amp; Stationery stocks in real-time.
            <br />
            <span style={{ fontSize: "0.8rem", color: "#777" }}>
              Reorder Level is automatically based on{" "}
              {Math.round(LOW_STOCK_PERCENT_OF_FORECAST * 100)}% of predicted
              next-month issuance.
            </span>
          </p>
        </div>

        <div className="inventory-actions">
          {/* 🔍 Search bar inline with buttons */}
          <input
            type="text"
            className="inventory-search-input"
            placeholder="Search item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <button className="btn btn-primary" onClick={openAddStockModal}>
            Add Stock
          </button>

          <button className="btn btn-primary" onClick={openAddModal}>
            Add Item
          </button>
        </div>
      </div>

      {/* Card with scrollable table only */}
      <div className="inventory-table-card">
        <div className="inventory-table-scroll">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Item ID</th>
                <th>Item Name</th>
                <th>Price</th>
                <th>Unit</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Reorder Level</th>
                <th>Recommended Restock</th>
                <th>Alert</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item) => {
                const dynamicLevel = computeDynamicReorderLevel(item);
                const low = isLowStock(item);
                const recommended = getRecommendedRestock(item);

                return (
                  <tr key={item.item_id}>
                    <td>{item.item_id}</td>
                    <td>{item.name}</td>
                    <td>₱{item.price}</td>
                    <td>{item.unit}</td>
                    <td>{item.category}</td>
                    <td>{item.stock_quantity}</td>
                    {/* 🔹 Show dynamic reorder level instead of DB value */}
                    <td>{dynamicLevel}</td>
                    {/* 🔹 New Recommended Restock column */}
                    <td>{recommended}</td>
                    <td
                      className={
                        low ? "status-insufficient" : "status-sufficient"
                      }
                    >
                      {low ? "Low Stock" : "Sufficient"}
                    </td>
                    <td className="actions-cell">
                      <button
                        className="table-btn edit-btn"
                        onClick={() => openEditModal(item)}
                      >
                        Edit
                      </button>
                      <button
                        className="table-btn delete-btn"
                        onClick={() => handleDelete(item.item_id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {displayItems.length === 0 && (
                <tr>
                  <td colSpan="10" style={{ textAlign: "center", padding: 24 }}>
                    No Stationery or Garments items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Item Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{editingId !== null ? "Edit Item" : "Add New Item"}</h3>

            <input
              type="text"
              placeholder="Item Name"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
            />

            <input
              type="number"
              placeholder="Price"
              value={newItem.price}
              onChange={(e) =>
                setNewItem({ ...newItem, price: e.target.value })
              }
            />

            <input
              type="text"
              placeholder="Unit"
              value={newItem.type}
              onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
            />

            {/* Category dropdown (Stationery / Garments only) */}
            <select
              value={newItem.size}
              onChange={(e) => setNewItem({ ...newItem, size: e.target.value })}
            >
              <option value="">Select Category</option>
              <option value="Stationery">Stationery</option>
              <option value="Garments">Garments</option>
            </select>

            <input
              type="number"
              placeholder="Stock"
              value={newItem.stock}
              onChange={(e) =>
                setNewItem({ ...newItem, stock: e.target.value })
              }
            />

            <div className="modal-buttons">
              <button className="btn btn-primary" onClick={handleSave}>
                Save
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔹 Add Stock Modal */}
      {showAddStockModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Add Stock</h3>

            {/* Category dropdown (Stationery / Garments only) */}
            <select
              value={stockForm.category}
              onChange={(e) =>
                setStockForm({
                  ...stockForm,
                  category: e.target.value,
                  itemId: "",
                })
              }
            >
              <option value="">Select Category</option>
              <option value="Stationery">Stationery</option>
              <option value="Garments">Garments</option>
            </select>

            {/* Item dropdown (depends on category) */}
            <select
              value={stockForm.itemId}
              onChange={(e) =>
                setStockForm({ ...stockForm, itemId: e.target.value })
              }
              disabled={!stockForm.category}
            >
              <option value="">Select Item</option>
              {stockCategoryItems.map((item) => (
                <option key={item.item_id} value={item.item_id}>
                  {item.name}
                </option>
              ))}
            </select>

            {/* Add Stock Amount */}
            <input
              type="number"
              placeholder="Add Stock Amount"
              value={stockForm.amount}
              onChange={(e) =>
                setStockForm({ ...stockForm, amount: e.target.value })
              }
            />

            <div className="modal-buttons">
              <button className="btn btn-primary" onClick={handleAddStock}>
                Save
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setShowAddStockModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Inventory;

