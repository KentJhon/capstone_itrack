// Central API base. Prefer Vite env (VITE_API_BASE_URL) or CRA-style REACT_APP_API_BASE, fallback to localhost.
const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  process.env.REACT_APP_API_BASE ||
  "http://localhost:8000";

export default API_BASE_URL;
