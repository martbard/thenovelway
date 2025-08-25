// src/StoryEdit.js
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import API, { unwrapList } from './api';

const normalize = (s) => String(s || '').trim().toLowerCase();
function toBackendStatus(ui) { return ui === 'COMPLETED' ? 'published' : 'draft'; }

export default function StoryEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [me, setMe] = useState(null);
  const [story, setStory] = useState(null);

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [status, setStatus] = useState('ONGOING');
  const [allTags, setAllTags] = useState([]);
  const [selectedNames, setSelectedNames] = useState([]);
  const [custom, setCustom] = useState('');
  const [filter, setFilter] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [checkedMineFallback, setCheckedMineFallback] = useState(false);

  // Load me + story + tags
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const [meRes, storyRes, tagsRes] = await Promise.allSettled([
          API.get('me/'),
          API.get(`stories/${id}/`),
          API.get('tags/'),
        ]);

        if (meRes.status === 'fulfilled') setMe(meRes.value.data || null);
        if (storyRes.status === 'fulfilled') {
          const s = storyRes.value.data;
          if (!mounted) return;
          setStory(s);
          setTitle(s.title || '');
          setSummary(s.summary || '');
          const serverStatus = String(s.status || '').toLowerCase();
          setStatus(serverStatus === 'published' ? 'COMPLETED' : 'ONGOING');
          const names = (s.tags || []).map((t) => (typeof t === 'string' ? t : t.name));
          setSelectedNames(names);
        }
        if (tagsRes.status === 'fulfilled') setAllTags(unwrapList(tagsRes.value.data) || []);
      } catch {
        setError('Failed to load story.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  // Primary owner check
  useEffect(() => {
    if (!me || !story) return;
    const author =
      typeof story.author === 'string'
        ? story.author
        : story.author?.username || story.author_username || null;
    if (author && me?.username) setIsOwner(normalize(author) === normalize(me.username));
    else setIsOwner(false);
  }, [me, story]);

  // Fallback: confirm ownership via /stories/mine/
  useEffect(() => {
    if (!story || isOwner || checkedMineFallback) return;
    (async () => {
      try {
        const resp = await API.get('stories/mine/');
        const data = resp?.data;
        const list = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
        const mine = list.some((s) => String(s.id) === String(id));
        if (mine) setIsOwner(true);
      } finally {
        setCheckedMineFallback(true);
      }
    })();
  }, [story, isOwner, checkedMineFallback, id]);

  const selectedSet = useMemo(() => new Set(selectedNames.map(normalize)), [selectedNames]);
  const filteredAllTags = useMemo(() => {
    const q = normalize(filter);
    return (allTags || []).filter((t) => !q || normalize(t.name).includes(q));
  }, [allTags, filter]);

  const toggleName = (name) => {
    const key = normalize(name);
    setSelectedNames((prev) =>
      prev.some((n) => normalize(n) === key)
        ? prev.filter((n) => normalize(n) !== key)
        : [...prev, name]
    );
  };
  const addCustom = () => {
    if (!custom.trim()) return;
    toggleName(custom.trim());
    setCustom('');
  };

  // Ensure we have tag IDs for each selected name; create missing tags on the fly
  async function ensureTagIdsFromNames(names) {
    const listArr = Array.isArray(allTags) ? allTags : unwrapList(allTags) || [];
    const byName = new Map(listArr.map((t) => [normalize(t.name), t]));
    const ids = [];
    const created = [];
    for (const raw of names) {
      const key = normalize(raw);
      if (byName.has(key)) { ids.push(byName.get(key).id); continue; }
      try {
        const res = await API.post('tags/', { name: raw.trim() });
        ids.push(res.data.id); created.push(res.data); byName.set(key, res.data);
      } catch {
        const refreshed = await API.get('tags/');
        const arr = unwrapList(refreshed.data) || [];
        setAllTags(arr);
        const found = arr.find((t) => normalize(t.name) === key);
        if (found) ids.push(found.id);
      }
    }
    if (created.length) setAllTags((prev) => [...prev, ...created]);
    return ids;
  }

  async function updateWithFallback(payload, uiStatus) {
    try {
      const primary = { ...payload, status: toBackendStatus(uiStatus) };
      return await API.patch(`stories/${id}/`, primary);
    } catch (err) {
      const res = err?.response;
      const statusErrors = res?.data && (res.data.status || res.data.detail);
      const isStatusProblem = res?.status === 400 && (statusErrors && String(statusErrors).toLowerCase().includes('valid'));
      if (isStatusProblem) {
        const secondary = { ...payload, status: uiStatus };
        return await API.patch(`stories/${id}/`, secondary);
      }
      throw err;
    }
  }

  const submit = async (e) => {
    e.preventDefault();
    if (!isOwner) return;
    setError(''); setSaving(true);
    try {
      const tag_ids = await ensureTagIdsFromNames(selectedNames);
      const payload = { title: title.trim(), summary: summary.trim(), tag_ids };
      await updateWithFallback(payload, status);
      navigate(`/stories/${id}`);
    } catch (err) {
      const code = err?.response?.status;
      if (code === 403 || code === 404) setError('You do not have permission to edit this story.');
      else if (err?.response?.data && typeof err.response.data === 'object') {
        const parts = [];
        for (const [k, v] of Object.entries(err.response.data)) {
          parts.push(`${k}: ${Array.isArray(v) ? v.join(' ') : String(v)}`);
        }
        setError(parts.join(' | ') || 'Update failed.');
      } else setError('Update failed. Please try again.');
    } finally { setSaving(false); }
  };

  const doDelete = async () => {
    if (!isOwner) return;
    const ok = window.confirm('Delete this story? This cannot be undone.');
    if (!ok) return;
    setDeleting(true);
    try { await API.delete(`stories/${id}/`); navigate('/stories'); }
    catch { setError('Delete failed. You may not have permission.'); }
    finally { setDeleting(false); }
  };

  if (loading) return <section className="container"><p className="muted">Loading…</p></section>;
  if (!story) return <section className="container"><p className="muted">Story not found.</p></section>;

  return (
    <section className="container">
      <div className="surface" style={{ padding: '1rem' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
          <h1>Edit story</h1>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <Link className="btn ghost" to={`/stories/${id}`}>Back</Link>
            {isOwner && (
              <button className="btn danger" onClick={doDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
        </header>

        <p className="muted" style={{ marginTop: 0 }}>
          by {typeof story.author === 'string' ? story.author : (story.author?.username || story.author_username || 'Unknown')}
        </p>

        {!isOwner && (
          <div role="alert" className="card" style={{ background: 'var(--surface-2)', padding: '.75rem', marginBottom: '.75rem' }}>
            You can’t edit this story because you’re not the author.
          </div>
        )}

        {error ? (
          <div role="alert" className="card" style={{ background: 'var(--surface-2)', padding: '.75rem', marginBottom: '.75rem' }}>
            {error}
          </div>
        ) : null}

        <form onSubmit={submit} style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label className="label" htmlFor="title">Title</label>
            <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={!isOwner} />
          </div>

          <div>
            <label className="label" htmlFor="summary">Summary</label>
            <textarea id="summary" className="textarea" rows={5} value={summary} onChange={(e) => setSummary(e.target.value)} disabled={!isOwner} />
          </div>

          <div>
            <label className="label" htmlFor="status">Status</label>
            <select id="status" className="select" value={status} onChange={(e) => setStatus(e.target.value)} disabled={!isOwner}>
              <option value="ONGOING">Ongoing</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          {/* Tag Manager */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'end' }}>
              <span className="label">Tags</span>
              <input
                className="input"
                placeholder="Filter suggestions…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                aria-label="Filter tag suggestions"
                style={{ maxWidth: 280 }}
                disabled={!isOwner}
              />
            </div>

            {/* Selected */}
            <div style={{ marginTop: '.5rem', display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              {selectedNames.length ? (
                selectedNames.map((n) => (
                  <button key={n} type="button" className={`badge on ${!isOwner ? 'disabled' : ''}`} onClick={() => isOwner && toggleName(n)} title="Remove">
                    {n} ✕
                  </button>
                ))
              ) : (
                <span className="muted">No tags selected yet.</span>
              )}
            </div>

            {/* Quick add custom */}
            <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem' }}>
              <input
                className="input"
                placeholder="Add custom tag (press +)"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                disabled={!isOwner}
              />
              <button type="button" className="btn secondary" onClick={() => isOwner && addCustom()} disabled={!isOwner}>+</button>
            </div>

            {/* Existing tags from API (filtered by input) */}
            <details style={{ marginTop: '.75rem' }} open>
              <summary className="muted" style={{ cursor: 'pointer' }}>Choose from existing tags</summary>
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.5rem' }}>
                {filteredAllTags.map((t) => {
                  const on = selectedSet.has(normalize(t.name));
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`badge ${on ? 'on' : ''} ${!isOwner ? 'disabled' : ''}`}
                      onClick={() => isOwner && toggleName(t.name)}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </details>
          </div>

          <div style={{ textAlign: 'right' }}>
            <button className="btn" disabled={!isOwner || saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      </div>
    </section>
  );
}
