import { useState, useEffect, useCallback } from "react";
// Componentes externos removidos - usando HTML nativo
import styles from "../../styles/financeiro/exportar-pagar.module.css";
import { Download, Loader2, ChevronDown } from "lucide-react";
import { toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

// Função cn para combinar classes CSS
const cn = (...classes) => classes.filter(Boolean).join(' ');

export function ExportarPagar({ isOpen, onClose }) {
  const [tipoExportacao, setTipoExportacao] = useState("todos");
  const [mesSelecionado, setMesSelecionado] = useState("");
  const [anoSelecionado, setAnoSelecionado] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  
  // Estados para controlar selects customizados
  const [isMesSelectOpen, setIsMesSelectOpen] = useState(false);
  const [isAnoSelectOpen, setIsAnoSelectOpen] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL;

  // NOTA: O erro SQL indica problema na construção da query no backend
  // A cláusula AND está sendo adicionada após ORDER BY, quando deveria estar na cláusula WHERE
  // Exemplo de query correta:
  // WHERE t.company_id = ? AND t.tipo = 'saida' AND MONTH(t.data_transacao) = ? AND YEAR(t.data_transacao) = ?
  // ORDER BY t.data_vencimento ASC

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
      let empresaId = localStorage.getItem("empresaId");
      // Se não encontrou empresaId diretamente, buscar do userData
      if (!empresaId) {
        const userData = JSON.parse(localStorage.getItem("userData") || "{}");
        empresaId = userData.EmpresaId || null;
      }
      const token = localStorage.getItem("token");

      if (!empresaId || !token || !API) {
        toast.error("Erro de autenticação. Faça login novamente.");
        return;
      }

      let url = `${API}/financeiro/exportar/saidas/${empresaId}`;
      
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
      let filename = "contas-a-pagar.xlsx";
      
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

  // Função para fechar modal ao clicar no overlay
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Função para lidar com cliques fora dos selects
  const handleClickOutside = useCallback((e) => {
    if (!e.target.closest('.select-container')) {
      setIsMesSelectOpen(false);
      setIsAnoSelectOpen(false);
    }
  }, []);

  // Adicionar listener para fechar selects ao clicar fora
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen, handleClickOutside]);

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={cn(styles.modalContent, styles.exportarPagarModal, "sm:max-w-[425px]")}>
        <div className={cn(styles.modalHeader)}>
          <h2 className={cn(styles.modalTitle, styles.exportarPagarTitle, "flex items-center gap-2")}>
            <Download className={cn(styles.exportarPagarIcon, "h-5 w-5")} />
            Exportar Contas a Pagar
          </h2>
          <p className={cn(styles.modalDescription, styles.exportarPagarDescription)}>
            Escolha o período para exportar a planilha de contas a pagar.
          </p>
        </div>

        <div className="space-y-4 py-4">
          <div className={cn(styles.radioGroupComponent, "space-y-3")}>
            <div className={cn(styles.radioItemComponent, "flex items-center space-x-2")}>
              <input 
                type="radio"
                id="todos"
                name="tipoExportacao"
                value="todos"
                checked={tipoExportacao === "todos"}
                onChange={(e) => setTipoExportacao(e.target.value)}
                className={cn(styles.radioInputComponent, styles.exportarPagarRadio)}
              />
              <label htmlFor="todos" className={cn(styles.labelComponent, styles.exportarPagarLabel, "text-sm font-medium")}>
                Todo o período
              </label>
            </div>
            <div className={cn(styles.radioItemComponent, "flex items-center space-x-2")}>
              <input 
                type="radio"
                id="especifico"
                name="tipoExportacao"
                value="especifico"
                checked={tipoExportacao === "especifico"}
                onChange={(e) => setTipoExportacao(e.target.value)}
                className={cn(styles.radioInputComponent, styles.exportarPagarRadio)}
              />
              <label htmlFor="especifico" className={cn(styles.labelComponent, styles.exportarPagarLabel, "text-sm font-medium")}>
                Período específico
              </label>
            </div>
          </div>

          {tipoExportacao === "especifico" && (
            <div className={cn(styles.exportarPagarSpecificPeriod, "space-y-3 pl-6 border-l-2 border-neonPurple")}>
              <div>
                <label htmlFor="mes" className={cn(styles.labelComponent, styles.exportarPagarLabel, "text-sm font-medium")}>
                  Mês
                </label>
                <div className={cn(styles.selectComponent, "select-container")} style={{ marginTop: '4px' }}>
                  <div
                    className={cn(styles.selectTriggerComponent, styles.exportarPagarSelectTrigger, "mt-1")}
                    onClick={() => setIsMesSelectOpen(!isMesSelectOpen)}
                  >
                    <span className={mesSelecionado ? styles.selectValue : styles.selectPlaceholder}>
                      {mesSelecionado ? meses.find(m => m.value === mesSelecionado)?.label : "Selecione o mês"}
                    </span>
                    <ChevronDown className={cn(styles.selectIcon, isMesSelectOpen && styles.selectIconOpen)} />
                  </div>
                  {isMesSelectOpen && (
                    <div className={cn(styles.selectContentComponent, styles.exportarPagarSelectContent)}>
                      {meses.map((mes) => (
                        <div
                          key={mes.value}
                          className={cn(styles.selectItemComponent, styles.exportarPagarSelectItem)}
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

              <div>
                <label htmlFor="ano" className={cn(styles.labelComponent, styles.exportarPagarLabel, "text-sm font-medium")}>
                  Ano
                </label>
                <div className={cn(styles.selectComponent, "select-container")} style={{ marginTop: '4px' }}>
                  <div
                    className={cn(styles.selectTriggerComponent, styles.exportarPagarSelectTrigger, "mt-1")}
                    onClick={() => setIsAnoSelectOpen(!isAnoSelectOpen)}
                  >
                    <span className={anoSelecionado ? styles.selectValue : styles.selectPlaceholder}>
                      {anoSelecionado ? anos.find(a => a.value === anoSelecionado)?.label : "Selecione o ano"}
                    </span>
                    <ChevronDown className={cn(styles.selectIcon, isAnoSelectOpen && styles.selectIconOpen)} />
                  </div>
                  {isAnoSelectOpen && (
                    <div className={cn(styles.selectContentComponent, styles.exportarPagarSelectContent)}>
                      {anos.map((ano) => (
                        <div
                          key={ano.value}
                          className={cn(styles.selectItemComponent, styles.exportarPagarSelectItem)}
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

        <div className={cn(styles.modalFooter)}>
          <button
            type="button"
            onClick={handleClose}
            disabled={isExporting}
            className={cn(styles.buttonComponent, styles.buttonComponentOutline, styles.exportarPagarCancelBtn)}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExportar}
            disabled={isExporting || (tipoExportacao === "especifico" && (!mesSelecionado || !anoSelecionado))}
            className={cn(styles.buttonComponent, styles.buttonComponentPrimary, styles.exportarPagarExportBtn)}
          >
            {isExporting ? (
              <>
                <Loader2 className={cn(styles.exportarPagarIcon, "mr-2 h-4 w-4 animate-spin")} />
                Exportando...
              </>
            ) : (
              <>
                <Download className={cn(styles.exportarPagarIcon, "mr-2 h-4 w-4")} />
                Exportar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 