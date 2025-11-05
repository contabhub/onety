// Função utilitária para calcular o progresso de uma meta departamental
export function calcularProgressoMeta(monthlyGoals, calculationType, progressType = 'progresso') {
  const isReverse = progressType === 'regresso';
  
  if (!monthlyGoals || monthlyGoals.length === 0) {
    return isReverse ? 100 : 0;
  }
  
  let progress = 0;
  
  if (calculationType === 'inverso') {
    const percentuais = monthlyGoals.map(m => {
      if (m.value_achieved <= m.value_goal) return 100;
      if (m.value_achieved > 0) return Math.min((m.value_goal / m.value_achieved) * 100, 100);
      return 0;
    });
    progress = Math.min(...percentuais);
    progress = isReverse ? Math.max(0, 100 - progress) : progress;
  } else if (calculationType === 'media') {
    const validMonths = monthlyGoals.filter(m => m.value_goal > 0);
    const percentList = validMonths.map(m => (m.value_achieved / m.value_goal) * 100);
    progress = percentList.length > 0 ? percentList.reduce((a, b) => a + b, 0) / percentList.length : 0;
    progress = isReverse ? Math.max(0, 100 - progress) : progress;
  } else {
    const totalGoal = monthlyGoals.reduce((sum, m) => sum + m.value_goal, 0);
    const totalAchieved = monthlyGoals.reduce((sum, m) => sum + m.value_achieved, 0);
    progress = totalGoal > 0 ? (totalAchieved / totalGoal) * 100 : 0;
    progress = isReverse ? Math.max(0, 100 - progress) : progress;
  }
  
  return Math.min(progress, 100);
}

// Calcula o KPI do mês atual para o departamento (média dos percentuais das metas do mês)
export function calcularKpiDepartamentoMesAtual(goals, selectedYear, selectedMonth) {
  const now = new Date();
  const mesAtual = selectedMonth || now.getMonth() + 1;
  const anoAtual = selectedYear || now.getFullYear();
  
  if (!goals || goals.length === 0) {
    return 0;
  }
  
  const percentuais = goals.map((goal) => {
    if (!goal.monthlyGoals || goal.monthlyGoals.length === 0) {
      const result = goal.progress_type === 'regresso' ? 100 : null;
      return result;
    }
    
    const metaMes = goal.monthlyGoals.find((mg) => {
      const data = new Date(mg.start_date);
      const match = data.getMonth() + 1 === mesAtual && data.getFullYear() === anoAtual;
      return match;
    });
    
    if (!metaMes || metaMes.value_goal === 0) {
      return null;
    }
    
    if (goal.calculation_type === 'acumulativa') {
      let percentual;
      if (metaMes.value_achieved >= metaMes.value_goal) {
        percentual = 100;
      } else {
        percentual = metaMes.value_goal > 0 ? Math.min((metaMes.value_achieved / metaMes.value_goal) * 100, 100) : 0;
      }
      const result = goal.progress_type === 'regresso' ? Math.max(0, 100 - percentual) : percentual;
      return result;
    } else {
      const percentual = Math.min((metaMes.value_achieved / metaMes.value_goal) * 100, 100);
      const result = goal.progress_type === 'regresso' ? Math.max(0, 100 - percentual) : percentual;
      return result;
    }
  }).filter((p) => p !== null);
  
  if (percentuais.length === 0) {
    return 0;
  }
  
  const media = percentuais.reduce((acc, p) => acc + p, 0) / percentuais.length;
  
  return Math.min(media, 100);
}

// Função utilitária para obter o KPI do mês atual (valor, esperado, cor, frase, classe)
export function getKpiMetaPercentualDepartamento(goals, selectedYear, selectedMonth) {
  const now = new Date();
  const mesAtual = selectedMonth || now.getMonth() + 1;
  const anoAtual = selectedYear || now.getFullYear();
  const diasNoMes = new Date(anoAtual, mesAtual, 0).getDate();
  const diaHoje = now.getDate();
  const percentualEsperado = (diaHoje / diasNoMes) * 100;
  const percentualReal = calcularKpiDepartamentoMesAtual(goals, selectedYear, selectedMonth);

  const cor = percentualReal >= percentualEsperado ? '#10B981' : '#EF4444';

  let frase = '';
  let fraseClasse = '';
  if (percentualReal < percentualEsperado) {
    frase = 'Atenção: o departamento está abaixo do ritmo esperado!';
    fraseClasse = 'text-red-600 font-semibold';
  } else {
    frase = 'Ótimo! O departamento está no ritmo esperado.';
    fraseClasse = 'text-green-600 font-semibold';
  }

  return { percentualReal, percentualEsperado, cor, frase, fraseClasse };
}

// Função auxiliar para coletar todos os percentuais dos filhos recursivamente
function coletarPercentuaisTodosFilhos(node, selectedYear, selectedMonth) {
  const todosPercentuais = [];
  
  if (node.children && node.children.length > 0) {
    node.children.forEach((child) => {
      const kpiFilho = getKpiMetaPercentualDepartamentoRecursivo(child, selectedYear, selectedMonth);
      const percentualExibidoNoCard = kpiFilho.percentualReal;
      
      todosPercentuais.push(percentualExibidoNoCard);
    });
  }
  
  return todosPercentuais;
}

// Função para calcular KPI recursivo considerando subdepartamentos
export function getKpiMetaPercentualDepartamentoRecursivo(node, selectedYear, selectedMonth) {
  const now = new Date();
  const mesAtual = selectedMonth || now.getMonth() + 1;
  const anoAtual = selectedYear || now.getFullYear();
  const diasNoMes = new Date(anoAtual, mesAtual, 0).getDate();
  const diaHoje = now.getDate();
  const percentualEsperado = (diaHoje / diasNoMes) * 100;

  const percentualProprio = calcularKpiDepartamentoMesAtual(node.goals || [], selectedYear, selectedMonth);
  
  let percentualReal;
  if (node.children && node.children.length > 0) {
    const todosPercentuaisFilhos = coletarPercentuaisTodosFilhos(node, selectedYear, selectedMonth);
    
    if (todosPercentuaisFilhos.length > 0) {
      percentualReal = todosPercentuaisFilhos.reduce((acc, p) => acc + p, 0) / todosPercentuaisFilhos.length;
    } else {
      percentualReal = 0;
    }
  } else {
    percentualReal = percentualProprio;
  }
  
  percentualReal = Math.min(percentualReal, 100);

  const cor = percentualReal >= percentualEsperado ? '#10B981' : '#EF4444';

  let frase = '';
  let fraseClasse = '';
  if (percentualReal < percentualEsperado) {
    frase = 'Atenção: o departamento está abaixo do ritmo esperado!';
    fraseClasse = 'text-red-600 font-semibold';
  } else {
    frase = 'Ótimo! O departamento está no ritmo esperado.';
    fraseClasse = 'text-green-600 font-semibold';
  }

  return { percentualReal, percentualEsperado, cor, frase, fraseClasse };
}

// Função para calcular KPI do próprio departamento (sem considerar filhos)
export function getKpiMetaPercentualDepartamentoProprio(node, selectedYear, selectedMonth) {
  const now = new Date();
  const mesAtual = selectedMonth || now.getMonth() + 1;
  const anoAtual = selectedYear || now.getFullYear();
  const diasNoMes = new Date(anoAtual, mesAtual, 0).getDate();
  const diaHoje = now.getDate();
  const percentualEsperado = (diaHoje / diasNoMes) * 100;

  let percentualReal = calcularKpiDepartamentoMesAtual(node.goals || [], selectedYear, selectedMonth);
  
  percentualReal = Math.min(percentualReal, 100);

  const cor = percentualReal >= percentualEsperado ? '#10B981' : '#EF4444';

  let frase = '';
  let fraseClasse = '';
  if (percentualReal < percentualEsperado) {
    frase = 'Atenção: o departamento está abaixo do ritmo esperado!';
    fraseClasse = 'text-red-600 font-semibold';
  } else {
    frase = 'Ótimo! O departamento está no ritmo esperado.';
    fraseClasse = 'text-green-600 font-semibold';
  }

  return { percentualReal, percentualEsperado, cor, frase, fraseClasse };
}

