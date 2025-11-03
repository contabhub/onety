"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import Select, { components } from "react-select";

 // Tipos removidos para compatibilidade com .js

// Componente customizado para opções
const CustomOption = (props) => (
  <components.Option {...props}>
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      <div style={{ fontWeight: "500", fontSize: "13px" }}>
        {props.data.label}
      </div>
      <div style={{ fontSize: "11px", color: "var(--titan-text-med)" }}>
        {formatarCNPJ(props.data.cnpj)}
      </div>
    </div>
  </components.Option>
);

// Componente customizado para valor único
const CustomSingleValue = (props) => (
  <components.SingleValue {...props}>
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      <div style={{ fontWeight: "500", fontSize: "13px" }}>
        {props.data.label}
      </div>
      <div style={{ fontSize: "11px", color: "var(--titan-text-med)" }}>
        {formatarCNPJ(props.data.cnpj)}
      </div>
    </div>
  </components.SingleValue>
);

// Componente customizado para valores múltiplos
const CustomMultiValue = (props) => (
  <components.MultiValue {...props}>
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <div style={{ fontWeight: "500", fontSize: "12px" }}>
        {props.data.label}
      </div>
      <div style={{ fontSize: "10px", color: "var(--titan-text-med)" }}>
        ({formatarCNPJ(props.data.cnpj)})
      </div>
    </div>
  </components.MultiValue>
);

// Função para formatar CNPJ/CPF
const formatarCNPJ = (cnpj) => {
  if (!cnpj) return "";
  const cleaned = cnpj.replace(/\D/g, "");
  
  if (cleaned.length === 11) {
    // CPF: 000.000.000-00
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  } else if (cleaned.length === 14) {
    // CNPJ: 00.000.000/0000-00
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return cnpj;
};

export default function ClienteSelectMulti({ 
  value, 
  onChange, 
  isMulti = false, 
  isClearable = false,
  placeholder = "Selecione ou pesquise o cliente..."
}) {
  const token = typeof window !== "undefined" ? sessionStorage.getItem("token") : "";
  const empresaId = typeof window !== "undefined" ? sessionStorage.getItem("empresaId") : "";
  const BASE = process.env.NEXT_PUBLIC_API_URL || '';

  const [clientes, setClientes] = useState([]);
  const [page, setPage] = useState(1);
  const [inputValue, setInputValue] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [buscandoClienteId, setBuscandoClienteId] = useState(false);

  const fetchClientes = useCallback(async (nome, pageNum = 1) => {
    if (!empresaId || !token) return [];

    try {
      const r = await fetch(`${BASE}/api/clientes?empresaId=${empresaId}&page=${pageNum}&limit=30&search=${encodeURIComponent(nome)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await r.json();
      const list = Array.isArray(json) ? json : (json?.clientes || json?.data?.clientes || []);

      const data = list.map((c) => ({
        value: c.id.toString(),
        label: c.nome,
        cnpj: c.cnpjCpf,
      }));

      if (data.length < 30) setHasMore(false);
      return data;
    } catch (err) {
      console.error("Erro ao buscar clientes:", err);
      return [];
    }
  }, [empresaId, token, BASE]);

  const carregarPrimeiraPagina = async (nome) => {
    setLoading(true);
    setPage(1);
    setHasMore(true);
    const data = await fetchClientes(nome, 1);
    setClientes(data);
    setLoading(false);
  };

  const carregarMaisClientes = async () => {
    if (!hasMore || loading) return;
    const nextPage = page + 1;
    setLoading(true);
    const novos = await fetchClientes(inputValue, nextPage);
    setClientes((prev) => [...prev, ...novos]);
    setPage(nextPage);
    setLoading(false);
  };

  const handleInputChange = (input) => {
    setInputValue(input);
    carregarPrimeiraPagina(input);
  };

  const handleSelectChange = (selected) => {
    if (isMulti) {
      const values = selected ? selected.map((s) => s.value) : [];
      onChange({ target: { name: "clienteId", value: values } });
    } else {
      onChange({ target: { name: "clienteId", value: selected?.value || "" } });
    }
  };

  // Converter valor para formato do react-select
  const selectValue = useMemo(() => {
    if (isMulti) {
      const values = Array.isArray(value) ? value : [];
      return values.map(v => 
        clientes.find(c => c.value === v) || { value: v, label: "Carregando...", cnpj: "" }
      );
    } else {
      const singleValue = Array.isArray(value) ? value[0] : value;
      return singleValue
        ? clientes.find(c => c.value === singleValue) || { value: singleValue, label: "Carregando...", cnpj: "" }
        : null;
    }
  }, [value, clientes, isMulti]);

  useEffect(() => {
    carregarPrimeiraPagina("");
  }, []);

  // Efeito para buscar clientes pelos IDs caso não estejam na lista
  useEffect(() => {
    if (value && !buscandoClienteId) {
      const ids = Array.isArray(value) ? value : [value];
      const idsNaoEncontrados = ids.filter(id => !clientes.find(c => c.value === id));
      
      if (idsNaoEncontrados.length > 0) {
        setBuscandoClienteId(true);
        Promise.all(
          idsNaoEncontrados.map(id => 
            fetch(`${BASE}/api/clientes/${id}`, {
              headers: { Authorization: `Bearer ${token}` },
            }).then(r => r.json()).catch(() => null)
          )
        ).then(results => {
          const clientesEncontrados = results
            .filter(Boolean)
            .map((cliente) => ({
              value: cliente.id.toString(),
              label: cliente.nome,
              cnpj: cliente.cnpjCpf || "",
            }));
          
          if (clientesEncontrados.length > 0) {
            setClientes(prev => [...prev, ...clientesEncontrados]);
          }
        }).finally(() => setBuscandoClienteId(false));
      }
    }
  }, [value, clientes, token, buscandoClienteId, BASE]);

  return (
    <Select
      options={clientes}
      onChange={handleSelectChange}
      onInputChange={handleInputChange}
      onMenuScrollToBottom={carregarMaisClientes}
      components={{ 
        Option: CustomOption, 
        SingleValue: CustomSingleValue,
        MultiValue: CustomMultiValue
      }}
      isMulti={isMulti}
      isClearable={isClearable}
      value={selectValue}
      placeholder={placeholder}
      isLoading={loading}
      styles={{
        control: (base, state) => ({
          ...base,
          padding: "1px",
          fontSize: "13px",
          minHeight: "36px",
          background: "var(--titan-input-bg)",
          borderColor: state.isFocused ? "var(--titan-primary)" : "var(--titan-stroke)",
          boxShadow: state.isFocused ? "var(--titan-glow-primary)" : "none",
          "&:hover": {
            borderColor: "var(--titan-primary)",
          },
          maxWidth: "100%",
        }),
        input: (base) => ({
          ...base,
          fontSize: "13px",
          color: "var(--titan-text-high)",
        }),
        valueContainer: (base) => ({
          ...base,
          flexWrap: "wrap",
        }),
        option: (base, state) => ({
          ...base,
          fontSize: "13px",
          padding: "6px 10px",
          backgroundColor: state.isFocused ? "var(--titan-primary)" : "var(--titan-input-bg)",
          color: state.isFocused ? "white" : "var(--titan-text-high)",
        }),
        menu: (base) => ({
          ...base,
          zIndex: 9999,
          background: "var(--titan-base-00)",
          border: "1px solid var(--titan-stroke)",
        }),
        singleValue: (base) => ({
          ...base,
          color: "var(--titan-text-high)",
        }),
        multiValue: (base) => ({
          ...base,
          backgroundColor: "var(--titan-primary)",
          color: "white",
          borderRadius: "4px",
        }),
        multiValueLabel: (base) => ({
          ...base,
          color: "white",
          fontSize: "12px",
        }),
        multiValueRemove: (base) => ({
          ...base,
          color: "white",
          "&:hover": {
            backgroundColor: "rgba(255, 255, 255, 0.2)",
            color: "white",
          },
        }),
        placeholder: (base) => ({
          ...base,
          color: "var(--titan-text-med)",
        }),
      }}
      // Forçar que os chips quebrem para a linha de baixo e não expandam indefinidamente
      classNamePrefix="cliente-select-multi"
    />
  );
}
