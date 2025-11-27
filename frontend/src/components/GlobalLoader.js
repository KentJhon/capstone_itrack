import React from "react";
import { useGlobalLoading } from "../loading/LoadingContext";
import "./Components.css";

export default function GlobalLoader() {
  const { isLoading } = useGlobalLoading();

  if (!isLoading) return null;

  return (
    <div className="global-loader-overlay" role="status" aria-label="Loading">
      <div className="global-loader-card">
        <div className="loader-spinner" />
        <p>Loading, please wait…</p>
      </div>
    </div>
  );
}
