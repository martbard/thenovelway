// src/StoryList.js
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from './api';
import { jwtDecode } from 'jwt-decode';

export default function StoryList() {
  const navigate = useNavigate();
  const [stories, setStories] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState('');
  const [query, setQuery] = useState('');

  const token = localStorage.getItem('access');
  const user = token ? jwtDecode(token)?.username : null;

  useEffect(() => {
    API.get('stories/').then((res) => setStories(res.data || [])).catch(console.error);
    API.get('tags/').then((res) => setTags(res.data || [])).catch(() => setTags([]));
  }, []);

  const filtered = stories.filter((s) => {
    const tagMatch = !selectedTag || (s.tags || []).some((t) => String(t.id || t) === String(selectedTag));
    const textMatch = !query || (s.title?.toLowerCase().includes(query.toLowerCase()) || s.summary?.toLowerCase().includes(query.toLowerCase()));
    return tagMatch && textMatch;
  });

  return (
    <section className="container" style={{ display: 'grid', gap: '1rem' }}>
      <header className="surface" style={{ padding: '1rem' }}>
        <h1>Stories</h1>
        <p className="muted">Browse all stories{user ? ` — welcome back, ${user}` : ''}.</p>

        <div style={{ display: 'grid', gap: '.75rem', gridTemplateColumns: '1fr 220px' }}>
          <input
            className="input"
            placeholder="Search by title or summary…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search stories"
          />
          <select
            className="select"
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            aria-label="Filter by tag"
          >
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </header>

      {filtered.length ? (
        <ul className="grid cards">
          {filtered.map((story) => (
            <li key={story.id} className="card">
              <h3>{story.title}</h3>
              <p className="muted">{story.summary || 'No summary yet.'}</p>
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.5rem' }}>
                {(story.tags || []).map((t) => <span key={t.id || t} className="badge">{t.name || t}</span>)}
              </div>
              <div style={{ display: 'flex', gap: '.5rem', marginTop: '.75rem' }}>
                <button className="btn" onClick={() => navigate(`/stories/${story.id}`)}>Open</button>
                <button className="btn ghost" onClick={() => navigate(`/stories/${story.id}#chapters`)}>Chapters</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" style={{ textAlign: 'center' }}>
          No stories found.{' '}
          <button onClick={() => navigate('/stories/new')} className="text-brand-secondary" style={{ fontWeight: 700 }}>
            Create one?
          </button>
        </p>
      )}
    </section>
  );
}
