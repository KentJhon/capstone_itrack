// frontend/src/components/Header.js
import React, { useEffect, useRef, useState } from "react";
import logo from "../assets/logo.png";
import { MdAccountCircle } from "react-icons/md";
import "../components/Components.css";
import { useAuth } from "../auth/useAuth";
import notify from "../utils/notify";
import confirmAction from "../utils/confirm";

function Header() {
  const [showLogout, setShowLogout] = useState(false);
  const headerRef = useRef(null);
  const { logout, user } = useAuth();

  const toggle = () => setShowLogout((s) => !s);
  const close = () => setShowLogout(false);

  useEffect(() => {
    const onDocClick = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target)) close();
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const handleLogout = async () => {
    const ok = await confirmAction("Do you want to logout?");
    if (!ok) return;
    try {
      await logout();
      notify.success("Logged out");
    } catch (err) {
      notify.error("Logout failed");
      return;
    }
    window.location.href = "/login";
  };

  return (
    <div id="header" ref={headerRef}>
      {/* Brand */}
      <div className="brand">
        <img src={logo} alt="USTP Logo" className="logo" />
        <h1>University of Science and Technology of Southern Philippines</h1>
      </div>

      {/* Account icon */}
      <div className="account-area">
        <MdAccountCircle
          id="accountLogo"
          className="account-icon"
          title={
            user
              ? `Logged in as ${user.role}`
              : "Account"
          }
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={showLogout}
        />

        {/* Dropdown */}
        {showLogout && (
          <div className="logout-popup" role="menu">
            <div className="user-info">
              {/* Display the name properly */}
              <p className="user-name">
                {user?.name || user?.username || user?.email || "User"}
              </p>
              <p className="user-role">{user?.role}</p>
            </div>

            <button onClick={handleLogout} role="menuitem">
              Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Header;
