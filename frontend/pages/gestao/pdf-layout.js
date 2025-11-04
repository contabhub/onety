"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import styles from "../../styles/gestao/PdfLayoutPage.module.css";

// Base da API
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

// Helpers para token e empresa
const getToken = () => {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
};

const getEmpresaId = () => {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem("userData");
    if (raw) {
      const u = JSON.parse(raw);
      return (
        u?.EmpresaId || u?.empresaId || u?.empresa_id || u?.companyId || u?.company_id || ""
      );
    }
  } catch {}
  return sessionStorage.getItem("empresaId") || "";
};

export default function PDFLayoutPage() {
  const [isClient, setIsClient] = useState(false);

  // Estados do FiltroBar
  const [departamentos, setDepartamentos] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [departamentoId, setDepartamentoId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingDepartamentos, setLoadingDepartamentos] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [verificandoTodos, setVerificandoTodos] = useState(false);

  // Estados do LayoutTable
  const [layouts, setLayouts] = useState([]);
  const [loadingLayouts, setLoadingLayouts] = useState(true);
  const [error, setError] = useState(null);
  const [departamentoFiltro, setDepartamentoFiltro] = useState("");

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Buscar departamentos
  useEffect(() => {
    const fetchDepartamentos = async () => {
      const empresaId = getEmpresaId();
      const token = getToken();

      if (!empresaId || !token) {
        console.warn("⚠️ empresaId ou token ausente.");
        setLoadingDepartamentos(false);
        return;
      }

      setLoadingDepartamentos(true);

      try {
        console.log("🔍 Buscando departamentos para empresa:", empresaId);
        const res = await fetch(`${BASE_URL}/gestao/departamentos/${empresaId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        console.log("📋 Departamentos recebidos:", data);
        console.log("📊 Tipo de dados:", typeof data);
        console.log("📊 É array?", Array.isArray(data));
        setDepartamentos(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("❌ Erro ao buscar departamentos:", error);
      } finally {
        setLoadingDepartamentos(false);
      }
    };

    if (typeof window !== "undefined") {
      fetchDepartamentos();
    }
  }, []);

  // Buscar layouts
  useEffect(() => {
    const fetchLayouts = async () => {
      const empresaId = getEmpresaId();
      const token = getToken();

      if (!empresaId) {
        setError("Empresa não identificada");
        setLoadingLayouts(false);
        return;
      }

      setLoadingLayouts(true);
      setError(null);

      try {
        const res = await fetch(`${BASE_URL}/gestao/pdf-layout`, {
          headers: { 
            Authorization: `Bearer ${token}`,
            "X-Empresa-Id": empresaId,
            "empresaid": empresaId
          }
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          let layoutsFiltrados = data;
          
          // Aplicar filtro de departamento se houver
          if (departamentoFiltro) {
            layoutsFiltrados = data.filter((layout) => 
              layout.departamento === departamentoFiltro
            );
          }
          
          setLayouts(layoutsFiltrados);
        } else {
          setError("Formato de dados inválido");
        }
      } catch (error) {
        console.error("Erro ao buscar layouts:", error);
        setError("Erro ao carregar layouts");
      } finally {
        setLoadingLayouts(false);
      }
    };

    if (typeof window !== "undefined") {
      fetchLayouts();
    }
  }, [departamentoFiltro]);

  const criarNovoLayout = async () => {
    if (!nome.trim() || !departamentoId) {
      setMensagem("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);
    const token = getToken();

    try {
      const empresaId = getEmpresaId();
      
      if (!empresaId) {
        setMensagem("⚠️ Empresa não identificada. Por favor, faça login novamente.");
        return;
      }

      const res = await fetch(`${BASE_URL}/gestao/pdf-layout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId,
          "empresaid": empresaId
        },
        body: JSON.stringify({
          name: nome.trim(),
          departamento_id: departamentoId,
        })
      });

      const data = await res.json();

      if (res.status === 201) {
        setMensagem("Layout criado com sucesso!");
        setNome("");
        setDepartamentoId("");
        setTimeout(() => {
          setModalAberto(false);
          setMensagem("");
          // Redirecionar para o novo layout criado
          if (data.layoutId) {
            window.location.href = `/dashboard/pdf-layout/${data.layoutId}`;
          } else {
            // Fallback: recarregar a página
            window.location.reload();
          }
        }, 1500);
      } else {
        setMensagem("❌ Erro ao criar layout: " + (data.erro || "Erro desconhecido"));
      }
    } catch (error) {
      console.error("❌ Erro ao criar layout:", error);
      setMensagem("❌ Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const verificarTodosLayouts = async () => {
    setVerificandoTodos(true);
    const token = getToken();
    const empresaId = getEmpresaId();

    if (!empresaId) {
      console.error("⚠️ Empresa não identificada");
      setVerificandoTodos(false);
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/gestao/pdf-layout/verificar-validacao-todos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId,
          "empresaid": empresaId
        }
      });
      const data = await res.json();
      console.log("✅ Verificação em massa:", data);

      // Recarregar a página para mostrar os novos status
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("❌ Erro na verificação em massa:", error);
    } finally {
      setVerificandoTodos(false);
    }
  };

  const handleDepartamentoChange = (id) => {
    setDepartamentoFiltro(id);
    console.log("Filtrando por:", id);
  };

  return (
    <>
      <PrincipalSidebar />
      <div className={styles.container}>
        <h1 className={styles.title}>PDF Layout</h1>
        <>
            {/* FiltroBar */}
            <div className={styles.topBar}>


              <select
                className={styles.selectFiltro}
                onChange={(e) => handleDepartamentoChange(e.target.value)}
                disabled={loadingDepartamentos}
                value={departamentoFiltro}
              >
                <option value="">
                  {loadingDepartamentos ? "Carregando..." : "Todos os departamentos"}
                </option>
                {departamentos.map((dep) => (
                  <option key={dep.id} value={dep.nome}>
                    {dep.nome}
                  </option>
                ))}
              </select>

              <button
                onClick={verificarTodosLayouts}
                disabled={verificandoTodos}
                className={styles.botaoFiltro}
                title="Verificar validação de todos os layouts"
              >
                {verificandoTodos ? (
                  <div className={styles.spinnerSmall}></div>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={styles.iconSvg}
                  >
                    <path d="M23 4v6h-6" />
                    <path d="M1 20v-6h6" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                )}
                {verificandoTodos ? "Verificando..." : "Verificar Todos"}
              </button>

              <button
                className={styles.botaoNovo}
                onClick={() => setModalAberto(true)}
              >
                + Novo
              </button>
            </div>

            {/* LayoutTable */}
            <div className={styles.container}>
              {loadingLayouts ? (
                <div className={styles.loadingContainer}>
                  <div className={styles.spinner}></div>
                  <p className={styles.loadingText}>Carregando layouts...</p>
                </div>
              ) : error ? (
                <div className={styles.errorContainer}>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#DC3545"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <p className={styles.errorText}>{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className={styles.retryButton}
                  >
                    Tentar Novamente
                  </button>
                </div>
              ) : layouts.length === 0 ? (
                <div className={styles.emptyContainer}>
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6B7280"
                    strokeWidth="1.5"
                  >
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14,2 14,8 20,8" />
                  </svg>
                  <p className={styles.emptyText}>Nenhum layout encontrado</p>
                  <p className={styles.emptySubtext}>
                    Crie seu primeiro layout clicando em "+ Novo"
                  </p>
                </div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>ID</th>
                      <th className={styles.th}>Modelo</th>
                      <th className={styles.th}>Departamento</th>
                      <th className={styles.th}>Status</th>
                      <th className={styles.th}>Versão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {layouts.map((layout, i) => (
                      <tr key={layout.id}>
                        <td className={styles.td}>{i + 1}</td>
                        <td className={styles.td}>
                          <Link href={`/gestao/pdf-layout/${layout.id}`}>
                            <span className={styles.linkSpan}>{layout.nome}</span>
                          </Link>
                        </td>
                        <td className={styles.td}>{layout.departamento}</td>
                        <td className={styles.td}>
                          {layout.status === "pronto" ? (
                            <span className={styles.statusGreen}>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 48 48"
                              >
                                <defs>
                                  <mask id="checkMask">
                                    <g fill="none" strokeLinejoin="round" strokeWidth="4">
                                      <path
                                        fill="#fff"
                                        stroke="#fff"
                                        d="M24 44a20 20 0 1 0 0-40 20 20 0 0 0 0 40Z"
                                      />
                                      <path
                                        stroke="#000"
                                        strokeLinecap="round"
                                        d="M16 24l6 6l12-12"
                                      />
                                    </g>
                                  </mask>
                                </defs>
                                <path fill="#0C860C" d="M0 0h48v48H0z" mask="url(#checkMask)" />
                              </svg>{" "}
                              Pronto para uso
                            </span>
                          ) : layout.status === "validando" ? (
                            <span className={styles.statusYellow}>
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#F59E0B"
                                strokeWidth="2"
                              >
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 6v6l4 2" />
                              </svg>{" "}
                              Validando...
                            </span>
                          ) : (
                            <span className={styles.statusRed}>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 512 512"
                              >
                                <path
                                  fill="#DC3545"
                                  d="M256 64c106 0 192 86 192 192s-86 192-192 192S64 362 64 256S150 64 256 64m81 81L256 226l-81-81l-30 30 81 81-81 81 30 30 81-81 81 81 30-30-81-81 81-81z"
                                />
                              </svg>{" "}
                              Pendente
                            </span>
                          )}
                        </td>
                        <td className={styles.td}>{layout.versao || 1}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal para criar novo layout */}
            {modalAberto && (
              <div className={styles.modalOverlay}>
                <div className={styles.modalContent}>
                  <h3 className={styles.modalTitle}>Novo PDF Layout</h3>

                  {mensagem && (
                    <div
                      className={`${styles.mensagem} ${
                        mensagem.includes("✅") ? styles.mensagemSucesso : styles.mensagemErro
                      }`}
                    >
                      {mensagem}
                    </div>
                  )}

                  <div className={styles.modalForm}>
                    <div>
                      <label>Nome do Layout *</label>
                      <input
                        type="text"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        placeholder="Ex: DARF"
                        disabled={loading}
                      />
                    </div>

                    <div>
                      <label>Departamento *</label>
                      <select
                        value={departamentoId}
                        onChange={(e) => setDepartamentoId(e.target.value)}
                        disabled={loading || loadingDepartamentos}
                      >
                        <option value="">
                          {loadingDepartamentos
                            ? "Carregando departamentos..."
                            : "Selecione um departamento..."}
                        </option>
                        {departamentos.map((dep) => (
                          <option key={dep.id} value={dep.id}>
                            {dep.nome}
                          </option>
                        ))}
                      </select>
                      {loadingDepartamentos && (
                        <div className={styles.loadingDepartamentos}>
                          <div className={styles.spinnerSmallBlue}></div>
                          Carregando departamentos...
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.modalFooter}>
                    <button
                      onClick={() => {
                        setModalAberto(false);
                        setNome("");
                        setDepartamentoId("");
                        setMensagem("");
                      }}
                      className={styles.buttonCancelar}
                      disabled={loading}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={criarNovoLayout}
                      className={styles.buttonSalvar}
                      disabled={loading}
                    >
                      {loading ? "Criando..." : "Criar Layout"}
                    </button>
                  </div>
                </div>
              </div>
            )}
        </>
      </div>
    </>
  );
}
