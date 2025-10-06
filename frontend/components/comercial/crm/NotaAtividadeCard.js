import { useState, useEffect } from "react";
import styles from "../../styles/NotaAtividadeCard.module.css";
import { Calendar, Clock, Mic, ChevronDown, Filter } from "lucide-react";
import { registrarHistorico } from "../../utils/registrarHistorico";
import CreateActivityModal from "./CreateActivityModal";

export default function NotaAtividadeCard({ leadId, onCreated }) {
    const [user, setUser] = useState(null);
    const token = localStorage.getItem("token");

    const [aba, setAba] = useState("nota");
    const [conteudo, setConteudo] = useState("");
    const [tipos, setTipos] = useState([]);
    const [tipoId, setTipoId] = useState("");
    const [data, setData] = useState("");
    const [duracao, setDuracao] = useState("");
    const [loading, setLoading] = useState(false);
    const [hora, setHora] = useState("00:00");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [atividadesPendentes, setAtividadesPendentes] = useState([]);
    const [equipeId, setEquipeId] = useState(null);

    // Função para abrir o modal
    const openModal = () => {
        setIsModalOpen(true);
    };

    // Função para fechar o modal
    const closeModal = () => {
        setIsModalOpen(false);
    };

useEffect(() => {
    if (equipeId) {
        fetchTiposAtividade();
    }
}, [equipeId]);

    useEffect(() => {
        // Obter equipeId do localStorage
        const userRaw = localStorage.getItem("user");
        if (userRaw) {
            try {
                const userObj = JSON.parse(userRaw);
                if (userObj.equipe_id) setEquipeId(userObj.equipe_id);
            } catch {}
        }
    }, []);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return;

        fetch(`${process.env.NEXT_PUBLIC_API_URL}/user`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((res) => res.json())
            .then((data) => {
                console.log("Usuário carregado", data);
                setUser(data);
            })
            .catch((err) => console.error("Erro ao carregar usuário", err));
    }, []);

    const fetchTiposAtividade = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tipos-atividade/equipe/${equipeId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setTipos(data);
        } catch (err) {
            console.error("Erro ao carregar tipos:", err);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            if (aba === "nota") {
                const notaRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notas`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        lead_id: leadId,
                        usuario_id: user.id,
                        conteudo,
                    }),
                });

                const notaData = await notaRes.json();

                await registrarHistorico({
                    lead_id: leadId,
                    usuario_id: user.id,
                    tipo: "nota",
                    titulo: "Nota adicionada",
                    descricao: conteudo,
                    referencia_id: notaData.notaId,
                    token,
                });

            } else {
                const atividadeRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/atividades`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        nome: conteudo,
                        observacao: conteudo,
                        data,
                        hora,
                        duracao,
                        tipo_id: tipoId,
                        status: "concluida",
                        lead_id: leadId,
                    }),
                });

                const atividadeData = await atividadeRes.json();

                await registrarHistorico({
                    lead_id: leadId,
                    usuario_id: user.id,
                    tipo: "atividade",
                    titulo: "Atividade concluída",
                    descricao: conteudo,
                    referencia_id: atividadeData.atividadeId,
                    token,
                });
            }

            setConteudo("");
            setHora("");
            setData("");
            setDuracao("");
            onCreated?.();
        } catch (error) {
            console.error("Erro ao salvar:", error);
        } finally {
            setLoading(false);
        }
    };

    


    return (
        <div className={styles.card}>
            <div className={styles.tabs}>
                <span className={aba === "nota" ? styles.activeTab : ""} onClick={() => setAba("nota")}>
                    Nota
                </span>
                <span className={aba === "atividade" ? styles.activeTab : ""} onClick={() => setAba("atividade")}>
                    Atividade Realizada
                </span>
            </div>

            <div className={styles.content}>
                {user && (
                    <img
                        src={user.avatar_url || "/default-avatar.png"}
                        className={styles.avatar}
                        alt="Avatar"
                    />
                )}
                <textarea
                    className={styles.textarea}
                    placeholder={
                        aba === "nota" ? "Escreva o que aconteceu..." : "Escreva sua atividade futura."
                    }
                    value={conteudo}
                    onChange={(e) => setConteudo(e.target.value)}
                />
            </div>

            {/* Footer para NOTA */}
            {aba === "nota" && (
                <div className={styles.footer}>
                    <div className={styles.left}>
                        {/* <div className={styles.dropdown}>
                            <Filter size={16} />
                            <select
                                className={styles.select}
                                value={tipoId}
                                onChange={(e) => setTipoId(e.target.value)}
                            >
                                <option value="" >
                                    Tipo de atividade
                                </option>
                                {tipos.map((tipo) => (
                                    <option key={tipo.id} value={tipo.id}>
                                        {tipo.nome}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={14} />
                        </div> */}
                    </div>

                    <div className={styles.right}>
                        <button
                            className={styles.saveBtn}
                            onClick={handleSubmit}
                            disabled={loading || !conteudo}
                        >
                            Salvar
                        </button>
                    </div>
                </div>
            )}

            {/* Footer para ATIVIDADE */}
            {aba === "atividade" && (
                <div className={styles.footerAtividade}>

                    {/* Linha 1: Tipo + Data + Hora */}
                    <div className={styles.inputRow}>
                        <div className={styles.dropdown}>
                            <Filter size={16} />
                            <select
                                className={styles.select}
                                value={tipoId}
                                onChange={(e) => setTipoId(e.target.value)}
                            >
                                <option value="">
                                    Tipo de atividade
                                </option>
                                {tipos.map((tipo) => (
                                    <option key={tipo.id} value={tipo.id}>
                                        {tipo.nome}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={14} />
                        </div>

                        <div className={styles.dateInput}>
                            <Calendar size={16} />
                            <input
                                type="date"
                                value={data}
                                onChange={(e) => setData(e.target.value)}
                            />
                        </div>

                        <div className={styles.timeInput}>
                            <Clock size={16} />
                            <input
                                type="time"
                                value={hora}
                                onChange={(e) => setHora(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Linha 2: Botões */}
                    <div className={styles.buttonRow}>
                        <button onClick={openModal} className={styles.secondaryBtn}>Mais opções</button>
                        <button
                            className={styles.saveBtn}
                            onClick={handleSubmit}
                            disabled={loading || !conteudo}
                        >
                            Concluir
                        </button>
                    </div>
                </div>

            )}

            {isModalOpen && (

                <CreateActivityModal
                    leadId={leadId}  // Passando o leadId
                    onClose={closeModal}  // Passando a função de fechar o modal
                    onCreated={onCreated}  // Passando a função de callback para ser chamada após criar a atividade
                    open={isModalOpen}  // Passando a visibilidade do modal
                    equipeId={equipeId}
                />
            )}

        </div>

    );
}
