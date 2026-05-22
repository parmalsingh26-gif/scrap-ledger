import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../components/AuthProvider';

// Floating particle component for industrial aesthetic
function FloatingParticles({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let particles: Array<{
      x: number; y: number; vx: number; vy: number;
      size: number; opacity: number; color: string;
    }> = [];

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#22d3ee'];

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    const initParticles = () => {
      particles = [];
      const count = Math.min(80, Math.floor((canvas.offsetWidth * canvas.offsetHeight) / 8000));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.offsetWidth,
          y: Math.random() * canvas.offsetHeight,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          size: Math.random() * 3 + 1,
          opacity: Math.random() * 0.5 + 0.1,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    };

    const drawConnections = () => {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(59, 130, 246, ${0.08 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      drawConnections();

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.offsetWidth) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.offsetHeight) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color.replace(')', `, ${p.opacity})`).replace('rgb', 'rgba');

        // Simple hex to rgba for fill
        const hexToRgba = (hex: string, alpha: number) => {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        ctx.fillStyle = hexToRgba(p.color, p.opacity);
        ctx.fill();
      });

      animationId = requestAnimationFrame(animate);
    };

    resize();
    initParticles();
    animate();

    window.addEventListener('resize', () => { resize(); initParticles(); });

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [canvasRef]);

  return null;
}

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

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate authentication delay for premium feel
    await new Promise(resolve => setTimeout(resolve, 800));

    if (loginApp(username, password)) {
      setSuccessAnim(true);
      // Allow success animation to play
      await new Promise(resolve => setTimeout(resolve, 600));
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
            </div>

            <h1 className="login-brand-title">
              Scrap<span className="login-brand-accent">Ledger</span>
            </h1>
            <p className="login-brand-subtitle">Industrial Inventory Management System</p>

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
          <div className={`login-form-card ${shake ? 'login-shake' : ''}`}>
            {/* Security badge */}
            <div className="login-security-badge">
              <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1" }}>
                verified_user
              </span>
              Secure Login
            </div>

            <div className="login-form-header">
              <h2 className="login-form-title">Welcome Back</h2>
              <p className="login-form-desc">Sign in to access your inventory dashboard</p>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              {/* Username field */}
              <div className="login-field-group">
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
                    className="login-input"
                    placeholder="Enter your username"
                    autoFocus
                    autoComplete="username"
                    required
                  />
                  <div className="login-input-glow"></div>
                </div>
              </div>

              {/* Password field */}
              <div className="login-field-group">
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
                    <span>Sign In</span>
                    <span className="material-symbols-outlined login-btn-arrow">arrow_forward</span>
                  </>
                )}
              </button>
            </form>

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
