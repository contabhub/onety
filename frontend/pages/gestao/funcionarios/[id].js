import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import PrincipalSidebar from "../../../components/onety/principal/PrincipalSidebar";
import styles from "../../../styles/gestao/FuncionarioDetalhes.module.css";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

const normalizeUrl = (url) => {
  if (!BASE_URL) return url;
  return `${BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const safeParseJSON = (value) => {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("[FuncionarioDetalhes] Falha ao fazer parse do JSON:", error);
    return null;
  }
};

const getFirstAvailable = (key) => {
  if (typeof window === "undefined") return null;
  const storages = [sessionStorage, localStorage];
  for (const storage of storages) {
    try {
      const value = storage?.getItem?.(key);
      if (value) return value;
    } catch (error) {
      console.warn(`[FuncionarioDetalhes] Erro ao ler chave '${key}':`, error);
    }
  }
  return null;
};

const extractFromUserData = (extractor) => {
  if (typeof window === "undefined") return null;
  const candidates = ["userData", "usuario"];
  for (const key of candidates) {
    const raw = getFirstAvailable(key);
    if (!raw) continue;
    const parsed = safeParseJSON(raw);
    if (!parsed || typeof parsed !== "object") continue;
    const result = extractor(parsed);
    if (result) return result;
  }
  return null;
};

const getToken = () => {
  if (typeof window === "undefined") return "";

  const direct = getFirstAvailable("token");
  if (direct) return direct;

  const fromUserData = extractFromUserData((data) =>
    data?.token ||
    data?.accessToken ||
    data?.jwt ||
    data?.jwtToken ||
    data?.authToken ||
    data?.data?.token ||
    data?.data?.accessToken
  );

  return fromUserData ? String(fromUserData) : "";
};

const getEmpresaId = () => {
  if (typeof window === "undefined") return "";

  const direct = getFirstAvailable("empresaId");
  if (direct) return String(direct);

  const fromUserData = extractFromUserData((data) =>
    data?.EmpresaId ||
    data?.empresaId ||
    data?.empresa?.id ||
    data?.empresaSelecionada?.id ||
    data?.empresaAtiva?.id
  );

  return fromUserData ? String(fromUserData) : "";
};

const parseResponseBody = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const request = async (method, url, { headers = {}, body, params } = {}) => {
  const normalized = normalizeUrl(url);
  const searchParams = params && typeof params === "object" ? new URLSearchParams(params) : null;
  const finalUrl = searchParams ? `${normalized}?${searchParams.toString()}` : normalized;

  const fetchOptions = {
    method,
    headers: { ...headers },
  };

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && body !== null) {
    if (isFormData || typeof body === "string" || body instanceof Blob) {
      fetchOptions.body = body;
    } else {
      fetchOptions.headers["Content-Type"] = fetchOptions.headers["Content-Type"] || "application/json";
      fetchOptions.body = JSON.stringify(body);
    }
  }

  Object.keys(fetchOptions.headers).forEach((key) => {
    if (fetchOptions.headers[key] === undefined) {
      delete fetchOptions.headers[key];
    }
  });

  const response = await fetch(finalUrl, fetchOptions);
  const data = await parseResponseBody(response);

  if (!response.ok) {
    const error = new Error(response.statusText || "Request failed");
    error.response = { status: response.status, data, statusText: response.statusText };
    throw error;
  }

  return data;
};

const normalizeCollection = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const { data, items, lista, list, resultados, results } = payload;
    if (Array.isArray(data)) return data;
    if (Array.isArray(items)) return items;
    if (Array.isArray(lista)) return lista;
    if (Array.isArray(list)) return list;
    if (Array.isArray(resultados)) return resultados;
    if (Array.isArray(results)) return results;
  }
  return [];
};

const normalizeUsuario = (payload) => {
  if (!payload) return null;
  if (payload && typeof payload === "object") {
    if (payload.usuario && typeof payload.usuario === "object") return payload.usuario;
    if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) return payload.data;
    if (payload.result && typeof payload.result === "object") return payload.result;
  }
  return payload;
};

export default function FuncionarioDetalhes() {
  const router = useRouter();
  const { id } = router.query;
  const [funcionario, setFuncionario] = useState(null);
  const [cargos, setCargos] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [auth, setAuth] = useState({ token: "", empresaId: "" });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = getToken();
    const empresaId = getEmpresaId();
    if (token && empresaId) {
      setAuth({ token, empresaId });
    }
  }, []);

  useEffect(() => {
    if (!router.isReady || !id) return;
    if (!auth.token || !auth.empresaId) return;

    setLoading(true);
    const authHeaders = { Authorization: `Bearer ${auth.token}` };

    Promise.allSettled([
      request("GET", `/usuarios/${id}`, { headers: authHeaders }),
      request("GET", `/gestao/cargos/empresa/${auth.empresaId}`, { headers: authHeaders }),
      request("GET", `/gestao/departamentos/${auth.empresaId}`, { headers: authHeaders }),
    ]).then((results) => {
      const [usuarioRes, cargosRes, deptosRes] = results;

      if (usuarioRes.status === "fulfilled") {
        setFuncionario(normalizeUsuario(usuarioRes.value));
      } else {
        console.error("[FuncionarioDetalhes] Falha ao carregar usuário:", usuarioRes.reason?.response || usuarioRes.reason);
        toast.error("Não foi possível carregar os dados do funcionário.");
      }

      if (cargosRes.status === "fulfilled") {
        setCargos(normalizeCollection(cargosRes.value));
      } else {
        console.warn("[FuncionarioDetalhes] Falha ao carregar cargos:", cargosRes.reason?.response || cargosRes.reason);
        setCargos([]);
      }

      if (deptosRes.status === "fulfilled") {
        setDepartamentos(normalizeCollection(deptosRes.value));
      } else {
        console.warn("[FuncionarioDetalhes] Falha ao carregar departamentos:", deptosRes.reason?.response || deptosRes.reason);
        setDepartamentos([]);
      }
    })
      .catch((error) => {
        console.error("[FuncionarioDetalhes] Erro não tratado ao carregar dados:", error);
        toast.error("Erro ao carregar dados do funcionário.");
      })
      .finally(() => setLoading(false));
  }, [id, auth.token, auth.empresaId, router.isReady]);

  const handleChange = (field, value) => {
    setFuncionario((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      if (!auth.token) {
        toast.error("Token não encontrado. Faça login novamente.");
        return;
      }
      await request("PATCH", `/usuarios/${id}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
        body: funcionario,
      });
      toast.success("Funcionário salvo com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar funcionário.");
    }
  };

  if (loading || !funcionario) {
    return (
      <>
        <PrincipalSidebar />
        <div className={styles.pageWrapper}>
          <div className={styles.loadingContainer}>Carregando...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <PrincipalSidebar />
      <div className={styles.pageWrapper}>
        <ToastContainer />
        <div className={styles.container}>
          <div className={styles.formCard}>
            <div className={styles.formGrid}>
              <div className={`${styles.formField} ${styles.span6}`}>
                <label className={styles.formLabel}>Nome *</label>
                <input
                  value={funcionario.nome || ""}
                  onChange={(e) => handleChange("nome", e.target.value)}
                  className={styles.formInput}
                  placeholder="Digite o nome do funcionário"
                />
              </div>
              <div className={`${styles.formField} ${styles.span6}`}>
                <label className={styles.formLabel}>Email *</label>
                <input
                  value={funcionario.email || ""}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className={styles.formInput}
                  placeholder="Digite o email do funcionário"
                  type="email"
                />
              </div>
              <div className={`${styles.formField} ${styles.span6}`}>
                <label className={styles.formLabel}>Telefone</label>
                <input
                  value={funcionario.telefone || ""}
                  onChange={(e) => handleChange("telefone", e.target.value)}
                  className={styles.formInput}
                  placeholder="Digite o telefone"
                />
              </div>
              <div className={`${styles.formField} ${styles.span3}`}>
                <label className={styles.formLabel}>Cargo *</label>
                <select
                  value={funcionario.cargoId || ""}
                  onChange={(e) => handleChange("cargoId", e.target.value)}
                  className={styles.formSelect}
                >
                  <option value="">Selecione...</option>
                  {cargos.map((cargo) => (
                    <option key={cargo.id} value={cargo.id}>
                      {cargo.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className={`${styles.formField} ${styles.span3}`}>
                <label className={styles.formLabel}>Departamento *</label>
                <select
                  value={funcionario.departamentoId || ""}
                  onChange={(e) => handleChange("departamentoId", e.target.value)}
                  className={styles.formSelect}
                >
                  <option value="">Selecione...</option>
                  {departamentos.map((departamento) => (
                    <option key={departamento.id} value={departamento.id}>
                      {departamento.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className={`${styles.formField} ${styles.span3}`}>
                <label className={styles.formLabel}>Status</label>
                <select
                  value={funcionario.status || "Ativo"}
                  onChange={(e) => handleChange("status", e.target.value)}
                  className={styles.formSelect}
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </select>
              </div>
            </div>
            <div className={styles.actionsContainer}>
              <button className={`${styles.button} ${styles.buttonVoltar}`} onClick={() => router.back()}>
                Voltar
              </button>
              <button className={`${styles.button} ${styles.buttonSalvar}`} onClick={handleSave}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 