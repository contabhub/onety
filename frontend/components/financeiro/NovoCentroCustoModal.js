'use client';

import { useState, useEffect } from 'react';
import styles from '../../styles/financeiro/NovoCentroCustoModal.module.css';

export function NovoCentroCustoModal({ isOpen, onClose, onSave, centro, isEditing = false }) {
  const [formData, setFormData] = useState({
    codigo: '',
    nome: '',
    situacao: 'Ativo'
  });

  // Preencher formulário quando estiver editando
  useEffect(() => {
    if (isEditing && centro) {
      setFormData({
        codigo: centro.codigo || '',
        nome: centro.nome || '',
        situacao: centro.situacao || 'Ativo'
      });
    } else if (!isEditing) {
      // Reset apenas quando não está editando
      setFormData({
        codigo: '',
        nome: '',
        situacao: 'Ativo'
      });
    }
  }, [isEditing, centro, isOpen]);

  const handleSave = () => {
    if (!formData.nome.trim()) {
      // Usar toast em vez de alert para consistência
      console.error('Nome é obrigatório');
      return;
    }

    // Chamar onSave com os dados formatados corretamente
    onSave(formData);
    
    // Não fechar automaticamente - deixar o componente pai controlar
    // onClose será chamado após sucesso na requisição
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleClose = () => {
    onClose();
    // Reset form apenas quando fechando
    setFormData({
      codigo: '',
      nome: '',
      situacao: 'Ativo'
    });
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleClose}>
      <div className={`${styles.modal} sm:max-w-[600px] max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className="flex items-center justify-between">
            <h2 className={styles.title}>{isEditing ? 'Editar centro de custo' : 'Novo centro de custo'}</h2>
          </div>
        </div>
        
        <div className={styles.container}>
          <div>
            <h3 className={styles.subtitle}>Informações gerais</h3>
            
            <div className={styles.gridTwoColumns}>
              <div className={styles.fieldContainer}>
                <label htmlFor="codigo" className={styles.label}>Código</label>
                <input
                  type="text"
                  id="codigo"
                  value={formData.codigo}
                  onChange={(e) => handleInputChange('codigo', e.target.value)}
                  placeholder="Digite o código (opcional)"
                  className={styles.input}
                />
              </div>

              <div className={styles.fieldContainer}>
                <label htmlFor="nome" className={styles.label}>Nome *</label>
                <input
                  type="text"
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => handleInputChange('nome', e.target.value)}
                  placeholder="Digite o nome do centro de custo"
                  required
                  className={styles.input}
                />
              </div>
            </div>

            <div className={styles.grid}>
              <div className={styles.fieldContainer}>
                <label htmlFor="situacao" className={styles.label}>Situação</label>
                <select 
                  id="situacao"
                  value={formData.situacao} 
                  onChange={(e) => handleInputChange('situacao', e.target.value)}
                  className={styles.select}
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.buttonsContainer}>
          <button 
            type="button"
            onClick={handleClose}
            className={styles.cancelBtn}
          >
            Cancelar
          </button>
          <button 
            type="button"
            onClick={handleSave} 
            className={styles.saveBtn}
          >
            {isEditing ? 'Atualizar' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}