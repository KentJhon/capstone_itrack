// src/components/AccountManagement.jsx
import React, { useEffect, useState } from "react";
import "../views/style/AccountManagement.css";
import notify from "../utils/notify";
import confirmAction from "../utils/confirm";
import api from "../auth/api";

export default function AccountManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  // Add-user modal
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirm: "",
    role: "",
  });
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null,
    username: "",
    email: "",
    role: "",
    password: "",
  });
  const [editing, setEditing] = useState(false);

  const ROLE_IDS = { Admin: 1, Staff: 2, "Enterprise Division": 3 };

  const mapUser = (u) => ({
    id: u.user_id ?? u.id,
    name: u.full_name ?? u.username ?? u.name,
    email: u.email,
    role: u.role_name ?? u.role,
  });

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/users");
      setUsers(Array.isArray(data) ? data.map(mapUser) : []);
    } catch (err) {
      console.error(err);
      const msg = String(err.message || err);
      setError(msg);
      notify.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Open Edit modal with prefilled values
  const openEdit = (user) => {
    setEditForm({
      id: user.id,
      username: user.name || "",
      email: user.email || "",
      role: user.role || "",
      password: "", // blank = keep unchanged
    });
    setEditOpen(true);
  };

  // Submit Edit
  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editForm.id) return;

    setEditing(true);
    try {
      const payload = {
        username: editForm.username?.trim() || undefined,
        email: editForm.email || undefined,
        role: editForm.role || undefined,
        roles_id: ROLE_IDS[editForm.role] || undefined,
      };
      if (editForm.password && editForm.password.length > 0) {
        if (editForm.password.length < 6) {
          const msg = "Password must be at least 6 characters";
          notify.error(msg);
          setEditing(false);
          return;
        }
        payload.password = editForm.password;
      }

      await api.put(`/users/${encodeURIComponent(editForm.id)}`, payload);

      await fetchUsers();
      setEditOpen(false);
      notify.success("User updated");
    } catch (err) {
      console.error(err);
      const msg = String(err.message || err);
      notify.error(msg);
    } finally {
      setEditing(false);
    }
  };

  // SweetAlert-style delete handler
  const handleDelete = async (user) => {
    const ok = await confirmAction(
      `Are you sure you want to delete ${user.name}?`
    );
    if (!ok) return;

    setBusyId(user.id);
    const prev = users.slice();

    // Optimistic UI: remove from list immediately
    setUsers((p) => p.filter((u) => u.id !== user.id));

    try {
      await api.delete(`/users/${encodeURIComponent(user.id)}`);

      notify.success(`Deleted ${user.name}`);
    } catch (err) {
      console.error(err);
      setUsers(prev); // rollback
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to delete user. Please try again.";
      notify.error(String(msg));
    } finally {
      setBusyId(null);
    }
  };

  // ---- Add User modal helpers ----
  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const validateForm = () => {
    if (!form.username.trim()) return "Username is required";
    if (!form.email.includes("@")) return "Email must contain '@'";
    if (form.password.length < 6)
      return "Password must be at least 6 characters";
    if (form.password !== form.confirm) return "Passwords do not match";
    if (!form.role) return "Please select a role";
    return "";
  };

  const submitNewUser = async (e) => {
    e.preventDefault();

    const v = validateForm();
    if (v) {
      setFormError(v);
      notify.error(v);
      return;
    }

    setCreating(true);
    setFormError("");

    try {
      const roleClean = (form.role || "").trim();
      const rolesId = ROLE_IDS[roleClean];

      const fd = new FormData();
      fd.append("username", form.username);
      fd.append("email", form.email);
      fd.append("password", form.password);
      fd.append("role", roleClean);
      fd.append("roles_id", String(rolesId));

      await api.post("/register", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      await fetchUsers();
      setOpen(false);
      setForm({ username: "", email: "", password: "", confirm: "", role: "" });
      notify.success("User created");
    } catch (err) {
      console.error(err);
      const msg = String(err.message || err);
      setFormError(msg);
      notify.error(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="account-page">
      <h1 className="account-title">Account Management</h1>

      <div className="account-container">
        <div className="account-header">
          <h2>Users</h2>
          <button className="btn btn-add" onClick={() => setOpen(true)}>
            + Add User
          </button>
        </div>

        {loading && <div className="muted">Loading users...</div>}
        {error && <div className="error-text">{error}</div>}

        {!loading && !error && (
          <div className="account-table-wrap">
            <table className="account-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Current Role</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.role || "—"}</td>
                    <td>
                      <button
                        className="btn btn-update"
                        onClick={() => openEdit(u)}
                        disabled={busyId === u.id}
                      >
                        Edit
                      </button>
                      &nbsp;
                      {u.role !== "Admin" && (
                        <button
                          className="btn btn-delete"
                          onClick={() => handleDelete(u)}
                          disabled={busyId === u.id}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      <div
        className={`overlay ${open ? "is-open" : ""}`}
        onClick={() => {
          if (!creating) setOpen(false); // don't close while creating
        }}
      >
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>New User</h3>
          </div>

          <form onSubmit={submitNewUser}>
            <div className="form-row">
              <label>Username</label>
              <input
                className="input"
                name="username"
                value={form.username}
                onChange={onChange}
                placeholder="e.g. jcruz"
              />
            </div>

            <div className="form-row">
              <label>Email</label>
              <input
                className="input"
                name="email"
                type="email"
                value={form.email}
                onChange={onChange}
                placeholder="name@domain.com"
              />
            </div>

            <div className="form-row">
              <label>Password</label>
              <input
                className="input"
                name="password"
                type="password"
                value={form.password}
                onChange={onChange}
              />
            </div>

            <div className="form-row">
              <label>Confirm Password</label>
              <input
                className="input"
                name="confirm"
                type="password"
                value={form.confirm}
                onChange={onChange}
              />
            </div>

            <div className="form-row">
              <label>Role</label>
              <select
                className="select"
                name="role"
                value={form.role}
                onChange={onChange}
              >
                <option value="" disabled>
                  Select role…
                </option>
                <option value="Admin">Admin</option>
                <option value="Staff">Staff</option>
                <option value="Enterprise Division">Enterprise</option>
              </select>
            </div>

            {formError && <div className="form-error">{formError}</div>}

            <div className="actions">
              <button
                type="button"
                className="btn btn-cancel"
                onClick={() => setOpen(false)}
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={creating}
              >
                {creating ? "Creating…" : "Create User"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Edit User Modal */}
      <div
        className={`overlay ${editOpen ? "is-open" : ""}`}
        onClick={() => {
          if (!editing) setEditOpen(false);
        }}
      >
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Edit User</h3>
          </div>

          <form onSubmit={submitEdit}>
            <div className="form-row">
              <label>Username</label>
              <input
                className="input"
                name="username"
                value={editForm.username}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, username: e.target.value }))
                }
              />
            </div>

            <div className="form-row">
              <label>Email</label>
              <input
                className="input"
                name="email"
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>

            <div className="form-row">
              <label>Role</label>
              <select
                className="select"
                name="role"
                value={editForm.role}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, role: e.target.value }))
                }
              >
                <option value="" disabled>
                  Select role…
                </option>
                <option value="Admin">Admin</option>
                <option value="Staff">Staff</option>
                <option value="Enterprise_Division">Enterprise</option>
              </select>
            </div>

            <div className="form-row">
              <label>New Password</label>
              <input
                className="input"
                name="password"
                type="password"
                value={editForm.password}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, password: e.target.value }))
                }
                placeholder="Leave blank to keep current password"
              />
            </div>

            <div className="actions">
              <button
                type="button"
                className="btn btn-cancel"
                onClick={() => setEditOpen(false)}
                disabled={editing}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={editing}
              >
                {editing ? "Updating…" : "Update"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
