// frontend/src/auth/useAuth.js
import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "./api";
import notify from "../utils/notify";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { id, role, username, name, email }
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  async function fetchSession() {
    try {
      const res = await api.get("/me");
      const data = res.data || {};
      const name = data.name || data.username || data.email || "User";
      const username = data.username || data.name || data.email || "User";
      // Store full user payload so UI (e.g., header) can show name/username
      setUser({
        id: data.id ?? data.sub,
        role: data.role,
        name,
        username,
        email: data.email,
      });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSession();
  }, []);

  useEffect(() => {
    if (!loading && user && location.pathname === "/login") {
      navigate("/dashboard", { replace: true });
    }
  }, [user, loading, location.pathname, navigate]);

  useEffect(() => {
    if (!loading && !user && location.pathname !== "/login") {
      navigate("/login", { replace: true });
    }
  }, [user, loading, location.pathname, navigate]);

  const value = {
    user,
    role: user?.role,
    loading,
    refresh: fetchSession,
    logout: async () => {
      try {
        await api.post("/logout");
      } catch (err) {
        notify.error("Logout failed");
      } finally {
        setUser(null);
        navigate("/login", { replace: true });
      }
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
