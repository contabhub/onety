import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Conta from '../../components/atendimento/ajustes/Conta';
import CanaisAtendimento from '../../components/atendimento/ajustes/CanaisAtendimento';
import Equipes from '../../components/atendimento/ajustes/Equipes';
import Usuarios from '../../components/atendimento/ajustes/Usuarios';
import Contatos from '../../components/atendimento/ajustes/Contatos';
import Webhooks from '../../components/atendimento/ajustes/Webhooks';
import Cargos from '../../components/atendimento/ajustes/Cargos';
import Etiquetas from '../../components/atendimento/ajustes/Etiquetas';
import LinksExternos from '../../components/atendimento/ajustes/LinksExternos';
import PrincipalSidebar from '../../components/onety/principal/PrincipalSidebar'
import styles from '../../styles/atendimento/ajustes.module.css';

export default function Ajustes({ auth }) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('conta');

  // Detectar seção ativa baseada na query string
  useEffect(() => {
    if (router.query.section) {
      setActiveSection(router.query.section);
    }
  }, [router.query.section]);


  const handleSectionChange = (section) => {
    setActiveSection(section);
    // Atualizar URL sem recarregar a página
    router.push(`/atendimento/ajustes?section=${section}`, undefined, { shallow: true });
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'conta':
        return <Conta />;
      case 'canais':
        return <CanaisAtendimento />;
      case 'equipes':
        return <Equipes />;
      case 'usuarios':
        return <Usuarios />;
      case 'contatos':
        return <Contatos />;
      case 'etiquetas':
        return <Etiquetas />;
      case 'links-externos':
        return <LinksExternos />;
      case 'webhooks':
        return <Webhooks />;
      case 'cargos':
        return <Cargos />;
      default:
        return <Conta />;
    }
  };

  return (
    <>
      <Head>
        <title>Ajustes - Aura8</title>
        <meta name="description" content="Configurações da sua conta e empresa" />
      </Head>
      
      <div className={styles.pageContainer}>
        <PrincipalSidebar />
        
        <div className={styles.ajustesContainer}>
          {/* Conteúdo principal */}
          <main className={styles.mainContent}>
            {renderContent()}
          </main>
        </div>
      </div>
    </>
  );
}
