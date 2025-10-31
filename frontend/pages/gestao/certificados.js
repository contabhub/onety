import { useState, useEffect } from "react";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import { FaCloudUploadAlt, FaQuestionCircle, FaFileExcel } from "react-icons/fa";
import CadastrarCertificadoClienteModal from "../../components/gestao/CadastrarCertificadoClienteModal";
import ModalSubstituirCertificado from "../../components/gestao/ModalSubstituirCertificado";
import { hasPermissaoCertificado } from "../../utils/gestao/permissoes";
import { toast } from "react-toastify";
import styles from "../../styles/gestao/CertificadosPage.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export default function CertificadosPage() {
  
  const [podeVisualizar, setPodeVisualizar] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [senha, setSenha] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [certificado, setCertificado] = useState(null);
  const [certificadosClientes, setCertificadosClientes] = useState([]);
  const [modoSubstituir, setModoSubstituir] = useState(false);
  const [modalClienteAberto, setModalClienteAberto] = useState(false);
  const [modalSubstituirAberto, setModalSubstituirAberto] = useState(false);
  const [certificadoParaSubstituir, setCertificadoParaSubstituir] = useState(null);
  const [ordenacao, setOrdenacao] = useState("vencimento");
  const [loading, setLoading] = useState(true);
  const [termoPesquisa, setTermoPesquisa] = useState("");
  
  const [itensPorPagina, setItensPorPagina] = useState(10);
  const [pagina, setPagina] = useState(1);
  
  useEffect(() => {
    // Verificar permissão apenas no cliente
    const temPermissao = hasPermissaoCertificado("visualizar");
    setPodeVisualizar(temPermissao);
    
    // Detectar tamanho da tela apenas no cliente
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  useEffect(() => {
    const fetchCertificadosClientes = async () => {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        console.error("EmpresaId não encontrado no storage");
        return;
      }
      
      try {
        const url = `${BASE_URL}/gestao/escritorio/certificados-clientes?ordenacao=${ordenacao}`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Empresa-Id": empresaId.toString()
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setCertificadosClientes(data);
      } catch (err) {
        console.log("Erro ao buscar certificados de clientes.");
      }
    };
    fetchCertificadosClientes();
  }, [ordenacao]);

  useEffect(() => {
    const fetchCertificado = async () => {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        console.error("EmpresaId não encontrado no storage");
        setLoading(false);
        return;
      }
      
      try {
        const url = `${BASE_URL}/gestao/escritorio?empresaId=${empresaId}`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Empresa-Id": empresaId.toString()
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setCertificado(data);
      } catch (err) {
        console.log("Nenhum certificado encontrado.");
      } finally {
        setLoading(false);
      }
    };
    fetchCertificado();
  }, []);
  
  // ✅ Reset da página quando mudar filtros
  useEffect(() => {
    setPagina(1);
  }, [termoPesquisa, ordenacao, itensPorPagina]);
  
  if (podeVisualizar === null) {
    return (
      <>
        <PrincipalSidebar />
        <div className={styles.container}>
          <div className={styles.card}>
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "300px",
              textAlign: "center"
            }}>
              <div>Carregando...</div>
            </div>
          </div>
        </div>
      </>
    );
  }
  
  if (!podeVisualizar) {
    return (
      <>
        <PrincipalSidebar />
        <div className={styles.container}>
          <div className={styles.card}>
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "300px",
              textAlign: "center"
            }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#D32F2F" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <h2 style={{ color: "#D32F2F", marginTop: 16, marginBottom: 8 }}>
                Acesso Negado
              </h2>
              <p style={{ color: "#666", maxWidth: "400px", lineHeight: 1.5 }}>
                Você não tem permissão para visualizar certificados. 
                Entre em contato com o administrador para solicitar acesso.
              </p>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.history.back();
                  }
                }}
                className={styles.button}
                style={{ marginTop: 24 }}
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  function calcularStatusVencimento(dataVencimento) {
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);

    const diffMs = vencimento.getTime() - hoje.getTime();
    const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    let className = styles.statusNormal;
    if (diffDias < 0) {
      className = styles.statusVencido;
    } else if (diffDias === 0) {
      className = styles.statusVenceHoje;
    }

    let texto = "";
    if (diffDias < 0) {
      texto = `Vencido há ${Math.abs(diffDias)} dia${Math.abs(diffDias) > 1 ? "s" : ""}`;
    } else if (diffDias === 0) {
      texto = "Vence hoje";
    } else {
      texto = `Faltam ${diffDias} dia${diffDias > 1 ? "s" : ""}`;
    }

    return <div className={className}>{texto}</div>;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = typeof window !== "undefined" 
      ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
      : "";
    const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
    const userData = rawUserData ? JSON.parse(rawUserData) : {};
    const empresaId = userData?.EmpresaId;

    const formData = new FormData();
    formData.append("senhaCertificado", senha);
    formData.append("apiKeyEplugin", apiKey);
    formData.append("empresaId", empresaId || "");
    if (arquivo) formData.append("pfxCertificado", arquivo);

    try {
      const response = await fetch(`${BASE_URL}/gestao/escritorio`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId.toString()
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setMensagem("✅ Certificado cadastrado com sucesso!");
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }, 1000);
    } catch (error) {
      console.error("Erro ao enviar certificado:", error);
      setMensagem("❌ Erro ao cadastrar o certificado.");
    }
  };

  const formatarData = (data) => {
    return new Date(data).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Filtrar certificados por termo de pesquisa
  const certificadosFiltrados = certificadosClientes.filter(cert => 
    cert.cliente_nome.toLowerCase().includes(termoPesquisa.toLowerCase()) ||
    cert.cliente_cnpj.includes(termoPesquisa) ||
    cert.nomeArquivo.toLowerCase().includes(termoPesquisa.toLowerCase())
  );

  // ✅ Cálculos de paginação
  const totalPaginas = Math.max(1, Math.ceil(certificadosFiltrados.length / itensPorPagina));
  const paginaInicio = Math.max(1, pagina - 2);
  const paginaFim = Math.min(totalPaginas, paginaInicio + 4);
  const certificadosPaginados = certificadosFiltrados.slice(
    (pagina - 1) * itensPorPagina,
    pagina * itensPorPagina
  );

  const handleSubstituirCertificado = async (certId, arquivo, dataVencimento) => {
    const token = typeof window !== "undefined" 
      ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
      : "";
    const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
    const userData = rawUserData ? JSON.parse(rawUserData) : {};
    const empresaId = userData?.EmpresaId;
    
    if (!empresaId) {
      console.error("EmpresaId não encontrado no storage");
      toast.error("Erro ao substituir certificado.");
      return;
    }
    
    try {
      const formData = new FormData();
      formData.append("pfxCertificado", arquivo);
      formData.append("dataVencimento", dataVencimento);

      const response = await fetch(`${BASE_URL}/gestao/escritorio/certificados-clientes/${certId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId.toString()
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setModalSubstituirAberto(false);
      setCertificadoParaSubstituir(null);
      
      // Recarregar certificados
      const res = await fetch(`${BASE_URL}/gestao/escritorio/certificados-clientes?ordenacao=${ordenacao}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId.toString()
        },
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      setCertificadosClientes(data);
      
      toast.success("Certificado substituído com sucesso!");
    } catch (error) {
      console.error("Erro ao substituir certificado:", error);
      toast.error("Erro ao substituir certificado.");
    }
  };

  const exportarParaExcel = () => {
    if (certificadosFiltrados.length === 0) {
      toast.error("Não há certificados para exportar.");
      return;
    }

    try {
      // Importar XLSX dinamicamente
      import('xlsx').then((XLSX) => {
        // Criar dados para o Excel
        const dados = [
          ['Cliente', 'CNPJ/CPF', 'Nome do Arquivo', 'Data de Vencimento'], // Cabeçalho
          ...certificadosFiltrados.map((cert) => [
            cert.cliente_nome,
            cert.cliente_cnpj,
            cert.nomeArquivo,
            new Date(cert.dataVencimento).toLocaleDateString("pt-BR")
          ])
        ];

        // Criar workbook e worksheet
        const ws = XLSX.utils.aoa_to_sheet(dados);
        
        // Ajustar largura das colunas
        ws['!cols'] = [
          { width: 40 }, // Cliente
          { width: 20 }, // CNPJ/CPF
          { width: 35 }, // Nome do Arquivo
          { width: 15 }  // Data de Vencimento
        ];

        // Criar workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Certificados');

        // Gerar arquivo XLSX
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        // Download do arquivo
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `certificados_clientes_${new Date().toISOString().split('T')[0]}.xlsx`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("Exportação realizada com sucesso!");
      }).catch((error) => {
        console.error("Erro ao importar XLSX:", error);
        toast.error("Erro ao exportar dados.");
      });
    } catch (error) {
      toast.error("Erro ao exportar dados.");
    }
  };

  return (
    <>
      <PrincipalSidebar />
      <div className={styles.container}>
        {loading ? (
          <div className={styles.card}>
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "300px",
              textAlign: "center"
            }}>
              <svg
                style={{ width: "36px", height: "36px", marginBottom: 12, animation: "spin 1s linear infinite" }}
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle cx="12" cy="12" r="10" stroke="var(--titan-primary)" strokeWidth="4" opacity="0.25" />
                <path d="M22 12a10 10 0 0 1-10 10" stroke="var(--titan-primary)" strokeWidth="4" strokeLinecap="round" />
              </svg>
              Carregando certificado...

              <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
            </div>
          </div>
        ) : (
          <>
            {!certificado || modoSubstituir || certificado.pfx === null ? (
              <div className={styles.card}>
                <h2 className={styles.title}>Importe seu certificado</h2>
                <label htmlFor="pfxUpload" className={styles.uploadArea}>
                  <FaCloudUploadAlt size={30} style={{ marginBottom: 8 }} />
                  <span style={{ fontWeight: "500" }}>
                    Clique aqui para selecionar o certificado
                  </span>
                  <input
                    type="file"
                    accept=".pfx"
                    id="pfxUpload"
                    onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                    style={{ display: "none" }}
                    required
                  />
                </label>
                <form onSubmit={handleSubmit} className={styles.form}>
                  <input
                    type="password"
                    placeholder="Senha"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    className={styles.input}
                  />
                  <div style={{ position: "relative", width: "100%" }}>
                    <input
                      type="text"
                      placeholder="API Key do Eplugin (opcional)"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className={styles.input}
                      style={{ paddingRight: 36 }}
                    />
                    <div
                      className={styles.tooltipIconWrapper}
                      onMouseEnter={() => setShowTooltip(true)}
                      onMouseLeave={() => setShowTooltip(false)}
                    >
                      <FaQuestionCircle className={styles.tooltipIcon} />
                      {showTooltip && (
                        <div className={styles.tooltipBox}>
                          O certificado digital deve estar vinculado ao mesmo CNPJ da sua empresa cadastrada. <br />
                          Certificados diferentes podem causar falhas nas integrações.
                        </div>
                      )}
                    </div>
                  </div>
                  <button type="submit" className={styles.button}>Validar</button>
                </form>
                {mensagem && <p className={styles.message}>{mensagem}</p>}
              </div>
            ) : (
              <>
                {/* ✅ Card 1: Certificado da Empresa */}
                <div className={styles.card}>
                  <div className={styles.certHeader}>
                    <h2 className={styles.certTitle}>Certificados da Empresa</h2>
                    {hasPermissaoCertificado("substituir") && (
                      <button
                        className={styles.certButton}
                        onClick={() => setModoSubstituir(true)}
                        onMouseEnter={() => setShowTooltip(true)}
                        onMouseLeave={() => setShowTooltip(false)}
                      >
                        Substituir certificado da empresa
                        <FaQuestionCircle style={{ marginLeft: 6 }} />
                        {showTooltip && (
                          <div className={styles.tooltipBox}>
                            O certificado digital deve estar vinculado ao mesmo CNPJ da sua empresa cadastrada. <br />
                            Certificados diferentes podem causar falhas nas integrações.
                          </div>
                        )}
                      </button>
                    )}
                  </div>
                  <div style={{
                    overflowX: "auto",
                    borderRadius: "var(--titan-radius-sm)",
                    border: "1px solid var(--titan-stroke)"
                  }}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th className={styles.th}>CNPJ/CPF</th>
                          <th className={styles.th}>Ativo?</th>
                          <th className={styles.th}>Criado em</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className={styles.td}>{certificado.cnpj || certificado.cpf}</td>
                          <td className={styles.td}>Sim</td>
                          <td className={styles.td}>{formatarData(certificado.criado_em)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ✅ Card 2: Certificados dos Clientes */}
                <div className={styles.card}>
                  {hasPermissaoCertificado("criar") && (
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
                      <button
                        onClick={() => setModalClienteAberto(true)}
                        className={styles.certButton}
                      >
                        Cadastrar certificado do cliente
                      </button>
                    </div>
                  )}
                  <div className={styles.certHeader}>
                    <div>
                      <h2 className={styles.certTitle}>Certificados de Clientes</h2>
                      {termoPesquisa && (
                        <p style={{
                          fontSize: 14,
                          color: "var(--titan-text-low)",
                          margin: 0,
                          marginTop: 4
                        }}>
                          {certificadosFiltrados.length} de {certificadosClientes.length} certificados encontrados
                        </p>
                      )}
                    </div>
                    <div className={styles.filtersContainer}>
                      {/* Botão Exportar Excel e Campo de Pesquisa */}
                      <div className={styles.searchContainer}>
                        {/* Botão Exportar Excel */}
                        <button
                          onClick={exportarParaExcel}
                          className={styles.excelButton}
                          title="Exportar certificados para Excel"
                        >
                          <FaFileExcel size={16} />
                          Exportar Excel
                        </button>
                        
                        <input
                          type="text"
                          placeholder="Pesquisar por cliente, CNPJ ou arquivo..."
                          value={termoPesquisa}
                          onChange={(e) => setTermoPesquisa(e.target.value)}
                          className={styles.searchInput}
                        />
                        {termoPesquisa && (
                          <button
                            onClick={() => setTermoPesquisa("")}
                            className={styles.clearButton}
                            title="Limpar pesquisa"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18"/>
                              <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        )}
                      </div>
                      
                      <label className={styles.label}>
                        Ordenar por:
                      </label>
                      <select
                        value={ordenacao}
                        onChange={(e) => setOrdenacao(e.target.value)}
                        className={styles.select}
                      >
                        <option value="vencimento">Vencimento (mais próximo)</option>
                        <option value="vencimento_desc">Vencimento (mais distante)</option>
                        <option value="cliente">Nome do Cliente</option>
                        <option value="arquivo">Nome do Arquivo</option>
                        <option value="criacao">Data de Criação</option>
                      </select>
                    </div>
                  </div>

                  <div style={{
                    overflowX: "auto",
                    borderRadius: "var(--titan-radius-sm)",
                    border: "1px solid var(--titan-stroke)"
                  }}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th className={styles.th}>Cliente</th>
                          <th className={styles.th}>CNPJ/CPF</th>
                          <th className={styles.th}>Nome do Arquivo</th>
                          <th className={styles.th}>Data de Vencimento</th>
                          <th className={styles.th}>Status</th>
                          <th className={styles.th}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {certificadosPaginados.length === 0 ? (
                          <tr>
                            <td className={styles.td} colSpan={6}>
                              {termoPesquisa ? 
                                `Nenhum certificado encontrado para "${termoPesquisa}"` : 
                                "Nenhum certificado cadastrado."
                              }
                            </td>
                          </tr>
                        ) : (
                          certificadosPaginados.map((cert) => (
                            <tr key={cert.id}>
                              <td className={styles.td}>{cert.cliente_nome}</td>
                              <td className={styles.td}>{cert.cliente_cnpj}</td>
                              <td className={styles.td}>{cert.nomeArquivo}</td>
                              <td className={styles.td} style={{ textAlign: "center" }}>
                                {new Date(cert.dataVencimento).toLocaleDateString("pt-BR")}
                              </td>
                              <td className={styles.td}>{calcularStatusVencimento(cert.dataVencimento)}</td>
                              <td className={styles.td}>
                                <div style={{ display: "flex", gap: "8px" }}>
                                  {hasPermissaoCertificado("download") && (
                                    <button
                                      onClick={async () => {
                                        const token = typeof window !== "undefined" 
                                          ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
                                          : "";
                                        const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
                                        const userData = rawUserData ? JSON.parse(rawUserData) : {};
                                        const empresaId = userData?.EmpresaId;
                                        
                                        try {
                                          const response = await fetch(`${BASE_URL}/gestao/escritorio/certificados-clientes/${cert.id}/download`, {
                                            headers: {
                                              Authorization: `Bearer ${token}`,
                                              "X-Empresa-Id": empresaId.toString()
                                            },
                                          });
                                          
                                          if (!response.ok) {
                                            throw new Error(`HTTP error! status: ${response.status}`);
                                          }
                                          
                                          const blob = await response.blob();
                                          
                                          if (typeof window !== 'undefined') {
                                            const url = window.URL.createObjectURL(blob);
                                            const link = document.createElement('a');
                                            link.href = url;
                                            link.setAttribute('download', cert.nomeArquivo);
                                            document.body.appendChild(link);
                                            link.click();
                                            link.remove();
                                            window.URL.revokeObjectURL(url);
                                          }
                                        } catch (error) {
                                          console.error("Erro ao fazer download:", error);
                                          toast.error("Erro ao fazer download do certificado.");
                                        }
                                      }}
                                      className={styles.actionButton}
                                      title="Download do certificado"
                                    >
                                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--titan-primary)" strokeWidth="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                        <polyline points="7,10 12,15 17,10"/>
                                        <line x1="12" y1="15" x2="12" y2="3"/>
                                      </svg>
                                    </button>
                                  )}
                                  {hasPermissaoCertificado("substituir") && (
                                    <button
                                      onClick={() => {
                                        setCertificadoParaSubstituir(cert);
                                        setModalSubstituirAberto(true);
                                      }}
                                      className={styles.actionButton}
                                      title="Substituir certificado"
                                    >
                                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--titan-warning)" strokeWidth="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                        <polyline points="7,10 12,15 17,10"/>
                                        <line x1="12" y1="15" x2="12" y2="3"/>
                                        <path d="M3 12h12"/>
                                      </svg>
                                    </button>
                                  )}
                                  {hasPermissaoCertificado("excluir") && (
                                    <button
                                      onClick={async () => {
                                        const token = typeof window !== "undefined" 
                                          ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
                                          : "";
                                        const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
                                        const userData = rawUserData ? JSON.parse(rawUserData) : {};
                                        const empresaId = userData?.EmpresaId;
                                        
                                        if (confirm("Deseja remover este certificado?")) {
                                          try {
                                            const response = await fetch(`${BASE_URL}/gestao/escritorio/certificados-clientes/${cert.id}`, {
                                              method: "DELETE",
                                              headers: {
                                                Authorization: `Bearer ${token}`,
                                                "X-Empresa-Id": empresaId.toString()
                                              },
                                            });
                                            
                                            if (!response.ok) {
                                              throw new Error(`HTTP error! status: ${response.status}`);
                                            }
                                            
                                            setCertificadosClientes((prev) => prev.filter((c) => c.id !== cert.id));
                                            toast.success("Certificado removido com sucesso!");
                                          } catch (error) {
                                            console.error("Erro ao excluir certificado:", error);
                                            toast.error("Erro ao excluir certificado.");
                                          }
                                        }
                                      }}
                                      className={styles.actionButton}
                                      title="Remover certificado"
                                    >
                                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--titan-error)" strokeWidth="2">
                                        <polyline points="3,6 5,6 21,6"/>
                                        <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                                        <line x1="10" y1="11" x2="10" y2="17"/>
                                        <line x1="14" y1="11" x2="14" y2="17"/>
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* ✅ Paginação adicionada */}
                  {certificadosFiltrados.length > 0 && (
                    <div className={styles.pagination}>
                      <span>
                        Mostrando {(pagina - 1) * itensPorPagina + 1}
                        {" - "}
                        {Math.min(pagina * itensPorPagina, certificadosFiltrados.length)} de {certificadosFiltrados.length}
                      </span>
                      <div className={styles.paginationButtons}>
                        <select
                          value={itensPorPagina}
                          onChange={(e) => setItensPorPagina(Number(e.target.value))}
                          className={styles.paginationSelect}
                          style={{ marginRight: 16 }}
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                        <button
                          className={styles.paginationArrow}
                          onClick={() => setPagina(1)}
                          disabled={pagina === 1}
                          aria-label="Primeira página"
                        >
                          {"<<"}
                        </button>
                        <button
                          className={styles.paginationArrow}
                          onClick={() => setPagina((p) => Math.max(1, p - 1))}
                          disabled={pagina === 1}
                          aria-label="Página anterior"
                        >
                          {"<"}
                        </button>
                        {Array.from({ length: paginaFim - paginaInicio + 1 }, (_, i) => paginaInicio + i).map((p) => (
                          <button
                            key={p}
                            onClick={() => setPagina(p)}
                            className={p === pagina ? styles.paginationButtonActive : styles.paginationArrow}
                          >
                            {p}
                          </button>
                        ))}
                        <button
                          className={styles.paginationArrow}
                          onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                          disabled={pagina === totalPaginas}
                          aria-label="Próxima página"
                        >
                          {">"}
                        </button>
                        <button
                          className={styles.paginationArrow}
                          onClick={() => setPagina(totalPaginas)}
                          disabled={pagina === totalPaginas}
                          aria-label="Última página"
                        >
                          {">>"}
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* ✅ Aviso movido para baixo da paginação */}
                  {(!certificado || certificado.pfx === null) && (
                    <div style={{ marginTop: "var(--titan-spacing-lg)" }}>
                      <p className={styles.warningBox}>
                        O certificado da empresa ainda não está cadastrado.
                        Isso pode afetar algumas integrações do sistema.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
        {modalClienteAberto && (
          <CadastrarCertificadoClienteModal
            onClose={() => setModalClienteAberto(false)}
            onSucesso={() => {
              setModalClienteAberto(false);
              const token = typeof window !== "undefined" 
                ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
                : "";
              const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
              const userData = rawUserData ? JSON.parse(rawUserData) : {};
              const empresaId = userData?.EmpresaId;
              
              fetch(`${BASE_URL}/gestao/escritorio/certificados-clientes?ordenacao=${ordenacao}`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "X-Empresa-Id": empresaId.toString()
                },
              })
              .then(res => res.json())
              .then(data => setCertificadosClientes(data));
            }}
          />
        )}
        {modalSubstituirAberto && certificadoParaSubstituir && (
          <ModalSubstituirCertificado
            certificado={certificadoParaSubstituir}
            onClose={() => {
              setModalSubstituirAberto(false);
              setCertificadoParaSubstituir(null);
            }}
            onSubstituir={handleSubstituirCertificado}
          />
        )}
      </div>
    </>
  );
}
