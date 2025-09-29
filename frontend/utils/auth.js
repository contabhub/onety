import { useEffect, useState, useCallback } from "react";

// Hook para gerenciar autenticação do usuário
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Função para sincronizar dados do usuário com localStorage
  const syncUserData = useCallback(() => {
    console.log('🔄 syncUserData chamado');
    
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('userData');

    console.log('📊 Dados do localStorage:', {
      hasToken: !!token,
      hasUserData: !!userData
    });

    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        
        // Garantir shape e id presentes
        const userWithCompany = {
          ...parsedUser,
          id: parsedUser.id
        };
        
        console.log('✅ Usuário sincronizado:', userWithCompany);
        setUser(userWithCompany);
      } catch (error) {
        console.error('❌ Erro ao parsear dados do usuário:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        setUser(null);
      }
    } else {
      console.log('❌ Token ou userData não encontrados');
      setUser(null);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    console.log('🚀 useAuth - useEffect inicial executado');
    // Sincronização inicial
    syncUserData();

    // Listener para mudanças no localStorage
    const handleStorageChange = (e) => {
      if (e.key === 'userData') {
        console.log('🔄 Mudança detectada no localStorage:', e.key, e.newValue);
        syncUserData();
      }
    };

    // Adicionar listener para mudanças no localStorage
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [syncUserData]);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    setUser(null);
  };

  const changeCompany = () => {
    // Limpar dados de empresa dentro de userData
    const raw = localStorage.getItem('userData');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const updated = { ...parsed };
        delete updated.companyId;
        delete updated.companyName;
        delete updated.userRole;
        localStorage.setItem('userData', JSON.stringify(updated));
      } catch {}
    }
    syncUserData();
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('userData', JSON.stringify(userData));
  };

  // Função para atualizar dados da empresa selecionada
  const updateCompanyData = useCallback((companyId, companyName, userRole) => {
    console.log('🔄 updateCompanyData chamado com:', { companyId, companyName, userRole });
    
    // Buscar dados atuais do usuário do localStorage
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        const updatedUser = {
          ...parsedUser,
          companyId,
          companyName,
          userRole
        };
        
        // Atualizar localStorage primeiro
        localStorage.setItem('userData', JSON.stringify(updatedUser));
        
        // Atualizar estado imediatamente
        setUser(updatedUser);
        setLoading(false);
        
        console.log('✅ Usuário atualizado imediatamente:', updatedUser);
        
        // Forçar sincronização adicional para garantir
        setTimeout(() => {
          syncUserData();
        }, 10);
        
      } catch (error) {
        console.error('❌ Erro ao atualizar dados da empresa:', error);
        syncUserData(); // Fallback para sincronização normal
      }
    } else {
      console.log('❌ Dados do usuário não encontrados no localStorage');
      syncUserData(); // Fallback para sincronização normal
    }
  }, [syncUserData]);

  return { 
    user, 
    loading, 
    logout, 
    changeCompany, 
    updateUser, 
    updateCompanyData,
    syncUserData 
  };
}
