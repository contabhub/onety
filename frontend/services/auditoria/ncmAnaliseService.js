import { consultarPorNCM } from './stInterestadualApi';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const AUTH_TOKEN_KEY = 'token';

const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

const getAuthHeaders = () => {
  const token = getAuthToken();
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
  };
};

const fetchNcmAnalises = async (searchParams = {}) => {
  if (!API_BASE_URL) {
    return { error: 'NEXT_PUBLIC_API_URL não configurada' };
  }

  const headers = getAuthHeaders();
  if (!headers) {
    return { error: 'Autenticação necessária' };
  }

  const query = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value));
    }
  });

  try {
    const url = `${API_BASE_URL}/auditoria/ncms-analises${query.toString() ? `?${query}` : ''}`;
    const response = await fetch(url, { headers });
    const payload = await response.json();

    if (!response.ok) {
      return { error: payload?.error || 'Erro ao buscar análises de NCM', data: payload };
    }

    const data = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
        ? payload
        : [];

    return {
      data,
      pagination: payload?.pagination ?? null,
    };
  } catch (error) {
    console.error('[NCM Analise] Erro ao consultar rota /auditoria/ncms-analises:', error);
    return { error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
};

const createNcmAnalise = async (body) => {
  if (!API_BASE_URL) {
    return { error: 'NEXT_PUBLIC_API_URL não configurada' };
  }

  const headers = getAuthHeaders();
  if (!headers) {
    return { error: 'Autenticação necessária' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auditoria/ncms-analises`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json();

    if (!response.ok) {
      return { error: payload?.error || 'Erro ao salvar análise de NCM', data: payload };
    }

    return { data: payload };
  } catch (error) {
    console.error('[NCM Analise] Erro ao salvar análise via rota /auditoria/ncms-analises:', error);
    return { error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
};

// Configuração padrão para consultas (pode ser personalizada)
const CONFIGURACAO_PADRAO = {
  estado_origem: 'SP',
  estado_destino: 'PR',
  destinacao_mercadoria: 1, // Comercialização
  regime_origem: 1, // Regime Normal
  regime_destino: 1 // Regime Normal
};

/**
 * Verifica se um NCM existe na tabela de cache e se está atualizado (menos de 30 dias)
 */
export async function verificarNcmNoCache(
  ncm, 
  estadoOrigem, 
  estadoDestino
) {
  try {
    console.log(`[NCM Analise] Verificando NCM ${ncm} (${estadoOrigem} → ${estadoDestino}) no cache...`);
    
    // Obter company_id do localStorage
    const companyId = localStorage.getItem('selected_company_id');
    if (!companyId) {
      console.log(`[NCM Analise] Nenhuma empresa selecionada, não é possível consultar cache`);
      return null;
    }

    const response = await fetchNcmAnalises({
      company_id: companyId,
      ncm: ncm,
      estado_origem: estadoOrigem,
      estado_destino: estadoDestino,
      limit: 1
    });

    if (response.error) {
      console.error('[NCM Analise] Erro ao buscar NCM no cache:', response.error);
      return null;
    }

    const rows = Array.isArray(response.data) ? response.data : [];

    if (!rows.length) {
      console.log(`[NCM Analise] NCM ${ncm} (${estadoOrigem} → ${estadoDestino}) não encontrado no cache`);
      return null;
    }

    const data = rows[0];

    // Verificar se data existe e tem created_at
    if (!data || !data.created_at) {
      console.log(`[NCM Analise] NCM ${ncm} (${estadoOrigem} → ${estadoDestino}) dados inválidos no cache`);
      return null;
    }

    // Verifica se o registro tem menos de 30 dias
    const dataCriacao = new Date(data.created_at);
    const dataAtual = new Date();
    const diferencaDias = (dataAtual.getTime() - dataCriacao.getTime()) / (1000 * 60 * 60 * 24);

    if (diferencaDias > 30) {
      console.log(`[NCM Analise] NCM ${ncm} (${estadoOrigem} → ${estadoDestino}) encontrado no cache, mas expirado (${diferencaDias.toFixed(1)} dias)`);
      return null;
    }

    console.log(`[NCM Analise] NCM ${ncm} (${estadoOrigem} → ${estadoDestino}) encontrado no cache e atualizado (${diferencaDias.toFixed(1)} dias)`);
    return data;
  } catch (error) {
    console.error(`[NCM Analise] Erro ao verificar NCM ${ncm} (${estadoOrigem} → ${estadoDestino}) no cache:`, error);
    return null;
  }
}

/**
 * Salva o resultado da análise de NCM na tabela de cache
 */
export async function salvarNcmAnalise(
  ncm, 
  resultado, 
  estadoOrigem, 
  estadoDestino
) {
  try {
    console.log(`[NCM Analise] Salvando análise do NCM ${ncm} (${estadoOrigem} → ${estadoDestino}) no cache...`);
    
    const analise = {
      ncm,
      search_result: JSON.stringify(resultado),
      estado_origem: estadoOrigem,
      estado_destino: estadoDestino
    };

    // Obter company_id do localStorage
    const companyId = localStorage.getItem('selected_company_id');
    if (!companyId) {
      throw new Error('Nenhuma empresa selecionada');
    }

    const response = await createNcmAnalise({
      company_id: companyId,
      ncm: analise.ncm,
      estado_origem: analise.estado_origem,
      estado_destino: analise.estado_destino,
      search_result: analise.search_result
    });

    if (response.error) {
      throw new Error(response.error);
    }

    console.log(`[NCM Analise] Análise do NCM ${ncm} (${estadoOrigem} → ${estadoDestino}) salva com sucesso`);
  } catch (error) {
    console.error(`[NCM Analise] Erro ao salvar análise do NCM ${ncm} (${estadoOrigem} → ${estadoDestino}):`, error);
    throw error;
  }
}

/**
 * Consulta a API de ST Interestadual para um NCM específico
 */
export async function consultarNcmNaAPI(
  ncm, 
  configuracao = CONFIGURACAO_PADRAO
) {
  try {
    console.log(`[NCM Analise] Consultando NCM ${ncm} na API ST Interestadual...`);
    
    const resultado = await consultarPorNCM(
      ncm,
      configuracao.estado_origem,
      configuracao.estado_destino,
      configuracao.destinacao_mercadoria,
      configuracao.regime_origem,
      configuracao.regime_destino
    );

    console.log(`[NCM Analise] API retornou ${resultado.registros} registros para NCM ${ncm}`);
    return resultado;
  } catch (error) {
    console.error(`[NCM Analise] Erro ao consultar NCM ${ncm} na API:`, error);
    throw error;
  }
}

/**
 * Função principal que analisa um NCM com cache inteligente
 */
export async function analisarNcm(
  ncm, 
  configuracao = CONFIGURACAO_PADRAO
) {
  try {
    console.log(`[NCM Analise] Iniciando análise do NCM ${ncm} (${configuracao.estado_origem} → ${configuracao.estado_destino})...`);
    
    // 1. Verifica se existe no cache e está atualizado
    const cacheResult = await verificarNcmNoCache(ncm, configuracao.estado_origem, configuracao.estado_destino);
    
    if (cacheResult) {
      // NCM encontrado no cache e atualizado
      const dados = JSON.parse(cacheResult.search_result);
      return {
        ncm,
        encontrado: dados.registros > 0,
        dados,
        origem: 'cache',
        ultima_atualizacao: cacheResult.created_at
      };
    }

    // 2. Se não está no cache ou expirou, consulta a API
    console.log(`[NCM Analise] NCM ${ncm} (${configuracao.estado_origem} → ${configuracao.estado_destino}) não encontrado no cache ou expirado. Consultando API...`);
    
    try {
      const resultadoAPI = await consultarNcmNaAPI(ncm, configuracao);
      
      // 3. Salva o resultado no cache
      await salvarNcmAnalise(ncm, resultadoAPI, configuracao.estado_origem, configuracao.estado_destino);
      
      return {
        ncm,
        encontrado: resultadoAPI.registros > 0,
        dados: resultadoAPI,
        origem: 'api',
        ultima_atualizacao: new Date().toISOString()
      };
    } catch (apiError) {
      console.error(`[NCM Analise] Erro na API para NCM ${ncm} (${configuracao.estado_origem} → ${configuracao.estado_destino}):`, apiError);
      
      // Se a API falhou, retorna como não encontrado
      return {
        ncm,
        encontrado: false,
        origem: 'nao_encontrado'
      };
    }
  } catch (error) {
    console.error(`[NCM Analise] Erro geral na análise do NCM ${ncm} (${configuracao.estado_origem} → ${configuracao.estado_destino}):`, error);
    throw error;
  }
}

/**
 * Analisa múltiplos NCMs de forma otimizada
 */
export async function analisarMultiplosNcms(
  ncms, 
  configuracao = CONFIGURACAO_PADRAO
) {
  console.log(`[NCM Analise] Iniciando análise de ${ncms.length} NCMs...`);
  
  const resultados = [];
  
  // Processa em lotes para não sobrecarregar a API
  const LOTE_SIZE = 5;
  
  for (let i = 0; i < ncms.length; i += LOTE_SIZE) {
    const lote = ncms.slice(i, i + LOTE_SIZE);
    console.log(`[NCM Analise] Processando lote ${Math.floor(i/LOTE_SIZE) + 1}/${Math.ceil(ncms.length/LOTE_SIZE)}`);
    
    const promessas = lote.map(ncm => analisarNcm(ncm, configuracao));
    const resultadosLote = await Promise.all(promessas);
    resultados.push(...resultadosLote);
    
    // Aguarda um pouco entre os lotes para não sobrecarregar a API
    if (i + LOTE_SIZE < ncms.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`[NCM Analise] Análise concluída. ${resultados.length} NCMs processados`);
  return resultados;
}

/**
 * Extrai NCMs únicos de uma lista de notas fiscais
 */
export function extrairNcmsUnicos(notasFiscais) {
  const ncms = new Set();
  
  notasFiscais.forEach(nota => {
    if (nota.ncm && nota.ncm.trim()) {
      ncms.add(nota.ncm.trim());
    }
  });
  
  return Array.from(ncms);
}

/**
 * Função para processar NCMs de notas fiscais importadas
 */
export async function processarNcmsNotasFiscais(
  notasFiscais, 
  configuracao = CONFIGURACAO_PADRAO
) {
  console.log(`[NCM Analise] Processando NCMs de ${notasFiscais.length} notas fiscais...`);
  
  // Extrai NCMs únicos
  const ncmsUnicos = extrairNcmsUnicos(notasFiscais);
  console.log(`[NCM Analise] ${ncmsUnicos.length} NCMs únicos encontrados`);
  
  // Analisa os NCMs
  const resultados = await analisarMultiplosNcms(ncmsUnicos, configuracao);
  
  // Calcula estatísticas
  const estatisticas = {
    total: resultados.length,
    encontrados: resultados.filter(r => r.encontrado).length,
    naoEncontrados: resultados.filter(r => !r.encontrado).length,
    doCache: resultados.filter(r => r.origem === 'cache').length,
    daAPI: resultados.filter(r => r.origem === 'api').length
  };
  
  console.log(`[NCM Analise] Estatísticas:`, estatisticas);
  
  return {
    ncmsProcessados: resultados,
    estatisticas
  };
}

/**
 * Limpa registros antigos da tabela de cache (mais de 60 dias)
 */
export async function limparCacheAntigo() {
  try {
    console.log('[NCM Analise] Limpando cache antigo...');
    
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 60);
    
    // TODO: Implementar limpeza de cache via backend
    // Por enquanto, retorna 0 para evitar erro
    const registrosRemovidos = 0;
    console.log(`[NCM Analise] ${registrosRemovidos} registros antigos removidos do cache`);
    
    return registrosRemovidos;
  } catch (error) {
    console.error('[NCM Analise] Erro ao limpar cache antigo:', error);
    throw error;
  }
}

/**
 * Obtém estatísticas do cache
 */
export async function obterEstatisticasCache() {
  try {
    console.log('[NCM Analise] Obtendo estatísticas do cache...');
    
    // TODO: Implementar estatísticas via backend
    // Por enquanto, retorna valores padrão
    const total = 0;

    // TODO: Implementar estatísticas via backend
    // Por enquanto, retorna valores padrão
    const ultimos30 = 0;
    const ultimos7 = 0;
    const ncmsUnicosCount = 0;

    const estatisticas = {
      totalRegistros: total || 0,
      registrosUltimos30Dias: ultimos30 || 0,
      registrosUltimos7Dias: ultimos7 || 0,
      ncmsUnicos: ncmsUnicosCount
    };

    console.log('[NCM Analise] Estatísticas obtidas:', estatisticas);
    return estatisticas;
  } catch (error) {
    console.error('[NCM Analise] Erro ao obter estatísticas:', error);
    throw error;
  }
}

