import React, { useState, useEffect } from "react";
import api from "../auth/api";
import "../views/style/Inventory.css";
import notify from "../utils/notify";
import confirmAction from "../utils/confirm";
import { useGlobalLoading } from "../loading/LoadingContext";

// Tune this to change how aggressive the reorder threshold is
// e.g. 0.7 = 70% of predicted next-month issuance
const LOW_STOCK_PERCENT_OF_FORECAST = 0.7;

function Inventory() {
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingForecasts, setLoadingForecasts] = useState(true);
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

  // Add Stock modal state
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [savingStock, setSavingStock] = useState(false);
  const [stockForm, setStockForm] = useState({
    category: "",
    itemId: "",
    amount: "",
  });

  // Forecast map from /predictive/next_month/all
  // { "item name (lowercase)": { item_name, current_stock, next_month_forecast } }
  const [forecastMap, setForecastMap] = useState({});
  const [savingItem, setSavingItem] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Search text
  const [searchTerm, setSearchTerm] = useState("");

  const { startLoading, stopLoading } = useGlobalLoading();

  // ---------------- FETCHERS ----------------

  useEffect(() => {
    fetchItems();
    fetchForecasts();
  }, []);

  const fetchItems = async () => {
    setLoadingItems(true);
    startLoading();
    try {
      const response = await api.get("/items");

      // Support both array and {items: []} formats
      const data = Array.isArray(response.data)
        ? response.data
        : response.data.items || [];

      // Only keep Garments and Stationery items
      const filtered = data.filter(
        (item) => item.category === "Garments" || item.category === "Stationery"
      );

      setItems(filtered);
    } catch (error) {
      notify.error("Error fetching items");
    } finally {
      setLoadingItems(false);
      stopLoading();
    }
  };

  const fetchForecasts = async () => {
    setLoadingForecasts(true);
    startLoading();
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
    } finally {
      setLoadingForecasts(false);
      stopLoading();
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

    return Math.max(level, 1);
  };

  const isLowStock = (item) => {
    const level = computeDynamicReorderLevel(item);
    return item.stock_quantity <= level;
  };

  // Recommended restock count based on forecast – current stock
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

  const openEditModal = (item) => {
    const dynamicLevel = computeDynamicReorderLevel(item);

    setEditingId(item.item_id);
    setNewItem({
      name: item.name,
      price: item.price,
      type: item.unit,
      stock: item.stock_quantity,
      size: item.category,
      alert: item.stock_quantity > dynamicLevel ? "Sufficient" : "Low Stock",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSavingItem(true);
    startLoading();
    try {
      const formData = new FormData();
      formData.append("name", newItem.name);
      formData.append("unit", newItem.type);
      formData.append("category", newItem.size);
      formData.append("price", parseFloat(newItem.price));
      formData.append("stock_quantity", parseInt(newItem.stock, 10));
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
      fetchForecasts();
      notify.success(editingId !== null ? "Item updated" : "Item created");
    } catch (error) {
      notify.error("Failed to save item");
    } finally {
      setSavingItem(false);
      stopLoading();
    }
  };

  // ---------------- DELETE ITEM ----------------

  const handleDelete = async (itemId) => {
    const ok = await confirmAction("Are you sure you want to delete this item?");
    if (!ok) return;
    setDeletingId(itemId);
    startLoading();
    try {
      await api.delete(`/items/${itemId}`);
      fetchItems();
      fetchForecasts();
      notify.success("Item deleted");
    } catch (error) {
      notify.error("Error deleting item");
    } finally {
      setDeletingId(null);
      stopLoading();
    }
  };

  // ---------------- ADD STOCK FLOW ----------------

  const openAddStockModal = () => {
    setStockForm({
      category: "",
      itemId: "",
      amount: "",
    });
    setShowAddStockModal(true);
  };

  const stockCategoryItems = stockForm.category
    ? items.filter((item) => item.category === stockForm.category)
    : [];

  const handleAddStock = async () => {
    setSavingStock(true);
    startLoading();
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

      const formData = new FormData();
      formData.append("name", selectedItem.name);
      formData.append("unit", selectedItem.unit);
      formData.append("category", selectedItem.category);
      formData.append("price", selectedItem.price);
      formData.append("stock_quantity", newStock);
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
    } finally {
      setSavingStock(false);
      stopLoading();
    }
  };

  // ---------------- FILTER + SORT FOR DISPLAY ----------------

  const displayItems = [...items]
    .filter((item) => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        String(item.item_id).includes(q) ||
        item.name.toLowerCase().includes(q) ||
        (item.category || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const aLow = isLowStock(a);
      const bLow = isLowStock(b);

      if (aLow && !bLow) return -1;
      if (!aLow && bLow) return 1;

      if (aLow && bLow) {
        return a.name.localeCompare(b.name);
      }

      return a.name.localeCompare(b.name);
    });

  // ---------------- RENDER ----------------

  const showSkeleton = loadingItems || loadingForecasts;

  const renderSkeletonRows = () =>
    Array.from({ length: 6 }).map((_, idx) => (
      <div key={idx} className="skeleton skeleton-table-row" />
    ));

  return (
    <div className="inventory-page">
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

      <div className="inventory-table-card">
        <div className="inventory-table-scroll">
          {showSkeleton ? (
            <div style={{ padding: "12px" }}>{renderSkeletonRows()}</div>
          ) : (
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
                      <td>{dynamicLevel}</td>
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
                          className={`table-btn edit-btn ${
                            savingItem ? "busy" : ""
                          }`}
                          onClick={() => openEditModal(item)}
                          disabled={savingItem}
                        >
                          Edit
                        </button>
                        <button
                          className={`table-btn delete-btn ${
                            deletingId === item.item_id ? "busy" : ""
                          }`}
                          onClick={() => handleDelete(item.item_id)}
                          disabled={deletingId === item.item_id}
                        >
                          {deletingId === item.item_id ? "Deleting…" : "Delete"}
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
          )}
        </div>
      </div>

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
              onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
            />

            <input
              type="text"
              placeholder="Unit"
              value={newItem.type}
              onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
            />

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
              onChange={(e) => setNewItem({ ...newItem, stock: e.target.value })}
            />

            <div className="modal-buttons">
              <button
                className={`btn btn-primary ${savingItem ? "busy" : ""}`}
                onClick={handleSave}
                disabled={savingItem}
              >
                {savingItem ? "Saving…" : "Save"}
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setShowModal(false)}
                disabled={savingItem}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddStockModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Add Stock</h3>

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

            <select
              value={stockForm.itemId}
              onChange={(e) => setStockForm({ ...stockForm, itemId: e.target.value })}
              disabled={!stockForm.category}
            >
              <option value="">Select Item</option>
              {stockCategoryItems.map((item) => (
                <option key={item.item_id} value={item.item_id}>
                  {item.name}
                </option>
              ))}
            </select>

            <input
              type="number"
              placeholder="Add Stock Amount"
              value={stockForm.amount}
              onChange={(e) => setStockForm({ ...stockForm, amount: e.target.value })}
            />

            <div className="modal-buttons">
              <button
                className={`btn btn-primary ${savingStock ? "busy" : ""}`}
                onClick={handleAddStock}
                disabled={savingStock}
              >
                {savingStock ? "Updating…" : "Save"}
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setShowAddStockModal(false)}
                disabled={savingStock}
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
