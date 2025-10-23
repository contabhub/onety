'use client';

import { useState, useEffect } from 'react';
import { Button } from './botao';
import { Input } from './input';
import { Label } from './label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { X } from 'lucide-react';
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
    } else {
      setFormData({
        codigo: '',
        nome: '',
        situacao: 'Ativo'
      });
    }
  }, [isEditing, centro, isOpen]);

  const handleSave = () => {
    if (!formData.nome.trim()) {
      alert('O nome é obrigatório');
      return;
    }

    onSave(formData);
    onClose();
    
    // Reset form
    setFormData({
      codigo: '',
      nome: '',
      situacao: 'Ativo'
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleClose = () => {
    onClose();
    // Reset form
    setFormData({
      codigo: '',
      nome: '',
      situacao: 'Ativo'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={`${styles.modal} sm:max-w-[600px] max-h-[90vh] overflow-y-auto [&>button]:${styles.closeBtn}`}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className={styles.title}>{isEditing ? 'Editar centro de custo' : 'Novo centro de custo'}</DialogTitle>
          </div>
        </DialogHeader>
        
        <div className={styles.container}>
          <div>
            <h3 className={styles.subtitle}>Informações gerais</h3>
            
            <div className={styles.gridTwoColumns}>
              <div className={styles.fieldContainer}>
                <Label htmlFor="codigo" className={styles.label}>Código</Label>
                <Input
                  id="codigo"
                  value={formData.codigo}
                  onChange={(e) => handleInputChange('codigo', e.target.value)}
                  placeholder="Digite o código"
                  className={styles.input}
                />
              </div>

              <div className={styles.fieldContainer}>
                <Label htmlFor="nome" className={styles.label}>Nome *</Label>
                <Input
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
                <Label htmlFor="situacao" className={styles.label}>Situação</Label>
                <select 
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
          <Button 
            variant="outline" 
            onClick={handleClose}
            className={styles.cancelBtn}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            className={styles.saveBtn}
          >
            {isEditing ? 'Atualizar' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}