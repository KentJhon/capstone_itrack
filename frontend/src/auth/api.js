// frontend/src/auth/api.js
import axios from "axios";

import API_BASE_URL from "../config";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // ✅ send/receive cookies
});

// simple refresh-once interceptor
let isRefreshing = false;
let pending = [];

function onRefreshed() {
  pending.forEach((cb) => cb());
  pending = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error?.response?.status;

    // If unauthorized & we haven't retried this request yet
    if (status === 401 && !original._retry) {
      // Queue requests while a refresh is in-flight
      if (isRefreshing) {
        await new Promise((resolve) => pending.push(resolve));
        original._retry = true;
        return api(original);
      }

      try {
        isRefreshing = true;
        // 🔁 only call /refresh here
        await axios.post(`${API_BASE_URL}/refresh`, null, {
          withCredentials: true,
        });

        onRefreshed();
        original._retry = true;
        return api(original);
      } catch (e) {
        // refresh failed -> bubble up; UI should redirect to /login
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

