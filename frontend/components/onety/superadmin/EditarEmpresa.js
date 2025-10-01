import { useEffect, useState } from 'react'
import { Building2, Upload, X } from 'lucide-react'
import styles from './EditarEmpresa.module.css'

export default function EditarEmpresa({ open, onClose, empresa, onUpdated }) {
  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [regimeTributario, setRegimeTributario] = useState('')
  const [logoPreview, setLogoPreview] = useState(null)
  const [logoFile, setLogoFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !empresa) return
    
    setNome(empresa.nome || '')
    setCnpj(empresa.cnpj || '')
    setRegimeTributario(empresa.regime_tributario || '')
    setLogoPreview(empresa.logo_url || null)
    setLogoFile(null)
    setError('')
  }, [open, empresa])

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    const url = URL.createObjectURL(file)
    setLogoPreview(url)
  }

  const handleSave = async () => {
    if (!empresa) return
    setLoading(true)
    setError('')
    
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    
    try {
      // 1) Atualiza campos básicos
      const res = await fetch(`${API_URL}/empresas/${empresa.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ 
          nome, 
          cnpj, 
          regime_tributario: regimeTributario 
        })
      })
      
      if (!res.ok) throw new Error('Falha ao atualizar dados da empresa')
      let updated = await res.json()

      // 2) Se houver novo logo, envia upload
      if (logoFile) {
        const form = new FormData()
        form.append('logo', logoFile)
        const up = await fetch(`${API_URL}/empresas/${empresa.id}/logo`, {
          method: 'PATCH',
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: form
        })
        if (!up.ok) throw new Error('Falha ao enviar logo')
        updated = await up.json()
      }

      onUpdated && onUpdated(updated)
      onClose && onClose()
    } catch (e) {
      setError(e?.message || 'Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <Building2 size={24} className={styles.titleIcon} />
            <h2>Editar Empresa</h2>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.form}>
          <div className={styles.logoRow}>
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className={styles.logo} />
            ) : (
              <div className={styles.logoFallback}>
                <Building2 size={32} color="white" />
              </div>
            )}
            <label className={styles.uploadBtn}>
              <Upload size={16} />
              Alterar logo
              <input type="file" accept="image/*" onChange={handleLogoChange} hidden />
            </label>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              Nome da Empresa
              <input 
                className={styles.input} 
                value={nome} 
                onChange={(e) => setNome(e.target.value)}
                placeholder="Digite o nome da empresa"
              />
            </label>
            
            <label className={styles.label}>
              CNPJ
              <input 
                className={styles.input} 
                value={cnpj} 
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </label>
            
            <label className={styles.label}>
              Regime Tributário
              <select 
                className={styles.select} 
                value={regimeTributario} 
                onChange={(e) => setRegimeTributario(e.target.value)}
              >
                <option value="">Selecione o regime</option>
                <option value="simples">Simples Nacional</option>
                <option value="lucro presumido">Lucro Presumido</option>
                <option value="lucro real">Lucro Real</option>
              </select>
            </label>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button className={styles.cancel} onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button className={styles.save} onClick={handleSave} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
