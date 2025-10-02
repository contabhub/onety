import { useState, useEffect } from 'react';
import styles from './ContatoModal.module.css';
import { X, User, Mail, Phone, FileText, Tag, Plus, XCircle } from 'lucide-react';
import { normalizeNotasInternas } from '../../../utils/contactHelper';

export default function ContatoModal({ isOpen, onClose, onSuccess, contato = null, isEdit = false }) {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    notas_internas: []
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showNotasInternas, setShowNotasInternas] = useState(false);
  const [novaNota, setNovaNota] = useState('');
  const [etiquetasVinculadas, setEtiquetasVinculadas] = useState([]);
  const [todasEtiquetas, setTodasEtiquetas] = useState([]);
  const [isLoadingEtiquetas, setIsLoadingEtiquetas] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [showVincularModal, setShowVincularModal] = useState(false);
  const [filtroEtiqueta, setFiltroEtiqueta] = useState('');

  // Preencher formulário quando editando
  useEffect(() => {
    if (isEdit && contato) {
      setFormData({
        nome: contato.nome || '',
        email: contato.email || '',
        telefone: contato.telefone || '',
        notas_internas: normalizeNotasInternas(contato.notas_internas)
      });
    } else {
      // Reset form para criação
      setFormData({
        nome: '',
        email: '',
        telefone: '',
        notas_internas: []
      });
    }
    setError(null);
    setNovaNota('');
    setShowNotasInternas(false);
    // Carregar etiquetas quando abrir o modal em modo edição
    if (isOpen && contato && contato.id) {
      carregarEtiquetas();
    } else {
      setEtiquetasVinculadas([]);
    }
  }, [isEdit, contato, isOpen]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePhoneChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    
    // Limitar a 11 dígitos (DDD + 9 dígitos)
    if (value.length > 11) {
      value = value.substring(0, 11);
    }
    
    setFormData(prev => ({
      ...prev,
      telefone: value
    }));
  };

  const formatPhoneDisplay = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length <= 2) {
      return `(${cleaned}`;
    } else if (cleaned.length <= 7) {
      return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2)}`;
    } else {
      return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7, 11)}`;
    }
  };

  const adicionarNota = () => {
    if (novaNota.trim()) {
      // Obter nome do usuário do localStorage ou usar padrão
      const userName = localStorage.getItem('userName') || 'Usuário';
      
      const nota = {
        id: Date.now(),
        texto: novaNota.trim(),
        data: new Date().toISOString(),
        usuario: userName
      };
      
      setFormData(prev => ({
        ...prev,
        notas_internas: [...prev.notas_internas, nota]
      }));
      
      setNovaNota('');
    }
  };

  const removerNota = (notaId) => {
    setFormData(prev => ({
      ...prev,
      notas_internas: prev.notas_internas.filter(nota => nota.id !== notaId)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      setError('Nome é obrigatório');
      return;
    }

    if (formData.email && !isValidEmail(formData.email)) {
      setError('Email inválido');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const companyId = JSON.parse(localStorage.getItem('userData') || '{}').companyId;
      const token = localStorage.getItem('token');
      
      // Preparar dados para envio
      const dataToSend = {
        nome: formData.nome.trim(),
        email: formData.email.trim() || null,
        telefone: formData.telefone || null,
        notas_internas: formData.notas_internas,
        company_id: parseInt(companyId)
      };

      const url = isEdit 
        ? `${apiUrl}/contacts/${contato.id}`
        : `${apiUrl}/contacts`;
      
      const method = isEdit ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSend)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar contato');
      }

      const result = await response.json();
      
      // Chamar callback de sucesso com os dados retornados pelo backend
      onSuccess(result);
      
      // Fechar modal
      onClose();
      
    } catch (err) {
      console.error('Erro ao salvar contato:', err);
      setError(err.message || 'Erro ao salvar contato');
    } finally {
      setLoading(false);
    }
  };

  // ===== Etiquetas: listar, vincular, desvincular =====
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
    } catch (err) {
      console.error(err);
      alert('Não foi possível remover a etiqueta.');
    }
  };

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {isEdit ? 'Editar Contato' : 'Novo Contato'}
          </h2>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          
          <div className={styles.formGroup}>
            <label className={styles.label}>
              <User size={16} />
              Nome *
            </label>
            <input
              type="text"
              name="nome"
              value={formData.nome}
              onChange={handleInputChange}
              className={styles.input}
              placeholder="Digite o nome completo"
              required
              maxLength={250}
            />
            <div className={styles.charCount}>
              {formData.nome.length}/250
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              <Mail size={16} />
              E-mail
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={styles.input}
              placeholder="Digite o e-mail"
              maxLength={250}
            />
            <div className={styles.charCount}>
              {formData.email.length}/250
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup} style={{ flex: '0 0 140px' }}>
              <label className={styles.label}>DDI</label>
              <select className={styles.select} defaultValue="+55">
                <option value="+55">+55 (Brasil)</option>
              </select>
            </div>
            
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label className={styles.label}>
                <Phone size={16} />
                Número
              </label>
              <input
                type="text"
                name="telefone"
                value={formatPhoneDisplay(formData.telefone)}
                onChange={handlePhoneChange}
                className={styles.input}
                placeholder="(11) 99999-9999"
                maxLength={15}
              />
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
          {/* Etiquetas do contato (posicionada acima de Notas internas) */}
          {isEdit && (
            <div className={styles.formGroup}>
              <div className={styles.etiquetasHeader}>
                <label className={styles.labelNoMargin}>
                  <Tag size={16} /> Etiquetas
                </label>
                <button
                  type="button"
                  title="Vincular etiqueta"
                  onClick={async () => {
                    if (!todasEtiquetas.length) await carregarEtiquetas();
                    setShowVincularModal(true);
                  }}
                  className={styles.vincularButton}
                >
                  <Plus size={14} /> Vincular
                </button>
              </div>
              <div className={styles.etiquetaList}>
                {isLoadingEtiquetas ? (
                  <span className={styles.mutedText}>Carregando...</span>
                ) : etiquetasVinculadas.length === 0 ? (
                  <span className={styles.mutedText}>Nenhuma etiqueta</span>
                ) : (
                  etiquetasVinculadas.map((et) => (
                    <span key={et.id} className={styles.etiquetaPill} style={{ background: et.cor }}>
                      <span className={styles.etiquetaName}>{et.nome}</span>
                      <button type="button" onClick={() => desvincularEtiqueta(et.id)} title="Remover" className={styles.chipRemoveButton}>
                        <XCircle size={14} />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          )}


          {/* Notas Internas */}
          <div className={styles.formGroup}>
            <button
              type="button"
              className={styles.notasToggle}
              onClick={() => setShowNotasInternas(!showNotasInternas)}
            >
              <FileText size={16} />
              Notas internas
              <span className={styles.toggleIcon}>
                {showNotasInternas ? '▲' : '▼'}
              </span>
            </button>
            
            {showNotasInternas && (
              <div className={styles.notasSection}>
                {formData.notas_internas.length > 0 && (
                  <div className={styles.notasList}>
                    {formData.notas_internas.map((nota) => (
                      <div key={nota.id} className={styles.notaItem}>
                        <div className={styles.notaContent}>
                          <p>{nota.texto}</p>
                          <small>
                            {nota.usuario} - {new Date(nota.data).toLocaleString('pt-BR')}
                          </small>
                        </div>
                        <button
                          type="button"
                          className={styles.removeNotaButton}
                          onClick={() => removerNota(nota.id)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className={styles.addNotaSection}>
                  <textarea
                    value={novaNota}
                    onChange={(e) => setNovaNota(e.target.value)}
                    className={styles.textarea}
                    placeholder="Adicionar nova nota interna..."
                    rows={2}
                  />
                  <button
                    type="button"
                    className={styles.addNotaButton}
                    onClick={adicionarNota}
                    disabled={!novaNota.trim()}
                  >
                    Adicionar Nota
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.saveButton}
              disabled={loading || !formData.nome.trim()}
            >
              {loading ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Salvar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
