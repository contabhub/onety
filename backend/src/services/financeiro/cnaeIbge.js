const axios = require('axios');

// cnae pode ser "6201-5/00" ou "6201500" -> normalizamos para só dígitos
function normalizarCNAE(cnae) {
  return String(cnae).replace(/\D/g, '');
}

// Normalizar número de conta corrente - remove hífens e outros caracteres especiais
function normalizarContaCorrente(conta) {
  return String(conta).replace(/\D/g, '');
}

// Detectar tipo de pessoa baseado no CPF/CNPJ
function detectarTipoPessoa(cpfCnpj) {
  if (!cpfCnpj) return 'FISICA';
  
  // Remover caracteres especiais
  const numero = String(cpfCnpj).replace(/\D/g, '');
  
  // CNPJ tem 14 dígitos, CPF tem 11
  if (numero.length === 14) {
    return 'JURIDICA';
  } else if (numero.length === 11) {
    return 'FISICA';
  }
  
  // Fallback: se tem mais de 11 dígitos, provavelmente é CNPJ
  return numero.length > 11 ? 'JURIDICA' : 'FISICA';
}

// Detectar se o código CNAE é uma classe (4 dígitos) ou subclasse (7 dígitos)
function detectarTipoCNAE(codigo) {
  const code = normalizarCNAE(codigo);
  
  if (code.length === 4) {
    return 'classe';
  } else if (code.length === 7) {
    return 'subclasse';
  } else {
    // Se não for nem 4 nem 7 dígitos, tenta como subclasse primeiro
    return 'subclasse';
  }
}

async function buscarCNAE_IBGE(cnae) {
  try {
    const code = normalizarCNAE(cnae);
    const tipo = detectarTipoCNAE(code);
    
    let url;
    if (tipo === 'classe') {
      url = `https://servicodados.ibge.gov.br/api/v2/cnae/classes/${code}`;
    } else {
      url = `https://servicodados.ibge.gov.br/api/v2/cnae/subclasses/${code}`;
    }
    
    const { data } = await axios.get(url, { timeout: 10000 });
    
    // Estrutura de resposta diferente para classe vs subclasse
    if (tipo === 'classe') {
      return {
        codigo: code,
        tipo: 'classe',
        descricao: data?.descricao || null,
        grupo: data?.grupo?.descricao || null,
        divisao: data?.divisao?.descricao || null,
        secao: data?.secao?.descricao || null
      };
    } else {
      return {
        codigo: code,
        tipo: 'subclasse',
        descricao: data?.descricao || null,
        classe: data?.classe?.descricao || null,
        grupo: data?.grupo?.descricao || null,
        divisao: data?.divisao?.descricao || null,
        secao: data?.secao?.descricao || null
      };
    }
  } catch (error) {
    console.error('Erro ao buscar CNAE no IBGE:', error.message);
    
    // Se falhou como subclasse, tenta como classe
    const code = normalizarCNAE(cnae);
    if (detectarTipoCNAE(code) === 'subclasse') {
      try {
        const classeCode = code.substring(0, 4);
        const url = `https://servicodados.ibge.gov.br/api/v2/cnae/classes/${classeCode}`;
        const { data } = await axios.get(url, { timeout: 10000 });
        
        return {
          codigo: code,
          tipo: 'subclasse_fallback_classe',
          descricao: null,
          classe: data?.descricao || null,
          grupo: data?.grupo?.descricao || null,
          divisao: data?.divisao?.descricao || null,
          secao: data?.secao?.descricao || null,
          aviso: 'Subclasse não encontrada, mostrando informações da classe'
        };
      } catch (classeError) {
        console.error('Erro ao buscar classe como fallback:', classeError.message);
      }
    }
    
    // Retorna informações básicas mesmo se a API falhar
    return {
      codigo: normalizarCNAE(cnae),
      tipo: 'erro',
      descricao: null,
      classe: null,
      grupo: null,
      divisao: null,
      secao: null,
      erro: 'Não foi possível buscar informações do CNAE no IBGE'
    };
  }
}

// Função específica para buscar apenas classes
async function buscarClasseCNAE_IBGE(codigo) {
  try {
    const code = normalizarCNAE(codigo);
    const url = `https://servicodados.ibge.gov.br/api/v2/cnae/classes/${code}`;
    
    const { data } = await axios.get(url, { timeout: 10000 });
    
    return {
      codigo: code,
      tipo: 'classe',
      descricao: data?.descricao || null,
      grupo: data?.grupo?.descricao || null,
      divisao: data?.divisao?.descricao || null,
      secao: data?.secao?.descricao || null
    };
  } catch (error) {
    console.error('Erro ao buscar classe CNAE no IBGE:', error.message);
    
    return {
      codigo: normalizarCNAE(codigo),
      tipo: 'classe',
      descricao: null,
      grupo: null,
      divisao: null,
      secao: null,
      erro: 'Não foi possível buscar informações da classe CNAE no IBGE'
    };
  }
}

// Função específica para buscar apenas subclasses
async function buscarSubclasseCNAE_IBGE(codigo) {
  try {
    const code = normalizarCNAE(codigo);
    const url = `https://servicodados.ibge.gov.br/api/v2/cnae/subclasses/${code}`;
    
    const { data } = await axios.get(url, { timeout: 10000 });
    
    return {
      codigo: code,
      tipo: 'subclasse',
      descricao: data?.descricao || null,
      classe: data?.classe?.descricao || null,
      grupo: data?.grupo?.descricao || null,
      divisao: data?.divisao?.descricao || null,
      secao: data?.secao?.descricao || null
    };
  } catch (error) {
    console.error('Erro ao buscar subclasse CNAE no IBGE:', error.message);
    
    return {
      codigo: normalizarCNAE(codigo),
      tipo: 'subclasse',
      descricao: null,
      classe: null,
      grupo: null,
      divisao: null,
      secao: null,
      erro: 'Não foi possível buscar informações da subclasse CNAE no IBGE'
    };
  }
}

module.exports = { 
  buscarCNAE_IBGE, 
  buscarClasseCNAE_IBGE, 
  buscarSubclasseCNAE_IBGE,
  normalizarCNAE, 
  normalizarContaCorrente, 
  detectarTipoPessoa,
  detectarTipoCNAE
};
