import { useEffect, useState } from 'react';
import styles from './Cargos.module.css';

const GROUPS = [
  { key: 'adm', label: 'ADM', actions: ['admin'] },
  { key: 'instancias', label: 'Instâncias', actions: ['conectar', 'desconectar', 'deletar', 'criar'] },
  { key: 'equipes', label: 'Equipes', actions: ['criar', 'editar', 'excluir'] },
  { key: 'usuarios', label: 'Usuários', actions: ['criar', 'editar', 'excluir'] },
  { key: 'cargos', label: 'Cargos', actions: ['visualizar', 'criar', 'editar', 'excluir'] },
  { key: 'contatos', label: 'Contatos', actions: ['criar', 'editar', 'deletar', 'importar', 'exportar'] },
  { key: 'etiquetas', label: 'Etiquetas', actions: ['criar', 'editar', 'excluir'] },
  { key: 'linksExternos', label: 'Links externos', actions: ['criar', 'editar', 'excluir'] },
  { key: 'webhooks', label: 'Webhooks', actions: ['criar', 'editar', 'excluir'] },
];

export default function PermissoesCargoModal({ cargo, onClose, onSaved }) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const empresaId = typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem('userData')||'{}').EmpresaId) : null;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const [perms, setPerms] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Carrega permissões existentes (nível raiz)
    const base = cargo?.permissoes || {};
    setPerms(base);
  }, [cargo]);

  const toggle = (group, action) => {
    setPerms(prev => {
      // Clona o estado atual
      const next = { ...prev };

      // Função auxiliar: verifica se todas as permissões (exceto ADM) estão totalmente marcadas
      const areAllSelected = (state) => {
        return GROUPS.filter(g => g.key !== 'adm').every(g => {
          const current = new Set(state[g.key] || []);
          return g.actions.every(a => current.has(a));
        });
      };

      // Se for o ADM, alterna seleção total
      if (group === 'adm' && action === 'admin') {
        const isAdmChecked = (next.adm || []).includes('admin');
        if (isAdmChecked) {
          // Desmarca ADM e limpa todas as outras permissões
          next.adm = [];
          GROUPS.forEach(g => {
            if (g.key !== 'adm') next[g.key] = [];
          });
        } else {
          // Marca todas as permissões de todos os grupos
          next.adm = ['admin'];
          GROUPS.forEach(g => {
            if (g.key !== 'adm') next[g.key] = [...g.actions];
          });
        }
        return next;
      }

      // Alternância padrão para grupos normais
      const set = new Set(next[group] || []);
      set.has(action) ? set.delete(action) : set.add(action);
      next[group] = Array.from(set);

      // Ajusta ADM conforme seleção total
      if (areAllSelected(next)) {
        next.adm = ['admin'];
      } else {
        next.adm = [];
      }

      return next;
    });
  };

  const save = async () => {
    try {
      setLoading(true);
      const payload = {
        empresa_id: empresaId,
        permissoes: perms
      };
      const res = await fetch(`${apiUrl}/cargos/${cargo.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-empresa-id': empresaId
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Falha ao salvar permissões');
      onSaved && onSaved();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!cargo) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3 className={styles.title}>Permissões — {cargo.nome}</h3>
          <button className={styles.btnSecondary} onClick={onClose}>Fechar</button>
        </div>
        <div className={styles.modalContent}>
          <div className={styles.permGrid}>
            {GROUPS.map(g => (
              <div key={g.key} className={styles.permCard}>
                <div className={styles.label}>{g.label}</div>
                <div className={styles.permList}>
                  {g.actions.map(a => (
                    <label key={a} style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <input type="checkbox" checked={(perms[g.key]||[]).includes(a)} onChange={()=>toggle(g.key,a)} />
                      <span>{a.charAt(0).toUpperCase() + a.slice(1)}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={save} disabled={loading}>Salvar</button>
        </div>
      </div>
    </div>
  );
}


