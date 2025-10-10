import { useState, useEffect } from "react";
import styles from "../../styles/contratual/NovoClienteForm.module.css";

export default function LeadToClientForm({ lead = null, onClose, onCreate }) {
  const [formData, setFormData] = useState({
    tipo: "pessoa_fisica",
    nome: "",
    cpf_cnpj: "",
    email: "",
    telefone: "",
    endereco: "",
    empresa_id: "",
    rg: "",
    estado_civil: "",
    profissao: "",
    sexo: "",
    nacionalidade: "",
    cep: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    representante: "",
    funcao: "",
    lead_id: null,
  });

  useEffect(() => {
    // Buscar empresa_id do localStorage
    const userDataRaw = localStorage.getItem("userData");
    const userRaw = localStorage.getItem("user");
    const userData = userDataRaw ? JSON.parse(userDataRaw) : null;
    const user = userRaw ? JSON.parse(userRaw) : null;
    const empresaId = userData?.EmpresaId || user?.EmpresaId || user?.equipe_id;

    if (lead) {
      setFormData((prev) => ({
        ...prev,
        tipo: lead.tipo || lead.type || "pessoa_fisica",
        nome: lead.nome || lead.name || "",
        cpf_cnpj: lead.cpf_cnpj || "",
        email: lead.email || "",
        telefone: lead.telefone || "",
        endereco: lead.endereco || "",
        rg: lead.rg || "",
        estado_civil: lead.estado_civil || "",
        profissao: lead.profissao || "",
        sexo: lead.sexo || "",
        nacionalidade: lead.nacionalidade || "",
        cep: lead.cep || "",
        numero: lead.numero || "",
        complemento: lead.complemento || "",
        bairro: lead.bairro || "",
        cidade: lead.cidade || "",
        estado: lead.estado || "",
        representante: lead.representante || "",
        funcao: lead.funcao || "",
        lead_id: lead.id,
        empresa_id: empresaId || prev.empresa_id,
      }));
    } else {
      if (empresaId) {
        setFormData((prev) => ({ ...prev, empresa_id: empresaId }));
      }
    }
  }, [lead]);
  

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Você precisa estar logado para salvar.");
      return;
    }

    // Limpar dados antes de enviar
    const dadosLimpos = {
      ...formData,
      // Converter valores vazios, "Selecione" ou undefined para null
      rg: formData.rg || null,
      estado_civil: (formData.estado_civil && formData.estado_civil !== "") ? formData.estado_civil : null,
      profissao: formData.profissao || null,
      sexo: (formData.sexo && formData.sexo !== "") ? formData.sexo : null,
      nacionalidade: formData.nacionalidade || null,
      cep: formData.cep || null,
      numero: formData.numero || null,
      complemento: formData.complemento || null,
      bairro: formData.bairro || null,
      cidade: formData.cidade || null,
      estado: (formData.estado && formData.estado !== "" && formData.estado !== "Selecione") ? formData.estado : null,
      representante: formData.representante || null,
      funcao: formData.funcao || null,
      // Limpar CPF/CNPJ removendo caracteres não numéricos
      cpf_cnpj: formData.cpf_cnpj ? formData.cpf_cnpj.replace(/\D/g, "") : "",
    };

    try {
      console.log("Dados que serão enviados:", dadosLimpos);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/pre-clientes`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dadosLimpos),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar cliente.");

      onCreate(data.clientId);
      onClose();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleBuscarCEP = async (cep) => {
    const cepLimpo = cep.replace(/\D/g, "");
    if (cepLimpo.length !== 8) return;

    const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    const data = await res.json();

    if (!data.erro) {
      setFormData((prev) => ({
        ...prev,
        endereco: data.logradouro || prev.endereco,
        bairro: data.bairro || prev.bairro,
        cidade: data.localidade || prev.cidade,
        estado: data.uf || prev.estado,
      }));
    }
  };

  const handleBuscarCNPJ = async (cnpj) => {
    const cnpjLimpo = cnpj.replace(/\D/g, "");
    if (cnpjLimpo.length !== 14) return;

    const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjLimpo}`);
    const data = await res.json();

    if (data.razao_social) {
      setFormData((prev) => ({
        ...prev,
        nome: data.razao_social,
        telefone: data.estabelecimento?.telefone1
          ? `(${data.estabelecimento.ddd1}) ${data.estabelecimento.telefone1}`
          : prev.telefone,
        endereco: `${data.estabelecimento?.logradouro || ""} ${data.estabelecimento?.numero || ""}`.trim(),
        bairro: data.estabelecimento?.bairro || "",
        cidade: data.estabelecimento?.cidade?.nome || "",
        estado: data.estabelecimento?.estado?.sigla || "",
        cep: data.estabelecimento?.cep || "",
      }));
    }
  };

  return (
    <div className={styles.formContainer}>
      <h3 className={styles.subtitle}>Tipo de Cliente</h3>
      <div className={styles.radioGroup}>
        <label>
          <input
            type="radio"
            name="tipo"
            value="pessoa_fisica"
            checked={formData.tipo === "pessoa_fisica"}
            onChange={(e) => handleChange("tipo", e.target.value)}
          />
          Pessoa Física
        </label>
        <label>
          <input
            type="radio"
            name="tipo"
            value="empresa"
            checked={formData.tipo === "empresa"}
            onChange={(e) => handleChange("tipo", e.target.value)}
          />
          Empresa
        </label>
      </div>

      {formData.tipo === "pessoa_fisica" && (
        <>
          <div className={styles.grid}>
            <h3 className={styles.subtitle}>Dados do Cliente</h3>
            <div><label>Nome</label><input className={styles.input} value={formData.nome} onChange={(e) => handleChange("nome", e.target.value)} /></div>
            <div><label>Email</label><input className={styles.input} value={formData.email} onChange={(e) => handleChange("email", e.target.value)} /></div>
            <div><label>CPF</label><input className={styles.input} value={formData.cpf_cnpj} onChange={(e) => handleChange("cpf_cnpj", e.target.value)} /></div>
            <div><label>RG</label><input className={styles.input} value={formData.rg} onChange={(e) => handleChange("rg", e.target.value)} /></div>
            <div><label>Estado Civil</label><select className={styles.input} value={formData.estado_civil} onChange={(e) => handleChange("estado_civil", e.target.value)}><option value="">Selecione</option><option value="solteiro">Solteiro</option><option value="casado">Casado</option><option value="divorciado">Divorciado</option><option value="viuvo">Viúvo</option></select></div>
            <div><label>Profissão</label><input className={styles.input} value={formData.profissao} onChange={(e) => handleChange("profissao", e.target.value)} /></div>
            <div><label>Sexo</label><select className={styles.input} value={formData.sexo} onChange={(e) => handleChange("sexo", e.target.value)}><option value="">Selecione</option><option value="masculino">Masculino</option><option value="feminino">Feminino</option></select></div>
            <div><label>Nacionalidade</label><input className={styles.input} value={formData.nacionalidade} onChange={(e) => handleChange("nacionalidade", e.target.value)} /></div>
            <div><label>Telefone</label><input className={styles.input} value={formData.telefone} onChange={(e) => handleChange("telefone", e.target.value)} /></div>
          </div>

          <div className={styles.grid}>
            <h3 className={styles.subtitle}>Endereço</h3>
            <div><label>CEP</label><input className={styles.input} value={formData.cep} onChange={(e) => { handleChange("cep", e.target.value); handleBuscarCEP(e.target.value); }} /></div>
            <div><label>Endereço</label><input className={styles.input} value={formData.endereco} onChange={(e) => handleChange("endereco", e.target.value)} /></div>
            <div><label>Número</label><input className={styles.input} value={formData.numero} onChange={(e) => handleChange("numero", e.target.value)} /></div>
            <div><label>Complemento</label><input className={styles.input} value={formData.complemento} onChange={(e) => handleChange("complemento", e.target.value)} /></div>
            <div><label>Bairro</label><input className={styles.input} value={formData.bairro} onChange={(e) => handleChange("bairro", e.target.value)} /></div>
            <div><label>Cidade</label><input className={styles.input} value={formData.cidade} onChange={(e) => handleChange("cidade", e.target.value)} /></div>
            <div><label>Estado</label><input className={styles.input} value={formData.estado} onChange={(e) => handleChange("estado", e.target.value)} /></div>
          </div>
        </>
      )}

      {formData.tipo === "empresa" && (
        <>
          <div className={styles.grid}>
            <h3 className={styles.subtitle}>Representante Legal</h3>
            <div><label>Representante</label><input className={styles.input} value={formData.representante} onChange={(e) => handleChange("representante", e.target.value)} /></div>
            <div><label>Email</label><input className={styles.input} value={formData.email} onChange={(e) => handleChange("email", e.target.value)} /></div>
            <div><label>Função</label><input className={styles.input} value={formData.funcao} onChange={(e) => handleChange("funcao", e.target.value)} /></div>
          </div>

          <div className={styles.grid}>
            <h3 className={styles.subtitle}>Dados da Empresa</h3>
            <div><label>Razão Social</label><input className={styles.input} value={formData.nome} onChange={(e) => handleChange("nome", e.target.value)} /></div>
            <div><label>CNPJ</label><input className={styles.input} value={formData.cpf_cnpj} onChange={(e) => { handleChange("cpf_cnpj", e.target.value); handleBuscarCNPJ(e.target.value); }} /></div>
            <div><label>Telefone</label><input className={styles.input} value={formData.telefone} onChange={(e) => handleChange("telefone", e.target.value)} /></div>
          </div>

          <div className={styles.grid}>
            <h3 className={styles.subtitle}>Endereço</h3>
            <div><label>CEP</label><input className={styles.input} value={formData.cep} onChange={(e) => { handleChange("cep", e.target.value); handleBuscarCEP(e.target.value); }} /></div>
            <div><label>Endereço</label><input className={styles.input} value={formData.endereco} onChange={(e) => handleChange("endereco", e.target.value)} /></div>
            <div><label>Número</label><input className={styles.input} value={formData.numero} onChange={(e) => handleChange("numero", e.target.value)} /></div>
            <div><label>Complemento</label><input className={styles.input} value={formData.complemento} onChange={(e) => handleChange("complemento", e.target.value)} /></div>
            <div><label>Bairro</label><input className={styles.input} value={formData.bairro} onChange={(e) => handleChange("bairro", e.target.value)} /></div>
            <div><label>Cidade</label><input className={styles.input} value={formData.cidade} onChange={(e) => handleChange("cidade", e.target.value)} /></div>
            <div><label>Estado</label><input className={styles.input} value={formData.estado} onChange={(e) => handleChange("estado", e.target.value)} /></div>
          </div>
        </>
      )}

      <div className={styles.formActions}>
        <button className={styles.button} onClick={handleSubmit}>
          Criar Cliente
        </button>
      </div>
    </div>
  );
}
