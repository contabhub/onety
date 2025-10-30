import React, { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Select from "react-select";
// estilos globais já aplicados via globals.css em _app.js

// Cliente HTTP mínimo (fetch)
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
const api = {
  get: async (url, config = {}) => {
    const params = config.params ? `?${new URLSearchParams(config.params).toString()}` : '';
    const res = await fetch(`${API_BASE}${url}${params}`, { headers: config.headers || {} });
    return { data: await res.json() };
  },
  post: async (url, body, config = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(config.headers || {}) };
    const res = await fetch(`${API_BASE}${url}`, { method: 'POST', headers, body: JSON.stringify(body) });
    return { data: await res.json() };
  }
};


export default function NovoClienteModal({ onClose, onSuccess }) {
  const [doresOptions, setDoresOptions] = useState([]);
  const [solucoesOptions, setSolucoesOptions] = useState([]);
  const [form, setForm] = useState({
    tipoInscricao: "",
    cnpjCpf: "",
    nome: "",
    apelido: "",
    tipo: "Fixo",
    sistema: "",
    base: "",
    codigo: "",
    status: "Ativo",
    grupoIds: [],
    dataInicio: new Date().toISOString().slice(0, 10),
    telefone: "",
    email: "",
    empresaId: "",
    dores: [],
    solucoes: [],
    // Novos campos de endereço
    endereco: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
  });

  const [grupos, setGrupos] = useState([]);
  const [mapaDoresSolucoes, setMapaDoresSolucoes] = useState({});

  // Busca os grupos da empresa ao montar
  useEffect(() => {
    const empresaId = sessionStorage.getItem("empresaId");
    if (empresaId) {
      setForm((prev) => ({ ...prev, empresaId }));
    }
    // Buscar grupos
    async function fetchGrupos() {
      const token = sessionStorage.getItem("token");
      if (!empresaId || !token) return;
      try {
        const res = await api.get("/api/clientes/grupos/todos", {
          params: { empresaId },
          headers: { Authorization: `Bearer ${token}` },
        });
        setGrupos(res.data.grupos || []);
      } catch {
        setGrupos([]);
      }
    }
    fetchGrupos();
    api.get("/api/clientes/dores").then(res => {
      const options = res.data.map((d) => ({ value: d, label: d }));
      const hasOutros = options.some((o) => o.value === "Outros");
      setDoresOptions(hasOutros ? options : [...options, { value: "Outros", label: "Outros" }]);
    });
    api.get("/api/clientes/solucoes").then(res => {
      const options = res.data.map((s) => ({ value: s, label: s }));
      const hasOutros = options.some((o) => o.value === "Outros");
      setSolucoesOptions(hasOutros ? options : [...options, { value: "Outros", label: "Outros" }]);
    });
    api.get("/api/clientes/mapa-dores-solucoes").then(res => {
      setMapaDoresSolucoes(res.data);
    });
  }, []);

  // Filtra as soluções possíveis conforme as dores selecionadas
  const doresSelecionadas = form.dores || [];
  const solucoesPossiveis = Array.from(new Set(
    doresSelecionadas.flatMap((dor) => mapaDoresSolucoes[dor] || [])
  ));
  const solucoesOptionsFiltradasBase = solucoesOptions.filter(opt => solucoesPossiveis.includes(opt.value));
  const incluiOutros = solucoesOptionsFiltradasBase.some(opt => opt.value === "Outros");
  const solucoesOptionsFiltradas = incluiOutros
    ? solucoesOptionsFiltradasBase
    : [...solucoesOptionsFiltradasBase, { value: "Outros", label: "Outros" }];

  // Remove soluções incompatíveis do form.solucoes
  useEffect(() => {
    if (!form.solucoes) return;
    const novasSolucoes = (form.solucoes).filter((s) => solucoesPossiveis.includes(s));
    if (novasSolucoes.length !== form.solucoes.length) {
      setForm((f) => ({ ...f, solucoes: novasSolucoes }));
    }
    // eslint-disable-next-line
  }, [JSON.stringify(doresSelecionadas), JSON.stringify(mapaDoresSolucoes)]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleConfirmar = async () => {
    try {
      await api.post("/api/clientes/cadastrar/individual", form);
      toast.success("Cliente cadastrado com sucesso!");
      onClose();
    } catch (error) {
      // 🔍 TRATAMENTO ESPECÍFICO PARA CLIENTES DUPLICADOS
      if (error.response?.status === 409 && error.response?.data?.error === "Cliente duplicado") {
        const duplicata = error.response.data.duplicata;
        const tipoDuplicata = duplicata.tipo === 'CNPJ/CPF' ? 'CNPJ/CPF' : 'nome';
        const valorDuplicata = duplicata.valor;
        
        toast.error(
          `Cliente duplicado! Já existe um cliente com ${tipoDuplicata === 'CNPJ/CPF' ? 'este CNPJ/CPF' : 'este nome'}: ${valorDuplicata}`,
          {
            autoClose: 5000,
            position: "top-center"
          }
        );
      } else {
        // Erro genérico
        toast.error("Erro ao cadastrar cliente.");
      }
    }
  };

  return (
    <div style={{
      ...overlayStyle,
      backgroundColor:
        typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light'
          ? 'rgba(255, 255, 255, 0.55)'
          : overlayStyle.backgroundColor
    }}>    <ToastContainer
    position="top-right"
    autoClose={2300}
    hideProgressBar={false}
    newestOnTop={false}
    closeOnClick
    rtl={false}
    pauseOnFocusLoss
    draggable
    pauseOnHover
    theme="dark"
    toastClassName="toast-custom"
  />
      <div style={{
        ...modalStyle,
        background:
          typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light'
            ? '#ffffff'
                : modalStyle.background,
        border:
          typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light'
            ? '1px solid var(--onity-color-border)'
                : modalStyle.border,
        boxShadow:
          typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light'
            ? 'var(--onity-elev-med)'
                : modalStyle.boxShadow
      }}>
        <h2 style={titleStyle}>Novo Cliente</h2>

        <div style={{ display: "grid", gap: "var(--onity-space-m)" }}>
          {/* Tipo + Inscrição */}
          <div style={rowStyle}>
            <div style={columnStyle}>
              <label style={labelStyle}>CNPJ/CPF/CEI *</label>
              <select
                value={form.tipoInscricao}
                onChange={(e) => handleChange("tipoInscricao", e.target.value)}
                style={selectStyle}
              >
                <option value="">Selecione...</option>
                <option value="CNPJ">CNPJ</option>
                <option value="CPF">CPF</option>
                <option value="CEI">CEI</option>
                <option value="SREG">SREG</option>
              </select>
            </div>

            <div
              style={{
                ...columnStyle,
                display: "flex",
                alignItems: "flex-end",
                gap: "var(--onity-space-s)",
              }}
            >
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Inscrição *</label>
                <input
                  type="text"
                  value={form.cnpjCpf}
                  onChange={(e) => {
                    let value = e.target.value;
                    if (form.tipoInscricao === "CPF") {
                      value = value
                        .replace(/\D/g, "")
                        .slice(0, 11)
                        .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
                    } else if (form.tipoInscricao === "CNPJ") {
                      value = value
                        .replace(/\D/g, "")
                        .slice(0, 14)
                        .replace(
                          /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
                          "$1.$2.$3/$4-$5"
                        );
                    }
                    handleChange("cnpjCpf", value);
                  }}
                  style={inputStyle}
                  placeholder={
                    form.tipoInscricao === "CPF"
                      ? "000.000.000-00"
                      : form.tipoInscricao === "CNPJ"
                        ? "00.000.000/0000-00"
                        : ""
                  }
                />
              </div>

              {form.tipoInscricao === "CNPJ" && (
                <button
                  type="button"
                  onClick={async () => {
                    const cnpj = form.cnpjCpf.replace(/\D/g, "");
                    if (cnpj.length !== 14) {
                      toast.error("CNPJ inválido");
                      return;
                    }
                    try {
                      const response = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`);
                      const data = await response.json();
                      
                      if (data.razao_social) {
                        setForm((prev) => ({
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
                        toast.success("Dados preenchidos com sucesso!");
                      } else {
                        toast.error("Empresa não encontrada.");
                      }
                    } catch (error) {
                      console.error("Erro ao consultar CNPJ:", error);
                      toast.error("Erro ao consultar CNPJ.");
                    }
                  }}
                  style={smallButtonStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--titan-primary-hover)";
                    e.currentTarget.style.transform = "scale(1.05)";
                    e.currentTarget.style.boxShadow = "var(--titan-glow-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--titan-primary)";
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Nome + Tipo */}
          <div style={rowStyle}>
            <div style={columnStyle}>
              <label style={labelStyle}>Nome *</label>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => handleChange("nome", e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={columnStyle}>
              <label style={labelStyle}>Tipo</label>
              <select
                value={form.tipo}
                onChange={(e) => handleChange("tipo", e.target.value)}
                style={selectStyle}
              >
                <option>Fixo</option>
                <option>Eventual</option>
              </select>
            </div>
          </div>

          {/* Apelido + Sistema */}
          <div style={rowStyle}>
            <div style={columnStyle}>
              <label style={labelStyle}>Apelido</label>
              <input
                type="text"
                value={form.apelido}
                onChange={(e) => handleChange("apelido", e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={columnStyle}>
              <label style={labelStyle}>Sistema</label>
              <input
                type="text"
                value={form.sistema}
                onChange={(e) => handleChange("sistema", e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Base + Código */}
          <div style={rowStyle}>
            <div style={columnStyle}>
              <label style={labelStyle}>Base</label>
              <input
                type="text"
                value={form.base}
                onChange={(e) => handleChange("base", e.target.value)}
                style={inputStyle}
                placeholder="Base do cliente"
              />
            </div>
            <div style={columnStyle}>
              <label style={labelStyle}>Código</label>
              <input
                type="text"
                value={form.codigo}
                onChange={(e) => handleChange("codigo", e.target.value)}
                style={inputStyle}
                placeholder="Código do cliente"
              />
            </div>
          </div>

          {/* Data + Status + Complementar */}
          <div style={rowStyle}>
            <div style={columnStyle}>
              <label style={labelStyle}>Data Início *</label>
              <input
                type="date"
                value={form.dataInicio}
                onChange={(e) => handleChange("dataInicio", e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={columnStyle}>
              <label style={labelStyle}>Status</label>
              <select
                value={form.status}
                onChange={(e) => handleChange("status", e.target.value)}
                style={selectStyle}
              >
                <option>Ativo</option>
                <option>Inativo</option>
              </select>
            </div>
            <div style={columnStyle}>
              <label style={labelStyle}>Grupos</label>
              <Select
                isMulti
                options={grupos.map((grupo) => ({
                  value: grupo.id,
                  label: grupo.nome,
                }))}
                value={form.grupoIds.map((id) => {
                  const grupo = grupos.find((g) => g.id === id);
                  return grupo ? { value: grupo.id, label: grupo.nome } : null;
                }).filter(Boolean)}
                onChange={(selected) => {
                  const valueArr = Array.isArray(selected)
                    ? selected.filter(Boolean).map((opt) => opt.value)
                    : [];
                  handleChange("grupoIds", valueArr);
                }}
                placeholder="Selecione..."
                styles={{
                  control: (base, state) => ({
                    ...base,
                    minHeight: 30,
                    maxHeight: 34,
                    borderRadius: "var(--onity-radius-xs)",
                    fontSize: "var(--onity-type-body-size)",
                    outline: "none",
                    boxShadow: "none",
                    borderColor: "var(--onity-color-border)",
                    backgroundColor: "var(--onity-color-surface)",
                    color: "var(--onity-color-text)",
                    ...(state.isFocused ? { 
                      borderColor: "var(--onity-color-primary)",
                      boxShadow: "0 0 0 3px rgba(68, 84, 100, 0.15)"
                    } : {}),
                  }),
                  placeholder: (base) => ({
                    ...base,
                    color: "var(--onity-color-text)",
                    opacity: 1,
                    fontWeight: 400,
                  }),
                  multiValue: (base) => ({
                    ...base,
                    backgroundColor: "var(--onity-color-primary)",
                    margin: 0,
                    borderRadius: "var(--onity-radius-xs)",
                  }),
                  multiValueLabel: (base) => ({
                    ...base,
                    color: "white",
                    fontWeight: 500,
                  }),
                  multiValueRemove: (base) => ({
                    ...base,
                    color: "white",
                    ":hover": {
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                      color: "white",
                    },
                  }),
                  valueContainer: (base) => ({
                    ...base,
                    flexWrap: "nowrap",
                    gap: 4,
                    overflowX: "auto",
                  }),
                  option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isSelected
                      ? "var(--onity-color-primary)"
                      : state.isFocused
                        ? "rgba(255, 255, 255, 0.02)"
                        : "var(--onity-color-surface)",
                    color: state.isSelected ? "white" : "var(--onity-color-text)",
                    cursor: "pointer",
                    boxShadow: "none",
                    outline: "none",
                    border: "none",
                  }),
                  menu: (base) => ({
                    ...base,
                    zIndex: 9999,
                    backgroundColor: "var(--onity-color-surface)",
                    border: "1px solid var(--onity-color-border)",
                    borderRadius: "var(--onity-radius-m)",
                    boxShadow: "var(--onity-elev-high)",
                  }),
                  menuList: (base) => ({
                    ...base,
                    boxShadow: "none",
                    outline: "none",
                  }),
                }}
                menuPlacement="auto"
              />
            </div>
          </div>

          {/* Dores e Soluções */}
          <div style={rowStyle}>
            <div style={columnStyle}>
              <label style={labelStyle}>Dores do cliente</label>
              <Select
                isMulti
                options={doresOptions}
                value={form.dores.map(d => ({ value: d, label: d }))}
                onChange={selected => handleChange("dores", selected.map((opt) => opt.value))}
                placeholder="Selecione as dores"
                styles={{
                  control: (base, state) => ({
                    ...base,
                    minHeight: 30,
                    maxHeight: 34,
                    borderRadius: "var(--onity-radius-xs)",
                    fontSize: "var(--onity-type-body-size)",
                    outline: "none",
                    boxShadow: "none",
                    borderColor: "var(--onity-color-border)",
                    backgroundColor: "var(--onity-color-surface)",
                    color: "var(--onity-color-text)",
                    ...(state.isFocused ? { 
                      borderColor: "var(--onity-color-primary)",
                      boxShadow: "0 0 0 3px rgba(68, 84, 100, 0.15)"
                    } : {}),
                  }),
                  placeholder: (base) => ({
                    ...base,
                    color: "var(--onity-color-text)",
                    opacity: 1,
                    fontWeight: 400,
                  }),
                  multiValue: (base) => ({
                    ...base,
                    backgroundColor: "var(--onity-color-primary)",
                    margin: 0,
                    borderRadius: "var(--onity-radius-xs)",
                  }),
                  multiValueLabel: (base) => ({
                    ...base,
                    color: "white",
                    fontWeight: 500,
                  }),
                  multiValueRemove: (base) => ({
                    ...base,
                    color: "white",
                    ":hover": {
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                      color: "white",
                    },
                  }),
                  valueContainer: (base) => ({
                    ...base,
                    flexWrap: "nowrap",
                    gap: 4,
                    overflowX: "auto",
                  }),
                  option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isSelected
                      ? "var(--onity-color-primary)"
                      : state.isFocused
                        ? "rgba(255, 255, 255, 0.02)"
                        : "var(--onity-color-surface)",
                    color: state.isSelected ? "white" : "var(--onity-color-text)",
                    cursor: "pointer",
                    boxShadow: "none",
                    outline: "none",
                    border: "none",
                  }),
                  menu: (base) => ({
                    ...base,
                    zIndex: 9999,
                    backgroundColor: "var(--onity-color-surface)",
                    border: "1px solid var(--onity-color-border)",
                    borderRadius: "var(--onity-radius-m)",
                    boxShadow: "var(--onity-elev-high)",
                  }),
                  menuList: (base) => ({
                    ...base,
                    boxShadow: "none",
                    outline: "none",
                  }),
                }}
                menuPlacement="auto"
              />
            </div>
            <div style={columnStyle}>
              <label style={labelStyle}>Soluções oferecidas</label>
              <Select
                isMulti
                options={solucoesOptionsFiltradas}
                value={form.solucoes.map(s => ({ value: s, label: s }))}
                onChange={selected => handleChange("solucoes", selected.map((opt) => opt.value))}
                placeholder="Selecione as soluções"
                styles={{
                  control: (base, state) => ({
                    ...base,
                    minHeight: 30,
                    maxHeight: 34,
                    borderRadius: "var(--titan-radius-sm)",
                    fontSize: "var(--titan-font-size-sm)",
                    outline: "none",
                    boxShadow: "none",
                    borderColor: "var(--titan-stroke)",
                    backgroundColor: "var(--titan-input-bg)",
                    color: "var(--titan-text-high)",
                    ...(state.isFocused ? { 
                      borderColor: "var(--titan-primary)",
                      boxShadow: "var(--titan-glow-primary)"
                    } : {}),
                  }),
                  placeholder: (base) => ({
                    ...base,
                    color: "var(--titan-text-low)",
                    opacity: 1,
                    fontWeight: "var(--titan-font-weight-normal)",
                  }),
                  multiValue: (base) => ({
                    ...base,
                    backgroundColor: "var(--titan-primary)",
                    margin: 0,
                    borderRadius: "var(--titan-radius-sm)",
                  }),
                  multiValueLabel: (base) => ({
                    ...base,
                    color: "white",
                    fontWeight: "var(--titan-font-weight-medium)",
                  }),
                  multiValueRemove: (base) => ({
                    ...base,
                    color: "white",
                    ":hover": {
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                      color: "white",
                    },
                  }),
                  valueContainer: (base) => ({
                    ...base,
                    flexWrap: "nowrap",
                    gap: 4,
                    overflowX: "auto",
                  }),
                  option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isSelected
                      ? "var(--titan-primary)"
                      : state.isFocused
                        ? "rgba(255, 255, 255, 0.02)"
                        : "var(--titan-base-00)",
                    color: state.isSelected ? "white" : "var(--titan-text-high)",
                    cursor: "pointer",
                    boxShadow: "none",
                    outline: "none",
                    border: "none",
                  }),
                  menu: (base) => ({
                    ...base,
                    zIndex: 9999,
                    backgroundColor: "var(--titan-base-00)",
                    border: "1px solid var(--titan-stroke)",
                    borderRadius: "var(--titan-radius-md)",
                    boxShadow: "var(--titan-shadow-lg)",
                  }),
                  menuList: (base) => ({
                    ...base,
                    boxShadow: "none",
                    outline: "none",
                  }),
                }}
                menuPlacement="auto"
              />
            </div>
          </div>

          {/* Telefone + Email */}
          <div style={rowStyle}>
            <div style={columnStyle}>
              <label style={labelStyle}>Telefone</label>
              <input
                type="tel"
                value={form.telefone}
                onChange={(e) => handleChange("telefone", e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={columnStyle}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Endereço */}
          <div style={rowStyle}>
            <div style={columnStyle}>
              <label style={labelStyle}>Endereço</label>
              <input
                type="text"
                value={form.endereco}
                onChange={(e) => handleChange("endereco", e.target.value)}
                style={inputStyle}
                placeholder="Logradouro e número"
              />
            </div>
            <div style={columnStyle}>
              <label style={labelStyle}>Bairro</label>
              <input
                type="text"
                value={form.bairro}
                onChange={(e) => handleChange("bairro", e.target.value)}
                style={inputStyle}
                placeholder="Bairro"
              />
            </div>
          </div>

          {/* Cidade + Estado + CEP */}
          <div style={rowStyle}>
            <div style={columnStyle}>
              <label style={labelStyle}>Cidade</label>
              <input
                type="text"
                value={form.cidade}
                onChange={(e) => handleChange("cidade", e.target.value)}
                style={inputStyle}
                placeholder="Cidade"
              />
            </div>
            <div style={columnStyle}>
              <label style={labelStyle}>Estado</label>
              <input
                type="text"
                value={form.estado}
                onChange={(e) => handleChange("estado", e.target.value)}
                style={inputStyle}
                placeholder="UF"
                maxLength={2}
              />
            </div>
            <div style={columnStyle}>
              <label style={labelStyle}>CEP</label>
              <input
                type="text"
                value={form.cep}
                onChange={(e) => {
                  let value = e.target.value.replace(/\D/g, "");
                  if (value.length > 5) {
                    value = value.slice(0, 5) + "-" + value.slice(5, 8);
                  }
                  handleChange("cep", value);
                }}
                style={inputStyle}
                placeholder="00000-000"
                maxLength={9}
              />
            </div>
          </div>
        </div>

        <div style={footerStyle}>
          <button 
            onClick={onClose} 
            style={{
              ...cancelButtonStyle,
              background:
                typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light'
                  ? 'var(--onity-color-surface)'
                  : cancelButtonStyle.background,
              border:
                typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light'
                  ? '1px solid var(--onity-color-border)'
                  : cancelButtonStyle.border,
              color: 'var(--onity-color-text)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light' ? 'var(--onity-color-surface)' : 'rgba(255, 255, 255, 0.18)';
              e.currentTarget.style.borderColor = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light' ? 'var(--onity-color-primary)' : 'rgba(255, 255, 255, 0.25)';
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light' ? 'var(--onity-color-surface)' : 'rgba(255, 255, 255, 0.12)';
              e.currentTarget.style.borderColor = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light' ? 'var(--onity-color-border)' : 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            Cancelar
          </button>
          <button 
            onClick={handleConfirmar} 
            style={confirmButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--onity-color-primary-hover)";
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "var(--onity-elev-high)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--onity-color-primary)";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// 🔧 Styles usando design system ONETY (globals.css)
const inputHeight = "34px";

const overlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  zIndex: 1000,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  backdropFilter: "blur(4px)",
  WebkitBackdropFilter: "blur(4px)",
};

const modalStyle = {
  background: "rgba(11, 11, 17, 0.6)",
  padding: "var(--onity-space-l)",
  borderRadius: "var(--onity-radius-l)",
  minWidth: "700px",
  maxWidth: "90%",
  maxHeight: "90vh",
  overflowY: "auto",
  fontFamily: "var(--onity-font-family-sans)",
  border: "1px solid var(--onity-color-border)",
  boxShadow: "var(--onity-elev-high)",
};

const titleStyle = {
  marginBottom: "var(--onity-space-m)",
  textAlign: "left",
  color: "var(--onity-color-text)",
  fontSize: "var(--onity-type-h2-size)",
  fontWeight: 600,
};

const labelStyle = {
  fontSize: "var(--onity-type-body-size)",
  fontWeight: 500,
  display: "block",
  marginBottom: "var(--onity-space-s)",
  color: "var(--onity-color-text)",
};

const inputStyle = {
  padding: "var(--onity-space-s)",
  borderRadius: "var(--onity-radius-xs)",
  border: "1px solid var(--onity-color-border)",
  width: "100%",
  height: inputHeight,
  fontSize: "var(--onity-type-body-size)",
  boxSizing: "border-box",
  backgroundColor: "var(--onity-color-surface)",
  color: "var(--onity-color-text)",
  transition: "all 0.2s ease",
};

const selectStyle = {
  ...inputStyle,
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  background: "var(--onity-color-surface)",
  textAlign: "center",
  color: "var(--onity-color-text)",
  cursor: "pointer",
};

const rowStyle = {
  display: "flex",
  gap: "var(--onity-space-m)",
  marginBottom: "var(--onity-space-s)",
};

const columnStyle = {
  flex: 1,
  minWidth: "150px",
};

const footerStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "var(--onity-space-s)",
  marginTop: "var(--onity-space-l)",
};

const cancelButtonStyle = {
  padding: "var(--onity-space-s) var(--onity-space-m)",
  background: "rgba(255, 255, 255, 0.12)",
  color: "var(--onity-color-text)",
  border: "1px solid rgba(255, 255, 255, 0.15)",
  borderRadius: "var(--onity-radius-xs)",
  fontSize: "var(--onity-type-body-size)",
  fontWeight: 500,
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const confirmButtonStyle = {
  padding: "var(--onity-space-s) var(--onity-space-m)",
  background: "var(--onity-color-primary)",
  color: "white",
  border: "none",
  borderRadius: "var(--onity-radius-xs)",
  fontSize: "var(--onity-type-body-size)",
  fontWeight: 500,
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const smallButtonStyle = {
  backgroundColor: "var(--onity-color-primary)",
  color: "white",
  border: "none",
  cursor: "pointer",
  borderRadius: "var(--onity-radius-xs)",
  padding: "0px var(--onity-space-m)",
  height: "32px",
  transition: "all 0.2s ease",
};

// Adicionar estilos globais para os dropdowns nativos
const globalStyles = `
  select option {
    background-color: var(--onity-color-surface) !important;
    color: var(--onity-color-text) !important;
    border: none !important;
    padding: var(--onity-space-s) !important;
  }
  
  select option:hover {
    background-color: var(--onity-color-primary-hover) !important;
  }
  
  select option:checked {
    background-color: var(--onity-color-primary) !important;
    color: white !important;
  }
`;

// Injetar os estilos globais
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = globalStyles;
  document.head.appendChild(styleElement);
}

// Estilos personalizados para o Toastify
const toastStyles = `
  .custom-toast {
    background-color: var(--titan-base-01) !important;
    color: var(--titan-text-high) !important;
    border: 1px solid var(--titan-stroke) !important;
    border-radius: var(--titan-radius-md) !important;
    box-shadow: var(--titan-shadow-lg) !important;
  }
  
  .custom-toast .Toastify__toast-body {
    color: var(--titan-text-high) !important;
    font-family: inherit !important;
  }
  
  .custom-toast .Toastify__progress-bar {
    background-color: var(--titan-primary) !important;
  }
  
  .custom-toast .Toastify__close-button {
    color: var(--titan-text-low) !important;
  }
  
  .custom-toast .Toastify__close-button:hover {
    color: var(--titan-text-high) !important;
  }
  
  /* Sobrescrever cores específicas dos tipos de toast */
  .Toastify__toast--success.custom-toast {
    background-color: var(--titan-base-01) !important;
    border-left: 4px solid #10b981 !important;
  }
  
  .Toastify__toast--error.custom-toast {
    background-color: var(--titan-base-01) !important;
    border-left: 4px solid #ef4444 !important;
  }
  
  .Toastify__toast--warning.custom-toast {
    background-color: var(--titan-base-01) !important;
    border-left: 4px solid #f59e0b !important;
  }
  
  .Toastify__toast--info.custom-toast {
    background-color: var(--titan-base-01) !important;
    border-left: 4px solid #3b82f6 !important;
  }
`;

// Injetar os estilos do toast
if (typeof document !== 'undefined') {
  const toastStyleElement = document.createElement('style');
  toastStyleElement.textContent = toastStyles;
  document.head.appendChild(toastStyleElement);
}
