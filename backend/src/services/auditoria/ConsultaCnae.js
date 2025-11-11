const axios = require('axios');

/**
 * Serviço para consulta de CNAEs na API da LegisWeb
 * Baseado na implementação do frontend, mas adaptado para o backend
 */

// Configurações da API LegisWeb
const LEGISWEB_BASE_URL = 'https://www.legisweb.com.br/api/empresas/';
const LEGISWEB_TOKEN = process.env.LEGISWEB_TOKEN;
const LEGISWEB_USER_ID = process.env.LEGISWEB_USER_ID;

/**
 * Valida se as credenciais da LegisWeb estão configuradas
 */
const validarCredenciais = () => {
  if (!LEGISWEB_TOKEN || !LEGISWEB_USER_ID) {
    throw new Error('Credenciais da LegisWeb não configuradas. Configure LEGISWEB_TOKEN e LEGISWEB_USER_ID no .env');
  }
};

/**
 * Limpa o CNPJ removendo caracteres especiais
 */
const limparCnpj = (cnpj) => {
  return cnpj.replace(/[^\d]/g, '');
};

/**
 * Consulta dados da empresa na API da LegisWeb
 * @param {string} cnpj - CNPJ da empresa
 * @returns {Promise<Object>} Dados da empresa com CNAEs
 */
const consultarEmpresaLegisweb = async (cnpj) => {
  try {
    validarCredenciais();
    
    const cleanCnpj = limparCnpj(cnpj);
    const url = `${LEGISWEB_BASE_URL}?c=${LEGISWEB_USER_ID}&t=${LEGISWEB_TOKEN}&empresa=${cleanCnpj}`;
    
    console.log(`[Consulta CNAE] Consultando empresa ${cleanCnpj} na LegisWeb...`);
    
    const response = await axios.get(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000 // 10 segundos de timeout
    });
    
    if (response.status !== 200) {
      throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`);
    }
    
    const data = response.data;
    
    if (!data.resposta || data.resposta.length === 0) {
      throw new Error('Empresa não encontrada na LegisWeb');
    }
    
    const empresa = data.resposta[0];
    console.log(`[Consulta CNAE] Empresa encontrada: ${empresa.razao_social || empresa.nome_fantasia}`);
    
    return empresa;
  } catch (error) {
    console.error(`[Consulta CNAE] Erro ao consultar empresa ${cnpj} na LegisWeb:`, error.message);
    throw error;
  }
};

/**
 * Processa os CNAEs da empresa e retorna um array formatado
 * @param {Object} empresaData - Dados da empresa da LegisWeb
 * @returns {Array} Array de CNAEs processados
 */
const processarCnaes = (empresaData) => {
  const cnaes = [];
  
  console.log(`[Consulta CNAE] Dados da empresa recebidos:`, {
    atividade_principal: empresaData.atividade_principal,
    atividade_secundaria: empresaData.atividade_secundaria,
    tem_atividade_secundaria: Array.isArray(empresaData.atividade_secundaria),
    quantidade_atividade_secundaria: empresaData.atividade_secundaria ? empresaData.atividade_secundaria.length : 0
  });
  
  // CNAE Principal
  if (empresaData.atividade_principal) {
    // Extrair código e descrição do CNAE principal (formato: "8599604 - TREINAMENTO EM DESENVOLVIMENTO PROFISSIONAL E GERENCIAL")
    const match = empresaData.atividade_principal.match(/^(\d+) - (.+)$/);
    if (match) {
      const codigo = match[1];
      const descricao = match[2];
      console.log(`[Consulta CNAE] Adicionando CNAE principal: ${codigo} - ${descricao}`);
      cnaes.push({
        codigo: codigo,
        descricao: descricao,
        principal: true,
        tipo: 'principal'
      });
    } else {
      console.log(`[Consulta CNAE] Formato do CNAE principal não reconhecido: ${empresaData.atividade_principal}`);
    }
  } else {
    console.log(`[Consulta CNAE] CNAE principal não encontrado`);
  }
  
  // CNAEs Secundários
  if (empresaData.atividade_secundaria && Array.isArray(empresaData.atividade_secundaria)) {
    console.log(`[Consulta CNAE] Processando ${empresaData.atividade_secundaria.length} CNAEs secundários`);
    empresaData.atividade_secundaria.forEach((atividade, index) => {
      // Extrair código e descrição do CNAE secundário (formato: "5819100 - EDIÇÃO DE CADASTROS, LISTAS E DE OUTROS PRODUTOS GRÁFICOS")
      const match = atividade.match(/^(\d+) - (.+)$/);
      if (match) {
        const codigo = match[1];
        const descricao = match[2];
        console.log(`[Consulta CNAE] CNAE secundário ${index + 1}: ${codigo} - ${descricao}`);
        cnaes.push({
          codigo: codigo,
          descricao: descricao,
          principal: false,
          tipo: 'secundario',
          ordem: index + 1
        });
      } else {
        console.log(`[Consulta CNAE] Formato do CNAE secundário não reconhecido: ${atividade}`);
      }
    });
  } else {
    console.log(`[Consulta CNAE] CNAEs secundários não encontrados ou não é array`);
  }
  
  console.log(`[Consulta CNAE] Total de CNAEs processados: ${cnaes.length}`);
  return cnaes;
};

/**
 * Determina se laboratório se aplica ao Fator R
 * @param {string} descricao - Descrição do CNAE
 * @returns {boolean} True se se aplica ao Fator R
 */
const laboratorioSeAplicaFatorR = (descricao) => {
  const descricaoNormalizada = descricao
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  
  // Laboratórios que se aplicam ao Fator R (Anexo III)
  const laboratoriosFatorR = [
    'LABORATORIOS CLINICOS',
    'LABORATORIOS DE ANATOMIA PATOLOGICA',
    'LABORATORIOS DE CITOLOGIA',
    'LABORATORIOS DE DIAGNOSTICO'
  ];
  
  return laboratoriosFatorR.some(tipo => descricaoNormalizada.includes(tipo));
};

/**
 * Determina o anexo do Simples Nacional baseado na descrição do CNAE
 * @param {string} descricao - Descrição do CNAE
 * @returns {string} Anexo correspondente
 */
const determinarAnexo = (descricao) => {
  // Normalizar removendo acentos
  const descricaoNormalizada = descricao
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  
  // Anexo I - Comércio (PRIORIDADE ALTA - palavras específicas)
  if (descricaoNormalizada.includes('COMERCIO VAREJISTA') || 
      descricaoNormalizada.includes('COMERCIO ATACADISTA') ||
      descricaoNormalizada.includes('COMERCIO') || 
      descricaoNormalizada.includes('REVENDA') || 
      descricaoNormalizada.includes('VENDA') ||
      descricaoNormalizada.includes('DISTRIBUICAO') ||
      descricaoNormalizada.includes('RESTAURANTES') ||
      descricaoNormalizada.includes('RESTAURANTE')) {
    return 'Anexo I';
  }
  
  // Anexo II - Indústria (PRIORIDADE ALTA - palavras específicas)
  if (descricaoNormalizada.includes('INDUSTRIA') || 
      descricaoNormalizada.includes('FABRICACAO') || 
      descricaoNormalizada.includes('PRODUCAO') ||
      descricaoNormalizada.includes('MANUFATURA')) {
    return 'Anexo II';
  }
  
  // TREINAMENTO - Anexo III (PRIORIDADE ALTA - específico)
  if (descricaoNormalizada.includes('TREINAMENTO')) {
    return 'Anexo III';
  }
  
  // Anexo IV - Serviços de Tecnologia (PRIORIDADE MÉDIA)
  if (descricaoNormalizada.includes('TECNOLOGIA') || 
      descricaoNormalizada.includes('SOFTWARE') || 
      descricaoNormalizada.includes('DESENVOLVIMENTO')) {
    return 'Anexo IV';
  }
  
  // Anexo V - Serviços de Saúde (PRIORIDADE MÉDIA)
  if (descricaoNormalizada.includes('SAUDE') || 
      descricaoNormalizada.includes('MEDICO') || 
      descricaoNormalizada.includes('HOSPITAL')) {
    return 'Anexo V';
  }
  
  // Laboratórios - Lógica especial (PRIORIDADE MÉDIA)
  if (descricaoNormalizada.includes('LABORATORIO')) {
    // Se se aplica ao Fator R, vai para Anexo III
    if (laboratorioSeAplicaFatorR(descricao)) {
      return 'Anexo III';
    }
    // Caso contrário, mantém como Anexo V (Saúde)
    return 'Anexo V';
  }
  
  // Anexo VI - Serviços de Educação (PRIORIDADE MÉDIA)
  if (descricaoNormalizada.includes('EDUCACAO') || 
      descricaoNormalizada.includes('ESCOLA') || 
      descricaoNormalizada.includes('ENSINO')) {
    return 'Anexo VI';
  }
  
  // Anexo III - Prestação de Serviços (PRIORIDADE BAIXA - genérico)
  if (descricaoNormalizada.includes('PRESTACAO') || 
      descricaoNormalizada.includes('SERVICOS') || 
      descricaoNormalizada.includes('CONSULTORIA') ||
      descricaoNormalizada.includes('ASSESSORIA') ||
      descricaoNormalizada.includes('CORRETORES') ||
      descricaoNormalizada.includes('HOTEIS') ||
      descricaoNormalizada.includes('HOTEL') ||
      descricaoNormalizada.includes('MARKETING')) {
    return 'Anexo III';
  }
  
  // Sem classificação - requer análise manual
  return 'Não identificado';
};

/**
 * Determina o Fator R baseado no anexo
 * @param {string} anexo - Anexo do Simples Nacional
 * @returns {string} Status do Fator R
 */
const determinarFatorR = (anexo) => {
  // Anexos que não se aplicam ao Fator R
  const anexosSemFatorR = ['Anexo I', 'Anexo II'];
  
  if (anexosSemFatorR.includes(anexo)) {
    return 'Não se aplica';
  }
  
  return 'Se aplica';
};

/**
 * Determina a alíquota baseada no anexo
 * @param {string} anexo - Anexo do Simples Nacional
 * @returns {number} Alíquota em percentual
 */
const determinarAliquota = (anexo) => {
  const aliquotas = {
    'Anexo I': 4.5,
    'Anexo II': 6.0,
    'Anexo III': 9.0,
    'Anexo IV': 12.0,
    'Anexo V': 15.0,
    'Anexo VI': 30.0
  };
  
  return aliquotas[anexo] || 9.0; // Padrão: Anexo III
};

/**
 * Função principal para consultar CNAEs de uma empresa
 * @param {string} cnpj - CNPJ da empresa
 * @returns {Promise<Object>} Dados processados dos CNAEs
 */
const consultarCnaes = async (cnpj) => {
  try {
    console.log(`[Consulta CNAE] Iniciando consulta de CNAEs para CNPJ: ${cnpj}`);
    
    // Consulta dados da empresa na LegisWeb
    const empresaData = await consultarEmpresaLegisweb(cnpj);
    
    // Processa os CNAEs encontrados
    const cnaesProcessados = processarCnaes(empresaData);
    
    // Adiciona informações do Simples Nacional para cada CNAE
    const cnaesCompletos = cnaesProcessados.map(cnae => {
      const anexo = determinarAnexo(cnae.descricao);
      const fatorR = determinarFatorR(anexo);
      const aliquota = determinarAliquota(anexo);
      
      return {
        ...cnae,
        anexo,
        fator_r: fatorR,
        aliquota,
        fonte: 'legisweb'
      };
    });
    
    console.log(`[Consulta CNAE] Processados ${cnaesCompletos.length} CNAEs para ${cnpj}`);
    
    return {
      empresa: {
        cnpj: limparCnpj(cnpj),
        razao_social: empresaData.razao_social,
        nome_fantasia: empresaData.nome_fantasia,
        uf: empresaData.uf,
        municipio: empresaData.municipio,
        situacao: empresaData.situacao
      },
      cnaes: cnaesCompletos,
      total_cnaes: cnaesCompletos.length,
      fonte: 'legisweb'
    };
  } catch (error) {
    console.error(`[Consulta CNAE] Erro na consulta de CNAEs para ${cnpj}:`, error.message);
    throw error;
  }
};

/**
 * Consulta apenas o CNAE principal da empresa
 * @param {string} cnpj - CNPJ da empresa
 * @returns {Promise<Object>} Dados do CNAE principal
 */
const consultarCnaePrincipal = async (cnpj) => {
  try {
    const resultado = await consultarCnaes(cnpj);
    const cnaePrincipal = resultado.cnaes.find(cnae => cnae.principal);
    
    if (!cnaePrincipal) {
      throw new Error('CNAE principal não encontrado');
    }
    
    return {
      empresa: resultado.empresa,
      cnae: cnaePrincipal
    };
  } catch (error) {
    console.error(`[Consulta CNAE] Erro ao consultar CNAE principal para ${cnpj}:`, error.message);
    throw error;
  }
};

module.exports = {
  consultarCnaes,
  consultarCnaePrincipal,
  consultarEmpresaLegisweb,
  processarCnaes,
  determinarAnexo,
  determinarFatorR,
  determinarAliquota,
  limparCnpj
};
