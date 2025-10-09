import { useEffect, useState, useMemo } from "react";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import SpaceLoader from "../../components/onety/menu/SpaceLoader";
import styles from "../../styles/contratual/Contratos.module.css";
import { useRouter } from "next/router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faDownload, faPencilAlt, faLink, faClone, faClock, faFilePdf, faList, faThLarge, faCheck, faTimes, faCalendarAlt } from "@fortawesome/free-solid-svg-icons";
import { ToastContainer, toast, Bounce } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


export default function Contratos() {
  const [contratos, setContratos] = useState([]);
  const [error, setError] = useState(null);
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  // const [isModalOpen, setIsModalOpen] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null); // contratoId do dropdown aberto
  const [signatariosDropdown, setSignatariosDropdown] = useState({}); // { contratoId: [signatarios] }
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5); // Convertido para estado
  const [prolongarId, setProlongarId] = useState(null);
  const [diasProlongar, setDiasProlongar] = useState(7);
  const [pdfOnly, setPdfOnly] = useState(false); // Filtro PDF
  const [viewMode, setViewMode] = useState("table"); // "table" ou "kanban"
  const [dataFiltro, setDataFiltro] = useState(""); // Filtro de data (mês/ano)
  const [mesFiltro, setMesFiltro] = useState(""); // Filtro de mês
  const [anoFiltro, setAnoFiltro] = useState(() => {
    const now = new Date();
    return String(now.getFullYear());
  }); // Filtro de ano, default ano atual
  const [autentiqueFiltro, setAutentiqueFiltro] = useState("todos"); // Filtro autentique
  const [downloadDropdownId, setDownloadDropdownId] = useState(null); // ID do contrato com dropdown de download aberto
  const [userRole, setUserRole] = useState(null);
  const isSuperAdmin = userRole === 'superadmin';

  const handleOpenModal = () => {
    router.push('/contratual/criar-contrato-autentique');
  };

  // Função para resetar página quando mudar quantidade de itens
  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset para primeira página
  };

  // const handleCloseModal = () => {
  //   setIsModalOpen(false);
  // };


  // Aplica filtro inicial vindo de /contratos?status=...
  useEffect(() => {
    if (!router?.query) return;
    const q = String(router.query.status || '').toLowerCase();
    const valid = ['pendente', 'assinado', 'expirado', 'reprovado'];
    if (valid.includes(q)) {
      setStatusFiltro(q);
    }
  }, [router.query]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("userData");
    const user = userRaw ? JSON.parse(userRaw) : null;
    const equipeId = user?.EmpresaId ?? null;
    setUserRole(user && user.permissoes?.adm ? String(user.permissoes.adm[0]).toLowerCase() : null);

    if (!token || !equipeId) {
      setError("Você precisa estar logado e vinculado a uma equipe.");
      return;
    }


    async function fetchContratos() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos/empresa/${equipeId}/light`, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(`Erro ao buscar contratos: ${res.status} - ${res.statusText}`);
        }

        const data = await res.json();
        console.log("✅ [DEBUG] Dados recebidos da API:", data);
        // Debug adicional para contratos do Autentique
        const contratosAutentique = data.filter(c => c.autentique === 1);
        if (contratosAutentique.length > 0) {
          console.log("🔐 [DEBUG] Contratos do Autentique encontrados:", contratosAutentique.map(c => ({
            id: c.id,
            autentique_id: c.autentique_id,
            client_name: c.client_name
          })));
        }
        setContratos(data);
        verificarContratosExpirados(data);
        setIsLoading(false);
      } catch (error) {
        console.error(error);
        setError("Erro ao buscar contratos.");
        setIsLoading(false)
      }
    }

    async function verificarContratosExpirados(contratos) {
      const agora = new Date();

      // Filtra contratos pendentes que podem ser expirados
      const pendentes = contratos.filter(
        (contrato) =>
          contrato.status !== "expirado" &&
          contrato.status !== "assinado" && // Exclui contratos assinados
          new Date(contrato.expires_at) < agora
      );

      if (pendentes.length === 0) {
        console.log("Nenhum contrato pendente para expirar.");
        return; // Não faz nada se não houver contratos pendentes
      }

      // Atualiza o status dos contratos expirados
      for (const contrato of pendentes) {
        const token = localStorage.getItem("token");

        try {
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos/${contrato.id}/status`, {
            method: "PATCH",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              status: "expirado",
            }),
          });
        } catch (err) {
          console.error(`Erro ao atualizar contrato ${contrato.id} como expirado:`, err);
        }
      }

      // Recarrega os contratos se houver mudanças
      if (pendentes.length > 0) {
        fetchContratos(); // Recarrega a lista atualizada
      }
    }



    fetchContratos();

    const intervalo = setInterval(fetchContratos, 60000); // a cada 60 segundos

    return () => clearInterval(intervalo);
  }, []);



  const handleViewContract = (id) => {
    router.push(`/contratual/contrato/${id}`);
  };

  // Anos disponíveis nos contratos (useMemo para performance)
  const anosDisponiveis = useMemo(() => {
    const anos = new Set();
    contratos.forEach(c => {
      if (c.expires_at) {
        anos.add(c.expires_at.slice(0, 4));
      }
    });
    // Garante que o ano atual sempre aparece
    const atual = String(new Date().getFullYear());
    anos.add(atual);
    return Array.from(anos).sort((a, b) => b - a);
  }, [contratos]);

  const meses = [
    { value: "", label: "Todos" },
    { value: "01", label: "Janeiro" },
    { value: "02", label: "Fevereiro" },
    { value: "03", label: "Março" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Maio" },
    { value: "06", label: "Junho" },
    { value: "07", label: "Julho" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ];

  // Filtro combinado de status, PDF, mês, ano e autentique
  const contratosFiltrados = contratos.filter((contrato) => {
    const statusOk = statusFiltro === "todos" || contrato.status.toLowerCase() === statusFiltro;
    const isPdf = contrato.content && contrato.content.startsWith("JVBERi0");

    // Filtro autentique
    const autentiqueOk = autentiqueFiltro === "todos" ||
      (autentiqueFiltro === "sim" && contrato.autentique === 1) ||
      (autentiqueFiltro === "nao" && contrato.autentique === 0);

    // Filtro de ano e mês
    let dataOk = true;
    if (anoFiltro) {
      const anoContrato = contrato.expires_at ? contrato.expires_at.slice(0, 4) : "";
      dataOk = anoContrato === anoFiltro;
    }
    if (mesFiltro) {
      const mesContrato = contrato.expires_at ? contrato.expires_at.slice(5, 7) : "";
      dataOk = dataOk && mesContrato === mesFiltro;
    }

    // Se não tem data de expiração, não aplica filtro de data
    if (!contrato.expires_at) {
      dataOk = true;
    }

    if (viewMode === "table" && pdfOnly) {
      return statusOk && isPdf && dataOk && autentiqueOk;
    }
    return statusOk && dataOk && autentiqueOk;
  });
  const totalPages = Math.ceil(contratosFiltrados.length / itemsPerPage) || 1;
  const paginatedContratos = contratosFiltrados.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // useEffect para ajustar página atual quando mudar filtros ou quantidade de itens
  useEffect(() => {
    const maxPage = Math.ceil(contratosFiltrados.length / itemsPerPage);
    if (currentPage > maxPage && maxPage > 0) {
      setCurrentPage(maxPage);
    }
  }, [contratosFiltrados.length, itemsPerPage, currentPage]);

  const handleDownloadContrato = async (contratoId) => {
    const token = localStorage.getItem("token");

    // 1. Garante que a folha de assinaturas foi criada/atualizada
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos/${contratoId}/generate-signatures-base64`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });

    // 2. Só agora faz o download do PDF
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos/${contratoId}/download`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!data.base64) throw new Error("Base64 não retornado");

      const binaryString = atob(data.base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: "application/pdf" });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `contrato-${contratoId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erro ao fazer download do contrato:", err);
      toast.error("Erro ao gerar PDF.");
    }
  };

  // Função para fazer download de contratos do Autentique
  const handleDownloadAutentique = async (contratoId, type = "signed") => {
    const token = localStorage.getItem("token");

    // Busca o contrato para pegar o autentique_id
    const contrato = contratos.find(c => c.id === contratoId);
    if (!contrato?.autentique_id) {
      toast.error("ID do Autentique não encontrado para este contrato.");
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos-autentique/${contrato.autentique_id}/download?type=${type}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Erro ao baixar arquivo: ${res.status}`);
      }

      // Cria um blob do PDF e faz o download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Nome do arquivo baseado no tipo
      const typeLabels = {
        original: "original",
        signed: "assinado",
        pades: "pades",
        certificado: "certificado",
      };
      link.download = `contrato-${contratoId}-${typeLabels[type]}.pdf`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Download do arquivo ${typeLabels[type]} realizado com sucesso!`);
      setDownloadDropdownId(null); // Fecha o dropdown
    } catch (err) {
      console.error("Erro ao fazer download do arquivo do Autentique:", err);
      toast.error("Erro ao baixar arquivo do Autentique.");
    }
  };

  const handleEditContract = async (id) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        toast.error("Erro ao verificar o contrato!");
        return;
      }
      const data = await res.json();
      // Checa se é base64 PDF
      if (data.contract.content && data.contract.content.startsWith("JVBERi0")) {
        toast.warning(
          <>
            Este contrato foi enviado como PDF.<br />
            Não é possível editar o conteúdo do PDF nesta tela.<br />
            Faça upload de um novo arquivo se quiser atualizar o contrato.
          </>,
          { autoClose: 10000 }
        );
        return; // NÃO navega
      }
      // Se não for PDF, navega normalmente
      router.push(`/contratual/editar-contrato?id=${id}`);
    } catch (err) {
      toast.error("Erro ao abrir o contrato para edição!");
    }
  };

  const handleCloneContract = async (id) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        toast.error("Erro ao buscar contrato para clonar!");
        return;
      }
      const data = await res.json();
      // Checa se é base64 PDF
      if (data.contract.content && data.contract.content.startsWith("JVBERi0")) {
        toast.warning("Não é possível clonar contratos enviados como PDF.");
        return;
      }
      // Salva os dados no localStorage
      localStorage.setItem("cloneContratoData", JSON.stringify(data.contract));
      // Redireciona para a tela de criação com flag de clone
      router.push("/contratual/criar-contrato-autentique?clone=1");
    } catch (err) {
      toast.error("Erro ao clonar contrato!");
    }
  };

  const handleDropdownSignatarios = async (contratoId) => {
    // Se já aberto, fecha
    if (openDropdownId === contratoId) {
      setOpenDropdownId(null);
      return;
    }

    // Busca o contrato para verificar se é do Autentique
    const contrato = contratos.find(c => c.id === contratoId);
    const isAutentique = contrato?.autentique === 1;

    // Se já buscou antes, só abre
    if (signatariosDropdown[contratoId]) {
      // Se só tem 1, já copia direto
      if (signatariosDropdown[contratoId].length === 1) {
        const onlySig = signatariosDropdown[contratoId][0];
        const url = isAutentique
          ? onlySig.token_acesso
          : `${window.location.origin}/contratual/assinar/${onlySig.token_acesso}`;
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado com sucesso!");
        setOpenDropdownId(null);
        return;
      }
      setOpenDropdownId(contratoId);
      return;
    }
    // Busca signatários na API
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos/${contratoId}/signatories`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const signatarios = await response.json();
      // console.log("Signatários recebidos:", signatarios);

      if (!signatarios.length) {
        toast.warning("Sem signatários");
        return;
      }

      setSignatariosDropdown((prev) => ({ ...prev, [contratoId]: signatarios }));

      // Só abre o dropdown se tiver mais de um
      if (signatarios.length === 1) {
        const url = isAutentique
          ? signatarios[0].token_acesso
          : `${window.location.origin}/contratual/assinar/${signatarios[0].token_acesso}`;
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado com sucesso!");
        setOpenDropdownId(null);
      } else {
        setOpenDropdownId(contratoId);
      }
    } catch (e) {
      console.error("Erro ao buscar signatários:", e);
      toast.error("Erro ao buscar signatários.");
    }
  };



  const handleCopySignatarioLink = async (token_acesso, contratoId) => {
    // Busca o contrato para verificar se é do Autentique
    const contrato = contratos.find(c => c.id === contratoId);
    const isAutentique = contrato?.autentique === 1;

    const url = isAutentique
      ? token_acesso
      : `${window.location.origin}/contratual/assinar/${token_acesso}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado para a área de transferência!");
    setOpenDropdownId(null); // fecha o dropdown após copiar
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      // fecha se clicar fora do dropdown e do ícone de link
      if (
        !event.target.closest(`.${styles.linkIcon}`) &&
        !event.target.closest(`.${styles.signatariosDropdown}`)
      ) {
        setOpenDropdownId(null);
      }

      // fecha se clicar fora do dropdown de download
      if (
        !event.target.closest(`.${styles.downloadIcon}`) &&
        !event.target.closest(`.${styles.downloadDropdown}`)
      ) {
        setDownloadDropdownId(null);
      }
    };
    if (openDropdownId !== null || downloadDropdownId !== null) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openDropdownId, downloadDropdownId]);

  // Função para prolongar contrato expirado
  const handleProlongarContrato = async (contratoId) => {
    const token = localStorage.getItem("token");
    try {
      // Busca o contrato para pegar a data atual de expiração
      const contrato = contratos.find(c => c.id === contratoId);
      const dataBase = contrato?.expires_at ? new Date(contrato.expires_at) : new Date();
      // Se já expirou, começa do hoje
      const base = (contrato?.status === "expirado" && dataBase < new Date()) ? new Date() : dataBase;
      const novaData = new Date(base);
      novaData.setDate(novaData.getDate() + Number(diasProlongar));
      const new_expires_at = novaData.toISOString().slice(0, 19).replace('T', ' ');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos/${contratoId}/prolongar`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ new_expires_at }),
      });
      if (!res.ok) throw new Error("Erro ao prolongar contrato");
      toast.success("Contrato prolongado com sucesso!");
      setProlongarId(null);
      setDiasProlongar(7);
      // Atualiza lista
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      toast.error("Erro ao prolongar contrato.");
    }
  };

  return (
    <>
      <div className={styles.page}>
        <PrincipalSidebar />
        <div className={styles.pageContent}>
      <div className={styles.pageContainer}>
        <div className={styles.header}>
          <h1 className={styles.title}>Contratos</h1>
          <div className={styles.userButtonContainer}>
            <button className={styles.button} onClick={handleOpenModal}>
              Novo Contrato
            </button>
          </div>
        </div>

        {/* {isModalOpen && <ModalCriarContrato onClose={handleCloseModal} />} */}


        {/* Filtro e alternância de visualização */}
        <div className={styles.filtroContainer}>
        <label htmlFor="statusFiltro">Filtrar por status:</label>
        <select
          id="statusFiltro"
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value)}
        >
          <option value="todos">Todos</option>
          <option value="pendente">Pendente</option>
          <option value="assinado">Assinado</option>
          <option value="expirado">Expirado</option>
          <option value="reprovado">Reprovado</option>
        </select>
        {/* Filtro de data combinado */}
        <div
          className={styles.filtroDataCombinado}
          title="Filtrar contratos por mês e ano de expiração"
        >
          <label htmlFor="mesFiltro" style={{ fontSize: '14px', color: '#555', marginRight: '4px' }}>Data:</label>
          <select
            id="mesFiltro"
            value={mesFiltro}
            onChange={e => setMesFiltro(e.target.value)}
            className={styles.filtroDataCombinado}
            style={{
              marginRight: '8px',
              minWidth: '80px'
            }}
          >
            {meses.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <span style={{ color: '#999', marginRight: '8px' }}>/</span>
          <select
            id="anoFiltro"
            value={anoFiltro}
            onChange={e => setAnoFiltro(e.target.value)}
            className={styles.filtroDataCombinado}
            style={{
              minWidth: '70px'
            }}
          >
            {anosDisponiveis.map(ano => (
              <option key={ano} value={ano}>{ano}</option>
            ))}
          </select>
        </div>
        {/* Filtro autentique - apenas superadmin */}
        {isSuperAdmin && (
          <>
            <label
              htmlFor="autentiqueFiltro"
              style={{ marginLeft: 12 }}
              title="Filtrar contratos por status de autenticação. Contratos autenticados são aqueles que passaram por processo de validação legal."
            >
              Autentique:
            </label>
            <select
              id="autentiqueFiltro"
              value={autentiqueFiltro}
              onChange={e => setAutentiqueFiltro(e.target.value)}
              style={{ marginLeft: 4, marginRight: 8 }}
              title="Filtrar contratos por status de autenticação. Contratos autenticados são aqueles que passaram por processo de validação legal."
            >
              <option value="todos">Todos</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </>
        )}
        {/* Ícone PDF toggle só no modo tabela */}
        {viewMode === "table" && (
          <button
            type="button"
            className={`${styles.pdfFilterBtn} ${pdfOnly ? styles.pdfFilterActive : ''}`}
            onClick={() => setPdfOnly((prev) => !prev)}
            title={pdfOnly ? "Mostrar todos os contratos" : "Mostrar apenas contratos em PDF"}
          >
            <FontAwesomeIcon icon={faFilePdf} />
          </button>
        )}
        {/* Botões de alternância de visualização */}
        <button
          type="button"
          className={`${styles.viewToggleBtn} ${viewMode === 'table' ? styles.viewToggleActive : ''}`}
          onClick={() => { setViewMode('table'); setPdfOnly(false); }}
          title="Visualização em lista"
        >
          <FontAwesomeIcon icon={faList} />
        </button>
        <button
          type="button"
          className={`${styles.viewToggleBtn} ${viewMode === 'kanban' ? styles.viewToggleActive : ''}`}
          onClick={() => { setViewMode('kanban'); setPdfOnly(false); }}
          title="Visualização Kanban"
        >
          <FontAwesomeIcon icon={faThLarge} />
        </button>
        
        {/* Seletor de quantidade de itens por página */}
        {viewMode === 'table' && (
          <div className={styles.itemsPerPageContainer}>
            <select
              id="itemsPerPage"
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              className={styles.itemsPerPageSelect}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        )}
      </div>

        {error && <p className={styles.error}>{error}</p>}
        {isLoading ? (
          <SpaceLoader 
            size={140} 
            label="Carregando contratos..." 
            showText={true}
            minHeight={400}
          />
        ) : (
        <>
          {/* Renderização condicional: tabela/lista ou Kanban */}
          {viewMode === 'table' ? (
            <>
              {/* 📱 TABELA - Desktop */}
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Nome</th>
                      <th>Responsável</th>
                      <th>Status</th>
                      <th>Expira em</th>
                      <th>Valor</th>
                      {/* {isSuperAdmin && <th>Autentique</th>} */}
                      <th>MRR</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedContratos.length > 0 ? (
                      paginatedContratos.map((contrato) => (
                        <tr key={contrato.id}>
                          <td>{contrato.id}</td>
                          <td>{contrato.client_name || "Contrato sem cliente"}</td>
                          <td>{contrato.created_by}</td> {/* Exibindo o responsável */}

                          <td>
                            <span className={styles[contrato.status.toLowerCase()]}>
                              {contrato.status}
                            </span>
                          </td>

                          <td>{contrato.expires_at?.slice(0, 10).split('-').reverse().join('/')}</td>
                          <td>{contrato.valor !== undefined && contrato.valor !== null ? `R$ ${Number(contrato.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</td>
                          <td>{contrato.valor_recorrente !== undefined && contrato.valor_recorrente !== null ? `R$ ${Number(contrato.valor_recorrente).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</td>
                          {/* {isSuperAdmin && (
                            <td>
                              <span
                                className={contrato.autentique === 1 ? styles.autentiqueSim : styles.autentiqueNao}
                                title={contrato.autentique === 1 ? "Contrato autenticado - Passou por processo de validação legal" : "Contrato não autenticado - Ainda não passou por processo de validação legal"}
                              >
                                <FontAwesomeIcon
                                  icon={contrato.autentique === 1 ? faCheck : faTimes}
                                  style={{ fontSize: '14px' }}
                                />
                              </span>
                            </td>
                          )} */}

                          <td className={styles.actions}>

                            <button
                              className={styles.viewIcon}
                              onClick={() => handleViewContract(contrato.id)}
                              title="Visualizar contrato"
                            >
                              <FontAwesomeIcon icon={faEye} />
                            </button>

                            {/* Ícone de lápis para contratos pendentes */}
                            {contrato.status === "pendente" && (
                              <>
                                {/* <button
                                  className={styles.editIcon}
                                  onClick={() => handleEditContract(contrato.id)}
                                  title="Editar contrato"
                                >
                                  <FontAwesomeIcon icon={faPencilAlt} />
                                </button> */}
                                {/* Botão de clonar contrato, só aparece se não for PDF */}
                                <button
                                  className={styles.cloneIcon}
                                  onClick={() => handleCloneContract(contrato.id)}
                                  title="Clonar contrato"
                                >
                                  <FontAwesomeIcon icon={faClone} />
                                </button>
                              </>
                            )}

                            {contrato.status === "assinado" && (
                              <div style={{ position: "relative", display: "inline-block" }}>
                                <button
                                  className={styles.downloadIcon}
                                  onClick={() => {
                                    // Verifica se é contrato do Autentique
                                    if (contrato.autentique === 1) {
                                      setDownloadDropdownId(downloadDropdownId === contrato.id ? null : contrato.id);
                                    } else {
                                      handleDownloadContrato(contrato.id);
                                    }
                                  }}
                                  title={contrato.autentique === 1 ? "Escolher tipo de download" : "Baixar contrato"}
                                >
                                  <FontAwesomeIcon icon={faDownload} />
                                </button>

                                {/* Dropdown de download para contratos do Autentique */}
                                {contrato.autentique === 1 && downloadDropdownId === contrato.id && (
                                  <div className={styles.downloadDropdown}>
                                    <div className={styles.downloadDropdownHeader}>
                                      Escolha o tipo de arquivo:
                                    </div>
                                    <button
                                      className={styles.downloadOption}
                                      onClick={() => handleDownloadAutentique(contrato.id, "original")}
                                      title="Download do arquivo original (sem assinaturas)"
                                    >
                                      <FontAwesomeIcon icon={faFilePdf} style={{ marginRight: '8px' }} />
                                      Original
                                    </button>
                                    <button
                                      className={styles.downloadOption}
                                      onClick={() => handleDownloadAutentique(contrato.id, "signed")}
                                      title="Download do arquivo assinado (com assinaturas)"
                                    >
                                      <FontAwesomeIcon icon={faFilePdf} style={{ marginRight: '8px' }} />
                                      Assinado
                                    </button>
                                    <button
                                      className={styles.downloadOption}
                                      onClick={() => handleDownloadAutentique(contrato.id, "certificado")}
                                      title="Baixar o certificado (certificado.pdf)"
                                    >
                                      <FontAwesomeIcon icon={faFilePdf} style={{ marginRight: '8px' }} />

                                      Certificado
                                    </button>


                                  </div>
                                )}
                              </div>
                            )}
                            <div style={{ position: "relative", display: "inline-block" }}>

                              <button
                                className={styles.linkIcon}
                                onClick={() => handleDropdownSignatarios(contrato.id)}
                                title="Copiar link do contrato"
                              >
                                <FontAwesomeIcon icon={faLink} />
                              </button>


                              {/* Dropdown de signatários */}
                              {openDropdownId === contrato.id && signatariosDropdown[contrato.id] && (
                                <ul className={styles.signatariosDropdown}>
                                  {signatariosDropdown[contrato.id].map((sig) => (
                                    <li
                                      key={sig.id}
                                      className={styles.signatarioItem}
                                      onClick={() => handleCopySignatarioLink(sig.token_acesso, contrato.id)}
                                    >
                                      <strong>{sig.nome || sig.email}</strong> — {sig.email}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>

                            {contrato.status === "expirado" && (
                              <span style={{ position: "relative", display: "inline-block" }}>
                                <button
                                  className={styles.clockIcon}
                                  title="Prolongar contrato"
                                  onClick={() => setProlongarId(prolongarId === contrato.id ? null : contrato.id)}
                                >
                                  <FontAwesomeIcon icon={faClock} />
                                </button>
                                {prolongarId === contrato.id && (
                                  <div className={styles.prolongarDropdown}>
                                    <label style={{ fontSize: 14, color: "#333" }}>Dias para prolongar:</label>
                                    <input
                                      type="number"
                                      min={1}
                                      value={diasProlongar}
                                      onChange={e => setDiasProlongar(e.target.value)}
                                      className={styles.prolongarInput}
                                    />
                                    <button
                                      className={styles.prolongarBtn}
                                      onClick={() => handleProlongarContrato(contrato.id)}
                                    >
                                      Confirmar
                                    </button>
                                    <button
                                      className={styles.prolongarCancelBtn}
                                      onClick={() => setProlongarId(null)}
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                )}
                              </span>
                            )}

                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={isSuperAdmin ? 8 : 7}>Nenhum contrato encontrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* �� CARDS - Mobile */}
              <div className={styles.cardList}>
                {paginatedContratos.map((contrato) => (
                  <div key={contrato.id} className={styles.card}>
                    <div className={styles.cardTitle}>
                      {contrato.content?.substring(0, 40)}...
                    </div>
                    <div className={styles.cardInfo}>
                      <strong>Responsável: </strong> {contrato.client_name}

                      <span className={styles[contrato.status.toLowerCase()]}>
                        {contrato.status}
                      </span>
                      <span>{new Date(contrato.expires_at).toLocaleDateString()}</span>
                    </div>
                    <div className={styles.cardActions}>

                      <button
                        className={styles.viewIcon}
                        onClick={() => handleViewContract(contrato.id)}
                        title="Visualizar contrato"
                      >
                        <FontAwesomeIcon icon={faEye} />
                      </button>

                      {/* Ícone de lápis para contratos pendentes */}
                      {contrato.status === "pendente" && (
                        <>
                          <button
                            className={styles.editIcon}
                            onClick={() => handleEditContract(contrato.id)}
                            title="Editar contrato"
                          >
                            <FontAwesomeIcon icon={faPencilAlt} />
                          </button>
                          <button
                            className={styles.cloneIcon}
                            onClick={() => handleCloneContract(contrato.id)}
                            title="Clonar contrato"
                          >
                            <FontAwesomeIcon icon={faClone} />
                          </button>
                        </>
                      )}

                      {contrato.status === "assinado" && (
                        <div style={{ position: "relative", display: "inline-block" }}>
                          <button
                            className={styles.downloadIcon}
                            onClick={() => {
                              // Verifica se é contrato do Autentique (apenas superadmin visualiza opções)
                              if (isSuperAdmin && contrato.autentique === 1) {
                                setDownloadDropdownId(downloadDropdownId === contrato.id ? null : contrato.id);
                              } else {
                                handleDownloadContrato(contrato.id);
                              }
                            }}
                            title={isSuperAdmin && contrato.autentique === 1 ? "Escolher tipo de download" : "Baixar contrato"}
                          >
                            <FontAwesomeIcon icon={faDownload} />
                          </button>

                          {/* Dropdown de download para contratos do Autentique */}
                          {isSuperAdmin && contrato.autentique === 1 && downloadDropdownId === contrato.id && (
                            <div className={styles.downloadDropdown}>
                              <div className={styles.downloadDropdownHeader}>
                                Escolha o tipo de arquivo:
                              </div>
                              <button
                                className={styles.downloadOption}
                                onClick={() => handleDownloadAutentique(contrato.id, "original")}
                                title="Download do arquivo original (sem assinaturas)"
                              >
                                <FontAwesomeIcon icon={faFilePdf} style={{ marginRight: '8px' }} />
                                Original
                              </button>
                              <button
                                className={styles.downloadOption}
                                onClick={() => handleDownloadAutentique(contrato.id, "signed")}
                                title="Download do arquivo assinado (com assinaturas)"
                              >
                                <FontAwesomeIcon icon={faFilePdf} style={{ marginRight: '8px' }} />
                                Assinado
                              </button>
                              <button
                                className={styles.downloadOption}
                                onClick={() => handleDownloadAutentique(contrato.id, "pades")}
                                title="Download do arquivo PAdES (padrão de assinatura digital)"
                              >
                                <FontAwesomeIcon icon={faFilePdf} style={{ marginRight: '8px' }} />
                                PAdES
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {contratosFiltrados.length > 0 && totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={`${styles.pageButton} ${currentPage === 1 ? styles.disabled : ''}`}
                  >
                    Anterior
                  </button>

                  <span className={styles.pageInfo}>
                    Página {currentPage} de {totalPages}
                  </span>


                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={`${styles.pageButton} ${currentPage === totalPages ? styles.disabled : ''}`}
                  >
                    Próxima
                  </button>
                </div>
              )}
              
              {/* Informação quando há apenas uma página */}
              {contratosFiltrados.length > 0 && totalPages === 1 && (
                <div className={styles.singlePageMessage}>
                  Mostrando todos os {contratosFiltrados.length} contratos
                </div>
              )}
            </>
          ) : (
            // Kanban
            <KanbanView contratos={contratos} statusFiltro={statusFiltro} isSuperAdmin={isSuperAdmin} />
          )}
          </>
        )}

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
      </div>
        </div>
      </div>
    </>
  );
}

function KanbanView({ contratos, statusFiltro, isSuperAdmin }) {
  // Filtrar contratos por statusFiltro (mas sem filtro PDF)
  const statusList = [
    { key: 'pendente', label: 'Pendente' },
    { key: 'assinado', label: 'Assinado' },
    { key: 'expirado', label: 'Expirado' },
    { key: 'reprovado', label: 'Reprovado' },
  ];
  const contratosFiltrados = contratos.filter((contrato) => {
    if (statusFiltro === 'todos') return true;
    return contrato.status.toLowerCase() === statusFiltro;
  });
  return (
    <div style={{ display: 'flex', gap: 24, overflowX: 'auto', marginTop: 24 }}>
      {statusList.map((status) => (
        <div key={status.key} style={{ minWidth: 260, background: '#f8f9ff', borderRadius: 8, padding: 12, boxShadow: '0 1px 4px #0001' }}>
          <div style={{ fontWeight: 'bold', marginBottom: 10, fontSize: 16 }}>{status.label}</div>
          {contratosFiltrados.filter(c => c.status.toLowerCase() === status.key).length === 0 ? (
            <div style={{ color: '#888', fontSize: 14 }}>Nenhum contrato</div>
          ) : (
            contratosFiltrados.filter(c => c.status.toLowerCase() === status.key).map((contrato) => (
              <div key={contrato.id} style={{ background: '#fff', border: '1px solid #dee4ff', borderRadius: 6, marginBottom: 10, padding: 10 }}>
                <div style={{ fontWeight: 'bold', color: '#2563eb', fontSize: 15 }}>{contrato.client_name || 'Contrato sem cliente'}</div>
                <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>ID: {contrato.id}</div>
                <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>Responsável: {contrato.created_by}</div>
                <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>Expira: {contrato.expires_at?.slice(0, 10).split('-').reverse().join('/')}</div>
                {isSuperAdmin && (
                  <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>
                    Autentique: <span
                      style={{ color: contrato.autentique === 1 ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}
                      title={contrato.autentique === 1 ? "Contrato autenticado - Passou por processo de validação legal" : "Contrato não autenticado - Ainda não passou por processo de validação legal"}
                    >
                      <FontAwesomeIcon
                        icon={contrato.autentique === 1 ? faCheck : faTimes}
                        style={{ fontSize: '12px', marginLeft: '4px' }}
                      />
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}
