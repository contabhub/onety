"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import PrincipalSidebar from "../../../components/onety/principal/PrincipalSidebar";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import styles from "../../../styles/gestao/EnquetePage.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

const ConfirmModal = ({ show, onConfirm, onClose, message }) => {
  if (!show) return null;
  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalBox}>
        <h2>Excluir</h2>
        <div className={styles.modalBody}>
          <span>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="#FFB557" d="M1 21L12 2l11 19zm11-3q.425 0 .713-.288T13 17t-.288-.712T12 16t-.712.288T11 17t.288.713T12 18m-1-3h2v-5h-2z"/></svg>
          </span>
          <p>{message}</p>
        </div>
        <div className={styles.modalActions}>
          <button className={styles.btnDanger} onClick={onConfirm}>Excluir</button>
          <button className={styles.btnCancel} onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
};

const PerguntaDetalhePage = () => {
  const router = useRouter();
  const perguntaId = router.query?.id;

  const [pergunta, setPergunta] = useState(null);
  const [respostas, setRespostas] = useState([]);
  const [particularidades, setParticularidades] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [particularidadeSelecionada, setParticularidadeSelecionada] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalFechando, setModalFechando] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [particularidadeForm, setParticularidadeForm] = useState({
    id: "",
    nome: "",
    descricao: "",
    categoriaId: ""
  });

  useEffect(() => {
    if (perguntaId) {
      fetchPergunta();
      fetchRespostas();
      fetchParticularidades();
      fetchCategorias();
    }
  }, [perguntaId]);

  const fetchPergunta = async () => {
    try {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        console.error("EmpresaId não encontrado no storage");
        setLoading(false);
        return;
      }
      
      const url = `${BASE_URL}/gestao/enquete/perguntas/${perguntaId}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId.toString()
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Dados da pergunta:", data);
      setPergunta(data);
    } catch (error) {
      console.error("Erro ao buscar pergunta:", error);
      toast.error("Erro ao carregar dados da pergunta");
    } finally {
      setLoading(false);
    }
  };

  const fetchRespostas = async () => {
    try {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        console.error("EmpresaId não encontrado no storage");
        return;
      }
      
      const url = `${BASE_URL}/gestao/enquete/respostas/${perguntaId}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId.toString()
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setRespostas(data);
    } catch (error) {
      console.error("Erro ao buscar respostas:", error);
      toast.error("Erro ao carregar respostas");
    }
  };

  const fetchParticularidades = async () => {
    try {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        console.error("EmpresaId não encontrado no storage");
        return;
      }
      
      const url = `${BASE_URL}/gestao/enquete/particularidades`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId.toString()
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setParticularidades(data);
    } catch (error) {
      console.error("Erro ao buscar particularidades:", error);
      toast.error("Erro ao carregar particularidades");
    }
  };

  const fetchCategorias = async () => {
    try {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        console.error("EmpresaId não encontrado no storage");
        return;
      }
      
      const url = `${BASE_URL}/gestao/enquete/categorias`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId.toString()
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setCategorias(data);
    } catch (error) {
      console.error("Erro ao buscar categorias:", error);
    }
  };

  const handleSavePergunta = async () => {
    try {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        toast.error("EmpresaId não encontrado no storage");
        return;
      }
      
      const url = `${BASE_URL}/gestao/enquete/perguntas/${perguntaId}`;
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Empresa-Id": empresaId.toString()
        },
        body: JSON.stringify({
          pergunta: pergunta.texto,
          multiplaEscolha: pergunta.tipo === 'múltipla'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      toast.success("Pergunta atualizada!");
    } catch (error) {
      console.error("Erro ao atualizar pergunta:", error);
      toast.error("Erro ao atualizar pergunta");
    }
  };

  const handleAddResposta = async () => {
    if (!particularidadeSelecionada) {
      toast.error("Selecione uma particularidade");
      return;
    }
    try {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        toast.error("EmpresaId não encontrado no storage");
        return;
      }
      
      const url = `${BASE_URL}/gestao/enquete/respostas`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Empresa-Id": empresaId.toString()
        },
        body: JSON.stringify({
          perguntaId,
          particularidadeId: particularidadeSelecionada
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setParticularidadeSelecionada('');
      fetchRespostas();

      toast.success("Resposta adicionada com sucesso!");
    } catch (error) {
      console.error("Erro ao adicionar resposta:", error);
      toast.error("Erro ao adicionar resposta");
    }
  };

  const handleDeleteResposta = async (id) => {
    try {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        toast.error("EmpresaId não encontrado no storage");
        return;
      }
      
      const url = `${BASE_URL}/gestao/enquete/respostas/${id}`;
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId.toString()
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      fetchRespostas();
      toast.success("Resposta removida com sucesso!");
    } catch (error) {
      console.error("Erro ao remover resposta:", error);
      toast.error("Erro ao remover resposta");
    }
  };

  const handleNovaParticularidade = () => {
    setModoEdicao(false);
    setParticularidadeForm({ id: "", nome: "", descricao: "", categoriaId: "" });
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalFechando(true);
    setTimeout(() => {
      setModalFechando(false);
      setModalAberto(false);
      setModoEdicao(false);
      setParticularidadeForm({ id: "", nome: "", descricao: "", categoriaId: "" });
    }, 300);
  };

  const handleSalvarParticularidade = async () => {
    const { id, nome, descricao, categoriaId } = particularidadeForm;
    const payload = { nome, descricao, categoriaId };

    const nomeTrim = nome.trim().toLowerCase();
    const nomeExiste = particularidades.some(
      (p) => p.nome.trim().toLowerCase() === nomeTrim && p.id !== id
    );

    if (nomeExiste) {
      toast.warning(`Ops, o nome ${nome} já existe, altere antes de salvar.`);
      return;
    }

    try {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        toast.error("EmpresaId não encontrado no storage");
        return;
      }
      
      const url = id 
        ? `${BASE_URL}/gestao/enquete/particularidades/${id}`
        : `${BASE_URL}/gestao/enquete/particularidades`;
      
      const response = await fetch(url, {
        method: id ? "PUT" : "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Empresa-Id": empresaId.toString()
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      toast.success("Particularidade salva com sucesso!");
      fecharModal();
      fetchParticularidades();
    } catch (error) {
      console.error("Erro ao salvar particularidade:", error);
      toast.error("Erro ao salvar particularidade");
    }
  };

  // Se ainda não carregou os dados, mostra loading
  if (loading) {
    return (
      <>
        <PrincipalSidebar />
        <div className={styles.page}>
          <div className={styles.card}>
            <p>Carregando...</p>
          </div>
        </div>
      </>
    );
  }

  // Se não encontrou a pergunta
  if (!pergunta) {
    return (
      <>
        <PrincipalSidebar />
        <div className={styles.page}>
          <div className={styles.card}>
            <p>Pergunta não encontrada</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PrincipalSidebar />
      <ToastContainer />
      <ConfirmModal show={showModal} onConfirm={() => {}} onClose={() => setShowModal(false)} message="" />

      {/* Modal de Particularidade */}
      {modalAberto && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalBox}>
            <h2 className={styles.sectionTitle}>
              {modoEdicao ? "Editar Particularidade" : "Nova Particularidade"}
            </h2>

            <div className={styles.modalForm}>
              <div className={styles.formRow}>
                <label className={styles.formLabelLeft}>Nome *</label>
                <div className={styles.fieldControl}>
                  <input
                    type="text"
                    value={particularidadeForm.nome}
                    onChange={(e) =>
                      setParticularidadeForm((prev) => ({
                        ...prev,
                        nome: e.target.value,
                      }))
                    }
                    className={`${styles.inputField} ${styles.inputFull}`}
                    placeholder="Nome da particularidade"
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabelLeft}>Descrição *</label>
                <div className={styles.fieldControl}>
                  <textarea
                    value={particularidadeForm.descricao}
                    onChange={(e) =>
                      setParticularidadeForm((prev) => ({
                        ...prev,
                        descricao: e.target.value,
                      }))
                    }
                    className={`${styles.inputField} ${styles.textareaField} ${styles.textareaFull}`}
                    placeholder="Descrição"
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabelLeft}>Categoria *</label>
                <div className={styles.fieldControl}>
                  <select
                    value={particularidadeForm.categoriaId}
                    onChange={(e) =>
                      setParticularidadeForm((prev) => ({
                        ...prev,
                        categoriaId: e.target.value,
                      }))
                    }
                    className={`${styles.inputField} ${styles.selectField} ${styles.selectFull}`}
                  >
                    <option value="">Selecione...</option>
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.modalActions}>
              {modoEdicao && (
                <button onClick={() => {}} className={styles.btnDanger}>
                  Excluir
                </button>
              )}
              <button onClick={handleSalvarParticularidade} className={styles.btnSuccess}>
                Salvar
              </button>
              <button onClick={fecharModal} className={styles.btnCancel}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.row}>
            <div className={styles.left}>
              <label className={styles.label}>Id</label>
              <input type="text" value={pergunta.id || ''} readOnly className={`${styles.inputField} ${styles.readonly}`} />

              <label className={styles.label}>Classificação</label>
              <input type="text" value={pergunta.classificacaoGrupo || ''} readOnly className={`${styles.inputField} ${styles.readonly}`} />

              <label className={styles.label}>Pergunta *</label>
              <textarea
                value={pergunta.texto || ''}
                onChange={(e) => setPergunta({ ...pergunta, texto: e.target.value })}
                className={`${styles.inputField} ${styles.textareaField}`}
              />

              <label className={styles.label}>Quantidade Respostas *</label>
              <select
                value={pergunta.tipo === 'múltipla' ? 'múltipla' : 'única'}
                onChange={(e) => setPergunta({ ...pergunta, tipo: e.target.value })}
                className={`${styles.inputField} ${styles.selectField}`}
              >
                <option value="única">Apenas 1</option>
                <option value="múltipla">Várias</option>
              </select>

              <button className={styles.btnSuccess} onClick={handleSavePergunta}>Salvar</button>
            </div>

            <div className={styles.right}>
              <h3 className={styles.sectionTitle}>Respostas</h3>
              <div className={styles.inline}>
                <div className={styles.inlineGroup}>
                  <label className={styles.label}>Particularidade *</label>
                  <select
                    value={particularidadeSelecionada}
                    onChange={(e) => setParticularidadeSelecionada(e.target.value)}
                    className={styles.selectField}
                  >
                    <option value="">Selecione...</option>
                    {particularidades.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>
                <button className={`${styles.btnSuccess} ${styles.smallButton}`} onClick={handleAddResposta}>Adicionar</button>
                <button 
                  className={`${styles.btnSuccess} ${styles.smallButton}`}
                  onClick={handleNovaParticularidade}
                  title="Criar uma nova particularidade"
                >
                  + Nova
                </button>
              </div>

              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>#</th>
                    <th className={styles.th}>Classificação</th>
                    <th className={styles.th}>Resposta</th>
                    <th className={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {respostas.map((r, index) => (
                    <tr key={r.id}>
                      <td className={styles.td}>{index + 1}</td>
                      <td className={styles.td}>{(index + 1).toString().padStart(2, '0')}</td>
                      <td className={styles.td}>
                        <span>
                          {r.id} - {r.particularidade}
                        </span>
                      </td>
                      <td className={styles.td}>
                        <button className={styles.iconButton} onClick={() => handleDeleteResposta(r.id)}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="none" stroke="#FF1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7h16m-10 4v6m4-6v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PerguntaDetalhePage;