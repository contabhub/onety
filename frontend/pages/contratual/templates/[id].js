import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import PrincipalSidebar from "../../../components/onety/principal/PrincipalSidebar";
import SpaceLoader from "../../../components/onety/menu/SpaceLoader";
import styles from "../../../styles/contratual/Documento.module.css";
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
        `${process.env.NEXT_PUBLIC_API_URL}/contratual/modelos-contrato/${id}`,
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
    <>
      <PrincipalSidebar />
      <div className={styles.pageContent}>
        <div className={styles.pageContainer}>
          <button className={styles.backButton} onClick={() => router.back()}>
            <span className={styles.iconWrapper}>
              <FontAwesomeIcon icon={faArrowLeft} />
            </span>
            Voltar
          </button>

          {loading ? (
            <SpaceLoader
              size={140}
              label="Carregando template..."
              showText={true}
              minHeight={400}
            />
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : (
            <>
              <div className={styles.contractContainer}>
                {loading ? (
                  <p className={styles.loading}>Carregando template...</p>
                ) : error ? (
                  <p className={styles.error}>{error}</p>
                ) : (
                  <>


                    {/* Conteúdo principal */}
                    <div className={styles.contractBody}>
                      {/* <h2 className={styles.sectionTitle}>Visualização do Template</h2> */}
                      <div className={styles.contractContent}>
                        {template?.conteudo ? (
                          <div
                            className="template-render"
                            dangerouslySetInnerHTML={{
                              __html: template.conteudo
                                // Remove quebras de linha desnecessárias entre variáveis
                                .replace(/\s*\n\s*/g, ' ')
                                // Remove espaços múltiplos
                                .replace(/\s{2,}/g, ' ')
                                // Preserva quebras de linha intencionais (quando há quebra dupla)
                                .replace(/\n\n/g, '<br/><br/>')
                                // Converte quebras de linha simples restantes em espaços
                                .replace(/\n/g, ' ')
                                // Remove espaços antes e depois de tags HTML
                                .replace(/\s+<\/?(p|div|br|h[1-6]|ul|ol|li|strong|em|u|span)[^>]*>\s*/gi, (match) => {
                                  return match.trim()
                                })
                                // Remove espaços entre variáveis e pontuação
                                .replace(/(\{\{[^}]+\}\})\s*([,.;:!?])/g, '$1$2')
                                // Remove espaços antes de variáveis quando seguem pontuação
                                .replace(/([,.;:!?])\s*(\{\{[^}]+\}\})/g, '$1$2')
                                .trim()
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
            </>
          )}
        </div>
      </div>
    </>
  );
}
