import { useState, useEffect } from 'react';
// Componentes externos removidos - usando HTML nativo
import { toast } from 'react-toastify';
import { ChevronDown } from 'lucide-react';
import styles from '../../styles/financeiro/NovaTransferenciaModal.module.css';

// Função cn para combinar classes CSS
const cn = (...classes) => classes.filter(Boolean).join(' ');

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
  // Estados para controlar dropdowns customizados
  const [isOrigemSelectOpen, setIsOrigemSelectOpen] = useState(false);
  const [isDestinoSelectOpen, setIsDestinoSelectOpen] = useState(false);

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

  // Efeito para fechar selects quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.selectComponent')) {
        setIsOrigemSelectOpen(false);
        setIsDestinoSelectOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
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

  // Função para fechar modal ao clicar no overlay
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={cn(styles.modalContent, styles.dialogContent)}>
        <div className={cn(styles.modalHeader)}>
          <h2 className={cn(styles.modalTitle, styles.dialogTitle)}>Nova transferência entre contas</h2>
        </div>
        <form onSubmit={handleSubmit} className={styles.formContainer}>
          <div className={styles.fieldContainer}>
            <label className={cn(styles.labelComponent, styles.label)}>Conta de origem *</label>
            <div className={cn(styles.selectComponent)}>
              <button
                type="button"
                onClick={() => setIsOrigemSelectOpen(!isOrigemSelectOpen)}
                className={cn(styles.selectTriggerComponent, styles.selectTrigger)}
              >
                <span className={contaOrigem ? styles.selectValue : styles.selectPlaceholder}>
                  {contaOrigem
                    ? contas.find(c => c.id === contaOrigem)?.nome || "Conta não encontrada"
                    : "Selecione a conta de origem"}
                </span>
                <ChevronDown className={cn(styles.selectIcon, isOrigemSelectOpen && styles.selectIconOpen)} />
              </button>
              {isOrigemSelectOpen && (
                <div className={cn(styles.selectContentComponent, styles.selectContent)}>
                  {contas.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setContaOrigem(c.id);
                        setIsOrigemSelectOpen(false);
                      }}
                      className={cn(styles.selectItemComponent, styles.selectItem)}
                    >
                      {c.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className={styles.fieldContainer}>
            <label className={cn(styles.labelComponent, styles.label)}>Conta de destino *</label>
            <div className={cn(styles.selectComponent)}>
              <button
                type="button"
                onClick={() => setIsDestinoSelectOpen(!isDestinoSelectOpen)}
                className={cn(styles.selectTriggerComponent, styles.selectTrigger)}
              >
                <span className={contaDestino ? styles.selectValue : styles.selectPlaceholder}>
                  {contaDestino
                    ? contas.find(c => c.id === contaDestino)?.nome || "Conta não encontrada"
                    : "Selecione a conta de destino"}
                </span>
                <ChevronDown className={cn(styles.selectIcon, isDestinoSelectOpen && styles.selectIconOpen)} />
              </button>
              {isDestinoSelectOpen && (
                <div className={cn(styles.selectContentComponent, styles.selectContent)}>
                  {contas.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setContaDestino(c.id);
                        setIsDestinoSelectOpen(false);
                      }}
                      className={cn(styles.selectItemComponent, styles.selectItem)}
                    >
                      {c.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className={styles.fieldContainer}>
            <label className={cn(styles.labelComponent, styles.label)}>Descrição</label>
            <input 
              type="text"
              value={descricao} 
              onChange={e => setDescricao(e.target.value)} 
              placeholder="Descrição da transferência" 
              className={cn(styles.inputComponent, styles.input)}
            />
          </div>
          <div className={styles.fieldContainer}>
            <label className={cn(styles.labelComponent, styles.label)}>Data da transferência *</label>
            <input 
              type="date" 
              value={dataTransferencia} 
              onChange={e => setDataTransferencia(e.target.value)} 
              className={cn(styles.inputComponent, styles.input)}
            />
          </div>
          <div className={styles.fieldContainer}>
            <label className={cn(styles.labelComponent, styles.label)}>Valor *</label>
            <input 
              type="number" 
              min="0" 
              step="0.01" 
              value={valor} 
              onChange={e => setValor(e.target.value)} 
              placeholder="0,00" 
              className={cn(styles.inputComponent, styles.input)}
            />
          </div>
          <div className={styles.fieldContainer}>
            <label className={cn(styles.labelComponent, styles.label)}>Anexar comprovante</label>
            <input 
              type="file" 
              accept="image/*,application/pdf" 
              onChange={handleFileChange} 
              className={styles.fileInput}
            />
            {anexo && <span className={styles.fileName}>{anexo.name}</span>}
          </div>
          <div className={cn(styles.modalFooter, styles.dialogFooter)}>
            <button 
              type="button" 
              onClick={onClose} 
              disabled={loading}
              className={cn(styles.buttonComponent, styles.buttonComponentOutline, styles.button, styles.buttonOutline)}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className={cn(styles.buttonComponent, styles.buttonComponentPrimary, styles.button, styles.buttonPrimary)}
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}