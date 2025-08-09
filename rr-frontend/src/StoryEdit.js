// src/StoryEdit.js
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import API from './api';

const normalize = (s) => s.trim().toLowerCase();

export default function StoryEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [status, setStatus] = useState('ONGOING');
  const [tagsList, setTagsList] = useState([]);
  const [selectedNames, setSelectedNames] = useState([]);
  const selectedSet = useMemo(() => new Set(selectedNames.map(normalize)), [selectedNames]);

  useEffect(() => {
    Promise.all([API.get(`stories/${id}/`), API.get('tags/')])
      .then(([s, t]) => {
        const story = s.data;
        setTitle(story.title || '');
        setSummary(story.summary || '');
        setStatus(story.status || 'ONGOING');
        setSelectedNames((story.tags || []).map((x) => (typeof x === 'string' ? x : x.name)));
        setTagsList(t.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const toggleName = (name) => {
    const key = normalize(name);
    setSelectedNames((prev) =>
      prev.map(normalize).includes(key)
        ? prev.filter((n) => normalize(n) !== key)
        : [...prev, name]
    );
  };

  async function ensureTagIdsFromNames(names) {
    const byName = new Map(tagsList.map((t) => [normalize(t.name), t]));
    const ids = [];
    for (const raw of names) {
      const key = normalize(raw);
      if (byName.has(key)) {
        ids.push(byName.get(key).id);
      } else {
        try {
          const res = await API.post('tags/', { name: raw.trim() });
          ids.push(res.data.id);
          byName.set(key, res.data);
          setTagsList((prev) => [...prev, res.data]);
        } catch {
          const refreshed = await API.get('tags/');
          setTagsList(refreshed.data || []);
          const found = (refreshed.data || []).find((t) => normalize(t.name) === key);
          if (found) ids.push(found.id);
        }
      }
    }
    return ids;
  }

  const submit = async (e) => {
    e.preventDefault();
    const tag_ids = await ensureTagIdsFromNames(selectedNames);
    await API.patch(`stories/${id}/`, { title, summary, status, tag_ids });
    navigate(`/stories/${id}`);
  };

  if (loading) return <section className="container"><p className="muted">Loading…</p></section>;

  return (
    <section className="container">
      <div className="surface" style={{ padding: '1rem' }}>
        <h1>Edit story</h1>

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

          <div>
            <p className="label">Tags</p>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              {selectedNames.map((n) => (
                <button key={n} type="button" className="badge on" onClick={() => toggleName(n)}>
                  {n} ✕
                </button>
              ))}
            </div>

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
          </div>

          <div style={{ textAlign: 'right' }}>
            <button className="btn">Save</button>
          </div>
        </form>
      </div>
    </section>
  );
}
