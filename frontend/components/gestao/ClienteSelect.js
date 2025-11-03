"use client";
import Select, { components } from "react-select";
import { useEffect, useState, useCallback } from "react";
 
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

const getToken = () => {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
};

const getEmpresaId = () => {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem("userData");
    if (raw) {
      const u = JSON.parse(raw);
      return (
        u?.EmpresaId || u?.empresaId || u?.empresa_id || u?.companyId || u?.company_id || ""
      );
    }
  } catch {}
  return sessionStorage.getItem("empresaId") || "";
};

// 👉 Função para formatar o CNPJ (opcional)
function formatarCNPJ(cnpj) {
  if (!cnpj) return "";
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}


// 👉 Componente customizado de cada opção na lista
const CustomOption = (props) => (
  <components.Option {...props}>
    <div>
      <div style={{ fontSize: "13px", color: "var(--titan-text-high)" }}>{props.data.label}</div>
      <div style={{ fontSize: "11px", color: "var(--titan-text-med)" }}>{formatarCNPJ(props.data.cnpj)}</div>
    </div>
  </components.Option>
);

// 👉 Componente customizado para o valor selecionado
const CustomSingleValue = (props) => (
  <components.SingleValue {...props}>
    <div>
      <div style={{ fontSize: "13px", color: "var(--titan-text-high)" }}>{props.data.label}</div>
      <div style={{ fontSize: "11px", color: "var(--titan-text-med)" }}>{formatarCNPJ(props.data.cnpj)}</div>
    </div>
  </components.SingleValue>
);

export default function ClienteSelect({ value, onChange, isClearable = false }) {
  const token = typeof window !== "undefined" ? (getToken()) : "";
  const empresaId = typeof window !== "undefined" ? (getEmpresaId()) : "";

  const [clientes, setClientes] = useState([]);
  const [page, setPage] = useState(1);
  const [inputValue, setInputValue] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [buscandoClienteId, setBuscandoClienteId] = useState(false);

  const fetchClientes = useCallback(async (nome, pageNum = 1) => {
    if (!empresaId || !token) return [];

    try {
      const res = await fetch(`${BASE_URL}/gestao/clientes?empresaId=${empresaId}&page=${pageNum}&limit=30&search=${encodeURIComponent(nome)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({ clientes: [] }));
      const data = (json.clientes || []).map((c) => ({
        value: c.id.toString(),
        label: c.nome,
        cnpj: c.cnpjCpf, // <- aqui faz a conversão
      }));

      if (data.length < 30) setHasMore(false);
      return data;
    } catch (err) {
      console.error("Erro ao buscar clientes:", err);
      return [];
    }
  }, [empresaId, token]);

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
    onChange({ target: { name: "clienteId", value: selected?.value || "" } });
  };

  useEffect(() => {
    carregarPrimeiraPagina("");
  }, []);

  // Efeito para buscar o cliente pelo ID caso não esteja na lista
  useEffect(() => {
    if (value && !clientes.find((c) => c.value === value) && !buscandoClienteId) {
      setBuscandoClienteId(true);
      fetch(`${BASE_URL}/gestao/clientes/${value}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((res) => {
          if (res && res.id) {
            const clienteOption = {
              value: res.id.toString(),
              label: res.nome,
              cnpj: res.cnpjCpf || "",
            };
            setClientes((prev) => [...prev, clienteOption]);
          }
        })
        .catch(() => {})
        .finally(() => setBuscandoClienteId(false));
    }
  }, [value, clientes, token, buscandoClienteId]);

  return (
    <Select
      options={clientes}
      onChange={handleSelectChange}
      onInputChange={handleInputChange}
      onMenuScrollToBottom={carregarMaisClientes}
      components={{ Option: CustomOption, SingleValue: CustomSingleValue }}
      isClearable={isClearable}
      value={
        value
          ? clientes.find((c) => c.value === value) || {
              value,
              label: buscandoClienteId ? "Carregando..." : "Cliente não encontrado",
              cnpj: "",
            }
          : null
      }
      placeholder="Selecione ou pesquise o cliente..."
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
        }),
        input: (base) => ({
          ...base,
          fontSize: "13px",
          color: "var(--titan-text-high)",
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
        placeholder: (base) => ({
          ...base,
          color: "var(--titan-text-med)",
        }),
      }}
    />
  );
}
