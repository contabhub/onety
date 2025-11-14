import { useState, useEffect } from 'react';
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/financeiro/contratos/${contratoId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      let data = await response.json();
      
      // Sempre buscar o e-mail do cliente, pois pode não estar incluído na resposta do contrato
      if (data.cliente_id) {
        try {
          const clienteResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/financeiro/clientes/${data.cliente_id}`, {
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
        const boletoResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/financeiro/boletos/por-contrato/${contratoId}`, {
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
      console.log(`🔍 URL: ${process.env.NEXT_PUBLIC_API_URL}/financeiro/vendas?contrato_origem_id=${contratoId}`);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/financeiro/vendas?contrato_origem_id=${contratoId}`, {
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
        <span className={`${styles.badge} ${styles.badgeGray}`}>
          Não definido
        </span>
      );

    switch (situacao) {
      case "ativo":
        return (
          <span className={`${styles.badge} ${styles.badgeSuccess}`}>
            Ativo
          </span>
        );
      case "inativo":
        return (
          <span className={`${styles.badge} ${styles.badgeWarning}`}>
            Inativo
          </span>
        );
      case "cancelado":
        return (
          <span className={`${styles.badge} ${styles.badgeHotPink}`}>
            Cancelado
          </span>
        );
      default:
        return (
          <span className={`${styles.badge} ${styles.badgeGray}`}>
            {situacao}
          </span>
        );
    }
  };

  // Função para calcular próximo vencimento a partir de produtos_dados
  const calcularProximoVencimentoDeProdutos = () => {
    if (!contrato?.produtos_dados) return null;
    
    try {
      const produtosDados = typeof contrato.produtos_dados === 'string' 
        ? JSON.parse(contrato.produtos_dados) 
        : contrato.produtos_dados;
      
      if (!Array.isArray(produtosDados) || produtosDados.length === 0) {
        return null;
      }
      
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0); // Zerar horas para comparação
      
      let proximaData = null;
      
      // Iterar por todos os produtos
      for (const produto of produtosDados) {
        if (!produto.parcelas_detalhadas || !Array.isArray(produto.parcelas_detalhadas)) {
          continue;
        }
        
        // Iterar por todas as parcelas
        for (const parcela of produto.parcelas_detalhadas) {
          if (!parcela.data_vencimento) continue;
          
          const dataVencimento = new Date(parcela.data_vencimento);
          dataVencimento.setHours(0, 0, 0, 0);
          
          // Se a data ainda não passou e é a primeira encontrada, ou é mais próxima que a anterior
          if (dataVencimento >= hoje) {
            if (!proximaData || dataVencimento < proximaData) {
              proximaData = dataVencimento;
            }
          }
        }
      }
      
      return proximaData;
    } catch (error) {
      console.error('Erro ao calcular próximo vencimento de produtos_dados:', error);
      return null;
    }
  };

  const calcularProximoVencimento = () => {
    // Primeiro tentar pegar de produtos_dados
    const vencimentoProdutos = calcularProximoVencimentoDeProdutos();
    if (vencimentoProdutos) {
      return formatDate(vencimentoProdutos.toISOString().split('T')[0]);
    }
    
    // Se não tiver, usar a lógica antiga
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
    console.log("🔵 handleGerarBoleto chamado", { 
      contrato, 
      proximo_vencimento: contrato?.proximo_vencimento,
      produtos_dados: contrato?.produtos_dados 
    });
    
    if (!contrato) {
      console.log("❌ Contrato não encontrado");
      toast.error('Dados do contrato não encontrados');
      return;
    }

    // Calcular próximo vencimento (de produtos_dados ou proximo_vencimento)
    const proximoVencimento = calcularProximoVencimentoDeProdutos() || contrato.proximo_vencimento;
    
    if (!proximoVencimento) {
      console.log("❌ Contrato não possui próximo vencimento");
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

      const response = await fetch(`${API}/financeiro/contratos/${contrato.id}/gerar-boleto`, {
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

      const response = await fetch(`${API}/financeiro/vendas/${vendaId}`, {
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

      const response = await fetch(`${API}/financeiro/vendas/${venda.id}/gerar-boleto`, {
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
          <button
            onClick={onClose}
            className={`${styles.button} ${styles.buttonGhost} ${styles.buttonSmall}`}
          >
            <X className="w-5 h-5" />
          </button>
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
              <button onClick={fetchContratoDetalhes} className={`${styles.button} ${styles.buttonPrimary}`}>
                Tentar novamente
              </button>
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
              <div className={styles.configCard}>
                <div className={styles.configCardHeader}>
                  <h3 className={styles.configCardTitle}>
                    <Mail className="w-5 h-5 text-primary" />
                    Configuração de envio automático
                  </h3>
                </div>
                <div className={styles.configCardContent}>
                  <div className={styles.configSection}>
                    <div className={styles.configRow}>
                      <span className={styles.configLabel}>Enviar a fatura</span>
                      <span className={`${styles.badge} ${styles.badgeActive}`}>Ativo</span>
                    </div>
                    <div className={styles.configRow}>
                      <span className={styles.configLabel}>Disponibilizar cobrança</span>
                      <span className={`${styles.badge} ${styles.badgeActive}`}>Ativo</span>
                    </div>
                    <div className={styles.configRow}>
                      <span className={styles.configLabel}>Enviar lembretes de vencimento</span>
                      <span className={`${styles.badge} ${styles.badgeActive}`}>Ativo</span>
                    </div>
                    <div className={styles.configRow}>
                      <span className={styles.configLabel}>Emitir e enviar nota fiscal</span>
                      <span className={`${styles.badge} ${styles.badgeDisabled}`}>Desativado</span>
                    </div>
                    <div className={styles.configDivider}>
                      <div className={styles.configEmailRow}>
                        <label className={styles.configEmailLabel}>E-mail que receberá as faturas</label>
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
                      <div className={styles.configRow}>
                        <span className={styles.emailText}>
                          {contrato.cliente_email && contrato.cliente_email.trim() !== '' ? (
                            contrato.cliente_email
                          ) : (
                            <span className={styles.emailTextSecondary}>E-mail do cliente não cadastrado</span>
                          )}
                        </span>
                      </div>
                      
                      {(!contrato.cliente_email || contrato.cliente_email.trim() === '') && (
                        <p className={styles.emailTextSmall}>
                          Para receber faturas, cadastre o e-mail do cliente
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Exibir detalhes da empresa */}
              {empresa && (
                <div className={styles.configCard}>
                  <div className={styles.configCardHeader}>
                    <h3 className={styles.configCardTitle}>
                      <Building className="w-5 h-5 text-primary" />
                      Detalhes da Empresa
                    </h3>
                  </div>
                  <div className={`${styles.configCardContent} ${styles.gridTwoCols}`}>
                    <div>
                      <label className={styles.label}>Nome</label>
                      <p className={styles.textPrimary}>{empresa.nome}</p>
                    </div>
                    <div>
                      <label className={styles.label}>Endereço</label>
                      <p className={styles.textMain}>{empresa.endereco}</p>
                    </div>
                    <div>
                      <label className={styles.label}>CNPJ</label>
                      <p className={styles.textMain}>{empresa.cnpj}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Vendas geradas automaticamente pelo contrato - Só mostra se houver vendas */}
              {(() => {
                console.log(`🔍 Renderização: vendasContrato.length = ${vendasContrato.length} para contrato ${contratoId}`);
                return vendasContrato.length > 0;
              })() && (
                <div className={styles.configCard}>
                  <div className={styles.configCardHeader}>
                    <h3 className={styles.configCardTitle}>
                      <Clock className="w-5 h-5 text-purple-500" />
                      Vendas geradas automaticamente
                    </h3>
                    <p className={styles.cardSubtitle}>
                      Vendas criadas automaticamente a partir deste contrato
                    </p>
                  </div>
                  <div className={styles.configCardContent}>
                    {loadingVendas ? (
                      <div className={styles.vendasLoading}>
                        <div className={styles.vendasLoadingSpinner}></div>
                        <span className={styles.vendasLoadingText}>Carregando vendas...</span>
                      </div>
                    ) : (
                    <div className={styles.vendasSection}>
                      <div className={styles.tableContainer}>
                        <table className={styles.vendasTable}>
                          <thead className={styles.vendasTableHeader}>
                            <tr>
                              <th className={styles.vendasTableHeaderCell}>Período</th>
                              <th className={styles.vendasTableHeaderCell}>Vencimento</th>
                              <th className={styles.vendasTableHeaderCell}>Valor</th>
                              <th className={styles.vendasTableHeaderCell}>Situação</th>
                              <th className={styles.vendasTableHeaderCell}>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vendasContrato.map((venda) => (
                              <tr key={venda.id} className={styles.vendasTableRow}>
                                <td className={styles.vendasTableCell}>
                                  {venda.mes_referencia}º mês de {venda.ano_referencia}
                                </td>
                                <td className={styles.vendasTableCell}>
                                  {editandoVenda === venda.id ? (
                                    <input
                                      type="date"
                                      defaultValue={toInputDateValue(venda.vencimento)}
                                      className={styles.vendasInput}
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
                                      className={styles.vendasClickableDate}
                                      onClick={() => setEditandoVenda(venda.id)}
                                    >
                                      {formatDate(venda.vencimento)}
                                    </span>
                                  )}
                                </td>
                                <td className={styles.vendasTableCell}>
                                  R$ {parseFloat(venda.valor_venda.toString()).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                                <td className={styles.vendasTableCell}>
                                  <span className={`${styles.badge} ${
                                      venda.situacao === 'aprovado' ? styles.badgeAprovado :
                                      venda.situacao === 'pendente' ? styles.badgePendente :
                                      venda.situacao === 'processado' ? styles.badgeProcessado : styles.badgeDestructive
                                    }`}>
                                    {venda.situacao.charAt(0).toUpperCase() + venda.situacao.slice(1)}
                                  </span>
                                </td>
                                <td className={styles.vendasTableCell}>
                                  <div className={styles.vendasActions}>
                                    <button
                                      className={`${styles.vendasButton} ${styles.vendasButtonBlue} ${editandoVenda === venda.id ? styles.vendasButtonDisabled : ''}`}
                                      onClick={() => setEditandoVenda(venda.id)}
                                      disabled={editandoVenda === venda.id}
                                    >
                                      <Calendar className={styles.vendasButtonIcon} />
                                      Editar
                                    </button>
                                    <button
                                      className={`${styles.vendasButton} ${
                                        boletosGeradosComSucesso.has(venda.id)
                                          ? styles.vendasButtonSuccess
                                          : todosBoletosDesabilitados
                                          ? styles.vendasButtonLoading
                                          : styles.vendasButtonGreen
                                      } ${(gerandoBoletoVenda === venda.id || boletosGeradosComSucesso.has(venda.id) || todosBoletosDesabilitados) ? styles.vendasButtonDisabled : ''}`}
                                      onClick={() => handleGerarBoletoVenda(venda)}
                                      disabled={gerandoBoletoVenda === venda.id || boletosGeradosComSucesso.has(venda.id) || todosBoletosDesabilitados}
                                    >
                                      {gerandoBoletoVenda === venda.id ? (
                                        <>
                                          <div className={styles.vendasButtonSpinner}></div>
                                          Gerando...
                                        </>
                                      ) : boletosGeradosComSucesso.has(venda.id) ? (
                                        <>
                                          <CreditCard className={styles.vendasButtonIcon} />
                                          Gerado!
                                        </>
                                      ) : todosBoletosDesabilitados ? (
                                        <>
                                          <CreditCard className={styles.vendasButtonIcon} />
                                          Aguarde...
                                        </>
                                      ) : (
                                        <>
                                          <CreditCard className={styles.vendasButtonIcon} />
                                          Boleto
                                        </>
                                      )}
                                    </button>
                                    <button
                                      className={`${styles.vendasButton} ${styles.vendasButtonPurple} ${baixandoBoleto === venda.id ? styles.vendasButtonDisabled : ''}`}
                                      onClick={() => handleBaixarBoletoIndividual(venda)}
                                      disabled={baixandoBoleto === venda.id}
                                    >
                                      {baixandoBoleto === venda.id ? (
                                        <>
                                          <div className={styles.vendasButtonSpinner}></div>
                                          Baixando...
                                        </>
                                      ) : (
                                        <>
                                          <Download className={styles.vendasButtonIcon} />
                                          Baixar
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      <div className={styles.vendasInfoBox}>
                          <p className={styles.vendasInfoText}>
                            <strong>💡 Dica:</strong> Clique na data de vencimento para editá-la rapidamente. 
                           Use o botão "Boleto" para gerar boletos e o botão "Baixar" para baixar boletos já gerados.
                          </p>
                      </div>
                    </div>
                    )}
                  </div>
                </div>
              )}

              {/* Histórico do contrato (boletos) */}
              <div className={styles.configCard}>
                <div className={styles.configCardHeader}>
                  <h3 className={styles.configCardTitle}>
                    <Clock className="w-5 h-5 text-purple-500" />
                    Histórico de boletos
                  </h3>
                </div>
                <div className={styles.configCardContent}>
                  <div className={styles.historicoSection}>
                    <p className={styles.textSecondary}>
                      Histórico de boletos gerados para este contrato
                    </p>
                    <div className={styles.historicoYearSelector}>
                      <div 
                        className={`${styles.historicoYearItem} ${
                          anoSelecionado === '2024' ? styles.historicoYearItemActive : ''
                        }`}
                        onClick={() => setAnoSelecionado('2024')}
                      >
                        <span className={styles.historicoYearText}>2024</span>
                        <ChevronDown className={styles.historicoYearIcon} />
                      </div>
                      <div 
                        className={`${styles.historicoYearItem} ${
                          anoSelecionado === '2025' ? styles.historicoYearItemActive : ''
                        }`}
                        onClick={() => setAnoSelecionado('2025')}
                      >
                        <span className={styles.historicoYearText}>2025</span>
                        <ChevronDown className={styles.historicoYearIcon} />
                      </div>
                    </div>

                    {/* Conteúdo do ano selecionado */}
                    {anoSelecionado === '2025' && (
                      <div className={styles.historicoContent}>
                        {/* Resumo dos produtos/serviços */}
                        {contrato.produtos && contrato.produtos.length > 0 && (
                          <div className={styles.historicoResumo}>
                            <h5 className={styles.historicoResumoTitle}>
                              <Package className="w-4 h-4 text-primary" />
                              Resumo dos Itens ({contrato.produtos.length} item{contrato.produtos.length > 1 ? 's' : ''})
                            </h5>
                            <div className={styles.historicoResumoGrid}>
                              {contrato.produtos.map((produto) => (
                                <div key={produto.id} className={styles.historicoResumoItem}>
                                  <div className={styles.historicoResumoItemRow}>
                                    <span className={styles.historicoResumoItemName}>{produto.produto_nome}</span>
                                    <span className={styles.historicoResumoItemPrice}>{produto.quantidade}x {formatCurrency(produto.valor_unitario)}</span>
                                  </div>
                                  {produto.departamento_nome && (
                                    <div className={styles.historicoResumoItemDept}>
                                      {produto.departamento_codigo && (
                                        <span className={styles.historicoResumoItemDeptCode}>
                                          {produto.departamento_codigo}
                                        </span>
                                      )}
                                      <span className={styles.historicoResumoItemDeptName}>{produto.departamento_nome}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Produtos/Serviços do contrato */}
                        <div>
                          <h4 className={styles.historicoProdutosTitle}>
                            <Package className="w-4 h-4 text-purple-500" />
                            Produtos/Serviços do contrato
                          </h4>
                          <div className={styles.historicoProdutosList}>
                            {contrato.produtos && contrato.produtos.length > 0 ? (
                              contrato.produtos.map((produto, index) => (
                                <div key={produto.id} className={styles.historicoProdutoItem}>
                                  <div className={styles.historicoProdutoHeader}>
                                    <span className={styles.historicoProdutoName}>{produto.produto_nome}</span>
                                    <span className={`${styles.historicoProdutoBadge} ${styles.historicoProdutoBadgeGreen}`}>
                                      {produto.produto_tipo === 'produto' ? 'PRODUTO' : 'SERVIÇO'}
                                    </span>
                                  </div>
                                  <div className={styles.historicoProdutoGrid}>
                                    <div className={styles.historicoProdutoField}>
                                      <span className={styles.historicoProdutoFieldLabel}>Departamento:</span>
                                      <p className={styles.historicoProdutoFieldValue}>
                                        {produto.departamento_nome ? (
                                          <span className="flex items-center gap-1">
                                            {produto.departamento_codigo && (
                                              <span className={styles.historicoResumoItemDeptCode}>
                                                {produto.departamento_codigo}
                                              </span>
                                            )}
                                            {produto.departamento_nome}
                                          </span>
                                        ) : (
                                          <span className={styles.textSecondary}>Não definido</span>
                                        )}
                                      </p>
                                    </div>
                                    <div className={styles.historicoProdutoField}>
                                      <span className={styles.historicoProdutoFieldLabel}>Quantidade:</span>
                                      <p className={styles.historicoProdutoFieldValue}>{produto.quantidade}</p>
                                    </div>
                                    <div className={styles.historicoProdutoField}>
                                      <span className={styles.historicoProdutoFieldLabel}>Valor Unitário:</span>
                                      <p className={styles.historicoProdutoFieldValue}>{formatCurrency(produto.valor_unitario)}</p>
                                    </div>
                                    <div className={styles.historicoProdutoField}>
                                      <span className={styles.historicoProdutoFieldLabel}>Subtotal:</span>
                                      <p className={styles.historicoProdutoFieldValue}>{formatCurrency((produto.quantidade * produto.valor_unitario) - produto.desconto)}</p>
                                    </div>
                                  </div>
                                  {produto.observacoes && (
                                    <div className={styles.historicoProdutoObservacoes}>
                                      <span className={styles.historicoProdutoObservacoesLabel}>Observações:</span>
                                      <p className={styles.historicoProdutoObservacoesValue}>{produto.observacoes}</p>
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className={styles.historicoProdutoItem}>
                                <div className={styles.historicoProdutoHeader}>
                                  <span className={styles.historicoProdutoName}>{contrato.produto_servico_nome}</span>
                                  <span className={`${styles.historicoProdutoBadge} ${styles.historicoProdutoBadgeBlue}`}>
                                    SERVIÇO
                                  </span>
                                </div>
                                <div className={styles.gridTwoCols}>
                                  <div className={styles.historicoProdutoField}>
                                    <span className={styles.historicoProdutoFieldLabel}>Valor:</span>
                                    <p className={styles.historicoProdutoFieldValue}>{formatCurrency(contrato.valor)}</p>
                                  </div>
                                  <div className={styles.historicoProdutoField}>
                                    <span className={styles.historicoProdutoFieldLabel}>Quantidade:</span>
                                    <p className={styles.historicoProdutoFieldValue}>1</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Boletos pagos */}
                        <div>
                          <h4 className={styles.historicoBoletosTitle}>
                            <CreditCard className="w-4 h-4 text-green-500" />
                            Boletos pagos
                          </h4>
                          {loadingBoletos ? (
                            <div className={styles.historicoBoletosLoading}>
                              <div className={styles.historicoBoletosLoadingSpinner}></div>
                              <span className={styles.historicoBoletosLoadingText}>Carregando...</span>
                            </div>
                          ) : (
                            <div className={styles.tableContainer}>
                              <table className={styles.historicoBoletosTable}>
                                <thead className={styles.historicoBoletosTableHeader}>
                                  <tr>
                                    <th className={styles.historicoBoletosTableHeaderCell}>Data da venda</th>
                                    <th className={styles.historicoBoletosTableHeaderCell}>Número da venda</th>
                                    <th className={styles.historicoBoletosTableHeaderCell}>Valor (R$)</th>
                                    <th className={styles.historicoBoletosTableHeaderCell}>Recebido (R$)</th>
                                    <th className={styles.historicoBoletosTableHeaderCell}>Situação</th>
                                    <th className={styles.historicoBoletosTableHeaderCell}>Ações</th>
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
                                            <td colSpan={6} className={`${styles.historicoBoletosTableCell} ${styles.historicoBoletosTableCellCenter} ${styles.historicoBoletosTableCellSecondary}`}>
                                              Nenhum boleto pago encontrado
                                            </td>
                                          </tr>
                                        );
                                      }

                                      // Mostrar apenas boletos que foram pagos
                                      return boletosPagos.map((boleto, index) => {
                                        const valorBase = contrato?.valor || 0;

                                        return (
                                          <tr key={index} className={styles.historicoBoletosTableRow}>
                                            <td className={styles.historicoBoletosTableCell}>
                                              {formatDate(boleto.data_pagamento)}
                                            </td>
                                            <td className={styles.historicoBoletosTableCell}>
                                              {contrato?.numero_contrato || contrato?.id}
                                            </td>
                                            <td className={styles.historicoBoletosTableCell}>
                                              {formatCurrency(valorBase)}
                                            </td>
                                            <td className={styles.historicoBoletosTableCell}>
                                              <span className={styles.historicoBoletosTableCellGreen}>
                                                {boleto.valor_recebido > 0 ? formatCurrency(boleto.valor_recebido) : formatCurrency(valorBase)}
                                              </span>
                                            </td>
                                            <td className={styles.historicoBoletosTableCell}>
                                              <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                                                PAGO
                                              </span>
                                            </td>
                                            <td className={styles.historicoBoletosTableCell}>
                                              <div className={styles.historicoBoletosActions}>
                                                <button 
                                                  className={styles.historicoBoletosButton}
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
                                      
                                      // Verificar se o contrato tem data de início válida OU produtos_dados
                                      const temProdutosDados = contrato?.produtos_dados && (
                                        typeof contrato.produtos_dados === 'string' 
                                          ? JSON.parse(contrato.produtos_dados)?.length > 0
                                          : Array.isArray(contrato.produtos_dados) && contrato.produtos_dados.length > 0
                                      );
                                      
                                      if (!contrato?.data_inicio && !temProdutosDados) {
                                        return (
                                          <tr>
                                            <td colSpan={6} className={`${styles.historicoBoletosTableCell} ${styles.historicoBoletosTableCellCenter} ${styles.historicoBoletosTableCellSecondary}`}>
                                              Contrato sem data de início definida
                                            </td>
                                          </tr>
                                        );
                                      }

                                      // Se tiver produtos_dados, usar a primeira data de vencimento como data de início
                                      let dataInicio = null;
                                      if (temProdutosDados) {
                                        try {
                                          const produtosDados = typeof contrato.produtos_dados === 'string' 
                                            ? JSON.parse(contrato.produtos_dados) 
                                            : contrato.produtos_dados;
                                          
                                          console.log('🔍 Processando produtos_dados para data de início:', produtosDados);
                                          
                                          // Encontrar a primeira data de vencimento (pode ser de qualquer parcela, não só a primeira)
                                          let primeiraDataEncontrada = null;
                                          
                                          for (const produto of produtosDados) {
                                            if (produto.parcelas_detalhadas && Array.isArray(produto.parcelas_detalhadas) && produto.parcelas_detalhadas.length > 0) {
                                              // Ordenar parcelas por data para pegar a mais antiga
                                              const parcelasOrdenadas = [...produto.parcelas_detalhadas].sort((a, b) => {
                                                const dataA = parseDateSafe(a.data_vencimento);
                                                const dataB = parseDateSafe(b.data_vencimento);
                                                if (!dataA) return 1;
                                                if (!dataB) return -1;
                                                return dataA.getTime() - dataB.getTime();
                                              });
                                              
                                              for (const parcela of parcelasOrdenadas) {
                                                if (parcela.data_vencimento) {
                                                  const dataParsed = parseDateSafe(parcela.data_vencimento);
                                                  console.log('📅 Tentando parsear data:', parcela.data_vencimento, 'Resultado:', dataParsed);
                                                  if (dataParsed) {
                                                    primeiraDataEncontrada = dataParsed;
                                                    break;
                                                  }
                                                }
                                              }
                                              
                                              if (primeiraDataEncontrada) break;
                                            }
                                          }
                                          
                                          dataInicio = primeiraDataEncontrada;
                                          console.log('✅ Data de início encontrada:', dataInicio);
                                        } catch (error) {
                                          console.error('❌ Erro ao processar produtos_dados:', error);
                                          console.error('Stack:', error.stack);
                                        }
                                      }
                                      
                                      // Se não encontrou em produtos_dados, usar data_inicio
                                      if (!dataInicio && contrato?.data_inicio) {
                                        console.log('📅 Usando data_inicio do contrato:', contrato.data_inicio);
                                        dataInicio = parseDateSafe(contrato.data_inicio);
                                        console.log('📅 Data parseada:', dataInicio);
                                      }
                                      
                                      if (!dataInicio) {
                                        console.error('❌ Não foi possível determinar data de início. Contrato:', {
                                          id: contrato?.id,
                                          temDataInicio: !!contrato?.data_inicio,
                                          temProdutosDados: temProdutosDados,
                                          produtosDados: contrato?.produtos_dados
                                        });
                                        return (
                                          <tr>
                                            <td colSpan={6} className={`${styles.historicoBoletosTableCell} ${styles.historicoBoletosTableCellCenter} ${styles.historicoBoletosTableCellSecondary}`}>
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
                                            <td colSpan={6} className={`${styles.historicoBoletosTableCell} ${styles.historicoBoletosTableCellCenter} ${styles.historicoBoletosTableCellSecondary}`}>
                                              Contrato ainda não iniciado para {anoAtual}
                                            </td>
                                          </tr>
                                        );
                                      }

                                      // Se o ano selecionado é posterior ao ano do contrato
                                      if (anoAtual > anoContrato) {
                                        return (
                                          <tr>
                                            <td colSpan={6} className={`${styles.historicoBoletosTableCell} ${styles.historicoBoletosTableCellCenter} ${styles.historicoBoletosTableCellSecondary}`}>
                                              Cronograma de {anoAtual} - Contrato iniciado em {anoContrato}
                                            </td>
                                          </tr>
                                        );
                                      }

                                      // Se tiver produtos_dados, usar as parcelas para gerar os meses
                                      let mesesParaMostrar = [];
                                      
                                      if (temProdutosDados) {
                                        try {
                                          const produtosDados = typeof contrato.produtos_dados === 'string' 
                                            ? JSON.parse(contrato.produtos_dados) 
                                            : contrato.produtos_dados;
                                          
                                          // Coletar todos os meses das parcelas do ano selecionado
                                          const mesesDasParcelas = new Set();
                                          
                                          for (const produto of produtosDados) {
                                            if (produto.parcelas_detalhadas && Array.isArray(produto.parcelas_detalhadas)) {
                                              for (const parcela of produto.parcelas_detalhadas) {
                                                if (parcela.data_vencimento) {
                                                  const dataParcela = parseDateSafe(parcela.data_vencimento);
                                                  if (dataParcela && dataParcela.getFullYear() === anoAtual) {
                                                    mesesDasParcelas.add(dataParcela.getMonth() + 1);
                                                  }
                                                }
                                              }
                                            }
                                          }
                                          
                                          // Converter Set para array ordenado
                                          mesesParaMostrar = Array.from(mesesDasParcelas).sort((a, b) => a - b);
                                        } catch (error) {
                                          console.error('Erro ao processar parcelas de produtos_dados:', error);
                                        }
                                      }
                                      
                                      // Se não encontrou meses em produtos_dados, usar a lógica antiga
                                      if (mesesParaMostrar.length === 0) {
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
                                        for (let mes = mesInicio; mes <= 12; mes++) {
                                          mesesParaMostrar.push(mes);
                                        }
                                      }

                                      if (mesesParaMostrar.length === 0) {
                                        return (
                                          <tr>
                                            <td colSpan={6} className={`${styles.historicoBoletosTableCell} ${styles.historicoBoletosTableCellCenter} ${styles.historicoBoletosTableCellSecondary}`}>
                                              Nenhum mês para exibir
                                            </td>
                                          </tr>
                                        );
                                      }

                                      return mesesParaMostrar.map((mes) => {
                                        // Buscar boleto para este mês (pago ou não pago) - específico deste contrato
                                        // Se tiver produtos_dados, buscar pela data exata da parcela
                                        let boletoMes = null;
                                        
                                        if (temProdutosDados) {
                                          try {
                                            const produtosDados = typeof contrato.produtos_dados === 'string' 
                                              ? JSON.parse(contrato.produtos_dados) 
                                              : contrato.produtos_dados;
                                            
                                            // Encontrar a parcela deste mês
                                            for (const produto of produtosDados) {
                                              if (produto.parcelas_detalhadas && Array.isArray(produto.parcelas_detalhadas)) {
                                                const parcelaDoMes = produto.parcelas_detalhadas.find(parcela => {
                                                  if (parcela.data_vencimento) {
                                                    const dataParcela = parseDateSafe(parcela.data_vencimento);
                                                    return dataParcela && dataParcela.getMonth() + 1 === mes && dataParcela.getFullYear() === anoAtual;
                                                  }
                                                  return false;
                                                });
                                                
                                                if (parcelaDoMes) {
                                                  // Buscar boleto pela data exata da parcela
                                                  boletoMes = boletosPagamento.find(boleto => {
                                                    if (boleto.data_pagamento) {
                                                      const dataPagamento = parseDateSafe(boleto.data_pagamento);
                                                      const dataParcela = parseDateSafe(parcelaDoMes.data_vencimento);
                                                      // Comparar apenas a data (sem hora)
                                                      if (dataPagamento && dataParcela) {
                                                        return dataPagamento.toDateString() === dataParcela.toDateString();
                                                      }
                                                    }
                                                    return false;
                                                  });
                                                  if (boletoMes) break;
                                                }
                                              }
                                            }
                                          } catch (error) {
                                            console.error('Erro ao buscar boleto por parcela:', error);
                                          }
                                        }
                                        
                                        // Se não encontrou, usar a busca antiga
                                        if (!boletoMes) {
                                          boletoMes = boletosPagamento.find(boleto => {
                                            if (boleto.data_pagamento) {
                                              const dataPagamento = parseDateSafe(boleto.data_pagamento);
                                              return dataPagamento && dataPagamento.getMonth() + 1 === mes && dataPagamento.getFullYear() === anoAtual;
                                            }
                                            return false;
                                          });
                                        }

                                        const isPago = boletoMes ? (
                                          boletoMes.status === "PAGO" || 
                                          boletoMes.status === "pago" || 
                                          boletoMes.status === "RECEBIDO" ||
                                          boletoMes.status === "LIQUIDADO"
                                        ) : false;

                                        // Calcular valor base e data de vencimento
                                        let valorBase = contrato?.valor || 0;
                                        let dataVencimento = `${anoAtual}-${mes.toString().padStart(2, '0')}-06`; // Data padrão
                                        
                                        // Se tiver produtos_dados, usar o valor e data da parcela
                                        if (temProdutosDados) {
                                          try {
                                            const produtosDados = typeof contrato.produtos_dados === 'string' 
                                              ? JSON.parse(contrato.produtos_dados) 
                                              : contrato.produtos_dados;
                                            
                                            for (const produto of produtosDados) {
                                              if (produto.parcelas_detalhadas && Array.isArray(produto.parcelas_detalhadas)) {
                                                const parcelaDoMes = produto.parcelas_detalhadas.find(parcela => {
                                                  if (parcela.data_vencimento) {
                                                    const dataParcela = parseDateSafe(parcela.data_vencimento);
                                                    return dataParcela && dataParcela.getMonth() + 1 === mes && dataParcela.getFullYear() === anoAtual;
                                                  }
                                                  return false;
                                                });
                                                
                                                if (parcelaDoMes) {
                                                  dataVencimento = parcelaDoMes.data_vencimento;
                                                  valorBase = parseFloat(parcelaDoMes.valor) || valorBase;
                                                  break;
                                                }
                                              }
                                            }
                                          } catch (error) {
                                            console.error('Erro ao buscar dados da parcela:', error);
                                          }
                                        }

                                        return (
                                          <tr key={mes} className={styles.historicoBoletosTableRow}>
                                            <td className={styles.historicoBoletosTableCell}>
                                              {formatDate(dataVencimento)}
                                            </td>
                                            <td className={styles.historicoBoletosTableCell}>
                                              {contrato?.numero_contrato || contrato?.id}
                                            </td>
                                            <td className={styles.historicoBoletosTableCell}>
                                              {formatCurrency(valorBase)}
                                            </td>
                                            <td className={styles.historicoBoletosTableCell}>
                                              {boletoMes && isPago ? (
                                                <span className={styles.historicoBoletosTableCellGreen}>
                                                  {boletoMes.valor_recebido > 0 ? formatCurrency(boletoMes.valor_recebido) : formatCurrency(valorBase)}
                                                </span>
                                              ) : boletoMes && !isPago ? (
                                                <span className={styles.historicoBoletosTableCellOrange}>
                                                  {formatCurrency(0)}
                                                </span>
                                              ) : (
                                                <span className={styles.historicoBoletosTableCellSecondary}>-</span>
                                              )}
                                            </td>
                                            <td className={styles.historicoBoletosTableCell}>
                                              <span className={`${styles.badge} ${
                                                boletoMes && isPago 
                                                  ? styles.badgeSuccess 
                                                  : boletoMes && !isPago 
                                                  ? styles.badgeError 
                                                  : styles.badgeWarning
                                              }`}>
                                                {boletoMes && isPago 
                                                  ? "PAGO" 
                                                  : boletoMes && !isPago 
                                                  ? "ATRASADO" 
                                                  : "PENDENTE"
                                                }
                                              </span>
                                            </td>
                                            <td className={styles.historicoBoletosTableCell}>
                                              <div className={styles.historicoBoletosActions}>
                                                <button 
                                                  className={styles.historicoBoletosButton}
                                                  onClick={() => handleEditarVencimento(dataVencimento)}
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
                      <div className={styles.historicoContent}>
                        <p className={styles.historicoEmpty}>Nenhuma venda registrada para 2024</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className={styles.drawerFooter}>
          <button
            onClick={onClose}
            className={`${styles.button} ${styles.buttonOutline}`}
          >
            Voltar
          </button>
          <div className={styles.footerActions}>
            <button 
              className={`${styles.button} ${styles.buttonOutline}`}
              onClick={handleGerarRecibo}
              disabled={!contrato || !empresa}
            >
              Gerar Recibo
            </button>
            <button 
              className={`${styles.button} ${styles.buttonGreen} ${(() => {
                const temVencimento = calcularProximoVencimentoDeProdutos() || contrato?.proximo_vencimento;
                return (!contrato || !temVencimento || gerandoBoleto) ? styles.buttonDisabled : '';
              })()}`}
              onClick={(e) => {
                const temVencimento = calcularProximoVencimentoDeProdutos() || contrato?.proximo_vencimento;
                console.log("🟢 Botão Gerar Boleto clicado", { 
                  contrato: !!contrato, 
                  proximo_vencimento: contrato?.proximo_vencimento,
                  vencimentoProdutos: calcularProximoVencimentoDeProdutos(),
                  temVencimento,
                  gerandoBoleto,
                  disabled: !contrato || !temVencimento || gerandoBoleto
                });
                e.preventDefault();
                e.stopPropagation();
                handleGerarBoleto();
              }}
              disabled={(() => {
                const temVencimento = calcularProximoVencimentoDeProdutos() || contrato?.proximo_vencimento;
                return !contrato || !temVencimento || gerandoBoleto;
              })()}
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
            </button>
            <button className={`${styles.button} ${styles.buttonOutline}`}>
              Outras ações
            </button>
            <button className={`${styles.button} ${styles.buttonPrimary}`}>
              Editar contrato
            </button>
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