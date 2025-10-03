import React, { useEffect, useMemo, useState } from 'react';
import styles from './Webhooks.module.css';
import { ArrowLeft, Plus, Edit, Trash2, X } from 'lucide-react';

const PALETTE = [
  '#F3F4F6','#E5E7EB','#D1D5DB','#9CA3AF','#6B7280','#374151','#111827',
  '#FEE2E2','#FCA5A5','#F87171','#EF4444','#DC2626','#B91C1C','#7F1D1D',
  '#FFEDD5','#FBD38D','#FBBF24','#F59E0B','#D97706','#B45309','#92400E',
  '#FEF3C7','#FDE68A','#FCD34D','#FBBF24','#F59E0B','#D97706','#92400E',
  '#ECFCCB','#D9F99D','#A7F3D0','#34D399','#10B981','#059669','#065F46',
  '#E0F2FE','#93C5FD','#60A5FA','#3B82F6','#2563EB','#1D4ED8','#1E40AF',
  '#EDE9FE','#DDD6FE','#C4B5FD','#A78BFA','#8B5CF6','#7C3AED','#5B21B6',
  '#FCE7F3','#F9A8D4','#F472B6','#EC4899','#DB2777','#BE185D','#831843',
  '#F3E8FF','#E9D5FF','#D8B4FE','#C084FC','#A855F7','#9333EA','#7E22CE',
  '#F5F5F4','#E7E5E4','#D6D3D1','#A8A29E','#78716C','#57534E','#292524'
];

export default function Etiquetas() {
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nome: '', cor: '#3B82F6' });

  const companyId = useMemo(() => {
    try {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      return userData.EmpresaId;
    } catch (_) { return null; }
  }, []);

  const headers = useMemo(() => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
  }), []);

  const loadLabels = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/atendimento/etiquetas/empresa/${companyId}`, { headers });
      const data = await res.json();
      setLabels(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Erro ao carregar etiquetas', e);
      alert('Erro ao carregar etiquetas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) loadLabels();
  }, [companyId]);

  const openModal = (label = null) => {
    if (label) {
      setEditing(label);
      setForm({ nome: label.nome, cor: label.cor });
    } else {
      setEditing(null);
      setForm({ nome: '', cor: '#3B82F6' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm({ nome: '', cor: '#3B82F6' });
  };

  const save = async () => {
    try {
      if (!form.nome || !form.cor) return alert('Informe o nome e a cor.');
      const url = editing
        ? `${process.env.NEXT_PUBLIC_API_URL}/atendimento/etiquetas/${editing.id}`
        : `${process.env.NEXT_PUBLIC_API_URL}/atendimento/etiquetas`;
      const method = editing ? 'PUT' : 'POST';
      const body = editing ? { nome: form.nome, cor: form.cor } : { empresa_id: companyId, nome: form.nome, cor: form.cor };
      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao salvar etiqueta');
      }
      closeModal();
      await loadLabels();
    } catch (e) {
      alert(e.message);
    }
  };

  const remove = async (id) => {
    if (!confirm('Remover esta etiqueta?')) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/atendimento/etiquetas/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('Erro ao remover etiqueta');
      await loadLabels();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Etiquetas</h1>
          <p className={styles.subtitle}>{labels.length} etiqueta{labels.length !== 1 ? 's' : ''}</p>
        </div>
        <button className={styles.newButton} onClick={() => openModal()}>
          <Plus size={16} />
          Nova etiqueta
        </button>
      </div>

      <div className={styles.webhooksList}>
        {loading ? (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Carregando etiquetas...</p>
          </div>
        ) : labels.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🏷️</div>
            <h3>Nenhuma etiqueta</h3>
            <p>Crie etiquetas para organizar seus contatos</p>
            <button className={styles.emptyButton} onClick={() => openModal()}>Criar primeira etiqueta</button>
          </div>
        ) : (
          labels.map(label => (
            <div key={label.id} className={styles.webhookItem}>
              <div className={styles.webhookInfo}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ width:20, height:20, borderRadius:9999, background:label.cor, border:'1px solid var(--color-form-border)' }}></span>
                  <h3 className={styles.webhookName}>{label.nome}</h3>
                </div>
                <p className={styles.webhookDate}>Criada em {new Date(label.criado_em).toLocaleDateString('pt-BR')}</p>
              </div>
              <div className={styles.webhookActions}>
                <div className={styles.actionButtons}>
                  <button className={styles.actionButton} onClick={() => openModal(label)} title="Editar">
                    <Edit size={16} />
                  </button>
                  <button className={styles.actionButton} onClick={() => remove(label.id)} title="Excluir">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>{editing ? 'Editar etiqueta' : 'Criando nova etiqueta'}</h2>
              <button className={styles.closeButton} onClick={closeModal}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalContent}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Nome</label>
                <input
                  type="text"
                  maxLength={50}
                  className={styles.input}
                  placeholder="Nome da etiqueta"
                  value={form.nome}
                  onChange={(e) => setForm(prev => ({ ...prev, nome: e.target.value }))}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Cor</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:12 }}>
                  {PALETTE.map((hex) => (
                    <button
                      key={hex}
                      onClick={() => setForm(prev => ({ ...prev, cor: hex }))}
                      style={{
                        width:32, height:32, borderRadius:9999,
                        background: hex,
                        border: form.cor === hex ? '2px solid var(--color-primary)' : '1px solid var(--color-form-border)'
                      }}
                      aria-label={`Selecionar cor ${hex}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelButton} onClick={closeModal}>Cancelar</button>
              <button className={styles.saveButton} onClick={save}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


