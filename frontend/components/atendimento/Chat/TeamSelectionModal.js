import { ArrowLeft, Users, Crown, User } from 'lucide-react';
import styles from './TeamSelectionModal.module.css';

export default function TeamSelectionModal({ teams, onSelect, onBack, loading }) {
  
  // Função para obter ícone do role
  const getRoleIcon = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin':
      case 'administrador':
        return <Crown size={16} className={styles.adminIcon} />;
      case 'manager':
      case 'gerente':
        return <Users size={16} className={styles.managerIcon} />;
      default:
        return <User size={16} className={styles.memberIcon} />;
    }
  };

  // Função para obter texto do role
  const getRoleText = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin':
      case 'administrador':
        return 'Administrador';
      case 'manager':
      case 'gerente':
        return 'Gerente';
      case 'member':
      case 'membro':
        return 'Membro';
      default:
        return role || 'Membro';
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <span>Carregando times...</span>
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
          <Users size={20} />
          <h3>Selecione o time</h3>
        </div>
      </div>

      <div className={styles.description}>
        Escolha qual time será responsável por este atendimento:
      </div>

      <div className={styles.teamsList}>
        {teams.length === 0 ? (
          <div className={styles.empty}>
            <Users size={48} className={styles.emptyIcon} />
            <p>Nenhum time encontrado</p>
            <small>Você não está vinculado a nenhum time</small>
          </div>
        ) : (
          teams.map((team) => (
            <button
              key={team.id}
              onClick={() => onSelect(team)}
              className={styles.teamItem}
            >
              <div className={styles.teamIcon}>
                <Users size={24} />
              </div>
              
              <div className={styles.teamInfo}>
                <div className={styles.teamName}>
                  {team.nome}
                  {team.padrao && (
                    <span className={styles.defaultBadge}>Padrão</span>
                  )}
                </div>
                
                <div className={styles.teamDetails}>
                  <div className={styles.roleInfo}>
                    {getRoleIcon(team.role)}
                    <span className={styles.roleText}>
                      {getRoleText(team.role)}
                    </span>
                  </div>
                  
                  {team.created_at && (
                    <div className={styles.createdAt}>
                      Criado em {new Date(team.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.arrow}>→</div>
            </button>
          ))
        )}
      </div>

      <div className={styles.footer}>
        <small>
          💡 Após selecionar o time, você escolherá qual instância WhatsApp usar
        </small>
      </div>
    </div>
  );
}

