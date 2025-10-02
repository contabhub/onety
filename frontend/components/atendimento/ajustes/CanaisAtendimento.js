import { useState, useEffect, useRef } from 'react';
import styles from './CanaisAtendimento.module.css';
import { MessageCircle, Plus, ChevronDown, X, RefreshCw, Trash } from 'lucide-react';

export default function CanaisAtendimento() {
  const [instancias, setInstancias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [qrCodeImage, setQrCodeImage] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [instanceName, setInstanceName] = useState('');
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const dropdownRef = useRef(null);
  const qrIntervalRef = useRef(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [instanceToDelete, setInstanceToDelete] = useState(null);
  const [deletingInstance, setDeletingInstance] = useState(false);
  const statusIntervalRef = useRef(null);

  // Verificar se os dados necessários estão disponíveis
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const companyId = userData.companyId;
    setUserRole(userData.userRole || null);
    
    if (!token) {
      setError('Token de autenticação não encontrado. Faça login novamente.');
      setLoading(false);
      return;
    }
    
    if (!companyId) {
      setError('ID da empresa não encontrado. Faça login novamente.');
      setLoading(false);
      return;
    }
    
    // Carregar instâncias do WhatsApp
    fetchInstancias();
  }, []);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Cleanup do intervalo de QR
  useEffect(() => {
    return () => {
      if (qrIntervalRef.current) {
        clearInterval(qrIntervalRef.current);
      }
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
    };
  }, []);

  // Polling periódico de status das instâncias
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return;

    // Limpa intervalo anterior se existir
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
    }

    // Cria novo intervalo
    statusIntervalRef.current = setInterval(async () => {
      try {
        const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
        // Atualiza status no backend conforme provedor
        await Promise.all(
          (instancias || []).map((inst) => {
            if (inst.integration_type === 'evolution' && inst.instance_name) {
              return fetch(`${apiUrl}/instances/evolution/status/${inst.instance_name}`, { headers }).catch(() => {});
            }
            if (inst.integration_type === 'zapi' && inst.id) {
              return fetch(`${apiUrl}/instances/${inst.id}/status`, { headers }).catch(() => {});
            }
            return Promise.resolve();
          })
        );
        // Recarrega lista para refletir status atual
        fetchInstancias();
      } catch (e) {
        // silencioso para não poluir UI
      }
    }, 60000); // a cada 60s

    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
    };
  }, [instancias.length]);

  const fetchInstancias = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Buscar companyId do localStorage
      const companyId = JSON.parse(localStorage.getItem('userData') || '{}').companyId;
      if (!companyId) {
        throw new Error('ID da empresa não encontrado. Faça login novamente.');
      }
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('URL da API não configurada.');
      }
      
      const response = await fetch(`${apiUrl}/instances/company/${companyId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar instâncias do WhatsApp');
      }

      const data = await response.json();
      setInstancias(data);
    } catch (err) {
      console.error('Erro ao buscar instâncias:', err);
      setError('Erro ao carregar instâncias. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'conectado':
        return '#22c55e'; // Verde
      case 'desconectado':
        return '#ef4444'; // Vermelho
      default:
        return '#6b7280'; // Cinza
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'conectado':
        return 'Conectado';
      case 'desconectado':
        return 'Desconectado';
      default:
        return status;
    }
  };

  const getIntegrationType = (type) => {
    switch (type) {
      case 'zapi':
        return 'Z-API';
      case 'evolution':
        return 'Evolution';
      default:
        return type;
    }
  };

  // Criar nova instância Evolution
  const createEvolutionInstance = async () => {
    if (!instanceName.trim()) {
      setError('Nome da instância é obrigatório');
      return;
    }

    try {
      setCreatingInstance(true);
      setError(null);
      
      const companyId = JSON.parse(localStorage.getItem('userData') || '{}').companyId;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      const response = await fetch(`${apiUrl}/instances/evolution/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          company_id: companyId,
          instanceName: instanceName.trim(),
          integration: 'WHATSAPP-BAILEYS',
          integration_type: 'evolution'
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao criar instância');
      }

      const data = await response.json();
      console.log('Instância criada:', data);
      
      // Chamar rota para configurar/reaplicar webhook (não bloqueante para UX)
      try {
        fetch(`${apiUrl}/instances/evolution/webhook/${instanceName.trim()}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }).catch(() => {});
      } catch (_) {}

      // Aguardar um pouco e buscar QR code
      setTimeout(() => {
        fetchQrCode(instanceName.trim());
      }, 2000);
      
    } catch (err) {
      console.error('Erro ao criar instância:', err);
      setError('Erro ao criar instância. Tente novamente.');
    } finally {
      setCreatingInstance(false);
    }
  };

  // Buscar QR Code
  const fetchQrCode = async (name) => {
    try {
      setQrLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      const response = await fetch(`${apiUrl}/instances/evolution/qrcode/${name}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        setQrCodeImage(imageUrl);
        
        // Configurar atualização automática do QR
        if (qrIntervalRef.current) {
          clearInterval(qrIntervalRef.current);
        }
        
        qrIntervalRef.current = setInterval(() => {
          fetchQrCode(name);
          checkConnectionStatus(name);
        }, 10000); // Atualizar a cada 10 segundos
        
        // Verificar status imediatamente
        setTimeout(() => checkConnectionStatus(name), 2000);
        
      } else if (response.status === 404) {
        // QR ainda não disponível na Evolution. Tentar novamente sem exibir erro.
        if (qrIntervalRef.current) {
          clearInterval(qrIntervalRef.current);
        }
        qrIntervalRef.current = setInterval(() => {
          fetchQrCode(name);
          checkConnectionStatus(name);
        }, 5000);
        // Evitar mostrar erro ao usuário para 404 transitório
        return;
      } else {
        throw new Error('Erro ao buscar QR Code');
      }
    } catch (err) {
      console.error('Erro ao buscar QR:', err);
      setError('Erro ao gerar QR Code. Tente novamente.');
    } finally {
      setQrLoading(false);
    }
  };

  // Verificar status da conexão
  const checkConnectionStatus = async (name) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      const response = await fetch(`${apiUrl}/instances/evolution/status/${name}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.connection_state === 'conectado') {
          // Parar atualização do QR e fechar modal
          if (qrIntervalRef.current) {
            clearInterval(qrIntervalRef.current);
          }
          setShowQrModal(false);
          setQrCodeImage(null);
          setInstanceName('');
          // Recarregar instâncias
          fetchInstancias();
        }
      }
    } catch (err) {
      console.error('Erro ao verificar status:', err);
    }
  };

  // Fechar modal QR
  const closeQrModal = () => {
    if (qrIntervalRef.current) {
      clearInterval(qrIntervalRef.current);
    }
    setShowQrModal(false);
    setQrCodeImage(null);
    setInstanceName('');
    setSelectedProvider(null);
    setShowDropdown(false);
  };

  // Selecionar provedor
  const selectProvider = (provider) => {
    setSelectedProvider(provider);
    setShowDropdown(false);
    setShowQrModal(true);
  };

  // Desconectar instância
  const handleDisconnect = async (instancia) => {
    try {
      setError(null);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      if (instancia.integration_type === 'evolution') {
        const response = await fetch(`${apiUrl}/instances/evolution/disconnect/${instancia.instance_name}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (!response.ok) {
          throw new Error('Erro ao desconectar instância');
        }
      } else if (instancia.integration_type === 'zapi') {
        const response = await fetch(`${apiUrl}/instances/${instancia.id}/disconnect`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (!response.ok) {
          throw new Error('Erro ao desconectar instância');
        }
      }

      // Recarregar instâncias
      fetchInstancias();
    } catch (err) {
      console.error('Erro ao desconectar:', err);
      setError('Erro ao desconectar instância. Tente novamente.');
    }
  };

  // Reconectar instância
  const handleReconnect = async (instancia) => {
    try {
      setError(null);
      setInstanceName(instancia.instance_name);
      setSelectedProvider(instancia.integration_type);
      
      if (instancia.integration_type === 'evolution') {
        setShowQrModal(true);
        // Aguardar um pouco e buscar QR code
        setTimeout(() => {
          fetchQrCode(instancia.instance_name);
        }, 1000);
      } else if (instancia.integration_type === 'zapi') {
        setShowQrModal(true);
        // Para Z-API, usar a rota específica
        setTimeout(() => {
          fetchZapiQrCode(instancia.id);
        }, 1000);
      }
      
    } catch (err) {
      console.error('Erro ao reconectar:', err);
      setError('Erro ao iniciar reconexão. Tente novamente.');
    }
  };

  // Deletar instância (abrir modal)
  const handleDelete = (instancia) => {
    setInstanceToDelete(instancia);
    setShowDeleteModal(true);
  };

  // Confirmar exclusão
  const confirmDeleteInstance = async () => {
    if (!instanceToDelete) return;
    try {
      setDeletingInstance(true);
      setError(null);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      let response;
      if (instanceToDelete.integration_type === 'evolution') {
        response = await fetch(`${apiUrl}/instances/evolution/delete/${instanceToDelete.instance_name}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
      } else {
        response = await fetch(`${apiUrl}/instances/${instanceToDelete.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
      }

      if (!response.ok) {
        throw new Error('Erro ao deletar instância');
      }

      if (qrIntervalRef.current) {
        clearInterval(qrIntervalRef.current);
      }
      setShowQrModal(false);
      setQrCodeImage(null);
      setShowDeleteModal(false);
      setInstanceToDelete(null);

      // Recarregar instâncias
      fetchInstancias();
    } catch (err) {
      console.error('Erro ao deletar instância:', err);
      setError('Erro ao deletar instância. Tente novamente.');
    } finally {
      setDeletingInstance(false);
    }
  };

  const closeDeleteModal = () => {
    if (deletingInstance) return;
    setShowDeleteModal(false);
    setInstanceToDelete(null);
  };

  // Buscar QR Code Z-API
  const fetchZapiQrCode = async (instanceId) => {
    try {
      setQrLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      const response = await fetch(`${apiUrl}/instances/${instanceId}/qr-code`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        setQrCodeImage(imageUrl);
        
        // Configurar atualização automática do QR
        if (qrIntervalRef.current) {
          clearInterval(qrIntervalRef.current);
        }
        
        qrIntervalRef.current = setInterval(() => {
          fetchZapiQrCode(instanceId);
          checkZapiConnectionStatus(instanceId);
        }, 10000);
        
        setTimeout(() => checkZapiConnectionStatus(instanceId), 2000);
        
      } else {
        throw new Error('Erro ao buscar QR Code');
      }
    } catch (err) {
      console.error('Erro ao buscar QR Z-API:', err);
      setError('Erro ao gerar QR Code. Tente novamente.');
    } finally {
      setQrLoading(false);
    }
  };

  // Verificar status Z-API
  const checkZapiConnectionStatus = async (instanceId) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      const response = await fetch(`${apiUrl}/instances/${instanceId}/status`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'conectado') {
          if (qrIntervalRef.current) {
            clearInterval(qrIntervalRef.current);
          }
          setShowQrModal(false);
          setQrCodeImage(null);
          setInstanceName('');
          fetchInstancias();
        }
      }
    } catch (err) {
      console.error('Erro ao verificar status Z-API:', err);
    }
  };

  const renderInstanciaCard = (instancia) => (
    <div key={instancia.id} className={styles.instanciaCard}>
      {/* Top section */}
      <div className={styles.cardTop}>
        <div className={styles.whatsappHeader}>
          <div className={styles.whatsappIcon}>
            <MessageCircle size={20} />
          </div>
          <div className={styles.instanceInfo}>
            <span className={styles.whatsappText}>WhatsApp</span>
            <span className={styles.instanceName}>{instancia.instance_name}</span>
          </div>
        </div>
        
        <div className={styles.providerInfo}>
          <span className={styles.providerText}>
            Provedor: {getIntegrationType(instancia.integration_type)}
          </span>
        </div>
        
        <button 
          className={`${styles.statusButton} ${styles[instancia.status]}`}
          style={{ backgroundColor: getStatusColor(instancia.status) }}
        >
          {getStatusText(instancia.status)}
        </button>
      </div>

      {/* Middle section - Actions */}
      <div className={styles.cardActions}>
        {(userRole === 'Administrador' || userRole === 'Superadmin') && (
          <>
            {instancia.status === 'conectado' ? (
              <button 
                className={styles.actionButton}
                onClick={() => handleDisconnect(instancia)}
                title="Desconectar WhatsApp"
              >
                <X size={16} />
                Desconectar
              </button>
            ) : (
              <button 
                className={styles.actionButton}
                onClick={() => handleReconnect(instancia)}
                title="Reconectar WhatsApp"
              >
                <RefreshCw size={16} />
                Reconectar
              </button>
            )}
            <button 
              className={styles.actionButton}
              onClick={() => handleDelete(instancia)}
              title="Deletar instância"
            >
              <Trash size={16} />
              Deletar
            </button>
          </>
        )}
      </div>

      {/* Bottom section */}
      <div className={styles.cardBottom}>
        <div className={styles.whatsappIcon}>
          <MessageCircle size={20} />
        </div>
        <span className={styles.phoneNumber}>
          {instancia.phone_number || '-'}
        </span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Carregando instâncias...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Canais de atendimento</h1>
      
      {/* Mensagens de erro e sucesso */}
      {error && (
        <div className={styles.errorMessage}>
          <span>⚠️</span>
          <div className={styles.errorContent}>
            <p>{error}</p>
            <button 
              onClick={() => {
                setError(null);
                fetchInstancias();
              }}
              className={styles.retryButton}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}
      
      <div className={styles.instanciasGrid}>
        {instancias.map(renderInstanciaCard)}
      </div>

      {(userRole === 'Administrador' || userRole === 'Superadmin') && (
        <div className={styles.addButtonContainer} ref={dropdownRef}>
          <button 
            className={styles.addButton}
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <Plus size={24} />
          </button>
          
          {showDropdown && (
            <div className={styles.dropdown}>
              <div className={styles.dropdownHeader}>
                <span>Escolha seu provedor</span>
              </div>
              <button 
                className={styles.dropdownItem}
                onClick={() => selectProvider('evolution')}
              >
                <MessageCircle size={16} />
                <span>Evolution API</span>
                <ChevronDown size={14} />
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Modal QR Code */}
      {showQrModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
                         <div className={styles.modalHeader}>
               <h3>
                 {instanceName ? 'Reconectar' : 'Conectar'} WhatsApp - {selectedProvider === 'evolution' ? 'Evolution API' : 'Z-API'}
               </h3>
              <button 
                className={styles.closeButton}
                onClick={closeQrModal}
              >
                <X size={20} />
              </button>
            </div>
            
                         <div className={styles.modalContent}>
               {!qrCodeImage && (
                 <div className={styles.instanceNameForm}>
                  <label className={styles.label}>Nome da Instância:</label>
                  <input 
                    type="text"
                    value={instanceName}
                    onChange={(e) => setInstanceName(e.target.value)}
                    placeholder="Digite um nome para a instância"
                    className={styles.input}
                  />
                  <button 
                    onClick={createEvolutionInstance}
                    disabled={creatingInstance || !instanceName.trim()}
                    className={styles.createButton}
                  >
                    {creatingInstance ? (
                      <>
                        <RefreshCw size={16} className={styles.spinning} />
                        Criando...
                      </>
                    ) : (
                      'Criar Instância'
                    )}
                  </button>
                </div>
              )}
              
              {qrLoading && (
                <div className={styles.qrLoading}>
                  <div className={styles.spinner}></div>
                  <p>Gerando QR Code...</p>
                </div>
              )}
              
              {qrCodeImage && (
                <div className={styles.qrContainer}>
                  <h4>Escaneie o QR Code com seu WhatsApp:</h4>
                  <div className={styles.qrImageContainer}>
                    <img 
                      src={qrCodeImage} 
                      alt="QR Code" 
                      className={styles.qrImage}
                    />
                    <div className={styles.qrOverlay}>
                      <RefreshCw size={20} className={styles.spinning} />
                      <span>Atualizando...</span>
                    </div>
                  </div>
                  <p className={styles.qrInstructions}>
                    1. Abra o WhatsApp no seu celular<br/>
                    2. Toque em Menu (3 pontos) → Aparelhos conectados<br/>
                    3. Toque em "Conectar um aparelho"<br/>
                    4. Aponte a câmera para este código
                  </p>
                  <button 
                    onClick={() => fetchQrCode(instanceName)}
                    className={styles.refreshQrButton}
                  >
                    <RefreshCw size={16} />
                    Atualizar QR Code
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Confirmar exclusão</h3>
              <button 
                className={styles.closeButton}
                onClick={closeDeleteModal}
                disabled={deletingInstance}
              >
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalContent}>
              <p>
                Tem certeza que deseja excluir a instância <strong>{instanceToDelete?.instance_name}</strong>? Esta ação não pode ser desfeita.
              </p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px', justifyContent: 'flex-end' }}>
                <button 
                  onClick={closeDeleteModal}
                  className={styles.retryButton}
                  disabled={deletingInstance}
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDeleteInstance}
                  disabled={deletingInstance}
                  className={styles.createButton}
                >
                  {deletingInstance ? (
                    <>
                      <RefreshCw size={16} className={styles.spinning} />
                      Excluindo...
                    </>
                  ) : (
                    <>
                      <Trash size={16} />
                      Excluir
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

