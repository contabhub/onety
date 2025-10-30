import { jwtDecode } from "jwt-decode";

export function getPermissoes() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  if (!token) return {};
  try {
    const decoded = jwtDecode(token);
    return decoded?.permissoes || {};
  } catch {
    return {};
  }
}

export function hasPermissao(grupo, acao) {
  const permissoes = getPermissoes();
  
  // SUPERADMIN tem acesso total a tudo, incluindo anjos
  if (permissoes.adm && Array.isArray(permissoes.adm) && permissoes.adm.includes("superadmin")) {
    return true;
  }
  
  // Para o grupo "anjos", não dar permissão automática para administradores comuns
  if (grupo === "anjos") {
    return Array.isArray(permissoes[grupo]) && permissoes[grupo].includes(acao);
  }
  
  // Para outros grupos, manter o comportamento original (admin comum tem acesso total)
  if (permissoes.adm && Array.isArray(permissoes.adm) && permissoes.adm.includes("admin")) {
    return true;
  }
  return Array.isArray(permissoes[grupo]) && permissoes[grupo].includes(acao);
}

// Permissões específicas para certificados
export function hasPermissaoCertificado(acao) {
  return hasPermissao('certificados', acao);
} 