// Importação dos módulos e bibliotecas necessárias para o funcionamento do componente
import { useState, useMemo, useEffect } from 'react';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver'; 
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { analisarNcm, analisarMultiplosNcms } from '../../services/auditoria/ncmAnaliseService';
import { toast, Toaster } from 'react-hot-toast';
import styles from '../../styles/auditoria/LeitorXML.module.css';
import SpaceLoader from '../onety/menu/SpaceLoader';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const AUTH_TOKEN_KEY = 'token';

const resolveCompanyFromStorage = () => {
  if (typeof window === 'undefined') {
    return { id: null, name: '' };
  }

  let storedId = localStorage.getItem('selected_company_id');
  let storedName = localStorage.getItem('selected_company_name') || '';

  try {
    const rawUserData = localStorage.getItem('userData');
    if (rawUserData) {
      const user = JSON.parse(rawUserData);
      const possibleId =
        user?.selectedCompanyId ||
        user?.selected_company_id ||
        user?.companyId ||
        user?.company_id ||
        user?.EmpresaId ||
        user?.empresaId ||
        user?.empresa_id ||
        null;

      if (possibleId) {
        storedId = String(possibleId);
      }

      const possibleName =
        user?.selectedCompanyName ||
        user?.selected_company_name ||
        user?.EmpresaNome ||
        user?.empresaNome ||
        user?.empresa_nome ||
        storedName;

      if (possibleName) {
        storedName = String(possibleName);
      }
    }
  } catch (error) {
    console.warn('[LeitorXML] Não foi possível interpretar userData ao resolver empresa selecionada:', error);
  }

  if (!storedId) {
    const legacyId = localStorage.getItem('empresaId');
    if (legacyId) {
      storedId = String(legacyId);
    }
  }

  return {
    id: storedId ? String(storedId) : null,
    name: storedName || '',
  };
};

const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

const buildAuthHeaders = () => {
  const token = getAuthToken();
  if (!token) {
    return {};
  }
  return {
    Authorization: `Bearer ${token}`,
  };
};

// Componente principal do leitor de XML
export default function LeitorXML() {
  // Estado para armazenar os arquivos carregados pelo usuário
  const [files, setFiles] = useState([]);
  // Estado para armazenar a lista de documentos processados
  const [documentList, setDocumentList] = useState([]);
  // Estado para armazenar o nome da empresa analisada
  const [nomeEmpresaAnalise, setNomeEmpresaAnalise] = useState('');
  // Estado para armazenar o CNPJ da empresa analisada
  const [cnpjEmpresaAnalise, setCnpjEmpresaAnalise] = useState('');
  // Estado para armazenar o resumo por NCM
  const [ncmResumeList, setNcmResumeList] = useState([]);
  // Estado para armazenar os NCMs disponíveis para filtro
  const [availableNcms, setAvailableNcms] = useState([]);
  // Estado para armazenar o NCM selecionado no filtro
  const [selectedNcm, setSelectedNcm] = useState(''); 
  // Estado para armazenar o resumo mensal de faturamento
  const [monthlyRevenueList, setMonthlyRevenueList] = useState([]);
  // Estado para armazenar o mês/ano selecionado no filtro
  const [selectedMonthYear, setSelectedMonthYear] = useState(''); 
  // Estado para armazenar os meses/anos disponíveis para filtro
  const [availableMonthYears, setAvailableMonthYears] = useState([]);
  // Estado para indicar se está processando arquivos
  const [isLoading, setIsLoading] = useState(false);
  // Estado para armazenar notas fiscais puladas (avisos)
  const [skippedNotes, setSkippedNotes] = useState([]); // NOVO ESTADO
  

  
  // Estados para controle da análise de NCMs
  const [analisandoNcms, setAnalisandoNcms] = useState(false);
  const [progressoNcms, setProgressoNcms] = useState({ atual: 0, total: 0 });
  const [resultadosNcms, setResultadosNcms] = useState(null);
  const [erroNcms, setErroNcms] = useState(null);
  
  // Estado para controle de importação de planilha
  const [importandoPlanilha, setImportandoPlanilha] = useState(false);

  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [selectedCompanyName, setSelectedCompanyName] = useState('');

  useEffect(() => {
    const loadCompany = () => {
      const resolved = resolveCompanyFromStorage();
      setSelectedCompanyId(resolved.id);
      setSelectedCompanyName(resolved.name);
    };

    loadCompany();

    const handleStorageChange = (event) => {
      if (!event?.key || ['selected_company_id', 'selected_company_name', 'userData', 'empresaId'].includes(event.key)) {
        loadCompany();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const fetchClientes = async (searchParams) => {
    if (!API_BASE_URL) {
      return { error: 'NEXT_PUBLIC_API_URL não configurada' };
    }

    const headers = getAutenticacaoValida();
    if (!headers) {
      return { error: 'Autenticação necessária' };
    }

    try {
      const params = new URLSearchParams();
      Object.entries(searchParams || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });

      const querySuffix = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`${API_BASE_URL}/auditoria/clientes${querySuffix}`, {
        headers: {
          ...headers,
        },
      });

      const payload = await response.json();

      if (!response.ok) {
        return { error: payload?.error || 'Erro ao buscar clientes', data: payload };
      }

      return { data: payload };
    } catch (error) {
      console.error('[LeitorXML] Erro ao buscar clientes via API:', error);
      return { error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  };

  const createNotasFiscaisBulk = async (notasFiscais) => {
    if (!API_BASE_URL) {
      return { error: 'NEXT_PUBLIC_API_URL não configurada' };
    }

    const headers = getAutenticacaoValida();
    if (!headers) {
      return { error: 'Autenticação necessária' };
    }

    // Garantia de array, log e validação
    const companyIdToSend = selectedCompanyId;
    if (!companyIdToSend) {
      return { error: 'company_id não encontrado no estado do componente' };
    }
    if (!Array.isArray(notasFiscais) || notasFiscais.length === 0) {
      console.error('[LeitorXML] Lote vazio enviado para a API:', { company_id: companyIdToSend, notas: notasFiscais });
      return { error: 'Notas fiscais para envio em lote precisam ser um array não vazio.' };
    }

    const payload = {
      company_id: companyIdToSend,
      notas: notasFiscais
    };
    console.log('[LeitorXML] Enviando para API (POST /bulk):', payload);
    try {
      const response = await fetch(`${API_BASE_URL}/auditoria/notas-fiscais/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(payload),
      });

      const resPayload = await response.json();

      if (!response.ok) {
        return { error: resPayload?.error || 'Erro ao salvar notas fiscais', data: resPayload };
      }

      return { data: resPayload };
    } catch (error) {
      console.error('[LeitorXML] Erro ao salvar notas fiscais via API:', error);
      return { error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  };

  const getAutenticacaoValida = () => {
    const headers = buildAuthHeaders();
    if (!headers.Authorization) {
      console.error('[LeitorXML] Token de autenticação não encontrado.');
      toast.error('Sessão expirada. Faça login novamente.');
      return null;
    }
    return headers;
  };


  // Função chamada ao selecionar arquivos pelo input
  const handleFileChange = (event) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      setFiles(prevFiles => [...prevFiles, ...newFiles]);
    }
  };





  // Função para permitir arrastar arquivos para a área de upload
  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  // Função chamada ao sair da área de drag-and-drop
  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  // Função chamada ao soltar arquivos na área de drag-and-drop
  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    
    const droppedFiles = Array.from(event.dataTransfer.files);
    const validFiles = droppedFiles.filter(file => 
      file.name.toLowerCase().endsWith('.xml') || 
      file.name.toLowerCase().endsWith('.zip')
    );
    
    if (validFiles.length > 0) {
      setFiles(prevFiles => [...prevFiles, ...validFiles]);
    }
  };

  // Função para remover um arquivo da lista
  const removeFile = (index) => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  // Função para limpar todos os arquivos selecionados
  const clearAllFiles = () => {
    setFiles([]);
  };

  // Função para obter dados de ST de um NCM específico
  const obterDadosST = (ncm) => {
    if (!resultadosNcms?.ncmsProcessados) return null;
    
    const resultado = resultadosNcms.ncmsProcessados.find((r) => r.ncm === ncm);
    if (!resultado || !resultado.encontrado) return null;
    
    const primeiroItem = resultado.dados?.resposta?.[0];
    if (!primeiroItem) return null;
    
    return {
      status: resultado.origem === 'cache' ? '💾 Cache' : resultado.origem === 'api' ? '🌐 API' : '❌ Não Encontrado',
      mva: primeiroItem.mva || 'N/A',
      aliquota: primeiroItem.aliquota_interestadual || 'N/A',
      cest: primeiroItem.cest || 'N/A',
      descricao: primeiroItem.descricao || 'N/A'
    };
  };



  // Função para processar NCMs automaticamente quando documentos são carregados
  const processarNcmsAutomaticamente = async (documentos) => {
    if (documentos.length === 0) return;
    
    try {
      console.log('[LeitorXML] 🔄 Processando NCMs automaticamente com estados específicos...');
      
      // Agrupa NCMs por combinação de estados para otimizar consultas
      const ncmsPorEstados = new Map();
      
      documentos.forEach(doc => {
        const estadoOrigem = doc.estadoOrigem || 'SP';
        const estadoDestino = doc.estadoDestino || 'PR';
        const chaveEstados = `${estadoOrigem}-${estadoDestino}`;
        
        if (doc.ncm && doc.ncm.trim()) {
          if (!ncmsPorEstados.has(chaveEstados)) {
            ncmsPorEstados.set(chaveEstados, []);
          }
          const listaNcms = ncmsPorEstados.get(chaveEstados);
          if (listaNcms) {
            listaNcms.push(doc.ncm.trim());
          }
        }
      });
      
      // Processa cada grupo de estados
      const resultados = [];
      let totalNcms = 0;
      let encontrados = 0;
      let naoEncontrados = 0;
      let doCache = 0;
      let daAPI = 0;
      
      for (const [chaveEstados, ncms] of ncmsPorEstados) {
        const [estadoOrigem, estadoDestino] = chaveEstados.split('-');
        
    
        
        const configuracao = {
          estado_origem: estadoOrigem,
          estado_destino: estadoDestino,
          destinacao_mercadoria: 1, // Comercialização
          regime_origem: 1, // Regime Normal
          regime_destino: 1 // Regime Normal
        };
        
        const resultadoGrupo = await analisarMultiplosNcms(ncms, configuracao);
        resultados.push(...resultadoGrupo);
        
        // Atualiza estatísticas
        totalNcms += ncms.length;
        resultadoGrupo.forEach((r) => {
          if (r.encontrado) encontrados++;
          else naoEncontrados++;
          if (r.origem === 'cache') doCache++;
          else if (r.origem === 'api') daAPI++;
        });
      }
      
      const resultadoFinal = {
        ncmsProcessados: resultados,
        estatisticas: {
          total: totalNcms,
          encontrados,
          naoEncontrados,
          doCache,
          daAPI
        }
      };
      
      setResultadosNcms(resultadoFinal);
      console.log('[LeitorXML] ✅ Análise automática concluída:', resultadoFinal.estatisticas);
    } catch (error) {
      console.error('[LeitorXML] ❌ Erro na análise automática:', error);
    }
  };





  // Função utilitária para formatar números no padrão brasileiro
  const formatNumber = (value) => {
    const num = parseFloat(String(value).replace(',', '.'));
    if (isNaN(num)) return '';
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Função utilitária para converter string para número
  const parseNumber = (value) => {
    if (!value) return 0;
    
    const valorTexto = value.trim();
    
    // Se o valor já está no formato correto (com ponto decimal), usar diretamente
    if (/^\d+\.\d+$/.test(valorTexto)) {
      return parseFloat(valorTexto);
    }
    
    // Se tem vírgula como separador decimal (formato brasileiro)
    if (valorTexto.includes(',')) {
      // Remove pontos de milhares e substitui vírgula por ponto
      const cleanedValue = valorTexto.replace(/\./g, '').replace(',', '.');
      return parseFloat(cleanedValue);
    }
    
    // Se não tem separador decimal, tratar como número inteiro
    if (/^\d+$/.test(valorTexto)) {
      return parseFloat(valorTexto);
    }
    
    // Para outros casos, tentar parseFloat diretamente
    const num = parseFloat(valorTexto);
    return isNaN(num) ? 0 : num;
  };

  // Função utilitária para garantir que valor seja sempre um número válido
  const garantirNumero = (valor) => {
    if (valor === null || valor === undefined) return 0;
    
    // Se já é número, retorna o valor
    if (typeof valor === 'number') return valor;
    
    // Se é string, converte para número usando a função parseNumber
    if (typeof valor === 'string') {
      return parseNumber(valor);
    }
    
    return 0;
  };

  // NOVA FUNÇÃO: Para extrair valores do XML sem formatação
  const extrairValorNumerico = (element, selector) => {
    if (!element) return 0;
    const valorElement = element.querySelector(selector);
    if (!valorElement || !valorElement.textContent) return 0;
    
    const valorTexto = valorElement.textContent.trim();
    return parseNumber(valorTexto);
  };

  // NOVA FUNÇÃO: Para extrair valores diretamente de elementos filhos
  const extrairValorDireto = (element, tagName) => {
    if (!element) return 0;
    const valorElement = element.getElementsByTagName(tagName)[0];
    if (!valorElement || !valorElement.textContent) return 0;
    
    const valorTexto = valorElement.textContent.trim();
    const valorConvertido = parseNumber(valorTexto);
    
    return valorConvertido;
  };

  // Função auxiliar para formatar data para formato ISO (YYYY-MM-DD)
  const formatarDataParaISO = (dataString) => {
    try {
      // Se já está no formato ISO (YYYY-MM-DD), retorna como está
      if (/^\d{4}-\d{2}-\d{2}/.test(dataString)) {
        return dataString.split('T')[0];
      }
      
      // Se está no formato brasileiro (DD/MM/YYYY HH:mm:ss)
      if (/^\d{2}\/\d{2}\/\d{4}/.test(dataString)) {
        const [dataParte, horaParte] = dataString.split(' ');
        const [dia, mes, ano] = dataParte.split('/');
        return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
      }
      
      // Se está no formato brasileiro sem hora (DD/MM/YYYY)
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataString)) {
        const [dia, mes, ano] = dataString.split('/');
        return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
      }
      
      // Se está no formato ISO com timestamp (YYYY-MM-DDTHH:mm:ss)
      if (/^\d{4}-\d{2}-\d{2}T/.test(dataString)) {
        return dataString.split('T')[0];
      }
      
      console.warn('[LeitorXML] Formato de data não reconhecido:', dataString);
      return dataString; // Retorna como está se não conseguir formatar
    } catch (error) {
      console.error('[LeitorXML] Erro ao formatar data:', dataString, error);
      return dataString; // Retorna como está em caso de erro
    }
  };

  // NOVA FUNÇÃO: Para processar valores de impostos sem formatação
  const processarImpostos = (impostoElement, tipoImposto) => {
    if (!impostoElement) return { valor: 0, cst: '' };
    
    const impostoTag = impostoElement.getElementsByTagName(tipoImposto)[0];
    if (!impostoTag) return { valor: 0, cst: '' };
    
    let totalImposto = 0;
    let cst = '';
    
    // Log para debug
    console.log(`[LeitorXML] Processando ${tipoImposto}:`, impostoTag);
    
    // Primeiro, tenta encontrar o CST
    const cstElement = impostoTag.querySelector('CST');
    if (cstElement) {
      cst = cstElement.textContent || '';
      console.log(`[LeitorXML] CST encontrado para ${tipoImposto}:`, cst);
    }
    
    // Procura por diferentes padrões de valor de imposto
    let valorElement = null;
    if (tipoImposto === 'ICMS') {
      valorElement = impostoTag.querySelector('vICMS') || 
                    impostoTag.querySelector('vICMSST') ||
                    impostoTag.querySelector('vICMSDeson');
    } else if (tipoImposto === 'PIS') {
      valorElement = impostoTag.querySelector('vPIS');
    } else if (tipoImposto === 'COFINS') {
      valorElement = impostoTag.querySelector('vCOFINS');
    }
    
    if (valorElement && valorElement.textContent) {
      const valorTexto = valorElement.textContent.trim();
      totalImposto = parseNumber(valorTexto);
      console.log(`[LeitorXML] Valor ${tipoImposto} extraído:`, valorTexto, 'convertido para:', totalImposto);
    } else {
      console.log(`[LeitorXML] Nenhum valor encontrado para ${tipoImposto}`);
    }
    
    return { valor: totalImposto, cst };
  };

  // Função para detectar o tipo de documento fiscal no XML
  // Retorna 'NFe', 'NFCe' ou 'NFSe' conforme o conteúdo do XML
  const detectDocumentType = (xmlDoc) => {
    // Verifica se é NFe
    if (xmlDoc.querySelector('NFe')) {
      return 'NFe';
    }
    // Verifica se é NFCe
    if (xmlDoc.querySelector('NFCe')) {
      return 'NFCe';
    }
    // Verifica se é NFSe (ampliado para mais padrões)
    if (
      xmlDoc.querySelector('NFSe') ||
      xmlDoc.querySelector('Nfse') ||
      xmlDoc.querySelector('CompNfse') ||
      xmlDoc.querySelector('Rps') ||
      xmlDoc.querySelector('GerarNfseResposta') ||
      xmlDoc.querySelector('ConsultarNfseResposta') ||
      xmlDoc.querySelector('consultarNotaResponse') ||
      xmlDoc.querySelector('xmlNfpse') // <- Adicionado para seu padrão
    ) {
      return 'NFSe';
    }
    // Padrão é NFe
    return 'NFe';
  };

  // Função para processar NFe (Nota Fiscal Eletrônica)
  // Extrai todos os dados relevantes do XML e retorna uma lista de produtos/documentos
  const processNFe = (xmlDoc) => {
    const numero = xmlDoc.querySelector('nNF')?.textContent || '';
    const cnpjEmitente = xmlDoc.querySelector('emit > CNPJ')?.textContent || '';
    const nomeEmitente = xmlDoc.querySelector('emit > xNome')?.textContent || '';
    const dataEmissaoRaw = xmlDoc.querySelector('dhEmi')?.textContent || ''; 
    let cnpjDestinatario = xmlDoc.querySelector('dest > CNPJ')?.textContent || '';
    let nomeDestinatario = xmlDoc.querySelector('dest > xNome')?.textContent || '';
    const serie = xmlDoc.querySelector('serie')?.textContent || '1';
    
    // Fallback: se não tem CNPJ, verificar se tem CPF
    if (!cnpjDestinatario) {
      const cpfDestinatario = xmlDoc.querySelector('dest > CPF')?.textContent || '';
      if (cpfDestinatario) {
        // Converter CPF para formato de 14 dígitos (padrão CNPJ)
        cnpjDestinatario = cpfDestinatario.padStart(14, '0');
        console.log('[LeitorXML] 🔄 CPF encontrado, convertido para CNPJ:', { cpfDestinatario, cnpjDestinatario });
      }
    }
    
    // Se ainda não tem destinatário, usar CNPJ genérico para consumidor final
    if (!cnpjDestinatario) {
      cnpjDestinatario = '00000000000000';
      nomeDestinatario = 'Consumidor Final';
      console.log('[LeitorXML] 🔄 Usando CNPJ genérico para consumidor final');
    }
    
    // Debug: verificar se o CNPJ destinatário está sendo extraído
    console.log('[LeitorXML] 🔍 Debug CNPJ Destinatário NFe:', {
      cnpjDestinatario,
      nomeDestinatario,
      destElement: xmlDoc.querySelector('dest'),
      cnpjElement: xmlDoc.querySelector('dest > CNPJ'),
      // Verificar se é NFCe (sem destinatário)
      isNFCe: xmlDoc.querySelector('ide > tpNF')?.textContent === '65',
      // Verificar outros elementos possíveis
      avulsaElement: xmlDoc.querySelector('avulsa'),
      entregaElement: xmlDoc.querySelector('entrega'),
      // Verificar se tem CPF em vez de CNPJ
      cpfDestinatario: xmlDoc.querySelector('dest > CPF')?.textContent || '',
      // Verificar estrutura completa do XML
      xmlStructure: {
        ide: xmlDoc.querySelector('ide')?.outerHTML?.substring(0, 200),
        dest: xmlDoc.querySelector('dest')?.outerHTML?.substring(0, 200),
        emit: xmlDoc.querySelector('emit')?.outerHTML?.substring(0, 200)
      }
    });
    
    // Extrair estados origem e destino
    const estadoOrigem = xmlDoc.querySelector('emit > enderEmit > UF')?.textContent || '';
    const estadoDestino = xmlDoc.querySelector('dest > enderDest > UF')?.textContent || '';

    const dets = xmlDoc.getElementsByTagName('det');
    const produtosData = [];

    for (let i = 0; i < dets.length; i++) {
      const prod = dets[i].getElementsByTagName('prod')[0];
      const imposto = dets[i].getElementsByTagName('imposto')[0];
      
      const produto = prod?.getElementsByTagName('xProd')[0]?.textContent || '';
      const ncm = prod?.getElementsByTagName('NCM')[0]?.textContent || '';
      const cfop = prod?.getElementsByTagName('CFOP')[0]?.textContent || '';
      
      // Extrair valores como números, não como strings formatadas
      const quantidadeNum = extrairValorDireto(prod, 'qCom');
      const valorUnitarioNum = extrairValorDireto(prod, 'vUnCom');
      
      // Processar impostos usando a nova função
      const { valor: icmsValor, cst } = processarImpostos(imposto, 'ICMS');
      const { valor: pisValor, cst: cstPis } = processarImpostos(imposto, 'PIS');
      const { valor: cofinsValor, cst: cstCofins } = processarImpostos(imposto, 'COFINS');
      
      // Log detalhado dos impostos extraídos
      console.log(`[LeitorXML] Produto ${i + 1} - Impostos extraídos:`, {
        produto: produto,
        ncm: ncm,
        icms: icmsValor,
        pis: pisValor,
        cofins: cofinsValor,
        cst: cst,
        cstPis: cstPis,
        cstCofins: cstCofins
      });
      
      produtosData.push({
        numero,
        cnpjEmitente,
        nomeEmitente,
        dataEmissao: dataEmissaoRaw, 
        cnpjDestinatario,
        nomeDestinatario,
        produto,
        ncm,
        cfop,
        cst,
        quantidade: quantidadeNum.toString(),
        valorUnitario: valorUnitarioNum.toString(),
        pis: pisValor.toString(),
        cofins: cofinsValor.toString(),
        icms: icmsValor.toString(),
        cstPis,
        cstCofins,
        tipoDocumento: 'NFe',
        estadoOrigem,
        estadoDestino
      });
    }

    // Log para debug do total da NFe

    produtosData.forEach((prod, index) => {
      // Log removido para limpeza
    });

    return produtosData;
  };

  // Função para processar NFCe (Nota Fiscal de Consumidor Eletrônica)
  // Extrai todos os dados relevantes do XML e retorna uma lista de produtos/documentos
  const processNFCe = (xmlDoc) => {
    const numero = xmlDoc.querySelector('nNF')?.textContent || '';
    const cnpjEmitente = xmlDoc.querySelector('emit > CNPJ')?.textContent || '';
    const nomeEmitente = xmlDoc.querySelector('emit > xNome')?.textContent || '';
    const dataEmissaoRaw = xmlDoc.querySelector('dhEmi')?.textContent || ''; 
    let cnpjDestinatario = xmlDoc.querySelector('dest > CNPJ')?.textContent || '';
    let nomeDestinatario = xmlDoc.querySelector('dest > xNome')?.textContent || '';
    const serie = xmlDoc.querySelector('serie')?.textContent || '1';
    
    // Fallback: se não tem CNPJ, verificar se tem CPF
    if (!cnpjDestinatario) {
      const cpfDestinatario = xmlDoc.querySelector('dest > CPF')?.textContent || '';
      if (cpfDestinatario) {
        // Converter CPF para formato de 14 dígitos (padrão CNPJ)
        cnpjDestinatario = cpfDestinatario.padStart(14, '0');
        console.log('[LeitorXML] 🔄 CPF encontrado, convertido para CNPJ:', { cpfDestinatario, cnpjDestinatario });
      }
    }
    
    // Se ainda não tem destinatário, usar CNPJ genérico para consumidor final
    if (!cnpjDestinatario) {
      cnpjDestinatario = '00000000000000';
      nomeDestinatario = 'Consumidor Final';
      console.log('[LeitorXML] 🔄 Usando CNPJ genérico para consumidor final');
    }
    
    // Debug: verificar se o CNPJ destinatário está sendo extraído
    console.log('[LeitorXML] 🔍 Debug CNPJ Destinatário NFCe:', {
      cnpjDestinatario,
      nomeDestinatario,
      destElement: xmlDoc.querySelector('dest'),
      cnpjElement: xmlDoc.querySelector('dest > CNPJ')
    });
    
    // Extrair estados origem e destino
    const estadoOrigem = xmlDoc.querySelector('emit > enderEmit > UF')?.textContent || '';
    const estadoDestino = xmlDoc.querySelector('dest > enderDest > UF')?.textContent || '';

    const dets = xmlDoc.getElementsByTagName('det');
    const produtosData = [];

    for (let i = 0; i < dets.length; i++) {
      const prod = dets[i].getElementsByTagName('prod')[0];
      const imposto = dets[i].getElementsByTagName('imposto')[0];
      
      const produto = prod?.getElementsByTagName('xProd')[0]?.textContent || '';
      const ncm = prod?.getElementsByTagName('NCM')[0]?.textContent || '';
      const cfop = prod?.getElementsByTagName('CFOP')[0]?.textContent || '';
      
      // Extrair valores como números, não como strings formatadas
      const quantidadeNum = extrairValorDireto(prod, 'qCom');
      const valorUnitarioNum = extrairValorDireto(prod, 'vUnCom');
      
      // Processar impostos usando a nova função
      const { valor: icmsValor, cst } = processarImpostos(imposto, 'ICMS');
      const { valor: pisValor, cst: cstPis } = processarImpostos(imposto, 'PIS');
      const { valor: cofinsValor, cst: cstCofins } = processarImpostos(imposto, 'COFINS');
      
      produtosData.push({
        numero,
        cnpjEmitente,
        nomeEmitente,
        dataEmissao: dataEmissaoRaw, 
        cnpjDestinatario,
        nomeDestinatario,
        produto,
        ncm,
        cfop,
        cst,
        quantidade: quantidadeNum.toString(),
        valorUnitario: valorUnitarioNum.toString(),
        pis: pisValor.toString(),
        cofins: cofinsValor.toString(),
        icms: icmsValor.toString(),
        cstPis,
        cstCofins,
        tipoDocumento: 'NFCe',
        estadoOrigem,
        estadoDestino
      });
    }

    return produtosData;
  };

  // Função para detectar se o ISS está retido e extrair seu valor
  const detectarIssRetidoEValor = (xmlDoc) => {
    console.log('[LeitorXML] Iniciando detecção de ISS retido e valor...');
    
    // Padrão ABRASF: <IssRetido> com valores 1 (retido) e 2 (não retido)
    const issRetidoAbrasf = xmlDoc.querySelector('IssRetido')?.textContent || 
                            xmlDoc.querySelector('InfNfse > IssRetido')?.textContent ||
                            xmlDoc.querySelector('Servico > Valores > IssRetido')?.textContent;
    if (issRetidoAbrasf) {
      console.log('[LeitorXML] ISS Retido (ABRASF):', issRetidoAbrasf);
      const retido = issRetidoAbrasf === '1';
      
      // Se retido, tentar extrair o valor
      if (retido) {
                const valorIssRetido = xmlDoc.querySelector('ValorIssRetido')?.textContent || 
                               xmlDoc.querySelector('InfNfse > ValorIssRetido')?.textContent ||
                               xmlDoc.querySelector('Servico > Valores > ValorIssRetido')?.textContent;
        if (valorIssRetido) {
          const valor = parseFloat(valorIssRetido.replace(',', '.'));
          console.log('[LeitorXML] Valor ISS Retido (ABRASF):', valor);
          return { retido: true, valor };
        }
      }
      return { retido };
    }

    // Padrão Nacional: <issRetido> (minúsculo) com valores true/false
    const issRetidoNacional = xmlDoc.querySelector('issRetido')?.textContent || 
                              xmlDoc.querySelector('InfNfse > issRetido')?.textContent ||
                              xmlDoc.querySelector('Servico > Valores > issRetido')?.textContent;
    if (issRetidoNacional) {
      console.log('[LeitorXML] ISS Retido (Nacional):', issRetidoNacional);
      const retido = issRetidoNacional.toLowerCase() === 'true';
      
      if (retido) {
                const valorIssRetido = xmlDoc.querySelector('valorIssRetido')?.textContent || 
                               xmlDoc.querySelector('InfNfse > valorIssRetido')?.textContent ||
                               xmlDoc.querySelector('Servico > Valores > valorIssRetido')?.textContent;
        if (valorIssRetido) {
          const valor = parseFloat(valorIssRetido.replace(',', '.'));
          console.log('[LeitorXML] Valor ISS Retido (Nacional):', valor);
          return { retido: true, valor };
        }
      }
      return { retido };
    }

    // Layouts próprios de prefeituras
    const retencaoIss = xmlDoc.querySelector('RetencaoISS')?.textContent || 
                        xmlDoc.querySelector('InfNfse > RetencaoISS')?.textContent;
    if (retencaoIss) {
      console.log('[LeitorXML] Retenção ISS:', retencaoIss);
      const retido = retencaoIss.toLowerCase() === 'sim' || retencaoIss === '1' || retencaoIss.toLowerCase() === 'true';
      
      if (retido) {
        const valorRetencao = xmlDoc.querySelector('ValorRetencaoISS')?.textContent ||
                              xmlDoc.querySelector('InfNfse > ValorRetencaoISS')?.textContent;
        if (valorRetencao) {
          const valor = parseFloat(valorRetencao.replace(',', '.'));
          console.log('[LeitorXML] Valor Retenção ISS:', valor);
          return { retido: true, valor };
        }
      }
      return { retido };
    }

    const issRetido = xmlDoc.querySelector('ISSRetido')?.textContent || 
                      xmlDoc.querySelector('InfNfse > ISSRetido')?.textContent;
    if (issRetido) {
      console.log('[LeitorXML] ISS Retido (próprio):', issRetido);
      const retido = issRetido.toLowerCase() === 'sim' || issRetido === '1' || issRetido.toLowerCase() === 'true';
      
      if (retido) {
        const valorIssRetido = xmlDoc.querySelector('ValorISSRetido')?.textContent ||
                               xmlDoc.querySelector('InfNfse > ValorISSRetido')?.textContent;
        if (valorIssRetido) {
          const valor = parseFloat(valorIssRetido.replace(',', '.'));
          console.log('[LeitorXML] Valor ISS Retido (próprio):', valor);
          return { retido: true, valor };
        }
      }
      return { retido };
    }

    const possuiRetencao = xmlDoc.querySelector('PossuiRetencao')?.textContent || 
                           xmlDoc.querySelector('InfNfse > PossuiRetencao')?.textContent;
    if (possuiRetencao) {
      console.log('[LeitorXML] Possui Retenção:', possuiRetencao);
      const retido = possuiRetencao.toLowerCase() === 'sim' || possuiRetencao === '1' || possuiRetencao.toLowerCase() === 'true';
      
      if (retido) {
        const valorRetencao = xmlDoc.querySelector('ValorRetencao')?.textContent ||
                              xmlDoc.querySelector('InfNfse > ValorRetencao')?.textContent;
        if (valorRetencao) {
          const valor = parseFloat(valorRetencao.replace(',', '.'));
          console.log('[LeitorXML] Valor Retenção:', valor);
          return { retido: true, valor };
        }
      }
      return { retido };
    }

    // Verificar também dentro de <Servico><Valores> para padrão ABRASF
    const issRetidoServico = xmlDoc.querySelector('Servico > Valores > IssRetido')?.textContent ||
                             xmlDoc.querySelector('InfNfse > Servico > Valores > IssRetido')?.textContent;
    if (issRetidoServico) {
      console.log('[LeitorXML] ISS Retido (Servico/Valores):', issRetidoServico);
      const retido = issRetidoServico === '1';
      
      if (retido) {
        const valorIssRetido = xmlDoc.querySelector('Servico > Valores > ValorIssRetido')?.textContent ||
                               xmlDoc.querySelector('InfNfse > Servico > Valores > ValorIssRetido')?.textContent;
        if (valorIssRetido) {
          const valor = parseFloat(valorIssRetido.replace(',', '.'));
          console.log('[LeitorXML] Valor ISS Retido (Servico/Valores):', valor);
          return { retido: true, valor };
        }
      }
      return { retido };
    }

    // Verificar campos adicionais que podem existir
    const camposAdicionais = [
      'RetencaoISS',
      'ISSRetido', 
      'IssRetido',
      'issRetido',
      'PossuiRetencao',
      'Retencao',
      'Retido'
    ];

    for (const campo of camposAdicionais) {
      const valor = xmlDoc.querySelector(campo)?.textContent || 
                    xmlDoc.querySelector(`InfNfse > ${campo}`)?.textContent;
      if (valor) {
        console.log(`[LeitorXML] Campo ${campo} encontrado:`, valor);
        const valorLower = valor.toLowerCase().trim();
        if (valorLower === 'sim' || valorLower === 'true' || valor === '1') {
          console.log(`[LeitorXML] ISS Retido detectado via campo ${campo}:`, valor);
          
          // Tentar encontrar o valor correspondente
          const camposValor = [
            'ValorIssRetido',
            'ValorISSRetido', 
            'ValorRetencaoISS',
            'ValorRetencao',
            'valorIssRetido',
            'valorRetencao'
          ];
          
          for (const campoValor of camposValor) {
            const valorRetido = xmlDoc.querySelector(campoValor)?.textContent || 
                                xmlDoc.querySelector(`InfNfse > ${campoValor}`)?.textContent;
            if (valorRetido) {
              const valorNumerico = parseFloat(valorRetido.replace(',', '.'));
              console.log(`[LeitorXML] Valor ISS Retido encontrado via ${campoValor}:`, valorNumerico);
              return { retido: true, valor: valorNumerico };
            }
          }
          
          return { retido: true };
        } else if (valorLower === 'nao' || valorLower === 'false' || valor === '2' || valor === '0') {
          console.log(`[LeitorXML] ISS NÃO retido detectado via campo ${campo}:`, valor);
          return { retido: false };
        }
      }
    }

    console.log('[LeitorXML] Nenhum campo de ISS retido encontrado - assumindo não retido');
    return { retido: false };
  };

  // Função para processar NFSe (Nota Fiscal de Serviço Eletrônica)
  // Adaptada para o padrão do XML fornecido
  const processNFSe = (xmlDoc) => {
    const produtosData = [];
    
    // Verificar se é uma lista de NFSe (múltiplas notas)
    const listaNfse = xmlDoc.querySelector('ListaNfse');
    console.log('[LeitorXML] NFSe - Verificando se é lista:', !!listaNfse);
    
    if (listaNfse) {
      console.log('[LeitorXML] NFSe - Lista de NFSe detectada, processando múltiplas notas');
      const compNfseElements = xmlDoc.querySelectorAll('CompNfse');
      console.log('[LeitorXML] NFSe - Encontradas', compNfseElements.length, 'notas fiscais');
      
      for (let i = 0; i < compNfseElements.length; i++) {
        console.log(`[LeitorXML] NFSe - Processando nota ${i + 1} de ${compNfseElements.length}`);
        const compNfse = compNfseElements[i];
        const nfse = compNfse.querySelector('Nfse');
        if (nfse) {
          const infNfse = nfse.querySelector('InfNfse');
          if (infNfse) {
            console.log(`[LeitorXML] NFSe - Processando InfNfse da nota ${i + 1}`);
            const produto = processarNotaNFSeIndividual(infNfse);
            if (produto) {
              console.log(`[LeitorXML] NFSe - Produto extraído da nota ${i + 1}:`, produto.numero);
              produtosData.push(produto);
            } else {
              console.log(`[LeitorXML] NFSe - Falha ao processar nota ${i + 1}`);
            }
          } else {
            console.log(`[LeitorXML] NFSe - InfNfse não encontrado na nota ${i + 1}`);
          }
        } else {
          console.log(`[LeitorXML] NFSe - Nfse não encontrado na nota ${i + 1}`);
        }
      }
    } else {
      console.log('[LeitorXML] NFSe - Processando nota individual');
      // Processar nota individual (padrão anterior)
      const produto = processarNotaNFSeIndividual(xmlDoc);
      if (produto) {
        produtosData.push(produto);
      }
    }
    
    console.log('[LeitorXML] NFSe - Total de produtos processados:', produtosData.length);
    return produtosData;
  };

  // Função auxiliar para salvar uma nota fiscal individual
  const salvarNotaFiscalIndividual = async (produtoData, xmlDoc, documentType) => {
    const produto = produtoData;
    let chave_nfe = '';
    let numero_nfe = parseInt(produto.numero, 10);
    let serie_nfe = 1;
    let data_emissao = produto.dataEmissao ? formatarDataParaISO(produto.dataEmissao) : null;
    let data_saida_entrada = null;
    let cnpj_emitente = produto.cnpjEmitente.replace(/\D/g, ''); // Remove símbolos, mantém apenas números
    let razao_social_emitente = produto.nomeEmitente;
    let cnpj_destinatario = produto.cnpjDestinatario.replace(/\D/g, ''); // Remove símbolos, mantém apenas números
    let razao_social_destinatario = produto.nomeDestinatario;
    let uf_origem = '';
    let uf_destino = '';
    let valor_total_nfe = 0;
    let natureza_operacao = '';
    let modelo = '';

    if (documentType === 'NFSe') {
      // Para NFSe, gerar uma chave única de 44 caracteres incluindo o número da nota
      const timestamp = Date.now().toString();
      const numeroLimpo = produto.numero.replace(/\D/g, '');
      const dataLimpa = data_emissao ? data_emissao.replace(/\D/g, '') : '';
      let chaveBase = `${cnpj_emitente}${numeroLimpo}${dataLimpa}${timestamp}`;
      chave_nfe = chaveBase.padEnd(44, '0').slice(0, 44);
      
      // Garante que cnpj_destinatario tenha 14 caracteres
      cnpj_destinatario = (produto.cnpjDestinatario || '').replace(/\D/g, '');
      if (cnpj_destinatario.length < 14) {
        cnpj_destinatario = cnpj_destinatario.padStart(14, '0');
      } else if (cnpj_destinatario.length > 14) {
        cnpj_destinatario = cnpj_destinatario.slice(0, 14);
      }
      
      // Preenche UF de origem/destino a partir do produto NFSe (prestador/tomador)
      uf_origem = produto.estadoOrigem || '';
      uf_destino = produto.estadoDestino || '';
      natureza_operacao = produto.produto || 'Serviço';
      modelo = 'SE';
      
      // Para NFSe, usar valorServico se existir
      let valorServico = '0';
      if ('valorServico' in produto && produto.valorServico) {
        valorServico = produto.valorServico;
      } else if (produto.valorUnitario) {
        valorServico = produto.valorUnitario;
      }
      // Garantir que valor_total_nfe seja sempre um número
      valor_total_nfe = parseNumber(valorServico);
    }

    // Detectar ISS retido para NFSe
    let iss_ret = null;
    let valor_iss_ret = null;
    
    if (documentType === 'NFSe' && produto.tipoDocumento === 'NFSe') {
      iss_ret = Boolean(produto.issRetido);
      valor_iss_ret = produto.valorIssRetido || null;
    }

    // Buscar cliente_id baseado no CNPJ do emitente usando a API
    let clientes_id = null;
    try {
      // Primeiro, tentar buscar o cliente existente
      if (!selectedCompanyId) {
        console.error('[LeitorXML] Company ID não encontrado');
        return;
      }
      
      const clientesResponse = await fetchClientes({
        company_id: selectedCompanyId,
        cnpj: cnpj_emitente
      });
      
      if (clientesResponse.error) {
        console.error('[LeitorXML] Erro ao buscar cliente via API:', clientesResponse.error);
        return;
      }

      const clientesEncontrados = clientesResponse.data?.data || [];
      
      if (clientesEncontrados.length > 0) {
        clientes_id = clientesEncontrados[0].id;
        console.log('[LeitorXML] Cliente encontrado:', clientes_id);
      } else {
        // Se não encontrar, não criar cliente automaticamente - apenas logar
        console.log('[LeitorXML] Cliente não encontrado. Criação de clientes deve ser feita via Simples Nacional.');
        console.log('[LeitorXML] Nota fiscal não será salva sem cliente associado.');
        return; // Não salvar a nota se não houver cliente
      }
    } catch (error) {
      console.error('[LeitorXML] Erro inesperado ao buscar cliente via API:', error);
      return; // Não salvar a nota se houver erro
    }

    const notaParaSalvar = {
      clientes_id,
      chave_nfe,
      numero_nfe,
      serie: serie_nfe,
      data_emissao,
      data_saida_entrada,
      cnpj_emitente,
      razao_social_emitente,
      cnpj_destinatario,
      razao_social_destinatario,
      uf_origem,
      uf_destino,
      valor_total_nfe,
      natureza_operacao,
      modelo,
      estado_origem: uf_origem,
      estado_destino: uf_destino,
      // Novas colunas individuais para melhorar performance
      ncm: produto.ncm || '',
      quantidade: parseNumber(produto.quantidade) || 0,
      valor_unitario: parseNumber(produto.valorUnitario) || 0,
      valor_total_item: parseNumber(produto.valorUnitario) || 0,
      pis: parseNumber(produto.pis) || 0,
      cofins: parseNumber(produto.cofins) || 0,
      icms: parseNumber(produto.icms) || 0,
      cst_pis: produto.cstPis || '',
      cst_cofins: produto.cstCofins || '',
      cst_icms: produto.cst || '',
      cfop: produto.cfop || '',
      descricao_produto: produto.produto || '',
      // Manter a coluna ncm_notas para compatibilidade
      ncm_notas: JSON.stringify([{
        ncm: produto.ncm,
        totalQuantidade: parseNumber(produto.quantidade),
        totalValor: parseNumber(produto.valorUnitario),
        totalPis: parseNumber(produto.pis),
        totalCofins: parseNumber(produto.cofins),
        totalIcms: parseNumber(produto.icms),
        pisPercentage: '0.00',
        cofinsPercentage: '0.00',
        icmsPercentage: '0.00',
      }]),
      iss_ret,
      valor_iss_ret
    };

    console.log('[LeitorXML] Salvando nota individual:', {
      numero: produto.numero,
      cnpjEmitenteOriginal: produto.cnpjEmitente,
      cnpjEmitenteLimpo: cnpj_emitente,
      cnpjDestinatarioOriginal: produto.cnpjDestinatario,
      cnpjDestinatarioLimpo: cnpj_destinatario,
      chave: chave_nfe,
      valor: valor_total_nfe,
      clientes_id,
      // Log detalhado das novas colunas individuais
      ncm: produto.ncm || '',
      quantidade: parseNumber(produto.quantidade) || 0,
      valor_unitario: parseNumber(produto.valorUnitario) || 0,
      valor_total_item: parseNumber(produto.valorUnitario) || 0,
      pis: parseNumber(produto.pis) || 0,
      cofins: parseNumber(produto.cofins) || 0,
      icms: parseNumber(produto.icms) || 0,
      cst_pis: produto.cstPis || '',
      cst_cofins: produto.cstCofins || '',
      cst_icms: produto.cst || '',
      cfop: produto.cfop || '',
      descricao_produto: produto.produto || ''
    });

    if (chave_nfe && clientes_id) {
      try {
        // Usar a nova API em vez do Supabase diretamente
        console.log('[LeitorXML] 🔄 Enviando nota para API:', {
          numero_nfe: notaParaSalvar.numero_nfe,
          chave_nfe: notaParaSalvar.chave_nfe,
          clientes_id: notaParaSalvar.clientes_id,
          cnpj_emitente: notaParaSalvar.cnpj_emitente,
          cnpj_destinatario: notaParaSalvar.cnpj_destinatario,
          valor_total_nfe: notaParaSalvar.valor_total_nfe
        });
        
        const response = await createNotasFiscaisBulk([notaParaSalvar]);
        
        if (response.error) {
          console.error('[LeitorXML] ❌ Erro ao salvar nota via API:', response.error);
          console.error('[LeitorXML] ❌ Detalhes do erro:', response);
          
          // Verificar se é erro de duplicata
          const errorData = response.error;
          if (errorData?.tipo_erro === 'duplicata' || errorData?.error?.includes('duplicada')) {
            toast(
              `Nota ${produto.numero} já cadastrada para este cliente`,
              {
                duration: 4000,
                position: 'top-right',
                icon: '⚠️',
                style: {
                  background: '#f59e0b',
                  color: '#fff',
                },
              }
            );
          } else {
            toast.error(
              `Erro ao salvar nota ${produto.numero}`,
              {
                duration: 4000,
                position: 'top-right',
              }
            );
          }
        } else {
          console.log('[LeitorXML] ✅ Nota salva com sucesso via API:', produto.numero);
          console.log('[LeitorXML] ✅ Resposta da API:', response);
          
          // Verificar se houve erros na resposta
          if (response.data && response.data.erros > 0) {
            console.error('[LeitorXML] ❌ Erros na resposta da API:', response.data.detalhes_erros);
          }
          
          // Analisa automaticamente o NCM se for válido
          if (produto.ncm && produto.ncm.trim()) {
            try {
          
              
              // Criar configuração com estados de origem e destino
              const configuracao = {
                estado_origem: uf_origem || 'SP',
                estado_destino: uf_destino || 'PR',
                destinacao_mercadoria: 1, // Comercialização
                regime_origem: 1, // Regime Normal
                regime_destino: 1 // Regime Normal
              };
              
              await analisarNcm(produto.ncm.trim(), configuracao);
              console.log(`[LeitorXML] ✅ NCM ${produto.ncm} analisado com sucesso`);
            } catch (ncmError) {
              console.warn(`[LeitorXML] ⚠️ Erro ao analisar NCM ${produto.ncm}:`, ncmError);
            }
          }
        }
      } catch (e) {
        console.error('[LeitorXML] ❌ Erro ao salvar nota:', produto.numero, e);
      }
    } else {
      console.warn('[LeitorXML] ⚠️ Dados insuficientes para salvar nota:', { chave_nfe, clientes_id });
    }
  };

  // Função auxiliar para processar uma nota NFSe individual
  const processarNotaNFSeIndividual = (xmlElement) => {
    // Detectar se a nota está cancelada
    const notaCancelada = detectarNotaCancelada(xmlElement);
    console.log('[LeitorXML] NFSe - Nota cancelada:', notaCancelada);
    
    // Extrair dados da nota
    let numero = xmlElement.querySelector('Numero')?.textContent || '';
    console.log('[LeitorXML] NFSe - Número extraído:', numero);
    let cnpjEmitente =
      xmlElement.querySelector('PrestadorServico > IdentificacaoPrestador > Cnpj')?.textContent ||
      xmlElement.querySelector('PrestadorServico > IdentificacaoPrestador > CpfCnpj > Cnpj')?.textContent ||
      '';
    let nomeEmitente = xmlElement.querySelector('PrestadorServico > RazaoSocial')?.textContent || '';
    let dataEmissaoRaw = xmlElement.querySelector('DataEmissao')?.textContent || '';
    let cnpjDestinatario = xmlElement.querySelector('TomadorServico > IdentificacaoTomador > CpfCnpj > Cpf')?.textContent || 
                           xmlElement.querySelector('TomadorServico > IdentificacaoTomador > CpfCnpj > Cnpj')?.textContent || '';
    let nomeDestinatario = xmlElement.querySelector('TomadorServico > RazaoSocial')?.textContent || '';
    let produto = xmlElement.querySelector('Servico > Discriminacao')?.textContent || '';
    let ncm = xmlElement.querySelector('Servico > CodigoCnae')?.textContent || '';
    // Extrair valores como números usando a nova função
    let valorServicoNum = extrairValorNumerico(xmlElement, 'Servico > Valores > ValorServicos');
    let valorIssNum = extrairValorNumerico(xmlElement, 'Servico > Valores > ValorIss');

    // Se não encontrar o CNPJ do emitente, tenta o layout alternativo
    if (!cnpjEmitente) {
      numero = xmlElement.querySelector('NumeroNfse')?.textContent || numero;
      cnpjEmitente = xmlElement.querySelector('Prestador > Cnpj')?.textContent || cnpjEmitente;
      nomeEmitente = xmlElement.querySelector('Prestador > RazaoSocial')?.textContent || nomeEmitente;
      dataEmissaoRaw = xmlElement.querySelector('DataEmissao')?.textContent || dataEmissaoRaw;
      cnpjDestinatario = xmlElement.querySelector('Tomador > NrDocumento')?.textContent || cnpjDestinatario;
      nomeDestinatario = xmlElement.querySelector('Tomador > RazaoSocial')?.textContent || nomeDestinatario;
      produto = xmlElement.querySelector('Servicos > Descricao')?.textContent || produto;
      ncm = xmlElement.querySelector('Atividade > CodigoCnae')?.textContent || ncm;
      valorServicoNum = extrairValorNumerico(xmlElement, 'Valores > ValorServicos') || valorServicoNum;
      valorIssNum = extrairValorNumerico(xmlElement, 'Valores > ValorIss') || valorIssNum;
    }

    // Se ainda não encontrou, tenta o layout ABRASF (com namespace)
    if (!cnpjEmitente) {
      numero = xmlElement.querySelector('Numero')?.textContent || numero;
      // Truncar número muito grande para caber no campo integer
      if (numero && numero.length > 9) {
        numero = numero.slice(-9); // Pega apenas os últimos 9 dígitos
      }
      cnpjEmitente = xmlElement.querySelector('PrestadorServico > IdentificacaoPrestador > CpfCnpj > Cnpj')?.textContent || cnpjEmitente;
      nomeEmitente = xmlElement.querySelector('PrestadorServico > RazaoSocial')?.textContent || nomeEmitente;
      dataEmissaoRaw = xmlElement.querySelector('DataEmissao')?.textContent || dataEmissaoRaw;
      cnpjDestinatario = xmlElement.querySelector('Tomador > IdentificacaoTomador > CpfCnpj > Cpf')?.textContent || cnpjDestinatario;
      nomeDestinatario = xmlElement.querySelector('Tomador > RazaoSocial')?.textContent || nomeDestinatario;
      produto = xmlElement.querySelector('Servico > Discriminacao')?.textContent || produto;
      ncm = xmlElement.querySelector('Servico > CodigoCnae')?.textContent || ncm;
      valorServicoNum = extrairValorNumerico(xmlElement, 'Servico > Valores > ValorServicos') || valorServicoNum;
      valorIssNum = extrairValorNumerico(xmlElement, 'ValoresNfse > ValorIss') || valorIssNum;
    }

    // Se ainda não encontrou, tenta o layout específico da NFSe (DeclaracaoPrestacaoServico)
    if (!cnpjEmitente) {
      numero = xmlElement.querySelector('Numero')?.textContent || numero;
      // Truncar número muito grande para caber no campo integer
      if (numero && numero.length > 9) {
        numero = numero.slice(-9); // Pega apenas os últimos 9 dígitos
      }
      cnpjEmitente = xmlElement.querySelector('DeclaracaoPrestacaoServico > InfDeclaracaoPrestacaoServico > Prestador > CpfCnpj > Cnpj')?.textContent || cnpjEmitente;
      nomeEmitente = xmlElement.querySelector('PrestadorServico > RazaoSocial')?.textContent || nomeEmitente;
      dataEmissaoRaw = xmlElement.querySelector('DataEmissao')?.textContent || dataEmissaoRaw;
      cnpjDestinatario = xmlElement.querySelector('DeclaracaoPrestacaoServico > InfDeclaracaoPrestacaoServico > TomadorServico > IdentificacaoTomador > CpfCnpj > Cnpj')?.textContent || cnpjDestinatario;
      nomeDestinatario = xmlElement.querySelector('DeclaracaoPrestacaoServico > InfDeclaracaoPrestacaoServico > TomadorServico > RazaoSocial')?.textContent || nomeDestinatario;
      produto = xmlElement.querySelector('Servico > Discriminacao')?.textContent || produto;
      ncm = xmlElement.querySelector('Servico > CodigoCnae')?.textContent || ncm;
      valorServicoNum = extrairValorNumerico(xmlElement, 'Servico > Valores > ValorServicos') || valorServicoNum;
      valorIssNum = extrairValorNumerico(xmlElement, 'Servico > Valores > ValorIss') || valorIssNum;
    }

    // Extrair estados origem e destino (para NFSe, geralmente são os mesmos)
    const estadoOrigem = xmlElement.querySelector('PrestadorServico > Endereco > Uf')?.textContent || 
                         xmlElement.querySelector('Prestador > Endereco > Uf')?.textContent || '';
    const estadoDestino = xmlElement.querySelector('TomadorServico > Endereco > Uf')?.textContent || 
                          xmlElement.querySelector('Tomador > Endereco > Uf')?.textContent || estadoOrigem;
    
    // Detectar se o ISS está retido e extrair seu valor
    const { retido: issRetido, valor: valorIssRetido } = detectarIssRetidoEValor(xmlElement);
    console.log('[LeitorXML] NFSe - ISS Retido detectado:', issRetido);
    if (issRetido && valorIssRetido) {
      console.log('[LeitorXML] NFSe - Valor do ISS Retido:', valorIssRetido);
    }

    // Se a nota estiver cancelada, zerar os valores monetários
    if (notaCancelada) {
      console.log('[LeitorXML] NFSe - Zerando valores da nota cancelada');
      console.log('[LeitorXML] NFSe - Nota cancelada detectada - Número:', numero);
      console.log('[LeitorXML] NFSe - Valores originais - Serviço:', valorServicoNum, 'ISS:', valorIssNum);
      valorServicoNum = 0;
      valorIssNum = 0;
      console.log('[LeitorXML] NFSe - Valores zerados - Serviço:', valorServicoNum, 'ISS:', valorIssNum);
      // Manter os dados de identificação mas zerar valores
    }

    const produtoProcessado = {
      numero,
      cnpjEmitente,
      nomeEmitente,
      dataEmissao: dataEmissaoRaw,
      cnpjDestinatario,
      nomeDestinatario,
      produto,
      ncm,
      cfop: '',
      cst: '',
      quantidade: '1',
      valorUnitario: notaCancelada ? '0' : valorServicoNum.toString(),
      pis: '',
      cofins: '',
      icms: '0',
      cstPis: '',
      cstCofins: '',
      tipoDocumento: 'NFSe',
      valorServico: notaCancelada ? '0' : valorServicoNum.toString(),
      valorIss: notaCancelada ? '0' : valorIssNum.toString(),
      issRetido: notaCancelada ? false : issRetido, // Zerar ISS retido se cancelada
      valorIssRetido: notaCancelada ? 0 : valorIssRetido, // Zerar valor ISS retido se cancelada
      estadoOrigem,
      estadoDestino
    };
    
    console.log('[LeitorXML] NFSe - Produto processado:', {
      numero: produtoProcessado.numero,
      cnpjEmitente: produtoProcessado.cnpjEmitente,
      valorServico: produtoProcessado.valorServico,
      valorIss: produtoProcessado.valorIss
    });
    
    return produtoProcessado;
  };

  // Função utilitária para extrair a chave da NFe
  const extractChaveNfe = (xmlDoc) => {
    // Tenta pegar do atributo Id do infNFe
    const infNFe = xmlDoc.querySelector('infNFe');
    if (infNFe && infNFe.getAttribute('Id')) {
      return infNFe.getAttribute('Id')?.replace(/^NFe/, '') || '';
    }
    // Ou do campo chNFe
    const chNFe = xmlDoc.querySelector('chNFe');
    if (chNFe) return chNFe.textContent || '';
    return '';
  };

  // Função para detectar se a nota está cancelada
  const detectarNotaCancelada = (xmlDoc) => {
    // Verificar se existe seção de cancelamento
    const nfseCancelamento = xmlDoc.querySelector('NfseCancelamento') || 
                             xmlDoc.querySelector('InfNfse > NfseCancelamento');
    if (nfseCancelamento) {
      console.log('[LeitorXML] Nota cancelada detectada - NfseCancelamento encontrado');
      return true;
    }

    // Verificar se existe SubstituicaoNfse (nota substituída)
    const substituicaoNfse = xmlDoc.querySelector('SubstituicaoNfse') || 
                             xmlDoc.querySelector('InfNfse > SubstituicaoNfse');
    if (substituicaoNfse) {
      console.log('[LeitorXML] Nota substituída detectada - SubstituicaoNfse encontrado');
      return true;
    }

    // Verificar se existe CodigoCancelamento
    const codigoCancelamento = xmlDoc.querySelector('CodigoCancelamento') || 
                              xmlDoc.querySelector('InfNfse > CodigoCancelamento');
    if (codigoCancelamento) {
      console.log('[LeitorXML] Nota cancelada detectada - CodigoCancelamento encontrado');
      return true;
    }

    // Verificar se existe InfPedidoCancelamento
    const infPedidoCancelamento = xmlDoc.querySelector('InfPedidoCancelamento') || 
                                 xmlDoc.querySelector('InfNfse > InfPedidoCancelamento');
    if (infPedidoCancelamento) {
      console.log('[LeitorXML] Nota cancelada detectada - InfPedidoCancelamento encontrado');
      return true;
    }

    return false;
  };

  // Função utilitária para extrair campos extras da NFe
  const extractExtraFields = (xmlDoc) => {
    const uf_origem = xmlDoc.querySelector('emit > enderEmit > UF')?.textContent || '';
    const uf_destino = xmlDoc.querySelector('dest > enderDest > UF')?.textContent || '';
    const natureza_operacao = xmlDoc.querySelector('natOp')?.textContent || '';
    const modelo = xmlDoc.querySelector('ide > mod')?.textContent || '';
    const data_saida_entrada = xmlDoc.querySelector('dSaiEnt')?.textContent || xmlDoc.querySelector('dhSaiEnt')?.textContent || null;
    return { uf_origem, uf_destino, natureza_operacao, modelo, data_saida_entrada };
  };

  // Função para baixar a planilha modelo
  const handleDownloadPlanilhaModelo = () => {
    const headers = [
      'chave_nfe',
      'numero_nfe',
      'serie',
      'data_emissao',
      'cnpj_emitente',
      'razao_social_emitente',
      'cnpj_destinatario',
      'razao_social_destinatario',
      'uf_origem',
      'uf_destino',
      'valor_total_nfe',
      'natureza_operacao',
      'modelo',
      'ncm',
      'quantidade',
      'valor_unitario',
      'pis',
      'cofins',
      'icms',
      'cst_pis',
      'cst_cofins',
      'cst_icms',
      'cfop',
      'descricao_produto'
    ];
    
    const exemplos = [
      [
        '35240912345678000123550010000000011234567890', // chave_nfe (44 caracteres)
        '1', // numero_nfe
        '1', // serie
        '2024-01-15', // data_emissao (formato YYYY-MM-DD)
        '12345678000123', // cnpj_emitente
        'EMPRESA EXEMPLO LTDA', // razao_social_emitente
        '98765432000156', // cnpj_destinatario
        'CLIENTE EXEMPLO LTDA', // razao_social_destinatario
        'SP', // uf_origem
        'RJ', // uf_destino
        '1500.00', // valor_total_nfe
        'VENDA DE MERCADORIA', // natureza_operacao
        '55', // modelo (55 para NFe, 65 para NFCe, SE para NFSe)
        '12345678', // ncm
        '10', // quantidade
        '150.00', // valor_unitario
        '24.75', // pis
        '114.00', // cofins
        '255.00', // icms
        '01', // cst_pis
        '01', // cst_cofins
        '00', // cst_icms
        '5102', // cfop
        'PRODUTO EXEMPLO' // descricao_produto
      ]
    ];
    
    const aoa = [
      headers,
      ...exemplos,
      [],
      ['INSTRUÇÕES:'],
      ['1. Preencha cada linha com os dados de uma nota fiscal'],
      ['2. A chave_nfe deve ter exatamente 44 caracteres'],
      ['3. A data_emissao deve estar no formato YYYY-MM-DD (ex: 2024-01-15)'],
      ['4. CNPJs devem conter apenas números (14 dígitos)'],
      ['5. Valores numéricos devem usar ponto como separador decimal (ex: 1500.00)'],
      ['6. Modelo: 55 para NFe, 65 para NFCe, SE para NFSe'],
      ['7. Remova esta linha de exemplo antes de importar'],
      [],
      ['Powered by Contabhub Technology']
    ];
    
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    
    // Adicionar cores e estilos aos headers
    const colCount = headers.length;
    worksheet['!cols'] = headers.map(() => ({ wch: 20 }));
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Modelo Notas Fiscais');
    
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const dataHora = `${now.getFullYear()}_${pad(now.getMonth() + 1)}_${pad(now.getDate())}`;
    const fileName = `planilha_modelo_notas_fiscais_${dataHora}.xlsx`;
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, fileName);
  };

  // Função para importar planilha de notas fiscais
  const handleImportPlanilha = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setImportandoPlanilha(true);
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          // Remover header e linhas vazias
          const headers = jsonData[0] || [];
          const rows = jsonData.slice(1).filter((row) => row && row.length > 0 && row[0]);
          
          console.log('[LeitorXML] 📊 Planilha importada:', { headers, totalLinhas: rows.length });
          
          if (rows.length === 0) {
            alert('A planilha não contém dados para importar.');
            setImportandoPlanilha(false);
            return;
          }
          
          // Validar se a empresa está selecionada
          if (!selectedCompanyId) {
            alert('Por favor, selecione uma empresa antes de importar a planilha.');
            setImportandoPlanilha(false);
            return;
          }
          
          // Processar cada linha e criar notas fiscais
          const notasParaSalvar = [];
          const errosDetalhados = [];
          
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            
            // Ignorar linhas que são instruções (começam com "INSTRUÇÕES" ou números seguidos de ponto)
            const primeiraColuna = String(row[0] || '').trim();
            if (primeiraColuna.toUpperCase().includes('INSTRUÇÕES') || 
                primeiraColuna.toUpperCase().includes('POWERED BY') ||
                /^\d+\./.test(primeiraColuna)) {
              console.log(`[LeitorXML] ℹ️ Linha ${i + 2} ignorada - linha de instrução`);
              continue;
            }
            
            // Mapear colunas baseado nos headers
            const nota = {};
            headers.forEach((header, index) => {
              nota[header] = row[index];
            });
            
            // Validar campos obrigatórios e mostrar quais estão faltando
            const camposFaltando = [];
            if (!nota.chave_nfe) camposFaltando.push('chave_nfe');
            if (!nota.numero_nfe) camposFaltando.push('numero_nfe');
            if (!nota.cnpj_emitente) camposFaltando.push('cnpj_emitente');
            
            if (camposFaltando.length > 0) {
              const msgErro = `Linha ${i + 2}: Campos obrigatórios faltando: ${camposFaltando.join(', ')}`;
              console.warn(`[LeitorXML] ⚠️ ${msgErro}`);
              errosDetalhados.push(msgErro);
              continue;
            }
            
            // Buscar cliente_id baseado no CNPJ do emitente
            let clientes_id = null;
            try {
          const clientesResponse = await fetchClientes({
                company_id: selectedCompanyId,
                cnpj: nota.cnpj_emitente
              });
              
              if (!clientesResponse.error && clientesResponse.data?.data && clientesResponse.data.data.length > 0) {
                clientes_id = clientesResponse.data.data[0].id;
              } else {
                const msgErro = `Linha ${i + 2}: Cliente não encontrado para CNPJ ${nota.cnpj_emitente}. Cadastre o cliente antes de importar.`;
                console.warn(`[LeitorXML] ⚠️ ${msgErro}`);
                errosDetalhados.push(msgErro);
                continue;
              }
            } catch (error) {
              const msgErro = `Linha ${i + 2}: Erro ao buscar cliente - ${error}`;
              console.error(`[LeitorXML] ❌ ${msgErro}`);
              errosDetalhados.push(msgErro);
              continue;
            }
            
            // Criar objeto de nota para salvar
            const notaParaSalvar = {
              clientes_id,
              chave_nfe: nota.chave_nfe,
              numero_nfe: parseInt(nota.numero_nfe, 10),
              serie: parseInt(nota.serie || '1', 10),
              data_emissao: nota.data_emissao,
              data_saida_entrada: nota.data_saida_entrada || null,
              cnpj_emitente: String(nota.cnpj_emitente).replace(/\D/g, ''),
              razao_social_emitente: nota.razao_social_emitente,
              cnpj_destinatario: String(nota.cnpj_destinatario || '').replace(/\D/g, '') || '00000000000000',
              razao_social_destinatario: nota.razao_social_destinatario || 'Consumidor Final',
              uf_origem: nota.uf_origem || '',
              uf_destino: nota.uf_destino || '',
              valor_total_nfe: parseNumber(String(nota.valor_total_nfe || '0')),
              natureza_operacao: nota.natureza_operacao || '',
              modelo: nota.modelo || '55',
              estado_origem: nota.uf_origem || '',
              estado_destino: nota.uf_destino || '',
              ncm: nota.ncm || '',
              quantidade: parseNumber(String(nota.quantidade || '0')),
              valor_unitario: parseNumber(String(nota.valor_unitario || '0')),
              valor_total_item: parseNumber(String(nota.valor_unitario || '0')) * parseNumber(String(nota.quantidade || '0')),
              pis: parseNumber(String(nota.pis || '0')),
              cofins: parseNumber(String(nota.cofins || '0')),
              icms: parseNumber(String(nota.icms || '0')),
              cst_pis: nota.cst_pis || '',
              cst_cofins: nota.cst_cofins || '',
              cst_icms: nota.cst_icms || '',
              cfop: nota.cfop || '',
              descricao_produto: nota.descricao_produto || '',
              ncm_notas: JSON.stringify([{
                ncm: nota.ncm || '',
                totalQuantidade: parseNumber(String(nota.quantidade || '0')),
                totalValor: parseNumber(String(nota.valor_unitario || '0')),
                totalPis: parseNumber(String(nota.pis || '0')),
                totalCofins: parseNumber(String(nota.cofins || '0')),
                totalIcms: parseNumber(String(nota.icms || '0')),
                pisPercentage: '0.00',
                cofinsPercentage: '0.00',
                icmsPercentage: '0.00',
              }])
            };
            
            console.log(`[LeitorXML] ✅ Linha ${i + 2} processada - NFe ${notaParaSalvar.numero_nfe}`);
            notasParaSalvar.push(notaParaSalvar);
          }
          
          if (notasParaSalvar.length === 0) {
            let mensagem = 'Nenhuma nota válida encontrada na planilha.';
            if (errosDetalhados.length > 0) {
              mensagem += '\n\nErros encontrados:\n' + errosDetalhados.slice(0, 5).join('\n');
              if (errosDetalhados.length > 5) {
                mensagem += `\n... e mais ${errosDetalhados.length - 5} erro(s)`;
              }
            }
            alert(mensagem);
            setImportandoPlanilha(false);
            return;
          }
          
          console.log(`[LeitorXML] 📤 Enviando ${notasParaSalvar.length} notas para a API...`);
          
          // Salvar notas em lote
          const response = await createNotasFiscaisBulk(notasParaSalvar);
          
          if (response.error) {
            console.error('[LeitorXML] ❌ Erro ao salvar notas via API:', response.error);
            
            // Verificar se é erro de duplicata
            const errorData = response.error;
            if (errorData?.tipo_erro === 'duplicata' || errorData?.detalhes?.duplicadas) {
              const duplicadas = errorData?.detalhes?.duplicadas || [];
              toast.error(
                `Nota fiscal duplicada! ${duplicadas.length > 0 ? `Chave: ${duplicadas[0].chave_nfe.substring(0, 20)}...` : ''}`,
                {
                  duration: 5000,
                  position: 'top-right',
                  icon: '⚠️',
                }
              );
            } else {
              const mensagemErro = typeof response.error === 'string' ? response.error : errorData?.message || 'Erro desconhecido';
              toast.error(`Erro ao importar notas: ${mensagemErro}`, {
                duration: 5000,
                position: 'top-right',
              });
            }
          } else {
            console.log('[LeitorXML] ✅ Notas salvas com sucesso:', response);
            const sucessos = response.data?.sucessos || notasParaSalvar.length;
            const erros = response.data?.erros || 0;
            const duplicadas = response.data?.duplicadas || 0;
            
            // Toast de sucesso
            if (sucessos > 0) {
              toast.success(`${sucessos} nota(s) importada(s) com sucesso!`, {
                duration: 4000,
                position: 'top-right',
                icon: '✅',
              });
            }
            
            // Toast de aviso para duplicatas
            if (duplicadas > 0) {
              toast(`${duplicadas} nota(s) duplicada(s) ignorada(s)`, {
                duration: 5000,
                position: 'top-right',
                icon: '⚠️',
                style: {
                  background: '#f59e0b',
                  color: '#fff',
                },
              });
            }
            
            // Toast de erro se houver
            if (erros > 0) {
              toast.error(`${erros} erro(s) encontrado(s). Veja o console para detalhes.`, {
                duration: 5000,
                position: 'top-right',
              });
            }
            
            // Manter o alert com resumo completo
            let mensagem = `Importação concluída!\n\nNotas importadas: ${sucessos}\nDuplicadas: ${duplicadas}\nErros: ${erros}`;
            if (errosDetalhados.length > 0) {
              mensagem += `\n\nLinhas ignoradas: ${errosDetalhados.length}`;
              mensagem += '\n\nPrimeiros erros:\n' + errosDetalhados.slice(0, 3).join('\n');
              if (errosDetalhados.length > 3) {
                mensagem += `\n... e mais ${errosDetalhados.length - 3} erro(s). Veja o console para mais detalhes.`;
              }
            }
            console.log('[LeitorXML] 📊 Resumo da importação:', mensagem);
          }
        } catch (error) {
          console.error('[LeitorXML] ❌ Erro ao processar planilha:', error);
          alert('Erro ao processar a planilha. Verifique o formato e tente novamente.');
        } finally {
          setImportandoPlanilha(false);
          // Limpar o input
          event.target.value = '';
        }
      };
      reader.readAsBinaryString(file);
    } catch (error) {
      console.error('[LeitorXML] ❌ Erro ao ler arquivo:', error);
      alert('Erro ao ler o arquivo. Tente novamente.');
      setImportandoPlanilha(false);
    }
  };

  // Função principal para processar todos os arquivos carregados
  // Lê arquivos XML e ZIP, extrai documentos, calcula totais, resumos e detecta pulos de notas
  const handleProcessFiles = async () => {
    setIsLoading(true);
    setSkippedNotes([]); // Limpa avisos anteriores ao iniciar novo processamento

    let xmlFiles = [];
    // Percorre todos os arquivos carregados
    for (const file of files) {
      if (file.name.toLowerCase().endsWith('.zip')) {
        // Se for ZIP, extrai todos os arquivos XML de dentro
        const zip = await JSZip.loadAsync(file);
        const zipXmlFiles = [];
        const entries = Object.values(zip.files);
        for (const entry of entries) {
          if (!entry.dir && entry.name.toLowerCase().endsWith('.xml')) {
            const content = await entry.async('blob');
            zipXmlFiles.push(new File([content], entry.name, { type: 'text/xml' }));
          }
          if (entry.dir && entry.name.toLowerCase().endsWith('/')) {
            const subEntries = Object.values(zip.folder(entry.name)?.files || {});
            for (const subEntry of subEntries) {
                if (!subEntry.dir && subEntry.name.toLowerCase().endsWith('.xml')) {
                    const subContent = await subEntry.async('blob');
                    zipXmlFiles.push(new File([subContent], subEntry.name, { type: 'text/xml' }));
                }
            }
          }
        }
        xmlFiles = xmlFiles.concat(zipXmlFiles);
      } else if (file.name.toLowerCase().endsWith('.xml')) {
        // Se for XML, adiciona direto
        xmlFiles.push(file);
      }
    }
    if (xmlFiles.length === 0) {
      alert('Nenhum arquivo XML encontrado para processar.');
      setIsLoading(false);
      return;
    }

    // Listas e mapas auxiliares para resumos e agrupamentos
    const processedDocumentData = [];
    const resumeMap = {};
    const uniqueNcms = new Set();
    let firstFileProcessed = false; 
 
    const monthlyRevenueMap = {};
    const uniqueMonthYears = new Set();
 
    // Mapa para armazenar números de notas por CNPJ do emitente e série (para detectar pulos)
    const noteNumbersMap = {};



    try {
      // Processa cada arquivo XML individualmente
      for (let i = 0; i < xmlFiles.length; i++) {
        const file = xmlFiles[i];
        
        // Lê o conteúdo do arquivo XML
        const promise = new Promise(async (resolve) => {
          const reader = new FileReader();
          reader.onload = async (e) => {
            const text = typeof e.target?.result === 'string' ? e.target.result : '';
            try {
              const parser = new DOMParser();
              const xmlDoc = parser.parseFromString(text, 'text/xml');
              
              // Detecta o tipo de documento (NFe, NFCe, NFSe)
              const documentType = detectDocumentType(xmlDoc);
              console.log('[LeitorXML] Tipo de documento detectado:', documentType);
              
              let produtosData = [];
              let totalDocumentValue = 0; 
              let totalDocumentPis = 0;    
              let totalDocumentCofins = 0; 
              let totalDocumentIcms = 0;   
              let monthYear = '';
              let dataEmissaoRaw = '';
              let cnpjEmitente = '';
              let nomeEmitente = '';
              let serie = '1';
              let numero = '';

              // Processa baseado no tipo de documento
              switch (documentType) {
                case 'NFe':
                  produtosData = processNFe(xmlDoc);
                  break;
                case 'NFCe':
                  produtosData = processNFCe(xmlDoc);
                  break;
                case 'NFSe':
                  produtosData = processNFSe(xmlDoc);
                  console.log('[LeitorXML] Produtos NFSe extraídos:', produtosData);
                  break;
              }

              // --- INÍCIO: RESUMO INDIVIDUAL DE NCM POR NOTA ---
              // Agrupa os produtos da nota por NCM
              const ncmResumoNota = [];
              const ncmMap = {};
              for (const produto of produtosData) {
                if (!produto.ncm) continue;
                if (!ncmMap[produto.ncm]) {
                  ncmMap[produto.ncm] = {
                    ncm: produto.ncm,
                    totalQuantidade: 0,
                    totalValor: 0,
                    totalPis: 0,
                    totalCofins: 0,
                    totalIcms: 0,
                    pisPercentage: '0.00',
                    cofinsPercentage: '0.00',
                    icmsPercentage: '0.00',
                  };
                }
                const quantidadeNum = parseNumber(produto.quantidade);
                const valorUnitarioNum = parseNumber(produto.valorUnitario);
                const valorTotalItem = quantidadeNum * valorUnitarioNum;
                const pisNum = parseNumber(produto.pis);
                const cofinsNum = parseNumber(produto.cofins);
                const icmsNum = parseNumber(produto.icms);

                ncmMap[produto.ncm].totalQuantidade += quantidadeNum;
                ncmMap[produto.ncm].totalValor += valorTotalItem;
                ncmMap[produto.ncm].totalPis += pisNum;
                ncmMap[produto.ncm].totalCofins += cofinsNum;
                ncmMap[produto.ncm].totalIcms += icmsNum;
              }
              Object.values(ncmMap).forEach((ncmObj) => {
                const total = ncmObj.totalValor;
                ncmObj.pisPercentage = total > 0 ? ((ncmObj.totalPis / total) * 100).toFixed(2) : '0.00';
                ncmObj.cofinsPercentage = total > 0 ? ((ncmObj.totalCofins / total) * 100).toFixed(2) : '0.00';
                ncmObj.icmsPercentage = total > 0 ? ((ncmObj.totalIcms / total) * 100).toFixed(2) : '0.00';
                ncmResumoNota.push(ncmObj);
              });
              // --- FIM: RESUMO INDIVIDUAL DE NCM POR NOTA ---

              if (produtosData.length > 0) {
                // Extrai informações comuns para processamento
                const firstProduct = produtosData[0];
                dataEmissaoRaw = firstProduct.dataEmissao;
                cnpjEmitente = firstProduct.cnpjEmitente;
                nomeEmitente = firstProduct.nomeEmitente;
                serie = xmlDoc.querySelector('serie')?.textContent || '1';
                numero = firstProduct.numero;

                

                if (!firstFileProcessed) {
                  setNomeEmpresaAnalise(nomeEmitente);
                  setCnpjEmpresaAnalise(cnpjEmitente);
                  firstFileProcessed = true;
                }

                // Adiciona o número da nota ao mapa para verificação de pulo
                if (firstProduct.numero && cnpjEmitente && serie) {
                  const key = `${cnpjEmitente}-${serie}`;
                  if (!noteNumbersMap[key]) {
                    noteNumbersMap[key] = [];
                  }
                  noteNumbersMap[key].push(parseInt(firstProduct.numero, 10));
                }

                // Calcula totais e processa dados de cada produto/documento
                for (const produto of produtosData) {
                  let valorTotalItem = 0;
                  let quantidadeNum = 0;
                  let valorUnitarioNum = 0;
                  if (produto.tipoDocumento === 'NFSe') {
                    // Para NFSe, usar valorServico se existir, senão valorUnitario
                    const valorServicoBase = produto.valorServico ?? produto.valorUnitario;
                    valorTotalItem = parseNumber(valorServicoBase || '0');
                    quantidadeNum = 1;
                    valorUnitarioNum = valorTotalItem;
                  } else {
                    quantidadeNum = parseNumber(produto.quantidade);
                    valorUnitarioNum = parseNumber(produto.valorUnitario);
                    valorTotalItem = quantidadeNum * valorUnitarioNum;
                  }
                  const pisNum = parseNumber(produto.pis);
                  const cofinsNum = parseNumber(produto.cofins);
                  const icmsNum = parseNumber(produto.icms);

                  totalDocumentValue += valorTotalItem;
                  totalDocumentPis += pisNum;
                  totalDocumentCofins += cofinsNum;
                  totalDocumentIcms += icmsNum;
                  
                  // Log para debug dos valores acumulados
                  

                  if (produto.ncm) {
                    uniqueNcms.add(produto.ncm);
                    if (!resumeMap[produto.ncm]) {
                      resumeMap[produto.ncm] = { totalQuantidade: 0, totalValor: 0, totalPis: 0, totalCofins: 0, totalIcms: 0 };
                    }
                    resumeMap[produto.ncm].totalQuantidade += quantidadeNum;
                    resumeMap[produto.ncm].totalValor += valorTotalItem;
                    resumeMap[produto.ncm].totalPis += pisNum;
                    resumeMap[produto.ncm].totalCofins += cofinsNum;
                    resumeMap[produto.ncm].totalIcms += icmsNum;
                  }
                }

                // Processa data para agrupamento mensal
                if (dataEmissaoRaw) {
                  try {
                    const datePart = dataEmissaoRaw.split('T')[0];
                    const [year, month] = datePart.split('-');
                    monthYear = `${year}-${month}`;
                    uniqueMonthYears.add(monthYear); 
                  } catch (e) {
                    console.error("Erro ao formatar data de emissão:", dataEmissaoRaw, e);
                  }
                }

                if (monthYear) {
                  if (!monthlyRevenueMap[monthYear]) {
                    monthlyRevenueMap[monthYear] = { totalRevenue: 0, totalIcms: 0, totalPis: 0, totalCofins: 0 };
                  }
                  monthlyRevenueMap[monthYear].totalRevenue += totalDocumentValue;
                  monthlyRevenueMap[monthYear].totalPis += totalDocumentPis;
                  monthlyRevenueMap[monthYear].totalCofins += totalDocumentCofins;
                  monthlyRevenueMap[monthYear].totalIcms += totalDocumentIcms;
                }

                // Salvar nota fiscal na tabela
                console.log('[LeitorXML] selectedCompanyId:', selectedCompanyId, 'selectedCompanyName:', selectedCompanyName);
                console.log('[LeitorXML] Produtos a serem salvos:', produtosData.length);
                
                // Para NFSe com múltiplas notas, salvar cada uma individualmente
                if (documentType === 'NFSe' && produtosData.length > 1) {
                  console.log('[LeitorXML] NFSe com múltiplas notas detectada, salvando individualmente');
                  for (let i = 0; i < produtosData.length; i++) {
                    const produto = produtosData[i];
                    console.log(`[LeitorXML] Salvando nota ${i + 1} de ${produtosData.length}:`, produto.numero);
                    await salvarNotaFiscalIndividual(produto, xmlDoc, documentType);
                    // Pequeno delay para evitar conflitos
                    await new Promise(resolve => setTimeout(resolve, 100));
                  }
                } else if (documentType === 'NFe' || documentType === 'NFCe' || documentType === 'NFSe') {
                  let chave_nfe = '';
                  let numero_nfe = parseInt(numero, 10);
                  let serie_nfe = parseInt(serie, 10);
                  let data_emissao = dataEmissaoRaw ? formatarDataParaISO(dataEmissaoRaw) : null;
                  let data_saida_entrada = null;
                  let cnpj_emitente = cnpjEmitente.replace(/\D/g, ''); // Remove símbolos, mantém apenas números
                  let razao_social_emitente = nomeEmitente;
                  let cnpj_destinatario = firstProduct.cnpjDestinatario.replace(/\D/g, ''); // Remove símbolos, mantém apenas números
                  let razao_social_destinatario = firstProduct.nomeDestinatario;
                  let uf_origem = '';
                  let uf_destino = '';
                  let valor_total_nfe = 0;
                  let natureza_operacao = '';
                  let modelo = '';

                  if (documentType === 'NFe') {
                    chave_nfe = extractChaveNfe(xmlDoc);
                    const extra = extractExtraFields(xmlDoc);
                    uf_origem = extra.uf_origem;
                    uf_destino = extra.uf_destino;
                    natureza_operacao = extra.natureza_operacao;
                    modelo = extra.modelo;
                    data_saida_entrada = extra.data_saida_entrada ? extra.data_saida_entrada.split('T')[0] : null;
                    // Garantir que valor_total_nfe seja sempre um número
                    const valorNF = xmlDoc.querySelector('vNF')?.textContent || '0';
                    valor_total_nfe = parseNumber(valorNF);
                    
                  } else if (documentType === 'NFCe') {
                    // NFCe pode não ter chave igual NFe, mas geralmente segue o mesmo padrão
                    chave_nfe = extractChaveNfe(xmlDoc) || `${cnpj_emitente}_${numero}_${serie}_NFCe`;
                    uf_origem = xmlDoc.querySelector('emit > enderEmit > UF')?.textContent || '';
                    uf_destino = xmlDoc.querySelector('dest > enderDest > UF')?.textContent || '';
                    natureza_operacao = xmlDoc.querySelector('natOp')?.textContent || '';
                    modelo = xmlDoc.querySelector('ide > mod')?.textContent || '65';
                    // Garantir que valor_total_nfe seja sempre um número
                    const valorCFe = xmlDoc.querySelector('vCFe')?.textContent || xmlDoc.querySelector('vNF')?.textContent || '0';
                    valor_total_nfe = parseNumber(valorCFe);
                  } else if (documentType === 'NFSe') {
                    // Para NFSe, gerar uma chave única de 44 caracteres incluindo o número da nota
                    // Usar CNPJ + Número da nota + Data + Timestamp para garantir unicidade
                    const timestamp = Date.now().toString();
                    const numeroLimpo = numero.replace(/\D/g, '');
                    const dataLimpa = data_emissao ? data_emissao.replace(/\D/g, '') : '';
                    let chaveBase = `${cnpj_emitente}${numeroLimpo}${dataLimpa}${timestamp}`;
                    // Limita a 44 caracteres e preenche com zeros se necessário
                    chave_nfe = chaveBase.padEnd(44, '0').slice(0, 44);
                    console.log('[LeitorXML] NFSe - Chave gerada:', chave_nfe, 'para nota:', numero);
                    
                    // Garante que numero_nfe e serie sejam válidos
                    numero_nfe = parseInt(numero, 10);
                    if (isNaN(numero_nfe)) numero_nfe = 1;
                    serie_nfe = parseInt(serie, 10);
                    if (isNaN(serie_nfe)) serie_nfe = 1;
                    
                    // Garante que cnpj_destinatario tenha 14 caracteres
                    cnpj_destinatario = (firstProduct.cnpjDestinatario || '').replace(/\D/g, '');
                    if (cnpj_destinatario.length < 14) {
                      cnpj_destinatario = cnpj_destinatario.padStart(14, '0');
                    } else if (cnpj_destinatario.length > 14) {
                      cnpj_destinatario = cnpj_destinatario.slice(0, 14);
                    }
                    
                    // Se ainda estiver vazio, usar valor padrão
                    if (!cnpj_destinatario || cnpj_destinatario === '00000000000000') {
                      cnpj_destinatario = '00000000000000'; // CNPJ genérico para consumidor final
                    }
                    razao_social_destinatario = firstProduct.nomeDestinatario || 'NFSe Destinatário';
                    // Preenche UF de origem/destino a partir do produto NFSe (prestador/tomador)
                    uf_origem = firstProduct.estadoOrigem || '';
                    uf_destino = firstProduct.estadoDestino || '';
                    natureza_operacao = xmlDoc.querySelector('Discriminacao')?.textContent || xmlDoc.querySelector('descricaoServico')?.textContent || 'Serviço';
                    modelo = 'SE'; // Corrigido para no máximo 2 caracteres
                    
                    // Corrigir acesso a valorServico
                    let valorServico = '0';
                    if ('valorServico' in firstProduct && firstProduct.valorServico) {
                      valorServico = firstProduct.valorServico;
                    } else if (firstProduct.valorUnitario) {
                      valorServico = firstProduct.valorUnitario;
                    }
                    // Garantir que valor_total_nfe seja sempre um número
                    valor_total_nfe = parseNumber(valorServico);
                  }

                  // Detectar ISS retido para NFSe
                  let iss_ret = null;
                  let valor_iss_ret = null;
                  
                  if (documentType === 'NFSe' && firstProduct.tipoDocumento === 'NFSe') {
                    iss_ret = Boolean(firstProduct.issRetido); // Garante que seja sempre booleano
                    valor_iss_ret = firstProduct.valorIssRetido || null; // Valor do ISS retido
                    

                    
                    console.log('[LeitorXML] NFSe detectada - ISS Retido para salvar:', iss_ret);
                    console.log('[LeitorXML] NFSe detectada - Valor ISS Retido para salvar:', valor_iss_ret);
                    console.log('[LeitorXML] Detalhes da NFSe:', {
                      numero: firstProduct.numero,
                      cnpjEmitente: firstProduct.cnpjEmitente,
                      valorServico: firstProduct.valorServico,
                      issRetido: firstProduct.issRetido,
                      valorIssRetido: firstProduct.valorIssRetido
                    });
                  } else if (documentType === 'NFSe') {
                    console.log('[LeitorXML] NFSe detectada mas não conseguiu extrair dados de ISS retido');
                  }

                  const notaParaSalvar = {
                    chave_nfe,
                    numero_nfe,
                    serie: serie_nfe,
                    data_emissao,
                    data_saida_entrada,
                    cnpj_emitente,
                    razao_social_emitente,
                    cnpj_destinatario,
                    razao_social_destinatario,
                    uf_origem,
                    uf_destino,
                    valor_total_nfe,
                    natureza_operacao,
                    modelo,
                    estado_origem: uf_origem,
                    estado_destino: uf_destino,
                    // Novas colunas individuais para melhorar performance
                    ncm: firstProduct.ncm || '',
                    quantidade: parseNumber(firstProduct.quantidade) || 0,
                    valor_unitario: parseNumber(firstProduct.valorUnitario) || 0,
                    valor_total_item: parseNumber(firstProduct.valorUnitario) || 0,
                    pis: parseNumber(firstProduct.pis) || 0,
                    cofins: parseNumber(firstProduct.cofins) || 0,
                    icms: parseNumber(firstProduct.icms) || 0,
                    cst_pis: firstProduct.cstPis || '',
                    cst_cofins: firstProduct.cstCofins || '',
                    cst_icms: firstProduct.cst || '',
                    cfop: firstProduct.cfop || '',
                    descricao_produto: firstProduct.produto || '',
                    // Manter a coluna ncm_notas para compatibilidade
                    ncm_notas: JSON.stringify([{
                      ncm: firstProduct.ncm,
                      totalQuantidade: parseNumber(firstProduct.quantidade),
                      totalValor: parseNumber(firstProduct.valorUnitario),
                      totalPis: parseNumber(firstProduct.pis),
                      totalCofins: parseNumber(firstProduct.cofins),
                      totalIcms: parseNumber(firstProduct.icms),
                      pisPercentage: '0.00',
                      cofinsPercentage: '0.00',
                      icmsPercentage: '0.00',
                    }]),
                    iss_ret,
                    valor_iss_ret
                  };
                  // Log para depuração
                  if (documentType === 'NFSe') {
                    console.log('[LeitorXML] Produto NFSe para salvar:', firstProduct);
                  }
                  // Log para depuração final antes de salvar
                  console.log('[LeitorXML] Nota para salvar via API:', notaParaSalvar);
                  // Novo log para garantir que sempre aparece
                  console.log('[LeitorXML] Tentando salvar nota:', notaParaSalvar);
                  // Log detalhado do fluxo de salvamento
                  
                  
                  if (chave_nfe) {
                
                    

                    
                    try {
                      // Buscar cliente_id baseado no CNPJ do emitente usando a API
                      let clientes_id = null;
                      try {
                        if (!selectedCompanyId) {
                          console.error('[LeitorXML] Company ID não encontrado');
                          return;
                        }

                        const clientesResponse = await fetchClientes({
                          company_id: selectedCompanyId,
                          cnpj: cnpj_emitente
                        });

                        if (clientesResponse.error) {
                          console.error('[LeitorXML] Erro ao buscar cliente via API:', clientesResponse.error);
                          return;
                        }

                        const clientesEncontrados = clientesResponse.data?.data || [];

                        if (clientesEncontrados.length > 0) {
                          clientes_id = clientesEncontrados[0].id;
                          console.log('[LeitorXML] Cliente encontrado:', clientes_id);
                        } else {
                          // Se não encontrar, não criar cliente automaticamente - apenas logar
                          console.log('[LeitorXML] Cliente não encontrado. Criação de clientes deve ser feita via Simples Nacional.');
                          console.log('[LeitorXML] Nota fiscal não será salva sem cliente associado.');
                          return; // Não salvar a nota se não houver cliente
                        }
                      } catch (error) {
                        console.error('[LeitorXML] Erro inesperado ao buscar cliente via API:', error);
                        return; // Não salvar a nota se houver erro
                      }

                      if (clientes_id) {
                        // Adicionar clientes_id ao objeto notaParaSalvar
                        const notaComCliente = {
                          ...notaParaSalvar,
                          clientes_id
                        };

                        // Usar a nova API em vez do Supabase diretamente
                        console.log('[LeitorXML] 🔄 Enviando nota para API (processamento em lote):', {
                          numero_nfe: notaComCliente.numero_nfe,
                          chave_nfe: notaComCliente.chave_nfe,
                          clientes_id: notaComCliente.clientes_id,
                          cnpj_emitente: notaComCliente.cnpj_emitente,
                          cnpj_destinatario: notaComCliente.cnpj_destinatario,
                          valor_total_nfe: notaComCliente.valor_total_nfe
                        });
                        
                        const response = await createNotasFiscaisBulk([notaComCliente]);
                        
                        if (response.error) {
                          console.error('[LeitorXML] ❌ Erro ao salvar nota via API:', response.error);
                          console.error('[LeitorXML] ❌ Detalhes do erro:', response);
                          
                          // Verificar se é erro de duplicata
                          const errorData = response.data || response.error;
                          if (errorData?.tipo_erro === 'duplicata' || errorData?.error?.includes?.('duplicada')) {
                            toast(
                              `Nota ${notaParaSalvar.numero_nfe} já cadastrada para este cliente`,
                              {
                                duration: 4000,
                                position: 'top-right',
                                icon: '⚠️',
                                style: {
                                  background: '#f59e0b',
                                  color: '#fff',
                                },
                              }
                            );
                          } else {
                            toast.error(
                              `Erro ao salvar nota ${notaParaSalvar.numero_nfe}`,
                              {
                                duration: 4000,
                                position: 'top-right',
                              }
                            );
                          }
                        } else {
                          console.log('[LeitorXML] ✅ Nota salva com sucesso via API:', notaParaSalvar.numero_nfe);
                          console.log('[LeitorXML] ✅ Resposta da API:', response);
                          
                          // Verificar se houve erros na resposta
                          if (response.data && response.data.erros > 0) {
                            console.error('[LeitorXML] ❌ Erros na resposta da API:', response.data.detalhes_erros);
                          }
                          if (documentType === 'NFSe' && iss_ret !== null) {
                            console.log('[LeitorXML] ✅ NFSe salva com ISS Retido:', iss_ret ? 'SIM' : 'NÃO');
                            if (iss_ret && valor_iss_ret) {
                              console.log('[LeitorXML] ✅ NFSe salva com Valor ISS Retido: R$', valor_iss_ret);
                            }
                          }
                        }
                      } else {
                        console.error('[LeitorXML] ❌ Não foi possível obter clientes_id para salvar a nota');
                      }
                    } catch (e) {
                      console.error('[LeitorXML] Erro ao salvar nota via API:', e);
                    }
                  } else {
                    console.warn('[LeitorXML][DEBUG] chave_nfe vazia, nota NÃO será salva:', notaParaSalvar);
                  }
                }
              }

              resolve(produtosData);
            } catch (error) {
              console.error("Erro ao processar arquivo:", error);
              resolve([]);
            }
          };
          reader.readAsText(file);
        });
        const result = await promise;
        processedDocumentData.push(...result);
      }
      setDocumentList(processedDocumentData);
      
      // Toast de sucesso ao processar documentos
      if (processedDocumentData.length > 0) {
        toast.success(
          `${processedDocumentData.length} documento(s) processado(s) com sucesso!`,
          {
            duration: 4000,
            position: 'top-right',
            icon: '✅',
          }
        );
        
        // Processa NCMs automaticamente após carregar os documentos
        processarNcmsAutomaticamente(processedDocumentData);
      }

      // Gera o resumo por NCM (agregando valores, impostos e percentuais)
      const sortedNCMResume = Object.keys(resumeMap).map(ncmKey => {
        const data = resumeMap[ncmKey];
        const totalRevenueForNCM = data.totalValor; 
        
        const pisPercentage = totalRevenueForNCM > 0 ? ((data.totalPis / totalRevenueForNCM) * 100).toFixed(2) : '0.00';
        const cofinsPercentage = totalRevenueForNCM > 0 ? ((data.totalCofins / totalRevenueForNCM) * 100).toFixed(2) : '0.00';
        const icmsPercentage = totalRevenueForNCM > 0 ? ((data.totalIcms / totalRevenueForNCM) * 100).toFixed(2) : '0.00'; 

        return {
            ncm: ncmKey,
            totalQuantidade: data.totalQuantidade,
            totalValor: data.totalValor,
            totalPis: data.totalPis,
            totalCofins: data.totalCofins,
            totalIcms: data.totalIcms,
            pisPercentage,
            cofinsPercentage,
            icmsPercentage,
        };
      }).sort((a, b) => a.ncm.localeCompare(b.ncm));
      setNcmResumeList(sortedNCMResume);

      // Atualiza filtros de NCM disponíveis
      const sortedUniqueNcms = Array.from(uniqueNcms).sort();
      setAvailableNcms(sortedUniqueNcms);
      setSelectedNcm(''); 

      // Gera o resumo mensal de faturamento
      const sortedMonthlyRevenue = Object.keys(monthlyRevenueMap)
        .map(monthYear => ({
          monthYear,
          totalRevenue: monthlyRevenueMap[monthYear].totalRevenue,
          totalIcms: monthlyRevenueMap[monthYear].totalIcms,
          totalPis: monthlyRevenueMap[monthYear].totalPis,
          totalCofins: monthlyRevenueMap[monthYear].totalCofins,
        }))
        .sort((a, b) => a.monthYear.localeCompare(b.monthYear)); 
      setMonthlyRevenueList(sortedMonthlyRevenue);

      // Atualiza filtros de mês/ano disponíveis
      const sortedUniqueMonthYears = Array.from(uniqueMonthYears).sort();
      setAvailableMonthYears(sortedUniqueMonthYears);
      setSelectedMonthYear(''); 

      // --- Lógica para detectar pulos de notas fiscais ---
      const detectedSkippedNotes = [];

      for (const key in noteNumbersMap) {
          if (noteNumbersMap.hasOwnProperty(key)) {
              const [cnpj, serie] = key.split('-');
              const numbers = noteNumbersMap[key].sort((a, b) => a - b); // Ordenar os números
              
              const currentSkipped = [];
              for (let i = 0; i < numbers.length - 1; i++) {
                  const current = numbers[i];
                  const next = numbers[i + 1];

                  if (next - current > 1) {
                      // Pulo detectado
                      for (let j = current + 1; j < next; j++) {
                          currentSkipped.push(j.toString());
                      }
                  }
              }
              if (currentSkipped.length > 0) {
                  detectedSkippedNotes.push({
                      cnpj: cnpj,
                      serie: serie,
                      skipped: currentSkipped,
                  });
              }
          }
      }
      setSkippedNotes(detectedSkippedNotes);
      // --- Fim da lógica de pulo de notas ---



    } finally {
      setIsLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (documentList.length === 0) return;
    
    let nomeRelatorio = nomeEmpresaAnalise || documentList[0]?.nomeEmitente || 'emitente';
    nomeRelatorio = nomeRelatorio
      .normalize('NFD')
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, '_')
      .toLowerCase();
      
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const dataHora = `${now.getFullYear()}_${pad(now.getMonth() + 1)}_${pad(now.getDate())}_${pad(now.getHours())}_${pad(now.getMinutes())}`;
    const fileName = `relatorio_documentos_${nomeRelatorio}_${dataHora}.xlsx`;
    
    const headers = Object.keys(documentList[0]);
    const dataRows = documentList.map((objData) => 
        headers.map((h) => {
            const value = objData[h];
            if (['quantidade', 'valorUnitario', 'pis', 'cofins', 'icms'].includes(h)) {
                return parseFloat(String(value).replace(/\./g, '').replace(',', '.'));
            }
            return value;
        })
    );
    
    const aoa = [headers, ...dataRows, [], ["Powered by Contabhub Technology"]];
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    
    const colCount = headers.length;
    worksheet['!merges'] = worksheet['!merges'] || [];
    worksheet['!merges'].push({ s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: colCount - 1 } });
    
    const assinaturaCell = worksheet[XLSX.utils.encode_cell({ r: aoa.length - 1, c: 0 })];
    if (assinaturaCell) {
      assinaturaCell.s = { font: { bold: true } };
    }
    
    worksheet['!cols'] = headers.map(() => ({ wch: 20 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'NFe');
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, fileName);
  };

  const handleNcmFilterChange = (event) => {
    setSelectedNcm(event.target.value);
  };

  const handleMonthYearFilterChange = (event) => {
    setSelectedMonthYear(event.target.value);
  };

  const filteredNcmResumeList = useMemo(() => {
    if (!selectedNcm || availableNcms.length === 0) {
      return ncmResumeList;
    }
    return ncmResumeList.filter(item => item.ncm === selectedNcm);
  }, [ncmResumeList, selectedNcm, availableNcms]);

  const filteredMonthlyRevenueList = useMemo(() => {
    if (!selectedMonthYear || availableMonthYears.length === 0) {
      return monthlyRevenueList;
    }
    return monthlyRevenueList.filter(item => item.monthYear === selectedMonthYear);
  }, [monthlyRevenueList, selectedMonthYear, availableMonthYears]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload; 
      const totalRevenue = data.totalRevenue;
      const totalIcms = data.totalIcms;
      const totalPis = data.totalPis;
      const totalCofins = data.totalCofins;

      const icmsPercentage = totalRevenue > 0 ? ((totalIcms / totalRevenue) * 100).toFixed(2) : '0.00';
      const pisPercentage = totalRevenue > 0 ? ((totalPis / totalRevenue) * 100).toFixed(2) : '0.00';
      const cofinsPercentage = totalRevenue > 0 ? ((totalCofins / totalRevenue) * 100).toFixed(2) : '0.00';
      
      return (
        <div className={styles.tooltipCard}>
          <p className={styles.tooltipTitle}>{label}</p> 
          <p className={styles.tooltipItem}>
            <span className={styles.tooltipLabel}>Faturamento Total:</span>{' '}
            <span className={styles.tooltipValue}>R$ {formatNumber(totalRevenue)}</span>
          </p>
          
          <div className={styles.tooltipSection}>
            <p className={styles.tooltipLabel}>Impostos sobre o Faturamento:</p>
            <div className={styles.tooltipList}>
              <p className={styles.tooltipItem}>
                <span className={styles.tooltipLabel}>ICMS:</span>{' '}
                <span className={styles.tooltipValue}>R$ {formatNumber(totalIcms)}</span>{' '}
                <span className={styles.tooltipPercent}>({icmsPercentage}%)</span>
              </p>
              <p className={styles.tooltipItem}>
                <span className={styles.tooltipLabel}>PIS:</span>{' '}
                <span className={styles.tooltipValue}>R$ {formatNumber(totalPis)}</span>{' '}
                <span className={styles.tooltipPercent}>({pisPercentage}%)</span>
              </p>
              <p className={styles.tooltipItem}>
                <span className={styles.tooltipLabel}>COFINS:</span>{' '}
                <span className={styles.tooltipValue}>R$ {formatNumber(totalCofins)}</span>{' '}
                <span className={styles.tooltipPercent}>({cofinsPercentage}%)</span>
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };


  return (
    <div className={styles.page}>
      {/* Toast Container */}
      <Toaster />

      <div className={styles.content}>
        {/* Card Principal */}
        <div className={styles.mainCard}>
          <div className={styles.cardHeader}>
            <svg className={styles.headerIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className={styles.headerTitle}>
              {nomeEmpresaAnalise && cnpjEmpresaAnalise ? (
                <>
                  <span className={styles.headerHighlight}>Nome da Empresa:</span> {nomeEmpresaAnalise} | CNPJ: {cnpjEmpresaAnalise}
                </>
              ) : (
                'Faça o Upload de Documentos Fiscais (NFe, NFCe, NFSe)'
              )}
            </h2>
          </div>

          <div className={styles.uploadSection}>
            <div className={styles.uploadInner}>
              <div
                className={styles.dropzone}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <svg className={styles.dropzoneIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>

                <div className={styles.dropzoneActions}>
                  <label htmlFor="file-upload">
                    <div className={styles.selectorButton}>
                      <div className={styles.selectorButtonContent}>
                        <svg className={`${styles.selectorButtonIcon} ${styles.selectorIconBlue}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className={styles.selectorButtonLabel}>Selecionar XML/ZIP</span>
                      </div>
                      <p className={styles.selectorButtonHint}>Arquivos XML ou ZIP</p>
                    </div>
                    <input
                      type="file"
                      accept=".xml,.zip"
                      multiple
                      onChange={handleFileChange}
                      style={{
                        opacity: 0,
                        position: 'absolute',
                        zIndex: -1,
                        width: '1px',
                        height: '1px',
                        overflow: 'hidden',
                      }}
                      id="file-upload"
                      disabled={isLoading}
                    />
                  </label>

                  <label htmlFor="planilha-upload">
                    <div className={`${styles.selectorButton} ${styles.selectorButtonGreen}`}>
                      <div className={styles.selectorButtonContent}>
                        <svg className={`${styles.selectorButtonIcon} ${styles.selectorIconGreen}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span className={styles.selectorButtonLabel}>
                          {importandoPlanilha ? 'Importando...' : 'Importar Planilha'}
                        </span>
                      </div>
                      <p className={styles.selectorButtonHint}>Arquivo Excel (.xlsx)</p>
                    </div>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleImportPlanilha}
                      style={{
                        opacity: 0,
                        position: 'absolute',
                        zIndex: -1,
                        width: '1px',
                        height: '1px',
                        overflow: 'hidden',
                      }}
                      id="planilha-upload"
                      disabled={isLoading || importandoPlanilha}
                    />
                  </label>

                  <button
                    onClick={handleDownloadPlanilhaModelo}
                    disabled={isLoading}
                    className={`${styles.selectorButton} ${styles.selectorButtonPurple}`}
                  >
                    <div className={styles.selectorButtonContent}>
                      <svg className={`${styles.selectorButtonIcon} ${styles.selectorIconPurple}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className={styles.selectorButtonLabel}>Baixar Modelo</span>
                    </div>
                    <p className={styles.selectorButtonHint}>Planilha de exemplo</p>
                  </button>
                </div>

                <p className={styles.helperText}>
                  Suporta NFe, NFCe e NFSe | Arraste e solte múltiplos arquivos XML e ZIP<br />
                  Ou importe notas via planilha Excel usando o modelo fornecido
                </p>

                {isLoading && (
                  <div className={styles.loaderStatusWrapper}>
                    <SpaceLoader size={32} label='Processando arquivos...' showText={true} minHeight={0} className={styles.statusMessageBlue} />
                  </div>
                )}

                {importandoPlanilha && (
                  <div className={styles.loaderStatusWrapper}>
                    <SpaceLoader size={32} label='Importando planilha...' showText={true} minHeight={0} className={styles.statusMessageGreen} />
                  </div>
                )}

                <div className={styles.actionButtons}>
                  <button
                    onClick={handleProcessFiles}
                    disabled={files.length === 0 || isLoading}
                    className={styles.primaryAction}
                  >
                    {isLoading ? 'Aguarde...' : 'Processar Arquivos'}
                  </button>

                  {files.length > 0 && (
                    <button
                      onClick={clearAllFiles}
                      disabled={isLoading}
                      className={styles.dangerAction}
                    >
                      Limpar Todos
                    </button>
                  )}
                </div>
              </div>

              {files.length > 0 && (
                <div className={styles.filesCard}>
                  <div className={styles.filesHeader}>
                    <h3 className={styles.filesTitle}>Arquivos Selecionados ({files.length})</h3>
                    <div className={styles.filesMeta}>
                      <svg className={styles.selectorButtonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>Arraste para reordenar</span>
                    </div>
                  </div>

                  <div className={styles.filesBody}>
                    {files.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className={styles.fileRow}
                      >
                        <div className={styles.fileInfoLeft}>
                          <div className={styles.fileDragHandle}>
                            <svg className={styles.selectorButtonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                            </svg>
                          </div>
                          <div
                            className={`${styles.fileBadge} ${
                              file.name.toLowerCase().endsWith('.xml')
                                ? styles.fileBadgeXml
                                : styles.fileBadgeZip
                            }`}
                          >
                            <svg className={styles.selectorButtonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className={styles.fileInfoContent}>
                             <p className={styles.fileName}>{file.name}</p>
                            <p className={styles.fileDetails}>
                              {(file.size / 1024).toFixed(1)} KB • {file.type || 'Arquivo'}
                            </p>
                          </div>
                        </div>

                        <div className={styles.fileInfoRight}>
                          <span
                            className={`${styles.fileType} ${
                              file.name.toLowerCase().endsWith('.xml')
                                ? styles.fileTypeXml
                                : styles.fileTypeZip
                            }`}
                          >
                            {file.name.toLowerCase().endsWith('.xml') ? 'XML' : 'ZIP'}
                          </span>

                          <button
                            onClick={() => removeFile(index)}
                            disabled={isLoading}
                            className={styles.removeButton}
                            title="Remover arquivo"
                          >
                            <svg className={styles.selectorButtonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={styles.filesFooter}>
                    <span>
                      Total: {files.length} arquivo(s) •
                      {files.reduce((acc, file) => acc + file.size, 0) / 1024 / 1024 > 1
                        ? ` ${(files.reduce((acc, file) => acc + file.size, 0) / 1024 / 1024).toFixed(2)} MB`
                        : ` ${(files.reduce((acc, file) => acc + file.size, 0) / 1024).toFixed(1)} KB`}
                    </span>
                    <span className={styles.filesFooterStatus}>✓ Pronto para processar</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* NOVO: Card de Aviso de Pulo de Nota */}
          {skippedNotes.length > 0 && (
            <div className={styles.warningCard}>
              <div className={styles.warningHeader}>
                <h3 className={styles.warningTitle}>
                  <svg className={styles.selectorButtonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Aviso: Pulos na Sequência de Notas Fiscais Detectados!
                </h3>
              </div>
              <div className={styles.warningBody}>
                <p>Foram detectadas falhas na sequência numérica das seguintes notas fiscais:</p>
                <ul className={styles.warningList}>
                  {skippedNotes.map((entry, index) => (
                    <li key={index} className={styles.warningItem}>
                      <span className={styles.headerHighlight}>Emitente CNPJ:</span> {entry.cnpj}
                      <span className={styles.headerHighlight}> • Série:</span> {entry.serie}
                      <span className={styles.headerHighlight}> • Notas Puladas:</span>{' '}
                      <span className={styles.warningHighlight}>{entry.skipped.join(', ')}</span>
                    </li>
                  ))}
                </ul>
                <p className={styles.warningFooter}>
                  É importante verificar a justificativa para esses pulos com o seu departamento fiscal ou contabilidade.
                </p>
              </div>
            </div>
          )}

          {/* Resumo dos Tipos de Documentos Processados */}
          {documentList.length > 0 && !isLoading && (
            <div className={styles.summaryCard}>
              <div className={styles.summaryHeader}>Resumo dos Documentos Processados</div>
              <div className={styles.summaryBody}>
                <div className={styles.summaryGrid}>
                  <div className={`${styles.summaryTile} ${styles.summaryTileGreen}`}>
                    <div className={`${styles.summaryTileIcon} ${styles.summaryTileIconGreen}`}>
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className={styles.summaryTileLabel}>NFe</p>
                      <p className={styles.summaryTileValue}>
                        {documentList.filter(doc => doc.tipoDocumento === 'NFe').length}
                      </p>
                    </div>
                  </div>

                  <div className={`${styles.summaryTile} ${styles.summaryTileBlue}`}>
                    <div className={`${styles.summaryTileIcon} ${styles.summaryTileIconBlue}`}>
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className={styles.summaryTileLabel}>NFCe</p>
                      <p className={styles.summaryTileValue}>
                        {documentList.filter(doc => doc.tipoDocumento === 'NFCe').length}
                      </p>
                    </div>
                  </div>

                  <div className={`${styles.summaryTile} ${styles.summaryTilePurple}`}>
                    <div className={`${styles.summaryTileIcon} ${styles.summaryTileIconPurple}`}>
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className={styles.summaryTileLabel}>NFSe</p>
                      <p className={styles.summaryTileValue}>
                        {documentList.filter(doc => doc.tipoDocumento === 'NFSe').length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.summaryFooter}>
                  <span className={styles.summaryTileLabel}>Total de documentos processados:</span> {documentList.length}
                </div>
              </div>
            </div>
          )}

          {/* Card de Resumo por NCM */}
          {ncmResumeList.length > 0 && !isLoading && (
            <div className={styles.summaryCard}>
              <div className={`${styles.summaryHeader} ${styles.summaryHeaderRow}`}>
                <h3>Resumo por NCM</h3>

                {availableNcms.length > 0 && (
                  <div className={styles.selectWrapper}>
                    <label htmlFor="ncm-filter" className="srOnly">Filtrar por NCM</label>
                    <select
                      id="ncm-filter"
                      value={selectedNcm}
                      onChange={handleNcmFilterChange}
                      className={styles.filterSelect}
                      disabled={isLoading}
                    >
                      <option value="">Todos os NCMs</option>
                      {availableNcms.map((ncm) => (
                        <option key={ncm} value={ncm}>
                          {ncm}
                        </option>
                      ))}
                    </select>
                    <div className={styles.selectArrow}>
                      <svg className={styles.selectorButtonIcon} viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 6.757 7.586 5.343 9z" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.tableHeadGradient}>
                      <th className={styles.tableHeadCell}>NCM</th>
                      <th className={styles.tableHeadCell}>Quantidade Vendida</th>
                      <th className={styles.tableHeadCell}>Valor Total (R$)</th>
                      <th className={styles.tableHeadCell}>ICMS (R$)</th>
                      <th className={styles.tableHeadCell}>ICMS (%)</th>
                      <th className={styles.tableHeadCell}>PIS (R$)</th>
                      <th className={styles.tableHeadCell}>PIS (%)</th>
                      <th className={styles.tableHeadCell}>COFINS (R$)</th>
                      <th className={styles.tableHeadCell}>COFINS (%)</th>
                    </tr>
                  </thead>
                  <tbody className={styles.tableBody}>
                    {filteredNcmResumeList.map((item, idx) => (
                      <tr key={idx} className={styles.tableRow}>
                        <td className={styles.tableCell}>{item.ncm}</td>
                        <td className={styles.tableCell}>{formatNumber(item.totalQuantidade)}</td>
                        <td className={styles.tableCell}>{formatNumber(item.totalValor)}</td>
                        <td className={styles.tableCell}>{formatNumber(item.totalIcms)}</td>
                        <td className={styles.tableCell}>{item.icmsPercentage}%</td>
                        <td className={styles.tableCell}>{formatNumber(item.totalPis)}</td>
                        <td className={styles.tableCell}>{item.pisPercentage}%</td>
                        <td className={styles.tableCell}>{formatNumber(item.totalCofins)}</td>
                        <td className={styles.tableCell}>{item.cofinsPercentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Card de Faturamento Mensal (GRÁFICO DE BARRAS APRIMORADO) */}
          {monthlyRevenueList.length > 0 && !isLoading && (
            <div className={styles.summaryCard}>
              <div className={`${styles.summaryHeader} ${styles.summaryHeaderRow}`}>
                <h3>Faturamento Mensal</h3>

                {availableMonthYears.length > 0 && (
                  <div className={styles.selectWrapper}>
                    <label htmlFor="month-year-filter" className="srOnly">Filtrar por Mês/Ano</label>
                    <select
                      id="month-year-filter"
                      value={selectedMonthYear}
                      onChange={handleMonthYearFilterChange}
                      className={styles.filterSelect}
                      disabled={isLoading}
                    >
                      <option value="">Todos os Meses</option>
                      {availableMonthYears.map((my) => (
                        <option key={my} value={my}>
                          {my}
                        </option>
                      ))}
                    </select>
                    <div className={styles.selectArrow}>
                      <svg className={styles.selectorButtonIcon} viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 6.757 7.586 5.343 9z" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
              <div className={styles.chartSection}>
                {filteredMonthlyRevenueList.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={filteredMonthlyRevenueList}
                      margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                      barCategoryGap="20%"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
                      <XAxis
                        dataKey="monthYear"
                        tickLine={false}
                        axisLine={{ stroke: '#cbd5e1' }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tickFormatter={(value) => `R$ ${formatNumber(value)}`}
                        tickLine={false}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                        width={80}
                      />
                      <Tooltip cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} content={<CustomTooltip />} />
                      <Legend
                        verticalAlign="top"
                        height={36}
                        iconType="rect"
                        wrapperStyle={{ paddingTop: '10px' }}
                      />
                      <Bar
                        dataKey="totalRevenue"
                        name="Faturamento (R$)"
                        fill="url(#colorRevenue)"
                        barSize={40}
                      />
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0.5} />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className={styles.emptyChartMessage}>
                    Nenhum dado de faturamento disponível para o período selecionado.
                  </div>
                )}
              </div>
            </div>
          )}



          {/* Tabela de Resultados (Dados Processados) */}
          {documentList.length > 0 && !isLoading && (
            <div className={styles.summaryCard}>
              <div className={`${styles.summaryHeader} ${styles.summaryHeaderRow}`}>
                <h3>Dados Processados {analisandoNcms && <span className={styles.tableMuted}>• Analisando NCMs...</span>}</h3>
                <button
                  onClick={handleExportExcel}
                  className={styles.exportButton}
                  disabled={isLoading}
                >
                  <svg className={styles.selectorButtonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Baixar em Excel
                </button>
              </div>

              <div className={`${styles.tableScroll}`}>
                <table className={styles.table}>
                  <thead>
                    <tr className={`${styles.tableHeadGradient} ${styles.stickyHead}`}>
                      <th className={styles.tableHeadCell}>Tipo</th>
                      <th className={styles.tableHeadCell}>Número</th>
                      <th className={styles.tableHeadCell}>CNPJ/CPF Emitente</th>
                      <th className={styles.tableHeadCell}>Nome Emitente</th>
                      <th className={styles.tableHeadCell}>Data Emissão</th>
                      <th className={styles.tableHeadCell}>CNPJ/CPF Destinatário</th>
                      <th className={styles.tableHeadCell}>Nome Destinatário</th>
                      <th className={styles.tableHeadCell}>Produto/Serviço</th>
                      <th className={styles.tableHeadCell}>NCM/Código</th>
                      <th className={styles.tableHeadCell}>CFOP</th>
                      <th className={styles.tableHeadCell}>CST</th>
                      <th className={styles.tableHeadCell}>Quantidade</th>
                      <th className={styles.tableHeadCell}>Valor Unitário</th>
                      <th className={styles.tableHeadCell}>PIS</th>
                      <th className={styles.tableHeadCell}>COFINS</th>
                      <th className={styles.tableHeadCell}>ICMS</th>
                      <th className={styles.tableHeadCell}>CST PIS</th>
                      <th className={styles.tableHeadCell}>CST COFINS</th>
                      <th className={styles.tableHeadCell}>ST Status</th>
                      <th className={styles.tableHeadCell}>MVA ST</th>
                      <th className={styles.tableHeadCell}>Alíq. ST</th>
                      <th className={styles.tableHeadCell}>CEST</th>
                    </tr>
                  </thead>
                  <tbody className={styles.tableBody}>
                    {documentList.map((docData, idx) => (
                      <tr key={idx} className={styles.tableRow}>
                        <td className={styles.tableCell}>
                          <span
                            className={`${styles.tableBadge} ${
                              docData.tipoDocumento === 'NFe'
                                ? styles.badgeNfe
                                : docData.tipoDocumento === 'NFCe'
                                ? styles.badgeNfce
                                : styles.badgeNfse
                            }`}
                          >
                            {docData.tipoDocumento}
                          </span>
                        </td>
                        <td className={styles.tableCell}>{docData.numero}</td>
                        <td className={styles.tableCell}>{docData.cnpjEmitente}</td>
                        <td className={styles.tableCell}>{docData.nomeEmitente}</td>
                        <td className={styles.tableCell}>{docData.dataEmissao}</td>
                        <td className={styles.tableCell}>{docData.cnpjDestinatario}</td>
                        <td className={styles.tableCell}>{docData.nomeDestinatario}</td>
                        <td className={styles.tableCell}>{docData.produto}</td>
                        <td className={styles.tableCell}>{docData.ncm}</td>
                        <td className={styles.tableCell}>{docData.cfop}</td>
                        <td className={styles.tableCell}>{docData.cst}</td>
                        <td className={styles.tableCell}>{docData.quantidade}</td>
                        <td className={styles.tableCell}>{docData.valorUnitario}</td>
                        <td className={styles.tableCell}>{docData.pis}</td>
                        <td className={styles.tableCell}>{docData.cofins}</td>
                        <td className={styles.tableCell}>{docData.icms}</td>
                        <td className={styles.tableCell}>{docData.cstPis}</td>
                        <td className={styles.tableCell}>{docData.cstCofins}</td>
                        <td className={styles.tableCell}>
                          {(() => {
                            const dadosST = obterDadosST(docData.ncm);
                            if (!dadosST) return <span className={styles.tableMuted}>Não analisado</span>;
                            return <span className={styles.tableMuted}>{dadosST.status}</span>;
                          })()}
                        </td>
                        <td className={styles.tableCell}>
                          {(() => {
                            const dadosST = obterDadosST(docData.ncm);
                            if (!dadosST) return <span className={styles.tableMuted}>-</span>;
                            return dadosST.mva !== 'N/A' ? `${dadosST.mva}%` : <span className={styles.tableMuted}>N/A</span>;
                          })()}
                        </td>
                        <td className={styles.tableCell}>
                          {(() => {
                            const dadosST = obterDadosST(docData.ncm);
                            if (!dadosST) return <span className={styles.tableMuted}>-</span>;
                            return dadosST.aliquota !== 'N/A' ? `${dadosST.aliquota}%` : <span className={styles.tableMuted}>N/A</span>;
                          })()}
                        </td>
                        <td className={styles.tableCell}>
                          {(() => {
                            const dadosST = obterDadosST(docData.ncm);
                            if (!dadosST) return <span className={styles.tableMuted}>-</span>;
                            return dadosST.cest !== 'N/A' ? dadosST.cest : <span className={styles.tableMuted}>N/A</span>;
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.tableFooter}>Powered by Contabhub Technology</div>
            </div>
          )}

          {/* Seção de Resultados da Análise de NCMs */}
          {resultadosNcms && (
            <div className={styles.summaryCard}>
              <div className={`${styles.summaryHeader} ${styles.summaryHeaderRow}`}>
                <h3>Resultados da Análise de NCMs</h3>
              </div>

              <div className={styles.summaryBody}>
                <div className={styles.summaryGrid}>
                  <div className={`${styles.summaryTile} ${styles.summaryTileBlue}`}>
                    <div className={`${styles.summaryTileIcon} ${styles.summaryTileIconBlue}`}>
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className={styles.summaryTileLabel}>Total de NCMs</p>
                      <p className={styles.summaryTileValue}>{resultadosNcms.estatisticas.total}</p>
                    </div>
                  </div>

                  <div className={`${styles.summaryTile} ${styles.summaryTileGreen}`}>
                    <div className={`${styles.summaryTileIcon} ${styles.summaryTileIconGreen}`}>
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className={styles.summaryTileLabel}>Encontrados</p>
                      <p className={styles.summaryTileValue}>{resultadosNcms.estatisticas.encontrados}</p>
                    </div>
                  </div>

                  <div className={`${styles.summaryTile} ${styles.summaryTilePurple}`}>
                    <div className={`${styles.summaryTileIcon} ${styles.summaryTileIconPurple}`}>
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className={styles.summaryTileLabel}>Não Encontrados</p>
                      <p className={styles.summaryTileValue}>{resultadosNcms.estatisticas.naoEncontrados}</p>
                    </div>
                  </div>

                  <div className={`${styles.summaryTile} ${styles.summaryTileGreen}`}>
                    <div className={`${styles.summaryTileIcon} ${styles.summaryTileIconGreen}`}>
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className={styles.summaryTileLabel}>Do Cache</p>
                      <p className={styles.summaryTileValue}>{resultadosNcms.estatisticas.doCache}</p>
                    </div>
                  </div>

                  <div className={`${styles.summaryTile} ${styles.summaryTilePurple}`}>
                    <div className={`${styles.summaryTileIcon} ${styles.summaryTileIconPurple}`}>
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className={styles.summaryTileLabel}>Da API</p>
                      <p className={styles.summaryTileValue}>{resultadosNcms.estatisticas.daAPI}</p>
                    </div>
                  </div>
                </div>

                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <thead>
                      <tr className={styles.tableHeadGradient}>
                        <th className={styles.tableHeadCell}>NCM</th>
                        <th className={styles.tableHeadCell}>Status</th>
                        <th className={styles.tableHeadCell}>Origem</th>
                        <th className={styles.tableHeadCell}>Última Atualização</th>
                        <th className={styles.tableHeadCell}>Registros</th>
                      </tr>
                    </thead>
                    <tbody className={styles.tableBody}>
                      {resultadosNcms.ncmsProcessados.map((ncm, idx) => (
                        <tr key={idx} className={styles.tableRow}>
                          <td className={styles.tableCell}>{ncm.ncm}</td>
                          <td className={styles.tableCell}>
                            <span className={`${styles.tableBadge} ${ncm.encontrado ? styles.badgeFound : styles.badgeNotFound}`}>
                              {ncm.encontrado ? 'Encontrado' : 'Não Encontrado'}
                            </span>
                          </td>
                          <td className={styles.tableCell}>
                            <span className={`${styles.tableBadge} ${
                              ncm.origem === 'cache'
                                ? styles.badgeCache
                                : ncm.origem === 'api'
                                ? styles.badgeApi
                                : styles.badgeNeutral
                            }`}>
                              {ncm.origem === 'cache' ? 'Cache' : ncm.origem === 'api' ? 'API' : 'N/A'}
                            </span>
                          </td>
                          <td className={styles.tableCell}>
                            {ncm.ultima_atualizacao ? new Date(ncm.ultima_atualizacao).toLocaleString('pt-BR') : 'N/A'}
                          </td>
                          <td className={styles.tableCell}>{ncm.dados?.registros || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Erro na Análise de NCMs */}
          {erroNcms && (
            <div className={styles.warningCard}>
              <div className={styles.warningHeader}>
                <h3 className={styles.warningTitle}>
                  <svg className={styles.selectorButtonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Erro na Análise de NCMs
                </h3>
              </div>
              <div className={styles.warningBody}>
                <p className={styles.warningHighlight}>{erroNcms}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}