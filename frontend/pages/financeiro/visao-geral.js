'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  MoreHorizontal,
  X,
  Mail,
  BarChart3,
  RefreshCw,
  Settings
} from 'lucide-react';
import { toast } from "react-toastify";
import { Button } from '../../components/financeiro/botao';
import { Textarea } from '../../components/financeiro/textarea';
import NovaReceitaDrawer from '../../components/financeiro/novaReceitaDrawer';
import { NovaDespesaDrawer } from '../../components/financeiro/NovaDespesaDrawer';
import PrincipalSidebar from '../../components/onety/principal/PrincipalSidebar';
import styles from '../../styles/financeiro/visao-geral.module.css';

// Componentes simples para substituir os do shadcn/ui
const Card = ({ className, children, ...props }) => (
  <div className={`${styles.card} ${className || ''}`} {...props}>
    {children}
  </div>
);

const CardHeader = ({ className, children, ...props }) => (
  <div className={`${styles.cardHeader} ${className || ''}`} {...props}>
    {children}
  </div>
);

const CardTitle = ({ className, children, ...props }) => (
  <h3 className={`${styles.cardTitle} ${className || ''}`} {...props}>
    {children}
  </h3>
);

const CardContent = ({ className, children, ...props }) => (
  <div className={`${styles.cardContent} ${className || ''}`} {...props}>
    {children}
  </div>
);

const Badge = ({ className, children, variant = 'default', ...props }) => {
  const variantClasses = {
    default: styles.badgeDefault,
    secondary: styles.badgeSecondary,
    destructive: styles.badgeDestructive,
  };
  
  return (
    <span className={`${styles.badge} ${variantClasses[variant]} ${className || ''}`} {...props}>
      {children}
    </span>
  );
};

const Skeleton = ({ className, style, ...props }) => (
  <div 
    className={`${styles.skeleton} ${className || ''}`} 
    style={style}
    {...props}
  />
);

// Função para buscar dados da API
const apiFetchJson = async (url) => {
  const token = localStorage.getItem('token');
  const response = await fetch(url, {
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
};

// Mapeamento de bancos para imagens locais
const BANCO_IMAGENS = {
  // Banco do Brasil
  'banco do brasil': '/bancosIcons/banco-do-brasil.png',
  'bb': '/bancosIcons/banco-do-brasil.png',
  
  // Bradesco
  'bradesco': '/bancosIcons/bradesco.png',
  'bradescard': '/bancosIcons/bradesco.png',
  
  // Caixa
  'caixa': '/bancosIcons/caixa.png',
  'caixa economica': '/bancosIcons/caixa.png',
  'caixa economica federal': '/bancosIcons/caixa.png',
  'caixa tem': '/bancosIcons/caixa.png',
  
  // Itaú
  'itau': '/bancosIcons/itau.png',
  'itau unibanco': '/bancosIcons/itau.png',
  'itaú': '/bancosIcons/itau.png',
  'Itaú': '/bancosIcons/itau.png',
  
  // Santander
  'santander': '/bancosIcons/santander.png',
  'banco santander': '/bancosIcons/santander.png',
  
  // Nubank
  'nubank': '/bancosIcons/nubank.png',
  'nubanco': '/bancosIcons/nubank.png',
  
  // Banco Inter
  'banco inter': '/bancosIcons/banco-inter.png',
  'inter': '/bancosIcons/banco-inter.png',
  
  // BTG Pactual
  'btg': '/bancosIcons/btg.png',
  'btg pactual': '/bancosIcons/btg.png',
  
  // Sicoob
  'sicoob': '/bancosIcons/sicoob.png',
  
  // Banco PAN
  'banco pan': '/bancosIcons/banco-pan.png',
  'pan': '/bancosIcons/banco-pan.png'
};

// Lista de bancos que não têm imagem específica (usar ícone)
const BANCOS_SEM_IMAGEM = [
  'banco bmg',
  'bmg',
  'ágora investimentos',
  'agora investimentos',
  'nucontas'
];

export default function VisaoGeral() {
  const [showPromoBanner, setShowPromoBanner] = useState(true);
  const [showNovaReceitaDrawer, setShowNovaReceitaDrawer] = useState(false);
  const [showNovaDespesaDrawer, setShowNovaDespesaDrawer] = useState(false);
  const [entradasVencidas, setEntradasVencidas] = useState(0);
  const [saidasVencidas, setSaidasVencidas] = useState(0);
  const [entradasVencemHoje, setEntradasVencemHoje] = useState(0);
  const [saidasVencemHoje, setSaidasVencemHoje] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, sucessos: 0, falhas: 0 });
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  
  // Estados para contas financeiras
  const [contasFinanceiras, setContasFinanceiras] = useState([]);
  const [contasLoading, setContasLoading] = useState(true);
  const [contasError, setContasError] = useState(null);
  const [valorTotalContas, setValorTotalContas] = useState(0);
  const [calculandoContasApi, setCalculandoContasApi] = useState(false);
  
  const API = process.env.NEXT_PUBLIC_API_URL;
  const router = useRouter();

  const receberStats = useMemo(() => [
    {
      title: 'Vencidos',
      value: entradasVencidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      color: styles.statValueReceita,
      bgColor: styles.statItemReceita
    },
    {
      title: 'Vencem hoje',
      value: entradasVencemHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      subtitle: 'Restante do mês: R$ Há renderizar',
      color: styles.statValueReceita,
      bgColor: styles.statItemReceita
    }
  ], [entradasVencidas, entradasVencemHoje]);

  const pagarStats = useMemo(() => [
    {
      title: 'Vencidos',
      value: saidasVencidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      color: styles.statValueDespesa,
      bgColor: styles.statItemDespesa
    },
    {
      title: 'Vencem hoje',
      value: saidasVencemHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      subtitle: 'Restante do mês: R$ Há renderizar',
      color: styles.statValueDespesa,
      bgColor: styles.statItemDespesa
    }
  ], [saidasVencidas, saidasVencemHoje]);

  // Estados para o fluxo de caixa
  const [fluxoCaixaData, setFluxoCaixaData] = useState([]);
  const [fluxoCaixaLoading, setFluxoCaixaLoading] = useState(true);
  const [fluxoCaixaError, setFluxoCaixaError] = useState(null);
  const [lastUpdateFluxoCaixa, setLastUpdateFluxoCaixa] = useState(null);

  const vendasData = [
    { month: 'jul', value: 45000 },
    { month: 'ago', value: 52000 },
    { month: 'set', value: 48000 },
    { month: 'out', value: 65000 },
    { month: 'nov', value: 58000 },
    { month: 'dez', value: 72000 },
    { month: 'jan', value: 68000 },
    { month: 'fev', value: 75000 },
    { month: 'mar', value: 82000 },
    { month: 'abr', value: 78000 },
    { month: 'mai', value: 85000 },
    { month: 'jun', value: 92000 }
  ];

  const maxVendas = Math.max(...vendasData.map(d => d.value));

  // Função para encontrar a imagem do banco baseada no campo "banco"
  const encontrarImagemBanco = (nomeBanco) => {
    if (!nomeBanco) return undefined;
    
    const nomeNormalizado = nomeBanco.toLowerCase().trim();
    
    // Verificar se está na lista de bancos sem imagem
    if (BANCOS_SEM_IMAGEM.includes(nomeNormalizado)) {
      console.log(`🏦 Banco sem imagem específica: ${nomeBanco}`);
      return undefined;
    }
    
    // Buscar correspondência exata primeiro
    if (BANCO_IMAGENS[nomeNormalizado]) {
      console.log(`✅ Imagem encontrada para ${nomeBanco}: ${BANCO_IMAGENS[nomeNormalizado]}`);
      return BANCO_IMAGENS[nomeNormalizado];
    }
    
    // Buscar correspondência parcial
    for (const [bancoKey, imagemPath] of Object.entries(BANCO_IMAGENS)) {
      if (nomeNormalizado.includes(bancoKey) || bancoKey.includes(nomeNormalizado)) {
        console.log(`✅ Imagem encontrada (parcial) para ${nomeBanco} -> ${bancoKey}: ${imagemPath}`);
        return imagemPath;
      }
    }
    
    console.log(`❌ Nenhuma imagem encontrada para: ${nomeBanco}`);
    return undefined;
  };

  // Função para transformar conta tradicional em ContaFinanceira
  const transformarContaTradicional = async (conta) => {
    const saldo = parseFloat(conta.saldo || '0');
    const status = saldo > 0 ? 'current' : saldo === 0 ? 'zero' : 'error';
    const nomeBanco = conta.descricao_banco || conta.banco || '';
    const fotoBanco = encontrarImagemBanco(nomeBanco);
    
    console.log(`🏦 Conta Tradicional - ID: ${conta.id}, Banco: "${conta.banco}", Descrição: "${conta.descricao_banco}", Nome usado: "${nomeBanco}", Foto: ${fotoBanco ? '✅' : '❌'}`);
    
    return {
      id: String(conta.id),
      bank: nomeBanco || 'Conta sem descrição',
      type: conta.tipo || 'Conta',
      account: conta.agencia && conta.numero_conta 
        ? `Ag: ${conta.agencia} Cc: ${conta.numero_conta}`
        : conta.numero_conta || '',
      balance: `R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      status,
      icon: (conta.banco || 'C').charAt(0).toUpperCase(),
      iconColor: 'bg-[#1E88E5]',
      lastUpdate: conta.updated_at ? new Date(conta.updated_at).toLocaleDateString('pt-BR') : undefined,
      origem: 'contas',
      fotoBanco
    };
  };

  // Função para transformar conta-api em ContaFinanceira
  const transformarContaApi = async (conta, todasContas) => {
    console.log('🔄 Transformando conta API:', conta);
    
    // Se a conta Pluggy não tem banco ou descricao_banco, buscar de uma conta manual com mesmo item_id
    let nomeConta = conta.descricao_banco;
    let bancoConta = conta.banco;
    
    if (!nomeConta || !bancoConta) {
      console.log(`🔍 Conta Pluggy sem dados completos, buscando conta manual com item_id: ${conta.item_id}`);
      
      // Buscar conta manual com mesmo item_id que tenha dados
      const contaManual = todasContas.find(c => 
        c.item_id === conta.item_id && 
        !c.account && // É conta manual (sem account)
        (c.descricao_banco || c.banco) // Tem dados de banco
      );
      
      if (contaManual) {
        console.log('✅ Encontrada conta manual com dados:', contaManual);
        nomeConta = nomeConta || contaManual.descricao_banco || contaManual.banco;
        bancoConta = bancoConta || contaManual.banco;
      } else {
        console.log('❌ Nenhuma conta manual encontrada com mesmo item_id');
      }
    }
    
    // Fallback se ainda não tem dados
    nomeConta = nomeConta || `Conta ${conta.tipo || conta.tipo_conta || 'OpenFinance'}`;
    bancoConta = bancoConta || "OpenFinance";
    
    console.log('📝 Nome da conta encontrado:', nomeConta);
    console.log('🏦 Banco encontrado:', bancoConta);
    
    const fotoBanco = encontrarImagemBanco(bancoConta);
    
    // Calcular saldo baseado nas transações da API
    let saldoCalculado = 0;
    try {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const empresaId = userData.EmpresaId;
      const token = localStorage.getItem('token');
      
      if (empresaId && token && conta.account) {
        const transacoesRes = await fetch(`${API}/transacoes-api/${conta.account}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (transacoesRes.ok) {
          const transacoesData = await transacoesRes.json();
          const transacoes = transacoesData.transactions || [];
          
          // Calcular saldo total de todas as transações
          saldoCalculado = transacoes.reduce((total, transacao) => {
            const valor = parseFloat(transacao.amount || 0);
            return total + valor;
          }, 0);
          
          console.log(`💰 Saldo calculado para conta ${conta.account}: R$ ${saldoCalculado.toFixed(2)}`);
        }
      }
    } catch (error) {
      console.error(`❌ Erro ao calcular saldo da conta ${conta.account}:`, error);
      saldoCalculado = parseFloat(conta.saldo || '0');
    }
    
    const status = saldoCalculado > 0 ? 'current' : saldoCalculado === 0 ? 'zero' : 'error';
    
    return {
      id: String(conta.account),
      bank: nomeConta,
      type: conta.tipo || conta.tipo_conta || 'Conta',
      account: conta.agencia && conta.numero_conta 
        ? `Ag: ${conta.agencia} Cc: ${conta.numero_conta}`
        : conta.numero_conta || '',
      balance: `R$ ${saldoCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      status,
      icon: (bancoConta || 'C').charAt(0).toUpperCase(),
      iconColor: 'bg-[#9C27B0]',
      lastUpdate: conta.updated_at ? new Date(conta.updated_at).toLocaleDateString('pt-BR') : undefined,
      origem: 'contas-api',
      fotoBanco
    };
  };

  // Função para buscar contas financeiras
  const fetchContasFinanceiras = async () => {
    console.log('🚀 Iniciando busca de contas financeiras');
    
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const empresaId = userData.EmpresaId;

    if (!empresaId) {
      console.error('❌ empresaId não encontrado no localStorage');
      setContasError('Empresa não selecionada');
      setContasLoading(false);
      return;
    }

    setContasLoading(true);
    setContasError(null);
    setCalculandoContasApi(true);

    try {
      // Buscar as duas rotas em paralelo usando o interceptor
      const [dataContas, dataContasApi] = await Promise.all([
        apiFetchJson(`${API}/contas/empresa/${empresaId}`),
        apiFetchJson(`${API}/contas-api/company/${empresaId}/contas`)
      ]);

      let contasTradicionais = [];
      let contasApi = [];

      // Processar contas tradicionais
      const contasTradicionaisPromises = (dataContas || []).map(transformarContaTradicional);
      contasTradicionais = await Promise.all(contasTradicionaisPromises);
      console.log('✅ Contas tradicionais carregadas:', contasTradicionais.length);

      // Processar contas-api
      // Filtrar apenas contas que tenham o campo 'account' válido
      const contasComAccount = (dataContasApi.contas || []).filter(
        (conta) => conta.account && conta.account.toString().trim() !== ''
      );
      
      // Processar contas API de forma assíncrona, passando todas as contas como parâmetro
      const contasApiPromises = contasComAccount.map(conta => transformarContaApi(conta, dataContasApi.contas || []));
      contasApi = await Promise.all(contasApiPromises);
      
      console.log('✅ Contas API carregadas:', contasApi.length);

      // Unir as duas listas
      const todasContas = [...contasTradicionais, ...contasApi];
      setContasFinanceiras(todasContas);

      // Calcular valor total
      const total = todasContas.reduce((acc, conta) => {
        const saldoStr = conta.balance.replace('R$ ', '').replace(/\./g, '').replace(',', '.');
        const saldo = parseFloat(saldoStr) || 0;
        return acc + saldo;
      }, 0);
      setValorTotalContas(total);

      console.log('✅ Contas financeiras atualizadas:', todasContas.length, 'contas, total: R$', total.toLocaleString('pt-BR'));

      // Toast de sucesso se houver contas API
      const contasApiCount = contasApi.length;
      if (contasApiCount > 0) {
        toast.success(`${contasApiCount} conta(s) API atualizada(s) com saldo calculado das transações!`);
      }

    } catch (error) {
      console.error('❌ Erro geral ao buscar contas financeiras:', error);
      setContasError('Erro ao carregar contas financeiras');
    } finally {
      setContasLoading(false);
      setCalculandoContasApi(false);
    }
  };

  // Função para sincronizar transações Pluggy silenciosamente (versão automática sem toast)
  const syncTransacoesPluggySilencioso = async () => {
    // Evitar múltiplas execuções simultâneas
    if (syncing) {
      console.log("🔄 Sincronização já em andamento, ignorando nova chamada");
      return;
    }

    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const empresaId = userData.EmpresaId;
    const token = localStorage.getItem("token");

    if (!empresaId || !token) {
      return;
    }

    setSyncing(true);
    
    console.log("🚀 Iniciando sincronização automática silenciosa...");
    
    // Timeout de 5 minutos para evitar travamento
    const timeoutId = setTimeout(() => {
      console.warn("⚠️ Timeout de sincronização atingido (5 minutos)");
      setSyncing(false);
      setSyncProgress({ current: 0, total: 0, sucessos: 0, falhas: 0 });
    }, 5 * 60 * 1000);
    
    try {
      console.log("🔄 Iniciando sincronização das transações Pluggy...");
      
      // Primeiro, buscar todas as contas-api da empresa
      const resContasApi = await fetch(`${API_URL}/contas-api/company/${empresaId}/contas`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (resContasApi.ok) {
        const dataContasApi = await resContasApi.json();
        const contasPluggy = dataContasApi.contas || [];

        // Filtrar apenas contas da empresa atual que são contas-api (Pluggy)
        const contasDaEmpresa = contasPluggy.filter(conta => 
          conta.company_id && 
          String(conta.company_id) === empresaId &&
          conta.account && // Deve ter account (é conta Pluggy)
          conta.item_id // Deve ter item_id (é conta Pluggy válida)
        );

        console.log(`📋 Encontradas ${contasPluggy.length} contas Pluggy no total`);
        console.log(`🏢 Contas da empresa atual (${empresaId}): ${contasDaEmpresa.length}`);

        if (contasDaEmpresa.length === 0) {
          console.log("ℹ️ Nenhuma conta Pluggy válida encontrada para esta empresa");
          setSyncing(false);
          return;
        }

        let sucessos = 0;
        let falhas = 0;
        
        // Inicializar progresso apenas com contas da empresa
        setSyncProgress({ current: 0, total: contasDaEmpresa.length, sucessos: 0, falhas: 0 });

        // Processar contas em lotes de 5 para evitar sobrecarga
        const LOTE_SIZE = 5;
        const lotes = [];
        for (let i = 0; i < contasDaEmpresa.length; i += LOTE_SIZE) {
          lotes.push(contasDaEmpresa.slice(i, i + LOTE_SIZE));
        }

        console.log(`🚀 Processando ${contasDaEmpresa.length} contas Pluggy em ${lotes.length} lotes de ${LOTE_SIZE}`);

        for (let loteIndex = 0; loteIndex < lotes.length; loteIndex++) {
          const lote = lotes[loteIndex];
          console.log(`📦 Processando lote ${loteIndex + 1}/${lotes.length} com ${lote.length} contas`);

          // Processar contas do lote em paralelo
          const promessas = lote.map(async (conta) => {
            if (!conta.account) return { sucesso: false, conta: conta.account };

            console.log(`🔄 Sincronizando transações da conta ${conta.account} (Empresa: ${conta.company_id})`);
            
            // Tentar até 2 vezes para cada conta (reduzido para ser mais rápido)
            let tentativas = 0;
            const maxTentativas = 2;
            let sucesso = false;

            while (tentativas < maxTentativas && !sucesso) {
              tentativas++;
              
              try {
                const requestBody = {
                  accountId: conta.account,
                  company_id: empresaId,
                  cliente_id: conta.cliente_id || null
                };
                
                const syncResponse = await fetch(`${API_URL}/transacoes-api/sync`, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(requestBody),
                });

                if (syncResponse.ok) {
                  const syncResult = await syncResponse.json();
                  console.log(`✅ Transações da conta ${conta.account} sincronizadas:`, syncResult);
                  sucesso = true;
                  return { sucesso: true, conta: conta.account };
                } else {
                  const errorData = await syncResponse.json().catch(() => ({}));
                  console.error(`❌ Erro ao sincronizar transações da conta ${conta.account} (tentativa ${tentativas}/${maxTentativas}):`, syncResponse.status, errorData);
                  
                  if (tentativas < maxTentativas) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                }
              } catch (error) {
                console.error(`❌ Erro ao sincronizar transações da conta ${conta.account} (tentativa ${tentativas}/${maxTentativas}):`, error);
                
                if (tentativas < maxTentativas) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
            }

            console.log(`❌ Conta ${conta.account} falhou após ${maxTentativas} tentativas`);
            return { sucesso: false, conta: conta.account };
          });

          // Aguardar todas as contas do lote
          const resultados = await Promise.all(promessas);
          
          // Atualizar contadores
          resultados.forEach(resultado => {
            if (resultado.sucesso) {
              sucessos++;
            } else {
              falhas++;
            }
          });

          // Atualizar progresso
          const newProgress = { current: sucessos + falhas, total: contasDaEmpresa.length, sucessos, falhas };
          console.log(`📊 Progresso atualizado (lote ${loteIndex + 1}):`, newProgress);
          setSyncProgress(newProgress);

          // Aguardar um pouco entre os lotes para não sobrecarregar
          if (loteIndex < lotes.length - 1) {
            console.log(`⏳ Aguardando 2 segundos antes do próximo lote...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        console.log(`✅ Sincronização automática silenciosa concluída! Sucessos: ${sucessos}, Falhas: ${falhas}`);
        
        // Disparar evento de sincronização concluída (silencioso)
        window.dispatchEvent(new CustomEvent('syncCompleted'));
        
        // SEM TOAST - sincronização automática é silenciosa
      } else {
        console.error("❌ Erro ao buscar contas da empresa:", resContasApi.status);
      }
    } catch (error) {
      console.error("❌ Erro durante sincronização automática de transações:", error);
    } finally {
      clearTimeout(timeoutId);
      setSyncing(false);
    }
  };

  // Função para sincronizar transações Pluggy com retry (versão manual com toast)
  const syncTransacoesPluggy = async () => {
    // Evitar múltiplas execuções simultâneas
    if (syncing) {
      console.log("🔄 Sincronização já em andamento, ignorando nova chamada");
      return;
    }

    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const empresaId = userData.EmpresaId;
    const token = localStorage.getItem("token");

    if (!empresaId || !token) {
      return;
    }

    setSyncing(true);
    
    console.log("🚀 Iniciando sincronização manual de transações Pluggy...");
    
    // Timeout de 5 minutos para evitar travamento
    const timeoutId = setTimeout(() => {
      console.warn("⚠️ Timeout de sincronização atingido (5 minutos)");
      setSyncing(false);
      setSyncProgress({ current: 0, total: 0, sucessos: 0, falhas: 0 });
    }, 5 * 60 * 1000);
    try {
      console.log("🔄 Iniciando sincronização das transações Pluggy...");
      
      // Primeiro, buscar todas as contas-api da empresa
      const resContasApi = await fetch(`${API_URL}/contas-api/company/${empresaId}/contas`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (resContasApi.ok) {
        const dataContasApi = await resContasApi.json();
        const contasPluggy = dataContasApi.contas || [];

        // Filtrar apenas contas da empresa atual que são contas-api (Pluggy)
        const contasDaEmpresa = contasPluggy.filter(conta => 
          conta.company_id && 
          String(conta.company_id) === empresaId &&
          conta.account && // Deve ter account (é conta Pluggy)
          conta.item_id // Deve ter item_id (é conta Pluggy válida)
        );

        console.log(`📋 Encontradas ${contasPluggy.length} contas Pluggy no total`);
        console.log(`🏢 Contas da empresa atual (${empresaId}): ${contasDaEmpresa.length}`);

        if (contasDaEmpresa.length === 0) {
          console.log("ℹ️ Nenhuma conta Pluggy válida encontrada para esta empresa");
          setSyncing(false);
          return;
        }

        let sucessos = 0;
        let falhas = 0;
        
        // Inicializar progresso apenas com contas da empresa
        setSyncProgress({ current: 0, total: contasDaEmpresa.length, sucessos: 0, falhas: 0 });

        // Processar contas em lotes de 5 para evitar sobrecarga
        const LOTE_SIZE = 5;
        const lotes = [];
        for (let i = 0; i < contasDaEmpresa.length; i += LOTE_SIZE) {
          lotes.push(contasDaEmpresa.slice(i, i + LOTE_SIZE));
        }

        console.log(`🚀 Processando ${contasDaEmpresa.length} contas Pluggy em ${lotes.length} lotes de ${LOTE_SIZE}`);

        for (let loteIndex = 0; loteIndex < lotes.length; loteIndex++) {
          const lote = lotes[loteIndex];
          console.log(`📦 Processando lote ${loteIndex + 1}/${lotes.length} com ${lote.length} contas`);

          // Processar contas do lote em paralelo
          const promessas = lote.map(async (conta) => {
            if (!conta.account) return { sucesso: false, conta: conta.account };

            console.log(`🔄 Sincronizando transações da conta ${conta.account} (Empresa: ${conta.company_id})`);
            
            // Tentar até 2 vezes para cada conta (reduzido para ser mais rápido)
            let tentativas = 0;
            const maxTentativas = 2;
            let sucesso = false;

            while (tentativas < maxTentativas && !sucesso) {
              tentativas++;
              
              try {
                const requestBody = {
                  accountId: conta.account,
                  company_id: empresaId,
                  cliente_id: conta.cliente_id || null
                };
                
                const syncResponse = await fetch(`${API_URL}/transacoes-api/sync`, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(requestBody),
                });

                if (syncResponse.ok) {
                  const syncResult = await syncResponse.json();
                  console.log(`✅ Transações da conta ${conta.account} sincronizadas:`, syncResult);
                  sucesso = true;
                  return { sucesso: true, conta: conta.account };
                } else {
                  const errorData = await syncResponse.json().catch(() => ({}));
                  console.error(`❌ Erro ao sincronizar transações da conta ${conta.account} (tentativa ${tentativas}/${maxTentativas}):`, syncResponse.status, errorData);
                  
                  if (tentativas < maxTentativas) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                }
              } catch (error) {
                console.error(`❌ Erro ao sincronizar transações da conta ${conta.account} (tentativa ${tentativas}/${maxTentativas}):`, error);
                
                if (tentativas < maxTentativas) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
            }

            console.log(`❌ Conta ${conta.account} falhou após ${maxTentativas} tentativas`);
            return { sucesso: false, conta: conta.account };
          });

          // Aguardar todas as contas do lote
          const resultados = await Promise.all(promessas);
          
          // Atualizar contadores
          resultados.forEach(resultado => {
            if (resultado.sucesso) {
              sucessos++;
            } else {
              falhas++;
            }
          });

          // Atualizar progresso
          const newProgress = { current: sucessos + falhas, total: contasDaEmpresa.length, sucessos, falhas };
          console.log(`📊 Progresso atualizado (lote ${loteIndex + 1}):`, newProgress);
          setSyncProgress(newProgress);

          // Aguardar um pouco entre os lotes para não sobrecarregar
          if (loteIndex < lotes.length - 1) {
            console.log(`⏳ Aguardando 2 segundos antes do próximo lote...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        console.log(`✅ Sincronização manual concluída! Sucessos: ${sucessos}, Falhas: ${falhas}`);
        
        // Disparar evento de sincronização concluída
        window.dispatchEvent(new CustomEvent('syncCompleted'));
        
        // Toast final único (apenas para sincronização manual)
        if (falhas > 0) {
          console.warn(`⚠️ ${falhas} conta(s) falharam na sincronização. Verifique os logs acima.`);
          toast.warning(`Sincronização concluída com ${falhas} falha(s) em ${contasDaEmpresa.length} conta(s)`);
        } else {
          toast.success(`Sincronização concluída com sucesso! ${sucessos} conta(s) processada(s)`);
        }
      } else {
        console.error("❌ Erro ao buscar contas da empresa:", resContasApi.status);
      }
    } catch (error) {
      console.error("❌ Erro durante sincronização de transações:", error);
    } finally {
      clearTimeout(timeoutId);
      setSyncing(false);
    }
  };

  // Handlers para os drawers
  const handleNovaReceitaSave = (data) => {
    console.log('Nova receita criada:', data);
    // Recarregar dados do fluxo de caixa após criar nova receita
    fetchFluxoCaixaData();
  };

  const handleNovaDespesaSave = (data) => {
    console.log('Nova despesa criada:', data);
    // Recarregar dados do fluxo de caixa após criar nova despesa
    fetchFluxoCaixaData();
  };

  // Função para gerar array de datas (hoje + 4 próximos dias)
  const generateDateRange = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < 5; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      // Formata a data no timezone local para evitar problemas de UTC
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      dates.push(dateString);
    }
    
    console.log('📅 Datas geradas:', dates);
    return dates;
  };

  // Função para formatar data para exibição
  const formatDateForDisplay = (dateString) => {
    const date = new Date(dateString + 'T00:00:00'); // Força timezone local
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  };

  // Função para buscar transações por data
  const fetchTransacoesByDate = async (empresaId, data) => {
    console.log(`🔍 Buscando transações para ${data}`);

    try {
      const [entradas, saidas] = await Promise.all([
        apiFetchJson(`${API}/transacoes/empresa/${empresaId}/entradas?vencimento=${data}`),
        apiFetchJson(`${API}/transacoes/empresa/${empresaId}/saidas?vencimento=${data}`)
      ]);

      console.log(`📊 Transações para ${data}:`, { entradas: entradas.length, saidas: saidas.length });
      
      return { entradas, saidas };
    } catch (error) {
      console.error(`❌ Erro ao buscar transações para ${data}:`, error);
      throw error;
    }
  };

  // Função para calcular totais por dia
  const calculateDayTotals = (entradas, saidas) => {
    const totalRecebimentos = entradas.reduce((acc, item) => {
      const valor = parseFloat(item.a_receber || '0');
      return acc + valor;
    }, 0);

    const totalPagamentos = saidas.reduce((acc, item) => {
      const valor = parseFloat(item.a_pagar || '0');
      return acc + valor;
    }, 0);

    const saldo = totalRecebimentos - totalPagamentos;

    console.log(`💰 Totais calculados: Recebimentos: ${totalRecebimentos}, Pagamentos: ${totalPagamentos}, Saldo: ${saldo}`);
    
    return { totalRecebimentos, totalPagamentos, saldo };
  };

  // Função para buscar dados do fluxo de caixa
  const fetchFluxoCaixaData = async () => {
    console.log('🚀 Iniciando busca de dados do fluxo de caixa');
    
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const empresaId = userData.EmpresaId;

    if (!empresaId) {
      console.error('❌ empresaId não encontrado no localStorage');
      setFluxoCaixaError('Empresa não selecionada');
      setFluxoCaixaLoading(false);
      return;
    }

    setFluxoCaixaLoading(true);
    setFluxoCaixaError(null);

    try {
      const dateRange = generateDateRange();
      console.log('📅 Range de datas:', dateRange);

      const fluxoData = [];

      // Buscar dados para cada data
      for (const data of dateRange) {
        try {
          const { entradas, saidas } = await fetchTransacoesByDate(empresaId, data);
          const { totalRecebimentos, totalPagamentos, saldo } = calculateDayTotals(entradas, saidas);

          const formattedDay = formatDateForDisplay(data);
          console.log(`📊 Dados processados para ${data}:`, { 
            formattedDay, 
            recebimentos: totalRecebimentos, 
            pagamentos: totalPagamentos, 
            saldo 
          });
          
          fluxoData.push({
            day: formattedDay,
            recebimentos: totalRecebimentos,
            pagamentos: totalPagamentos,
            saldo: saldo,
            data: data
          });
        } catch (error) {
          console.error(`❌ Erro ao processar dados para ${data}:`, error);
          // Em caso de erro, adiciona dados zerados para manter a estrutura
          fluxoData.push({
            day: formatDateForDisplay(data),
            recebimentos: 0,
            pagamentos: 0,
            saldo: 0,
            data: data
          });
        }
      }

      setFluxoCaixaData(fluxoData);
      setLastUpdateFluxoCaixa(new Date());
      console.log('✅ Dados do fluxo de caixa atualizados:', fluxoData);

    } catch (error) {
      console.error('❌ Erro geral ao buscar dados do fluxo de caixa:', error);
      setFluxoCaixaError('Erro ao carregar dados do fluxo de caixa');
    } finally {
      setFluxoCaixaLoading(false);
    }
  };

  const handleCardClick = (type, filter) => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    let url = '';

    if (type === 'receber' && filter === 'vencem_hoje') {
      url = `/financeiro/contas-a-receber?status=ABERTO&vencimento=${today}`;
    }
    if (type === 'receber' && filter === 'vencidos') {
      url = `/financeiro/contas-a-receber?status=VENCIDO`;
    }
    if (type === 'pagar' && filter === 'vencem_hoje') {
      url = `/financeiro/contas-a-pagar?status=ABERTO&vencimento=${today}`;
    }
    if (type === 'pagar' && filter === 'vencidos') {
      url = `/financeiro/contas-a-pagar?status=VENCIDO`;
    }

    router.push(url);
  };

  const handleContaClick = (conta) => {
    // Navegar para a página de detalhes da conta
    if (conta.origem === 'contas-api') {
      router.push(`/financeiro/outras-contas/${conta.id}/transferencia`);
    } else {
      router.push(`/financeiro/outras-contas/${conta.id}/transferencia`);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const empresaId = userData.EmpresaId;
  
      if (!empresaId) {
        console.error('❌ empresaId não encontrado no localStorage');
        setIsLoading(false);
        return;
      }
  
      try {
        // Data de hoje no formato YYYY-MM-DD
        const hoje = new Date().toISOString().slice(0, 10);
  
        // Executar todas as requisições em paralelo usando o interceptor
        const [
          entradasVencidasData,
          entradasVencemHojeData,
          saidasVencidasData,
          saidasVencemHojeData
        ] = await Promise.all([
          apiFetchJson(`${API}/transacoes/empresa/${empresaId}/entradas?status=vencidos`),
          apiFetchJson(`${API}/transacoes/empresa/${empresaId}/entradas?status=em_aberto&vencimento=${hoje}`),
          apiFetchJson(`${API}/transacoes/empresa/${empresaId}/saidas?status=vencidos`),
          apiFetchJson(`${API}/transacoes/empresa/${empresaId}/saidas?status=em_aberto&vencimento=${hoje}`)
        ]);

        // Calcular somas
        const somaEntradasVencidas = entradasVencidasData.reduce(
          (acc, item) => acc + parseFloat(item.a_receber),
          0
        );
        const somaEntradasVencemHoje = entradasVencemHojeData.reduce(
          (acc, item) => acc + parseFloat(item.a_receber),
          0
        );
        const somaSaidasVencidas = saidasVencidasData.reduce(
          (acc, item) => acc + parseFloat(item.a_pagar),
          0
        );
        const somaSaidasVencemHoje = saidasVencemHojeData.reduce(
          (acc, item) => acc + parseFloat(item.a_pagar),
          0
        );

        // Atualizar estados
        setEntradasVencidas(somaEntradasVencidas);
        setEntradasVencemHoje(somaEntradasVencemHoje);
        setSaidasVencidas(somaSaidasVencidas);
        setSaidasVencemHoje(somaSaidasVencemHoje);

        console.log('✅ Dados carregados:');
        console.log('  Entradas vencidas:', somaEntradasVencidas);
        console.log('  Entradas que vencem hoje:', somaEntradasVencemHoje);
        console.log('  Saídas vencidas:', somaSaidasVencidas);
        console.log('  Saídas que vencem hoje:', somaSaidasVencemHoje);
  
      } catch (error) {
        console.error('❌ Erro ao buscar valores vencidos e que vencem hoje:', error);
      } finally {
        setIsLoading(false);
      }
    };
  
    fetchData();
  }, [API]);

  // useEffect para carregar dados do fluxo de caixa
  useEffect(() => {
    fetchFluxoCaixaData();
  }, []);  

  // useEffect para carregar contas financeiras
  useEffect(() => {
    fetchContasFinanceiras();
  }, []);

  // useEffect para sincronização automática silenciosa
  useEffect(() => {
    // Aguardar um pouco para as contas carregarem primeiro
    const timer = setTimeout(() => {
      if (!syncing) {
        syncTransacoesPluggySilencioso();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <PrincipalSidebar />
      <div className={styles.dashboardContainer}>
      {/* Header */}
      <div className={styles.dashboardHeader}>
        <div>
          <h1 className={styles.dashboardTitle}>Visão geral</h1>
        </div>
        <div className={styles.headerActions}>
          {syncing && (
            <div className={styles.syncIndicator}>
              <div className={styles.syncSpinner}></div>
              <span className={styles.syncText}>
                Sincronizando transações... ({syncProgress.current}/{syncProgress.total})
              </span>
              {syncProgress.sucessos > 0 && (
                <span className={styles.syncSuccess}>
                  ✅ {syncProgress.sucessos}
                </span>
              )}
              {syncProgress.falhas > 0 && (
                <span className={styles.syncError}>
                  ❌ {syncProgress.falhas}
                </span>
              )}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncTransacoesPluggy()}
            disabled={syncing}
            className={styles.syncButton}
          >
            <Settings className={styles.syncButtonIcon} />
            {syncing ? "Sincronizando..." : "Sincronizar transações"}
          </Button>
        </div>
      </div>

      {/* Promo Banner */}
      {/* {showPromoBanner && (
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 relative overflow-hidden">
          <CardContent className="pt-6">
            <button
              onClick={() => setShowPromoBanner(false)}
              className="absolute top-4 right-4 text-white/80 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold">Programe o envio automático de relatórios</h3>
                  <Badge variant="secondary" className="bg-white/20 text-white border-0">
                    Novo
                  </Badge>
                </div>
                <p className="text-blue-100 text-sm">
                  Escolha os relatórios que quer enviar por e-mail, defina uma frequência e quem deve recebê-los.
                </p>
              </div>
              <div className="ml-8">
                <div className="w-32 h-20 bg-white/10 rounded-lg flex items-center justify-center">
                  <Mail className="h-8 w-8 text-white/80" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )} */}

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        {/* A receber */}
        <Card className={`${styles.card} ${styles.receitaCard}`}>
          <CardHeader className={styles.cardHeader}>
            <CardTitle className={styles.cardTitle}>A receber</CardTitle>
            <Button 
              size="sm" 
              className={styles.actionButtonReceita}
              onClick={() => setShowNovaReceitaDrawer(true)}
            >
              <Plus className="h-4 w-4" />
              Nova receita
            </Button>
          </CardHeader>
          <CardContent className={styles.cardContent}>
            {isLoading ? (
              // Estado de loading com Skeleton
              <div className={styles.loadingContainer}>
                <div className={`${styles.loadingItem} ${styles.statItemReceita}`}>
                  <div className={styles.loadingContent}>
                    <div className={styles.loadingInfo}>
                      <Skeleton className={`${styles.loadingSkeleton} h-4 w-16 mb-2`} />
                      <Skeleton className={`${styles.loadingSkeleton} h-8 w-24 mb-1`} />
                    </div>
                    <Skeleton className={`${styles.loadingSkeleton} h-8 w-8 rounded`} />
                  </div>
                </div>
                <div className={`${styles.loadingItem} ${styles.statItemReceita}`}>
                  <div className={styles.loadingContent}>
                    <div className={styles.loadingInfo}>
                      <Skeleton className={`${styles.loadingSkeleton} h-4 w-20 mb-2`} />
                      <Skeleton className={`${styles.loadingSkeleton} h-8 w-28 mb-1`} />
                      <Skeleton className={`${styles.loadingSkeleton} h-3 w-32`} />
                    </div>
                    <Skeleton className={`${styles.loadingSkeleton} h-8 w-8 rounded`} />
                  </div>
                </div>
              </div>
            ) : (
              // Estado carregado
              receberStats.map((stat, index) => (
                <div 
                  key={index} 
                  className={`${styles.statItem} ${styles.statItemReceita}`}
                  onClick={() => handleCardClick('receber', stat.title.toLowerCase().replace(' ', '_'))}
                >
                  <div className={styles.statContent}>
                    <div className={styles.statInfo}>
                      <p className={styles.statLabel}>{stat.title}</p>
                      <p className={`${styles.statValue} ${styles.statValueReceita}`}>
                        R$ {stat.value}
                      </p>
                      {stat.subtitle && (
                        <p className={styles.statSubtitle}>{stat.subtitle}</p>
                      )}
                    </div>
                    <TrendingUp className={`${styles.statIcon} ${styles.statIconReceita}`} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* A pagar */}
        <Card className={`${styles.card} ${styles.despesaCard}`}>
          <CardHeader className={styles.cardHeader}>
            <CardTitle className={styles.cardTitle}>A pagar</CardTitle>
            <Button 
              size="sm" 
              className={styles.actionButtonDespesa}
              onClick={() => setShowNovaDespesaDrawer(true)}
            >
              <Plus className="h-4 w-4" />
              Nova despesa
            </Button>
          </CardHeader>
          <CardContent className={styles.cardContent}>
            {isLoading ? (
              // Estado de loading com Skeleton
              <div className={styles.loadingContainer}>
                <div className={`${styles.loadingItem} ${styles.statItemDespesa}`}>
                  <div className={styles.loadingContent}>
                    <div className={styles.loadingInfo}>
                      <Skeleton className={`${styles.loadingSkeleton} h-4 w-16 mb-2`} />
                      <Skeleton className={`${styles.loadingSkeleton} h-8 w-24 mb-1`} />
                    </div>
                    <Skeleton className={`${styles.loadingSkeleton} h-8 w-8 rounded`} />
                  </div>
                </div>
                <div className={`${styles.loadingItem} ${styles.statItemDespesa}`}>
                  <div className={styles.loadingContent}>
                    <div className={styles.loadingInfo}>
                      <Skeleton className={`${styles.loadingSkeleton} h-4 w-20 mb-2`} />
                      <Skeleton className={`${styles.loadingSkeleton} h-8 w-28 mb-1`} />
                      <Skeleton className={`${styles.loadingSkeleton} h-3 w-32`} />
                    </div>
                    <Skeleton className={`${styles.loadingSkeleton} h-8 w-8 rounded`} />
                  </div>
                </div>
              </div>
            ) : (
              // Estado carregado
              pagarStats.map((stat, index) => (
                <div 
                  key={index} 
                  className={`${styles.statItem} ${styles.statItemDespesa}`}
                  onClick={() => handleCardClick('pagar', stat.title.toLowerCase().replace(' ', '_'))}
                >
                  <div className={styles.statContent}>
                    <div className={styles.statInfo}>
                      <p className={styles.statLabel}>{stat.title}</p>
                      <p className={`${styles.statValue} ${styles.statValueDespesa}`}>
                        R$ {stat.value}
                      </p>
                      {stat.subtitle && (
                        <p className={styles.statSubtitle}>{stat.subtitle}</p>
                      )}
                    </div>
                    <TrendingDown className={`${styles.statIcon} ${styles.statIconDespesa}`} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section */}
      <div className={styles.bottomGrid}>
        {/* Contas Financeiras */}
        <Card className={styles.contasCard}>
          <CardHeader className={styles.contasHeader}>
            <CardTitle className={styles.cardTitle}>Contas financeiras</CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              className={styles.refreshButton}
              onClick={fetchContasFinanceiras}
              disabled={contasLoading}
            >
              <RefreshCw className={`${styles.refreshIcon} ${contasLoading ? styles.spinning : ''}`} />
              {calculandoContasApi && !contasLoading && (
                <span className={styles.calculatingText}>Calculando...</span>
              )}
            </Button>
          </CardHeader>
          <CardContent className={styles.contasContent}>
            <div className={styles.totalValue}>
              {contasLoading ? (
                <>
                  <Skeleton className={`${styles.loadingSkeleton} h-8 w-32 mx-auto mb-2`} />
                  <Skeleton className={`${styles.loadingSkeleton} h-4 w-20 mx-auto`} />
                </>
              ) : (
                <>
                  <p className={styles.totalValueAmount}>R$ {valorTotalContas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <p className={styles.totalValueLabel}>Valor total</p>
                </>
              )}
            </div>
            
            <div className={styles.cardContent}>
              {contasLoading ? (
                // Estado de loading com Skeleton para contas financeiras
                <div className={styles.loadingContainer}>
                  <div className={styles.contaItem}>
                    <div className={styles.contaContent}>
                      <Skeleton className={`${styles.loadingSkeleton} w-8 h-8 rounded`} />
                      <div className={styles.contaInfo}>
                        <div className={styles.contaHeader}>
                          <div className={styles.contaName}>
                            <Skeleton className={`${styles.loadingSkeleton} h-4 w-32 mb-2`} />
                            <Skeleton className={`${styles.loadingSkeleton} h-4 w-8`} />
                            </div>
                          <Skeleton className={`${styles.loadingSkeleton} h-6 w-20`} />
                          </div>
                        <Skeleton className={`${styles.loadingSkeleton} h-3 w-24 mb-1`} />
                        <Skeleton className={`${styles.loadingSkeleton} h-3 w-20`} />
                        </div>
                      </div>
                    </div>
                  <div className={styles.contaItem}>
                    <div className={styles.contaContent}>
                      <Skeleton className={`${styles.loadingSkeleton} w-8 h-8 rounded`} />
                      <div className={styles.contaInfo}>
                        <div className={styles.contaHeader}>
                          <div className={styles.contaName}>
                            <Skeleton className={`${styles.loadingSkeleton} h-4 w-28 mb-2`} />
                            <Skeleton className={`${styles.loadingSkeleton} h-4 w-8`} />
                  </div>
                          <Skeleton className={`${styles.loadingSkeleton} h-6 w-16`} />
                            </div>
                        <Skeleton className={`${styles.loadingSkeleton} h-3 w-20 mb-1`} />
                        <Skeleton className={`${styles.loadingSkeleton} h-3 w-16`} />
                          </div>
                        </div>
                      </div>
                    </div>
              ) : contasError ? (
                <div className={styles.errorState}>
                  <p className={styles.errorText}>{contasError}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchContasFinanceiras}
                    className={styles.retryButton}
                  >
                    Tentar novamente
                  </Button>
                </div>
              ) : contasFinanceiras.length === 0 ? (
                <div className={styles.emptyState}>
                  <p className={styles.emptyText}>Nenhuma conta financeira encontrada</p>
                  <p className={styles.emptySubtext}>Adicione contas para começar a gerenciar suas finanças</p>
                </div>
              ) : (
                contasFinanceiras.map((conta) => (
                  <div 
                    key={conta.id} 
                    className={styles.contaItem}
                    onClick={() => handleContaClick(conta)}
                  >
                    <div className={styles.contaContent}>
                      {conta.fotoBanco ? (
                        <div className={styles.contaImageContainer}>
                          <Image 
                            src={conta.fotoBanco} 
                            alt={conta.bank}
                            width={32}
                            height={32}
                            className={styles.contaImage}
                          />
                        </div>
                      ) : (
                        <div className={`${styles.contaIcon} ${conta.origem === 'contas-api' ? styles.contaIconApi : styles.contaIconTradicional}`}>
                          {conta.icon}
                        </div>
                      )}
                      <div className={styles.contaInfo}>
                        <div className={styles.contaHeader}>
                          <div>
                            <div className={styles.contaNameContainer}>
                              <p className={styles.contaName}>{conta.bank}</p>
                              {conta.origem === 'contas-api' && (
                                <Badge variant="secondary" className={styles.contaBadge}>
                                  API
                                </Badge>
                              )}
                            </div>
                            <p className={styles.contaType}>{conta.type}</p>
                            {conta.account && (
                              <p className={styles.contaAccount}>{conta.account}</p>
                            )}
                            {conta.lastUpdate && (
                              <p className={styles.contaUpdate}>Atualizado: {conta.lastUpdate}</p>
                            )}
                            {conta.origem === 'contas-api' && (
                              <p className={styles.contaApiNote}>💰 Saldo calculado das transações</p>
                            )}
                          </div>
                          <p className={styles.contaBalance}>{conta.balance}</p>
                        </div>
                        
                        {conta.note && (
                          <div className={styles.contaNote}>
                            <p>{conta.note}</p>
                            {conta.pendingItems && (
                              <Button variant="link" className={styles.contaPendingButton}>
                                {conta.pendingItems} Conciliações pendentes
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <Button 
              variant="outline" 
              className={styles.addAccountButton}
              onClick={() => router.push('/financeiro/outras-contas')}
            >
              <Plus className="h-4 w-4" />
              Adicionar conta
            </Button>
          </CardContent>
        </Card>

        {/* Fluxo de caixa diário */}
        <Card className={styles.fluxoCard}>
          <CardHeader className={styles.contasHeader}>
            <CardTitle className={styles.cardTitle}>Fluxo de caixa diário</CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              className={styles.refreshButton}
              onClick={fetchFluxoCaixaData}
              disabled={fluxoCaixaLoading}
            >
              <RefreshCw className={`h-4 w-4 ${fluxoCaixaLoading ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent className={styles.fluxoContent}>
            {fluxoCaixaLoading ? (
              // Estado de loading com Skeleton para fluxo de caixa
              <div className={styles.chartContainer}>
                <div className={styles.chartBars}>
                  {[1, 2, 3, 4, 5].map((index) => (
                    <div key={index} className={styles.chartBar}>
                      <div className={styles.chartBarContainer}>
                        <Skeleton className={`${styles.loadingSkeleton} w-full`} style={{ height: `${30 + (index * 10)}%` }} />
                        <Skeleton className={`${styles.loadingSkeleton} w-full`} style={{ height: `${20 + (index * 5)}%` }} />
                        <Skeleton className={`${styles.loadingSkeleton} w-full`} style={{ height: `${15 + (index * 3)}%` }} />
                      </div>
                      <Skeleton className={`${styles.loadingSkeleton} h-3 w-8 mt-2`} />
                    </div>
                  ))}
                </div>
                <div className={styles.chartLegend}>
                  <div className={styles.legendItem}>
                    <Skeleton className={`${styles.loadingSkeleton} w-3 h-3 rounded-full`} />
                    <Skeleton className={`${styles.loadingSkeleton} h-3 w-20`} />
                  </div>
                  <div className={styles.legendItem}>
                    <Skeleton className={`${styles.loadingSkeleton} w-3 h-3 rounded-full`} />
                    <Skeleton className={`${styles.loadingSkeleton} h-3 w-20`} />
                  </div>
                  <div className={styles.legendItem}>
                    <Skeleton className={`${styles.loadingSkeleton} w-3 h-3 rounded-full`} />
                    <Skeleton className={`${styles.loadingSkeleton} h-3 w-12`} />
                  </div>
                </div>
              </div>
            ) : fluxoCaixaError ? (
              <div className={styles.chartContainer}>
                <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <p className={styles.errorText}>{fluxoCaixaError}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchFluxoCaixaData}
                      className={styles.retryButton}
                  >
                    Tentar novamente
                  </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.chartContainer}>
                  <div className={styles.chartBars}>
                  {fluxoCaixaData.map((data, index) => {
                    const maxValue = Math.max(
                      ...fluxoCaixaData.map(d => Math.max(d.recebimentos, d.pagamentos, Math.abs(d.saldo)))
                    );
                    const recebimentosHeight = maxValue > 0 ? (data.recebimentos / maxValue) * 100 : 0;
                    const pagamentosHeight = maxValue > 0 ? (data.pagamentos / maxValue) * 100 : 0;
                    const saldoHeight = maxValue > 0 ? (Math.abs(data.saldo) / maxValue) * 100 : 0;

                    return (
                        <div key={index} className={`${styles.chartBar} ${styles.chartBarGroup}`}>
                          <div className={styles.chartBarContainer}>
                          {/* Recebimentos */}
                          <div 
                              className={`${styles.chartBarSegment} ${styles.chartBarRecebimentos}`}
                            style={{ height: `${recebimentosHeight}%` }}
                            title={`Recebimentos: R$ ${data.recebimentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                          ></div>
                          
                          {/* Pagamentos */}
                          <div 
                              className={`${styles.chartBarSegment} ${styles.chartBarPagamentos}`}
                            style={{ height: `${pagamentosHeight}%` }}
                            title={`Pagamentos: R$ ${data.pagamentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                          ></div>
                          
                          {/* Saldo */}
                          <div 
                              className={`${styles.chartBarSegment} ${data.saldo >= 0 ? styles.chartBarSaldoPositivo : styles.chartBarSaldoNegativo}`}
                            style={{ height: `${saldoHeight}%` }}
                            title={`Saldo: R$ ${data.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                          ></div>
                        </div>
                        
                                                 {/* Tooltip detalhado */}
                          <div className={styles.chartTooltip}>
                            <div className={styles.chartTooltipContent}>
                              <div className={styles.chartTooltipHeader}>
                                <p className={styles.chartTooltipTitle}>
                                 {new Date(data.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                               </p>
                             </div>
                              <div className={styles.chartTooltipBody}>
                                <div className={styles.chartTooltipRow}>
                                  <span className={styles.chartTooltipLabel}>Recebimentos:</span>
                                  <span className={styles.chartTooltipValueRecebimentos}>
                                  R$ {data.recebimentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                                <div className={styles.chartTooltipRow}>
                                  <span className={styles.chartTooltipLabel}>Pagamentos:</span>
                                  <span className={styles.chartTooltipValuePagamentos}>
                                  R$ {data.pagamentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                                <div className={`${styles.chartTooltipRow} ${styles.chartTooltipRowBorder}`}>
                                  <span className={styles.chartTooltipLabel}>Saldo:</span>
                                  <span className={`${styles.chartTooltipValue} ${data.saldo >= 0 ? styles.chartTooltipValueSaldoPositivo : styles.chartTooltipValueSaldoNegativo}`}>
                                  R$ {data.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                          <p className={styles.chartLabel}>{data.day}</p>
                      </div>
                    );
                  })}
                </div>
                
                  <div className={styles.chartLegend}>
                    <div className={styles.legendItem}>
                      <div className={`${styles.legendDot} ${styles.legendDotRecebimentos}`}></div>
                      <span className={styles.legendText}>Recebimentos</span>
                  </div>
                    <div className={styles.legendItem}>
                      <div className={`${styles.legendDot} ${styles.legendDotPagamentos}`}></div>
                      <span className={styles.legendText}>Pagamentos</span>
                  </div>
                    <div className={styles.legendItem}>
                      <div className={`${styles.legendDot} ${styles.legendDotSaldo}`}></div>
                      <span className={styles.legendText}>Saldo</span>
                  </div>
                </div>
                
                  <div className={styles.chartActions}>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        {/* Gráfico de vendas */}
        <Card className={styles.fluxoCard}>
          <CardHeader className={styles.contasHeader}>
            <CardTitle className={styles.cardTitle}>Gráfico de vendas</CardTitle>
            <Button variant="ghost" size="sm" className={styles.refreshButton}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className={styles.fluxoContent}>
            <div className={styles.chartContainer}>
              <div className={styles.chartBars}>
              {vendasData.map((data, index) => (
                  <div key={index} className={styles.chartBar}>
                  <div 
                      className={styles.chartBarContainer}
                    style={{ height: `${(data.value / maxVendas) * 200}px` }}
                    >
                      <div className={styles.vendasBarFill}></div>
                    </div>
                    <p className={styles.chartLabel}>
                    {data.month}
                  </p>
                </div>
              ))}
            </div>
            
              <div className={styles.chartLegend}>
                <div className={styles.legendItem}>
              <div className={styles.vendasLegendDot}></div>
              <span className={styles.vendasLegendText}>Faturamento</span>
            </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drawers */}
      <NovaReceitaDrawer
        isOpen={showNovaReceitaDrawer}
        onClose={() => setShowNovaReceitaDrawer(false)}
        onSave={handleNovaReceitaSave}
      />

      <NovaDespesaDrawer
        isOpen={showNovaDespesaDrawer}
        onClose={() => setShowNovaDespesaDrawer(false)}
        onSave={handleNovaDespesaSave}
      />

    </div>
    </>
  );
}

