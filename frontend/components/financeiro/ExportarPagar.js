import { useState } from "react";
import { Button } from "./botao";
import styles from "../../styles/financeiro/exportar-pagar.module.css";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { Label } from "./label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Download, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

// Função cn para combinar classes CSS
const cn = (...classes) => classes.filter(Boolean).join(' ');

export function ExportarPagar({ isOpen, onClose }) {
  const [tipoExportacao, setTipoExportacao] = useState("todos");
  const [mesSelecionado, setMesSelecionado] = useState("");
  const [anoSelecionado, setAnoSelecionado] = useState("");
  const [isExporting, setIsExporting] = useState(false);

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
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={cn(styles.exportarPagarModal, "sm:max-w-[425px]")}>
        <DialogHeader>
          <DialogTitle className={cn(styles.exportarPagarTitle, "flex items-center gap-2")}>
            <Download className={cn(styles.exportarPagarIcon, "h-5 w-5")} />
            Exportar Contas a Pagar
          </DialogTitle>
          <DialogDescription className={styles.exportarPagarDescription}>
            Escolha o período para exportar a planilha de contas a pagar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup
            value={tipoExportacao}
            onValueChange={(value) => setTipoExportacao(value)}
            className="space-y-3"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="todos" id="todos" className={styles.exportarPagarRadio} />
              <Label htmlFor="todos" className={cn(styles.exportarPagarLabel, "text-sm font-medium")}>
                Todo o período
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="especifico" id="especifico" className={styles.exportarPagarRadio} />
              <Label htmlFor="especifico" className={cn(styles.exportarPagarLabel, "text-sm font-medium")}>
                Período específico
              </Label>
            </div>
          </RadioGroup>

          {tipoExportacao === "especifico" && (
            <div className={cn(styles.exportarPagarSpecificPeriod, "space-y-3 pl-6 border-l-2 border-neonPurple")}>
              <div>
                <Label htmlFor="mes" className={cn(styles.exportarPagarLabel, "text-sm font-medium")}>
                  Mês
                </Label>
                <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                  <SelectTrigger className={cn(styles.exportarPagarSelectTrigger, "mt-1")}>
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent className={styles.exportarPagarSelectContent}>
                    {meses.map((mes) => (
                      <SelectItem key={mes.value} value={mes.value} className={styles.exportarPagarSelectItem}>
                        {mes.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="ano" className={cn(styles.exportarPagarLabel, "text-sm font-medium")}>
                  Ano
                </Label>
                <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
                  <SelectTrigger className={cn(styles.exportarPagarSelectTrigger, "mt-1")}>
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent className={styles.exportarPagarSelectContent}>
                    {anos.map((ano) => (
                      <SelectItem key={ano.value} value={ano.value} className={styles.exportarPagarSelectItem}>
                        {ano.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isExporting}
            className={styles.exportarPagarCancelBtn}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleExportar}
            disabled={isExporting || (tipoExportacao === "especifico" && (!mesSelecionado || !anoSelecionado))}
            className={styles.exportarPagarExportBtn}
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
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 