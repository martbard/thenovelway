// src/StoryForm.js
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from './api';

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

const normalize = (s) => s.trim().toLowerCase();

export default function StoryForm() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [status, setStatus] = useState('ONGOING');
  const [tagsList, setTagsList] = useState([]);
  const [selectedNames, setSelectedNames] = useState([]);
  const [custom, setCustom] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    API.get('tags/').then((res) => setTagsList(res.data || [])).catch(() => setTagsList([]));
  }, []);

  const selectedSet = useMemo(() => new Set(selectedNames.map(normalize)), [selectedNames]);

  const toggleName = (name) => {
    const key = normalize(name);
    setSelectedNames((prev) =>
      prev.map(normalize).includes(key)
        ? prev.filter((n) => normalize(n) !== key)
        : [...prev, name]
    );
  };

  const addCustom = () => {
    if (!custom.trim()) return;
    toggleName(custom.trim());
    setCustom('');
  };

  async function ensureTagIdsFromNames(names) {
    const byName = new Map(tagsList.map((t) => [normalize(t.name), t]));
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
          setTagsList(refreshed.data || []);
          const found = (refreshed.data || []).find((t) => normalize(t.name) === key);
          if (found) ids.push(found.id);
        }
      }
    }
    if (created.length) setTagsList((prev) => [...prev, ...created]);
    return ids;
  }

  const submit = async (e) => {
    e.preventDefault();
    const tag_ids = await ensureTagIdsFromNames(selectedNames);
    const payload = { title, summary, status, tag_ids };
    const res = await API.post('stories/', payload);
    navigate(`/stories/${res.data.id}`);
  };

  const filteredNames = (group) =>
    SUGGESTED[group].filter((n) => !filter || normalize(n).includes(normalize(filter)));

  return (
    <section className="container">
      <div className="surface" style={{ padding: '1rem' }}>
        <h1>Create a new story</h1>

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
                {tagsList.map((t) => {
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
                    {filteredNames(group).map((name) => {
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
            <button className="btn">Create Story</button>
          </div>
        </form>
      </div>
    </section>
  );
}
