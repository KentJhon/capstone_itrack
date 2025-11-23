import React, { useState, useEffect } from "react";
import api from "../../auth/api";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import notify from "../../utils/notify";
import confirmAction from "../../utils/confirm";
import "../JobOrder/style/JobOrderInventory.css";


// ✅ category is exactly "Souvenir"
const JOB_CATEGORY = "Souvenir";

function JobOrderInventory() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editIndex, setEditIndex] = useState(null);

  const [newItem, setNewItem] = useState({
    name: "",
    price: "",
    type: "",
    stock: "",
  });

  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [stockForm, setStockForm] = useState({
    itemId: "",
    amount: "",
  });

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await api.get("/items");
      const allItems = response.data || [];

      const souvenirItems = allItems.filter(
        (item) => item.category === JOB_CATEGORY
      );

      setItems(souvenirItems);
    } catch (error) {
      console.error("Error fetching items:", error);
    }
  };

  // --- Modals ---
  const openAddModal = () => {
    setEditIndex(null);
    setNewItem({ name: "", price: "", type: "", stock: "" });
    setShowModal(true);
  };

  const openEditModal = (index) => {
    const it = items[index];
    setEditIndex(index);
    setNewItem({
      name: it.name,
      price: it.price,
      type: it.unit,
      stock: it.stock_quantity,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const formData = new FormData();
      formData.append("name", newItem.name);
      formData.append("unit", newItem.type);
      formData.append("category", JOB_CATEGORY); // Souvenir
      formData.append("price", parseFloat(newItem.price));
      formData.append("stock_quantity", parseInt(newItem.stock, 10));
      formData.append("reorder_level", 20);

      if (editIndex !== null) {
        const id = items[editIndex].item_id;
        await api.put(`/items/${id}`, formData);
      } else {
        await api.post("/items", formData);
      }

      setShowModal(false);
      setEditIndex(null);
      fetchItems();
      notify.success(editIndex !== null ? "Item updated" : "Item added");
    } catch (error) {
      console.error("Error saving item:", error);
      notify.error("Failed to save item");
    }
  };

  const handleDelete = async (index) => {
    const id = items[index].item_id;
    const ok = await confirmAction("Are you sure you want to delete this item?");
    if (!ok) return;
    try {
      await api.delete(`/items/${id}`);
      fetchItems();
      notify.success("Item deleted");
    } catch (error) {
      console.error("Error deleting item:", error);
      notify.error("Error deleting item");
    }
  };

  // --- Add Stock ---
  const openAddStockModal = () => {
    setStockForm({ itemId: "", amount: "" });
    setShowAddStockModal(true);
  };

  const handleAddStock = async () => {
    try {
      const { itemId, amount } = stockForm;

      if (!itemId || !amount) {
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
      formData.append("category", JOB_CATEGORY); // Souvenir
      formData.append("price", selectedItem.price);
      formData.append("stock_quantity", newStock);
      formData.append("reorder_level", selectedItem.reorder_level);

      await api.put(`/items/${selectedItem.item_id}`, formData);

      notify.success("Stock successfully updated!");
      setShowAddStockModal(false);
      fetchItems();
    } catch (error) {
      console.error("Error adding stock:", error);
      notify.error("Failed to add stock");
    }
  };

  return (
    <div className="inventory-page">
      {/* Header + actions */}
      <div className="inventory-header">
        <div className="inventory-header-left">
          <button className="back-btn" onClick={() => navigate("/joborder")}>
            <FiArrowLeft className="back-icon" /> Back
          </button>

          <div className="inventory-title-group">
            <h2>Job Order Inventory</h2>
            <p className="inventory-subtitle">
              Manage and monitor Souvenir items.
            </p>
          </div>
        </div>

        <div className="inventory-actions">
          <button className="btn btn-primary" onClick={openAddStockModal}>
            Add Stock
          </button>
          <button className="btn btn-primary" onClick={openAddModal}>
            Add Item
          </button>
        </div>
      </div>

      {/* Floating scrollable card */}
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
                <th>Alert</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item, index) => (
                <tr key={item.item_id}>
                  <td>{item.item_id}</td>
                  <td>{item.name}</td>
                  <td>₱{item.price}</td>
                  <td>{item.unit}</td>
                  <td>{item.category}</td>
                  <td>{item.stock_quantity}</td>
                  <td>{item.reorder_level}</td>

                  <td
                    className={
                      item.stock_quantity > item.reorder_level
                        ? "status-sufficient"
                        : "status-insufficient"
                    }
                  >
                    {item.stock_quantity > item.reorder_level
                      ? "Sufficient"
                      : "Low Stock"}
                  </td>

                  <td className="actions-cell">
                    <button
                      className="table-btn edit-btn"
                      onClick={() => openEditModal(index)}
                    >
                      Edit
                    </button>
                    <button
                      className="table-btn delete-btn"
                      onClick={() => handleDelete(index)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {items.length === 0 && (
                <tr>
                  <td colSpan="9" style={{ textAlign: "center", padding: 24 }}>
                    No Souvenir items found.
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
            <h3>
              {editIndex !== null ? "Edit Souvenir Item" : "Add Souvenir Item"}
            </h3>

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

            <input
              type="text"
              value={JOB_CATEGORY}
              disabled
              style={{ backgroundColor: "#eee", cursor: "not-allowed" }}
            />

            <input
              type="number"
              placeholder="Stock"
              value={newItem.stock}
              onChange={(e) =>
                setNewItem({ ...newItem, stock: e.target.value })
              }
            />

            <div className="modal-buttons">
              <button className="btn btn-save" onClick={handleSave}>
                Save
              </button>

              <button
                className="btn btn-cancel"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Stock Modal */}
      {showAddStockModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Add Stock (Souvenir)</h3>

            <select
              value={stockForm.itemId}
              onChange={(e) =>
                setStockForm({ ...stockForm, itemId: e.target.value })
              }
            >
              <option value="">Select Item</option>

              {items.map((item) => (
                <option key={item.item_id} value={item.item_id}>
                  {item.name}
                </option>
              ))}
            </select>

            <input
              type="number"
              placeholder="Add Stock Amount"
              value={stockForm.amount}
              onChange={(e) =>
                setStockForm({ ...stockForm, amount: e.target.value })
              }
            />

            <div className="modal-buttons">
              <button className="btn btn-save" onClick={handleAddStock}>
                Save
              </button>

              <button
                className="btn btn-cancel"
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

export default JobOrderInventory;



