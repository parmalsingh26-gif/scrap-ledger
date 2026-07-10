import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface QRScannerModalProps {
  onScanSuccess: (text: string) => void;
  onClose: () => void;
}

export function QRScannerModal({ onScanSuccess, onClose }: QRScannerModalProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [scanned, setScanned] = useState<string | null>(null);
  const containerId = 'qr-scanner-container';

  const stopScanner = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
    } catch { /* ignore */ }
  };

  const startScanner = async (cameraId: string) => {
    if (!scannerRef.current) return;
    setError(null);
    setIsStarting(true);
    try {
      if (scannerRef.current.isScanning) await scannerRef.current.stop();
      await scannerRef.current.start(
        { deviceId: { exact: cameraId } },
        {
          fps: 10,
          qrbox: { width: 260, height: 260 },
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
          ],
          aspectRatio: 1.0,
        },
        (decodedText) => {
          setScanned(decodedText);
          stopScanner();
        },
        () => { /* ignore scan errors */ }
      );
      setIsStarting(false);
    } catch (err: any) {
      setError('Camera start nahi ho saka. Permission check karo.');
      setIsStarting(false);
    }
  };

  useEffect(() => {
    scannerRef.current = new Html5Qrcode(containerId, { verbose: false });

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!devices || devices.length === 0) {
          setError('Koi camera nahi mila. Device me camera hai?');
          setIsStarting(false);
          return;
        }
        const cams = devices.map(d => ({ id: d.id, label: d.label || `Camera ${d.id.slice(0, 5)}` }));
        setCameras(cams);
        // back camera prefer karo (mobile ke liye)
        const back = cams.find(c =>
          /back|rear|environment/i.test(c.label)
        );
        const chosen = back || cams[cams.length - 1];
        setActiveCameraId(chosen.id);
        startScanner(chosen.id);
      })
      .catch(() => {
        setError('Camera access deny ho gaya. Browser settings me permission do.');
        setIsStarting(false);
      });

    return () => { stopScanner(); };
  }, []);

  const handleUseScanned = () => {
    if (scanned) {
      onScanSuccess(scanned.trim().toUpperCase());
      onClose();
    }
  };

  const handleSwitchCamera = (cameraId: string) => {
    setActiveCameraId(cameraId);
    setScanned(null);
    startScanner(cameraId);
  };

  const handleRetry = () => {
    setScanned(null);
    if (activeCameraId) startScanner(activeCameraId);
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) { stopScanner(); onClose(); } }}
    >
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '420px',
        background: '#0f0f1a',
        borderRadius: '24px',
        boxShadow: '0 30px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* Header */}
        <div style={{
          padding: '18px 20px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.04)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '20px', fontVariationSettings: "'FILL' 1" }}>qr_code_scanner</span>
            </div>
            <div>
              <p style={{ color: 'white', fontWeight: '700', fontSize: '16px', margin: 0 }}>QR / Barcode Scanner</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: 0 }}>Lot ka QR ya barcode scan karo</p>
            </div>
          </div>
          <button
            onClick={() => { stopScanner(); onClose(); }}
            style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'rgba(255,255,255,0.7)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        {/* Scanner Viewport */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {!scanned && !error && (
            <>
              {/* Scanner box */}
              <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', background: '#000' }}>
                <div id={containerId} style={{ width: '100%' }} />
                {isStarting && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: '#000',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: '12px', minHeight: '260px'
                  }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      border: '3px solid rgba(99,102,241,0.3)',
                      borderTop: '3px solid #6366f1',
                      animation: 'spin 1s linear infinite',
                    }} />
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>Camera khul raha hai...</p>
                  </div>
                )}
                {/* Corner markers */}
                {!isStarting && ['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(pos => (
                  <div key={pos} style={{
                    position: 'absolute',
                    ...(pos.includes('top') ? { top: '50%', transform: 'translateY(-66%)' } : { bottom: '50%', transform: 'translateY(66%)' }),
                    ...(pos.includes('left') ? { left: '12%' } : { right: '12%' }),
                    width: '24px', height: '24px',
                    borderTop: pos.includes('top') ? '3px solid #6366f1' : 'none',
                    borderBottom: pos.includes('bottom') ? '3px solid #6366f1' : 'none',
                    borderLeft: pos.includes('left') ? '3px solid #6366f1' : 'none',
                    borderRight: pos.includes('right') ? '3px solid #6366f1' : 'none',
                    borderRadius: pos === 'top-left' ? '4px 0 0 0' : pos === 'top-right' ? '0 4px 0 0' : pos === 'bottom-left' ? '0 0 0 4px' : '0 0 4px 0',
                    pointerEvents: 'none',
                  }} />
                ))}
              </div>

              {/* Scan line animation indicator */}
              {!isStarting && (
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textAlign: 'center' }}>
                  📷 Camera ke samne Lot ka QR code ya Barcode rakho
                </p>
              )}

              {/* Camera switcher */}
              {cameras.length > 1 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {cameras.map(cam => (
                    <button
                      key={cam.id}
                      onClick={() => handleSwitchCamera(cam.id)}
                      style={{
                        flex: 1, padding: '8px 12px', borderRadius: '10px', border: 'none',
                        cursor: 'pointer', fontSize: '11px', fontWeight: '600',
                        background: activeCameraId === cam.id
                          ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                          : 'rgba(255,255,255,0.08)',
                        color: activeCameraId === cam.id ? 'white' : 'rgba(255,255,255,0.5)',
                        transition: 'all 0.2s',
                      }}
                    >
                      {/back|rear|environment/i.test(cam.label) ? '📷 Back Camera' : '🤳 Front Camera'}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Error State */}
          {error && (
            <div style={{
              padding: '24px', borderRadius: '16px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              textAlign: 'center',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#f87171' }}>error</span>
              <p style={{ color: '#f87171', fontWeight: '600', margin: '8px 0 4px' }}>{error}</p>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', margin: '0 0 16px' }}>
                Browser me camera permission allow karo (Settings → Camera)
              </p>
              <button
                onClick={() => { stopScanner(); onClose(); }}
                style={{
                  padding: '8px 20px', borderRadius: '10px', border: 'none',
                  background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)',
                  cursor: 'pointer', fontSize: '13px',
                }}
              >
                Band Karo
              </button>
            </div>
          )}

          {/* Success State — Scanned Preview */}
          {scanned && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Success banner */}
              <div style={{
                padding: '16px 20px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.08))',
                border: '1px solid rgba(16,185,129,0.3)',
                display: 'flex', alignItems: 'center', gap: '14px',
              }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '24px', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                </div>
                <div>
                  <p style={{ color: '#6ee7b7', fontWeight: '700', fontSize: '13px', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>✅ Scan Successful!</p>
                  <p style={{ color: 'rgba(255,255,255,0.8)', fontWeight: '800', fontSize: '18px', margin: 0, letterSpacing: '0.05em', fontFamily: 'monospace' }}>
                    {scanned.toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Info */}
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textAlign: 'center' }}>
                Yahi Lot Number form mein fill ho jayega. Agar inward entry mili, material bhi auto-select hoga.
              </p>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleRetry}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                    background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)',
                    cursor: 'pointer', fontWeight: '600', fontSize: '14px', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: '6px',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>refresh</span>
                  Dobara Scan
                </button>
                <button
                  onClick={handleUseScanned}
                  style={{
                    flex: 2, padding: '12px', borderRadius: '12px', border: 'none',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: 'white', cursor: 'pointer', fontWeight: '700', fontSize: '14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 1" }}>done_all</span>
                  Use Karo → Form Fill Karo
                </button>
              </div>
            </div>
          )}
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          #${containerId} video { border-radius: 12px; }
          #${containerId} img { display: none; }
        `}</style>
      </div>
    </div>,
    document.body
  );
}
