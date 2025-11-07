import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { getKpiMetaPercentualDepartamentoRecursivo, getKpiMetaPercentualDepartamentoProprio } from '../../utils/estrategico/goalUtils';
import { CircularProgressbarWithChildren, buildStyles } from 'react-circular-progressbar';
import CountUp from '../../components/estrategico/CountUp';
import styles from '../../styles/estrategico/CanvasOrgChart.module.css';

const CircularProgressBar = ({ percentage, color, x, y, size, tooltip, isIcon }) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    setDisplayValue(0);
    const timer = setTimeout(() => {
      setDisplayValue(percentage);
    }, 50);
    return () => clearTimeout(timer);
  }, [percentage]);

  const dynamicStyle = {
    left: x - size / 2,
    top: y - size / 2,
    width: size,
    height: size,
  };

  if (isIcon) {
    return (
      <div
        className={styles.circularProgressBar}
        style={dynamicStyle}
        title={tooltip}
      >
        <Users size={size} color={color} />
      </div>
    );
  }

  const progressTextStyle = {
    fontSize: `${Math.max(8, Math.min(14, size * 0.25))}px`,
    color: color,
  };

  return (
    <div
      className={styles.circularProgressBar}
      style={dynamicStyle}
      title={tooltip}
    >
      <CircularProgressbarWithChildren
        value={displayValue}
        styles={buildStyles({
          pathColor: color,
          trailColor: 'var(--onity-color-border)',
          strokeLinecap: 'round',
          pathTransitionDuration: 1,
        })}
      >
        <div className={styles.progressText} style={progressTextStyle}>
          <CountUp key={`${percentage}-${color}`} end={percentage} duration={1000} decimals={1} />%
        </div>
      </CircularProgressbarWithChildren>
    </div>
  );
};

// interface MetaProcessada {
//   titulo: string;
//   percentual: number;
//   valorAlcancado: number;
//   valorMeta: number;
// }

const NODE_WIDTH = 300;
const NODE_HEIGHT = 180;
const VERTICAL_GAP = 100;
const HORIZONTAL_GAP = 40;

// Função recursiva para coletar todas as metas do departamento e subdepartamentos
function coletarMetasRecursivo(node) {
  let metas = node.goals || [];
  if (node.children && node.children.length > 0) {
    node.children.forEach(child => {
      metas = metas.concat(coletarMetasRecursivo(child));
    });
  }
  return metas;
}

const CanvasOrgChart = ({
  data,
  highlightedDepartment,
  globalGoal,
  onToggleExpand,
  onEditDepartment,
  onDeleteDepartment,
  userRole,
  currentUserId,
  companyId,
  selectedYear,
  selectedMonth
}) => {
  const canvasRef = useRef(null);
  const imagesCache = useRef({});
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [circularBars, setCircularBars] = useState([]);
  
  // Estados para o menu de contexto
  const [menuPosition, setMenuPosition] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const menuRef = useRef(null);
  
  const titleAreasRef = useRef([]);
  const buttonAreasRef = useRef([]);
  const router = useRouter();
  
  // const handleZoomIn = () => {
  //   setScale(prev => Math.min(prev * 1.2, 2));
  // };

  // const handleZoomOut = () => {
  //   setScale(prev => Math.max(prev * 0.8, 0.1));
  // };

  // const handleResetZoom = () => {
  //   setScale(1);
  //   setOffset({ x: 0, y: 0 });
  // };

  const calculateNodeWidth = (node) => {
    if (!node.children || !node.isExpanded || node.children.length === 0) {
      return NODE_WIDTH;
    }

    const totalChildrenWidth = node.children.reduce((acc, child) => {
      return acc + calculateNodeWidth(child);
    }, 0);
    
    const totalGaps = (node.children.length - 1) * HORIZONTAL_GAP;
    return Math.max(NODE_WIDTH, totalChildrenWidth + totalGaps);
  };

  const getSubtreeWidth = (node) => {
    if (!node.children || node.children.length === 0 || !node.isExpanded) {
      return NODE_WIDTH;
    }
    
    const childrenWidth = node.children.reduce((acc, child) => {
      return acc + getSubtreeWidth(child);
    }, 0);
    
    const totalGaps = (node.children.length - 1) * HORIZONTAL_GAP;
    return Math.max(NODE_WIDTH, childrenWidth + totalGaps);
  };

  // Função para encontrar as coordenadas de um nó
  const findNodeCoordinates = (node, x, y) => {
    if (node.id === highlightedDepartment) {
      return { x, y };
    }

    if (node.children && node.isExpanded) {
      let childX = x + NODE_WIDTH / 2 - getSubtreeWidth(node) / 2;
      const childY = y + NODE_HEIGHT + VERTICAL_GAP;

      for (const child of node.children) {
        const coords = findNodeCoordinates(child, childX, childY);
        if (coords) return coords;
        childX += NODE_WIDTH + HORIZONTAL_GAP;
      }
    }

    return null;
  };

  useEffect(() => {
    if (!highlightedDepartment || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Encontra as coordenadas do nó destacado
    const startX = (canvas.width / scale - calculateNodeWidth(data)) / 2;
    const coords = findNodeCoordinates(data, startX, 40);

    if (coords) {
      // Calcula o offset necessário para centralizar o nó
      const newOffset = {
        x: rect.width / 2 - coords.x * scale,
        y: rect.height / 2 - coords.y * scale
      };

      // Aplica a animação de transição
      setOffset(newOffset);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedDepartment, data, scale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      ctx.scale(dpr, dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      
      drawChart();
    };

    const drawNode = (node, x, y, isRoot = false) => {
      if (!ctx) return { width: 0, height: 0 };

      // Calcular largura total da subárvore e centralizar o nó
      const subtreeWidth = getSubtreeWidth(node);
      let adjustedX = x;
      
      // Se o nó tiver filhos expandidos, centralizar em relação aos filhos
      if (node.isExpanded && node.children && node.children.length > 0) {
        const childrenWidths = node.children.map(getSubtreeWidth);
        const totalChildrenWidth = childrenWidths.reduce((acc, w) => acc + w, 0) + 
          (node.children.length - 1) * HORIZONTAL_GAP;
        adjustedX = x + (totalChildrenWidth / 2) - (NODE_WIDTH / 2);
      }

      // Registrar a posição do nó para detecção de clique
      const nodeArea = {
        x: adjustedX,
        y: y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        id: node.id
      };
      titleAreasRef.current.push(nodeArea);

      const cardWidth = NODE_WIDTH;
      const cardHeight = NODE_HEIGHT;

             // Use o utilitário para calcular o percentual da bolinha e cor/frase
       let percentualReal = 0;
       let kpiColor = '#10B981';
       
      // Calcular percentual esperado baseado no mês selecionado
      const now = new Date();
      const mesAtual = selectedMonth || now.getMonth() + 1;
      const anoAtual = selectedYear || now.getFullYear();
      const diasNoMes = new Date(anoAtual, mesAtual, 0).getDate();
      
      // Verificar se é o mês atual
      const isCurrentMonth = selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear();
      
      // Para o mês atual: usar o dia de hoje
      // Para meses passados/futuros: usar o último dia (100%)
      const diaReferencia = isCurrentMonth ? now.getDate() : diasNoMes;
      const percentualEsperado = (diaReferencia / diasNoMes) * 100;
      
      // Verificar se é o departamento que contém todos os outros (baseado no título)
      const isMainRoot = node.title.toLowerCase().includes('diretoria') || 
                        node.title.toLowerCase().includes('presidência') || 
                        node.title.toLowerCase().includes('ceo') ||
                        node.title.toLowerCase().includes('presidente') ||
                        node.title.toLowerCase().includes('direção') ||
                        node.title.toLowerCase().includes('gestão') ||
                        node.title.toLowerCase().includes('administração') ||
                        (node.children && node.children.length > 3) || // Se tem mais de 3 filhos, é raiz
                        (isRoot && node.children && node.children.length > 0); // Se é raiz e tem filhos, é raiz principal
      
      // LÓGICA CORRIGIDA: O departamento raiz deve SEMPRE usar a média dos filhos
      // Não importa se tem globalGoal ou não - o raiz sempre calcula a média dos filhos
      if (isMainRoot) {
        const kpi = getKpiMetaPercentualDepartamentoRecursivo(node, selectedYear, selectedMonth);
        percentualReal = kpi.percentualReal;
        kpiColor = kpi.cor;
      } else {
        // Para todos os outros departamentos, usar a lógica recursiva
        const kpi = getKpiMetaPercentualDepartamentoRecursivo(node, selectedYear, selectedMonth);
        percentualReal = kpi.percentualReal;
        kpiColor = kpi.cor;
      }

             // 3. A borda do card deve usar a mesma cor do primeiro círculo (próprio departamento)
       // Vamos calcular a cor do próprio departamento primeiro
       const kpiProprio = getKpiMetaPercentualDepartamentoProprio(node, selectedYear, selectedMonth);
       const percentualProprio = kpiProprio.percentualReal;
       
      // Aplicar lógica de cores baseada no mês selecionado
      let cardColor = '#10B981'; // verde
      if (isCurrentMonth) {
        // Mês atual: lógica original
        if (percentualProprio < percentualEsperado - 10) {
          cardColor = '#EF4444'; // vermelho
        } else if (percentualProprio < percentualEsperado) {
          cardColor = '#F59E42'; // amarelo
        }
      } else {
        // Meses passados/futuros: lógica fixa
        if (percentualProprio < 50) {
          cardColor = '#EF4444'; // vermelho
        } else if (percentualProprio < 100) {
          cardColor = '#F59E42'; // amarelo
        }
      }

      // 4. Card moderno com gradiente e efeitos visuais
      ctx.save();
      
      // Sombra externa mais elegante
      ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
      ctx.shadowBlur = 25;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 12;
      
      // Card com bordas arredondadas
      ctx.beginPath();
      // Implementação compatível de roundRect
      const radius = 16;
      ctx.moveTo(adjustedX + radius, y);
      ctx.lineTo(adjustedX + cardWidth - radius, y);
      ctx.quadraticCurveTo(adjustedX + cardWidth, y, adjustedX + cardWidth, y + radius);
      ctx.lineTo(adjustedX + cardWidth, y + cardHeight - radius);
      ctx.quadraticCurveTo(adjustedX + cardWidth, y + cardHeight, adjustedX + cardWidth - radius, y + cardHeight);
      ctx.lineTo(adjustedX + radius, y + cardHeight);
      ctx.quadraticCurveTo(adjustedX, y + cardHeight, adjustedX, y + cardHeight - radius);
      ctx.lineTo(adjustedX, y + radius);
      ctx.quadraticCurveTo(adjustedX, y, adjustedX + radius, y);
      ctx.closePath();
      
      // Fundo gradiente sutil
      const bgGradient = ctx.createLinearGradient(adjustedX, y, adjustedX, y + cardHeight);
      bgGradient.addColorStop(0, '#ffffff');
      bgGradient.addColorStop(1, '#fafafa');
      ctx.fillStyle = bgGradient;
      ctx.fill();
      
      // Borda gradiente mais elegante
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = 4;
      const gradient = ctx.createLinearGradient(adjustedX, y, adjustedX + cardWidth, y + cardHeight);
      gradient.addColorStop(0, cardColor);
      gradient.addColorStop(0.5, cardColor + 'CC');
      gradient.addColorStop(1, cardColor + '80');
      ctx.strokeStyle = gradient;
      ctx.stroke();
      
      // Borda interna sutil
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.stroke();
      
      // Efeito de brilho no topo
      ctx.beginPath();
      // Implementação compatível de roundRect para o brilho
      const highlightRadius = 14;
      const highlightX = adjustedX + 2;
      const highlightY = y + 2;
      const highlightWidth = cardWidth - 4;
      const highlightHeight = 30;
      ctx.moveTo(highlightX + highlightRadius, highlightY);
      ctx.lineTo(highlightX + highlightWidth - highlightRadius, highlightY);
      ctx.quadraticCurveTo(highlightX + highlightWidth, highlightY, highlightX + highlightWidth, highlightY + highlightRadius);
      ctx.lineTo(highlightX + highlightWidth, highlightY + highlightHeight - highlightRadius);
      ctx.quadraticCurveTo(highlightX + highlightWidth, highlightY + highlightHeight, highlightX + highlightWidth - highlightRadius, highlightY + highlightHeight);
      ctx.lineTo(highlightX + highlightRadius, highlightY + highlightHeight);
      ctx.quadraticCurveTo(highlightX, highlightY + highlightHeight, highlightX, highlightY + highlightHeight - highlightRadius);
      ctx.lineTo(highlightX, highlightY + highlightRadius);
      ctx.quadraticCurveTo(highlightX, highlightY, highlightX + highlightRadius, highlightY);
      ctx.closePath();
      const highlightGradient = ctx.createLinearGradient(adjustedX, y, adjustedX, y + 30);
      highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
      ctx.fillStyle = highlightGradient;
      ctx.fill();
      
      ctx.restore();

      // Desenhar o ícone de menu (três pontos) no canto superior direito
      const menuIconX = adjustedX + cardWidth - 40;
      const menuIconY = y + 20;
      const menuIconSize = 24;
      const menuIconRadius = 2;
      const menuIconSpacing = 4;

      // Verificar se o usuário tem permissão para ver o menu
      const canShowMenu = 
        userRole === 'ADMIN' || 
        userRole === 'SUPERADMIN' || 
        (userRole === 'GESTOR' && node.manager?.id === currentUserId);

      // Registrar área clicável do ícone de menu apenas se tiver permissão
      if (canShowMenu) {
        buttonAreasRef.current.push({
          x: menuIconX,
          y: menuIconY,
          w: menuIconSize,
          h: menuIconSize,
          id: node.id,
          type: 'menu'
        });

        // Desenhar os três pontos
        ctx.save();
        ctx.fillStyle = '#64748B';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(
            menuIconX + menuIconSize/2,
            menuIconY + menuIconSize/2 + (i - 1) * menuIconSpacing,
            menuIconRadius,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        ctx.restore();
      }

      // Título do departamento com estilo moderno
      ctx.save();
      ctx.font = '700 18px Inter';
      ctx.fillStyle = '#1F2937';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      
      // Sombra sutil no texto
      ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1;
      
             ctx.fillText(node.title, adjustedX + 24, y + 20);
      // Registrar área clicável do título (ajustar largura)
      const titleWidth = ctx.measureText(node.title).width;
      titleAreasRef.current.push({
        x: adjustedX + 24,
        y: y + 20,
        width: titleWidth,
        height: 22,
        id: node.id
      });
      // Aplicar lógica de cores baseada no mês selecionado para o círculo próprio
      let corProprio = '#10B981'; // verde
      if (isCurrentMonth) {
        // Mês atual: lógica original
        if (percentualProprio < percentualEsperado - 10) {
          corProprio = '#EF4444'; // vermelho
        } else if (percentualProprio < percentualEsperado) {
          corProprio = '#F59E42'; // amarelo
        }
      } else {
        // Meses passados/futuros: lógica fixa
        if (percentualProprio < 50) {
          corProprio = '#EF4444'; // vermelho
        } else if (percentualProprio < 100) {
          corProprio = '#F59E42'; // amarelo
        }
      }
      
             // Armazenar informações das barras circulares para renderizar como elemento HTML
       const circleX = adjustedX + cardWidth - 90; // Posicionado mais à esquerda para não sobrepor o menu
       const circleSize = 60; // Tamanho da barra circular
      
      // Círculo do próprio departamento (acima)
      const circleYProprio = y + 45; // Posicionado mais acima
      
      // Círculo dos filhos (abaixo)
      const circleYFilhos = y + 115; // Posicionado mais abaixo
      
                            // Adicionar à lista de barras circulares para renderizar
        if (node.children && node.children.length > 0) {
          // Se tem filhos, mostrar ambos os círculos
          setCircularBars(prev => [
            ...prev,
            {
              id: `${node.id}-proprio`,
              percentage: percentualProprio,
              color: corProprio,
              x: circleX,
              y: circleYProprio,
              size: circleSize,
              tooltip: "Meta do próprio departamento",
            },
                         {
               id: `${node.id}-filhos`,
               percentage: percentualReal,
               color: isCurrentMonth ? 
                      (percentualReal >= percentualEsperado ? '#10B981' : 
                       percentualReal < percentualEsperado - 10 ? '#EF4444' : '#F59E42') :
                      (percentualReal >= 100 ? '#10B981' : 
                       percentualReal < 50 ? '#EF4444' : '#F59E42'), // Lógica baseada no mês selecionado
               x: circleX,
               y: circleYFilhos,
               size: circleSize,
               tooltip: "Meta dos departamentos inferiores",
             }
          ]);
        } else {
          // Se não tem filhos, mostrar apenas o círculo do próprio departamento
          setCircularBars(prev => [
            ...prev,
            {
              id: `${node.id}-proprio`,
              percentage: percentualProprio,
              color: corProprio,
              x: circleX,
              y: circleYProprio + 35, // Centralizar verticalmente quando só tem um círculo
              size: circleSize,
              tooltip: "Meta do próprio departamento",
            }
          ]);
        }

        // Contador de colaboradores com ícone
        const textX = adjustedX + 24;
        const textY = y + 55;
        
        // Texto do contador
        ctx.font = '600 12px Inter';
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          `${node.employees.length} colaborador${node.employees.length !== 1 ? 'es' : ''}`,
          textX + 28,
          textY + 8
        );
        
                 // Adicionar ícone Users como elemento HTML
         setCircularBars(prev => [
           ...prev,
           {
             id: `${node.id}-users-icon`,
             percentage: 0, // Não usado para ícones
             color: corProprio, // Usar a mesma cor do círculo de cima (próprio departamento)
             x: textX + 12,
             y: textY + 8,
             size: 16,
             tooltip: "Colaboradores",
             isIcon: true
           }
         ]);

      

      // Seção do líder com design moderno
      const avatarX = adjustedX + 24;
      const avatarY = y + 90; // Ajustado para não sobrepor os círculos
      const avatarSize = 44;

             // Background do avatar com gradiente e sombra
       ctx.save();
       ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
       ctx.shadowBlur = 12;
       ctx.shadowOffsetX = 0;
       ctx.shadowOffsetY = 4;
       
       ctx.beginPath();
       ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
       
       // Gradiente para o avatar
       const avatarGradient = ctx.createRadialGradient(
         avatarX + avatarSize/2, avatarY + avatarSize/2, 0,
         avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2
       );
       avatarGradient.addColorStop(0, '#f8fafc');
       avatarGradient.addColorStop(1, '#e2e8f0');
       ctx.fillStyle = avatarGradient;
       ctx.fill();
       
               // Borda com gradiente
        const avatarBorderGradient = ctx.createLinearGradient(
          avatarX, avatarY, 
          avatarX + avatarSize, avatarY + avatarSize
        );
        avatarBorderGradient.addColorStop(0, corProprio + '60'); // Usar a mesma cor do círculo de cima
        avatarBorderGradient.addColorStop(1, corProprio + '30');
        ctx.strokeStyle = avatarBorderGradient;
       ctx.lineWidth = 2.5;
       ctx.stroke();

      // Foto ou iniciais
      if (node.manager?.photo) {
        const img = new Image();
        img.src = node.manager.photo;
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();
      } else {
        ctx.font = 'bold 20px Montserrat, Inter, Arial';
        ctx.fillStyle = '#64748B';
        const initials = node.manager?.name
          ? node.manager.name.split(' ').map(n => n[0]).join('').toUpperCase()
          : node.title[0].toUpperCase();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initials, avatarX + avatarSize / 2, avatarY + avatarSize / 2);
      }
      ctx.restore();

      // Informações do líder
      ctx.save();
      ctx.textAlign = 'left';
      
      // Cargo
      ctx.font = '400 12px Inter';
      ctx.fillStyle = '#64748B';
      ctx.textBaseline = 'bottom';
      ctx.fillText('Líder', avatarX + avatarSize + 12, avatarY + 16);
      
      // Nome - Posicionamento à esquerda dos círculos
      ctx.font = '500 14px Inter';
      ctx.fillStyle = '#1A202C';
      ctx.textBaseline = 'top';
      
      const nome = node.manager?.name || 'Sem líder definido';
      
      // Posicionar o nome à esquerda dos círculos, com espaço adequado
      const nomeX = avatarX + avatarSize + 12;
      const nomeY = avatarY + 20; // Alinhado com o avatar
      const maxWidth = circleX - nomeX - 20; // Espaço disponível até os círculos
      
      // Função para quebrar texto
      const wrapText = (text, maxWidth) => {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
          const testLine = currentLine ? currentLine + ' ' + word : word;
          const testWidth = ctx.measureText(testLine).width;
          
          if (testWidth > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        
        if (currentLine) {
          lines.push(currentLine);
        }
        
        return lines;
      };
      
      const linhas = wrapText(nome, maxWidth);
      linhas.forEach((linha, index) => {
        ctx.fillText(linha, nomeX, nomeY + (index * 18));
      });
      
      ctx.restore();

      // Seção da meta
      if (node.goals && node.goals.length > 0) {
        let metaY = avatarY + avatarSize + 25; // Ajustado para dar mais espaço
        
        // Se for o departamento pai (raiz), usar a meta global
        if (isRoot && globalGoal) {
          // Título da meta global
          ctx.save();
          ctx.font = '500 13px Inter';
          ctx.fillStyle = '#1A202C';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(globalGoal.title, adjustedX + 24, metaY);

          // Barra de progresso da meta global
          const progress = Math.min(1, globalGoal.current_value / globalGoal.target_value);
          const barWidth = cardWidth - 48;
          const barHeight = 6;
          const barY = metaY + 20;
          ctx.beginPath();
          ctx.roundRect(adjustedX + 24, barY, barWidth, barHeight, 3);
          ctx.fillStyle = '#f3f4f6';
          ctx.fill();
          ctx.beginPath();
          ctx.roundRect(adjustedX + 24, barY, barWidth * progress, barHeight, 3);
          ctx.fillStyle = progress >= 1 ? '#22c55e' : '#3B82F6';
          ctx.fill();
          ctx.font = '400 12px Inter';
          ctx.fillStyle = '#64748B';
          ctx.fillText(
            `${globalGoal.current_value} / ${globalGoal.target_value}`,
            adjustedX + 24,
            barY + barHeight + 8
          );
          ctx.restore();
        } else {
          // Para outros departamentos, não mostrar metas detalhadas - apenas cards básicos
          // Comentado para mostrar apenas informações básicas dos departamentos
          /*
          node.goals?.forEach((meta: DepartmentGoal, idx: number) => {
            // Título da meta
            ctx.save();
            ctx.font = '500 13px Inter';
            ctx.fillStyle = '#1A202C';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(meta.title, adjustedX + 24, metaY);

            // Barra de progresso
            const progress = Math.min(1, meta.current_value / meta.target_value);
            const barWidth = cardWidth - 48;
            const barHeight = 6;
            const barY = metaY + 20;
            ctx.beginPath();
            ctx.roundRect(adjustedX + 24, barY, barWidth, barHeight, 3);
            ctx.fillStyle = '#f3f4f6';
            ctx.fill();
            ctx.beginPath();
            ctx.roundRect(adjustedX + 24, barY, barWidth * progress, barHeight, 3);
            ctx.fillStyle = progress >= 1 ? '#22c55e' : '#3B82F6';
            ctx.fill();
            ctx.font = '400 12px Inter';
            ctx.fillStyle = '#64748B';
            ctx.fillText(
              `${meta.current_value} / ${meta.target_value}`,
              adjustedX + 24,
              barY + barHeight + 8
            );
            ctx.restore();
            // Espaço para a próxima meta
            metaY = barY + barHeight + 24;
          });
          */
        }
      }

      // Botão de expandir/colapsar
      if (node.children && node.children.length > 0) {
        const buttonSize = 28;
        const buttonX = adjustedX + cardWidth/2 - buttonSize/2;
        const buttonY = y + cardHeight - buttonSize/2; // Posicionado exatamente na linha inferior do card
        
        ctx.save();
        // Círculo do botão
        ctx.beginPath();
        ctx.arc(buttonX + buttonSize/2, buttonY, buttonSize/2, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.shadowColor = 'rgba(59,130,246,0.10)';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#3B82F6';
        ctx.stroke();
        
        // Símbolo + ou -
        ctx.fillStyle = '#3B82F6';
        ctx.font = 'bold 18px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.isExpanded ? '−' : '+', buttonX + buttonSize/2, buttonY);
        ctx.restore();

        // Registra área do botão
        buttonAreasRef.current.push({
          x: buttonX,
          y: buttonY - buttonSize/2,
          w: buttonSize,
          h: buttonSize,
          id: node.id
        });
      }

      // Desenhar conexões se tiver filhos expandidos
      if (node.isExpanded && node.children && node.children.length > 0) {
        const childY = y + NODE_HEIGHT + VERTICAL_GAP;
        let currentX = x;
        const parentCenterX = adjustedX + NODE_WIDTH / 2;
        const parentBottomY = y + NODE_HEIGHT;
        const connectionY = childY - VERTICAL_GAP / 2;

        // Linha vertical do pai
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(parentCenterX, parentBottomY);
        ctx.lineTo(parentCenterX, connectionY);
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

          // Armazenar centros dos filhos para conexões
          const childrenCenters = [];
        
        // Primeiro passo: desenhar os nós filhos e coletar seus centros
        node.children.forEach((child, index) => {
          const childWidth = getSubtreeWidth(child);
          const childCenterX = currentX + childWidth / 2;
          childrenCenters.push(childCenterX);
          
          // Desenhar o nó filho (filhos nunca são raiz)
          drawNode(child, currentX, childY, false);
          currentX += childWidth + HORIZONTAL_GAP;
        });

        // Segundo passo: desenhar linha horizontal conectando todos os filhos
        if (childrenCenters.length > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(childrenCenters[0], connectionY);
          ctx.lineTo(childrenCenters[childrenCenters.length - 1], connectionY);
          ctx.strokeStyle = '#3B82F6';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Terceiro passo: desenhar linhas verticais e círculos para cada filho
          childrenCenters.forEach(centerX => {
            ctx.save();
            // Linha vertical
            ctx.beginPath();
            ctx.moveTo(centerX, connectionY);
            ctx.lineTo(centerX, childY);
            ctx.strokeStyle = '#3B82F6';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Círculo decorativo na conexão
            ctx.beginPath();
            ctx.arc(centerX, childY - 5, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.strokeStyle = '#3B82F6';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
          });
        }
      }

      return { width: subtreeWidth, height: NODE_HEIGHT };
    };

    const drawChart = () => {
      if (!ctx || !canvasRef.current) return;

      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      buttonAreasRef.current = [];
      titleAreasRef.current = [];
      
      // Limpar barras circulares antes de redesenhar
      setCircularBars([]);

      ctx.save();
      ctx.translate(offset.x, offset.y);
      ctx.scale(scale, scale);

      const totalWidth = getSubtreeWidth(data);
      const startX = (canvasRef.current.width / scale - totalWidth) / 2;
      
      drawNode(data, startX, 40, true);
      
      ctx.restore();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, offset, scale]);

  const handleMouseDown = (e) => {
    // Só inicia o arrasto se for o botão esquerdo do mouse
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !dragStart) return;
    
    // Calcula a distância movida
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    // Só move se a distância for maior que um threshold (evita movimento acidental)
    const threshold = 5;
    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      setOffset(prev => ({
        x: prev.x + dx,
        y: prev.y + dy
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart({ x: 0, y: 0 });
  };

  const handleTouchStart = (e) => {
    setIsDragging(true);
    const touch = e.touches[0];
    setDragStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchMove = (e) => {
    if (!isDragging || !dragStart) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragStart.x;
    const dy = touch.clientY - dragStart.y;
    setOffset(prev => ({
      x: prev.x + dx,
      y: prev.y + dy
    }));
    setDragStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setDragStart({ x: 0, y: 0 });
  };

  const handleWheel = (e) => {
    // Exemplo: zoom ou scroll
    // e.preventDefault(); // só se necessário
    // Sua lógica de zoom/scroll aqui, ou apenas deixe vazio para não quebrar
  };

  const handleNodeClick = (e) => {
    // Só processa o clique se não estiver arrastando e for um clique simples
    if (isDragging || e.button !== 0) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / scale;
    const y = (e.clientY - rect.top - offset.y) / scale;

    // Primeiro, verificar clique nos botões de expandir/colapsar e menu
    for (const area of buttonAreasRef.current) {
      if (
        x >= area.x &&
        x <= area.x + area.w &&
        y >= area.y &&
        y <= area.y + area.h
      ) {
        if (area.type === 'menu') {
          const findNodeById = (node) => {
            if (node.id === area.id) return node;
            if (node.children) {
              for (const child of node.children) {
                const found = findNodeById(child);
                if (found) return found;
              }
            }
            return null;
          };

          const clickedNode = findNodeById(data);
          if (clickedNode) {
            // Verifica permissões antes de mostrar o menu
            if (userRole === 'FUNCIONARIO') {
              return;
            }

            if (userRole === 'GESTOR' && clickedNode.manager?.id !== currentUserId) {
              return;
            }

            // Mostra o menu
            setSelectedNode(clickedNode);
            setMenuPosition({ x: e.clientX, y: e.clientY });
            return;
          }
        } else if (onToggleExpand) {
          // Find the node by id and pass the node object
          const findNodeById = (node) => {
            if (node.id === area.id) return node;
            if (node.children) {
              for (const child of node.children) {
                const found = findNodeById(child);
                if (found) return found;
              }
            }
            return null;
          };
          const nodeToToggle = findNodeById(data);
          if (nodeToToggle) {
            onToggleExpand(nodeToToggle);
          }
          return;
        }
      }
    }

    // Verificar clique no card (excluindo a área do menu)
    for (const area of titleAreasRef.current) {
      const cardX = area.x - 24;
      const cardY = area.y - 20;
      
      const isCardClick = 
        x >= cardX &&
        x <= cardX + NODE_WIDTH &&
        y >= cardY &&
        y <= cardY + NODE_HEIGHT;

      if (isCardClick) {
        const findNodeById = (node) => {
          if (node.id === area.id) return node;
          if (node.children) {
            for (const child of node.children) {
              const found = findNodeById(child);
              if (found) return found;
            }
          }
          return null;
        };

        const clickedNode = findNodeById(data);
        if (clickedNode) {
          // Navegar para a página do departamento
          router.push(`/estrategico/organograma/${clickedNode.id}`);
          return;
        }
      }
    }
  };

  const handleCenter = () => {
    setOffset({ x: 0, y: 0 });
    setScale(1);
  };

  // Função para pré-carregar todas as fotos dos líderes
  const preloadManagerImages = (node) => {
    if (node.manager && node.manager.photo && !imagesCache.current[node.manager.photo]) {
      const img = new window.Image();
      img.src = node.manager.photo;
      imagesCache.current[node.manager.photo] = img;
    }
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => preloadManagerImages(child));
    }
  };

  // Chame o preload antes de desenhar o canvas
  useEffect(() => {
    preloadManagerImages(data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Função auxiliar para filtrar metas por trimestre
  function metasFiltradasPorTrimestre(goals, trimestre) {
    if (!trimestre) return goals;
    return goals.filter(meta => {
      const month = new Date(meta.start_date).getMonth() + 1;
      if (trimestre === '1') return month >= 1 && month <= 3;
      if (trimestre === '2') return month >= 4 && month <= 6;
      if (trimestre === '3') return month >= 7 && month <= 9;
      if (trimestre === '4') return month >= 10 && month <= 12;
      return true;
    });
  }

  // Função para fechar o menu
  const handleCloseMenu = () => {
    setMenuPosition(null);
    setSelectedNode(null);
  };

  // Efeito para fechar o menu quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        handleCloseMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className={styles.container} onTouchEnd={handleTouchEnd}>
      <canvas
        ref={canvasRef}
        className={`${styles.canvas} ${isDragging ? styles.canvasDragging : styles.canvasNotDragging} ${highlightedDepartment ? styles.canvasTransitioning : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleNodeClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      
                     {/* Barras Circulares de Porcentagem */}
        {circularBars.map((bar) => (
          <CircularProgressBar
            key={bar.id}
            percentage={bar.percentage}
            color={bar.color}
            x={bar.x * scale + offset.x}
            y={bar.y * scale + offset.y}
            size={bar.size * scale}
            tooltip={bar.tooltip}
            isIcon={bar.isIcon}
          />
        ))}
      
      {/* Menu de Contexto */}
      {menuPosition && selectedNode && (
        <div
          ref={menuRef}
          className={styles.contextMenu}
          style={{
            left: menuPosition.x,
            top: menuPosition.y,
          }}
          onClick={e => e.stopPropagation()}
        >
          <button
            className={styles.contextMenuButton}
            onClick={() => {
              router.push(`/estrategico/organograma/${selectedNode.id}`);
              handleCloseMenu();
            }}
          >
            <svg className={styles.contextMenuButtonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Ver Departamento
          </button>
          {(userRole === 'ADMIN' || 
            userRole === 'SUPERADMIN' || 
            (userRole === 'GESTOR' && selectedNode.manager?.id === currentUserId)
          ) && (
            <>
              <button
                className={styles.contextMenuButton}
                onClick={() => {
                  if (onEditDepartment) {
                    onEditDepartment(selectedNode);
                    handleCloseMenu();
                  }
                }}
              >
                <svg className={styles.contextMenuButtonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editar Departamento
              </button>
              <button
                className={`${styles.contextMenuButton} ${styles.contextMenuButtonDanger}`}
                onClick={() => {
                  if (onDeleteDepartment) {
                    onDeleteDepartment(selectedNode);
                    handleCloseMenu();
                  }
                }}
              >
                <svg className={styles.contextMenuButtonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Excluir Departamento
              </button>
            </>
          )}
        </div>
      )}

      {/* Controles de Zoom */}
      <div className={styles.zoomControls}>
        <button
          onClick={handleCenter}
          className={styles.zoomButton}
          title="Centralizar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
        </button>
        
        <button
          onClick={() => setScale(prev => Math.max(0.1, prev - 0.1))}
          className={styles.zoomButton}
          title="Diminuir zoom"
        >
          -
        </button>
        
        <span className={styles.zoomLabel}>
          {Math.round(scale * 100)}%
        </span>
        
        <button
          onClick={() => setScale(prev => Math.min(2, prev + 0.1))}
          className={styles.zoomButton}
          title="Aumentar zoom"
        >
          +
        </button>
      </div>
    </div>
  );
};

export default CanvasOrgChart; 