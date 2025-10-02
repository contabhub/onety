import { useState, useEffect } from 'react';
import { X, Users, User, ArrowRight, Smartphone } from 'lucide-react';
import axios from 'axios';
import styles from './TransferModal.module.css';

export default function TransferModal({ isOpen, onClose, conversation, onTransferSuccess }) {
  const [activeTab, setActiveTab] = useState('team'); // 'team' ou 'person'
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [teamInstances, setTeamInstances] = useState([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [transferring, setTransferring] = useState(false);

  // Buscar equipes da empresa
  const fetchTeams = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const companyId = JSON.parse(localStorage.getItem('userData') || '{}').companyId;
      
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/teams?company_id=${companyId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setTeams(response.data);
    } catch (error) {
      console.error('Erro ao buscar equipes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Buscar usuários da empresa
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const companyId = JSON.parse(localStorage.getItem('userData') || '{}').companyId;
      
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/users/company/${companyId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    } finally {
      setLoading(false);
    }
  };

  // Buscar instâncias WhatsApp de uma equipe
  const fetchTeamInstances = async (teamId) => {
    try {
      setLoadingInstances(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/team-instances/team/${teamId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setTeamInstances(response.data);
      // Se houver apenas uma instância, seleciona automaticamente
      if (response.data.length === 1) {
        setSelectedInstance(response.data[0]);
      } else {
        setSelectedInstance(null);
      }
    } catch (error) {
      console.error('Erro ao buscar instâncias da equipe:', error);
      setTeamInstances([]);
      setSelectedInstance(null);
    } finally {
      setLoadingInstances(false);
    }
  };

  // Carregar dados quando o modal abrir
  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'team') {
        fetchTeams();
      } else {
        fetchUsers();
      }
      setSelectedTeam(null);
      setSelectedUser(null);
      setSelectedInstance(null);
      setTeamInstances([]);
    }
  }, [isOpen, activeTab]);

  // Quando uma equipe for selecionada, buscar suas instâncias
  useEffect(() => {
    if (selectedTeam) {
      fetchTeamInstances(selectedTeam.id);
    } else {
      setTeamInstances([]);
      setSelectedInstance(null);
    }
  }, [selectedTeam]);

  // Transferir para equipe
  const transferToTeam = async () => {
    if (!selectedTeam || !selectedInstance) return;

    try {
      setTransferring(true);
      const token = localStorage.getItem('token');
      
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/conversations/${conversation.conversation_id}/transfer/team`,
        {
          team_id: selectedTeam.id,
          team_whatsapp_instance_id: selectedInstance.id,
          remove_assigned_user: true
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Atualizar conversa local
      const updatedConversation = {
        ...conversation,
        assigned_user_id: null,
        team_name: selectedTeam.nome,
        team_whatsapp_instance_id: selectedInstance.id
      };

      onTransferSuccess(updatedConversation);
      onClose();
    } catch (error) {
      console.error('Erro ao transferir para equipe:', error);
      alert('Erro ao transferir conversa para a equipe');
    } finally {
      setTransferring(false);
    }
  };

  // Transferir para pessoa
  const transferToPerson = async () => {
    if (!selectedUser) return;

    try {
      setTransferring(true);
      const token = localStorage.getItem('token');
      
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/conversations/${conversation.conversation_id}/transfer/user`,
        {
          assigned_user_id: selectedUser.id
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Atualizar conversa local
      const updatedConversation = {
        ...conversation,
        assigned_user_id: selectedUser.id,
        assigned_user_name: selectedUser.nome || selectedUser.apelido
      };

      onTransferSuccess(updatedConversation);
      onClose();
    } catch (error) {
      console.error('Erro ao transferir para usuário:', error);
      alert('Erro ao transferir conversa para o usuário');
    } finally {
      setTransferring(false);
    }
  };

  // Executar transferência baseada na aba ativa
  const handleTransfer = () => {
    if (activeTab === 'team') {
      transferToTeam();
    } else {
      transferToPerson();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Cabeçalho */}
        <div className={styles.header}>
          <h2 className={styles.title}>Transferir</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            disabled={transferring}
          >
            <X size={20} />
          </button>
        </div>

        {/* Abas */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'team' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('team')}
            disabled={transferring}
          >
            Para uma equipe
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'person' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('person')}
            disabled={transferring}
          >
            Para uma pessoa
          </button>
        </div>

        {/* Conteúdo */}
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Carregando...</p>
            </div>
          ) : (
            <>
              {/* Lista de equipes */}
              {activeTab === 'team' && (
                <div className={styles.teamSection}>
                  {/* Seleção de equipe */}
                  <div className={styles.sectionTitle}>Selecione uma equipe:</div>
                  <div className={styles.list}>
                    {teams.length === 0 ? (
                      <p className={styles.emptyMessage}>Nenhuma equipe encontrada</p>
                    ) : (
                      teams.map((team) => (
                        <div
                          key={team.id}
                          className={`${styles.item} ${selectedTeam?.id === team.id ? styles.selectedItem : ''}`}
                          onClick={() => setSelectedTeam(team)}
                        >
                          <div className={styles.itemIcon}>
                            <div className={styles.teamInitials}>
                              {team.nome.substring(0, 2).toUpperCase()}
                            </div>
                          </div>
                          <div className={styles.itemInfo}>
                            <span className={styles.itemName}>{team.nome}</span>
                            {team.usuarios > 0 && (
                              <span className={styles.itemDetail}>
                                {team.usuarios} {team.usuarios === 1 ? 'usuário' : 'usuários'}
                              </span>
                            )}
                          </div>
                          {team.padrao && (
                            <span className={styles.defaultBadge}>Equipe atual</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Seleção de instância WhatsApp */}
                  {selectedTeam && (
                    <div className={styles.instanceSection}>
                      <div className={styles.sectionTitle}>Selecione uma instância WhatsApp:</div>
                      {loadingInstances ? (
                        <div className={styles.loading}>
                          <div className={styles.spinner}></div>
                          <p>Carregando instâncias...</p>
                        </div>
                      ) : (
                        <div className={styles.list}>
                          {teamInstances.length === 0 ? (
                            <p className={styles.emptyMessage}>
                              Esta equipe não possui instâncias WhatsApp vinculadas
                            </p>
                          ) : (
                            teamInstances.map((instance) => (
                              <div
                                key={instance.id}
                                className={`${styles.item} ${selectedInstance?.id === instance.id ? styles.selectedItem : ''}`}
                                onClick={() => setSelectedInstance(instance)}
                              >
                                <div className={styles.itemIcon}>
                                  <Smartphone size={20} />
                                </div>
                                <div className={styles.itemInfo}>
                                  <span className={styles.itemName}>
                                    {instance.instance_name || `Instância ${instance.whatsapp_instance_id}`}
                                  </span>
                                  <span className={styles.itemDetail}>
                                    {instance.phone_number}
                                  </span>
                                  {instance.status && (
                                    <span className={`${styles.statusBadge} ${styles[instance.status]}`}>
                                      {instance.status}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Lista de usuários */}
              {activeTab === 'person' && (
                <div className={styles.list}>
                  {users.length === 0 ? (
                    <p className={styles.emptyMessage}>Nenhum usuário encontrado</p>
                  ) : (
                    users.map((user) => (
                      <div
                        key={user.id}
                        className={`${styles.item} ${selectedUser?.id === user.id ? styles.selectedItem : ''}`}
                        onClick={() => setSelectedUser(user)}
                      >
                        <div className={styles.itemIcon}>
                          <div className={styles.userInitials}>
                            {(user.nome || user.apelido || user.email || 'U')[0].toUpperCase()}
                          </div>
                        </div>
                        <div className={styles.itemInfo}>
                          <span className={styles.itemName}>
                            {user.nome || user.apelido || user.email}
                          </span>
                          {user.email && user.nome && (
                            <span className={styles.itemDetail}>{user.email}</span>
                          )}
                        </div>
                        {user.is_admin && (
                          <span className={styles.adminBadge}>Admin</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodapé */}
        <div className={styles.footer}>
          <button
            className={styles.cancelButton}
            onClick={onClose}
            disabled={transferring}
          >
            Cancelar
          </button>
          <button
            className={styles.transferButton}
            onClick={handleTransfer}
            disabled={
              transferring ||
              (activeTab === 'team' && (!selectedTeam || !selectedInstance)) ||
              (activeTab === 'person' && !selectedUser)
            }
          >
            {transferring ? (
              <>
                <div className={styles.buttonSpinner}></div>
                Transferindo...
              </>
            ) : (
              <>
                <ArrowRight size={16} />
                Transferir
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
