import { useState } from 'react';
import { X, Phone, MessageCircle, Users, Smartphone } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../../utils/auth';
import TeamSelectionModal from './TeamSelectionModal';
import InstanceSelectionModal from './InstanceSelectionModal';
import styles from './NewChatModal.module.css';

export default function NewChatModal({ isOpen, onClose, onConversationCreated }) {
  const { user } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('phone'); // 'phone', 'team', 'instance'
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [userTeams, setUserTeams] = useState([]);
  const [teamInstances, setTeamInstances] = useState([]);

  // Função para normalizar o número de telefone
  const normalizePhone = (phone) => {
    if (!phone) return '';
    let normalized = phone.replace(/\D/g, ''); // Remove tudo que não é número
    
    // Se começar com 55, já está no formato correto
    if (normalized.startsWith('55')) {
      return normalized;
    }
    
    // Se começar com 0, remove
    if (normalized.startsWith('0')) {
      normalized = normalized.substring(1);
    }
    
    // Adiciona o código do país (55)
    return `55${normalized}`;
  };

  // Função para formatar número para exibição
  const formatPhoneDisplay = (phone) => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    
    if (digits.length === 13 && digits.startsWith('55')) {
      // +55 (XX) 9XXXX-XXXX
      const ddd = digits.slice(2, 4);
      const first = digits.slice(4, 9);
      const second = digits.slice(9, 13);
      return `+55 (${ddd}) ${first}-${second}`;
    } else if (digits.length === 12 && digits.startsWith('55')) {
      // +55 (XX) XXXX-XXXX
      const ddd = digits.slice(2, 4);
      const first = digits.slice(4, 8);
      const second = digits.slice(8, 12);
      return `+55 (${ddd}) ${first}-${second}`;
    }
    
    return phone;
  };

  // Buscar times do usuário filtrando pela empresa atual
  const fetchUserTeams = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      const userId = user?.id || (JSON.parse(localStorage.getItem('userData') || '{}').id);
      const companyId = (JSON.parse(localStorage.getItem('userData') || '{}').companyId);
      
      if (!userId) {
        throw new Error('Usuário não identificado');
      }
      if (!companyId) {
        throw new Error('Empresa não identificada');
      }
      
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/company/${companyId}/teams`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setUserTeams(response.data || []);
      
      if (response.data.length === 0) {
        setError('Você não está vinculado a nenhum time. Entre em contato com o administrador.');
        return;
      }
      
      setStep('team');
    } catch (err) {
      console.error('Erro ao buscar times:', err);
      setError('Erro ao carregar times. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Buscar instâncias do time selecionado
  const fetchTeamInstances = async (teamId) => {
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      
             const response = await axios.get(
         `${process.env.NEXT_PUBLIC_API_URL}/team-instances/team/${teamId}`,
         { headers: { Authorization: `Bearer ${token}` } }
       );
      
      setTeamInstances(response.data || []);
      
      if (response.data.length === 0) {
        setError('Este time não possui instâncias WhatsApp configuradas. Entre em contato com o administrador.');
        return;
      }
      
      setStep('instance');
    } catch (err) {
      console.error('Erro ao buscar instâncias:', err);
      setError('Erro ao carregar instâncias WhatsApp. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Criar conversa com instância específica
  const createConversationWithInstance = async (instance) => {
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      const userId = user?.id || (JSON.parse(localStorage.getItem('userData') || '{}').id);
      const normalizedPhone = normalizePhone(phoneNumber);
      
      if (!normalizedPhone || normalizedPhone.length < 12) {
        setError('Por favor, insira um número de telefone válido');
        return;
      }
      
      if (!instance?.id) {
        setError('Instância WhatsApp não selecionada');
        return;
      }
      
      // Criar conversa
      const conversationData = {
        team_whatsapp_instance_id: instance.id,
        customer_name: customerName.trim() || null,
        customer_phone: normalizedPhone,
        assigned_user_id: userId
      };
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/conversations`,
        conversationData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const newConversation = {
        conversation_id: response.data.id,
        customer_name: response.data.customer_name,
        customer_phone: response.data.customer_phone,
        avatar_url: response.data.avatar_url || null,
        status: response.data.status || 'aberta',
        assigned_user_id: response.data.assigned_user_id,
        assigned_user_name: user?.nome,
        created_at: response.data.created_at || new Date().toISOString(),
        updated_at: response.data.updated_at || new Date().toISOString(),
        // Informações do time (igual ao ChatSidebar)
        team_id: selectedTeam?.id,
        team_name: selectedTeam?.nome, // Usar nome do time selecionado
        user_role: selectedTeam?.role,
        // Informações da instância (usar instância passada como parâmetro)
        instance_name: instance?.instance_name,
        phone_number: instance?.phone_number,
        instance_id: instance?.instance_id,
        token: instance?.token,
        client_token: instance?.client_token,
        whatsapp_status: instance?.status,
        // Contadores e mensagens
        unread_count: 0,
        last_message_content: null,
        last_message_time: null,
        last_message_read: null,
        last_message_sender: null
      };
      
      console.log('✅ Nova conversa criada:', newConversation);
      
      // Notificar componente pai
      if (onConversationCreated) {
        onConversationCreated(newConversation);
      }
      
      // Fechar modal
      handleClose();
      
    } catch (err) {
      console.error('Erro ao criar conversa:', err);
      setError(err.response?.data?.error || 'Erro ao iniciar conversa. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Lidar com envio do formulário de telefone
  const handlePhoneSubmit = (e) => {
    e.preventDefault();
    
    const normalizedPhone = normalizePhone(phoneNumber);
    
    if (!normalizedPhone || normalizedPhone.length < 12) {
      setError('Por favor, insira um número de telefone válido');
      return;
    }
    
    setError('');
    fetchUserTeams();
  };

  // Lidar com seleção de time
  const handleTeamSelect = (team) => {
    setSelectedTeam(team);
    fetchTeamInstances(team.id);
  };

  // Lidar com seleção de instância
  const handleInstanceSelect = async (instance) => {
    setSelectedInstance(instance);
    // Criar conversa diretamente com a instância selecionada
    await createConversationWithInstance(instance);
  };

  // Fechar modal e resetar estado
  const handleClose = () => {
    setPhoneNumber('');
    setCustomerName('');
    setError('');
    setStep('phone');
    setSelectedTeam(null);
    setSelectedInstance(null);
    setUserTeams([]);
    setTeamInstances([]);
    onClose();
  };

  // Voltar para etapa anterior
  const handleBack = () => {
    setError('');
    if (step === 'instance') {
      setStep('team');
      setSelectedInstance(null);
      setTeamInstances([]);
    } else if (step === 'team') {
      setStep('phone');
      setSelectedTeam(null);
      setUserTeams([]);
    }
  };

  if (!isOpen) return null;
  

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            <MessageCircle size={24} />
            Iniciar novo atendimento
          </h2>
          <button onClick={handleClose} className={styles.closeButton}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          {step === 'phone' && (
            <form onSubmit={handlePhoneSubmit} className={styles.phoneForm}>
              <div className={styles.inputGroup}>
                <label htmlFor="phone" className={styles.label}>
                  <Phone size={16} />
                  Número do telefone *
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className={styles.input}
                  required
                />
                {phoneNumber && (
                  <div className={styles.phonePreview}>
                    Será enviado para: {formatPhoneDisplay(normalizePhone(phoneNumber))}
                  </div>
                )}
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="customerName" className={styles.label}>
                  Nome do cliente (opcional)
                </label>
                <input
                  id="customerName"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nome do cliente"
                  className={styles.input}
                />
              </div>

              <div className={styles.actions}>
                <button 
                  type="button" 
                  onClick={handleClose}
                  className={styles.cancelButton}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={loading || !phoneNumber.trim()}
                  className={styles.continueButton}
                >
                  {loading ? 'Carregando...' : 'Continuar'}
                </button>
              </div>
            </form>
          )}

          {step === 'team' && (
            <TeamSelectionModal
              teams={userTeams}
              onSelect={handleTeamSelect}
              onBack={handleBack}
              loading={loading}
            />
          )}

          {step === 'instance' && (
            <InstanceSelectionModal
              instances={teamInstances}
              selectedTeam={selectedTeam}
              onSelect={handleInstanceSelect}
              onBack={handleBack}
              loading={loading}
            />
          )}
        </div>
      </div>
    </div>
  );
}
