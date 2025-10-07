import { useState, useEffect } from "react";
import { FaBox } from "react-icons/fa"; // Ícone de produto
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEllipsisV, faExpand } from "@fortawesome/free-solid-svg-icons";
import styles from "../../../styles/comercial/crm/LeadProducts.module.css"; // Estilos do componente de produtos
import ModalVincularProduto from "../crm/ModalVincularProduto"; // Modal para vinculação de produtos

const LeadProducts = ({ leadId }) => {
    const [produtos, setProdutos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showDropdown, setShowDropdown] = useState(null); // Controla o dropdown de cada produto
    const [isModalOpen, setIsModalOpen] = useState(false); // Controla a abertura do modal
    const [produtoParaVincular, setProdutoParaVincular] = useState(null); // Produto selecionado para vincular ao lead
    const [valorTotal, setValorTotal] = useState(0);  // Definindo o estado de valor total

    // Buscar produtos ao carregar a página
    useEffect(() => {
        fetchProdutos();
    }, [leadId]);

    const fetchProdutos = async () => {
        setLoading(true);
        setError(null);
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
                `${process.env.NEXT_PUBLIC_API_URL}/produtos/produto_lead/${leadId}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (!res.ok) {
                const message = `Erro ao buscar produtos do lead: ${res.status} ${res.statusText}`;
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
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const calcularValorTotalProduto = (produto) => {
        return produto.valor_de_venda * produto.quantidade;
    };

    useEffect(() => {
        const total = produtos.reduce((acc, produto) => {
            return acc + calcularValorTotalProduto(produto);
        }, 0);
        setValorTotal(total); // Atualize o estado de valor total
    }, [produtos]); // Isso vai ser chamado sempre que os produtos mudarem


    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>
                    <FaBox className={styles.userIcon} size={30} /> Produtos
                </h2>
                <button
                    className={styles.addContactButton}
                    onClick={() => setIsModalOpen(true)} // Abre o modal de vinculação
                >
                    <FontAwesomeIcon icon={faExpand} size="lg" />
                </button>
            </div>

            {loading ? (
                <p>Carregando produtos...</p>
            ) : error ? (
                <p className={styles.errorMessage}>{error}</p>
            ) : produtos.length > 0 ? (
                <>
                    {produtos.map((produto, index) => (
                        <div key={index} className={styles.cardProduct}>
                            <div className={styles.productInfo}>
                                <span className={styles.productName}>{produto.nome}</span>
                                <span className={styles.productValue}>R$ {produto.valor_de_venda}</span>
                            </div>
                            <div className={styles.productDetails}>
                                <span className={styles.productQuantity}>{produto.quantidade}x</span>
                            </div>
                        </div>
                    ))}

                    {/* Cálculo do valor total de todos os produtos */}
                    <div className={styles.totalValue}>
                        {/* Soma dos valores totais dos produtos */}
                        <span>Total: R$ {produtos.reduce((acc, produto) => acc + produto.valor_de_venda * produto.quantidade, 0).toFixed(2)}</span>
                    </div>
                </>
            ) : (
                <p className={styles.noProducts}>Nenhum produto vinculado.</p>
            )}


            {/* Modal de Vinculação */}
            {isModalOpen && (
                <ModalVincularProduto
                    leadId={leadId} // Passando o leadId para o modal
                    produtoParaVincular={produtoParaVincular} // Passando o produto selecionado
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={fetchProdutos}
                />
            )}
        </div>
    );
};

export default LeadProducts;
