import { useState, useEffect } from 'react';
import styles from './ContatoDetailsModal.module.css';
import { X, User, Mail, Phone, FileText, MessageSquare, Folder, Archive, Edit2, Trash2, Calendar, Tag, Plus, XCircle } from 'lucide-react';
import { normalizeNotasInternas, formatDate, formatPhone } from '../../../utils/contactHelper';

export default function ContatoDetailsModal({ isOpen, onClose, contato, onEdit, onEtiquetasChanged }) {
  const [activeTab, setActiveTab] = useState('detalhes');
  const [conversas, setConversas] = useState([]);
  const [loadingConversas, setLoadingConversas] = useState(false);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [etiquetasVinculadas, setEtiquetasVinculadas] = useState([]);
  const [todasEtiquetas, setTodasEtiquetas] = useState([]);
  const [isLoadingEtiquetas, setIsLoadingEtiquetas] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [showVincularModal, setShowVincularModal] = useState(false);
  const [filtroEtiqueta, setFiltroEtiqueta] = useState('');

  useEffect(() => {
    if (isOpen && contato && activeTab === 'conversas') {
      fetchConversas();
    }
  }, [isOpen, contato, activeTab]);

  useEffect(() => {
    if (isOpen && contato && contato.id) {
      carregarEtiquetas();
    }
  }, [isOpen, contato]);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    setUserRole(userData.userRole || null);
  }, []);

  const fetchConversas = async () => {
    try {
      setLoadingConversas(true);
      setError(null);
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = localStorage.getItem('token');
      
      // Buscar conversas vinculadas ao contato
      const response = await fetch(`${apiUrl}/conversations/contact/${contato.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar conversas');
      }

      const data = await response.json();
      setConversas(data || []);
    } catch (err) {
      console.error('Erro ao buscar conversas:', err);
      setError('Erro ao carregar conversas do contato');
    } finally {
      setLoadingConversas(false);
    }
  };

  // ===== Funções para gerenciar etiquetas =====
  const carregarEtiquetas = async () => {
    try {
      setIsLoadingEtiquetas(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = localStorage.getItem('token');
      const companyId = JSON.parse(localStorage.getItem('userData') || '{}').companyId;

      // Etiquetas do contato
      const [resContato, resTodas] = await Promise.all([
        fetch(`${apiUrl}/contatos-etiquetas/contato/${contato.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${apiUrl}/etiquetas/company/${companyId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const etiquetasContato = await resContato.json();
      const etiquetasEmpresa = await resTodas.json();

      setEtiquetasVinculadas(Array.isArray(etiquetasContato) ? etiquetasContato : []);
      setTodasEtiquetas(Array.isArray(etiquetasEmpresa) ? etiquetasEmpresa : []);
    } catch (err) {
      console.error('Erro ao carregar etiquetas:', err);
    } finally {
      setIsLoadingEtiquetas(false);
    }
  };

  const vincularEtiqueta = async (etiquetaId) => {
    try {
      setIsLinking(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/contatos-etiquetas`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ contato_id: contato.id, etiqueta_id: etiquetaId })
      });
      if (!res.ok) throw new Error('Erro ao vincular etiqueta');
      await carregarEtiquetas();
      onEtiquetasChanged && onEtiquetasChanged();
    } catch (err) {
      console.error(err);
      alert('Não foi possível vincular a etiqueta.');
    } finally {
      setIsLinking(false);
    }
  };

  const desvincularEtiqueta = async (etiquetaId) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/contatos-etiquetas`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ contato_id: contato.id, etiqueta_id: etiquetaId })
      });
      if (!res.ok) throw new Error('Erro ao desvincular etiqueta');
      setEtiquetasVinculadas(prev => prev.filter(e => e.id !== etiquetaId));
      onEtiquetasChanged && onEtiquetasChanged();
    } catch (err) {
      console.error(err);
      alert('Não foi possível remover a etiqueta.');
    }
  };

  const getInitials = (nome) => {
    if (!nome) return 'C';
    return nome
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'aberta': return '#10b981';
      case 'fechada': return '#6b7280';
      case 'em_andamento': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'aberta': return 'Aberta';
      case 'fechada': return 'Fechada';
      case 'em_andamento': return 'Em Andamento';
      default: return status;
    }
  };

  const renderDetalhesTab = () => (
    <div className={styles.tabContent}>
      <div className={styles.contatoHeader}>
        <div className={styles.contatoAvatar}>
          <div className={styles.avatarInitials}>
            {getInitials(contato.nome)}
          </div>
        </div>
        <div className={styles.contatoInfo}>
          <h3 className={styles.contatoNome}>{contato.nome}</h3>
          <p className={styles.contatoId}>ID: {contato.id}</p>
        </div>
        <div className={styles.headerActions}>
          {userRole === 'Administrador' && (
            <button
              className={styles.editButton}
              onClick={() => onEdit(contato)}
              title="Editar contato"
            >
              <Edit2 size={16} />
              Editar
            </button>
          )}
        </div>
      </div>

      <div className={styles.detailsGrid}>
        <div className={styles.detailItem}>
          <div className={styles.detailLabel}>
            <Phone size={16} />
            Telefone
          </div>
          <div className={styles.detailValue}>
            {contato.telefone ? (
              <span>{formatPhone(contato.telefone)}</span>
            ) : (
              <span className={styles.noValue}>-</span>
            )}
          </div>
        </div>

        <div className={styles.detailItem}>
          <div className={styles.detailLabel}>
            <Mail size={16} />
            E-mail
          </div>
          <div className={styles.detailValue}>
            {contato.email ? (
              <span>{contato.email}</span>
            ) : (
              <span className={styles.noValue}>-</span>
            )}
          </div>
        </div>


        <div className={styles.detailItem}>
          <div className={styles.detailLabel}>
            <Calendar size={16} />
            Criado em
          </div>
          <div className={styles.detailValue}>
            {formatDate(contato.created_at)}
          </div>
        </div>

        <div className={styles.detailItem}>
          <div className={styles.detailLabel}>
            <Calendar size={16} />
            Atualizado em
          </div>
          <div className={styles.detailValue}>
            {formatDate(contato.updated_at)}
          </div>
        </div>
      </div>

      {/* Etiquetas */}
      <div className={styles.etiquetasSection}>
        <div className={styles.etiquetasHeader}>
          <h4 className={styles.sectionTitle}>
            <Tag size={16} />
            Etiquetas
          </h4>
          {userRole === 'Administrador' && (
            <button
              className={styles.vincularButton}
              onClick={async () => {
                if (!todasEtiquetas.length) await carregarEtiquetas();
                setShowVincularModal(true);
              }}
              title="Vincular etiqueta"
            >
              <Plus size={14} />
              Vincular
            </button>
          )}
        </div>
        
        <div className={styles.etiquetaList}>
          {isLoadingEtiquetas ? (
            <span className={styles.mutedText}>Carregando...</span>
          ) : etiquetasVinculadas.length === 0 ? (
            <p className={styles.emptyMessage}>Nenhuma etiqueta vinculada</p>
          ) : (
            etiquetasVinculadas.map((et) => (
              <span key={et.id} className={styles.etiquetaPill} style={{ background: et.cor }}>
                <span className={styles.etiquetaName}>{et.nome}</span>
                {userRole === 'Administrador' && (
                  <button 
                    type="button" 
                    onClick={() => desvincularEtiqueta(et.id)} 
                    title="Remover" 
                    className={styles.chipRemoveButton}
                  >
                    <XCircle size={14} />
                  </button>
                )}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Notas Internas */}
      <div className={styles.notasSection}>
        <h4 className={styles.sectionTitle}>
          <FileText size={16} />
          Notas Internas
        </h4>
        {(() => {
          const notas = normalizeNotasInternas(contato.notas_internas);
          
          return notas.length > 0 ? (
            <div className={styles.notasList}>
              {notas.map((nota) => (
                <div key={nota.id} className={styles.notaItem}>
                  <div className={styles.notaContent}>
                    <p>{nota.texto}</p>
                    <small>
                      {nota.usuario} - {formatDate(nota.data)}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.emptyMessage}>Nenhuma nota cadastrada</p>
          );
        })()}
      </div>
    </div>
  );

  const renderConversasTab = () => (
    <div className={styles.tabContent}>
      <div className={styles.sectionHeader}>
        <h4 className={styles.sectionTitle}>
          <MessageSquare size={16} />
          Conversas
        </h4>
        <span className={styles.conversasCount}>
          {conversas.length} conversa{conversas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loadingConversas ? (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Carregando conversas...</p>
        </div>
      ) : error ? (
        <div className={styles.errorMessage}>
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      ) : conversas.length > 0 ? (
        <div className={styles.conversasList}>
          {conversas.map((conversa) => (
            <div key={conversa.id} className={styles.conversaItem}>
              <div className={styles.conversaInfo}>
                <div className={styles.conversaHeader}>
                  <span className={styles.conversaId}>#{conversa.id}</span>
                  <span 
                    className={styles.conversaStatus}
                    style={{ backgroundColor: getStatusColor(conversa.status) }}
                  >
                    {getStatusText(conversa.status)}
                  </span>
                </div>
                <p className={styles.conversaPhone}>{formatPhone(conversa.customer_phone)}</p>
                <p className={styles.conversaDate}>
                  Criada em {formatDate(conversa.created_at)}
                </p>
                {conversa.assigned_user_name && (
                  <p className={styles.conversaUser}>
                    Atribuída a: {conversa.assigned_user_name}
                  </p>
                )}
              </div>
              <div className={styles.conversaActions}>
                <button 
                  className={styles.viewConversaButton}
                  onClick={() => {
                    // TODO: Navegar para a conversa
                    console.log('Navegar para conversa:', conversa.id);
                  }}
                >
                  Ver Conversa
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <MessageSquare size={48} className={styles.emptyIcon} />
          <p>Nenhuma conversa encontrada</p>
          <p className={styles.emptySubtext}>
            Este contato ainda não iniciou nenhuma conversa
          </p>
        </div>
      )}
    </div>
  );

  if (!isOpen || !contato) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Dados do contato</h2>
          <div className={styles.headerActions}>
            <button className={styles.closeButton} onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'detalhes' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('detalhes')}
          >
            <User size={16} />
            Detalhes
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'conversas' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('conversas')}
          >
            <MessageSquare size={16} />
            Conversas
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'arquivos' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('arquivos')}
          >
            <Folder size={16} />
            Arquivos
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'historico' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('historico')}
          >
            <Archive size={16} />
            Histórico
          </button>
        </div>

        <div className={styles.content}>
          {activeTab === 'detalhes' && renderDetalhesTab()}
          {activeTab === 'conversas' && renderConversasTab()}
          {activeTab === 'arquivos' && (
            <div className={styles.tabContent}>
              <div className={styles.emptyState}>
                <Folder size={48} className={styles.emptyIcon} />
                <p>Funcionalidade em desenvolvimento</p>
                <p className={styles.emptySubtext}>
                  Em breve você poderá ver os arquivos compartilhados
                </p>
              </div>
            </div>
          )}
          {activeTab === 'historico' && (
            <div className={styles.tabContent}>
              <div className={styles.emptyState}>
                <Archive size={48} className={styles.emptyIcon} />
                <p>Funcionalidade em desenvolvimento</p>
                <p className={styles.emptySubtext}>
                  Em breve você poderá ver o histórico completo
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal para vincular etiqueta */}
      {showVincularModal && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.header}>
              <h2 className={styles.title} style={{ margin: 0 }}>Vincular etiqueta</h2>
              <button className={styles.closeButton} onClick={() => setShowVincularModal(false)} type="button">
                <X size={20} />
              </button>
            </div>
            <div className={`${styles.form} ${styles.formNoTopPadding}`}>
              <div className={styles.formGroup}>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Buscar etiqueta..."
                  value={filtroEtiqueta}
                  onChange={(e) => setFiltroEtiqueta(e.target.value)}
                />
              </div>
              <div className={styles.vincularLista}>
                {todasEtiquetas
                  .filter(e => !etiquetasVinculadas.find(v => v.id === e.id))
                  .filter(e => e.nome.toLowerCase().includes(filtroEtiqueta.toLowerCase()))
                  .map(e => (
                    <button
                      key={e.id}
                      type="button"
                      disabled={isLinking}
                      onClick={async () => { await vincularEtiqueta(e.id); setShowVincularModal(false); }}
                      className={styles.etiquetaOption}
                    >
                      <span className={styles.etiquetaDot} style={{ width: 14, height: 14, background: e.cor }}></span>
                      {e.nome}
                    </button>
                  ))}
                {todasEtiquetas.filter(e => !etiquetasVinculadas.find(v => v.id === e.id)).length === 0 && (
                  <span className={styles.mutedText}>Nenhuma etiqueta disponível</span>
                )}
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.cancelButton} onClick={() => setShowVincularModal(false)}>Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
