"use client";

import { useState } from "react";
import { Button } from "./botao";
import styles from "../../styles/financeiro/ExportarReceber.module.css";
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

export function ExportarReceber({ isOpen, onClose }) {
  const [tipoExportacao, setTipoExportacao] = useState("todos");
  const [mesSelecionado, setMesSelecionado] = useState("");
  const [anoSelecionado, setAnoSelecionado] = useState("");
  const [isExporting, setIsExporting] = useState(false);

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
      <DialogContent className={styles.modal}>
        <DialogHeader>
          <DialogTitle className={styles.title}>
            <Download className={styles.icon} />
            Exportar Contas a Receber
          </DialogTitle>
          <DialogDescription className={styles.description}>
            Escolha o período para exportar a planilha de contas a receber.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup
            value={tipoExportacao}
            onValueChange={(value) => setTipoExportacao(value)}
            className={styles.radioGroup}
          >
            <div className={styles.radioItem}>
              <RadioGroupItem value="todos" id="todos" className={styles.radio} />
              <Label htmlFor="todos" className={styles.label}>
                Todo o período
              </Label>
            </div>
            <div className={styles.radioItem}>
              <RadioGroupItem value="especifico" id="especifico" className={styles.radio} />
              <Label htmlFor="especifico" className={styles.label}>
                Período específico
              </Label>
            </div>
          </RadioGroup>

          {tipoExportacao === "especifico" && (
            <div className={styles.specificPeriod}>
              <div className={styles.selectContainer}>
                <Label htmlFor="mes" className={styles.selectLabel}>
                  Mês
                </Label>
                <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                  <SelectTrigger className={styles.selectTrigger}>
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent className={styles.selectContent}>
                    {meses.map((mes) => (
                      <SelectItem 
                        key={mes.value} 
                        value={mes.value}
                        className={styles.selectItem}
                      >
                        {mes.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className={styles.selectContainer}>
                <Label htmlFor="ano" className={styles.selectLabel}>
                  Ano
                </Label>
                <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
                  <SelectTrigger className={styles.selectTrigger}>
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent className={styles.selectContent}>
                    {anos.map((ano) => (
                      <SelectItem 
                        key={ano.value} 
                        value={ano.value}
                        className={styles.selectItem}
                      >
                        {ano.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className={styles.footer}>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isExporting}
            className={styles.cancelBtn}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleExportar}
            disabled={isExporting || (tipoExportacao === "especifico" && (!mesSelecionado || !anoSelecionado))}
            className={styles.exportBtn}
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
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 