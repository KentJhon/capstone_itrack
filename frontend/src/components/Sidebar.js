import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { RxDashboard } from "react-icons/rx";
import { FaBoxArchive, FaBoxOpen } from "react-icons/fa6";
import { FaSignOutAlt } from "react-icons/fa";
import { BiQrScan } from "react-icons/bi";
import { AiOutlineTransaction } from "react-icons/ai";
import { RiAccountBoxFill } from "react-icons/ri";
import { FaBloggerB } from "react-icons/fa";
import { TbAnalyze } from "react-icons/tb";
import { HiOutlineDocumentReport } from "react-icons/hi";
import { MdOutlineArrowCircleLeft, MdOutlineArrowCircleRight } from "react-icons/md";
import { MdAssignment } from "react-icons/md";
import "./SideBar.css";
import { useAuth } from "../auth/useAuth";
import notify from "../utils/notify";
import confirmAction from "../utils/confirm";

function SideBar({ isOpen, toggleSidebar }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;
  const role = user.role;

  const baseLinks = [
    { to: "/dashboard", icon: <RxDashboard />, label: "Dashboard" },
    { to: "/inventory", icon: <FaBoxOpen />, label: "Inventory" },
  ];

  const commonLinks = [
    { to: "/stockcard", icon: <FaBoxArchive />, label: "Stock Card" },
    { to: "/transaction", icon: <AiOutlineTransaction />, label: "Transaction" },
    { to: "/joborder", icon: <MdAssignment />, label: "Job Orders" },
    { to: "/monthly", icon: <HiOutlineDocumentReport />, label: "Monthly Reports" },
    { to: "/predictive", icon: <TbAnalyze />, label: "Predictive Restock" },
  ];

  const orderSlipLink = { to: "/orderslip", icon: <BiQrScan />, label: "Order Slip" };

  const roleLinks = {
    Admin: [
      ...baseLinks,
      orderSlipLink,
      ...commonLinks,
      { to: "/activitylog", icon: <FaBloggerB />, label: "Activity Log" },
      { to: "/accountmanagement", icon: <RiAccountBoxFill />, label: "Account Management" },
    ],
    Staff: [
      ...baseLinks,
      orderSlipLink,
      ...commonLinks,
    ],
    Enterprise_Division: [
      ...baseLinks,
      ...commonLinks,
      { to: "/activitylog", icon: <FaBloggerB />, label: "Activity Log" },
    ],
  };

  const menu = roleLinks[role] || baseLinks;

  const handleLogout = async () => {
    const ok = await confirmAction("Do you want to logout?");
    if (!ok) return;
    try {
      await logout();
      notify.success("Logged out");
      navigate("/login", { replace: true });
    } catch (e) {
      notify.error("Logout failed");
    }
  };

  return (
    <div id="sidebar" className={isOpen ? "open" : "closed"}>
      <div className="sidebar-title">
        {isOpen && <span>iTrack</span>}
        <span className="arrow" onClick={toggleSidebar}>
          {isOpen ? <MdOutlineArrowCircleLeft /> : <MdOutlineArrowCircleRight />}
        </span>
      </div>

      {isOpen && (
        <ul>
          {menu.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                className={({ isActive }) => `menu-link ${isActive ? "active" : ""}`}
              >
                {link.icon} {link.label}
              </NavLink>
            </li>
          ))}

          <li>
            <button type="button" className="menu-link" onClick={handleLogout}>
              <FaSignOutAlt /> Logout {/* ✅ replaced icon here */}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

export default SideBar; 
