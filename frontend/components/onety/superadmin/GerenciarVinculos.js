import { useEffect, useState } from 'react'
import { X, Building2, Plus, Trash2, Users, UserCheck, User, Shield } from 'lucide-react'
import SpaceLoader from '../menu/SpaceLoader'
import styles from './GerenciarVinculos.module.css'

export default function GerenciarVinculos({ open, onClose, usuario, onUpdated }) {
  const [loading, setLoading] = useState(false)
  const [empresas, setEmpresas] = useState([])
  const [vinculos, setVinculos] = useState([])
  const [showNovoVinculo, setShowNovoVinculo] = useState(false)
  const [empresaSelecionada, setEmpresaSelecionada] = useState('')
  const [cargoSelecionado, setCargoSelecionado] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [cargosEmpresa, setCargosEmpresa] = useState([])
  const [loadingCargos, setLoadingCargos] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !usuario) return
    
    const fetchData = async () => {
      setLoading(true)
      try {
        const token = localStorage.getItem('token')
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
        
        // Buscar empresas disponíveis
        const empresasResponse = await fetch(`${API_URL}/empresas?limit=100`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        
        if (empresasResponse.ok) {
          const empresasData = await empresasResponse.json()
          setEmpresas(empresasData.data || [])
        }

        // Buscar vínculos atuais do usuário
        const vinculosResponse = await fetch(`${API_URL}/usuarios-empresas?usuario_id=${usuario.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        
        if (vinculosResponse.ok) {
          const vinculosData = await vinculosResponse.json()
          const vinculos = vinculosData.data || []
          
          // Para cada vínculo, buscar dados completos da empresa e cargo
          const vinculosCompletos = await Promise.all(
            vinculos.map(async (vinculo) => {
              try {
                // Buscar dados da empresa
                const empresaResponse = await fetch(`${API_URL}/empresas/${vinculo.empresa_id}`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                })
                
                let empresa = null
                if (empresaResponse.ok) {
                  empresa = await empresaResponse.json()
                }
                
                // Buscar dados do cargo
                let cargo = null
                if (vinculo.cargo_id) {
                  const cargoResponse = await fetch(`${API_URL}/cargos`, {
                    method: 'GET',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'x-empresa-id': vinculo.empresa_id.toString()
                    }
                  })
                  
                  if (cargoResponse.ok) {
                    const cargos = await cargoResponse.json()
                    cargo = cargos.find(c => c.id === vinculo.cargo_id)
                  }
                }
                
                return {
                  ...vinculo,
                  empresa_nome: empresa?.nome || 'Empresa não encontrada',
                  cargo: cargo || { nome: 'Cargo não encontrado' }
                }
              } catch (error) {
                console.error(`Erro ao buscar detalhes do vínculo ${vinculo.id}:`, error)
                return {
                  ...vinculo,
                  empresa_nome: 'Erro ao carregar',
                  cargo: { nome: 'Erro ao carregar' }
                }
              }
            })
          )
          
          setVinculos(vinculosCompletos)
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error)
        setError('Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [open, usuario])

  // Buscar cargos da empresa selecionada
  const fetchCargosEmpresa = async (empresaId) => {
    if (!empresaId) {
      setCargosEmpresa([])
      return
    }

    setLoadingCargos(true)
    try {
      const token = localStorage.getItem('token')
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      
      const response = await fetch(`${API_URL}/cargos`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-empresa-id': empresaId.toString()
        }
      })

      if (response.ok) {
        const cargos = await response.json()
        setCargosEmpresa(cargos || [])
      } else {
        setCargosEmpresa([])
      }
    } catch (error) {
      console.error('Erro ao buscar cargos:', error)
      setCargosEmpresa([])
    } finally {
      setLoadingCargos(false)
    }
  }

  // Buscar cargos quando empresa for selecionada
  useEffect(() => {
    if (empresaSelecionada) {
      fetchCargosEmpresa(empresaSelecionada)
      setCargoSelecionado('') // Reset cargo selection
    } else {
      setCargosEmpresa([])
      setCargoSelecionado('')
    }
  }, [empresaSelecionada])

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return <Shield size={16} />
      case 'rh': return <User size={16} />
      case 'gestor': return <UserCheck size={16} />
      case 'usuario': return <User size={16} />
      default: return <User size={16} />
    }
  }

  const getRoleLabel = (cargo) => {
    if (typeof cargo === 'object' && cargo.nome) {
      return cargo.nome
    }
    return 'Cargo não definido'
  }

  const handleNovoVinculo = async () => {
    if (!empresaSelecionada || !cargoSelecionado) {
      setError('Selecione uma empresa e cargo')
      return
    }

    setLoading(true)
    setError('')
    
    try {
      const token = localStorage.getItem('token')
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      
      const response = await fetch(`${API_URL}/usuarios-empresas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          usuario_id: usuario.id,
          empresa_id: parseInt(empresaSelecionada),
          cargo_id: parseInt(cargoSelecionado),
          departamento: departamento || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Erro ao criar vínculo')
      }

      // Atualizar lista de vínculos
      const novoVinculo = await response.json()
      setVinculos(prev => [...prev, novoVinculo])
      
      // Resetar formulário
      setEmpresaSelecionada('')
      setCargoSelecionado('')
      setDepartamento('')
      setCargosEmpresa([])
      setShowNovoVinculo(false)
      
      onUpdated && onUpdated()
    } catch (error) {
      setError(error.message || 'Erro ao criar vínculo')
    } finally {
      setLoading(false)
    }
  }

  const handleDesvincular = async (vinculoId) => {
    if (!confirm('Tem certeza que deseja desvincular este usuário da empresa?')) return

    setLoading(true)
    setError('')
    
    try {
      const token = localStorage.getItem('token')
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      
      const response = await fetch(`${API_URL}/usuarios-empresas/${vinculoId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Erro ao desvincular usuário')
      }

      // Atualizar lista de vínculos
      setVinculos(prev => prev.filter(v => v.id !== vinculoId))
      
      onUpdated && onUpdated()
    } catch (error) {
      setError(error.message || 'Erro ao desvincular usuário')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <div className={styles.userAvatar}>
              {usuario.avatar_url ? (
                <img src={usuario.avatar_url} alt="Avatar" className={styles.avatar} />
              ) : (
                <div className={styles.avatarFallback}>
                  {(usuario.nome || usuario.name || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h2>Empresas de {usuario.nome || usuario.name}</h2>
              <p className={styles.userEmail}>{usuario.email}</p>
            </div>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          {loading && !showNovoVinculo ? (
            <div className={styles.loadingContainer}>
              <SpaceLoader label="Carregando vínculos..." />
            </div>
          ) : (
            <>
              {/* Lista de Vínculos Atuais */}
              <div className={styles.vinculosSection}>
                <div className={styles.sectionHeader}>
                  <h3>Vínculos Atuais ({vinculos.length})</h3>
                  <button 
                    className={styles.novoVinculoBtn}
                    onClick={() => setShowNovoVinculo(true)}
                  >
                    <Plus size={16} />
                    Novo Vínculo
                  </button>
                </div>

                {vinculos.length === 0 ? (
                  <div className={styles.emptyState}>
                    <Building2 size={48} />
                    <p>Nenhum vínculo encontrado</p>
                  </div>
                ) : (
                  <div className={styles.vinculosList}>
                    {vinculos.map((vinculo) => (
                      <div key={vinculo.id} className={styles.vinculoCard}>
                        <div className={styles.vinculoInfo}>
                          <div className={styles.empresaIcon}>
                            <Building2 size={20} />
                          </div>
                        <div className={styles.vinculoDetails}>
                          <h4>{vinculo.empresa_nome || 'Empresa não encontrada'}</h4>
                          <p>ID: {vinculo.empresa_id}</p>
                          {vinculo.departamento && (
                            <p>Depto: {vinculo.departamento}</p>
                          )}
                        </div>
                        </div>
                        <div className={styles.vinculoActions}>
                          <div className={styles.roleBadge}>
                            <Users size={16} />
                            <span>{getRoleLabel(vinculo.cargo)}</span>
                          </div>
                          <button 
                            className={styles.desvincularBtn}
                            onClick={() => handleDesvincular(vinculo.id)}
                            disabled={loading}
                          >
                            <Trash2 size={14} />
                            Desvincular
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Formulário de Novo Vínculo */}
              {showNovoVinculo && (
                <div className={styles.novoVinculoSection}>
                  <h3>Novo Vínculo</h3>
                  
                  <div className={styles.form}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label}>
                        <Building2 size={16} />
                        Empresa
                        <select 
                          className={styles.select}
                          value={empresaSelecionada}
                          onChange={(e) => setEmpresaSelecionada(e.target.value)}
                        >
                          <option value="">Selecione uma empresa</option>
                          {empresas.map(empresa => (
                            <option key={empresa.id} value={empresa.id}>
                              {empresa.nome}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className={styles.label}>
                        <Users size={16} />
                        Cargo
                        <select 
                          className={styles.select}
                          value={cargoSelecionado}
                          onChange={(e) => setCargoSelecionado(e.target.value)}
                          disabled={!empresaSelecionada || loadingCargos}
                        >
                          <option value="">
                            {loadingCargos ? 'Carregando cargos...' : !empresaSelecionada ? 'Selecione uma empresa primeiro' : 'Selecione um cargo'}
                          </option>
                          {cargosEmpresa.map(cargo => (
                            <option key={cargo.id} value={cargo.id}>
                              {cargo.nome}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className={styles.label}>
                      <Building2 size={16} />
                      Departamento (opcional)
                      <input 
                        className={styles.input}
                        type="text"
                        value={departamento}
                        onChange={(e) => setDepartamento(e.target.value)}
                        placeholder="Ex: Vendas, Marketing, TI..."
                      />
                    </label>

                    {error && <div className={styles.error}>{error}</div>}

                    <div className={styles.formActions}>
                      <button 
                        className={styles.cancelBtn}
                        onClick={() => {
                          setShowNovoVinculo(false)
                          setError('')
                          setEmpresaSelecionada('')
                          setCargoSelecionado('')
                          setDepartamento('')
                          setCargosEmpresa([])
                        }}
                      >
                        Cancelar
                      </button>
                      <button 
                        className={styles.saveBtn}
                        onClick={handleNovoVinculo}
                        disabled={loading || !empresaSelecionada || !cargoSelecionado || loadingCargos}
                      >
                        {loading ? 'Criando...' : 'Criar Vínculo'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.totalInfo}>
            Total: {vinculos.length} empresa{vinculos.length !== 1 ? 's' : ''}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
