import { useState, useEffect } from 'react';
import { Mail, Phone, AlertTriangle, CheckCircle } from 'lucide-react';
import styles from './Conta.module.css';

export default function Conta() {
  const [formData, setFormData] = useState({
    // Dados da empresa
    nome: '',
    tipoEmpresa: '',
    razaoSocial: '',
    cnpj: '',
    administrador: '',
    situacaoConta: '',
    
    // Dados para contato
    email: '',
    telefone: '',
    
    // Endereço
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);

  // Função para buscar dados da empresa
  const fetchCompanyData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Buscar EmpresaId do userData
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const companyId = userData.EmpresaId;
      if (!companyId) {
        throw new Error('ID da empresa não encontrado. Faça login novamente.');
      }
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('URL da API não configurada.');
      }
      
      const response = await fetch(`${apiUrl}/empresas/${companyId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar dados da empresa');
      }

      const data = await response.json();
      
      // Mapear os dados da API para o formato do formulário
      setFormData({
        nome: data.nome || '',
        tipoEmpresa: data.tipo_empresa || '',
        razaoSocial: data.razaoSocial || '',
        cnpj: data.cnpj || '',
        administrador: data.admin_user_id || '',
        situacaoConta: data.status || '',
        email: userData.email || '',
        telefone: userData.telefone || '',
        cep: data.cep || '',
        logradouro: data.rua || '',
        numero: data.numero || '',
        complemento: data.complemento || '',
        bairro: data.bairro || '',
        cidade: data.cidade || '',
        estado: data.estado || ''
      });

      // Buscar usuários da empresa e filtrar administradores
      await fetchCompanyAdmins(companyId, data.admin_user_id);
    } catch (err) {
      console.error('Erro ao buscar dados da empresa:', err);
      setError('Erro ao carregar dados da empresa. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Buscar usuários da empresa e filtrar por roles de administração
  const fetchCompanyAdmins = async (companyId, currentAdminId) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = localStorage.getItem('token');
      const resp = await fetch(`${apiUrl}/atendimento/usuarios/company/${companyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!resp.ok) {
        throw new Error('Erro ao buscar usuários da empresa');
      }
      const payload = await resp.json();
      const users = payload.users || [];
      // Considerar administradores, exceto Superadmin
      const adminRoles = new Set(['Admin', 'Administrador']);
      const admins = users
        .filter(u => adminRoles.has(u.role))
        .filter(u => u.role !== 'Superadmin' && u.id !== 8);
      setAdminUsers(admins);
      // Se não houver admin selecionado ainda, e existir admin_id, garantir no form
      if (!formData.administrador && payload.admin_id) {
        setFormData(prev => ({ ...prev, administrador: payload.admin_id }));
      }
    } catch (err) {
      console.error('Erro ao carregar administradores da empresa:', err);
      // Não quebra a tela; apenas deixa o select vazio
    }
  };

  // Função para salvar dados da empresa
  const saveCompanyData = async (data) => {
    try {
      setSaving(true);
      setError(null);
      
      // Buscar EmpresaId do userData
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const companyId = userData.EmpresaId;
      if (!companyId) {
        throw new Error('ID da empresa não encontrado. Faça login novamente.');
      }
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('URL da API não configurada.');
      }
      
      const response = await fetch(`${apiUrl}/empresas/${companyId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nome: data.nome,
          tipo_empresa: data.tipoEmpresa,
          razaoSocial: data.razaoSocial,
          cnpj: data.cnpj,
          cep: data.cep,
          rua: data.logradouro,
          numero: data.numero,
          complemento: data.complemento,
          bairro: data.bairro,
          cidade: data.cidade,
          estado: data.estado,
          status: data.situacaoConta,
          admin_usuario_id: data.administrador ? parseInt(data.administrador, 10) : null
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao salvar dados da empresa');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Erro ao salvar dados da empresa:', err);
      setError('Erro ao salvar dados. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await saveCompanyData(formData);
  };

  // Verificar se os dados necessários estão disponíveis
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const companyId = userData.EmpresaId;
    
    if (!token) {
      setError('Token de autenticação não encontrado. Faça login novamente.');
      setLoading(false);
      return;
    }
    
    if (!companyId) {
      setError('ID da empresa não encontrado. Faça login novamente.');
      setLoading(false);
      return;
    }
    
    // Carregar dados da empresa
    fetchCompanyData();
  }, []);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Carregando dados da empresa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Conta</h1>
      
      {/* Mensagens de erro e sucesso */}
      {error && (
        <div className={styles.errorMessage}>
          <AlertTriangle size={20} />
          <div className={styles.errorContent}>
            <p>{error}</p>
            <button 
              onClick={() => {
                setError(null);
                fetchCompanyData();
              }}
              className={styles.retryButton}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}
      
      {success && (
        <div className={styles.successMessage}>
          <CheckCircle size={20} />
          Dados salvos com sucesso!
        </div>
      )}
      
      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Dados da empresa */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Dados da empresa</h2>
          
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label htmlFor="nome" className={styles.label}>
                Nome *
              </label>
              <input
                type="text"
                id="nome"
                name="nome"
                value={formData.nome}
                onChange={handleInputChange}
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="tipoEmpresa" className={styles.label}>
                Tipo da empresa *
              </label>
              <select
                id="tipoEmpresa"
                name="tipoEmpresa"
                value={formData.tipoEmpresa}
                onChange={handleInputChange}
                className={styles.select}
                required
              >
                <option value="LTDA">LTDA</option>
                <option value="SA">SA</option>
                <option value="MEI">MEI</option>
                <option value="EI">EI</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="razaoSocial" className={styles.label}>
                Razão social
              </label>
              <input
                type="text"
                id="razaoSocial"
                name="razaoSocial"
                value={formData.razaoSocial}
                onChange={handleInputChange}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="cnpj" className={styles.label}>
                CNPJ
              </label>
              <input
                type="text"
                id="cnpj"
                name="cnpj"
                value={formData.cnpj}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="administrador" className={styles.label}>
                Administrador *
              </label>
              <select
                id="administrador"
                name="administrador"
                value={formData.administrador}
                onChange={handleInputChange}
                className={styles.select}
                required
              >
                <option value="">Selecione...</option>
                {adminUsers.map(user => (
                  <option key={user.id} value={user.id}>{user.nome} ({user.role})</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="situacaoConta" className={styles.label}>
                Situação da conta
              </label>
              <select
                id="situacaoConta"
                name="situacaoConta"
                value={formData.situacaoConta}
                onChange={handleInputChange}
                className={styles.select}
              >
                <option value="Ativa">Ativa</option>
                <option value="Inativa">Inativa</option>
                <option value="Suspensa">Suspensa</option>
              </select>
            </div>
          </div>
        </section>

        {/* Dados para contato */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Dados para contato</h2>
          
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.label}>
                Email (do usuário logado)
              </label>
              <div className={styles.inputWithIcon}>
                <Mail size={16} className={styles.inputIcon} />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={styles.input}
                  disabled
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="telefone" className={styles.label}>
                Telefone (do usuário logado)
              </label>
              <div className={styles.inputWithIcon}>
                <Phone size={16} className={styles.inputIcon} />
                <input
                  type="tel"
                  id="telefone"
                  name="telefone"
                  value={formData.telefone}
                  onChange={handleInputChange}
                  className={styles.input}
                  disabled
                />
              </div>
            </div>
          </div>
        </section>

        {/* Endereço */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Endereço</h2>
          
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label htmlFor="cep" className={styles.label}>
                CEP
              </label>
              <input
                type="text"
                id="cep"
                name="cep"
                value={formData.cep}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="00000-000"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="logradouro" className={styles.label}>
                Logradouro
              </label>
              <input
                type="text"
                id="logradouro"
                name="logradouro"
                value={formData.logradouro}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="Rua, Avenida, etc."
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="numero" className={styles.label}>
                Número
              </label>
              <input
                type="text"
                id="numero"
                name="numero"
                value={formData.numero}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="123"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="complemento" className={styles.label}>
                Complemento
              </label>
              <input
                type="text"
                id="complemento"
                name="complemento"
                value={formData.complemento}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="Sala, Apto, etc."
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="bairro" className={styles.label}>
                Bairro
              </label>
              <input
                type="text"
                id="bairro"
                name="bairro"
                value={formData.bairro}
                onChange={handleInputChange}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="cidade" className={styles.label}>
                Cidade
              </label>
              <input
                type="text"
                id="cidade"
                name="cidade"
                value={formData.cidade}
                onChange={handleInputChange}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="estado" className={styles.label}>
                Estado
              </label>
              <select
                id="estado"
                name="estado"
                value={formData.estado}
                onChange={handleInputChange}
                className={styles.select}
              >
                <option value="">Selecione...</option>
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
        </section>

        <div className={styles.formActions}>
          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </div>
  );
}

