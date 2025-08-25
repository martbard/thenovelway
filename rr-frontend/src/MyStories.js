// src/MyStories.js
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API, { unwrapList } from './api';

export default function MyStories() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const res = await API.get('stories/mine/');
        const data = res?.data;
        // Be robust to either an array or a paginated object
        const list = unwrapList
          ? unwrapList(data)
          : (Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []));
        if (mounted) setItems(list || []);
      } catch (e) {
        if (!mounted) return;
        const code = e?.response?.status;
        setError(code === 401 ? 'Please sign in to view your stories.' : 'Could not load your stories.');
        setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const onDelete = async (id) => {
    const ok = window.confirm('Delete this story? This cannot be undone.');
    if (!ok) return;
    try {
      await API.delete(`stories/${id}/`);
      setItems((prev) => prev.filter((s) => String(s.id) !== String(id)));
    } catch {
      alert('Delete failed. You may not have permission.');
    }
  };

  if (loading) return <section className="container"><p className="muted">Loading…</p></section>;
  if (error)   return <section className="container"><p className="muted">{error}</p></section>;

  return (
    <section className="container">
      <div className="surface" style={{ padding: '1rem' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1>My stories</h1>
          <Link className="btn" to="/stories/new">Create new</Link>
        </header>

        {!items.length ? (
          <p className="muted" style={{ marginTop: '.75rem' }}>
            You don’t have any stories yet. <Link to="/stories/new">Create your first one</Link>.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem', display: 'grid', gap: '.75rem' }}>
            {items.map((s) => (
              <li key={s.id} className="card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <Link to={`/stories/${s.id}`} style={{ fontWeight: 700, fontSize: '1.05rem' }}>{s.title}</Link>
                    <p className="muted" style={{ margin: '.25rem 0' }}>
                      by {typeof s.author === 'string' ? s.author : (s.author?.username || s.author_username || 'You')}
                    </p>
                    {s.summary && <p className="muted" style={{ margin: '.25rem 0 0' }}>{s.summary}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '.5rem', alignItems: 'start' }}>
                    <button className="btn ghost" onClick={() => navigate(`/stories/${s.id}/edit`)}>Edit</button>
                    <button className="btn danger" onClick={() => onDelete(s.id)}>Delete</button>
                  </div>
                </div>

                {(Array.isArray(s.tags) && s.tags.length) ? (
                  <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.5rem' }}>
                    {s.tags.map((t) => (
                      <span key={typeof t === 'string' ? t : t.id} className="badge">
                        {typeof t === 'string' ? t : t.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
