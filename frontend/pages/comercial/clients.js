import { useEffect, useState } from "react";
import { toast, Bounce } from 'react-toastify';
import { Pencil, Trash2, Plus, Loader2 } from 'lucide-react';
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import styles from "../../styles/comercial/crm/Clients.module.css";
import ClienteModal from "../../components/comercial/ClienteModal";

function ClienteFormInline({ cliente, onClose, onCreate, onUpdate }) {
  const [formData, setFormData] = useState({
    tipo: cliente?.tipo || "pessoa_fisica",
    // dados básicos
    nome: cliente?.nome || "",
    email: cliente?.email || "",
    cpf: cliente?.cpf || "",
    rg: cliente?.rg || "",
    estado_civil: cliente?.estado_civil || "",
    profissao: cliente?.profissao || "",
    sexo: cliente?.sexo || "",
    nacionalidade: cliente?.nacionalidade || "",
    telefone: cliente?.telefone || "",
    // endereço
    cep: cliente?.cep || "",
    endereco: cliente?.endereco || "",
    numero: cliente?.numero || "",
    complemento: cliente?.complemento || "",
    bairro: cliente?.bairro || "",
    cidade: cliente?.cidade || "",
    estado: cliente?.estado || "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nome || !formData.cpf) {
      toast.error('Preencha os campos obrigatórios (Nome e CPF).');
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Não autenticado");
      const userRaw = localStorage.getItem("userData");
      const user = userRaw ? JSON.parse(userRaw) : null;
      const empresaId = user?.EmpresaId || user?.empresa?.id;
      if (!empresaId) throw new Error("Empresa não selecionada");

      const base = `${process.env.NEXT_PUBLIC_API_URL}/comercial/pre-clientes`;
      const url = cliente ? `${base}/${cliente.id}` : base;
      const method = cliente ? "PUT" : "POST";

      // payload compatível com backend atual (usa cpf_cnpj) + campos extras
      const payload = {
        tipo: formData.tipo,
        nome: formData.nome,
        cpf_cnpj: formData.cpf,
        email: formData.email,
        telefone: formData.telefone,
        rg: formData.rg,
        estado_civil: formData.estado_civil,
        profissao: formData.profissao,
        sexo: formData.sexo,
        nacionalidade: formData.nacionalidade,
        cep: formData.cep,
        endereco: formData.endereco,
        numero: formData.numero,
        complemento: formData.complemento,
        bairro: formData.bairro,
        cidade: formData.cidade,
        estado: formData.estado,
        empresa_id: empresaId,
      };

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao salvar cliente");
      }
      toast.success("Cliente salvo com sucesso");
      cliente ? onUpdate?.() : onCreate?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={styles.modalContent}>
        <div className="mb-4" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <h3 className="text-lg font-semibold">{cliente ? "Editar Cliente" : "Novo Cliente"}</h3>
          <button onClick={onClose} className={styles.actionButton}>Fechar</button>
        </div>
        <form onSubmit={handleSubmit}>
          {/* Tipo de Cliente */}
          <div style={{display:'flex',gap:'16px',marginBottom:'14px'}}>
            <label style={{display:'inline-flex',alignItems:'center',gap:'6px'}}>
              <input type="radio" name="tipo" value="pessoa_fisica" checked={formData.tipo === 'pessoa_fisica'} onChange={handleChange} />
              Pessoa Física
            </label>
            <label style={{display:'inline-flex',alignItems:'center',gap:'6px'}}>
              <input type="radio" name="tipo" value="empresa" checked={formData.tipo === 'empresa'} onChange={handleChange} />
              Empresa
            </label>
          </div>

          {/* Dados do Cliente - Pessoa Física */}
          {formData.tipo === 'pessoa_fisica' && (
            <div>
              <h4 style={{margin:'14px 0 8px 0',fontWeight:600}}>Dados do Cliente</h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm">Nome *</label>
                  <input name="nome" value={formData.nome} onChange={handleChange} className={styles.searchInput} required />
                </div>
                <div>
                  <label className="mb-1 block text-sm">Email *</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} className={styles.searchInput} required />
                </div>
                <div>
                  <label className="mb-1 block text-sm">CPF *</label>
                  <input name="cpf" value={formData.cpf} onChange={handleChange} className={styles.searchInput} required />
                </div>
                <div>
                  <label className="mb-1 block text-sm">RG</label>
                  <input name="rg" value={formData.rg} onChange={handleChange} className={styles.searchInput} />
                </div>
                <div>
                  <label className="mb-1 block text-sm">Estado Civil</label>
                  <select name="estado_civil" value={formData.estado_civil} onChange={handleChange} className={styles.filterSelect}>
                    <option value="">Selecione</option>
                    <option value="solteiro">Solteiro(a)</option>
                    <option value="casado">Casado(a)</option>
                    <option value="divorciado">Divorciado(a)</option>
                    <option value="viuvo">Viúvo(a)</option>
                    <option value="uniao_estavel">União Estável</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm">Profissão</label>
                  <input name="profissao" value={formData.profissao} onChange={handleChange} className={styles.searchInput} />
                </div>
                <div>
                  <label className="mb-1 block text-sm">Sexo</label>
                  <select name="sexo" value={formData.sexo} onChange={handleChange} className={styles.filterSelect}>
                    <option value="">Selecione</option>
                    <option value="masculino">Masculino</option>
                    <option value="feminino">Feminino</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm">Nacionalidade</label>
                  <input name="nacionalidade" value={formData.nacionalidade} onChange={handleChange} className={styles.searchInput} />
                </div>
                <div>
                  <label className="mb-1 block text-sm">Telefone</label>
                  <input name="telefone" value={formData.telefone} onChange={handleChange} className={styles.searchInput} />
                </div>
              </div>

              <h4 style={{margin:'16px 0 8px 0',fontWeight:600}}>Endereço</h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm">CEP</label>
                  <input name="cep" value={formData.cep} onChange={handleChange} className={styles.searchInput} />
                </div>
                <div>
                  <label className="mb-1 block text-sm">Endereço</label>
                  <input name="endereco" value={formData.endereco} onChange={handleChange} className={styles.searchInput} />
                </div>
                <div>
                  <label className="mb-1 block text-sm">Número</label>
                  <input name="numero" value={formData.numero} onChange={handleChange} className={styles.searchInput} />
                </div>
                <div>
                  <label className="mb-1 block text-sm">Complemento</label>
                  <input name="complemento" value={formData.complemento} onChange={handleChange} className={styles.searchInput} />
                </div>
                <div>
                  <label className="mb-1 block text-sm">Bairro</label>
                  <input name="bairro" value={formData.bairro} onChange={handleChange} className={styles.searchInput} />
                </div>
                <div>
                  <label className="mb-1 block text-sm">Cidade</label>
                  <input name="cidade" value={formData.cidade} onChange={handleChange} className={styles.searchInput} />
                </div>
                <div>
                  <label className="mb-1 block text-sm">Estado</label>
                  <input name="estado" value={formData.estado} onChange={handleChange} className={styles.searchInput} />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className={styles.actionButton}>Cancelar</button>
            <button type="submit" disabled={submitting} className={styles.button} style={{display:'inline-flex',alignItems:'center',gap:'8px'}}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {cliente ? 'Salvar' : 'Criar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [clienteEdit, setClienteEdit] = useState(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Busca clientes da equipe do usuário logado
  const fetchClientes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Usuário não autenticado.");
      const userRaw = localStorage.getItem("userData");
      const user = userRaw ? JSON.parse(userRaw) : null;
      const empresaId = user?.EmpresaId || user?.empresa?.id;
      const permissoesAdm = Array.isArray(user?.permissoes?.adm) ? user.permissoes.adm : [];
      setIsAdmin(permissoesAdm.includes('superadmin') || permissoesAdm.includes('admin'));

      // Seleciona endpoint baseado nos dados disponíveis
      const base = `${process.env.NEXT_PUBLIC_API_URL}/comercial/pre-clientes`;
      let url = base;
      if (empresaId) {
        url = `${base}/empresa/${empresaId}`;
      }

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error("Erro ao buscar clientes.");
      const data = await res.json();
      setClientes(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  // Ajustar para admin OU superadmin
  useEffect(() => {
    const userRaw = localStorage.getItem("userData");
    if (userRaw) {
      const user = JSON.parse(userRaw);
      const permissoesAdm = Array.isArray(user?.permissoes?.adm) ? user.permissoes.adm : [];
      setIsAdmin(permissoesAdm.includes('superadmin') || permissoesAdm.includes('admin'));
    }
  }, []);

  const handleNovoCliente = () => {
    setClienteEdit(null);
    setShowForm(true);
  };

  const handleEditarCliente = (cliente) => {
    setClienteEdit(cliente);
    setShowForm(true);
  };

  const handleClienteCriado = () => {
    setShowForm(false);
    fetchClientes();
  };

  const handleClienteAtualizado = () => {
    setShowForm(false);
    fetchClientes();
  };

  const handleExcluirCliente = async (cliente) => {
    if (window.confirm(`Tem certeza que deseja excluir o cliente "${cliente.nome}"? Essa ação não poderá ser desfeita.`)) {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/pre-clientes/${cliente.id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Erro ao excluir cliente.");
        }
        fetchClientes();
      } catch (err) {
        toast.error(err.message);
      }
    }
  };

  // Filtro e busca
  const clientesFiltrados = clientes.filter((c) => {
    const matchSearch =
      c.nome?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.telefone?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType ? c.tipo === filterType : true;
    return matchSearch && matchType;
  });

  // Paginação baseada nos clientes filtrados
  const totalPages = Math.ceil(clientesFiltrados.length / itemsPerPage) || 1;
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const clientesPagina = clientesFiltrados.slice(startIdx, endIdx);

  // Resetar página ao filtrar/buscar
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterType]);

  // Função para formatar CPF ou CNPJ
  function formatarCpfCnpj(valor) {
    if (!valor) return "";
    const apenasNumeros = valor.replace(/\D/g, "");
    if (apenasNumeros.length === 11) {
      // CPF: 000.000.000-00
      return apenasNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    if (apenasNumeros.length === 14) {
      // CNPJ: 00.000.000/0000-00
      return apenasNumeros.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    return valor;
  }

  return (
    <div className={styles.page}>
      <PrincipalSidebar />
      <div className={styles.pageContent}>
        <div className={styles.pageHeader}>
          <div className={styles.toolbarBox}>
            <div className={styles.toolbarHeader}>
              <span className={styles.title}>Clientes</span>
              <div className={styles.filtersRowBox}>
                <button onClick={handleNovoCliente} className={styles.button}>
                  <span style={{display:'inline-flex',gap:'8px',alignItems:'center'}}>
                    <Plus className="h-4 w-4" />
                    Novo Cliente
                  </span>
                </button>
              </div>
            </div>
            <div className={styles.filtersRow}>
              <div className={styles.filtersRowBox}>
                <input
                  className={styles.searchInput}
                  type="text"
                  placeholder="Buscar por nome, e-mail ou telefone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className={styles.filtersRowBox}>
                <select
                  className={styles.filterSelect}
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="">Todos os tipos</option>
                  <option value="pessoa_fisica">Pessoa Física</option>
                  <option value="empresa">Empresa</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.contentScroll}>
          {loading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner}></div>
              <p className={styles.loadingText}>Carregando clientes...</p>
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div style={{display:'grid',placeItems:'center',height:'50vh'}}>
              <p className="p-6">Nenhum cliente encontrado.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Nome</th>
                      <th>CPF/CNPJ</th>
                      <th>Email</th>
                      <th>Telefone</th>
                      {isAdmin && <th>Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {clientesPagina.map((c) => (
                      <tr key={c.id} className={styles.tableCardRow}>
                        <td>{c.tipo === "empresa" ? "Empresa" : "Pessoa Física"}</td>
                        <td>{c.nome}</td>
                        <td>{formatarCpfCnpj(c.cpf_cnpj)}</td>
                        <td>{c.email}</td>
                        <td>{c.telefone}</td>
                        {isAdmin && (
                          <td>
                            <button
                              className={styles.actionButton}
                              title="Editar Cliente"
                              onClick={() => handleEditarCliente(c)}
                            >
                              <span style={{display:'inline-flex',gap:'6px',alignItems:'center'}}>
                                <Pencil className="h-4 w-4" />
                                Editar
                              </span>
                            </button>
                            <button
                              className={styles.deleteButton}
                              title="Excluir Cliente"
                              onClick={() => handleExcluirCliente(c)}
                            >
                              <span style={{display:'inline-flex',gap:'6px',alignItems:'center'}}>
                                <Trash2 className="h-4 w-4" />
                                Excluir
                              </span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={`${styles.pageButton} ${currentPage === 1 ? styles.disabled : ''}`}
                  >
                    Anterior
                  </button>
                  <span className={styles.pageInfo}>
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={`${styles.pageButton} ${currentPage === totalPages ? styles.disabled : ''}`}
                  >
                    Próxima
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {showForm && (
          <ClienteModal
            cliente={clienteEdit}
            onClose={() => setShowForm(false)}
            onCreate={handleClienteCriado}
            onUpdate={handleClienteAtualizado}
          />
        )}
      </div>
    </div>
  );
} 