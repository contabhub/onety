import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import PrincipalSidebar from "../../../components/onety/principal/PrincipalSidebar";
import styles from "../../../styles/contratual/Documento.module.css";
import { useAuthRedirect } from "../../../utils/auth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload, faArrowLeft, faPaperPlane, faTrash } from "@fortawesome/free-solid-svg-icons";
import PDFViewer from "../../../components/contratual/PDFViewer";

export default function Contrato() {
  const router = useRouter();
  const { id } = router.query;
  const [contrato, setContrato] = useState(null);
  const [signatarios, setSignatarios] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [assinaturas, setAssinaturas] = useState([]);

  const [sendingEmail, setSendingEmail] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useAuthRedirect();



  const downloadPDFBackend = async () => {
    try {
      const token = localStorage.getItem("token");

      // Garante que a folha de assinaturas está gerada (ESSA É A LINHA NOVA!)
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos/${id}/generate-signatures-base64`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos/${id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Erro ao buscar o PDF base64");

      const data = await response.json();

      if (!data.base64) throw new Error("Base64 não encontrado na resposta");

      // Converter base64 em blob
      const binaryString = atob(data.base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: "application/pdf" });

      // Criar link temporário
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `contrato-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erro ao baixar o contrato:", err);
      alert("Erro ao baixar o contrato.");
    }
  };



  useEffect(() => {
    if (!id) return;

    async function fetchContrato() {
      const token = localStorage.getItem("token");

      if (!token) {
        setError("Você precisa estar logado para acessar este contrato.");
        setLoading(false);
        return;
      }

      try {
        // Buscar contrato
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos/${id}`, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });

        if (!res.ok) throw new Error("Erro ao buscar contrato.");
        const data = await res.json();

        console.log("📄 Dados do contrato:", data); // <-- Verifica se `content` está presente
        setContrato(data);

        // Buscar signatários do contrato
        const resSignatarios = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos/${id}/signatories`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const signatariosData = resSignatarios.ok ? await resSignatarios.json() : [];
        setSignatarios(signatariosData);

        // Buscar detalhes das assinaturas
        const resAssinaturas = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos/${id}/signatures`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Se a requisição falhar (provavelmente porque não há assinaturas ainda), retorne um array vazio
        const assinaturasData = resAssinaturas.ok ? await resAssinaturas.json() : [];
        setAssinaturas(assinaturasData);

      } catch (error) {
        setError("Erro ao carregar o contrato.");
      } finally {
        setLoading(false);
      }
    }

    fetchContrato();
  }, [id]);


  const handleEnviarDocumento = async () => {
    const token = localStorage.getItem("token");
    if (!id || !token) return;
    setSendingEmail(true);

    try {
      const emailRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos/${id}/send-email`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signatories: signatarios.map((s) => ({ email: s.email })),
        }),
      });

      if (!emailRes.ok) throw new Error("Erro ao enviar e-mails.");

      // Enviar WhatsApp (Evolution)
      const whatsappRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos/${id}/send-whatsapp-evolution`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      setEnviado(true); // <- aqui
      setTimeout(() => router.push(`/contratual/contratos`), 1200);

    } catch (error) {
      console.error("Erro ao enviar email:", error);
      setError("Erro ao enviar o contrato.");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleExcluirContrato = async () => {
    const token = localStorage.getItem("token");
    if (!id || !token) return;
    setDeleting(true);

    try {
      // Verifica se o contrato tem autentique_id para determinar a rota correta
      const isAutentiqueContract = contrato?.contract?.autentique_id;
      
      const endpoint = isAutentiqueContract 
        ? `${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos-autentique/${id}`
        : `${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos/${id}`;

      console.log(`🗑️ Excluindo contrato via rota: ${isAutentiqueContract ? 'contracts-authentique' : 'contracts'}`);

      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Erro ao excluir contrato.");
      router.push("/contratual/contratos");
    } catch (err) {
      console.error("Erro ao excluir contrato:", err);
      setError("Erro ao excluir contrato.");
    } finally {
      setDeleting(false);
    }
  };

  function formatDateBR(dateTimeStr) {
    if (!dateTimeStr) return "";
    // Trata o formato "2025-07-18T15:48:13.000Z" ou "2025-07-18 15:48:13"
    let [date, time] = dateTimeStr.split(' ');
    if (!time && dateTimeStr.includes('T')) {
      // Trata caso venha no formato ISO
      [date, time] = dateTimeStr.split('T');
      if (time) time = time.replace('.000Z', '').replace('Z', '');
    }
    if (!date || !time) return dateTimeStr;
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year} ${time}`;
  }



  return (
    <div className={styles.principalContainer}>
      <PrincipalSidebar />
      {sendingEmail && (
        <div className={styles.overlayLoader}>Enviando...</div>
      )}
      <button className={styles.backButton} onClick={() => router.back()}>
        <FontAwesomeIcon icon={faArrowLeft} /> Voltar
      </button>
      {/* Status do contrato */}
      {contrato?.contract && (
        <div className={
          contrato.contract.status === "assinado"
            ? styles.bannerSuccess
            : contrato.contract.status === "reprovado"
              ? styles.bannerRejected
              : contrato.contract.status === "expirado"
                ? styles.bannerError
                : styles.bannerWarning
        }>
          Documento {contrato.contract.status === "assinado" ? "assinado" : contrato.contract.status === "reprovado" ? "reprovado" : contrato.contract.status === "expirado" ? "expirado" : "pendente"}
        </div>
      )}

      {contrato?.contract?.status === "reprovado" && contrato.contract.rejected_by_name && (
        <div className={styles.rejectedBy}>
          Rejeitado por: <strong>{contrato.contract.rejected_by_name}</strong>
        </div>
      )}


      {/* 🔥 Exibir progresso das assinaturas */}
      <p className={styles.signatureProgress}>
        <strong>Assinaturas:</strong> {assinaturas.length} / {signatarios.length}
      </p>

      {/* 🔥 Barra de progresso de assinaturas */}
      <div className={styles.progressContainer}>
        <div
          className={styles.progressBar}
          style={{ width: `${(assinaturas.length / signatarios.length) * 100}%` }}
        />
      </div>


      {/* Botões de Download - só aparecem se todos tiverem assinado */}
      {contrato?.contract?.status === "assinado" && (
        <div className={styles.downloadSection}>
          <button
            className={styles.downloadButton}
            style={{ marginLeft: "10px" }}
            onClick={downloadPDFBackend}
          >
            <FontAwesomeIcon icon={faDownload} />
          </button>
        </div>
      )}

      {contrato?.contract?.status === "pendente" && (
        <div className={styles.buttonGroupWrapper}>

          <button
            className={`${styles.dangerActionButton}`}
            onClick={handleExcluirContrato}
            disabled={deleting}
          >
            <FontAwesomeIcon icon={faTrash} />{" "}
            {deleting ? "Excluindo..." : "Excluir Contrato"}
          </button>

          <button
            className={`${styles.primaryActionButton} ${enviado ? styles.emailSuccess : ""}`}
            onClick={handleEnviarDocumento}
            disabled={sendingEmail || enviado}
          >
            <FontAwesomeIcon icon={faPaperPlane} />{" "}
            {sendingEmail ? "Enviando..." : enviado ? "Enviado ✅" : "Enviar Documento"}
          </button>

        </div>
      )}


      <div id="contrato-visual" className={styles.contractContainer}>
        {loading ? (
          <p className={styles.loading}>Carregando contrato...</p>
        ) : error ? (
          <p className={styles.error}>{error}</p>
        ) : (
          contrato && (
            <>

              <div className={styles.contractBody}>
                <div className={styles.contractContent}>
                  {(contrato?.contract?.conteudo || contrato?.contract?.content) ? (
                    (() => {
                      const rawContent = contrato?.contract?.conteudo || contrato?.contract?.content;
                      // Se for URL (Cloudinary), renderiza em iframe
                      if (typeof rawContent === "string" && /^https?:\/\//.test(rawContent)) {
                        return (
                          <iframe
                            src={rawContent}
                            title="Contrato PDF"
                            width="100%"
                            height="1000px"
                            style={{ border: "none" }}
                          />
                        );
                      }
                      // Se começar com base64 de PDF
                      if (typeof rawContent === "string" && rawContent.startsWith("JVBERi0")) {
                        return <PDFViewer base64={rawContent} />;
                      }
                      // Caso contrário, trata como HTML
                      return (
                        <div
                          className="template-render"
                          dangerouslySetInnerHTML={{ __html: String(rawContent).replace(/\n/g, "<br/>") }}
                        />
                      );
                    })()
                  ) : (
                    <p className={styles.error}>⚠️ O conteúdo do contrato não foi encontrado.</p>
                  )}
                </div>


              </div>

              {/* Lista de Signatários */}
              <div className={styles.signatoriesSection}>
                <h2 className={styles.sectionTitle}>Signatários</h2>
                <ul className={styles.signatoriesList}>
                  {signatarios.length > 0 ? (
                    signatarios.map((signatario) => {
                      const assinatura = assinaturas.find(a => a.signatory_id === signatario.id);

                      return (
                        <li key={signatario.id} className={styles.signatory}>
                          {/* Nome e Email do Signatário */}
                          <p><strong>Nome do Signatário:</strong> {signatario.nome}</p>
                          <p><strong>Email do Signatário:</strong> {signatario.email}</p>
                          <p><strong>CPF do Signatário:</strong> {signatario.cpf}</p>
                          <p><strong>Função do Signatário:</strong> {signatario.funcao_assinatura}</p>

                          {/* Mostrar a Assinatura SOMENTE se ela existir */}
                          {assinatura ? (
                            <>

                              <div className={styles.signatoryDetails}>
                                <p><strong>ID do Contrato:</strong> {assinatura.contract_id}</p>
                                <p><strong>IP do Signatário:</strong> {assinatura.endereco_ip}</p>
                                <p><strong>Navegador:</strong> {assinatura.navegador_usuario}</p>
                                <p><strong>Data da Assinatura:</strong> {formatDateBR(assinatura.assinado_em)}</p>

                              </div>
                              <div className={styles.signature}>
                                <p className={styles.signatureText}>{signatario.nome}</p>
                              </div>
                            </>
                          ) : (
                            <p className={styles.pending}>⏳ Aguardando assinatura...</p>
                          )}
                        </li>
                      );
                    })
                  ) : (
                    <p className={styles.noSignatories}>Nenhum signatário encontrado.</p>
                  )}
                </ul>
              </div>


            </>
          )
        )}
      </div>
    </div>
  );
}
