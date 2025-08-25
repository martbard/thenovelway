// src/StoryFront.js
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API, { unwrapList } from './api';
import Hero from './Hero';

export default function StoryFront() {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await API.get('stories/');
        if (!mounted) return;
        setStories(unwrapList(res.data) || []);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <>
      <Hero />
      <section className="container" style={{ marginTop: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '.75rem' }}>
          <h2>Latest stories</h2>
          <Link to="/stories" className="muted">View all →</Link>
        </div>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : stories.length ? (
          <ul className="grid cards">
            {stories.slice(0, 8).map((story) => (
              <li key={story.id} className="card">
                <h3 style={{ marginBottom: '.25rem' }}>{story.title}</h3>
                <p className="muted" style={{ marginTop: 0 }}>
                  by {story.author || story.author_username || 'Unknown'}
                </p>
                <p className="muted">{story.summary || 'No summary yet.'}</p>
                <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.5rem' }}>
                  {(story.tags || []).map((t) => <span key={t.id || t} className="badge">{t.name || t}</span>)}
                </div>
                <Link to={`/stories/${story.id}`} className="btn ghost" style={{ marginTop: '.75rem' }}>Read more →</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No stories yet. <Link to="/stories/new">Create one?</Link></p>
        )}
      </section>
    </>
  );
}
