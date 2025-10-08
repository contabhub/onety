import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import styles from "../styles/EmpresaEquipe.module.css";
import Layout from "../components/layout/Layout";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Select from "react-select";
import { ToastContainer, toast, Bounce } from 'react-toastify';
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
    const user = JSON.parse(localStorage.getItem("user"));
    const token = localStorage.getItem("token");
    if (!user || !token || !user.equipe_id) return;

    setEquipeId(user.equipe_id);
    buscarEmpresas(user.equipe_id, token);
  }, []);

  const buscarEmpresas = async (equipeId, token) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/equipe-empresa/equipe/${equipeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEmpresas(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Erro ao buscar empresas:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Função para buscar dados do CNPJ
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

  const salvar = async () => {
    setSalvando(true);
    setErro("");

    const token = localStorage.getItem("token");

    try {
      let res, data;
      if (editando && editId) {
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/equipe-empresa/${editId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ...form, equipe_id: equipeId }),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao atualizar.");
      } else {
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/equipe-empresa`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ...form, equipe_id: equipeId }),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao criar.");
      }
      await buscarEmpresas(equipeId, token);
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
        ativo: 1,
      });
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  };

  const toggleAtivoEmpresa = async (empresa) => {
    if (!empresa) return;
    const token = localStorage.getItem("token");
    const url = `${process.env.NEXT_PUBLIC_API_URL}/equipe-empresa/${empresa.id}/${empresa.ativo ? "inativar" : "ativar"}`;
    try {
      await fetch(url, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      setEmpresas((prev) => prev.map(e => e.id === empresa.id ? { ...e, ativo: e.ativo ? 0 : 1 } : e));
    } catch (err) {
      toast.error("Erro ao atualizar status da empresa.");
    }
  };

  const deletarEmpresa = async (empresa) => {
    if (!empresa || !window.confirm("Deseja realmente excluir esta empresa?")) return;
    const token = localStorage.getItem("token");
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/equipe-empresa/${empresa.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setEmpresas((prev) => prev.filter(e => e.id !== empresa.id));
    } catch (err) {
      toast.error("Erro ao excluir empresa.");
    }
  };

  return (
    <Layout>
      <div className={styles.container}>
        <button className={styles.backButton} onClick={() => router.back()}>
          <span className={styles.iconWrapper}>
            <FontAwesomeIcon icon={faArrowLeft} />
          </span>
          Voltar
        </button>
        <h1 className={styles.title}>Empresa da Equipe</h1>

        {erro && <p className={styles.error}>{erro}</p>}

        <button
          className={styles.novaEmpresaBtn}
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
          style={{ marginBottom: 24 }}
        >
          Nova Empresa
        </button>

        <div className={styles.empresasList}>
          {empresas.length === 0 && <p>Nenhuma empresa cadastrada.</p>}
          {empresas.map((empresa) => (
            <div key={empresa.id} className={styles.card}>
              <h2>{empresa.name}</h2>
              <p><strong>CNPJ:</strong> {empresa.cnpj}</p>
              <p><strong>Telefone:</strong> {empresa.telefone}</p>
              <p><strong>Endereço:</strong> {empresa.endereco}, {empresa.numero} - {empresa.bairro}, {empresa.cidade}/{empresa.estado}</p>
              <p>
                <strong>Status:</strong>{" "}
                <span style={{ color: empresa.ativo ? "green" : "red", fontWeight: 600 }}>
                  {empresa.ativo ? "Ativa" : "Inativa"}
                </span>
                <button
                  className={styles.toggleAtivoBtn}
                  onClick={() => toggleAtivoEmpresa(empresa)}
                  data-ativo={empresa.ativo ? "1" : "0"}
                >
                  {empresa.ativo ? "Inativar" : "Ativar"}
                </button>
              </p>
              <div className={styles.cardActions}>
                <button
                  className={styles.editButton}
                  onClick={() => {
                    setShowForm(true);
                    setEditando(true);
                    setEditId(empresa.id);
                    setForm({ ...empresa });
                  }}
                >Editar</button>
                <button
                  className={styles.deleteButton}
                  onClick={() => deletarEmpresa(empresa)}
                >Excluir</button>
              </div>
            </div>
          ))}
        </div>

        {showForm && (
          <form className={styles.form} style={{ marginTop: 24 }}>
            {[
              { label: "CNPJ", name: "cnpj", onBlur: (e) => buscarCnpj(e.target.value) },
              { label: "Nome Fantasia", name: "name" },
              { label: "Razão Social", name: "razao_social" },
              { label: "Endereço", name: "endereco" },
              { label: "Número", name: "numero" },
              { label: "Complemento", name: "complemento" },
              { label: "Bairro", name: "bairro" },
              { label: "Cidade", name: "cidade" },
              { label: "CEP", name: "cep" },
              { label: "Telefone", name: "telefone" },
            ].map(({ label, name, onBlur }) => (
              <div key={name} className={styles.formItem}>
                <label>{label}</label>
                <input
                  type="text"
                  name={name}
                  value={form[name]}
                  onChange={handleInputChange}
                  placeholder={label}
                  className={styles.input}
                  onBlur={onBlur}
                  disabled={name === "cnpj" && buscandoCnpj}
                />
                {name === "cnpj" && (
                  <span style={{ fontSize: '0.95em', color: '#666', display: 'block', marginTop: 4 }}>
                    Ao preencher o CNPJ e sair do campo, os dados da empresa serão preenchidos automaticamente.
                  </span>
                )}
              </div>
            ))}

            <div className={styles.formItem}>
              <label>Estado</label>
              <Select
                options={estados}
                value={estados.find(e => e.value === form.estado) || null}
                onChange={option => setForm(prev => ({ ...prev, estado: option ? option.value : "" }))}
                placeholder="Selecione..."
                classNamePrefix="react-select"
                isClearable
                styles={{
                  container: base => ({ ...base, minWidth: 240, maxWidth: 320 }),
                  control: (base, state) => ({
                    ...base,
                    backgroundColor: 'var(--color-surface-1)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-card)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: 'var(--color-divider)',
                    },
                    ...(state.isFocused && {
                      borderColor: 'var(--brand-primary)',
                      boxShadow: '0 0 0 2px color-mix(in srgb, var(--brand-primary) 20%, transparent)',
                    }),
                  }),
                  menu: base => ({
                    ...base,
                    backgroundColor: 'var(--color-surface-1)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-card)',
                    marginTop: '4px',
                  }),
                  option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isSelected 
                      ? 'var(--brand-primary)' 
                      : state.isFocused 
                      ? 'color-mix(in srgb, var(--brand-primary) 12%, transparent)'
                      : 'var(--color-surface-1)',
                    color: state.isSelected 
                      ? 'white' 
                      : 'var(--color-text-primary)',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                    '&:hover': {
                      backgroundColor: state.isSelected 
                        ? 'var(--brand-primary)' 
                        : 'var(--color-surface-2)',
                    },
                  }),
                  singleValue: base => ({
                    ...base,
                    color: 'var(--color-text-primary)',
                  }),
                  placeholder: base => ({
                    ...base,
                    color: 'var(--color-text-secondary)',
                  }),
                  input: base => ({
                    ...base,
                    color: 'var(--color-text-primary)',
                  }),
                  indicatorSeparator: base => ({
                    ...base,
                    backgroundColor: 'var(--color-border)',
                  }),
                  indicatorsContainer: base => ({
                    ...base,
                    color: 'var(--color-text-secondary)',
                  }),
                  dropdownIndicator: (base, state) => ({
                    ...base,
                    color: 'var(--color-text-secondary)',
                    transition: 'color 0.2s ease',
                    '&:hover': {
                      color: 'var(--color-text-primary)',
                    },
                  }),
                }}
              />
            </div>

            <div className={styles.formItem}>
              <label>
                <input
                  type="checkbox"
                  name="ativo"
                  checked={!!form.ativo}
                  onChange={(e) => setForm(prev => ({ ...prev, ativo: e.target.checked ? 1 : 0 }))}
                />
                Empresa ativa?
              </label>
            </div>

            <div className={styles.buttons}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => {
                  setEditando(false);
                  setEditId(null);
                  setShowForm(false);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.confirmButton}
                onClick={salvar}
                disabled={salvando}
              >
                {salvando ? "Salvando..." : editando ? "Atualizar" : "Criar"}
              </button>
            </div>
          </form>
        )}
      </div>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick={false}
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
        transition={Bounce}
      />
    </Layout>
  );
}
