import React, { useEffect, useState, useRef } from 'react';
import styles from './SoundVisualizer.module.css';

const SoundVisualizer = ({ clientAnalyser, serverAnalyser }) => {
  const [audioIntensity, setAudioIntensity] = useState(0);
  const animationFrameRef = useRef(null);
  
  // Define o estado de ativação baseado nos analysers
  const isClientActive = !!clientAnalyser;
  const isServerActive = !!serverAnalyser;
  const isActive = isClientActive || isServerActive;

  useEffect(() => {
    if (!isActive) {
      setAudioIntensity(0);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const analyser = clientAnalyser || serverAnalyser;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateIntensity = () => {
      analyser.getByteFrequencyData(dataArray);
      
      // Foca nas frequências de voz (aproximadamente índices 10-100)
      // Isso captura melhor a fala humana
      const voiceStart = Math.floor(dataArray.length * 0.05);
      const voiceEnd = Math.floor(dataArray.length * 0.4);
      
      let sum = 0;
      let count = 0;
      for (let i = voiceStart; i < voiceEnd; i++) {
        sum += dataArray[i];
        count++;
      }
      
      const average = sum / count;
      
      // Normaliza para 0-1 com sensibilidade maior
      const normalized = Math.min(average / 100, 1.5); // Aumenta limite para 1.5 para mais responsividade
      const intensity = Math.pow(normalized, 0.7); // Curva mais suave para resposta natural
      
      setAudioIntensity(intensity);
      animationFrameRef.current = requestAnimationFrame(updateIntensity);
    };

    updateIntensity();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [clientAnalyser, serverAnalyser, isActive]);

  // Calcula o scale baseado na intensidade (1.0 a 1.35 para pulso mais visível)
  const scale = isActive ? 1 + (audioIntensity * 0.35) : 1;
  
  // Calcula a opacidade do glow baseado na intensidade
  const glowIntensity = audioIntensity;
  
  return (
    <div className={styles.container}>
      <div className={styles.soundSphere}>
        {/* Esfera Central */}
        <div 
          className={`${styles.sphere} ${
            isClientActive ? styles.speaking : 
            isServerActive ? styles.listening : 
            styles.idle
          } ${isActive ? styles.animated : ''}`}
          style={{
            transform: `scale(${scale})`,
            filter: isActive ? `brightness(${1 + glowIntensity * 0.3}) saturate(${1 + glowIntensity * 0.5})` : 'brightness(1)',
            transition: 'transform 0.05s ease-out, filter 0.1s ease-out'
          }}
        >
          <div 
            className={styles.sphereCore}
            style={{
              boxShadow: isActive ? `
                0 0 ${60 + glowIntensity * 40}px ${isClientActive ? 'rgba(168, 85, 247, 0.9)' : 'rgba(6, 182, 212, 0.9)'},
                0 0 ${120 + glowIntensity * 80}px ${isClientActive ? 'rgba(217, 70, 239, 0.6)' : 'rgba(34, 211, 238, 0.6)'},
                inset 0 0 50px ${isClientActive ? 'rgba(251, 207, 232, 0.5)' : 'rgba(165, 243, 252, 0.5)'},
                inset -10px -10px 40px ${isClientActive ? 'rgba(233, 213, 255, 0.6)' : 'rgba(186, 230, 253, 0.6)'}
              ` : undefined
            }}
          ></div>
        </div>

        {/* Ondas Sonoras Concêntricas - Só aparecem quando ativo */}
        {isActive && (
          <>
            <div className={`${styles.wave} ${styles.wave1} ${styles.active}`}></div>
            <div className={`${styles.wave} ${styles.wave2} ${styles.active}`}></div>
            <div className={`${styles.wave} ${styles.wave3} ${styles.active}`}></div>
            <div className={`${styles.wave} ${styles.wave4} ${styles.active}`}></div>
          </>
        )}

        {/* Partículas Orbitais - Só aparecem quando ativo */}
        {isActive && (
          <>
            <div className={`${styles.particle} ${styles.particle1}`}></div>
            <div className={`${styles.particle} ${styles.particle2}`}></div>
            <div className={`${styles.particle} ${styles.particle3}`}></div>
          </>
        )}
      </div>
    </div>
  );
};

export default SoundVisualizer;

