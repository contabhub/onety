import { X, Phone, MessageSquare, BadgeCheck, User as UserIcon, Clock } from 'lucide-react';
import styles from './ContactDetailsModal.module.css';

export default function ContactDetailsModal({ 
  isOpen, 
  onClose, 
  conversation, 
  currentUser,
  onAssumeConversation,
  onFinalizeConversation 
}) {
  if (!isOpen || !conversation) return null;

  // Função para formatar status
  const formatStatus = (status) => {
    const statusMap = {
      'open': 'Aberta',
      'closed': 'Fechada',
      'pending': 'Pendente',
      'assigned': 'Atendida'
    };
    return statusMap[status] || status;
  };

  // Função para formatar data/hora
  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Função para formatar status do WhatsApp
  const formatWhatsAppStatus = (status) => {
    const statusMap = {
      'connected': 'Conectado',
      'disconnected': 'Desconectado',
      'connecting': 'Conectando...',
      'error': 'Erro'
    };
    return statusMap[status] || status;
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header do Modal */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Dados do contato</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo do Modal */}
        <div className={styles.modalContent}>
          {/* Informações do contato */}
          <div className={styles.contactSection}>
            <div className={styles.contactHeader}>
              <div className={styles.avatar}>
                <span className={styles.avatarText}>
                  {(conversation.customer_name || conversation.customer_phone || 'C')[0]}
                </span>
              </div>
              <div className={styles.contactInfo}>
                <h3 className={styles.contactName}>
                  {conversation.customer_name || conversation.customer_phone || 'Contato'}
                </h3>
              </div>
            </div>
          </div>

          {/* Detalhes do contato */}
          <div className={styles.detailsGrid}>
            <div className={styles.detailItem}>
              <Phone size={16} className={styles.detailIcon} />
              <div className={styles.detailContent}>
                <span className={styles.detailLabel}>Telefone</span>
                <span className={styles.detailValue}>{conversation.customer_phone || 'Sem telefone'}</span>
              </div>
            </div>

            {conversation.instance_name && (
              <div className={styles.detailItem}>
                <MessageSquare size={16} className={styles.detailIcon} />
                <div className={styles.detailContent}>
                  <span className={styles.detailLabel}>Instância</span>
                  <span className={styles.detailValue}>
                    {conversation.instance_name}
                    {conversation.whatsapp_status && (
                      <span className={`${styles.whatsappStatus} ${styles[conversation.whatsapp_status]}`}>
                        {' '}({formatWhatsAppStatus(conversation.whatsapp_status)})
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )}

            <div className={styles.detailItem}>
              <BadgeCheck size={16} className={styles.detailIcon} />
              <div className={styles.detailContent}>
                <span className={styles.detailLabel}>Status</span>
                <span className={`${styles.statusBadge} ${styles[conversation.status] || styles.default}`}>
                  {formatStatus(conversation.status)}
                </span>
              </div>
            </div>

            {conversation.last_message_time && (
              <div className={styles.detailItem}>
                <Clock size={16} className={styles.detailIcon} />
                <div className={styles.detailContent}>
                  <span className={styles.detailLabel}>Última mensagem</span>
                  <span className={styles.detailValue}>{formatDateTime(conversation.last_message_time)}</span>
                </div>
              </div>
            )}

            {conversation.assigned_user_id && (
              <div className={styles.detailItem}>
                <UserIcon size={16} className={styles.detailIcon} />
                <div className={styles.detailContent}>
                  <span className={styles.detailLabel}>Atendida por</span>
                  <span className={styles.detailValue}>
                    {conversation.assigned_user_id === currentUser?.id ? 'Você' : conversation.assigned_user_name || `ID: ${conversation.assigned_user_id}`}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Ações */}
          <div className={styles.actions}>
            {!conversation.assigned_user_id && conversation.status === 'open' && (
              <button
                onClick={onAssumeConversation}
                className={styles.assumeButton}
              >
                ✋ Assumir conversa
              </button>
            )}
            
            {conversation.status === 'open' && (
              <button
                onClick={onFinalizeConversation}
                className={styles.finalizeButton}
              >
                ✅ Finalizar conversa
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
