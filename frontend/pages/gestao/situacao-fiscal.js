"use client";

import { useEffect, useState, useMemo } from "react";
import { FaDownload } from "react-icons/fa";
import ClienteSelecaoModal from "@/components/gestao/ClienteSelectModal";
import { useAuthRedirect } from "@/utils/auth";
import PrincipalSidebar from "@/components/onety/principal/PrincipalSidebar";
import styles from "../../styles/gestao/Clientes.module.css";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Cliente HTTP simples (compatível com uso básico neste arquivo)
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const api = {
  get: async (url, config = {}) => {
    const params = config.params ? `?${new URLSearchParams(config.params).toString()}` : "";
    const res = await fetch(`${API_BASE}${url}${params}`, {
      method: "GET",
      headers: config.headers || {}
    });
    return { data: await res.json(), status: res.status };
  },
  post: async (url, body, config = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(config.headers || {}) };
    const res = await fetch(`${API_BASE}${url}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    return { data: await res.json(), status: res.status };
  }
};

// Helper para obter empresaId do localStorage.userData (fallback: sessionStorage)
const getEmpresaId = () => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('userData') : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.EmpresaId) return String(parsed.EmpresaId);
    }
  } catch {}
  if (typeof window !== 'undefined') {
    const ss = sessionStorage.getItem('empresaId');
    if (ss) return String(ss);
  }
  return '';
};

// Helper para auth headers
const getAuthHeaders = () => {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function SituacaoFiscalFederal() {
  useAuthRedirect();
  const [registros, setRegistros] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroData, setFiltroData] = useState("Mês atual");
  const [clientes, setClientes] = useState([]);
  const [clientesSelecionados, setClientesSelecionados] = useState([]);
  const [isConsultando, setIsConsultando] = useState(false);
  const [isModalAberto, setIsModalAberto] = useState(false);
  const [filtroPendencia, setFiltroPendencia] = useState("");
  const [pesquisa, setPesquisa] = useState("");
  // Debounce da pesquisa para atualizar conforme digitação sem travar a UI
  const useDebounce = (value, delay) => {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
      const id = setTimeout(() => setDebounced(value), delay);
      return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
  };
  const pesquisaDebounced = useDebounce(pesquisa, 200);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [limitePorPagina, setLimitePorPagina] = useState(25);

  const normalize = (s) =>
    (s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const statusMap = {
    regular: "Regular",
    regularizado: "Regularizado",
    irregular: "Irregular",
  };

  const normalizeBase64 = (b64) => {
    if (!b64 || typeof b64 !== 'string') return '';
    const i = b64.indexOf('base64,');
    if (i !== -1) b64 = b64.slice(i + 7);
    b64 = b64.replace(/\s+/g, '');
    const pad = (4 - (b64.length % 4)) % 4;
    if (pad) b64 += '='.repeat(pad);
    return b64;
  };

  const downloadPDF = (base64, nome) => {
    try {
      if (!base64) {
        toast.error("Arquivo PDF não disponível para download.");
        return;
      }

      const safe = normalizeBase64(base64);

      // Preferir Data URL direto para evitar inconsistências de decodificação
      const dataUrl = `data:application/pdf;base64,${safe}`;
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${nome || 'documento'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Download iniciado: ${nome || 'documento'}.pdf`);
    } catch (error) {
      console.error("Erro ao fazer download:", error);
      toast.error("PDF inválido ou corrompido.");
    }
  };

  const toggleSelecionado = (id) => {
    setClientesSelecionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const consultarCarteiraInteira = async () => {
    setIsConsultando(true);
    const empresaId = getEmpresaId();
    if (!empresaId) {
      toast.error("Empresa não identificada. Faça login novamente.");
      return;
    }
    try {
      const response = await api.post(`/gestao/sitfis/${empresaId}`, {}, { headers: getAuthHeaders() });
      
      console.log("🔍 [DEBUG] Resposta carteira inteira:", response);
      console.log("🔍 [DEBUG] response.status:", response.status);
      console.log("🔍 [DEBUG] response.data:", response.data);
      
      // Verificar se a resposta contém erro mesmo com status 200
      if (response.data && response.data.error) {
        console.log("🔍 [DEBUG] Erro detectado na resposta:", response.data.error);
        throw new Error(response.data.error);
      }
      
      toast.success("Consulta da carteira inteira realizada com sucesso!");
    } catch (error) {
      console.log("🔍 [DEBUG] Erro capturado:", error);
      console.log("🔍 [DEBUG] error.response?.data:", error.response?.data);
      console.log("🔍 [DEBUG] error.response?.status:", error.response?.status);
      
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message;
      console.log("🔍 [DEBUG] errorMessage final:", errorMessage);
      
      if (errorMessage.includes("certificado") || 
          errorMessage.includes("Certificado") || 
          errorMessage.includes("não encontrados") ||
          errorMessage.includes("token do procurador")) {
        toast.error("Certificado não encontrado! Cadastre o seu certificado digital primeiro.");
      } else if (errorMessage.includes("senha") || errorMessage.includes("Senha")) {
        toast.error("Senha do certificado não encontrada! Configure a senha do certificado digital.");
      } else {
        toast.error(`Erro ao consultar carteira inteira: ${errorMessage}`);
      }
    } finally {
      setIsConsultando(false);
    }
  };

  const consultarSelecionados = async () => {
    if (clientesSelecionados.length === 0) {
      toast.warning("Selecione ao menos um cliente para consultar.");
      return;
    }
    setIsConsultando(true);
    const empresaId = getEmpresaId();
    if (!empresaId) {
      toast.error("Empresa não identificada. Faça login novamente.");
      return;
    }
    try {
      const response = await api.post(`/gestao/sitfis/${empresaId}/clientes-selecionados`, {
        clientesSelecionados,
      }, { headers: getAuthHeaders() });
      
      console.log("🔍 [DEBUG] Resposta recebida:", response);
      console.log("🔍 [DEBUG] response.status:", response.status);
      console.log("🔍 [DEBUG] response.data:", response.data);
      
      // Verificar se a resposta contém erro mesmo com status 200
      if (response.data && response.data.error) {
        console.log("🔍 [DEBUG] Erro detectado na resposta:", response.data.error);
        throw new Error(response.data.error);
      }
      
      // ✅ Resumo detalhado para o usuário
      const resultados = Array.isArray(response.data?.resultados) ? response.data.resultados : [];
      const total = resultados.length || clientesSelecionados.length;
      const jaMes = resultados.filter((r) => r?.status === 'ja_consultado_mes' || r?.status === 'já consultado').length;
      const processados = resultados.filter((r) => r?.status === 'processado').length;
      const erros = resultados.filter((r) => r?.status === 'erro').length;
      toast.success(`Consulta finalizada: ${processados} processado(s), ${jaMes} bloqueado(s) já consultado(s) no mês, ${erros} com erro. Total: ${total}.`);
    } catch (error) {
      console.log("🔍 [DEBUG] Erro capturado:", error);
      console.log("🔍 [DEBUG] error.response?.data:", error.response?.data);
      console.log("🔍 [DEBUG] error.response?.status:", error.response?.status);
      
      // 🔎 Mesmo em erro (ex.: 400 certificado), se vier 'resultados', apresentar o resumo parcial
      const resultadosErro = Array.isArray(error.response?.data?.resultados) ? error.response.data.resultados : [];
      if (resultadosErro.length > 0) {
        const total = resultadosErro.length;
        const jaMes = resultadosErro.filter((r) => r?.status === 'ja_consultado_mes' || r?.status === 'já consultado').length;
        const processados = resultadosErro.filter((r) => r?.status === 'processado').length;
        const erros = resultadosErro.filter((r) => r?.status === 'erro').length;
        toast.info(`Parcial: ${processados} processado(s), ${jaMes} bloqueado(s) já consultado(s) no mês, ${erros} com erro. Total: ${total}.`);
      }

      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message;
      console.log("🔍 [DEBUG] errorMessage final:", errorMessage);
      
      if (errorMessage.includes("certificado") || 
          errorMessage.includes("Certificado") || 
          errorMessage.includes("não encontrados") ||
          errorMessage.includes("token do procurador")) {
        toast.error("Certificado não encontrado! Cadastre o seu certificado digital primeiro.");
      } else if (errorMessage.includes("senha") || errorMessage.includes("Senha")) {
        toast.error("Senha do certificado não encontrada! Configure a senha do certificado digital.");
      } else {
        toast.error(`Erro ao consultar clientes: ${errorMessage}`);
      }
    } finally {
      setIsConsultando(false);
      setIsModalAberto(false);
    }
  };

  useEffect(() => {
    const fetchClientes = async () => {
      const empresaId = getEmpresaId();
      if (!empresaId) return;
      try {
        const res = await api.get(`/gestao/clientes`, { params: { empresaId, limit: 9999 }, headers: getAuthHeaders() });
        setClientes(res.data.clientes);
    } catch (error) {
        console.error("Erro ao carregar clientes:", error);
        toast.error("Erro ao carregar lista de clientes. Tente novamente.");
      }
    };
    fetchClientes();
  }, []);

useEffect(() => {
  const empresaId = getEmpresaId();
  if (!empresaId) return;

  const buscarFiltrado = async () => {
    try {
      const res = await api.get(`/gestao/sitfis/detalhado/${empresaId}`, {
        params: { periodo: filtroData },
        headers: getAuthHeaders()
      });
      const payload = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.registros) ? res.data.registros : []);
      setRegistros(payload);
    } catch (err) {
      console.error("Erro ao buscar por filtroData:", err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message;
      if (errorMessage.includes("certificado") || 
          errorMessage.includes("Certificado") || 
          errorMessage.includes("não encontrados") ||
          errorMessage.includes("token do procurador")) {
        toast.error("Certificado não encontrado! Cadastre o seu certificado digital primeiro.");
      } else {
        toast.error(`Erro ao carregar dados: ${errorMessage}`);
      }
    }
  };

  buscarFiltrado(); // ✅ chama sempre, independentemente do valor
}, [filtroData]);



  // Deduplicar por CNPJ: manter apenas o registro mais recente por CNPJ no período carregado
  const registrosUnicos = useMemo(() => {
    const base = Array.isArray(registros) ? registros : [];
    const byCnpj = {};
    for (const r of base) {
      const key = r.cnpj;
      const atual = byCnpj[key];
      if (!atual) {
        byCnpj[key] = r;
      } else {
        const dataAtual = new Date(atual.data_criacao).getTime();
        const dataNovo = new Date(r.data_criacao).getTime();
        if (dataNovo > dataAtual) byCnpj[key] = r;
      }
    }
    return Object.values(byCnpj);
  }, [registros]);

  const filtrados = useMemo(() => {
    return registrosUnicos.filter((r) => {
      const statusNormalizado = normalize(r.status);
      const filtroNormalizado = normalize(filtroStatus);
      const statusOk = !filtroStatus || statusNormalizado === filtroNormalizado;
      const pendenciaOk =
        !filtroPendencia ||
        (r.pendencias?.split(",").map((p) => normalize(p)).includes(normalize(filtroPendencia)) ?? false);
      let pesquisaOk = true;
      if (pesquisaDebounced.trim()) {
        const termo = normalize(pesquisaDebounced);
        const nomeNorm = normalize(r.nome || "");
        const somenteDigitos = (s) => (s || "").replace(/\D/g, "");
        const termoDig = somenteDigitos(pesquisaDebounced);
        const cnpjDig = somenteDigitos(r.cnpj || "");

        // 1) Match direto no nome (substring)
        const nomeOkSub = nomeNorm.includes(termo);

        // 2) Match por termos (todos os termos presentes no nome)
        const termos = termo.split(" ").filter(Boolean);
        const nomeOkTermos = termos.length === 0 ? true : termos.every(t => nomeNorm.includes(t));

        // 3) Match por CNPJ (apenas quando a consulta é numérica e com tamanho mínimo para evitar ruído)
        const isCnpjQuery = /^[0-9.\-\/\s]+$/.test(pesquisaDebounced) && termoDig.length >= 6;
        const cnpjOk = isCnpjQuery && cnpjDig.includes(termoDig);

        pesquisaOk = nomeOkSub || nomeOkTermos || cnpjOk;
      }
      return statusOk && pendenciaOk && pesquisaOk;
    });
  }, [registrosUnicos, filtroStatus, filtroPendencia, pesquisaDebounced]);

  // Paginação
  const totalRegistros = filtrados.length;
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / limitePorPagina));
  const paginaCorrigida = Math.min(paginaAtual, totalPaginas);
  const inicio = (paginaCorrigida - 1) * limitePorPagina;
  const fim = Math.min(inicio + limitePorPagina, totalRegistros);
  const exibidos = filtrados.slice(inicio, fim);

  // Resetar página quando filtros/pesquisa mudarem
  useEffect(() => {
    setPaginaAtual(1);
  }, [filtroStatus, filtroPendencia, pesquisaDebounced, limitePorPagina, registrosUnicos]);

  const resumoFiltrado = useMemo(() => {
    const counts = { Regular: 0, Regularizado: 0, Irregular: 0 };
    filtrados.forEach((r) => {
      const key = statusMap[normalize(r.status)];
      if (key) counts[key]++;
    });
    return counts;
  }, [filtrados]);

  const total = filtrados.length;

  return (
    <>
      <PrincipalSidebar />
      <ToastContainer 
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        limit={3}
        theme="dark"
        toastClassName="titan-base-10"
      />
      <div className="situacao-fiscal">
        <div className="pageWrap">
        <h1 className="titulo">Situação Fiscal Federal</h1>

        <div className="filtro-data">
          <label className="filtro-data-label">
            Data Consulta
          </label>
          <select
            value={filtroData}
            onChange={(e) => setFiltroData(e.target.value)}
            className="filtro-data-select"
          >
            <option>Todos</option>
            <option>Últimos 7 dias</option>
            <option>Mês atual</option>
            <option>Último mês</option>
            <option>Trimestre atual</option>
            <option>Último trimestre</option>
            <option>Ano atual</option>
            <option>Último ano</option>
            <option>Hoje</option>
            <option>Passado</option>
          </select>
        </div>

        {/* Cards */}
        <div className="cards">
          {["Regular", "Regularizado", "Irregular"].map((status) => (
            <div
              key={status}
              className={`card card-${status.toLowerCase()} ${filtroStatus === status ? "ativo" : ""}`}
              onClick={() => {
                setFiltroStatus((prev) => (prev === status ? "" : status));
              }}
            >
              <h3>{status}</h3>
              <p>
                {resumoFiltrado[status]} | {((resumoFiltrado[status] / (total || 1)) * 100).toFixed(0)}%
              </p>
            </div>
          ))}
        </div>

        <div className="filtros">
          {["Débito", "Dívida Ativa", "Divergência GFIP x GPS", "Parcelamento em Atraso", "Omissão de Declaração", "Processo Fiscal", "Arrolamento de Bens"].map((tipo) => (
            <button
              key={tipo}
              onClick={() => setFiltroPendencia(filtroPendencia === tipo ? "" : tipo)}
              className={`filtro ${filtroPendencia === tipo ? "ativo" : ""}`}
            >
              {tipo}
            </button>
          ))}
        </div>

        <div className={styles.buttonsRow}>
          <input
            type="text"
            value={pesquisa}
            onChange={(e) => setPesquisa(e.target.value)}
            placeholder="Pesquisar por CNPJ ou Razão Social..."
            className={styles.filtroInput}
            style={{ width: 320 }}
          />
          <button
            onClick={() => setIsModalAberto(true)}
            disabled={isConsultando}
            className={styles.botaoClientes}
          >
            {isConsultando ? "Consultando clientes..." : "Selecionar Clientes para Consultar"}
          </button>
        </div>

        {/* Tabela */}
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>CNPJ</th>
              <th className={styles.th}>Razão Social</th>
              <th className={styles.th}>Status</th>
              <th className={styles.th}>Pendências</th>
              <th className={styles.th}>Data Consulta</th>
              <th className={styles.th}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {exibidos.length === 0 ? (
              <tr>
                <td className={styles.td} colSpan={6}>Nenhum registro encontrado.</td>
              </tr>
            ) : (
              exibidos.map((r, idx) => (
                <tr key={`${r.cliente_id}-${r.data_criacao}-${idx}`}>
                  <td className={styles.td}>{r.cnpj}</td>
                  <td className={styles.td}>{r.nome}</td>
                  <td className={styles.td}>
                    <span className={`badge ${r.status.toLowerCase()}`}>{r.status}</span>
                  </td>
                  <td className={styles.td}>
                    {normalize(r.pendencias) === normalize("Análise textual não identificou pendência específica.")
                      ? "Sem pendências"
                      : r.pendencias || "Sem pendências"}
                  </td>
                  <td className={styles.td}>{new Date(r.data_criacao).toLocaleString()}</td>
                  <td className={styles.td}>
                    <FaDownload
                      className="download-icon"
                      onClick={() => {
                        if (!r?.binary_file) {
                          toast.warning("PDF não disponível para este registro.");
                          return;
                        }
                        downloadPDF(r.binary_file, r.nome);
                      }}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Paginação */}
        <div className={styles.pagination}>
          <span>
            Mostrando {totalRegistros === 0 ? 0 : inicio + 1}
            {" - "}
            {fim} de {totalRegistros}
          </span>
          <div className={styles.paginationButtons}>
            <select
              value={limitePorPagina}
              onChange={(e) => setLimitePorPagina(Number(e.target.value))}
              className={styles.paginationSelect}
              style={{ marginRight: 16 }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <button
              className={styles.paginationArrow}
              onClick={() => setPaginaAtual(1)}
              disabled={paginaCorrigida === 1}
              aria-label="Primeira página"
            >
              {"<<"}
            </button>
            <button
              className={styles.paginationArrow}
              onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
              disabled={paginaCorrigida === 1}
              aria-label="Página anterior"
            >
              {"<"}
            </button>
            {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
              const start = Math.max(1, Math.min(paginaCorrigida - 2, totalPaginas - 4));
              const page = start + i;
              return (
                <button
                  key={page}
                  onClick={() => setPaginaAtual(page)}
                  className={page === paginaCorrigida ? styles.paginationButtonActive : styles.paginationArrow}
                >
                  {page}
                </button>
              );
            })}
            <button
              className={styles.paginationArrow}
              onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
              disabled={paginaCorrigida === totalPaginas}
              aria-label="Próxima página"
            >
              {">"}
            </button>
            <button
              className={styles.paginationArrow}
              onClick={() => setPaginaAtual(totalPaginas)}
              disabled={paginaCorrigida === totalPaginas}
              aria-label="Última página"
            >
              {">>"}
            </button>
          </div>
        </div>

        <ClienteSelecaoModal
          isOpen={isModalAberto}
          onClose={() => setIsModalAberto(false)}
          clientes={clientes}
          selecionados={clientesSelecionados}
          onToggle={toggleSelecionado}
          onConfirmar={consultarSelecionados}
        />
        </div>
      </div>

      <style jsx>{`
        .situacao-fiscal {
          background: transparent;
          min-height: 100vh;
          font-family: var(--onity-font-family-sans);
          font-size: var(--onity-type-body-size);
          line-height: var(--onity-type-body-line);
          color: var(--onity-color-text);
        }

        .pageWrap {
          max-width: 2000px;
          margin: 0 auto;
          padding: var(--onity-space-l);
        }

        .titulo {
          font-size: var(--onity-type-h2-size);
          font-weight: var(--onity-type-h2-weight);
          margin-bottom: var(--onity-space-l);
          color: var(--onity-color-text);
        }

        .filtro-data {
          margin-bottom: var(--onity-space-l);
        }

        .filtro-data-label {
          font-size: var(--onity-type-body-size);
          font-weight: 500;
          display: block;
          margin-bottom: var(--onity-space-s);
          color: var(--onity-icon-secondary);
        }

        .filtro-data-select {
          padding: var(--onity-space-s);
          border-radius: var(--onity-radius-xs);
          border: 1px solid var(--onity-color-border);
          width: 100%;
          background: var(--onity-color-surface);
          color: var(--onity-color-text);
          font-family: var(--onity-font-family-sans);
          font-size: var(--onity-type-body-size);
          outline: none;
          transition: box-shadow 120ms ease, border-color 120ms ease;
        }

        .filtro-data-select:focus {
          border-color: var(--onity-color-primary);
          box-shadow: 0 0 0 3px rgba(68,84,100,0.15);
        }

        .cards {
          display: flex;
          gap: var(--onity-space-m);
          margin-top: var(--onity-space-l);
          margin-bottom: var(--onity-space-l);
        }

        .card {
          flex: 1;
          height: 100px;
          border-radius: var(--onity-radius-m);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          color: #fff;
          transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
          cursor: pointer;
        }

        .card h3 { margin: 0; font-size: var(--onity-type-h3-size); font-weight: 500; }
        .card p { margin: var(--onity-space-xs) 0 0 0; font-weight: 600; }

        .card-regular { background-color: var(--onity-color-success); }
        .card-regularizado { background-color: var(--onity-color-warning); }
        .card-irregular { background-color: var(--onity-color-error); }

        .card.ativo {
          box-shadow: inset 0 0 0 3px rgba(255,255,255,0.7);
          opacity: 0.95;
          transform: scale(1.02);
        }

        .filtros {
          display: flex;
          flex-wrap: wrap;
          gap: var(--onity-space-s);
          margin-bottom: var(--onity-space-l);
        }

        .filtro {
          background: var(--onity-color-surface);
          border: 1.5px solid var(--onity-color-primary);
          color: var(--onity-color-text);
          padding: var(--onity-space-xs) var(--onity-space-s);
          border-radius: 18px;
          cursor: pointer;
          font-size: var(--onity-type-body-size);
          font-family: var(--onity-font-family-sans);
          line-height: var(--onity-type-body-line);
          transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease;
        }

        .filtro:hover { background: var(--onity-color-bg); }
        .filtro.ativo { background: var(--onity-color-primary); color: #fff; }

        .tabela {
          width: 100%;
          background: var(--onity-color-surface);
          border-collapse: collapse;
          border-radius: var(--onity-radius-m);
          overflow: hidden;
          border: 1px solid var(--onity-color-border);
        }

        th, td {
          padding: var(--onity-space-s) var(--onity-space-m);
          border-bottom: 1px solid var(--onity-color-border);
          font-size: var(--onity-type-body-size);
          text-align: left;
        }

        thead { background: var(--onity-color-surface); }
        th { color: var(--onity-color-text); font-weight: 600; }
        td { color: var(--onity-color-text); }

        .badge {
          padding: var(--onity-space-xs) var(--onity-space-s);
          border-radius: var(--onity-radius-xs);
          font-size: var(--onity-type-caption-size);
          font-weight: 600;
          text-transform: uppercase;
          font-family: var(--onity-font-family-sans);
          color: #fff;
        }
        .badge.regular { background: var(--onity-color-success); }
        .badge.irregular { background: var(--onity-color-error); }
        .badge.regularizado { background: var(--onity-color-warning); }

        .download-icon {
          cursor: pointer;
          color: var(--onity-color-primary);
          transition: color 120ms ease;
        }
        .download-icon:hover { color: var(--onity-color-primary-hover); }
      `}</style>
    </>
  );
}
