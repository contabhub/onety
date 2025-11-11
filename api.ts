/**
 * Serviço de API para comunicação com o backend
 * Substitui as chamadas diretas ao Supabase
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Interface para respostas da API
interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

// Interface para opções de requisição
interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

/**
 * Classe principal para comunicação com a API
 */
class ApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.loadToken();
  }

  /**
   * Carrega o token do localStorage
   */
  private loadToken(): void {
    const token = localStorage.getItem('auth_token');
    this.token = token;
  }

  /**
   * Define o token de autenticação
   */
  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  /**
   * Remove o token de autenticação
   */
  clearToken(): void {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  /**
   * Obtém a URL base da API
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Executa uma requisição para a API
   */
  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      // Garantir que o token esteja atualizado antes de cada requisição
      this.loadToken();

      // Adiciona token de autenticação se disponível
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const config: RequestInit = {
        method: options.method || 'GET',
        headers,
      };

      if (options.body && options.method !== 'GET') {
        config.body = JSON.stringify(options.body);
      }

      const response = await fetch(url, config);
      
      // Se não autorizado, log detalhado mas NÃO limpa o token automaticamente
      if (response.status === 401) {
        console.log('❌ [API Service] 401 Unauthorized para:', endpoint);
        console.log('❌ [API Service] Token atual:', this.token ? 'Presente' : 'Ausente');
        console.log('❌ [API Service] Headers enviados:', headers);
        // NÃO limpar token automaticamente - pode ser problema do backend
        throw new Error('Token expirado ou inválido');
      }

      const data = await response.json();

      if (!response.ok) {
        console.error("❌ [API Service] Erro na resposta:", data.error || `Erro ${response.status}: ${response.statusText}`);
        throw new Error(data.error || `Erro ${response.status}: ${response.statusText}`);
      }
      return { data };
    } catch (error) {
      console.error(`❌ [API Service] Erro na requisição ${endpoint}:`, error);
      console.error(`❌ [API Service] Stack trace:`, error instanceof Error ? error.stack : 'N/A');
      return { error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }

  // ===== MÉTODOS DE AUTENTICAÇÃO =====

  /**
   * Login do usuário
   */
  async login(email: string, password: string): Promise<ApiResponse<{ token: string; user: any }>> {
    return this.request('/auth/login', {
      method: 'POST',
      body: { email, password }
    });
  }

  /**
   * Registro de usuário
   */
  async register(userData: any): Promise<ApiResponse<{ token: string; user: any }>> {
    return this.request('/users', {
      method: 'POST',
      body: userData
    });
  }

  /**
   * Verifica se o token é válido
   */
  async verifyToken(): Promise<ApiResponse<{ user: any }>> {
    return this.request('/auth/verify');
  }

  // ===== MÉTODOS DE EMPRESAS =====

  /**
   * Busca empresas do usuário
   */
  async getCompanies(): Promise<ApiResponse<any[]>> {
    return this.request('/companies');
  }

  /**
   * Cria nova empresa
   */
  async createCompany(companyData: any): Promise<ApiResponse<any>> {
    return this.request('/companies', {
      method: 'POST',
      body: companyData
    });
  }

  /**
   * Atualiza empresa
   */
  async updateCompany(id: string, companyData: any): Promise<ApiResponse<any>> {
    return this.request(`/companies/${id}`, {
      method: 'PUT',
      body: companyData
    });
  }

  // ===== MÉTODOS DE ANÁLISES =====

  /**
   * Busca análises
   */
  async getAnalyses(params?: {
    company_id?: string;
    clientes_id?: string;
    cnpj?: string;
    ano?: number;
    mes?: number;
    tipo?: string;
  }): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams();
    if (params?.company_id) queryParams.append('company_id', params.company_id);
    if (params?.clientes_id) queryParams.append('clientes_id', params.clientes_id);
    if (params?.cnpj) queryParams.append('cnpj', params.cnpj);
    if (params?.ano) queryParams.append('ano', params.ano.toString());
    if (params?.mes) queryParams.append('mes', params.mes.toString());
    if (params?.tipo) queryParams.append('tipo', params.tipo);

    const endpoint = `/analyses${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  /**
   * Cria nova análise
   */
  async createAnalysis(analysisData: any): Promise<ApiResponse<any>> {
    return this.request('/analyses', {
      method: 'POST',
      body: analysisData
    });
  }

  // ===== MÉTODOS DE NOTAS FISCAIS =====

  /**
   * Busca notas fiscais
   */
  async getNotasFiscais(params?: {
    company_id?: string;
    clientes_id?: string;
    ncm?: string;
    estado_origem?: string;
    estado_destino?: string;
    cfop?: string;
    cst_icms?: string;
    numero_nfe?: string;
    serie?: string;
  }): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams();
    if (params?.company_id) queryParams.append('company_id', params.company_id);
    if (params?.clientes_id) queryParams.append('clientes_id', params.clientes_id);
    if (params?.ncm) queryParams.append('ncm', params.ncm);
    if (params?.estado_origem) queryParams.append('estado_origem', params.estado_origem);
    if (params?.estado_destino) queryParams.append('estado_destino', params.estado_destino);
    if (params?.cfop) queryParams.append('cfop', params.cfop);
    if (params?.cst_icms) queryParams.append('cst_icms', params.cst_icms);
    if (params?.numero_nfe) queryParams.append('numero_nfe', params.numero_nfe);
    if (params?.serie) queryParams.append('serie', params.serie);

    const endpoint = `/notas-fiscais${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  /**
   * Cria nova nota fiscal
   */
  async createNotaFiscal(notaData: any): Promise<ApiResponse<any>> {
    return this.request('/notas-fiscais', {
      method: 'POST',
      body: notaData
    });
  }

  /**
   * Análise de notas fiscais por NCM
   */
  async getNotasFiscaisAnalise(params: {
    company_id: string;
    ncm?: string;
    estado_origem?: string;
    estado_destino?: string;
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    queryParams.append('company_id', params.company_id);
    if (params.ncm) queryParams.append('ncm', params.ncm);
    if (params.estado_origem) queryParams.append('estado_origem', params.estado_origem);
    if (params.estado_destino) queryParams.append('estado_destino', params.estado_destino);

    return this.request(`/notas-fiscais/analise?${queryParams.toString()}`);
  }

  /**
   * Busca notas fiscais por período
   */
  async getNotasFiscaisPorPeriodo(params: {
    clientes_id?: string;
    cnpj_emitente?: string;
    data_inicio?: string;
    data_fim?: string;
    ano?: number;
    mes?: number;
    select?: string;
  }): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams();
    if (params.clientes_id) {
      queryParams.append('clientes_id', params.clientes_id);
    } else if (params.cnpj_emitente) {
      queryParams.append('cnpj_emitente', params.cnpj_emitente);
    }
    if (params.data_inicio) queryParams.append('data_inicio', params.data_inicio);
    if (params.data_fim) queryParams.append('data_fim', params.data_fim);
    if (params.ano) queryParams.append('ano', params.ano.toString());
    if (params.mes) queryParams.append('mes', params.mes.toString());
    if (params.select) queryParams.append('select', params.select);

    return this.request(`/notas-fiscais/periodo?${queryParams.toString()}`);
  }

  /**
   * Busca notas fiscais com ISS retido
   */
  async getNotasFiscaisIssRetido(params: {
    clientes_id?: string;
    cnpj_emitente?: string;
    ano?: number;
  }): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams();
    if (params.clientes_id) {
      queryParams.append('clientes_id', params.clientes_id);
    } else if (params.cnpj_emitente) {
      queryParams.append('cnpj_emitente', params.cnpj_emitente);
    }
    if (params.ano) queryParams.append('ano', params.ano.toString());

    return this.request(`/notas-fiscais/iss-retido?${queryParams.toString()}`);
  }

  // ===== MÉTODOS DE SIMPLES NACIONAL =====

  /**
   * Busca análises do Simples Nacional
   */
  async getSimplesNacional(params?: {
    clientes_id?: string;
    cnpj?: string;
    cnpj_emitente?: string;
    ano?: number;
    mes?: number;
    tipo?: string;
    status_analise?: string;
  }): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams();
    if (params?.clientes_id) queryParams.append('clientes_id', params.clientes_id);
    if (params?.cnpj) queryParams.append('cnpj', params.cnpj);
    if (params?.cnpj_emitente) queryParams.append('cnpj_emitente', params.cnpj_emitente);
    if (params?.ano) queryParams.append('ano', params.ano.toString());
    if (params?.mes) queryParams.append('mes', params.mes.toString());
    if (params?.tipo) queryParams.append('tipo', params.tipo);
    if (params?.status_analise) queryParams.append('status_analise', params.status_analise);

    const endpoint = `/simples-nacional${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  /**
   * Busca empresas do Simples Nacional
   */
  async getSimplesNacionalEmpresas(params?: {
    company_id?: string;
    cnpj?: string;
    uf?: string;
    nome?: string;
  }): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams();
    if (params?.company_id) queryParams.append('company_id', params.company_id);
    if (params?.cnpj) queryParams.append('cnpj', params.cnpj);
    if (params?.uf) queryParams.append('uf', params.uf);
    if (params?.nome) queryParams.append('nome', params.nome);

    const endpoint = `/clientes/simples-nacional${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  /**
   * Cria nova análise Simples Nacional
   */
  async createSimplesNacional(analysisData: any): Promise<ApiResponse<any>> {
    return this.request('/simples-nacional', {
      method: 'POST',
      body: analysisData
    });
  }

  /**
   * Atualiza análise Simples Nacional existente
   */
  async updateSimplesNacional(id: string, analysisData: any): Promise<ApiResponse<any>> {
    return this.request(`/simples-nacional/${id}`, {
      method: 'PUT',
      body: analysisData
    });
  }

  /**
   * Deleta análise Simples Nacional
   */
  async deleteSimplesNacional(id: string): Promise<ApiResponse<any>> {
    return this.request(`/simples-nacional/${id}`, {
      method: 'DELETE'
    });
  }

  // ===== MÉTODOS DE ECAC =====

  /**
   * Busca pagamentos eCAC
   */
  async getEcac(params?: {
    company_id?: string;
    cnpj?: string;
    ano?: number;
    mes?: number;
    tipo?: string;
  }): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams();
    if (params?.company_id) queryParams.append('company_id', params.company_id);
    if (params?.cnpj) queryParams.append('cnpj', params.cnpj);
    if (params?.ano) queryParams.append('ano', params.ano.toString());
    if (params?.mes) queryParams.append('mes', params.mes.toString());
    if (params?.tipo) queryParams.append('tipo', params.tipo);

    const endpoint = `/ecac${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  // ===== MÉTODOS DE EMPRESAS =====

  /**
   * Busca empresas com filtros e paginação
   */
  async getEmpresas(params?: {
    company_id?: string;
    cnpj?: string;
    uf?: string;
    nome?: string;
    mes?: number;
    ano?: number;
    page?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (params?.company_id) queryParams.append('company_id', params.company_id);
    if (params?.cnpj) queryParams.append('cnpj', params.cnpj);
    if (params?.uf) queryParams.append('uf', params.uf);
    if (params?.nome) queryParams.append('nome', params.nome);
    if (params?.mes) queryParams.append('mes', params.mes.toString());
    if (params?.ano) queryParams.append('ano', params.ano.toString());
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.sort_by) queryParams.append('sort_by', params.sort_by);
    if (params?.sort_order) queryParams.append('sort_order', params.sort_order);

    const endpoint = `/empresas${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  /**
   * Busca empresa por ID
   */
  async getEmpresa(id: string): Promise<ApiResponse<any>> {
    return this.request(`/empresas/${id}`);
  }

  /**
   * Cria nova empresa
   */
  async createEmpresa(empresaData: {
    company_id: string;
    nome: string;
    cnpj: string;
    uf: string;
    mes: number;
    ano: number;
  }): Promise<ApiResponse<any>> {
    return this.request('/empresas', {
      method: 'POST',
      body: empresaData
    });
  }

  /**
   * Atualiza empresa existente
   */
  async updateEmpresa(id: string, empresaData: Partial<{
    nome: string;
    cnpj: string;
    uf: string;
    mes: number;
    ano: number;
  }>): Promise<ApiResponse<any>> {
    return this.request(`/empresas/${id}`, {
      method: 'PUT',
      body: empresaData
    });
  }

  /**
   * Deleta empresa
   */
  async deleteEmpresa(id: string): Promise<ApiResponse<any>> {
    return this.request(`/empresas/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Busca estatísticas das empresas
   */
  async getEmpresasEstatisticas(params?: {
    company_id?: string;
    ano?: number;
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (params?.company_id) queryParams.append('company_id', params.company_id);
    if (params?.ano) queryParams.append('ano', params.ano.toString());

    const endpoint = `/empresas/estatisticas${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  /**
   * Busca empresas por CNPJ
   */
  async getEmpresasPorCnpj(cnpj: string, params?: {
    company_id?: string;
  }): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams();
    if (params?.company_id) queryParams.append('company_id', params.company_id);

    const endpoint = `/empresas/por-cnpj/${cnpj}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  /**
   * Cria múltiplas empresas em lote
   */
  async createEmpresasBulk(empresas: Array<{
    company_id: string;
    nome: string;
    cnpj: string;
    uf: string;
    mes: number;
    ano: number;
  }>): Promise<ApiResponse<any>> {
    return this.request('/empresas/bulk', {
      method: 'POST',
      body: { empresas }
    });
  }

  /**
   * Comparativo de pagamentos eCAC
   */
  async getEcacComparativo(params: {
    company_id: string;
    cnpj: string;
    ano: number;
  }): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams();
    queryParams.append('company_id', params.company_id);
    queryParams.append('cnpj', params.cnpj);
    queryParams.append('ano', params.ano.toString());

    return this.request(`/ecac/comparativo?${queryParams.toString()}`);
  }

  // ===== MÉTODOS DE CLIENTES =====

  /**
   * Busca clientes com filtros e paginação
   */
  async getClientes(params?: {
    company_id?: string;
    cnpj?: string;
    uf?: string;
    nome?: string;
    simples_nacional?: string;
    page?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (params?.company_id) queryParams.append('company_id', params.company_id);
    if (params?.cnpj) queryParams.append('cnpj', params.cnpj);
    if (params?.uf) queryParams.append('uf', params.uf);
    if (params?.nome) queryParams.append('nome', params.nome);
    if (params?.simples_nacional) queryParams.append('simples_nacional', params.simples_nacional);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.sort_by) queryParams.append('sort_by', params.sort_by);
    if (params?.sort_order) queryParams.append('sort_order', params.sort_order);

    const endpoint = `/clientes${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  /**
   * Busca cliente específico por ID
   */
  async getCliente(id: string): Promise<ApiResponse<any>> {
    const endpoint = `/clientes/${id}`;
    return this.request(endpoint);
  }

  /**
   * Deleta cliente específico por ID
   */
  async deleteCliente(id: string): Promise<ApiResponse<any>> {
    const endpoint = `/clientes/${id}`;
    return this.request(endpoint, {
      method: 'DELETE'
    });
  }

  /**
   * Cria novo cliente
   */
  async createCliente(clienteData: {
    company_id: string;
    nome: string;
    cnpj: string;
    uf: string;
    regime_tributario?: string;
  }): Promise<ApiResponse<any>> {
    return this.request('/clientes', {
      method: 'POST',
      body: clienteData
    });
  }

  /**
   * Busca dados consolidados de um cliente para montar gráficos
   * Combina dados de notas fiscais e análises do Simples Nacional
   */
  async getDadosConsolidadosCliente(clienteId: string, ano: number): Promise<ApiResponse<{
    cliente_id: string;
    ano: number;
    dados_mensais: Array<{
      mes: string;
      mesNumero: number;
      ano: number;
      faturamentoNotas: number;
      quantidadeNotas: number;
      valorDas: number;
      receitaTotal: number;
      faturamentoExtrato: number;
    }>;
    totais: {
      faturamentoNotas: number;
      quantidadeNotas: number;
      valorDas: number;
      receitaTotal: number;
    };
    resumo: {
      total_notas_fiscais: number;
      total_analises_simples: number;
      meses_com_dados: number;
    };
  }>> {
    const endpoint = `/clientes/${clienteId}/dados-consolidados?ano=${ano}`;
    return this.request(endpoint);
  }

  /**
   * Cria múltiplas notas fiscais em lote
   */
  async createNotasFiscaisBulk(notasFiscais: any[]): Promise<ApiResponse<any>> {
    const endpoint = `/notas-fiscais/bulk`;
    return this.request(endpoint, {
      method: 'POST',
      body: { notas_fiscais: notasFiscais }
    });
  }

  // ===== MÉTODOS DE SIMPLES NACIONAL =====

  /**
   * Upload de PDF do Simples Nacional
   */
  async uploadSimplesNacional(uploadData: {
    cnpj: string;
    nome_empresa: string;
    atividade_principal?: string;
    uf?: string;
    fator_r_status: string;
    periodo_documento?: string;
    icms_percentage?: number;
    pis_cofins_percentage?: number;
    receita_total?: number;
    icms_total?: number;
    pis_total?: number;
    cofins_total?: number;
    valor_das?: number;
    anexos_simples?: string;
    valor_folha?: number;
    date_pag?: string;
    resultado_api?: any;
    arquivo_nome?: string;
    mes?: number;
    ano?: number;
    company_id?: string; // Adicionar company_id explícito
  }): Promise<ApiResponse<any>> {
    return this.request('/simples-nacional/upload', {
      method: 'POST',
      body: uploadData
    });
  }

  /**
   * Busca análises do Simples Nacional
   */
  async getSimplesNacionalAnalises(params?: {
    clientes_id?: string;
    cnpj?: string;
    company_id?: string;
    page?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (params?.clientes_id) queryParams.append('clientes_id', params.clientes_id);
    if (params?.cnpj) queryParams.append('cnpj', params.cnpj);
    if (params?.company_id) queryParams.append('company_id', params.company_id);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.sort_by) queryParams.append('sort_by', params.sort_by);
    if (params?.sort_order) queryParams.append('sort_order', params.sort_order);

    const endpoint = `/simples-nacional${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  /**
   * Busca cliente por CNPJ e regime tributário
   */
  async getClienteByCnpj(cnpj: string, regimeTributario: string): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    queryParams.append('cnpj', cnpj);
    queryParams.append('regime_tributario', regimeTributario);
    
    // Adicionar company_id do localStorage
    const companyId = localStorage.getItem('selected_company_id');
    if (companyId) {
      queryParams.append('company_id', companyId);
    }
    
    const endpoint = `/clientes${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  /**
   * Busca dados de DAS mensais do Simples Nacional
   */
  async getDasMensais(params: {
    clientes_id?: string;
    cnpj_emitente?: string;
    ano: number;
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (params.clientes_id) {
      queryParams.append('clientes_id', params.clientes_id);
    } else if (params.cnpj_emitente) {
      queryParams.append('cnpj_emitente', params.cnpj_emitente);
    }
    queryParams.append('ano', params.ano.toString());

    const endpoint = `/simples-nacional/das-mensais?${queryParams.toString()}`;
    return this.request(endpoint);
  }

  /**
   * Busca dados de folhas de salários mensais do Simples Nacional
   */
  async getFolhasMensais(params: {
    clientes_id?: string;
    cnpj_emitente?: string;
    ano: number;
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (params.clientes_id) {
      queryParams.append('clientes_id', params.clientes_id);
    } else if (params.cnpj_emitente) {
      queryParams.append('cnpj_emitente', params.cnpj_emitente);
    }
    queryParams.append('ano', params.ano.toString());

    const endpoint = `/simples-nacional/folhas-mensais?${queryParams.toString()}`;
    return this.request(endpoint);
  }

  /**
   * Busca dados de folhas de salários anteriores do Simples Nacional
   */
  async getFolhasAnteriores(params: {
    clientes_id?: string;
    cnpj_emitente?: string;
    ano: number;
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (params.clientes_id) {
      queryParams.append('clientes_id', params.clientes_id);
    } else if (params.cnpj_emitente) {
      queryParams.append('cnpj_emitente', params.cnpj_emitente);
    }
    queryParams.append('ano', params.ano.toString());

    const endpoint = `/simples-nacional/folhas-anteriores?${queryParams.toString()}`;
    return this.request(endpoint);
  }

  /**
   * Busca dados de folhas de salários anteriores por mês do Simples Nacional
   */
  async getFolhasAnterioresPorMes(params: {
    clientes_id?: string;
    cnpj_emitente?: string;
    ano: number;
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (params.clientes_id) {
      queryParams.append('clientes_id', params.clientes_id);
    } else if (params.cnpj_emitente) {
      queryParams.append('cnpj_emitente', params.cnpj_emitente);
    }
    queryParams.append('ano', params.ano.toString());

    const endpoint = `/simples-nacional/folhas-anteriores-por-mes?${queryParams.toString()}`;
    return this.request(endpoint);
  }

  /**
   * Busca pulos detectados nas sequências de notas fiscais
   */
  async getPulosDetectados(params: {
    cnpj_emitente: string;
    ano: number;
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    queryParams.append('cnpj_emitente', params.cnpj_emitente);
    queryParams.append('ano', params.ano.toString());

    const endpoint = `/simples-nacional/pulos-detectados?${queryParams.toString()}`;
    return this.request(endpoint);
  }

  /**
   * Busca análises do Simples Nacional por CNPJ e ano
   */
  async getAnalisesSimplesNacional(cnpj: string, ano?: number): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    queryParams.append('cnpj', cnpj);
    if (ano) queryParams.append('ano', ano.toString());
    
    const endpoint = `/simples-nacional${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  /**
   * Busca clientes do Simples Nacional
   */
  async getSimplesNacionalClientes(params?: {
    company_id?: string;
    cnpj?: string;
    uf?: string;
    nome?: string;
    page?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (params?.company_id) queryParams.append('company_id', params.company_id);
    if (params?.cnpj) queryParams.append('cnpj', params.cnpj);
    if (params?.uf) queryParams.append('uf', params.uf);
    if (params?.nome) queryParams.append('nome', params.nome);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.sort_by) queryParams.append('sort_by', params.sort_by);
    if (params?.sort_order) queryParams.append('sort_order', params.sort_order);

    const endpoint = `/simples-nacional/clientes${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  /**
   * Busca análise específica do Simples Nacional
   */
  async getSimplesNacionalAnalise(id: string): Promise<ApiResponse<any>> {
    return this.request(`/simples-nacional/${id}`);
  }

  /**
   * Deleta análise do Simples Nacional
   */
  async deleteSimplesNacionalAnalise(id: string): Promise<ApiResponse<any>> {
    return this.request(`/simples-nacional/${id}`, {
      method: 'DELETE'
    });
  }

  // ===== MÉTODOS DE RCT SN =====

  /**
   * Busca análises RCT Simples Nacional
   */
  async getRctSn(params?: {
    company_id?: string;
    cnpj?: string;
    ano?: number;
    mes?: number;
    tipo?: string;
  }): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams();
    if (params?.company_id) queryParams.append('company_id', params.company_id);
    if (params?.cnpj) queryParams.append('cnpj', params.cnpj);
    if (params?.ano) queryParams.append('ano', params.ano.toString());
    if (params?.mes) queryParams.append('mes', params.mes.toString());
    if (params?.tipo) queryParams.append('tipo', params.tipo);

    const endpoint = `/rct-sn${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  // ===== MÉTODOS DE CNAE INFO =====

  /**
   * Consulta CNAEs na API da LegisWeb
   */
  async consultarCnaes(cnpj: string): Promise<ApiResponse<any>> {
    return this.request('/cnae-info/consultar', {
      method: 'POST',
      body: { cnpj }
    });
  }

  /**
   * Consulta CNAEs e salva automaticamente na tabela cnae_info
   */
  async consultarESalvarCnaes(cnpj: string, clientes_id: string): Promise<ApiResponse<any>> {
    return this.request('/cnae-info/consultar-e-salvar', {
      method: 'POST',
      body: { cnpj, clientes_id }
    });
  }

  /**
   * Lista CNAEs de um cliente
   */
  async getCnaes(params?: {
    clientes_id: string;
    cnae?: string;
    descricao?: string;
    anexo?: string;
    page?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (params?.clientes_id) queryParams.append('clientes_id', params.clientes_id);
    if (params?.cnae) queryParams.append('cnae', params.cnae);
    if (params?.descricao) queryParams.append('descricao', params.descricao);
    if (params?.anexo) queryParams.append('anexo', params.anexo);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.sort_by) queryParams.append('sort_by', params.sort_by);
    if (params?.sort_order) queryParams.append('sort_order', params.sort_order);

    const endpoint = `/cnae-info${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  /**
   * Busca CNAE específico por ID
   */
  async getCnae(id: string): Promise<ApiResponse<any>> {
    return this.request(`/cnae-info/${id}`);
  }

  /**
   * Cria novo CNAE
   */
  async createCnae(data: {
    clientes_id: string;
    cnae: string;
    descricao: string;
    anexo: string;
    fator_r: string;
    aliquota: number;
  }): Promise<ApiResponse<any>> {
    return this.request('/cnae-info', {
      method: 'POST',
      body: data
    });
  }

  /**
   * Atualiza CNAE existente
   */
  async updateCnae(id: string, data: {
    cnae: string;
    descricao: string;
    anexo: string;
    fator_r: string;
    aliquota: number;
  }): Promise<ApiResponse<any>> {
    return this.request(`/cnae-info/${id}`, {
      method: 'PUT',
      body: data
    });
  }

  /**
   * Deleta CNAE
   */
  async deleteCnae(id: string): Promise<ApiResponse<any>> {
    return this.request(`/cnae-info/${id}`, {
      method: 'DELETE'
    });
  }

  // ===== MÉTODOS DE COMPARAÇÃO DE ANEXOS =====

  /**
   * Busca comparação de anexos do Simples Nacional
   */
  async getComparacaoAnexos(params: {
    clientes_id?: string;
    cnpj?: string;
    ano?: number;
    mes?: number;
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    
    // Priorizar clientes_id para segurança multi-tenant
    if (params.clientes_id) {
      queryParams.append('clientes_id', params.clientes_id);
    } else if (params.cnpj) {
      queryParams.append('cnpj', params.cnpj);
    }
    
    if (params.ano) queryParams.append('ano', params.ano.toString());
    if (params.mes) queryParams.append('mes', params.mes.toString());

    const endpoint = `/simples-nacional/comparacao-anexos?${queryParams.toString()}`;
    return this.request(endpoint);
  }

  // ===== MÉTODOS DE ICMS RECOLHIDO =====

  /**
   * Busca ICMS recolhido
   */
  async getIcmsRecolhido(params?: {
    company_id?: string;
    cnpj?: string;
    ano?: number;
    mes?: number;
    tipo?: string;
  }): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams();
    if (params?.company_id) queryParams.append('company_id', params.company_id);
    if (params?.cnpj) queryParams.append('cnpj', params.cnpj);
    if (params?.ano) queryParams.append('ano', params.ano.toString());
    if (params?.mes) queryParams.append('mes', params.mes.toString());
    if (params?.tipo) queryParams.append('tipo', params.tipo);

    const endpoint = `/icms-recolhido${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  // ===== MÉTODOS DE NCM ANALISES =====

  /**
   * Busca análises de NCM no cache
   */
  async getNcmsAnalises(params?: {
    company_id?: string;
    ncm?: string;
    estado_origem?: string;
    estado_destino?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams();
    if (params?.company_id) queryParams.append('company_id', params.company_id);
    if (params?.ncm) queryParams.append('ncm', params.ncm);
    if (params?.estado_origem) queryParams.append('estado_origem', params.estado_origem);
    if (params?.estado_destino) queryParams.append('estado_destino', params.estado_destino);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const endpoint = `/ncms-analises${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  /**
   * Cria nova análise de NCM
   */
  async createNcmAnalise(data: {
    company_id: string;
    ncm: string;
    estado_origem: string;
    estado_destino: string;
    search_result: any;
  }): Promise<ApiResponse<any>> {
    return this.request('/ncms-analises', {
      method: 'POST',
      body: data
    });
  }
}

// Instância única do serviço
export const apiService = new ApiService(API_BASE_URL);

// Exporta a classe para uso em outros lugares se necessário
export default ApiService;
