import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Button } from './botao';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';
import styles from '../../styles/financeiro/DetalhesContratoDrawer.module.css';

export function EditarVencimentoContratoModal({
  isOpen,
  onClose,
  contratoId,
  dataAtual,
  onConfirm
}) {
  const [novaData, setNovaData] = useState();
  const [opcaoSelecionada, setOpcaoSelecionada] = useState('apenas');

  useEffect(() => {
    if (isOpen && dataAtual) {
      setNovaData(new Date(dataAtual));
      setOpcaoSelecionada('apenas');
    }
  }, [isOpen, dataAtual]);

  const handleConfirmar = () => {
    if (!novaData) {
      toast({
        title: "Erro",
        description: "Selecione uma data.",
        variant: "destructive",
      });
      return;
    }

    console.log("🔍 Modal - Opção selecionada:", opcaoSelecionada);
    console.log("🔍 Modal - Nova data:", novaData);

    // Chamar callback para abrir o drawer de edição
    onConfirm?.(contratoId, opcaoSelecionada, novaData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={styles.drawerContent}>
        <DialogHeader className={styles.drawerHeader}>
          <DialogTitle className={styles.headerTitle}>Editar contrato</DialogTitle>
        </DialogHeader>

        <div className={styles.drawerContentArea}>
          <p className={styles.textSecondary}>
            Escolha em quais vendas as edições a serem feitas devem ser aplicadas:
          </p>

          <div className={styles.configSection}>
            <label className={`${styles.configRow} cursor-pointer`}>
              <input
                type="radio"
                name="opcao"
                value="apenas"
                checked={opcaoSelecionada === 'apenas'}
                onChange={(e) => {
                  console.log("🔍 Radio 'apenas' selecionado:", e.target.value);
                  setOpcaoSelecionada(e.target.value);
                }}
                className={styles.input}
                style={{ width: '16px', height: '16px', marginRight: '12px' }}
              />
              <span className={styles.textMain}>
                Editar apenas a venda prevista para {dataAtual ? format(new Date(dataAtual), 'dd/MM/yyyy', { locale: ptBR }) : ''}
              </span>
            </label>

            <label className={`${styles.configRow} cursor-pointer`}>
              <input
                type="radio"
                name="opcao"
                value="todas"
                checked={opcaoSelecionada === 'todas'}
                onChange={(e) => {
                  console.log("🔍 Radio 'todas' selecionado:", e.target.value);
                  setOpcaoSelecionada(e.target.value);
                }}
                className={styles.input}
                style={{ width: '16px', height: '16px', marginRight: '12px' }}
              />
              <span className={styles.textMain}>
                Editar todas as próximas vendas do contrato
              </span>
            </label>
          </div>

          <div className={styles.configSection}>
            <label className={styles.label}>Nova data de vencimento:</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`${styles.buttonOutline} w-full justify-start text-left font-normal ${
                    !novaData ? styles.textSecondary : styles.textMain
                  }`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {novaData ? format(novaData, 'dd/MM/yyyy', { locale: ptBR }) : "Selecione uma data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className={`${styles.card} w-auto p-0`} align="start">
                <Calendar
                  mode="single"
                  selected={novaData}
                  onSelect={setNovaData}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className={styles.drawerFooter}>
          <Button variant="outline" onClick={onClose} className={styles.buttonOutline}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirmar}
            className={styles.buttonGreen}
          >
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
