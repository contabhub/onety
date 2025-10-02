import styles from './AjustesSidebar.module.css';
import { Building2, MessageCircle, Users, UserCheck, Contact, Webhook, Tag, ExternalLink } from 'lucide-react';

export default function AjustesSidebar({ activeSection, onSectionChange }) {
  const menuItems = [
    {
      id: 'conta',
      title: 'Conta',
      description: 'Defina seus dados e da sua empresa',
      icon: Building2
    },
    {
      id: 'canais',
      title: 'Canais de atendimento',
      description: 'Configure seus canais de atendimento',
      icon: MessageCircle
    },
    {
      id: 'equipes',
      title: 'Equipes',
      description: 'Gerencie suas equipes de atendimento',
      icon: Users
    },
    {
      id: 'usuarios',
      title: 'Usuários',
      description: 'Gerencie os usuários da empresa',
      icon: UserCheck
    },
    {
      id: 'contatos',
      title: 'Contatos',
      description: 'Gerencie seus contatos e clientes',
      icon: Contact
    },
    {
      id: 'etiquetas',
      title: 'Etiquetas',
      description: 'Crie e gerencie etiquetas de contatos',
      icon: Tag
    },
    {
      id: 'links-externos',
      title: 'Links Externos',
      description: 'Gerencie links úteis da empresa',
      icon: ExternalLink
    },
    {
      id: 'webhooks',
      title: 'Webhooks',
      description: 'Configure integrações automáticas',
      icon: Webhook
    }
  ];

  return (
    <aside className={styles.sidebar}>
      <h1 className={styles.title}>Configurações</h1>
      
      <nav className={styles.nav}>
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <button
              key={item.id}
              className={`${styles.navItem} ${activeSection === item.id ? styles.active : ''}`}
              onClick={() => onSectionChange(item.id)}
            >
              <span className={styles.icon}>
                <IconComponent size={20} />
              </span>
              <div className={styles.itemContent}>
                <h3 className={styles.itemTitle}>{item.title}</h3>
                <p className={styles.itemDescription}>{item.description}</p>
              </div>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

