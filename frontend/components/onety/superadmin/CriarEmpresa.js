import { useState, useEffect } from 'react'
import { X, Building2, Save, AlertCircle, Plus, User } from 'lucide-react'
import styles from './CriarEmpresa.module.css'

export default function CriarEmpresa({ open, onClose, onCreated }) {
  const [formData, setFormData] = useState({
    nome: '',
    cnpj: '',
    razaoSocial: '',
    cep: '',
    rua: '',
    bairro: '',
    cidade: '',
    estado: '',
    numero: '',
    complemento: '',
    regime_tributario: 'simples',
    cnae_primario: '',
    cnae_descricao: '',
    cnae_classe: '',
    data_fundacao: '',
    optante_mei: false,
    inscricao_municipal: '',
    inscricao_estadual: '',
    tipo_empresa: 'nao_franqueado',
    logo_url: '',
    pesquisaSatisfacaoAtiva: false,
    admin_usuario_id: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [usuarios, setUsuarios] = useState([])
  const [showUsuarioModal, setShowUsuarioModal] = useState(false)
  const [novoUsuario, setNovoUsuario] = useState({ nome: '', email: '', senha: '' })

  // Carregar usuários quando o modal abre
  useEffect(() => {
    if (open) {
      loadUsuarios()
    }
  }, [open])

  const loadUsuarios = async () => {
    try {
      const token = localStorage.getItem('token')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      
      const response = await fetch(`${apiUrl}/usuarios?limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        const data = await response.json()
        setUsuarios(data.data || [])
      }
    } catch (err) {
      console.error('Erro ao carregar usuários:', err)
    }
  }

  const handleCreateUsuario = async () => {
    if (!novoUsuario.nome.trim() || !novoUsuario.email.trim() || !novoUsuario.senha.trim()) {
      setError('Nome, email e senha são obrigatórios')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      
      const response = await fetch(`${apiUrl}/usuarios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(novoUsuario)
      })

      if (response.ok) {
        const newUsuario = await response.json()
        setUsuarios(prev => [...prev, newUsuario])
        setFormData(prev => ({ ...prev, admin_usuario_id: newUsuario.id }))
        setNovoUsuario({ nome: '', email: '', senha: '' })
        setShowUsuarioModal(false)
        setError('')
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Erro ao criar usuário')
      }
    } catch (err) {
      setError('Erro de conexão ao criar usuário')
      console.error('Erro ao criar usuário:', err)
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const token = localStorage.getItem('token')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      
      const response = await fetch(`${apiUrl}/empresas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        const newEmpresa = await response.json()
        onCreated?.(newEmpresa)
        onClose()
        // Reset form
        setFormData({
          nome: '',
          cnpj: '',
          razaoSocial: '',
          cep: '',
          rua: '',
          bairro: '',
          cidade: '',
          estado: '',
          numero: '',
          complemento: '',
          regime_tributario: 'simples',
          cnae_primario: '',
          cnae_descricao: '',
          cnae_classe: '',
          data_fundacao: '',
          optante_mei: false,
          inscricao_municipal: '',
          inscricao_estadual: '',
          tipo_empresa: 'nao_franqueado',
          logo_url: '',
          pesquisaSatisfacaoAtiva: false,
          admin_usuario_id: ''
        })
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Erro ao criar empresa')
      }
    } catch (err) {
      setError('Erro de conexão')
      console.error('Erro ao criar empresa:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <Building2 size={24} />
            Nova Empresa
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.error}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Informações Básicas</h3>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label>Nome da Empresa *</label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleInputChange}
                  required
                  placeholder="Digite o nome da empresa"
                />
              </div>
              <div className={styles.field}>
                <label>CNPJ</label>
                <input
                  type="text"
                  name="cnpj"
                  value={formData.cnpj}
                  onChange={handleInputChange}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className={styles.field}>
                <label>Razão Social</label>
                <input
                  type="text"
                  name="razaoSocial"
                  value={formData.razaoSocial}
                  onChange={handleInputChange}
                  placeholder="Razão social da empresa"
                />
              </div>
              <div className={styles.field}>
                <label>Tipo de Empresa</label>
                <select
                  name="tipo_empresa"
                  value={formData.tipo_empresa}
                  onChange={handleInputChange}
                >
                  <option value="nao_franqueado">Não Franqueado</option>
                  <option value="franqueado">Franqueado</option>
                  <option value="franqueadora">Franqueadora</option>
                </select>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Endereço</h3>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label>CEP</label>
                <input
                  type="text"
                  name="cep"
                  value={formData.cep}
                  onChange={handleInputChange}
                  placeholder="00000-000"
                />
              </div>
              <div className={styles.field}>
                <label>Rua</label>
                <input
                  type="text"
                  name="rua"
                  value={formData.rua}
                  onChange={handleInputChange}
                  placeholder="Nome da rua"
                />
              </div>
              <div className={styles.field}>
                <label>Número</label>
                <input
                  type="text"
                  name="numero"
                  value={formData.numero}
                  onChange={handleInputChange}
                  placeholder="123"
                />
              </div>
              <div className={styles.field}>
                <label>Complemento</label>
                <input
                  type="text"
                  name="complemento"
                  value={formData.complemento}
                  onChange={handleInputChange}
                  placeholder="Sala 101"
                />
              </div>
              <div className={styles.field}>
                <label>Bairro</label>
                <input
                  type="text"
                  name="bairro"
                  value={formData.bairro}
                  onChange={handleInputChange}
                  placeholder="Nome do bairro"
                />
              </div>
              <div className={styles.field}>
                <label>Cidade</label>
                <input
                  type="text"
                  name="cidade"
                  value={formData.cidade}
                  onChange={handleInputChange}
                  placeholder="Nome da cidade"
                />
              </div>
              <div className={styles.field}>
                <label>Estado</label>
                <select
                  name="estado"
                  value={formData.estado}
                  onChange={handleInputChange}
                >
                  <option value="">Selecione</option>
                  <option value="AC">Acre</option>
                  <option value="AL">Alagoas</option>
                  <option value="AP">Amapá</option>
                  <option value="AM">Amazonas</option>
                  <option value="BA">Bahia</option>
                  <option value="CE">Ceará</option>
                  <option value="DF">Distrito Federal</option>
                  <option value="ES">Espírito Santo</option>
                  <option value="GO">Goiás</option>
                  <option value="MA">Maranhão</option>
                  <option value="MT">Mato Grosso</option>
                  <option value="MS">Mato Grosso do Sul</option>
                  <option value="MG">Minas Gerais</option>
                  <option value="PA">Pará</option>
                  <option value="PB">Paraíba</option>
                  <option value="PR">Paraná</option>
                  <option value="PE">Pernambuco</option>
                  <option value="PI">Piauí</option>
                  <option value="RJ">Rio de Janeiro</option>
                  <option value="RN">Rio Grande do Norte</option>
                  <option value="RS">Rio Grande do Sul</option>
                  <option value="RO">Rondônia</option>
                  <option value="RR">Roraima</option>
                  <option value="SC">Santa Catarina</option>
                  <option value="SP">São Paulo</option>
                  <option value="SE">Sergipe</option>
                  <option value="TO">Tocantins</option>
                </select>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Informações Tributárias</h3>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label>Regime Tributário</label>
                <select
                  name="regime_tributario"
                  value={formData.regime_tributario}
                  onChange={handleInputChange}
                >
                  <option value="simples">Simples Nacional</option>
                  <option value="lucro_presumido">Lucro Presumido</option>
                  <option value="lucro_real">Lucro Real</option>
                </select>
              </div>
              <div className={styles.field}>
                <label>CNAE Primário</label>
                <input
                  type="text"
                  name="cnae_primario"
                  value={formData.cnae_primario}
                  onChange={handleInputChange}
                  placeholder="0000-0/00"
                />
              </div>
              <div className={styles.field}>
                <label>Data de Fundação</label>
                <input
                  type="date"
                  name="data_fundacao"
                  value={formData.data_fundacao}
                  onChange={handleInputChange}
                />
              </div>
              <div className={styles.field}>
                <label>Inscrição Municipal</label>
                <input
                  type="text"
                  name="inscricao_municipal"
                  value={formData.inscricao_municipal}
                  onChange={handleInputChange}
                  placeholder="00000000"
                />
              </div>
              <div className={styles.field}>
                <label>Inscrição Estadual</label>
                <input
                  type="text"
                  name="inscricao_estadual"
                  value={formData.inscricao_estadual}
                  onChange={handleInputChange}
                  placeholder="000000000"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    name="optante_mei"
                    checked={formData.optante_mei}
                    onChange={handleInputChange}
                  />
                  Optante MEI
                </label>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Configurações</h3>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label>URL da Logo</label>
                <input
                  type="url"
                  name="logo_url"
                  value={formData.logo_url}
                  onChange={handleInputChange}
                  placeholder="https://exemplo.com/logo.png"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    name="pesquisaSatisfacaoAtiva"
                    checked={formData.pesquisaSatisfacaoAtiva}
                    onChange={handleInputChange}
                  />
                  Pesquisa de Satisfação Ativa
                </label>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Usuário Administrador</h3>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label>Usuário Responsável *</label>
                <div className={styles.usuarioRow}>
                  <select
                    className={styles.usuarioSelect}
                    name="admin_usuario_id"
                    value={formData.admin_usuario_id}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Selecione um usuário</option>
                    {usuarios.map(usuario => (
                      <option key={usuario.id} value={usuario.id}>
                        {usuario.nome} ({usuario.email})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={styles.addUsuarioBtn}
                    onClick={() => setShowUsuarioModal(true)}
                  >
                    <Plus size={16} />
                    Novo Usuário
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelButton}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.saveButton}
              disabled={loading}
            >
              <Save size={16} />
              {loading ? 'Criando...' : 'Criar Empresa'}
            </button>
          </div>
        </form>

        {/* Modal para criar novo usuário */}
        {showUsuarioModal && (
          <div className={styles.backdrop} onClick={() => setShowUsuarioModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.header}>
                <div className={styles.headerTitle}>
                  <User size={20} />
                  Novo Usuário
                </div>
                <button className={styles.closeButton} onClick={() => setShowUsuarioModal(false)}>
                  <X size={16} />
                </button>
              </div>
              
              <div className={styles.form}>
                <div className={styles.field}>
                  <label>Nome *</label>
                  <input
                    type="text"
                    value={novoUsuario.nome}
                    onChange={(e) => setNovoUsuario(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="Digite o nome do usuário"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label>Email *</label>
                  <input
                    type="email"
                    value={novoUsuario.email}
                    onChange={(e) => setNovoUsuario(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Digite o email do usuário"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label>Senha *</label>
                  <input
                    type="password"
                    value={novoUsuario.senha}
                    onChange={(e) => setNovoUsuario(prev => ({ ...prev, senha: e.target.value }))}
                    placeholder="Digite a senha do usuário"
                    required
                  />
                </div>
                
                <div className={styles.actions}>
                  <button
                    type="button"
                    onClick={() => setShowUsuarioModal(false)}
                    className={styles.cancelButton}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateUsuario}
                    className={styles.saveButton}
                  >
                    <Save size={16} />
                    Criar Usuário
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
