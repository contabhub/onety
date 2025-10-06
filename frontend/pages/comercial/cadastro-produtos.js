import { useState, useEffect } from "react";
import { FaBox } from "react-icons/fa"; // Ícone de produto
import styles from "../../styles/comercial/crm/ProdutoCadastro.module.css"; // Importe o CSS atualizado
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEllipsisV, faPen, faTrash } from "@fortawesome/free-solid-svg-icons";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import SpaceLoader from "../../components/onety/menu/SpaceLoader";
import EditProductModal from "../../components/comercial/crm/EditProductModal";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { useRouter } from "next/router";

const ProdutoCadastro = () => {
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState("ativo");
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // Estado para armazenar erro
  const [showDropdown, setShowDropdown] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null); // Produto sendo editado
  const [isModalOpen, setIsModalOpen] = useState(false); // Controle de abertura do modal
  const [modalMode, setModalMode] = useState("edit"); // Modo do modal: "edit" ou "create"
  const [filtro, setFiltro] = useState("todos"); // Novo estado para filtro
  const [searchTerm, setSearchTerm] = useState(""); // Estado para busca
  const router = useRouter();
  const [userRole, setUserRole] = useState("");
  const [global, setGlobal] = useState(0); // padrão: produto local
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    const userRaw = localStorage.getItem("user");
    if (userRaw) {
      const user = JSON.parse(userRaw);
      setUserRole(user.role);
    }
  }, []);

  // Buscar produtos ao carregar a página
  const fetchProdutos = async () => {
    setLoading(true);
    setError(null); // Resetando erro antes de uma nova tentativa
    try {
      const userRaw = localStorage.getItem("user");
      const token = localStorage.getItem("token");

      if (!userRaw || !token) return;

      const user = JSON.parse(userRaw);
      const equipeId = user.equipe_id;

      if (!equipeId) {
        console.error("Usuário não tem equipe associada.");
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/produtos/equipe/${equipeId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Verificar se a resposta não é bem-sucedida (res.ok é falso)
      if (!res.ok) {
        const message = `Erro ao buscar produtos: ${res.status} ${res.statusText}`;
        throw new Error(message);
      }

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setProdutos(data);
      } else {
        throw new Error("A resposta não é um JSON válido.");
      }
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
      setError(error.message); // Armazenando o erro
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchProdutos();
  }, []);

  const toggleDropdown = (productId) => {
    if (showDropdown === productId) {
      setShowDropdown(null); // Fecha o dropdown se já estiver aberto
    } else {
      setShowDropdown(productId); // Abre o dropdown para o produto selecionado
    }
  };

  // Lógica para abrir o modal com o produto selecionado
  const handleEditProduct = (produto) => {
    setEditingProduct(produto);
    setModalMode("edit");
    setIsModalOpen(true); // Abre o modal
  };

  // Lógica para abrir o modal para criar novo produto
  const handleCreateProduct = () => {
    setEditingProduct(null);
    setModalMode("create");
    setIsModalOpen(true);
  };

  // Lógica para salvar as alterações após edição/criação
  const handleSaveProduct = async (updatedProduct) => {
    // Atualiza o produto na lista localmente
    setProdutos((prevProdutos) => {
      if (modalMode === "create") {
        // Adiciona novo produto
        return [...prevProdutos, updatedProduct];
      } else {
        // Atualiza produto existente
        return prevProdutos.map((produto) =>
          produto.id === updatedProduct.id
            ? { ...produto, ...updatedProduct }
            : produto
        );
      }
    });

    // Fazendo um novo fetch para garantir que a lista de produtos seja atualizada
    fetchProdutos();

    // Fecha o modal após salvar
    setIsModalOpen(false);
  };

  const handleDeleteProduct = async (produtoId) => {
    const token = localStorage.getItem("token");

    if (!token) {
      console.error("Token não encontrado.");
      return;
    }

    try {
      // Enviar requisição para excluir o produto no backend
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/produtos/${produtoId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const message = `Erro ao excluir produto: ${res.status} ${res.statusText}`;
        throw new Error(message);
      }

      // Atualizar a lista de produtos removendo o produto excluído
      setProdutos((prevProdutos) =>
        prevProdutos.filter((produto) => produto.id !== produtoId)
      );

      console.log("Produto excluído com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir produto:", error);
      setError("Erro ao excluir produto: " + error.message); // Exibe mensagem de erro
    }
  };

  // Função para filtrar produtos por busca e tipo
  const filteredProducts = produtos.filter(produto => {
    // Filtro por tipo (todos, globais, locais)
    const typeFilter = filtro === "todos" || 
      (filtro === "globais" && produto.global === 1) ||
      (filtro === "locais" && (!produto.global || produto.global === 0));
    
    // Filtro por busca (nome ou descrição)
    const searchFilter = !searchTerm || 
      produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      produto.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return typeFilter && searchFilter;
  });

  return (
    <>
      <div className={styles.page}>
        <PrincipalSidebar />
        <div className={styles.pageContent}>
      <div className={styles.container}>

        {/* Header com título e botão Novo Produto */}
        <div className={styles.headerContainer}>
          <h1 className={styles.title}>
            <FaBox className={styles.icon} size={40} /> Produtos
          </h1>
          <button 
            onClick={handleCreateProduct}
            className={styles.button}
          >
            Novo Produto
          </button>
        </div>

        {/* Container de Busca e Filtros */}
        <div className={styles.searchFilterContainer}>
          {/* Busca */}
          <div className={styles.searchContainer}>
            <div className={styles.searchContent}>
              <input
                type="text"
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          </div>

          {/* Filtro de Produtos */}
          <div className={styles.filterContainer}>
            <div className={styles.filterContent}>
              <select
                id="filtro-produtos"
                value={filtro}
                onChange={e => setFiltro(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="todos">Todos</option>
                <option value="globais">Globais</option>
                <option value="locais">Locais</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lista de Produtos Cadastrados */}
        {loading ? (
          <SpaceLoader label="Carregando produtos..." />
        ) : error ? (
          <p className={styles.errorMessage}>{error}</p> // Exibe mensagem de erro
        ) : filteredProducts.length > 0 ? (
          filteredProducts.map((produto, index) => (
            <div key={index} className={styles.cardProduct}>
              <div className={styles.productInfo}>
                {/* Nome em negrito */}
                <div className={styles.productName}>
                  {produto.nome}
                </div>
                
                {/* Descrição com ellipsis e clique para expandir */}
                <div 
                  className={styles.productDescription}
                  onClick={() => {
                    setSelectedProduct(produto);
                    setShowDescriptionModal(true);
                  }}
                  title="Clique para ver descrição completa"
                >
                  {produto.descricao || 'Sem descrição'}
                </div>
                
                {/* Status e tipo em badges */}
                <div className={styles.productBadges}>
                  <span className={`${styles.badge} ${styles.statusBadge} ${produto.status === 'ativo' ? styles.activeStatus : styles.inactiveStatus}`}>
                    {produto.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </span>
                  <span className={`${styles.badge} ${styles.typeBadge} ${produto.global === 1 ? styles.globalType : styles.localType}`}>
                    {produto.global === 1 ? 'Global' : 'Local'}
                  </span>
                </div>
              </div>

              {/* Elipse com Dropdown - apenas para superadmin ou produtos locais */}
              {(userRole === "superadmin" || produto.global !== 1) && (
                <div className={styles.menuButtonContainer}>
                  <button
                    className={styles.menuButton}
                    onClick={() => toggleDropdown(produto.id)} // Toggle do dropdown
                  >
                    <FontAwesomeIcon
                      icon={faEllipsisV}
                      className={styles.dotIcon}
                    />
                  </button>

                  {/* Dropdown para Editar e Excluir */}
                  {showDropdown === produto.id && (
                    <div className={styles.dropdownMenu}>
                      <button
                        className={styles.editButton}
                        onClick={() => handleEditProduct(produto)}
                      >
                        <FontAwesomeIcon
                          icon={faPen}
                          size={16}
                          className={styles.iconEditTrash}
                        />{" "}
                        Editar
                      </button>
                      <button
                        className={styles.deleteButton}
                        onClick={() => handleDeleteProduct(produto.id)}
                      >
                        <FontAwesomeIcon
                          icon={faTrash}
                          size={16}
                          className={styles.iconEditTrash}
                        />{" "}
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <p className={styles.noProducts}>
            {searchTerm || filtro !== "todos" 
              ? "Nenhum produto encontrado com os filtros aplicados." 
              : "Nenhum produto cadastrado."}
          </p>
        )}

        {/* Lista de Produtos Inativos */}
        {/* <div className={styles.inactiveProducts}>
          <h2>Lista de Produtos Inativos</h2>
          <p>Nenhum produto inativo encontrado.</p>
        </div> */}

      </div>
        </div>
      </div>
      
      {/* Modal Unificado de Edição/Criação */}
      {isModalOpen && (
        <EditProductModal
          product={editingProduct}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveProduct}
          mode={modalMode}
        />
      )}

      {/* Modal de Descrição */}
      {showDescriptionModal && selectedProduct && (
        <div className={styles.descriptionModal}>
          <div className={styles.descriptionModalContent}>
            <div className={styles.descriptionModalHeader}>
              <h3 className={styles.descriptionModalTitle}>{selectedProduct.nome}</h3>
              <button 
                onClick={() => setShowDescriptionModal(false)}
                className={styles.descriptionModalClose}
              >
                ×
              </button>
            </div>
            
            <div className={styles.descriptionModalBody}>
              <strong>Descrição:</strong>
              <p className={styles.descriptionText}>
                {selectedProduct.descricao || 'Sem descrição'}
              </p>
            </div>
            
            <div className={styles.descriptionModalInfo}>
              <div>
                <strong>Status:</strong> 
                <span className={`${styles.badge} ${styles.statusBadge} ${selectedProduct.status === 'ativo' ? styles.activeStatus : styles.inactiveStatus}`}>
                  {selectedProduct.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div>
                <strong>Tipo:</strong> 
                <span className={`${styles.badge} ${styles.typeBadge} ${selectedProduct.global === 1 ? styles.globalType : styles.localType}`}>
                  {selectedProduct.global === 1 ? 'Global' : 'Local'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProdutoCadastro;
