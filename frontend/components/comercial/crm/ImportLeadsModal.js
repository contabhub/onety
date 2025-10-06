import React, { useEffect, useMemo, useState } from 'react';
import styles from '../../../styles/comercial/crm/ImportLeadsModal.module.css';

export default function ImportLeadsModal({
  open,
  onClose,
  teamId,
  funis,
  funilSelecionado,
  fases,
  membrosEquipe,
  onImported,
}) {
  const [selectedFunilId, setSelectedFunilId] = useState('');
  const [selectedFaseId, setSelectedFaseId] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [file, setFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0); // força reset do input após erro
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [fasesDoFunil, setFasesDoFunil] = useState([]);
  const [temperatura, setTemperatura] = useState('neutro');

  // Quando mudar o funil selecionado, limpar a fase selecionada e buscar as fases do funil
  useEffect(() => {
    setSelectedFaseId(null);
    setFasesDoFunil([]);
    async function fetchFases() {
      if (!selectedFunilId) return;
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/funil_fases/${selectedFunilId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setFasesDoFunil(Array.isArray(data) ? data : []);
      } catch (e) {
        setFasesDoFunil([]);
      }
    }
    fetchFases();
  }, [selectedFunilId]);

  if (!open) return null;

  function downloadModelo() {
    const header = ['name','email','telefone','valor','data_prevista','status'];
    const linhasExemplo = [
      ['Maria Silva','maria@example.com','(11) 91234-5678','1500.50','2025-09-30','aberto'],
      ['João Souza','joao@example.com','(21) 99876-5432','0','','aberto'],
    ];
    const csv = [header.join(','), ...linhasExemplo.map(l => l.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_importacao_leads.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function parseCSVText(text) {
    // Parser simples: separa por linhas e vírgulas/; ignora aspas básicas
    const linhas = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (linhas.length === 0) return [];
    const header = linhas[0].split(/[,;]\s*/).map(h => h.trim().toLowerCase());
    const idx = (k) => header.indexOf(k);
    const rows = [];
    for (let i = 1; i < linhas.length; i++) {
      const cols = linhas[i].split(/[,;](?=(?:[^"]*\"[^"]*\")*[^"]*$)/).map(c => c.replace(/^\"|\"$/g,'').trim());
      rows.push({
        name: cols[idx('name')] || '',
        email: cols[idx('email')] || '',
        telefone: cols[idx('telefone')] || '',
        valor: cols[idx('valor')] || '',
        data_prevista: cols[idx('data_prevista')] || '',
        status: cols[idx('status')] || 'aberto',
      });
    }
    return rows;
  }

  function normalizeValor(raw) {
    if (raw == null) return 0;
    const s = String(raw).trim();
    if (!s) return 0;
    const noSpaces = s.replace(/\s/g, '');
    let normalized = noSpaces;
    const hasDot = noSpaces.includes('.');
    const hasComma = noSpaces.includes(',');
    if (/e\+|e\-/i.test(noSpaces)) {
      // notação científica, só troca vírgula por ponto
      normalized = noSpaces.replace(/,/g, '.');
    } else if (hasDot && hasComma) {
      // Assume ponto como separador de milhar e vírgula como decimal: 1.234,56
      normalized = noSpaces.replace(/\./g, '').replace(/,/g, '.');
    } else if (!hasDot && hasComma) {
      // Apenas vírgula presente => decimal
      normalized = noSpaces.replace(/,/g, '.');
    } else {
      // Apenas ponto ou apenas dígitos => já é decimal com ponto
      normalized = noSpaces;
    }
    const n = parseFloat(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  function normalizeDate(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s || s === '########') return null;
    // Suporta dd/mm/yyyy e yyyy-mm-dd
    const ddmmyyyy = s.match(/^([0-3]?\d)[\/.-]([01]?\d)[\/.-](\d{4})$/);
    if (ddmmyyyy) {
      const [_, d, m, y] = ddmmyyyy;
      const dia = d.padStart(2, '0');
      const mes = m.padStart(2, '0');
      return `${y}-${mes}-${dia}`;
    }
    const iso = s.match(/^\d{4}-\d{2}-\d{2}$/);
    return iso ? s : null;
  }

  function readFileAsText(f) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Leitura do arquivo falhou'));
      try {
        reader.readAsText(f, 'utf-8');
      } catch (e) {
        reject(e);
      }
    });
  }

  async function handleImport(e) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!file) { setError('Selecione um arquivo CSV.'); return; }
    if (!teamId || !selectedFunilId || !selectedFaseId || !selectedUserId) {
      setError('Selecione vendedor, funil e fase.');
      return;
    }

    setParsing(true);
    try {
      let text = '';
      try {
        // Tenta API moderna
        text = await file.text();
      } catch (readErr) {
        // Fallback com FileReader
        try {
          text = await readFileAsText(file);
        } catch (fallbackErr) {
          setError('Não foi possível ler o arquivo. Verifique se o arquivo não está aberto em outro programa e tente novamente.');
          // reseta input para permitir nova seleção
          setFile(null);
          setFileInputKey(prev => prev + 1);
          setParsing(false);
          return;
        }
      }
      let items = parseCSVText(text).filter(r => (r.name || '').trim().length > 0);
      // Normalizações antes do envio
      items = items.map(r => ({
        ...r,
        valor: normalizeValor(r.valor),
        data_prevista: normalizeDate(r.data_prevista),
      }));
      if (items.length === 0) {
        setError('Arquivo sem registros válidos.');
        setParsing(false);
        return;
      }

      const token = localStorage.getItem('token');
      const funilId = selectedFunilId;
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/leads/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          team_id: teamId,
          funil_id: Number(funilId),
          fase_funil_id: Number(selectedFaseId),
          user_id: Number(selectedUserId),
          temperatura_padrao: temperatura,
          leads: items,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || 'Falha ao importar');
      }
      setResult(data);
      if (onImported) onImported({ funilId });
    } catch (err) {
      // Normaliza mensagens para pt-BR
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('could not be read') || msg.includes('notreadableerror')) {
        setError('Não foi possível ler o arquivo. Feche programas que estejam usando o arquivo e tente novamente.');
      } else if (msg.includes('permission')) {
        setError('Sem permissão para acessar o arquivo. Copie o arquivo para sua área de trabalho e tente de novo.');
      } else if (msg.includes('network') || msg.includes('fetch')) {
        setError('Falha de conexão ao enviar a planilha. Verifique sua internet e tente novamente.');
      } else {
        setError('Erro ao importar. Tente novamente.');
      }
    } finally {
      setParsing(false);
    }
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 style={{ margin: 0 }}>Importar Leads por Planilha (CSV)</h3>
        </div>
        <div className={styles.content}>
          <div className={styles.helperText}>
            Baixe o modelo, preencha as colunas e envie o arquivo CSV.
          </div>
          <button type="button" onClick={downloadModelo} className={styles.secondaryBtn}>Baixar modelo CSV</button>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Vendedor responsável</label>
              <select className={styles.select} value={selectedUserId || ''} onChange={e => setSelectedUserId(e.target.value)}>
                <option value="">Selecione</option>
                {membrosEquipe
                  .filter(m => m.role !== 'superadmin')
                  .map(m => (
                    <option key={m.userId} value={m.userId}>{m.full_name}</option>
                  ))}
              </select>
            </div>
            <div className={styles.field}>
              <label>Funil</label>
              <select className={styles.select} value={selectedFunilId} onChange={e => setSelectedFunilId(Number(e.target.value) || '')}>
                <option value="">Selecione</option>
                {(funis || []).map(f => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label>Fase</label>
              <select className={styles.select} value={selectedFaseId || ''} onChange={e => setSelectedFaseId(Number(e.target.value))} disabled={!selectedFunilId}>
                <option value="">Selecione</option>
                {(fasesDoFunil || []).map(f => (
                  <option key={f.id} value={f.id}>{f.nome || f.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label>Arquivo CSV</label>
            <input key={fileInputKey} className={styles.input} type="file" accept=".csv,text/csv" onChange={e => setFile(e.target.files?.[0] || null)} />
          </div>

          <div className={styles.field}>
            <label>Temperatura padrão</label>
            <select className={styles.select} value={temperatura} onChange={e => setTemperatura(e.target.value)}>
              <option value="neutro">Neutro</option>
              <option value="frio">Frio</option>
              <option value="quente">Quente</option>
            </select>
          </div>

          <div className={styles.helperText}>
            Colunas esperadas: name, email, telefone, valor, data_prevista (YYYY-MM-DD), status
          </div>

          {error && (
            <div className={styles.errorText}>{error}</div>
          )}
          {result && (
            <div className={styles.successText}>
              Importação concluída. Inseridos: {result.inseridos} | Ignorados: {result.ignorados}
            </div>
          )}
        </div>
        <div className={styles.footer}>
          <button type="button" onClick={onClose} className={styles.ghostBtn}>Cancelar</button>
          <button type="button" onClick={handleImport} disabled={parsing} className={styles.primaryBtn}>
            {parsing ? 'Importando...' : 'Importar'}
          </button>
        </div>
      </div>
    </div>
  );
}

