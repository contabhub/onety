// components/modal/ProdutoModal.js
import { useState, useEffect } from "react";
import { toast } from 'react-toastify';
import styles from "../../styles/CriarContrato.module.css";

export default function ProdutoModal({ produtos, onClose, onAdd }) {
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [valorTotal, setValorTotal] = useState(0);
  const [tipo, setTipo] = useState("");
  const [parcelas, setParcelas] = useState(1);
  const [incluir13, setIncluir13] = useState(false);

  // Atualiza o número de parcelas automaticamente ao trocar o tipo ou a checkbox
  useEffect(() => {
    if (tipo === "pontual") {
      setParcelas(1);
    } else if (tipo === "mensal") {
      setParcelas(incluir13 ? 13 : 12);
    } else if (tipo === "bimestral") {
      setParcelas(6);
    } else if (tipo === "trimestral") {
      setParcelas(3);
    } else if (tipo === "semestral") {
      setParcelas(2);
    } else if (tipo === "anual") {
      setParcelas(1);
    } else if (tipo === "personalizado") {
      // Para tipo personalizado, mantém o valor atual das parcelas
      // O usuário pode editar manualmente
    } else {
      setParcelas(1);
    }
  }, [tipo, incluir13]);

  // Recalcula o valor total sempre que quantidade ou valor_de_venda mudarem
  useEffect(() => {
    if (produtoSelecionado) {
      const quantidade = parseFloat(produtoSelecionado.quantidade) || 0;
      const unitario = parseFloat(produtoSelecionado.valor_de_venda) || 0;
      setValorTotal(quantidade * unitario);
    }
  }, [produtoSelecionado?.quantidade, produtoSelecionado?.valor_de_venda]);

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3>Adicionar Produto</h3>

        <label className={styles.label}>Produto:</label>
        <select
          className={styles.select}
          onChange={(e) => {
            const p = produtos.find(p => p.id.toString() === e.target.value);
            if (p) {
              const valor = parseFloat(p.valor) || 0;
              setProdutoSelecionado({
                ...p,
                quantidade: 1,
                desconto: 0,
                valor_de_venda: valor,
              });
              setValorTotal(valor);
            }
          }}
        >
          <option value="">Selecione um produto</option>
          {produtos.map(p => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>

        {produtoSelecionado && (
          <>
            <label className={styles.label}>Tipo:</label>
            <select
              className={styles.select}
              value={tipo}
              onChange={e => {
                setTipo(e.target.value);
                if (e.target.value !== "mensal") setIncluir13(false);
              }}
            >
              <option value="">Selecione o tipo</option>
              <option value="pontual">Pontual</option>
              <option value="mensal">Mensal</option>
              <option value="bimestral">Bimestral</option>
              <option value="trimestral">Trimestral</option>
              <option value="semestral">Semestral</option>
              <option value="anual">Anual</option>
              <option value="personalizado">Personalizado</option>
            </select>

            {/* Checkbox para 13ª parcela */}
            {tipo === "mensal" && (
              <div style={{ margin: '8px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={incluir13}
                    onChange={e => setIncluir13(e.target.checked)}
                  />
                  Incluir 13ª parcela
                </label>
              </div>
            )}

            <label className={styles.label}>Parcelas:</label>
            <input
              className={styles.input}
              type="number"
              min="1"
              value={parcelas}
              onChange={e => setParcelas(Number(e.target.value))}
              disabled={tipo !== "" && tipo !== "personalizado"}
            />

            <label className={styles.label}>Quantidade:</label>
            <input
              className={styles.input}
              type="number"
              min="1"
              value={produtoSelecionado.quantidade}
              onChange={(e) =>
                setProdutoSelecionado({ ...produtoSelecionado, quantidade: e.target.value })
              }
            />

            <label className={styles.label}>Valor Total do Contrato:</label>
            <input
              className={styles.input}
              type="number"
              step="0.01"
              value={produtoSelecionado.valor_de_venda}
              onChange={(e) =>
                setProdutoSelecionado({
                  ...produtoSelecionado,
                  valor_de_venda: parseFloat(e.target.value) || 0,
                })
              }
            />


            <label className={styles.label}>Valor Total:</label>
            <input
              className={styles.input}
              type="number"
              disabled
              value={parseFloat(valorTotal || 0).toFixed(2)}
            />
          </>
        )}

        <div className={styles.buttons}>
          <button
            className={styles.button}
            onClick={() => {
              if (!produtoSelecionado) {
                toast.warning('Selecione um produto.');
                return;
              }
              if (!tipo) {
                toast.warning('Selecione o tipo do produto.');
                return;
              }
              if (!parcelas || parcelas < 1) {
                toast.warning('Informe um número válido de parcelas.');
                return;
              }
              onAdd({
                ...produtoSelecionado,
                tipo,
                parcelas
              });
              onClose();
            }}
          >
            Adicionar
          </button>
          <button className={styles.closeBtn} onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
