import React, { useEffect, useMemo, useState } from 'react';

export default function ImportFromAtendimentoModal({ open, onClose, empresaId, funis, defaultFunilId, fases, onImported }) {
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [funilId, setFunilId] = useState(defaultFunilId || null);
  const [faseId, setFaseId] = useState(null);

  useEffect(() => {
    if (!open) return;
    setSelectedLeadId(null);
    setQuery('');
    setFunilId(defaultFunilId || null);
    setFaseId(null);
    (async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/atendimento/leads/empresa/${empresaId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setLeads(Array.isArray(data) ? data : []);
      } catch (e) {
        setLeads([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, empresaId, defaultFunilId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(l =>
      (l.nome || '').toLowerCase().includes(q) ||
      (l.telefone || '').toLowerCase().includes(q) ||
      String(l.id).includes(q)
    );
  }, [leads, query]);

  const selectedLead = useMemo(() => leads.find(l => l.id === selectedLeadId) || null, [leads, selectedLeadId]);

  const handleConfirm = async () => {
    if (!selectedLead) return;
    if (!funilId || !faseId) return;
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const userId = JSON.parse(localStorage.getItem('userData') || '{}')?.id;
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nome: selectedLead.nome || 'Contato sem nome',
          email: selectedLead.email || '',
          telefone: selectedLead.telefone || '',
          empresa_id: empresaId,
          funil_id: parseInt(funilId),
          funil_fase_id: parseInt(faseId),
          valor: 0,
          data_prevista: null,
          status: 'aberto',
          usuario_id: userId
        })
      });
      onImported && onImported({ funilId });
      onClose && onClose();
    } catch (e) {
      // silencioso; a página de CRM já reporta erros em console
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(3,8,66,.64)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', zIndex: 1112, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 'min(860px, 94vw)', maxHeight: '86vh', overflow: 'auto', background: 'var(--onity-color-surface)', border: '1px solid var(--onity-color-border)', borderRadius: 12, boxShadow: 'var(--onity-elev-high)', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Buscar lead no Atendimento</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--onity-color-border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>Fechar</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px 220px', gap: 12, marginBottom: 12 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, telefone ou ID"
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--onity-color-border)', background: 'var(--onity-color-surface-1, #0f172a)', color: 'var(--onity-color-text)' }}
          />
          <select value={funilId || ''} onChange={(e) => { setFunilId(e.target.value); setFaseId(null); }} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--onity-color-border)', background: 'var(--onity-color-surface-1, #0f172a)', color: 'var(--onity-color-text)' }}>
            <option value="" disabled>Selecione o funil</option>
            {(funis || []).map(f => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
          <select value={faseId || ''} onChange={(e) => setFaseId(e.target.value)} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--onity-color-border)', background: 'var(--onity-color-surface-1, #0f172a)', color: 'var(--onity-color-text)' }}>
            <option value="" disabled>Selecione a fase</option>
            {(fases || []).map(f => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        </div>

        <div style={{ border: '1px solid var(--onity-color-border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ maxHeight: 360, overflow: 'auto' }}>
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--onity-color-text-secondary)' }}>Carregando leads...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--onity-color-text-secondary)' }}>Nenhum lead encontrado no Atendimento.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--onity-color-surface-1)', color: 'var(--onity-color-text-secondary)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--onity-color-border)' }}>Selecionar</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--onity-color-border)' }}>ID</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--onity-color-border)' }}>Nome</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--onity-color-border)' }}>Telefone</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--onity-color-border)' }}>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => (
                    <tr key={l.id} style={{ borderBottom: '1px solid var(--onity-color-border)' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <input type="radio" name="selLead" checked={selectedLeadId === l.id} onChange={() => setSelectedLeadId(l.id)} />
                      </td>
                      <td style={{ padding: '8px 12px' }}>#{l.id}</td>
                      <td style={{ padding: '8px 12px' }}>{l.nome || '-'}</td>
                      <td style={{ padding: '8px 12px' }}>{l.telefone || '-'}</td>
                      <td style={{ padding: '8px 12px' }}>{l.email || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--onity-color-text)', border: '1px solid var(--onity-color-border)', borderRadius: 10, padding: '10px 16px', cursor: 'pointer' }}>Cancelar</button>
          <button disabled={!selectedLead || !funilId || !faseId || loading} onClick={handleConfirm} style={{ background: 'var(--primary-color, #3b82f6)', color: '#fff', border: '1px solid var(--primary-color, #3b82f6)', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', fontWeight: 700 }}>
            {loading ? 'Importando...' : 'Adicionar ao CRM'}
          </button>
        </div>
      </div>
    </div>
  );
}


