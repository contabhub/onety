import axios from 'axios';

// Configurar interceptor global para capturar erros de token
let isRedirecting = false;

const setupAxiosInterceptors = () => {
  // Interceptor de response para capturar erros 401
  axios.interceptors.response.use(
    (response) => response, // Passa responses bem-sucedidos
    (error) => {
      // Se receber 401 (token inválido/expirado)
      if (error.response?.status === 401 && !isRedirecting) {
        isRedirecting = true;
        
        console.log('❌ Token expirado detectado pelo interceptor - fazendo logout...');
        
        // Limpar dados do localStorage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('companyId');
        localStorage.removeItem('companyName');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userId');
        
        // Redirecionar para login
        window.location.href = '/login';
        
        return Promise.reject(error);
      }
      
      return Promise.reject(error);
    }
  );
};

export default setupAxiosInterceptors;
