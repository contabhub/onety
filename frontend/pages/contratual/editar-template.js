import { useEffect, useState } from "react";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import SpaceLoader from "../../components/onety/menu/SpaceLoader";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import styles from "../../styles/contratual/Templates.module.css";
import { useRouter } from "next/router";
import TiptapEditor from "../../components/contratual/TiptapEditor";
import ListaVariaveis from "../../components/contratual/ListaVariaveis";
import { ToastContainer, toast, Bounce } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


export default function EditarTemplate() {
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [showVariaveis, setShowVariaveis] = useState(false);
  const router = useRouter();
  const { id } = router.query;
  const [isGlobal, setIsGlobal] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [isLoading, setIsLoading] = useState(true);
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



  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) {
      setIsLoading(false);
      return;
    }

    // Buscar os dados do template pelo ID
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/modelos-contrato/${id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((data) => {
        console.log('Conteúdo carregado do template:', data);
        setTitulo(data.nome || data.name);
        setConteudo(data.conteudo || data.content);
        setIsGlobal(data.global || data.is_global);
        setIsStraton(Boolean(data.straton));
        setIsFuncionario(Boolean(data.funcionario));
        setIsLoading(false);
      })
      .catch((err) => {
        setError("Erro ao carregar o template.");
        console.error(err);
        setIsLoading(false);
      });
  }, [id]);



  const handleUpdateTemplate = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Você precisa estar logado.");
      return;
    }

    const userRaw = localStorage.getItem("userData");
    const user = userRaw ? JSON.parse(userRaw) : null;
    const empresaId = user?.EmpresaId;

    // Garantir exclusividade e obrigatoriedade: exatamente uma opção
    if ((isStraton && isFuncionario) || (!isStraton && !isFuncionario)) {
      setError("Selecione exatamente uma opção: Straton ou Funcionário.");
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/modelos-contrato/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: titulo,
          conteudo: conteudo,
          global: isGlobal ? 1 : 0,
          empresa_id: empresaId,
          straton: isStraton ? 1 : 0,
          funcionario: isFuncionario ? 1 : 0,
        }),
      });

      if (response.ok) {
        toast.success("Template atualizado com sucesso!");
        setTimeout(() => router.push(`/contratual/templates`), 1500);
        setError("");
      } else {
        const errData = await response.json();
        toast.error(errData.error || "Erro ao atualizar template.");
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

            {isLoading ? (
              <SpaceLoader 
                size={140} 
                label="Carregando template..." 
                showText={true}
                minHeight={400}
              />
            ) : (
              <>
                <div className={styles.templatesHeader}>
                  <h1 className={styles.title}>Editar Template</h1>
                </div>

                {error && <p className={styles.error}>{error}</p>}
                {successMessage && <p className={styles.success}>{successMessage}</p>}

                <div className={styles.container}>
                  <form onSubmit={handleUpdateTemplate} className={styles.form}>
                    <div>
                      <label htmlFor="titulo">Nome do Template</label>
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
                            Template global?
                          </label>
                        </div>
                      )}
                    </div>

                    <div className={styles.buttonContainer}>
                      <button type="submit" className={styles.button}>
                        Salvar Alterações
                      </button>
                    </div>
                  </form>
                </div>
              </>
            )}

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