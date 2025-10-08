import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Layout from "../../components/layout/Layout";
import styles from "../../styles/Documento.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";

export default function VisualizarTemplate() {
  const router = useRouter();
  const { id } = router.query;
  const [template, setTemplate] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchTemplate();
  }, [id]);

  const fetchTemplate = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("Você precisa estar logado para visualizar o template.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/templates/${id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) throw new Error("Erro ao buscar o template.");
      const data = await res.json();
      setTemplate(data);
    } catch (err) {
      setError(err.message || "Erro ao carregar o template.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <button className={styles.backButton} onClick={() => router.back()}>
        <span className={styles.iconWrapper}>
          <FontAwesomeIcon icon={faArrowLeft} />
        </span>
        Voltar
      </button>
      <div className={styles.contractContainer}>
        {loading ? (
          <p className={styles.loading}>Carregando template...</p>
        ) : error ? (
          <p className={styles.error}>{error}</p>
        ) : (
          <>
            {/* Banner superior */}
            {/* <div className={styles.header}>
              <img src="/img/banner.png" alt="Banner da empresa" className={styles.logo} />
            </div> */}

            {/* Conteúdo principal */}
            <div className={styles.contractBody}>
              {/* <h2 className={styles.sectionTitle}>Visualização do Template</h2> */}
              <div className={styles.contractContent}>
                {template?.content ? (
                  <div
                    className="template-render"
                    dangerouslySetInnerHTML={{
                      __html: template.content.replace(/\n/g, "<br/>"),
                    }}
                  />

                ) : (
                  <p className={styles.error}>
                    ⚠️ O conteúdo do template está vazio.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
