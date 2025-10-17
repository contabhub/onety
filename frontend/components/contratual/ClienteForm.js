import { useState, useEffect } from "react";
import styles from "../../styles/contratual/NovoClienteForm.module.css";

export default function ClienteForm({ cliente = null, onClose, onCreate, onUpdate, isFuncionario = false }) {
  const [formData, setFormData] = useState({
    type: "pessoa_fisica",
    name: "",
    cpf_cnpj: "",
    email: "",
    telefone: "",
    endereco: "",
    equipe_id: "",
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
    // funcionário
    departamento_id: "",
    cargo_id: "",
  });
  const [departamentos, setDepartamentos] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [loadingDepartamentos, setLoadingDepartamentos] = useState(false);
  const [loadingCargos, setLoadingCargos] = useState(false);

  useEffect(() => {
    if (cliente) {
      console.log("🔍 [DEBUG] ClienteForm recebeu cliente:", cliente);
      console.log("🔍 [DEBUG] ClienteForm - nome do cliente:", cliente.nome);
      // Garantir que todos os valores sejam strings para evitar undefined
      const clienteData = {
        type: isFuncionario ? "pessoa_fisica" : (cliente.type || "pessoa_fisica"),
        name: cliente.nome || cliente.name || "",
        cpf_cnpj: cliente.cpf_cnpj || "",
        email: cliente.email || "",
        telefone: cliente.telefone || "",
        endereco: cliente.endereco || "",
        equipe_id: cliente.equipe_id || cliente.empresa_id || "", // Mapear empresa_id também
        rg: cliente.rg || "",
        estado_civil: cliente.estado_civil || "",
        profissao: cliente.profissao || "",
        sexo: cliente.sexo || "",
        nacionalidade: cliente.nacionalidade || "",
        cep: cliente.cep || "",
        numero: cliente.numero || "",
        complemento: cliente.complemento || "",
        bairro: cliente.bairro || "",
        cidade: cliente.cidade || "",
        estado: cliente.estado || "",
        representante: cliente.representante || "",
        funcao: cliente.funcao || "",
        lead_id: cliente.lead_id || null,
        departamento_id: cliente.departamento_id || "",
        cargo_id: cliente.cargo_id || "",
      };
      console.log("🔍 [DEBUG] ClienteForm - dados aplicados:", clienteData);
      setFormData(clienteData);
    } else {
      const userRaw = localStorage.getItem("user");
      const userDataRaw = localStorage.getItem("userData");
      const user = userRaw ? JSON.parse(userRaw) : null;
      const userData = userDataRaw ? JSON.parse(userDataRaw) : null;
      
      // Tentar pegar empresa_id de diferentes fontes
      const empresaId = user?.equipe_id || userData?.EmpresaId || user?.EmpresaId || userData?.equipe_id;
      if (empresaId) {
        setFormData((prev) => ({ 
          ...prev, 
          equipe_id: empresaId,
          type: isFuncionario ? "pessoa_fisica" : prev.type
        }));
      } else if (isFuncionario) {
        setFormData((prev) => ({ ...prev, type: "pessoa_fisica" }));
      }
    }
  }, [cliente, isFuncionario]);

  // Buscar departamentos e cargos quando for funcionário
  useEffect(() => {
    if (isFuncionario) {
      fetchDepartamentos();
      fetchCargos();
    }
  }, [isFuncionario]);

  const fetchDepartamentos = async () => {
    setLoadingDepartamentos(true);
    try {
      const token = localStorage.getItem("token");
      const userRaw = localStorage.getItem("userData");
      const user = userRaw ? JSON.parse(userRaw) : null;
      const empresaId = user?.EmpresaId || user?.empresa?.id || user?.Empresa?.id || user?.companyId || user?.empresa_id || user?.empresaId;
      
      if (!empresaId) {
        console.error("Empresa ID não encontrado");
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/departamentos/empresa/${empresaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setDepartamentos(data);
      }
    } catch (error) {
      console.error("Erro ao buscar departamentos:", error);
    } finally {
      setLoadingDepartamentos(false);
    }
  };

  const fetchCargos = async () => {
    setLoadingCargos(true);
    try {
      const token = localStorage.getItem("token");
      const userRaw = localStorage.getItem("userData");
      const user = userRaw ? JSON.parse(userRaw) : null;
      const empresaId = user?.EmpresaId || user?.empresa?.id || user?.Empresa?.id || user?.companyId || user?.empresa_id || user?.empresaId;
      
      if (!empresaId) {
        console.error("Empresa ID não encontrado");
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cargos`, {
        method: 'GET',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-empresa-id': empresaId
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setCargos(data);
      }
    } catch (error) {
      console.error("Erro ao buscar cargos:", error);
    } finally {
      setLoadingCargos(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    const token = localStorage.getItem("token");
    const url = cliente
      ? `${process.env.NEXT_PUBLIC_API_URL}/comercial/pre-clientes/${cliente.id}`
      : `${process.env.NEXT_PUBLIC_API_URL}/comercial/pre-clientes`;

    const method = cliente ? "PUT" : "POST";

    // Converte o email para minúsculas e limpa o CPF/CNPJ antes de enviar
    const dataToSend = {
      ...formData,
      email: formData.email.toLowerCase(),
      cpf_cnpj: formData.cpf_cnpj.replace(/\D/g, ""), // Remove caracteres não numéricos
      empresa_id: formData.equipe_id || cliente?.empresa_id || cliente?.equipe_id, // Mapeia equipe_id para empresa_id
      // Garantir que campos obrigatórios não sejam nulos
      tipo: formData.type || "pessoa_fisica",
      nome: formData.name || "",
      // Remover campos vazios para evitar problemas no backend
      ...Object.fromEntries(
        Object.entries(formData).filter(([key, value]) => {
          // Manter campos obrigatórios mesmo se vazios
          if (['type', 'name', 'cpf_cnpj', 'email', 'equipe_id'].includes(key)) {
            return true;
          }
          // Remover campos vazios dos opcionais
          return value !== null && value !== undefined && value !== "";
        })
      )
    };

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSend),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar cliente.");

      if (cliente) onUpdate(data);
      else onCreate(data.clientId);

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
        name: data.razao_social,
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
      <button
        onClick={onClose}
        className={styles.closeButton}
        aria-label="Fechar formulário"
      >
        ×
      </button>
      {!isFuncionario && (
        <>
          <h3 className={styles.subtitle}>Tipo de Cliente</h3>
          <div className={styles.radioGroup}>
            <label>
              <input
                type="radio"
                name="tipo"
                value="pessoa_fisica"
                checked={formData.type === "pessoa_fisica"}
                onChange={(e) => handleChange("type", e.target.value)}
              />
              Pessoa Física
            </label>
            <label>
              <input
                type="radio"
                name="tipo"
                value="empresa"
                checked={formData.type === "empresa"}
                onChange={(e) => handleChange("type", e.target.value)}
              />
              Empresa
            </label>
          </div>
        </>
      )}

      {/* Campos da Pessoa Física */}
      {formData.type === "pessoa_fisica" && (
        <>
          <div className={styles.grid}>
            <h3 className={styles.subtitle}>{isFuncionario ? "Dados do Funcionário" : "Dados do Cliente"}</h3>
            <div><label>Nome <span style={{color: 'red'}}>*</span></label><input className={styles.input} value={formData.name} onChange={(e) => handleChange("name", e.target.value)} /></div>
            <div><label>Email <span style={{color: 'red'}}>*</span></label><input className={styles.input} value={formData.email} onChange={(e) => handleChange("email", e.target.value)} /></div>
            <div><label>CPF <span style={{color: 'red'}}>*</span></label><input className={styles.input} value={formData.cpf_cnpj} onChange={(e) => handleChange("cpf_cnpj", e.target.value)} /></div>
            <div><label>RG</label><input className={styles.input} value={formData.rg} onChange={(e) => handleChange("rg", e.target.value)} /></div>
            <div><label>Estado Civil</label><select className={styles.input} value={formData.estado_civil} onChange={(e) => handleChange("estado_civil", e.target.value)}><option value="">Selecione</option><option value="solteiro">Solteiro</option><option value="casado">Casado</option><option value="divorciado">Divorciado</option><option value="viuvo">Viúvo</option></select></div>
            <div><label>Profissão</label><input className={styles.input} value={formData.profissao} onChange={(e) => handleChange("profissao", e.target.value)} /></div>
            <div><label>Sexo</label><select className={styles.input} value={formData.sexo} onChange={(e) => handleChange("sexo", e.target.value)}><option value="">Selecione</option><option value="masculino">Masculino</option><option value="feminino">Feminino</option></select></div>
            <div><label>Nacionalidade</label><input className={styles.input} value={formData.nacionalidade} onChange={(e) => handleChange("nacionalidade", e.target.value)} /></div>
            <div><label>Telefone</label><input className={styles.input} value={formData.telefone} onChange={(e) => handleChange("telefone", e.target.value)} /></div>
          </div>

          {/* Campos específicos para funcionários */}
          {isFuncionario && (
            <div className={styles.grid}>
              <h3 className={styles.subtitle}>Dados Profissionais</h3>
              <div>
                <label>Departamento <span style={{color: 'red'}}>*</span></label>
                <select 
                  className={styles.input} 
                  value={formData.departamento_id} 
                  onChange={(e) => handleChange("departamento_id", e.target.value)}
                  disabled={loadingDepartamentos}
                >
                  <option value="">{loadingDepartamentos ? "Carregando..." : "Selecione um departamento"}</option>
                  {departamentos.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Cargo <span style={{color: 'red'}}>*</span></label>
                <select 
                  className={styles.input} 
                  value={formData.cargo_id} 
                  onChange={(e) => handleChange("cargo_id", e.target.value)}
                  disabled={loadingCargos}
                >
                  <option value="">{loadingCargos ? "Carregando..." : "Selecione um cargo"}</option>
                  {cargos.map(cargo => (
                    <option key={cargo.id} value={cargo.id}>{cargo.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

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

      {/* Campos da Empresa */}
      {formData.type === "empresa" && (
        <>
          <div className={styles.grid}>
            <h3 className={styles.subtitle}>Representante Legal</h3>
            <div><label>Representante</label><input className={styles.input} value={formData.representante} onChange={(e) => handleChange("representante", e.target.value)} /></div>
            <div><label>Email <span style={{color: 'red'}}>*</span></label><input className={styles.input} value={formData.email} onChange={(e) => handleChange("email", e.target.value)} /></div>
            <div><label>Função</label><input className={styles.input} value={formData.funcao} onChange={(e) => handleChange("funcao", e.target.value)} /></div>
          </div>

          <div className={styles.grid}>
            <h3 className={styles.subtitle}>Dados da Empresa</h3>
            <div><label>Razão Social</label><input className={styles.input} value={formData.name} onChange={(e) => handleChange("name", e.target.value)} /></div>
            <div><label>CNPJ <span style={{color: 'red'}}>*</span></label><input className={styles.input} value={formData.cpf_cnpj} onChange={(e) => { handleChange("cpf_cnpj", e.target.value); handleBuscarCNPJ(e.target.value); }} /></div>
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
          {cliente ? "Salvar Alterações" : (isFuncionario ? "Criar Funcionário" : "Criar Cliente")}
        </button>
      </div>
    </div>
  );
}
