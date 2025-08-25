// src/Register.js
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from './api';

export default function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // IMPORTANT: trailing slash so Django/DRF doesn’t redirect a POST
      const { data } = await API.post('register/', {
        username: username.trim(),
        email: email.trim(),
        password,
      });

      // Auto-login: backend returns tokens on successful registration
      const { access, refresh } = data || {};
      if (access) localStorage.setItem('access', access);
      if (refresh) localStorage.setItem('refresh', refresh);

      navigate('/');
    } catch (err) {
      // Try to surface field-level validation messages
      const res = err?.response;
      if (res?.data) {
        const parts = [];
        for (const [k, v] of Object.entries(res.data)) {
          if (Array.isArray(v)) parts.push(`${k}: ${v.join(' ')}`);
          else if (typeof v === 'string') parts.push(`${k}: ${v}`);
        }
        setError(parts.join(' | ') || 'Registration failed.');
      } else {
        setError('Registration failed. Check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="container" style={{ maxWidth: 520 }}>
      <h1 style={{ margin: '1.2rem 0' }}>Create your account</h1>
      {error ? (
        <div role="alert" className="card" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
          {error}
        </div>
      ) : null}

      <form onSubmit={submit} className="card" style={{ display: 'grid', gap: '.75rem', padding: '1rem' }}>
        <label htmlFor="user" className="label">Username</label>
        <input id="user" className="input" value={username} onChange={(e) => setUsername(e.target.value)} required />

        <label htmlFor="email" className="label">Email (optional)</label>
        <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />

        <label htmlFor="pass" className="label">Password</label>
        <input
          id="pass"
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />

        <button className="btn" disabled={loading}>{loading ? 'Creating…' : 'Register'}</button>
      </form>
    </section>
  );
}
