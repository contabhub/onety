import { useState, useEffect, useCallback } from 'react';

export function useProdutos(options) {
  const [produtos, setProdutos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProdutos = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Buscar empresaId do userData (prioridade) ou do localStorage direto
      const userData = localStorage.getItem("userData");
      const token = localStorage.getItem("token");
      
      let companyId = options?.empresaId;
      
      if (!companyId && userData) {
        const parsedUserData = JSON.parse(userData);
        companyId = parsedUserData.EmpresaId || parsedUserData.empresa?.id;
      }
      
      // Fallback para localStorage direto
      if (!companyId) {
        companyId = localStorage.getItem("empresaId");
      }
      
      if (!companyId || !token) {
        setError("Dados de autenticação não encontrados");
        return;
      }

      // Construir URL com filtro de status se fornecido
      let url = `${process.env.NEXT_PUBLIC_API_URL}/financeiro/produtos-servicos/empresa/${companyId}/produtos`;
      
      if (options?.status) {
        url += `?status=${options.status}`;
      }

      console.log("🔍 URL da requisição:", url);
      console.log("🏢 CompanyId usado:", companyId);

      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ao buscar produtos: ${response.status}`);
      }

      const data = await response.json();
      console.log("📦 Dados dos produtos:", data);
      
      // Transformar dados da API para o formato esperado
      const produtosTransformados = data.map((produto) => ({
        id: String(produto.id),
        nome: produto.nome,
        codigo: produto.codigo || `PRD${String(produto.id).padStart(3, '0')}`,
        tipo: produto.tipo === 'serviço' ? 'Prestado' : 'Produto',
        status: produto.status === 'ativo' ? 'Ativo' : 'Inativo',
        valorCusto: 0, // Campo não existe na tabela
        valorVenda: 0  // Campo não existe na tabela
      }));
      
      setProdutos(produtosTransformados);
    } catch (err) {
      console.error("❌ Erro ao buscar produtos:", err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setProdutos([]);
    } finally {
      setIsLoading(false);
    }
  }, [options?.status]);

  const alterarStatus = useCallback(async (id, status) => {
    try {
      const token = localStorage.getItem("token");
      
      if (!token) {
        throw new Error("Token de autenticação não encontrado");
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/financeiro/produtos-servicos/${id}/status`, {
        method: 'PATCH',
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        throw new Error(`Erro ao alterar status: ${response.status}`);
      }

      const result = await response.json();
      console.log("✅ Status alterado com sucesso:", result);
      
      // Atualizar o estado local imediatamente sem fazer nova requisição
      setProdutos(prevProdutos => 
        prevProdutos.map(produto => 
          produto.id === id 
            ? { ...produto, status: status === 'ativo' ? 'Ativo' : 'Inativo' }
            : produto
        )
      );
    } catch (err) {
      console.error("❌ Erro ao alterar status:", err);
      throw err;
    }
  }, []);

  const criarProduto = useCallback(async (data) => {
    try {
      const companyId = localStorage.getItem("empresaId");
      const token = localStorage.getItem("token");
      
      if (!companyId || !token) {
        throw new Error("Dados de autenticação não encontrados");
      }

      // Preparar dados para a API baseado na estrutura real da tabela
      const produtoData = {
        nome: data.nome,
        codigo: data.codigo,
        tipo: data.tipo,
        status: data.status,
        company_id: companyId
      };

      console.log("📤 Enviando dados do produto:", produtoData);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/financeiro/produtos-servicos`, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(produtoData)
      });

      if (!response.ok) {
        throw new Error(`Erro ao criar produto: ${response.status}`);
      }

      const result = await response.json();
      console.log("✅ Produto criado com sucesso:", result);
      
      // Atualizar a lista de produtos após criação
      await fetchProdutos();
    } catch (err) {
      console.error("❌ Erro ao criar produto:", err);
      throw err;
    }
  }, [fetchProdutos]);

  useEffect(() => {
    fetchProdutos();
  }, [fetchProdutos]);

  return {
    produtos,
    isLoading,
    error,
    fetchProdutos,
    alterarStatus,
    criarProduto
  };
}