import { useState, useCallback, useEffect, useMemo } from 'react';

// UseVendasOptions: { startDate?: Date, endDate?: Date }
// UseVendasReturn: { vendas: any[], isLoading: boolean, error: string | null, buscarVendas: () => Promise<void>, refetch: () => Promise<void>, criarVenda: (dados: any) => Promise<any>, atualizarVenda: (id: number, dados: any) => Promise<any>, excluirVenda: (id: number) => Promise<any> }

export function useVendas(options) {
  const [vendas, setVendas] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const API = process.env.NEXT_PUBLIC_API_URL;

  // Memoizar as datas para evitar recriações desnecessárias
  const memoizedStartDate = useMemo(() => options?.startDate?.toISOString().split('T')[0], [options?.startDate]);
  const memoizedEndDate = useMemo(() => options?.endDate?.toISOString().split('T')[0], [options?.endDate]);

  const buscarVendas = useCallback(async () => {
    // Buscar empresaId do userData (EmpresaId com E maiúsculo)
    const userData = localStorage.getItem("userData");
    const token = localStorage.getItem("token");
    
    if (!userData || !token || !API) {
      setError("Dados de autenticação não encontrados no localStorage");
      return;
    }

    const parsedUserData = JSON.parse(userData);
    const empresaId = parsedUserData.EmpresaId;

    if (!empresaId) {
      setError("ID da empresa não encontrado");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Construir URL com filtros de data se fornecidos
      let url = `${API}/vendas?company_id=${empresaId}`;
      
      if (memoizedStartDate && memoizedEndDate) {
        url += `&start_date=${memoizedStartDate}&end_date=${memoizedEndDate}`;
      } else if (memoizedStartDate) {
        url += `&start_date=${memoizedStartDate}`;
      } else if (memoizedEndDate) {
        url += `&end_date=${memoizedEndDate}`;
      }

      console.log("🔍 URL da requisição:", url);
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error("Erro ao buscar vendas");
      }
      
      const data = await response.json();
      console.log("📦 Dados das vendas:", data);
      
      // Ordenar vendas da mais recente para a mais antiga
      const vendasOrdenadas = data.sort((a, b) => {
        const dataA = new Date(a.data_venda);
        const dataB = new Date(b.data_venda);
        return dataB.getTime() - dataA.getTime(); // Ordem decrescente (mais recente primeiro)
      });
      
      setVendas(vendasOrdenadas);
    } catch (error) {
      console.error("Erro ao buscar vendas:", error);
      setError("Erro ao carregar vendas. Tente novamente.");
      setVendas([]);
    } finally {
      setIsLoading(false);
    }
  }, [API, memoizedStartDate, memoizedEndDate]);

  // Carregar dados automaticamente quando as opções mudarem
  useEffect(() => {
    buscarVendas();
  }, [memoizedStartDate, memoizedEndDate]); // Usar as versões memoizadas

  const criarVenda = useCallback(async (dados) => {
    const token = localStorage.getItem("token");
    if (!token || !API) {
      throw new Error("Token não encontrado no localStorage");
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log("Dados sendo enviados para criar venda:", dados);
      
      const response = await fetch(`${API}/vendas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dados),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Erro ao criar venda:", errorData);
        throw new Error(`Erro ao criar venda: ${response.status} - ${errorData}`);
      }

      const resultado = await response.json();
      console.log("✅ Venda criada:", resultado);
      console.log("🔍 Verificando se deve criar recorrência...");
      console.log("📋 tipo_venda:", dados.tipo_venda);
      console.log("📋 dados.recorrencia:", dados.recorrencia);
      console.log("📋 resultado.id:", resultado.id);

      // Se for venda recorrente e tiver dados de recorrência, criar recorrência diretamente
      if (dados.tipo_venda === 'venda_recorrente' && dados.recorrencia && resultado.id) {
        console.log("🚀 Venda recorrente detectada, criando recorrência...");
        console.log("📋 Dados da recorrência:", dados.recorrencia);
        
        // Criar recorrência usando o ID da venda
        const dadosRecorrencia = {
          venda_id: resultado.id, // Usar venda_id em vez de contrato_id
          tipo_origem: 'venda', // Identificar que é uma venda
          tipo_intervalo: dados.recorrencia.tipo_intervalo,
          intervalo: dados.recorrencia.intervalo,
          indeterminado: dados.recorrencia.indeterminado,
          total_ciclos: dados.recorrencia.total_ciclos,
          status: dados.recorrencia.status
        };
        
        console.log("📤 Enviando dados da recorrência:", dadosRecorrencia);
        
        const responseRecorrencia = await fetch(`${API}/recorrencia-vendas-contratos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(dadosRecorrencia),
        });
        
        console.log("📥 Resposta da recorrência:", responseRecorrencia.status);
        
        if (!responseRecorrencia.ok) {
          const errorRecorrencia = await responseRecorrencia.text();
          console.error("❌ Erro ao criar recorrência:", errorRecorrencia);
          // Não falhar a venda se a recorrência der erro
          console.warn("Recorrência não foi criada, mas a venda foi salva");
        } else {
          const resultadoRecorrencia = await responseRecorrencia.json();
          console.log("✅ Recorrência criada:", resultadoRecorrencia);
        }
      } else {
        console.log("❌ Não criando recorrência porque:");
        console.log("   - tipo_venda === 'venda_recorrente':", dados.tipo_venda === 'venda_recorrente');
        console.log("   - dados.recorrencia existe:", !!dados.recorrencia);
        console.log("   - resultado.id existe:", !!resultado.id);
      }

      // Se tiver dados de boleto, criar boleto
      if (dados.boleto && resultado.id) {
        console.log("Criando boleto para a venda:", resultado.id);
        
        // Buscar dados completos do cliente
        console.log("🔍 Buscando dados completos do cliente ID:", dados.cliente_id);
        const responseCliente = await fetch(`${API}/clientes/${dados.cliente_id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (!responseCliente.ok) {
          console.error("❌ Erro ao buscar dados do cliente:", responseCliente.status);
          throw new Error(`Erro ao buscar dados do cliente: ${responseCliente.status}`);
        }
        
        const dadosCliente = await responseCliente.json();
        console.log("✅ Dados do cliente encontrados:", dadosCliente);
        
        const dadosBoleto = {
          conta_corrente: dados.boleto.conta_corrente,
          seuNumero: `${resultado.id}_${Date.now()}`, // Número único
          valorNominal: dados.valor_venda,
          dataVencimento: dados.vencimento,
          numDiasAgenda: 60,
          pagador: {
            nome: dadosCliente.nome_fantasia || dadosCliente.razao_social || dadosCliente.nome,
            cpfCnpj: dadosCliente.cpf_cnpj || dadosCliente.cnpj || dadosCliente.cpf,
            email: dadosCliente.email || dados.cliente_email || "",
            endereco: dadosCliente.endereco || "",
            numero: dadosCliente.numero || "",
            complemento: dadosCliente.complemento || "",
            bairro: dadosCliente.bairro || "",
            cidade: dadosCliente.cidade || "",
            estado: dadosCliente.estado || "",
            cep: dadosCliente.cep || ""
          },
          formasRecebimento: ["BOLETO"],
          mensagem: dados.observacoes || "Pagamento referente à venda"
        };

        const responseBoleto = await fetch(`${API}/inter/cobranca`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(dadosBoleto),
        });

        if (!responseBoleto.ok) {
          const errorBoleto = await responseBoleto.text();
          console.error("Erro ao criar boleto:", errorBoleto);
          // Não falhar a venda se o boleto der erro
          console.warn("Boleto não foi criado, mas a venda foi salva");
        } else {
          const resultadoBoleto = await responseBoleto.json();
          console.log("Boleto criado:", resultadoBoleto);

          // Se tiver dados de e-mail, enviar e-mail com boleto
          const emailCliente = dadosCliente.email || dados.cliente_email;
          if (dados.email && emailCliente) {
            console.log("Enviando e-mail com boleto para:", emailCliente);
            const dadosEmail = {
              to: emailCliente,
              subject: `Boleto - Venda ${resultado.id}`,
              htmlContent: `
                <h2>Olá ${dadosCliente.nome_fantasia || dadosCliente.razao_social || dadosCliente.nome}!</h2>
                <p>Segue o boleto referente à sua venda.</p>
                <p><strong>Valor:</strong> R$ ${dados.valor_venda}</p>
                <p><strong>Vencimento:</strong> ${dados.vencimento}</p>
                <p><strong>Link do boleto:</strong> <a href="${resultadoBoleto.linkBoleto}">Clique aqui</a></p>
                <p>Obrigado pela preferência!</p>
              `,
              boletoId: resultadoBoleto.insertId
            };

            const responseEmail = await fetch(`${API}/email/enviar-com-boleto`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(dadosEmail),
            });

            if (!responseEmail.ok) {
              const errorEmail = await responseEmail.text();
              console.error("Erro ao enviar e-mail:", errorEmail);
              console.warn("E-mail não foi enviado, mas a venda e boleto foram criados");
            } else {
              console.log("E-mail enviado com sucesso");
            }
          }
        }
      }

      await buscarVendas();
      return resultado;
    } catch (error) {
      console.error("Erro ao criar venda:", error);
      setError("Erro ao criar venda. Tente novamente.");
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [API, buscarVendas]);

  // Atualizar venda
  const atualizarVenda = useCallback(async (id, dados) => {
    const token = localStorage.getItem("token");

    if (!token || !API) {
      throw new Error("Token não encontrado no localStorage");
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log(`🔄 Atualizando venda ${id} com dados:`, dados);

      const response = await fetch(`${API}/vendas/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dados),
      });

      console.log(`📄 Status da resposta: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Erro na resposta: ${response.status} ${response.statusText}`);
        console.error(`📄 Conteúdo do erro:`, errorText);
        throw new Error(`Erro ao atualizar venda: ${response.status} - ${errorText}`);
      }

      const resultado = await response.json();
      console.log(`✅ Venda atualizada com sucesso:`, resultado);

      // Recarregar a lista de vendas
      await buscarVendas();
      
      return resultado;
    } catch (error) {
      console.error("Erro ao atualizar venda:", error);
      setError("Erro ao atualizar venda. Tente novamente.");
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [API, buscarVendas]);

  // Excluir venda
  const excluirVenda = useCallback(async (id) => {
    const token = localStorage.getItem("token");

    if (!token || !API) {
      throw new Error("Token não encontrado no localStorage");
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log(`🗑️ Excluindo venda ${id}`);

      const response = await fetch(`${API}/vendas/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log(`📄 Status da resposta: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Erro na resposta: ${response.status} ${response.statusText}`);
        console.error(`📄 Conteúdo do erro:`, errorText);
        throw new Error(`Erro ao excluir venda: ${response.status} - ${errorText}`);
      }

      const resultado = await response.json();
      console.log(`✅ Venda excluída com sucesso:`, resultado);

      // Recarregar a lista de vendas
      await buscarVendas();
      
      return resultado;
    } catch (error) {
      console.error("Erro ao excluir venda:", error);
      setError("Erro ao excluir venda. Tente novamente.");
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [API, buscarVendas]);

  return {
    vendas,
    isLoading,
    error,
    buscarVendas,
    refetch: buscarVendas, // Alias para refetch
    criarVenda,
    atualizarVenda, // ✅ Adicionado - Função para atualizar vendas
    excluirVenda,
  };
}; 