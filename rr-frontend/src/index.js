// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));

// Default dark mode ON (can be toggled later if you add a switch)
if (localStorage.getItem('theme-dark') == null) {
  localStorage.setItem('theme-dark', 'true');
}
document.documentElement.classList.toggle('dark', localStorage.getItem('theme-dark') === 'true');
// Cozy style is default
document.documentElement.dataset.theme = 'cozy';

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();
