import React from "react";
import { Link } from "react-router-dom";
import { RxDashboard } from "react-icons/rx";
import { FaBoxArchive, FaBoxOpen } from "react-icons/fa6";
import { BiQrScan } from "react-icons/bi";
import { AiOutlineTransaction } from "react-icons/ai";
import { MdOutlineArrowCircleLeft, MdOutlineArrowCircleRight } from "react-icons/md";

import "../App.css";

function SideBar({ isOpen, toggleSidebar }) {
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
          <li><Link to="/"><RxDashboard /> Dashboard</Link></li>
          <li><Link to="/inventory"><FaBoxOpen /> Inventory</Link></li>
          <li><Link to="/orderslip"><BiQrScan /> Order Slip</Link></li>
          <li><Link to="/stockcard"><FaBoxArchive /> Stock Card</Link></li>
          <li><Link to="/transaction"><AiOutlineTransaction /> Transaction</Link></li>
        </ul>
      )}
    </div>
  );
}

export default SideBar;
