import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import { buscarInformacoesSTMultiplosNCMs } from "../../services/auditoria/stInterestadualApi";
import styles from "../../styles/auditoria/consolidado-simples.module.css";

// Importar os novos componentes
import ConsolidadoHeader from "../../components/auditoria/ConsolidadoHeader";
import FaturamentoCards from "../../components/auditoria/FaturamentoCards";
import GraficoComparativo from "../../components/auditoria/GraficoComparativo";
import PulosDetectados from "../../components/auditoria/PulosDetectados";
import TabelaIssRetido from "../../components/auditoria/TabelaIssRetido";
import TabelaFolhas from "../../components/auditoria/TabelaFolhas";
import TabelaDas from "../../components/auditoria/TabelaDas";
import TabelaNcms from "../../components/auditoria/TabelaNcms";
import ComparacaoAnexos from "../../components/auditoria/ComparacaoAnexos";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

const buildQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, value);
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

const requestWithAuth = async (endpoint, options = {}) => {
  if (typeof window === "undefined") {
    return { data: null, error: "Ambiente indisponível no momento." };
  }

  if (!API_BASE_URL) {
    return { data: null, error: "URL da API não configurada." };
  }

  const token = localStorage.getItem("token");
  if (!token) {
    return { data: null, error: "Token não encontrado. Faça login novamente." };
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      return {
        data: null,
        error:
          typeof payload === "string" && payload
            ? payload
            : payload?.error || `Erro ${response.status}`,
        status: response.status,
      };
    }

    return { data: payload };
  } catch (error) {
    console.error("[ConsolidadoSimples] Erro de rede:", error);
    return { data: null, error: error?.message || "Erro de rede" };
  }
};

const auditoriaApi = {
  getDadosConsolidadosCliente: (clienteId, ano) =>
    requestWithAuth(
      `/auditoria/clientes/${clienteId}/dados-consolidados${buildQueryString({
        ano,
      })}`
    ),
  getSimplesNacional: (params = {}) =>
    requestWithAuth(
      `/auditoria/simples-nacional${buildQueryString(params)}`
    ),
  getAnalisesSimplesNacional: (params = {}) =>
    requestWithAuth(
      `/auditoria/simples-nacional${buildQueryString(params)}`
    ),
  getNotasFiscaisPorPeriodo: (params = {}) =>
    requestWithAuth(
      `/auditoria/notas-fiscais/periodo${buildQueryString(params)}`
    ),
  getNotasFiscaisIssRetido: (params = {}) =>
    requestWithAuth(
      `/auditoria/notas-fiscais/iss-retido${buildQueryString(params)}`
    ),
  getFolhasMensais: (params = {}) =>
    requestWithAuth(
      `/auditoria/simples-nacional/folhas-mensais${buildQueryString(params)}`
    ),
  getFolhasAnteriores: (params = {}) =>
    requestWithAuth(
      `/auditoria/simples-nacional/folhas-anteriores${buildQueryString(
        params
      )}`
    ),
  getFolhasAnterioresPorMes: (params = {}) =>
    requestWithAuth(
      `/auditoria/simples-nacional/folhas-anteriores-por-mes${buildQueryString(
        params
      )}`
    ),
  getDasMensais: (params = {}) =>
    requestWithAuth(
      `/auditoria/simples-nacional/das-mensais${buildQueryString(params)}`
    ),
  getPulosDetectados: (params = {}) =>
    requestWithAuth(
      `/auditoria/simples-nacional/pulos-detectados${buildQueryString(params)}`
    ),
  getClienteByCnpj: (cnpj, regimeTributario, empresaId) =>
    requestWithAuth(
      `/auditoria/clientes/por-cnpj/${cnpj}${buildQueryString({
        empresa_id: empresaId,
        regime_tributario: regimeTributario,
      })}`
    ),
  getClienteById: (clienteId) =>
    requestWithAuth(`/auditoria/clientes/${clienteId}`),
  getCnaes: (params = {}) =>
    requestWithAuth(
      `/auditoria/cnae-info${buildQueryString(params)}`
    ),
};

let html2pdfInstance = null;
const loadHtml2Pdf = async () => {
  if (html2pdfInstance) return html2pdfInstance;
  const module = await import("html2pdf.js");
  html2pdfInstance = module.default || module;
  return html2pdfInstance;
};

// NOVA ROTA IMPLEMENTADA: /clientes/:id/dados-consolidados
//
// Esta rota combina dados de duas tabelas:
// - notas_fiscais: valor_total_nfe, data_emissao
// - analises_simples_nacional: valor_das, receita_total, mes, ano
//
// Para usar esta rota e simplificar o carregamento de dados do gráfico:
//
// 1. Substitua as chamadas separadas em carregarFaturamentos():
//    - apiService.getSimplesNacional()
//    - apiService.getNotasFiscaisPorPeriodo()
//
// 2. Use a nova rota consolidada:
//    const response = await apiService.getDadosConsolidadosCliente(clienteId, ano);
//
// 3. Os dados retornados já estão organizados por mês e prontos para o gráfico
//
// Exemplo de implementação:
// ```
// const dadosConsolidadosResponse = await apiService.getDadosConsolidadosCliente(
//   clienteIdFromUrl,
//   anoSelecionado
// );
//
// if (dadosConsolidadosResponse.data) {
//   const { dados_mensais, totais } = dadosConsolidadosResponse.data;
//
//   // Atualizar gráfico
//   setDadosMensais(dados_mensais.map(item => ({
//     name: item.mes,
//     Faturamento: item.receitaTotal,
//     'Guias DAS': item.valorDas,
//     'Faturamento Notas': item.faturamentoNotas
//   })));
//
//   // Atualizar cards
//   setFaturamentoExtrato(totais.receitaTotal);
//   setFaturamentoNotas(totais.faturamentoNotas);
//   setValoresGuiasDas(totais.valorDas);
// }
// ```
//
// Vantagens:
// - Uma única requisição para dados de duas tabelas
// - Dados já processados e organizados por mês
// - Melhor performance e consistência
// - Código mais limpo e manutenível
//
// ================================

// Função utilitária para formatar CNPJ

function formatCNPJ(cnpj) {
  return cnpj
    .replace(/\D/g, "")
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export default function ConsolidadoSimples() {
  const [selectedCompany, setSelectedCompany] = useState(null);

  const [clienteIdFromLocalStorage, setClienteIdFromLocalStorage] = useState(null);
  const [clienteTypeFromUrl, setClienteTypeFromUrl] = useState(null);
  const [storageReady, setStorageReady] = useState(false);

  const [clienteEspecifico, setClienteEspecifico] = useState(null);

  const [loading, setLoading] = useState(true);

  const [faturamentoExtrato, setFaturamentoExtrato] = useState(null);

  const [faturamentoNotas, setFaturamentoNotas] = useState(null);

  const [valoresGuiasDas, setValoresGuiasDas] = useState(null);

  const [dadosMensais, setDadosMensais] = useState([]);

  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());

  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth()); // 0 = Jan

  const [ncmResumoMes, setNcmResumoMes] = useState([]);

  const [pulosDetectados, setPulosDetectados] = useState([]);

  const [mostrarPulosDetectados, setMostrarPulosDetectados] = useState(false);

  const [mostrarTabelaNcms, setMostrarTabelaNcms] = useState(false);

  const [issRetidoMensal, setIssRetidoMensal] = useState([]);

  const [temIssRetido, setTemIssRetido] = useState(false);

  const [folhasMensais, setFolhasMensais] = useState([]);

  const [temFolhas, setTemFolhas] = useState(false);

  const [mostrarFolhas, setMostrarFolhas] = useState(false);

  const [dasMensais, setDasMensais] = useState([]);

  const [temDas, setTemDas] = useState(false);

  const [mostrarDas, setMostrarDas] = useState(false);

  // Estados para folhas anteriores
  const [folhasAnteriores, setFolhasAnteriores] = useState([]);
  const [folhasAnterioresPorMes, setFolhasAnterioresPorMes] = useState([]);
  const [mostrarFolhasAnteriores, setMostrarFolhasAnteriores] = useState(false);

  const [informacoesST, setInformacoesST] = useState({});

  const [carregandoST, setCarregandoST] = useState(false);

  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const userDataStr = localStorage.getItem("userData");
      if (userDataStr) {
        try {
          const parsed = JSON.parse(userDataStr);
          const empresaId = parsed?.EmpresaId || parsed?.empresa?.id;
          const empresaNome = parsed?.EmpresaNome || parsed?.empresa?.nome;
          const empresaCnpj = parsed?.EmpresaCnpj || parsed?.empresa?.cnpj;

          if (empresaId) {
            setSelectedCompany({
              id: empresaId,
              nome: empresaNome || "",
              cnpj: empresaCnpj || "",
              regime_tributario: "simples_nacional",
              tipo_empresa: "simples_nacional",
            });
          }
        } catch (error) {
          console.error("[ConsolidadoSimples] Erro ao interpretar userData:", error);
        }
      } else {
        router.push("/empresa");
      }

      // Buscar client_id e tipo da URL (query params)
      const { cliente_id, tipo } = router.query;
      if (cliente_id) {
        setClienteIdFromLocalStorage(cliente_id.toString());
        setClienteTypeFromUrl(tipo?.toString() || "cliente");
      }
      setStorageReady(true);
    } catch (error) {
      console.error("[ConsolidadoSimples] Erro ao carregar dados locais:", error);
      router.push("/login");
    }
  }, [router, router.query]);

  // Carregar cliente específico do backend usando o ID do localStorage
  useEffect(() => {
    const carregarClienteEspecifico = async () => {
      console.log("🔍 [ConsolidadoSimples] carregarClienteEspecifico executando...");
      console.log("🔍 [ConsolidadoSimples] clienteIdFromLocalStorage:", clienteIdFromLocalStorage);
      
      if (!clienteIdFromLocalStorage) {
        console.log("⚠️ [ConsolidadoSimples] Nenhum cliente ID encontrado no localStorage");
        setClienteEspecifico(null);
        return;
      }

      try {
        // Verificar se é cliente ou pre_cliente (vem da URL)
        const clientType = clienteTypeFromUrl || "cliente";
        console.log("🔍 [ConsolidadoSimples] Tipo de cadastro:", clientType);
        
        let clienteData = null;
        
        if (clientType === "pre_cliente") {
          // Para pre_cliente, buscar dados da primeira análise encontrada usando company_id
          // A API retorna análises com pre_cliente_id, então buscamos todas e filtramos
          console.log("🔍 [ConsolidadoSimples] Buscando dados de pre_cliente via análises...");
          const analisesResponse = await auditoriaApi.getSimplesNacional({
            company_id: selectedCompany?.id,
            limit: 100 // Buscar mais para garantir que encontramos o pre_cliente correto
          });
          
          if (analisesResponse.error) {
            console.error("❌ [ConsolidadoSimples] Erro ao buscar análises do pre_cliente:", analisesResponse.error);
            setClienteEspecifico(null);
            return;
          }
          
          // Filtrar análises pelo pre_clientes_id correto
          const analises = Array.isArray(analisesResponse.data) 
            ? analisesResponse.data 
            : analisesResponse.data?.data || [];
          
          const analiseDoPreCliente = analises.find(
            a => a.pre_clientes_id && Number(a.pre_clientes_id) === Number(clienteIdFromLocalStorage)
          );
          
          if (analiseDoPreCliente) {
            clienteData = {
              id: analiseDoPreCliente.pre_clientes_id || clienteIdFromLocalStorage,
              nome: analiseDoPreCliente.nome || analiseDoPreCliente.resultado_api?.razao_social || '',
              cnpj: analiseDoPreCliente.cnpj || analiseDoPreCliente.cnpj_exibicao || analiseDoPreCliente.resultado_api?.cnpj || '',
              uf: analiseDoPreCliente.uf || analiseDoPreCliente.resultado_api?.uf || '',
              regime_tributario: analiseDoPreCliente.regime_tributario || 'simples_nacional'
            };
          } else {
            console.error("❌ [ConsolidadoSimples] Análise do pre_cliente não encontrada");
            setClienteEspecifico(null);
            return;
          }
        } else {
          // Para cliente, usar a rota normal
          console.log("🔍 [ConsolidadoSimples] Buscando dados de cliente via API...");
          const clienteResponse = await auditoriaApi.getClienteById(clienteIdFromLocalStorage);
          
          if (clienteResponse.error) {
            console.error("❌ [ConsolidadoSimples] Erro ao buscar cliente do backend:", clienteResponse.error);
            setClienteEspecifico(null);
            return;
          }
          
          clienteData = clienteResponse.data;
        }
        
        if (!clienteData) {
          console.error("❌ [ConsolidadoSimples] Dados do cliente não encontrados");
          setClienteEspecifico(null);
          return;
        }
        
        // Criar objeto cliente com os dados do backend
        const cliente = {
          id: clienteData.id || clienteIdFromLocalStorage,
          nome: clienteData.nome || clienteData.razao_social || '',
          cnpj: clienteData.cnpj || clienteData.cpf_cnpj || '',
          uf: clienteData.uf || clienteData.estado || '',
          regime_tributario: clienteData.regime_tributario || 'simples_nacional'
        };

        setClienteEspecifico(cliente);
        console.log("✅ [ConsolidadoSimples] Cliente carregado do backend:", cliente);
      } catch (err) {
        console.error("❌ [ConsolidadoSimples] Erro ao carregar cliente específico:", err);
        setClienteEspecifico(null);
      }
    };

    if (storageReady && clienteIdFromLocalStorage && selectedCompany) {
      carregarClienteEspecifico();
    }
  }, [clienteIdFromLocalStorage, clienteTypeFromUrl, storageReady, selectedCompany]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    console.log("🔍 [ConsolidadoSimples] useEffect executando...");
    console.log("🔍 [ConsolidadoSimples] selectedCompany:", selectedCompany);
    console.log("🔍 [ConsolidadoSimples] clienteEspecifico:", clienteEspecifico);
    console.log("🔍 [ConsolidadoSimples] clienteIdFromLocalStorage:", clienteIdFromLocalStorage);
    
    // Se temos um cliente específico, usar ele independente do selectedCompany
    if (clienteIdFromLocalStorage) {
      if (!clienteEspecifico) {
        console.log("🔍 [ConsolidadoSimples] Aguardando cliente específico carregar do backend...");
        return; // Aguardar carregarClienteEspecifico
      }
      
      console.log("🔍 [ConsolidadoSimples] Carregando faturamentos com cliente específico...");
      carregarFaturamentos();
      return;
    }
    
    // Se não temos cliente específico, verificar se temos empresa selecionada
    if (!selectedCompany && !clienteEspecifico) {
      console.log("🔍 [ConsolidadoSimples] Redirecionando para dashboard-simples - nenhuma empresa/cliente encontrado");
      router.push("/dashboard-simples");
      return;
    }

    console.log("🔍 [ConsolidadoSimples] Carregando faturamentos com empresa selecionada...");
    carregarFaturamentos();

    // eslint-disable-next-line
  }, [selectedCompany, clienteEspecifico, anoSelecionado, storageReady]);

  useEffect(() => {
    if (!storageReady || !selectedCompany) {
      return;
    }

    // Se temos um cliente específico, aguardar ele carregar primeiro
    if (clienteIdFromLocalStorage && !clienteEspecifico) {
      return; // Aguardar carregarClienteEspecifico
    }

    carregarNcmResumoMes();

    carregarIssRetidoMensal();

    carregarFolhasAnteriores();

    // eslint-disable-next-line
  }, [selectedCompany, anoSelecionado, mesSelecionado, clienteEspecifico, storageReady]);

  // NOVA FUNÇÃO: Detectar pulos nas sequências de notas fiscais

  const detectarPulosNotas = async () => {
    console.log("🔍 [PULOS] Iniciando detecção de pulos...");
    
    if (!selectedCompany) {
      console.log("🔍 [PULOS] selectedCompany não encontrado");
      return;
    }

    // Usar CNPJ do cliente específico se disponível, senão usar da empresa selecionada
    const empresaAtual = clienteEspecifico || selectedCompany;
    const cnpj = getCnpj(empresaAtual);

    console.log("🔍 [PULOS] CNPJ para busca:", cnpj);

    if (!cnpj) {
      console.error("🔍 [PULOS] CNPJ não encontrado");
      return;
    }

    try {
      // Usar a nova rota de pulos detectados
      const pulosResponse = await auditoriaApi.getPulosDetectados({
        cnpj_emitente: cnpj,
        ano: anoSelecionado,
        company_id: selectedCompany?.id,
      });

      console.log(
        "Consulta de pulos executada para CNPJ:",
        cnpj,
        "Ano:",
        anoSelecionado
      );

      if (pulosResponse.error) {
        // 403/404 são normais se o usuário não tem acesso ou não há dados
        if (pulosResponse.status === 403 || pulosResponse.status === 404 || 
            pulosResponse.error?.includes('não possui empresas') ||
            pulosResponse.error?.includes('não encontrado')) {
          console.log("Não foi possível detectar pulos (sem acesso ou sem dados)");
          setPulosDetectados([]);
          return;
        }
        console.error("Erro ao detectar pulos:", pulosResponse.error);
        setPulosDetectados([]);
        return;
      }

      const pulosData = pulosResponse.data;

      if (pulosData && pulosData.data) {
        setPulosDetectados(pulosData.data);
        console.log("Pulos detectados:", pulosData.data);
        console.log("Total de pulos:", pulosData.total_pulos);
          } else {
        setPulosDetectados([]);
      }
    } catch (error) {
      console.error("Erro ao detectar pulos:", error);
      setPulosDetectados([]);
    }
  };

  useEffect(() => {
    if (!storageReady || !selectedCompany) {
      return;
    }

    console.log("🔍 [PULOS] useEffect executando...");
    console.log("🔍 [PULOS] selectedCompany:", selectedCompany);
    console.log("🔍 [PULOS] clienteEspecifico:", clienteEspecifico);
    
    // Verificar se temos uma empresa válida
    const empresaAtual = clienteEspecifico || selectedCompany;
    
    if (!empresaAtual) {
      console.log("🔍 [PULOS] Nenhuma empresa encontrada");
      return;
    }
    
    // Verificar se é Simples Nacional
    const isSimplesNacional = 
      empresaAtual.tipo_empresa === "simples_nacional" ||
      empresaAtual.regime_tributario === "simples_nacional";
    
    console.log("🔍 [PULOS] É Simples Nacional:", isSimplesNacional);
    
    if (!isSimplesNacional) {
      console.log("🔍 [PULOS] Não é Simples Nacional, retornando");
      return;
    }

    console.log("🔍 [PULOS] Condições atendidas, carregando pulos");
    detectarPulosNotas();

    // eslint-disable-next-line
  }, [selectedCompany, anoSelecionado, clienteEspecifico, storageReady]);

  const carregarFaturamentos = async () => {
    setLoading(true);

    if (!storageReady || !selectedCompany) return;

    // Usar CNPJ do cliente específico se disponível, senão usar da empresa selecionada

    const empresaAtual = clienteEspecifico || selectedCompany;

    const cnpj = getCnpj(empresaAtual);



    if (!cnpj) {
      console.error("CNPJ não encontrado");

      setLoading(false);

      return;
    }

    // Se temos um cliente específico, usar a nova rota de dados consolidados

    if (clienteEspecifico && clienteIdFromLocalStorage) {
      try {


        const dadosConsolidadosResponse =
          await auditoriaApi.getDadosConsolidadosCliente(
            clienteIdFromLocalStorage,
            anoSelecionado
          );

        if (dadosConsolidadosResponse.error) {
          // 404 é normal se o cliente não tem dados consolidados
          if (dadosConsolidadosResponse.status === 404 || dadosConsolidadosResponse.error?.includes('não encontrado')) {
            console.log("Cliente não possui dados consolidados para o período selecionado");
            setLoading(false);
            return;
          }
          console.error(
            "Erro ao carregar dados consolidados:",
            dadosConsolidadosResponse.error
          );
          setLoading(false);

          return;
        }

        if (dadosConsolidadosResponse.data) {
          const { dados_mensais, totais } = dadosConsolidadosResponse.data;



          // Atualizar estado do gráfico

          const dadosGrafico = dados_mensais.map((item) => ({
            name: item.mes,

            Faturamento: item.receitaTotal,

            "Guias DAS": item.valorDas,

            "Faturamento Notas": item.faturamentoNotas,
          }));

          setDadosMensais(dadosGrafico);

          // Atualizar cards de resumo

          setFaturamentoExtrato(totais.receitaTotal);

          setFaturamentoNotas(totais.faturamentoNotas);

          setValoresGuiasDas(totais.valorDas);


        }
      } catch (err) {
        console.error("Erro ao carregar dados consolidados:", err);
      } finally {
        setLoading(false);
      }

      return;
    }

    try {
      // Buscar todos os registros do ano selecionado

      const analisesResponse = await auditoriaApi.getSimplesNacional({
        clientes_id:
          clienteEspecifico?.id || clienteIdFromLocalStorage || undefined,
        ano: anoSelecionado,
        company_id: selectedCompany?.id,
      });

      if (analisesResponse.error) {
        console.error("Erro ao carregar análises:", analisesResponse.error);

        return;
      }

      const extratoMensal = Array.isArray(analisesResponse.data)
        ? analisesResponse.data
        : [];

      // Inicializar array para os 12 meses

      const meses = [
        "Jan",
        "Fev",
        "Mar",
        "Abr",
        "Mai",
        "Jun",

        "Jul",
        "Ago",
        "Set",
        "Out",
        "Nov",
        "Dez",
      ];

      const dados = meses.map((mes) => ({
        name: mes,

        Faturamento: 0,

        "Guias DAS": 0,

        "Faturamento Notas": 0,
      }));

      if (extratoMensal && extratoMensal.length > 0) {
        console.log("Dados do PGDAS-D encontrados:", extratoMensal);
        extratoMensal.forEach((item) => {
          // Usar as colunas mes e ano diretamente da tabela analises_simples_nacional
          const mesIdx = (item.mes || 1) - 1; // mes vem como número (1-12), converter para índice (0-11)
          const anoItem = item.ano || anoSelecionado;

          // Verificar se o item pertence ao ano selecionado
          if (anoItem === anoSelecionado && mesIdx >= 0 && mesIdx < 12) {
            dados[mesIdx].Faturamento += Number(item.receita_total) || 0;
            dados[mesIdx]["Guias DAS"] += Number(item.valor_das) || 0;
            console.log(
              `PGDAS-D ${meses[mesIdx]}: Receita=${item.receita_total}, DAS=${item.valor_das}, Mes=${item.mes}, Ano=${item.ano}`
            );
          }
        });
      } else {
        console.log("Nenhum dado do PGDAS-D encontrado para o período");
      }

      // Buscar faturamento das notas fiscais (por mês) - CORRIGIDO



      // Buscar todas as notas fiscais do ano selecionado

      const notasResponse = await auditoriaApi.getNotasFiscaisPorPeriodo({
        clientes_id: clienteEspecifico?.id || clienteIdFromLocalStorage || undefined,
        ano: anoSelecionado,
        select: "chave_nfe,valor_total_nfe,data_emissao,modelo,cnpj_emitente",
        company_id: selectedCompany?.id,
      });



      if (notasResponse.error) {
        console.error("Erro ao carregar notas fiscais:", notasResponse.error);

        return;
      }

      const notasFiscais = Array.isArray(notasResponse.data)
        ? notasResponse.data
        : [];



      if (notasFiscais && notasFiscais.length > 0) {
        // Log para depuração: mostrar todas as notas retornadas

        console.log("Notas fiscais retornadas:", notasFiscais);

        console.log("Total de notas encontradas:", notasFiscais.length);

        // Verificar se as notas estão no ano correto (limitado a 10 para não sobrecarregar o console)

        console.log("Verificando ano das notas encontradas (primeiras 10):");

        notasFiscais.slice(0, 10).forEach((nota, idx) => {
          const dataNota = new Date(nota.data_emissao);

          console.log(
            `Nota ${idx + 1}: ${nota.chave_nfe} - Data: ${
              nota.data_emissao
            } - Ano: ${dataNota.getFullYear()} - Valor: ${
              nota.valor_total_nfe
            } - Tipo: ${typeof nota.valor_total_nfe}`
          );
        });

        if (notasFiscais.length > 10) {
          console.log(`... e mais ${notasFiscais.length - 10} notas`);
        }
      }

      // Verificar se há notas que não estão sendo encontradas devido ao filtro de data

      if (notasFiscais && notasFiscais.length === 0) {
        console.log(
          "⚠️ ATENÇÃO: Nenhuma nota encontrada para o CNPJ no ano selecionado."
        );

        // DEBUG: Tentar buscar sem filtro de ano para ver se existem notas para este CNPJ

        console.log(
          "🔍 DEBUG - Tentando buscar notas sem filtro de ano para debug..."
        );

        const notasDebugResponse = await auditoriaApi.getNotasFiscaisPorPeriodo({
          clientes_id: clienteEspecifico?.id || clienteIdFromLocalStorage || undefined,
          select: "chave_nfe,valor_total_nfe,data_emissao,modelo,cnpj_emitente",
          company_id: selectedCompany?.id,
        });

        if (notasDebugResponse.error) {
          console.error(
            "🔍 DEBUG - Erro ao buscar notas sem filtro:",
            notasDebugResponse.error
          );
        } else {
          const notasDebug = Array.isArray(notasDebugResponse.data)
            ? notasDebugResponse.data
            : [];

          console.log(
            "🔍 DEBUG - Notas encontradas sem filtro de ano:",
            notasDebug.length
          );

          if (notasDebug.length > 0) {
            console.log(
              "🔍 DEBUG - Primeiras 3 notas sem filtro:",
              notasDebug.slice(0, 3)
            );


          }
        }
      }

      if (notasFiscais && notasFiscais.length > 0) {
        // Log para depuração: mostrar todas as notas retornadas

        console.log("Notas fiscais retornadas:", notasFiscais);

        console.log("Total de notas encontradas:", notasFiscais.length);

        // Verificar se as notas estão no ano correto (limitado a 10 para não sobrecarregar o console)

        console.log("Verificando ano das notas encontradas (primeiras 10):");

        notasFiscais.slice(0, 10).forEach((nota, idx) => {
          const dataNota = new Date(nota.data_emissao);

          console.log(
            `Nota ${idx + 1}: ${nota.chave_nfe} - Data: ${
              nota.data_emissao
            } - Ano: ${dataNota.getFullYear()} - Valor: ${
              nota.valor_total_nfe
            } - Tipo: ${typeof nota.valor_total_nfe}`
          );
        });

        if (notasFiscais.length > 10) {
          console.log(`... e mais ${notasFiscais.length - 10} notas`);
        }

        // Função auxiliar para converter valor_total_nfe para número

        const converterValorNota = (valor) => {
          if (valor === null || valor === undefined) return 0;

          // Se já é número, retorna o valor

          if (typeof valor === "number") return valor;

          // Se é string, converte para número

          if (typeof valor === "string") {
            // Remove vírgulas e substitui por ponto se necessário

            const valorLimpo = valor.replace(/\./g, "").replace(",", ".");

            const numero = parseFloat(valorLimpo);

            return isNaN(numero) ? 0 : numero;
          }

          return 0;
        };

        // Filtrar notas por ano e processar cada nota fiscal

        const notasFiltradas = notasFiscais.filter((nota) => {
          if (!nota.data_emissao) {
            console.warn("Nota sem data de emissão:", nota);

            return false;
          }

          const dataStr =
            typeof nota.data_emissao === "string"
              ? nota.data_emissao.split("T")[0]
              : "";

          if (!dataStr || dataStr === "") {
            console.warn("Nota com data inválida:", nota);

            return false;
          }

          const [ano, mes, dia] = dataStr.split("-");

          if (
            !ano ||
            !mes ||
            !dia ||
            isNaN(Number(ano)) ||
            isNaN(Number(mes)) ||
            isNaN(Number(dia))
          ) {
            console.warn("Nota com componentes de data inválidos:", {
              ano,
              mes,
              dia,
            });

            return false;
          }

          const anoNota = Number(ano);

          if (anoNota !== anoSelecionado) {
            console.log(
              `Nota ignorada - ano da nota (${anoNota}) diferente do ano selecionado (${anoSelecionado}):`,
              nota.chave_nfe
            );

            return false;
          }

          return true;
        });

        console.log(
          `Notas filtradas para o ano ${anoSelecionado}:`,
          notasFiltradas.length
        );

        const notasPorMes = {};

        let contadorProcessadas = 0;

        notasFiltradas.forEach((nota) => {
          contadorProcessadas++;

          if (contadorProcessadas % 100 === 0) {
            console.log(
              `Processadas ${contadorProcessadas}/${notasFiltradas.length} notas...`
            );
          }

          // Corrigir a criação da data para evitar problemas de timezone e formato

          const dataStr =
            typeof nota.data_emissao === "string"
              ? nota.data_emissao.split("T")[0]
              : "";

          const [ano, mes, dia] = dataStr.split("-");

          const data = new Date(Number(ano), Number(mes) - 1, Number(dia));

          const mesIdx = data.getMonth(); // 0 = Jan, 11 = Dez

          // Converter valor da nota para número

          const valorNota = converterValorNota(nota.valor_total_nfe);

          // Verificar se o valor é válido

          if (valorNota <= 0) {
            console.warn(
              "Nota com valor inválido:",
              nota.chave_nfe,
              "valor:",
              valorNota
            );

            return; // Pular notas com valor inválido
          }

          if (mesIdx >= 0 && mesIdx < 12) {
            dados[mesIdx]["Faturamento Notas"] += valorNota;

            // Agrupar notas por mês para análise (limitado para não sobrecarregar)

            const mesNome = [
              "Jan",
              "Fev",
              "Mar",
              "Abr",
              "Mai",
              "Jun",
              "Jul",
              "Ago",
              "Set",
              "Out",
              "Nov",
              "Dez",
            ][mesIdx];

            if (!notasPorMes[mesNome]) {
              notasPorMes[mesNome] = [];
            }

            // Limitar a 50 notas por mês para evitar sobrecarga

            if (notasPorMes[mesNome].length < 50) {
              notasPorMes[mesNome].push({
                chave: nota.chave_nfe,

                valor: valorNota,

                data: nota.data_emissao,

                modelo: nota.modelo,
              });
            }
          } else {
            console.warn("Nota com data inválida:", nota);
          }
        });

        console.log(
          `Processamento concluído: ${contadorProcessadas} notas processadas`
        );

        // Log detalhado por mês (limitado para não sobrecarregar)

        console.log("Resumo detalhado por mês:");

        Object.keys(notasPorMes).forEach((mes) => {
          const totalMes = notasPorMes[mes].reduce(
            (sum, nota) => sum + nota.valor,
            0
          );

          console.log(
            `${mes}: ${
              notasPorMes[mes].length
            } notas, Total: R$ ${totalMes.toFixed(2)}`
          );

          // Mostrar apenas as primeiras 5 notas de cada mês

          if (notasPorMes[mes].length > 0) {
            console.log(`  Primeiras 5 notas de ${mes}:`);

            notasPorMes[mes].slice(0, 5).forEach((nota) => {
              console.log(
                `    - ${nota.chave}: R$ ${nota.valor.toFixed(2)} (${
                  nota.data
                })`
              );
            });

            if (notasPorMes[mes].length > 5) {
              console.log(
                `    ... e mais ${notasPorMes[mes].length - 5} notas`
              );
            }
          }
        });

        // LOGS DE DEPURAÇÃO

        console.log("Resumo final por mês:");

        dados.forEach((mes, idx) => {
          console.log(
            `${
              [
                "Jan",
                "Fev",
                "Mar",
                "Abr",
                "Mai",
                "Jun",
                "Jul",
                "Ago",
                "Set",
                "Out",
                "Nov",
                "Dez",
              ][idx]
            }: R$ ${mes["Faturamento Notas"].toFixed(2)}`
          );
        });

        // Calcular total anual das notas

        const totalAnualNotas = dados.reduce(
          (sum, item) => sum + item["Faturamento Notas"],
          0
        );

        setFaturamentoNotas(totalAnualNotas);
      } else {
        console.log("Nenhuma nota fiscal encontrada para o período");

        setFaturamentoNotas(0);
      }

      setDadosMensais(dados);

      // Buscar valores guias DAS (total anual)

      let totalDas = 0;

      if (extratoMensal && extratoMensal.length > 0) {
        totalDas = extratoMensal.reduce(
          (sum, item) => sum + (item.valor_das || 0),
          0
        );
      }

      setValoresGuiasDas(totalDas);

      // Faturamento anual (soma dos meses)

      let somaReceitaTotal = 0;

      if (extratoMensal && extratoMensal.length > 0) {
        somaReceitaTotal = extratoMensal.reduce(
          (sum, item) => sum + (item.receita_total || 0),
          0
        );
      }

      setFaturamentoExtrato(somaReceitaTotal);
    } catch {
      setFaturamentoExtrato(0);

      setFaturamentoNotas(0);

      setValoresGuiasDas(0);

      setDadosMensais([]);
    } finally {
      setLoading(false);
    }
  };

  // NOVA FUNÇÃO: Carregar resumo de NCMs usando as novas colunas individuais

  const carregarNcmResumoMes = async () => {
    if (!storageReady || !selectedCompany) return;

    // Usar CNPJ do cliente específico se disponível, senão usar da empresa selecionada
    const empresaAtual = clienteEspecifico || selectedCompany;
    const cnpj = getCnpj(empresaAtual);

    if (!cnpj) {
      console.error("CNPJ não encontrado");
      return;
    }

    const mes = (mesSelecionado + 1).toString().padStart(2, "0");

    // Calcular o último dia do mês selecionado
    // const ultimoDia = new Date(anoSelecionado, mesSelecionado + 1, 0).getDate();
    // const dataFinal = `${anoSelecionado}-${mes}-${ultimoDia}`;

    try {
      // Usar o ID do cliente específico se disponível, senão usar o ID do localStorage
      const clientesId = clienteEspecifico?.id || clienteIdFromLocalStorage || undefined;
      
      // Buscar todas as notas fiscais do mês/ano selecionado com as novas colunas individuais
      const notasResponse = await auditoriaApi.getNotasFiscaisPorPeriodo({
        clientes_id: clientesId,
        ano: anoSelecionado,
        mes: parseInt(mes),
        select:
          "chave_nfe,numero_nfe,serie,data_emissao,cnpj_emitente,valor_total_nfe,ncm,quantidade,valor_unitario,valor_total_item,pis,cofins,icms,ncm_notas,estado_origem,estado_destino",
        company_id: selectedCompany?.id,
      });

      if (notasResponse.error) {
        // 404 é normal se o cliente não tem notas fiscais
        if (notasResponse.status === 404 || notasResponse.error?.includes('não encontrado')) {
          console.log("Cliente não possui notas fiscais para o período selecionado");
          setNcmResumoMes([]);
          return;
        }
        console.error(
          "[ConsolidadoSimples] Erro ao buscar notas fiscais:",
          notasResponse.error
        );
        setNcmResumoMes([]);
        return;
      }

      // Verificar se a resposta tem a estrutura correta
      let notas = [];
      if (notasResponse.data) {
        if (Array.isArray(notasResponse.data)) {
          notas = notasResponse.data;
        } else if (notasResponse.data.data && Array.isArray(notasResponse.data.data)) {
          notas = notasResponse.data.data;
        }
      }

      if (!notas || notas.length === 0) {
        setNcmResumoMes([]);
        return;
      }

      // Agrupar NCMs e calcular totais
      const ncmMap = {};
      notas.forEach((nota) => {

        // Prioridade 1: Usar colunas individuais se disponíveis
        if (nota.ncm && nota.ncm.trim() !== "") {
          const ncm = nota.ncm;
          const quantidade = Number(nota.quantidade) || 1;
          const valorTotal =
            Number(nota.valor_total_item) || Number(nota.valor_total_nfe) || 0;
          const pis = Number(nota.pis) || 0;
          const cofins = Number(nota.cofins) || 0;
          const icms = Number(nota.icms) || 0;
          if (!ncmMap[ncm]) {
            ncmMap[ncm] = {
              ncm: ncm,
              totalQuantidade: 0,
              totalValor: 0,
              totalPis: 0,
              totalCofins: 0,
              totalIcms: 0,
              pisPercentage: "0.00",
              cofinsPercentage: "0.00",
              icmsPercentage: "0.00",
              estadoOrigem: nota.estado_origem,
              estadoDestino: nota.estado_destino,
            };
          }

          ncmMap[ncm].totalQuantidade += quantidade;

          ncmMap[ncm].totalValor += valorTotal;

          ncmMap[ncm].totalPis += pis;

          ncmMap[ncm].totalCofins += cofins;

          ncmMap[ncm].totalIcms += icms;

          // Atualizar estados se não estiverem definidos

          if (!ncmMap[ncm].estadoOrigem && nota.estado_origem) {
            ncmMap[ncm].estadoOrigem = nota.estado_origem;
          }

          if (!ncmMap[ncm].estadoDestino && nota.estado_destino) {
            ncmMap[ncm].estadoDestino = nota.estado_destino;
          }

        }

        // Prioridade 2: Usar dados detalhados do JSON se colunas individuais não estiverem disponíveis
        else if (nota.ncm_notas && nota.ncm_notas.trim() !== "") {
          try {
            const ncmArr =
              typeof nota.ncm_notas === "string"
                ? JSON.parse(nota.ncm_notas)
                : nota.ncm_notas;


            ncmArr.forEach((ncmObj) => {
              // Se NCM está vazio, usar "N/A" como identificador
              const ncmKey = ncmObj.ncm && ncmObj.ncm.trim() !== "" ? ncmObj.ncm : "N/A";

              if (!ncmMap[ncmKey]) {
                ncmMap[ncmKey] = {
                  ncm: ncmKey,

                  totalQuantidade: 0,

                  totalValor: 0,

                  totalPis: 0,

                  totalCofins: 0,

                  totalIcms: 0,

                  pisPercentage: "0.00",

                  cofinsPercentage: "0.00",

                  icmsPercentage: "0.00",
                };
              }

              ncmMap[ncmKey].totalQuantidade +=
                Number(ncmObj.totalQuantidade) || 0;

              ncmMap[ncmKey].totalValor += Number(ncmObj.totalValor) || 0;

              ncmMap[ncmKey].totalPis += Number(ncmObj.totalPis) || 0;

              ncmMap[ncmKey].totalCofins += Number(ncmObj.totalCofins) || 0;

              ncmMap[ncmKey].totalIcms += Number(ncmObj.totalIcms) || 0;
            });

          } catch (e) {
            console.error(
              `[ConsolidadoSimples] Erro ao processar ncm_notas da nota ${nota.numero_nfe}:`,
              e
            );

          }
        } else {
          // Se não tem dados individuais nem detalhados, agrupar por valor total

          const ncm = "N/A"; // NCM não disponível

          const valorTotal = Number(nota.valor_total_nfe) || 0;

          if (!ncmMap[ncm]) {
            ncmMap[ncm] = {
              ncm: ncm,

              totalQuantidade: 0,

              totalValor: 0,

              totalPis: 0,

              totalCofins: 0,

              totalIcms: 0,

              pisPercentage: "0.00",

              cofinsPercentage: "0.00",

              icmsPercentage: "0.00",
            };
          }

          ncmMap[ncm].totalQuantidade += 1; // Uma nota

          ncmMap[ncm].totalValor += valorTotal;

          // Impostos ficam como 0 pois não temos dados detalhados
        }
      });

      // Calcular percentuais

      Object.values(ncmMap).forEach((ncmObj) => {
        const total = ncmObj.totalValor;

        ncmObj.pisPercentage =
          total > 0 ? ((ncmObj.totalPis / total) * 100).toFixed(2) : "0.00";

        ncmObj.cofinsPercentage =
          total > 0 ? ((ncmObj.totalCofins / total) * 100).toFixed(2) : "0.00";

        ncmObj.icmsPercentage =
          total > 0 ? ((ncmObj.totalIcms / total) * 100).toFixed(2) : "0.00";
      });

      const resultado = Object.values(ncmMap).sort((a, b) =>
        a.ncm.localeCompare(b.ncm)
      );

      setNcmResumoMes(resultado);

      // Carregar informações de ST para os NCMs encontrados
      if (resultado.length > 0) {
        carregarInformacoesST(
          resultado.map((item) => item.ncm).filter((ncm) => ncm !== "N/A")
        );
      }
    } catch (error) {
      console.error(
        "[ConsolidadoSimples] Erro ao carregar resumo de NCMs:",
        error
      );

      setNcmResumoMes([]);
    }
  };

  // Função para carregar informações de ST para os NCMs

  const carregarInformacoesST = async (ncms) => {
    if (ncms.length === 0) return;

    setCarregandoST(true);

    try {
      console.log(
        `[ConsolidadoSimples] Carregando informações de ST para ${ncms.length} NCMs:`,
        ncms
      );

      const informacoes = await buscarInformacoesSTMultiplosNCMs(ncms);

      setInformacoesST(informacoes);

      console.log(
        `[ConsolidadoSimples] Informações de ST carregadas:`,
        informacoes
      );
    } catch (error) {
      console.error(
        "[ConsolidadoSimples] Erro ao carregar informações de ST:",
        error
      );
    } finally {
      setCarregandoST(false);
    }
  };

  // NOVA FUNÇÃO: Carregar dados de ISS retido por mês

  const carregarIssRetidoMensal = async () => {
    if (!storageReady || !selectedCompany) return;

    // Usar CNPJ do cliente específico se disponível, senão usar da empresa selecionada

    const empresaAtual = clienteEspecifico || selectedCompany;

    const cnpj = getCnpj(empresaAtual);

    if (!cnpj) {
      console.error("CNPJ não encontrado");

      return;
    }

    try {
      // Usar o ID do cliente específico se disponível, senão usar o ID do localStorage
      const clientesId = clienteEspecifico?.id || clienteIdFromLocalStorage || undefined;
      
      // Buscar dados de ISS retido por mês
      const dadosIssResponse = await auditoriaApi.getNotasFiscaisIssRetido({
        clientes_id: clientesId,
        ano: anoSelecionado,
        company_id: selectedCompany?.id,
      });

      if (dadosIssResponse.error) {
        // 404 é normal se o cliente não tem ISS retido
        if (dadosIssResponse.status === 404 || dadosIssResponse.error?.includes('não encontrado')) {
          console.log("Cliente não possui ISS retido para o período selecionado");
          setTemIssRetido(false);
          setIssRetidoMensal([]);
          return;
        }
        console.error(
          "Erro ao carregar dados de ISS retido:",
          dadosIssResponse.error
        );
        return;
      }

      const dadosIss = Array.isArray(dadosIssResponse.data)
        ? dadosIssResponse.data
        : [];

      // Se não tem ISS retido, não carrega a tabela

      if (!dadosIss || dadosIss.length === 0) {
        setTemIssRetido(false);

        setIssRetidoMensal([]);

        return;
      }

      setTemIssRetido(true);

      if (dadosIss && dadosIss.length > 0) {
        // Agrupar por mês

        const dadosPorMes = {};

        dadosIss.forEach((nota) => {
          const data = new Date(nota.data_emissao);

          const mes = data.getMonth();

          const ano = data.getFullYear();

          const chave = `${ano}-${mes}`;

          if (!dadosPorMes[chave]) {
            dadosPorMes[chave] = { valor: 0, quantidade: 0 };
          }

          dadosPorMes[chave].valor += parseFloat(nota.valor_iss_ret || "0");

          dadosPorMes[chave].quantidade += 1;
        });

        // Converter para array e formatar

        const nomesMeses = [
          "Janeiro",
          "Fevereiro",
          "Março",
          "Abril",
          "Maio",
          "Junho",

          "Julho",
          "Agosto",
          "Setembro",
          "Outubro",
          "Novembro",
          "Dezembro",
        ];

        const dadosFormatados = Object.entries(dadosPorMes)

          .map(([chave, dados]) => {
            const [ano, mes] = chave.split("-");

            return {
              mes: nomesMeses[parseInt(mes)],

              ano: parseInt(ano),

              valor_iss_retido: dados.valor,

              quantidade_notas: dados.quantidade,
            };
          })

          .sort((a, b) => {
            // Ordenar por ano e mês

            if (a.ano !== b.ano) return a.ano - b.ano;

            const meses = [
              "Janeiro",
              "Fevereiro",
              "Março",
              "Abril",
              "Maio",
              "Junho",

              "Julho",
              "Agosto",
              "Setembro",
              "Outubro",
              "Novembro",
              "Dezembro",
            ];

            return meses.indexOf(a.mes) - meses.indexOf(b.mes);
          });

        setIssRetidoMensal(dadosFormatados);
      } else {
        setIssRetidoMensal([]);
      }
    } catch (error) {
      console.error("Erro ao carregar dados de ISS retido:", error);
    }
  };

  // NOVA FUNÇÃO: Carregar folhas de salários mensais

  const carregarFolhasMensais = async () => {
    console.log("🔍 [FOLHAS] Iniciando carregamento de folhas...");

    if (!storageReady || !selectedCompany) {
      console.log("🔍 [FOLHAS] selectedCompany não encontrado");
      return;
    }

    // Usar CNPJ do cliente específico se disponível, senão usar da empresa selecionada
    const empresaAtual = clienteEspecifico || selectedCompany;
    const cnpj = getCnpj(empresaAtual);

    console.log("🔍 [FOLHAS] CNPJ para busca:", cnpj);

    if (!cnpj) {
      console.error("🔍 [FOLHAS] CNPJ não encontrado");
      return;
    }

    try {
      // Usar o ID do cliente específico se disponível, senão usar o ID do localStorage
      const clientesId = clienteEspecifico?.id || clienteIdFromLocalStorage || undefined;
      
      // Usar a nova rota de folhas mensais
      const folhasResponse = await auditoriaApi.getFolhasMensais({
        clientes_id: clientesId,
        ano: anoSelecionado,
      });

      if (folhasResponse.error) {
        // 404 é normal se o cliente não tem folhas
        if (folhasResponse.status === 404 || folhasResponse.error?.includes('não encontrado')) {
          console.log("Cliente não possui folhas de pagamento para o período selecionado");
          setTemFolhas(false);
          setFolhasMensais([]);
          return;
        }
        console.error("Erro ao carregar folhas mensais:", folhasResponse.error);
        setTemFolhas(false);
        setFolhasMensais([]);
        return;
      }

      const folhasData = folhasResponse.data;

      if (folhasData && folhasData.tem_folhas) {
        setTemFolhas(true);
        setFolhasMensais(folhasData.data || []);
        console.log("✅ [FOLHAS] Folhas carregadas:", folhasData.data);
        console.log("✅ [FOLHAS] Total das folhas:", folhasData.valor_total);
      } else {
        console.log("⚠️ [FOLHAS] Nenhuma folha encontrada");
        setTemFolhas(false);
        setFolhasMensais([]);
      }
    } catch (error) {
      console.error("Erro ao carregar folhas mensais:", error);
      setTemFolhas(false);
      setFolhasMensais([]);
    }
  };

  // NOVA FUNÇÃO: Carregar Folhas de Salários Anteriores (2.3)
  const carregarFolhasAnteriores = async () => {
    if (!storageReady || !selectedCompany) return;
    const empresaAtual = clienteEspecifico || selectedCompany;
    const cnpj = getCnpj(empresaAtual);
    if (!cnpj) return;

    try {
      // Usar o ID do cliente específico se disponível, senão usar o ID do localStorage
      const clientesId = clienteEspecifico?.id || clienteIdFromLocalStorage || undefined;

      // Buscar folhas anteriores
      const folhasAnterioresResponse = await auditoriaApi.getFolhasAnteriores({
        clientes_id: clientesId,
        ano: anoSelecionado,
      });

      if (folhasAnterioresResponse.error) {
        // 404 é normal se o cliente não tem folhas anteriores
        if (folhasAnterioresResponse.status === 404 || folhasAnterioresResponse.error?.includes('não encontrado')) {
          console.log('[Folhas Anteriores] Cliente não possui folhas anteriores para o período selecionado');
          setFolhasAnteriores([]);
          return;
        }
        console.error('[Folhas Anteriores] Erro ao carregar:', folhasAnterioresResponse.error);
        setFolhasAnteriores([]);
        return;
      }

      const folhasAnterioresData = folhasAnterioresResponse.data;
      if (folhasAnterioresData && folhasAnterioresData.data) {
        setFolhasAnteriores(folhasAnterioresData.data);
      } else {
        setFolhasAnteriores([]);
      }

      // Buscar folhas anteriores agrupadas por mês
      const folhasPorMesResponse = await auditoriaApi.getFolhasAnterioresPorMes({
        clientes_id: clientesId,
        ano: anoSelecionado,
        company_id: selectedCompany?.id,
      });

      if (folhasPorMesResponse.error) {
        console.error('[Folhas Anteriores Por Mes] Erro ao carregar:', folhasPorMesResponse.error);
        setFolhasAnterioresPorMes([]);
        return;
      }

      const folhasPorMesData = folhasPorMesResponse.data;
      if (folhasPorMesData && folhasPorMesData.data) {
        setFolhasAnterioresPorMes(folhasPorMesData.data);
      } else {
        setFolhasAnterioresPorMes([]);
      }

      console.log('[Folhas Anteriores] Dados carregados:', {
        folhasAnteriores: folhasAnterioresData?.data?.length || 0,
        folhasPorMes: folhasPorMesData?.data?.length || 0
      });

    } catch (e) {
      console.error('[Folhas Anteriores] Erro ao carregar:', e);
      setFolhasAnteriores([]);
      setFolhasAnterioresPorMes([]);
    }
  };

  // NOVA FUNÇÃO: Carregar dados de DAS mensais

  const carregarDasMensais = async () => {
    console.log("🔍 [DAS] Iniciando carregamento de DAS...");

    if (!storageReady || !selectedCompany) {
      console.log("🔍 [DAS] selectedCompany não encontrado");
      return;
    }

    // Usar CNPJ do cliente específico se disponível, senão usar da empresa selecionada
    const empresaAtual = clienteEspecifico || selectedCompany;
    const cnpj = getCnpj(empresaAtual);

    console.log("🔍 [DAS] CNPJ para busca:", cnpj);

    if (!cnpj) {
      console.error("🔍 [DAS] CNPJ não encontrado");
      return;
    }

    try {
      // Usar o ID do cliente específico se disponível, senão usar o ID do localStorage
      const clientesId = clienteEspecifico?.id || clienteIdFromLocalStorage || undefined;
      
      // Usar a nova rota de DAS mensais
      const dasResponse = await auditoriaApi.getDasMensais({
        clientes_id: clientesId,
        ano: anoSelecionado,
      });

      if (dasResponse.error) {
        // 404 é normal se o cliente não tem DAS
        if (dasResponse.status === 404 || dasResponse.error?.includes('não encontrado')) {
          console.log("Cliente não possui DAS para o período selecionado");
          setTemDas(false);
          setDasMensais([]);
          return;
        }
        console.error("Erro ao carregar DAS mensais:", dasResponse.error);
        setTemDas(false);
        setDasMensais([]);
        return;
      }

      const dasData = dasResponse.data;

      if (dasData && dasData.tem_das) {
        setTemDas(true);
        setDasMensais(dasData.data || []);
        console.log("✅ [DAS] DAS mensais carregados:", dasData.data);
      } else {
        console.log("⚠️ [DAS] Nenhum DAS encontrado");
        setTemDas(false);
        setDasMensais([]);
      }
    } catch (error) {
      console.error("Erro ao carregar DAS mensais:", error);
      setTemDas(false);
      setDasMensais([]);
    }
  };

  // NOVA FUNÇÃO: Carregar comparação de anexos

  const carregarComparacaoAnexos = useCallback(async () => {
    if (!storageReady || !selectedCompany) {
      console.log("❌ selectedCompany não encontrado");
      return;
    }

    console.log("🔍 selectedCompany:", selectedCompany);
    console.log("🔍 clienteEspecifico:", clienteEspecifico);
    
    // Usar clienteEspecifico se disponível, senão usar selectedCompany
    const empresaAtual = clienteEspecifico || selectedCompany;
    console.log("🔍 empresaAtual:", empresaAtual);
    
    const cnpj = getCnpj(empresaAtual);
    
    if (!cnpj) {
      console.log("❌ CNPJ não encontrado");
      return;
    }
    
    console.log("🔍 Carregando comparação de anexos para CNPJ:", cnpj);

    try {
      // Buscar dados da empresa para obter CNAEs

      const cleanCnpj = cnpj.replace(/\D/g, "");
      const empresaResponse = await auditoriaApi.getClienteByCnpj(
        cleanCnpj,
        "simples_nacional",
        selectedCompany?.id
      );

      let empresa = null;

      if (
        empresaResponse.error ||
        !empresaResponse.data ||
        !Array.isArray(empresaResponse.data) ||
        empresaResponse.data.length === 0
      ) {
        // 400/404 são normais se o cliente não foi encontrado ou CNPJ inválido
        if (empresaResponse.status === 400 || empresaResponse.status === 404 || 
            empresaResponse.error?.includes('não encontrado') || 
            empresaResponse.error?.includes('CNPJ inválido')) {
          console.log("Cliente não encontrado por CNPJ, continuando sem CNAEs...");
        } else {
          console.error("Erro ao buscar empresa:", empresaResponse.error);
        }
      } else {
        empresa = empresaResponse.data[0];
      }

      // Processar CNAEs da empresa

      let cnaes = [];

      // Se temos um clienteIdFromLocalStorage, buscar CNAEs da API
      if (clienteIdFromLocalStorage) {
        try {
          const cnaesResponse = await auditoriaApi.getCnaes({
            clientes_id: clienteIdFromLocalStorage,
            company_id: selectedCompany?.id,
          });

          if (cnaesResponse.error) {
            console.error("Erro ao buscar CNAEs:", cnaesResponse.error);
          } else {
            const cnaesData = cnaesResponse.data?.data || [];
            
            console.log("🔍 CNAEs encontrados:", cnaesData.length);

            // Converter formato da API para o formato esperado pelo componente
            const cnaesFormatados = cnaesData.map((cnae) => {
              const cnaeFormatado = {
                codigo: cnae.cnae,
                descricao: cnae.descricao,
                principal: false, // Será determinado depois
                anexo: cnae.anexo,
                fator_r: cnae.fator_r,
                aliquota: cnae.aliquota,
              };

              return cnaeFormatado;
            });

            // Determinar qual é o CNAE principal (primeiro da lista ou baseado em alguma lógica)
            if (cnaesFormatados.length > 0) {
              // Por enquanto, considerar o primeiro como principal
              cnaesFormatados[0].principal = true;
            }

            // ATUALIZAR A VARIÁVEL cnaes
            cnaes = cnaesFormatados;
            
            console.log("🔍 CNAEs formatados:", cnaes.length);
          }
        } catch (error) {
          console.error("Erro ao buscar CNAEs da API:", error);
        }
      } else if (empresa && empresa.cnaes) {
        // Fallback para o método antigo se não tiver cliente específico
        try {
          cnaes = JSON.parse(empresa.cnaes);
        } catch (error) {
          console.error("Erro ao processar CNAEs:", error);
        }
      }

      // Buscar análises do Simples Nacional do ano selecionado

      const analiseParamsBase =
        clienteEspecifico?.id || clienteIdFromLocalStorage
          ? { clientes_id: clienteEspecifico?.id || clienteIdFromLocalStorage }
          : { cnpj: cleanCnpj };
      const todasAnalisesResponse =
        await auditoriaApi.getAnalisesSimplesNacional({
          ...analiseParamsBase,
          company_id: selectedCompany?.id,
        });

      let todasAnalises = null;

      if (todasAnalisesResponse.error) {
        console.error(
          "Erro ao buscar todas as análises:",
          todasAnalisesResponse.error
        );
      } else {
        todasAnalises = Array.isArray(todasAnalisesResponse.data)
          ? todasAnalisesResponse.data
          : [];
      }

      // Buscar análises do ano selecionado
      console.log("🔍 Buscando análises para CNPJ:", cnpj, "Ano:", anoSelecionado);

      const analisesResponse = await auditoriaApi.getAnalisesSimplesNacional({
        ...analiseParamsBase,
        ano: anoSelecionado,
        company_id: selectedCompany?.id,
      });

      if (analisesResponse.error) {
        console.error("Erro ao buscar análises:", analisesResponse.error);

        return;
      }

      console.log("🔍 Resposta da API de análises:", analisesResponse);

      // Verificar se a resposta tem a estrutura correta
      let analises = [];
      if (analisesResponse.data) {
        if (Array.isArray(analisesResponse.data)) {
          analises = analisesResponse.data;
        } else if (analisesResponse.data.data && Array.isArray(analisesResponse.data.data)) {
          analises = analisesResponse.data.data;
        }
      }
        
      console.log("🔍 Análises encontradas:", analises.length);
      console.log("🔍 Estrutura das análises:", analises);

      // Se não encontrou análises pelo ano, tentar buscar por período

      let analisesFinais = analises;

      if (!analises || analises.length === 0) {
        // Para buscar por período, vamos usar todas as análises e filtrar

        if (todasAnalises && todasAnalises.length > 0) {
          const analisesPorPeriodo = todasAnalises.filter(
            (a) =>
              a.periodo_documento &&
              a.periodo_documento.includes(`/${anoSelecionado}`)
          );

          if (analisesPorPeriodo && analisesPorPeriodo.length > 0) {
            analisesFinais = analisesPorPeriodo;
          }
        }
      }

      // Se ainda não encontrou, usar todas as análises disponíveis para este CNPJ

      if (!analisesFinais || analisesFinais.length === 0) {
        console.log("🔍 Usando todas as análises disponíveis");

        if (todasAnalises && todasAnalises.length > 0) {
          analisesFinais = todasAnalises.map((analise) => ({
            anexos_simples: analise.anexos_simples,

            periodo_documento: analise.periodo_documento,

            mes: analise.mes,

            ano: analise.ano,

            fator_r_status: analise.fator_r_status,
          }));

          console.log("🔍 Análises finais:", analisesFinais.length);
        }
      }



      const comparacoes = [];

      const nomesMeses = [
        "janeiro",
        "fevereiro",
        "março",
        "abril",
        "maio",
        "junho",

        "julho",
        "agosto",
        "setembro",
        "outubro",
        "novembro",
        "dezembro",
      ];

      // Processar cada análise



      analisesFinais?.forEach((analise) => {


        const anexoExtrato = analise.anexos_simples || "Não identificado";

        const mes = analise.mes || 1;

        const ano = analise.ano || anoSelecionado;

        const fatorR = analise.fator_r_status || null;



        // Verificar se o mês é válido

        if (!mes || mes < 1 || mes > 12) {
          console.warn(`Mês inválido encontrado: ${mes}, pulando análise`);

          return;
        }

        // Determinar anexo baseado no CNAE da empresa

        let anexoCnae = "Não identificado";

        let anexoConsiderandoFatorR = "Não identificado";

        if (cnaes.length > 0) {
          // Buscar CNAE principal

          const cnaePrincipal =
            cnaes.find((cnae) => cnae.principal) || cnaes[0];

          const codigoCnae = cnaePrincipal.codigo;



          // Converter codigoCnae para string para usar startsWith()

          const codigoCnaeStr = String(codigoCnae);



          // Verificar se codigoCnae é válido

          if (codigoCnaeStr && codigoCnaeStr.length > 0) {
            // Mapear CNAE para anexo baseado nas regras do Simples Nacional

            if (
              codigoCnaeStr.startsWith("47") ||
              codigoCnaeStr.startsWith("45") ||
              codigoCnaeStr.startsWith("46") ||
              codigoCnaeStr.startsWith("56") ||
              codigoCnaeStr.startsWith("52") ||
              codigoCnaeStr.startsWith("53") ||
              codigoCnaeStr.startsWith("55") ||
              codigoCnaeStr.startsWith("58") ||
              codigoCnaeStr.startsWith("59") ||
              codigoCnaeStr.startsWith("60") ||
              codigoCnaeStr.startsWith("61") ||
              codigoCnaeStr.startsWith("62") ||
              codigoCnaeStr.startsWith("63") ||
              codigoCnaeStr.startsWith("64") ||
              codigoCnaeStr.startsWith("65")
            ) {
              anexoCnae = "Anexo I - Comércio";

              anexoConsiderandoFatorR = "Anexo I - Comércio";
            } else if (
              codigoCnaeStr.startsWith("10") ||
              codigoCnaeStr.startsWith("11") ||
              codigoCnaeStr.startsWith("13") ||
              codigoCnaeStr.startsWith("14") ||
              codigoCnaeStr.startsWith("15") ||
              codigoCnaeStr.startsWith("16") ||
              codigoCnaeStr.startsWith("17") ||
              codigoCnaeStr.startsWith("20") ||
              codigoCnaeStr.startsWith("22") ||
              codigoCnaeStr.startsWith("23") ||
              codigoCnaeStr.startsWith("24") ||
              codigoCnaeStr.startsWith("25") ||
              codigoCnaeStr.startsWith("26") ||
              codigoCnaeStr.startsWith("27") ||
              codigoCnaeStr.startsWith("28") ||
              codigoCnaeStr.startsWith("29") ||
              codigoCnaeStr.startsWith("30") ||
              codigoCnaeStr.startsWith("31") ||
              codigoCnaeStr.startsWith("32") ||
              codigoCnaeStr.startsWith("33")
            ) {
              anexoCnae = "Anexo II - Indústria";

              anexoConsiderandoFatorR = "Anexo II - Indústria";
            } else if (
              codigoCnaeStr.startsWith("66") ||
              codigoCnaeStr.startsWith("69") ||
              codigoCnaeStr.startsWith("70") ||
              codigoCnaeStr.startsWith("71") ||
              codigoCnaeStr.startsWith("72") ||
              codigoCnaeStr.startsWith("73") ||
              codigoCnaeStr.startsWith("74") ||
              codigoCnaeStr.startsWith("78") ||
              codigoCnaeStr.startsWith("79") ||
              codigoCnaeStr.startsWith("80") ||
              codigoCnaeStr.startsWith("81") ||
              codigoCnaeStr.startsWith("82") ||
              codigoCnaeStr.startsWith("85") ||
              codigoCnaeStr.startsWith("86") ||
              codigoCnaeStr.startsWith("87") ||
              codigoCnaeStr.startsWith("90") ||
              codigoCnaeStr.startsWith("91") ||
              codigoCnaeStr.startsWith("92") ||
              codigoCnaeStr.startsWith("93") ||
              codigoCnaeStr.startsWith("94") ||
              codigoCnaeStr.startsWith("95") ||
              codigoCnaeStr.startsWith("96")
            ) {
              anexoCnae = "Anexo III - Serviços";

              anexoConsiderandoFatorR = "Anexo III - Serviços";
            } else if (
              codigoCnaeStr.startsWith("41") ||
              codigoCnaeStr.startsWith("42") ||
              codigoCnaeStr.startsWith("43")
            ) {
              anexoCnae = "Anexo IV - Construção";

              anexoConsiderandoFatorR = "Anexo IV - Construção";
            } else if (codigoCnaeStr.startsWith("68")) {
              anexoCnae = "Anexo V - Serviços";

              // NOVA LÓGICA: Considerar fator R para CNAEs 68

              if (
                fatorR &&
                fatorR !== "Não se aplica" &&
                fatorR !== "Não identificado"
              ) {
                // Converter fator R para número

                const fatorRNumero = parseFloat(
                  fatorR.toString().replace(",", ".").replace("%", "")
                );

                console.log(`Fator R detectado: ${fatorR} (${fatorRNumero}%)`);

                // Se fator R < 0,28%, empresa pode estar no Anexo III

                if (!isNaN(fatorRNumero) && fatorRNumero < 0.28) {
                  console.log(
                    `Fator R ${fatorRNumero}% < 0,28% - empresa pode estar no Anexo III`
                  );

                  anexoConsiderandoFatorR =
                    "Anexo III - Serviços (Fator R < 0,28%)";
                } else {
                  anexoConsiderandoFatorR = "Anexo V - Serviços";
                }
              } else {
                anexoConsiderandoFatorR = "Anexo V - Serviços";
              }
            } else {
              anexoCnae = "Não identificado";

              anexoConsiderandoFatorR = "Não identificado";
            }

            console.log(`CNAE ${codigoCnaeStr} mapeado para: ${anexoCnae}`);

            console.log(`Considerando fator R: ${anexoConsiderandoFatorR}`);
          } else {
            console.warn("Código CNAE inválido ou vazio:", codigoCnae);

            anexoCnae = "CNAE inválido";

            anexoConsiderandoFatorR = "CNAE inválido";
          }
        }

        // Determinar se há diferença - comparação mais inteligente

        let status = "incorreto";

        // Normalizar os anexos para comparação

        const anexoExtratoNormalizado = anexoExtrato
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");

        const anexoCnaeNormalizado = anexoCnae
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");

        const anexoConsiderandoFatorRNormalizado = anexoConsiderandoFatorR
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");

        // Verificar se são equivalentes - PRIMEIRO comparar com anexo baseado no CNAE

        if (anexoExtrato === anexoCnae) {
          status = "correto";
        } else if (anexoExtratoNormalizado === anexoCnaeNormalizado) {
          status = "correto";
        } else if (
          anexoCnae.includes(anexoExtrato) ||
          anexoExtrato.includes(anexoCnae)
        ) {
          status = "correto";
        } else if (
          (anexoExtrato.includes("III") && anexoCnae.includes("III")) ||
          (anexoExtrato.includes("II") && anexoCnae.includes("II")) ||
          (anexoExtrato.includes("I") && anexoCnae.includes("I")) ||
          (anexoExtrato.includes("IV") && anexoCnae.includes("IV")) ||
          (anexoExtrato.includes("V") && anexoCnae.includes("V"))
        ) {
          status = "correto";
        }

        // SE ainda estiver incorreto, verificar se é devido ao fator R

        if (status === "incorreto" && anexoConsiderandoFatorR !== anexoCnae) {
          // Comparar com anexo considerando fator R

          if (anexoExtrato === anexoConsiderandoFatorR) {
            status = "correto";
          } else if (
            anexoExtratoNormalizado === anexoConsiderandoFatorRNormalizado
          ) {
            status = "correto";
          } else if (
            anexoConsiderandoFatorR.includes(anexoExtrato) ||
            anexoExtrato.includes(anexoConsiderandoFatorR)
          ) {
            status = "correto";
          } else if (
            (anexoExtrato.includes("III") &&
              anexoConsiderandoFatorR.includes("III")) ||
            (anexoExtrato.includes("II") &&
              anexoConsiderandoFatorR.includes("II")) ||
            (anexoExtrato.includes("I") &&
              anexoConsiderandoFatorR.includes("I")) ||
            (anexoExtrato.includes("IV") &&
              anexoConsiderandoFatorR.includes("IV")) ||
            (anexoExtrato.includes("V") &&
              anexoConsiderandoFatorR.includes("V"))
          ) {
            status = "correto";
          }
        }

        console.log(
          `Comparação: "${anexoExtrato}" vs "${anexoCnae}" (sem fator R) vs "${anexoConsiderandoFatorR}" (com fator R) = ${status}`
        );

        // Gerar recomendação

        let recomendacao = "";

        if (status === "incorreto") {
          if (anexoExtrato === "Não identificado") {
            recomendacao = `Verificar se a atividade está correta no extrato. Baseado no CNAE "${anexoCnae}", o anexo deveria ser ${anexoCnae}.`;

            if (anexoConsiderandoFatorR !== anexoCnae) {
              recomendacao += ` Considerando o fator R (${fatorR}), o anexo poderia ser ${anexoConsiderandoFatorR}.`;
            }
          } else if (anexoCnae === "Não identificado") {
            recomendacao = `Verificar se o CNAE está correto. Baseado no anexo do extrato "${anexoExtrato}", verificar se o CNAE está adequado.`;
          } else {
            recomendacao = `Verificar se a atividade "${anexoExtrato}" está correta no extrato. Baseado no CNAE "${anexoCnae}", o anexo deveria ser ${anexoCnae}.`;

            if (anexoConsiderandoFatorR !== anexoCnae) {
              recomendacao += ` Considerando o fator R (${fatorR}), o anexo poderia ser ${anexoConsiderandoFatorR}.`;
            }
          }
        } else {
          if (anexoConsiderandoFatorR !== anexoCnae) {
            recomendacao = `Anexo correto. O fator R (${fatorR}) justifica o enquadramento em anexo diferente do padrão do CNAE.`;
          } else {
            recomendacao = "Anexo correto conforme CNAE da empresa.";
          }
        }

        comparacoes.push({
          mes: nomesMeses[mes - 1],

          ano,

          anexoExtrato,

          anexoCnae:
            anexoConsiderandoFatorR !== anexoCnae
              ? `${anexoCnae} (Fator R: ${fatorR} → ${anexoConsiderandoFatorR})`
              : anexoCnae,

          diferenca: `Extrato: ${anexoExtrato} | CNAE: ${anexoCnae} | Fator R: ${fatorR}`,

          recomendacao,

          status,
        });
        
        console.log("🔍 Comparação criada para", nomesMeses[mes - 1], ano, "Status:", status);
              });

        console.log("🔍 Total de comparações criadas:", comparacoes.length);

      } catch (error) {
        console.error("Erro ao carregar comparação de anexos:", error);
      }
  }, [selectedCompany, clienteEspecifico, clienteIdFromLocalStorage, anoSelecionado, storageReady]);

  // useEffect para carregar CNAEs quando há clienteIdFromLocalStorage
  useEffect(() => {
    if (clienteIdFromLocalStorage && clienteEspecifico && anoSelecionado) {
      carregarComparacaoAnexos();
    }
  }, [clienteIdFromLocalStorage, clienteEspecifico, anoSelecionado, carregarComparacaoAnexos]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    console.log("🔍 [COMPONENTES] useEffect executando...");
    console.log("🔍 [COMPONENTES] selectedCompany:", selectedCompany);
    console.log("🔍 [COMPONENTES] clienteIdFromLocalStorage:", clienteIdFromLocalStorage);
    console.log("🔍 [COMPONENTES] clienteEspecifico:", clienteEspecifico);
    
    // Se temos um cliente específico, aguardar ele carregar primeiro
    if (clienteIdFromLocalStorage && !clienteEspecifico) {
      console.log("🔍 [COMPONENTES] Aguardando cliente específico carregar");
      return; // Aguardar carregarClienteEspecifico
    }
    
    // Verificar se temos uma empresa válida
    const empresaAtual = clienteEspecifico || selectedCompany;
    
    if (!empresaAtual) {
      console.log("🔍 [COMPONENTES] Nenhuma empresa encontrada");
      return;
    }
    
    // Verificar se é Simples Nacional
    const isSimplesNacional = 
      empresaAtual.tipo_empresa === "simples_nacional" ||
      empresaAtual.regime_tributario === "simples_nacional";
    
    console.log("🔍 [COMPONENTES] É Simples Nacional:", isSimplesNacional);
    
    if (!isSimplesNacional) {
      console.log("🔍 [COMPONENTES] Não é Simples Nacional, retornando");
      return;
    }

    console.log("🔍 [COMPONENTES] Carregando dados para componentes...");
    carregarComparacaoAnexos();
    carregarFolhasMensais();
    carregarDasMensais();

    // eslint-disable-next-line
  }, [selectedCompany, anoSelecionado, clienteEspecifico, storageReady]);

  const handleExport = async (format) => {
    try {
      let content;

      const referenciaEmpresa = clienteEspecifico || selectedCompany;
      const fileName = `consolidado-simples-${
        (getNome(referenciaEmpresa) || "empresa").replace(/\s+/g, "-")
      }-${anoSelecionado}.${format}`;

      if (format === "csv") {
        content = generateCSV();

        const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });

        const link = document.createElement("a");

        link.href = URL.createObjectURL(blob);

        link.download = fileName;

        link.click();
      } else if (format === "pdf") {
        if (typeof window === "undefined") {
          return;
        }

        const element = document.getElementById("pdf-content");

        if (element) {
          element.classList.add("pdf-export-content");

          const html2pdf = await loadHtml2Pdf();

          html2pdf()
            .set({
              margin: 1,
              filename: fileName,
              image: { type: "jpeg", quality: 0.98 },
              html2canvas: { scale: 2 },
              jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
            })
            .from(element)
            .save()
            .finally(() => {
              element.classList.remove("pdf-export-content");
            });
        }
      }
    } catch (error) {
      console.error("Error exporting data:", error);

      alert("Erro ao exportar dados");
    }
  };

  const generateCSV = () => {
    const headers = ["Tipo", "Valor (R$)"];

    const rows = [headers.join(",")];

    // Dados dos cards

    rows.push(
      `Faturamento Extrato,${(faturamentoExtrato || 0).toFixed(2)}`,

      `Faturamento Notas,${(faturamentoNotas || 0).toFixed(2)}`,

      `Valores Guias DAS,${(valoresGuiasDas || 0).toFixed(2)}`
    );

    // Dados mensais

    rows.push(""); // Linha em branco

    rows.push("Dados Mensais");

    rows.push("Mês,Faturamento,Guias DAS,Faturamento Notas");

    dadosMensais.forEach((item) => {
      rows.push(
        `${item.name},${item.Faturamento.toFixed(2)},${item[
          "Guias DAS"
        ].toFixed(2)},${item["Faturamento Notas"].toFixed(2)}`
      );
    });

    // Dados de NCMs

    if (ncmResumoMes.length > 0) {
      rows.push(""); // Linha em branco

      rows.push("NCMs do Mês Selecionado");

      rows.push(
        "NCM,Quantidade,Valor Total,ICMS (R$),ICMS (%),PIS (R$),PIS (%),COFINS (R$),COFINS (%)"
      );

      ncmResumoMes.forEach((item) => {
        rows.push(
          `${item.ncm},${item.totalQuantidade.toFixed(
            2
          )},${item.totalValor.toFixed(2)},${item.totalIcms.toFixed(2)},${
            item.icmsPercentage
          }%,${item.totalPis.toFixed(2)},${
            item.pisPercentage
          }%,${item.totalCofins.toFixed(2)},${item.cofinsPercentage}%`
        );
      });
    }

    // Dados de pulos detectados

    if (pulosDetectados.length > 0) {
      rows.push(""); // Linha em branco

      rows.push("Pulos Detectados nas Notas Fiscais");

      rows.push(
        "CNPJ,Série,Mês/Ano Esperado,Total Notas Puladas,Números das Notas Puladas"
      );

      pulosDetectados.forEach((pulo) => {
        rows.push(
          `${formatCNPJ(pulo.cnpj)},${pulo.serie},${pulo.mesEsperado} de ${
            pulo.anoEsperado
          },${pulo.notasPuladas.length},${pulo.notasPuladas.join("; ")}`
        );
      });
    }

    // Dados de ISS retido por mês

    if (temIssRetido && issRetidoMensal.length > 0) {
      rows.push(""); // Linha em branco

      rows.push("ISS Retido por Mês");

      rows.push("Mês,Ano,Valor ISS Retido (R$),Quantidade de Notas");

      issRetidoMensal.forEach((item) => {
        rows.push(
          `${item.mes},${item.ano},${item.valor_iss_retido.toFixed(2)},${
            item.quantidade_notas
          }`
        );
      });

      // Adicionar total

      const totalValor = issRetidoMensal.reduce(
        (sum, item) => sum + item.valor_iss_retido,
        0
      );

      const totalNotas = issRetidoMensal.reduce(
        (sum, item) => sum + item.quantidade_notas,
        0
      );

      rows.push(`TOTAL,,${totalValor.toFixed(2)},${totalNotas}`);
    }

    // Dados de folhas de salários por mês

    if (temFolhas && folhasMensais.length > 0) {
      rows.push(""); // Linha em branco

      rows.push("Folhas de Salários por Mês");

      rows.push("Mês,Valor Folha de Salários (R$)");

      folhasMensais.forEach((item) => {
        rows.push(`${item.mes},${item.valor.toFixed(2)}`);
      });

      // Adicionar total

      const totalFolhas = folhasMensais.reduce(
        (sum, item) => sum + Number(item.valor),
        0
      );

      rows.push(`TOTAL,${totalFolhas.toFixed(2)}`);
    }

    // Dados de DAS por mês

    if (temDas && dasMensais.length > 0) {
      rows.push(""); // Linha em branco

      rows.push("DAS por Mês");

      rows.push("Mês,Ano,Status,Valor DAS (R$),Data de Pagamento");

      dasMensais.forEach((item) => {
        const status =
          item.status === "pago"
            ? "Pago"
            : item.status === "a_pagar"
            ? "A pagar"
            : "Importação pendente";

        const dataPagamento = item.data_pagamento || "";

        const valorDAS = item.valor_das
          ? `R$ ${item.valor_das.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            })}`
          : "-";

        rows.push(
          `${item.mes},${item.ano},${status},${valorDAS},${dataPagamento}`
        );
      });
    }

    // Dados de comparação de anexos - Removido pois agora é gerenciado pelo componente

    return rows.join("\n");
  };

  // Função auxiliar para obter CNPJ da empresa/cliente
  const getCnpj = (empresa) => {
    if (!empresa) return "";
    
    // Tentar diferentes propriedades onde o CNPJ pode estar (backend pode retornar diferentes formatos)
    const cnpj = empresa.cnpj || empresa.cpf_cnpj || empresa.cnpj_exibicao || "";
    const cnpjLimpo = cnpj.replace(/\D/g, "");
    
    // Validar se o CNPJ tem tamanho válido (14 dígitos)
    if (cnpjLimpo.length !== 14 && cnpjLimpo.length !== 11) {
      console.warn("🔍 CNPJ/CPF inválido ou incompleto:", cnpj, "Limpo:", cnpjLimpo);
      return "";
    }
    
    return cnpjLimpo;
  };

  // Função auxiliar para obter nome da empresa/cliente
  const getNome = (empresa) => {
    if (!empresa) return "";
    // Backend pode retornar 'nome' ou 'razao_social'
    return empresa.nome || empresa.name || empresa.razao_social || "";
  };

  return (
    <div className={styles.layoutWrapper}>
      <PrincipalSidebar />
      <div className={styles.pageContent}>
        <div className={styles.page}>
          <div
            className={`${styles.container} ${styles.pdfContent}`}
            id="pdf-content"
          >
            {/* Header com seletor de ano e botões de export */}
            <ConsolidadoHeader
              selectedCompany={clienteEspecifico || selectedCompany}
              anoSelecionado={anoSelecionado}
              onAnoChange={setAnoSelecionado}
              onExportPDF={() => handleExport("pdf")}
              onExportCSV={() => handleExport("csv")}
            />

            {/* Cards de faturamento */}
            <FaturamentoCards
              loading={loading}
              faturamentoExtrato={faturamentoExtrato}
              faturamentoNotas={faturamentoNotas}
              valoresGuiasDas={valoresGuiasDas}
            />

            {/* Gráfico comparativo */}
            <GraficoComparativo loading={loading} dadosMensais={dadosMensais} />

            {/* Comparação de anexos */}
            <ComparacaoAnexos
              selectedCompany={clienteEspecifico || selectedCompany}
              anoSelecionado={anoSelecionado}
            />

            {/* Pulos detectados */}
            <PulosDetectados
              pulosDetectados={pulosDetectados}
              mostrarPulosDetectados={mostrarPulosDetectados}
              onTogglePulosDetectados={() =>
                setMostrarPulosDetectados(!mostrarPulosDetectados)
              }
            />

            {/* ISS Retido */}
            <TabelaIssRetido
              temIssRetido={temIssRetido}
              issRetidoMensal={issRetidoMensal}
            />

            {/* Folhas de salários */}
            <TabelaFolhas
              temFolhas={temFolhas}
              folhasMensais={folhasMensais}
              mostrarFolhas={mostrarFolhas}
              onToggleFolhas={() => setMostrarFolhas(!mostrarFolhas)}
              folhasAnteriores={folhasAnteriores}
              folhasAnterioresPorMes={folhasAnterioresPorMes}
              mostrarFolhasAnteriores={mostrarFolhasAnteriores}
              onToggleFolhasAnteriores={() =>
                setMostrarFolhasAnteriores(!mostrarFolhasAnteriores)
              }
            />

            {/* DAS mensais */}
            <TabelaDas
              temDas={temDas}
              dasMensais={dasMensais}
              mostrarDas={mostrarDas}
              onToggleDas={() => setMostrarDas(!mostrarDas)}
            />

            {/* Tabela de NCMs */}
            <TabelaNcms
              clientes_id={clienteIdFromLocalStorage || ""}
              anoSelecionado={anoSelecionado}
              mesSelecionado={mesSelecionado}
              onMesChange={setMesSelecionado}
              mostrarTabelaNcms={mostrarTabelaNcms}
              onToggleTabelaNcms={() =>
                setMostrarTabelaNcms(!mostrarTabelaNcms)
              }
              ncmResumoMes={ncmResumoMes}
              carregandoST={carregandoST}
              informacoesST={informacoesST}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

