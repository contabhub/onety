import { useState, useEffect } from 'react';
import styles from './CreateTeamModal.module.css';
import { X, Users, Smartphone, ChevronDown } from 'lucide-react';

export default function CreateTeamModal({ isOpen, onClose, onSuccess, editTeam = null }) {
  const [formData, setFormData] = useState({
    nome: '',
    padrao: false,
    departamento_id: '',
    whatsappInstances: [],
    teamUsers: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [availableInstances, setAvailableInstances] = useState([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isUsersDropdownOpen, setIsUsersDropdownOpen] = useState(false);
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  
  // Buscar dados disponíveis quando o modal abrir
  useEffect(() => {
    if (isOpen) {
      fetchAvailableInstances();
      fetchAvailableUsers();
      fetchAvailableDepartments();
    }
  }, [isOpen]);

  // Preencher dados quando for edição
  useEffect(() => {
    if (editTeam && isOpen) {
      setFormData({
        nome: editTeam.nome || '',
        padrao: editTeam.padrao === 1,
        departamento_id: editTeam.departamento_id ? editTeam.departamento_id.toString() : 'null',
        whatsappInstances: [],
        teamUsers: []
      });
      // Buscar dados vinculados se for edição
      fetchTeamInstances(editTeam.id);
      fetchTeamUsers(editTeam.id);
    } else if (!editTeam && isOpen) {
      setFormData({
        nome: '',
        padrao: false,
        departamento_id: '',
        whatsappInstances: [],
        teamUsers: []
      });
    }
  }, [editTeam, isOpen]);

  const fetchAvailableInstances = async () => {
    try {
      setLoadingInstances(true);
      const token = localStorage.getItem('token');
      const companyId = JSON.parse(localStorage.getItem('userData') || '{}').EmpresaId;
      
      if (!token || !companyId) {
        throw new Error('Dados de autenticação não encontrados');
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/atendimento/instancias/empresa/${companyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar instâncias');
      }

      const instances = await response.json();
      setAvailableInstances(instances);
    } catch (err) {
      console.error('Erro ao buscar instâncias:', err);
      setError('Erro ao carregar instâncias disponíveis');
    } finally {
      setLoadingInstances(false);
    }
  };

  const fetchTeamInstances = async (teamId) => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      const response = await fetch(`${apiUrl}/atendimento/times-atendimento-instancias/time/${teamId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const teamInstances = await response.json();
        const instanceIds = teamInstances.map(ti => ti.whatsapp_instance_id);
        setFormData(prev => ({
          ...prev,
          whatsappInstances: instanceIds
        }));
      }
    } catch (err) {
      console.error('Erro ao buscar instâncias da equipe:', err);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      setLoadingUsers(true);
      const token = localStorage.getItem('token');
      const companyId = JSON.parse(localStorage.getItem('userData') || '{}').EmpresaId;
      
      if (!token || !companyId) {
        throw new Error('Dados de autenticação não encontrados');
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/atendimento/usuarios/company/${companyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar usuários');
      }

      const data = await response.json();
      const users = data.users || [];
      const filtered = users.filter(u => u.role !== 'Superadmin' && u.id !== 8);
      setAvailableUsers(filtered);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
      setError('Erro ao carregar usuários disponíveis');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchAvailableDepartments = async () => {
    try {
      setLoadingDepartments(true);
      const token = localStorage.getItem('token');
      const companyId = JSON.parse(localStorage.getItem('userData') || '{}').EmpresaId;
      
      if (!token || !companyId) {
        throw new Error('Dados de autenticação não encontrados');
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/departamentos/empresa/${companyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar departamentos');
      }

      const departments = await response.json();
      setAvailableDepartments(departments);
    } catch (err) {
      console.error('Erro ao buscar departamentos:', err);
      setError('Erro ao carregar departamentos disponíveis');
    } finally {
      setLoadingDepartments(false);
    }
  };

  const fetchTeamUsers = async (teamId) => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      const response = await fetch(`${apiUrl}/atendimento/times-atendimento-usuarios/time/${teamId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const teamUsers = await response.json();
        
        // Extrair apenas os usuario_id dos usuários vinculados
        const userIds = teamUsers.map(tu => tu.usuario_id);
        
        setFormData(prev => ({
          ...prev,
          teamUsers: userIds
        }));
      }
    } catch (err) {
      console.error('Erro ao buscar usuários da equipe:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleInstanceToggle = (instanceId) => {
    setFormData(prev => ({
      ...prev,
      whatsappInstances: prev.whatsappInstances.includes(instanceId)
        ? prev.whatsappInstances.filter(id => id !== instanceId)
        : [...prev.whatsappInstances, instanceId]
    }));
  };

  const handleToggleAllInstances = () => {
    const allInstanceIds = availableInstances.map(instance => instance.id);
    const isAllSelected = allInstanceIds.length === formData.whatsappInstances.length &&
                         allInstanceIds.every(id => formData.whatsappInstances.includes(id));
    
    setFormData(prev => ({
      ...prev,
      whatsappInstances: isAllSelected ? [] : allInstanceIds
    }));
  };

  const handleUserToggle = (userId) => {
    setFormData(prev => ({
      ...prev,
      teamUsers: prev.teamUsers.includes(userId)
        ? prev.teamUsers.filter(id => id !== userId)
        : [...prev.teamUsers, userId]
    }));
  };

  const handleToggleAllUsers = () => {
    const allUserIds = availableUsers.map(user => user.id);
    const isAllSelected = formData.teamUsers.length === allUserIds.length;
    
    setFormData(prev => ({
      ...prev,
      teamUsers: isAllSelected ? [] : allUserIds
    }));
  };

  const getDropdownText = () => {
    if (formData.whatsappInstances.length === 0) {
      return 'Nenhum canal';
    }
    
    if (formData.whatsappInstances.length === availableInstances.length && availableInstances.length > 0) {
      return 'Todos os canais';
    }
    
    if (formData.whatsappInstances.length === 1) {
      const instance = availableInstances.find(inst => inst.id === formData.whatsappInstances[0]);
      if (instance) {
        return instance.phone_number ? 
          `(${instance.phone_number}) - ${instance.instancia_nome || instance.instance_name}` : 
          `- Instância ${instance.instancia_nome || instance.instance_name || instance.instancia_id || instance.instance_id}`;
      }
    }
    
    return `${formData.whatsappInstances.length} canais selecionados`;
  };

  const getUsersDropdownText = () => {
    if (formData.teamUsers.length === 0) {
      return 'Nenhum usuário';
    }
    
    if (formData.teamUsers.length === availableUsers.length && availableUsers.length > 0) {
      return 'Todos os usuários';
    }
    
    if (formData.teamUsers.length === 1) {
      const user = availableUsers.find(u => u.id === formData.teamUsers[0]);
      if (user) {
        return user.nome || user.email;
      }
    }
    
    return `${formData.teamUsers.length} usuários selecionados`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      setError('Nome da equipe é obrigatório');
      return;
    }

    if (!formData.departamento_id || formData.departamento_id === '') {
      setError('Departamento é obrigatório');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const companyId = JSON.parse(localStorage.getItem('userData') || '{}').EmpresaId;
      if (!token || !companyId) {
        throw new Error('Dados de autenticação não encontrados');
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('URL da API não configurada');
      }

      const isEditing = !!editTeam;
      const url = isEditing ? `${apiUrl}/atendimento/times-atendimento/${editTeam.id}` : `${apiUrl}/atendimento/times-atendimento`;
      const method = isEditing ? 'PUT' : 'POST';
      
      const body = {
        nome: formData.nome.trim(),
        padrao: formData.padrao ? 1 : 0,
        empresa_id: parseInt(companyId),
        departamento_id: formData.departamento_id === 'null' ? null : (formData.departamento_id ? parseInt(formData.departamento_id) : null)
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro ao ${isEditing ? 'atualizar' : 'criar'} equipe`);
      }

      const newTeam = await response.json();
      
      // Se não for edição, criar vínculos com instâncias e usuários selecionados
      if (!isEditing) {
        if (formData.whatsappInstances.length > 0) {
          await createTeamInstanceLinks(newTeam.id || newTeam.insertId);
        }
        if (formData.teamUsers.length > 0) {
          await createTeamUserLinks(newTeam.id || newTeam.insertId);
        }
      } else if (isEditing) {
        // Se for edição, atualizar vínculos de instâncias e usuários
        await updateTeamInstanceLinks(editTeam.id);
        await updateTeamUserLinks(editTeam.id);
      }
      
      // Reset form
      setFormData({ nome: '', padrao: false, whatsappInstances: [], teamUsers: [] });
      
      // Call success callback
      if (onSuccess) {
        onSuccess(newTeam);
      }
      
      // Close modal
      onClose();
      
    } catch (err) {
      console.error('Erro ao criar equipe:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createTeamInstanceLinks = async (teamId) => {
    const token = localStorage.getItem('token');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    for (const instanceId of formData.whatsappInstances) {
      try {
        const response = await fetch(`${apiUrl}/atendimento/times-atendimento-instancias`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            times_atendimento_id: teamId,
            instancia_id: instanceId,
            nivel_acesso: 'total'
          })
        });

        if (!response.ok) {
          console.error(`Erro ao vincular instância ${instanceId} à equipe ${teamId}`);
        }
      } catch (err) {
        console.error(`Erro ao vincular instância ${instanceId}:`, err);
      }
    }
  };

  const updateTeamInstanceLinks = async (teamId) => {
    const token = localStorage.getItem('token');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    try {
      // Buscar vínculos existentes
      const existingResponse = await fetch(`${apiUrl}/atendimento/times-atendimento-instancias/time/${teamId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      let existingLinks = [];
      if (existingResponse.ok) {
        existingLinks = await existingResponse.json();
      }

      // IDs das instâncias atualmente selecionadas
      const selectedInstanceIds = formData.whatsappInstances;
      
      // IDs das instâncias que já estão vinculadas
      const existingInstanceIds = existingLinks.map(link => link.whatsapp_instance_id);

      // Instâncias para ADICIONAR (selecionadas mas não existem vínculos)
      const instancesToAdd = selectedInstanceIds.filter(id => !existingInstanceIds.includes(id));
      
      // Instâncias para REMOVER (existem vínculos mas não estão selecionadas)
      const instancesToRemove = existingLinks.filter(link => !selectedInstanceIds.includes(link.whatsapp_instance_id));

      console.log('Instâncias para adicionar:', instancesToAdd);
      console.log('Instâncias para remover:', instancesToRemove);

      // REMOVER vínculos desmarcados
      for (const link of instancesToRemove) {
        try {
          const deleteResponse = await fetch(`${apiUrl}/atendimento/times-atendimento-instancias/${link.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (!deleteResponse.ok) {
            console.error(`Erro ao desvincular instância ${link.whatsapp_instance_id} da equipe ${teamId}`);
          } else {
            console.log(`✅ Instância ${link.whatsapp_instance_id} desvinculada da equipe ${teamId}`);
          }
        } catch (err) {
          console.error(`Erro ao desvincular instância ${link.whatsapp_instance_id}:`, err);
        }
      }

      // ADICIONAR novos vínculos
      for (const instanceId of instancesToAdd) {
        try {
          const addResponse = await fetch(`${apiUrl}/atendimento/times-atendimento-instancias`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              times_atendimento_id: teamId,
              instancia_id: instanceId,
              nivel_acesso: 'total'
            })
          });

          if (!addResponse.ok) {
            console.error(`Erro ao vincular instância ${instanceId} à equipe ${teamId}`);
          } else {
            console.log(`✅ Instância ${instanceId} vinculada à equipe ${teamId}`);
          }
        } catch (err) {
          console.error(`Erro ao vincular instância ${instanceId}:`, err);
        }
      }

    } catch (err) {
      console.error('Erro ao atualizar vínculos das instâncias:', err);
    }
  };

  const createTeamUserLinks = async (teamId) => {
    const token = localStorage.getItem('token');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    for (const userId of formData.teamUsers) {
      try {
        const response = await fetch(`${apiUrl}/atendimento/times-atendimento-usuarios`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            times_atendimento_id: teamId,
            usuario_id: userId,
            role: 'Usuário'
          })
        });

        if (!response.ok) {
          console.error(`Erro ao vincular usuário ${userId} à equipe ${teamId}`);
        }
      } catch (err) {
        console.error(`Erro ao vincular usuário ${userId}:`, err);
      }
    }
  };

  const updateTeamUserLinks = async (teamId) => {
    const token = localStorage.getItem('token');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    try {
      // Buscar vínculos existentes
      const existingResponse = await fetch(`${apiUrl}/atendimento/times-atendimento-usuarios/time/${teamId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      let existingLinks = [];
      if (existingResponse.ok) {
        existingLinks = await existingResponse.json();
      }

      // IDs dos usuários atualmente selecionados
      const selectedUserIds = formData.teamUsers;
      
      // IDs dos usuários que já estão vinculados (usar user_id do retorno da API)
      const existingUserIds = existingLinks.map(link => link.user_id);
      console.log('IDs dos usuários existentes:', existingUserIds);

      // Usuários para ADICIONAR (selecionados mas não existem vínculos)
      const usersToAdd = selectedUserIds.filter(id => !existingUserIds.includes(id));
      
      // Usuários para REMOVER (existem vínculos mas não estão selecionados)
      const usersToRemove = existingLinks.filter(link => !selectedUserIds.includes(link.user_id));

      console.log('Usuários para adicionar:', usersToAdd);
      console.log('Usuários para remover:', usersToRemove);

      // REMOVER vínculos desmarcados
      for (const link of usersToRemove) {
        try {
          const deleteResponse = await fetch(`${apiUrl}/atendimento/times-atendimento-usuarios/${link.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (!deleteResponse.ok) {
            console.error(`Erro ao desvincular usuário ${link.user_id} da equipe ${teamId}`);
          } else {
            console.log(`✅ Usuário ${link.user_id} desvinculado da equipe ${teamId}`);
          }
        } catch (err) {
          console.error(`Erro ao desvincular usuário ${link.user_id}:`, err);
        }
      }

      // ADICIONAR novos vínculos
      for (const userId of usersToAdd) {
        try {
          const addResponse = await fetch(`${apiUrl}/atendimento/times-atendimento-usuarios`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              times_atendimento_id: teamId,
              usuario_id: userId,
              role: 'Usuário'
            })
          });

          if (!addResponse.ok) {
            console.error(`Erro ao vincular usuário ${userId} à equipe ${teamId}`);
          } else {
            console.log(`✅ Usuário ${userId} vinculado à equipe ${teamId}`);
          }
        } catch (err) {
          console.error(`Erro ao vincular usuário ${userId}:`, err);
        }
      }

    } catch (err) {
      console.error('Erro ao atualizar vínculos dos usuários:', err);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({ nome: '', padrao: false, whatsappInstances: [], teamUsers: [] });
      setError(null);
      setIsDropdownOpen(false);
      setIsUsersDropdownOpen(false);
      onClose();
    }
  };

  // Fechar dropdowns quando clicar fora deles
  useEffect(() => {
    const handleClickOutside = (event) => {
      const dropdown = event.target.closest('.dropdownContainer');
      const usersDropdown = event.target.closest('.usersDropdownContainer');
      
      if (!dropdown && isDropdownOpen) {
        setIsDropdownOpen(false);
      }
      
      if (!usersDropdown && isUsersDropdownOpen) {
        setIsUsersDropdownOpen(false);
      }
    };

    if (isDropdownOpen || isUsersDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen, isUsersDropdownOpen]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <div className={styles.icon}>
              <Users size={24} />
            </div>
            <h2 className={styles.title}>
              {editTeam ? 'Editar Equipe' : 'Nova Equipe'}
            </h2>
          </div>
          <button 
            className={styles.closeButton}
            onClick={handleClose}
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="nome" className={styles.label}>
              Nome da Equipe *
            </label>
            <input
              type="text"
              id="nome"
              name="nome"
              value={formData.nome}
              onChange={handleInputChange}
              className={styles.input}
              placeholder="Digite o nome da equipe"
              disabled={loading}
              maxLength={100}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="departamento_id" className={styles.label}>
              Departamento *
            </label>
            <select
              id="departamento_id"
              name="departamento_id"
              value={formData.departamento_id}
              onChange={handleInputChange}
              className={styles.input}
              disabled={loading || loadingDepartments}
              required
            >
              <option value="">Selecione um departamento</option>
              <option value="null">Sem Departamento Definido</option>
              {availableDepartments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.nome}
                </option>
              ))}
            </select>
            {loadingDepartments && (
              <div className={styles.loadingText}>Carregando departamentos...</div>
            )}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                name="padrao"
                checked={formData.padrao}
                onChange={handleInputChange}
                className={styles.checkbox}
                disabled={loading}
              />
              <span className={styles.checkboxText}>
                Definir como equipe padrão
              </span>
            </label>
            <p className={styles.helpText}>
              A equipe padrão será usada automaticamente para novos usuários
            </p>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Canal da equipe
            </label>
            <p className={styles.helpText}>
              Defina o canal que a equipe terá acesso
            </p>
            
            <div className={`${styles.dropdownContainer} dropdownContainer`}>
              <button
                type="button"
                className={`${styles.dropdownButton} ${isDropdownOpen ? styles.dropdownOpen : ''}`}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                disabled={loading || loadingInstances}
              >
                <span className={styles.dropdownText}>
                  {loadingInstances ? 'Carregando...' : getDropdownText()}
                </span>
                <ChevronDown 
                  size={16} 
                  className={`${styles.dropdownIcon} ${isDropdownOpen ? styles.dropdownIconOpen : ''}`} 
                />
              </button>
              
              {isDropdownOpen && !loadingInstances && (
                <div className={styles.dropdownMenu}>
                  <div className={styles.instanceOption}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={availableInstances.length > 0 && 
                                 availableInstances.length === formData.whatsappInstances.length &&
                                 availableInstances.every(instance => formData.whatsappInstances.includes(instance.id))}
                        onChange={handleToggleAllInstances}
                        className={styles.checkbox}
                        disabled={loading || availableInstances.length === 0}
                      />
                      <span className={styles.checkboxText}>
                        <strong>Todos os canais</strong>
                      </span>
                    </label>
                  </div>

                  <div className={styles.instanceOption}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={formData.whatsappInstances.length === 0}
                        onChange={() => setFormData(prev => ({ ...prev, whatsappInstances: [] }))}
                        className={styles.checkbox}
                        disabled={loading}
                      />
                      <span className={styles.checkboxText}>
                        Nenhum canal
                      </span>
                    </label>
                  </div>

                  {availableInstances.length > 0 && (
                    <>
                      <div className={styles.instanceDivider}>WhatsApp</div>
                      
                      {availableInstances.map((instance) => (
                        <div key={instance.id} className={styles.instanceOption}>
                          <label className={styles.checkboxLabel}>
                            <input
                              type="checkbox"
                              checked={formData.whatsappInstances.includes(instance.id)}
                              onChange={() => handleInstanceToggle(instance.id)}
                              className={styles.checkbox}
                              disabled={loading}
                            />
                            <span className={styles.checkboxText}>
                              {instance.phone_number ? 
                                `(${instance.phone_number}) - ${instance.instancia_nome || instance.instance_name}` : 
                                `- Instância ${instance.instancia_nome || instance.instance_name || instance.instancia_id || instance.instance_id}`
                              }
                            </span>
                          </label>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              <Users size={16} style={{ marginRight: '8px' }} />
              Acesso aos atendimentos
            </label>
            <p className={styles.helpText}>
              Defina abaixo quem poderá visualizar os atendimentos do atendimento
            </p>
            
            <div className={`${styles.dropdownContainer} usersDropdownContainer`}>
              <button
                type="button"
                className={`${styles.dropdownButton} ${isUsersDropdownOpen ? styles.dropdownOpen : ''}`}
                onClick={() => setIsUsersDropdownOpen(!isUsersDropdownOpen)}
                disabled={loading || loadingUsers}
              >
                <span className={styles.dropdownText}>
                  {loadingUsers ? 'Carregando...' : getUsersDropdownText()}
                </span>
                <ChevronDown 
                  size={16} 
                  className={`${styles.dropdownIcon} ${isUsersDropdownOpen ? styles.dropdownIconOpen : ''}`} 
                />
              </button>
              
              {isUsersDropdownOpen && !loadingUsers && (
                <div className={styles.dropdownMenu}>
                  <div className={styles.instanceOption}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={availableUsers.length > 0 && formData.teamUsers.length === availableUsers.length}
                        onChange={handleToggleAllUsers}
                        className={styles.checkbox}
                        disabled={loading || availableUsers.length === 0}
                      />
                      <span className={styles.checkboxText}>
                        <strong>Todos</strong>
                      </span>
                    </label>
                    <p className={styles.helpText}>
                      Visível aos usuários desta equipe no aba Outros
                    </p>
                  </div>

                  <div className={styles.instanceOption}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={formData.teamUsers.length === 0}
                        onChange={() => setFormData(prev => ({ ...prev, teamUsers: [] }))}
                        className={styles.checkbox}
                        disabled={loading}
                      />
                      <span className={styles.checkboxText}>
                        Nenhum usuário
                      </span>
                    </label>
                  </div>

                  {availableUsers.length > 0 && (
                    <>
                      <div className={styles.instanceDivider}>Usuários da empresa</div>
                      
                      {availableUsers.map((user) => (
                        <div key={user.id} className={styles.instanceOption}>
                          <label className={styles.checkboxLabel}>
                            <input
                              type="checkbox"
                              checked={formData.teamUsers.includes(user.id)}
                              onChange={() => handleUserToggle(user.id)}
                              className={styles.checkbox}
                              disabled={loading}
                            />
                            <span className={styles.checkboxText}>
                              {user.nome || user.email}
                              {user.is_admin === 1 && (
                                <span className={styles.adminBadge}> (Admin)</span>
                              )}
                            </span>
                          </label>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className={styles.errorMessage}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              onClick={handleClose}
              className={styles.cancelButton}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading || !formData.nome.trim()}
            >
              {loading ? (
                <>
                  <div className={styles.spinner}></div>
                  {editTeam ? 'Salvando...' : 'Criando...'}
                </>
              ) : (
                editTeam ? 'Salvar Alterações' : 'Criar Equipe'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
