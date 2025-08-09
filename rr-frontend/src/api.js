// src/api.js
import axios from 'axios';

const BASE_URL =
  process.env.REACT_APP_API_BASE_URL?.replace(/\/+$/, '') ||
  'http://127.0.0.1:8000/api';

const API = axios.create({
  baseURL: `${BASE_URL}/`,
  withCredentials: false,
});

// Attach access token on every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('access');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---- Refresh handling with endpoint fallback ----
let isRefreshing = false;
let failedQueue = [];
const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => {
    if (token) p.resolve(p.config);
    else p.reject(error);
  });
  failedQueue = [];
};

async function refreshAccessToken() {
  const refresh = localStorage.getItem('refresh');
  if (!refresh) throw new Error('Missing refresh token');

  // Try SimpleJWT default first, then Djoser-style
  try {
    const r1 = await axios.post(`${BASE_URL}/token/refresh/`, { refresh });
    return r1.data?.access;
  } catch (e1) {
    if (e1?.response?.status !== 404) throw e1;
    const r2 = await axios.post(`${BASE_URL}/auth/jwt/refresh/`, { refresh });
    return r2.data?.access;
  }
}

API.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config || {};
    const status = err?.response?.status;

    if (status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, config: original });
        }).then((cfg) => API(cfg));
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const access = await refreshAccessToken();
        if (!access) throw new Error('No access token from refresh');
        localStorage.setItem('access', access);
        original.headers = { ...(original.headers || {}), Authorization: `Bearer ${access}` };
        processQueue(null, access);
        return API(original);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(err);
  }
);

export default API;
