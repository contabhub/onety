"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import styles from "../../styles/financeiro/ExportarReceber.module.css";
import { Download, Loader2, ChevronDown } from "lucide-react";
import { toast } from "react-toastify";

// Utility para combinar classes CSS
const cn = (...classes) => classes.filter(Boolean).join(' ');

export function ExportarReceber({ isOpen, onClose }) {
  const [tipoExportacao, setTipoExportacao] = useState("todos");
  const [mesSelecionado, setMesSelecionado] = useState("");
  const [anoSelecionado, setAnoSelecionado] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isMesSelectOpen, setIsMesSelectOpen] = useState(false);
  const [isAnoSelectOpen, setIsAnoSelectOpen] = useState(false);
  
  const modalRef = useRef(null);
  const mesSelectRef = useRef(null);
  const anoSelectRef = useRef(null);

  const API = process.env.NEXT_PUBLIC_API_URL;

  const meses = [
    { value: "1", label: "Janeiro" },
    { value: "2", label: "Fevereiro" },
    { value: "3", label: "Março" },
    { value: "4", label: "Abril" },
    { value: "5", label: "Maio" },
    { value: "6", label: "Junho" },
    { value: "7", label: "Julho" },
    { value: "8", label: "Agosto" },
    { value: "9", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ];

  const anos = Array.from({ length: 10 }, (_, i) => {
    const ano = new Date().getFullYear() - 5 + i;
    return { value: ano.toString(), label: ano.toString() };
  });

  const handleExportar = async () => {
    try {
      setIsExporting(true);
      const empresaId = localStorage.getItem("empresaId");
      const token = localStorage.getItem("token");

      if (!empresaId || !token || !API) {
        toast.error("Erro de autenticação. Faça login novamente.");
        return;
      }

      let url = `${API}/export/entradas/${empresaId}`;
      
      if (tipoExportacao === "especifico") {
        if (!mesSelecionado || !anoSelecionado) {
          toast.error("Selecione o mês e ano para exportação específica.");
          return;
        }
        url += `?mes=${mesSelecionado}&ano=${anoSelecionado}`;
      }

      console.log("🔗 URL de exportação:", url);

      console.log("🔐 Token:", token ? "Presente" : "Ausente");
      console.log("🏢 Empresa ID:", empresaId);
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("📥 Status da resposta:", response.status);
      console.log("📥 Headers da resposta:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Erro na resposta:", errorText);
        throw new Error(`Erro ao exportar planilha: ${response.status} - ${errorText}`);
      }

      // Obter o nome do arquivo do header Content-Disposition
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "contas-a-receber.xlsx";
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename=(.+)/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Criar blob e fazer download
      const blob = await response.blob();
      const urlBlob = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = urlBlob;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(urlBlob);

      toast.success("Planilha exportada com sucesso!");
      onClose();
    } catch (error) {
      console.error("Erro ao exportar:", error);
      
      // Verificar se é um erro de SQL
      if (error instanceof Error && error.message.includes("SQL syntax")) {
        toast.error("Erro no servidor: Problema na consulta do banco de dados. Contate o suporte.");
      } else if (error instanceof Error && error.message.includes("401")) {
        toast.error("Erro de autenticação. Faça login novamente.");
      } else if (error instanceof Error && error.message.includes("403")) {
        toast.error("Acesso negado. Verifique suas permissões.");
      } else if (error instanceof Error && error.message.includes("404")) {
        toast.error("Rota não encontrada. Verifique a configuração da API.");
      } else if (error instanceof Error && error.message.includes("500")) {
        toast.error("Erro interno do servidor. Tente novamente mais tarde.");
      } else {
        toast.error("Erro ao exportar planilha. Tente novamente.");
      }
    } finally {
      setIsExporting(false);
    }
  };

  // Handlers para modal e dropdowns
  const handleClickOutside = useCallback((event) => {
    if (modalRef.current && !modalRef.current.contains(event.target)) {
      handleClose();
    }
  }, []);

  const handleClickOutsideDropdowns = useCallback((event) => {
    if (mesSelectRef.current && !mesSelectRef.current.contains(event.target)) {
      setIsMesSelectOpen(false);
    }
    if (anoSelectRef.current && !anoSelectRef.current.contains(event.target)) {
      setIsAnoSelectOpen(false);
    }
  }, []);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      setIsMesSelectOpen(false);
      setIsAnoSelectOpen(false);
      handleClose();
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('mousedown', handleClickOutsideDropdowns);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('mousedown', handleClickOutsideDropdowns);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClickOutside, handleClickOutsideDropdowns, handleKeyDown]);

  const handleClose = () => {
    if (!isExporting) {
      setTipoExportacao("todos");
      setMesSelecionado("");
      setAnoSelecionado("");
      setIsMesSelectOpen(false);
      setIsAnoSelectOpen(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleClickOutside}>
      <div className={cn(styles.modalContent, styles.modal)} ref={modalRef}>
        <div className={styles.modalHeader}>
          <h2 className={cn(styles.modalTitle, styles.title)}>
            <Download className={styles.icon} />
            Exportar Contas a Receber
          </h2>
          <p className={cn(styles.modalDescription, styles.description)}>
            Escolha o período para exportar a planilha de contas a receber.
          </p>
        </div>

        <div className={cn(styles.modalBody, "space-y-4 py-4")}>
          <div className={cn(styles.radioGroupComponent, styles.radioGroup)}>
            <div className={cn(styles.radioItemComponent, styles.radioItem)}>
              <input 
                type="radio"
                id="todos"
                name="tipoExportacao"
                value="todos"
                checked={tipoExportacao === "todos"}
                onChange={(e) => setTipoExportacao(e.target.value)}
                className={cn(styles.radioInputComponent, styles.radio)}
              />
              <label htmlFor="todos" className={cn(styles.labelComponent, styles.label)}>
                Todo o período
              </label>
            </div>
            <div className={cn(styles.radioItemComponent, styles.radioItem)}>
              <input 
                type="radio"
                id="especifico"
                name="tipoExportacao"
                value="especifico"
                checked={tipoExportacao === "especifico"}
                onChange={(e) => setTipoExportacao(e.target.value)}
                className={cn(styles.radioInputComponent, styles.radio)}
              />
              <label htmlFor="especifico" className={cn(styles.labelComponent, styles.label)}>
                Período específico
              </label>
            </div>
          </div>

          {tipoExportacao === "especifico" && (
            <div className={styles.specificPeriod}>
              <div className={styles.selectContainer}>
                <label htmlFor="mes" className={cn(styles.labelComponent, styles.selectLabel)}>
                  Mês
                </label>
                <div className={styles.selectComponent} ref={mesSelectRef}>
                  <div
                    className={cn(styles.selectTriggerComponent, styles.selectTrigger)}
                    onClick={() => setIsMesSelectOpen(!isMesSelectOpen)}
                  >
                    <span className={mesSelecionado ? "" : styles.selectPlaceholder}>
                      {mesSelecionado ? meses.find(m => m.value === mesSelecionado)?.label : "Selecione o mês"}
                    </span>
                    <ChevronDown className={cn(styles.selectIcon, isMesSelectOpen && styles.selectIconOpen)} />
                  </div>
                  {isMesSelectOpen && (
                    <div className={cn(styles.selectContentComponent, styles.selectContent)}>
                      {meses.map((mes) => (
                        <div
                          key={mes.value}
                          className={cn(styles.selectItemComponent, styles.selectItem)}
                          onClick={() => {
                            setMesSelecionado(mes.value);
                            setIsMesSelectOpen(false);
                          }}
                        >
                          {mes.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.selectContainer}>
                <label htmlFor="ano" className={cn(styles.labelComponent, styles.selectLabel)}>
                  Ano
                </label>
                <div className={styles.selectComponent} ref={anoSelectRef}>
                  <div
                    className={cn(styles.selectTriggerComponent, styles.selectTrigger)}
                    onClick={() => setIsAnoSelectOpen(!isAnoSelectOpen)}
                  >
                    <span className={anoSelecionado ? "" : styles.selectPlaceholder}>
                      {anoSelecionado ? anos.find(a => a.value === anoSelecionado)?.label : "Selecione o ano"}
                    </span>
                    <ChevronDown className={cn(styles.selectIcon, isAnoSelectOpen && styles.selectIconOpen)} />
                  </div>
                  {isAnoSelectOpen && (
                    <div className={cn(styles.selectContentComponent, styles.selectContent)}>
                      {anos.map((ano) => (
                        <div
                          key={ano.value}
                          className={cn(styles.selectItemComponent, styles.selectItem)}
                          onClick={() => {
                            setAnoSelecionado(ano.value);
                            setIsAnoSelectOpen(false);
                          }}
                        >
                          {ano.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={cn(styles.modalFooter, styles.footer)}>
          <button
            type="button"
            onClick={handleClose}
            disabled={isExporting}
            className={cn(styles.buttonComponent, styles.buttonComponentOutline, styles.cancelBtn)}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExportar}
            disabled={isExporting || (tipoExportacao === "especifico" && (!mesSelecionado || !anoSelecionado))}
            className={cn(styles.buttonComponent, styles.buttonComponentPrimary, styles.exportBtn)}
          >
            {isExporting ? (
              <>
                <Loader2 className={styles.loadingIcon} />
                Exportando...
              </>
            ) : (
              <>
                <Download className={styles.icon} />
                Exportar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 