// src/ChapterForm.js
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from './api';

async function createChapterFlexible(storyId, payload) {
  // Try nested first (your server has this), then flat as fallback
  try {
    const r2 = await API.post(`stories/${storyId}/chapters/`, payload);
    return r2.data;
  } catch (e2) {
    if (e2?.response?.status !== 404) throw e2;
    const r = await API.post('chapters/', payload);
    return r.data;
  }
}

export default function ChapterForm() {
  const { id: storyId } = useParams();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [nextPos, setNextPos] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Count chapters: nested first, fallback to flat
    (async () => {
      try {
        const r2 = await API.get(`stories/${storyId}/chapters/`);
        setNextPos(((r2.data || []).length || 0) + 1);
      } catch (e2) {
        if (e2?.response?.status === 404) {
          try {
            const r = await API.get(`chapters/?story=${storyId}`);
            setNextPos(((r.data || []).length || 0) + 1);
          } catch {
            setNextPos(1);
          }
        } else {
          setNextPos(1);
        }
      }
    })();
  }, [storyId]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { story: Number(storyId), title, content, position: nextPos };
      const data = await createChapterFlexible(storyId, payload);
      navigate(`/stories/${storyId}/chapters/${data.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: '.9rem' }}>
      <label className="label" htmlFor="ctitle">Title</label>
      <input id="ctitle" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />

      <label className="label" htmlFor="ccontent">Content</label>
      <textarea id="ccontent" className="textarea" value={content} onChange={(e) => setContent(e.target.value)} />

      <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
        <span className="label" style={{ margin: 0 }}>Position</span>
        <input className="input" style={{ width: '120px' }} type="number" min="1" value={nextPos} onChange={(e) => setNextPos(Number(e.target.value))} />
      </div>

      <div style={{ textAlign: 'right' }}>
        <button className="btn" disabled={saving}>{saving ? 'Adding…' : 'Add Chapter'}</button>
      </div>
    </form>
  );
}
