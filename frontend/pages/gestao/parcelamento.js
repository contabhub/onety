"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PrincipalSidebar from "@/components/onety/principal/PrincipalSidebar";
import ClienteSelecaoModal from "@/components/gestao/ClienteSelecaoModal";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import CompetenciaSelecaoModal from "@/components/gestao/CompetenciaSelecaoModal";
import { useAuthRedirect } from "@/utils/auth";
import styles from "../../styles/gestao/Parcelamento.module.css";

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
    const fallback = typeof window !== 'undefined' ? sessionStorage.getItem('empresaId') : null;
    return fallback ? String(fallback) : null;
  } catch (e) {
    console.error('Erro ao obter empresaId:', e);
    return null;
  }
};

// Helper para auth headers
const getAuthHeaders = () => {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};


export default function ParcelamentosPrivado() {
    useAuthRedirect();
    const [empresaId, setEmpresaId] = useState(null);
    const [dados, setDados] = useState([]);
    const [filtroStatus, setFiltroStatus] = useState("");
    const [collapsed, setCollapsed] = useState(false);
    const [clientes, setClientes] = useState([]);
    const [clientesSelecionados, setClientesSelecionados] = useState([]);
    const [isConsultando, setIsConsultando] = useState(false);
    const [isModalAberto, setIsModalAberto] = useState(false);
    const [competenciaModalAberto, setCompetenciaModalAberto] = useState(false);
    const [parcelamentoSelecionado, setParcelamentoSelecionado] = useState(null);
    const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
    const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1);
    const [paginaAtual, setPaginaAtual] = useState(1);
    const [totalPaginas, setTotalPaginas] = useState(1);
    const [limitePorPagina, setLimitePorPagina] = useState(25);
    const [isCarregando, setIsCarregando] = useState(false);



    const abrirCompetenciaModal = (parcelamento) => {
        setParcelamentoSelecionado(parcelamento);
        setCompetenciaModalAberto(true);
    };

    const toggleSelecionado = (id) => {
        setClientesSelecionados((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const consultarSelecionados = async () => {
        if (clientesSelecionados.length === 0) {
            alert("Selecione ao menos um cliente para consultar.");
            return;
        }

        setIsConsultando(true);
        try {
            const res = await api.post(
                `/gestao/parcelamento/api/parcelamentos/${empresaId}/clientes-selecionados`,
                { clientesSelecionados },
                {
                    headers: getAuthHeaders()
                }
            );

            toast.success("Consulta realizada com sucesso! Verifique se todas as guias foram emitidas corretamente.");
        } catch (error) {
            toast.error("Erro ao consultar clientes selecionados.");
            console.error(error);
        } finally {
            setIsConsultando(false);
            setIsModalAberto(false);
        }
    };



    useEffect(() => {
        const fetchClientes = async () => {
            try {
                const empresaId = getEmpresaId();
                if (!empresaId) return;

                const res = await api.get(`/gestao/clientes`, {
                    params: { empresaId, limit: 9999 },
                    headers: getAuthHeaders()
                });
                setClientes(res.data.clientes || res.data || []);
            } catch (error) {
                console.error("Erro ao buscar clientes:", error);
            }
        };

        fetchClientes();
    }, []);


    const [resumoBD, setResumoBD] = useState({ ativo: 0, encerrado: 0, outros: 0 });
    const [resumoCalculado, setResumoCalculado] = useState({ ativo: 0, encerrado: 0, outros: 0 });

    useEffect(() => {
        if (empresaId === null) return;

        const carregarResumo = async () => {
            try {
                const res = await api.get(`/gestao/parcelamento/api/parcelamentos/${empresaId}/resumo`, {
                    headers: getAuthHeaders()
                });
                setResumoBD(res.data);
            } catch (err) {
                console.error("Erro ao buscar resumo do BD:", err);
            }
        };

        carregarResumo();
    }, [empresaId]);

    // Calcular resumo baseado nos dados agrupados
    useEffect(() => {
        const dadosAgrupados = dados.reduce((acc, item) => {
            const chave = `${item.clienteId}-${item.cliente}`;
            
            if (!acc[chave]) {
                acc[chave] = {
                    ...item,
                    parcelamentos: [item],
                    totalParcelamentos: 1
                };
            } else {
                const jaExiste = acc[chave].parcelamentos.some((p) => p.numero === item.numero);
                if (!jaExiste) {
                    acc[chave].parcelamentos.push(item);
                    acc[chave].totalParcelamentos++;
                }
            }
            
            return acc;
        }, {});

        const clientesAgrupados = Object.values(dadosAgrupados);
        
        let ativo = 0, encerrado = 0, outros = 0;
        
        clientesAgrupados.forEach((cliente) => {
            const status = cliente.status.toLowerCase();
            
            if (status.includes("em parcelamento")) {
                ativo++;
            } else if (status.includes("encerrado") || status.includes("sem efeito")) {
                encerrado++;
            } else {
                outros++;
            }
        });
        
        setResumoCalculado({ ativo, encerrado, outros });
    }, [dados]);

    // Ao mudar quantidade de itens por página, volte para página 1
    useEffect(() => {
        setPaginaAtual(1);
    }, [limitePorPagina]);

    useEffect(() => {
        const empresaIdValue = getEmpresaId();
        if (empresaIdValue) setEmpresaId(Number(empresaIdValue));
    }, []);



    useEffect(() => {
        if (empresaId === null) return;

        const carregarParcelamentos = async () => {
            setIsCarregando(true);
            try {
                const res = await api.get(`/gestao/parcelamento/api/parcelamentos/${empresaId}`, {
                    headers: getAuthHeaders()
                });

                // Backend retorna array direto ou objeto com { data, total, page, totalPages }
                const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);

                if (!Array.isArray(data)) {
                    console.error("❌ Dados recebidos não são um array:", res.data);
                    toast.error("Erro: formato de dados inválido.");
                    return;
                }

                const dadosComVencimentoReal = await Promise.all(
                    data.map(async (item) => {
                        const status = item.status?.trim().toLowerCase();
                        const ehParcelamento = status === "em parcelamento";

                        if (
                            ehParcelamento &&
                            typeof item.guia_pdf_base64 === "string" &&
                            item.guia_pdf_base64.length > 50
                        ) {
                            try {
                                const { extrairDadosDoPDF } = await import("../../app/utils/extrairVencimento");
                                const { vencimento: vencReal, parcela, valor } = await extrairDadosDoPDF(item.guia_pdf_base64);

                                return {
                                    ...item,
                                    vencimentoOriginal: item.vencimento,
                                    vencimento: vencReal || "Não possível extrair o vencimento. Baixe a guia e confira",
                                    parcelaExtraida: parcela || undefined,
                                    valorExtraido: valor || undefined,
                                };
                            } catch (err) {
                                return { 
                                    ...item, 
                                    vencimentoOriginal: item.vencimento,
                                    vencimento: "Não possível extrair o vencimento. Baixe a guia e confira"
                                };
                            }
                        }

                        return { ...item, guia_pdf_base64: undefined, vencimentoOriginal: item.vencimento };
                    })
                );

                setDados(dadosComVencimentoReal);
            } catch (err) {
                console.error("❌ Erro ao carregar parcelamentos:", err);
                toast.error("Erro ao carregar parcelamentos. Tente novamente.");
            } finally {
                setIsCarregando(false);
            }
        };

        carregarParcelamentos();
    }, [empresaId]);

    // Agrupar parcelamentos por cliente para evitar duplicatas desnecessárias
    const dadosAgrupados = dados.reduce((acc, item) => {
        const chave = `${item.clienteId}-${item.cliente}`;
        
        if (!acc[chave]) {
            acc[chave] = {
                ...item,
                parcelamentos: [item],
                totalParcelamentos: 1
            };
        } else {
            // Só adiciona se for uma competência diferente (baseado no número do parcelamento)
            const jaExiste = acc[chave].parcelamentos.some((p) => p.numero === item.numero);
            if (!jaExiste) {
                acc[chave].parcelamentos.push(item);
                acc[chave].totalParcelamentos++;
            }
        }
        
        return acc;
    }, {});

    // Ordenar os dados agrupados: com vencimento válido primeiro (mais novo para mais antigo), sem guia por último
    const dadosOrdenados = Object.values(dadosAgrupados).sort((a, b) => {
        const aTemGuia = a.guia_pdf_base64 && a.guia_pdf_base64.length > 50;
        const bTemGuia = b.guia_pdf_base64 && b.guia_pdf_base64.length > 50;
        
        // Verificar se tem vencimento válido (não é a mensagem de erro)
        const aTemVencimentoValido = a.vencimento && !a.vencimento.includes("Não possível extrair");
        const bTemVencimentoValido = b.vencimento && !b.vencimento.includes("Não possível extrair");
        
        // Se um tem vencimento válido e outro não, o com vencimento válido vem primeiro
        if (aTemVencimentoValido && !bTemVencimentoValido) return -1;
        if (!aTemVencimentoValido && bTemVencimentoValido) return 1;
        
        // Se ambos têm vencimento válido, ordenar por data (mais novo primeiro)
        if (aTemVencimentoValido && bTemVencimentoValido) {
            const dataA = new Date(a.vencimento);
            const dataB = new Date(b.vencimento);
            return dataB.getTime() - dataA.getTime(); // Mais novo primeiro
        }
        
        // Se um tem guia e outro não, o com guia vem primeiro
        if (aTemGuia && !bTemGuia) return -1;
        if (!aTemGuia && bTemGuia) return 1;
        
        // Se nenhum tem vencimento válido, manter ordem original
        return 0;
    });

    const dadosFiltrados = dadosOrdenados.filter((d) => {
        if (!filtroStatus) return true;
        
        const status = d.status.toLowerCase();
        const filtro = filtroStatus.toLowerCase();
        
        // Lógica mais precisa para os filtros
        if (filtro === "parcelamento") {
            return status.includes("parcelamento");
        } else if (filtro === "encerrado") {
            return status.includes("encerrado") || status.includes("sem efeito");
        } else {
            return status.includes(filtro);
        }
    });

    // Variáveis de paginação
    const totalPaginasCalculado = Math.ceil(dadosFiltrados.length / limitePorPagina);
    const paginaInicio = Math.max(1, paginaAtual - 2);
    const paginaFim = Math.min(totalPaginasCalculado, paginaInicio + 4);

    // Dados paginados
    const dadosPaginados = dadosFiltrados.slice(
        (paginaAtual - 1) * limitePorPagina,
        paginaAtual * limitePorPagina
    );

    return (
        <>
            <PrincipalSidebar />
            <div className="pageWrap" style={{ maxWidth: '2000px', margin: '0 auto', padding: 'var(--onity-space-l)' }}>
            <div className={styles.parcelamento}>
                <div className={styles.cards}>
                    <div
                        className={`${styles.card} ${styles.cardRegular} ${filtroStatus === "parcelamento" ? styles.cardAtivo : ""}`}
                        onClick={() => setFiltroStatus(filtroStatus === "parcelamento" ? "" : "parcelamento")}
                    >
                        <h3>Em Parcelamento</h3>
                        <p>{resumoCalculado.ativo}</p>
                    </div>
                    <div
                        className={`${styles.card} ${styles.cardIrregular} ${filtroStatus === "encerrado" ? styles.cardAtivo : ""}`}
                        onClick={() => setFiltroStatus(filtroStatus === "encerrado" ? "" : "encerrado")}
                    >
                        <h3>Encerrado</h3>
                        <p>{resumoCalculado.encerrado}</p>
                    </div>
                    <div
                        className={`${styles.card} ${styles.cardRegularizado} ${filtroStatus === "" ? styles.cardAtivo : ""}`}
                        onClick={() => setFiltroStatus("")}
                    >
                        <h3>Outros</h3>
                        <p>{resumoCalculado.outros}</p>
                    </div>
                </div>

                <div className={styles.acoesConsulta}>
                    <button
                        onClick={() => setIsModalAberto(true)}
                        disabled={isConsultando}
                        className={styles.botaoPrincipal}
                    >
                        {isConsultando ? "Consultando clientes..." : "Selecionar Clientes para Consultar"}
                    </button>
                </div>

                    {isCarregando ? (
                        <div className={styles.loadingContainer}>
                            <div className={styles.loadingSpinner}></div>
                            <h2>Carregando Parcelamentos...</h2>
                            <p>Por favor, aguarde enquanto processamos os dados.</p>
                        </div>
                    ) : (
                        <table className={styles.tabela}>
                            <thead>
                                <tr>
                                    <th>Cliente</th>
                                    <th>Tipo</th>
                                    <th>Status</th>
                                    {filtroStatus !== "encerrado" && (
                                        <>
                                            <th>Vencimento</th>
                                            <th>Parcela</th>
                                            <th>Valor</th>
                                            <th>PDF</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {dadosPaginados.length === 0 ? (
                                    <tr>
                                        <td colSpan={filtroStatus === "encerrado" ? 3 : 7}>Nenhum registro encontrado.</td>
                                    </tr>
                                ) : (
                                    dadosPaginados.map((d, i) => (
                                <tr key={i}>
                                    <td>{d.cliente}</td>
                                    <td>Simples Nacional</td>
                                    <td>
                                        <span className={`${styles.badge} ${corBadge(d.status) === "irregular" ? styles.badgeIrregular : corBadge(d.status) === "regular" ? styles.badgeRegular : styles.badgeRegularizado}`}>{d.status}</span>
                                    </td>
                                    {filtroStatus !== "encerrado" && (
                                        <>
                                        <td className={
                                            d.vencimento !== d.vencimentoOriginal ? styles.vencimentoDestaque : 
                                            d.vencimento?.includes("Não possível extrair") ? styles.vencimentoErro : ""
                                        }>
                                            {d.guia_pdf_base64 ? d.vencimento : "Guias não disponíveis para Download"}
                                        </td>
                                            <td>{d.parcelaExtraida || "-"}</td>
                                            <td>{d.valorExtraido ? `R$ ${d.valorExtraido}` : "-"}</td>
                                            <td>
                                                {d.guia_pdf_base64 ? (
                                                    <a
                                                        href={`data:application/pdf;base64,${d.guia_pdf_base64}`}
                                                        download={`DAS-${d.numero}.pdf`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={styles.botaoDownload}
                                                    >
                                                        Baixar Guia
                                                    </a>
                                                ) : d.status.toLowerCase().includes("parcelamento") ? (
                                                    <button
                                                        className={styles.botaoEmitir}
                                                        onClick={() => abrirCompetenciaModal(d)}
                                                    >
                                                        Emitir Guia
                                                    </button>
                                                ) : (
                                                    <span className={styles.textoIndisponivel}>
                                                        Guias não disponíveis para Download
                                                    </span>
                                                )}
                                            </td>
                                        </>
                                    )}
                                </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}

                <div className={styles.paginacao}>
                    <span>
                        Mostrando {(paginaAtual - 1) * limitePorPagina + 1}
                        {" - "}
                        {Math.min(paginaAtual * limitePorPagina, dadosFiltrados.length)} de {dadosFiltrados.length}
                    </span>
                    <div className={styles.paginationButtons}>
                        <select
                            value={limitePorPagina}
                            onChange={(e) => setLimitePorPagina(Number(e.target.value))}
                            className={styles.paginationSelect}
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                        <button
                            className={styles.paginationArrow}
                            onClick={() => setPaginaAtual(1)}
                            disabled={paginaAtual === 1}
                            aria-label="Primeira página"
                        >
                            {"<<"}
                        </button>
                        <button
                            className={styles.paginationArrow}
                            onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                            disabled={paginaAtual === 1}
                            aria-label="Página anterior"
                        >
                            {"<"}
                        </button>
                        {Array.from({ length: paginaFim - paginaInicio + 1 }, (_, i) => paginaInicio + i).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPaginaAtual(p)}
                                className={p === paginaAtual ? styles.paginationButtonActive : styles.paginationArrow}
                            >
                                {p}
                            </button>
                        ))}
                        <button
                            className={styles.paginationArrow}
                            onClick={() => setPaginaAtual((p) => Math.min(totalPaginasCalculado, p + 1))}
                            disabled={paginaAtual === totalPaginasCalculado}
                            aria-label="Próxima página"
                        >
                            {">"}
                        </button>
                        <button
                            className={styles.paginationArrow}
                            onClick={() => setPaginaAtual(totalPaginasCalculado)}
                            disabled={paginaAtual === totalPaginasCalculado}
                            aria-label="Última página"
                        >
                            {">>"}
                        </button>
                    </div>
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

            {competenciaModalAberto && parcelamentoSelecionado && (
                <CompetenciaSelecaoModal
                    isOpen={competenciaModalAberto}
                    onClose={() => setCompetenciaModalAberto(false)}
                    onConfirmar={async (anoMesSelecionado) => {
                        try {
                            const res = await api.post(
                                `/gestao/parcelamento/api/parcelamentos/emitir/${parcelamentoSelecionado.id}`,
                                { anoMes: anoMesSelecionado },
                                { headers: getAuthHeaders() }
                            );

                            if (res.data.sucesso === false && res.data.mensagens?.length > 0) {
                                toast.error(res.data.mensagens[0].texto);
                            } else {
                                toast.success("Guia emitida com sucesso!");
                                setTimeout(() => location.reload(), 2000);
                            }
                        } catch (err) {
                            toast.error("Erro ao emitir a guia.");
                        } finally {
                            setCompetenciaModalAberto(false);
                        }
                    }}
                    anoSelecionado={anoSelecionado}
                    setAnoSelecionado={setAnoSelecionado}
                    mesSelecionado={mesSelecionado}
                    setMesSelecionado={setMesSelecionado}
                />
            )}
            </div>
            <ToastContainer />
        </>
    );
}

function corBadge(status) {
    if (status.toLowerCase().includes("encerrado")) return "irregular";
    if (status.toLowerCase().includes("parcelamento")) return "regular";
    return "regularizado";
}

const menuItemStyle = {
    padding: "10px",
    borderRadius: "8px",
    textDecoration: "none",
    color: "#374151",
    fontWeight: 500,
    transition: "background 0.2s",
    cursor: "pointer",
};