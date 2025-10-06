import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import styles from "../../styles/PropostasCliente.module.css";

export default function Propostas({ leadId }) {
    const router = useRouter();
    const [propostas, setPropostas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!leadId) return;

        const fetchPropostas = async () => {
            setLoading(true);
            setError(null);
            try {
                const token = localStorage.getItem("token");
                if (!token) throw new Error("Usuário não autenticado.");

                // Buscar todos os clientes
                const clientsRes = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/clients`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );

                if (!clientsRes.ok) throw new Error("Erro ao buscar clientes.");

                const clients = await clientsRes.json();

                // Encontrar o cliente com lead_id igual ao leadId
                const clientData = clients.find(
                    (c) => c.lead_id === leadId || c.lead_id === Number(leadId)
                );

                if (!clientData) {
                    setPropostas([]); // Sem cliente, sem propostas
                    setLoading(false);
                    return;
                }

                // Buscar contratos do cliente
                const contratosRes = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/clients/${clientData.id}/contracts`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );

                if (!contratosRes.ok) throw new Error("Erro ao buscar propostas.");

                const contratos = await contratosRes.json();

                setPropostas(contratos);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPropostas();
    }, [leadId]);

    const getStatusColor = (status) => {
        switch ((status || "").toLowerCase()) {
            case "assinado":
                return "#28a745"; // verde
            case "pendente":
                return "#ffc107"; // amarelo
            case "expirado":
                return "#dc3545"; // vermelho
            default:
                return "#6c757d"; // cinza para outros ou indefinidos
        }
    };

    if (loading) return <p>Carregando propostas...</p>;
    if (error) return <p>Erro: {error}</p>;

    return (
        <div className={styles.container}>
            <h3 className={styles.h3}>
                <FileText size={30} className={styles.userIcon} /> Propostas
            </h3>

            {propostas.length === 0 ? (
                <p className={styles.noPropostas}>Nenhuma proposta encontrada</p>
            ) : (
                <ul className={styles.listaPropostas}>
                    {propostas.map((proposta) => (
                        <li
                            key={proposta.id}
                            className={styles.itemProposta}
                            onClick={() => router.push(`/contrato/${proposta.id}`)}
                            style={{ cursor: "pointer" }}
                        >
                            <div>
                                <strong>{proposta.title || `Proposta #${proposta.id}`}</strong>
                            </div>
                            <div>Data: {new Date(proposta.created_at).toLocaleDateString()}</div>
                            <div>
                                Status:{" "}
                                <span style={{ color: getStatusColor(proposta.status), fontWeight: "bold" }}>
                                    {proposta.status || "Indefinido"}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
