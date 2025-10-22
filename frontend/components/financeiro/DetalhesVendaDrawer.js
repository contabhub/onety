import { useState, useEffect } from 'react';
import { Button } from './botao';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { X, Calendar, User, Building, DollarSign, FileText, Mail, CreditCard, Download, Package, TrendingUp } from 'lucide-react';
import { toast } from 'react-toastify';

// DetalhesVendaDrawerProps: { isOpen: boolean, onClose: () => void, vendaId: number | null, onRefresh?: () => void }
// VendaDetalhada: { id: number, tipo_venda: string, cliente_id: number, cliente_nome: string, cliente_email?: string, categoria_id?: number, sub_categoria_id?: number, produtos_servicos_id?: number, produto_servico_nome?: string, company_id: number, empresa_nome: string, centro_de_custo_id?: number, centro_custo_nome?: string, vendedor_id?: number, vendedor_nome?: string, data_venda: string, situacao: string, valor_venda: number, desconto_venda: number, pagamento?: string, conta_recebimento?: number, conta_recebimento_nome?: string, conta_recebimento_api?: number, conta_recebimento_api_nome?: string, parcelamento?: number, vencimento: string, observacoes?: string, natureza?: string, observacoes_fiscais?: string, created_at: string, updated_at: string, contrato_origem_id?: number, mes_referencia?: number, ano_referencia?: number }
// BoletoInfo: { id: number, codigo_solicitacao: string, link_boleto: string, data_vencimento: string, valor_nominal: number, status: string, data_emissao: string }

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

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vendas/${vendaId}`, {
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

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/inter-boletos/boletos/codigo-por-venda/${vendaId}`, {
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

      const response = await fetch(`${API}/vendas/${venda.id}/gerar-boleto`, {
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

      const response = await fetch(`${API}/inter-boletos/pdf-simples/${boleto.codigo_solicitacao}`, {
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

      const response = await fetch(`${API}/vendas/${venda.id}`, {
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
        <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
          Não definido
        </Badge>
      );
    }

    switch (situacao) {
      case "ativo":
        return (
          <Badge className="bg-[#4CAF50]/20 text-[#4CAF50] border-[#4CAF50]/30">
            Ativo
          </Badge>
        );
      case "aprovado":
        return (
          <Badge className="bg-[#1E88E5]/20 text-[#26a6eb] border-[#1E88E5]/30">
            Venda liberada
          </Badge>
        );
      case "em_andamento":
        return (
          <Badge className="bg-[#FF9800]/20 text-[#FF9800] border-[#FF9800]/30">
            Em Andamento
          </Badge>
        );
      case "recusado":
        return (
          <Badge className="bg-[#F50057]/20 text-[#ff1769] border-[#F50057]/30">
            Recusado
          </Badge>
        );
      case "pendente":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            Pendente
          </Badge>
        );
      case "processado":
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            Processado
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
            {situacao}
          </Badge>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-darkPurple rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-neonPurple">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neonPurple bg-darkPurple sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-primary" />
            <div>
              <h2 className="text-xl font-bold text-textMain">
                Detalhes da Venda #{venda?.id}
              </h2>
              <p className="text-sm text-textSecondary">
                {venda ? formatCurrency(venda.valor_venda) : '-'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-textSecondary hover:text-textMain"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 bg-darkPurple">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-textMain">Carregando detalhes...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-hotPink mb-4">{error}</p>
              <Button onClick={fetchVendaDetalhes} className="bg-primary hover:bg-primary/80 text-textMain">
                Tentar novamente
              </Button>
            </div>
          ) : venda ? (
            <>
              {/* Informações da Venda */}
              <Card className="bg-darkPurple border-neonPurple">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg text-textMain">
                    <Building className="w-5 h-5 text-primary" />
                    Informações da Venda
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-textSecondary">Cliente</label>
                      <p className="text-primary font-medium">{venda.cliente_nome}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-textSecondary">Tipo de Venda</label>
                      <p className="text-textMain">{venda.tipo_venda || 'Não definido'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-textSecondary">Data da Venda</label>
                      <p className="text-textMain">{formatDate(venda.data_venda)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-textSecondary">Vencimento</label>
                      {editandoVencimento ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={novoVencimento}
                            onChange={(e) => setNovoVencimento(e.target.value)}
                            className="bg-darkPurple border border-neonPurple rounded px-2 py-1 text-sm text-textMain"
                          />
                          <Button
                            size="sm"
                            onClick={handleSalvarVencimento}
                            className="bg-green-500 hover:bg-green-600 text-white h-7"
                          >
                            Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditandoVencimento(false);
                              setNovoVencimento(toInputDateValue(venda.vencimento));
                            }}
                            className="border-neonPurple h-7"
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-textMain">{formatDate(venda.vencimento)}</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditandoVencimento(true)}
                            className="text-primary hover:text-primary/80 h-6 px-2"
                          >
                            <Calendar className="w-3 h-3 mr-1" />
                            Editar
                          </Button>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-textSecondary">Situação</label>
                      <div className="mt-1">{getSituacaoBadge(venda.situacao)}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-textSecondary">Vendedor</label>
                      <p className="text-textMain">{venda.vendedor_nome || 'Não definido'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-textSecondary">Empresa</label>
                      <p className="text-textMain">{venda.empresa_nome}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-textSecondary">Centro de Custo</label>
                      <p className="text-textMain">{venda.centro_custo_nome || 'Não definido'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Valores */}
              <Card className="bg-darkPurple border-neonPurple">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg text-textMain">
                    <DollarSign className="w-5 h-5 text-green-500" />
                    Valores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-textSecondary">Valor Bruto:</span>
                      <span className="text-textMain font-medium">{formatCurrency(venda.valor_venda + (venda.desconto_venda || 0))}</span>
                    </div>
                    {venda.desconto_venda > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-textSecondary">Desconto:</span>
                        <span className="text-orange-400 font-medium">- {formatCurrency(venda.desconto_venda)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-3 border-t border-neonPurple">
                      <span className="text-textMain font-semibold">Valor Total:</span>
                      <span className="text-green-500 font-bold text-xl flex items-center gap-1">
                        <TrendingUp className="w-5 h-5" />
                        {formatCurrency(venda.valor_venda)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Produto/Serviço */}
              {venda.produto_servico_nome && (
                <Card className="bg-darkPurple border-neonPurple">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg text-textMain">
                      <Package className="w-5 h-5 text-purple-500" />
                      Produto/Serviço
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-textMain">{venda.produto_servico_nome}</p>
                  </CardContent>
                </Card>
              )}

              {/* Informações de Pagamento */}
              <Card className="bg-darkPurple border-neonPurple">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg text-textMain">
                    <CreditCard className="w-5 h-5 text-green-500" />
                    Informações de Pagamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-textSecondary">Forma de Pagamento</label>
                      <p className="text-textMain">{venda.pagamento || 'Não definido'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-textSecondary">Conta de Recebimento</label>
                      <p className="text-textMain">{venda.conta_recebimento_nome || venda.conta_recebimento_api_nome || 'Não definido'}</p>
                    </div>
                    {venda.parcelamento && venda.parcelamento > 1 && (
                      <div>
                        <label className="text-sm font-medium text-textSecondary">Parcelamento</label>
                        <p className="text-textMain">{venda.parcelamento}x</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Boleto */}
              <Card className="bg-darkPurple border-neonPurple">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg text-textMain">
                    <CreditCard className="w-5 h-5 text-primary" />
                    Boleto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingBoleto ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      <span className="ml-2 text-textSecondary">Verificando boleto...</span>
                    </div>
                  ) : boleto ? (
                    <div className="space-y-3">
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-green-400 text-sm">✅ Boleto gerado</p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={fetchBoletoVenda}
                              disabled={loadingBoleto}
                              className="text-xs"
                            >
                              {loadingBoleto ? '🔄' : '🔄'} Recarregar
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-textSecondary">Código:</span>
                            <p className="text-textMain font-mono">
                              {boleto.codigo_solicitacao || 'Não encontrado'}
                            </p>
                          </div>
                          <div>
                            <span className="text-textSecondary">Vencimento:</span>
                            <p className="text-textMain">
                              {boleto.data_vencimento ? formatDate(boleto.data_vencimento) : (venda?.vencimento ? formatDate(venda.vencimento) : 'Não definido')}
                            </p>
                          </div>
                          <div>
                            <span className="text-textSecondary">Valor:</span>
                            <p className="text-textMain">
                              {formatCurrency(boleto.valor_nominal || venda?.valor_venda || 0)}
                            </p>
                          </div>
                          <div>
                            <span className="text-textSecondary">Status:</span>
                            <p className="text-textMain">
                              {boleto.status || venda?.situacao || 'Não definido'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={handleBaixarBoleto}
                        disabled={baixandoBoleto}
                        className="w-full bg-primary hover:bg-primary/80 text-textMain"
                      >
                        {baixandoBoleto ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                            Baixando...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" />
                            Baixar Boleto
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-textSecondary text-sm">Nenhum boleto gerado para esta venda</p>
                      <Button
                        onClick={handleGerarBoleto}
                        disabled={gerandoBoleto}
                        className="w-full bg-green-500 hover:bg-green-600 text-white"
                      >
                        {gerandoBoleto ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                            Gerando...
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-4 h-4 mr-2" />
                            Gerar Boleto
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Observações */}
              {(venda.observacoes || venda.observacoes_fiscais) && (
                <Card className="bg-darkPurple border-neonPurple">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg text-textMain">
                      <FileText className="w-5 h-5 text-primary" />
                      Observações
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {venda.observacoes && (
                      <div>
                        <label className="text-sm font-medium text-textSecondary">Observações Gerais</label>
                        <p className="text-textMain text-sm mt-1">{venda.observacoes}</p>
                      </div>
                    )}
                    {venda.observacoes_fiscais && (
                      <div>
                        <label className="text-sm font-medium text-textSecondary">Observações Fiscais</label>
                        <p className="text-textMain text-sm mt-1">{venda.observacoes_fiscais}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Email Cliente */}
              {venda.cliente_email && (
                <Card className="bg-darkPurple border-neonPurple">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg text-textMain">
                      <Mail className="w-5 h-5 text-primary" />
                      Contato
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div>
                      <label className="text-sm font-medium text-textSecondary">E-mail do Cliente</label>
                      <p className="text-textMain">{venda.cliente_email}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-neonPurple bg-darkPurple sticky bottom-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-neonPurple bg-darkPurple text-textMain hover:bg-neonPurple hover:text-textMain"
          >
            Fechar
          </Button>
          <div className="flex items-center gap-2">
            {boleto && (
              <Button
                variant="outline"
                onClick={handleBaixarBoleto}
                disabled={baixandoBoleto}
                className="border-primary bg-darkPurple text-primary hover:bg-primary hover:text-textMain"
              >
                <Download className="w-4 h-4 mr-2" />
                Baixar Boleto
              </Button>
            )}
            {!boleto && (
              <Button
                onClick={handleGerarBoleto}
                disabled={gerandoBoleto}
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Gerar Boleto
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
