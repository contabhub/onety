import { useState, useEffect } from 'react';
import styles from './LinksExternos.module.css';
import { ExternalLink, Plus, Edit, Trash, Link as LinkIcon } from 'lucide-react';

export default function LinksExternos() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    link: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState(null);

  // Verificar dados do usuário
  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    setUserRole(userData.userRole || null);
    
    if (!userData.EmpresaId) {
      setError('ID da empresa não encontrado. Faça login novamente.');
      setLoading(false);
      return;
    }
    
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const companyId = JSON.parse(localStorage.getItem('userData') || '{}').EmpresaId;
      if (!companyId) {
        throw new Error('ID da empresa não encontrado. Faça login novamente.');
      }
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('URL da API não configurada.');
      }
      
      const response = await fetch(`${apiUrl}/atendimento/links-externos/company/${companyId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar links externos');
      }

      const data = await response.json();
      setLinks(data);
    } catch (err) {
      console.error('Erro ao buscar links:', err);
      setError('Erro ao carregar links externos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.nome.trim() || !formData.link.trim()) {
      setError('Nome e link são obrigatórios');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      const companyId = JSON.parse(localStorage.getItem('userData') || '{}').EmpresaId;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      const url = editingLink 
        ? `${apiUrl}/atendimento/links-externos/${editingLink.id}`
        : `${apiUrl}/atendimento/links-externos`;
      
      const method = editingLink ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nome: formData.nome.trim(),
          link: formData.link.trim(),
          empresa_id: companyId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar link');
      }

      // Recarregar lista
      await fetchLinks();
      
      // Limpar formulário e fechar modal
      setFormData({ nome: '', link: '' });
      setEditingLink(null);
      setShowModal(false);
      
    } catch (err) {
      console.error('Erro ao salvar link:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (link) => {
    setEditingLink(link);
    setFormData({
      nome: link.nome,
      link: link.link
    });
    setShowModal(true);
  };

  const handleDelete = async (linkId) => {
    if (!confirm('Tem certeza que deseja excluir este link?')) {
      return;
    }

    try {
      setError(null);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      const response = await fetch(`${apiUrl}/atendimento/links-externos/${linkId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao excluir link');
      }

      // Recarregar lista
      await fetchLinks();
      
    } catch (err) {
      console.error('Erro ao excluir link:', err);
      setError('Erro ao excluir link. Tente novamente.');
    }
  };

  const openModal = () => {
    setEditingLink(null);
    setFormData({ nome: '', link: '' });
    setShowModal(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setShowModal(false);
    setEditingLink(null);
    setFormData({ nome: '', link: '' });
    setError(null);
  };

  const openLink = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Carregando links externos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerText}>
            <h1 className={styles.title}>Links Externos</h1>
            <p className={styles.subtitle}>
              Gerencie links úteis para sua empresa
            </p>
          </div>
            <button 
              onClick={openModal}
              className={styles.headerAddButton}
            >
              Adicionar Link
            </button>
        </div>
      </div>
      
      {/* Mensagens de erro */}
      {error && (
        <div className={styles.errorMessage}>
          <span>⚠️</span>
          <div className={styles.errorContent}>
            <p>{error}</p>
            <button 
              onClick={() => {
                setError(null);
                fetchLinks();
              }}
              className={styles.retryButton}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}
      
      {/* Lista de links */}
      <div className={styles.linksGrid}>
        {links.length === 0 ? (
          <div className={styles.emptyState}>
            <LinkIcon size={48} className={styles.emptyIcon} />
            <h3>Nenhum link externo cadastrado</h3>
            <p>Adicione links úteis para sua empresa</p>
            {(userRole === 'Administrador' || userRole === 'Superadmin') && (
              <button 
                onClick={openModal}
                className={styles.addFirstButton}
              >
                <Plus size={20} />
                Adicionar primeiro link
              </button>
            )}
          </div>
        ) : (
          links.map((link) => (
            <div key={link.id} className={styles.linkCard}>
              <div className={styles.linkHeader}>
                <div className={styles.linkIcon}>
                  <ExternalLink size={20} />
                </div>
                <div className={styles.linkInfo}>
                  <h3 className={styles.linkName}>{link.nome}</h3>
                  <p className={styles.linkUrl}>{link.link}</p>
                </div>
              </div>
              
              <div className={styles.linkActions}>
                <button 
                  className={styles.actionButton}
                  onClick={() => openLink(link.link)}
                  title="Abrir link"
                >
                  <ExternalLink size={16} />
                  Abrir
                </button>
                
                  <>
                    <button 
                      className={styles.actionButton}
                      onClick={() => handleEdit(link)}
                      title="Editar link"
                    >
                      <Edit size={16} />
                      Editar
                    </button>
                    <button 
                      className={styles.actionButton}
                      onClick={() => handleDelete(link.id)}
                      title="Excluir link"
                    >
                      <Trash size={16} />
                      Excluir
                    </button>
                  </>
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
              <h3>{editingLink ? 'Editar Link' : 'Adicionar Link'}</h3>
              <button 
                className={styles.closeButton}
                onClick={closeModal}
                disabled={submitting}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className={styles.modalContent}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Nome do Link:</label>
                <input 
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Site da empresa, Documentação, etc."
                  className={styles.input}
                  required
                />
              </div>
              
              <div className={styles.formGroup}>
                <label className={styles.label}>URL:</label>
                <input 
                  type="url"
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  placeholder="https://exemplo.com"
                  className={styles.input}
                  required
                />
              </div>
              
              <div className={styles.modalActions}>
                <button 
                  type="button"
                  onClick={closeModal}
                  className={styles.cancelButton}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className={styles.saveButton}
                  disabled={submitting}
                >
                  {submitting ? 'Salvando...' : (editingLink ? 'Atualizar' : 'Salvar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

