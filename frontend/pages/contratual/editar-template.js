import { useEffect, useState } from "react";
import Layout from "../components/layout/Layout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/Templates.module.css";
import { useRouter } from "next/router";
import TiptapEditor from "../components/TiptapEditor";
import ListaVariaveis from "../components/assinador/ListaVariaveis";
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

  useEffect(() => {
    const userRaw = localStorage.getItem("user");
    if (userRaw) {
      const parsed = JSON.parse(userRaw);
      setUserRole(parsed.role?.toLowerCase() || "");
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
    if (!id) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    // Buscar os dados do template pelo ID
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/templates/${id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((data) => {
        console.log('Conteúdo carregado do template:', data.content);
        setTitulo(data.name);
        setConteudo(data.content);
        setIsGlobal(data.is_global); // <-- define se o template já é global

      })
      .catch((err) => {
        setError("Erro ao carregar o template.");
        console.error(err);
      });
  }, [id]);



  const handleUpdateTemplate = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Você precisa estar logado.");
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/templates/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: titulo,
          content: conteudo,
          is_global: isGlobal,
        }),
      });

      if (response.ok) {
        toast.success("Template atualizado com sucesso!");
        setTimeout(() => router.push(`/templates`), 1500);
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
    <Layout>
      <button className={styles.backButton} onClick={() => router.back()}>
        <FontAwesomeIcon icon={faArrowLeft} /> Voltar
      </button>
      <div className={styles.container}>
        <h1 className={styles.title}>Editar Template</h1>

        {error && <p className={styles.error}>{error}</p>}
        {successMessage && <p className={styles.success}>{successMessage}</p>}

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
          
          <div className={styles.checkContainer}>
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
    </Layout>
  );
}