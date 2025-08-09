// src/MyStories.js
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from './api';

export default function MyStories() {
  const navigate = useNavigate();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    API.get('stories/mine/')
      .then((res) => setStories(res.data || []))
      .catch(() => setStories([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const del = async (id) => {
    const ok = window.confirm('Delete this story? This cannot be undone.');
    if (!ok) return;
    try {
      await API.delete(`stories/${id}/`);
      load();
    } catch {
      alert('Could not delete story. You may not have permission.');
    }
  };

  return (
    <section className="container">
      <header className="surface" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>My Stories</h1>
          <p className="muted">Create, edit, and manage your stories.</p>
        </div>
        <button className="btn" onClick={() => navigate('/stories/new')}>New Story</button>
      </header>

      {loading ? (
        <p className="muted" style={{ marginTop: '1rem' }}>Loading…</p>
      ) : !stories.length ? (
        <p className="muted" style={{ marginTop: '1rem' }}>You have no stories yet. Start by creating one.</p>
      ) : (
        <ul className="grid cards" style={{ marginTop: '1rem' }}>
          {stories.map((s) => (
            <li key={s.id} className="card">
              <h3>{s.title}</h3>
              <p className="muted">{s.summary || 'No summary yet.'}</p>
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.5rem' }}>
                {(s.tags || []).map((t) => <span key={t.id || t} className="badge">{t.name || t}</span>)}
              </div>
              <div style={{ display: 'flex', gap: '.5rem', marginTop: '.75rem' }}>
                <button className="btn" onClick={() => navigate(`/stories/${s.id}`)}>Open</button>
                <button className="btn ghost" onClick={() => navigate(`/stories/${s.id}/edit`)}>Edit</button>
                <button className="btn" onClick={() => del(s.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
