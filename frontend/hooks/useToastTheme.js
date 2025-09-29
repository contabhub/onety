import { useEffect, useState } from 'react';

export const useToastTheme = () => {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const getTheme = () => {
      try {
        const saved = localStorage.getItem('theme');
        const attr = document.documentElement.getAttribute('data-theme');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        return saved || attr || (prefersDark ? 'dark' : 'light');
      } catch {
        return 'dark';
      }
    };

    const resolveTheme = () => {
      setTheme(getTheme());
    };

    // Inicial
    resolveTheme();

    // Observar mudanças no atributo data-theme
    const observer = new MutationObserver(() => resolveTheme());
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['data-theme'] 
    });

    // Mudanças em outras abas via localStorage
    const onStorage = (e) => {
      if (e.key === 'theme') resolveTheme();
    };
    window.addEventListener('storage', onStorage);

    return () => {
      observer.disconnect();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return theme;
};
