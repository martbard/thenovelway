// src/api.js
import axios from 'axios';

function trimSlash(s) {
  return String(s || '').replace(/\/+$/, '');
}

const BASE_URL = (() => {
  const env = trimSlash(process.env.REACT_APP_API_BASE_URL || '');
  if (env) return env;
  if (typeof window !== 'undefined') {
    const { hostname, port } = window.location;
    const isLocalDev = (hostname === 'localhost' || hostname === '127.0.0.1') && port === '3000';
    if (isLocalDev) return 'http://127.0.0.1:8000/api';
    return `${window.location.origin}/api`;
  }
  return 'http://127.0.0.1:8000/api';
})();

const API = axios.create({
  // ensure baseURL ends with a single slash
  baseURL: `${trimSlash(BASE_URL)}/`,
  withCredentials: false,
});

// Always: no leading slash, yes trailing slash
API.interceptors.request.use((config) => {
  let url = String(config.url || '');
  // strip any leading slash so baseURL isn't ignored
  url = url.replace(/^\/+/, '');
  // add trailing slash if there is no querystring
  if (url && !url.endsWith('/') && !url.includes('?')) {
    url = `${url}/`;
  }
  config.url = url;

  const token = localStorage.getItem('access');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ----- Refresh token on 401 -----
let isRefreshing = false;
let queue = [];
function processQueue(error, token = null) {
  queue.forEach(({ resolve, reject }) => (token ? resolve(token) : reject(error)));
  queue = [];
}

API.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err?.config;
    const status = err?.response?.status;

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
        const { data } = await axios.post(`${trimSlash(BASE_URL)}/token/refresh/`, { refresh });
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

// Normalize array vs. {results: [...]}
export function unwrapList(data) {
  return Array.isArray(data) ? data : (data?.results || []);
}

export default API;
