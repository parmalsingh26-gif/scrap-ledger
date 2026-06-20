/**
 * NoteBook — Digital Notebook page for Scrap Ledger
 * Multiple books · Multiple pages per book · Canvas drawing
 * Pen colors, sizes, eraser, undo, clear · localStorage save
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';

// ─── Types ───────────────────────────────────────────────────────────────────
interface NbBook {
  id: string;
  name: string;
  coverColor: string;
  pageType: 'lines' | 'blank' | 'dots';
  pageCount: number;
  createdAt: string;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────
const BOOKS_KEY = 'nb_books_v1';
const pk = (bid: string, idx: number) => `nb_pg_${bid}_${idx}`;
function loadBooks(): NbBook[] {
  try { return JSON.parse(localStorage.getItem(BOOKS_KEY) || '[]'); } catch { return []; }
}
function saveBooks(b: NbBook[]) { localStorage.setItem(BOOKS_KEY, JSON.stringify(b)); }
function loadPageData(bid: string, idx: number): string | null { return localStorage.getItem(pk(bid, idx)); }
function savePageData(bid: string, idx: number, data: string) { localStorage.setItem(pk(bid, idx), data); }
function deleteBookPages(b: NbBook) {
  for (let i = 0; i < b.pageCount; i++) localStorage.removeItem(pk(b.id, i));
}
function nbId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ─── Constants ────────────────────────────────────────────────────────────────
const COLORS = [
  { v: '#111827', l: 'Black' }, { v: '#1d4ed8', l: 'Blue' },
  { v: '#dc2626', l: 'Red' },   { v: '#16a34a', l: 'Green' },
  { v: '#d97706', l: 'Amber' }, { v: '#7c3aed', l: 'Purple' },
  { v: '#0891b2', l: 'Teal' },  { v: '#be185d', l: 'Pink' },
];
const SIZES = [
  { v: 1.2, l: 'Hair-thin' }, { v: 2.5, l: 'Fine' }, { v: 5, l: 'Medium' },
  { v: 9, l: 'Bold' }, { v: 16, l: 'Thick' },
];
const COVER_COLORS = ['#1d4ed8','#dc2626','#16a34a','#d97706','#7c3aed','#0891b2','#be185d','#1e293b','#92400e','#065f46'];
const PAGE_TYPES = [
  { v: 'lines' as const, l: '📄 Lined' },
  { v: 'blank' as const, l: '⬜ Blank' },
  { v: 'dots'  as const, l: '⋯ Dotted' },
];
const FONTS = [
  { v: 'Arial', l: 'Normal' },
  { v: "'Caveat', cursive", l: 'Caveat' },
  { v: "'Dancing Script', cursive", l: 'Dancing' },
  { v: "'Indie Flower', cursive", l: 'Indie' },
  { v: "'Kalam', cursive", l: 'Kalam' },
  { v: "'Patrick Hand', cursive", l: 'Patrick' },
];
const CW = 760, CH = 1040, PAGE_BG = '#fffef7';

// ─── Draw page background ─────────────────────────────────────────────────────
function drawBg(ctx: CanvasRenderingContext2D, type: string) {
  ctx.fillStyle = PAGE_BG;
  ctx.fillRect(0, 0, CW, CH);
  if (type === 'lines') {
    ctx.strokeStyle = 'rgba(220,38,38,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(64, CH); ctx.stroke();
    ctx.strokeStyle = 'rgba(99,102,241,0.16)';
    ctx.lineWidth = 0.8;
    for (let y = 68; y < CH; y += 44) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke();
    }
  } else if (type === 'dots') {
    ctx.fillStyle = 'rgba(99,102,241,0.22)';
    for (let y = 40; y < CH; y += 36) {
      for (let x = 40; x < CW; x += 36) {
        ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function NoteBook() {
  const [books, setBooks] = useState<NbBook[]>(loadBooks);
  const [bookId, setBookId] = useState<string | null>(() => { const b = loadBooks(); return b[0]?.id ?? null; });
  const [pgIdx, setPgIdx] = useState(0);
  const [showBooks, setShowBooks] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COVER_COLORS[0]);
  const [newPgType, setNewPgType] = useState<NbBook['pageType']>('lines');

  const [tool, setTool] = useState<'pen' | 'eraser' | 'text'>('pen');
  const [color, setColor] = useState(COLORS[0].v);
  const [penSize, setPenSize] = useState(SIZES[1].v);
  const [font, setFont] = useState(FONTS[1].v);
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [activeText, setActiveText] = useState<{ x: number; y: number; text: string } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);

  const { isNotebookUnlocked, unlockNotebook } = useAuth();
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const book = books.find(b => b.id === bookId) ?? null;

  const doSave = useCallback(() => {
    if (!canvasRef.current || !bookId) return;
    savePageData(bookId, pgIdx, canvasRef.current.toDataURL('image/png'));
  }, [bookId, pgIdx]);

  const loadCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const bgCanvas = bgCanvasRef.current;
    if (!canvas || !bgCanvas || !bookId || !book) return;
    
    const bgCtx = bgCanvas.getContext('2d')!;
    drawBg(bgCtx, book.pageType);
    
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, CW, CH);
    
    const stored = loadPageData(bookId, pgIdx);
    if (stored) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = stored;
    }
    setUndoStack([]);
    setActiveText(null);
  }, [bookId, pgIdx, book]);

  useEffect(() => { loadCanvas(); }, [loadCanvas]);

  function getXY(e: React.MouseEvent | React.TouchEvent) {
    const r = canvasRef.current!.getBoundingClientRect();
    const sx = CW / r.width, sy = CH / r.height;
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: (t.clientX - r.left) * sx, y: (t.clientY - r.top) * sy };
    }
    return { x: ((e as React.MouseEvent).clientX - r.left) * sx, y: ((e as React.MouseEvent).clientY - r.top) * sy };
  }

  function onDown(e: React.MouseEvent | React.TouchEvent) {
    if (tool === 'text') {
      const pt = getXY(e);
      setActiveText({ x: pt.x, y: pt.y, text: '' });
      return;
    }
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    setUndoStack(prev => [...prev.slice(-19), ctx.getImageData(0, 0, CW, CH)]);
    drawing.current = true;
    lastPt.current = getXY(e);
  }

  function onMove(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current || tool === 'text') return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext('2d')!;
    const pt = getXY(e);
    const lp = lastPt.current!;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = penSize * 5;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = penSize;
    }
    
    const mx = (lp.x + pt.x) / 2, my = (lp.y + pt.y) / 2;
    ctx.beginPath();
    ctx.moveTo(lp.x, lp.y);
    ctx.quadraticCurveTo(lp.x, lp.y, mx, my);
    ctx.stroke();
    lastPt.current = pt;
  }

  function onUp() {
    if (!drawing.current) return;
    drawing.current = false; lastPt.current = null;
    doSave();
  }

  function stampText() {
    if (!activeText || !activeText.text.trim()) {
      setActiveText(null);
      return;
    }
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    setUndoStack(prev => [...prev.slice(-19), ctx.getImageData(0, 0, CW, CH)]);
    
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = `${penSize * 6 + 10}px ${font}`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    
    const lines = activeText.text.split('\n');
    let y = activeText.y;
    const lh = penSize * 6 + 14;
    const maxWidth = CW - activeText.x - 20;
    
    lines.forEach(line => {
      const words = line.split(' ');
      let currentLine = '';

      words.forEach(word => {
        const testLine = currentLine + word + ' ';
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine !== '') {
          ctx.fillText(currentLine, activeText.x, y);
          y += lh;
          currentLine = word + ' ';
        } else {
          currentLine = testLine;
        }
      });
      ctx.fillText(currentLine, activeText.x, y);
      y += lh;
    });
    
    setActiveText(null);
    doSave();
  }

  function undo() {
    if (undoStack.length === 0) return;
    canvasRef.current!.getContext('2d')!.putImageData(undoStack[undoStack.length - 1], 0, 0);
    setUndoStack(prev => prev.slice(0, -1));
    doSave();
  }

  function clearCanvas() {
    if (!window.confirm('Is page ko bilkul saaf karna chahte ho?')) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.clearRect(0, 0, CW, CH);
    doSave(); setUndoStack([]);
  }

  if (!isNotebookUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-surface/50">
        <span className="material-symbols-outlined text-[64px] text-primary mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
        <h2 className="text-2xl font-bold mb-6 text-on-surface">Notebook Locked</h2>
        <input 
          type="password" 
          maxLength={4}
          value={pinInput}
          onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
          placeholder="Enter PIN"
          className="glass-input rounded-xl py-3 px-6 text-center tracking-widest font-mono text-xl focus:outline-none focus:ring-2 focus:ring-primary/50 mb-4 bg-white/50 border border-outline-variant/30 shadow-sm"
        />
        {pinError && <p className="text-error mb-4 font-medium text-sm">Incorrect PIN</p>}
        <button 
          onClick={() => {
            if (!unlockNotebook(pinInput)) {
              setPinError(true);
              setTimeout(() => setPinError(false), 2000);
            }
          }}
          className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition shadow-sm"
        >
          Unlock
        </button>
      </div>
    );
  }

  function addPage() {
    if (!book) return;
    doSave();
    const updated = books.map(b => b.id === book.id ? { ...b, pageCount: b.pageCount + 1 } : b);
    setBooks(updated); saveBooks(updated);
    setPgIdx(book.pageCount);
  }

  function goPage(next: number) { doSave(); setPgIdx(next); }

  function createBook() {
    if (!newName.trim()) { alert('Book ka naam likho'); return; }
    const nb: NbBook = { id: nbId(), name: newName.trim(), coverColor: newColor, pageType: newPgType, pageCount: 1, createdAt: new Date().toLocaleDateString('en-IN') };
    const updated = [...books, nb];
    setBooks(updated); saveBooks(updated);
    setBookId(nb.id); setPgIdx(0);
    setNewName(''); setShowNew(false); setShowBooks(false);
  }

  function removeBook(b: NbBook, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`"${b.name}" aur uske ${b.pageCount} pages permanently delete ho jayenge. Pakka?`)) return;
    deleteBookPages(b);
    const updated = books.filter(x => x.id !== b.id);
    setBooks(updated); saveBooks(updated);
    if (bookId === b.id) { setBookId(updated[0]?.id ?? null); setPgIdx(0); }
  }

  return (
    <div className="nb-wrapper">
      {/* ── Header ── */}
      <div className="nb-header">
        <button className="nb-books-btn" onClick={() => setShowBooks(true)}>
          <span className="nb-book-dot" style={{ background: book?.coverColor ?? '#888' }} />
          <span className="nb-books-label">{book ? book.name : 'Book chuno'}</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
        </button>

        <div className="nb-page-nav">
          <button className="nb-nav-btn" disabled={pgIdx === 0} onClick={() => goPage(pgIdx - 1)}>‹</button>
          <span className="nb-page-label">
            <strong>{pgIdx + 1}</strong>
            <span className="nb-page-sep">/</span>
            {book?.pageCount ?? 1}
          </span>
          <button className="nb-nav-btn" disabled={!book || pgIdx >= book.pageCount - 1} onClick={() => goPage(pgIdx + 1)}>›</button>
          <button className="nb-add-page-btn" onClick={addPage} disabled={!book}>＋ Page</button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="nb-toolbar">
        <div className="nb-tgrp">
          <button className={`nb-tool${tool === 'pen' ? ' on' : ''}`} onClick={() => setTool('pen')}>
            ✏️ Pen
          </button>
          <button className={`nb-tool${tool === 'text' ? ' on' : ''}`} onClick={() => setTool('text')}>
            🔤 Text
          </button>
          <button className={`nb-tool${tool === 'eraser' ? ' on' : ''}`} onClick={() => setTool('eraser')}>
            ⬜ Eraser
          </button>
        </div>

        {tool === 'text' && (
          <div className="nb-tgrp">
            <select className="nb-font-sel" value={font} onChange={e => setFont(e.target.value)}>
              {FONTS.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
            </select>
          </div>
        )}

        <div className="nb-tgrp nb-colors">
          {COLORS.map(c => (
            <button key={c.v}
              className={`nb-clr-dot${color === c.v && tool === 'pen' ? ' selected' : ''}`}
              style={{ '--clr': c.v } as React.CSSProperties}
              title={c.l}
              onClick={() => { setColor(c.v); setTool('pen'); }}
            />
          ))}
        </div>

        <div className="nb-tgrp nb-sizes">
          {SIZES.map(s => (
            <button key={s.v}
              className={`nb-sz-btn${penSize === s.v ? ' on' : ''}`}
              title={s.l}
              onClick={() => setPenSize(s.v)}
            >
              <span className="nb-sz-dot" style={{
                width: Math.min(s.v * 2.8, 22),
                height: Math.min(s.v * 2.8, 22),
                background: tool === 'pen' ? color : '#999'
              }} />
            </button>
          ))}
        </div>

        <div className="nb-tgrp">
          <button className="nb-act-btn" onClick={undo} disabled={undoStack.length === 0}>↩ Undo</button>
          <button className="nb-act-btn danger" onClick={clearCanvas}>🗑 Clear</button>
        </div>
      </div>

      {/* ── Canvas Area ── */}
      <div className="nb-canvas-area">
        {!book ? (
          <div className="nb-no-book">
            <div style={{ fontSize: 52 }}>📚</div>
            <div className="nb-no-title">Koi book nahi hai</div>
            <div className="nb-no-sub">Apni pehli notebook banao</div>
            <button className="nb-cta-btn" onClick={() => setShowNew(true)}>＋ Nayi Book Banao</button>
          </div>
        ) : (
          <div className="nb-paper-outer">
            <canvas ref={bgCanvasRef} className="nb-canvas-bg" width={CW} height={CH} />
            <canvas
              ref={canvasRef}
              className="nb-canvas"
              width={CW} height={CH}
              onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
              onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
              style={{ cursor: tool === 'text' ? 'text' : tool === 'eraser' ? 'cell' : 'crosshair' }}
            />
            {activeText && (
              <div className="nb-text-overlay">
                <textarea
                  className="nb-text-input"
                  autoFocus
                  value={activeText.text}
                  onChange={e => setActiveText({ ...activeText, text: e.target.value })}
                  style={{
                    left: `${(activeText.x / CW) * 100}%`,
                    top: `${(activeText.y / CH) * 100}%`,
                    width: `calc(100% - ${(activeText.x / CW) * 100}%)`,
                    color: color,
                    fontFamily: font,
                    fontSize: `${(penSize * 6 + 10) * (canvasRef.current ? canvasRef.current.getBoundingClientRect().width / CW : 1)}px`,
                  }}
                />
                <button 
                  className="nb-text-done-btn"
                  onClick={stampText}
                  style={{
                    left: `${(activeText.x / CW) * 100}%`,
                    top: `${(activeText.y / CH) * 100}%`
                  }}
                >
                  Done
                </button>
              </div>
            )}
            <div className="nb-page-stamp">{pgIdx + 1}</div>
          </div>
        )}
      </div>

      {/* ── Book List Sheet ── */}
      {showBooks && (
        <div className="nb-overlay" onClick={() => setShowBooks(false)}>
          <div className="nb-sheet" onClick={e => e.stopPropagation()}>
            <div className="nb-sheet-handle" />
            <div className="nb-sheet-head">
              <span className="nb-sheet-title">📚 Meri Books</span>
              <button className="nb-close-btn" onClick={() => setShowBooks(false)}>✕</button>
            </div>

            <div className="nb-book-list">
              {books.length === 0 && <div className="nb-list-empty">Abhi koi book nahi — banao!</div>}
              {books.map(b => (
                <div key={b.id}
                  className={`nb-book-row${bookId === b.id ? ' active' : ''}`}
                  onClick={() => { doSave(); setBookId(b.id); setPgIdx(0); setShowBooks(false); }}
                >
                  <div className="nb-book-spine" style={{ background: b.coverColor }} />
                  <div className="nb-book-info">
                    <div className="nb-book-name">{b.name}</div>
                    <div className="nb-book-meta">{b.pageCount} pages · {PAGE_TYPES.find(p => p.v === b.pageType)?.l} · {b.createdAt}</div>
                  </div>
                  {bookId === b.id && <span className="nb-active-badge">Khuli hai</span>}
                  <button className="nb-del-btn" onClick={e => removeBook(b, e)} title="Delete book">🗑️</button>
                </div>
              ))}
            </div>

            <button className="nb-sheet-cta" onClick={() => { setShowBooks(false); setShowNew(true); }}>＋ Nayi Book Banao</button>
          </div>
        </div>
      )}

      {/* ── New Book Sheet ── */}
      {showNew && (
        <div className="nb-overlay" onClick={() => setShowNew(false)}>
          <div className="nb-sheet" onClick={e => e.stopPropagation()}>
            <div className="nb-sheet-handle" />
            <div className="nb-sheet-head">
              <span className="nb-sheet-title">📖 Nayi Book</span>
              <button className="nb-close-btn" onClick={() => setShowNew(false)}>✕</button>
            </div>

            <label className="nb-label">Book ka naam *</label>
            <input className="nb-input" placeholder="e.g. Personal Diary, Scrap Notes, Ideas..."
              value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createBook()} autoFocus />

            <label className="nb-label">Cover Color</label>
            <div className="nb-color-row">
              {COVER_COLORS.map(c => (
                <button key={c} className={`nb-cov-dot${newColor === c ? ' sel' : ''}`}
                  style={{ background: c }} onClick={() => setNewColor(c)} />
              ))}
            </div>

            <label className="nb-label">Page Type</label>
            <div className="nb-type-row">
              {PAGE_TYPES.map(pt => (
                <button key={pt.v}
                  className={`nb-type-btn${newPgType === pt.v ? ' on' : ''}`}
                  onClick={() => setNewPgType(pt.v)}>{pt.l}</button>
              ))}
            </div>

            {/* Cover preview */}
            <div className="nb-cover-preview" style={{ background: newColor }}>
              <div className="nb-cover-lines">
                {[0,1,2,3,4].map(i => <div key={i} className="nb-cover-line" />)}
              </div>
              <div className="nb-cover-label">{newName || 'Book Name'}</div>
            </div>

            <button className="nb-sheet-cta" onClick={createBook} style={{ marginTop: 14 }}>📖 Book Banao</button>
          </div>
        </div>
      )}
    </div>
  );
}
