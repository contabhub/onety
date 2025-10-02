import { ArrowLeft, Smartphone, Phone, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import styles from './InstanceSelectionModal.module.css';

export default function InstanceSelectionModal({ instances, selectedTeam, onSelect, onBack, loading }) {
  
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
        {instances.length === 0 ? (
          <div className={styles.empty}>
            <Smartphone size={48} className={styles.emptyIcon} />
            <p>Nenhuma instância encontrada</p>
            <small>Este time não possui instâncias WhatsApp configuradas</small>
          </div>
        ) : (
          instances.map((instance) => {
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

      {instances.some(instance => !isInstanceAvailable(instance)) && (
        <div className={styles.footer}>
          <small>
            💡 Apenas instâncias conectadas podem ser usadas para iniciar atendimentos
          </small>
        </div>
      )}
    </div>
  );
}

