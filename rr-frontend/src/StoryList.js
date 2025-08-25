// src/StoryList.js
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API, { unwrapList } from './api';

export default function StoryList() {
  const navigate = useNavigate();
  const [stories, setStories] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState('');
  const [query, setQuery] = useState('');
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [tagsRes, storiesRes, meRes] = await Promise.allSettled([
          API.get('tags/'),
          API.get('stories/'),
          API.get('me/'),
        ]);
        if (mounted && tagsRes.status === 'fulfilled') setTags(unwrapList(tagsRes.value.data) || []);
        if (mounted && storiesRes.status === 'fulfilled') setStories(unwrapList(storiesRes.value.data) || []);
        if (mounted && meRes.status === 'fulfilled') setMe(meRes.value.data);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stories.filter((s) => {
      const matchesQuery = !q || (s.title || '').toLowerCase().includes(q) || (s.summary || '').toLowerCase().includes(q);
      const matchesTag = !selectedTag || (Array.isArray(s.tags) && s.tags.some((t) => String(t.id) === String(selectedTag)));
      return matchesQuery && matchesTag;
    });
  }, [stories, query, selectedTag]);

  const isMine = (story) => me && (story.author === me.username || story.author_username === me.username);

  return (
    <section className="container" style={{ display: 'grid', gap: '1rem' }}>
      <header className="surface" style={{ padding: '1rem' }}>
        <h1>Stories</h1>
        <p className="muted">Browse all stories{me ? ` — welcome back, ${me.username}` : ''}.</p>

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

      {loading ? (
        <p className="muted" style={{ padding: '1rem' }}>Loading…</p>
      ) : filtered.length ? (
        <ul className="grid cards">
          {filtered.map((story) => (
            <li key={story.id} className="card">
              <h3 style={{ marginBottom: '.25rem' }}>{story.title}</h3>
              <p className="muted" style={{ marginTop: 0 }}>
                by {story.author || story.author_username || 'Unknown'}
              </p>
              <p className="muted">{story.summary || 'No summary yet.'}</p>
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.5rem' }}>
                {(story.tags || []).map((t) => <span key={t.id || t} className="badge">{t.name || t}</span>)}
              </div>
              <div style={{ display: 'flex', gap: '.5rem', marginTop: '.75rem' }}>
                <button className="btn ghost" onClick={() => navigate(`/stories/${story.id}`)}>Read</button>
                {isMine(story) && (
                  <>
                    <button className="btn ghost" onClick={() => navigate(`/stories/${story.id}/edit`)}>Edit</button>
                    <button className="btn ghost" onClick={() => navigate(`/stories/${story.id}/chapters/new`)}>Add chapter</button>
                  </>
                )}
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
