// src/StoryForm.js
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API, { unwrapList } from './api';

const SUGGESTED = {
  Genres: [
    'Fantasy','Science Fiction','Romance','Mystery','Thriller','Horror','Historical','Urban Fantasy','LitRPG','Progression Fantasy',
  ],
  Subgenres: [
    'Isekai','Cultivation','Space Opera','Cyberpunk','Steampunk','Dark Fantasy','Paranormal','Dystopian','Post-Apocalyptic','Time Travel',
  ],
  Elements: [
    'Magic Academy','Dungeon','System','Reincarnation','Villain Protagonist','Anti-hero','Found Family','Slow Burn','Comedy','Tragedy',
  ],
  Audience: [
    'Young Adult','Adult','General','LGBTQ+','Female Lead','Male Lead'
  ],
};

const normalize = (s) => String(s || '').trim().toLowerCase();

// Map UI -> common backend values; we’ll fall back if API rejects it.
function toBackendStatus(ui) {
  return ui === 'COMPLETED' ? 'published' : 'draft';
}

export default function StoryForm() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [status, setStatus] = useState('ONGOING'); // UI value
  const [tagsList, setTagsList] = useState([]);    // always array
  const [selectedNames, setSelectedNames] = useState([]);
  const [custom, setCustom] = useState('');
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load tags (normalize array vs paginated)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await API.get('tags/'); // trailing slash
        if (!mounted) return;
        setTagsList(unwrapList(res.data) || []);
      } catch {
        if (!mounted) return;
        setTagsList([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const selectedSet = useMemo(() => new Set(selectedNames.map(normalize)), [selectedNames]);

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
    const listArr = Array.isArray(tagsList) ? tagsList : unwrapList(tagsList) || [];
    const byName = new Map(listArr.map((t) => [normalize(t.name), t]));
    const ids = [];
    const created = [];

    for (const raw of names) {
      const key = normalize(raw);
      if (byName.has(key)) {
        ids.push(byName.get(key).id);
        continue;
      }
      try {
        const res = await API.post('tags/', { name: raw.trim() }); // trailing slash
        ids.push(res.data.id);
        created.push(res.data);
        byName.set(key, res.data);
      } catch {
        const refreshed = await API.get('tags/'); // trailing slash
        const arr = unwrapList(refreshed.data) || [];
        setTagsList(arr);
        const found = arr.find((t) => normalize(t.name) === key);
        if (found) ids.push(found.id);
      }
    }

    if (created.length) setTagsList((prev) => [...prev, ...created]);
    return ids;
  }

  async function createWithFallback(payload, uiStatus) {
    // Try common values first
    try {
      const primary = { ...payload, status: toBackendStatus(uiStatus) };
      return await API.post('stories/', primary); // trailing slash
    } catch (err) {
      const res = err?.response;
      const statusErrors = res?.data && (res.data.status || res.data.detail);
      const isStatusProblem =
        res?.status === 400 &&
        (statusErrors && String(statusErrors).toLowerCase().includes('valid'));

      // If backend rejected status choice, retry with the UI value itself (ONGOING/COMPLETED)
      if (isStatusProblem) {
        const secondary = { ...payload, status: uiStatus };
        return await API.post('stories/', secondary); // trailing slash
      }
      throw err; // bubble up
    }
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const tag_ids = await ensureTagIdsFromNames(selectedNames);
      const base = {
        title: title.trim(),
        summary: summary.trim(),
        tag_ids,
      };

      const res = await createWithFallback(base, status);

      // Navigate to the new story
      navigate(`/stories/${res.data?.id ?? ''}`);
    } catch (err) {
      const code = err?.response?.status;
      if (code === 401) {
        setError('Please sign in to create a story.');
      } else if (err?.response?.data && typeof err.response.data === 'object') {
        const parts = [];
        for (const [k, v] of Object.entries(err.response.data)) {
          parts.push(`${k}: ${Array.isArray(v) ? v.join(' ') : String(v)}`);
        }
        setError(parts.join(' | ') || 'Create failed.');
      } else {
        setError('Create failed. Check your connection and try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="container">
      <div className="surface" style={{ padding: '1rem' }}>
        <h1>Create a new story</h1>

        {error ? (
          <div role="alert" className="card" style={{ background: 'var(--surface-2)', padding: '.75rem', marginTop: '.5rem' }}>
            {error}
          </div>
        ) : null}

        <form onSubmit={submit} style={{ display: 'grid', gap: '1rem', marginTop: '.75rem' }}>
          <div>
            <label className="label" htmlFor="title">Title</label>
            <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div>
            <label className="label" htmlFor="summary">Summary</label>
            <textarea id="summary" className="textarea" value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>

          <div>
            <label className="label" htmlFor="status">Status</label>
            <select id="status" className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ONGOING">Ongoing</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          {/* Tag Picker */}
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
              />
            </div>

            {/* Selected */}
            <div style={{ marginTop: '.5rem', display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              {selectedNames.length ? (
                selectedNames.map((n) => (
                  <button key={n} type="button" className="badge on" onClick={() => toggleName(n)} title="Remove">
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
              />
              <button type="button" className="btn secondary" onClick={addCustom}>+</button>
            </div>

            {/* Existing tags from API */}
            <details style={{ marginTop: '.75rem' }}>
              <summary className="muted" style={{ cursor: 'pointer' }}>Choose from existing tags</summary>
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.5rem' }}>
                {(Array.isArray(tagsList) ? tagsList : []).map((t) => {
                  const on = selectedSet.has(normalize(t.name));
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`badge ${on ? 'on' : ''}`}
                      onClick={() => toggleName(t.name)}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </details>

            {/* Suggested tags */}
            <div style={{ display: 'grid', gap: '.75rem', marginTop: '.75rem' }}>
              {Object.keys(SUGGESTED).map((group) => (
                <div key={group}>
                  <p className="muted" style={{ fontWeight: 800, marginBottom: '.35rem' }}>{group}</p>
                  <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                    {(SUGGESTED[group] || [])
                      .filter((n) => !filter || normalize(n).includes(normalize(filter)))
                      .map((name) => {
                        const on = selectedSet.has(normalize(name));
                        return (
                          <button
                            key={name}
                            type="button"
                            className={`badge ${on ? 'on' : ''}`}
                            onClick={() => toggleName(name)}
                          >
                            {name}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Create Story'}</button>
          </div>
        </form>
      </div>
    </section>
  );
}
