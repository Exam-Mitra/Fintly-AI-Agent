import { useState } from 'react';
import { speak, stopSpeaking, isSpeechSynthesisSupported } from '../lib/voice.js';
import FlashcardGenerateButton from './FlashcardGenerateButton.jsx';

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const RegenIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);
const BookmarkIcon = ({ filled }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'var(--accent-blue)' : 'none'} stroke="currentColor" strokeWidth="1.8">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);
const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
const ThumbUpIcon = ({ active }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={active ? 'var(--success)' : 'none'} stroke={active ? 'var(--success)' : 'currentColor'} strokeWidth="1.8">
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
  </svg>
);
const ThumbDownIcon = ({ active }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={active ? 'var(--danger)' : 'none'} stroke={active ? 'var(--danger)' : 'currentColor'} strokeWidth="1.8">
    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
  </svg>
);
const SpeakerIcon = ({ active }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--accent-blue)' : 'currentColor'} strokeWidth="1.8">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    {active
      ? <><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></>
      : <line x1="23" y1="9" x2="17" y2="15" />}
    {active ? null : <line x1="17" y1="9" x2="23" y2="15" />}
  </svg>
);

export default function MessageActions({ text, onRegenerate, showRegenerate, onSave, onExportPdf, onReact }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reaction, setReaction] = useState(null);
  const [speaking, setSpeaking] = useState(false);

  const handleSpeak = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(text, { onEnd: () => setSpeaking(false) });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  const handleSave = () => {
    if (!onSave || saved) return;
    onSave();
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const handleReact = (value) => {
    if (!onReact) return;
    const next = reaction === value ? null : value; // tap again to un-react
    setReaction(next);
    onReact(next || 'cleared');
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, marginLeft: 4 }}>
      <button
        onClick={handleCopy}
        title="Copy"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 26, height: 26, borderRadius: 8, color: 'var(--ink-faint)',
        }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
      {isSpeechSynthesisSupported() && (
        <button
          onClick={handleSpeak}
          title={speaking ? 'Stop reading aloud' : 'Read aloud'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 26, height: 26, borderRadius: 8, color: speaking ? 'var(--accent-blue)' : 'var(--ink-faint)',
          }}
        >
          <SpeakerIcon active={speaking} />
        </button>
      )}
      {onReact && (
        <>
          <button
            onClick={() => handleReact('up')}
            title="Good answer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 8, color: reaction === 'up' ? 'var(--success)' : 'var(--ink-faint)',
            }}
          >
            <ThumbUpIcon active={reaction === 'up'} />
          </button>
          <button
            onClick={() => handleReact('down')}
            title="Not helpful"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 8, color: reaction === 'down' ? 'var(--danger)' : 'var(--ink-faint)',
            }}
          >
            <ThumbDownIcon active={reaction === 'down'} />
          </button>
        </>
      )}
      {onSave && (
        <button
          onClick={handleSave}
          title="Save this answer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 26, height: 26, borderRadius: 8, color: saved ? 'var(--accent-blue)' : 'var(--ink-faint)',
          }}
        >
          <BookmarkIcon filled={saved} />
        </button>
      )}
      {onExportPdf && (
        <button
          onClick={onExportPdf}
          title="Export as PDF"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 26, height: 26, borderRadius: 8, color: 'var(--ink-faint)',
          }}
        >
          <DownloadIcon />
        </button>
      )}
      <FlashcardGenerateButton text={text} />
      {showRegenerate && (
        <button
          onClick={onRegenerate}
          title="Regenerate"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 26, height: 26, borderRadius: 8, color: 'var(--ink-faint)',
          }}
        >
          <RegenIcon />
        </button>
      )}
    </div>
  );
}
