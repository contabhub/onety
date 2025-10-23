'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';

// ⚡️ Importa PluggyConnect só no Client:
const PluggyConnect = dynamic(
  () => import('react-pluggy-connect').then((mod) => mod.PluggyConnect),
  { ssr: false }
);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://straton-back.vercel.app';

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
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 bg-white rounded shadow max-w-md mx-auto mt-10">
      <h1 className="text-2xl font-bold mb-6 text-center">
        Conectar Conta Bancária (Open Finance)
      </h1>

      <button
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded w-full transition disabled:opacity-60"
        onClick={handleConnect}
        disabled={loading}
      >
        {loading ? 'Conectando...' : 'Conectar Conta'}
      </button>

      {error && (
        <div className="text-red-600 text-sm mt-4 text-center">{error}</div>
      )}

      {isConnectVisible && connectToken && (
        <PluggyConnect
        connectToken={connectToken}
        onSuccess={async (data) => {
          console.log('🔗 Pluggy conectado:', data);
          const itemId = data.item.id;
      
          // Supondo que seu JWT esteja no localStorage:
          const token = localStorage.getItem('token');
          const company_id = localStorage.getItem('empresaId');
      
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
              company_id,
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
      
      )}
    </div>
  );
}
