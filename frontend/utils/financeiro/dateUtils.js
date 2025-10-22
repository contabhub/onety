export function formatarDataParaMysql(data) {
    if (!data) return null;
  
    const match = data.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (match) {
      const [, dia, mes, ano] = match;
      return `${ano}-${mes}-${dia}`;
    }
  
    const matchISO = data.match(/^\d{4}-\d{2}-\d{2}$/);
    if (matchISO) return data;
  
    return null;
  }
  
  export function formatarDataParaExibicao(data) {
    if (!data) return '';
    
    // Verifica se está no formato YYYY-MM-DD
    const match = data.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, ano, mes, dia] = match;
      return `${dia}/${mes}/${ano}`;
    }
    
    return data;
  }
  
  export function formatarDataParaGrafico(data) {
    if (!data) return '';
    
    // Verifica se está no formato YYYY-MM-DD
    const match = data.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, ano, mes, dia] = match;
      return `${dia}/${mes}`;
    }
    
    return data;
  }
  