import React from 'react'
import styles from './SpaceLoader.module.css'

export default function SpaceLoader({ size = 120, label = 'Carregando...', showText = true, minHeight = 220, className = '' }) {
  const loaderStyle = { width: size, height: size }
  const containerStyle = { minHeight }

  return (
    <div className={`${styles.loadingContainer} ${className}`} style={containerStyle}>
      <div className={styles.spaceLoader} aria-label={label} role="status" style={loaderStyle}>
        <div className={styles.core}></div>
        <div className={`${styles.orbit} ${styles.orbit1}`}></div>
        <div className={`${styles.orbit} ${styles.orbit2}`}></div>
        <div className={`${styles.orbit} ${styles.orbit3}`}></div>
        <div className={styles.stars}></div>
      </div>
      {showText && <span className={styles.loadingText}>{label}</span>}
    </div>
  )
}


