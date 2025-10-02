import { useState, useEffect } from 'react';
import styles from './Equipes.module.css';
import { Users, Plus, Search, RefreshCw, ChevronLeft, ChevronRight, Edit } from 'lucide-react';
import CreateTeamModal from './CreateTeamModal';

export default function Equipes() {
  const [equipes, setEquipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(6);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [availableInstances, setAvailableInstances] = useState([]);
  const [teamInstances, setTeamInstances] = useState({});
  const [teamUserCounts, setTeamUserCounts] = useState({});
  const [userRole, setUserRole] = useState(null);

  // Verificar se os dados necessários estão disponíveis
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const companyId = userData.companyId;
    setUserRole(userData.userRole || null);
    
    if (!token) {
      setError('Token de autenticação não encontrado. Faça login novamente.');
      setLoading(false);
      return;
    }
    
    if (!companyId) {
      setError('ID da empresa não encontrado. Faça login novamente.');
      setLoading(false);
      return;
    }
    
    // Carregar dados
    fetchEquipes();
    fetchAvailableInstances();
  }, []);

  const fetchEquipes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('URL da API não configurada.');
      }
      
      const companyId = JSON.parse(localStorage.getItem('userData') || '{}').companyId;
      const url = companyId ? `${apiUrl}/teams?company_id=${companyId}` : `${apiUrl}/teams`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar equipes');
      }

      const data = await response.json();
      setEquipes(data);
      
      // Buscar vínculos das instâncias e contagem de usuários para cada equipe
      if (data.length > 0) {
        await fetchTeamInstances(data);
        await fetchTeamUserCounts(data);
      }
    } catch (err) {
      console.error('Erro ao buscar equipes:', err);
      setError('Erro ao carregar equipes. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableInstances = async () => {
    try {
      const token = localStorage.getItem('token');
      const companyId = JSON.parse(localStorage.getItem('userData') || '{}').companyId;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      if (!token || !companyId || !apiUrl) return;

      const response = await fetch(`${apiUrl}/instances/company/${companyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const instances = await response.json();
        setAvailableInstances(instances);
      }
    } catch (err) {
      console.error('Erro ao buscar instâncias:', err);
    }
  };

  const fetchTeamInstances = async (teams) => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      if (!token || !apiUrl) return;

      const teamInstancesData = {};
      
      // Buscar vínculos para cada equipe
      for (const team of teams) {
        try {
          const response = await fetch(`${apiUrl}/team-instances/team/${team.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const instances = await response.json();
            teamInstancesData[team.id] = instances;
          } else {
            teamInstancesData[team.id] = [];
          }
        } catch (err) {
          console.error(`Erro ao buscar instâncias da equipe ${team.id}:`, err);
          teamInstancesData[team.id] = [];
        }
      }
      
      setTeamInstances(teamInstancesData);
    } catch (err) {
      console.error('Erro ao buscar vínculos das equipes:', err);
    }
  };

  const fetchTeamUserCounts = async (teams) => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      if (!token || !apiUrl) return;

      const teamUserCountsData = {};
      
      // Buscar contagem de usuários para cada equipe
      for (const team of teams) {
        try {
          const response = await fetch(`${apiUrl}/team-users/team/${team.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const teamUsers = await response.json();
            teamUserCountsData[team.id] = teamUsers.length;
          } else {
            teamUserCountsData[team.id] = 0;
          }
        } catch (err) {
          console.error(`Erro ao buscar usuários da equipe ${team.id}:`, err);
          teamUserCountsData[team.id] = 0;
        }
      }
      
      setTeamUserCounts(teamUserCountsData);
    } catch (err) {
      console.error('Erro ao buscar contagem de usuários das equipes:', err);
    }
  };

  const handleCreateSuccess = async (teamData) => {
    if (editingTeam) {
      // Atualizar equipe existente
      setEquipes(prev => prev.map(equipe => 
        equipe.id === editingTeam.id 
          ? { ...equipe, ...teamData }
          : equipe
      ));
      setSuccessMessage(`Equipe "${teamData.nome}" atualizada com sucesso!`);
    } else {
      // Adicionar nova equipe à lista com contagem de usuários
      const teamWithUsers = { ...teamData, usuarios: 0 };
      setEquipes(prev => [...prev, teamWithUsers]);
      setSuccessMessage(`Equipe "${teamData.nome}" criada com sucesso!`);
    }
    
    // Recarregar vínculos das instâncias e contagem de usuários
    const currentEquipes = editingTeam 
      ? equipes.map(equipe => equipe.id === editingTeam.id ? { ...equipe, ...teamData } : equipe)
      : [...equipes, teamData];
    await fetchTeamInstances(currentEquipes);
    await fetchTeamUserCounts(currentEquipes);
    
    // Limpar mensagem após 3 segundos
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  const handleOpenCreateModal = () => {
    setEditingTeam(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (equipe) => {
    setEditingTeam(equipe);
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setEditingTeam(null);
  };

  // Função para gerar iniciais do nome da equipe
  const getInitials = (nome) => {
    return nome
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Função para agrupar equipes por letra inicial
  const groupEquipesByLetter = (equipes) => {
    const grouped = {};
    equipes.forEach(equipe => {
      const firstLetter = equipe.nome.charAt(0).toUpperCase();
      if (!grouped[firstLetter]) {
        grouped[firstLetter] = [];
      }
      grouped[firstLetter].push(equipe);
    });
    return grouped;
  };

  // Filtrar equipes baseado na busca e canal (instância)
  const filteredEquipes = equipes.filter(equipe => {
    const matchesSearch = equipe.nome.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!filterChannel) {
      return matchesSearch;
    }
    
    // Filtrar por instância específica
    const equipeInstances = teamInstances[equipe.id] || [];
    const hasInstance = equipeInstances.some(instance => 
      instance.whatsapp_instance_id.toString() === filterChannel
    );
    
    return matchesSearch && hasInstance;
  });

  // Agrupar equipes filtradas
  const groupedEquipes = groupEquipesByLetter(filteredEquipes);

  // Calcular paginação
  const totalItems = filteredEquipes.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  // Pegar apenas as equipes da página atual
  const currentEquipes = filteredEquipes.slice(startIndex, endIndex);
  const currentGroupedEquipes = groupEquipesByLetter(currentEquipes);

  const renderEquipeItem = (equipe) => (
    <div key={equipe.id} className={styles.equipeItem}>
      <div className={styles.equipeIcon}>
        {getInitials(equipe.nome)}
      </div>
      <div className={styles.equipeInfo}>
        <span className={styles.equipeNome}>{equipe.nome}</span>
        <span className={styles.equipeUsuarios}>
          {teamUserCounts[equipe.id] || 0} usuários
        </span>
      </div>
      <div className={styles.equipeActions}>
        {equipe.padrao === 1 && (
          <div className={styles.padraoTag}>Padrão</div>
        )}
        {(userRole === 'Administrador' || userRole === 'Superadmin') && (
          <button 
            className={styles.editButton}
            onClick={() => handleOpenEditModal(equipe)}
            title="Editar equipe"
          >
            <Edit size={16} />
          </button>
        )}
      </div>
    </div>
  );

  const renderLetterGroup = (letter, equipes) => (
    <div key={letter} className={styles.letterGroup}>
      <div className={styles.letterHeader}>{letter}</div>
      <div className={styles.equipesList}>
        {equipes.map(renderEquipeItem)}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Carregando equipes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Equipes</h1>
        <div className={styles.headerStats}>
          {totalItems} equipes encontradas
        </div>
      </div>

      {/* Barra de busca e filtros */}
      <div className={styles.searchBar}>
        <div className={styles.searchInput}>
          <Search size={20} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Pesquisar"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.input}
          />
        </div>
        <div className={styles.filterSelect}>
          <select
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
            className={styles.select}
          >
            <option value="">Todos os canais</option>
            {availableInstances.map((instance) => (
              <option key={instance.id} value={instance.id}>
                {instance.phone_number ? 
                  `(${instance.phone_number}) - ${instance.instance_name}` : 
                  `- Instância ${instance.instance_name || instance.instance_id}`
                }
              </option>
            ))}
          </select>
        </div>
        <div className={styles.headerActions}>
          {(userRole === 'Administrador' || userRole === 'Superadmin') && (
            <button 
              className={styles.newButton}
              onClick={handleOpenCreateModal}
            >
              <Plus size={20} />
              Novo
            </button>
          )}
          <button 
            className={styles.refreshButton}
            onClick={() => {
              fetchEquipes();
              fetchAvailableInstances();
            }}
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* Mensagens de erro e sucesso */}
      {error && (
        <div className={styles.errorMessage}>
          <span>⚠️</span>
          <div className={styles.errorContent}>
            <p>{error}</p>
            <button 
              onClick={() => {
                setError(null);
                fetchEquipes();
              }}
              className={styles.retryButton}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {successMessage && (
        <div className={styles.successMessage}>
          <span>✅</span>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Lista de equipes */}
      <div className={styles.equipesContainer}>
        {Object.keys(currentGroupedEquipes).length === 0 ? (
          <div className={styles.emptyState}>
            <Users size={48} className={styles.emptyIcon} />
            <p>Nenhuma equipe encontrada</p>
            {(userRole === 'Administrador' || userRole === 'Superadmin') && (
              <button 
                className={styles.createFirstButton}
                onClick={handleOpenCreateModal}
              >
                <Plus size={20} />
                Criar primeira equipe
              </button>
            )}
          </div>
        ) : (
          Object.entries(currentGroupedEquipes)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([letter, equipes]) => renderLetterGroup(letter, equipes))
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.paginationButton}
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className={styles.paginationInfo}>
            {startIndex + 1}-{Math.min(endIndex, totalItems)} de {totalItems}
          </div>
          
          <button
            className={styles.paginationButton}
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {/* Modal de criação/edição */}
      <CreateTeamModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onSuccess={handleCreateSuccess}
        editTeam={editingTeam}
      />
    </div>
  );
}
