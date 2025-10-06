import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import styles from "../../styles/comercial/crm/CRM.module.css";
import SpaceLoader from "../../components/onety/menu/SpaceLoader";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import CreateCardModal from "../../components/comercial/crm/CreateCardModal";
import CRMCard from "../../components/comercial/crm/CRMCard";

import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import Column from "../../components/comercial/crm/Column";
import EditCardModal from "../../components/comercial/crm/EditCardModal";
import ImportLeadsModal from "../../components/comercial/crm/ImportLeadsModal";
import ExportLeadsModal from "../../components/comercial/crm/ExportLeadsModal";
import { registrarHistorico } from "../../utils/registrarHistorico";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch, faFileCsv, faThLarge, faList, faPencilAlt, faSnowflake, faFire, faInfoCircle, faThumbsUp, faThumbsDown, faBriefcase, faChevronDown, faChevronUp, faPlus, faBars, faCalendar
} from "@fortawesome/free-solid-svg-icons";




export default function CRM() {
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedColumnId, setSelectedColumnId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [teamId, setTeamId] = useState(null);
  const [funilId, setFunilId] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor));
  const [columns, setColumns] = useState({});
  const router = useRouter();

  const [funis, setFunis] = useState([]);
  const [funilSelecionado, setFunilSelecionado] = useState(null);
  const [orderedColumnIds, setOrderedColumnIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeCard, setActiveCard] = useState(null);
  const [viewMode, setViewMode] = useState("crm");
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showToolsDrawer, setShowToolsDrawer] = useState(false);

  const [membrosEquipe, setMembrosEquipe] = useState([]);
  const [fasesDoFunil, setFasesDoFunil] = useState([]);
  const [responsaveisSelecionados, setResponsaveisSelecionados] = useState(['todos']);

  const [dropdownAberto, setDropdownAberto] = useState(false);
  const dropdownRef = useRef(null);

  const [dropdownFunilAberto, setDropdownFunilAberto] = useState(false);
  const dropdownFunilRef = useRef(null);



  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const userRaw = localStorage.getItem('user');
      const token = localStorage.getItem('token');

      if (!userRaw || !token) {
        console.error('Usuário ou token não encontrado no localStorage.');
        return;
      }

      const user = JSON.parse(userRaw);

      if (!user.id) {
        console.error('ID do usuário não encontrado.');
        return;
      }

      const userId = user.id;
      const equipeId = user.equipe_id;

      if (!equipeId) {
        console.warn('Usuário não está vinculado a nenhuma equipe.');
        setColumns({});
        return;
      }

      setTeamId(equipeId);

      // 🔵 Busca o funil da equipe - COM TOKEN
      const funilRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/funis/${equipeId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const funilData = await funilRes.json();

      setFunis(funilData);
      const firstFunilId = funilData[0]?.id;

      if (!firstFunilId) {
        console.warn("Nenhum funil encontrado para a equipe.");
        setColumns({});
        setIsLoading(false); // Para quando não há funis
        return;
      }

      setFunilSelecionado(firstFunilId);
      setFunilId(firstFunilId);
      loadFunilContent(firstFunilId); // 🔁 nova função que vamos criar
      try {
        // Carregar fases do funil para o modal de importação
        const fasesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/funil_fases/${firstFunilId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const fasesData = await fasesRes.json();
        setFasesDoFunil(Array.isArray(fasesData) ? fasesData : []);
      } catch (e) {
        setFasesDoFunil([]);
      }
      // Removido setIsLoading(false) daqui - será chamado apenas no loadFunilContent

    } catch (error) {
      console.error('Erro ao buscar dados do CRM:', error);
      setIsLoading(false); // Garante que o loading pare em caso de erro
    }
  };


  const loadFunilContent = async (fId) => {
    try {
      const token = localStorage.getItem("token");
      const user = JSON.parse(localStorage.getItem('user'));
      const equipeId = user.equipe_id;

      // 🔵 Nova rota consolidada que retorna funil, fases e leads em uma única chamada
      const crmRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/crm/${equipeId}/${fId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!crmRes.ok) {
        throw new Error(`Erro ao carregar dados do CRM: ${crmRes.status}`);
      }

      const crmData = await crmRes.json();
      const { funil, fases, contagem } = crmData;

      // Mapa de atividades pendentes por lead
      const allLeadIds = fases.flatMap(f => (f.leads || []).map(l => l.id));
      const pendingMap = await getPendingActivitiesMap(allLeadIds, token);

      // Verifica se há fases antes de continuar
      if (!fases || fases.length === 0) {
        console.warn("Nenhuma fase encontrada para o funil.");
        setColumns({});
        setOrderedColumnIds([]);
        setIsLoading(false);
        return;
      }

      // Monta as colunas com os dados já organizados
      const newColumns = {};
      fases.forEach((fase) => {
        // Adiciona o nome da fase a cada lead para compatibilidade com o código existente
        const leadsComFase = (fase.leads || []).map(lead => ({
          ...lead,
          fase_nome: fase.nome,
          hasPendingActivity: pendingMap[lead.id] || false
        }));
        
        newColumns[fase.id] = {
          title: fase.nome,
          cards: leadsComFase,
        };
      });

      setColumns(newColumns);
      setFunilId(fId);
      setOrderedColumnIds(fases.map((fase) => fase.id));
      
      console.log('✅ Funil carregado via rota consolidada:', { 
        funil: funil.nome,
        fases: fases.length, 
        totalLeads: contagem.total,
        contagemPorFase: contagem.por_fase
      });
      
      setIsLoading(false);
    } catch (error) {
      console.error("Erro ao carregar conteúdo do funil:", error);
      setIsLoading(false);
    }
  };

  // Busca se cada lead possui atividade pendente
  async function getPendingActivitiesMap(leadIds, token) {
    if (!leadIds || leadIds.length === 0) return {};
    const uniqueIds = Array.from(new Set(leadIds));
    const results = await Promise.all(uniqueIds.map(async (id) => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/atividades/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        const hasPending = Array.isArray(data) && data.some(a => a.status === 'pendente');
        return [id, hasPending];
      } catch (e) {
        return [id, false];
      }
    }));
    return Object.fromEntries(results);
  }


  useEffect(() => {
    if (funilSelecionado) {
      setIsLoading(true); // Exibe o spinner ao trocar de funil
      loadFunilContent(funilSelecionado);
      (async () => {
        try {
          const token = localStorage.getItem('token');
          const fasesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/funil_fases/${funilSelecionado}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const fasesData = await fasesRes.json();
          setFasesDoFunil(Array.isArray(fasesData) ? fasesData : []);
        } catch (e) {
          setFasesDoFunil([]);
        }
      })();
    }
  }, [funilSelecionado]);

  // Buscar membros da equipe ao carregar teamId
  useEffect(() => {
    async function fetchMembrosEquipe() {
      if (!teamId) return;
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user_equipes/${teamId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Erro ao buscar membros da equipe');
        const data = await res.json();
        setMembrosEquipe(Array.isArray(data) ? data : []);
      } catch (err) {
        setMembrosEquipe([]);
        console.error('Erro ao buscar membros da equipe:', err);
      }
    }
    fetchMembrosEquipe();
  }, [teamId]);

  const handleDragStart = (event) => {
    const { active } = event;
    // Procure o card pelo id
    const cardId = active.id;
    let foundCard = null;
    Object.values(columns).forEach(col => {
      const card = col.cards.find(c => c.id === cardId);
      if (card) foundCard = card;
    });
    setActiveCard(foundCard);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeCardId = active.id;
    let sourceColId, destColId;

    // Encontrar a coluna de origem e destino
    for (const [colId, col] of Object.entries(columns)) {
      if (col.cards.find((card) => card.id === activeCardId)) {
        sourceColId = colId;
      }
      if (colId === over.id || col.cards.find((card) => card.id === over.id)) {
        destColId = colId;
      }
    }

    if (!sourceColId || !destColId || sourceColId === destColId) return;

    const activeCard = columns[sourceColId].cards.find((c) => c.id === activeCardId);

    try {
      const token = localStorage.getItem('token');

      // 🔵 Atualizar fase no backend
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/leads/${activeCardId}/mover-fase`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ fase_funil_id: parseInt(destColId) }),
      });

      // ⬇️ Registrar movimentação
      await registrarHistorico({
        lead_id: activeCardId,
        usuario_id: JSON.parse(localStorage.getItem("user"))?.id,
        tipo: "movimentacao",
        titulo: "Lead movido de fase",
        descricao: `Lead movido de "${columns[sourceColId].title}" para "${columns[destColId].title}"`,
        token,
      });

      if (columns[destColId]?.title.toLowerCase() === "proposta") {
        const leadSelecionado = activeCard;

        setTimeout(() => {
          router.push({
            pathname: "/criar-contrato-autentique",
            query: {
              nome: leadSelecionado.name,
              email: leadSelecionado.email,
              telefone: leadSelecionado.telefone,
              lead_id: leadSelecionado.id,
              valor: leadSelecionado.valor
            }
          });
        }, 2000);
      }



      // 🟢 Atualizar frontend
      setColumns((prev) => {
        const sourceCards = prev[sourceColId].cards.filter((c) => c.id !== activeCardId);
        const destCards = [...prev[destColId].cards, { ...activeCard }];

        return {
          ...prev,
          [sourceColId]: { ...prev[sourceColId], cards: sourceCards },
          [destColId]: { ...prev[destColId], cards: destCards },
        };
      });
    } catch (error) {
      console.error('Erro ao mover fase do lead:', error);
    }
    setActiveCard(null);
  };

  const handleDragCancel = () => {
    setActiveCard(null);
  };

  const handleEdit = (card, columnId) => {
    setSelectedCard(card);
    setSelectedColumnId(columnId);
    setModalOpen(true);
  };

  const handleSaveCard = async (updatedCard) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/leads/${updatedCard.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: updatedCard.name,
          email: updatedCard.email,
          telefone: updatedCard.telefone,
          team_id: teamId,
          funil_id: funilId,
          fase_funil_id: parseInt(selectedColumnId),
          valor: updatedCard.valor || 0,
          data_prevista: updatedCard.dataPrevista || null,
          status: updatedCard.status || 'aberto'
        }),

      });

      // Se sucesso, atualiza o frontend também
      setColumns((prevCols) => {
        const newCols = { ...prevCols };
        newCols[selectedColumnId].cards = newCols[selectedColumnId].cards.map((card) =>
          card.id === updatedCard.id ? updatedCard : card
        );
        return newCols;
      });
      setModalOpen(false);
    } catch (error) {
      console.error('Erro ao atualizar lead:', error);
    }
  };


  const handleAddCard = (columnId, cardData) => {
    const faseId = parseInt(columnId);
    setColumns((prev) => {
      return {
        ...prev,
        [faseId]: {
          ...prev[faseId],
          cards: [...prev[faseId].cards, cardData],
        }
      };
    });
  };

  // Handler para checkboxes de responsáveis
  const handleResponsavelChange = (userId) => {
    if (userId === 'todos') {
      setResponsaveisSelecionados(['todos']);
    } else {
      setResponsaveisSelecionados((prev) => {
        const novo = prev.includes(userId)
          ? prev.filter((id) => id !== userId)
          : [...prev.filter((id) => id !== 'todos'), userId];
        return novo.length === 0 ? ['todos'] : novo;
      });
    }
  };

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownAberto(false);
      }
    }
    if (dropdownAberto) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownAberto]);

  // Fechar dropdown de funil ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownFunilRef.current && !dropdownFunilRef.current.contains(event.target)) {
        setDropdownFunilAberto(false);
      }
    }
    if (dropdownFunilAberto) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownFunilAberto]);

  // Função para verificar se há leads visíveis após aplicar filtros
  const hasVisibleLeads = () => {
    return Object.values(columns).some(col => 
      col.cards.some(card => {
        const nomeMatch = card.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const responsavelMatch =
          responsaveisSelecionados.includes('todos') ||
          (card.user_id && responsaveisSelecionados.includes(card.user_id.toString()));
        return nomeMatch && responsavelMatch;
      })
    );
  };

  return (
    <>
    <div className={styles.page}>
      <PrincipalSidebar />
    {!isLoading && (funis.length === 0 || !funilSelecionado) ? (
        <p className={styles.warningText}>
          Nenhum funil encontrado.<br />
          Adicione o seu funil em <b>Configurações &gt; Funis</b>.
        </p>
      ) : (
        <>
          <div className={styles.pageContent}>
          <div className={styles.headerRow}>
            <h1 className={styles.title}>CRM</h1>

            {/* Filtro de responsáveis como dropdown */}
            <div className={styles.responsavelDropdownWrapper} ref={dropdownRef}>
              <button
                className={styles.responsavelDropdownBtn}
                type="button"
                onClick={() => setDropdownAberto((prev) => !prev)}
              >
                <span className={styles.responsavelLabel}>Responsável</span>
                <span className={styles.responsavelDropdownIcon}>
                  <FontAwesomeIcon icon={dropdownAberto ? faChevronUp : faChevronDown} />
                </span>
              </button>
              {dropdownAberto && (
                <div className={styles.responsavelDropdownMenu}>
                  <label>
                    <input
                      type="checkbox"
                      checked={responsaveisSelecionados.includes('todos')}
                      onChange={() => handleResponsavelChange('todos')}
                    />
                    Todos
                  </label>
                  {membrosEquipe
                    .filter((m) => m.role !== 'superadmin')
                    .map((m) => (
                      <label key={m.userId}>
                        <input
                          type="checkbox"
                          checked={responsaveisSelecionados.includes(m.userId.toString())}
                          onChange={() => handleResponsavelChange(m.userId.toString())}
                        />
                        {m.full_name}
                      </label>
                    ))}
                </div>
              )}
            </div>
            <div className={styles.responsavelDropdownWrapper} ref={dropdownFunilRef}>
              <button
                className={styles.responsavelDropdownBtn}
                type="button"
                onClick={() => setDropdownFunilAberto((prev) => !prev)}
              >
                <span className={styles.funilLabel}>Funil</span>
                <span className={styles.funilNome}>
                  {funis.find(f => f.id === funilSelecionado)?.nome || 'Selecionar'}
                </span>
                <span className={styles.responsavelDropdownIcon}>
                  <FontAwesomeIcon icon={dropdownFunilAberto ? faChevronUp : faChevronDown} />
                </span>
              </button>
              {dropdownFunilAberto && (
                <div className={styles.responsavelDropdownMenu + ' ' + styles.funilDropdownMenu}>
                  {funis.map((f) => (
                    <button
                      key={f.id}
                      className={
                        (f.id === funilSelecionado ? styles.activeTab : '') + ' ' +
                        (f.id === funilSelecionado ? styles.funilTabActive : styles.funilTab)
                      }
                      onClick={() => {
                        setFunilSelecionado(f.id);
                        setDropdownFunilAberto(false);
                      }}
                    >
                      {f.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.searchContainer}>
              <FontAwesomeIcon icon={faSearch} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Buscar por nome..."
                className={styles.searchInput}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className={styles.exportContainer}>
              <button
                className={styles.toolsToggleBtn}
                type="button"
                title="Ferramentas"
                onClick={() => setShowToolsDrawer(true)}
              >
                <FontAwesomeIcon icon={faBars} />
              </button>
            </div>

            {/* Botões de alternância de visualização */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className={`${styles.viewToggleBtn} ${viewMode === 'crm' ? styles.viewToggleActive : ''}`}
                onClick={() => setViewMode('crm')}
                title="Visualização Kanban"
              >
                <FontAwesomeIcon icon={faThLarge} />
              </button>
              <button
                type="button"
                className={`${styles.viewToggleBtn} ${viewMode === 'lista' ? styles.viewToggleActive : ''}`}
                onClick={() => setViewMode('lista')}
                title="Visualização em lista"
              >
                <FontAwesomeIcon icon={faList} />
              </button>
            </div>
          </div>



        {isLoading ? (
          <SpaceLoader label="Carregando leads e funil..." />
        ) : Object.keys(columns).length === 0 || orderedColumnIds.length === 0 ? (
          <SpaceLoader label="Carregando colunas..." />
        ) : !hasVisibleLeads() ? (
            <div className={styles.emptyStateContainer}>
              <div className={styles.emptyStateContent}>
                <h3 className={styles.emptyStateTitle}>Nenhum lead encontrado</h3>
                <p className={styles.emptyStateDescription}>
                  {searchTerm || responsaveisSelecionados.length > 0 ? 
                    "Nenhum lead encontrado com os filtros aplicados. Tente ajustar os filtros ou criar um novo lead." :
                    "Comece criando seu primeiro lead clicando no botão \"+\" no canto inferior direito."
                  }
                </p>
                <div className={styles.emptyStateIcon}>
                  <FontAwesomeIcon icon={faPlus} />
                </div>
              </div>
            </div>
          ) : (
            viewMode === 'crm' ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                <div className={styles.crmContainer}>
                  <SortableContext
                    items={Object.values(columns).flatMap((col) => col.cards.map((card) => card.id))}
                    strategy={verticalListSortingStrategy}
                  >
                    {Object.entries(columns)
                      .sort(([aId], [bId]) => {
                        return orderedColumnIds.indexOf(parseInt(aId)) - orderedColumnIds.indexOf(parseInt(bId));
                      })
                      .map(([columnId, column]) => (
                        <Column
                          key={columnId}
                          id={columnId}
                          title={column.title}
                          cards={column.cards.filter(card => {
                            // Filtro por nome
                            const nomeMatch = card.name?.toLowerCase().includes(searchTerm.toLowerCase());
                            // Filtro por responsável
                            const responsavelMatch =
                              responsaveisSelecionados.includes('todos') ||
                              (card.user_id && responsaveisSelecionados.includes(card.user_id.toString()));
                            return nomeMatch && responsavelMatch;
                          })}
                          onEdit={(card) => handleEdit(card, columnId)}
                        />
                      ))}

                  </SortableContext>
                </div>
                <DragOverlay>
                  {activeCard ? (
                    <CRMCard data={activeCard} />
                  ) : null}
                </DragOverlay>
              </DndContext>
            ) : (
              <ListView
                columns={columns}
                orderedColumnIds={orderedColumnIds}
                searchTerm={searchTerm}
                responsaveisSelecionados={responsaveisSelecionados}
                onEdit={handleEdit}
              />
            )
          )}


          <button className={styles.floatingBtn} onClick={() => setShowCreateModal(true)}>
            +
          </button>

          <CreateCardModal
            open={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onCreate={handleAddCard}
            columnOptions={Object.entries(columns).map(([id, col]) => ({
              id,
              title: col.title,
            }))}
            teamId={teamId}
            funilId={funilId}
          />

          <EditCardModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onSave={handleSaveCard}
            initialData={selectedCard}
          />
          {showToolsDrawer && (
            <>
              <div className={styles.toolsDrawerBackdrop} onClick={() => setShowToolsDrawer(false)} />
              <div className={styles.toolsDrawer}>
                <div className={styles.toolsDrawerHeader}>
                  <h3 style={{ margin: 0 }}>Ferramentas</h3>
                  <button className={styles.viewToggleBtn} onClick={() => setShowToolsDrawer(false)}>✕</button>
                </div>
                <div className={styles.toolsDrawerContent}>
                  <button
                    className={styles.exportBtn}
                    onClick={() => { setShowImportModal(true); setShowToolsDrawer(false); }}
                    disabled={!funilSelecionado || isLoading}
                  >
                    Importar Leads
                  </button>
                  <button
                    className={styles.exportBtn}
                    onClick={() => { setShowExportModal(true); setShowToolsDrawer(false); }}
                    disabled={!funilSelecionado || isLoading}
                  >
                    Exportar Leads
                  </button>
                </div>
              </div>
            </>
          )}
          <ImportLeadsModal
            open={showImportModal}
            onClose={() => setShowImportModal(false)}
            teamId={teamId}
            funis={funis}
            funilSelecionado={funilSelecionado}
            fases={fasesDoFunil}
            membrosEquipe={membrosEquipe}
            onImported={({ funilId }) => {
              setIsLoading(true);
              loadFunilContent(funilId || funilSelecionado).then(() => setIsLoading(false));
            }}
          />
          <ExportLeadsModal
            open={showExportModal}
            onClose={() => setShowExportModal(false)}
            teamId={teamId}
            funis={funis}
            defaultFunilId={funilSelecionado}
          />
          </div>
        </>
      )}
    </div>
    </>
  );
}

function ListView({ columns, orderedColumnIds, searchTerm, responsaveisSelecionados, onEdit }) {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Junta todos os cards de todas as colunas
  const allCards = orderedColumnIds
    .map(colId => columns[colId]?.cards || [])
    .flat();

  // Aplica filtros
  const filteredCards = allCards.filter(card => {
    const nomeMatch = card.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const responsavelMatch =
      responsaveisSelecionados.includes('todos') ||
      (card.user_id && responsaveisSelecionados.includes(card.user_id.toString()));
    return nomeMatch && responsavelMatch;
  });

  // Paginação
  const totalPages = Math.ceil(filteredCards.length / itemsPerPage);
  const paginatedCards = filteredCards.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Função para renderizar o ícone de temperatura
  function renderTemperaturaIcon(card) {
    if (card.hasPendingActivity) {
      return <FontAwesomeIcon icon={faCalendar} style={{ color: '#F4B400', fontSize: 20 }} title="Atividade pendente" />;
    }
    if (card.temperatura === 'frio') {
      return <FontAwesomeIcon icon={faSnowflake} style={{ color: '#2563eb', fontSize: 20 }} title="Lead Frio" />;
    }
    if (card.temperatura === 'quente') {
      return <FontAwesomeIcon icon={faFire} style={{ color: '#f44', fontSize: 20 }} title="Lead Quente" />;
    }
    // Default ou morno
    return <FontAwesomeIcon icon={faInfoCircle} style={{ color: '#aaa', fontSize: 20 }} title="Lead Neutro" />;
  }

  return (
    <div className={styles.listViewContainer}>
      <table className={styles.listViewTable}>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Responsável</th>
            <th>Fase</th>
            <th>Valor</th>
            <th>Temperatura</th>

          </tr>
        </thead>
        <tbody>
          {paginatedCards.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <FontAwesomeIcon icon={faPlus} style={{ fontSize: 24, color: '#3498db', opacity: 0.7 }} />
                  <div>
                    <strong style={{ fontSize: 16, color: '#2c3e50' }}>Nenhum lead encontrado</strong>
                    <br />
                    <span style={{ fontSize: 14, color: '#7f8c8d' }}>
                      {searchTerm || responsaveisSelecionados.length > 0 ? 
                        "Nenhum lead encontrado com os filtros aplicados." :
                        "Comece criando seu primeiro lead clicando no botão \"+\" no canto inferior direito."
                      }
                    </span>
                  </div>
                </div>
              </td>
            </tr>
          ) : (
            paginatedCards.map(card => (
              <tr key={card.id}>
                <td>
                  <span style={{ marginRight: 8 }}>
                    {card.fase_nome?.toLowerCase() === 'ganhou' ? (
                      <FontAwesomeIcon icon={faThumbsUp} style={{ color: '#18c964', fontSize: 16 }} title="Lead Ganhou" />
                    ) : card.fase_nome?.toLowerCase() === 'perdeu' ? (
                      <FontAwesomeIcon icon={faThumbsDown} style={{ color: '#f44', fontSize: 16 }} title="Lead Perdeu" />
                    ) : (
                      <FontAwesomeIcon icon={faBriefcase} style={{ color: '#007bff', fontSize: 16 }} title="Lead em andamento" />
                    )}
                  </span>
                  <span
                    className={styles.leadNameLink}
                    onClick={() => router.push(`/leads/${card.id}`)}
                    style={{
                      color:
                        card.fase_nome?.toLowerCase() === 'ganhou'
                          ? '#18c964'
                          : card.fase_nome?.toLowerCase() === 'perdeu'
                            ? '#f44'
                            : '#007bff',
                    }}
                  >
                    {card.name}
                  </span>
                </td>
                <td>{card.responsavel_nome || '-'}</td>
                <td
                  className={
                    card.fase_nome?.toLowerCase() === 'ganhou'
                      ? styles.faseGanhou
                      : card.fase_nome?.toLowerCase() === 'perdeu'
                        ? styles.fasePerdeu
                        : card.fase_nome?.toLowerCase() === 'proposta'
                          ? styles.faseProposta
                          : ''
                  }
                >
                  {card.fase_nome || '-'}
                </td>
                <td>{card.valor ? `R$ ${Number(card.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</td>
                <td>{renderTemperaturaIcon(card)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {totalPages > 1 && (
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
    </div>

  );
}

