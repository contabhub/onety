"use client";

import { useState, useEffect } from "react";
import { Download, Loader2, X, ChevronDown } from "lucide-react";
import { toast } from "react-toastify";
import styles from "../../styles/financeiro/ExportarMovimentacoes.module.css";

export function ExportarMovimentacoes({ isOpen, onClose }) {
  const [tipoExportacao, setTipoExportacao] = useState("todos");
  const [mesSelecionado, setMesSelecionado] = useState("");
  const [anoSelecionado, setAnoSelecionado] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [showMesSelect, setShowMesSelect] = useState(false);
  const [showAnoSelect, setShowAnoSelect] = useState(false);

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
      const token = localStorage.getItem("token");
      const userData = JSON.parse(localStorage.getItem("userData") || "{}");
      const empresaId = userData.EmpresaId;

      if (!empresaId || !token || !API) {
        toast.error("Erro de autenticação. Faça login novamente.");
        return;
      }

      let url = `${API}/financeiro/exportar/movimentacoes/${empresaId}`;
      
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
      let filename = "movimentacoes.xlsx";
      
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

      toast.success("Planilha de movimentações exportada com sucesso!");
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

  const handleClose = () => {
    if (!isExporting) {
      setTipoExportacao("todos");
      setMesSelecionado("");
      setAnoSelecionado("");
      setShowMesSelect(false);
      setShowAnoSelect(false);
      onClose();
    }
  };

  // Fechar selects ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      const selectWrappers = document.querySelectorAll('[class*="selectWrapper"]');
      const clickedOutside = Array.from(selectWrappers).every(wrapper => !wrapper.contains(event.target));
      if (clickedOutside) {
        setShowMesSelect(false);
        setShowAnoSelect(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!isOpen) return null;

  const mesLabel = meses.find(m => m.value === mesSelecionado)?.label || "Selecione o mês";
  const anoLabel = anos.find(a => a.value === anoSelecionado)?.label || "Selecione o ano";

  return (
    <div className={styles.modalOverlay} onClick={handleClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            <Download className={styles.dialogIcon} />
            Exportar Movimentações
          </h3>
          <button onClick={handleClose} className={styles.closeButton}>
            <X className={styles.closeIcon} />
          </button>
        </div>
        <p className={styles.modalDescription}>
          Escolha o período para exportar a planilha de movimentações financeiras.
        </p>

        <div className={styles.formContainer}>
          <div className={styles.radioGroup}>
            <label className={styles.radioOption}>
              <input
                type="radio"
                name="tipoExportacao"
                value="todos"
                checked={tipoExportacao === "todos"}
                onChange={(e) => setTipoExportacao(e.target.value)}
                className={styles.radioInput}
              />
              <span className={styles.radioLabel}>Todo o período</span>
            </label>
            <label className={styles.radioOption}>
              <input
                type="radio"
                name="tipoExportacao"
                value="especifico"
                checked={tipoExportacao === "especifico"}
                onChange={(e) => setTipoExportacao(e.target.value)}
                className={styles.radioInput}
              />
              <span className={styles.radioLabel}>Período específico</span>
            </label>
          </div>

          {tipoExportacao === "especifico" && (
            <div className={styles.specificPeriodContainer}>
              <div className={styles.fieldContainer}>
                <label htmlFor="mes" className={styles.fieldLabel}>
                  Mês
                </label>
                <div className={styles.selectWrapper}>
                  <button
                    type="button"
                    className={styles.selectTrigger}
                    onClick={() => {
                      setShowMesSelect(!showMesSelect);
                      setShowAnoSelect(false);
                    }}
                  >
                    <span>{mesLabel}</span>
                    <ChevronDown className={styles.chevronIcon} />
                  </button>
                  {showMesSelect && (
                    <div className={styles.selectContent}>
                      {meses.map((mes) => (
                        <button
                          key={mes.value}
                          type="button"
                          className={`${styles.selectItem} ${mesSelecionado === mes.value ? styles.selectItemActive : ''}`}
                          onClick={() => {
                            setMesSelecionado(mes.value);
                            setShowMesSelect(false);
                          }}
                        >
                          {mes.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.fieldContainer}>
                <label htmlFor="ano" className={styles.fieldLabel}>
                  Ano
                </label>
                <div className={styles.selectWrapper}>
                  <button
                    type="button"
                    className={styles.selectTrigger}
                    onClick={() => {
                      setShowAnoSelect(!showAnoSelect);
                      setShowMesSelect(false);
                    }}
                  >
                    <span>{anoLabel}</span>
                    <ChevronDown className={styles.chevronIcon} />
                  </button>
                  {showAnoSelect && (
                    <div className={styles.selectContent}>
                      {anos.map((ano) => (
                        <button
                          key={ano.value}
                          type="button"
                          className={`${styles.selectItem} ${anoSelecionado === ano.value ? styles.selectItemActive : ''}`}
                          onClick={() => {
                            setAnoSelecionado(ano.value);
                            setShowAnoSelect(false);
                          }}
                        >
                          {ano.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button
            type="button"
            onClick={handleClose}
            disabled={isExporting}
            className={`${styles.button} ${styles.buttonOutline}`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExportar}
            disabled={isExporting || (tipoExportacao === "especifico" && (!mesSelecionado || !anoSelecionado))}
            className={`${styles.button} ${styles.buttonPrimary}`}
          >
            {isExporting ? (
              <>
                <Loader2 className={styles.loadingIcon} />
                Exportando...
              </>
            ) : (
              <>
                <Download className={styles.buttonIcon} />
                Exportar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 