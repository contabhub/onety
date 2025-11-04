import Select, { components } from "react-select";
import { useEffect, useState, useCallback } from "react";
import styles from "./ClienteSelectInline.module.css";

// Base da API
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

// Função para formatar o CNPJ
function formatarCNPJ(cnpj = "") {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

// Custom Option
const CustomOption = (props) => (
  <components.Option {...props}>
    <div>
      <div className={styles.customOptionLabel}>{props.data.label}</div>
      <div className={styles.customOptionCnpj}>{formatarCNPJ(props.data.cnpj)}</div>
    </div>
  </components.Option>
);

// Custom SingleValue
const CustomSingleValue = (props) => (
  <components.SingleValue {...props}>
    <div>
      <div className={styles.customSingleValueLabel}>{props.data.label}</div>
      <div className={styles.customSingleValueCnpj}>{formatarCNPJ(props.data.cnpj)}</div>
    </div>
  </components.SingleValue>
);

export function ClienteSelectInline({
  value,
  onChange,
}) {
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

  const [clientes, setClientes] = useState([]);
  const [page, setPage] = useState(1);
  const [inputValue, setInputValue] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchClientes = useCallback(
    async (nome, pageNum = 1) => {
      const empresaId = getEmpresaId();
      const token = getToken();
      if (!empresaId || !token) return [];
      try {
        const res = await fetch(`${BASE_URL}/gestao/clientes?empresaId=${empresaId}&page=${pageNum}&limit=30&search=${nome}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await res.json();
        const data = (result.clientes || []).map((c) => ({
          value: c.id.toString(),
          label: c.nome,
          cnpj: c.cnpjCpf,
        }));
        if (data.length < 30) setHasMore(false);
        return data;
      } catch (err) {
        return [];
      }
    },
    []
  );

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

  useEffect(() => {
    carregarPrimeiraPagina("");
  }, []);

  return (
    <Select
      options={clientes}
      onChange={selected =>
        onChange({
          target: { name: "clienteId", value: selected ? selected.value : null }
        })
      }
      onInputChange={input => {
        setInputValue(input);
        carregarPrimeiraPagina(input);
      }}
      onMenuScrollToBottom={carregarMaisClientes}
      components={{ Option: CustomOption, SingleValue: CustomSingleValue }}
      value={
        value
          ? clientes.find((c) => c.value === value) || { value, label: "Carregando...", cnpj: "" }
          : null
      }
      styles={{
        control: (base, state) => ({
          ...base,
          fontSize: "var(--onity-type-body-size)",
          minHeight: "35px",
          maxHeight: "35px",
          borderColor: state.isFocused ? "var(--onity-color-primary)" : "var(--onity-color-border)",
          background: "var(--onity-color-surface)",
          borderRadius: "var(--onity-radius-xs)",
          boxShadow: state.isFocused ? "0 0 0 3px rgba(68, 84, 100, 0.15)" : "none",
          "&:hover": { borderColor: "var(--onity-color-primary-hover)" },
        }),
        input: (base) => ({
          ...base,
          fontSize: "var(--onity-type-body-size)",
          background: "var(--onity-color-surface)",
          color: "var(--onity-color-text)",
        }),
        valueContainer: (base) => ({
          ...base,
          background: "var(--onity-color-surface)",
          color: "var(--onity-color-text)",
        }),
        placeholder: (base) => ({
          ...base,
          color: "var(--onity-color-text)",
          opacity: 0.7,
          fontSize: "var(--onity-type-body-size)",
          fontWeight: "400",
        }),
        singleValue: (base) => ({
          ...base,
          color: "var(--onity-color-text)",
          fontSize: "var(--onity-type-body-size)",
          fontWeight: "500",
        }),
        menu: (base) => ({
          ...base,
          zIndex: 9999,
          background: "var(--onity-color-surface)",
          border: "1px solid var(--onity-color-border)",
          borderRadius: "var(--onity-radius-xs)",
        }),
        option: (base, state) => ({
          ...base,
          fontSize: "var(--onity-type-body-size)",
          padding: "7px 13px",
          backgroundColor: state.isFocused ? "rgba(255, 255, 255, 0.02)" : "var(--onity-color-surface)",
          color: state.isFocused ? "var(--onity-color-text)" : "var(--onity-color-text)",
          "&:hover": {
            backgroundColor: "rgba(255, 255, 255, 0.02)",
          },
        }),
        indicatorSeparator: () => ({ display: "none" }),
        dropdownIndicator: (base) => ({
          ...base,
          color: "var(--onity-color-text)",
          opacity: 0.7,
          "&:hover": { color: "var(--onity-color-primary)" },
        }),
      }}
    />
  );
}
