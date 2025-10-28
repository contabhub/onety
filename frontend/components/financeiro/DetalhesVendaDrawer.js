import { useState, useEffect } from 'react';
import { X, Calendar, User, Building, DollarSign, FileText, Mail, CreditCard, Download, Package, TrendingUp } from 'lucide-react';
import { toast } from 'react-toastify';
import styles from '../../styles/financeiro/DetalhesVendaDrawer.module.css';


export function DetalhesVendaDrawer({ isOpen, onClose, vendaId, onRefresh }) {
  const [venda, setVenda] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gerandoBoleto, setGerandoBoleto] = useState(false);
  const [baixandoBoleto, setBaixandoBoleto] = useState(false);
  const [boleto, setBoleto] = useState(null);
  const [loadingBoleto, setLoadingBoleto] = useState(false);
  const [editandoVencimento, setEditandoVencimento] = useState(false);
  const [novoVencimento, setNovoVencimento] = useState('');

  useEffect(() => {
    if (isOpen && vendaId) {
      fetchVendaDetalhes();
      fetchBoletoVenda();
    } else if (!isOpen) {
      setVenda(null);
      setBoleto(null);
      setEditandoVencimento(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, vendaId]);

  const fetchVendaDetalhes = async () => {
    if (!vendaId) return;

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token não encontrado');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/financeiro/vendas/${vendaId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar detalhes da venda');
      }

      const data = await response.json();
      setVenda(data);
      setNovoVencimento(toInputDateValue(data.vencimento));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchBoletoVenda = async () => {
    if (!vendaId) return;

    setLoadingBoleto(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      console.log(`🔍 Buscando boleto para venda ${vendaId}...`);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/financeiro/boletos/boletos/codigo-por-venda/${vendaId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📊 Dados do boleto recebidos:', data);
        setBoleto(data);
      } else {
        const errorData = await response.json();
        console.log('❌ Erro ao buscar boleto:', errorData);
        setBoleto(null);
      }
    } catch (error) {
      console.error('Erro ao buscar boleto da venda:', error);
      setBoleto(null);
    } finally {
      setLoadingBoleto(false);
    }
  };

  const handleGerarBoleto = async () => {
    if (!venda) return;

    setGerandoBoleto(true);
    try {
      const token = localStorage.getItem('token');
      const API = process.env.NEXT_PUBLIC_API_URL;

      if (!token || !API) {
        throw new Error('Token ou URL da API não encontrados');
      }

      const response = await fetch(`${API}/financeiro/vendas/${venda.id}/gerar-boleto`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          data_vencimento: venda.vencimento,
          observacoes: venda.observacoes || `Venda ${venda.id}`
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 400 && errorData.error?.includes('Já existe um boleto')) {
          toast.warning('Já existe um boleto gerado para esta venda');
          await fetchBoletoVenda();
          return;
        }
        
        // Erro de conexão com API Inter
        if (response.status === 500 && errorData.details === 'no healthy upstream') {
          toast.error(
            '⚠️ Erro de Conexão com Banco Inter\n\n' +
            'Possíveis causas:\n' +
            '• Certificados digitais inválidos\n' +
            '• Credenciais incorretas\n' +
            '• Conta Inter não configurada\n\n' +
            'Contate o administrador do sistema.',
            { autoClose: 8000 }
          );
          throw new Error('Erro de conexão com API do Banco Inter');
        }
        
        throw new Error(errorData.error || 'Erro ao gerar boleto');
      }

      const responseData = await response.json();
      toast.success('Boleto gerado com sucesso!');
      
      await fetchBoletoVenda();
      
      if (responseData.link) {
        setTimeout(() => {
          window.open(responseData.link, '_blank');
        }, 1000);
      }

    } catch (error) {
      console.error('Erro ao gerar boleto:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar boleto';
      toast.error(errorMessage);
    } finally {
      setGerandoBoleto(false);
    }
  };

  const handleBaixarBoleto = async () => {
    if (!boleto) return;

    if (!boleto.codigo_solicitacao) {
      toast.error('Código do boleto não encontrado');
      return;
    }

    setBaixandoBoleto(true);
    try {
      const token = localStorage.getItem('token');
      const API = process.env.NEXT_PUBLIC_API_URL;

      if (!token || !API) {
        throw new Error('Token ou URL da API não encontrados');
      }

      console.log('🔍 Tentando baixar boleto com código:', boleto.codigo_solicitacao);

      const response = await fetch(`${API}/financeiro/boletos/pdf-simples/${boleto.codigo_solicitacao}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao baixar boleto');
      }

      const contentType = response.headers.get('content-type');

      if (contentType === 'application/pdf') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `boleto_venda_${venda?.id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success('Boleto baixado com sucesso!');
      } else {
        const data = await response.json();
        if (data.pdf) {
          const byteCharacters = atob(data.pdf);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `boleto_venda_${venda?.id}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          toast.success('Boleto baixado com sucesso!');
        }
      }
    } catch (error) {
      console.error('Erro ao baixar boleto:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao baixar boleto';
      toast.error(errorMessage);
    } finally {
      setBaixandoBoleto(false);
    }
  };


  const handleSalvarVencimento = async () => {
    if (!venda || !novoVencimento) return;

    try {
      const token = localStorage.getItem('token');
      const API = process.env.NEXT_PUBLIC_API_URL;

      if (!token || !API) {
        throw new Error('Token ou URL da API não encontrados');
      }

      const response = await fetch(`${API}/financeiro/vendas/${venda.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          vencimento: novoVencimento
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar vencimento');
      }

      toast.success('Data de vencimento atualizada com sucesso!');
      setEditandoVencimento(false);
      await fetchVendaDetalhes();
      
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Erro ao atualizar vencimento:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar vencimento';
      toast.error(errorMessage);
    }
  };

  const formatCurrency = (value) => {
    if (!value || isNaN(value)) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const parseDateSafe = (input) => {
    if (!input) return null;
    if (input instanceof Date) {
      return isNaN(input.getTime()) ? null : input;
    }
    const raw = String(input).trim();
    if (!raw) return null;
    let d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      d = new Date(`${raw}T00:00:00`);
      if (!isNaN(d.getTime())) return d;
    }
    if (raw.includes(" ")) {
      d = new Date(raw.replace(" ", "T"));
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  const formatDate = (value) => {
    const d = parseDateSafe(value);
    if (!d) return "-";
    return d.toLocaleDateString("pt-BR");
  };

  const toInputDateValue = (value) => {
    const d = parseDateSafe(value);
    if (!d) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getSituacaoBadge = (situacao) => {
    if (!situacao) {
      return (
        <span className={`${styles.badgeComponent} ${styles.badge} ${styles.badgeGray}`}>
          Não definido
        </span>
      );
    }

    switch (situacao) {
      case "ativo":
        return (
          <span className={`${styles.badgeComponent} ${styles.badge} ${styles.badgeGreen}`}>
            Ativo
          </span>
        );
      case "aprovado":
        return (
          <span className={`${styles.badgeComponent} ${styles.badge} ${styles.badgeBlue}`}>
            Venda liberada
          </span>
        );
      case "em_andamento":
        return (
          <span className={`${styles.badgeComponent} ${styles.badge} ${styles.badgeOrange}`}>
            Em Andamento
          </span>
        );
      case "recusado":
        return (
          <span className={`${styles.badgeComponent} ${styles.badge} ${styles.badgeRed}`}>
            Recusado
          </span>
        );
      case "pendente":
        return (
          <span className={`${styles.badgeComponent} ${styles.badge} ${styles.badgeYellow}`}>
            Pendente
          </span>
        );
      case "processado":
        return (
          <span className={`${styles.badgeComponent} ${styles.badge} ${styles.badgeBlueAlt}`}>
            Processado
          </span>
        );
      default:
        return (
          <span className={`${styles.badgeComponent} ${styles.badge} ${styles.badgeGray}`}>
            {situacao}
          </span>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.drawer}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <FileText className={styles.headerIcon} />
            <div>
              <h2 className={styles.headerTitle}>
                Detalhes da Venda #{venda?.id}
              </h2>
              <p className={styles.headerSubtitle}>
                {venda ? formatCurrency(venda.valor_venda) : '-'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`${styles.buttonComponent} ${styles.buttonGhost} ${styles.buttonSmall} ${styles.closeButton}`}
          >
            <X className={`w-5 h-5 ${styles.closeButton}`} />
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinner}></div>
              <span className={styles.loadingText}>Carregando detalhes...</span>
            </div>
          ) : error ? (
            <div className={styles.errorContainer}>
              <p className={styles.errorMessage}>{error}</p>
              <button 
                onClick={fetchVendaDetalhes} 
                className={`${styles.buttonComponent} ${styles.buttonPrimary}`}
              >
                Tentar novamente
              </button>
            </div>
          ) : venda ? (
            <>
              {/* Informações da Venda */}
              <div className={`${styles.cardComponent} ${styles.card}`}>
                <div className={`${styles.cardHeaderComponent} ${styles.cardHeader}`}>
                  <h3 className={`${styles.cardTitleComponent} ${styles.cardTitle}`}>
                    <Building className={styles.cardTitleIcon} />
                    Informações da Venda
                  </h3>
                </div>
                <div className={`${styles.cardContentComponent} ${styles.cardContent}`}>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <label className={styles.infoLabel}>Cliente</label>
                      <p className={styles.infoValuePrimary}>{venda.cliente_nome}</p>
                    </div>
                    <div className={styles.infoItem}>
                      <label className={styles.infoLabel}>Tipo de Venda</label>
                      <p className={styles.infoValue}>{venda.tipo_venda || 'Não definido'}</p>
                    </div>
                    <div className={styles.infoItem}>
                      <label className={styles.infoLabel}>Data da Venda</label>
                      <p className={styles.infoValue}>{formatDate(venda.data_venda)}</p>
                    </div>
                    <div className={styles.infoItem}>
                      <label className={styles.infoLabel}>Vencimento</label>
                      {editandoVencimento ? (
                        <div className={styles.dateEditContainer}>
                          <input
                            type="date"
                            value={novoVencimento}
                            onChange={(e) => setNovoVencimento(e.target.value)}
                            className={styles.dateInput}
                          />
                          <div className={styles.dateEditButtons}>
                            <button
                              onClick={handleSalvarVencimento}
                              className={`${styles.buttonComponent} ${styles.buttonSmall} ${styles.buttonSuccess} ${styles.saveButton}`}
                            >
                              Salvar
                            </button>
                            <button
                              onClick={() => {
                                setEditandoVencimento(false);
                                setNovoVencimento(toInputDateValue(venda.vencimento));
                              }}
                              className={`${styles.buttonComponent} ${styles.buttonSmall} ${styles.buttonOutline} ${styles.cancelButton}`}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.dateEditContainer}>
                          <p className={styles.infoValue}>{formatDate(venda.vencimento)}</p>
                          <button
                            onClick={() => setEditandoVencimento(true)}
                            className={`${styles.buttonComponent} ${styles.buttonSmall} ${styles.buttonGhost} ${styles.editButton}`}
                          >
                            <Calendar className={styles.editIcon} />
                            Editar
                          </button>
                        </div>
                      )}
                    </div>
                    <div className={styles.infoItem}>
                      <label className={styles.infoLabel}>Situação</label>
                      <div className="mt-1">{getSituacaoBadge(venda.situacao)}</div>
                    </div>
                    <div className={styles.infoItem}>
                      <label className={styles.infoLabel}>Vendedor</label>
                      <p className={styles.infoValue}>{venda.vendedor_nome || 'Não definido'}</p>
                    </div>
                    <div className={styles.infoItem}>
                      <label className={styles.infoLabel}>Empresa</label>
                      <p className={styles.infoValue}>{venda.empresa_nome}</p>
                    </div>
                    <div className={styles.infoItem}>
                      <label className={styles.infoLabel}>Centro de Custo</label>
                      <p className={styles.infoValue}>{venda.centro_custo_nome || 'Não definido'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Valores */}
              <div className={`${styles.cardComponent} ${styles.card}`}>
                <div className={`${styles.cardHeaderComponent} ${styles.cardHeader}`}>
                  <h3 className={`${styles.cardTitleComponent} ${styles.cardTitle}`}>
                    <DollarSign className={styles.cardTitleIcon} style={{color: '#10b981'}} />
                    Valores
                  </h3>
                </div>
                <div className={`${styles.cardContentComponent} ${styles.cardContent}`}>
                  <div className={styles.valuesContainer}>
                    <div className={styles.valueRow}>
                      <span className={styles.valueRowSecondary}>Valor Bruto:</span>
                      <span className={styles.valueRowMain}>{formatCurrency(venda.valor_venda + (venda.desconto_venda || 0))}</span>
                    </div>
                    {venda.desconto_venda > 0 && (
                      <div className={styles.valueRow}>
                        <span className={styles.valueRowSecondary}>Desconto:</span>
                        <span className={styles.valueRowOrange}>- {formatCurrency(venda.desconto_venda)}</span>
                      </div>
                    )}
                    <div className={`${styles.valueRow} ${styles.valueRowDivider}`}>
                      <span className={styles.valueRowTotal}>Valor Total:</span>
                      <span className={styles.valueRowTotalAmount}>
                        <TrendingUp className={styles.valueRowTotalIcon} />
                        {formatCurrency(venda.valor_venda)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Produto/Serviço */}
              {venda.produto_servico_nome && (
                <div className={`${styles.cardComponent} ${styles.card}`}>
                  <div className={`${styles.cardHeaderComponent} ${styles.cardHeader}`}>
                    <h3 className={`${styles.cardTitleComponent} ${styles.cardTitle}`}>
                      <Package className={styles.cardTitleIcon} style={{color: '#8b5cf6'}} />
                      Produto/Serviço
                    </h3>
                  </div>
                  <div className={`${styles.cardContentComponent} ${styles.cardContent}`}>
                    <p className={styles.infoValue}>{venda.produto_servico_nome}</p>
                  </div>
                </div>
              )}

              {/* Informações de Pagamento */}
              <div className={`${styles.cardComponent} ${styles.card}`}>
                <div className={`${styles.cardHeaderComponent} ${styles.cardHeader}`}>
                  <h3 className={`${styles.cardTitleComponent} ${styles.cardTitle}`}>
                    <CreditCard className={styles.cardTitleIcon} style={{color: '#10b981'}} />
                    Informações de Pagamento
                  </h3>
                </div>
                <div className={`${styles.cardContentComponent} ${styles.cardContent}`}>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <label className={styles.infoLabel}>Forma de Pagamento</label>
                      <p className={styles.infoValue}>{venda.pagamento || 'Não definido'}</p>
                    </div>
                    <div className={styles.infoItem}>
                      <label className={styles.infoLabel}>Conta de Recebimento</label>
                      <p className={styles.infoValue}>{venda.conta_recebimento_nome || venda.conta_recebimento_api_nome || 'Não definido'}</p>
                    </div>
                    {venda.parcelamento && venda.parcelamento > 1 && (
                      <div className={styles.infoItem}>
                        <label className={styles.infoLabel}>Parcelamento</label>
                        <p className={styles.infoValue}>{venda.parcelamento}x</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Boleto */}
              <div className={`${styles.cardComponent} ${styles.card}`}>
                <div className={`${styles.cardHeaderComponent} ${styles.cardHeader}`}>
                  <h3 className={`${styles.cardTitleComponent} ${styles.cardTitle}`}>
                    <CreditCard className={styles.cardTitleIcon} />
                    Boleto
                  </h3>
                </div>
                <div className={`${styles.cardContentComponent} ${styles.cardContent}`}>
                  {loadingBoleto ? (
                    <div className={styles.boletoLoadingContainer}>
                      <div className={styles.boletoLoadingSpinner}></div>
                      <span className={styles.boletoLoadingText}>Verificando boleto...</span>
                    </div>
                  ) : boleto ? (
                    <div className={styles.boletoContainer}>
                      <div className={styles.boletoSuccessContainer}>
                        <div className={styles.boletoSuccessHeader}>
                          <p className={styles.boletoSuccessText}>✅ Boleto gerado</p>
                          <div className="flex gap-2">
                            <button
                              onClick={fetchBoletoVenda}
                              disabled={loadingBoleto}
                              className={`${styles.buttonComponent} ${styles.buttonSmall} ${styles.buttonOutline} ${styles.boletoReloadButton}`}
                            >
                              {loadingBoleto ? '🔄' : '🔄'} Recarregar
                            </button>
                          </div>
                        </div>
                        <div className={styles.boletoInfoGrid}>
                          <div className={styles.boletoInfoItem}>
                            <span className={styles.boletoInfoLabel}>Código:</span>
                            <p className={styles.boletoInfoValue}>
                              {boleto.codigo_solicitacao || 'Não encontrado'}
                            </p>
                          </div>
                          <div className={styles.boletoInfoItem}>
                            <span className={styles.boletoInfoLabel}>Vencimento:</span>
                            <p className={styles.boletoInfoValue}>
                              {boleto.data_vencimento ? formatDate(boleto.data_vencimento) : (venda?.vencimento ? formatDate(venda.vencimento) : 'Não definido')}
                            </p>
                          </div>
                          <div className={styles.boletoInfoItem}>
                            <span className={styles.boletoInfoLabel}>Valor:</span>
                            <p className={styles.boletoInfoValue}>
                              {formatCurrency(boleto.valor_nominal || venda?.valor_venda || 0)}
                            </p>
                          </div>
                          <div className={styles.boletoInfoItem}>
                            <span className={styles.boletoInfoLabel}>Status:</span>
                            <p className={styles.boletoInfoValue}>
                              {boleto.status || venda?.situacao || 'Não definido'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={handleBaixarBoleto}
                        disabled={baixandoBoleto}
                        className={`${styles.buttonComponent} ${styles.buttonPrimary} ${styles.boletoDownloadButton}`}
                      >
                        {baixandoBoleto ? (
                          <>
                            <div className={styles.boletoDownloadSpinner}></div>
                            Baixando...
                          </>
                        ) : (
                          <>
                            <Download className={styles.boletoDownloadIcon} />
                            Baixar Boleto
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className={styles.boletoGenerateContainer}>
                      <p className={styles.boletoGenerateText}>Nenhum boleto gerado para esta venda</p>
                      <button
                        onClick={handleGerarBoleto}
                        disabled={gerandoBoleto}
                        className={`${styles.buttonComponent} ${styles.buttonSuccess} ${styles.boletoGenerateButton}`}
                      >
                        {gerandoBoleto ? (
                          <>
                            <div className={styles.boletoGenerateSpinner}></div>
                            Gerando...
                          </>
                        ) : (
                          <>
                            <CreditCard className={styles.boletoGenerateIcon} />
                            Gerar Boleto
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Observações */}
              {(venda.observacoes || venda.observacoes_fiscais) && (
                <div className={`${styles.cardComponent} ${styles.card}`}>
                  <div className={`${styles.cardHeaderComponent} ${styles.cardHeader}`}>
                    <h3 className={`${styles.cardTitleComponent} ${styles.cardTitle}`}>
                      <FileText className={styles.cardTitleIcon} />
                      Observações
                    </h3>
                  </div>
                  <div className={`${styles.cardContentComponent} ${styles.cardContent} ${styles.observationsContainer}`}>
                    {venda.observacoes && (
                      <div className={styles.observationItem}>
                        <label className={styles.observationLabel}>Observações Gerais</label>
                        <p className={styles.observationText}>{venda.observacoes}</p>
                      </div>
                    )}
                    {venda.observacoes_fiscais && (
                      <div className={styles.observationItem}>
                        <label className={styles.observationLabel}>Observações Fiscais</label>
                        <p className={styles.observationText}>{venda.observacoes_fiscais}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Email Cliente */}
              {venda.cliente_email && (
                <div className={`${styles.cardComponent} ${styles.card}`}>
                  <div className={`${styles.cardHeaderComponent} ${styles.cardHeader}`}>
                    <h3 className={`${styles.cardTitleComponent} ${styles.cardTitle}`}>
                      <Mail className={styles.cardTitleIcon} />
                      Contato
                    </h3>
                  </div>
                  <div className={`${styles.cardContentComponent} ${styles.cardContent}`}>
                    <div className={styles.infoItem}>
                      <label className={styles.infoLabel}>E-mail do Cliente</label>
                      <p className={styles.infoValue}>{venda.cliente_email}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerActions}>
            {boleto && (
              <button
                onClick={handleBaixarBoleto}
                disabled={baixandoBoleto}
                className={`${styles.buttonComponent} ${styles.buttonOutline} ${styles.footerDownloadButton}`}
              >
                <Download className={styles.footerDownloadIcon} />
                Baixar Boleto
              </button>
            )}
            {!boleto && (
              <button
                onClick={handleGerarBoleto}
                disabled={gerandoBoleto}
                className={`${styles.buttonComponent} ${styles.buttonSuccess} ${styles.footerGenerateButton}`}
              >
                <CreditCard className={styles.footerGenerateIcon} />
                Gerar Boleto
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
