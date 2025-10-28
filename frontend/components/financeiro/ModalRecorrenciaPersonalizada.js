import React, { useState, useCallback, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import styles from "../../styles/financeiro/modal-recorrencia-personalizada.module.css";

// Utility para combinar classes CSS
const cn = (...classes) => classes.filter(Boolean).join(' ');

export default function ModalRecorrenciaPersonalizada({ open, onClose, onConfirm }) {
  const [intervalo, setIntervalo] = useState("1");
  const [tipo, setTipo] = useState("meses");
  const [total, setTotal] = useState("1");
  const [isTipoSelectOpen, setIsTipoSelectOpen] = useState(false);
  
  const modalRef = useRef(null);
  const tipoSelectRef = useRef(null);

  // Handlers para modal e dropdown
  const handleClickOutside = useCallback((event) => {
    if (modalRef.current && !modalRef.current.contains(event.target)) {
      onClose();
    }
  }, [onClose]);

  const handleClickOutsideDropdown = useCallback((event) => {
    if (tipoSelectRef.current && !tipoSelectRef.current.contains(event.target)) {
      setIsTipoSelectOpen(false);
    }
  }, []);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      setIsTipoSelectOpen(false);
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('mousedown', handleClickOutsideDropdown);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('mousedown', handleClickOutsideDropdown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, handleClickOutside, handleClickOutsideDropdown, handleKeyDown]);

  const tipoOptions = [
    { value: "dias", label: "Dia(s)" },
    { value: "semanas", label: "Semana(s)" },
    { value: "meses", label: "Mês(es)" },
    { value: "anos", label: "Ano(s)" }
  ];

  if (!open) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleClickOutside}>
      <div className={cn(styles.modalContent, styles.modalRecorrenciaPersonalizada)} ref={modalRef}>
        <div className={styles.modalHeader}>
          <h2 className={cn(styles.modalTitleComponent, styles.modalRecorrenciaTitle)}>
            Recorrência
          </h2>
        </div>
        <div className="space-y-6">
          <div>
            <div className={`font-medium mb-2 ${styles.modalRecorrenciaDescription}`}>Frequência da recorrência</div>
            <div className="flex gap-2 items-end">
              <div>
                <label className={cn(styles.labelComponent, styles.modalRecorrenciaLabel)}>
                  Repetir a cada *
                </label>
                <input
                  type="number" 
                  min={1} 
                  value={intervalo} 
                  onChange={e => setIntervalo(e.target.value)}
                  className={cn(styles.inputComponent, styles.modalRecorrenciaInput)}
                />
              </div>
              <div>
                <label className={cn(styles.labelComponent, styles.modalRecorrenciaLabel)}>
                  Frequência *
                </label>
                <div className={styles.selectComponent} ref={tipoSelectRef}>
                  <div
                    className={cn(styles.selectTriggerComponent, styles.modalRecorrenciaSelectTrigger)}
                    onClick={() => setIsTipoSelectOpen(!isTipoSelectOpen)}
                  >
                    <span>
                      {tipoOptions.find(option => option.value === tipo)?.label || "Selecione..."}
                    </span>
                    <ChevronDown className={cn(styles.selectIcon, isTipoSelectOpen && styles.selectIconOpen)} />
                  </div>
                  {isTipoSelectOpen && (
                    <div className={cn(styles.selectContentComponent, styles.modalRecorrenciaSelectContent)}>
                      {tipoOptions.map((option) => (
                        <div
                          key={option.value}
                          className={cn(styles.selectItemComponent, styles.modalRecorrenciaSelectItem)}
                          onClick={() => {
                            setTipo(option.value);
                            setIsTipoSelectOpen(false);
                          }}
                        >
                          {option.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
              <input
                type="number" 
                min={1} 
                value={total} 
                onChange={e => setTotal(e.target.value)} 
                className={cn(styles.inputComponent, styles.modalRecorrenciaInput, "w-20")}
              />
              <span className={styles.modalRecorrenciaRadioText}>Ocorrências</span>
            </div>
          </div>
        </div>
        <div className={cn(styles.modalFooter, styles.modalRecorrenciaFooter)}>
          <button
            type="button"
            onClick={onClose}
            className={cn(styles.buttonComponent, styles.buttonComponentOutline, styles.modalRecorrenciaCancelBtn)}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              console.log("🔄 Modal: Dados enviados:", { intervalo, tipo, total });
              onConfirm({ intervalo, tipo, total });
            }}
            className={cn(styles.buttonComponent, styles.buttonComponentPrimary, styles.modalRecorrenciaConfirmBtn)}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
} 