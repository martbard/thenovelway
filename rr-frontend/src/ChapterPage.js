// src/ChapterPage.js
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from './api';
import CommentForm from './CommentForm';

/** Load a chapter from the API (prefer nested URL first) */
async function fetchChapterFlexible(storyId, chapterId) {
  try {
    const r2 = await API.get(`stories/${storyId}/chapters/${chapterId}/`);
    return r2.data;
  } catch (e2) {
    if (e2?.response?.status !== 404) throw e2;
    const r = await API.get(`chapters/${chapterId}/`);
    return r.data;
  }
}

const loadComments = (chapterId, setComments) =>
  API.get(`comments/?chapter=${chapterId}`)
    .then((res) => setComments(res.data || []))
    .catch((err) => console.error('Error loading comments', err));

/** --- Lightweight formatter: turn plain text into paragraphs + simple emphasis --- */
function escapeHtml(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
function plainTextToHtml(text = '') {
  let t = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  t = escapeHtml(t);
  t = t
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
  return t
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('\n');
}

/** Reader preference helpers (persist in localStorage) */
const DEFAULT_PREFS = {
  mode: 'scroll',  // 'scroll' | 'pages'
  font: 'serif',   // 'serif' | 'sans' | 'mono'
  size: 18,        // px
  lh: 1.9,         // line-height
  width: 680,      // px (content max width)
  justify: false,  // boolean
  columns: 1       // 1 or 2 (ignored in page mode)
};
function loadPrefs() {
  try {
    const raw = localStorage.getItem('readerPrefs');
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export default function ChapterPage() {
  const { storyId, chapterId } = useParams();
  const [chapter, setChapter] = useState(null);
  const [comments, setComments] = useState([]);

  // Vertical scroll progress
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollRef = useRef(null);

  // Reader prefs
  const [prefs, setPrefs] = useState(loadPrefs());
  useEffect(() => {
    try { localStorage.setItem('readerPrefs', JSON.stringify(prefs)); } catch {}
  }, [prefs]);

  // Derived font-family
  const readerFont = useMemo(() => (
    prefs.font === 'serif'
      ? `"Iowan Old Style","Palatino Linotype",Palatino,"URW Palladio L","Source Serif Pro",Georgia,serif`
      : prefs.font === 'sans'
      ? `Inter, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
      : `ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace`
  ), [prefs.font]);

  // Load chapter + comments
  useEffect(() => {
    fetchChapterFlexible(storyId, chapterId)
      .then(setChapter)
      .catch(() => setChapter(null));
    loadComments(chapterId, setComments);
  }, [storyId, chapterId]);

  // Build HTML (either from backend or from plain text)
  const contentHtml = useMemo(() => {
    if (!chapter) return '';
    return chapter.content_html && chapter.content_html.trim().length
      ? chapter.content_html
      : plainTextToHtml(chapter.content || '');
  }, [chapter]);

  /* ---------------------- Scroll mode ---------------------- */
  useEffect(() => {
    if (prefs.mode !== 'scroll') return;
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const total = el.scrollHeight - el.clientHeight;
      const pct = total > 0 ? Math.min(100, Math.max(0, (el.scrollTop / total) * 100)) : 0;
      setScrollProgress(pct);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [prefs.mode, contentHtml, prefs.size, prefs.width, prefs.lh]);

  /* ---------------------- Page mode ---------------------- */
  const [pages, setPages] = useState([]);        // array of HTML strings
  const [currentPage, setCurrentPage] = useState(0);
  const pageStripRef = useRef(null);
  const [pageHeight, setPageHeight] = useState(() => Math.max(420, Math.floor(window.innerHeight * 0.72) - 24));

  // (re)paginate when content or typography changes or window resizes
  useEffect(() => {
    if (prefs.mode !== 'pages') return;

    let cancelled = false;

    function paginate() {
      // Compute target page height (match reading viewport)
      const vh = Math.max(420, Math.floor(window.innerHeight * 0.72) - 24);
      setPageHeight(vh);

      // Build a hidden measurer with the same typography
      const measurer = document.createElement('div');
      Object.assign(measurer.style, {
        position: 'fixed',
        visibility: 'hidden',
        zIndex: '-1',
        left: '-99999px',
        top: '-99999px',
        width: `${prefs.width}px`,
        fontFamily: readerFont,
        fontSize: `${prefs.size}px`,
        lineHeight: String(prefs.lh),
        padding: '0 .9rem',       // match .page > .reading padding X
        boxSizing: 'border-box',
        whiteSpace: 'normal',
        maxHeight: `${vh}px`,
        overflow: 'hidden',
      });
      document.body.appendChild(measurer);

      // Parse contentHtml into blocks (preserve tags)
      const wrapper = document.createElement('div');
      wrapper.innerHTML = contentHtml;

      const blocks = Array.from(wrapper.childNodes);
      const out = [];
      let page = document.createElement('div');
      measurer.innerHTML = '';
      measurer.appendChild(page);

      const pushPage = () => {
        out.push(page.innerHTML);
        measurer.innerHTML = '';
        page = document.createElement('div');
        measurer.appendChild(page);
      };

      for (let i = 0; i < blocks.length; i++) {
        const node = blocks[i].cloneNode(true);
        page.appendChild(node);

        if (measurer.scrollHeight > vh) {
          // If a single node already exceeds, accept it as a page and move on
          page.removeChild(page.lastChild);
          if (page.childNodes.length) pushPage();

          // Start new page with the big node
          page.appendChild(node);
          if (measurer.scrollHeight > vh) {
            pushPage();
          }
        }

        if (i === blocks.length - 1) {
          pushPage();
        }
      }

      if (!cancelled) {
        setPages(out.filter((p) => p && p.trim().length));
        setCurrentPage(0);
      }
      document.body.removeChild(measurer);
    }

    paginate();

    // Re-paginate on resize (debounced)
    let t = null;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(paginate, 150);
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      if (t) clearTimeout(t);
    };
  }, [prefs.mode, prefs.width, prefs.size, prefs.lh, readerFont, contentHtml]);

  // Sync progress for page mode
  useEffect(() => {
    if (prefs.mode !== 'pages') return;
    const total = Math.max(1, pages.length);
    const pct = ((currentPage) / (total - 1)) * 100;
    setScrollProgress(isFinite(pct) ? pct : 0);
  }, [prefs.mode, currentPage, pages.length]);

  // Update current page based on horizontal scroll position
  useEffect(() => {
    if (prefs.mode !== 'pages') return;
    const el = pageStripRef.current;
    if (!el) return;
    const onScroll = () => {
      const pageW = prefs.width + 16; // page width + gap (approx)
      const idx = Math.round(el.scrollLeft / pageW);
      if (idx !== currentPage) setCurrentPage(Math.max(0, Math.min(pages.length - 1, idx)));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [prefs.mode, prefs.width, pages.length, currentPage]);

  // Keyboard navigation in page mode
  useEffect(() => {
    if (prefs.mode !== 'pages') return;
    const onKey = (e) => {
      if (e.key === 'ArrowRight') goTo(currentPage + 1);
      if (e.key === 'ArrowLeft')  goTo(currentPage - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prefs.mode, currentPage, pages.length]);

  const goTo = (idx) => {
    const el = pageStripRef.current;
    if (!el) return;
    const target = Math.max(0, Math.min(pages.length - 1, idx));
    setCurrentPage(target);
    const pageW = prefs.width + 16; // width + gap
    el.scrollTo({ left: target * pageW, behavior: 'smooth' });
  };

  // Shared reader style
  const baseReaderStyle = {
    fontFamily: readerFont,
    fontSize: `${prefs.size}px`,
    lineHeight: prefs.lh,
    textAlign: prefs.justify ? 'justify' : 'start',
    hyphens: prefs.justify ? 'auto' : 'manual',
  };

  // Styles for scroll mode
  const scrollStyle = {
    ...baseReaderStyle,
    padding: '1rem',
    maxHeight: '72vh',
    overflow: 'auto',
    maxWidth: `${prefs.width}px`,
    columnCount: prefs.mode === 'scroll' ? prefs.columns : 1,
    columnGap: prefs.columns > 1 ? '2.2rem' : 'initial',
    margin: '0 auto',
  };

  // Guard while loading
  if (!chapter) return <section className="container"><p className="muted">Loading chapter…</p></section>;

  const totalPages = Math.max(1, pages.length);

  return (
    <section className="container">
      <div className="surface" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Progress bar shows scroll percent or page progress */}
        <div className="progress"><span style={{ width: `${scrollProgress}%` }} /></div>

        <header style={{ padding: '1rem 1rem .5rem' }}>
          <Link to={`/stories/${storyId}`} className="muted">← Back to story</Link>
          <h1 style={{ marginTop: '.5rem' }}>{chapter.title}</h1>

          {/* Reader controls */}
          <div className="reader-controls" style={{ marginTop: '.6rem' }} aria-label="Reader settings">
            <label className="label" style={{ margin: 0 }}>Mode</label>
            <select
              className="select"
              value={prefs.mode}
              onChange={(e) => setPrefs((p) => ({ ...p, mode: e.target.value }))}
              aria-label="Reading mode"
            >
              {/* Renamed for clarity per your feedback */}
              <option value="scroll">Vertical (scroll up/down)</option>
              <option value="pages">Horizontal (pages left/right)</option>
            </select>

            <label className="label" style={{ margin: 0 }}>Font</label>
            <select
              className="select"
              value={prefs.font}
              onChange={(e) => setPrefs((p) => ({ ...p, font: e.target.value }))}
              aria-label="Font family"
            >
              <option value="serif">Serif (bookish)</option>
              <option value="sans">Sans (clean)</option>
              <option value="mono">Typewriter</option>
            </select>

            <label className="label" style={{ margin: 0 }}>Size</label>
            <input
              className="range"
              type="range" min="14" max="24" step="1"
              value={prefs.size}
              onChange={(e) => setPrefs((p) => ({ ...p, size: Number(e.target.value) }))}
            />
            <span className="muted" style={{ minWidth: 34, textAlign: 'right' }}>{prefs.size}px</span>

            <label className="label" style={{ margin: 0 }}>Line</label>
            <input
              className="range"
              type="range" min="1.5" max="2.2" step="0.05"
              value={prefs.lh}
              onChange={(e) => setPrefs((p) => ({ ...p, lh: Number(e.target.value) }))}
            />
            <span className="muted" style={{ minWidth: 38, textAlign: 'right' }}>{prefs.lh.toFixed(2)}</span>

            <label className="label" style={{ margin: 0 }}>Width</label>
            <input
              className="range"
              type="range" min="560" max="900" step="10"
              value={prefs.width}
              onChange={(e) => setPrefs((p) => ({ ...p, width: Number(e.target.value) }))}
            />
            <span className="muted" style={{ minWidth: 48, textAlign: 'right' }}>{prefs.width}px</span>

            <label className="label" style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={prefs.justify}
                onChange={(e) => setPrefs((p) => ({ ...p, justify: e.target.checked }))}
                style={{ marginRight: '.4rem' }}
              />
              Justify
            </label>

            <label className="label" style={{ margin: 0, opacity: prefs.mode === 'pages' ? .4 : 1 }}>
              <input
                type="checkbox"
                disabled={prefs.mode === 'pages'}
                checked={prefs.columns > 1}
                onChange={(e) => setPrefs((p) => ({ ...p, columns: e.target.checked ? 2 : 1 }))}
                style={{ marginRight: '.4rem' }}
              />
              Two columns
            </label>

            {prefs.mode === 'pages' && (
              <span className="muted" style={{ marginLeft: 'auto', fontWeight: 700 }}>
                Page {Math.min(currentPage + 1, totalPages)} / {totalPages}
              </span>
            )}
          </div>
        </header>

        {/* SCROLL MODE */}
        {prefs.mode === 'scroll' && (
          <div
            ref={scrollRef}
            className="reading"
            style={scrollStyle}
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        )}

        {/* PAGES MODE */}
        {prefs.mode === 'pages' && (
          <div className="pager-wrap" style={{ '--page-width': `${prefs.width}px`, '--page-height': `${pageHeight}px` }}>
            <div ref={pageStripRef} className="page-strip" aria-label="Pages">
              {pages.map((html, i) => (
                <div className="page" key={i}>
                  <div className="reading" style={baseReaderStyle} dangerouslySetInnerHTML={{ __html: html }} />
                </div>
              ))}
            </div>

            {/* arrows overlay */}
            <div className="pager-nav" aria-hidden="true">
              <button
                className="pager-btn"
                onClick={() => goTo(currentPage - 1)}
                disabled={currentPage <= 0}
                title="Previous page (←)"
              >
                ‹
              </button>
              <button
                className="pager-btn"
                onClick={() => goTo(currentPage + 1)}
                disabled={currentPage >= pages.length - 1}
                title="Next page (→)"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      <section style={{ marginTop: '1rem' }}>
        <h2>Comments</h2>
        {comments.length ? (
          <ul className="surface" style={{ padding: '1rem', listStyle: 'none', margin: 0 }}>
            {comments.map((c) => (
              <li key={c.id} style={{ padding: '.6rem 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{c.author_name || 'Reader'}</strong>
                  <span className="muted" style={{ fontSize: '.85rem' }}>
                    {c.created_at ? new Date(c.created_at).toLocaleString() : ''}
                  </span>
                </div>
                <p style={{ margin: '.25rem 0 0' }}>{c.content}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Be the first to comment.</p>
        )}

        {localStorage.getItem('access') && (
          <div className="surface" style={{ padding: '1rem', marginTop: '1rem' }}>
            <CommentForm chapterId={chapterId} onNewComment={(c) => setComments((prev) => [c, ...prev])} />
          </div>
        )}
      </section>
    </section>
  );
}
