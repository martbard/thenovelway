// src/CommentForm.js
import { useState } from 'react';
import API from './api';

export default function CommentForm({ storyId, chapterId, onCreated }) {
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function explain(err) {
    const res = err?.response;
    if (res?.status === 401) return 'Please sign in to comment.';
    if (res?.data && typeof res.data === 'object') {
      const parts = [];
      for (const [k, v] of Object.entries(res.data)) {
        parts.push(`${k}: ${Array.isArray(v) ? v.join(' ') : String(v)}`);
      }
      return parts.join(' | ') || 'Could not post comment.';
    }
    return 'Could not post comment.';
  }

  const submit = async (e) => {
    e.preventDefault();
    const content = body.trim();
    if (!content) return;

    setSaving(true);
    setError('');
    try {
      // Try the nested route first (your API supports this)
      const r = await API.post(`stories/${storyId}/chapters/${chapterId}/comments/`, { content });
      onCreated?.(r.data);
      setBody('');
    } catch (err) {
      // Fallback: flat route if available (we added it in urls.py)
      if (err?.response?.status === 404) {
        try {
          const r2 = await API.post('comments/', { chapter: chapterId, content });
          onCreated?.(r2.data);
          setBody('');
        } catch (err2) {
          setError(explain(err2));
        }
      } else {
        setError(explain(err));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: '.5rem' }}>
      <label className="label" htmlFor="comment">Add a comment</label>
      <textarea
        id="comment"
        className="textarea"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Be kind. Keep spoilers hidden."
      />
      {error && (
        <div role="alert" className="card" style={{ background: 'var(--surface-2)', padding: '.5rem' }}>
          {error}
        </div>
      )}
      <div style={{ textAlign: 'right' }}>
        <button className="btn" disabled={saving || !body.trim()}>
          {saving ? 'Posting…' : 'Post comment'}
        </button>
      </div>
    </form>
  );
}
