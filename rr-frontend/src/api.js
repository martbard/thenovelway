// src/api.js
import axios from 'axios';

function trimSlash(s) {
  return String(s || '').replace(/\/+$/, '');
}

// Figure out the API base URL.
// In production, set REACT_APP_API_BASE_URL, e.g. https://your-api.onrender.com/api
const BASE_URL = (() => {
  const env = trimSlash(process.env.REACT_APP_API_BASE_URL || '');
  if (env) return env;
  if (typeof window !== 'undefined') {
    const guess = trimSlash(`${window.location.origin}/api`);
    // Helpful warning in dev/prod if env isn’t set
    // eslint-disable-next-line no-console
    console.warn(`[api] REACT_APP_API_BASE_URL not set. Guessing: ${guess}`);
    return guess;
  }
  return 'http://127.0.0.1:8000/api';
})();

const API = axios.create({
  baseURL: `${BASE_URL}/`,
  withCredentials: false,
});

// Attach JWT on every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('access');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ----- Refresh token on 401 -----
let isRefreshing = false;
let queue = [];

function processQueue(error, token = null) {
  queue.forEach(({ resolve, reject }) => {
    if (token) {
      resolve(token);
    } else {
      reject(error);
    }
  });
  queue = [];
}

API.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err?.config;
    const status = err?.response?.status;

    // If unauthorized and we have a refresh token, try to refresh once
    if (status === 401 && !original?._retry) {
      const refresh = localStorage.getItem('refresh');
      if (!refresh) return Promise.reject(err);

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({
            resolve: (token) => {
              original.headers.Authorization = `Bearer ${token}`;
              resolve(API(original));
            },
            reject,
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${BASE_URL}/token/refresh/`, { refresh });
        const newAccess = data?.access;
        if (!newAccess) throw new Error('No access token returned from refresh');

        localStorage.setItem('access', newAccess);
        processQueue(null, newAccess);

        original.headers.Authorization = `Bearer ${newAccess}`;
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

// Small helper to normalize paginated/non-paginated shapes
export function unwrapList(data) {
  return Array.isArray(data) ? data : (data?.results || []);
}

export default API;
