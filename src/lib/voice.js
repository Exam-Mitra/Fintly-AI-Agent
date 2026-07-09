export function isSpeechRecognitionSupported() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported() {
  return typeof window !== 'undefined' && !!window.speechSynthesis;
}

export function startListening({ onResult, onError, onEnd, lang = 'en-IN' }) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    onError?.('Voice input is not supported in this browser.');
    return () => {};
  }

  const recognition = new SpeechRecognition();
  recognition.lang = lang;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || '';
    onResult?.(transcript);
  };
  recognition.onerror = (event) => {
    onError?.(event.error === 'not-allowed' ? 'Microphone access was denied.' : 'Voice input failed. Please try again.');
  };
  recognition.onend = () => {
    onEnd?.();
  };

  try {
    recognition.start();
  } catch {
    onError?.('Could not start voice input.');
  }

  return () => {
    try {
      recognition.stop();
    } catch {
      // already stopped — ignore
    }
  };
}

function stripMarkdownForSpeech(text) {
  return text
    .replace(/```[\s\S]*?```/g, ' code block omitted ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '');
}

export function speak(text, { lang = 'en-IN', onEnd } = {}) {
  if (!isSpeechSynthesisSupported()) return () => {};
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(stripMarkdownForSpeech(text));
  utterance.lang = lang;
  utterance.rate = 1;
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);

  return () => window.speechSynthesis.cancel();
}

export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
}
