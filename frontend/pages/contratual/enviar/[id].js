import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Layout from "../../components/layout/Layout";
import styles from "../../styles/Documento.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faPaperPlane, faTrash } from "@fortawesome/free-solid-svg-icons";

export default function VisualizarContrato() {
    const router = useRouter();
    const { id } = router.query;

    const [contratoHtml, setContratoHtml] = useState("");
    const [sendingEmail, setSendingEmail] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [signatarios, setSignatarios] = useState([]);
    const [enviado, setEnviado] = useState(false);


    useEffect(() => {
        if (!id) return;
        const token = localStorage.getItem("token");

        const fetchContrato = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contracts/${id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                const html = await res.text();
                setContratoHtml(html);
            } catch (err) {
                console.error("Erro ao buscar contrato:", err);
                setError("Não foi possível carregar o contrato.");
            }
        };

        const fetchSignatarios = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contracts/${id}/signatories`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) throw new Error("Erro ao buscar signatários");
                const data = await res.json();
                setSignatarios(data);
            } catch (err) {
                console.error("Erro ao buscar signatários:", err);
            }
        };

        fetchContrato();
        fetchSignatarios();
    }, [id]);

    const handleEnviarEmail = async () => {
        const token = localStorage.getItem("token");
        if (!id || !token) return;
        setSendingEmail(true);

        try {
            const emailRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contracts/${id}/send-email`, {
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
            setEnviado(true); // <- aqui
            setTimeout(() => router.push(`/contratos`), 1200);

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
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contracts/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) throw new Error("Erro ao excluir contrato.");
            router.push("/contratos");
        } catch (err) {
            console.error("Erro ao excluir contrato:", err);
            setError("Erro ao excluir contrato.");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <Layout>
            <button className={styles.backButton} onClick={() => router.back()}>
                <FontAwesomeIcon icon={faArrowLeft} /> Voltar
            </button>

            {error && <p className={styles.error}>{error}</p>}
            {successMessage && <p className={styles.success}>{successMessage}</p>}

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
                    onClick={handleEnviarEmail}
                    disabled={sendingEmail || enviado}
                >
                    <FontAwesomeIcon icon={faPaperPlane} />{" "}
                    {sendingEmail ? "Enviando..." : enviado ? "Enviado ✅" : "Enviar Documento"}
                </button>

            </div>


            <div className={styles.contractContainer}>
                {contratoHtml ? (
                    contratoHtml.startsWith("JVBERi0") ? (
                        <PDFViewer base64={contratoHtml} />
                    ) : (
                        <div
                            className={styles.contractBody}
                            dangerouslySetInnerHTML={{ __html: contratoHtml.replace(/\n/g, "<br/>") }}
                        />
                    )
                ) : (
                    <p className={styles.loading}>Carregando contrato...</p>
                )}
            </div>

        </Layout>
    );
}
