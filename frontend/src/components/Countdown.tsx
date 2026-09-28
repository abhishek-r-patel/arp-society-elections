import { useEffect, useRef, useState } from 'react';

/** Live "time remaining until target" display; calls onReached once when it hits zero. */
export default function Countdown({ target, onReached }: { target: string; onReached?: () => void }) {
  const [remainingMs, setRemainingMs] = useState(() => new Date(target).getTime() - Date.now());
  const notified = useRef(false);

  useEffect(() => {
    notified.current = false;
    const tick = () => {
      const ms = new Date(target).getTime() - Date.now();
      setRemainingMs(ms);
      if (ms <= 0 && !notified.current) {
        notified.current = true;
        onReached?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target, onReached]);

  if (remainingMs <= 0) return <span className="countdown">Starting…</span>;

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <span className="countdown">
      {days > 0 ? `${days}d ` : ''}
      {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </span>
  );
}
