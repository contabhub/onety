import React, { useState, useEffect } from 'react';
import styles from './Webhooks.module.css';
import { useRouter } from 'next/router';
import { 
  ArrowLeft, 
  Plus, 
  Link, 
  ToggleLeft, 
  ToggleRight,
  Edit, 
  Trash2, 
  X, 
  Cloud,
  CheckCircle,
  Circle
} from 'lucide-react';

const Webhooks = () => {
  const router = useRouter();
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    url: '',
    event_types: [],
    status: 'ativo'
  });

  // Eventos disponíveis no sistema
  const availableEvents = [
    { id: 'MESSAGE_RECEIVED', label: 'Mensagem recebida', description: 'Quando uma mensagem é recebida do cliente' },
    { id: 'MESSAGE_SENT', label: 'Mensagem enviada', description: 'Quando uma mensagem é enviada para o cliente' },
    { id: 'CONVERSATION_CREATED', label: 'Conversa criada', description: 'Quando uma nova conversa é iniciada' },
    { id: 'CONVERSATION_UPDATED', label: 'Conversa atualizada', description: 'Quando uma conversa é modificada' },
    { id: 'CONVERSATION_CLOSED', label: 'Conversa fechada', description: 'Quando uma conversa é finalizada' },
    { id: 'CONTACT_CREATED', label: 'Contato criado', description: 'Quando um novo contato é cadastrado' },
    { id: 'CONTACT_UPDATED', label: 'Contato atualizado', description: 'Quando um contato é modificado' },
    { id: 'TEAM_USER_JOINED', label: 'Usuário adicionado ao time', description: 'Quando um usuário é adicionado a um time' },
    { id: 'TEAM_USER_LEFT', label: 'Usuário removido do time', description: 'Quando um usuário é removido de um time' }
  ];

  // Carregar webhooks
  const loadWebhooks = async () => {
    
    try {
      setLoading(true);
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const companyId = userData.companyId;
      
      if (!companyId) {
        throw new Error('ID da empresa não encontrado');
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/webhooks-integracao/company`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company_id: companyId
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setWebhooks(data.data || []);
    } catch (error) {
      console.error('Erro ao carregar webhooks:', error);
      alert('Erro ao carregar webhooks');
    } finally {
      setLoading(false);
    }
  };

  // Carregar webhooks ao montar o componente
  useEffect(() => {
    loadWebhooks();
  }, []);

  // Abrir modal para criar/editar
  const openModal = (webhook = null) => {
    if (webhook) {
      setEditingWebhook(webhook);
      setFormData({
        nome: webhook.nome,
        url: webhook.url,
        event_types: webhook.event_types || [],
        status: webhook.status
      });
    } else {
      setEditingWebhook(null);
      setFormData({
        nome: '',
        url: '',
        event_types: [],
        status: 'ativo'
      });
    }
    setShowModal(true);
  };

  // Fechar modal
  const closeModal = () => {
    setShowModal(false);
    setEditingWebhook(null);
    setFormData({
      nome: '',
      url: '',
      event_types: [],
      status: 'ativo'
    });
  };

  // Salvar webhook
  const saveWebhook = async () => {
    try {
      if (!formData.nome || !formData.url || formData.event_types.length === 0) {
        alert('Preencha todos os campos obrigatórios');
        return;
      }

      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const companyId = userData.companyId;
      
      if (!companyId) {
        throw new Error('ID da empresa não encontrado');
      }

      const url = editingWebhook 
        ? `${process.env.NEXT_PUBLIC_API_URL}/webhooks-integracao/${editingWebhook.id}`
        : `${process.env.NEXT_PUBLIC_API_URL}/webhooks-integracao`;
      
      const method = editingWebhook ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          company_id: companyId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      alert(editingWebhook ? 'Webhook atualizado com sucesso!' : 'Webhook criado com sucesso!');
      closeModal();
      loadWebhooks();
    } catch (error) {
      console.error('Erro ao salvar webhook:', error);
      alert(error.message || 'Erro ao salvar webhook');
    }
  };

  // Deletar webhook
  const deleteWebhook = async (id) => {
    if (!confirm('Tem certeza que deseja deletar este webhook?')) {
      return;
    }

    try {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const companyId = userData.companyId;
      
      if (!companyId) {
        throw new Error('ID da empresa não encontrado');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/webhooks-integracao/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company_id: companyId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      alert('Webhook deletado com sucesso!');
      loadWebhooks();
    } catch (error) {
      console.error('Erro ao deletar webhook:', error);
      alert('Erro ao deletar webhook');
    }
  };

  // Alternar status
  const toggleStatus = async (id) => {
    try {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const companyId = userData.companyId;
      
      if (!companyId) {
        throw new Error('ID da empresa não encontrado');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/webhooks-integracao/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company_id: companyId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      alert('Status alterado com sucesso!');
      loadWebhooks();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      alert('Erro ao alterar status');
    }
  };

  // Atualizar campo do formulário
  const updateFormData = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Toggle evento selecionado
  const toggleEvent = (eventId) => {
    setFormData(prev => ({
      ...prev,
      event_types: prev.event_types.includes(eventId)
        ? prev.event_types.filter(id => id !== eventId)
        : [...prev.event_types, eventId]
    }));
  };

  // Formatar data
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button 
          className={styles.backButton}
          onClick={() => router.back()}
        >
          <ArrowLeft size={20} />
        </button>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Webhooks</h1>
          <p className={styles.subtitle}>
            {webhooks.length} webhook{webhooks.length !== 1 ? 's' : ''} cadastrado{webhooks.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button 
          className={styles.newButton}
          onClick={() => openModal()}
        >
          <Plus size={16} />
          Novo
        </button>
      </div>

      {/* Lista de webhooks */}
      <div className={styles.webhooksList}>
        {loading ? (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Carregando webhooks...</p>
          </div>
        ) : webhooks.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Link size={48} />
            </div>
            <h3>Nenhum webhook cadastrado</h3>
            <p>Configure webhooks para receber eventos automáticos da plataforma</p>
            <button 
              className={styles.emptyButton}
              onClick={() => openModal()}
            >
              Criar primeiro webhook
            </button>
          </div>
        ) : (
          webhooks.map(webhook => (
            <div key={webhook.id} className={styles.webhookItem}>
              <div className={styles.webhookInfo}>
                <h3 className={styles.webhookName}>{webhook.nome}</h3>
                <p className={styles.webhookUrl}>{webhook.url}</p>
                <div className={styles.webhookEvents}>
                  {webhook.event_types.map(eventId => {
                    const event = availableEvents.find(e => e.id === eventId);
                    return event ? (
                      <span key={eventId} className={styles.eventTag}>
                        {event.label}
                      </span>
                    ) : null;
                  })}
                </div>
                <p className={styles.webhookDate}>
                  Criado em {formatDate(webhook.created_at)}
                </p>
              </div>
              <div className={styles.webhookActions}>
                <div className={styles.statusContainer}>
                  <span 
                    className={`${styles.status} ${webhook.status === 'ativo' ? styles.statusActive : styles.statusInactive}`}
                  >
                    {webhook.status === 'ativo' ? 'ATIVO' : 'INATIVO'}
                  </span>
                </div>
                <div className={styles.actionButtons}>
                  <button 
                    className={styles.actionButton}
                    onClick={() => toggleStatus(webhook.id)}
                    title="Alternar status"
                  >
                    {webhook.status === 'ativo' ? (
                      <ToggleRight size={16} />
                    ) : (
                      <ToggleLeft size={16} />
                    )}
                  </button>
                  <button 
                    className={styles.actionButton}
                    onClick={() => openModal(webhook)}
                    title="Editar webhook"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    className={styles.actionButton}
                    onClick={() => deleteWebhook(webhook.id)}
                    title="Deletar webhook"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de criação/edição */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>{editingWebhook ? 'Editar Webhook' : 'Criar Webhook'}</h2>
              <button className={styles.closeButton} onClick={closeModal}>
                <X size={20} />
              </button>
            </div>
            
            <div className={styles.modalContent}>
              <p className={styles.modalDescription}>
                Preencha todas as informações para receber eventos automáticos da plataforma.
              </p>

              <div className={styles.formGroup}>
                <label className={styles.label}>Nome</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Ex: Integração com n8n"
                  value={formData.nome}
                  onChange={(e) => updateFormData('nome', e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>URL</label>
                <input
                  type="url"
                  className={styles.input}
                  placeholder="https://seusistema.com.br/webhook"
                  value={formData.url}
                  onChange={(e) => updateFormData('url', e.target.value)}
                />
                <p className={styles.helpText}>
                  Preencha aqui a URL do seu sistema contendo{' '}
                  <a href="#" className={styles.link}>http://</a> ou{' '}
                  <a href="#" className={styles.link}>https://</a> que receberá os eventos.
                </p>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Eventos</label>
                <div className={styles.eventsList}>
                  {availableEvents.map(event => (
                    <div key={event.id} className={styles.eventItem}>
                      <label className={styles.eventCheckbox}>
                        <input
                          type="checkbox"
                          checked={formData.event_types.includes(event.id)}
                          onChange={() => toggleEvent(event.id)}
                        />
                        <span className={styles.checkmark}>
                          {formData.event_types.includes(event.id) ? (
                            <CheckCircle size={16} />
                          ) : (
                            <Circle size={16} />
                          )}
                        </span>
                        <div className={styles.eventInfo}>
                          <span className={styles.eventLabel}>{event.label}</span>
                          <span className={styles.eventDescription}>{event.description}</span>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Status</label>
                <select
                  className={styles.select}
                  value={formData.status}
                  onChange={(e) => updateFormData('status', e.target.value)}
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.cancelButton} onClick={closeModal}>
                Cancelar
              </button>
              <button className={styles.saveButton} onClick={saveWebhook}>
                <Cloud size={16} />
                {editingWebhook ? 'Atualizar webhook' : 'Criar webhook'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Webhooks;
