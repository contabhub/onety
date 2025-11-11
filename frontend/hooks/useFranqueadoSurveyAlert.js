import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

const MODULE_PREFIXES = [
  "/gestao",
  "/financeiro",
  "/comercial",
  "/contratual",
  "/estrategico",
  "/atendimento",
];

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

const getToken = () => {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    ""
  );
};

const normalizePath = (path) => {
  if (!path) return "";
  const [cleanPath] = path.split("?");
  return cleanPath;
};

const isModuleRoute = (path) => {
  if (!path) return false;
  return MODULE_PREFIXES.some((prefix) =>
    normalizePath(path).startsWith(prefix)
  );
};

const resolveEmpresaId = (user) => {
  if (!user) return null;
  return (
    user?.companyId ||
    user?.empresaId ||
    user?.EmpresaId ||
    user?.empresa_id ||
    user?.company_id ||
    null
  );
};

export function useFranqueadoSurveyAlert(user) {
  const router = useRouter();
  const [alertData, setAlertData] = useState(null);
  const empresaId = useMemo(() => resolveEmpresaId(user), [user]);
  const lastFetchKeyRef = useRef(null);
  const dismissedRef = useRef(false);

  useEffect(() => {
    lastFetchKeyRef.current = null;
    dismissedRef.current = false;
    setAlertData(null);
  }, [empresaId]);

  const routeKey = useMemo(() => {
    if (!empresaId) return null;
    const currentPath = normalizePath(router.asPath || router.pathname || "");
    return `${empresaId}:${currentPath}`;
  }, [empresaId, router.asPath, router.pathname]);

  useEffect(() => {
    if (!empresaId || !routeKey) return;
    if (dismissedRef.current) return;

    const [, path] = routeKey.split(":");
    if (!isModuleRoute(path || "")) return;

    if (lastFetchKeyRef.current === routeKey) return;
    lastFetchKeyRef.current = routeKey;

    const token = getToken();
    if (!token) {
      return;
    }

    fetch(
      `${API_BASE}/gestao/pesquisas-franqueados-alertas/pendentes?empresaId=${empresaId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )
      .then((response) => response.json())
      .then((data) => {
        if (dismissedRef.current) return;

        if (data?.pendencias) {
          setAlertData({
            total: data.total,
            mensagem: data.mensagem,
            pesquisa: data.pesquisa || null,
          });
        } else {
          setAlertData(null);
        }
      })
      .catch((error) => {
        console.error("Erro ao consultar pesquisas pendentes:", error);
      });
  }, [empresaId, routeKey]);

  const dismiss = () => {
    dismissedRef.current = true;
    setAlertData(null);
  };

  const openSurvey = () => {
    if (alertData?.pesquisa?.link && typeof window !== "undefined") {
      window.open(alertData.pesquisa.link, "_blank", "noopener");
    }
    dismiss();
  };

  return {
    data: alertData,
    dismiss,
    openSurvey,
  };
}

