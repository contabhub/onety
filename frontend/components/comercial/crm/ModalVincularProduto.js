import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaBox } from 'react-icons/fa';
import styles from '../../../styles/comercial/crm/ModalVincularProduto.module.css'; // Estilos do modal
import { toast } from 'react-toastify'; // Para notificações (opcional)

const ModalVincularProduto = ({ leadId, isOpen, onClose, onSave }) => {
    const [produtos, setProdutos] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [valorVenda, setValorVenda] = useState(0);
    const [quantidade, setQuantidade] = useState(1);
    const [valorTotal, setValorTotal] = useState(0);
    const [produtosVinculados, setProdutosVinculados] = useState([]);

    // Buscar produtos ao abrir o modal
    useEffect(() => {
        if (isOpen) {
            fetchProdutos();
            fetchProdutosVinculados();
        }
    }, [isOpen]);

    const fetchProdutos = async () => {
        try {
            const userRaw = localStorage.getItem("userData");
            const token = localStorage.getItem("token");

            if (!userRaw || !token) return;

            const user = JSON.parse(userRaw);
            const empresaId = user?.EmpresaId || user?.empresa?.id;

            if (!empresaId) {
                console.error("Usuário não tem empresa associada.");
                return;
            }

            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/comercial/produtos/empresa/${empresaId}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            const data = await res.json();
            setProdutos(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Erro ao carregar produtos:", error);
            toast.error("Erro ao carregar produtos!");
        }
    };

    const handleProductSelect = (product) => {
        if (product) {
            setSelectedProduct(product);
            setValorVenda(product.valor);  // Define o valor inicial como o valor do produto
            setQuantidade(1); // Quantidade inicial
        } else {
            console.error("Produto não encontrado");
        }
    };

    // Calcular o valor total quando valorVenda ou quantidade mudar
    useEffect(() => {
        setValorTotal(valorVenda * quantidade);
    }, [valorVenda, quantidade]);

    const handleSubmit = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/produtos/produto_lead`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    produto_id: selectedProduct.id,
                    lead_id: leadId,
                    valor_de_venda: valorVenda,
                    desconto: 0, // Mantendo compatibilidade com o backend
                    quantidade: quantidade,
                }),
            });

            if (res.ok) {
                toast.success('Produto vinculado com sucesso!');
                onSave(); // Atualizar lista de produtos após salvar
                onClose(); // Fechar modal
            } else {
                toast.error('Erro ao vincular produto!');
            }
        } catch (error) {
            console.error('Erro ao vincular produto:', error);
            toast.error('Erro ao vincular produto!');
        }
    };

    const fetchProdutosVinculados = async () => {
        try {
            const token = localStorage.getItem("token");

            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/comercial/produtos/produto_lead/${leadId}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            const data = await res.json();
            setProdutosVinculados(Array.isArray(data) ? data : []); // Atualiza os produtos vinculados
        } catch (error) {
            console.error("Erro ao carregar produtos vinculados:", error);
            toast.error("Erro ao carregar produtos vinculados!");
        }
    };

    const handleDesvincularProduto = async (produtoLeadId) => {
        console.log("Desvinculando produto com ID:", produtoLeadId); // Verifique o ID correto do produto_lead

        try {
            const token = localStorage.getItem("token");

            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/comercial/produtos/produto_lead/${produtoLeadId}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            const result = await res.json(); // Lê a resposta JSON

            console.log("Resposta da API:", result); // Exibe a resposta no console para verificar

            if (res.ok) {
                toast.success("Produto desvinculado com sucesso!");
                fetchProdutosVinculados(); // Recarregar os produtos vinculados
                onSave(); // Atualizar lista de produtos após desvincular
            } else {
                toast.error(result.message || "Erro ao desvincular produto!");
            }
        } catch (error) {
            console.error("Erro ao desvincular produto:", error);
            toast.error("Erro ao desvincular produto!");
        }
    };





    return createPortal(
        <div className={`${styles.modal} ${isOpen ? styles.modalOpen : ''}`} role="dialog" aria-modal="true">
            <div className={styles.overlay} onClick={onClose}></div>

            <div className={styles.content}>
                <div className={styles.header}>
                    <h2><FaBox className={styles.icon} size={40} /> Vincular Produto</h2>
                    <select
                        id="produto"
                        onChange={(e) => {
                            const selected = produtos.find(prod => prod.id === Number(e.target.value));
                            handleProductSelect(selected);
                        }}
                        className={styles.select}
                    >
                        <option value="">Selecione um produto</option>
                        {produtos.map((produto) => (
                            <option key={produto.id} value={produto.id}>
                                {produto.nome}
                            </option>
                        ))}
                    </select>
                    <button onClick={onClose} className={styles.close}>X</button>
                </div>



                {selectedProduct && (
                    <div className={styles.vinculadosContainer}>
                        <h3>Detalhes do Produto</h3>
                        <table className={styles.vinculadoTable}>
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th>Valor de Venda</th>
                                    <th>Quantidade</th>
                                    <th>Valor Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>{selectedProduct.nome}</td>
                                    <td>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={valorVenda}
                                            onChange={(e) => setValorVenda(Number(e.target.value))}
                                            className={styles.input}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            value={quantidade}
                                            onChange={(e) => setQuantidade(Number(e.target.value))}
                                            className={styles.input}
                                        />
                                    </td>
                                    <td>R$ {valorTotal.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                        <div className={styles.footer}>
                            <button onClick={handleSubmit} className={styles.saveButton}>
                                Vincular e Atualizar Valor
                            </button>
                        </div>
                    </div>
                )}

 

                <div className={styles.vinculadosContainer}>
                    <h3>Produtos Vinculados</h3>
                    <table className={styles.vinculadoTable}>
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Valor de Venda</th>
                                <th>Quantidade</th>
                                <th>Valor Total</th>
                                <th>Ação</th> {/* Coluna para o botão de desvincular */}
                            </tr>
                        </thead>
                        <tbody>
                            {produtosVinculados.map((produto, index) => (
                                <tr key={index}>
                                    <td>{produto.nome}</td>
                                    <td>R$ {produto.valor_de_venda}</td>
                                    <td>{produto.quantidade}x</td>
                                    <td>R$ {(produto.valor_de_venda * produto.quantidade).toFixed(2)}</td> {/* Calcula o valor total */}
                                    <td>
                                        <button
                                            className={styles.removeButton}
                                            onClick={() => {
                                                console.log("Produto ID a ser desvinculado:", produto.id); // Verifique o ID do produto
                                                handleDesvincularProduto(produto.id); // Passa o id correto da tabela produto_lead
                                            }}
                                        >
                                            Desvincular
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>,
        typeof document !== 'undefined' ? document.body : (typeof window !== 'undefined' ? window.document.body : null)
    );
};

export default ModalVincularProduto;
