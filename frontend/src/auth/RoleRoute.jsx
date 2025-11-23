import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./useAuth";

export default function RoleRoute({ allowed }) {
  const { role, loading } = useAuth();
  if (loading) return null;
  const ok = role && allowed.map(r => r.toLowerCase()).includes(role);
  return ok ? <Outlet /> : <Navigate to="/forbidden" replace />;
}
