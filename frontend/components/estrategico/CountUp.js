import { useEffect, useRef, useState } from 'react';

export default function CountUp({ end, duration = 1000, decimals = 0 }) {
  const safeEnd = typeof end === 'number' && !isNaN(end) ? end : 0;
  const [value, setValue] = useState(0);
  const raf = useRef(null);
  const startTime = useRef(null);
  const previousEnd = useRef(0);

  useEffect(() => {
    // Cancelar animação anterior
    if (raf.current) cancelAnimationFrame(raf.current);

    // Sempre começar do 0 quando o end value muda
    const shouldReset = previousEnd.current !== safeEnd;
    if (shouldReset) {
      setValue(0);
      previousEnd.current = safeEnd;
    }

    startTime.current = null;

    const animate = (timestamp) => {
      if (!startTime.current) startTime.current = timestamp;
      const progress = Math.min((timestamp - startTime.current) / duration, 1);
      const current = (safeEnd * progress);
      setValue(progress < 1 ? current : safeEnd);
      if (progress < 1) {
        raf.current = requestAnimationFrame(animate);
      }
    };
    raf.current = requestAnimationFrame(animate);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeEnd, duration]);

  // Formatar valor
  const formatted = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();

  return <span>{formatted}</span>;
}