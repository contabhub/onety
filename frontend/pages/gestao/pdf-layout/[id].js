"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import PrincipalSidebar from "../../../components/onety/principal/PrincipalSidebar";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import styles from "../../../styles/gestao/PdfLayoutEditPage.module.css";

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

export default function EditPdfLayout() {
  const router = useRouter();

  const [idPronto, setIdPronto] = useState(null);

  const [nome, setNome] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [departamentos, setDepartamentos] = useState([]);
  const [arquivo, setArquivo] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [etapa, setEtapa] = useState(1);
  const [linhasPdf, setLinhasPdf] = useState([]);
  const [textoSelecionado, setTextoSelecionado] = useState("");
  const [camposSalvos, setCamposSalvos] = useState([]);
  const [linhaSelecionadaIndex, setLinhaSelecionadaIndex] = useState(null);
  let regex_validacao = "";
  const [atividadesVinculadas, setAtividadesVinculadas] = useState([]);
  const [modalTestarAberto, setModalTestarAberto] = useState(false);
  const [arquivoTeste, setArquivoTeste] = useState(null);
  const [resultadoTeste, setResultadoTeste] = useState(null);
  const [testando, setTestando] = useState(false);

  function getTextoSelecionado() {
    const selection = window.getSelection();
    return selection && selection.toString().length > 1
      ? selection.toString().trim()
      : "";
  }
  
  const salvarCampo = async (tipoCampo) => {
    if (!textoSelecionado) {
      toast.error("Selecione um texto primeiro.");
      return;
    }
    
    const linhaIndex = linhaSelecionadaIndex;
    if (linhaIndex === null || linhaIndex === undefined) {
      toast.error("Não foi possível determinar a linha.");
      return;
    }
    if (linhaIndex === -1) {
      toast.error("Texto selecionado não encontrado na lista.");
      return;
    }

    const payload = {
      tipo_campo: tipoCampo,
      valor_esperado: textoSelecionado,
      posicao_linha: linhaIndex,
      posicao_coluna: 0,
      regex_validacao: textoSelecionado
    };

    try {
      const token = getToken();
      const empresaId = getEmpresaId();
      const res = await fetch(`${BASE_URL}/gestao/pdf-layout/${idPronto}/campos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId,
          "empresaid": empresaId
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.erro || "Erro ao salvar campo");
      }
      
      toast.success("Campo salvo com sucesso!");
      carregarCamposSalvos();
      
      try {
        const validacaoRes = await fetch(`${BASE_URL}/gestao/pdf-layout/${idPronto}/verificar-validacao`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "X-Empresa-Id": empresaId,
            "empresaid": empresaId
          }
        });
        const validacaoData = await validacaoRes.json();
        console.log("✅ Validação automática:", validacaoData);
        
        if (validacaoData.status !== "pendente") {
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } catch (validacaoError) {
        console.error("⚠️ Erro na verificação automática:", validacaoError);
      }
    } catch (error) {
      toast.error("Erro ao salvar.");
    }
  };

  const removerCampo = async (campoId) => {
    try {
      const token = getToken();
      const empresaId = getEmpresaId();
      const res = await fetch(`${BASE_URL}/gestao/pdf-layout/campos/${campoId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId,
          "empresaid": empresaId
        }
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.erro || "Erro ao remover campo");
      }
      
      toast.success("Campo removido com sucesso!");
      carregarCamposSalvos();
      
      try {
        const validacaoRes = await fetch(`${BASE_URL}/gestao/pdf-layout/${idPronto}/verificar-validacao`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "X-Empresa-Id": empresaId,
            "empresaid": empresaId
          }
        });
        const validacaoData = await validacaoRes.json();
        console.log("✅ Validação automática após remoção:", validacaoData);
        
        if (validacaoData.status !== "pendente") {
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } catch (validacaoError) {
        console.error("⚠️ Erro na verificação automática:", validacaoError);
      }
    } catch (error) {
      toast.error("Erro ao remover campo.");
    }
  };

  const excluirModelo = async () => {
    if (!window.confirm("Tem certeza que deseja excluir o PDF deste modelo? Esta ação não pode ser desfeita.")) {
      return;
    }

    try {
      const token = getToken();
      const empresaId = getEmpresaId();
      const res = await fetch(`${BASE_URL}/gestao/pdf-layout/${idPronto}/pdf`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId,
          "empresaid": empresaId
        }
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.erro || "Erro ao excluir PDF");
      }
      
      toast.success("PDF removido com sucesso!");
      
      // Limpar estados relacionados ao PDF
      setPdfUrl(null);
      setArquivo(null);
      setLinhasPdf([]);
      setTextoSelecionado("");
      setLinhaSelecionadaIndex(null);
      setCamposSalvos([]);
      setEtapa(1);
      
    } catch (error) {
      console.error("Erro ao excluir PDF:", error);
      toast.error("Erro ao excluir PDF. Tente novamente.");
    }
  };

  function base64ToBlob(base64, mime) {
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length).fill(0).map((_, i) => byteChars.charCodeAt(i));
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mime });
  }

  useEffect(() => {
    if (!idPronto && router.isReady && typeof router.query.id === "string") {
      setIdPronto(router.query.id);
    }
  }, [router.isReady, router.query.id, idPronto]);

  useEffect(() => {
    if (idPronto) {
      fetchLayout();
      fetchDepartamentos();
      carregarCamposSalvos();
      
      const token = getToken();
      const empresaId = getEmpresaId();
      fetch(`${BASE_URL}/gestao/pdf-layout/${idPronto}/atividades-vinculadas`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId,
          "empresaid": empresaId
        }
      })
        .then(res => res.json())
        .then(data => setAtividadesVinculadas(data))
        .catch(() => setAtividadesVinculadas([]));
    }
  }, [idPronto]);

  const fetchLayout = async () => {
    try {
      const token = getToken();
      const empresaId = getEmpresaId();
      const res = await fetch(`${BASE_URL}/gestao/pdf-layout/${idPronto}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId,
          "empresaid": empresaId
        }
      });
      const data = await res.json();
      setNome(data.nome);
      setDepartamento(data.departamento_id || data.departamento);
    
      if (data.pdf_base64) {
        setPdfUrl(`data:application/pdf;base64,${data.pdf_base64}`);
      }
    } catch (error) {
      toast.error("Erro ao carregar layout.");
    }
  };

  const fetchDepartamentos = async () => {
    try {
      const empresaId = getEmpresaId();
      if (!empresaId) return;
      
      const token = getToken();
      const res = await fetch(`${BASE_URL}/gestao/departamentos/${empresaId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId,
          "empresaid": empresaId
        }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setDepartamentos(data.map((d) => ({ id: d.id, nome: d.nome })));
      }
    } catch (error) {
      toast.error("Erro ao carregar departamentos.");
    }
  };

  const carregarCamposSalvos = async () => {
    try {
      const token = getToken();
      const empresaId = getEmpresaId();
      const res = await fetch(`${BASE_URL}/gestao/pdf-layout/${idPronto}/campos`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId,
          "empresaid": empresaId
        }
      });
      const data = await res.json();
      setCamposSalvos(data);
    } catch (error) {
      toast.error("Erro ao carregar campos salvos.");
    }
  };

  const salvarLayout = async () => {
    if (!nome.trim()) {
      toast.error("Informe um nome.");
      return;
    }
    if (!departamento) {
      toast.error("Selecione um departamento.");
      return;
    }
    try {
      const token = getToken();
      const empresaId = getEmpresaId();
      const res = await fetch(`${BASE_URL}/gestao/pdf-layout/${idPronto}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId,
          "empresaid": empresaId
        },
        body: JSON.stringify({
          name: nome,
          departamento_id: departamento,
        })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.erro || "Erro ao salvar layout");
      }
      
      toast.success("Layout salvo com sucesso!");
      fetchLayout();
    } catch (error) {
      toast.error("Erro ao salvar layout.");
    }
  };

  const handleUpload = async () => {
    if (!arquivo) {
      toast.error("Selecione um arquivo antes de anexar.");
      return;
    }
    const token = getToken();
    const empresaId = getEmpresaId();
    const formData = new FormData();
    formData.append("arquivo", arquivo);

    try {
      const res = await fetch(`${BASE_URL}/gestao/pdf-layout/${idPronto}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId,
          "empresaid": empresaId
        },
        body: formData
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.erro || "Falha ao anexar arquivo");
      }
      
      if (data && data.pdf_base64) {
        setPdfUrl(`data:application/pdf;base64,${data.pdf_base64}`);
        setModalAberto(false);
        toast.success("Arquivo anexado com sucesso!");
      } else {
        toast.error("Falha ao anexar arquivo.");
      }
    } catch (error) {
      toast.error("Falha ao anexar arquivo.");
    }
  };

  const carregarTextoExtraido = async () => {
    const token = getToken();
    const empresaId = getEmpresaId();
    const formData = new FormData();
  
    if (arquivo) {
      formData.append("arquivo", arquivo);
    } else {
      try {
        const resBase64 = await fetch(`${BASE_URL}/gestao/pdf-layout/${idPronto}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Empresa-Id": empresaId,
            "empresaid": empresaId
          }
        });
        const dataBase64 = await resBase64.json();
      
        if (dataBase64?.pdf_base64) {
          const pdfBlob = base64ToBlob(dataBase64.pdf_base64, "application/pdf");
          formData.append("arquivo", pdfBlob);
        } else {
          toast.error("Não foi possível obter o PDF para extrair os textos.");
          return;
        }
      } catch (error) {
        toast.error("Erro ao obter PDF do banco.");
        return;
      }
    }
  
    try {
      const res = await fetch(`${BASE_URL}/gestao/pdf-layout/${idPronto}/testar-pdf`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId,
          "empresaid": empresaId
        },
        body: formData
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.erro || "Erro ao extrair texto do PDF");
      }
      
      if (data?.resultados && data.resultados.length > 0) {
        setLinhasPdf(data.resultados[0].extraido);
      }
    } catch (error) {
      toast.error("Erro ao extrair texto do PDF.");
    }
  };

  if (!idPronto) return <p>Carregando layout...</p>;

  return (
    <>
      <PrincipalSidebar />
      <ToastContainer />
      <div className={styles.container}>
        <button onClick={() => router.back()} className={styles.backButton}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Voltar
        </button>
        <h2 className={styles.title}>
          {nome}
        </h2>

        <div className={styles.stepsContainer}>
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`${styles.step} ${etapa === n ? styles.stepActive : ''}`}
              onClick={() => {
                if (!arquivo && !pdfUrl) {
                  toast.error("Você precisa anexar um PDF antes.");
                  return;
                }
                setEtapa(n);
                if (n === 2) carregarTextoExtraido();
              }}
            >
              {n}. {["Adicionar arquivo", "Selecionar campos para validação", "Vincular atividades"][n - 1]}
            </div>
          ))}
        </div>

        {etapa === 1 && (
          <>
            <div className={styles.infoSection}>
              <div className={styles.infoForm}>
                <label className={styles.formLabel}>Nome</label>
                <div className={styles.formRow}>
                  <input disabled value={idPronto} className={`${styles.formInput} ${styles.idInput}`} />
                  <input 
                    value={nome} 
                    onChange={(e) => setNome(e.target.value)} 
                    className={`${styles.formInput} ${styles.nameInput}`} 
                  />
                </div>

                <label className={styles.formLabel}>Departamento</label>
                <select
                  value={departamento}
                  onChange={(e) => setDepartamento(e.target.value)}
                  className={styles.formSelect}
                >
                  <option value="">Selecione...</option>
                  {departamentos.map((d) => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formActions}>
                <button 
                  className={styles.buttonExcluir}
                  onClick={excluirModelo}
                  disabled={!pdfUrl}
                >
                  Excluir modelo
                </button>
                <button onClick={salvarLayout} className={styles.buttonAnexar}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className={styles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Salvar
                </button>
                <button onClick={() => setModalAberto(true)} className={styles.buttonAnexar}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className={styles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Anexar Arquivo
                </button>
              </div>
            </div>

            {!pdfUrl && (
              <div className={styles.warningBox}>
                <div className={styles.warningHeader}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <strong className={styles.warningTitle}>AVISO IMPORTANTE!</strong>
                </div>
                <p className={styles.warningText}>O arquivo PDF deve conter:</p>
                <ul className={styles.warningList}>
                  <li><strong>Inscrição</strong> (CPF, CNPJ etc.)</li>
                  <li><strong>Competência</strong> (data)</li>
                  <li><strong>Identificação da obrigação</strong> (ex: DARF)</li>
                </ul>
              </div>
            )}

            {pdfUrl && (
              <iframe src={pdfUrl} className={styles.pdfViewer} />
            )}
          </>
        )}

        {etapa === 2 && pdfUrl && (
          <div className={styles.camposSection}>
            <div className={styles.infoBox}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              Foram transformadas em TXT as informações contidas na primeira página do arquivo. Agora, grife o texto à esquerda e selecione usando o botão correspondente à direita.
            </div>

            <div className={styles.camposLayout}>
              {/* Esquerda - Campos */}
              <div className={styles.camposLeft}>
                
                {/* 1. Palavra-chave ou código para identificar a Obrigação */}
                <div className={styles.campoCard}>
                  <div className={styles.campoHeader}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.campoIcon}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                      <polyline points="10 9 9 9 8 9"/>
                    </svg>
                    <h4 className={styles.campoTitle}>Palavra-chave ou código para identificar a Obrigação</h4>
                  </div>
                  <div className={styles.campoDescription}>
                    É possível selecionar vários textos em diferentes linhas.
                  </div>
                  <button
                    className={styles.campoButton}
                    onClick={() => salvarCampo("obrigacao")}
                  >
                    <svg width="14" height="14" className={styles.campoButtonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                    Selecione um texto a esquerda e clique para salvar
                  </button>
                  
                  {/* Campos salvos para obrigação */}
                  {camposSalvos
                    .filter((c) => c.tipo_campo === "obrigacao")
                    .map((campo, i) => (
                      <div key={i} className={styles.campoSaved}>
                        <div className={styles.campoSavedInfo}>
                          <div className={styles.campoSavedTitle}>
                            Obrigatório - Texto - linha {campo.posicao_linha + 1}
                          </div>
                          <div className={styles.campoSavedValue}>
                            {campo.valor_esperado || campo.regex_validacao || "Valor não definido"}
                          </div>
                        </div>
                        <button
                          onClick={() => removerCampo(campo.id)}
                          className={styles.campoSavedRemove}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                </div>

                {/* 2. Inscrição ou campo adicional para identificar o cliente */}
                <div className={styles.campoCard}>
                  <div className={styles.campoHeader}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.campoIcon}>
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <h4 className={styles.campoTitle}>Inscrição ou campo adicional para identificar o cliente:</h4>
                  </div>
                  
                  {/* Opção 1 */}
                  <div className={styles.campoSelect}>
                    <div className={styles.campoSelectLabel}>
                      Opção 1. Selecione o tipo da inscrição
                    </div>
                    <select className={styles.formSelect}>
                      <option>CNPJ</option>
                      <option>CPF</option>
                      <option>IE</option>
                    </select>
                  </div>
                  
                  <button
                    className={styles.campoButton}
                    onClick={() => salvarCampo("inscricao")}
                  >
                    <svg width="14" height="14" className={styles.campoButtonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                    Selecione um texto a esquerda e clique para salvar
                  </button>
                  
                  {/* Campos salvos para inscrição */}
                  {camposSalvos
                    .filter((c) => c.tipo_campo === "inscricao")
                    .map((campo, i) => (
                      <div key={i} className={styles.campoSaved}>
                        <div className={styles.campoSavedInfo}>
                          <div className={styles.campoSavedTitle}>
                            Inscrição - CNPJ - linha {campo.posicao_linha + 1}
                          </div>
                          <div className={styles.campoSavedValue}>
                            {campo.valor_esperado || campo.regex_validacao || "Valor não definido"}
                          </div>
                        </div>
                        <button
                          onClick={() => removerCampo(campo.id)}
                          className={styles.campoSavedRemove}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                </div>

                {/* 3. Competência da obrigação */}
                <div className={styles.campoCard}>
                  <div className={styles.campoHeader}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.campoIcon}>
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <h4 className={styles.campoTitle}>Competência da obrigação</h4>
                  </div>
                  <div className={styles.campoDescription}>
                    Selecione a ordem correta da data conforme o arquivo. Exemplo: 01/2025 = Mês e ano.
                  </div>
                  <select className={styles.formSelect}>
                    <option>Mês/Ano</option>
                    <option>Dia/Mês/Ano</option>
                    <option>Ano/Mês</option>
                    <option>Apenas ano</option>
                  </select>
                  
                  <button
                    className={styles.campoButton}
                    onClick={() => salvarCampo("competencia")}
                  >
                    <svg width="14" height="14" className={styles.campoButtonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                    Selecione um texto a esquerda e clique para salvar
                  </button>
                  
                  {/* Campos salvos para competência */}
                  {camposSalvos
                    .filter((c) => c.tipo_campo === "competencia")
                    .map((campo, i) => (
                      <div key={i} className={`${styles.campoSaved} ${styles.campoCompetencia}`}>
                        <div className={styles.campoSavedInfo}>
                          <div className={styles.campoSavedTitle}>
                            Competência - Mês/Ano - linha {campo.posicao_linha + 1}
                          </div>
                          <div className={styles.campoSavedValue}>
                            {campo.valor_esperado || campo.regex_validacao || "Valor não definido"}
                          </div>
                        </div>
                        <button
                          onClick={() => removerCampo(campo.id)}
                          className={styles.campoSavedRemove}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                </div>

                {/* Opção adicional */}
                <div className={styles.opcaoAdicional}>
                  <label className={styles.opcaoAdicionalLabel}>
                    <input type="checkbox" className={styles.opcaoAdicionalCheckbox} />
                    <span className={styles.opcaoAdicionalText}>Buscar informações em diferentes linhas.</span>
                  </label>
                  <div className={styles.opcaoAdicionalDescription}>
                    Essa opção é ideal para arquivos de contracheque/holerite. <a href="#" className={styles.opcaoAdicionalLink}>Saiba +</a>
                  </div>
                </div>
              </div>

              {/* Direita - Texto do PDF */}
              <div className={styles.camposRight}>
                <div className={styles.textoPdfContainer}>
                  {linhasPdf.map((linha, index) => {
                    const camposDaLinha = camposSalvos.filter(c => c.posicao_linha === index);
                    const temCampos = camposDaLinha.length > 0;
                    
                    return (
                      <div
                        key={index}
                        className={`${styles.pdfLine} ${textoSelecionado === linha ? styles.pdfLineSelected : ''}`}
                        onMouseUp={() => {
                          const selecionado = getTextoSelecionado();
                          if (selecionado) {
                            setTextoSelecionado(selecionado);
                            setLinhaSelecionadaIndex(index);
                          } else {
                            setTextoSelecionado(linha);
                            setLinhaSelecionadaIndex(index);
                          }
                        }}
                      >
                        <span className={styles.pdfLineNumber}>
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span
                          className={`${styles.pdfLineText} ${textoSelecionado === linha ? styles.pdfLineTextSelected : ''}`}
                        >
                          {linha}
                        </span>
                        
                        {/* Indicadores de campos salvos */}
                        {temCampos && (
                          <div className={styles.campoIndicators}>
                            {camposDaLinha.map((campo, i) => (
                              <span
                                key={i}
                                className={`${styles.campoIndicator} ${
                                  campo.tipo_campo === "obrigacao" ? styles.campoIndicatorObrigacao :
                                  campo.tipo_campo === "inscricao" ? styles.campoIndicatorInscricao :
                                  styles.campoIndicatorCompetencia
                                }`}
                                title={`${campo.tipo_campo} - linha ${campo.posicao_linha + 1}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {textoSelecionado && (
                  <div className={styles.textoSelecionado}>
                    Texto selecionado: <strong>{textoSelecionado}</strong>
                  </div>
                )}

                <div className={styles.pdfInfo}>
                  Apenas a primeira página.
                </div>
              </div>
            </div>
          </div>
        )}

        {etapa === 3 && (
          <div className={styles.atividadesSection}>
            <div className={styles.atividadesHeader}>
              <button className={styles.buttonTestar} onClick={() => setModalTestarAberto(true)}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Testar campos
              </button>
            </div>
            <h3 className={styles.atividadesTitle}>Atividades vinculadas a este modelo</h3>
            {atividadesVinculadas.length === 0 ? (
              <div className={styles.atividadesEmpty}>Nenhuma atividade vinculada a este modelo.</div>
            ) : (
              <table className={styles.atividadesTable}>
                <thead>
                  <tr>
                    <th>Obrigação</th>
                    <th>Atividade</th>
                    <th>Competência</th>
                  </tr>
                </thead>
                <tbody>
                  {atividadesVinculadas.map((a) => (
                    <tr key={a.id}>
                      <td>{a.obrigacao_nome}</td>
                      <td>{a.texto}</td>
                      <td>{a.competencia || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            
            {/* Modal de Testar Campos */}
            {modalTestarAberto && (
              <div className={styles.modalOverlay} onClick={() => { setModalTestarAberto(false); setArquivoTeste(null); setResultadoTeste(null); }}>
                <div className={styles.modalTestarContent} onClick={(e) => e.stopPropagation()}>
                  <h2 className={styles.modalTestarTitle}>Testando modelo</h2>
                  <div className={styles.modalTestarDropZone}>
                    {!arquivoTeste ? (
                      <label className={styles.modalTestarLabel}>
                        <input type="file" accept="application/pdf" className={styles.modalTestarInput} onChange={e => setArquivoTeste(e.target.files?.[0] || null)} />
                        <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className={styles.modalTestarIcon}>
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="7 10 12 15 17 10"/>
                          <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        <div className={styles.modalTestarText}>Por favor, clique ou arraste o arquivo PDF para testar.</div>
                      </label>
                    ) : (
                      <div className={styles.modalTestarFile}>{arquivoTeste.name}</div>
                    )}
                  </div>
                  <div className={styles.modalTestarActions}>
                    <button 
                      className={`${styles.modalTestarButton} ${styles.modalTestarButtonSecondary}`}
                      onClick={() => { setModalTestarAberto(false); setArquivoTeste(null); setResultadoTeste(null); }}
                    >
                      Fechar
                    </button>
                    <button 
                      className={styles.modalTestarButton}
                      disabled={!arquivoTeste || testando} 
                      onClick={async () => {
                        if (!arquivoTeste) return;
                        setTestando(true);
                        setResultadoTeste(null);
                        const formData = new FormData();
                        formData.append("arquivo", arquivoTeste);
                        try {
                          const token = getToken();
                          const empresaId = getEmpresaId();
                          const res = await fetch(`${BASE_URL}/gestao/pdf-layout/${idPronto}/testar-pdf`, {
                            method: "POST",
                            headers: {
                              Authorization: `Bearer ${token}`,
                              "X-Empresa-Id": empresaId,
                              "empresaid": empresaId
                            },
                            body: formData
                          });
                          const data = await res.json();
                          setResultadoTeste(data);
                        } catch (err) {
                          setResultadoTeste({ erro: "Erro ao testar PDF." });
                        } finally {
                          setTestando(false);
                        }
                      }}
                    >
                      {testando ? "Testando..." : "Testar"}
                    </button>
                  </div>
                  {resultadoTeste && (
                    <div className={styles.modalTestarResultado}>
                      {resultadoTeste.erro && <div className={styles.modalTestarErro}>{resultadoTeste.erro}</div>}
                      {resultadoTeste.resultados && resultadoTeste.resultados.length > 0 && (
                        <table className={styles.modalTestarTable}>
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Campo</th>
                              <th>Resultado</th>
                              <th>Sugestão</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resultadoTeste.resultados.map((r, idx) => (
                              <tr key={idx}>
                                <td>{idx + 1}</td>
                                <td>{r.campo}</td>
                                <td>{r.resultado}</td>
                                <td>
                                  <div>
                                    <div><strong>Detectado:</strong> {r.sugestao_detectada}</div>
                                    {r.valor_mapeado && (
                                      <div className={styles.modalTestarSugestao}>
                                        <strong>Mapeado:</strong> {r.valor_mapeado}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal para anexar arquivo */}
        {modalAberto && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <h3 className={styles.modalTitle}>Anexando Modelo</h3>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setArquivo(e.target.files[0]);
                  }
                }}
                className={styles.modalFileInput}
              />
              {arquivo && (
                <p className={styles.modalFileInfo}>✅ {arquivo.name} ({(arquivo.size / 1024 / 1024).toFixed(1)} MiB)</p>
              )}
              <div className={styles.modalActions}>
                <button onClick={() => setModalAberto(false)} className={`${styles.modalButton} ${styles.modalButtonSecondary}`}>
                  Fechar
                </button>
                <button onClick={handleUpload} className={`${styles.modalButton} ${styles.modalButtonPrimary}`}>
                  Anexar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}