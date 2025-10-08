import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import styles from "../../styles/contratual/EmpresaEquipe.module.css";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import { faPen, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Plus, Loader2, X } from 'lucide-react';
import Select from "react-select";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const estados = [
  { value: "AC", label: "AC" }, { value: "AL", label: "AL" }, { value: "AP", label: "AP" },
  { value: "AM", label: "AM" }, { value: "BA", label: "BA" }, { value: "CE", label: "CE" },
  { value: "DF", label: "DF" }, { value: "ES", label: "ES" }, { value: "GO", label: "GO" },
  { value: "MA", label: "MA" }, { value: "MT", label: "MT" }, { value: "MS", label: "MS" },
  { value: "MG", label: "MG" }, { value: "PA", label: "PA" }, { value: "PB", label: "PB" },
  { value: "PR", label: "PR" }, { value: "PE", label: "PE" }, { value: "PI", label: "PI" },
  { value: "RJ", label: "RJ" }, { value: "RN", label: "RN" }, { value: "RS", label: "RS" },
  { value: "RO", label: "RO" }, { value: "RR", label: "RR" }, { value: "SC", label: "SC" },
  { value: "SP", label: "SP" }, { value: "SE", label: "SE" }, { value: "TO", label: "TO" }
];

// Funções para formatação de exibição
const formatarCnpj = (cnpj) => {
  if (!cnpj) return '';
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  return cnpjLimpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
};

const formatarTelefone = (telefone) => {
  if (!telefone) return '';
  const telefoneLimpo = telefone.replace(/\D/g, '');
  if (telefoneLimpo.length === 11) {
    return telefoneLimpo.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  } else if (telefoneLimpo.length === 10) {
    return telefoneLimpo.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  }
  return telefone;
};

export default function EmpresaEquipePage() {
  const [empresas, setEmpresas] = useState([]);
  const [form, setForm] = useState({
    name: "",
    razao_social: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    cnpj: "",
    telefone: "",
    ativo: 1,
  });
  const [editando, setEditando] = useState(false);
  const [editId, setEditId] = useState(null);
  const [erro, setErro] = useState("");
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [equipeId, setEquipeId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("userData") || "null");
    const user = JSON.parse(localStorage.getItem("user") || "null");
    const token = localStorage.getItem("token");
    
    console.log("UserData no useEffect:", userData);
    console.log("User no useEffect:", user);
    console.log("Token:", token);
    
    // Usar EmpresaId em vez de equipe_id
    const empresaId = userData?.EmpresaId || user?.EmpresaId || user?.equipe_id;
    
    if (!empresaId || !token) {
      console.log("EmpresaId não encontrado:", empresaId);
      console.log("Token não encontrado:", token);
      setEmpresas([]);
      return;
    }

    console.log("Usando EmpresaId:", empresaId);
    setEquipeId(empresaId);
    buscarEmpresas(empresaId, token);
  }, []);

  // Garantir que empresas seja sempre um array
  useEffect(() => {
    if (empresas === undefined) {
      setEmpresas([]);
    }
  }, [empresas]);

  const buscarEmpresas = async (equipeId, token) => {
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/contratual/contratada/empresa/${equipeId}`;
      console.log("Buscando empresas na URL:", url);
      console.log("Com token:", token ? "Token presente" : "Token ausente");
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      console.log("Resposta da API:", res.status, res.statusText);
      
      if (res.ok) {
        const data = await res.json();
        console.log("Dados recebidos:", data);
        setEmpresas(Array.isArray(data) ? data : []);
      } else {
        console.log("Erro na resposta:", res.status, res.statusText);
        setEmpresas([]);
      }
    } catch (error) {
      console.error("Erro ao buscar empresas:", error);
      setEmpresas([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let valorMascarado = value;
    
    // Aplicar máscaras conforme o campo
    if (name === "cnpj") {
      valorMascarado = mascararCnpj(value);
    } else if (name === "telefone") {
      valorMascarado = mascararTelefone(value);
    } else if (name === "cep") {
      valorMascarado = mascararCep(value);
    }
    
    setForm((prev) => ({ ...prev, [name]: valorMascarado }));
  };

  // Função para buscar dados do CNPJ
  // Função para mascarar CNPJ
  const mascararCnpj = (valor) => {
    if (!valor) return "";
    let apenasNumeros = valor.replace(/\D/g, "");
    if (apenasNumeros.length > 14) apenasNumeros = apenasNumeros.slice(0, 14);
    if (apenasNumeros.length === 14) {
      return apenasNumeros.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    if (apenasNumeros.length > 11) {
      return apenasNumeros.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5");
    }
    if (apenasNumeros.length > 8) {
      return apenasNumeros.replace(/(\d{2})(\d{3})(\d{3})(\d{0,4})/, "$1.$2.$3/$4");
    }
    if (apenasNumeros.length > 5) {
      return apenasNumeros.replace(/(\d{2})(\d{3})(\d{0,3})/, "$1.$2.$3");
    }
    if (apenasNumeros.length > 2) {
      return apenasNumeros.replace(/(\d{2})(\d{0,3})/, "$1.$2");
    }
    return apenasNumeros;
  };

  // Função para mascarar telefone
  const mascararTelefone = (valor) => {
    if (!valor) return "";
    let apenasNumeros = valor.replace(/\D/g, "");
    if (apenasNumeros.length > 11) apenasNumeros = apenasNumeros.slice(0, 11);
    if (apenasNumeros.length === 11) {
      return apenasNumeros.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    if (apenasNumeros.length >= 7) {
      return apenasNumeros.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
    }
    if (apenasNumeros.length >= 3) {
      return apenasNumeros.replace(/(\d{2})(\d{0,4})/, "($1) $2");
    }
    if (apenasNumeros.length > 0) {
      return apenasNumeros.replace(/(\d{0,2})/, "($1");
    }
    return apenasNumeros;
  };

  // Função para mascarar CEP
  const mascararCep = (valor) => {
    if (!valor) return "";
    let apenasNumeros = valor.replace(/\D/g, "");
    if (apenasNumeros.length > 8) apenasNumeros = apenasNumeros.slice(0, 8);
    if (apenasNumeros.length === 8) {
      return apenasNumeros.replace(/(\d{5})(\d{3})/, "$1-$2");
    }
    if (apenasNumeros.length >= 5) {
      return apenasNumeros.replace(/(\d{5})(\d{0,3})/, "$1-$2");
    }
    return apenasNumeros;
  };

  // Função para buscar CEP
  const buscarCep = async (cep) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (!cepLimpo || cepLimpo.length !== 8) return;
    
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      if (res.ok) {
        const data = await res.json();
        if (!data.erro) {
          setForm(prev => ({
            ...prev,
            endereco: data.logradouro || prev.endereco,
            bairro: data.bairro || prev.bairro,
            cidade: data.localidade || prev.cidade,
            estado: data.uf || prev.estado
          }));
        }
      }
    } catch (err) {
      console.error('Erro ao buscar CEP:', err);
    }
  };

  const buscarCnpj = async (cnpj) => {
    setErro("");
    setBuscandoCnpj(true);
    try {
      const cnpjLimpo = (cnpj || "").replace(/\D/g, "");
      if (cnpjLimpo.length !== 14) {
        setErro("CNPJ deve ter 14 dígitos.");
        setBuscandoCnpj(false);
        return;
      }
      const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjLimpo}`);
      const data = await res.json();
      if (!data || data.status === 'ERROR' || data.status === 404 || data.message) {
        setErro(data.message || "CNPJ não encontrado.");
        setBuscandoCnpj(false);
        return;
      }
      setForm(prev => ({
        ...prev,
        name: data.estabelecimento?.nome_fantasia || prev.name,
        razao_social: data.razao_social || prev.razao_social,
        endereco: data.estabelecimento?.logradouro || prev.endereco,
        numero: data.estabelecimento?.numero || prev.numero,
        complemento: data.estabelecimento?.complemento || prev.complemento,
        bairro: data.estabelecimento?.bairro || prev.bairro,
        cidade: data.estabelecimento?.cidade?.nome || prev.cidade,
        estado: data.estabelecimento?.estado?.sigla || prev.estado,
        cep: data.estabelecimento?.cep ? data.estabelecimento.cep.replace(/\D/g, "") : prev.cep,
        telefone: data.estabelecimento?.telefone1 ? data.estabelecimento.telefone1.replace(/\D/g, "") : prev.telefone,
      }));
    } catch (err) {
      setErro("Erro ao buscar dados do CNPJ. Tente novamente.");
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const salvar = async (e) => {
    e.preventDefault(); // PREVINE O RELOAD DA PÁGINA
    setSalvando(true);
    setErro("");

    const token = localStorage.getItem("token");
    
    // Verificar todas as chaves possíveis no localStorage
    console.log("localStorage keys:", Object.keys(localStorage));
    console.log("userData:", localStorage.getItem("userData"));
    console.log("user:", localStorage.getItem("user"));
    
    const userData = JSON.parse(localStorage.getItem("userData") || "null");
    const user = JSON.parse(localStorage.getItem("user") || "null");
    
    // Obter EmpresaId diretamente do userData
    const empresaIdAtual = userData?.EmpresaId || user?.EmpresaId || user?.equipe_id || equipeId;
    console.log("UserData no salvar:", userData);
    console.log("User no salvar:", user);
    console.log("EmpresaId no salvar:", empresaIdAtual);

    // Verificar se já existe uma empresa com o mesmo CNPJ
    if (form.cnpj) {
      const cnpjLimpo = form.cnpj.replace(/\D/g, '');
      const empresaExistente = empresas.find(emp => 
        emp.cnpj === cnpjLimpo && 
        (!editando || emp.id !== editId)
      );
      
      if (empresaExistente) {
        setErro("Já existe uma empresa contratada com este CNPJ.");
        toast.error("Já existe uma empresa contratada com este CNPJ.");
        setSalvando(false);
        return;
      }
    }

    try {
      // Dados limpos para enviar
      const dadosParaEnviar = { 
        ...form, 
        nome: form.name, // Corrigido: mapear name para nome
        cnpj: form.cnpj?.replace(/\D/g, ''),
        telefone: form.telefone?.replace(/\D/g, ''),
        cep: form.cep?.replace(/\D/g, ''),
        empresa_id: empresaIdAtual // Usar empresaIdAtual obtido diretamente do userData
      };
      
      // Remove o campo 'name' duplicado
      delete dadosParaEnviar.name;

      console.log("Dados sendo enviados:", dadosParaEnviar);
      console.log("URL da API:", process.env.NEXT_PUBLIC_API_URL);
      console.log("equipeId atual:", equipeId);

      let res, data;
      if (editando && editId) {
        console.log("Editando empresa com ID:", editId);
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/contratada/${editId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(dadosParaEnviar),
        });
        data = await res.json();
        console.log("Resposta da edição:", { status: res.status, data });
        if (!res.ok) throw new Error(data.error || "Erro ao atualizar.");
      } else {
        console.log("Criando nova empresa");
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/contratada`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(dadosParaEnviar),
        });
        data = await res.json();
        console.log("Resposta da criação:", { status: res.status, data });
        if (!res.ok) throw new Error(data.error || "Erro ao criar.");
      }
      await buscarEmpresas(empresaIdAtual, token);
      setEditando(false);
      setEditId(null);
      setShowForm(false);
      setForm({
        name: "",
        razao_social: "",
        endereco: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
        cep: "",
        cnpj: "",
        telefone: "",
        email: "", // Adicionado
        site: "", // Adicionado
        ativo: 1,
      });
    } catch (err) {
      console.error("Erro completo:", err);
      console.error("Mensagem do erro:", err.message);
      setErro(err.message);
      toast.error(err.message);
      // Alert temporário para debug
      alert(`ERRO: ${err.message}\nVerifique o console para mais detalhes.`);
    } finally {
      setSalvando(false);
    }
  };

  const toggleAtivoEmpresa = async (empresa) => {
    if (!empresa) return;
    const token = localStorage.getItem("token");
    const url = `${process.env.NEXT_PUBLIC_API_URL}/contratual/contratada/${empresa.id}/${empresa.ativo ? "inativar" : "ativar"}`;
    try {
      await fetch(url, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      setEmpresas((prev) => (prev || []).map(e => e.id === empresa.id ? { ...e, ativo: e.ativo ? 0 : 1 } : e));
    } catch (err) {
      toast.error("Erro ao atualizar status da empresa.");
    }
  };

  const deletarEmpresa = async (empresa) => {
    if (!empresa || !window.confirm("Deseja realmente excluir esta empresa?")) return;
    const token = localStorage.getItem("token");
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/contratada/${empresa.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setEmpresas((prev) => (prev || []).filter(e => e.id !== empresa.id));
    } catch (err) {
      toast.error("Erro ao excluir empresa.");
    }
  };

  return (
    <div className={styles.page}>
      <PrincipalSidebar />
      <div className={styles.pageContent}>
        <div className={styles.pageHeader}>
          <div className={styles.toolbarBox}>
            <div className={styles.toolbarHeader}>
              <span className={styles.title}>Empresas Contratadas</span>
              <div className={styles.filtersRowBox}>
                <button
                  onClick={() => {
                    setShowForm(true);
                    setEditando(false);
                    setEditId(null);
                    setForm({
                      name: "",
                      razao_social: "",
                      endereco: "",
                      numero: "",
                      complemento: "",
                      bairro: "",
                      cidade: "",
                      estado: "",
                      cep: "",
                      cnpj: "",
                      telefone: "",
                      ativo: 1,
                    });
                  }}
                  className={styles.addButton}
                >
                  <span style={{display:'inline-flex',gap:'8px',alignItems:'center'}}>
                    <Plus className="h-4 w-4" />
                    Nova Empresa
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className={styles.contentScroll}>
          {erro && <p className={styles.error}>{erro}</p>}

        <div className={styles.empresasList}>
          {(empresas || []).length === 0 && <p>Nenhuma empresa cadastrada.</p>}
          {(empresas || []).map((empresa) => (
            <div key={empresa.id} className={styles.card}>
              <h2>{empresa.name}</h2>
              <p><strong>CNPJ:</strong> {formatarCnpj(empresa.cnpj)}</p>
              <p><strong>Telefone:</strong> {formatarTelefone(empresa.telefone)}</p>
              <p><strong>Endereço:</strong> {empresa.endereco}, {empresa.numero} - {empresa.bairro}, {empresa.cidade}/{empresa.estado}</p>
              <p>
                <strong>Status:</strong>{" "}
                <span style={{ color: empresa.ativo ? "green" : "red", fontWeight: 600 }}>
                  {empresa.ativo ? "Ativa" : "Inativa"}
                </span>
              </p>
              <div className={styles.cardActions}>
                <button
                  className={`${styles.toggleButton} ${!empresa.ativo ? styles.inactive : ''}`}
                  onClick={() => toggleAtivoEmpresa(empresa)}
                >
                  {empresa.ativo ? "Inativar" : "Ativar"}
                </button>
                <button
                  className={styles.editButton}
                  onClick={() => {
                    setShowForm(true);
                    setEditando(true);
                    setEditId(empresa.id);
                    setForm({ ...empresa });
                  }}
                >
                  <FontAwesomeIcon icon={faPen} />
                  Editar
                </button>
                <button
                  className={styles.deleteButtonCard}
                  onClick={() => deletarEmpresa(empresa)}
                >
                  <FontAwesomeIcon icon={faTrash} />
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>

        {showForm && (
          <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h3>{editando ? "Editar Empresa" : "Nova Empresa"}</h3>
                <button onClick={() => setShowForm(false)} className={styles.iconBtn}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={salvar} className={styles.modalForm}>
                <div className={styles.section}>
                  <h4 className={styles.sectionTitle}>Dados da Empresa</h4>
                  <div className={styles.grid}>
                    <div className={styles.field}>
                      <label>CNPJ *</label>
                      <div className={styles.inputBox}>
                        <input
                          type="text"
                          name="cnpj"
                          value={form.cnpj}
                          onChange={handleInputChange}
                          onBlur={(e) => buscarCnpj(e.target.value)}
                          disabled={buscandoCnpj}
                          placeholder="00.000.000/0000-00"
                          maxLength={18}
                          required
                        />
                      </div>
                      {buscandoCnpj && <span style={{ fontSize: '0.95em', color: '#666', display: 'block', marginTop: 4 }}>Buscando dados...</span>}
                    </div>
                    <div className={styles.field}>
                      <label>Nome Fantasia *</label>
                      <div className={styles.inputBox}>
                        <input
                          type="text"
                          name="name"
                          value={form.name}
                          onChange={handleInputChange}
                          placeholder="Nome fantasia da empresa"
                          required
                        />
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label>Razão Social *</label>
                      <div className={styles.inputBox}>
                        <input
                          type="text"
                          name="razao_social"
                          value={form.razao_social}
                          onChange={handleInputChange}
                          placeholder="Razão social completa"
                          required
                        />
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label>Email</label>
                      <div className={styles.inputBox}>
                        <input
                          type="email"
                          name="email"
                          value={form.email}
                          onChange={handleInputChange}
                          placeholder="email@empresa.com"
                        />
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label>Telefone</label>
                      <div className={styles.inputBox}>
                        <input
                          type="tel"
                          name="telefone"
                          value={form.telefone}
                          onChange={handleInputChange}
                          placeholder="(11) 99999-9999"
                          maxLength={15}
                        />
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label>Site</label>
                      <div className={styles.inputBox}>
                        <input
                          type="url"
                          name="site"
                          value={form.site}
                          onChange={handleInputChange}
                          placeholder="https://www.empresa.com"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.section}>
                  <h4 className={styles.sectionTitle}>Endereço</h4>
                  <div className={styles.grid}>
                    <div className={styles.field}>
                      <label>CEP</label>
                      <div className={styles.inputBox}>
                        <input
                          type="text"
                          name="cep"
                          value={form.cep}
                          onChange={handleInputChange}
                          onBlur={(e) => buscarCep(e.target.value)}
                          placeholder="00000-000"
                          maxLength={9}
                        />
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label>Endereço</label>
                      <div className={styles.inputBox}>
                        <input
                          type="text"
                          name="endereco"
                          value={form.endereco}
                          onChange={handleInputChange}
                          placeholder="Rua, Avenida, etc."
                        />
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label>Número</label>
                      <div className={styles.inputBox}>
                        <input
                          type="text"
                          name="numero"
                          value={form.numero}
                          onChange={handleInputChange}
                          placeholder="123"
                        />
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label>Complemento</label>
                      <div className={styles.inputBox}>
                        <input
                          type="text"
                          name="complemento"
                          value={form.complemento}
                          onChange={handleInputChange}
                          placeholder="Sala, Andar, etc."
                        />
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label>Bairro</label>
                      <div className={styles.inputBox}>
                        <input
                          type="text"
                          name="bairro"
                          value={form.bairro}
                          onChange={handleInputChange}
                          placeholder="Nome do bairro"
                        />
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label>Cidade</label>
                      <div className={styles.inputBox}>
                        <input
                          type="text"
                          name="cidade"
                          value={form.cidade}
                          onChange={handleInputChange}
                          placeholder="Nome da cidade"
                        />
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label>Estado *</label>
                      <div className={styles.inputBox}>
                        <Select
                          options={estados}
                          value={estados.find(e => e.value === form.estado) || null}
                          onChange={option => setForm(prev => ({ ...prev, estado: option ? option.value : "" }))}
                          placeholder="Selecione o estado"
                          styles={{
                            control: (base) => ({
                              ...base,
                              backgroundColor: 'transparent',
                              border: 'none',
                              boxShadow: 'none',
                            }),
                            menu: base => ({
                              ...base,
                              backgroundColor: 'var(--onity-color-surface)',
                              border: '1px solid var(--onity-color-border)',
                              borderRadius: '8px',
                              boxShadow: 'var(--onity-elev-med)',
                            }),
                            option: (base, state) => ({
                              ...base,
                              backgroundColor: state.isSelected 
                                ? 'var(--onity-color-primary)' 
                                : state.isFocused 
                                ? 'var(--onity-color-bg)'
                                : 'transparent',
                              color: state.isSelected 
                                ? 'var(--onity-color-primary-contrast)' 
                                : 'var(--onity-color-text)',
                            }),
                            singleValue: base => ({
                              ...base,
                              color: 'var(--onity-color-text)',
                            }),
                            placeholder: base => ({
                              ...base,
                              color: 'var(--onity-color-text-secondary)',
                            }),
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.section}>
                  <div className={styles.row}>
                    <label className={styles.radio}>
                      <input
                        type="checkbox"
                        checked={!!form.ativo}
                        onChange={(e) => setForm(prev => ({ ...prev, ativo: e.target.checked ? 1 : 0 }))}
                      />
                      Empresa ativa
                    </label>
                  </div>
                </div>

                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => {
                      setEditando(false);
                      setEditId(null);
                      setShowForm(false);
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className={styles.primaryBtn}
                    disabled={salvando}
                  >
                    {salvando && <Loader2 className={styles.spinnerIcon} />}
                    {salvando ? "Salvando..." : editando ? "Atualizar" : "Criar Empresa"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        </div>
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick={true}
          rtl={false}
          pauseOnFocusLoss={true}
          draggable={true}
          pauseOnHover={true}
          theme="colored"
        />
      </div>
    </div>
  );
}
