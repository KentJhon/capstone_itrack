import React, { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import "./App.css";

import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import Footer from "./components/Footer";
import { AuthProvider, useAuth } from "./auth/useAuth";

// Pages
import Login from "./views/Login";
import Dashboard from "./views/Dashboard";
import Inventory from "./views/Inventory";
import StockCard from "./views/StockCard";
import OrderSlip from "./views/OrderSlip/OrderSlip";
import Transaction from "./views/Transaction";
import Predictive from "./views/Predictive";
import ActivityLog from "./views/ActivityLog";
import AccountManagement from "./views/AccountManagement";
import MonthlyReport from "./views/MonthlyReport";
import JobOrder from "./views/JobOrder/JobOrder";
import JobOrderTransactions from "./views/JobOrder/JobOrderTransactions";
import JobOrderInventory from "./views/JobOrder/JobOrderInventory";

function ProtectedLayout({ sidebarOpen, toggleSidebar }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="overall">
      <Header />
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
      <div className={`main ${sidebarOpen ? "with-sidebar" : "full"}`}>
        <Routes>
          {/* Shared pages (visible to all) */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/stockcard" element={<StockCard />} />
          <Route path="/transaction" element={<Transaction />} />
          <Route path="/joborder" element={<JobOrder />} />
          <Route
            path="/job-orders/transactions"
            element={<JobOrderTransactions />}
          />
          <Route path="/job-orders/inventory" element={<JobOrderInventory />} />
          <Route path="/predictive" element={<Predictive />} />
          <Route path="/monthly" element={<MonthlyReport />} />

          {/* Admin-only */}
          {user.role === "Admin" && (
            <>
              <Route path="/orderslip" element={<OrderSlip />} />
              <Route path="/activitylog" element={<ActivityLog />} />
              <Route
                path="/accountmanagement"
                element={<AccountManagement />}
              />
            </>
          )}

          {/* Staff-only */}
          {user.role === "Staff" && (
            <>
              <Route path="/orderslip" element={<OrderSlip />} />
            </>
          )}

          {/* Enterprise-only */}
          {user.role === "Enterprise_Division" && (
            <>
              <Route path="/activitylog" element={<ActivityLog />} />
            </>
          )}

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedLayout
                sidebarOpen={sidebarOpen}
                toggleSidebar={toggleSidebar}
              />
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
