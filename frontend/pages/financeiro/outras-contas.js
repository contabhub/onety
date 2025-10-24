"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import styles from '../../styles/financeiro/outras-contas.module.css';
import { Card, CardContent } from '../../components/financeiro/card';
import { Button } from '../../components/financeiro/botao';
import { Input } from '../../components/financeiro/input';
import { Badge } from '../../components/financeiro/badge';
import { Plus, Search, Settings, Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import { NovaContaFinanceiraModal } from '../../components/financeiro/NovaContaFinanceiraModal';
import { ModalConfirmarExclusaoConta } from '../../components/financeiro/ModalConfirmarExclusaoConta';
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import PrincipalSidebar from '../../components/onety/principal/PrincipalSidebar';

/**
 * @typedef {Object} ContaFinanceira
 * @property {string} id
 * @property {string} nome
 * @property {string} banco
 * @property {string} tipo
 * @property {string} statusCobranca
 * @property {string} integracao
 * @property {string} icon
 * @property {string} iconColor
 * @property {string} origem
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // Função para transformar contas tradicionais
  /**
   * @param {any} conta
   * @returns {ContaFinanceira}
   */
  function transformarContaTradicional(conta) {
    return {
      id: String(conta.id),
      nome:
        conta.descricao_banco ||
        `${conta.tipo} - ${conta.banco}` ||
        "Conta sem descrição",
      banco: conta.banco || "-",
      tipo: conta.tipo || "-",
      statusCobranca: "Não",
      integracao: "Não configurada",
      icon: conta.banco?.charAt(0).toUpperCase() || "",
      iconColor: "outras-contas-account-icon",
      origem: "contas",
    };
  }

// Função para transformar contas-api (Pluggy)
/**
 * @param {any} conta
 * @param {any[]} todasContas
 * @returns {ContaFinanceira}
 */
function transformarContaApi(conta, todasContas) {
  console.log('🔄 Transformando conta:', conta);
  
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
  
    return {
      id: String(conta.account),
      nome: nomeConta,
      banco: bancoConta,
      tipo: conta.tipo || conta.tipo_conta || "-",
      statusCobranca: conta.numero_conta || "Não",
      integracao: "Automática",
      icon: (bancoConta || "O").charAt(0).toUpperCase(),
      iconColor: "outras-contas-account-icon",
      origem: "contas-api",
    };
}

export default function OutrasContasPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [isNovaContaOpen, setIsNovaContaOpen] = useState(false);
  const [contasFinanceiras, setContasFinanceiras] = useState([]);
  const [contaSelecionada, setContaSelecionada] = useState(null);
  const [isModalExcluirOpen, setIsModalExcluirOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, sucessos: 0, falhas: 0 });
  const [syncExecuted, setSyncExecuted] = useState(false);

  // Função para sincronizar transações Pluggy com retry (versão manual com toast)
  const syncTransacoesPluggy = async () => {
    // Evitar múltiplas execuções simultâneas
    if (syncing) {
      console.log("🔄 Sincronização já em andamento, ignorando nova chamada");
      return;
    }

    const userData = JSON.parse(localStorage.getItem("userData") || "{}");
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
        console.log(`🔍 Contas Pluggy da empresa:`, contasDaEmpresa.map(c => ({ 
          account: c.account, 
          company_id: c.company_id, 
          item_id: c.item_id,
          banco: c.banco 
        })));

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
            console.log(`📋 Dados da conta:`, { account: conta.account, item_id: conta.item_id, company_id: conta.company_id });
            
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
                console.log(`📤 Enviando requisição (tentativa ${tentativas}):`, requestBody);
                
                const syncResponse = await fetch(`${API_URL}/transacoes-api/sync`, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(requestBody),
                });

                console.log(`📥 Resposta da API (tentativa ${tentativas}):`, syncResponse.status, syncResponse.statusText);

                if (syncResponse.ok) {
                  const syncResult = await syncResponse.json();
                  console.log(`✅ Transações da conta ${conta.account} sincronizadas:`, syncResult);
                  sucesso = true;
                  return { sucesso: true, conta: conta.account };
                } else {
                  const errorData = await syncResponse.json().catch(() => ({}));
                  console.error(`❌ Erro ao sincronizar transações da conta ${conta.account} (tentativa ${tentativas}/${maxTentativas}):`, syncResponse.status, errorData);
                  
                  // Aguardar um pouco antes de tentar novamente
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

  // Função para sincronizar transações Pluggy silenciosamente (versão automática sem toast)
  const syncTransacoesPluggySilencioso = useCallback(async () => {
    // Evitar múltiplas execuções simultâneas
    if (syncing) {
      console.log("🔄 Sincronização já em andamento, ignorando nova chamada");
      return;
    }

    const userData = JSON.parse(localStorage.getItem("userData") || "{}");
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
  }, [syncing]);






  // Função para buscar contas (reutilizável)
  const fetchContas = useCallback(async () => {
    const userData = JSON.parse(localStorage.getItem("userData") || "{}");
    const empresaId = userData.EmpresaId;
    const token = localStorage.getItem("token");

    if (!empresaId || !token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Buscar contas da empresa
      const resContas = await fetch(`${API_URL}/contas-api/company/${empresaId}/contas`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      let contasTradicionais = [];
      let contasApi = [];

      // Trata resposta das contas
      if (resContas.ok) {
        const dataContas = await resContas.json();
        console.log('📋 Dados recebidos da API contas-api:', dataContas);
        
        const todasContas = dataContas.contas || [];
        
        // Separar contas tradicionais (sem account) e contas-api (com account)
        const contasSemAccount = todasContas.filter(conta => !conta.account);
        const contasComAccount = todasContas.filter(conta => conta.account && conta.account.toString().trim() !== "");
        
        console.log(`🔍 Contas tradicionais: ${contasSemAccount.length}`);
        console.log(`🔍 Contas com account válido: ${contasComAccount.length}`);
        
        // Transformar contas tradicionais
        contasTradicionais = contasSemAccount.map(transformarContaTradicional);
        
        // Transformar contas-api passando todas as contas como parâmetro
        contasApi = contasComAccount.map(conta => transformarContaApi(conta, todasContas));
      } else {
        console.error("Erro ao buscar contas:", resContas.status);
      }

      // Une as duas listas
      setContasFinanceiras([...contasTradicionais, ...contasApi]);
    } catch (error) {
      console.error("Erro ao buscar contas:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Função para atualizar a lista de contas após criação
  const handleContaCriada = () => {
    console.log("🔄 Atualizando lista de contas após criação...");
    // Aguarda um pouco para a API processar e depois busca as contas novamente
    setTimeout(() => {
      fetchContas();
    }, 1500); // 1.5 segundos de delay
  };

  useEffect(() => {
    fetchContas();
  }, [fetchContas]);

  // Sincronização automática silenciosa - executa apenas uma vez após carregar as contas
  useEffect(() => {
    if (contasFinanceiras.length > 0 && !syncing && !syncExecuted) {
      setSyncExecuted(true);
      // Aguarda um pouco para evitar conflitos
      const timer = setTimeout(() => {
        syncTransacoesPluggySilencioso();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [contasFinanceiras.length, syncing, syncExecuted, syncTransacoesPluggySilencioso]); // Só executa quando necessário

  const filteredContas = useMemo(() => {
    return contasFinanceiras.filter((conta) => {
      const termo = searchTerm.toLowerCase();
      return (
        (conta.nome || "").toLowerCase().includes(termo) ||
        (conta.banco || "").toLowerCase().includes(termo) ||
        (conta.tipo || "").toLowerCase().includes(termo)
      );
    });
  }, [contasFinanceiras, searchTerm]);


  const getIntegracaoBadge = (integracao, origem) => {
    // Se a conta é de origem "contas-api", sempre retorna "OpenFinance"
    if (origem === "contas-api") {
      return (
        <Badge className="outras-contas-badge-openfinance">
          OpenFinance
        </Badge>
      );
    }

    // Para contas tradicionais, mantém a lógica original
    switch (integracao) {
      case "Automática":
        return (
          <Badge className="outras-contas-badge-automatica">
            Automática
          </Badge>
        );
      case "Manual":
        return (
          <Badge className="outras-contas-badge-manual">
            -
          </Badge>
        );
      case "Não configurada":
        return (
          <Badge className="outras-contas-badge-nao-configurada">
            Não configurada
          </Badge>
        );
      default:
        return (
          <Badge className="outras-contas-badge-manual">
            {integracao}
          </Badge>
        );
    }
  };

  const removerContaDaLista = (id) => {
    setContasFinanceiras((prev) => prev.filter((conta) => conta.id !== id));
  };

  // Componente de Loading...
  const LoadingState = () => (
    <div className={styles.outrasContasLoadingContainer}>
      <div className={styles.outrasContasLoadingSpinner}></div>
      <p className={styles.outrasContasLoadingText}>Carregando contas financeiras...</p>
    </div>
  );

  return (
    <>
      <PrincipalSidebar />
      <div className={styles.outrasContasBg}>
        {/* Header */}
        <div className={styles.outrasContasHeader}>
        <div className={styles.outrasContasHeaderLeft}>
          <div>
            <h1 className={styles.outrasContasHeaderTitle}>Contas financeiras</h1>
            <p className={styles.outrasContasHeaderSubtitle}>
              Gerencie suas contas bancárias e meios de pagamento
            </p>
          </div>
        </div>
        <div className={styles.outrasContasHeaderRight}>
          {syncing && (
            <div className={styles.outrasContasSyncIndicator}>
              <div className={styles.outrasContasSyncSpinner}></div>
              <span className={styles.outrasContasSyncText}>
                Sincronizando transações... ({syncProgress.current}/{syncProgress.total})
              </span>
              {syncProgress.sucessos > 0 && (
                <span className={styles.outrasContasSyncSuccess}>
                  ✅ {syncProgress.sucessos}
                </span>
              )}
              {syncProgress.falhas > 0 && (
                <span className={styles.outrasContasSyncError}>
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
            className={styles.outrasContasSyncBtn}
          >
            <Settings className={styles.outrasContasIcon} />
            {syncing ? "Sincronizando..." : "Sincronizar transações"}
          </Button>
          <Button
            size="sm"
            className={styles.outrasContasPrimaryBtn}
            onClick={() => setIsNovaContaOpen(true)}
          >
            <Plus className={styles.outrasContasIcon} />
            Nova conta financeira
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className={styles.outrasContasSearchCard}>
        <CardContent className={styles.outrasContasSearchContent}>
          <div className={styles.outrasContasSearchContainer}>
            <Search className={styles.outrasContasSearchIcon} />
            <Input
              placeholder="Descrição, Nome da conta..."
              className={styles.outrasContasSearchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className={styles.outrasContasTableCard}>
        <CardContent className={styles.outrasContasTableContent}>
          {loading ? (
            <LoadingState />
          ) : (
            <div className={styles.outrasContasTableWrapper}>
              <table className={styles.outrasContasTable}>
                <thead>
                  <tr className={styles.outrasContasTableBorder}>
                    <th className={styles.outrasContasTableHeader}>
                      Nome da conta
                    </th>
                    <th className={styles.outrasContasTableHeader}>
                      Banco
                    </th>
                    <th className={styles.outrasContasTableHeader}>
                      Tipo de conta
                    </th>
                    <th className={styles.outrasContasTableHeader}>
                      Status cobrança
                    </th>
                    <th className={styles.outrasContasTableHeader}>
                      Integração
                    </th>
                    <th className={styles.outrasContasTableHeader}>
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContas.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className={styles.outrasContasEmptyText}
                      >
                        Nenhuma conta encontrada.
                      </td>
                    </tr>
                  ) : (
                    filteredContas.map((conta) => (
                      <tr
                        key={conta.id}
                        className={styles.outrasContasTableRow}
                        onClick={() =>
                          router.push(
                            `/financeiro/outras-contas/${conta.id}/transferencia`
                          )
                        }
                      >
                        <td className={styles.outrasContasTableCell}>
                          <div className={styles.outrasContasAccountInfo}>
                            <div className={styles.outrasContasAccountIcon}>
                              {conta.icon.charAt(0)}
                            </div>
                            <span className={styles.outrasContasTableCellPrimary}>
                              {conta.nome}
                            </span>
                          </div>
                        </td>
                        <td className={`${styles.outrasContasTableCell} ${styles.outrasContasTableCellSecondary}`}>
                          {conta.banco}
                        </td>
                        <td className={`${styles.outrasContasTableCell} ${styles.outrasContasTableCellSecondary}`}>
                          {conta.tipo}
                        </td>
                        <td className={`${styles.outrasContasTableCell} ${styles.outrasContasTableCellSecondary}`}>
                          {conta.statusCobranca}
                        </td>
                        <td className={styles.outrasContasTableCell}>
                          {getIntegracaoBadge(conta.integracao, conta.origem)}
                        </td>
                        <td className={styles.outrasContasTableCell}>
                          <div className={styles.outrasContasActionButtons}>
                            <Link
                              href={`/financeiro/outras-contas/${conta.id}/editar`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="outline"
                                size="sm"
                                className={styles.outrasContasActionBtnEdit}
                              >
                                <Edit className={styles.outrasContasActionIcon} />
                                Editar
                              </Button>
                            </Link>
                            <Button
                              variant="outline"
                              size="sm"
                              className={styles.outrasContasActionBtnDelete}
                              onClick={(e) => {
                                e.stopPropagation();
                                setContaSelecionada(conta);
                                setIsModalExcluirOpen(true);
                              }}
                            >
                              <Trash2 className={styles.outrasContasActionIcon} />
                              Excluir
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nova Conta Financeira Modal */}
      <NovaContaFinanceiraModal
        isOpen={isNovaContaOpen}
        onClose={() => setIsNovaContaOpen(false)}
        onSuccess={handleContaCriada}
      />

      {contaSelecionada && (
        <ModalConfirmarExclusaoConta
          isOpen={isModalExcluirOpen}
          onClose={() => setIsModalExcluirOpen(false)}
          onConfirm={() => removerContaDaLista(contaSelecionada.id)}
          itemName={contaSelecionada.nome}
          itemType="pagar"
        />
      )}
      </div>
    </>
  );
}
