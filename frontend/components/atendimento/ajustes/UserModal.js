import { useState, useEffect } from 'react';
import styles from './UserModal.module.css';
import { X, User, Eye, EyeOff, Upload } from 'lucide-react';

export default function UserModal({ isOpen, onClose, onSuccess, user = null, isEdit = false }) {
  const [formData, setFormData] = useState({
    nome: '',
    apelido: '',
    email: '',
    telefone: '',
    senha: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [role, setRole] = useState('Atendente');
  const [companyLinkId, setCompanyLinkId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cargos, setCargos] = useState([]);
  const [cargoId, setCargoId] = useState(null);

  // Preencher formulário quando editando
  useEffect(() => {
    if (isEdit && user) {
      setFormData({
        nome: user.nome || '',
        apelido: user.apelido || '',
        email: user.email || '',
        telefone: user.telefone || '',
        senha: '', // Sempre vazio na edição
      });
      setAvatarPreview(user.avatar_url || null);
      setAvatarFile(null);
    } else {
      // Reset form para criação
      setFormData({
        nome: '',
        apelido: '',
        email: '',
        telefone: '',
        senha: '',
      });
      setAvatarPreview(null);
      setAvatarFile(null);
    }
    if (!isOpen) {
      // Limpar estados quando o modal fechar
      setAvatarFile(null);
      setUploadingAvatar(false);
    }
    setError(null);
  }, [isEdit, user, isOpen]);

  // Definir valor padrão do role em criação
  useEffect(() => {
    if (!isOpen) return;
    if (!isEdit) {
      setRole('Atendente');
    }
  }, [isOpen, isEdit]);

  // Detectar admin/superadmin e carregar cargos (somente para admin/superadmin)
  useEffect(() => {
    try {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const roleCandidates = [userData?.userRole, userData?.nivel].filter(Boolean).map(r => String(r).toLowerCase());
      const permsAdm = Array.isArray(userData?.permissoes?.adm) ? userData.permissoes.adm.map(v => String(v).toLowerCase()) : [];
      const adminMatch = roleCandidates.includes('superadmin') || roleCandidates.includes('administrador') || roleCandidates.includes('admin') || permsAdm.includes('superadmin') || permsAdm.includes('administrador') || permsAdm.includes('admin');
      setIsAdmin(Boolean(adminMatch));
    } catch {
      setIsAdmin(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchCargos = async () => {
      try {
        if (!isOpen || !isAdmin) return;
        const token = localStorage.getItem('token');
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const empresaId = JSON.parse(localStorage.getItem('userData') || '{}').EmpresaId;
        if (!token || !apiUrl || !empresaId) return;
        const res = await fetch(`${apiUrl}/cargos`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-empresa-id': empresaId
          }
        });
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        const withoutSuperadmin = list.filter(c => String(c?.nome || '').toLowerCase() !== 'superadmin');
        setCargos(withoutSuperadmin);
        if (!cargoId && withoutSuperadmin[0]?.id) setCargoId(withoutSuperadmin[0].id);
      } catch {}
    };
    fetchCargos();
  }, [isOpen, isAdmin]);

  // Carregar role atual do usuário para a empresa selecionada (quando editando)
  useEffect(() => {
    const loadUserCompanyRole = async () => {
      try {
        if (!isEdit || !user) return;
        const token = localStorage.getItem('token');
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const companyId = JSON.parse(localStorage.getItem('userData') || '{}').EmpresaId;
        if (!token || !apiUrl || !companyId) return;

        const resp = await fetch(`${apiUrl}/usuarios-empresas?usuario_id=${user.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!resp.ok) return;
        const data = await resp.json();
        const vinculo = (data.data || []).find(c => String(c.empresa_id) === String(companyId));
        if (vinculo) {
          setRole(vinculo.cargo_id || 'Atendente');
          setCompanyLinkId(vinculo.vinculo_id);
          setCargoId(vinculo.cargo_id || null);
        } else {
          // mantém escolha default carregada
          setRole('Atendente');
          setCompanyLinkId(null);
          setCargoId(null);
        }
      } catch (e) {
        // Silencioso: não bloquear a edição em caso de erro
      }
    };
    loadUserCompanyRole();
  }, [isEdit, user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        setError('Por favor, selecione apenas arquivos de imagem');
        return;
      }
      
      // Validar tamanho (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('A imagem deve ter no máximo 5MB');
        return;
      }
      
      setAvatarFile(file);
      
      // Criar preview da imagem
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target.result);
      };
      reader.readAsDataURL(file);
      
      // Limpar erro se havia
      setError(null);
    }
  };

  const uploadAvatar = async (userId) => {
    if (!avatarFile) return null;
    
    try {
      setUploadingAvatar(true);
      
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      const formData = new FormData();
      formData.append('avatar', avatarFile);
      
      const response = await fetch(`${apiUrl}/atendimento/usuarios/${userId}/upload-avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao fazer upload do avatar');
      }
      
      const result = await response.json();
      return result.avatar_url;
      
    } catch (err) {
      console.error('Erro no upload do avatar:', err);
      throw err;
    } finally {
      setUploadingAvatar(false);
    }
  };

  const validateForm = () => {
    if (!formData.nome.trim()) {
      setError('Nome é obrigatório');
      return false;
    }
    if (!formData.email.trim()) {
      setError('Email é obrigatório');
      return false;
    }
    if (!isEdit && !formData.senha.trim()) {
      setError('Senha é obrigatória para novos usuários');
      return false;
    }
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      setError('Email inválido');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const companyId = JSON.parse(localStorage.getItem('userData') || '{}').EmpresaId;
      
      if (!token || !companyId) {
        throw new Error('Dados de autenticação não encontrados');
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('URL da API não configurada');
      }

      const requestData = {
        nome: formData.nome.trim(),
        apelido: formData.apelido.trim() || null,
        email: formData.email.trim(),
        telefone: formData.telefone.trim() || null,
      };

      // Adicionar senha apenas se for criação ou se foi preenchida na edição
      if (!isEdit || formData.senha.trim()) {
        requestData.senha = formData.senha.trim();
      }

      let response;
      if (isEdit) {
        // Para edição, primeiro fazer upload do avatar se necessário
        let avatarUrl = user.avatar_url;
        if (avatarFile) {
          try {
            avatarUrl = await uploadAvatar(user.id);
          } catch (uploadError) {
            throw new Error(`Erro no upload do avatar: ${uploadError.message}`);
          }
        }
        
        // Adicionar avatar_url aos dados da requisição
        requestData.avatar_url = avatarUrl;
        
        // Editar usuário existente
        response = await fetch(`${apiUrl}/atendimento/usuarios/${user.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        });
      } else {
        // Criar novo usuário
        response = await fetch(`${apiUrl}/atendimento/usuarios`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro ao ${isEdit ? 'editar' : 'criar'} usuário`);
      }

      const result = await response.json();
      
      // Para criação, fazer upload do avatar após criar o usuário
      if (!isEdit && avatarFile) {
        try {
          const avatarUrl = await uploadAvatar(result.id);
          // Atualizar o resultado com a URL do avatar
          result.avatar_url = avatarUrl;
        } catch (uploadError) {
          console.warn('Usuário criado mas erro no upload do avatar:', uploadError.message);
        }
      }
      
      // Vincular/atualizar cargo do usuário na empresa (somente admin/superadmin)
      if (isAdmin) {
        try {
          const chosenCargoId = cargoId || role; // fallback para compat
          if (!isEdit) {
            const linkResponse = await fetch(`${apiUrl}/usuarios-empresas`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                usuario_id: result.id,
                empresa_id: parseInt(companyId),
                cargo_id: chosenCargoId
              })
            });
            if (!linkResponse.ok) {
              console.warn('Usuário criado mas não foi possível vincular/definir cargo na empresa');
            }
          } else {
            if (companyLinkId) {
              const upd = await fetch(`${apiUrl}/usuarios-empresas/${companyLinkId}`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ cargo_id: chosenCargoId })
              });
              if (!upd.ok) {
                console.warn('Não foi possível atualizar o cargo na empresa');
              }
            } else {
              const crt = await fetch(`${apiUrl}/usuarios-empresas`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  usuario_id: user.id,
                  empresa_id: parseInt(companyId),
                  cargo_id: chosenCargoId
                })
              });
              if (!crt.ok) {
                console.warn('Não foi possível criar o vínculo com cargo');
              }
            }
          }
        } catch (linkErr) {
          console.warn('Falha ao definir cargo do usuário na empresa:', linkErr?.message || linkErr);
        }
      }
      
      // Call success callback
      if (onSuccess) {
        onSuccess(result);
      }
      
      // Close modal
      onClose();
      
    } catch (err) {
      console.error(`Erro ao ${isEdit ? 'editar' : 'criar'} usuário:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading && !uploadingAvatar) {
      setFormData({
        nome: '',
        apelido: '',
        email: '',
        telefone: '',
        senha: '',
      });
      setError(null);
      setShowPassword(false);
      setAvatarPreview(null);
      setAvatarFile(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <div className={styles.icon}>
              <User size={24} />
            </div>
            <h2 className={styles.title}>
              {isEdit ? 'Editar Usuário' : 'Novo Usuário'}
            </h2>
          </div>
          <button 
            className={styles.closeButton}
            onClick={handleClose}
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Avatar Section */}
          <div className={styles.avatarSection}>
            <div className={styles.avatarContainer}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className={styles.avatarImage} />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  <User size={32} />
                </div>
              )}
            </div>
            <label className={`${styles.avatarUploadButton} ${uploadingAvatar ? styles.uploading : ''}`}>
              <Upload size={16} />
              {uploadingAvatar ? 'Carregando...' : 'Alterar Foto'}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className={styles.avatarInput}
                disabled={uploadingAvatar || loading}
              />
            </label>
          </div>
          {/* Role na empresa */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="role" className={styles.label}>
                Permissão na Empresa
              </label>
              <select
                id="role"
                name="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={styles.input}
                disabled={loading}
              >
                <option value="Atendente">Atendente</option>
                <option value="Administrador">Administrador</option>
              </select>
            </div>
            {isAdmin && (
              <div className={styles.formGroup}>
                <label htmlFor="cargoId" className={styles.label}>
                  Cargo na Empresa
                </label>
                <select
                  id="cargoId"
                  name="cargoId"
                  value={cargoId || ''}
                  onChange={(e) => setCargoId(Number(e.target.value))}
                  className={styles.input}
                  disabled={loading}
                >
                  <option value="" disabled>Selecione um cargo</option>
                  {cargos.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="nome" className={styles.label}>
                Nome Completo *
              </label>
              <input
                type="text"
                id="nome"
                name="nome"
                value={formData.nome}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="Digite o nome completo"
                disabled={loading}
                maxLength={100}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="apelido" className={styles.label}>
                Apelido
              </label>
              <input
                type="text"
                id="apelido"
                name="apelido"
                value={formData.apelido}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="Digite o apelido"
                disabled={loading}
                maxLength={50}
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.label}>
                Email *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="Digite o email"
                disabled={loading}
                maxLength={100}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="telefone" className={styles.label}>
                Telefone
              </label>
              <input
                type="tel"
                id="telefone"
                name="telefone"
                value={formData.telefone}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="(11) 99999-9999"
                disabled={loading}
                maxLength={20}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="senha" className={styles.label}>
              Senha {!isEdit && '*'}
            </label>
            <div className={styles.passwordInput}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="senha"
                name="senha"
                value={formData.senha}
                onChange={handleInputChange}
                className={styles.input}
                placeholder={isEdit ? 'Deixe em branco para manter a senha atual' : 'Digite a senha'}
                disabled={loading}
                maxLength={100}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {isEdit && (
              <p className={styles.helpText}>
                Deixe em branco para manter a senha atual
              </p>
            )}
          </div>


          {error && (
            <div className={styles.errorMessage}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              onClick={handleClose}
              className={styles.cancelButton}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading || uploadingAvatar || !formData.nome.trim() || !formData.email.trim()}
            >
              {loading ? (
                <>
                  <div className={styles.spinner}></div>
                  {isEdit ? 'Salvando...' : 'Criando...'}
                </>
              ) : uploadingAvatar ? (
                <>
                  <div className={styles.spinner}></div>
                  Fazendo upload...
                </>
              ) : (
                isEdit ? 'Salvar Alterações' : 'Criar Usuário'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
