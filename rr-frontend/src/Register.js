// src/Register.js
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from './api';

export default function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await API.post('register/', { username, email, password });
      if (data?.access) localStorage.setItem('access', data.access);
      if (data?.refresh) localStorage.setItem('refresh', data.refresh);
      navigate('/my');
    } catch (err) {
      setError('Could not register. Try a different username or check password length (min 8).');
    }
  };

  return (
    <section className="container" style={{ maxWidth: 520 }}>
      <div className="surface" style={{ padding: '1.25rem' }}>
        <h1>Create an account</h1>
        <p className="muted">Pick a username, add your email, and set a password.</p>
        {error && <p style={{ color: 'crimson', marginTop: '.5rem' }}>{error}</p>}

        <form onSubmit={submit} style={{ display: 'grid', gap: '.9rem', marginTop: '.75rem' }}>
          <label className="label" htmlFor="user">Username</label>
          <input id="user" className="input" value={username} onChange={(e) => setUsername(e.target.value)} required />

          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />

          <label className="label" htmlFor="pass">Password</label>
          <input id="pass" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />

          <button className="btn">Register</button>
        </form>
      </div>
    </section>
  );
}
