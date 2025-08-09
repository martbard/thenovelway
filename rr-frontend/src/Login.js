// src/Login.js
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from './api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const navigate = useNavigate();

  async function loginWithFallback(creds) {
    // Try SimpleJWT: /token/
    try {
      return await API.post('token/', creds);
    } catch (e1) {
      if (e1?.response?.status !== 404) throw e1;
      // Try Djoser-style: /auth/jwt/create/
      return await API.post('auth/jwt/create/', creds);
    }
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await loginWithFallback({ username, password });
      const { access, refresh } = res.data || {};
      if (!access) throw new Error('No access token in response');
      localStorage.setItem('access', access);
      if (refresh) localStorage.setItem('refresh', refresh);
      navigate('/');
    } catch (err) {
      setError('Invalid username or password, or login endpoint not configured.');
    }
  };

  return (
    <section className="container" style={{ maxWidth: 440 }}>
      <div className="surface" style={{ padding: '1.25rem' }}>
        <h1>Log in</h1>
        <p className="muted">Welcome back.</p>
        {error && <p style={{ color: 'crimson', marginTop: '.5rem' }}>{error}</p>}

        <form onSubmit={submit} style={{ display: 'grid', gap: '.9rem', marginTop: '.75rem' }}>
          <label className="label" htmlFor="user">Username</label>
          <input id="user" className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />

          <label className="label" htmlFor="pass">Password</label>
          <input id="pass" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />

          <button className="btn">Log In</button>
        </form>
      </div>
    </section>
  );
}
