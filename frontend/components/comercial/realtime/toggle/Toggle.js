import { useState, useEffect, useRef } from 'react';
import styles from './Toggle.module.css';

export function Toggle({
  defaultValue = false,
  values,
  labels,
  onChange = () => {},
}) {
  if (typeof defaultValue === 'string') {
    defaultValue = !!Math.max(0, (values || []).indexOf(defaultValue));
  }

  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const bgRef = useRef(null);
  const [value, setValue] = useState(defaultValue);

  const toggleValue = () => {
    const v = !value;
    const index = +v;
    setValue(v);
    onChange(v, (values || [])[index]);
  };

  useEffect(() => {
    const leftEl = leftRef.current;
    const rightEl = rightRef.current;
    const bgEl = bgRef.current;
    if (leftEl && rightEl && bgEl) {
      if (value) {
        bgEl.style.left = rightEl.offsetLeft + 'px';
        bgEl.style.width = rightEl.offsetWidth + 'px';
      } else {
        bgEl.style.left = '';
        bgEl.style.width = leftEl.offsetWidth + 'px';
      }
    }
  }, [value]);

  return (
    <div
      data-component="Toggle"
      className={styles.toggle}
      onClick={toggleValue}
      data-enabled={value.toString()}
    >
      {labels && (
        <div className={`${styles.label} ${styles.left}`} ref={leftRef}>
          {labels[0]}
        </div>
      )}
      {labels && (
        <div className={`${styles.label} ${styles.right}`} ref={rightRef}>
          {labels[1]}
        </div>
      )}
      <div className={styles.toggleBackground} ref={bgRef}></div>
    </div>
  );
}

