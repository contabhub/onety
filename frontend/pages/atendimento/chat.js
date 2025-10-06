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


  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('userData');
    
    // Se ainda está carregando, não decide nada
    if (loading) return;

    if (!user && (!token || !userData)) {
      console.log('❌ Chat - Sem usuário e sem dados no localStorage, redirecionando para login');
      router.push('/login');
      return;
    }

    if (!user && token && userData) {
      console.log('⚠️ Chat - Aguardando sincronização do useAuth, evitando timeout curto');
      // Não redireciona; deixa a tela mostrar o estado de carregamento
      return;
    }

    if (user) {
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
              } else {
                // Se a conversa foi assumida pelo usuário atual, forçar refresh e ir para "Meus"
                try {
                  const currentUserId = (user?.id || (JSON.parse(localStorage.getItem('userData') || '{}').id))?.toString();
                  const assignedId = updatedConversation?.assigned_user_id != null
                    ? updatedConversation.assigned_user_id.toString()
                    : null;
                  const prevAssignedId = selectedConversation?.assigned_user_id != null
                    ? selectedConversation.assigned_user_id.toString()
                    : null;

                  if (assignedId && assignedId === currentUserId && assignedId !== prevAssignedId) {
                    console.log('✅ Chat.js: Conversa assumida pelo usuário atual → forçando refresh e aba "meus"');
                    setActiveTab('meus');
                    setRefreshTrigger(prev => prev + 1);
                  }
                } catch (e) {
                  console.warn('Falha ao avaliar mudança de responsável:', e?.message || e);
                }
              }
            }
          }}
          onTabChange={setActiveTab}
        />
      </div>
    </div>
  );
}
