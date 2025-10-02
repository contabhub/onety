import { useState } from 'react';
import Head from 'next/head';
import Header from '../components/menu/Header';
import AjustesSidebar from '../components/ajustes/AjustesSidebar';
import Conta from '../components/ajustes/Conta';
import CanaisAtendimento from '../components/ajustes/CanaisAtendimento';
import Equipes from '../components/ajustes/Equipes';
import Usuarios from '../components/ajustes/Usuarios';
import Contatos from '../components/ajustes/Contatos';
import Webhooks from '../components/ajustes/Webhooks';
import Etiquetas from '../components/ajustes/Etiquetas';
import LinksExternos from '../components/ajustes/LinksExternos';
import '../styles/ajustes.module.css';

export default function Ajustes({ auth }) {
  const [activeSection, setActiveSection] = useState('conta');

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
      
      <div className="flex flex-col h-screen bg-gray-100">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white">
          <Header auth={auth} />
        </div>
        
        {/* Conteúdo principal */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <AjustesSidebar 
            activeSection={activeSection} 
            onSectionChange={setActiveSection} 
          />
          <main className="flex-1 overflow-auto">
            {renderContent()}
          </main>
        </div>
      </div>
    </>
  );
}
