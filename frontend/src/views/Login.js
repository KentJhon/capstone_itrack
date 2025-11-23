// frontend/src/views/Login.js
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FaUser, FaLock, FaArrowRight } from "react-icons/fa";
import "./style/Login.css";
import logo from "../assets/logo.png";
import api from "../auth/api";
import { useAuth } from "../auth/useAuth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const navigate = useNavigate();
  const { refresh } = useAuth(); // ✅ to refresh context after login
 
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    try {
      const formData = new FormData();
      formData.append("username", email);
      formData.append("password", password);

      // 🔹 1) Login (sets HTTP-only cookies)
      await api.post("/login", formData);

      // 🔹 2) Refresh auth context (fetch /me)
      await refresh();

      // 🔹 3) Go to dashboard
      navigate("/dashboard", { replace: true });
    } catch (ex) {
      console.error(ex);
      setErr(ex?.response?.data?.detail || ex.message || "Login failed");
    }
  };

  return (
    <div className="login-container">
      <div className="login-header">
        <img src={logo} alt="iTrack Logo" />
        <h1>iTrack</h1>
      </div>

      <div className="login-box">
        <h2>Login to your account</h2>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <FaUser style={{ color: "gray" }} />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <FaLock style={{ color: "gray" }} />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit">
            <span>Login</span>
            <FaArrowRight />
          </button>

          {err && <p style={{ color: "crimson", marginTop: 8 }}>{err}</p>}
        </form>

        
      </div>
    </div>
  );
}
