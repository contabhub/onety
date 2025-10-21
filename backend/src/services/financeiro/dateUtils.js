/**
 * Utilitários para manipulação de datas com tratamento correto de anos bissextos
 * e meses com diferentes quantidades de dias
 */

/**
 * Calcula o próximo vencimento respeitando limites do mês
 * @param {Date} dataAtual - Data atual
 * @param {number} intervalo - Quantidade de unidades a adicionar
 * @param {string} tipoIntervalo - 'dias', 'semanas', 'meses', 'anos'
 * @returns {Date} Nova data calculada
 */
function calcularProximoVencimento(dataAtual, intervalo, tipoIntervalo) {
  // ✅ CORREÇÃO: Garantir que a data seja criada corretamente
  let novaData;
  if (typeof dataAtual === 'string') {
    // Se for string, criar data manualmente para evitar problemas de fuso horário
    const partes = dataAtual.split('-');
    novaData = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
  } else {
    novaData = new Date(dataAtual);
  }
  
  switch (tipoIntervalo) {
    case 'dias':
      novaData.setDate(novaData.getDate() + intervalo);
      break;
    case 'semanas':
      novaData.setDate(novaData.getDate() + intervalo * 7);
      break;
    case 'meses':
      // ✅ CORREÇÃO: Tratamento especial para recorrência mensal
      const diaOriginal = novaData.getDate();
      const mesOriginal = novaData.getMonth();
      const anoOriginal = novaData.getFullYear();
      
      // Calcular novo mês e ano
      let novoMes = mesOriginal + intervalo;
      let novoAno = anoOriginal;
      
      // Ajustar se passou de dezembro
      while (novoMes > 11) {
        novoMes -= 12;
        novoAno += 1;
      }
      
      // Ajustar se passou de janeiro (intervalo negativo)
      while (novoMes < 0) {
        novoMes += 12;
        novoAno -= 1;
      }
      
      // Definir o dia correto respeitando o limite do mês
      const diasNoMes = new Date(novoAno, novoMes + 1, 0).getDate();
      let diaFinal;
      
      // ✅ CORREÇÃO: Lógica mais robusta para lidar com dias 31
      if (diaOriginal === 31) {
        if (diasNoMes >= 31) {
          // Se o mês tem 31 dias, usar dia 31
          diaFinal = 31;
        } else if (diasNoMes >= 30) {
          // Se o mês tem 30 dias, usar dia 30
          diaFinal = 30;
        } else {
          // Se o mês tem menos de 30 dias (fevereiro), usar o último dia
          diaFinal = diasNoMes;
        }
      } else {
        // Para outros dias, usar o menor entre o dia original e os dias do mês
        diaFinal = Math.min(diaOriginal, diasNoMes);
      }
      
      novaData.setFullYear(novoAno, novoMes, diaFinal);
      break;
    case 'anos':
      novaData.setFullYear(novaData.getFullYear() + intervalo);
      break;
    default:
      // Padrão: mensal - usar a mesma lógica de 'meses'
      const diaOriginalDefault = novaData.getDate();
      const mesOriginalDefault = novaData.getMonth();
      const anoOriginalDefault = novaData.getFullYear();
      
      let novoMesDefault = mesOriginalDefault + 1;
      let novoAnoDefault = anoOriginalDefault;
      
      if (novoMesDefault > 11) {
        novoMesDefault = 0;
        novoAnoDefault += 1;
      }
      
      const diasNoMesDefault = new Date(novoAnoDefault, novoMesDefault + 1, 0).getDate();
      let diaFinalDefault;
      
      // ✅ CORREÇÃO: Lógica mais robusta para lidar com dias 31
      if (diaOriginalDefault === 31) {
        if (diasNoMesDefault >= 31) {
          // Se o mês tem 31 dias, usar dia 31
          diaFinalDefault = 31;
        } else if (diasNoMesDefault >= 30) {
          // Se o mês tem 30 dias, usar dia 30
          diaFinalDefault = 30;
        } else {
          // Se o mês tem menos de 30 dias (fevereiro), usar o último dia
          diaFinalDefault = diasNoMesDefault;
        }
      } else {
        // Para outros dias, usar o menor entre o dia original e os dias do mês
        diaFinalDefault = Math.min(diaOriginalDefault, diasNoMesDefault);
      }
      
      novaData.setFullYear(novoAnoDefault, novoMesDefault, diaFinalDefault);
  }
  
  return novaData;
}

/**
 * Calcula o próximo vencimento respeitando limites do mês e mantendo o dia original
 * @param {Date} dataAtual - Data atual
 * @param {number} intervalo - Quantidade de unidades a adicionar
 * @param {string} tipoIntervalo - 'dias', 'semanas', 'meses', 'anos'
 * @param {number} diaOriginal - Dia original da primeira parcela
 * @returns {Date} Nova data calculada
 */
function calcularProximoVencimentoComDiaOriginal(dataAtual, intervalo, tipoIntervalo, diaOriginal) {
  // ✅ CORREÇÃO: Garantir que a data seja criada corretamente
  let novaData;
  if (typeof dataAtual === 'string') {
    // Se for string, criar data manualmente para evitar problemas de fuso horário
    const partes = dataAtual.split('-');
    novaData = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
  } else {
    novaData = new Date(dataAtual);
  }
  
  switch (tipoIntervalo) {
    case 'dias':
      novaData.setDate(novaData.getDate() + intervalo);
      break;
    case 'semanas':
      novaData.setDate(novaData.getDate() + intervalo * 7);
      break;
    case 'meses':
      // ✅ CORREÇÃO: Usar o dia original em vez do dia atual
      const mesOriginal = novaData.getMonth();
      const anoOriginal = novaData.getFullYear();
      
      // Calcular novo mês e ano
      let novoMes = mesOriginal + intervalo;
      let novoAno = anoOriginal;
      
      // Ajustar se passou de dezembro
      while (novoMes > 11) {
        novoMes -= 12;
        novoAno += 1;
      }
      
      // Ajustar se passou de janeiro (intervalo negativo)
      while (novoMes < 0) {
        novoMes += 12;
        novoAno -= 1;
      }
      
      // Definir o dia correto respeitando o limite do mês
      const diasNoMes = new Date(novoAno, novoMes + 1, 0).getDate();
      let diaFinal;
      
      // ✅ CORREÇÃO: Lógica mais robusta para lidar com dias 31
      if (diaOriginal === 31) {
        if (diasNoMes >= 31) {
          // Se o mês tem 31 dias, usar dia 31
          diaFinal = 31;
        } else if (diasNoMes >= 30) {
          // Se o mês tem 30 dias, usar dia 30
          diaFinal = 30;
        } else {
          // Se o mês tem menos de 30 dias (fevereiro), usar o último dia
          diaFinal = diasNoMes;
        }
      } else {
        // Para outros dias, usar o menor entre o dia original e os dias do mês
        diaFinal = Math.min(diaOriginal, diasNoMes);
      }
      
      novaData.setFullYear(novoAno, novoMes, diaFinal);
      break;
    case 'anos':
      novaData.setFullYear(novaData.getFullYear() + intervalo);
      break;
    default:
      // Padrão: mensal - usar a mesma lógica de 'meses'
      const mesOriginalDefault = novaData.getMonth();
      const anoOriginalDefault = novaData.getFullYear();
      
      let novoMesDefault = mesOriginalDefault + 1;
      let novoAnoDefault = anoOriginalDefault;
      
      if (novoMesDefault > 11) {
        novoMesDefault = 0;
        novoAnoDefault += 1;
      }
      
      const diasNoMesDefault = new Date(novoAnoDefault, novoMesDefault + 1, 0).getDate();
      let diaFinalDefault;
      
      // ✅ CORREÇÃO: Lógica mais robusta para lidar com dias 31
      if (diaOriginal === 31) {
        if (diasNoMesDefault >= 31) {
          // Se o mês tem 31 dias, usar dia 31
          diaFinalDefault = 31;
        } else if (diasNoMesDefault >= 30) {
          // Se o mês tem 30 dias, usar dia 30
          diaFinalDefault = 30;
        } else {
          // Se o mês tem menos de 30 dias (fevereiro), usar o último dia
          diaFinalDefault = diasNoMesDefault;
        }
      } else {
        // Para outros dias, usar o menor entre o dia original e os dias do mês
        diaFinalDefault = Math.min(diaOriginal, diasNoMesDefault);
      }
      
      novaData.setFullYear(novoAnoDefault, novoMesDefault, diaFinalDefault);
  }
  
  return novaData;
}

/**
 * Gera array de datas para parcelas com tratamento correto de limites de mês
 * @param {Date|string} dataInicial - Data inicial
 * @param {number} totalParcelas - Total de parcelas
 * @param {number} intervalo - Intervalo entre parcelas
 * @param {string} tipoIntervalo - Tipo de intervalo
 * @returns {Date[]} Array de datas
 */
function gerarDatasParcelas(dataInicial, totalParcelas, intervalo, tipoIntervalo) {
  const datas = [];
  
  // ✅ CORREÇÃO: Garantir que a data seja criada corretamente
  let data;
  if (typeof dataInicial === 'string') {
    // Se for string, criar data manualmente para evitar problemas de fuso horário
    const partes = dataInicial.split('-');
    data = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
  } else {
    data = new Date(dataInicial);
  }
  
  // ✅ NOVO: Guardar o dia original para usar em todas as parcelas
  const diaOriginal = data.getDate();
  
  for (let i = 0; i < totalParcelas; i++) {
    // Adicionar a data atual ao array
    datas.push(new Date(data));
    
    // Calcular próxima data apenas se não for a última parcela
    if (i < totalParcelas - 1) {
      // ✅ CORREÇÃO: Usar o dia original em vez do dia atual
      data = calcularProximoVencimentoComDiaOriginal(data, intervalo, tipoIntervalo, diaOriginal);
    }
  }
  
  return datas;
}

/**
 * Verifica se um ano é bissexto
 * @param {number} ano - Ano para verificar
 * @returns {boolean} True se for bissexto
 */
function ehAnoBissexto(ano) {
  return (ano % 4 === 0 && ano % 100 !== 0) || (ano % 400 === 0);
}

/**
 * Retorna a quantidade de dias em um mês específico
 * @param {number} mes - Mês (0-11)
 * @param {number} ano - Ano
 * @returns {number} Quantidade de dias no mês
 */
function diasNoMes(mes, ano) {
  return new Date(ano, mes + 1, 0).getDate();
}

module.exports = {
  calcularProximoVencimento,
  calcularProximoVencimentoComDiaOriginal,
  gerarDatasParcelas,
  ehAnoBissexto,
  diasNoMes
};
