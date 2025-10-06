import React, { useEffect, useMemo, useState } from 'react';
import styles from '../../styles/ImportLeadsModal.module.css';

const DEFAULT_FIELDS = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Nome' },
  { key: 'email', label: 'Email' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'valor', label: 'Valor' },
  { key: 'data_prevista', label: 'Data prevista' },
  { key: 'status', label: 'Status' },
  { key: 'responsavel_nome', label: 'Responsável' },
  { key: 'fase_nome', label: 'Fase' },
  { key: 'funil_nome', label: 'Funil' },
  { key: 'equipe_nome', label: 'Equipe' },
  { key: 'temperatura', label: 'Temperatura' },
  { key: 'created_at', label: 'Criado em' },
  { key: 'dias', label: 'Dias desde criação' },
];

export default function ExportLeadsModal({ open, onClose, teamId, funis, defaultFunilId }) {
  const [selectedFunilId, setSelectedFunilId] = useState(defaultFunilId || '');
  const [selectedFields, setSelectedFields] = useState(() => new Set(DEFAULT_FIELDS.map(f => f.key)));
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFunisSet, setSelectedFunisSet] = useState(new Set());
  const [selectAllFunis, setSelectAllFunis] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(false);

  useEffect(() => {
    setSelectedFunilId(defaultFunilId || '');
  }, [defaultFunilId]);

  // Ao abrir o modal, deixar todos os campos selecionados por padrão
  useEffect(() => {
    if (open) {
      setSelectedFields(new Set(DEFAULT_FIELDS.map(f => f.key)));
      // Select inicia como "Selecione" e limpa seleção múltipla
      setSelectedFunilId('');
      setSelectedFunisSet(new Set());
      setSelectAllFunis(false);
    }
  }, [open]);

  if (!open) return null;

  function toggleField(key) {
    setSelectedFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toCSV(rows, headers) {
    const headerLine = headers.map(h => h.label).join(',');
    const lines = rows.map(row => headers.map(h => {
      let v = row[h.key];
      if (v == null) v = '';
      if (typeof v === 'string') {
        // Escapar vírgulas/aspas/quebras
        const needsQuote = /[",\n]/.test(v);
        const s = v.replace(/"/g, '""');
        return needsQuote ? `"${s}"` : s;
      }
      return String(v);
    }).join(','));
    return [headerLine, ...lines].join('\n');
  }

  async function handleExport() {
    setError(null);
    // Resolve lista de funis a exportar: Todos -> todos ids; Selecionados -> selectedFunisSet; fallback -> select único
    const funilIds = (() => {
      if (selectAllFunis) return (funis || []).map(f => f.id);
      const fromChecks = Array.from(selectedFunisSet);
      if (fromChecks.length > 0) return fromChecks;
      if (selectedFunilId) return [selectedFunilId];
      return [];
    })();
    if (funilIds.length === 0) {
      setError('Selecione pelo menos um funil.');
      return;
    }
    if (selectedFields.size === 0) {
      setError('Selecione pelo menos um campo.');
      return;
    }

    setDownloading(true);
    try {
      const token = localStorage.getItem('token');
      // Buscar todos os funis selecionados em paralelo
      const requests = funilIds.map(fid => {
        const urlEquipe = teamId ? `${process.env.NEXT_PUBLIC_API_URL}/leads/equipe/${teamId}?funil_id=${fid}` : `${process.env.NEXT_PUBLIC_API_URL}/leads?funil_id=${fid}`;
        return fetch(urlEquipe, { headers: { Authorization: `Bearer ${token}` } })
          .then(async r => {
            if (!r.ok) {
              const r2 = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/leads?funil_id=${fid}`, { headers: { Authorization: `Bearer ${token}` } });
              if (!r2.ok) {
                let msg = '';
                try { const j = await r2.json(); msg = j?.error || j?.message || ''; } catch {}
                throw new Error(msg || `HTTP ${r2.status}`);
              }
              return r2.json();
            }
            return r.json();
          });
      });
      const results = await Promise.all(requests);
      const dataMerged = results.flat().filter(Boolean);
      if (!Array.isArray(dataMerged)) throw new Error('Resposta inesperada do servidor.');

      const headers = DEFAULT_FIELDS.filter(f => selectedFields.has(f.key));
      // Dedup por id caso algum lead apareça em múltiplos resultados
      const seen = new Set();
      const rows = dataMerged.filter(item => {
        if (!item?.id) return true;
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      }).map(item => ({
        ...item,
        data_prevista: item.data_prevista ? String(item.data_prevista).slice(0, 10) : '',
        created_at: item.created_at ? String(item.created_at).slice(0, 10) : '',
        valor: item.valor ?? 0,
      }));
      const csv = toCSV(rows, headers);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = funilIds.length > 1 ? 'leads_multifunis.csv' : `leads_funil_${funilIds[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.message ? `Erro ao exportar: ${e.message}` : 'Erro ao exportar. Tente novamente.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 style={{ margin: 0 }}>Exportar Leads</h3>
        </div>
        <div className={styles.content}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label>Funil</label>
              <div className={styles.dropdownWrapper}>
                <button type="button" className={styles.dropdownBtn} onClick={() => setOpenDropdown(v => !v)}>
                  {selectAllFunis ? 'Todos os funis' : (selectedFunisSet.size > 0 ? `${selectedFunisSet.size} funil(is) selecionado(s)` : 'Selecione')}
                </button>
                {openDropdown && (
                  <div className={styles.dropdownMenu}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <input type="checkbox" checked={selectAllFunis} onChange={(e) => {
                        const checked = e.target.checked;
                        setSelectAllFunis(checked);
                        if (checked) {
                          setSelectedFunisSet(new Set((funis || []).map(f => f.id)));
                        } else {
                          setSelectedFunisSet(new Set());
                        }
                      }} />
                      Todos
                    </label>
                    {(funis || []).map(f => (
                      <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={selectAllFunis || selectedFunisSet.has(f.id)}
                          onChange={() => {
                            setSelectAllFunis(false);
                            setSelectedFunisSet(prev => {
                              const next = new Set(prev);
                              if (next.has(f.id)) next.delete(f.id); else next.add(f.id);
                              return next;
                            });
                          }}
                        />
                        {f.nome}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Removido bloco de checkboxes fora do dropdown */}

          <div className={styles.field}>
            <label>Campos</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8 }}>
              {DEFAULT_FIELDS.map(f => (
                <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={selectedFields.has(f.key)} onChange={() => toggleField(f.key)} />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
          {error && (
            <div className={styles.errorText}>{error}</div>
          )}
        </div>
        <div className={styles.footer}>
          <button type="button" className={styles.ghostBtn} onClick={onClose}>Cancelar</button>
          <button type="button" className={styles.primaryBtn} disabled={downloading} onClick={handleExport}>
            {downloading ? 'Gerando...' : 'Exportar CSV'}
          </button>
        </div>
      </div>
    </div>
  );
}


