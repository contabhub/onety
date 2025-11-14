import { useState, useCallback } from 'react';

export const useContratos = () => {
  const [contratos, setContratos] = useState([]);
  const [recorrencias, setRecorrencias] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const API = process.env.NEXT_PUBLIC_API_URL;

  // Buscar próximo número de contrato automaticamente
  const buscarProximoNumeroContrato = useCallback(async () => {
    // Buscar empresaId do userData (padrão correto do sistema)
    const userData = localStorage.getItem("userData");
    const user = userData ? JSON.parse(userData) : null;
    const empresaId = user?.EmpresaId || user?.empresa?.id || null;
    const token = localStorage.getItem("token");

    if (!empresaId || !token || !API) {
      throw new Error("EmpresaId ou Token não encontrados no localStorage");
    }

    try {
      // Buscar contratos da empresa
      const response = await fetch(`${API}/financeiro/contratos?empresa_id=${empresaId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao buscar contratos para gerar número");
      }

      const contratosEmpresa = await response.json();
      
      // Filtrar apenas contratos ativos e com número válido
      const contratosComNumero = contratosEmpresa.filter((contrato) => 
        contrato.status === "ativo" && 
        contrato.numero_contrato && 
        contrato.numero_contrato.trim() !== ""
      );

      if (contratosComNumero.length === 0) {
        // Se não há contratos, começar com 001
        return "001";
      }

      // Extrair números dos contratos existentes
      const numeros = contratosComNumero
        .map((contrato) => {
          const numero = contrato.numero_contrato || '';
          // Tentar extrair número do formato atual (pode ser "001", "CONTRATO-001", etc.)
          const match = numero.match(/(\d+)/);
          return match ? parseInt(match[1]) : 0;
        })
        .filter(num => num > 0)
        .sort((a, b) => b - a); // Ordenar decrescente

      // Pegar o maior número e adicionar 1
      const proximoNumero = (numeros[0] || 0) + 1;
      
      // Formatar com zeros à esquerda (001, 002, etc.)
      return proximoNumero.toString().padStart(3, '0');
    } catch (error) {
      console.error("Erro ao buscar próximo número de contrato:", error);
      throw new Error("Erro ao gerar número de contrato. Tente novamente.");
    }
  }, [API]);

  // Buscar contratos (usando a rota específica de contratos)
  const buscarContratos = useCallback(async () => {
    // Buscar empresaId do userData (padrão correto do sistema)
    const userData = localStorage.getItem("userData");
    const user = userData ? JSON.parse(userData) : null;
    const empresaId = user?.EmpresaId || user?.empresa?.id || null;
    const token = localStorage.getItem("token");

    if (!empresaId || !token || !API) {
      setError("EmpresaId ou Token não encontrados no localStorage");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Usar a rota específica de contratos com empresa_id (conforme esperado pelo backend)
      const response = await fetch(`${API}/financeiro/contratos?empresa_id=${empresaId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao buscar contratos");
      }

      let data = await response.json();
      console.log("Contratos encontrados:", data);

      // O backend já está filtrando apenas contratos financeiros (modelos_contrato_id IS NULL) 
      // e contratos contratuais (straton = 1), então não precisamos filtrar no frontend

      setContratos(data);
    } catch (error) {
      console.error("Erro ao buscar contratos:", error);
      setError("Erro ao carregar contratos. Tente novamente.");
      setContratos([]);
    } finally {
      setIsLoading(false);
    }
  }, [API]);

  // Buscar recorrências
  const buscarRecorrencias = useCallback(async () => {
    const token = localStorage.getItem("token");

    if (!token || !API) {
      setError("Token não encontrado no localStorage");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API}/financeiro/recorrencia-vendas-contratos`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao buscar recorrências");
      }

      const data = await response.json();
      setRecorrencias(data);
    } catch (error) {
      console.error("Erro ao buscar recorrências:", error);
      setError("Erro ao carregar recorrências. Tente novamente.");
      setRecorrencias([]);
    } finally {
      setIsLoading(false);
    }
  }, [API]);

  // Criar novo contrato (usando a rota específica de contratos)
  const criarContrato = useCallback(async (dados) => {
    const token = localStorage.getItem("token");

    if (!token || !API) {
      throw new Error("Token não encontrado no localStorage");
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log("Dados sendo enviados para criar contrato:", dados);

      // Usar a rota específica de contratos
      const response = await fetch(`${API}/financeiro/contratos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dados),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Erro ao criar contrato:", errorData);
        throw new Error(`Erro ao criar contrato: ${response.status} - ${errorData}`);
      }

      const resultado = await response.json();
      console.log("Contrato criado:", resultado);

      // Se houver dados de recorrência, criar a recorrência
      if (dados.recorrencia && resultado.id) {
        console.log("Criando recorrência para o contrato:", resultado.id);
        
        const dadosRecorrencia = {
          contrato_id: resultado.id,
          tipo_origem: 'contrato', // Identificar que é um contrato
          tipo_intervalo: dados.recorrencia.tipo_intervalo,
          intervalo: dados.recorrencia.intervalo,
          indeterminado: dados.recorrencia.indeterminado,
          total_ciclos: dados.recorrencia.total_ciclos,
          status: dados.recorrencia.status
        };

        const responseRecorrencia = await fetch(`${API}/financeiro/recorrencia-vendas-contratos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(dadosRecorrencia),
        });

        if (!responseRecorrencia.ok) {
          const errorRecorrencia = await responseRecorrencia.text();
          console.error("Erro ao criar recorrência:", errorRecorrencia);
          throw new Error(`Erro ao criar recorrência: ${responseRecorrencia.status} - ${errorRecorrencia}`);
        }

        const resultadoRecorrencia = await responseRecorrencia.json();
        console.log("Recorrência criada:", resultadoRecorrencia);
      }

      // Recarregar a lista de contratos
      await buscarContratos();
      
      return resultado;
    } catch (error) {
      console.error("Erro ao criar contrato:", error);
      setError("Erro ao criar contrato. Tente novamente.");
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [API, buscarContratos]);

  // Atualizar contrato
  const atualizarContrato = useCallback(async (id, dados) => {
    const token = localStorage.getItem("token");

    if (!token || !API) {
      throw new Error("Token não encontrado no localStorage");
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log(`🔄 Atualizando contrato ${id} com dados:`, dados);

      const response = await fetch(`${API}/financeiro/contratos/${id}`, {
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
        throw new Error(`Erro ao atualizar contrato: ${response.status} - ${errorText}`);
      }

      const resultado = await response.json();
      console.log(`✅ Contrato atualizado com sucesso:`, resultado);

      // Recarregar a lista de contratos
      await buscarContratos();
      
      return resultado;
    } catch (error) {
      console.error("Erro ao atualizar contrato:", error);
      setError("Erro ao atualizar contrato. Tente novamente.");
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [API, buscarContratos]);

  // Excluir contrato
  const excluirContrato = useCallback(async (id) => {
    const token = localStorage.getItem("token");

    if (!token || !API) {
      throw new Error("Token não encontrado no localStorage");
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API}/financeiro/contratos/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao excluir contrato");
      }

      // Recarregar a lista de contratos
      await buscarContratos();
      
      return await response.json();
    } catch (error) {
      console.error("Erro ao excluir contrato:", error);
      setError("Erro ao excluir contrato. Tente novamente.");
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [API, buscarContratos]);

  return {
    contratos,
    recorrencias,
    isLoading,
    error,
    buscarContratos,
    buscarRecorrencias,
    criarContrato,
    atualizarContrato,
    excluirContrato,
    buscarProximoNumeroContrato,
  };
}; 