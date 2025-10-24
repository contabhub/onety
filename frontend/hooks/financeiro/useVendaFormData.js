import { useState, useEffect } from 'react';

// FormData: { clientes: Array, produtosServicos: Array, categorias: Array, subCategorias: Array, companies: Array, centrosCusto: Array, users: Array, contas: Array }
// UseVendaFormDataReturn: { formData: FormData, isLoading: boolean, error: string | null, refetch: () => Promise<void>, saveVenda: (vendaData: any) => Promise<{ success: boolean; message: string; id?: number }> }

export function useVendaFormData() {
  const [formData, setFormData] = useState({
    clientes: [],
    produtosServicos: [],
    categorias: [],
    subCategorias: [],
    companies: [],
    centrosCusto: [],
    users: [],
    contas: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchFormData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Buscar empresaId do userData (EmpresaId com E maiúsculo)
      const userData = localStorage.getItem("userData");
      const token = localStorage.getItem("token");

      if (!userData || !token) {
        throw new Error("Dados de autenticação não encontrados");
      }

      const parsedUserData = JSON.parse(userData);
      const companyId = parsedUserData.EmpresaId;

      if (!companyId) {
        throw new Error("ID da empresa não encontrado");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/financeiro/vendas/form-data?empresa_id=${companyId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Erro ao buscar dados: ${response.status}`);
      }

      const data = await response.json();
      setFormData(data);
    } catch (err) {
      console.error("❌ Erro ao buscar dados do formulário:", err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setIsLoading(false);
    }
  };

                const saveVenda = async (vendaData) => {
                try {
                  // Buscar dados do userData
                  const userData = localStorage.getItem("userData");
                  const token = localStorage.getItem("token");

                  if (!userData || !token) {
                    throw new Error("Dados de autenticação não encontrados");
                  }

                  const parsedUserData = JSON.parse(userData);
                  const companyId = parsedUserData.EmpresaId;
                  const userId = parsedUserData.id;

                  if (!companyId || !userId) {
                    throw new Error("ID da empresa ou usuário não encontrado");
                  }

                  // Mapear tipo_venda baseado na seleção do ToggleGroupItem
                  const mapearTipoVenda = (tipoVenda) => {
                    switch (tipoVenda) {
                      case "orcamento":
                        return "orcamento";
                      case "venda-avulsa":
                        return "venda avulsa";
                      case "venda-recorrente":
                        return "venda recorrente";
                      default:
                        return "orcamento"; // valor padrão
                    }
                  };

                  // Função para formatar data para o formato MySQL (YYYY-MM-DD)
                  const formatarDataParaMySQL = (data) => {
                    if (data instanceof Date) {
                      return data.toISOString().split('T')[0]; // YYYY-MM-DD
                    }
                    if (typeof data === 'string') {
                      // Se já for uma string, tenta converter para Date e depois formatar
                      const dataObj = new Date(data);
                      return dataObj.toISOString().split('T')[0];
                    }
                    return '';
                  };

                  // Processar itens da venda - apenas itens com produto/serviço selecionado
                  const itensValidos = vendaData.itens ? vendaData.itens
                    .filter((item) => item.produtoServico && item.produtoServico.trim() !== '')
                    .map((item) => ({
                      produto_servico_id: parseInt(item.produtoServico),
                      detalhes: item.detalhes || '',
                      quantidade: parseFloat(item.quantidade.replace(',', '.')) || 0,
                      valor_unitario: parseFloat(item.valorUnitario.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0,
                      total: parseFloat(item.total.replace(',', '.')) || 0,
                    })) : [];

                  // Pegar o primeiro produto/serviço para o campo produtos_servicos_id
                  const primeiroProdutoServico = itensValidos.length > 0 ? itensValidos[0].produto_servico_id : null;

                  // Preparar dados para envio
                  const dadosParaEnvio = {
                    tipo_venda: mapearTipoVenda(vendaData.tipoVenda),
                    cliente_id: parseInt(vendaData.cliente),
                    categoria_id: vendaData.categoriaFinanceira ? parseInt(vendaData.categoriaFinanceira) : null,
                    sub_categoria_id: vendaData.subCategoria ? parseInt(vendaData.subCategoria) : null,
                    produtos_servicos_id: primeiroProdutoServico,
                    company_id: parseInt(companyId),
                    centro_de_custo_id: vendaData.centroCusto ? parseInt(vendaData.centroCusto) : null,
                    vendedor_id: parseInt(userId),
                    data_venda: formatarDataParaMySQL(vendaData.dataVenda),
                    situacao: vendaData.situacao,
                    valor_venda: parseFloat(vendaData.totalFinal.replace(',', '.')),
                    desconto_venda: parseFloat(vendaData.descontoValor.replace(',', '.')),
                    pagamento: vendaData.formaPagamento,
                    conta_recebimento: vendaData.contaRecebimento ? parseInt(vendaData.contaRecebimento) : null,
                    parcelamento: vendaData.condicaoPagamento,
                    vencimento: formatarDataParaMySQL(vendaData.vencimento),
                    observacoes: vendaData.observacoesPagamento,
                    natureza: vendaData.naturezaOperacao,
                    observacoes_fiscais: vendaData.observacoesFiscais,
                  };

      // Debug: log dos dados sendo enviados
      console.log("📤 Dados sendo enviados para a API:", dadosParaEnvio);
      console.log("🔍 Primeiro produto/serviço:", primeiroProdutoServico);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/vendas`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(dadosParaEnvio),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erro ao salvar venda: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: result.message,
        id: result.id,
      };
    } catch (err) {
      console.error("❌ Erro ao salvar venda:", err);
      return {
        success: false,
        message: err instanceof Error ? err.message : "Erro desconhecido ao salvar venda",
      };
    }
  };

  useEffect(() => {
    fetchFormData();
  }, []);

  return {
    formData,
    isLoading,
    error,
    refetch: fetchFormData,
    saveVenda,
  };
} 