import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './dialog';
import { Button } from './botao';
import { Input } from './input';
import { Label } from './label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { toast } from 'react-toastify';
import { Upload } from 'lucide-react';
import styles from '../../styles/financeiro/NovaTransferenciaModal.module.css';

export function NovaTransferenciaModal({ isOpen, onClose, onSuccess }) {
  const [contas, setContas] = useState([]);
  const [contaOrigem, setContaOrigem] = useState('');
  const [contaDestino, setContaDestino] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dataTransferencia, setDataTransferencia] = useState('');
  const [anexo, setAnexo] = useState(null);
  const [anexoBase64, setAnexoBase64] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const empresaId = localStorage.getItem('empresaId');
    const token = localStorage.getItem('token');
    if (!empresaId || !token) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/contas/empresa/${empresaId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setContas(
          Array.isArray(data)
            ? data.map((c) => ({ id: String(c.id), nome: c.descricao_banco || c.banco || 'Conta sem descrição' }))
            : []
        );
      });
  }, [isOpen]);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    setAnexo(file || null);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setAnexoBase64(reader.result);
      reader.readAsDataURL(file);
    } else {
      setAnexoBase64(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const empresaId = localStorage.getItem('empresaId');
    const token = localStorage.getItem('token');
    if (!empresaId || !token) {
      toast.error('Token ou empresaId não encontrado.');
      return;
    }
    if (!contaOrigem || !contaDestino || !valor || !dataTransferencia) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    if (contaOrigem === contaDestino) {
      toast.error('Conta de origem e destino não podem ser iguais.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transferencias`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conta_origem_id: contaOrigem,
          conta_destino_id: contaDestino,
          descricao,
          valor: parseFloat(valor.replace(',', '.')),
          data_transferencia: dataTransferencia,
          anexo_base64: anexoBase64,
          company_id: empresaId,
        }),
      });
      if (res.ok) {
        toast.success('Transferência realizada com sucesso!');
        onSuccess();
        onClose();
        // Limpar campos
        setContaOrigem(''); setContaDestino(''); setDescricao(''); setValor(''); setDataTransferencia(''); setAnexo(null); setAnexoBase64(null);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Erro ao realizar transferência.');
      }
    } catch (err) {
      toast.error('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle className={styles.dialogTitle}>Nova transferência entre contas</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className={styles.formContainer}>
          <div className={styles.fieldContainer}>
            <Label className={styles.label}>Conta de origem *</Label>
            <Select value={contaOrigem} onValueChange={setContaOrigem}>
              <SelectTrigger className={styles.selectTrigger}>
                <SelectValue placeholder="Selecione a conta de origem" />
              </SelectTrigger>
              <SelectContent className={styles.selectContent}>
                {contas.map((c) => (
                  <SelectItem key={c.id} value={c.id} className={styles.selectItem}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={styles.fieldContainer}>
            <Label className={styles.label}>Conta de destino *</Label>
            <Select value={contaDestino} onValueChange={setContaDestino}>
              <SelectTrigger className={styles.selectTrigger}>
                <SelectValue placeholder="Selecione a conta de destino" />
              </SelectTrigger>
              <SelectContent className={styles.selectContent}>
                {contas.map((c) => (
                  <SelectItem key={c.id} value={c.id} className={styles.selectItem}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={styles.fieldContainer}>
            <Label className={styles.label}>Descrição</Label>
            <Input 
              value={descricao} 
              onChange={e => setDescricao(e.target.value)} 
              placeholder="Descrição da transferência" 
              className={styles.input}
            />
          </div>
          <div className={styles.fieldContainer}>
            <Label className={styles.label}>Data da transferência *</Label>
            <Input 
              type="date" 
              value={dataTransferencia} 
              onChange={e => setDataTransferencia(e.target.value)} 
              className={styles.input}
            />
          </div>
          <div className={styles.fieldContainer}>
            <Label className={styles.label}>Valor *</Label>
            <Input 
              type="number" 
              min="0" 
              step="0.01" 
              value={valor} 
              onChange={e => setValor(e.target.value)} 
              placeholder="0,00" 
              className={styles.input}
            />
          </div>
          <div className={styles.fieldContainer}>
            <Label className={styles.label}>Anexar comprovante</Label>
            <Input 
              type="file" 
              accept="image/*,application/pdf" 
              onChange={handleFileChange} 
              className={styles.fileInput}
            />
            {anexo && <span className={styles.fileName}>{anexo.name}</span>}
          </div>
          <DialogFooter className={styles.dialogFooter}>
            <Button 
              variant="outline" 
              type="button" 
              onClick={onClose} 
              disabled={loading}
              className={`${styles.button} ${styles.buttonOutline}`}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className={`${styles.button} ${styles.buttonPrimary}`}
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}