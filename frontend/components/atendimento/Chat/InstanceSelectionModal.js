import { ArrowLeft, Smartphone, Phone, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import styles from './InstanceSelectionModal.module.css';

export default function InstanceSelectionModal({ instances, selectedTeam, onSelect, onBack, loading }) {
  const router = useRouter();
  const [list, setList] = useState(Array.isArray(instances) ? instances : []);
  const pollRef = useRef(null);

  useEffect(() => {
    setList(Array.isArray(instances) ? instances : []);
  }, [instances]);
  
  // Função para obter ícone do status
  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'connected':
      case 'conectado':
        return <CheckCircle size={16} className={styles.connectedIcon} />;
      case 'disconnected':
      case 'desconectado':
        return <XCircle size={16} className={styles.disconnectedIcon} />;
      case 'connecting':
      case 'conectando':
        return <AlertCircle size={16} className={styles.connectingIcon} />;
      default:
        return <AlertCircle size={16} className={styles.unknownIcon} />;
    }
  };

  // Função para obter texto do status
  const getStatusText = (status) => {
    switch (status?.toLowerCase()) {
      case 'connected':
      case 'conectado':
        return 'Conectado';
      case 'disconnected':
      case 'desconectado':
        return 'Desconectado';
      case 'connecting':
      case 'conectando':
        return 'Conectando';
      default:
        return status || 'Desconhecido';
    }
  };

  // Função para formatar número de telefone
  const formatPhone = (phone) => {
    if (!phone) return 'Não informado';
    
    const digits = phone.replace(/\D/g, '');
    
    if (digits.length === 13 && digits.startsWith('55')) {
      // +55 (XX) 9XXXX-XXXX
      const ddd = digits.slice(2, 4);
      const first = digits.slice(4, 9);
      const second = digits.slice(9, 13);
      return `+55 (${ddd}) ${first}-${second}`;
    } else if (digits.length === 12 && digits.startsWith('55')) {
      // +55 (XX) XXXX-XXXX
      const ddd = digits.slice(2, 4);
      const first = digits.slice(4, 8);
      const second = digits.slice(8, 12);
      return `+55 (${ddd}) ${first}-${second}`;
    }
    
    return phone;
  };

  // Verificar se instância está disponível para uso
  const isInstanceAvailable = (instance) => {
    const status = instance.status?.toLowerCase();
    return status === 'connected' || status === 'conectado';
  };

  // Verificar permissão do usuário para gerenciar/conectar instâncias
  const canManageInstances = (() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('userData') : null;
      const user = raw ? JSON.parse(raw) : {};
      const adm = Array.isArray(user?.permissoes?.adm) ? user.permissoes.adm.map(String) : [];
      const inst = Array.isArray(user?.permissoes?.instancias) ? user.permissoes.instancias.map(String) : [];
      const isAdmin = adm.includes('admin') || adm.includes('superadmin');
      const canConnect = inst.includes('conectar');
      return isAdmin || canConnect;
    } catch {
      return false;
    }
  })();

  const anyUnavailable = Array.isArray(list) && list.some((i) => !isInstanceAvailable(i));

  // Função para refazer a leitura das instâncias do time (para auto refresh após reconexão)
  const refetchInstances = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token || !selectedTeam?.id) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/atendimento/times-atendimento-instancias/time/${selectedTeam.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      const mapped = (data || []).map(inst => ({
        id: inst.id,
        instance_name: inst.instancia_nome,
        phone_number: inst.telefone,
        instance_id: inst.instancia_codigo,
        instancia_whatsapp_id: inst.instancia_id,
        token: inst.token,
        client_token: inst.cliente_token,
        status: inst.status
      }));
      setList(mapped);
    } catch {}
  };

  // Inicia polling enquanto houver indisponíveis
  useEffect(() => {
    if (!anyUnavailable) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (!pollRef.current) {
      pollRef.current = setInterval(refetchInstances, 5000);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [anyUnavailable, selectedTeam?.id]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <span>Carregando instâncias...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={onBack} className={styles.backButton}>
          <ArrowLeft size={20} />
        </button>
        <div className={styles.headerContent}>
          <Smartphone size={20} />
          <h3>Selecione a instância WhatsApp</h3>
        </div>
      </div>

      <div className={styles.teamInfo}>
        <strong>Time selecionado:</strong> {selectedTeam?.nome}
      </div>

      <div className={styles.description}>
        Escolha qual instância WhatsApp será usada para este atendimento:
      </div>

      <div className={styles.instancesList}>
        {list.length === 0 ? (
          <div className={styles.empty}>
            <Smartphone size={48} className={styles.emptyIcon} />
            <p>Nenhuma instância encontrada</p>
            <small>Este time não possui instâncias WhatsApp configuradas</small>
          </div>
        ) : (
          list.map((instance) => {
            const isAvailable = isInstanceAvailable(instance);
            
            return (
              <button
                key={instance.id}
                onClick={() => onSelect(instance)}
                disabled={!isAvailable}
                className={`${styles.instanceItem} ${
                  !isAvailable ? styles.disabled : ''
                }`}
              >
                <div className={styles.instanceIcon}>
                  <Smartphone size={24} />
                </div>
                
                <div className={styles.instanceInfo}>
                  <div className={styles.instanceName}>
                    {instance.instance_name}
                  </div>
                  
                  <div className={styles.instanceDetails}>
                    <div className={styles.phoneInfo}>
                      <Phone size={14} />
                      <span>{formatPhone(instance.phone_number)}</span>
                    </div>
                    
                    <div className={styles.statusInfo}>
                      {getStatusIcon(instance.status)}
                      <span className={styles.statusText}>
                        {getStatusText(instance.status)}
                      </span>
                    </div>
                  </div>
                  
                  {instance.instance_id && (
                    <div className={styles.instanceId}>
                      ID: {instance.instance_id}
                    </div>
                  )}
                  
                  {!isAvailable && (
                    <div className={styles.unavailableWarning}>
                      ⚠️ Instância não disponível para uso
                    </div>
                  )}
                </div>

                <div className={`${styles.arrow} ${!isAvailable ? styles.disabledArrow : ''}`}>
                  →
                </div>
              </button>
            );
          })
        )}
      </div>

      {list.some(instance => !isInstanceAvailable(instance)) && (
        <div className={styles.footer}>
          <small>
            💡 Apenas instâncias conectadas podem ser usadas para iniciar atendimentos
          </small>
          {canManageInstances && anyUnavailable && (
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  // abre ajustes em nova aba e inicia um refresh otimista
                  window.open('/atendimento/ajustes?section=canais', '_blank', 'noopener');
                  refetchInstances();
                }}
                style={{
                  background: 'var(--onity-color-primary)',
                  color: 'var(--onity-color-primary-contrast)',
                  border: '1px solid transparent',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                title="Abrir ajustes de canais"
              >
                Conectar instâncias nos Ajustes
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

