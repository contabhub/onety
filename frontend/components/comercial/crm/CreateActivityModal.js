import { useState, useEffect } from "react";
import styles from "../../styles/CreateActivityModal.module.css";
import { FaTimes } from "react-icons/fa";

export default function CreateActivityModal({ onClose, leadId, onCreated, equipeId }) {
  const [nome, setNome] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [duracao, setDuracao] = useState("");
  const [descricao, setDescricao] = useState("");
  const [concluida, setConcluida] = useState(false); 
  const [loading, setLoading] = useState(false);
  const [tipoId, setTipoId] = useState("");  
  const [tiposAtividade, setTiposAtividade] = useState([]);

  // Buscar tipos de atividade por equipe
  useEffect(() => {
    if (!equipeId) return;
    const fetchTiposAtividade = async () => {
      const token = localStorage.getItem("token");
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tipos-atividade/equipe/${equipeId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        setTiposAtividade(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Erro ao carregar tipos de atividade:", error);
      }
    };
    fetchTiposAtividade();
  }, [equipeId]);

  const handleSave = async () => {
    setLoading(true);
    const token = localStorage.getItem("token");

    const activityData = {
      lead_id: leadId,
      nome,
      observacao: descricao,
      data,
      hora,
      duracao,
      tipo_id: tipoId,  // Aqui, o tipo_id será o selecionado
      status: concluida ? "concluida" : "pendente",  // Se marcada, a atividade será concluída
    };

    console.log("Enviando dados para o backend:", activityData);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/atividades`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(activityData),
      });

      if (!res.ok) {
        throw new Error("Erro ao criar atividade.");
      }

      const response = await res.json();
      console.log("Atividade criada:", response);

      // Se a atividade for concluída, envia para o histórico
      if (concluida) {
        await registrarHistorico({
          lead_id: leadId,
          usuario_id: user.id,
          tipo: "atividade",
          titulo: "Atividade concluída",
          descricao: descricao,
          referencia_id: response.atividadeId,  // Supondo que a resposta tenha a id da atividade criada
          token,
        });
      }

      // Limpar campos após salvar
      setNome("");
      setDescricao("");
      setData("");
      setHora("");
      setDuracao("");
      setConcluida(false);

      onCreated?.();  // Callback após criação

      // Fechar o modal após salvar
      onClose?.();
    } catch (error) {
      console.error("Erro ao criar atividade:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <div className={styles.header}>
          <h3>Atividade Futura</h3>
          <FaTimes onClick={onClose} className={styles.closeIcon} />
        </div>

        <div className={styles.formGroup}>
          <label>Nome da Atividade <span style={{ color: 'red' }}>*</span></label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome da atividade"
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label>Data</label>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Hora</label>
          <input
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Duração</label>
          <input
            type="number"
            value={duracao}
            onChange={(e) => setDuracao(e.target.value)}
            placeholder="Duração em minutos"
          />
        </div>

        <div className={styles.formGroup}>
          <label>Observações</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Observações sobre a atividade"
          />
        </div>

        {/* Seletor para tipo de atividade */}
        <div className={styles.formGroup}>
          <label>Tipo de Atividade <span style={{ color: 'red' }}>*</span></label>
          <select
            value={tipoId}
            onChange={(e) => setTipoId(e.target.value)} // Atualiza o tipo_id
            required
          >
            <option value="">Selecione o tipo</option>
            {tiposAtividade.map((tipo) => (
              <option key={tipo.id} value={tipo.id}>
                {tipo.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Checkbox para atividade concluída */}
        <div className={styles.checkboxGroup}>
          <label>
            <input
              type="checkbox"
              checked={concluida}
              onChange={() => setConcluida(!concluida)} // Marca ou desmarca
            />
            Atividade concluída
          </label>
        </div>

        <div className={styles.footer}>
          <button className={styles.saveBtn} onClick={handleSave} disabled={loading || !nome || !tipoId}>
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
