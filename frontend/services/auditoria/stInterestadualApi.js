/**
 * Serviço para integração com a API de ST Interestadual
 * https://www.legisweb.com.br/api/st-interestadual/
 */

// Constantes para destinação de mercadoria
export const DESTINACAO_MERCADORIA = {
  COMERCIALIZACAO: 1,
  ATIVO_FIXO: 2,
  USO_CONSUMO: 3,
  TRANSFERENCIA_VAREJISTA: 4
};

// Constantes para regime tributário
export const REGIME_TRIBUTARIO = {
  NORMAL: 1,
  SIMPLES_NACIONAL: 2
};

// Constantes para optante crédito presumido
export const OPTANTE_CREDITO_PRESUMIDO = {
  NAO: 0,
  SIM: 1
};

// Configuração da API
const API_BASE_URL = 'https://www.legisweb.com.br/api/st-interestadual/';
const API_TOKEN = process.env.NEXT_PUBLIC_LEGISWEB_TOKEN;
const API_CLIENT_ID = process.env.NEXT_PUBLIC_LEGISWEB_USER_ID;

/**
 * Valida se pelo menos um dos parâmetros obrigatórios foi fornecido
 */
const validarParametrosObrigatorios = (params) => {
  return !!(params.ncm || params.codigo || params.descricao || params.cest);
};

/**
 * Constrói a URL da API com os parâmetros fornecidos
 */
const construirUrl = (params) => {
  const urlParams = new URLSearchParams();
  
  // Parâmetros obrigatórios
  urlParams.append('t', API_TOKEN || '');
  urlParams.append('c', API_CLIENT_ID || '');
  urlParams.append('estado_origem', params.estado_origem);
  urlParams.append('estado_destino', params.estado_destino);
  urlParams.append('destinacao_mercadoria', params.destinacao_mercadoria.toString());
  
  // Parâmetros opcionais de busca (pelo menos um deve ser fornecido)
  if (params.ncm) urlParams.append('ncm', params.ncm);
  if (params.codigo) urlParams.append('codigo', params.codigo);
  if (params.descricao) urlParams.append('descricao', params.descricao);
  if (params.cest) urlParams.append('cest', params.cest);
  
  // Parâmetros opcionais adicionais
  if (params.regime_tributario_origem) {
    urlParams.append('regime_tributario_origem', params.regime_tributario_origem.toString());
  }
  if (params.regime_tributario_destino) {
    urlParams.append('regime_tributario_destino', params.regime_tributario_destino.toString());
  }
  if (params.opt_cred_presumido !== undefined) {
    urlParams.append('opt_cred_presumido', params.opt_cred_presumido.toString());
  }
  if (params.id_segmento) {
    urlParams.append('id_segmento', params.id_segmento);
  }
  
  return `${API_BASE_URL}?${urlParams.toString()}`;
};

/**
 * Consulta a API de ST Interestadual
 */
export const consultarSTInterestadual = async (
  params
) => {
  try {
    // Validações
    if (!API_TOKEN || !API_CLIENT_ID) {
      throw new Error('Token e User ID da API LegisWeb não configurados');
    }
    
    if (!validarParametrosObrigatorios(params)) {
      throw new Error('É obrigatório fornecer pelo menos um dos parâmetros: ncm, codigo, descricao ou cest');
    }
    
    if (!params.estado_origem || !params.estado_destino) {
      throw new Error('Estado de origem e destino são obrigatórios');
    }
    
    // Constrói a URL
    const url = construirUrl(params);
    console.log('[ST Interestadual] URL da consulta:', url);
    
    // Faz a requisição
    const response = await fetch(url, {
      method: 'GET',
      // Removendo headers para evitar problemas de CORS
    });
    
    if (!response.ok) {
      const rawText = await response.text();
      console.error('[ST Interestadual] Erro detalhado da API LegisWeb:', rawText);
      throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}\n${rawText}`);
    }
    
    const data = await response.json();
    
    // Log do resultado
    console.log('[ST Interestadual] Registros encontrados:', data.registros);
    
    if (data.registros === 0) {
      console.warn('[ST Interestadual] Nenhum registro encontrado para os parâmetros fornecidos');
    }
    
    return data;
  } catch (error) {
    console.error('[ST Interestadual] Erro na consulta:', error);
    throw error;
  }
};

/**
 * Consulta por NCM específico
 */
export const consultarPorNCM = async (
  ncm,
  estadoOrigem,
  estadoDestino,
  destinacaoMercadoria,
  regimeOrigem,
  regimeDestino
) => {
  return consultarSTInterestadual({
    ncm,
    estado_origem: estadoOrigem,
    estado_destino: estadoDestino,
    destinacao_mercadoria: destinacaoMercadoria,
    regime_tributario_origem: regimeOrigem,
    regime_tributario_destino: regimeDestino,
  });
};

/**
 * Consulta por descrição de produto
 */
export const consultarPorDescricao = async (
  descricao,
  estadoOrigem,
  estadoDestino,
  destinacaoMercadoria,
  regimeOrigem,
  regimeDestino
) => {
  if (descricao.length < 2) {
    throw new Error('A descrição deve ter pelo menos 2 caracteres');
  }
  
  return consultarSTInterestadual({
    descricao,
    estado_origem: estadoOrigem,
    estado_destino: estadoDestino,
    destinacao_mercadoria: destinacaoMercadoria,
    regime_tributario_origem: regimeOrigem,
    regime_tributario_destino: regimeDestino,
  });
};

/**
 * Consulta por CEST
 */
export const consultarPorCEST = async (
  cest,
  estadoOrigem,
  estadoDestino,
  destinacaoMercadoria,
  regimeOrigem,
  regimeDestino
) => {
  return consultarSTInterestadual({
    cest,
    estado_origem: estadoOrigem,
    estado_destino: estadoDestino,
    destinacao_mercadoria: destinacaoMercadoria,
    regime_tributario_origem: regimeOrigem,
    regime_tributario_destino: regimeDestino,
  });
};

/**
 * Função utilitária para formatar valores monetários
 */
export const formatarValorMonetario = (valor) => {
  if (!valor) return '0,00';
  const numero = parseFloat(valor);
  if (isNaN(numero)) return '0,00';
  return numero.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Função utilitária para formatar percentuais
 */
export const formatarPercentual = (valor) => {
  if (!valor) return '0,00%';
  const numero = parseFloat(valor);
  if (isNaN(numero)) return '0,00%';
  return `${numero.toFixed(2)}%`;
};

/**
 * Função utilitária para obter descrição da destinação de mercadoria
 */
export const getDescricaoDestinacao = (codigo) => {
  switch (codigo) {
    case DESTINACAO_MERCADORIA.COMERCIALIZACAO:
      return 'Op. Subsequente - Comercialização';
    case DESTINACAO_MERCADORIA.ATIVO_FIXO:
      return 'Ativo Fixo ou Imobilizado';
    case DESTINACAO_MERCADORIA.USO_CONSUMO:
      return 'Uso e Consumo';
    case DESTINACAO_MERCADORIA.TRANSFERENCIA_VAREJISTA:
      return 'Transferência para Varejista';
    default:
      return 'Não informado';
  }
};

/**
 * Função utilitária para obter descrição do regime tributário
 */
export const getDescricaoRegime = (codigo) => {
  switch (codigo) {
    case REGIME_TRIBUTARIO.NORMAL:
      return 'Regime Normal';
    case REGIME_TRIBUTARIO.SIMPLES_NACIONAL:
      return 'Simples Nacional';
    default:
      return 'Não informado';
  }
};

/**
 * Função de teste para verificar se a API está funcionando
 */
export const testarAPI = async () => {
  try {
    console.log('[ST Interestadual] Testando conexão com a API...');
    
    // Teste com um NCM conhecido (veículos)
    const resultado = await consultarPorNCM(
      '87021000', // NCM de veículos
      'SP',       // São Paulo
      'PR',       // Paraná
      1           // Comercialização
    );
    
    console.log('[ST Interestadual] ✅ API funcionando corretamente!');
    console.log('[ST Interestadual] Registros encontrados:', resultado.registros);
    
    return true;
  } catch (error) {
    console.error('[ST Interestadual] ❌ Erro no teste da API:', error);
    return false;
  }
};

// Função para buscar informações de ST por NCM do banco de dados
export const buscarInformacoesSTPorNCM = async (ncm) => {
  try {
    // Importar supabase dinamicamente para evitar problemas de importação
    const { supabase } = await import('../lib/supabase');
    
    // Limpar o NCM (remover pontos e traços)
    const ncmLimpo = ncm.replace(/[.-]/g, '');
    
    // Buscar na tabela ncms_analises
    const { data, error } = await supabase
      .from('ncms_analises')
      .select('search_result')
      .eq('ncm', ncmLimpo)
      .single();
    
    if (error) {
      console.warn(`[ST Interestadual] NCM ${ncm} não encontrado no banco:`, error.message);
      return null;
    }
    
    if (!data || !data.search_result) {
      console.warn(`[ST Interestadual] NCM ${ncm} sem dados de search_result`);
      return null;
    }
    
    // Tentar fazer parse do JSON
    try {
      const parsedData = typeof data.search_result === 'string' 
        ? JSON.parse(data.search_result) 
        : data.search_result;
      
      // Verificar se há dados válidos
      if (parsedData && parsedData.resposta && parsedData.resposta.length > 0) {
        console.log(`[ST Interestadual] Dados encontrados para NCM ${ncm}:`, parsedData.resposta[0]);
        return parsedData.resposta[0];
      }
      
      return null;
    } catch (parseError) {
      console.error(`[ST Interestadual] Erro ao fazer parse do JSON para NCM ${ncm}:`, parseError);
      return null;
    }
    
  } catch (error) {
    console.error(`[ST Interestadual] Erro ao buscar NCM ${ncm} no banco:`, error);
    return null;
  }
};

// Função para buscar informações de ST para múltiplos NCMs do banco de dados
export const buscarInformacoesSTMultiplosNCMs = async (ncms) => {
  const resultados = {};
  
  try {
    // Importar supabase dinamicamente
    const { supabase } = await import('../lib/supabase');
    
    // Limpar NCMs (remover pontos e traços)
    const ncmsLimpos = ncms.map(ncm => ncm.replace(/[.-]/g, ''));
    
    // Buscar todos os NCMs de uma vez
    const { data, error } = await supabase
      .from('ncms_analises')
      .select('ncm, search_result')
      .in('ncm', ncmsLimpos);
    
    if (error) {
      console.error('[ST Interestadual] Erro ao buscar NCMs no banco:', error);
      return resultados;
    }
    
    if (!data || data.length === 0) {
      console.warn('[ST Interestadual] Nenhum NCM encontrado no banco');
      return resultados;
    }
    
    // Processar cada resultado
    data.forEach(item => {
      if (item.search_result) {
        try {
          const parsedData = typeof item.search_result === 'string' 
            ? JSON.parse(item.search_result) 
            : item.search_result;
          
          if (parsedData && parsedData.resposta && parsedData.resposta.length > 0) {
            // Usar o NCM original (com pontos) como chave
            const ncmOriginal = ncms.find(ncm => ncm.replace(/[.-]/g, '') === item.ncm);
            if (ncmOriginal) {
              resultados[ncmOriginal] = parsedData.resposta[0];
              console.log(`[ST Interestadual] Dados carregados para NCM ${ncmOriginal}:`, parsedData.resposta[0]);
            }
          }
        } catch (parseError) {
          console.error(`[ST Interestadual] Erro ao fazer parse do JSON para NCM ${item.ncm}:`, parseError);
        }
      }
    });
    
    console.log(`[ST Interestadual] Total de NCMs com dados encontrados: ${Object.keys(resultados).length}`);
    
  } catch (error) {
    console.error('[ST Interestadual] Erro geral ao buscar NCMs:', error);
  }
  
  return resultados;
};
