/**
 * 📝 Utilitários para manipulação de contatos
 */

/**
 * 🔄 Normaliza as notas internas para garantir consistência
 * @param {any} notas_internas - Dados das notas (pode ser string, array ou null)
 * @returns {Array} - Array normalizado das notas
 */
export function normalizeNotasInternas(notas_internas) {
  if (!notas_internas) {
    return [];
  }
  
  if (Array.isArray(notas_internas)) {
    return notas_internas;
  }
  
  if (typeof notas_internas === 'string') {
    try {
      const parsed = JSON.parse(notas_internas);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Erro ao fazer parse das notas internas:', e);
      return [];
    }
  }
  
  return [];
}

/**
 * 📤 Prepara as notas internas para envio ao backend
 * @param {Array} notas_internas - Array das notas
 * @returns {string} - JSON string para envio
 */
export function prepareNotasInternasForSend(notas_internas) {
  if (!Array.isArray(notas_internas)) {
    return JSON.stringify([]);
  }
  
  return JSON.stringify(notas_internas);
}

/**
 * 📅 Formata data para exibição
 * @param {string} dateString - Data em formato ISO
 * @returns {string} - Data formatada
 */
export function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('pt-BR');
}

/**
 * 📱 Formata telefone para exibição
 * @param {string} phone - Número do telefone
 * @returns {string} - Telefone formatado
 */
export function formatPhone(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 13 && cleaned.startsWith('55')) {
    const ddd = cleaned.substring(2, 4);
    const number = cleaned.substring(4);
    return `(${ddd}) ${number.substring(0, number.length - 4)}-${number.substring(number.length - 4)}`;
  }
  return phone;
}
