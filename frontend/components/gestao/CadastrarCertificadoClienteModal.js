import { useState, useEffect } from "react";
import { FaCloudUploadAlt } from "react-icons/fa";
import styles from "../../styles/gestao/CertificadosPage.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export default function CadastrarCertificadoClienteModal({ onClose, onSucesso }) {
  const [clienteId, setClienteId] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [dataVencimento, setDataVencimento] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState([]);

  useEffect(() => {
    const fetchClientes = async () => {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        console.error("EmpresaId não encontrado no storage");
        return;
      }
      
      try {
        const response = await fetch(`${BASE_URL}/gestao/clientes?empresaId=${empresaId}&limit=1000`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Empresa-Id": empresaId.toString()
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setClientes(data.clientes || []);
      } catch (err) {
        console.error("Erro ao buscar clientes:", err);
      }
    };
    
    fetchClientes();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = typeof window !== "undefined" 
      ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
      : "";
    const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
    const userData = rawUserData ? JSON.parse(rawUserData) : {};
    const empresaId = userData?.EmpresaId;
    
    if (!empresaId) {
      console.error("EmpresaId não encontrado no storage");
      setMensagem("❌ Erro ao cadastrar certificado.");
      return;
    }
    
    if (!clienteId || !arquivo || !dataVencimento) {
      setMensagem("❌ Preencha cliente, arquivo .pfx e data de vencimento.");
      return;
    }

    const formData = new FormData();
    formData.append("clienteId", clienteId);
    formData.append("dataVencimento", dataVencimento);
    formData.append("pfxCertificado", arquivo);

    setLoading(true);
    try {
      // Debug: conferir payload antes do envio
      const debugEntries = [];
      formData.forEach((v, k) => {
        debugEntries.push([k, v instanceof File ? `File(${v.name}, ${v.type}, ${v.size}B)` : v]);
      });
      console.log("[certificados-clientes] POST payload", debugEntries);
      const response = await fetch(`${BASE_URL}/gestao/escritorio/certificados-clientes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId.toString()
        },
        body: formData,
      });

      if (!response.ok) {
        let details = "";
        try {
          const data = await response.json();
          details = data?.error || data?.message || JSON.stringify(data);
        } catch (_e) {
          // ignore
        }
        console.error("[certificados-clientes] Erro:", response.status, details);
        setMensagem(`❌ Erro ao cadastrar certificado. ${details || "Verifique os dados enviados."}`);
        return;
      }

      setMensagem("✅ Certificado cadastrado com sucesso!");
      onSucesso();
      onClose();
    } catch (error) {
      console.error("[certificados-clientes] Exceção:", error);
      setMensagem("❌ Erro ao cadastrar certificado (rede/cliente).");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2 className={styles.modalTitulo}>Cadastrar Certificado do Cliente</h2>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <select 
            value={clienteId} 
            onChange={(e) => setClienteId(e.target.value)} 
            required
            className={styles.modalInput}
          >
            <option value="">Selecione um cliente</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nome || cliente.name || cliente.razao_social || `Cliente ${cliente.id}`}
              </option>
            ))}
          </select>

          <label 
            htmlFor="upload" 
            className={styles.modalUploadArea}
          >
            <FaCloudUploadAlt size={24} className={styles.modalUploadIcon} />
            <span className={styles.modalUploadSpan}>Clique para escolher o arquivo</span>
            <input
              id="upload"
              type="file"
              accept=".pfx"
              className={styles.modalFileInput}
              onChange={(e) => setArquivo(e.target.files?.[0] || null)}
            />
          </label>

          <input
            type="date"
            placeholder="Data de vencimento"
            value={dataVencimento}
            onChange={(e) => setDataVencimento(e.target.value)}
            required
            className={styles.modalInput}
          />

          <div className={styles.modalButtonsContainer}>
            <button 
              type="button" 
              onClick={onClose} 
              className={styles.modalBotaoCancelar}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className={styles.modalBotaoSalvar}
            >
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </div>

          {mensagem && <p className={styles.modalMensagem}>{mensagem}</p>}
        </form>
      </div>
    </div>
  );
}
