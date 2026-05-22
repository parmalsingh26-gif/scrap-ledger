import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../components/AuthProvider';

// ─── Antigravity-style Interactive Particle Canvas ───────────────────────────
function FloatingParticles({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let W = 0, H = 0;

    // Smooth mouse with lerp
    const mouse = { x: -9999, y: -9999, targetX: -9999, targetY: -9999, active: false };
    const MOUSE_RADIUS = 200;
    const CONNECT_DIST = 160;
    const MOUSE_CONNECT_DIST = 250;

    interface Particle {
      x: number; y: number;
      originX: number; originY: number;
      vx: number; vy: number;
      size: number; baseSize: number;
      opacity: number; baseOpacity: number;
      hue: number;
    }

    let particles: Particle[] = [];

    // Trail points for the cursor
    let trail: Array<{ x: number; y: number; age: number }> = [];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const initParticles = () => {
      particles = [];
      const count = Math.min(100, Math.floor((W * H) / 6000));
      for (let i = 0; i < count; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        particles.push({
          x, y,
          originX: x, originY: y,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: Math.random() * 2 + 1,
          baseSize: Math.random() * 2 + 1,
          opacity: Math.random() * 0.4 + 0.1,
          baseOpacity: Math.random() * 0.4 + 0.1,
          hue: Math.random() * 60 + 200, // blue-cyan-purple range
        });
      }
    };

    const animate = () => {
      // Smooth mouse lerp
      mouse.x += (mouse.targetX - mouse.x) * 0.12;
      mouse.y += (mouse.targetY - mouse.y) * 0.12;

      // Fade trail (don't clear fully — creates subtle motion blur)
      ctx.fillStyle = 'rgba(10, 14, 39, 0.15)';
      ctx.fillRect(0, 0, W, H);

      // ── Draw cursor glow halo ──
      if (mouse.active) {
        // Outer soft halo
        const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, MOUSE_RADIUS);
        grad.addColorStop(0, 'rgba(59, 130, 246, 0.06)');
        grad.addColorStop(0.4, 'rgba(99, 102, 241, 0.03)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(mouse.x - MOUSE_RADIUS, mouse.y - MOUSE_RADIUS, MOUSE_RADIUS * 2, MOUSE_RADIUS * 2);

        // Inner bright point
        const innerGrad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 30);
        innerGrad.addColorStop(0, 'rgba(147, 197, 253, 0.15)');
        innerGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = innerGrad;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 30, 0, Math.PI * 2);
        ctx.fill();

        // Update trail
        trail.push({ x: mouse.x, y: mouse.y, age: 0 });
        if (trail.length > 20) trail.shift();
      }

      // ── Draw cursor trail ──
      if (trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);
        for (let i = 1; i < trail.length; i++) {
          const t = trail[i];
          ctx.lineTo(t.x, t.y);
        }
        ctx.strokeStyle = 'rgba(147, 197, 253, 0.08)';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Age out trail
        trail.forEach(t => t.age++);
        trail = trail.filter(t => t.age < 25);
      }

      // ── Draw connections between particles ──
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            const alpha = 0.06 * (1 - dist / CONNECT_DIST);

            // Brighter connections near mouse
            let boost = 1;
            if (mouse.active) {
              const midX = (particles[i].x + particles[j].x) / 2;
              const midY = (particles[i].y + particles[j].y) / 2;
              const mDist = Math.sqrt((midX - mouse.x) ** 2 + (midY - mouse.y) ** 2);
              if (mDist < MOUSE_RADIUS) {
                boost = 1 + 3 * (1 - mDist / MOUSE_RADIUS);
              }
            }

            ctx.beginPath();
            ctx.strokeStyle = `rgba(100, 160, 255, ${Math.min(alpha * boost, 0.35)})`;
            ctx.lineWidth = 0.5 + boost * 0.3;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // ── Draw connections from mouse to nearby particles ──
      if (mouse.active) {
        particles.forEach(p => {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MOUSE_CONNECT_DIST) {
            const alpha = 0.12 * (1 - dist / MOUSE_CONNECT_DIST);
            ctx.beginPath();
            ctx.strokeStyle = `rgba(147, 197, 253, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }
        });
      }

      // ── Update and draw particles ──
      particles.forEach(p => {
        // Gravity towards mouse (attraction)
        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < MOUSE_RADIUS && dist > 0) {
            const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
            const strength = force * force * 0.5; // Quadratic for smooth gravity feel
            p.vx += (dx / dist) * strength;
            p.vy += (dy / dist) * strength;

            // Grow & brighten near mouse
            p.size += (p.baseSize * (1 + force * 2) - p.size) * 0.08;
            p.opacity += (p.baseOpacity + force * 0.5 - p.opacity) * 0.08;
          } else {
            p.size += (p.baseSize - p.size) * 0.03;
            p.opacity += (p.baseOpacity - p.opacity) * 0.03;
          }
        } else {
          p.size += (p.baseSize - p.size) * 0.03;
          p.opacity += (p.baseOpacity - p.opacity) * 0.03;
        }

        // Gentle return to origin (elastic)
        p.vx += (p.originX - p.x) * 0.001;
        p.vy += (p.originY - p.y) * 0.001;

        // Friction
        p.vx *= 0.96;
        p.vy *= 0.96;

        // Move
        p.x += p.vx;
        p.y += p.vy;

        // Soft boundaries
        if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx) * 0.5; }
        if (p.x > W) { p.x = W; p.vx = -Math.abs(p.vx) * 0.5; }
        if (p.y < 0) { p.y = 0; p.vy = Math.abs(p.vy) * 0.5; }
        if (p.y > H) { p.y = H; p.vy = -Math.abs(p.vy) * 0.5; }

        // Draw glow
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
        grd.addColorStop(0, `hsla(${p.hue}, 80%, 70%, ${p.opacity * 0.3})`);
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
        ctx.fill();

        // Draw core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 75%, ${p.opacity})`;
        ctx.fill();
      });

      animationId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.targetX = e.clientX - rect.left;
      mouse.targetY = e.clientY - rect.top;
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.active = false;
      mouse.targetX = -9999;
      mouse.targetY = -9999;
      trail = [];
    };

    const handleTouchMove = (e: TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.targetX = e.touches[0].clientX - rect.left;
      mouse.targetY = e.touches[0].clientY - rect.top;
      mouse.active = true;
    };

    const handleTouchEnd = () => {
      mouse.active = false;
      trail = [];
    };

    resize();
    initParticles();
    animate();

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('touchmove', handleTouchMove, { passive: true });
    canvas.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('resize', () => { resize(); initParticles(); });

    return () => {
      cancelAnimationFrame(animationId);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
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
      </div>

      {/* Main Content */}
      <div className="login-container">
        {/* Left side — Branding */}
        <div className="login-brand-side">

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
