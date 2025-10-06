import { useState, useEffect } from "react";
import styles from "../../../styles/comercial/crm/EditProductModal.module.css"; // Importando o CSS para o modal
import { FaBox } from "react-icons/fa"; // Ícone de produto

const EditProductModal = ({ product, isOpen, onClose, onSave, mode = "edit" }) => {
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState("ativo");
  const [global, setGlobal] = useState(0);
  const [userRole, setUserRole] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    // Detecta papel a partir do userData (permissoes.adm) ou fallback para user.role
    const raw = localStorage.getItem("userData") || localStorage.getItem("user");
    if (raw) {
      try {
        const u = JSON.parse(raw);
        const isSuper = Array.isArray(u?.permissoes?.adm) && u.permissoes.adm.map(String).map(s=>s.toLowerCase()).includes('superadmin');
        setUserRole(isSuper ? 'superadmin' : (u.role || ''));
      } catch {
        setUserRole('');
      }
    }
  }, []);

  useEffect(() => {
    if (product && mode === "edit") {
      setNome(product.nome);
      setDescricao(product.descricao);
      setStatus(product.status);
      setGlobal(product.global ?? 0);
    } else if (mode === "create") {
      // Reset para modo de criação
      setNome("");
      setValor("");
      setDescricao("");
      setStatus("ativo");
      setGlobal(0);
      setError(null);
    }
  }, [product, mode]);

  const handleSubmit = async () => {
    if (!nome || !descricao) {
      setError("Todos os campos são obrigatórios!");
      return;
    }

    const userRaw = localStorage.getItem("userData") || localStorage.getItem("user");
    const token = localStorage.getItem("token");

    if (!userRaw || !token) return;

    const user = JSON.parse(userRaw);
    const empresaId = user?.EmpresaId || user?.empresa?.id || user?.empresa_id || user?.companyId;
    if (!empresaId) { console.error('Usuário sem empresa associada.'); return; }

    try {
      if (mode === "create") {
        // Criar novo produto
        const newProduct = {
          nome,
          valor,
          descricao,
          status,
          empresa_id: empresaId,
          global
        };

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/produtos`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(newProduct),
        });

        if (!res.ok) {
          const message = `Erro ao salvar produto: ${res.status} ${res.statusText}`;
          throw new Error(message);
        }

        const data = await res.json();
        onSave(data);
      } else {
        // Editar produto existente
        const updatedProduct = { nome, descricao, status, global };

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/produtos/${product.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(updatedProduct),
        });

        if (!res.ok) {
          const message = `Erro ao atualizar produto: ${res.status} ${res.statusText}`;
          throw new Error(message);
        }

        const data = await res.json();
        onSave(data);
      }

      onClose();
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
      setError(error.message);
    }
  };

  const handleClose = () => {
    setNome("");
    setValor("");
    setDescricao("");
    setStatus("ativo");
    setGlobal(0);
    setError(null);
    onClose();
  };

  return isOpen ? (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            <FaBox className={styles.modalIcon} size={40} />
            {mode === "create" ? "Cadastrar Produto" : "Editar Produto"}
          </h2>
          <button 
            className={styles.closeButton}
            onClick={handleClose}
          >
            ×
          </button>
        </div>

        {/* Formulário */}
        <div className={styles.formContainer}>
          {/* Nome do Produto */}
          <div className={styles.fieldContainer}>
            <label className={styles.fieldLabel}>
              Nome do Produto <span className={styles.requiredField}>*</span>
            </label>
            <input
              className={styles.input}
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Digite o nome do produto"
            />
          </div>

          {/* Descrição */}
          <div className={styles.fieldContainer}>
            <label className={styles.fieldLabel}>
              Descrição <span className={styles.requiredField}>*</span>
            </label>
            <textarea
              className={styles.textarea}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Digite a descrição do produto"
            />
          </div>

          {/* Status */}
          {/* <div className={styles.fieldContainer}>
            <label className={styles.fieldLabel}>
              Status
            </label>
            <div className={styles.checkboxContainer}>
              <input
                type="checkbox"
                checked={status === "ativo"}
                onChange={() => setStatus(status === "ativo" ? "inativo" : "ativo")}
              />
              <span>{status === "ativo" ? "Ativo" : "Inativo"}</span>
            </div>
          </div> */}

          {/* Produto Global (apenas para superadmin) */}
          {userRole === "superadmin" && (
            <div className={styles.fieldContainer}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={!!global}
                  onChange={e => setGlobal(e.target.checked ? 1 : 0)}
                />
                <span>Produto Global</span>
              </label>
            </div>
          )}

          {/* Mensagem de erro */}
          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}

          {/* Botões */}
          <div className={styles.buttonContainer}>
            <button 
              className={`${styles.button} ${styles.primaryButton}`}
              onClick={handleSubmit}
            >
              {mode === "create" ? "Salvar Produto" : "Salvar Alterações"}
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;
};

export default EditProductModal;
