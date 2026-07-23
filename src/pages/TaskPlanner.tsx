/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Kal Kya Karna Hai — Task Planner
 * Full-featured task & reminder system integrated into Scrap Ledger.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ReactElement } from 'react';
import { createPortal } from 'react-dom';

// ===================== TYPES =====================
export interface Subtask {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  note: string;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM
  priority: 'high' | 'medium' | 'low';
  category: string;
  recur: 'none' | 'daily' | 'weekly' | 'monthly';
  subtasks: Subtask[];
  reminders: string[]; // ISO datetime strings
  completed: boolean;
  createdAt: string;
}

type ViewTab = 'today' | 'upcoming' | 'calendar' | 'all';

// ===================== CONSTANTS =====================
const STORAGE_KEY = 'kkh_tasks_scrap_v1';
const FIRED_KEY = 'kkh_fired_scrap_v1';

const CATEGORIES = [
  { id: 'Scrap Office', label: '🏭 Scrap Office', color: '#6EA8E8', bg: 'rgba(110,168,232,0.14)' },
  { id: 'Supplier Call', label: '📞 Supplier Call', color: '#F4A736', bg: 'rgba(244,167,54,0.14)' },
  { id: 'Transport', label: '🚛 Transport', color: '#6FCF97', bg: 'rgba(111,207,151,0.14)' },
  { id: 'Work', label: '💼 Work', color: '#6EA8E8', bg: 'rgba(110,168,232,0.14)' },
  { id: 'Personal', label: '🏠 Personal', color: '#6FCF97', bg: 'rgba(111,207,151,0.14)' },
  { id: 'Study', label: '📚 Study', color: '#c9a8ff', bg: 'rgba(201,168,255,0.14)' },
  { id: 'Health', label: '🏃 Health', color: '#E85D75', bg: 'rgba(232,93,117,0.14)' },
];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// ===================== HELPERS =====================
function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function thisWeekEndStr(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = 6 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function formatTime(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${ampm}`;
}
function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tmrw = new Date(today); tmrw.setDate(today.getDate() + 1);
  if (d.getTime() === today.getTime()) return 'Aaj';
  if (d.getTime() === tmrw.getTime()) return 'Kal';
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}
function isOverdue(t: Task): boolean {
  if (t.completed) return false;
  return new Date(`${t.date}T${t.time}`) < new Date();
}
function loadTasks(): Task[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveTasks(tasks: Task[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}
function loadFired(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) || '[]')); } catch { return new Set(); }
}
function saveFired(fired: Set<string>): void {
  localStorage.setItem(FIRED_KEY, JSON.stringify([...fired]));
}

// ===================== FUTURISTIC CLOCK =====================
function FuturisticClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const h = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const greeting = h < 12 ? 'GOOD MORNING' : h < 17 ? 'GOOD AFTERNOON' : 'GOOD EVENING';

  const hPct = (h % 12) / 12;
  const mPct = m / 60;
  const sPct = s / 60;
  const CX = 100, CY = 100;

  const arcPath = (pct, r) => {
    if (pct <= 0) return '';
    const p = Math.min(pct, 0.9999);
    const angle = p * 360 - 90;
    const rad = angle * (Math.PI / 180);
    const x = CX + r * Math.cos(rad);
    const y = CY + r * Math.sin(rad);
    const large = p > 0.5 ? 1 : 0;
    return `M ${CX},${CY - r} A ${r},${r} 0 ${large},1 ${x.toFixed(3)},${y.toFixed(3)}`;
  };

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const angle = (i / 60) * 360 - 90;
    const rad = angle * (Math.PI / 180);
    const major = i % 5 === 0;
    const r1 = major ? 85 : 88;
    return {
      x1: (CX + r1 * Math.cos(rad)).toFixed(2),
      y1: (CY + r1 * Math.sin(rad)).toFixed(2),
      x2: (CX + 93 * Math.cos(rad)).toFixed(2),
      y2: (CY + 93 * Math.sin(rad)).toFixed(2),
      major,
      lit: i < Math.round(sPct * 60),
    };
  });

  const DAY_NAMES = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];

  return (
    <div className="kkh-clock-card">
      <div className="kkh-hud-tl"/><div className="kkh-hud-tr"/>
      <div className="kkh-hud-bl"/><div className="kkh-hud-br"/>
      <div className="kkh-clock-blob kkh-blob-1"/>
      <div className="kkh-clock-blob kkh-blob-2"/>
      <div className="kkh-clock-scan"/>
      <div className="kkh-clock-inner">
        <div className="kkh-clock-svg-wrap">
          <svg width="200" height="200" viewBox="0 0 200 200">
            <defs>
              <linearGradient id="hGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00d4ff"/><stop offset="100%" stopColor="#0055ff"/>
              </linearGradient>
              <linearGradient id="mGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00ffb3"/><stop offset="100%" stopColor="#00cc66"/>
              </linearGradient>
              <linearGradient id="sGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff9500"/><stop offset="100%" stopColor="#ff2d55"/>
              </linearGradient>
              <radialGradient id="coreGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#c0eeff"/><stop offset="55%" stopColor="#00d4ff"/><stop offset="100%" stopColor="#0033cc"/>
              </radialGradient>
            </defs>

            <circle cx={CX} cy={CY} r="97" fill="none" stroke="rgba(0,212,255,0.08)" strokeWidth="0.8" strokeDasharray="2 5"/>
            <circle cx={CX} cy={CY} r="96" fill="none" stroke="rgba(0,212,255,0.04)" strokeWidth="4"/>

            {ticks.map((tk, i) => (
              <line key={i} x1={tk.x1} y1={tk.y1} x2={tk.x2} y2={tk.y2}
                stroke={tk.lit ? '#ff9500' : tk.major ? 'rgba(0,212,255,0.6)' : 'rgba(0,212,255,0.15)'}
                strokeWidth={tk.major ? 1.8 : 0.8}
                style={tk.lit ? {filter:'drop-shadow(0 0 3px #ff9500)'} : {}}
              />
            ))}

            <circle cx={CX} cy={CY} r="76" fill="none" stroke="rgba(0,212,255,0.06)" strokeWidth="8"/>
            <circle cx={CX} cy={CY} r="62" fill="none" stroke="rgba(0,255,179,0.06)" strokeWidth="7"/>
            <circle cx={CX} cy={CY} r="48" fill="none" stroke="rgba(255,149,0,0.06)" strokeWidth="6"/>

            {hPct > 0 && <path d={arcPath(hPct, 76)} fill="none" stroke="url(#hGrad)" strokeWidth="8" strokeLinecap="round"
              style={{filter:'drop-shadow(0 0 8px #00d4ff) drop-shadow(0 0 16px #00d4ff55)'}}/>}
            {mPct > 0 && <path d={arcPath(mPct, 62)} fill="none" stroke="url(#mGrad)" strokeWidth="7" strokeLinecap="round"
              style={{filter:'drop-shadow(0 0 7px #00ffb3) drop-shadow(0 0 14px #00ffb344)'}}/>}
            {sPct > 0 && <path d={arcPath(sPct, 48)} fill="none" stroke="url(#sGrad)" strokeWidth="6" strokeLinecap="round"
              style={{filter:'drop-shadow(0 0 7px #ff9500) drop-shadow(0 0 14px #ff950055)', transition:'none'}}/>}

            <circle cx={CX} cy={CY} r="34" fill="rgba(0,6,24,0.92)" stroke="rgba(0,212,255,0.22)" strokeWidth="1"/>
            <circle cx={CX} cy={CY} r="25" fill="rgba(0,4,18,0.95)" stroke="rgba(0,212,255,0.10)" strokeWidth="0.6"/>

            <circle cx={CX} cy={CY} r="10" fill="url(#coreGrad)" style={{filter:'drop-shadow(0 0 12px #00d4ff)'}}>
              <animate attributeName="r" values="9;13;9" dur="2s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite"/>
            </circle>
            <circle cx={CX} cy={CY} r="3.5" fill="#e8f8ff">
              <animate attributeName="opacity" values="0.5;1;0.5" dur="1s" repeatCount="indefinite"/>
            </circle>
          </svg>
        </div>

        <div className="kkh-clock-right">
          <div className="kkh-clock-status-bar">
            <span className="kkh-clock-status-dot"/>
            <span className="kkh-clock-status-txt">SYSTEM ONLINE</span>
            <span className="kkh-clock-status-line"/>
          </div>

          <div className="kkh-clock-greeting">{greeting}</div>

          <div className="kkh-clock-time">
            <span className="kkh-clock-hm">{pad(h12)}:{pad(m)}</span>
            <div className="kkh-clock-sec-col">
              <span className="kkh-clock-blink">:</span>
              <span className="kkh-clock-sec">{pad(s)}</span>
              <span className="kkh-clock-ampm">{ampm}</span>
            </div>
          </div>

          <div className="kkh-clock-date-row">
            <div className="kkh-clock-day">{DAY_NAMES[now.getDay()]}</div>
            <div className="kkh-clock-datenum">
              {now.getDate()} {MONTH_NAMES[now.getMonth()].toUpperCase()} {now.getFullYear()}
            </div>
          </div>

          <div className="kkh-clock-legend">
            {[
              {label:'HRS', color:'#00d4ff'},
              {label:'MIN', color:'#00ffb3'},
              {label:'SEC', color:'#ff9500'},
            ].map(({label,color}) => (
              <div key={label} className="kkh-legend-item">
                <span className="kkh-legend-bar" style={{background:color,boxShadow:`0 0 8px ${color}`}}/>
                <span style={{color}}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


// ===================== MAIN COMPONENT =====================
export function TaskPlanner() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [view, setView] = useState<ViewTab>('today');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [searchQ, setSearchQ] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calSelectedDate, setCalSelectedDate] = useState<string | null>(null);
  const [toast, setToast] = useState<string>('');
  const [toastVisible, setToastVisible] = useState(false);
  const [overdueAlert, setOverdueAlert] = useState<string>('');
  const [selectedBulk, setSelectedBulk] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const firedRef = useRef<Set<string>>(loadFired());
  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good Morning 🌅' : h < 17 ? 'Good Afternoon ☀️' : 'Good Evening 🌙';
  })();

  // Save whenever tasks change
  useEffect(() => { saveTasks(tasks); }, [tasks]);

  // Toast helper
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }, []);

  // Notification permission
  const requestNotif = useCallback(async () => {
    if (!('Notification' in window)) { showToast('❌ Browser notifications support nahi hai'); return; }
    const p = await Notification.requestPermission();
    showToast(p === 'granted' ? '🔔 Notifications on ho gayi!' : '❌ Permission nahi mili');
  }, [showToast]);

  function fireNotif(title: string, body: string) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(title, { body, tag: title }); } catch { /* noop */ }
    }
  }

  // Check due reminders every 20s
  useEffect(() => {
    function check() {
      const now = new Date();
      tasks.forEach(t => {
        if (t.completed) return;
        const times = [{ dt: `${t.date}T${t.time}`, label: t.title }];
        (t.reminders || []).forEach(r => times.push({ dt: r, label: t.title + ' (reminder)' }));
        times.forEach(item => {
          const target = new Date(item.dt);
          const diff = now.getTime() - target.getTime();
          const key = t.id + '|' + item.dt;
          if (diff >= 0 && diff < 60000 && !firedRef.current.has(key)) {
            fireNotif('⏰ ' + item.label, formatTime(t.time) + ' — ' + (t.note || 'Yeh karna hai!'));
            firedRef.current.add(key);
            saveFired(firedRef.current);
            setOverdueAlert(`⏰ ${t.title} — ${formatTime(t.time)} ka time ho gaya!`);
            setTimeout(() => setOverdueAlert(''), 8000);
          }
        });
      });
    }
    check();
    const interval = setInterval(check, 20000);
    return () => clearInterval(interval);
  }, [tasks]);

  // Overdue alert on open
  useEffect(() => {
    const overdue = tasks.filter(t => !t.completed && isOverdue(t));
    if (overdue.length > 0) {
      setOverdueAlert(`⚠️ ${overdue.length} task miss ho gaye — ${overdue.slice(0, 2).map(t => t.title).join(', ')}${overdue.length > 2 ? '...' : ''}`);
    }
    // Soft notification prompt
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => showToast('🔔 Notifications on karne ke liye bell icon dabao'), 2000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===================== TASK CRUD =====================
  function addTask(data: Omit<Task, 'id' | 'completed' | 'createdAt'>) {
    const newTask: Task = { id: uid(), completed: false, createdAt: new Date().toISOString(), ...data };
    setTasks(prev => [...prev, newTask]);
    showToast('✅ Task save ho gaya!');
  }

  function updateTask(id: string, data: Omit<Task, 'id' | 'completed' | 'createdAt'>) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
    showToast('✏️ Task update ho gaya!');
  }

  function deleteTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
    showToast('🗑️ Task delete ho gaya');
  }

  function toggleComplete(id: string) {
    const task = tasks.find(t => t.id === id);
    const nowComplete = task ? !task.completed : false;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    if (nowComplete) {
      showToast('✅ Task complete! "Sab" tab mein dekhein');
    }
  }


  function toggleSubtask(taskId: string, subId: string) {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      return { ...t, subtasks: t.subtasks.map(s => s.id === subId ? { ...s, done: !s.done } : s) };
    }));
  }

  function bulkComplete() {
    setTasks(prev => prev.map(t => selectedBulk.has(t.id) ? { ...t, completed: true } : t));
    setSelectedBulk(new Set());
    setBulkMode(false);
    showToast(`✅ ${selectedBulk.size} tasks complete ho gaye`);
  }

  function bulkDelete() {
    if (!confirm(`Sach mein ${selectedBulk.size} tasks delete karne hain?`)) return;
    setTasks(prev => prev.filter(t => !selectedBulk.has(t.id)));
    setSelectedBulk(new Set());
    setBulkMode(false);
    showToast(`🗑️ ${selectedBulk.size} tasks delete ho gaye`);
  }

  function exportTasks() {
    let text = '📋 MERE TASKS — Scrap Ledger\n\n';
    [...tasks].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).forEach(t => {
      text += `${t.completed ? '[✓]' : '[ ]'} ${t.title}\n`;
      text += `   📅 ${t.date} ⏰ ${formatTime(t.time)} | ${t.category} | ${t.priority}\n`;
      if (t.note) text += `   📝 ${t.note}\n`;
      if (t.subtasks?.length) text += `   Steps: ${t.subtasks.map(s => `${s.done ? '✓' : '○'} ${s.text}`).join(', ')}\n`;
      text += '\n';
    });
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mere-tasks.txt';
    a.click();
    showToast('📥 Export ho gaya!');
  }

  function clearAll() {
    if (!confirm('Sach mein sab tasks delete karne hain? Ye undo nahi ho sakta.')) return;
    setTasks([]);
    showToast('🗑️ Sab clear ho gaya');
  }

  // ===================== FILTERING =====================
  function getFiltered(): Task[] {
    let list = [...tasks];
    if (catFilter !== 'all') list = list.filter(t => t.category === catFilter);
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      list = list.filter(t => t.title.toLowerCase().includes(q) || t.note.toLowerCase().includes(q));
    }
    const today = todayStr();
    // Today & Upcoming: hide completed so list stays clean
    if (view === 'today') list = list.filter(t => (t.date === today || isOverdue(t)) && !t.completed);
    else if (view === 'upcoming') list = list.filter(t => t.date > today && !t.completed);
    // 'all' and 'calendar' show everything
    list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    return list;
  }

  // ===================== PROGRESS =====================
  const todayTasks = tasks.filter(t => t.date === todayStr());
  const todayDone = todayTasks.filter(t => t.completed).length;
  const todayTotal = todayTasks.length;
  const progressPct = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;

  // ===================== CALENDAR STATS =====================
  function getMonthStreak(): number {
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 365; i++) {
      const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const dayTasks = tasks.filter(t => t.date === ds);
      if (dayTasks.length === 0) { d.setDate(d.getDate() - 1); continue; }
      if (dayTasks.every(t => t.completed)) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return streak;
  }

  // ===================== CALENDAR RENDER =====================
  function renderCalendar() {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const today = todayStr();
    const tasksByDate: Record<string, Task[]> = {};
    tasks.forEach(t => { (tasksByDate[t.date] = tasksByDate[t.date] || []).push(t); });

    const cells: ReactElement[] = [];
    ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach(d => {
      cells.push(<div key={`dow-${d}`} className="kkh-cal-dow">{d}</div>);
    });
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="kkh-cal-day kkh-cal-empty" />);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${pad(calMonth + 1)}-${pad(d)}`;
      const dayTasks = tasksByDate[dateStr] || [];
      const isToday = dateStr === today;
      const isSel = dateStr === calSelectedDate;
      const dots = dayTasks.slice(0, 3).map((t, i) => {
        const color = t.completed ? '#6FCF97' : isOverdue(t) ? '#E85D75' : '#F4A736';
        return <span key={i} className="kkh-cdot" style={{ background: color }} />;
      });
      cells.push(
        <div
          key={dateStr}
          className={`kkh-cal-day${isToday ? ' kkh-cal-today' : ''}${isSel ? ' kkh-cal-selected' : ''}`}
          onClick={() => setCalSelectedDate(dateStr)}
        >
          {d}
          <div className="kkh-dot-row">{dots}</div>
        </div>
      );
    }
    return cells;
  }

  const filteredTasks = getFiltered();
  const overdueTasks = filteredTasks.filter(t => isOverdue(t));
  const normalTasks = filteredTasks.filter(t => !isOverdue(t));

  // Group upcoming/all by date
  const grouped: Record<string, Task[]> = {};
  if (view === 'upcoming' || view === 'all') {
    normalTasks.forEach(t => { (grouped[t.date] = grouped[t.date] || []).push(t); });
  }

  const monthTasks = tasks.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    return d.getMonth() === calMonth && d.getFullYear() === calYear;
  });
  const monthCompleted = monthTasks.filter(t => t.completed).length;
  const monthMissed = monthTasks.filter(t => isOverdue(t)).length;

  const calDayTasks = calSelectedDate
    ? tasks.filter(t => t.date === calSelectedDate).sort((a, b) => a.time.localeCompare(b.time))
    : [];

  return (
    <div className="kkh-wrapper animate-fade-in">
      {/* Toast */}
      {toastVisible && (
        <div className="kkh-toast kkh-toast-show">{toast}</div>
      )}

      {/* Overdue Alert Banner */}
      {overdueAlert && (
        <div className="kkh-alert-banner">
          <span style={{ fontSize: 18 }}>🚨</span>
          <span style={{ flex: 1 }}>{overdueAlert}</span>
          <button className="kkh-close-btn" onClick={() => setOverdueAlert('')}>✕</button>
        </div>
      )}

      {/* Header */}
      <div className="kkh-header">
        {/* Futuristic Clock */}
        <FuturisticClock />

        <div className="kkh-header-top" style={{ marginTop: 14 }}>
          <div style={{ flex: 1 }} />
          <div className="kkh-header-icons">
            <button className="kkh-icon-btn" title="Search/Filter" onClick={() => setShowSearch(s => !s)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
            </button>
            <button
              className="kkh-icon-btn"
              title="Notification on karo"
              onClick={requestNotif}
              style={Notification.permission !== 'granted' ? { color: '#F4A736' } : {}}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
              </svg>
              {Notification.permission !== 'granted' && <span className="kkh-notif-dot" />}
            </button>
            <button
              className="kkh-icon-btn"
              title="Bulk Mode"
              style={bulkMode ? { background: 'rgba(244,167,54,0.18)', color: '#F4A736' } : {}}
              onClick={() => { setBulkMode(b => !b); setSelectedBulk(new Set()); }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="5" width="4" height="4" rx="1"/><rect x="3" y="11" width="4" height="4" rx="1"/>
                <rect x="3" y="17" width="4" height="4" rx="1"/><path d="M11 7h10M11 13h10M11 19h10"/>
              </svg>
            </button>
            <button className="kkh-icon-btn" title="Export" onClick={exportTasks}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Search + Filter */}
        {showSearch && (
          <div className="kkh-filter-bar">
            <input
              type="text"
              className="kkh-search-input"
              placeholder="Task dhundo..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
            />
            <div className="kkh-chips-row">
              {['all', ...CATEGORIES.map(c => c.id)].map(cat => (
                <div
                  key={cat}
                  className={`kkh-chip${catFilter === cat ? ' kkh-chip-active' : ''}`}
                  onClick={() => setCatFilter(cat)}
                >
                  {cat === 'all' ? 'Sab' : cat}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress Strip */}
        <div className="kkh-progress-strip">
          <div className="kkh-progress-label">
            {todayDone}/{todayTotal} aaj poora {progressPct > 0 && `(${progressPct}%)`}
          </div>
          <div className="kkh-progress-track">
            <div
              className="kkh-progress-fill"
              style={{ width: `${progressPct}%`, background: progressPct === 100 ? '#6FCF97' : 'linear-gradient(90deg,#F4A736,#f7c06e)' }}
            />
          </div>
        </div>

        {/* View Tabs */}
        <div className="kkh-tabs">
          {(['today', 'upcoming', 'calendar', 'all'] as ViewTab[]).map(v => (
            <div
              key={v}
              className={`kkh-tab${view === v ? ' kkh-tab-active' : ''}`}
              onClick={() => setView(v)}
            >
              {v === 'today' ? 'Aaj' : v === 'upcoming' ? 'Aage' : v === 'calendar' ? 'Calendar' : 'Sab'}
            </div>
          ))}
        </div>
      </div>

      {/* Bulk Mode Bar */}
      {bulkMode && selectedBulk.size > 0 && (
        <div className="kkh-bulk-bar">
          <span>{selectedBulk.size} select kiye</span>
          <button className="kkh-bulk-btn kkh-bulk-complete" onClick={bulkComplete}>✅ Complete Karo</button>
          <button className="kkh-bulk-btn kkh-bulk-delete" onClick={bulkDelete}>🗑️ Delete Karo</button>
        </div>
      )}

      {/* Content */}
      <div className="kkh-content">
        {view === 'calendar' ? (
          /* Calendar View */
          <div className="kkh-calendar-view">
            <div className="kkh-cal-header">
              <button className="kkh-icon-btn" onClick={() => {
                let m = calMonth - 1, y = calYear;
                if (m < 0) { m = 11; y--; }
                setCalMonth(m); setCalYear(y);
              }}>‹</button>
              <div className="kkh-cal-month">{MONTH_NAMES[calMonth]} {calYear}</div>
              <button className="kkh-icon-btn" onClick={() => {
                let m = calMonth + 1, y = calYear;
                if (m > 11) { m = 0; y++; }
                setCalMonth(m); setCalYear(y);
              }}>›</button>
            </div>

            <div className="kkh-cal-grid">{renderCalendar()}</div>

            {/* Month Stats */}
            <div className="kkh-stats-row">
              <div className="kkh-stat-box">
                <div className="kkh-stat-num" style={{ color: '#6FCF97' }}>{monthCompleted}</div>
                <div className="kkh-stat-label">Complete (mahina)</div>
              </div>
              <div className="kkh-stat-box">
                <div className="kkh-stat-num" style={{ color: '#E85D75' }}>{monthMissed}</div>
                <div className="kkh-stat-label">Missed (mahina)</div>
              </div>
              <div className="kkh-stat-box">
                <div className="kkh-stat-num" style={{ color: '#F4A736' }}>{getMonthStreak()}</div>
                <div className="kkh-stat-label">Din Streak 🔥</div>
              </div>
            </div>

            {/* Calendar Day Tasks */}
            {calSelectedDate && (
              <div style={{ marginTop: 18 }}>
                <div className="kkh-section-label">{formatDateLabel(calSelectedDate)}</div>
                {calDayTasks.length === 0 ? (
                  <div className="kkh-empty-state">
                    <span className="kkh-empty-emoji">📅</span>
                    <div className="kkh-empty-sub">Is din koi task nahi hai</div>
                  </div>
                ) : (
                  <div className="kkh-timeline">
                    {calDayTasks.map(t => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        overdue={isOverdue(t)}
                        bulkMode={bulkMode}
                        selected={selectedBulk.has(t.id)}
                        onToggle={() => toggleComplete(t.id)}
                        onEdit={() => { setEditingTask(t); setShowModal(true); }}
                        onDelete={() => deleteTask(t.id)}
                        onSelectBulk={() => {
                          setSelectedBulk(prev => {
                            const next = new Set(prev);
                            next.has(t.id) ? next.delete(t.id) : next.add(t.id);
                            return next;
                          });
                        }}
                        onToggleSubtask={(sid) => toggleSubtask(t.id, sid)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* List View */
          <div>
            {overdueTasks.length > 0 && (
              <>
                <div className="kkh-section-label kkh-section-overdue">
                  Miss Ho Gaye ({overdueTasks.length})
                </div>
                <div className="kkh-timeline">
                  {overdueTasks.map(t => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      overdue
                      bulkMode={bulkMode}
                      selected={selectedBulk.has(t.id)}
                      onToggle={() => toggleComplete(t.id)}
                      onEdit={() => { setEditingTask(t); setShowModal(true); }}
                      onDelete={() => deleteTask(t.id)}
                      onSelectBulk={() => {
                        setSelectedBulk(prev => {
                          const next = new Set(prev);
                          next.has(t.id) ? next.delete(t.id) : next.add(t.id);
                          return next;
                        });
                      }}
                      onToggleSubtask={(sid) => toggleSubtask(t.id, sid)}
                    />
                  ))}
                </div>
              </>
            )}

            {normalTasks.length > 0 ? (
              view === 'upcoming' || view === 'all' ? (
                Object.keys(grouped).sort().map(date => (
                  <div key={date}>
                    <div className="kkh-section-label">{formatDateLabel(date)}</div>
                    <div className="kkh-timeline">
                      {grouped[date].map(t => (
                        <TaskCard
                          key={t.id}
                          task={t}
                          overdue={isOverdue(t)}
                          bulkMode={bulkMode}
                          selected={selectedBulk.has(t.id)}
                          onToggle={() => toggleComplete(t.id)}
                          onEdit={() => { setEditingTask(t); setShowModal(true); }}
                          onDelete={() => deleteTask(t.id)}
                          onSelectBulk={() => {
                            setSelectedBulk(prev => {
                              const next = new Set(prev);
                              next.has(t.id) ? next.delete(t.id) : next.add(t.id);
                              return next;
                            });
                          }}
                          onToggleSubtask={(sid) => toggleSubtask(t.id, sid)}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <div className="kkh-section-label">
                    {view === 'today' ? 'Aaj Ke Tasks' : 'Tasks'}
                  </div>
                  <div className="kkh-timeline">
                    {normalTasks.map(t => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        overdue={isOverdue(t)}
                        bulkMode={bulkMode}
                        selected={selectedBulk.has(t.id)}
                        onToggle={() => toggleComplete(t.id)}
                        onEdit={() => { setEditingTask(t); setShowModal(true); }}
                        onDelete={() => deleteTask(t.id)}
                        onSelectBulk={() => {
                          setSelectedBulk(prev => {
                            const next = new Set(prev);
                            next.has(t.id) ? next.delete(t.id) : next.add(t.id);
                            return next;
                          });
                        }}
                        onToggleSubtask={(sid) => toggleSubtask(t.id, sid)}
                      />
                    ))}
                  </div>
                </>
              )
            ) : overdueTasks.length === 0 && (
              <div className="kkh-empty-state">
                {todayDone > 0 ? (
                  <>
                    <span className="kkh-empty-emoji">🎉</span>
                    <div className="kkh-empty-title">Sab tasks complete!</div>
                    <div className="kkh-empty-sub">{todayDone} task aaj poore kiye — Sab tab mein dekhein</div>
                  </>
                ) : (
                  <>
                    <span className="kkh-empty-emoji">📝</span>
                    <div className="kkh-empty-title">Yahan kuch nahi hai</div>
                    <div className="kkh-empty-sub">Niche button se naya task likho</div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Completed tasks hint — only in today/upcoming */}
        {(view === 'today' || view === 'upcoming') && (() => {
          const completedCount = view === 'today'
            ? tasks.filter(t => t.date === todayStr() && t.completed).length
            : tasks.filter(t => t.date > todayStr() && t.completed).length;
          return completedCount > 0 ? (
            <div className="kkh-completed-hint" onClick={() => setView('all')}>
              <span className="kkh-completed-hint-icon">✅</span>
              <span>{completedCount} completed task{completedCount > 1 ? 's' : ''} chhupaaye hain</span>
              <span className="kkh-completed-hint-link">Sab dekhein →</span>
            </div>
          ) : null;
        })()}

        {/* Clear All button */}
        {tasks.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <button className="kkh-clear-btn" onClick={clearAll}>🗑️ Sab Delete Karo</button>
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        className="kkh-fab"
        onClick={() => { setEditingTask(null); setShowModal(true); }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Naya Task Likho
      </button>

      {/* Task Modal */}
      {showModal && (
        <TaskModal
          editingTask={editingTask}
          defaultDate={calSelectedDate || undefined}
          onSave={(data) => {
            if (editingTask) {
              updateTask(editingTask.id, data);
            } else {
              addTask(data);
            }
            setShowModal(false);
            setEditingTask(null);
          }}
          onDelete={editingTask ? () => {
            deleteTask(editingTask.id);
            setShowModal(false);
            setEditingTask(null);
          } : undefined}
          onClose={() => { setShowModal(false); setEditingTask(null); }}
        />
      )}
    </div>
  );
}

// ===================== TASK CARD =====================
interface TaskCardProps {
  task: Task;
  overdue: boolean;
  bulkMode: boolean;
  selected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  onSelectBulk: () => void;
  onToggleSubtask: (subId: string) => void;
  key?: string | number;
}

function TaskCard({ task: t, overdue, bulkMode, selected, onToggle, onEdit, onDelete, onSelectBulk, onToggleSubtask }: TaskCardProps) {
  const cat = CATEGORIES.find(c => c.id === t.category);
  const subtasksDone = (t.subtasks || []).filter(s => s.done).length;
  const subtaskTotal = (t.subtasks || []).length;
  const priorityColor = t.priority === 'high' ? '#E85D75' : t.priority === 'medium' ? '#F4A736' : '#6EA8E8';

  return (
    <div
      className={`kkh-task-card${t.completed ? ' kkh-completed' : ''}${overdue ? ' kkh-overdue' : ''}${selected ? ' kkh-selected' : ''}`}
      style={{ borderLeftColor: priorityColor }}
    >
      {/* Priority dot on timeline */}
      <div className="kkh-timeline-dot" style={{ background: priorityColor }} />

      {bulkMode ? (
        <div
          className={`kkh-bulk-checkbox${selected ? ' kkh-bulk-checkbox-checked' : ''}`}
          onClick={onSelectBulk}
        >
          {selected && '✓'}
        </div>
      ) : (
        <div
          className={`kkh-check-circle${t.completed ? ' kkh-checked' : ''}`}
          onClick={onToggle}
        >
          {t.completed && (
            <svg viewBox="0 0 24 24" fill="none" stroke="#0E1F16" strokeWidth="3" width="14" height="14">
              <path d="M5 13l4 4L19 7"/>
            </svg>
          )}
        </div>
      )}

      <div className="kkh-task-body" onClick={onEdit}>
        <div className="kkh-task-title">{t.title}</div>
        <div className="kkh-task-meta">
          {t.time && <span className="kkh-task-time" style={overdue ? { color: '#E85D75' } : {}}>{formatTime(t.time)}</span>}
          {cat && (
            <span className="kkh-tag-pill" style={{ background: cat.bg, color: cat.color }}>
              {cat.label.split(' ')[0]} {t.category}
            </span>
          )}
          {t.recur && t.recur !== 'none' && (
            <span className="kkh-tag-pill" style={{ background: 'rgba(255,255,255,0.08)', color: '#8B94A3' }}>
              🔁 {t.recur}
            </span>
          )}
          {t.priority === 'high' && <span className="kkh-tag-pill" style={{ background: 'rgba(232,93,117,0.14)', color: '#E85D75' }}>🔴 High</span>}
        </div>
        {subtaskTotal > 0 && (
          <div className="kkh-subtask-progress">
            <div className="kkh-subtask-track">
              <div className="kkh-subtask-fill" style={{ width: `${subtaskTotal > 0 ? (subtasksDone / subtaskTotal) * 100 : 0}%` }} />
            </div>
            <span>{subtasksDone}/{subtaskTotal} steps</span>
          </div>
        )}
        {t.note && <div className="kkh-task-note">{t.note}</div>}
      </div>

      {/* Delete button */}
      {onDelete && !bulkMode && (
        <button
          className="kkh-card-del"
          title="Delete task"
          onClick={e => { e.stopPropagation(); if (window.confirm(`"${t.title}" delete karna chahte ho?`)) onDelete(); }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      )}
    </div>
  );
}

// ===================== TASK MODAL =====================
interface TaskModalProps {
  editingTask: Task | null;
  defaultDate?: string;
  onSave: (data: Omit<Task, 'id' | 'completed' | 'createdAt'>) => void;
  onDelete?: () => void;
  onClose: () => void;
}

function TaskModal({ editingTask, defaultDate, onSave, onDelete, onClose }: TaskModalProps) {
  const [title, setTitle] = useState(editingTask?.title || '');
  const [note, setNote] = useState(editingTask?.note || '');
  const [date, setDate] = useState(editingTask?.date || defaultDate || todayStr());
  const [time, setTime] = useState(editingTask?.time || '09:00');
  const [priority, setPriority] = useState<Task['priority']>(editingTask?.priority || 'medium');
  const [category, setCategory] = useState(editingTask?.category || 'Work');
  const [recur, setRecur] = useState<Task['recur']>(editingTask?.recur || 'none');
  const [subtasks, setSubtasks] = useState<Subtask[]>(editingTask?.subtasks ? JSON.parse(JSON.stringify(editingTask.subtasks)) : []);
  const [reminders, setReminders] = useState<string[]>(editingTask?.reminders || []);
  const [reminderDate, setReminderDate] = useState(date);
  const [reminderTime, setReminderTime] = useState('08:00');

  function handleSave() {
    if (!title.trim()) { alert('Task ka naam likho'); return; }
    if (!date || !time) { alert('Date aur time select karo'); return; }
    onSave({ title: title.trim(), note: note.trim(), date, time, priority, category, recur, subtasks: subtasks.filter(s => s.text.trim()), reminders });
  }

  function addSubtask() {
    setSubtasks(prev => [...prev, { id: uid(), text: '', done: false }]);
  }

  function addReminder() {
    setReminders(prev => [...prev, `${reminderDate}T${reminderTime}`]);
  }

  const quickDates = [
    { label: 'Aaj', value: todayStr() },
    { label: 'Kal', value: tomorrowStr() },
    { label: 'Weekend', value: thisWeekEndStr() },
  ];

  return createPortal(
    <div className="kkh-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="kkh-sheet">
        <div className="kkh-sheet-handle" />
        <div className="kkh-sheet-title">
          {editingTask ? '✏️ Task Edit Karo' : '✨ Naya Task'}
        </div>

        {/* Title */}
        <label className="kkh-field-label">Kya karna hai? *</label>
        <input
          className="kkh-field-input"
          type="text"
          placeholder="e.g. Supplier ko call karna hai"
          value={title}
          onChange={e => setTitle(e.target.value)}
          autoFocus
        />

        {/* Note */}
        <label className="kkh-field-label">Extra note (optional)</label>
        <textarea
          className="kkh-field-input kkh-field-textarea"
          placeholder="Detail likho..."
          value={note}
          onChange={e => setNote(e.target.value)}
        />

        {/* Quick Date Chips */}
        <label className="kkh-field-label">Jaldi Date</label>
        <div className="kkh-quick-dates">
          {quickDates.map(q => (
            <div
              key={q.value}
              className={`kkh-chip${date === q.value ? ' kkh-chip-active' : ''}`}
              onClick={() => setDate(q.value)}
            >
              {q.label}
            </div>
          ))}
        </div>

        {/* Date + Time */}
        <div className="kkh-row-2">
          <div>
            <label className="kkh-field-label">Date *</label>
            <input className="kkh-field-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="kkh-field-label">Time *</label>
            <input className="kkh-field-input" type="time" value={time} onChange={e => setTime(e.target.value)} />
          </div>
        </div>

        {/* Priority */}
        <label className="kkh-field-label">Priority</label>
        <div className="kkh-pill-group">
          {(['low', 'medium', 'high'] as Task['priority'][]).map(p => (
            <div
              key={p}
              className={`kkh-pill-option kkh-pill-${p}${priority === p ? ' kkh-pill-active' : ''}`}
              onClick={() => setPriority(p)}
            >
              {p === 'low' ? '🔵 Low' : p === 'medium' ? '🟡 Medium' : '🔴 High'}
            </div>
          ))}
        </div>

        {/* Category */}
        <label className="kkh-field-label">Category</label>
        <div className="kkh-cat-grid">
          {CATEGORIES.map(c => (
            <div
              key={c.id}
              className={`kkh-cat-chip${category === c.id ? ' kkh-cat-chip-active' : ''}`}
              style={category === c.id ? { borderColor: c.color, color: c.color, background: c.bg } : {}}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </div>
          ))}
        </div>

        {/* Repeat */}
        <label className="kkh-field-label">Repeat</label>
        <div className="kkh-pill-group" style={{ flexWrap: 'wrap' }}>
          {(['none', 'daily', 'weekly', 'monthly'] as Task['recur'][]).map(r => (
            <div
              key={r}
              className={`kkh-cat-chip${recur === r ? ' kkh-cat-chip-active' : ''}`}
              style={recur === r ? { borderColor: '#6EA8E8', color: '#6EA8E8', background: 'rgba(110,168,232,0.14)' } : {}}
              onClick={() => setRecur(r)}
            >
              {r === 'none' ? 'Ek Baar' : r === 'daily' ? '🔁 Daily' : r === 'weekly' ? '📅 Weekly' : '📆 Monthly'}
            </div>
          ))}
        </div>

        {/* Subtasks */}
        <label className="kkh-field-label">Subtasks / Steps (optional)</label>
        {subtasks.map((s, i) => (
          <div key={s.id} className="kkh-subtask-row">
            <input
              className="kkh-field-input"
              type="text"
              placeholder={`Step ${i + 1}`}
              value={s.text}
              onChange={e => setSubtasks(prev => prev.map((st, j) => j === i ? { ...st, text: e.target.value } : st))}
            />
            <button className="kkh-subtask-del" onClick={() => setSubtasks(prev => prev.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <div className="kkh-add-link" onClick={addSubtask}>+ Step jodo</div>

        {/* Extra Reminders */}
        <label className="kkh-field-label">Extra Reminders (optional)</label>
        {reminders.map((r, i) => {
          const d = new Date(r);
          return (
            <div key={i} className="kkh-reminder-chip">
              <span>📅 {d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ⏰ {formatTime(pad(d.getHours()) + ':' + pad(d.getMinutes()))}</span>
              <button className="kkh-subtask-del" onClick={() => setReminders(prev => prev.filter((_, j) => j !== i))}>✕</button>
            </div>
          );
        })}
        <div className="kkh-row-2" style={{ marginTop: 8 }}>
          <div>
            <input className="kkh-field-input" type="date" value={reminderDate} onChange={e => setReminderDate(e.target.value)} />
          </div>
          <div>
            <input className="kkh-field-input" type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)} />
          </div>
        </div>
        <div className="kkh-add-link" style={{ color: '#6EA8E8' }} onClick={addReminder}>+ Reminder jodo</div>

        {/* Save Button */}
        <button className="kkh-save-btn" onClick={handleSave}>
          {editingTask ? '💾 Update Karo' : '✅ Task Save Karo'}
        </button>

        {/* Delete Button */}
        {onDelete && (
          <button className="kkh-delete-btn" onClick={onDelete}>
            🗑️ Task Delete Karo
          </button>
        )}

        <div style={{ height: 8 }} />
      </div>
    </div>,
    document.body
  );
}
