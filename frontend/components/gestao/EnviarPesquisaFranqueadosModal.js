import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Send, Users, UserCheck, BarChart3, X } from 'lucide-react';
import styles from '../../styles/gestao/EnviarPesquisaFranqueados.Modal.module.css';

// Cliente HTTP mínimo
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
const api = {
  get: async (url, config = {}) => {
    const params = config.params ? `?${new URLSearchParams(config.params).toString()}` : '';
    const res = await fetch(`${API_BASE}${url}${params}`, { headers: config.headers || {} });
    return { data: await res.json() };
  },
  post: async (url, body, config = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(config.headers || {}) };
    const res = await fetch(`${API_BASE}${url}`, { method: 'POST', headers, body: JSON.stringify(body) });
    return { data: await res.json() };
  }
};

export default function EnviarPesquisaFranqueadosModal({ 
  isOpen, 
  onClose, 
  empresaId 
}) {
  const [franqueados, setFranqueados] = useState([]);
  const [franqueadosSelecionados, setFranqueadosSelecionados] = useState([]);
  const [enviarParaTodos, setEnviarParaTodos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [estatisticas, setEstatisticas] = useState(null);
  const [loadingEstatisticas, setLoadingEstatisticas] = useState(false);

  useEffect(() => {
    if (isOpen && empresaId > 0) {
      buscarFranqueados();
      buscarEstatisticas();
    }
  }, [isOpen, empresaId]);

  const buscarFranqueados = async () => {
    if (!empresaId || empresaId <= 0) {
      return;
    }

    try {
      const token = sessionStorage.getItem('token');
      if (!token) {
        toast.error('Token de autenticação não encontrado.');
        return;
      }

      const response = await api.get(`/api/franqueados`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 999999 } // Buscar todos os franqueados
      });
      
      setFranqueados(response.data.franqueados || []);
    } catch (error) {
      // Se for erro 403, não mostrar erro para o usuário
      if (error?.response?.status === 403) {
        setFranqueados([]);
      } else {
        console.error('Erro ao buscar franqueados:', error);
        toast.error('Erro ao buscar franqueados.');
      }
    }
  };

  const buscarEstatisticas = async () => {
    if (!empresaId || empresaId <= 0) {
      console.warn('empresaId inválido:', empresaId);
      return;
    }

    setLoadingEstatisticas(true);
    try {
      const token = sessionStorage.getItem('token');
      if (!token) {
        toast.error('Token de autenticação não encontrado.');
        return;
      }

      const response = await api.get(`/api/pesquisa/franqueado/estatisticas/${empresaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEstatisticas(response.data);
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      // Não mostrar erro para o usuário, apenas log
    } finally {
      setLoadingEstatisticas(false);
    }
  };

  const handleEnviarPesquisa = async () => {
    if (!empresaId || empresaId <= 0) {
      toast.error('ID da empresa inválido. Tente recarregar a página.');
      return;
    }

    if (!enviarParaTodos && franqueadosSelecionados.length === 0) {
      toast.error('Selecione pelo menos um franqueado ou marque "Enviar para todos".');
      return;
    }

    setLoading(true);
    try {
      const payload = enviarParaTodos 
        ? { enviarParaTodos: true, empresaId }
        : { franqueadoIds: franqueadosSelecionados, empresaId };

      const response = await api.post('/api/pesquisa/enviar-para-franqueados', payload);
      
      if (response.data.success) {
        const totalEnviados = response.data.pesquisasCriadas?.length || 0;
        toast.success(`Pesquisa enviada com sucesso para ${totalEnviados} franqueado(s)!`);
        onClose();
        setFranqueadosSelecionados([]);
        setEnviarParaTodos(false);
      } else {
        toast.error(response.data.error || 'Erro ao enviar pesquisa.');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao enviar pesquisa.');
    } finally {
      setLoading(false);
    }
  };

  const toggleFranqueado = (id) => {
    if (franqueadosSelecionados.includes(id)) {
      setFranqueadosSelecionados(prev => prev.filter(f => f !== id));
    } else {
      setFranqueadosSelecionados(prev => [...prev, id]);
    }
  };

  const toggleEnviarParaTodos = () => {
    setEnviarParaTodos(!enviarParaTodos);
    if (!enviarParaTodos) {
      setFranqueadosSelecionados([]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Enviar Pesquisa de Satisfação</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Seção de Estatísticas */}
        <div className={styles.estatisticasSection}>
          <h3>
            <BarChart3 size={20} />
            Estatísticas das Pesquisas Existentes
          </h3>
          
          {loadingEstatisticas ? (
            <div className={styles.loadingStats}>Carregando estatísticas...</div>
          ) : estatisticas ? (
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{estatisticas.total_respostas}</div>
                <div className={styles.statLabel}>Total de Respostas</div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statValue}>{estatisticas.medias.franquia}</div>
                <div className={styles.statLabel}>Média da Franquia</div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statValue}>{estatisticas.medias.dp}</div>
                <div className={styles.statLabel}>Média DP</div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statValue}>{estatisticas.medias.fiscal}</div>
                <div className={styles.statLabel}>Média Fiscal</div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statValue}>{estatisticas.medias.contabil}</div>
                <div className={styles.statLabel}>Média Contábil</div>
              </div>
            </div>
          ) : (
            <div className={styles.noStats}>Nenhuma pesquisa respondida ainda.</div>
          )}
        </div>

        <div className={styles.content}>
          <div className={styles.section}>
            <h3>
              <Users size={20} />
              Selecionar Franqueados
            </h3>
            
            <label className={styles.checkboxItem}>
              <input
                type="checkbox"
                checked={enviarParaTodos}
                onChange={toggleEnviarParaTodos}
              />
              <span className={styles.checkmark}></span>
              Enviar para todos os franqueados ativos
            </label>

            {!enviarParaTodos && (
              <div className={styles.franqueadosList}>
                <h4>Ou selecione franqueados específicos:</h4>
                {franqueados.map(franqueado => (
                  <label key={franqueado.id} className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      checked={franqueadosSelecionados.includes(franqueado.id)}
                      onChange={() => toggleFranqueado(franqueado.id)}
                    />
                    <span className={styles.checkmark}></span>
                    {franqueado.nome}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className={styles.modalActions}>
            <button onClick={onClose} className={styles.btnSecondary}>
              Cancelar
            </button>
            <button 
              onClick={handleEnviarPesquisa} 
              disabled={loading || (!enviarParaTodos && franqueadosSelecionados.length === 0)}
              className={styles.btnPrimary}
            >
              <Send size={16} />
              {loading ? 'Enviando...' : 'Enviar Pesquisa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
