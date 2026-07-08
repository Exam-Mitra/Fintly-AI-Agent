import MarkdownMessage from './MarkdownMessage.jsx';
import useTypewriter from '../lib/useTypewriter.js';

// Wraps MarkdownMessage with a lightweight "typing" reveal animation, used
// only for the newest assistant message right after it arrives (never replayed
// when a conversation is simply reloaded from history).
export default function StreamingMessage({ text, animate }) {
  const { displayText } = useTypewriter(text, { enabled: animate });
  return <MarkdownMessage text={displayText} />;
}
