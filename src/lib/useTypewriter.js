import { useEffect, useRef, useState } from 'react';

// Reveals `fullText` progressively in word-sized chunks to create a lightweight
// "typing" effect once the complete answer has arrived from the server (our
// free-tier APIs don't support true token-by-token streaming all the way through
// the multi-engine + synthesis step, so we simulate the feel of live typing
// instead). The whole reveal always finishes within ~1.4s regardless of answer
// length, so it never actually slows down reading long answers.
export default function useTypewriter(fullText, { enabled = true } = {}) {
  const [displayText, setDisplayText] = useState(enabled ? '' : fullText);
  const [done, setDone] = useState(!enabled);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      setDisplayText(fullText || '');
      setDone(true);
      return;
    }
    if (!fullText) {
      setDisplayText('');
      setDone(true);
      return;
    }

    const tokens = fullText.split(/(\s+)/); // keep whitespace tokens so spacing stays exact
    const totalDurationMs = Math.min(1400, 250 + tokens.length * 4);
    const stepMs = 16;
    const steps = Math.max(1, Math.round(totalDurationMs / stepMs));
    const tokensPerStep = Math.max(1, Math.ceil(tokens.length / steps));

    let i = 0;
    setDisplayText('');
    setDone(false);

    function tick() {
      i += tokensPerStep;
      if (i >= tokens.length) {
        setDisplayText(fullText);
        setDone(true);
        return;
      }
      setDisplayText(tokens.slice(0, i).join(''));
      timerRef.current = setTimeout(tick, stepMs);
    }
    timerRef.current = setTimeout(tick, stepMs);

    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullText, enabled]);

  return { displayText, done };
}
