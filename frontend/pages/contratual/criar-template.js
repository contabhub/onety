import React, { useState, useEffect } from "react";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import styles from "../../styles/contratual/Templates.module.css";
import TiptapEditor from "../../components/contratual/TiptapEditor";
import ListaVariaveis from "../../components/contratual/ListaVariaveis";
import { useRouter } from "next/router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { ToastContainer, toast, Bounce } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';



export default function CriarTemplate() {
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [showVariaveis, setShowVariaveis] = useState(false);
  const router = useRouter();
  const [isGlobal, setIsGlobal] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [isStraton, setIsStraton] = useState(false);
  const [isFuncionario, setIsFuncionario] = useState(false);

  useEffect(() => {
    const userRaw = localStorage.getItem("userData");
    if (userRaw) {
      const parsed = JSON.parse(userRaw);
      setUserRole(parsed.permissoes?.adm ? String(parsed.permissoes.adm[0]).toLowerCase() : "");
    }
  }, []);

  const handleChange = (newContent) => {
    setConteudo(newContent);
  };

  const handleInsertVariable = (variableName) => {
    const tag = `{{${variableName}}}`;
    setConteudo((prevContent) => prevContent + " " + tag);
    toast.success(`Variável "${variableName}" adicionada com sucesso!`);
    setShowVariaveis(false);
  };



  const handleCreateTemplate = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("userData");

    if (!token) {
      setError("Você precisa estar logado.");
      return;
    }
    const user = JSON.parse(userRaw);

    if (!titulo.trim() || !conteudo.trim()) {
      setError("O título e conteúdo do template são obrigatórios.");
      return;
    }

    // Garantir exclusividade e obrigatoriedade: exatamente uma opção
    if ((isStraton && isFuncionario) || (!isStraton && !isFuncionario)) {
      setError("Selecione exatamente uma opção: Straton ou Funcionário.");
      return;
    }

    try {
      const payload = {
        nome: titulo,
        conteudo: conteudo,
        global: isGlobal ? 1 : 0,
        empresa_id: isGlobal ? null : user?.EmpresaId,
        straton: isStraton ? 1 : 0,
        funcionario: isFuncionario ? 1 : 0,
      };

      console.log("Payload enviado para API:", payload);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/contratual/modelos-contrato`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        toast.success("Template criado com sucesso!");
        setTimeout(() => router.push(`/contratual/templates`), 1500);
        setTitulo("");
        setConteudo("");
        setIsStraton(false);
        setIsFuncionario(false);
        setError("");
      } else {
        const errData = await response.json();
        toast.error(errData.error || "Erro ao criar template.");
        setSuccessMessage("");
      }
    } catch (err) {
      setError("Erro ao conectar com o servidor.");
      setSuccessMessage("");
    }
  };





  return (
    <>
      <div className={styles.page}>
        <PrincipalSidebar />
        <div className={styles.pageContent}>
          <div className={styles.pageContainer}>
            <button className={styles.backButton} onClick={() => router.back()}>
              <span className={styles.iconWrapper}>
                <FontAwesomeIcon icon={faArrowLeft} />
              </span>
              Voltar
            </button>

            <div className={styles.templatesHeader}>
              <h1 className={styles.title}>Criar Novo Template</h1>
            </div>
      <div className={styles.container}>
        {error && <p className={styles.error}>{error}</p>}
        {successMessage && <p className={styles.success}>{successMessage}</p>}

        <form onSubmit={handleCreateTemplate} className={styles.form}>
          <div>
            <label htmlFor="titulo">Nome</label>
            <input
              id="titulo"
              type="text"
              placeholder="Ex: Contrato de Prestação de Serviços"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
            />
          </div>

          <div className={styles.templateContent}>
            <label htmlFor="conteudo">Conteúdo do Template</label>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setShowVariaveis(true);
              }}
              className={styles.buttonSecundario}
            >
              Inserir Variável
            </button>

            {showVariaveis && (
              <ListaVariaveis
                handleInsertVariable={handleInsertVariable}
                setShowVariaveis={setShowVariaveis}
              />
            )}

            <TiptapEditor
              content={conteudo}
              onChange={handleChange}
              placeholder="Digite o conteúdo do template..."
              onImageUrlWarning={(message) => toast.warning(message)}
              showVariableButton={false}
            />
          </div>
          
          <div className={`${styles.checkContainer} ${styles.checkRowLeft}`}>
            <div className={styles.checkboxWrapper}>
              <label className={styles.checkboxLabel} title="Para o módulo financeiro (Straton). Ao assinar, serão solicitadas informações adicionais para gerar parcelas automaticamente no financeiro.">
                <input
                  type="checkbox"
                  checked={isStraton}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsStraton(checked);
                    if (checked) setIsFuncionario(false);
                  }}
                />
                Financeiro
              </label>
            </div>

            <div className={styles.checkboxWrapper}>
              <label className={styles.checkboxLabel} title="Para cadastro de funcionário. Ao assinar, o usuário será cadastrado e vinculado à empresa, departamento e cargo.">
                <input
                  type="checkbox"
                  checked={isFuncionario}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsFuncionario(checked);
                    if (checked) setIsStraton(false);
                  }}
                />
                Funcionário
              </label>
            </div>

            {userRole === "superadmin" && (
              <div className={styles.checkboxWrapper}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={isGlobal}
                    onChange={() => setIsGlobal(!isGlobal)}
                  />
                  Template global ?
                </label>
              </div>
            )}
          </div>

          <div className={styles.buttonContainer}>

            <button type="submit" className={styles.button}>
              Criar Template
            </button>
          </div>
        </form>
      </div>

            <ToastContainer
              position="top-right"
              autoClose={5000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick={false}
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="colored"
              transition={Bounce}
            />
          </div>
        </div>
      </div>
    </>
  );
}

