import React, { useState, useEffect } from "react";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import NavEnquete from "../../components/gestao/NavEnquete";
import NovoGrupoModal from "../../components/gestao/NovoGrupoModal";
import styles from "../../styles/gestao/EnquetePage.module.css";
import { FaLayerGroup } from "react-icons/fa";
import { useRouter } from "next/router";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export default function EnquetePage() {
  const [arvore, setArvore] = useState([]);
  const [expandedGrupos, setExpandedGrupos] = useState(new Set());
  const [expandedPerguntas, setExpandedPerguntas] = useState(
    new Set()
  );
  const [modalAberto, setModalAberto] = useState(false);
  const [modalFechando, setModalFechando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  const fetchArvore = async () => {
    if (typeof window === "undefined") return;
    const token =
      typeof window !== "undefined"
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "")
        : "";
    if (!token) return;

    try {
      setLoading(true);
      setError(null);
      console.log("🔄 Iniciando busca da árvore de enquetes...");
      const startTime = performance.now();
      
      const rawUserData = localStorage.getItem("userData");
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        throw new Error("EmpresaId não encontrado no storage");
      }
      
      const url = `${BASE_URL}/gestao/enquete/arvore`;
      const response = await fetch(url, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId.toString()
        },
      });
      
      const endTime = performance.now();
      console.log(`✅ Árvore carregada em ${(endTime - startTime).toFixed(2)}ms`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`📊 Dados recebidos: ${data.length} grupos`);
      
      setArvore(data);
    } catch (error) {
      console.error("❌ Erro ao buscar árvore:", error);
      setError("Erro ao carregar dados. Tente novamente.");
    } finally {
      setLoading(false);
      setTimeout(() => {
        setHasLoaded(true);
      }, 50);
    }
  };

  useEffect(() => {
    fetchArvore();
  }, []);

  const toggleGrupo = (id) => {
    const newSet = new Set(expandedGrupos);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setExpandedGrupos(newSet);
  };

  const togglePergunta = (id) => {
    const newSet = new Set(expandedPerguntas);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setExpandedPerguntas(newSet);
  };

  const abrirModal = () => {
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalFechando(true);
    setTimeout(() => {
      setModalFechando(false);
      setModalAberto(false);
    }, 300);
  };

  return (
    <>
      <PrincipalSidebar />
      <NavEnquete
        tabs={[
          { name: "Enquete", path: "/gestao/enquete" },
          { name: "Categoria", path: "/gestao/enquete-categoria" },
          { name: "Particularidade", path: "/gestao/enquete-particularidade" },
          { name: "Respondendo Enquete", path: "#" },
        ]}
        active="enquete"
      />
      <div className={styles.container}>
        {/* Header com título e botão */}
        <div className={styles.headerRow}>
          <h1 className={styles.headerTitle}>Gestão de Enquetes</h1>
          <button className={styles.buttonNovo} onClick={abrirModal}>
            <FaLayerGroup className={styles.icon} />
            Novo Grupo
          </button>
        </div>

        {/* Estados de loading, erro e conteúdo */}
        {loading ? (
          <div className={styles.spinnerContainer}>
            <div className={styles.spinner}></div>
            <span>Carregando enquetes...</span>
          </div>
        ) : error ? (
          <div className={styles.errorContainer}>
            <p>{error}</p>
            <button className={styles.errorButton} onClick={fetchArvore}>
              Tentar Novamente
            </button>
          </div>
        ) : (
          <table className={`${styles.table} ${hasLoaded ? styles.fadeIn : ""}`}>
            <thead>
              <tr>
                <th className={styles.th} style={{ width: 50, textAlign: "center" }}>
                  #
                </th>
                <th className={styles.th} style={{ width: 70, textAlign: "center" }}>
                  Tipo
                </th>
                <th className={styles.th} style={{ width: 150, textAlign: "center" }}>
                  Classificação
                </th>
                <th className={styles.th} style={{ textAlign: "left" }}>
                  Nome
                </th>
              </tr>
            </thead>
            <tbody>
              {arvore.length === 0 ? (
                <tr>
                  <td colSpan={4} className={styles.emptyState}>
                    Nenhuma enquete encontrada. Crie seu primeiro grupo!
                  </td>
                </tr>
              ) : (
                arvore.map((grupo, idx) => (
                  <React.Fragment key={`G-${grupo.id}`}>
                    {/* Linha do Grupo */}
                    <tr className={styles.grupoRow}>
                      <td
                        className={`${styles.td} ${styles.toggleCell}`}
                        onClick={() => toggleGrupo(grupo.id)}
                      >
                        {expandedGrupos.has(grupo.id) ? "−" : "+"}
                      </td>
                      <td className={`${styles.td} ${styles.tipoCell} ${styles.tipoGrupo}`}>
                        G
                      </td>
                      <td className={`${styles.td} ${styles.classificacaoCell}`}>
                        {grupo.classificacao}
                      </td>
                      <td
                        className={`${styles.td} ${styles.linkTd}`}
                        onClick={() =>
                          router.push(`/gestao/enquete-grupos/${grupo.id}`)
                        }
                      >
                        {grupo.titulo}
                      </td>
                    </tr>

                    {/* Linhas das Perguntas */}
                    {expandedGrupos.has(grupo.id) &&
                      grupo.filhos.map((pergunta) => (
                        <React.Fragment key={`P-${pergunta.id}`}>
                          <tr className={styles.perguntaRow}>
                            <td
                              className={`${styles.td} ${styles.toggleCell}`}
                              onClick={() => togglePergunta(pergunta.id)}
                            >
                              {expandedPerguntas.has(pergunta.id) ? "−" : "+"}
                            </td>
                            <td className={`${styles.td} ${styles.tipoCell} ${styles.tipoPergunta}`}>
                              P
                            </td>
                            <td className={`${styles.td} ${styles.classificacaoCell}`}>
                              {pergunta.classificacao}
                            </td>
                            <td
                              className={`${styles.td} ${styles.linkTd}`}
                              onClick={() =>
                                router.push(
                                  `/gestao/enquete-perguntas/${pergunta.id}`
                                )
                              }
                            >
                              {pergunta.texto}
                            </td>
                          </tr>

                          {/* Linhas das Respostas */}
                          {expandedPerguntas.has(pergunta.id) &&
                            pergunta.filhos.map((resposta) => (
                              <tr key={`R-${resposta.id}`} className={styles.respostaRow}>
                                <td className={styles.td}></td>
                                <td className={`${styles.td} ${styles.tipoCell} ${styles.tipoResposta}`}>
                                  R
                                </td>
                                <td className={`${styles.td} ${styles.classificacaoCell}`}>
                                  {resposta.classificacao}
                                </td>
                                <td className={styles.td}>
                                  {resposta.particularidade}
                                </td>
                              </tr>
                            ))}
                        </React.Fragment>
                      ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Modal */}
        <NovoGrupoModal
          isOpen={modalAberto}
          onClose={fecharModal}
          onCreated={() => {
            fetchArvore();
            fecharModal();
          }}
        />
      </div>
    </>
  );
}
