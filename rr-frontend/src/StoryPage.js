// src/StoryPage.js
import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import API from './api';
import ChapterForm from './ChapterForm';

const normalize = (s) => s?.trim().toLowerCase();

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

async function fetchChaptersFlexible(storyId) {
  // Try nested first (your backend has this), then flat as fallback
  try {
    const r2 = await API.get(`stories/${storyId}/chapters/`);
    return r2.data || [];
  } catch (e2) {
    if (e2?.response?.status !== 404) throw e2;
    const r = await API.get(`chapters/?story=${storyId}`);
    return r.data || [];
  }
}

export default function StoryPage() {
  const navigate = useNavigate();
  const { id: storyId } = useParams();

  const [story, setStory] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);

  // robust current-user detection
  const [currentUser, setCurrentUser] = useState(null);
  const [checkedMineFallback, setCheckedMineFallback] = useState(false); // for last-resort ownership check

  // tag management state (owner only)
  const [allTags, setAllTags] = useState([]);
  const [selectedNames, setSelectedNames] = useState([]);
  const selectedSet = useMemo(() => new Set(selectedNames.map(normalize)), [selectedNames]);
  const [savingTags, setSavingTags] = useState(false);

  // derive isOwner from currentUser + story (and final fallback via /stories/mine/)
  const [isOwner, setIsOwner] = useState(false);

  // 1) Load story, chapters, tags
  useEffect(() => {
    setLoading(true);
    Promise.all([
      API.get(`stories/${storyId}/`).then((r) => r.data),
      fetchChaptersFlexible(storyId),
      API.get('tags/').then((r) => r.data || []),
    ])
      .then(([storyData, chaps, tags]) => {
        setStory(storyData);
        setChapters((chaps || []).sort((a, b) => (a.position || 0) - (b.position || 0)));
        setAllTags(tags);
        const names = (storyData.tags || []).map((t) => (typeof t === 'string' ? t : t.name));
        setSelectedNames(names);
      })
      .catch((e) => console.error('Failed to load story', e))
      .finally(() => setLoading(false));
  }, [storyId]);

  // 2) Figure out who the current user is (token → /me/ fallback)
  useEffect(() => {
    const token = localStorage.getItem('access');
    if (!token) { setCurrentUser(null); return; }
    const decoded = decodeUsernameFromJWT(token);
    if (decoded) { setCurrentUser(decoded); return; }
    // fallback to /api/me/
    (async () => {
      try {
        const { data } = await API.get('me/');
        const name = data?.username || data?.user || data?.name || data?.email || null;
        setCurrentUser(name ? String(name) : null);
      } catch {
        setCurrentUser(null);
      }
    })();
  }, []);

  // 3) Compute owner when we have story and currentUser (string compare on username)
  useEffect(() => {
    if (!story) return;
    const authorName =
      typeof story.author === 'string'
        ? story.author
        : story.author?.username || story.author_name || story.author_username || null;

    if (authorName && currentUser) {
      setIsOwner(normalize(authorName) === normalize(currentUser));
    } else {
      setIsOwner(false);
    }
  }, [story, currentUser]);

  // 4) Last-resort: if we still don’t think you’re owner, try /stories/mine/ and see if this id is listed
  useEffect(() => {
    if (!story || isOwner || checkedMineFallback === true) return;
    (async () => {
      try {
        const resp = await API.get('stories/mine/');
        const data = resp?.data;
        const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
        const mine = list.some((s) => String(s.id) === String(storyId));
        if (mine) setIsOwner(true);
      } catch {
        // ignore
      } finally {
        setCheckedMineFallback(true);
      }
    })();
  }, [story, isOwner, checkedMineFallback, storyId]);

  if (loading) return <section className="container"><p className="muted">Loading story…</p></section>;
  if (!story) return <section className="container"><p className="muted">Story not found.</p></section>;

  const toggleName = (name) => {
    const key = normalize(name);
    setSelectedNames((prev) =>
      prev.map(normalize).includes(key)
        ? prev.filter((n) => normalize(n) !== key)
        : [...prev, name]
    );
  };

  async function ensureTagIdsFromNames(names) {
    const byName = new Map(allTags.map((t) => [normalize(t.name), t]));
    const ids = [];
    const created = [];

    for (const raw of names) {
      const key = normalize(raw);
      if (byName.has(key)) {
        ids.push(byName.get(key).id);
      } else {
        try {
          const res = await API.post('tags/', { name: raw.trim() });
          ids.push(res.data.id);
          created.push(res.data);
          byName.set(key, res.data);
        } catch {
          const refreshed = await API.get('tags/');
          setAllTags(refreshed.data || []);
          const found = (refreshed.data || []).find((t) => normalize(t.name) === key);
          if (found) ids.push(found.id);
        }
      }
    }
    if (created.length) setAllTags((prev) => [...prev, ...created]);
    return ids;
  }

  const saveTags = async () => {
    setSavingTags(true);
    try {
      // backend expects `tag_ids` for write
      const tag_ids = await ensureTagIdsFromNames(selectedNames);
      const res = await API.patch(`stories/${storyId}/`, { tag_ids });
      setStory(res.data);
    } finally {
      setSavingTags(false);
    }
  };

  const doDelete = async () => {
    if (!isOwner) return;
    const ok = window.confirm('Delete this story? This cannot be undone.');
    if (!ok) return;
    try {
      await API.delete(`stories/${storyId}/`);
      navigate('/my');
    } catch {
      alert('Could not delete story. You may not have permission.');
    }
  };

  const chapterCount = chapters.length;

  return (
    <section className="container">
      <article className="surface" style={{ padding: '1.25rem' }}>
        <header style={{ display: 'flex', gap: '1rem', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div>
            <h1>{story.title}</h1>
            {story.author && (
              <p className="muted">
                by {typeof story.author === 'string' ? story.author : (story.author?.username || 'Unknown')}
              </p>
            )}
            {story.summary && <p className="muted" style={{ marginTop: '.5rem' }}>{story.summary}</p>}
          </div>

          {isOwner ? (
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button className="btn ghost" onClick={() => navigate(`/stories/${storyId}/edit`)}>Edit</button>
              <button className="btn" onClick={doDelete} title="Delete this story">Delete</button>
            </div>
          ) : (
            <div className="muted" title="Only the author can edit">
              {currentUser ? 'You are viewing as a reader.' : 'Log in to manage your stories.'}
            </div>
          )}
        </header>

        <div className="spacer" />

        {/* Tags display & editor (owner only) */}
        <section>
          <p className="muted" style={{ fontWeight: 800, marginBottom: '.35rem' }}>Tags</p>
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
            {(story.tags || []).length ? (
              (story.tags || []).map((t) => (
                <span key={typeof t === 'string' ? t : t.id} className="badge">
                  {typeof t === 'string' ? t : t.name}
                </span>
              ))
            ) : (
              <span className="muted">No tags yet.</span>
            )}
          </div>

          {isOwner && (
            <div className="surface" style={{ marginTop: '.75rem', padding: '1rem' }}>
              <p style={{ fontWeight: 800, marginBottom: '.35rem' }}>Manage tags</p>
              {/* Selected */}
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                {selectedNames.length ? (
                  selectedNames.map((n) => (
                    <button key={n} type="button" className="badge on" onClick={() => toggleName(n)} title="Remove">
                      {n} ✕
                    </button>
                  ))
                ) : (
                  <span className="muted">No tags selected.</span>
                )}
              </div>
              {/* Existing tags */}
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.5rem' }}>
                {allTags.map((t) => {
                  const on = selectedSet.has(normalize(t.name));
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`badge ${on ? 'on' : ''}`}
                      onClick={() => {
                        const name = t.name;
                        const key = normalize(name);
                        setSelectedNames((prev) =>
                          prev.map(normalize).includes(key)
                            ? prev.filter((n) => normalize(n) !== key)
                            : [...prev, name]
                        );
                      }}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
              <div style={{ textAlign: 'right', marginTop: '.75rem' }}>
                <button className="btn" onClick={saveTags} disabled={savingTags}>
                  {savingTags ? 'Saving…' : 'Save tags'}
                </button>
              </div>
            </div>
          )}
        </section>

        <div className="spacer" />

        <section id="chapters">
          <h2>Chapters ({chapterCount})</h2>
          {chapters.length ? (
            <ol style={{ paddingLeft: '1.25rem' }}>
              {chapters.map((c) => (
                <li key={c.id} style={{ margin: '.35rem 0' }}>
                  <Link to={`/stories/${storyId}/chapters/${c.id}`}>{c.title}</Link>
                  {typeof c.position === 'number' && <span className="muted"> — {c.position}</span>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">No chapters yet.</p>
          )}
        </section>
      </article>

      {/* Add Chapter (owner only) */}
      {isOwner && (
        <section style={{ marginTop: '1rem' }}>
          <div className="surface" style={{ padding: '1rem' }}>
            <h2>Add a Chapter</h2>
            <ChapterForm />
          </div>
        </section>
      )}
    </section>
  );
}
