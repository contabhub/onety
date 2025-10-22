import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./dialog";
import { Button } from "./botao";
import { Input } from "./input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./select";
import styles from "../../styles/financeiro/modal-recorrencia-personalizada.module.css";

export default function ModalRecorrenciaPersonalizada({ open, onClose, onConfirm }) {
  const [intervalo, setIntervalo] = useState("1");
  const [tipo, setTipo] = useState("meses");
  const [total, setTotal] = useState("1");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={`max-w-md ${styles.modalRecorrenciaPersonalizada}`}>
        <DialogHeader>
          <DialogTitle className={styles.modalRecorrenciaTitle}>Recorrência</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div>
            <div className={`font-medium mb-2 ${styles.modalRecorrenciaDescription}`}>Frequência da recorrência</div>
            <div className="flex gap-2 items-end">
              <div>
                <label className={`block text-sm mb-1 ${styles.modalRecorrenciaLabel}`}>Repetir a cada *</label>
                <Input 
                  type="number" 
                  min={1} 
                  value={intervalo} 
                  onChange={e => setIntervalo(e.target.value)}
                  className={styles.modalRecorrenciaInput}
                />
              </div>
              <div>
                <label className={`block text-sm mb-1 ${styles.modalRecorrenciaLabel}`}>Frequência *</label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger className={styles.modalRecorrenciaSelectTrigger}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={styles.modalRecorrenciaSelectContent}>
                    <SelectItem value="dias" className={styles.modalRecorrenciaSelectItem}>Dia(s)</SelectItem>
                    <SelectItem value="semanas" className={styles.modalRecorrenciaSelectItem}>Semana(s)</SelectItem>
                    <SelectItem value="meses" className={styles.modalRecorrenciaSelectItem}>Mês(es)</SelectItem>
                    <SelectItem value="anos" className={styles.modalRecorrenciaSelectItem}>Ano(s)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div>
            <div className={`font-medium mb-2 ${styles.modalRecorrenciaDescription}`}>Término da recorrência</div>
            <div className="flex items-center gap-2">
              <input 
                type="radio" 
                checked 
                readOnly 
                className={styles.modalRecorrenciaRadio}
              />
              <Input 
                type="number" 
                min={1} 
                value={total} 
                onChange={e => setTotal(e.target.value)} 
                className={`w-20 ${styles.modalRecorrenciaInput}`} 
              />
              <span className={styles.modalRecorrenciaRadioText}>Ocorrências</span>
            </div>
          </div>
        </div>
        <DialogFooter className={styles.modalRecorrenciaFooter}>
          <Button 
            variant="outline" 
            onClick={onClose}
            className={styles.modalRecorrenciaCancelBtn}
          >
            Cancelar
          </Button>
          <Button 
            onClick={() => {
              console.log("🔄 Modal: Dados enviados:", { intervalo, tipo, total });
              onConfirm({ intervalo, tipo, total });
            }} 
            className={styles.modalRecorrenciaConfirmBtn}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 