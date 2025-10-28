'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import styles from '../../../styles/financeiro/open-finance.module.css';

// ⚡️ Importa PluggyConnect só no Client:
const PluggyConnect = dynamic(
  () => import('react-pluggy-connect').then((mod) => mod.PluggyConnect),
  { ssr: false }
);

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

/**
 * @param {Object} props
 * @param {Function} [props.onSuccess] - Callback chamado quando a conexão é bem-sucedida
 * @param {string} [props.onSuccess.itemId] - ID do item conectado
 */
export default function OpenFinancePluggy({ onSuccess }) {
  const [connectToken, setConnectToken] = useState(null);
  const [isConnectVisible, setIsConnectVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConnect() {
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/openfinance/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientUserId: 'user-abc' }),
      });

      if (!res.ok) throw new Error('Erro ao criar connect_token.');

      const { connectToken } = await res.json();
      if (!connectToken) throw new Error('Connect Token não veio do backend!');

      setConnectToken(connectToken);
      setIsConnectVisible(true);

    } catch (err) {
      console.error(err);
      setError(err.message || 'Erro desconhecido.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        Conectar Conta Bancária (Open Finance)
      </h1>

      <button
        className={`${styles.connectButton} ${loading ? styles.loading : ''}`}
        onClick={handleConnect}
        disabled={loading}
      >
        {loading ? 'Conectando...' : 'Conectar Conta'}
      </button>

      {error && (
        <div className={styles.errorMessage}>{error}</div>
      )}

      {isConnectVisible && connectToken && (
        <div className={styles.pluggyContainer}>
          <PluggyConnect
            connectToken={connectToken}
            onSuccess={async (data) => {
              console.log('🔗 Pluggy conectado:', data);
              const itemId = data.item.id;
          
              // Supondo que seu JWT esteja no localStorage:
              const token = localStorage.getItem('token');
              const userData = JSON.parse(localStorage.getItem('userData') || '{}');
              const company_id = userData.EmpresaId;
          
              const res = await fetch(`${API_BASE}/contas-api`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                  item_id: itemId,
                  client_user_id: 'user-abc',
                  connector_id: data.item.connector.id,
                  status: data.item.status,
                  execution_status: data.item.executionStatus,
                  empresa_id: company_id,
                }),
              });
          
              if (!res.ok) {
                console.error('Erro ao salvar item_id na contasapi');
              } else {
                console.log('✅ item_id salvo com sucesso');
                if (onSuccess) onSuccess(itemId);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
