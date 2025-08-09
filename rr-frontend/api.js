// src/api.js

import axios from 'axios';

// Create an axios instance for our API
const API = axios.create({
  baseURL: 'http://127.0.0.1:8000/api/',
});

// Attach the access token to every request
API.interceptors.request.use(config => {
  const token = localStorage.getItem('access');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, error => Promise.reject(error));

// Handle 401s by attempting token refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

API.interceptors.response.use(
  response => response,
  err => {
    const originalReq = err.config;
    if (err.response && err.response.status === 401 && !originalReq._retry) {
      originalReq._retry = true;
      const refreshToken = localStorage.getItem('refresh');
      if (!refreshToken) {
        return Promise.reject(err);
      }
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
        .then(token => {
          originalReq.headers.Authorization = `Bearer ${token}`;
          return API(originalReq);
        });
      }

      isRefreshing = true;
      return new Promise((resolve, reject) => {
        axios.post('http://127.0.0.1:8000/api/token/refresh/', { refresh: refreshToken })
          .then(({ data }) => {
            localStorage.setItem('access', data.access);
            API.defaults.headers.Authorization = `Bearer ${data.access}`;
            processQueue(null, data.access);
            originalReq.headers.Authorization = `Bearer ${data.access}`;
            resolve(API(originalReq));
          })
          .catch(refreshError => {
            processQueue(refreshError, null);
            reject(refreshError);
          })
          .finally(() => {
            isRefreshing = false;
          });
      });
    }
    return Promise.reject(err);
  }
);

export default API;