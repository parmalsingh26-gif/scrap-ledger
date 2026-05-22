import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../components/AuthProvider';

// ─── Particle Network Canvas ─────────────────────────────────────────────────
function FloatingParticles({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let mouse = { x: -999, y: -999 };
    let particles: Array<{
      x: number; y: number; vx: number; vy: number;
      size: number; opacity: number; color: string; baseSize: number;
    }> = [];

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#22d3ee', '#ec4899'];

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    const initParticles = () => {
      particles = [];
      const count = Math.min(90, Math.floor((canvas.offsetWidth * canvas.offsetHeight) / 7000));
      for (let i = 0; i < count; i++) {
        const s = Math.random() * 2.5 + 0.8;
        particles.push({
          x: Math.random() * canvas.offsetWidth,
          y: Math.random() * canvas.offsetHeight,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          size: s, baseSize: s,
          opacity: Math.random() * 0.5 + 0.15,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    };

    const hexToRgba = (hex: string, alpha: number) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(100, 160, 255, ${0.07 * (1 - dist / 130)})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw & move particles, react to mouse
      particles.forEach(p => {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const mouseDist = Math.sqrt(dx * dx + dy * dy);

        // Repel from mouse
        if (mouseDist < 100) {
          const force = (100 - mouseDist) / 100;
          p.vx += (dx / mouseDist) * force * 0.3;
          p.vy += (dy / mouseDist) * force * 0.3;
          p.size = p.baseSize * (1 + force * 1.5);
        } else {
          p.size += (p.baseSize - p.size) * 0.05;
        }

        // Dampen velocity
        p.vx *= 0.99;
        p.vy *= 0.99;

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.offsetWidth) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.offsetHeight) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(p.color, p.opacity);
        ctx.fill();

        // Glow for bigger particles
        if (p.size > 2) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(p.color, p.opacity * 0.08);
          ctx.fill();
        }
      });

      animationId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    const handleMouseLeave = () => { mouse.x = -999; mouse.y = -999; };

    resize();
    initParticles();
    animate();

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('resize', () => { resize(); initParticles(); });

    return () => {
      cancelAnimationFrame(animationId);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [canvasRef]);

  return null;
}

// ─── Typing Animation Hook ──────────────────────────────────────────────────
function useTypewriter(texts: string[], speed = 60, pause = 2000) {
  const [display, setDisplay] = useState('');
  const [textIdx, setTextIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const current = texts[textIdx];
    let timer: NodeJS.Timeout;

    if (!isDeleting && charIdx < current.length) {
      timer = setTimeout(() => setCharIdx(c => c + 1), speed);
    } else if (!isDeleting && charIdx === current.length) {
      timer = setTimeout(() => setIsDeleting(true), pause);
    } else if (isDeleting && charIdx > 0) {
      timer = setTimeout(() => setCharIdx(c => c - 1), speed / 2);
    } else if (isDeleting && charIdx === 0) {
      setIsDeleting(false);
      setTextIdx(i => (i + 1) % texts.length);
    }

    setDisplay(current.substring(0, charIdx));
    return () => clearTimeout(timer);
  }, [charIdx, isDeleting, textIdx, texts, speed, pause]);

  return display;
}

// ─── Main Login Page ─────────────────────────────────────────────────────────
export function LoginPage() {
  const { loginApp } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [shake, setShake] = useState(false);
  const [successAnim, setSuccessAnim] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Typewriter effect
  const typedText = useTypewriter([
    'Track Industrial Materials',
    'Real-time Inventory Analytics',
    'Secure Data Management',
    'Export to Excel & WhatsApp',
    'Category-wise Reports',
  ], 50, 2500);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    await new Promise(resolve => setTimeout(resolve, 900));

    if (loginApp(username, password)) {
      setSuccessAnim(true);
      await new Promise(resolve => setTimeout(resolve, 700));
    } else {
      setError('Invalid credentials. Please try again.');
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
    setIsLoading(false);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Seconds for the scanning line animation
  const seconds = currentTime.getSeconds();

  return (
    <div className={`login-page ${successAnim ? 'login-success-exit' : ''}`}>
      {/* Animated Background */}
      <div className="login-bg">
        <canvas ref={canvasRef} className="login-particles-canvas" />
        <FloatingParticles canvasRef={canvasRef} />

        {/* Ambient gradient orbs */}
        <div className="login-orb login-orb-1"></div>
        <div className="login-orb login-orb-2"></div>
        <div className="login-orb login-orb-3"></div>
        <div className="login-orb login-orb-4"></div>

        {/* Grid pattern overlay */}
        <div className="login-grid-pattern"></div>

        {/* Scanning beam effect */}
        <div className="login-scan-line"></div>
      </div>

      {/* Main Content */}
      <div className="login-container">
        {/* Left side — Branding */}
        <div className="login-brand-side">
          {/* Animated border glow */}
          <div className="login-brand-border-glow"></div>

          <div className="login-brand-content">
            {/* Animated Logo */}
            <div className="login-logo-wrap">
              <div className="login-logo-ring login-logo-ring-outer"></div>
              <div className="login-logo-ring login-logo-ring-inner"></div>
              <div className="login-logo-icon">
                <span className="material-symbols-outlined" style={{ fontSize: '40px', fontVariationSettings: "'FILL' 1", color: '#fff' }}>
                  widgets
                </span>
              </div>
              {/* Orbiting dot */}
              <div className="login-orbit-dot"></div>
            </div>

            <h1 className="login-brand-title">
              Scrap<span className="login-brand-accent">Ledger</span>
            </h1>
            <p className="login-brand-subtitle">Industrial Inventory Management System</p>

            {/* Typewriter tagline */}
            <div className="login-typewriter-wrap">
              <span className="login-typewriter-text">{typedText}</span>
              <span className="login-typewriter-cursor">|</span>
            </div>

            {/* Stats ticker */}
            <div className="login-stats-ticker">
              <div className="login-stat-item">
                <span className="material-symbols-outlined login-stat-icon">inventory_2</span>
                <div>
                  <span className="login-stat-label">Inventory</span>
                  <span className="login-stat-value">Real-time Tracking</span>
                </div>
              </div>
              <div className="login-stat-item">
                <span className="material-symbols-outlined login-stat-icon">analytics</span>
                <div>
                  <span className="login-stat-label">Analytics</span>
                  <span className="login-stat-value">Live Dashboard</span>
                </div>
              </div>
              <div className="login-stat-item">
                <span className="material-symbols-outlined login-stat-icon">security</span>
                <div>
                  <span className="login-stat-label">Security</span>
                  <span className="login-stat-value">PIN Protected</span>
                </div>
              </div>
            </div>

            {/* Live clock */}
            <div className="login-clock">
              <div className="login-clock-time">{formatTime(currentTime)}</div>
              <div className="login-clock-date">{formatDate(currentTime)}</div>
            </div>
          </div>

          {/* Industrial decoration */}
          <div className="login-industrial-deco">
            <div className="login-gear login-gear-1">⚙</div>
            <div className="login-gear login-gear-2">⚙</div>
          </div>
        </div>

        {/* Right side — Login form */}
        <div className="login-form-side">
          {/* Animated glow border around form */}
          <div className={`login-form-card ${shake ? 'login-shake' : ''}`}>
            {/* Glowing border animation */}
            <div className="login-card-glow-border"></div>

            {/* Security badge */}
            <div className="login-security-badge">
              <span className="login-badge-dot"></span>
              <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1" }}>
                verified_user
              </span>
              Secure Login
              <span className="login-badge-pulse"></span>
            </div>

            <div className="login-form-header">
              <h2 className="login-form-title">Welcome Back</h2>
              <p className="login-form-desc">Sign in to access your inventory dashboard</p>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              {/* Username field */}
              <div className={`login-field-group ${focusedField === 'user' ? 'login-field-focused' : ''}`}>
                <label className="login-field-label" htmlFor="login-username">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person</span>
                  Username
                </label>
                <div className="login-input-wrap">
                  <input
                    id="login-username"
                    type="text"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setError(''); }}
                    onFocus={() => setFocusedField('user')}
                    onBlur={() => setFocusedField(null)}
                    className="login-input"
                    placeholder="Enter your username"
                    autoFocus
                    autoComplete="username"
                    required
                  />
                  {/* Animated underline */}
                  <div className="login-input-line"></div>
                  <div className="login-input-glow"></div>
                </div>
              </div>

              {/* Password field */}
              <div className={`login-field-group ${focusedField === 'pass' ? 'login-field-focused' : ''}`}>
                <label className="login-field-label" htmlFor="login-password">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>lock</span>
                  Password
                </label>
                <div className="login-input-wrap">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    onFocus={() => setFocusedField('pass')}
                    onBlur={() => setFocusedField(null)}
                    className="login-input login-input-password"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="login-password-toggle"
                    tabIndex={-1}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                  <div className="login-input-line"></div>
                  <div className="login-input-glow"></div>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="login-error">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}>
                    error
                  </span>
                  {error}
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading || !username || !password}
                className={`login-submit-btn ${isLoading ? 'login-btn-loading' : ''}`}
              >
                {isLoading ? (
                  <div className="login-spinner">
                    <div className="login-spinner-ring"></div>
                  </div>
                ) : (
                  <>
                    <span className="login-btn-text">Sign In</span>
                    <span className="material-symbols-outlined login-btn-arrow">arrow_forward</span>
                  </>
                )}
                {/* Button shimmer */}
                <div className="login-btn-shimmer"></div>
              </button>
            </form>

            {/* Fingerprint scan visual */}
            <div className="login-fingerprint-section">
              <div className="login-fingerprint-icon">
                <span className="material-symbols-outlined" style={{ fontSize: '20px', fontVariationSettings: "'FILL' 1" }}>
                  fingerprint
                </span>
                <div className="login-fingerprint-pulse"></div>
              </div>
              <span className="login-fingerprint-text">Protected by Scrap Ledger Security</span>
            </div>

            {/* Footer info */}
            <div className="login-form-footer">
              <div className="login-footer-divider">
                <span></span>
                <span className="login-footer-text">Scrap Ledger v2.0</span>
                <span></span>
              </div>
              <p className="login-footer-note">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>info</span>
                Contact administrator if you forgot your credentials
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
