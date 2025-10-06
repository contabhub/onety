import { useEffect, useMemo, useState } from 'react';
import styles from './Cargos.module.css';
import PermissoesCargoModal from './PermissoesCargoModal';

export default function Cargos() {
  const [cargos, setCargos] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [cargoPermissoesAberto, setCargoPermissoesAberto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modulesOpen, setModulesOpen] = useState(false);
  const [modulesCargo, setModulesCargo] = useState(null);
  const [selectedModules, setSelectedModules] = useState([]);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const empresaId = typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem('userData')||'{}').EmpresaId) : null;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  // IDs numéricos para persistência no BD; labels apenas para UI
  const AVAILABLE_MODULES = [
    { id: 1, key: 'atendimento', label: 'Atendimento' },
    { id: 2, key: 'estrategico', label: 'Estratégico' },
    { id: 3, key: 'comercial', label: 'Comercial' },
    { id: 4, key: 'gestao_processos', label: 'Gestão de Processos' },
    { id: 5, key: 'contratual', label: 'Contratual' },
    { id: 6, key: 'financeiro', label: 'Financeiro' },
    { id: 7, key: 'auditoria', label: 'Auditoria' }
  ];
  const MODULE_ID_TO_LABEL = AVAILABLE_MODULES.reduce((acc, m) => { acc[m.id] = m.label; return acc; }, {});
  const MODULE_KEY_TO_ID = AVAILABLE_MODULES.reduce((acc, m) => { acc[m.key] = m.id; return acc; }, {});

  const [isSuperadmin, setIsSuperadmin] = useState(false);
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('userData') : null;
      const parsed = raw ? JSON.parse(raw) : null;
      const roleCandidates = [parsed?.userRole, parsed?.nivel].filter(Boolean).map(r => String(r).toLowerCase());
      const permsAdm = Array.isArray(parsed?.permissoes?.adm) ? parsed.permissoes.adm.map(v => String(v).toLowerCase()) : [];
      const superMatch = roleCandidates.includes('superadmin') || permsAdm.includes('superadmin');
      setIsSuperadmin(Boolean(superMatch));
    } catch {
      setIsSuperadmin(false);
    }
  }, []);

  const filtered = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return cargos.filter(c => (c.nome || '').toLowerCase().includes(q));
  }, [cargos, filtro]);

  const parseJsonSafe = async (res) => {
    try {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) return await res.json();
      const text = await res.text();
      try { return JSON.parse(text); } catch { return { error: text }; }
    } catch {
      return { error: 'Falha ao ler resposta' };
    }
  };

  const fetchCargos = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/cargos`, {
        headers: { Authorization: `Bearer ${token}`, 'x-empresa-id': empresaId }
      });
      if (!res.ok) {
        const err = await parseJsonSafe(res);
        console.error('Erro ao listar cargos:', err);
        setCargos([]);
        return;
      }
      const data = await parseJsonSafe(res);
      const list = Array.isArray(data) ? data : [];
      // Ocultar cargo Superadmin da listagem
      const withoutSuperadmin = list.filter(c => String(c?.nome || '').toLowerCase() !== 'superadmin');
      // Normaliza permissoes_modulos para IDs numéricos (se vierem como strings/keys)
      const normalized = withoutSuperadmin.map(c => ({
        ...c,
        permissoes_modulos: Array.isArray(c?.permissoes_modulos)
          ? c.permissoes_modulos.map(v => {
              if (typeof v === 'number') return v;
              const asNum = Number(v);
              if (!Number.isNaN(asNum)) return asNum;
              return MODULE_KEY_TO_ID[String(v)] || v; // último recurso mantém valor
            })
          : []
      }));
      setCargos(normalized);
    } catch (e) {
      console.error('Erro ao listar cargos', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCargos(); }, []);

  const salvarCargo = async () => {
    try {
      setLoading(true);
      const payload = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        empresa_id: empresaId,
        // Permissões serão definidas posteriormente na tela específica
        ...(isSuperadmin ? { permissoes_modulos: selectedModules } : {})
      };
      const res = await fetch(`${apiUrl}/cargos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await parseJsonSafe(res);
        throw new Error(typeof err?.error === 'string' ? err.error : 'Falha ao criar cargo');
      }
      const created = await parseJsonSafe(res);
      setOpen(false);
      setNome('');
      setDescricao('');
      setSelectedModules([]);
      fetchCargos();
      // opcional: abrir modal de permissões logo após criar
      if (created?.id) {
        const novo = { id: created.id, nome: payload.nome, descricao: payload.descricao, permissoes: {} };
        setCargoPermissoesAberto(novo);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openModulesForCargo = (cargo) => {
    setModulesCargo(cargo);
    const current = Array.isArray(cargo?.permissoes_modulos)
      ? cargo.permissoes_modulos.map(v => {
          if (typeof v === 'number') return v;
          const asNum = Number(v);
          if (!Number.isNaN(asNum)) return asNum;
          return MODULE_KEY_TO_ID[String(v)] || null;
        }).filter(Boolean)
      : [];
    setSelectedModules(current);
    setModulesOpen(true);
  };

  const toggleModule = (modId) => {
    setSelectedModules(prev => prev.includes(modId) ? prev.filter(m => m !== modId) : [...prev, modId]);
  };

  const salvarModulos = async () => {
    if (!modulesCargo) return;
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/cargos/${modulesCargo.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-empresa-id': empresaId
        },
        body: JSON.stringify({ permissoes_modulos: selectedModules })
      });
      if (!res.ok) {
        const err = await parseJsonSafe(res);
        throw new Error(typeof err?.error === 'string' ? err.error : 'Falha ao salvar módulos');
      }
      await fetchCargos();
      setModulesOpen(false);
      setModulesCargo(null);
      setSelectedModules([]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Cargos</h2>
        <div className={styles.actions}>
          <button className={styles.buttonPrimary} onClick={() => setOpen(true)}>Novo cargo</button>
        </div>
      </div>

      <div className={styles.searchRow}>
        <input className={styles.searchInput} placeholder="Buscar cargo" value={filtro} onChange={e=>setFiltro(e.target.value)} />
      </div>

      <table className={styles.table}>
        <thead className={styles.thead}>
          <tr>
            <th>#</th>
            <th>Nome</th>
            <th>Descrição</th>
            <th>Módulos</th>
            <th>Permissões (Atendimento)</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((c, i) => (
            <tr key={c.id} className={styles.row}>
              <td>{i+1}</td>
              <td>{c.nome}</td>
              <td>{c.descricao || '-'}</td>
              <td>
                {(Array.isArray(c.permissoes_modulos) ? c.permissoes_modulos : []).length > 0 ? (
                  (c.permissoes_modulos || []).map(m => (
                    <span key={m} className={styles.badge}>{MODULE_ID_TO_LABEL[m] || m}</span>
                  ))
                ) : (
                  <span className={styles.badge} style={{opacity:0.7}}>—</span>
                )}
              </td>
              <td>
                {Object.entries((c.permissoes||{}).atendimento||{}).map(([k, arr]) => (
                  <span key={k} className={styles.badge}>{k}: {(arr||[]).join(', ')}</span>
                ))}
              </td>
              <td>
                <div className={styles.actionsCol}>
                  <button className={`${styles.buttonPrimary} ${styles.tableActionButton}`} onClick={()=>setCargoPermissoesAberto(c)}>Permissões</button>
                  {isSuperadmin && (
                    <button className={`${styles.buttonPrimary} ${styles.tableActionButton}`} onClick={()=>openModulesForCargo(c)}>Módulos</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr className={styles.row}><td colSpan={6}>Nenhum cargo</td></tr>
          )}
        </tbody>
      </table>

      {open && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.title}>Novo cargo</h3>
              <button className={styles.btnSecondary} onClick={()=>setOpen(false)}>Fechar</button>
            </div>
            <div className={styles.modalContent}>
              <div className={styles.field}>
                <label className={styles.label}>Nome</label>
                <input className={styles.input} value={nome} onChange={e=>setNome(e.target.value)} placeholder="Ex: Atendente" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Descrição</label>
                <input className={styles.input} value={descricao} onChange={e=>setDescricao(e.target.value)} placeholder="Opcional" />
              </div>
              {isSuperadmin && (
                <div className={styles.field}>
                  <label className={styles.label}>Módulos deste cargo</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {AVAILABLE_MODULES.map(m => (
                      <label key={m.id} className={styles.badge} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={selectedModules.includes(m.id)}
                          onChange={() => toggleModule(m.id)}
                        />
                        {m.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={()=>setOpen(false)} disabled={loading}>Cancelar</button>
              <button className={styles.btnPrimary} onClick={salvarCargo} disabled={loading || !nome.trim()}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {cargoPermissoesAberto && (
        <PermissoesCargoModal
          cargo={cargoPermissoesAberto}
          onClose={()=>setCargoPermissoesAberto(null)}
          onSaved={()=>{ setCargoPermissoesAberto(null); fetchCargos(); }}
        />
      )}

      {modulesOpen && isSuperadmin && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.title}>Módulos do cargo</h3>
              <button className={styles.btnSecondary} onClick={()=>{ setModulesOpen(false); setModulesCargo(null); }}>Fechar</button>
            </div>
            <div className={styles.modalContent}>
              <div className={styles.field}>
                <label className={styles.label}>Selecione os módulos</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {AVAILABLE_MODULES.map(m => (
                    <label key={m.id} className={styles.badge} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={selectedModules.includes(m.id)}
                        onChange={() => toggleModule(m.id)}
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={()=>{ setModulesOpen(false); setModulesCargo(null); }} disabled={loading}>Cancelar</button>
              <button className={styles.btnPrimary} onClick={salvarModulos} disabled={loading}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


