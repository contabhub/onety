import { useEffect, useState, useRef } from 'react';
import styles from "../../../styles/comercial/crm/LeadDataCard.module.css";
import { Info, Link, Pencil } from 'lucide-react';
import EditLeadDataModal from '../crm/EditLeadDataModal';

export default function LeadDataCard({ leadDetails }) {
  const [dados, setDados] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState(null);
  const [valoresTemp, setValoresTemp] = useState({}); // valores temporários para os campos
  const [campoEditando, setCampoEditando] = useState(null); // campo que está sendo editado
  const debounceTimeouts = useRef({}); // Armazenar os timers de debounce

  // Função para carregar dados do lead
  const fetchDados = async () => {
    if (leadDetails?.id) {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/leads/${leadDetails.id}/dados-personalizados`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDados(data);
      setValoresTemp({}); // Limpa os valores temporários ao carregar
      setCampoEditando(null); // Limpa o campo editando ao recarregar
    }
  };

  useEffect(() => {
    fetchDados();
  }, [leadDetails]);

  // Função para manejar a mudança de valor no campo
  const handleInputChange = (campoId, valor) => {
    setValoresTemp((prev) => ({ ...prev, [campoId]: valor }));

    // Implementação de debounce para controlar o envio dos dados
    if (debounceTimeouts.current[campoId]) {
      clearTimeout(debounceTimeouts.current[campoId]);
    }
  };

  // Função para enviar a alteração para a API
  const handleValorChange = async (campoId, valor) => {
    if (!leadDetails?.id || !campoId) return;

    const campoInfo = dados.flatMap(cat => cat.campos).find(c => c.campo_id === campoId);
    const valorId = campoInfo?.valor_id;

    try {
      // Define a URL da API
      const url = valorId
        ? `${process.env.NEXT_PUBLIC_API_URL}/comercial/valores-personalizados/${valorId}`
        : `${process.env.NEXT_PUBLIC_API_URL}/comercial/valores-personalizados`;

      const method = valorId ? 'PUT' : 'POST';
      const body = valorId
        ? { valor }
        : { lead_id: leadDetails.id, campo_id: campoId, valor };

      await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(body),
      });

      fetchDados(); // Atualiza os dados após salvar
    } catch (err) {
      console.error("Erro ao salvar valor:", err);
    }
  };

  // Função para ativar o modo de edição quando o ícone de lápis for clicado
  const handleEditClick = (campoId, valorAtual) => {
    setCampoEditando(campoId); // Marca o campo como sendo editado
    setValoresTemp((prev) => ({ ...prev, [campoId]: valorAtual })); // Define o valor temporário
  };

  // Função para renderizar o tipo de input de acordo com o campo
  const renderInputField = (campo) => {
    switch (campo.tipo) {
      case 'url':
        return (
          <a href={campo.valor} target="_blank" rel="noreferrer">
            {campo.valor}
          </a>
        );
      case 'data':
        return (
          <input
            type="date"
            value={valoresTemp[campo.campo_id] || ""}
            onChange={(e) => handleInputChange(campo.campo_id, e.target.value)}
            onBlur={() => handleValorChange(campo.campo_id, valoresTemp[campo.campo_id])}
            className={styles.inlineInput}
            autoFocus
          />
        );
      case 'numero':
        return (
          <input
            type="text"
            value={valoresTemp[campo.campo_id] || ""}
            onChange={(e) => handleInputChange(campo.campo_id, e.target.value)}
            onBlur={() => handleValorChange(campo.campo_id, valoresTemp[campo.campo_id])}
            className={styles.inlineInput}
            autoFocus
          />
        );
      case 'lista':
        const listaItems = valoresTemp[campo.campo_id]?.split(",").map(item => item.trim()) || [];
        return (
          <div className={styles.listaContainer}>
            <textarea
              value={valoresTemp[campo.campo_id] || ""}
              onChange={(e) => handleInputChange(campo.campo_id, e.target.value)}
              onBlur={() => handleValorChange(campo.campo_id, valoresTemp[campo.campo_id])}
              className={styles.inlineInput}
              rows={3}
              placeholder="Digite os itens separados por vírgula"
            />
            <ul className={styles.lista}>
              {listaItems.map((item, index) => (
                <li key={index} className={styles.listaItem}>- {item}</li>
              ))}
            </ul>
          </div>
        );
      case 'endereco':
        return (
          <input
            type="text"
            value={valoresTemp[campo.campo_id] || ""}
            onChange={(e) => handleInputChange(campo.campo_id, e.target.value)}
            onBlur={() => handleValorChange(campo.campo_id, valoresTemp[campo.campo_id])}
            className={styles.inlineInput}
            autoFocus
          />
        );
      case 'texto':
      default:
        return (
          <input
            type="text"
            value={valoresTemp[campo.campo_id] || ""}
            onChange={(e) => handleInputChange(campo.campo_id, e.target.value)}
            onBlur={() => handleValorChange(campo.campo_id, valoresTemp[campo.campo_id])}
            className={styles.inlineInput}
            autoFocus
          />
        );
    }
  };

  return (
    <>
      {dados.map((categoria, index) => (
        <div className={styles.card} key={index}>
          <div className={styles.header}>
            <span className={styles.title}>{categoria.categoria_nome}</span>
            <Pencil
              size={16}
              className={styles.editIcon}
              onClick={() => {
                setCategoriaSelecionada(categoria);
                setModalOpen(true);
              }}
            />
          </div>

          <div className={styles.dados}>
            {categoria.campos.map((campo) => (
              <div className={styles.item} key={campo.campo_id}>
                <div className={styles.icon}>
                  {campo.tipo === 'url' ? <Link size={16} /> : <Info size={16} />}
                </div>
                <div>
                  <div className={styles.nome}>{campo.nome}</div>
                  <div className={styles.valor}>
                    {campoEditando === campo.campo_id ? (
                      // Renderiza o campo de edição
                      renderInputField(campo)
                    ) : campo.tipo === "lista" ? (
                      // Tratamento para campos do tipo "lista"
                      <div className={styles.listaContainer}>
                        {campo.valor && campo.valor.split(",").map((item, index) => (
                          <div key={index} className={styles.listaItem}>- {item.trim()}</div>
                        ))}
                      </div>
                    ) : campo.valor ? (
                      campo.tipo === "url" ? (
                        <a
                          href={campo.valor}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {campo.valor}
                        </a>
                      ) : (
                        <span>
                          {campo.valor}
                        </span>
                      )
                    ) : (
                      <span
                        className={styles.preencherVazio}
                      >
                        (campo vazio)
                      </span>
                    )}
                    {/* Ícone de lápis para editar */}
                    {/* <Pencil
                      size={16}
                      className={styles.editIcon}
                      onClick={() => handleEditClick(campo.campo_id, campo.valor)}
                    /> */}
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      ))}

      {modalOpen && categoriaSelecionada && (
        <EditLeadDataModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          categoria={categoriaSelecionada}
          leadId={leadDetails.id}
          onSave={fetchDados}
        />
      )}
    </>
  );
}
