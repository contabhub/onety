import { useState, useEffect, useCallback } from 'react';
import styles from './ThemeToggle.module.css';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  const applyTheme = useCallback((dark) => {
    const theme = dark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch {}
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme');
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initialDark = saved ? saved === 'dark' : prefersDark;
      setIsDark(initialDark);
      applyTheme(initialDark);
    } catch {}
  }, [applyTheme]);

  const onChange = () => {
    setIsDark((prev) => {
      const next = !prev;
      applyTheme(next);
      return next;
    });
  };

  return (
    <div className={styles.themeSwitch}>
      <span className={`${styles.themeIcon} ${styles.themeIconSun}`} aria-hidden>
        <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 4h.01"/><path d="M20 12h.01"/><path d="M12 20h.01"/><path d="M4 12h.01"/><path d="M17.657 6.343h.01"/><path d="M17.657 17.657h.01"/><path d="M6.343 17.657h.01"/><path d="M6.343 6.343h.01"/></svg>
      </span>
      <input
        id="onety-theme-switch"
        className={styles.themeSwitchInput}
        type="checkbox"
        checked={isDark}
        onChange={onChange}
        aria-label="Alternar tema"
      />
      <label htmlFor="onety-theme-switch" className={styles.themeSwitchLabel}>
        <span className={styles.themeSwitchKnob} />
      </label>
      <span className={`${styles.themeIcon} ${styles.themeIconMoon}`} aria-hidden>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>
      </span>
    </div>
  );
}
