import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import ChatSidebar from '../../components/atendimento/Chat/ChatSidebar';
import ChatWindow from '../../components/atendimento/Chat/ChatWindow';
import BillingStatusBanner from '../../components/atendimento/banner/banner';
import PrincipalSidebar from '../../components/onety/principal/PrincipalSidebar';
import styles from '../../styles/atendimento/chat.module.css';


export default function Chat({ auth }) {
  const { user, loading } = auth || {};
  const router = useRouter();
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [activeTab, setActiveTab] = useState('novos');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [companyStatus, setCompanyStatus] = useState(null);

  // Debug: Log mudanças de aba
  useEffect(() => {
    console.log('🔄 Chat.js: Aba ativa mudou para:', activeTab);
  }, [activeTab]);

  useEffect(() => {
    console.log('🔍 Chat - useEffect executado:', { 
      user, 
      loading, 
      auth,
      hasToken: !!localStorage.getItem('token'),
      hasUserData: !!localStorage.getItem('userData'),
      companyId: (JSON.parse(localStorage.getItem('userData') || '{}').companyId)
    });
    
    // Se ainda está carregando, aguardar
    if (loading) {
      console.log('⏳ Chat - Ainda carregando, aguardando...');
      return;
    }
    
    // Verificar se tem token e dados no localStorage como fallback
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('userData');
    
    if (!user && (!token || !userData)) {
      console.log('❌ Chat - Sem usuário e sem dados no localStorage, redirecionando para login');
      router.push('/login');
    } else if (!user && token && userData) {
      console.log('⚠️ Chat - Usuário não no estado, mas dados existem no localStorage. Aguardando sincronização...');
      // Dar um tempo para o useAuth sincronizar
      setTimeout(() => {
        if (!auth?.user) {
          console.log('❌ Chat - Timeout na sincronização, redirecionando para login');
          router.push('/login');
        }
      }, 2000);
    } else if (user) {
      console.log('✅ Chat - Usuário encontrado:', user);
    }
  }, [user, loading, router, auth]);

  // Buscar status da empresa para exibir banner
  useEffect(() => {
    const fetchCompanyStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        const companyId = JSON.parse(localStorage.getItem('userData') || '{}').companyId;
        if (!token || !companyId) return;
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/company/${companyId}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        if (!res.ok) return;
        const data = await res.json();
        setCompanyStatus(data.status || null);
      } catch (err) {
        console.error('Erro ao buscar status da empresa:', err);
      }
    };
    fetchCompanyStatus();
  }, []);

  const renderStatusBanner = () => {
    const supportUrl = process.env.NEXT_PUBLIC_SUPPORT_URL || process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_URL || null;
    return <BillingStatusBanner status={companyStatus} supportUrl={supportUrl} />;
  };

  // Log adicional para debug
  useEffect(() => {
    console.log('🔍 Chat - Estado atual:', { user, loading, selectedConversation });
  }, [user, loading, selectedConversation]);

  if (loading) {
    console.log('⏳ Chat - Carregando...');
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingText}>Carregando...</div>
      </div>
    );
  }

  if (!user) {
    console.log('❌ Chat - Sem usuário, renderizando null');
    return null;
  }

  return (
    <div className={styles.chatContainer}>
      {/* Banner de status da empresa */}
      {renderStatusBanner()}
      {/* Conteúdo principal */}
      <div className={styles.mainContent}>
      <PrincipalSidebar />

        <ChatSidebar 
          onSelectConversation={setSelectedConversation}
          selectedConversation={selectedConversation}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          refreshTrigger={refreshTrigger}
        />
        <ChatWindow 
          conversation={selectedConversation}
          onConversationUpdate={(updatedConversation) => {
            console.log('🔄 Chat.js: Conversa atualizada:', updatedConversation);
            if (selectedConversation?.conversation_id === updatedConversation.conversation_id) {
              setSelectedConversation(updatedConversation);
              console.log('✅ Chat.js: Conversa selecionada atualizada');
              
              // Se a conversa foi finalizada, disparar refresh do sidebar
              if (updatedConversation.status === 'fechada') {
                console.log('🔄 Chat.js: Conversa finalizada, disparando refresh do sidebar');
                setRefreshTrigger(prev => prev + 1);
              }
            }
          }}
          onTabChange={setActiveTab}
        />
      </div>
    </div>
  );
}
