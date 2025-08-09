// src/NavBar.js
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import API from './api';

function decodeUsernameFromJWT(token) {
  if (!token) return null;
  try {
    const p = jwtDecode(token);
    return (
      p?.username ||
      p?.user ||
      p?.name ||
      (p?.email ? String(p.email).split('@')[0] : null) ||
      null
    );
  } catch {
    return null;
  }
}

async function probeWhoAmI() {
  const candidates = ['me/', 'auth/users/me/', 'users/me/', 'profile/', 'whoami/'];
  for (const path of candidates) {
    try {
      const { data } = await API.get(path);
      const name = data?.username || data?.user || data?.name || data?.email || null;
      if (name) return String(name);
    } catch {}
  }
  return null;
}

export default function NavBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [username, setUsername] = useState(null);
  const token = localStorage.getItem('access');
  const isLoggedIn = Boolean(token);

  useEffect(() => {
    if (!isLoggedIn) { setUsername(null); return; }
    const decoded = decodeUsernameFromJWT(token);
    if (decoded) { setUsername(decoded); return; }
    (async () => {
      const name = await probeWhoAmI();
      setUsername(name || null);
    })();
  }, [isLoggedIn, token]);

  const isActive = (path) => (pathname === path || pathname.startsWith(path)) ? 'active' : '';

  const logout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    setUsername(null);
    navigate('/login');
  };

  const initials = username ? username[0]?.toUpperCase() : '✓';

  return (
    <header className="navbar">
      <nav className="container nav-center" aria-label="Primary">
        <Link to="/" style={{ fontWeight: 900, fontSize: '1.3rem', letterSpacing: '.3px', color: 'var(--text)' }}>
          The Novel Way
        </Link>
        <div className="nav-links" style={{ alignItems: 'center', gap: '1rem' }}>
          <Link to="/stories" className={isActive('/stories')}>Stories</Link>
          {isLoggedIn && <Link to="/my" className={isActive('/my')}>My Stories</Link>}
          <Link to="/stories/new" className={isActive('/stories/new')}>New Story</Link>

          {!isLoggedIn ? (
            <>
              <Link to="/login" className={isActive('/login')}>Log In</Link>
              <Link to="/register" className={isActive('/register')}>Register</Link>
            </>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem' }}>
              <span className="avatar" title={username || 'Signed in'}>{initials}</span>
              <span className="muted" style={{ fontWeight: 700 }}>
                {username ? `Signed in as ${username}` : 'Signed in'}
              </span>
              <button className="btn ghost" onClick={logout} title="Log out">Log out</button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
