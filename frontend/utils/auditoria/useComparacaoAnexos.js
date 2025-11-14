import { useState, useEffect } from 'react';
import { comparacaoService } from '../../services/auditoria/comparacaoService';

export const useComparacaoAnexos = ({ 
  selectedCompany, 
  anoSelecionado 
}) => {
  const [comparacaoAnexos, setComparacaoAnexos] = useState([]);
  const [cnaesEmpresa, setCnaesEmpresa] = useState([]);
  const [cliente, setCliente] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Função para obter CNPJ da empresa/cliente
  const getCnpj = (empresa) => {
    if (!empresa) {
      return "";
    }
    
    // Verificar se é um objeto Company do contexto (sem CNPJ)
    if (empresa.id && empresa.name && !empresa.cnpj) {
      return "";
    }
    
    // Tentar diferentes propriedades onde o CNPJ pode estar
    const cnpj = empresa.cnpj || empresa.CNPJ || empresa.cnpj_emitente || empresa.CNPJ_EMITENTE || "";
    const cnpjLimpo = cnpj.replace(/\D/g, "");
    
    return cnpjLimpo;
  };

  // Carregar dados de comparação
  const carregarComparacao = async () => {
    if (!selectedCompany) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Priorizar clientes_id do localStorage para segurança multi-tenant
      if (typeof window === 'undefined') return;
      
      const selectedClientId = localStorage.getItem('selected_client_id');
      const cnpj = getCnpj(selectedCompany);
      
      let response;
      
      if (selectedClientId) {
        // Usar clientes_id (mais seguro)
        response = await comparacaoService.buscarComparacaoAnexos({
          clientes_id: selectedClientId,
          ano: anoSelecionado
        });
      } else if (cnpj) {
        // Fallback para CNPJ (manter compatibilidade)
        response = await comparacaoService.buscarComparacaoAnexos({
          cnpj: cnpj,
          ano: anoSelecionado
        });
      } else {
        throw new Error("Cliente não encontrado. Selecione um cliente específico ou verifique se a empresa possui CNPJ.");
      }
      
      // Regra adicional: se vier "incorreto" mas o extrato estiver em Anexo V
      // e o fator R do extrato for numérico, reclassificar como 'aviso'
      const isNumericFatorR = (valor) => {
        if (!valor) return false;
        const cleaned = valor.toString().replace(/\s/g, '').replace('%', '').replace(',', '.');
        const num = parseFloat(cleaned);
        return !isNaN(num);
      };

      const ajustados = (response.comparacaoAnexos || []).map((item) => {
        const anexoV = (item.anexoExtrato || '').toLowerCase().includes('anexo v');
        const fatorNumerico = isNumericFatorR(item.fatorRExtrato);
        if (item.status === 'incorreto' && anexoV && fatorNumerico) {
          return {
            ...item,
            status: 'aviso',
          };
        }
        return item;
      });

      // Ordenar cronologicamente: primeiro por ano, depois por mês (1→12)
      const ordenados = ajustados.sort((a, b) => {
        if (a.ano !== b.ano) return a.ano - b.ano;
        return a.mes - b.mes;
      });

      setComparacaoAnexos(ordenados);
      setCnaesEmpresa(response.cnaes);
      setCliente(response.cliente);
    } catch (err) {
      setError(err.message);
      setComparacaoAnexos([]);
      setCnaesEmpresa([]);
      setCliente(null);
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados quando empresa ou ano mudar
  useEffect(() => {
    if (selectedCompany && anoSelecionado) {
      carregarComparacao();
    }
  }, [selectedCompany, anoSelecionado]);

  return {
    comparacaoAnexos,
    cnaesEmpresa,
    cliente,
    loading,
    error,
    carregarComparacao
  };
};

