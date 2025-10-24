import { useMemo, useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/financeiro/card";
import { Button } from "../../components/financeiro/botao";
import { Badge } from "../../components/financeiro/badge";
import { Separator } from "../../components/financeiro/separator";
import {
  Upload,
  Image as ImageIcon,
  Mail,
  MessageCircle,
  CheckCircle2,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Trash2,
  FileText,
  Calendar,
  Building2,
  ChevronRight,
  FileText as FileTextIcon,
} from "lucide-react";
import { toast } from "react-toastify";
import { NovaDespesaDrawer } from "../../components/financeiro/NovaDespesaDrawer";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import styles from "../../styles/financeiro/captura-facil.module.css";

function formatCurrencyFromCents(valueInCents) {
  const value = valueInCents / 100;
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function formatDate(iso) {
  const date = new Date(iso);
  return date.toLocaleDateString("pt-BR");
}

const initialBoletos = [];

export default function CapturaFacilPage() {
  const [boletos, setBoletos] = useState(initialBoletos);
  const [selectedId, setSelectedId] = useState(boletos[0]?.id ?? null);
  const [zoom, setZoom] = useState(45);
  const [rotation, setRotation] = useState(0);
  const [showNovaDespesaDrawer, setShowNovaDespesaDrawer] = useState(false);
  const [boletoParaDespesa, setBoletoParaDespesa] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(true); // Começar como true para mostrar loading inicial

  const selectedBoleto = useMemo(() => boletos.find(b => b.id === selectedId) || null, [boletos, selectedId]);

  const API = process.env.NEXT_PUBLIC_API_URL;

  const carregarDrafts = useCallback(async (showToast = false) => {
    const userData = JSON.parse(localStorage.getItem("userData") || "{}");
    const EmpresaId = userData.EmpresaId;
    const token = localStorage.getItem("token");

    if (!EmpresaId || !token) {
      toast.error("Empresa ou token não encontrados");
      setLoadingDrafts(false);
      return;
    }

    setLoadingDrafts(true);

    try {
      if (showToast) {
        toast.info("Carregando drafts...");
      }
      
      const url = `${API}/boletos-drafts/drafts?company_id=${EmpresaId}&status=draft`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Erro ao carregar drafts:", response.status, errorText);
        toast.error(`Erro ao carregar drafts: ${response.status}`);
        return;
      }

      const data = await response.json();
      
      if (!data.drafts) {
        console.warn("Resposta não contém 'drafts'", data);
        toast.warning("Formato de resposta inesperado");
        return;
      }
      
      // Converter drafts para o formato BoletoItem
      const draftsConvertidos = data.drafts.map((draft) => {
        let boletoMeta = draft.boleto_meta;
        let form = draft.form;
        
        // Tentar fazer parse se for string
        if (typeof boletoMeta === 'string') {
          try {
            boletoMeta = JSON.parse(boletoMeta);
          } catch (e) {
            console.error("Erro ao fazer parse do boleto_meta:", e);
            boletoMeta = {};
          }
        }
        
        if (typeof form === 'string') {
          try {
            form = JSON.parse(form);
          } catch (e) {
            console.error("Erro ao fazer parse do form:", e);
            form = {};
          }
        }
        
        return {
          id: `draft-${draft.id}`,
          titulo: form?.nome_arquivo || form?.descricao || 'Boleto sem título',
          descricao: form?.observacoes || 'Draft de boleto',
          dataEnvioISO: draft.created_at,
          remetente: 'draft',
          valorCentavos: Math.round((form?.valor || 0) * 100),
          fornecedor: boletoMeta?.beneficiario || form?.descricao || 'Fornecedor não identificado',
          categoria: boletoMeta?.tipo === 'pix' ? 'Boleto PIX' : 'Boleto Bancário',
          pdfBase64: form?.anexo_base64,
          boletoMeta: boletoMeta,
          tipoBoleto: boletoMeta?.tipo || 'linha_digitavel',
          linhaDigitavel: draft.linha_digitavel,
          status: 'processado',
          draftId: draft.id,
          form: form
        };
      });
      
      // Substituir completamente os boletos pelos drafts carregados
      setBoletos(draftsConvertidos);

      // Mostrar sucesso
      if (data.drafts.length > 0) {
        toast.success(`${data.drafts.length} draft(s) carregado(s)`);
      } else {
        toast.info("Nenhum draft encontrado");
      }

    } catch (error) {
      console.error("Erro ao carregar drafts:", error);
      toast.error("Erro ao carregar drafts");
    } finally {
      setLoadingDrafts(false);
    }
  }, [API]);

  // Função wrapper para o botão de atualizar
  const handleAtualizarDrafts = () => {
    carregarDrafts(true);
  };

  // Carregar drafts existentes ao montar o componente
  useEffect(() => {
    carregarDrafts(false); // Não mostrar toast na primeira vez
  }, [carregarDrafts]);

  // Atualizar selectedId quando boletos mudarem
  useEffect(() => {
    if (boletos.length > 0 && !selectedId) {
      setSelectedId(boletos[0].id);
    } else if (boletos.length === 0) {
      setSelectedId(null);
    }
  }, [boletos, selectedId]);

  async function processarPDF(file) {
    const id = crypto.randomUUID();
    const novo = {
      id,
      titulo: file.name,
      descricao: "Processando PDF...",
      dataEnvioISO: new Date().toISOString(),
      remetente: "upload",
      fornecedor: "Processando...",
      categoria: "Processando...",
      valorCentavos: 0,
      status: 'processando'
    };

    setBoletos(prev => [novo, ...prev]);
    setSelectedId(id);

    try {
      // Converter arquivo para base64
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          // Remove o prefixo "data:application/pdf;base64,"
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.readAsDataURL(file);
      });

      // Enviar para o backend
      const userData = JSON.parse(localStorage.getItem("userData") || "{}");
      const EmpresaId = userData.EmpresaId;
      const token = localStorage.getItem("token");

      if (!EmpresaId || !token) {
        throw new Error("Empresa ou token não encontrados");
      }

      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('company_id', EmpresaId);
      formData.append('tipo', 'saida');
      formData.append('nome_arquivo', file.name); // Enviar nome do arquivo

      const response = await fetch(`${API}/boletos-drafts/importar-pdf`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar PDF');
      }

      // Atualizar o boleto com os dados processados
      setBoletos(prev => prev.map(b => 
        b.id === id ? {
          ...b,
          descricao: data.message,
          fornecedor: data.boleto_meta?.beneficiario || 'Fornecedor não identificado',
          categoria: data.tipo_boleto === 'pix' ? 'Boleto PIX' : 'Boleto Bancário',
          valorCentavos: Math.round((data.boleto_meta?.valor || 0) * 100),
          pdfBase64: base64,
          boletoMeta: data.boleto_meta,
          tipoBoleto: data.tipo_boleto,
          linhaDigitavel: data.linha_digitavel,
          status: 'processado',
          draftId: data.draft_id,
          form: data.form
        } : b
      ));

      toast.success("PDF processado com sucesso!");
    } catch (error) {
      console.error("Erro ao processar PDF:", error);
      
      setBoletos(prev => prev.map(b => 
        b.id === id ? {
          ...b,
          descricao: "Erro ao processar PDF",
          fornecedor: "Erro",
          categoria: "Erro",
          status: 'erro',
          erro: error instanceof Error ? error.message : 'Erro desconhecido'
        } : b
      ));

      toast.error(error instanceof Error ? error.message : "Erro ao processar PDF");
    }
  }

  function handleUpload(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Tamanho máximo permitido é 10 MB.");
      return;
    }

    if (file.type !== 'application/pdf') {
      toast.error("Apenas arquivos PDF são permitidos.");
      return;
    }

    processarPDF(file);
  }

  function resetViewer() {
    setZoom(45);
    setRotation(0);
  }


  function handleRevisarECriar() {
    if (!selectedBoleto || selectedBoleto.status !== 'processado') {
      toast.error("Selecione um boleto processado para revisar");
      return;
    }

    // Preparar dados para o drawer
    const dadosParaDespesa = {
      descricao: selectedBoleto.boletoMeta?.beneficiario || selectedBoleto.fornecedor,
      valor: selectedBoleto.valorCentavos / 100,
      dataVencimento: selectedBoleto.boletoMeta?.data_vencimento ? new Date(selectedBoleto.boletoMeta.data_vencimento) : new Date(),
      origem: 'boleto',
      observacoes: selectedBoleto.form?.observacoes || `Importado via Captura Fácil\n${selectedBoleto.descricao}`,
      anexo_base64: selectedBoleto.pdfBase64,
      boletoMeta: selectedBoleto.boletoMeta,
      draftId: selectedBoleto.draftId,
      tipoBoleto: selectedBoleto.tipoBoleto,
      linhaDigitavel: selectedBoleto.linhaDigitavel,
      form: selectedBoleto.form
    };

    setBoletoParaDespesa(dadosParaDespesa);
    setShowNovaDespesaDrawer(true);
  }

  async function handleDespesaSalva(data) {
    // Se tem draftId, finalizar o draft
    if (selectedBoleto?.draftId) {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Token não encontrado");
        return;
      }

      try {
        const response = await fetch(`${API}/boletos-drafts/drafts/${selectedBoleto.draftId}/finalizar`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          toast.error("Erro ao finalizar draft");
          return;
        }

        const finalizacaoData = await response.json();
        console.log("Draft finalizado:", finalizacaoData);
        
        toast.success("Despesa criada e draft finalizado com sucesso!");
      } catch (error) {
        console.error("Erro ao finalizar draft:", error);
        toast.error("Erro ao finalizar draft");
        return;
      }
    } else {
      toast.success("Despesa criada com sucesso!");
    }

    setShowNovaDespesaDrawer(false);
    setBoletoParaDespesa(null);
    
    // Remover o boleto da lista após criar a despesa
    if (selectedBoleto) {
      setBoletos(prev => prev.filter(b => b.id !== selectedBoleto.id));
      setSelectedId(null);
    }
  }

  function handleDownloadPDF() {
    if (!selectedBoleto?.pdfBase64) {
      toast.error("PDF não disponível para download");
      return;
    }

    try {
      // Converter base64 para blob
      const byteCharacters = atob(selectedBoleto.pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      // Criar link de download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = selectedBoleto.titulo || 'boleto.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Download iniciado!");
    } catch (error) {
      console.error("Erro ao baixar PDF:", error);
      toast.error("Erro ao baixar PDF");
    }
  }

  function handleOpenPDFInNewTab() {
    if (!selectedBoleto?.pdfBase64) {
      toast.error("PDF não disponível");
      return;
    }

    try {
      // Abrir PDF em nova aba
      const byteCharacters = atob(selectedBoleto.pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      window.open(url, '_blank');
      
      // Limpar URL após um tempo
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Erro ao abrir PDF:", error);
      toast.error("Erro ao abrir PDF");
    }
  }

  async function handleExcluirDraft() {
    if (!selectedBoleto?.draftId) {
      toast.error("Este item não pode ser excluído");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Token não encontrado");
      return;
    }

    try {
      const response = await fetch(`${API}/boletos-drafts/drafts/${selectedBoleto.draftId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        toast.error("Erro ao excluir draft");
        return;
      }

      // Remover da lista local
      setBoletos(prev => prev.filter(b => b.id !== selectedBoleto.id));
      setSelectedId(null);
      
      toast.success("Draft excluído com sucesso!");
    } catch (error) {
      console.error("Erro ao excluir draft:", error);
      toast.error("Erro ao excluir draft");
    }
  }

  return (
    <>
      <PrincipalSidebar />
      <div className={styles.capturaFacilContainer}>
        <div className={styles.capturaFacilHeader}>
          <div>
            <h1 className={styles.capturaFacilTitle}>Captura Fácil</h1>
            <p className={styles.capturaFacilSubtitle}>Envie boletos por upload, e-mail ou WhatsApp e deixe a IA fazer o resto</p>
          </div>
        </div>

        <div className={styles.capturaFacilGrid}>
          {/* Coluna esquerda */}
          <div className={styles.capturaFacilLeftColumn}>
            <Card className={styles.capturaFacilUploadCard}>
              <CardContent className={styles.capturaFacilCardContent}>
                <label
                  htmlFor="file-input"
                  className={styles.capturaFacilUploadArea}
                >
                  <div className={styles.capturaFacilUploadText}>
                    <Upload className={styles.capturaFacilUploadIcon} />
                    <span>Clique aqui ou arraste arquivos para importar</span>
                  </div>
                  <input id="file-input" type="file" accept="application/pdf" className={styles.capturaFacilHiddenInput} onChange={e => handleUpload(e.target.files)} />
                </label>
              </CardContent>
            </Card>


            <div className={styles.capturaFacilSection}>
              <div className={styles.capturaFacilSectionHeader}>
                <h2 className={styles.capturaFacilSectionTitle}>Esta semana</h2>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleAtualizarDrafts}
                  disabled={loadingDrafts}
                  className={styles.capturaFacilRefreshBtn}
                >
                  {loadingDrafts ? (
                    <>
                      <div className={styles.capturaFacilSpinner}></div>
                      Carregando...
                    </>
                  ) : (
                    '🔄 Atualizar'
                  )}
                </Button>
              </div>
              <div className={styles.capturaFacilListContainer}>
                <div className={styles.capturaFacilListContent}>
                  {loadingDrafts ? (
                    <div className={styles.capturaFacilLoadingContainer}>
                      <div className={styles.capturaFacilSpinner}></div>
                      <p className={styles.capturaFacilLoadingText}>Carregando drafts...</p>
                    </div>
                  ) : boletos.length === 0 ? (
                    <div className={styles.capturaFacilEmptyContainer}>
                      <p className={styles.capturaFacilLoadingText}>Nenhum boleto encontrado</p>
                      <p className={styles.capturaFacilEmptyText}>Faça upload de um PDF para começar</p>
                    </div>
                  ) : (
                    boletos.map((item) => {
                      const isActive = item.id === selectedId;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setSelectedId(item.id)}
                          className={`${styles.capturaFacilListItem} ${isActive ? styles.capturaFacilListItemActive : ''}`}
                        >
                          <div className={`${styles.capturaFacilItemIcon} ${
                            item.status === 'processando' ? styles.capturaFacilItemIconProcessing :
                            item.status === 'erro' ? styles.capturaFacilItemIconError :
                            item.status === 'processado' ? (item.draftId ? styles.capturaFacilItemIconDraft : styles.capturaFacilItemIconSuccess) :
                            styles.capturaFacilItemIconDefault
                          }`}>
                            {item.status === 'processando' ? '⏳' :
                             item.status === 'erro' ? '❌' :
                             item.status === 'processado' ? (item.draftId ? '📄' : '✅') : 'CA'}
                          </div>
                          <div className={styles.capturaFacilItemContent}>
                            <p className={styles.capturaFacilItemTitle}>{item.titulo}</p>
                            <p className={styles.capturaFacilItemSubtitle}>
                              {formatDate(item.dataEnvioISO)} – {item.descricao}
                            </p>
                            {item.status === 'erro' && item.erro && (
                              <p className={styles.capturaFacilItemError}>{item.erro}</p>
                            )}
                            {item.form?.observacoes && (
                              <div className={styles.capturaFacilItemObservations}>
                                <FileText className={styles.capturaFacilItemObservationIcon} />
                                <p className={styles.capturaFacilItemObservationText}>
                                  {item.form.observacoes.split('\n')[0]}...
                                </p>
                              </div>
                            )}
                          </div>
                          <ChevronRight className={styles.capturaFacilItemChevron} />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Coluna direita */}
          <div className={styles.capturaFacilRightColumn}>
            {!selectedBoleto ? (
              <Card className={styles.capturaFacilEmptyCard}>
                <CardContent className={styles.capturaFacilEmptyCardContent}>
                  <div className={styles.capturaFacilEmptyContent}>
                    <div className={styles.capturaFacilEmptyImage}>
                      <img src="/interface.png" alt="Ilustração Upload" className={styles.capturaFacilEmptyImageImg} />
                    </div>
                    <div>
                      <h3 className={styles.capturaFacilEmptyTitle}>Você não possui lançamentos pendentes!</h3>
                      <p className={styles.capturaFacilEmptyDescription}>
                        Faça o upload de novos arquivos que nossas IAs ajudarão na criação e atualização das despesas no ERP.
                      </p>
                    </div>

                    <div className={styles.capturaFacilEmptyInfo}>
                      <p>
                        <span className={styles.capturaFacilEmptyInfoLabel}>Arquivos permitidos:</span> PDF
                      </p>
                      <p>
                        <span className={styles.capturaFacilEmptyInfoLabel}>Tamanho máximo:</span> 10 MB
                      </p>
                      <p>
                        <span className={styles.capturaFacilEmptyInfoLabel}>Integrações disponíveis:</span> upload, e-mail e whatsapp
                      </p>
                    </div>

                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className={styles.capturaFacilMainCard}>
                  <CardHeader className={styles.capturaFacilMainCardHeader}>
                    <div className={styles.capturaFacilMainCardHeaderContent}>
                      <div className={styles.capturaFacilMainCardTitle}>
                        <span className={styles.capturaFacilMainCardTitleText}>{selectedBoleto.titulo}</span>
                      </div>
                      <div className={styles.capturaFacilMainCardControls}>
                        <Button variant="ghost" size="icon" className={styles.capturaFacilControlBtn} onClick={() => setZoom(z => Math.min(200, z + 10))}>
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className={styles.capturaFacilControlBtn} onClick={() => setZoom(z => Math.max(10, z - 10))}>
                          <ZoomOut className="h-4 w-4" />
                        </Button>
                        <div className={styles.capturaFacilZoomText}>{zoom}%</div>
                        <Separator orientation="vertical" className={styles.capturaFacilSeparator} />
                        <Button variant="ghost" size="icon" className={styles.capturaFacilControlBtn} onClick={() => setRotation(r => (r - 90) % 360)}>
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className={styles.capturaFacilControlBtn} onClick={() => setRotation(r => (r + 90) % 360)}>
                          <RotateCw className="h-4 w-4" />
                        </Button>
                        <Separator orientation="vertical" className={styles.capturaFacilSeparator} />
                        <Button variant="ghost" size="icon" className={styles.capturaFacilControlBtn} onClick={handleDownloadPDF} title="Baixar PDF">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className={styles.capturaFacilControlBtn} onClick={handleOpenPDFInNewTab} title="Abrir PDF em nova aba">
                          <FileTextIcon className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={styles.capturaFacilDeleteBtn} 
                          onClick={selectedBoleto?.draftId ? handleExcluirDraft : () => { resetViewer(); toast.info("Arquivo removido da seleção"); }}
                          title={selectedBoleto?.draftId ? "Excluir draft" : "Remover da seleção"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className={styles.capturaFacilMainCardContent}>
                    <div className={styles.capturaFacilPdfContainer}>
                      {selectedBoleto.status === 'processando' ? (
                        <div className={styles.capturaFacilProcessingContainer}>
                          <div className={styles.capturaFacilSpinner}></div>
                          <p>Processando PDF...</p>
                        </div>
                      ) : selectedBoleto.status === 'erro' ? (
                        <div className={styles.capturaFacilErrorContainer}>
                          <FileTextIcon className={styles.capturaFacilErrorIcon} />
                          <p>Erro ao processar PDF</p>
                          <p className={styles.capturaFacilErrorText}>{selectedBoleto.erro}</p>
                        </div>
                      ) : selectedBoleto.pdfBase64 ? (
                        <div className={styles.capturaFacilPdfWrapper}>
                          {pdfLoading && (
                            <div className={styles.capturaFacilPdfLoading}>
                              <div className={styles.capturaFacilPdfLoadingContent}>
                                <div className={styles.capturaFacilSpinner}></div>
                                <p className={styles.capturaFacilPdfLoadingText}>Carregando PDF...</p>
                              </div>
                            </div>
                          )}
                          <div 
                            className={styles.capturaFacilPdfViewer}
                            style={{ 
                              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                              transition: 'transform 0.2s ease-out'
                            }}
                          >
                            <iframe
                              src={`data:application/pdf;base64,${selectedBoleto.pdfBase64}#toolbar=0&navpanes=0&scrollbar=0`}
                              className={styles.capturaFacilPdfIframe}
                              title="Visualizador de PDF"
                              onLoad={() => setPdfLoading(false)}
                              onLoadStart={() => setPdfLoading(true)}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className={styles.capturaFacilPdfProcessed}>
                          <div className={styles.capturaFacilPdfProcessedContent}>
                            <FileTextIcon className={styles.capturaFacilPdfProcessedIcon} />
                            <p className={styles.capturaFacilPdfProcessedTitle}>PDF Processado</p>
                            <p className={styles.capturaFacilPdfProcessedSubtitle}>
                              {selectedBoleto.tipoBoleto === 'pix' ? 'Boleto PIX' : 'Boleto Bancário'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className={styles.capturaFacilInfoCard}>
                  <CardContent className={styles.capturaFacilInfoCardContent}>
                    <div className={styles.capturaFacilInfoHeader}>
                      <div className={styles.capturaFacilInfoBadges}>
                        <Badge className={`${styles.capturaFacilInfoBadge} ${
                          selectedBoleto.status === 'processado' ? styles.capturaFacilInfoBadgeSuccess :
                          selectedBoleto.status === 'processando' ? styles.capturaFacilInfoBadgeProcessing :
                          styles.capturaFacilInfoBadgeError
                        }`}>
                          {selectedBoleto.status === 'processado' ? 'Dados extraídos' :
                           selectedBoleto.status === 'processando' ? 'Processando' : 'Erro'}
                        </Badge>
                        <span className={styles.capturaFacilInfoType}>
                          {selectedBoleto.tipoBoleto === 'pix' ? 'Boleto PIX' : 'Boleto Bancário'}
                        </span>
                      </div>

                      <div className={styles.capturaFacilInfoActions}>
                        <Button 
                          className={styles.capturaFacilActionBtn}
                          onClick={handleRevisarECriar}
                          disabled={selectedBoleto.status !== 'processado'}
                        >
                          {selectedBoleto.draftId ? 'Finalizar draft' : 'Revisar e criar'}
                        </Button>
                        <Button variant="outline" className={styles.capturaFacilOutlineBtn}>
                          Buscar lançamento
                        </Button>
                      </div>
                    </div>

                    <div className={styles.capturaFacilInfoGrid}>
                      <div className={styles.capturaFacilInfoItem}>
                        <Calendar className={styles.capturaFacilInfoIcon} /> 
                        {selectedBoleto.boletoMeta?.data_vencimento ? 
                          formatDate(selectedBoleto.boletoMeta.data_vencimento) : 
                          formatDate(selectedBoleto.dataEnvioISO)
                        }
                      </div>
                      <div className={styles.capturaFacilInfoItem}>
                        <Building2 className={styles.capturaFacilInfoIcon} /> 
                        Fornecedor: <span className={styles.capturaFacilInfoValue}>{selectedBoleto.fornecedor}</span>
                      </div>
                      <div className={styles.capturaFacilInfoItem}>
                        <FileText className={styles.capturaFacilInfoIcon} /> 
                        Categoria: <span className={styles.capturaFacilInfoValue}>{selectedBoleto.categoria}</span>
                      </div>
                      <div className={styles.capturaFacilInfoItem}>
                        <CheckCircle2 className={styles.capturaFacilInfoIcon} /> 
                        <span className={styles.capturaFacilInfoValue}>{formatCurrencyFromCents(selectedBoleto.valorCentavos)}</span>
                      </div>
                    </div>

                    {/* Seção de Observações */}
                    {selectedBoleto.form?.observacoes && (
                      <div className={styles.capturaFacilObservationsSection}>
                        <div className={styles.capturaFacilObservationsHeader}>
                          <FileText className={styles.capturaFacilObservationsIcon} />
                          <h3 className={styles.capturaFacilObservationsTitle}>Observações</h3>
                        </div>
                        <div className={styles.capturaFacilObservationsContainer}>
                          <div className={styles.capturaFacilObservationsText}>
                            {selectedBoleto.form.observacoes}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Nova Despesa Drawer */}
      <NovaDespesaDrawer
        isOpen={showNovaDespesaDrawer}
        onClose={() => {
          setShowNovaDespesaDrawer(false);
          setBoletoParaDespesa(null);
        }}
        onSave={handleDespesaSalva}
        dadosBoleto={boletoParaDespesa}
      />
    </>
  );
}


