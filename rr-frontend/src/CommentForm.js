// src/CommentForm.js
import { useState } from 'react';
import API from './api';

export default function CommentForm({ chapterId, onNewComment }) {
  const [content, setContent] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!localStorage.getItem('access')) { alert('Please log in to comment.'); return; }
    setSubmitting(true);
    try {
      const res = await API.post('comments/', { chapter: Number(chapterId), content });
      onNewComment?.(res.data);
      setContent('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: '.75rem' }} aria-label="Add a comment">
      <label htmlFor="comment" className="label">Your comment</label>
      <textarea
        id="comment"
        className="textarea"
        placeholder="Be kind, be constructive…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
      />
      <div style={{ textAlign: 'right' }}>
        <button className="btn" disabled={isSubmitting}>{isSubmitting ? 'Submitting…' : 'Post Comment'}</button>
      </div>
    </form>
  );
}
