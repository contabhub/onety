import { useState, useEffect } from 'react';
import { Button } from './botao';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { Separator } from './separator';
import { X, Calendar, User, Building, Package, DollarSign, FileText, Settings, Mail, Clock, TrendingUp, ChevronDown, CreditCard, Download } from 'lucide-react';
import { toast } from 'react-toastify';
import { generateReciboContrato } from '../../utils/financeiro/pdfGenerator';
import { EditarVencimentoContratoModal } from './EditarVencimentoContratoModal';
import EditarContratoDrawer from './EditarContratoDrawer';
import styles from '../../styles/financeiro/DetalhesContratoDrawer.module.css';


export function DetalhesContratoDrawer({ isOpen, onClose, contratoId, mostrarApenasBoletosP = false }) {
  const [contrato, setContrato] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Comentado temporariamente - Estados de edição de e-mail
  // const [editandoEmail, setEditandoEmail] = useState(false);
  // const [novoEmail, setNovoEmail] = useState('');
  // const [salvandoEmail, setSalvandoEmail] = useState(false);
  const [loadingBoletos, setLoadingBoletos] = useState(false);
  const [boletosPagamento, setBoletosPagamento] = useState([]);
  const [isEditarVencimentoOpen, setIsEditarVencimentoOpen] = useState(false);
  const [dataParaEditar, setDataParaEditar] = useState('');
  const [isEditarContratoOpen, setIsEditarContratoOpen] = useState(false);
  const [opcaoEdicaoContrato, setOpcaoEdicaoContrato] = useState(undefined);
  const [anoSelecionado, setAnoSelecionado] = useState('2025');
  const [gerandoBoleto, setGerandoBoleto] = useState(false);
  const [vendasContrato, setVendasContrato] = useState([]);
  const [loadingVendas, setLoadingVendas] = useState(false);
  const [editandoVenda, setEditandoVenda] = useState(null);
  const [gerandoBoletoVenda, setGerandoBoletoVenda] = useState(null);
  const [boletosGeradosComSucesso, setBoletosGeradosComSucesso] = useState(new Set());
  const [todosBoletosDesabilitados, setTodosBoletosDesabilitados] = useState(false);
  const [baixandoBoleto, setBaixandoBoleto] = useState(null);

  const handleEditarVencimento = (data) => {
    setDataParaEditar(data);
    setIsEditarVencimentoOpen(true);
  };

  const handleConfirmarEdicaoVencimento = (contratoId, opcao, novaData) => {
    console.log("🔍 DetalhesDrawer - Recebido do modal:", { contratoId, opcao, novaData });
    
    // Armazenar dados da edição e abrir drawer de edição
    const opcaoEdicao = { opcao, novaData };
    console.log("🔍 DetalhesDrawer - Definindo opcaoEdicaoContrato:", opcaoEdicao);
    
    setOpcaoEdicaoContrato(opcaoEdicao);
    setIsEditarContratoOpen(true);
  };

  const handleSuccessEditarContrato = () => {
    // Recarregar os dados do contrato e boletos após edição
    setOpcaoEdicaoContrato(undefined);
    if (contratoId) {
      fetchContratoDetalhes();
      fetchBoletosPagamento();
    }
  };
  const [empresa, setEmpresa] = useState(null);

  // Buscar detalhes do contrato quando o drawer abrir
  useEffect(() => {
    if (isOpen && contratoId) {
      fetchContratoDetalhes();
      fetchBoletosPagamento();
      fetchEmpresaDetalhes();
      fetchVendasContrato();
    } else if (!isOpen) {
      // Limpar dados quando o drawer for fechado
      setVendasContrato([]);
      setBoletosPagamento([]);
      setContrato(null);
      setEmpresa(null);
          setBoletosGeradosComSucesso(new Set());
          setTodosBoletosDesabilitados(false);
          setBaixandoBoleto(null);
    }
  }, [isOpen, contratoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Comentado temporariamente - Inicializar novoEmail quando contrato carregar
  /*
  useEffect(() => {
    if (contrato) {
      setNovoEmail(contrato.cliente_email || '');
    }
  }, [contrato]);
  */

  const fetchContratoDetalhes = async () => {
    if (!contratoId) return;

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token não encontrado');
      }

      // Buscar detalhes do contrato
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratos/${contratoId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      let data = await response.json();
      
      // Sempre buscar o e-mail do cliente, pois pode não estar incluído na resposta do contrato
      if (data.cliente_id) {
        try {
          const clienteResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/clientes/${data.cliente_id}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (clienteResponse.ok) {
            const clienteData = await clienteResponse.json();
            data = { ...data, cliente_email: clienteData.e_mail_principal };
            console.log('📧 E-mail do cliente encontrado:', clienteData.e_mail_principal);
          }
        } catch (clienteError) {
          console.warn('Erro ao buscar e-mail do cliente:', clienteError);
        }
      }
      setContrato(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchBoletosPagamento = async () => {
    if (!contratoId) return;

    setLoadingBoletos(true);
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Token não encontrado');
      }

      const boletosData = [];

      // Buscar boletos diretamente pelo contrato_id usando a rota correta
      try {
        const boletoResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/inter-boletos/boletos/por-contrato/${contratoId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (boletoResponse.ok) {
          const boletoInfo = await boletoResponse.json();
          const codigoSolicitacao = boletoInfo.codigoSolicitacao;
          
          if (codigoSolicitacao) {
            console.log(`🔍 Buscando status do boleto do contrato ${contratoId}: ${codigoSolicitacao}`);
            
            // Buscar status do boleto usando a rota correta
            const statusResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/inter-boletos/boletos/status/${codigoSolicitacao}`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });

            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              console.log(`✅ Status do boleto ${codigoSolicitacao}:`, statusData);
              
              // Mapear os dados para o formato esperado
              boletosData.push({
                da_id: contratoId,
                valor_recebido: statusData.valorRecebido || 0,
                data_pagamento: statusData.dataPagamento || null,
                data_cancelamento: statusData.dataCancelamento || null,
                codigo_solicitacao: codigoSolicitacao,
                status: statusData.statusBruto || statusData.situacao || 'EM_ABERTO'
              });
            } else {
              console.warn(`❌ Erro ao buscar status do boleto ${codigoSolicitacao}:`, statusResponse.status);
            }
          }
        } else {
          console.warn(`❌ Erro ao buscar boleto do contrato ${contratoId}:`, boletoResponse.status);
        }
      } catch (error) {
        console.warn(`❌ Erro ao processar contrato ${contratoId}:`, error);
      }

      setBoletosPagamento(boletosData);
      console.log('📊 Dados de pagamento dos boletos:', boletosData);
      console.log('🔍 Boletos encontrados para o contrato:', boletosData.length);
      console.log('🔍 Boletos com status RECEBIDO:', boletosData.filter(b => 
        b.status === "RECEBIDO" || b.status === "PAGO" || b.status === "pago" || b.status === "LIQUIDADO"
      ).length);
      
      // Log para debug da tabela de meses
      const boletosPagos = boletosData.filter(b => 
        b.status === "RECEBIDO" || b.status === "PAGO" || b.status === "pago" || b.status === "LIQUIDADO"
      );
      console.log('📅 Boletos pagos que aparecerão na tabela:', boletosPagos.map(b => ({
        data: b.data_pagamento,
        valor: b.valor_recebido,
        status: b.status
      })));
    } catch (err) {
      console.error('Erro ao buscar dados de pagamento dos boletos:', err);
    } finally {
      setLoadingBoletos(false);
    }
  };

  const fetchEmpresaDetalhes = async () => {
    // Buscar empresaId do userData (padrão correto do sistema)
    const userData = localStorage.getItem("userData");
    const user = userData ? JSON.parse(userData) : null;
    const empresaId = user?.EmpresaId || user?.empresa?.id || null;
    
    if (!empresaId) {
      toast.error('ID da empresa não encontrado');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token não encontrado');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/empresas/${empresaId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar dados da empresa');
      }

      const data = await response.json();
      setEmpresa({
        nome: data.nome,
        endereco: data.endereco,
        cnpj: data.cnpj
      });
    } catch (error) {
      console.error('Erro ao buscar empresa:', error);
      toast.error('Erro ao carregar dados da empresa');
    }
  };

  const fetchVendasContrato = async () => {
    if (!contratoId) {
      console.log('❌ fetchVendasContrato: contratoId não fornecido');
      return;
    }

    console.log(`🔍 fetchVendasContrato: Iniciando busca para contrato ${contratoId}`);
    setLoadingVendas(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token não encontrado');
      }

      console.log(`🔍 Buscando vendas do contrato ${contratoId}...`);
      console.log(`🔍 URL: ${process.env.NEXT_PUBLIC_API_URL}/vendas?contrato_origem_id=${contratoId}`);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vendas?contrato_origem_id=${contratoId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        // Se der erro 404 ou similar, não é um erro crítico - apenas não há vendas
        if (response.status === 404) {
          console.log(`ℹ️ Nenhuma venda encontrada para o contrato ${contratoId}`);
          setVendasContrato([]);
          return;
        }
        throw new Error('Erro ao buscar vendas do contrato');
      }

      const data = await response.json();
      console.log(`✅ Vendas encontradas para contrato ${contratoId}:`, data);
      console.log(`📊 Total de vendas encontradas: ${data.length}`);
      
      // 🔒 FILTRO CRÍTICO: Garantir que apenas vendas do contrato específico sejam exibidas
      const vendasFiltradas = data.filter((venda) => {
        const pertenceAoContrato = venda.contrato_origem_id === contratoId;
        if (!pertenceAoContrato) {
          console.warn(`⚠️ Venda ${venda.id} não pertence ao contrato ${contratoId} (contrato_origem_id: ${venda.contrato_origem_id})`);
        }
        return pertenceAoContrato;
      });
      
      console.log(`🔒 Vendas filtradas para contrato ${contratoId}:`, vendasFiltradas);
      console.log(`📊 Total de vendas válidas: ${vendasFiltradas.length}`);
      
      // Ordenar por ano e mês de referência
      const vendasOrdenadas = vendasFiltradas.sort((a, b) => {
        if (a.ano_referencia !== b.ano_referencia) {
          return a.ano_referencia - b.ano_referencia;
        }
        return a.mes_referencia - b.mes_referencia;
      });
      
      console.log(`📋 Vendas ordenadas para contrato ${contratoId}:`, vendasOrdenadas);
      
      // Se não há vendas válidas para este contrato, definir array vazio
      if (vendasOrdenadas.length === 0) {
        console.log(`ℹ️ Nenhuma venda válida encontrada para o contrato ${contratoId}`);
        setVendasContrato([]);
      } else {
        setVendasContrato(vendasOrdenadas);
      }
    } catch (error) {
      console.error('Erro ao buscar vendas do contrato:', error);
      // Não mostrar toast de erro para evitar spam - apenas log
      setVendasContrato([]);
    } finally {
      setLoadingVendas(false);
    }
  };

  // Comentado temporariamente - Função de salvar e-mail do cliente
  /*
  const handleSalvarEmailCliente = async () => {
    if (!contrato || !novoEmail.trim()) return;

    setSalvandoEmail(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token não encontrado');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/clientes/${contrato.cliente_id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          e_mail_principal: novoEmail.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar e-mail do cliente');
      }

      // Atualizar o estado local
      setContrato(prev => prev ? { ...prev, cliente_email: novoEmail.trim() } : null);
      setEditandoEmail(false);
      setNovoEmail('');
      toast.success('E-mail do cliente atualizado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar e-mail';
      toast.error(errorMessage);
    } finally {
      setSalvandoEmail(false);
    }
  };
  */

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
    // Tenta parse direto
    let d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
    // Se vier apenas data (YYYY-MM-DD), força meia-noite
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      d = new Date(`${raw}T00:00:00`);
      if (!isNaN(d.getTime())) return d;
    }
    // Se vier com espaço, troca por T
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
    if (!situacao)
      return (
        <Badge className={styles.badgeGray}>
          Não definido
        </Badge>
      );

    switch (situacao) {
      case "ativo":
        return (
          <Badge className={styles.badgeSuccess}>
            Ativo
          </Badge>
        );
      case "inativo":
        return (
          <Badge className={styles.badgeWarning}>
            Inativo
          </Badge>
        );
      case "cancelado":
        return (
          <Badge className={styles.badgeHotPink}>
            Cancelado
          </Badge>
        );
      default:
        return (
          <Badge className={styles.badgeGray}>
            {situacao}
          </Badge>
        );
    }
  };

  const calcularProximoVencimento = () => {
    if (!contrato?.data_inicio || !contrato?.dia_gerado) return "Indeterminado";
    
    try {
      const dataInicio = new Date(contrato.data_inicio);
      const hoje = new Date();
      const diaGerado = parseInt(contrato.dia_gerado) || 1;
      
      // Calcular próximo vencimento baseado no dia_gerado
      let proximoVencimento = new Date(hoje.getFullYear(), hoje.getMonth(), diaGerado);
      
      // Se já passou este mês, ir para o próximo
      if (proximoVencimento <= hoje) {
        proximoVencimento = new Date(hoje.getFullYear(), hoje.getMonth() + 1, diaGerado);
      }
      
      return formatDate(proximoVencimento.toISOString().split('T')[0]);
    } catch (error) {
      return "Indeterminado";
    }
  };

  const handleGerarRecibo = async () => {
    if (!contrato || !empresa) {
      toast.error('Dados insuficientes para gerar o recibo');
      return;
    }

    try {
      await generateReciboContrato(contrato, empresa);
      toast.success('Recibo gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar recibo:', error);
      toast.error('Erro ao gerar recibo');
    }
  };

  const handleGerarBoleto = async () => {
    if (!contrato) {
      toast.error('Dados do contrato não encontrados');
      return;
    }

    if (!contrato.proximo_vencimento) {
      toast.error('Contrato não possui data de vencimento definida');
      return;
    }

    // Por enquanto, vou usar uma conta corrente fixa
    // Em uma implementação completa, você deveria ter um modal para selecionar a conta
    const contaCorrente = "77777777"; // Substitua pela conta corrente desejada

    setGerandoBoleto(true);

    try {
      const token = localStorage.getItem("token");
      const API = process.env.NEXT_PUBLIC_API_URL;

      if (!token || !API) {
        throw new Error("Token ou URL da API não encontrados");
      }

      console.log("🔍 Gerando boleto para contrato:", contrato.id);

      const response = await fetch(`${API}/contratos/${contrato.id}/gerar-boleto`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          conta_corrente: contaCorrente
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("🚨 Erro na resposta do servidor:", response.status, errorData);
        throw new Error(`Erro ao gerar boleto: ${response.status}`);
      }

      const responseData = await response.json();
      console.log("✅ Boleto gerado com sucesso:", responseData);

      toast.success(`Boleto gerado com sucesso! Cliente: ${responseData.cliente}`);

      // Opcional: Mostrar mais detalhes do boleto gerado
      console.log("📧 Email do cliente:", responseData.email);
      console.log("💰 Valor do boleto:", responseData.valor);
      console.log("📅 Data de vencimento:", responseData.vencimento);

    } catch (error) {
      console.error("❌ Erro ao gerar boleto:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao gerar boleto";
      toast.error(errorMessage);
    } finally {
      setGerandoBoleto(false);
    }
  };

  const handleEditarVenda = async (vendaId, novaData) => {
    try {
      const token = localStorage.getItem("token");
      const API = process.env.NEXT_PUBLIC_API_URL;

      if (!token || !API) {
        throw new Error("Token ou URL da API não encontrados");
      }

      console.log(`🔍 Editando venda ${vendaId} para nova data: ${novaData}`);

      const response = await fetch(`${API}/vendas/${vendaId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          vencimento: novaData
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("🚨 Erro na resposta do servidor:", response.status, errorData);
        throw new Error(`Erro ao editar venda: ${response.status}`);
      }

      toast.success("Data da venda atualizada com sucesso!");
      
      // Recarregar as vendas do contrato
      await fetchVendasContrato();
      
    } catch (error) {
      console.error("❌ Erro ao editar venda:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao editar venda";
      toast.error(errorMessage);
    } finally {
      setEditandoVenda(null);
    }
  };

  const handleDownloadBoletoGerado = async (vendaId) => {
    try {
      const token = localStorage.getItem("token");
      const API = process.env.NEXT_PUBLIC_API_URL;

      if (!token || !API) {
        throw new Error("Token ou URL da API não encontrados");
      }

      console.log(`🔍 Buscando código de solicitação para venda ${vendaId}`);

      // Buscar código de solicitação usando a rota correta
      const response = await fetch(`${API}/inter-boletos/boletos/codigo-por-venda/${vendaId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn("Boleto não encontrado para esta venda");
          return;
        }
        throw new Error(`Erro ao buscar boleto: ${response.status}`);
      }

      const boletoData = await response.json();
      console.log("✅ Código de solicitação encontrado:", boletoData);

      if (boletoData.codigoSolicitacao) {
        console.log(`📄 Baixando PDF para código: ${boletoData.codigoSolicitacao}`);
        await handleDownloadPDFDireto(boletoData.codigoSolicitacao);
      } else {
        console.warn("Código de solicitação não encontrado");
      }

    } catch (error) {
      console.error("❌ Erro ao baixar boleto:", error);
    }
  };

  const handleDownloadPDFDireto = async (codigoSolicitacao) => {
    try {
      const token = localStorage.getItem("token");
      const API = process.env.NEXT_PUBLIC_API_URL;

      if (!token || !API) {
        throw new Error("Token ou URL da API não encontrados");
      }

      console.log(`📄 Baixando PDF diretamente para código: ${codigoSolicitacao}`);

      // Baixar PDF usando a rota correta
      const response = await fetch(`${API}/inter-boletos/pdf-simples/${codigoSolicitacao}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.warn(`⚠️ Erro ao baixar PDF: ${response.status}`);
        return;
      }

      // Verificar se é um PDF
      const contentType = response.headers.get('content-type');
      console.log(`📄 Content-Type recebido: ${contentType}`);

      if (contentType === 'application/pdf') {
        // É um PDF binário
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `boleto_${codigoSolicitacao}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        console.log("✅ PDF baixado com sucesso!");
      } else {
        // Pode ser JSON com PDF em base64
        const data = await response.json();
        console.log("📄 Resposta JSON recebida:", data);
        
        if (data.pdf) {
          // Converter base64 para blob e baixar
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
          link.download = `boleto_${codigoSolicitacao}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          console.log("✅ PDF baixado com sucesso (base64)!");
        } else {
          console.warn("⚠️ PDF não encontrado na resposta");
        }
      }

    } catch (error) {
      console.error("❌ Erro ao baixar PDF diretamente:", error);
    }
  };

  const handleBaixarBoletoIndividual = async (venda) => {
    setBaixandoBoleto(venda.id);
    
    try {
      const token = localStorage.getItem("token");
      const API = process.env.NEXT_PUBLIC_API_URL;

      if (!token || !API) {
        throw new Error("Token ou URL da API não encontrados");
      }

      console.log(`📥 Baixando boleto para venda ${venda.id}`);

      // Buscar código de solicitação usando a rota correta
      const response = await fetch(`${API}/inter-boletos/boletos/codigo-por-venda/${venda.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          toast.warning(`Boleto não encontrado para a venda ${venda.mes_referencia}º mês`);
          return;
        }
        throw new Error(`Erro ao buscar boleto: ${response.status}`);
      }

      const boletoData = await response.json();
      console.log("✅ Código de solicitação encontrado:", boletoData);

      if (boletoData.codigoSolicitacao) {
        console.log(`📄 Baixando PDF para código: ${boletoData.codigoSolicitacao}`);
        await handleDownloadPDFDireto(boletoData.codigoSolicitacao);
        toast.success(`Boleto da venda ${venda.mes_referencia}º mês baixado com sucesso!`);
      } else {
        toast.warning("Código de solicitação não encontrado para este boleto");
      }

    } catch (error) {
      console.error("❌ Erro ao baixar boleto:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao baixar boleto";
      toast.error(errorMessage);
    } finally {
      setBaixandoBoleto(null);
    }
  };

  const handleGerarBoletoVenda = async (venda) => {
    setGerandoBoletoVenda(venda.id);

    try {
      const token = localStorage.getItem("token");
      const API = process.env.NEXT_PUBLIC_API_URL;

      if (!token || !API) {
        throw new Error("Token ou URL da API não encontrados");
      }

      console.log(`🔍 Gerando boleto para venda ${venda.id}:`, venda);

      // Preparar dados para o novo endpoint
      const boletoData = {
        data_vencimento: venda.vencimento,
        observacoes: `Venda ${venda.mes_referencia}º mês - Contrato ${contrato?.numero_contrato || contrato?.id}`
      };

      const response = await fetch(`${API}/vendas/${venda.id}/gerar-boleto`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(boletoData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("🚨 Erro na resposta do servidor:", response.status, errorData);
        
        // Verificar se já existe boleto gerado
        if (response.status === 400 && errorData.error?.includes("Já existe um boleto")) {
          toast.warning(`Já existe um boleto gerado para esta venda (ID: ${errorData.boleto_id})`);
          return;
        }
        
        throw new Error(errorData.error || `Erro ao gerar boleto da venda: ${response.status}`);
      }

      const responseData = await response.json();
      console.log("✅ Boleto da venda gerado com sucesso:", responseData);

      toast.success(`Boleto da venda ${venda.mes_referencia}º mês gerado e baixado com sucesso!`);
      
      // Desabilitar TODOS os botões de boleto após sucesso
      setBoletosGeradosComSucesso(prev => new Set(prev).add(venda.id));
      setTodosBoletosDesabilitados(true);
      
      // Reabilitar todos os botões após 5 segundos (tempo padrão do toast)
      setTimeout(() => {
        setBoletosGeradosComSucesso(prev => {
          const newSet = new Set(prev);
          newSet.delete(venda.id);
          return newSet;
        });
        setTodosBoletosDesabilitados(false);
      }, 5000);
      
      // Baixar o boleto automaticamente
      if (responseData.link) {
        console.log("🔗 Link do boleto encontrado na resposta:", responseData.link);
        setTimeout(() => {
          window.open(responseData.link, '_blank');
          console.log("📄 Boleto aberto para download:", responseData.link);
        }, 1000); // 1 segundo de delay
      } else {
        console.warn("⚠️ Link do boleto não encontrado na resposta da geração");
        console.log("📋 Dados completos da resposta:", responseData);
        
        // Tentar baixar via código de solicitação
        setTimeout(() => {
          handleDownloadBoletoGerado(venda.id);
        }, 2000); // 2 segundos de delay para garantir que o boleto foi processado
      }

    } catch (error) {
      console.error("❌ Erro ao gerar boleto da venda:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao gerar boleto da venda";
      toast.error(errorMessage);
    } finally {
      setGerandoBoletoVenda(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.drawerContainer}>
      <div className={styles.drawerContent}>
        {/* Header */}
        <div className={styles.drawerHeader}>
          <div className={styles.headerLeft}>
            <FileText className="w-6 h-6" style={{color: 'var(--onety-primary)'}} />
            <div>
              <h2 className={styles.headerTitle}>
                Detalhes do contrato {contrato?.numero_contrato || contrato?.id}
              </h2>
              <p className={styles.headerSubtitle}>
                {contrato?.produtos && contrato.produtos.length > 0 
                  ? `${contrato.produtos.length} item(ns) • ${formatCurrency(contrato.valor)}`
                  : `Informações completas do contrato • ${formatCurrency(contrato?.valor || 0)}`
                }
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className={styles.closeButton}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className={styles.drawerContentArea}>
          {loading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinner}></div>
              <span className={styles.loadingText}>Carregando detalhes...</span>
            </div>
          ) : error ? (
            <div className={styles.errorContainer}>
              <p className={styles.errorMessage}>{error}</p>
              <Button onClick={fetchContratoDetalhes} className={styles.buttonPrimary}>
                Tentar novamente
              </Button>
            </div>
          ) : contrato ? (
            <>
              {/* Informações da venda */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>
                    <Building className="w-5 h-5 text-primary" />
                    Informações da venda
                  </div>
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.gridTwoCols}>
                    <div>
                      <label className={styles.label}>Cliente</label>
                      <p className={styles.textPrimary}>{contrato.cliente_nome}</p>
                    </div>
                    <div>
                      <label className={styles.label}>Data de início</label>
                      <p className={styles.textMain}>{formatDate(contrato.data_inicio)}</p>
                    </div>
                    <div>
                      <label className={styles.label}>Dia da geração das vendas</label>
                      <p className={styles.textMain}>{contrato.dia_gerado ? `${contrato.dia_gerado}º dia do mês` : "Não definido"}</p>
                    </div>
                    <div>
                      <label className={styles.label}>Data da próxima venda</label>
                      <p className={styles.textMain}>{calcularProximoVencimento()}</p>
                    </div>
                    <div>
                      <label className={styles.label}>Próximo vencimento</label>
                      <p className={styles.textMain}>{contrato.proximo_vencimento ? formatDate(contrato.proximo_vencimento) : "Indeterminado"}</p>
                    </div>
                    <div>
                      <label className={styles.label}>Situação do contrato</label>
                      <div className={styles.label}>{getSituacaoBadge(contrato.status)}</div>
                    </div>
                    <div>
                      <label className={styles.label}>Vendedor responsável</label>
                      <p className={styles.textMain}>{contrato.vendedor_nome || "Não definido"}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Configurações de recorrência */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>
                    <Settings className="w-5 h-5" style={{color: 'var(--onety-green)'}} />
                    Configurações de recorrência
                  </div>
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.gridTwoCols}>
                    <div>
                      <label className={styles.label}>Repetir venda a cada</label>
                      <p className={styles.textMain}>1 mês</p>
                    </div>
                    <div>
                      <label className={styles.label}>Término da recorrência</label>
                      <p className={styles.textMain}>Indeterminado</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Itens da venda */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>
                    <Package className="w-5 h-5" style={{color: 'var(--onety-purple)'}} />
                    Itens da venda
                  </div>
                  <div className={styles.cardContent}>
                    <p className={styles.textSecondary}>
                      Os itens e valores apresentados abaixo são da próxima venda prevista. 
                      Para visualizar as informações de outras vendas deste contrato, acesse o 
                      <strong className={styles.textMain}> Histórico do contrato</strong> no final desta página.
                    </p>
                    <div className={styles.infoBox}>
                      <p className={styles.infoBoxText}>
                        <strong>💡 Baixa Automática:</strong> Quando este contrato gera vendas, elas são automaticamente 
                        enviadas para <strong>Contas a Receber</strong>. Lá você pode acompanhar o status de pagamento 
                        de cada venda individual gerada por este contrato.
                      </p>
                    </div>
                  </div>
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.tableContainer}>
                    <table className={styles.table}>
                      <thead className={styles.tableHeader}>
                        <tr>
                          <th className={styles.tableHeaderCell}>Produto/Serviço</th>
                          <th className={styles.tableHeaderCell}>Departamento</th>
                          <th className={styles.tableHeaderCell}>Tipo</th>
                          <th className={styles.tableHeaderCell}>Detalhes</th>
                          <th className={styles.tableHeaderCell}>Quantidade</th>
                          <th className={styles.tableHeaderCell}>Valor unitário (R$)</th>
                          <th className={styles.tableHeaderCell}>Subtotal (R$)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contrato.produtos && contrato.produtos.length > 0 ? (
                          contrato.produtos.map((produto, index) => (
                            <tr key={produto.id} className={styles.tableRow}>
                              <td className={styles.tableCell}>{produto.produto_nome}</td>
                              <td className={styles.tableCellSecondary}>
                                {produto.departamento_nome ? (
                                  <span className={styles.textSecondary}>
                                    {produto.departamento_codigo && (
                                      <span className={styles.departmentCode}>
                                        {produto.departamento_codigo}
                                      </span>
                                    )}
                                    {produto.departamento_nome}
                                  </span>
                                ) : (
                                  <span className={styles.textSecondary}>Não definido</span>
                                )}
                              </td>
                              <td className={styles.tableCellSecondary}>{produto.produto_tipo === 'produto' ? 'Produto' : 'Serviço'}</td>
                              <td className={styles.tableCellSecondary}>{produto.observacoes || 'MODALIDADE FIXA'}</td>
                              <td className={styles.tableCell}>{produto.quantidade}</td>
                              <td className={styles.tableCell}>{formatCurrency(produto.valor_unitario)}</td>
                              <td className={styles.tableCell}>{formatCurrency((produto.quantidade * produto.valor_unitario) - produto.desconto)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr className={styles.tableRow}>
                            <td className={styles.tableCell}>{contrato.produto_servico_nome}</td>
                            <td className={styles.tableCellSecondary}>Não definido</td>
                            <td className={styles.tableCellSecondary}>Serviço</td>
                            <td className={styles.tableCellSecondary}>MODALIDADE FIXA</td>
                            <td className={styles.tableCell}>1</td>
                            <td className={styles.tableCell}>{formatCurrency(contrato.valor)}</td>
                            <td className={styles.tableCell}>{formatCurrency(contrato.valor)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Total da venda */}
                  {(() => {
                    // Calcular totais baseado nos produtos
                    let totalItens = 0;
                    let totalBruto = 0;
                    let totalDesconto = 0;
                    let totalLiquido = 0;

                    if (contrato.produtos && contrato.produtos.length > 0) {
                      totalItens = contrato.produtos.length;
                      totalBruto = contrato.produtos.reduce((acc, produto) => acc + (produto.quantidade * produto.valor_unitario), 0);
                      totalDesconto = contrato.produtos.reduce((acc, produto) => acc + produto.desconto, 0);
                      totalLiquido = totalBruto - totalDesconto;
                    } else {
                      totalItens = 1;
                      totalBruto = contrato.valor;
                      totalDesconto = contrato.desconto || 0;
                      totalLiquido = contrato.valor;
                    }

                    return (
                      <div className={styles.totalSection}>
                        <div className={styles.totalContainer}>
                          <div className={styles.totalRow}>
                            <span className={styles.textSecondary}>Total de itens:</span>
                            <span className={styles.textMain}>{totalItens}</span>
                          </div>
                          <div className={styles.totalRow}>
                            <span className={styles.textSecondary}>Total bruto (R$):</span>
                            <span className={styles.textMain}>{formatCurrency(totalBruto)}</span>
                          </div>
                          <div className={styles.totalRow}>
                            <span className={styles.textSecondary}>Desconto (R$):</span>
                            <span className={styles.textMain}>{formatCurrency(totalDesconto)}</span>
                          </div>
                          <div className={styles.totalRow}>
                            <span className={styles.textSecondary}>Total líquido (R$):</span>
                            <span className={styles.totalGreen}>
                              <TrendingUp className="w-4 h-4" />
                              {formatCurrency(totalLiquido)}
                            </span>
                          </div>
                          <div className={styles.totalRow}>
                            <span className={styles.textSecondary}>Impostos (R$):</span>
                            <span className={styles.textMain}>-</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Informações de pagamento */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>
                    <DollarSign className="w-5 h-5" style={{color: 'var(--onety-green)'}} />
                    Informações de pagamento
                  </div>
                  <p className={styles.textSecondary}>
                    As informações de pagamento podem variar em cada venda, aqui exibimos as informações da próxima venda prevista.
                  </p>
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.gridThreeCols}>
                    <div>
                      <label className={styles.label}>Forma de pagamento</label>
                      <p className={styles.textMain}>Boleto Bancário</p>
                    </div>
                    <div>
                      <label className={styles.label}>Conta de recebimento</label>
                      <p className={styles.textMain}>Receba Fácil</p>
                    </div>
                    <div>
                      <label className={styles.label}>Vencer sempre no</label>
                      <p className={styles.textMain}>{contrato.dia_gerado ? `${contrato.dia_gerado}º dia do mês` : "Não definido"}</p>
                    </div>
                  </div>
                </div>
              </div>



              {/* Configuração de envio automático */}
              <Card className="bg-darkPurple border-neonPurple">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg text-textMain">
                    <Mail className="w-5 h-5 text-primary" />
                    Configuração de envio automático
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-textMain">Enviar a fatura</span>
                      <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Ativo</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-textMain">Disponibilizar cobrança</span>
                      <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Ativo</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-textMain">Enviar lembretes de vencimento</span>
                      <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Ativo</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-textMain">Emitir e enviar nota fiscal</span>
                      <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Desativado</Badge>
                    </div>
                    <div className="pt-3 border-t border-neonPurple">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-textSecondary">E-mail que receberá as faturas</label>
                        {/* Comentado temporariamente - Funcionalidade de editar e-mail
                        {!editandoEmail && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditandoEmail(true);
                              setNovoEmail(contrato.cliente_email || '');
                            }}
                            className="text-blue-600 hover:text-blue-700 text-xs"
                          >
                            {(contrato.cliente_email && contrato.cliente_email.trim() !== '') ? 'Editar' : 'Adicionar'}
                          </Button>
                        )}
                        */}
                      </div>
                      
                      {/* Comentado temporariamente - Interface de edição de e-mail
                      {editandoEmail ? (
                        <div className="space-y-2">
                          <input
                            type="email"
                            value={novoEmail}
                            onChange={(e) => setNovoEmail(e.target.value)}
                            placeholder="Digite o e-mail do cliente"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={handleSalvarEmailCliente}
                              disabled={salvandoEmail || !novoEmail.trim()}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                            >
                              {salvandoEmail ? 'Salvando...' : 'Salvar'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditandoEmail(false);
                                setNovoEmail('');
                              }}
                              disabled={salvandoEmail}
                              className="text-gray-600 border-gray-300 text-xs"
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                      */}
                                            {/* Apenas exibição do e-mail (sem edição) */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-textMain">
                          {contrato.cliente_email && contrato.cliente_email.trim() !== '' ? (
                            contrato.cliente_email
                          ) : (
                            <span className="text-textSecondary italic">E-mail do cliente não cadastrado</span>
                          )}
                        </span>
                      </div>
                      
                      {(!contrato.cliente_email || contrato.cliente_email.trim() === '') && (
                        <p className="text-xs text-textSecondary mt-1">
                          Para receber faturas, cadastre o e-mail do cliente
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Exibir detalhes da empresa */}
              {empresa && (
                <Card className="bg-darkPurple border-neonPurple">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg text-textMain">
                      <Building className="w-5 h-5 text-primary" />
                      Detalhes da Empresa
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-textSecondary">Nome</label>
                        <p className="text-primary font-medium">{empresa.nome}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-textSecondary">Endereço</label>
                        <p className="text-textMain">{empresa.endereco}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-textSecondary">CNPJ</label>
                        <p className="text-textMain">{empresa.cnpj}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Vendas geradas automaticamente pelo contrato - Só mostra se houver vendas */}
              {(() => {
                console.log(`🔍 Renderização: vendasContrato.length = ${vendasContrato.length} para contrato ${contratoId}`);
                return vendasContrato.length > 0;
              })() && (
                <Card className="bg-darkPurple border-neonPurple">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg text-textMain">
                      <Clock className="w-5 h-5 text-purple-500" />
                      Vendas geradas automaticamente
                    </CardTitle>
                    <p className="text-sm text-textSecondary mt-2">
                      Vendas criadas automaticamente a partir deste contrato
                    </p>
                  </CardHeader>
                  <CardContent>
                    {loadingVendas ? (
                      <div className="flex items-center justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        <span className="ml-2 text-textSecondary">Carregando vendas...</span>
                      </div>
                    ) : (
                    <div className="space-y-4">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b border-neonPurple">
                              <th className="text-left p-2 text-textMain font-medium">Período</th>
                              <th className="text-left p-2 text-textMain font-medium">Vencimento</th>
                              <th className="text-left p-2 text-textMain font-medium">Valor</th>
                              <th className="text-left p-2 text-textMain font-medium">Situação</th>
                              <th className="text-left p-2 text-textMain font-medium">Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vendasContrato.map((venda) => (
                              <tr key={venda.id} className="border-b border-neonPurple/30 hover:bg-neonPurple/5">
                                <td className="p-2 text-textMain">
                                  {venda.mes_referencia}º mês de {venda.ano_referencia}
                                </td>
                                <td className="p-2 text-textMain">
                                  {editandoVenda === venda.id ? (
                                    <input
                                      type="date"
                                      defaultValue={toInputDateValue(venda.vencimento)}
                                      className="bg-darkPurple border border-neonPurple rounded px-2 py-1 text-sm text-textMain"
                                      onBlur={(e) => {
                                        if (e.target.value && e.target.value !== toInputDateValue(venda.vencimento)) {
                                          handleEditarVenda(venda.id, e.target.value);
                                        } else {
                                          setEditandoVenda(null);
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          const target = e.target;
                                          if (target.value && target.value !== toInputDateValue(venda.vencimento)) {
                                            handleEditarVenda(venda.id, target.value);
                                          } else {
                                            setEditandoVenda(null);
                                          }
                                        } else if (e.key === 'Escape') {
                                          setEditandoVenda(null);
                                        }
                                      }}
                                      autoFocus
                                    />
                                  ) : (
                                    <span 
                                      className="cursor-pointer hover:text-primary"
                                      onClick={() => setEditandoVenda(venda.id)}
                                    >
                                      {formatDate(venda.vencimento)}
                                    </span>
                                  )}
                                </td>
                                <td className="p-2 text-textMain">
                                  R$ {parseFloat(venda.valor_venda.toString()).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-2">
                                  <Badge 
                                    variant={
                                      venda.situacao === 'aprovado' ? 'default' :
                                      venda.situacao === 'pendente' ? 'secondary' :
                                      venda.situacao === 'processado' ? 'outline' : 'destructive'
                                    }
                                    className={
                                      venda.situacao === 'aprovado' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                      venda.situacao === 'pendente' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                                      venda.situacao === 'processado' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                      'bg-red-500/20 text-red-400 border-red-500/30'
                                    }
                                  >
                                    {venda.situacao.charAt(0).toUpperCase() + venda.situacao.slice(1)}
                                  </Badge>
                                </td>
                                <td className="p-2">
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
                                      onClick={() => setEditandoVenda(venda.id)}
                                      disabled={editandoVenda === venda.id}
                                    >
                                      <Calendar className="w-3 h-3 mr-1" />
                                      Editar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className={`h-7 px-2 text-xs ${
                                        boletosGeradosComSucesso.has(venda.id)
                                          ? "border-green-500 text-green-500 bg-green-500/10 cursor-not-allowed"
                                          : todosBoletosDesabilitados
                                          ? "border-gray-500 text-gray-400 bg-gray-500/10 cursor-not-allowed"
                                          : "border-green-500 text-green-400 hover:bg-green-500 hover:text-white"
                                      }`}
                                      onClick={() => handleGerarBoletoVenda(venda)}
                                      disabled={gerandoBoletoVenda === venda.id || boletosGeradosComSucesso.has(venda.id) || todosBoletosDesabilitados}
                                    >
                                      {gerandoBoletoVenda === venda.id ? (
                                        <>
                                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-1"></div>
                                          Gerando...
                                        </>
                                      ) : boletosGeradosComSucesso.has(venda.id) ? (
                                        <>
                                          <CreditCard className="w-3 h-3 mr-1" />
                                          Gerado!
                                        </>
                                      ) : todosBoletosDesabilitados ? (
                                        <>
                                          <CreditCard className="w-3 h-3 mr-1" />
                                          Aguarde...
                                        </>
                                      ) : (
                                        <>
                                          <CreditCard className="w-3 h-3 mr-1" />
                                          Boleto
                                        </>
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white"
                                      onClick={() => handleBaixarBoletoIndividual(venda)}
                                      disabled={baixandoBoleto === venda.id}
                                    >
                                      {baixandoBoleto === venda.id ? (
                                        <>
                                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-1"></div>
                                          Baixando...
                                        </>
                                      ) : (
                                        <>
                                          <Download className="w-3 h-3 mr-1" />
                                          Baixar
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                          <p className="text-xs text-blue-400">
                            <strong>💡 Dica:</strong> Clique na data de vencimento para editá-la rapidamente. 
                           Use o botão &quot;Boleto&quot; para gerar boletos e o botão &quot;Baixar&quot; para baixar boletos já gerados.
                          </p>
                      </div>
                    </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Histórico do contrato (boletos) */}
              <Card className="bg-darkPurple border-neonPurple">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg text-textMain">
                    <Clock className="w-5 h-5 text-purple-500" />
                    Histórico de boletos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-textSecondary">
                      Histórico de boletos gerados para este contrato
                    </p>
                    <div className="space-y-2">
                      <div 
                        className={`flex items-center justify-between p-3 border border-neonPurple rounded-lg cursor-pointer hover:bg-neonPurple/10 ${
                          anoSelecionado === '2024' ? 'bg-neonPurple/10' : ''
                        }`}
                        onClick={() => setAnoSelecionado('2024')}
                      >
                        <span className="font-medium text-textMain">2024</span>
                        <ChevronDown className="w-5 h-5 text-textSecondary" />
                      </div>
                      <div 
                        className={`flex items-center justify-between p-3 border border-neonPurple rounded-lg cursor-pointer hover:bg-neonPurple/10 ${
                          anoSelecionado === '2025' ? 'bg-neonPurple/10' : ''
                        }`}
                        onClick={() => setAnoSelecionado('2025')}
                      >
                        <span className="font-medium text-textMain">2025</span>
                        <ChevronDown className="w-5 h-5 text-textSecondary" />
                      </div>
                    </div>

                    {/* Conteúdo do ano selecionado */}
                    {anoSelecionado === '2025' && (
                      <div className="mt-4 space-y-4">
                        {/* Resumo dos produtos/serviços */}
                        {contrato.produtos && contrato.produtos.length > 0 && (
                          <div className="bg-neonPurple/5 border border-neonPurple/30 rounded-lg p-4">
                            <h5 className="text-sm font-medium text-textMain mb-2 flex items-center gap-2">
                              <Package className="w-4 h-4 text-primary" />
                              Resumo dos Itens ({contrato.produtos.length} item{contrato.produtos.length > 1 ? 's' : ''})
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                              {contrato.produtos.map((produto) => (
                                <div key={produto.id} className="flex flex-col bg-darkPurple/50 rounded px-2 py-1">
                                  <div className="flex justify-between items-center">
                                    <span className="text-textMain">{produto.produto_nome}</span>
                                    <span className="text-textSecondary">{produto.quantidade}x {formatCurrency(produto.valor_unitario)}</span>
                                  </div>
                                  {produto.departamento_nome && (
                                    <div className="flex items-center gap-1 mt-1">
                                      {produto.departamento_codigo && (
                                        <span className="text-xs bg-neonPurple/20 text-primary px-1 py-0.5 rounded">
                                          {produto.departamento_codigo}
                                        </span>
                                      )}
                                      <span className="text-xs text-textSecondary">{produto.departamento_nome}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Produtos/Serviços do contrato */}
                        <div>
                          <h4 className="text-sm font-medium text-textMain mb-3 flex items-center gap-2">
                            <Package className="w-4 h-4 text-purple-500" />
                            Produtos/Serviços do contrato
                          </h4>
                          <div className="space-y-2">
                            {contrato.produtos && contrato.produtos.length > 0 ? (
                              contrato.produtos.map((produto, index) => (
                                <div key={produto.id} className="p-3 border border-neonPurple/30 rounded-lg bg-neonPurple/5">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-textMain">{produto.produto_nome}</span>
                                    <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">
                                      {produto.produto_tipo === 'produto' ? 'PRODUTO' : 'SERVIÇO'}
                                    </Badge>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                    <div>
                                      <span className="text-textSecondary">Departamento:</span>
                                      <p className="text-textMain font-medium">
                                        {produto.departamento_nome ? (
                                          <span className="flex items-center gap-1">
                                            {produto.departamento_codigo && (
                                              <span className="text-xs bg-neonPurple/20 text-primary px-1 py-0.5 rounded">
                                                {produto.departamento_codigo}
                                              </span>
                                            )}
                                            {produto.departamento_nome}
                                          </span>
                                        ) : (
                                          <span className="text-textSecondary italic">Não definido</span>
                                        )}
                                      </p>
                                    </div>
                                    <div>
                                      <span className="text-textSecondary">Quantidade:</span>
                                      <p className="text-textMain font-medium">{produto.quantidade}</p>
                                    </div>
                                    <div>
                                      <span className="text-textSecondary">Valor Unitário:</span>
                                      <p className="text-textMain font-medium">{formatCurrency(produto.valor_unitario)}</p>
                                    </div>
                                    <div>
                                      <span className="text-textSecondary">Subtotal:</span>
                                      <p className="text-textMain font-medium">{formatCurrency((produto.quantidade * produto.valor_unitario) - produto.desconto)}</p>
                                    </div>
                                  </div>
                                  {produto.observacoes && (
                                    <div className="mt-2">
                                      <span className="text-textSecondary text-xs">Observações:</span>
                                      <p className="text-textMain text-xs">{produto.observacoes}</p>
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="p-3 border border-neonPurple/30 rounded-lg bg-neonPurple/5">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-textMain">{contrato.produto_servico_nome}</span>
                                  <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30 text-xs">
                                    SERVIÇO
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div>
                                    <span className="text-textSecondary">Valor:</span>
                                    <p className="text-textMain font-medium">{formatCurrency(contrato.valor)}</p>
                                  </div>
                                  <div>
                                    <span className="text-textSecondary">Quantidade:</span>
                                    <p className="text-textMain font-medium">1</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Boletos pagos */}
                        <div>
                          <h4 className="text-sm font-medium text-textMain mb-3 flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-green-500" />
                            Boletos pagos
                          </h4>
                          {loadingBoletos ? (
                            <div className="flex items-center justify-center py-4">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                              <span className="ml-2 text-textSecondary text-sm">Carregando...</span>
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead>
                                  <tr className="border-b border-neonPurple bg-neonPurple/10">
                                    <th className="text-left py-2 px-3 text-sm font-medium text-textSecondary">Data da venda</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-textSecondary">Número da venda</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-textSecondary">Valor (R$)</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-textSecondary">Recebido (R$)</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-textSecondary">Situação</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-textSecondary">Ações</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(() => {
                                    if (mostrarApenasBoletosP) {
                                      // Filtrar apenas boletos pagos
                                      const boletosPagos = boletosPagamento.filter(boleto => 
                                        boleto.status === "PAGO" || 
                                        boleto.status === "pago" || 
                                        boleto.status === "RECEBIDO" ||
                                        boleto.status === "LIQUIDADO"
                                      );

                                      if (boletosPagos.length === 0) {
                                        return (
                                          <tr>
                                            <td colSpan={6} className="py-4 text-center text-textSecondary text-sm">
                                              Nenhum boleto pago encontrado
                                            </td>
                                          </tr>
                                        );
                                      }

                                      // Mostrar apenas boletos que foram pagos
                                      return boletosPagos.map((boleto, index) => {
                                        const valorBase = contrato?.valor || 0;

                                        return (
                                          <tr key={index} className="border-b border-neonPurple/30 hover:bg-neonPurple/5">
                                            <td className="py-3 px-3 text-textMain text-sm">
                                              {formatDate(boleto.data_pagamento)}
                                            </td>
                                            <td className="py-3 px-3 text-textMain text-sm">
                                              {contrato?.numero_contrato || contrato?.id}
                                            </td>
                                            <td className="py-3 px-3 text-textMain text-sm">
                                              {formatCurrency(valorBase)}
                                            </td>
                                            <td className="py-3 px-3 text-sm">
                                              <span className="text-green-500 font-medium">
                                                {boleto.valor_recebido > 0 ? formatCurrency(boleto.valor_recebido) : formatCurrency(valorBase)}
                                              </span>
                                            </td>
                                            <td className="py-3 px-3">
                                              <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">
                                                PAGO
                                              </Badge>
                                            </td>
                                            <td className="py-3 px-3">
                                              <div className="flex items-center gap-2">
                                                <button 
                                                  className="px-3 py-1 text-xs border border-blue-500 text-blue-500 rounded hover:bg-blue-500/10"
                                                  onClick={() => handleEditarVencimento(boleto.data_pagamento || '')}
                                                >
                                                  Editar
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      });
                                    } else {
                                      // Mostrar cronograma específico deste contrato
                                      const anoAtual = parseInt(anoSelecionado);
                                      
                                      // Verificar se o contrato tem data de início válida
                                      if (!contrato?.data_inicio) {
                                        return (
                                          <tr>
                                            <td colSpan={6} className="py-4 text-center text-textSecondary text-sm">
                                              Contrato sem data de início definida
                                            </td>
                                          </tr>
                                        );
                                      }

                                      const dataInicio = parseDateSafe(contrato.data_inicio);
                                      if (!dataInicio) {
                                        return (
                                          <tr>
                                            <td colSpan={6} className="py-4 text-center text-textSecondary text-sm">
                                              Data de início do contrato inválida
                                            </td>
                                          </tr>
                                        );
                                      }

                                      const anoContrato = dataInicio.getFullYear();
                                      
                                      // Se o ano selecionado é anterior ao ano do contrato
                                      if (anoAtual < anoContrato) {
                                        return (
                                          <tr>
                                            <td colSpan={6} className="py-4 text-center text-textSecondary text-sm">
                                              Contrato ainda não iniciado para {anoAtual}
                                            </td>
                                          </tr>
                                        );
                                      }

                                      // Se o ano selecionado é posterior ao ano do contrato
                                      if (anoAtual > anoContrato) {
                                        return (
                                          <tr>
                                            <td colSpan={6} className="py-4 text-center text-textSecondary text-sm">
                                              Cronograma de {anoAtual} - Contrato iniciado em {anoContrato}
                                            </td>
                                          </tr>
                                        );
                                      }

                                      // Para o ano do contrato, começar do mês de início
                                      let mesInicio = dataInicio.getMonth() + 1;
                                      
                                      // Se tem boletos pagos, começar do primeiro boleto pago do ano
                                      const primeiroBoletoPago = boletosPagamento.find(boleto => {
                                        if (!boleto.data_pagamento) return false;
                                        const dataPagamento = parseDateSafe(boleto.data_pagamento);
                                        return dataPagamento && dataPagamento.getFullYear() === anoAtual;
                                      });

                                      if (primeiroBoletoPago && primeiroBoletoPago.data_pagamento) {
                                        const dataPrimeiroBoleto = parseDateSafe(primeiroBoletoPago.data_pagamento);
                                        if (dataPrimeiroBoleto) {
                                          mesInicio = Math.min(mesInicio, dataPrimeiroBoleto.getMonth() + 1);
                                        }
                                      }

                                      // Gerar array de meses do mesInicio até dezembro
                                      let mesesParaMostrar = [];
                                      for (let mes = mesInicio; mes <= 12; mes++) {
                                        mesesParaMostrar.push(mes);
                                      }

                                      if (mesesParaMostrar.length === 0) {
                                        return (
                                          <tr>
                                            <td colSpan={6} className="py-4 text-center text-textSecondary text-sm">
                                              Nenhum mês para exibir
                                            </td>
                                          </tr>
                                        );
                                      }

                                      return mesesParaMostrar.map((mes) => {
                                        // Buscar boleto para este mês (pago ou não pago) - específico deste contrato
                                        const boletoMes = boletosPagamento.find(boleto => {
                                          if (boleto.data_pagamento) {
                                            const dataPagamento = parseDateSafe(boleto.data_pagamento);
                                            return dataPagamento && dataPagamento.getMonth() + 1 === mes && dataPagamento.getFullYear() === anoAtual;
                                          }
                                          return false;
                                        });

                                        const isPago = boletoMes ? (
                                          boletoMes.status === "PAGO" || 
                                          boletoMes.status === "pago" || 
                                          boletoMes.status === "RECEBIDO" ||
                                          boletoMes.status === "LIQUIDADO"
                                        ) : false;

                                        const valorBase = contrato?.valor || 0;

                                        return (
                                          <tr key={mes} className="border-b border-neonPurple/30 hover:bg-neonPurple/5">
                                            <td className="py-3 px-3 text-textMain text-sm">
                                              {formatDate(`${anoAtual}-${mes.toString().padStart(2, '0')}-06`)}
                                            </td>
                                            <td className="py-3 px-3 text-textMain text-sm">
                                              {contrato?.numero_contrato || contrato?.id}
                                            </td>
                                            <td className="py-3 px-3 text-textMain text-sm">
                                              {formatCurrency(valorBase)}
                                            </td>
                                            <td className="py-3 px-3 text-sm">
                                              {boletoMes && isPago ? (
                                                <span className="text-green-500 font-medium">
                                                  {boletoMes.valor_recebido > 0 ? formatCurrency(boletoMes.valor_recebido) : formatCurrency(valorBase)}
                                                </span>
                                              ) : boletoMes && !isPago ? (
                                                <span className="text-orange-500 font-medium">
                                                  {formatCurrency(0)}
                                                </span>
                                              ) : (
                                                <span className="text-textSecondary">-</span>
                                              )}
                                            </td>
                                            <td className="py-3 px-3">
                                              <Badge className={`text-xs ${
                                                boletoMes && isPago 
                                                  ? "bg-green-500/20 text-green-500 border-green-500/30" 
                                                  : boletoMes && !isPago 
                                                  ? "bg-red-500/20 text-red-500 border-red-500/30" 
                                                  : "bg-yellow-500/20 text-yellow-500 border-yellow-500/30"
                                              }`}>
                                                {boletoMes && isPago 
                                                  ? "PAGO" 
                                                  : boletoMes && !isPago 
                                                  ? "ATRASADO" 
                                                  : "PENDENTE"
                                                }
                                              </Badge>
                                            </td>
                                            <td className="py-3 px-3">
                                              <div className="flex items-center gap-2">
                                                <button 
                                                  className="px-3 py-1 text-xs border border-blue-500 text-blue-500 rounded hover:bg-blue-500/10"
                                                  onClick={() => handleEditarVencimento(`${anoAtual}-${mes.toString().padStart(2, '0')}-06`)}
                                                >
                                                  Editar
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      });
                                    }
                                  })()}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {anoSelecionado === '2024' && (
                      <div className="mt-4">
                        <p className="text-textSecondary text-sm">Nenhuma venda registrada para 2024</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className={styles.drawerFooter}>
          <Button
            variant="outline"
            onClick={onClose}
            className={styles.buttonOutline}
          >
            Voltar
          </Button>
          <div className={styles.footerActions}>
            <Button 
              variant="outline" 
              className={styles.buttonOutline}
              onClick={handleGerarRecibo}
              disabled={!contrato || !empresa}
            >
              Gerar Recibo
            </Button>
            <Button 
              variant="outline" 
              className={styles.buttonGreen}
              onClick={handleGerarBoleto}
              disabled={!contrato || !contrato.proximo_vencimento || gerandoBoleto}
            >
              {gerandoBoleto ? (
                <>
                  <div className={styles.loadingSpinner}></div>
                  Gerando...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Gerar Boleto
                </>
              )}
            </Button>
            <Button variant="outline" className={styles.buttonOutline}>
              Outras ações
            </Button>
            <Button className={styles.buttonPrimary}>
              Editar contrato
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de Edição de Vencimento */}
      <EditarVencimentoContratoModal
        isOpen={isEditarVencimentoOpen}
        onClose={() => setIsEditarVencimentoOpen(false)}
        contratoId={contratoId || 0}
        dataAtual={dataParaEditar}
        onConfirm={handleConfirmarEdicaoVencimento}
      />

      {/* Drawer de Edição de Contrato */}
      <EditarContratoDrawer
        isOpen={isEditarContratoOpen}
        onClose={() => {
          setIsEditarContratoOpen(false);
          setOpcaoEdicaoContrato(undefined);
        }}
        contratoId={contratoId}
        opcaoEdicao={opcaoEdicaoContrato}
      />
    </div>
  );
} 