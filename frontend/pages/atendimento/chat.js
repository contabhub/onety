import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import ChatSidebar from '../components/Chat/ChatSidebar';
import ChatWindow from '../components/Chat/ChatWindow';
import Header from '../components/menu/Header';
import BillingStatusBanner from '../components/banner/banner';

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    console.log('❌ Chat - Sem usuário, renderizando null');
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      {/* Banner de status da empresa */}
      {renderStatusBanner()}
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white">
        <Header auth={auth} />
      </div>

      {/* Conteúdo principal */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
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
