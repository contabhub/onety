import { useEffect, useMemo, useState } from 'react'
import styles from './Sidebar.module.css'
import { LayoutList } from 'lucide-react'

export default function OnboardingSidebar({ currentTab, onChangeTab, tabs }) {
  const [isLightTheme, setIsLightTheme] = useState(false)

  useEffect(() => {
    const resolveTheme = () => {
      try {
        const saved = localStorage.getItem('theme')
        const attr = document.documentElement.getAttribute('data-theme')
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        const theme = saved || attr || (prefersDark ? 'dark' : 'light')
        setIsLightTheme(theme === 'light')
      } catch {
        setIsLightTheme(false)
      }
    }
    resolveTheme()
    const observer = new MutationObserver(() => resolveTheme())
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const onStorage = (e) => { if (e.key === 'theme') resolveTheme() }
    window.addEventListener('storage', onStorage)
    return () => { observer.disconnect(); window.removeEventListener('storage', onStorage) }
  }, [])

  const items = useMemo(() => tabs || [
    { key: 'conteudo', label: 'Conteúdo', icon: LayoutList },
  ], [tabs])

  return (
    <aside className={styles.aside}>
      <div className={styles.logoBox}>
        <img
          src={isLightTheme ? '/img/Logo-Onety-Preta.png' : '/img/Logo-Onety.png'}
          alt="Onety Logo"
          className={styles.logo}
        />
      </div>
      <nav>
        {items.map((t) => (
          <button
            key={t.key}
            onClick={() => onChangeTab?.(t.key)}
            className={`${styles.tabButton} ${currentTab === t.key ? styles.active : ''}`}
          >
            {t.icon ? <t.icon size={18} style={{ marginRight: 8 }} /> : null}
            {t.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}


