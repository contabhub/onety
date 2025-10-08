import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import styles from "../../styles/Assinar.module.css";
import { faDownload } from "@fortawesome/free-solid-svg-icons"; // certifique-se que está importado
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { notificarRejeicao } from "../../utils/notificarRejeicao";
import PDFViewer from "../../components/assinador/PDFViewer";
import meuLottieJson from '../../assets/Loading.json';
import Lottie from 'lottie-react';


export default function AssinarContrato() {
  const router = useRouter();
  const { hash } = router.query; // Obtendo o hash da URL
  const [contrato, setContrato] = useState(null);
  const [signatario, setSignatario] = useState({
    name: "",
    email: "",
    cpf: "",
    birth_date: "",
  });
  const [assinatura, setAssinatura] = useState(""); // Assinatura digitada
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showModal, setShowModal] = useState(true); // Modal inicia aberto
  const [assinaturaConcluida, setAssinaturaConcluida] = useState(false);
  const [cpfDigitado, setCpfDigitado] = useState("");
  const [cpfInvalido, setCpfInvalido] = useState(false);
  const [querAssinar, setQuerAssinar] = useState(false);
  const [bloquearAssinatura, setBloquearAssinatura] = useState(false);
  const [signatarios, setSignatarios] = useState([]);
  const [assinaturas, setAssinaturas] = useState([]);


  // Buscar contrato pelo hash
  useEffect(() => {
    if (!hash) return;

    async function fetchContrato() {
      try {

        const resSigned = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contracts/token/${hash}/check-signature`);

        if (resSigned.ok) {
          const dataSigned = await resSigned.json();
          setContrato(dataSigned); // direto
          setSignatario({
            name: dataSigned.name,
            email: dataSigned.email,
            cpf: dataSigned.cpf,
            birth_date: dataSigned.birth_date,
          });
          setAssinatura(dataSigned.name); // também já define o nome
          setAssinaturaConcluida(true);
          return;
        }


        // Se ainda não foi assinado, busca o contrato normalmente
        const resContrato = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contracts/token/${hash}`);
        if (!resContrato.ok) {
          throw new Error("Contrato não encontrado ou expirado.");
        }

        const dataContrato = await resContrato.json();
        setContrato(dataContrato);
        if (dataContrato.status === "reprovado") {
          setBloquearAssinatura(true); // impede que outro assine
          setAssinaturaConcluida(true); // força exibição da tela de contrato final
        }

        setSignatario({
          name: dataContrato.name,
          email: dataContrato.email,
          cpf: dataContrato.cpf,
          birth_date: dataContrato.birth_date,
        });
        setAssinatura(dataContrato.name); // 👈 aqui preenche automaticamente

        // Buscar signatários
        const resSignatarios = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contracts/token/${hash}/signatories`);
        const signatariosData = resSignatarios.ok ? await resSignatarios.json() : [];
        setSignatarios(signatariosData);

        // Buscar assinaturas
        const resAssinaturas = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contracts/token/${hash}/signatures`);
        const assinaturasData = resAssinaturas.ok ? await resAssinaturas.json() : [];
        setAssinaturas(assinaturasData);


      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchContrato();
  }, [hash]);


  async function handleAssinar() {
    if (!assinatura) {
      setError("Preencha sua assinatura antes de assinar.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Registra assinatura
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/signatures/${hash}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpf: signatario.cpf, // CPF já carregado automaticamente
        }),
      });

      if (!res.ok) {
        throw new Error("Erro ao assinar contrato.");
      }

      // 2. Atualiza folha de assinaturas (nova rota que você criou)
      console.log("[DEBUG] Chamando update-signature-base64 para o hash:", hash);
      const updateRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/signatures/${hash}/update-signature-base64`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" }
      });
      console.log("[DEBUG] Resposta update-signature-base64 status:", updateRes.status);
      if (!updateRes.ok) {
        const updateError = await updateRes.text();
        console.error("[DEBUG] Erro update-signature-base64:", updateError);
      }

      setSuccessMessage("Contrato assinado com sucesso!");
      setAssinaturaConcluida(true);

      // 3. Buscar dados atualizados do contrato para checar status
      const contratoAtualizado = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contracts/token/${hash}`);
      const contratoJson = await contratoAtualizado.json();

      // 4. Se o contrato estiver "assinado", chamar a notificação
      if (contratoJson.status === "assinado" || contratoJson.contract?.status === "assinado") {
        const contratoId = contratoJson.contract?.id || contratoJson.contract_id;

        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contracts/${contratoId}/notificar-assinatura`, {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleDownloadContrato = async (contratoId) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contracts/${contratoId}/download-assinado`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Erro ao baixar contrato assinado.");

      const data = await res.json();

      if (!data.base64) throw new Error("Base64 não encontrado na resposta.");

      // Convertendo base64 para Blob
      const binaryString = atob(data.base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: "application/pdf" });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `contrato-${contratoId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erro ao fazer download do contrato assinado:", err);
      alert("Erro ao baixar o contrato assinado.");
    }
  };

  function handleContinuar() {
    if (cpfDigitado !== signatario.cpf) {
      setCpfInvalido(true);
      return;
    }

    setCpfInvalido(false);
    setShowModal(false);
  }

  const handleRejeitar = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/signatures/${hash}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: signatario.cpf }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao rejeitar contrato.");

      setAssinaturaConcluida(true);

      // 🔁 Recarregar os dados do contrato atualizado
      const resContratoAtualizado = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contracts/token/${hash}`);

      if (!resContratoAtualizado.ok) {
        throw new Error("Erro ao recarregar dados do contrato.");
      }

      const contratoData = await resContratoAtualizado.json();
      console.log("📦 Dados do contrato recarregado:", contratoData);
      setContrato(contratoData);

      // 📧 Notificar por e-mail após recarregar e confirmar o campo
      const contratoId = contratoData.contract?.id || contratoData.contract_id;
      const rejectedByName = contratoData.contract?.rejected_by_name || contratoData.rejected_by_name;

      if (contratoData.contract?.rejected_by || contratoData.rejected_by) {
        console.log("📨 Chamando notificação de rejeição...");
        await notificarRejeicao(contratoId, rejectedByName);
      } else {
        console.log("⛔ Campo 'rejected_by' ainda não está disponível.");
      }

    } catch (err) {
      console.error("❌ Erro ao rejeitar contrato:", err);
      alert(err.message);
    }
  };


  useEffect(() => {
    if (!contrato || !(contrato.contract_id || contrato.id)) return;
    const contratoId = contrato.contract_id || contrato.id;

    async function fetchSignatariosEAssinaturas() {
      try {
        // Buscar signatários
        const resSignatarios = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contracts/token/${hash}/signatories`);
        const signatariosData = resSignatarios.ok ? await resSignatarios.json() : [];
        console.log("Signatários retornados:", signatariosData);
        setSignatarios(signatariosData);

        // Buscar assinaturas
        const resAssinaturas = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contracts/token/${hash}/signatures`);
        const assinaturasData = resAssinaturas.ok ? await resAssinaturas.json() : [];
        console.log("Assinaturas retornadas:", assinaturasData);
        setAssinaturas(assinaturasData);
      } catch (err) {
        console.error("Erro ao buscar signatários/assinaturas:", err);
      }
    }
    fetchSignatariosEAssinaturas();
  }, [contrato]);


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


  if (loading) return (
    <div className={styles.loadingContainer}>
      <Lottie
        animationData={meuLottieJson}
        loop={true}
        style={{ width: 200, height: 200 }}
      />
      <p className={styles.loadingText}>Carregando contratos...</p>
    </div>
  );
  if (error) return <p className={styles.error}>{error}</p>;

  return (
    <div className={styles.contractContainer}>

      {assinaturaConcluida ? (
        <>
          {contrato?.status === "reprovado" ? (
            <>
              <p className={styles.bannerError}>Contrato reprovado!</p>
              {contrato?.rejected_by_name && (
                <p className={styles.rejectedBy}>
                  Rejeitado por: <strong>{contrato.rejected_by_name}</strong>
                </p>
              )}
              <div className={styles.contractBody}>
                <h2 className={styles.sectionTitle}>Contrato Reprovado</h2>
                <div className={styles.contractContent}>
                  {contrato?.content.startsWith("JVBERi0") ? (
                    <PDFViewer base64={contrato.content} />
                  ) : (
                    <p dangerouslySetInnerHTML={{ __html: contrato.content.replace(/\n/g, "<br/>") }} />
                  )}

                </div>
              </div>
            </>
          ) : (
            <>
              <p className={styles.bannerSuccess}>Contrato assinado!</p>
              <div className={styles.downloadSection}>
                <button
                  className={styles.downloadButton}
                  style={{ marginLeft: "10px" }}
                  onClick={() => handleDownloadContrato(contrato.contract_id)}
                >
                  <FontAwesomeIcon icon={faDownload} />
                </button>
              </div>

              <div className={styles.contractBody}>
                <h2 className={styles.sectionTitle}>Contrato Assinado</h2>
                <div className={styles.contractContent}>
                  {contrato?.content.startsWith("JVBERi0") ? (
                    <PDFViewer base64={contrato.content} />
                  ) : (
                    <p dangerouslySetInnerHTML={{ __html: contrato.content.replace(/\n/g, "<br/>") }} />
                  )}

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
                              <p><strong>Nome do Signatário:</strong> {signatario.name}</p>
                              <p><strong>Email do Signatário:</strong> {signatario.email}</p>
                              <p><strong>Função do Signatário:</strong> {signatario.funcao_assinatura}</p>

                              {/* Mostrar a Assinatura SOMENTE se ela existir */}
                              {assinatura ? (
                                <>

                                  <div className={styles.signatoryDetails}>
                                    <p><strong>ID do Contrato:</strong> {assinatura.contract_id}</p>
                                    <p><strong>IP do Signatário:</strong> {assinatura.ip_address}</p>
                                    <p><strong>Navegador:</strong> {assinatura.user_agent}</p>
                                    <p><strong>Data da Assinatura:</strong> {formatDateBR(assinatura.signed_at)}</p>

                                  </div>
                                  <div className={styles.signature}>
                                    <p className={styles.signatureText}>{signatario.name}</p>
                                  </div>
                                </>
                              ) : (
                                <p className={styles.pending}>Aguardando assinatura...</p>
                              )}
                            </li>
                          );
                        })
                      ) : (
                        <p className={styles.noSignatories}>Nenhum signatário encontrado.</p>
                      )}
                    </ul>
                  </div>

                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {/* 
          <div className={styles.header}>
            <img src="/img/banner.png" alt="Logo da Empresa" className={styles.logo} />
          </div> */}

          {/* Corpo do contrato */}
          <div className={styles.contractBody}>
            <h2 className={styles.sectionTitle}>Contrato</h2>
            <div className={styles.contractContent}>
              {contrato?.content.startsWith("JVBERi0") ? (
                <PDFViewer base64={contrato.content} />
              ) : (
                <p dangerouslySetInnerHTML={{ __html: contrato.content.replace(/\n/g, "<br/>") }} />
              )}

            </div>
          </div>

          {/* Modal de preenchimento dos dados */}
          {showModal && (
            <div className={styles.modal}>
              <div className={styles.modalContent}>
                <h2>Preencha seus dados</h2>
                <input
                  type="text"
                  placeholder="Nome Completo"
                  value={signatario.name}
                  onChange={(e) => setSignatario({ ...signatario, name: e.target.value })}
                  className={styles.input}
                  required
                />
                <input
                  type="text"
                  placeholder="Email"
                  value={signatario.email}
                  onChange={(e) => setSignatario({ ...signatario, email: e.target.value })}
                  className={styles.input}
                  required
                />
                <input
                  type="text"
                  placeholder="Digite seu CPF"
                  value={cpfDigitado}
                  onChange={(e) => setCpfDigitado(e.target.value)}
                  className={styles.input}
                  required
                />

                {cpfInvalido && (
                  <p className={styles.error}>
                    O CPF informado não confere com o do contrato.
                  </p>
                )}


                <button className={styles.button} onClick={handleContinuar}>
                  Continuar
                </button>
              </div>
            </div>
          )}
          {/* Ações do signatário (Assinar ou Rejeitar) */}
          {!querAssinar ? (
            <>
              <div className={styles.signatureActions}>

                <button className={styles.rejectButton} onClick={handleRejeitar}>
                  Rejeitar Contrato
                </button>

                <button className={styles.confirmButton} onClick={() => setQuerAssinar(true)}>
                  Quero Assinar
                </button>
              </div>

            </>
          ) : (
            <>
              {/* Campo de assinatura */}

              <div className={styles.signatureContainer}>
                <label className={styles.label}>Sua assinatura:</label>
                <div className={styles.signatureField}>
                  <input
                    type="text"
                    value={assinatura}
                    readOnly
                    className={styles.signatureInput}
                  />

                </div>
              </div>

              {/* Botão de assinar */}
              <button className={styles.button} onClick={handleAssinar} disabled={loading}>
                {loading ? "Assinando..." : "Confirmar Assinatura"}
              </button>
            </>
          )}

        </>
      )}
    </div>
  );
}
