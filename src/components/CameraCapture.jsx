import { useEffect, useRef, useState } from 'react';

const CameraIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

// Self-contained camera capture. Opens a live preview, lets the user capture a
// frame, and hands the photo back as a pending image attachment (same shape the
// chat already sends to the vision endpoint). Requires browser camera permission.
export default function CameraCapture({ onCapture, disabled }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera not supported on this device/browser.');
      setTimeout(() => setError(''), 4000);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setOpen(true);
    } catch {
      setError('Camera access was denied or is unavailable.');
      setTimeout(() => setError(''), 4000);
    }
  };

  useEffect(() => {
    if (open && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, [open]);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setOpen(false);
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.split(',')[1] || '';
    stop();
    onCapture?.({ kind: 'image', name: 'camera-photo.jpg', mimeType: 'image/jpeg', dataBase64: base64, previewUrl: dataUrl });
  };

  if (open) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
        <video ref={videoRef} playsInline muted style={{ width: '100%', maxWidth: 480, borderRadius: 12, background: '#000' }} />
        {error && <div style={{ color: '#FFD98A', fontSize: 13, margin: '8px 0' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button onClick={stop} style={{ padding: '10px 18px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink)', fontWeight: 600 }}>Cancel</button>
          <button onClick={capture} style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: 'var(--accent-gradient)', color: '#0F1115', fontWeight: 700 }}>Capture</button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={start}
      disabled={disabled}
      title="Take a photo"
      style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <CameraIcon />
    </button>
  );
}
