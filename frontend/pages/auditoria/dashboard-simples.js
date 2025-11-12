import React, { useState, useEffect, useCallback } from 'react';
import styles from '../../styles/auditoria/dashboard-simples.module.css';
import { useRouter } from 'next/router';
import PrincipalSidebar from '../../components/onety/principal/PrincipalSidebar';
import { 
  Building2, 
  FileText, 
  BarChart3, 
  Calculator, 
  Upload, 
  AlertCircle,
  MoreVertical,
  Eye,
  Trash2,
  Search
} from 'lucide-react';

// Função para formatar CNPJ
const formatCNPJ = (cnpj) => {
  if (!cnpj) return '';
  const cleanCnpj = cnpj.replace(/\D/g, '');
  return cleanCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
};

// Função para obter regime tributário formatado
const getRegimeTributario = (cliente) => {
  // Busque em vários possíveis caminhos
  const regime = cliente.regime_tributario
    || (cliente.clientes && cliente.clientes.regime_tributario)
    || '';
  // Para debug, visualizar o objeto e valor que está vindo:
  // Remova depois de confirmar!
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.log('Regime tributário para cliente:', cliente, 'Encontrado:', regime);
  }
  const valor = (regime || '').toLowerCase().replace(/\s/g, '_');
  if (valor === 'simples_nacional' || valor === 'simplesnacional') return 'Simples Nacional';
  if (valor === 'regime_normal' || valor === 'normal' || valor === 'regimenormal') return 'Regime Normal';
  if (valor === 'lucro_presumido' || valor === 'lucropresumido') return 'Lucro Presumido';
  if (valor === 'lucro_real' || valor === 'lucrereal') return 'Lucro Real';
  if (valor === 'mei') return 'MEI';
  if (valor === 'atividade_rural') return 'Atividade Rural';
  return 'Não informado';
};

// Função segura para obter nome do cliente
const getClienteNome = (cliente) =>
  cliente.nome ||
  cliente.nome_empresa ||
  (cliente.clientes && cliente.clientes.nome) ||
  '';

const DashboardSimples = () => {
  const [clientes, setClientes] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(null);
  const [deletingCliente, setDeletingCliente] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const router = useRouter();
  
  // Buscar dados da empresa de userData diretamente do localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('userData');
      if (!raw) {
        setSelectedCompany(null);
        return;
      }
      const parsed = JSON.parse(raw);
      const id = parsed?.EmpresaId || parsed?.empresa?.id;
      const name = parsed?.EmpresaNome || parsed?.empresa?.nome;
      if (id && name) {
        setSelectedCompany({ id, name });
      } else {
        setSelectedCompany(null);
      }
    } catch {
      setSelectedCompany(null);
    }
  }, []);

  const loadSimplesNacionalClientes = useCallback(async () => {
    if (!selectedCompany) return;
    try {
      setLoading(true);
      setError(null);
      // Busca no endpoint correto de Simples Nacional:
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auditoria/simples-nacional?company_id=${selectedCompany.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const response = await res.json();
      if (!res.ok || response.error) {
        setError(response.error || 'Erro ao buscar dados');
        setClientes([]);
        return;
      }
      const clientesData = response.data?.data || response.data || [];
      setClientes(clientesData);
      // Calcular estatísticas básicas
      const totalClientes = clientesData.length;
      // Agrupar clientes por mês de criação
      const clientesPorMes = clientesData.reduce((acc, cliente) => {
        const date = new Date(cliente.created_at);
        const mes = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
        const existing = acc.find(item => item.mes === mes);
        if (existing) {
          existing.quantidade++;
        } else {
          acc.push({ mes, quantidade: 1 });
        }
        return acc;
      }, []);
      setStats({
        totalClientes,
        totalReceita: 0,
        totalImpostos: 0,
        clientesPorMes: clientesPorMes.slice(0, 6)
      });
    } catch (err) {
      console.error('Erro ao carregar clientes do Simples Nacional:', err);
      setError('Erro ao carregar dados do Simples Nacional');
    } finally {
      setLoading(false);
    }
  }, [selectedCompany]);

  useEffect(() => {
    if (selectedCompany) {
      loadSimplesNacionalClientes();
    }
  }, [selectedCompany, loadSimplesNacionalClientes]);

  const handleDeleteCliente = async (clienteId, clienteNome) => {
    if (typeof window === 'undefined') return;
    if (!window.confirm(`Tem certeza que deseja excluir a empresa "${clienteNome}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    try {
      setDeletingCliente(clienteId);
      setDropdownOpen(null);
      // Supondo endpoint
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/clientes/${clienteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const response = await res.json();
      if (!res.ok || response.error) {
        alert(`Erro ao excluir empresa: ${response.error || 'Erro desconhecido.'}`);
        return;
      }
      setClientes(prevClientes => prevClientes.filter(cliente => cliente.id !== clienteId));
      await loadSimplesNacionalClientes();
      alert('Empresa excluída com sucesso!');
    } catch (err) {
      console.error('Erro ao excluir empresa:', err);
      alert('Erro ao excluir empresa. Tente novamente.');
    } finally {
      setDeletingCliente(null);
    }
  };

  const toggleDropdown = (clienteId) => {
    setDropdownOpen(dropdownOpen === clienteId ? null : clienteId);
  };

  // Filtrar clientes baseado no termo de busca
  const filteredClientes = clientes.filter(cliente =>
    (cliente.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cliente.cnpj_exibicao || cliente.cnpj || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cliente.regime_tributario || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = () => setDropdownOpen(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  if (!selectedCompany) {
    return (
      <div className={styles.fallbackWrapper}>
        <div className={styles.fallbackInner}>
          <div className={styles.spinner}></div>
          <p className={styles.fallbackText}>Redirecionando...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <>
        <PrincipalSidebar />
        <div className={styles.loadingPage}>
          <div className={styles.loadingContent}>
            <div className={styles.skeletonLayout}>
              <div className={styles.skeletonBar}></div>
              <div className={`${styles.skeletonGrid} ${styles.skeletonGridColumns4}`}>
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={styles.skeletonCard}></div>
                ))}
              </div>
              <div className={`${styles.skeletonGrid} ${styles.skeletonGridColumns2}`}>
                {[...Array(2)].map((_, i) => (
                  <div key={i} className={styles.skeletonTallCard}></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PrincipalSidebar />
        <div className={styles.fallbackWrapper}>
          <div className={styles.errorCard}>
            <AlertCircle className={styles.errorIcon} />
            <h2 className={styles.errorTitle}>Erro ao Carregar</h2>
            <p className={styles.errorMessage}>{error}</p>
            <button
              onClick={loadSimplesNacionalClientes}
              className={`${styles.actionButton} ${styles.actionButtonBlue}`}
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!stats) {
    return (
      <>
        <PrincipalSidebar />
        <div className={styles.fallbackWrapper}>
          <div className={styles.emptyState}>
            <FileText className={styles.emptyIcon} />
            <h3 className={styles.sectionTitle}>
              Nenhum dado disponível
            </h3>
            <p className={styles.emptyHint}>
              Não há dados do Simples Nacional para exibir.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PrincipalSidebar />
      <div className={styles.pageWrapper}>
        {/* Removido o headerBar */}
        <div className={styles.mainContent}>
          {/* Ações Rápidas */}
          <div className={styles.actionsCard}>
            <h2 className={styles.actionsTitle}>Ações Rápidas</h2>
            <div className={styles.actionsGrid}>
              <button
                onClick={() => router.push('/auditoria/rct-sn')}
                className={`${styles.actionButton} ${styles.actionButtonGreen}`}
              >
                <Upload className={styles.actionIcon} />
                <span>Importar Extratos</span>
              </button>
              <button
                onClick={() => router.push('/auditoria/leitor-xml')}
                className={`${styles.actionButton} ${styles.actionButtonPurple}`}
              >
                <Upload className={styles.actionIcon} />
                <span>Importar Notas Fiscais</span>
              </button>
              <button
                onClick={() => router.push('/chatbot')}
                className={`${styles.actionButton} ${styles.actionButtonBlue}`}
              >
                <BarChart3 className={styles.actionIcon} />
                <span>Planejamento Tributário</span>
              </button>
            </div>
          </div>
          {/* Listagem de Empresas */}
          <div className={styles.sectionWrapper}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <Building2 className={styles.sectionTitleIcon} />
                Clientes do Simples Nacional
              </h2>
              {/* Searchbar */}
              <div className={styles.searchGroup}>
                <div className={styles.searchIconWrapper}>
                  <Search className={styles.searchIcon} />
                </div>
                <input
                  type="text"
                  placeholder="Buscar por nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.tableHeaderCell}>Nome</th>
                    <th className={styles.tableHeaderCell}>CNPJ</th>
                    <th className={styles.tableHeaderCell}>Regime Tributário</th>
                    <th className={styles.tableHeaderCell}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClientes.length > 0 ? (
                    filteredClientes.map((analysis) => (
                      <tr key={analysis.id} className={styles.tableRow}>
                        <td className={styles.tableCell}>
                          {analysis.nome || "Nome não encontrado"}
                          {analysis.tipo_cadastro === "pre_cliente" && (
                            <span className={styles.badge}>Pré-Cliente</span>
                          )}
                        </td>
                        <td className={styles.tableCell}>
                          {analysis.cnpj_exibicao ? formatCNPJ(analysis.cnpj_exibicao) : formatCNPJ(analysis.cnpj) || 'N/A'}
                        </td>
                        <td className={styles.tableCell}>
                          {getRegimeTributario(analysis)}
                        </td>
                        <td className={`${styles.tableCell} ${styles.tableCellActions}`}>
                          <div className={styles.dropdownContainer}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleDropdown(analysis.id);
                              }}
                              className={styles.dropdownButton}
                              disabled={deletingCliente === analysis.id}
                            >
                              {deletingCliente === analysis.id ? (
                                <div className={styles.dropdownSpinner}></div>
                              ) : (
                                <MoreVertical className={styles.dropdownIcon} />
                              )}
                            </button>
                            {dropdownOpen === analysis.id && (
                              <div className={styles.dropdownMenu}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDropdownOpen(null);
                                    localStorage.setItem('selected_client_id', analysis.id);
                                    localStorage.setItem('selected_client_name', analysis.nome || 'Sem nome');
                                    localStorage.setItem('selected_client_cnpj', analysis.cnpj_exibicao || analysis.cnpj || '');
                                    router.push('/consolidado-simples');
                                  }}
                                  className={styles.dropdownItem}
                                >
                                  <Eye className={styles.dropdownIcon} />
                                  Ver Análises
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCliente(analysis.id, analysis.nome || 'Sem nome');
                                  }}
                                  className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                                >
                                  <Trash2 className={styles.dropdownIcon} />
                                  Excluir Empresa
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className={styles.emptyStateCell}>
                        {searchTerm ? (
                          <div className={styles.emptyState}>
                            <Search className={styles.emptyIcon} />
                            <p>Nenhum cliente encontrado para "{searchTerm}"</p>
                            <p className={styles.emptyHint}>Tente ajustar o termo de busca</p>
                          </div>
                        ) : (
                          <div className={styles.emptyState}>
                            <Building2 className={styles.emptyIcon} />
                            <p>Nenhum cliente cadastrado</p>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DashboardSimples;

