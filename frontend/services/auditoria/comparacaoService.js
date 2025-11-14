const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

const buildQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, value);
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

const requestWithAuth = async (endpoint) => {
  if (typeof window === 'undefined') {
    throw new Error('Ambiente indisponível');
  }

  if (!API_BASE_URL) {
    throw new Error('URL da API não configurada');
  }

  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Token não encontrado. Faça login novamente.');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const errorMessage =
      typeof payload === 'string' && payload
        ? payload
        : payload?.error || `Erro ${response.status}`;
    const error = new Error(errorMessage);
    error.status = response.status;
    throw error;
  }

  return payload;
};

export const comparacaoService = {
  /**
   * Buscar comparação de anexos do Simples Nacional
   * @param params - Parâmetros para busca
   * @param params.clientes_id - ID do cliente (prioritário para segurança)
   * @param params.cnpj - CNPJ da empresa (fallback)
   * @param params.ano - Ano para filtrar (opcional)
   * @param params.mes - Mês para filtrar (opcional)
   * @returns Dados da comparação de anexos
   */
  async buscarComparacaoAnexos(params = {}) {
    try {
      const queryString = buildQueryString({
        clientes_id: params.clientes_id,
        cnpj: params.cnpj,
        ano: params.ano,
        mes: params.mes,
      });

      const data = await requestWithAuth(
        `/auditoria/simples-nacional/comparacao-anexos${queryString}`
      );

      return data;
    } catch (error) {
      console.error('Erro ao buscar comparação de anexos:', error);

      if (error.status === 404) {
        throw new Error('Cliente não encontrado ou não está no Simples Nacional');
      }

      if (error.status === 400) {
        throw new Error(error.message || 'Parâmetros inválidos');
      }

      throw new Error(error.message || 'Erro ao buscar comparação de anexos');
    }
  },

  /**
   * Formatar CNPJ para exibição
   * @param cnpj - CNPJ sem formatação
   * @returns CNPJ formatado
   */
  formatarCNPJ(cnpj) {
    return cnpj
      .replace(/\D/g, "")
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  },

  /**
   * Obter nome do mês
   * @param mes - Número do mês (1-12)
   * @returns Nome do mês
   */
  obterNomeMes(mes) {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return meses[mes - 1] || 'Mês inválido';
  }
};

