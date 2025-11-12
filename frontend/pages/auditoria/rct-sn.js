import { useState, useCallback, useEffect } from 'react';
import {
  Upload,
  X,
} from 'lucide-react';
import { useRouter } from 'next/router';
import { useDropzone } from 'react-dropzone';
import { toast, ToastContainer, Bounce } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ensurePdfjsLib, extractDasValueFromPdf, extractFolhaSalariosFromPdf, extractDataPagamentoFromPdf, extractFolhasAnterioresFromPdf } from '../../services/auditoria/pdf-extractor';
import styles from '../../styles/auditoria/rct-sn.module.css';
import PrincipalSidebar from '../../components/onety/principal/PrincipalSidebar';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

const resolveSelectedCompanyId = () => {
  if (typeof window === 'undefined') return null;

  const storedCompanyId = localStorage.getItem('selected_company_id');
  if (storedCompanyId) {
    return storedCompanyId;
  }

  const rawUserData = localStorage.getItem('userData');
  if (!rawUserData) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawUserData);
    const fallbackId =
      parsed?.EmpresaId ??
      parsed?.empresaId ??
      parsed?.empresa_id ??
      parsed?.companyId ??
      parsed?.company_id ??
      null;

    if (fallbackId) {
      const normalized = String(fallbackId);
      localStorage.setItem('selected_company_id', normalized);
      return normalized;
    }
  } catch (error) {
    console.error('Erro ao interpretar userData para obter empresaId:', error);
  }

  return null;
};

export default function RctSn() {
  const [loading, setLoading] = useState(false);
  const [analyses, setAnalyses] = useState([]);
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();
  // Removido: setSelectedCompany(null) para evitar redirecionamento para /companies

  const extractCnpjFromPdf = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await ensurePdfjsLib();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .filter((item) => 'str' in item && typeof item.str === 'string')
          .map((item) => item.str)
          .join(' ');
        fullText += pageText + ' ';
      }
  
      // Normalizar texto: remover acentos e deixar maiúsculo
      const normalizedText = fullText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
      // Buscar CNPJ Estabelecimento no formato correto no texto normalizado
      const cnpjEstabMatch = normalizedText.match(/CNPJ\s*ESTABELECIMENTO:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
      if (cnpjEstabMatch && cnpjEstabMatch[1]) {
        return cnpjEstabMatch[1].replace(/\D/g, '');
      }
      // Se não encontrar, retorna string especial para exibir análise normalmente
      return 'NAO_IDENTIFICADO';
    } catch (error) {
      console.error('Error extracting CNPJ from PDF:', error);
      return null;
    }
  };

  const extractFatorRFromPdf = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await ensurePdfjsLib();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = '';
      
      // Verificar todas as páginas para informação do Fator R
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .filter((item) => 'str' in item && typeof item.str === 'string')
          .map((item) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }

      // Normalizar o texto
      fullText = fullText.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      fullText = fullText.replace(/\s+/g, ' ').toUpperCase();

      // Padrões mais abrangentes para Fator R no PGDAS
      const fatorRPatterns = [
        /FATOR\s*R\s*[:=]?\s*(NAO\s*SE\s*APLICA|NAO|SIM)/i,
        /FATOR\s*R\s*[:=]?\s*(\d{1},\d{2})/i,
        /FATOR\s*R\s*[:=]?\s*(\d+\.\d+)/i,
        /FATOR\s*R\s*[:=]?\s*(\d+,\d+)/i,
        /FATOR\s*R\s*[:=]?\s*(\d+)/i,
        /FATOR\s*R\s*[:=]?\s*(SIM|NAO)/i,
        /FATOR\s*R\s*[:=]?\s*(SE\s*APLICA|NAO\s*SE\s*APLICA)/i
      ];

      for (const pattern of fatorRPatterns) {
        const match = fullText.match(pattern);
        if (match && match[1]) {
          const value = match[1].trim();
          
          // Se for um número, formatar como percentual
          if (/^\d+[,.]?\d*$/.test(value)) {
            const numericValue = parseFloat(value.replace(',', '.'));
            if (!isNaN(numericValue)) {
              return `${numericValue.toFixed(2).replace('.', ',')}%`;
            }
          }
          
          // Se for texto, retornar normalizado
          return value.replace(/\s+/g, ' ');
        }
      }

      return 'Não identificado';
    } catch (error) {
      console.error('Error extracting Fator R from PDF:', error);
      return 'Erro na extração';
    }
  };

  const extractTaxDataFromPdf = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await ensurePdfjsLib();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      
      // Extrair texto de todas as páginas
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .filter((item) => 'str' in item && typeof item.str === 'string')
          .map((item) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }

      // Normalizar o texto (remover acentos e padronizar)
      fullText = fullText.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      fullText = fullText.replace(/\s+/g, ' ').toUpperCase();

      // Primeiro tenta pegar o valor do PA (RPA)
      let receitaValor = 0;
      const receitaPaMatch = fullText.match(/RECEITA\s+BRUTA\s+DO\s+PA\s+\(RPA\)[^\d]*([\d\.]+,[\d]{2})/i);
      if (receitaPaMatch && receitaPaMatch[1]) {
        receitaValor = parseFloat(receitaPaMatch[1].replace(/\./g, '').replace(',', '.'));
      } else {
        // Se não achar, tenta o antigo
        const receitaMatch = fullText.match(/RECEITA\s+BRUTA\s+INFORMADA[:\s]+R?\$?\s*([\d.]+,[\d]{2})/i);
        if (receitaMatch && receitaMatch[1]) {
          receitaValor = parseFloat(receitaMatch[1].replace(/\./g, '').replace(',', '.'));
        }
      }

      const taxData = {
        receita_total: receitaValor,
        icms_total: 0,
        pis_total: 0,
        cofins_total: 0,
      };

      // Extração dos tributos com base na linha em bloco
      const linhaTributosMatch = fullText.match(/IRPJ CSLL COFINS PIS\/PASEP INSS\/CPP ICMS IPI ISS TOTAL ([\d,\.\s]+)/);

      if (linhaTributosMatch) {
        const valores = linhaTributosMatch[1].trim().split(/\s+/);
        const nomesTributos = ['IRPJ', 'CSLL', 'COFINS', 'PISPASEP', 'INSSCPP', 'ICMS', 'IPI', 'ISS'];
        
        // Mapear os valores extraídos
        const tributos = {};
        nomesTributos.forEach((nome, idx) => {
          if (valores[idx]) {
            tributos[nome] = parseFloat(valores[idx].replace(/\./g, '').replace(',', '.')) || 0;
          }
        });

        // Atribuir os valores corretos
        taxData.icms_total = tributos['ICMS'] || 0;
        taxData.pis_total = tributos['PISPASEP'] || 0;
        taxData.cofins_total = tributos['COFINS'] || 0;
      }

      return taxData;
    } catch (error) {
      console.error('Error extracting tax data from PDF:', error);
      return null;
    }
  };

  const extractCompanyNameFromPdf = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await ensurePdfjsLib();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      
      // Extrair texto de todas as páginas
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .filter((item) => 'str' in item && typeof item.str === 'string')
          .map((item) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }

      // Normalizar o texto
      fullText = fullText.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      fullText = fullText.replace(/\s+/g, ' ').toUpperCase();

      // Padrões para nome da empresa no PGDAS
      const nomePatterns = [
        /NOME\s+EMPRESARIAL[:\s]+([A-Z0-9\s\.\-]+?)\s+DATA\s+DE\s+ABERTURA/,
        /NOME\s+EMPRESARIAL[:\s]+([A-Z0-9\s\.\-]+?)\s+CNPJ/,
        /NOME\s+EMPRESARIAL[:\s]+([A-Z0-9\s\.\-]+?)\s+UF/,
        /RAZAO\s+SOCIAL[:\s]+([A-Z0-9\s\.\-]+?)\s+CNPJ/,
        /RAZAO\s+SOCIAL[:\s]+([A-Z0-9\s\.\-]+?)\s+DATA/,
        /NOME\s+FANTASIA[:\s]+([A-Z0-9\s\.\-]+?)\s+CNPJ/,
        /NOME\s+FANTASIA[:\s]+([A-Z0-9\s\.\-]+?)\s+DATA/
      ];

      for (const pattern of nomePatterns) {
        const match = fullText.match(pattern);
        if (match && match[1]) {
          const nome = match[1].trim();
          if (nome.length > 3) { // Evitar nomes muito curtos
            return nome;
          }
        }
      }

      return 'Não encontrado';
    } catch (error) {
      console.error('Error extracting company name from PDF:', error);
      return 'Erro na extração';
    }
  };

  const extractUfFromPdf = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await ensurePdfjsLib();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
        const textContent = await page.getTextContent();
        const text = textContent.items
          .filter((item) => item && typeof item === 'object' && 'str' in item && typeof item.str === 'string')
        .map((item) => item.str)
        .join(' ');

      // Normalizar o texto
      const fullText = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const normalizedText = fullText.replace(/\s+/g, ' ').toUpperCase();

      // Buscar UF
      const ufMatch = normalizedText.match(/UF[:\s]+([A-Z]{2})/);
      if (ufMatch && ufMatch[1]) {
        return ufMatch[1];
      }
      return 'N/A';
    } catch (error) {
      console.error('Error extracting UF from PDF:', error);
      return 'N/A';
    }
  };

  const extractPeriodFromPdf = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await ensurePdfjsLib();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      
      // Extrair texto de todas as páginas
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .filter((item) => 'str' in item && typeof item.str === 'string')
          .map((item) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }

      // Normalizar o texto
      fullText = fullText.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      fullText = fullText.replace(/\s+/g, ' ').toUpperCase();

      // Padrões para período de apuração no PGDAS
      const periodPatterns = [
        /PERIODO\s+DE\s+APURACAO\s*\(PA\)[:\s]+(\d{2}\/\d{4})/i,
        /PERIODO\s+DE\s+APURACAO[:\s]+(\d{2}\/\d{4})/i,
        /PERIODO\s+APURACAO[:\s]+(\d{2}\/\d{4})/i,
        /PA[:\s]+(\d{2}\/\d{4})/i,
        /COMPETENCIA[:\s]+(\d{2}\/\d{4})/i,
        /MES\/ANO[:\s]+(\d{2}\/\d{4})/i,
        /APURACAO[:\s]+(\d{2}\/\d{4})/i,
        /PERIODO[:\s]+(\d{2}\/\d{4})/i
      ];

      for (const pattern of periodPatterns) {
        const match = fullText.match(pattern);
        if (match && match[1]) {
          const periodo = match[1].trim();
          // Validar formato MM/AAAA
          if (/^\d{2}\/\d{4}$/.test(periodo)) {
            const [mes, ano] = periodo.split('/');
            const mesNum = parseInt(mes, 10);
            const anoNum = parseInt(ano, 10);
            
            if (mesNum >= 1 && mesNum <= 12 && anoNum >= 2000 && anoNum <= 2030) {
              return periodo;
            }
          }
        }
      }

      return 'Não identificado';
    } catch (error) {
      console.error('Error extracting period from PDF:', error);
      return 'Erro na extração';
    }
  };

  const extractActivityFromPdf = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await ensurePdfjsLib();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      
      // Extrair texto de todas as páginas
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .filter((item) => 'str' in item && typeof item.str === 'string')
          .map((item) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }

      // Normalizar o texto
      fullText = fullText.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      fullText = fullText.replace(/\s+/g, ' ').toUpperCase();

      console.log('Texto completo do PDF para análise de atividade:', fullText);

      // Padrões para atividade principal no PGDAS - incluindo seção de débito por tributo
      const activityPatterns = [
        // Seção específica de débito por tributo - NOVOS PADRÕES baseados no PDF fornecido
        /VALOR\s+DO\s+DEBITO\s+POR\s+TRIBUTO\s+PARA\s+A\s+ATIVIDADE[:\s]+([A-Z0-9\s\.\-]+?)(?:,|\s+EXCETO|\s+PARA)/,
        /DEBITO\s+POR\s+TRIBUTO\s+PARA\s+A\s+ATIVIDADE[:\s]+([A-Z0-9\s\.\-]+?)(?:,|\s+EXCETO|\s+PARA)/,
        /TRIBUTO\s+PARA\s+A\s+ATIVIDADE[:\s]+([A-Z0-9\s\.\-]+?)(?:,|\s+EXCETO|\s+PARA)/,
        /ATIVIDADE[:\s]+([A-Z0-9\s\.\-]+?)(?:,|\s+EXCETO|\s+PARA)/,
        
        // Padrões específicos para "Revenda de mercadorias"
        /REVENDA\s+DE\s+MERCADORIAS[^,]*/,
        /REVENDA\s+DE\s+MERCADORIAS,\s+EXCETO\s+PARA\s+O\s+EXTERIOR/,
        /REVENDA\s+DE\s+MERCADORIAS\s+EXCETO\s+PARA\s+O\s+EXTERIOR/,
        /REVENDA\s+DE\s+MERCADORIAS,\s+EXCETO\s+PARA\s+O\s+EXTERIOR\s+-\s+SEM\s+SUBSTITUICAO\s+TRIBUTARIA/,
        /REVENDA\s+DE\s+MERCADORIAS,\s+EXCETO\s+PARA\s+O\s+EXTERIOR\s+-\s+SEM\s+SUBSTITUICAO\s+TRIBUTARIA\/TRIBUTACAO\s+MONOFASICA/,
        
        // Padrões específicos para "Venda de mercadorias"
        /VENDA\s+DE\s+MERCADORIAS[^,]*/,
        /VENDA\s+DE\s+MERCADORIAS,\s+EXCETO\s+PARA\s+O\s+EXTERIOR/,
        /VENDA\s+DE\s+MERCADORIAS\s+EXCETO\s+PARA\s+O\s+EXTERIOR/,
        /VENDA\s+DE\s+MERCADORIAS,\s+EXCETO\s+PARA\s+O\s+EXTERIOR\s+-\s+SEM\s+SUBSTITUICAO\s+TRIBUTARIA/,
        /VENDA\s+DE\s+MERCADORIAS,\s+EXCETO\s+PARA\s+O\s+EXTERIOR\s+-\s+SEM\s+SUBSTITUICAO\s+TRIBUTARIA\/TRIBUTACAO\s+MONOFASICA/,
        
        // Padrões tradicionais
        /ATIVIDADE\s+PRINCIPAL[:\s]+([A-Z0-9\s\.\-]+?)\s+CNAE/,
        /ATIVIDADE\s+PRINCIPAL[:\s]+([A-Z0-9\s\.\-]+?)\s+FATOR/,
        /ATIVIDADE\s+PRINCIPAL[:\s]+([A-Z0-9\s\.\-]+?)\s+RECEITA/,
        /CNAE\s+PRINCIPAL[:\s]+([A-Z0-9\s\.\-]+?)\s+ATIVIDADE/,
        /CNAE\s+PRINCIPAL[:\s]+([A-Z0-9\s\.\-]+?)\s+FATOR/,
        /CNAE\s+PRINCIPAL[:\s]+([A-Z0-9\s\.\-]+?)\s+RECEITA/,
        /ATIVIDADE[:\s]+([A-Z0-9\s\.\-]+?)\s+CNAE/,
        /CNAE[:\s]+([A-Z0-9\s\.\-]+?)\s+ATIVIDADE/,
        /ATIVIDADE\s+ECONOMICA[:\s]+([A-Z0-9\s\.\-]+?)\s+CNAE/,
        /ATIVIDADE\s+ECONOMICA[:\s]+([A-Z0-9\s\.\-]+?)\s+FATOR/,
        
        // Buscar por "Prestação de Serviços" especificamente
        /PRESTACAO\s+DE\s+SERVICOS[^,]*/,
        /PRESTACAO\s+DE\s+SERVICOS\s+EXCETO[^,]*/,
        
        // Buscar por outras atividades comuns
        /COMERCIO[^,]*/,
        /INDUSTRIA[^,]*/,
        /FABRICACAO[^,]*/,
        /VENDA[^,]*/,
        /SERVICOS[^,]*/
      ];

      for (const pattern of activityPatterns) {
        const match = fullText.match(pattern);
        if (match && match[1]) {
          const atividade = match[1].trim();
          if (atividade.length > 5) { // Evitar atividades muito curtas
            // Limpar a atividade removendo partes desnecessárias
            const cleanActivity = atividade
              .replace(/\s+EXCETO.*$/, '') // Remove "exceto para o exterior"
              .replace(/\s+PARA.*$/, '') // Remove "para o exterior"
              .replace(/,\s*$/, '') // Remove vírgulas no final
              .trim();
            
            if (cleanActivity.length > 3) {
              console.log('Atividade encontrada via padrão com grupo:', cleanActivity);
              return cleanActivity;
            }
          }
        } else if (match && match[0]) {
          // Para padrões que não usam grupos de captura
          const atividade = match[0].trim();
          if (atividade.length > 5) {
            const cleanActivity = atividade
              .replace(/\s+EXCETO.*$/, '')
              .replace(/\s+PARA.*$/, '')
              .replace(/,\s*$/, '')
              .trim();
            
            if (cleanActivity.length > 3) {
              console.log('Atividade encontrada via padrão sem grupo:', cleanActivity);
              return cleanActivity;
            }
          }
        }
      }

      // Buscar por CNAE específico
      const cnaeMatch = fullText.match(/CNAE[:\s]*(\d{2}\.\d{2}-\d-\d{2})/);
      if (cnaeMatch && cnaeMatch[1]) {
        console.log('CNAE encontrado:', cnaeMatch[1]);
        return `CNAE ${cnaeMatch[1]}`;
      }

      console.log('Nenhuma atividade identificada no PDF');
      return 'Não identificada';
    } catch (error) {
      console.error('Error extracting activity from PDF:', error);
      return 'Erro na extração';
    }
  };

  // NOVA FUNÇÃO: Extrair anexo do campo 3 do extrato do Simples Nacional
  const extractAnexoFromPdf = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await ensurePdfjsLib();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      
      // Extrair texto de todas as páginas
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .filter((item) => 'str' in item && typeof item.str === 'string')
          .map((item) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }

      // Normalizar o texto
      fullText = fullText.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      fullText = fullText.replace(/\s+/g, ' ').toUpperCase();

      console.log('Texto completo do PDF para análise de anexo:', fullText);

      // Padrões para identificar o anexo no campo 3 do extrato
      const anexoPatterns = [
        // Padrões específicos para campo 3 - Anexo
        /CAMPO\s+3[:\s]*ANEXO\s+([IVX]+)/i,
        /CAMPO\s+3[:\s]*([IVX]+)/i,
        /ANEXO\s+([IVX]+)[:\s]*CAMPO\s+3/i,
        /ANEXO\s+([IVX]+)/i,
        
        // Buscar por "Anexo" seguido de número romano
        /ANEXO\s+([IVX]+)/i,
        /ANEXO\s+([IVX]+)\s+[^A-Z]/i,
        
        // Buscar por seções específicas que mencionam anexos
        /TABELA\s+DO\s+ANEXO\s+([IVX]+)/i,
        /TABELA\s+ANEXO\s+([IVX]+)/i,
        /ANEXO\s+([IVX]+)\s+TABELA/i,
        
        // Buscar por padrões de alíquotas específicas de cada anexo
        /ALIQUOTA\s+4[.,]5[%]?\s+ANEXO\s+([IVX]+)/i, // Anexo I
        /ALIQUOTA\s+6[.,]0[%]?\s+ANEXO\s+([IVX]+)/i, // Anexo II
        /ALIQUOTA\s+9[.,]0[%]?\s+ANEXO\s+([IVX]+)/i, // Anexo III
        /ALIQUOTA\s+12[.,]0[%]?\s+ANEXO\s+([IVX]+)/i, // Anexo IV
        /ALIQUOTA\s+15[.,]0[%]?\s+ANEXO\s+([IVX]+)/i, // Anexo V
        /ALIQUOTA\s+30[.,]0[%]?\s+ANEXO\s+([IVX]+)/i, // Anexo VI
      ];

      for (const pattern of anexoPatterns) {
        const match = fullText.match(pattern);
        if (match && match[1]) {
          const anexo = match[1].trim().toUpperCase();
          // Validar se é um número romano válido para anexo (I, II, III, IV, V, VI)
          if (/^[IVX]+$/.test(anexo) && ['I', 'II', 'III', 'IV', 'V', 'VI'].includes(anexo)) {
            console.log('Anexo encontrado via padrão:', `Anexo ${anexo}`);
            return `Anexo ${anexo}`;
          }
        }
      }

      // Buscar por padrões de texto que indiquem o anexo baseado no conteúdo
      if (fullText.includes('COMERCIO') && fullText.includes('ANEXO')) {
        console.log('Anexo identificado via comércio');
        return 'Anexo I'; // Comércio
      }
      if (fullText.includes('INDUSTRIA') && fullText.includes('ANEXO')) {
        console.log('Anexo identificado via indústria');
        return 'Anexo II'; // Indústria
      }
      if (fullText.includes('PRESTACAO DE SERVICOS') && fullText.includes('ANEXO')) {
        console.log('Anexo identificado via prestação de serviços');
        return 'Anexo III'; // Prestação de Serviços
      }
      if (fullText.includes('SERVICOS') && fullText.includes('ANEXO')) {
        console.log('Anexo identificado via serviços');
        return 'Anexo III'; // Serviços
      }

      // Buscar por alíquotas específicas para inferir o anexo
      if (fullText.includes('4,5%') || fullText.includes('4.5%')) {
        console.log('Anexo identificado via alíquota 4,5%');
        return 'Anexo I';
      }
      if (fullText.includes('6,0%') || fullText.includes('6.0%')) {
        console.log('Anexo identificado via alíquota 6,0%');
        return 'Anexo II';
      }
      if (fullText.includes('9,0%') || fullText.includes('9.0%')) {
        console.log('Anexo identificado via alíquota 9,0%');
        return 'Anexo III';
      }
      if (fullText.includes('12,0%') || fullText.includes('12.0%')) {
        console.log('Anexo identificado via alíquota 12,0%');
        return 'Anexo IV';
      }
      if (fullText.includes('15,0%') || fullText.includes('15.0%')) {
        console.log('Anexo identificado via alíquota 15,0%');
        return 'Anexo V';
      }
      if (fullText.includes('30,0%') || fullText.includes('30.0%')) {
        console.log('Anexo identificado via alíquota 30,0%');
        return 'Anexo VI';
      }

      // NOVOS PADRÕES baseados no PDF fornecido
      // Buscar por "Revenda de mercadorias" que indica Anexo I
      if (fullText.includes('REVENDA DE MERCADORIAS') || fullText.includes('REVENDA DE MERCADORIAS, EXCETO PARA O EXTERIOR')) {
        console.log('Anexo identificado via revenda de mercadorias');
        return 'Anexo I';
      }

      // Buscar por "Venda de mercadorias" que também indica Anexo I
      if (fullText.includes('VENDA DE MERCADORIAS') || fullText.includes('VENDA DE MERCADORIAS, EXCETO PARA O EXTERIOR')) {
        console.log('Anexo identificado via venda de mercadorias');
        return 'Anexo I';
      }

      // Buscar por padrões de atividade específica
      if (fullText.includes('REVENDA') && fullText.includes('MERCADORIAS')) {
        console.log('Anexo identificado via revenda de mercadorias (padrão alternativo)');
        return 'Anexo I';
      }

      // Buscar por padrões de atividade específica para "Venda"
      if (fullText.includes('VENDA') && fullText.includes('MERCADORIAS')) {
        console.log('Anexo identificado via venda de mercadorias (padrão alternativo)');
        return 'Anexo I';
      }

      // Buscar por valores de impostos específicos que podem indicar o anexo
      // Anexo I tem alíquotas menores para ICMS
      if (fullText.includes('ICMS') && fullText.includes('92,56')) {
        console.log('Anexo identificado via valor ICMS específico');
        return 'Anexo I';
      }

      // Buscar por padrões de texto que mencionam "Sem substituição tributária"
      if (fullText.includes('SEM SUBSTITUICAO TRIBUTARIA') || fullText.includes('SEM SUBSTITUICAO TRIBUTARIA/TRIBUTACAO MONOFASICA')) {
        console.log('Anexo identificado via padrão de tributação');
        return 'Anexo I';
      }

      // Buscar por padrões de "tributação monofásica"
      if (fullText.includes('TRIBUTACAO MONOFASICA') || fullText.includes('ANTECIPACAO COM ENCERRAMENTO DE TRIBUTACAO')) {
        console.log('Anexo identificado via tributação monofásica');
        return 'Anexo I';
      }

      // Buscar por padrões de "encerramento de tributação"
      if (fullText.includes('ENCERRAMENTO DE TRIBUTACAO')) {
        console.log('Anexo identificado via encerramento de tributação');
        return 'Anexo I';
      }

      // Buscar por padrões específicos do PDF fornecido
      // Padrão: "Revenda de mercadorias, exceto para o exterior - Sem substituição tributária/tributação monofásica/antecipação com encerramento de tributação"
      if (fullText.includes('REVENDA DE MERCADORIAS, EXCETO PARA O EXTERIOR - SEM SUBSTITUICAO TRIBUTARIA/TRIBUTACAO MONOFASICA/ANTECIPACAO COM ENCERRAMENTO DE TRIBUTACAO')) {
        console.log('Anexo identificado via padrão completo do PDF (revenda)');
        return 'Anexo I';
      }

      // Padrão: "Venda de mercadorias, exceto para o exterior - Sem substituição tributária/tributação monofásica/antecipação com encerramento de tributação"
      if (fullText.includes('VENDA DE MERCADORIAS, EXCETO PARA O EXTERIOR - SEM SUBSTITUICAO TRIBUTARIA/TRIBUTACAO MONOFASICA/ANTECIPACAO COM ENCERRAMENTO DE TRIBUTACAO')) {
        console.log('Anexo identificado via padrão completo do PDF (venda)');
        return 'Anexo I';
      }

      // Buscar por partes do padrão específico
      if (fullText.includes('REVENDA DE MERCADORIAS, EXCETO PARA O EXTERIOR')) {
        console.log('Anexo identificado via revenda de mercadorias (exceto exterior)');
        return 'Anexo I';
      }

      // Buscar por partes do padrão específico para "Venda"
      if (fullText.includes('VENDA DE MERCADORIAS, EXCETO PARA O EXTERIOR')) {
        console.log('Anexo identificado via venda de mercadorias (exceto exterior)');
        return 'Anexo I';
      }

      // Buscar por padrões de redução de ICMS que indicam Anexo I
      if (fullText.includes('REDUCAO DE ICMS') && fullText.includes('48,52%')) {
        console.log('Anexo identificado via redução de ICMS específica');
        return 'Anexo I';
      }

      // Buscar por padrões de "substituto tributário" que indicam Anexo I
      if (fullText.includes('SUBSTITUTO TRIBUTARIO DO ICMS')) {
        console.log('Anexo identificado via substituto tributário');
        return 'Anexo I';
      }

      console.log('Nenhum padrão de anexo encontrado no PDF');
      return 'Não identificado';
    } catch (error) {
      console.error('Error extracting anexo from PDF:', error);
      return 'Erro na extração';
    }
  };

  const fetchBrasilApi = async (cnpj) => {
    try {
      const cleanCnpj = cnpj.replace(/[^\d]/g, '');
      const response = await fetch(
        `https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch company data');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching from BrasilAPI:', error);
      throw error;
    }
  };

  // Função para buscar dados na Legisweb
  const fetchLegiswebApi = async (cnpj) => {
    try {
      const token = process.env.NEXT_PUBLIC_LEGISWEB_TOKEN;
      const userId = process.env.NEXT_PUBLIC_LEGISWEB_USER_ID;
      const cleanCnpj = cnpj.replace(/[^\d]/g, ''); // Remove caracteres especiais
      const url = `https://www.legisweb.com.br/api/empresas/?c=${userId}&t=${token}&empresa=${cleanCnpj}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Erro na consulta Legisweb');
      const data = await response.json();
      if (data.resposta && data.resposta.length > 0) {
        return data.resposta[0];
      }
      throw new Error('Empresa não encontrada na Legisweb');
    } catch (error) {
      console.error('Erro ao buscar na Legisweb:', error);
      return null;
    }
  };


  // Função para deletar análise
  const deleteAnalysis = async (id) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) {
        toast.error('Token de autenticação não encontrado. Faça login novamente.', {
          autoClose: 4000,
        });
        return;
      }

      const response = await fetch(`${API_BASE}/auditoria/simples-nacional/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || 'Erro ao excluir análise');
      }

      toast.success('Análise excluída com sucesso!', {
        autoClose: 4000,
      });
      loadAnalyses();
    } catch (error) {
      console.error('Erro ao excluir análise:', error);
      toast.error('Erro ao excluir análise. Tente novamente.', {
        autoClose: 4000,
      });
    }
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    const selectedCompanyId = resolveSelectedCompanyId();
    if (!selectedCompanyId) {
      toast.error('Nenhuma empresa selecionada. Selecione uma empresa antes de fazer upload.', {
        autoClose: 5000,
      });
      return;
    }
    const file = acceptedFiles[0];
    // Checagem: Arquivo já existe para esta empresa?
    const alreadyExists = analyses.some((a) => a.arquivo_nome === file.name && String(a.company_id) === String(selectedCompanyId));
    if (alreadyExists) {
      toast.error('Já existe uma análise com este nome de arquivo para esta empresa. Renomeie o arquivo antes de enviar.', {
        autoClose: 5000,
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Toast informativo durante o processamento
    toast.info('Processando arquivo PDF...', {
      autoClose: 2000,
    });

    const saveAnalysis = async (
      cnpj,
      apiData,
      fatorR,
      taxData,
      periodoDocumento,
      file
    ) => {
      try {
        // Calcular percentuais se houver dados fiscais
        let icmsPercentage = undefined;
        let pisCofinsPercentage = undefined;

        if (taxData && taxData.receita_total > 0) {
          icmsPercentage = (taxData.icms_total / taxData.receita_total) * 100;
          pisCofinsPercentage =
            ((taxData.pis_total + taxData.cofins_total) / taxData.receita_total) *
            100;
        }

        // Extrair dados adicionais do PDF
        const valorFolha = await extractFolhaSalariosFromPdf(file);
        const folhasAnteriores = await extractFolhasAnterioresFromPdf(file);
        const dasValue = await extractDasValueFromPdf(file);
        const dataPagamento = await extractDataPagamentoFromPdf(file);
        const anexoFromPdf = await extractAnexoFromPdf(file);

        // Extrair mês e ano do período
        let mes = undefined, ano = undefined;
        if (periodoDocumento && /^\d{2}\/\d{4}$/.test(periodoDocumento)) {
          [mes, ano] = periodoDocumento.split('/').map(Number);
        }

        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) {
          throw new Error('Token de autenticação não encontrado.');
        }

        // Usar a nova API do Simples Nacional
        const response = await fetch(`${API_BASE}/auditoria/simples-nacional/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            cnpj: cnpj.replace(/[^\d]/g, ''),
            nome_empresa: apiData.nome_fantasia || apiData.razao_social,
            atividade_principal: apiData.cnae_fiscal_descricao || apiData.atividade_principal || 'Não identificada',
            uf: apiData.uf || 'SP',
            fator_r_status: fatorR,
            periodo_documento: periodoDocumento,
            icms_percentage: icmsPercentage,
            pis_cofins_percentage: pisCofinsPercentage,
            receita_total: taxData?.receita_total,
            icms_total: taxData?.icms_total,
            pis_total: taxData?.pis_total,
            cofins_total: taxData?.cofins_total,
            valor_das: dasValue || undefined,
            anexos_simples: anexoFromPdf,
            valor_folha: valorFolha || undefined,
            folha_de_salarios_anteriores: folhasAnteriores && folhasAnteriores.length > 0 ? folhasAnteriores : undefined,
            date_pag: dataPagamento || undefined,
            resultado_api: apiData,
            arquivo_nome: file.name,
            mes,
            ano,
            company_id: selectedCompanyId // Enviar company_id explícito
          }),
        });

        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.error || 'Erro ao salvar análise');
        return result?.data;
      } catch (error) {
        console.error('Error saving analysis:', error);
        throw error;
      }
    };

    try {
      // Extrair dados do PDF usando as funções melhoradas
      const cnpj = await extractCnpjFromPdf(file);
      if (!cnpj) {
        toast.error('Não foi possível extrair o CNPJ do PDF. Verifique se o documento é um extrato válido do Simples Nacional.', {
          autoClose: 5000,
        });
        return;
      }
      const fatorR = await extractFatorRFromPdf(file);
      const valorFolha = await extractFolhaSalariosFromPdf(file);
      const taxData = await extractTaxDataFromPdf(file);
      const companyName = await extractCompanyNameFromPdf(file);
      const uf = await extractUfFromPdf(file);
      const activityFromPdf = await extractActivityFromPdf(file);
      const periodoDocumento = await extractPeriodFromPdf(file);
      const anexoFromPdf = await extractAnexoFromPdf(file);
      if (taxData && taxData.receita_total > 0) {
        // Cálculos serão feitos na função saveAnalysis
      }
      const dataPagamento = await extractDataPagamentoFromPdf(file);

      // Buscar dados da empresa na BrasilAPI, depois Legisweb se necessário
      let apiData = null;
      try {
        apiData = await fetchBrasilApi(cnpj);
      } catch {
        // Tenta Legisweb se BrasilAPI falhar
        apiData = await fetchLegiswebApi(cnpj);
        if (!apiData) {
          // Se Legisweb também falhar, monta objeto com dados do PDF
          apiData = {
            cnpj,
            nome_fantasia: companyName,
            razao_social: companyName,
            cnae_fiscal: '',
            cnae_fiscal_descricao: '',
            uf,
            cnaes_secundarios: [],
            atividade_principal: '',
          };
        }
      }

      // Nota: A consulta e salvamento de CNAEs será feita automaticamente pelo backend
      // quando o cliente for criado/atualizado na API do Simples Nacional

      // Nota: A criação do cliente e análise será feita pela API do Simples Nacional

      // Usar o nome extraído do PDF se a API não retornar
      const finalCompanyName =
        typeof apiData?.nome_fantasia === 'string'
          ? apiData.nome_fantasia
          : typeof apiData?.razao_social === 'string'
            ? apiData.razao_social
            : companyName;
      const finalActivity = activityFromPdf !== 'Não identificada' 
        ? activityFromPdf 
        : (apiData?.cnae_fiscal_descricao || apiData?.atividade_principal || 'Não identificada');

      // Log dos dados extraídos para depuração
      console.log('Dados extraídos do PDF:', {
        cnpj,
        fatorR,
        companyName,
        activityFromPdf,
        uf,
        taxData
      });
      
      // Log específico para debug da atividade
      console.log('Atividade extraída:', activityFromPdf);
      
      // Log específico para debug do Fator R
      console.log('Fator R extraído:', fatorR);
      
      // Log específico para debug do Anexo
      console.log('Anexo extraído:', anexoFromPdf);
      
      // Log específico para debug do Valor da Folha
      console.log('Valor da folha extraído:', valorFolha);
      
      // Log específico para debug da Data de Pagamento
      console.log('Data de pagamento extraída:', dataPagamento);

      const savedAnalysis = await saveAnalysis(cnpj, {
        ...(apiData || {}),
        nome_fantasia: finalCompanyName,
        cnae_fiscal_descricao: finalActivity
      }, fatorR, taxData, periodoDocumento, file);
      console.log('savedAnalysis:', savedAnalysis);

      if (savedAnalysis) {
        setCurrentAnalysis(savedAnalysis);
        toast.success(`Análise realizada com sucesso! CNPJ: ${cnpj ? cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : 'N/A'}`, {
          autoClose: 6000,
        });
        // Atualizar a lista de análises automaticamente
        await loadAnalyses();
      } else {
        toast.error('Não foi possível salvar a análise. Verifique os dados e tente novamente.', {
          autoClose: 5000,
        });
      }
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error('Erro ao processar arquivo. Verifique se o PDF é válido e tente novamente.', {
        autoClose: 5000,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalyses = async () => {
    try {
      const selectedCompanyId = resolveSelectedCompanyId();
      if (!selectedCompanyId) {
        console.warn('Nenhuma empresa selecionada');
        setAnalyses([]);
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token de autenticação não encontrado.');
      }

      const url = new URL(`${API_BASE}/auditoria/simples-nacional`);
      url.searchParams.set('company_id', selectedCompanyId);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || 'Erro ao carregar análises');
      }
      setAnalyses(result?.data || []);
    } catch (error) {
      console.error('Error loading analyses:', error);
      toast.error('Erro ao carregar análises. Verifique sua conexão e tente novamente.', {
        autoClose: 4000,
      });
    }
  };

  useEffect(() => {
    loadAnalyses();
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
  });



  const viewAnalysisDetails = (analysis) => {
    // Navegar para análise detalhada usando o ID
    router.push(`/analise-simples/${analysis.id}`);
  };


  const filteredAnalyses = analyses.filter((analysis) => {
    const termo = searchTerm.toLowerCase();
    return (
      (analysis.cnpj && analysis.cnpj.toLowerCase().includes(termo)) ||
      ((analysis.nome || analysis.nome_empresa) && (analysis.nome || analysis.nome_empresa).toLowerCase().includes(termo)) ||
      (analysis.atividade_principal && analysis.atividade_principal.toLowerCase().includes(termo)) ||
      (analysis.periodo_documento && analysis.periodo_documento.toLowerCase().includes(termo))
    );
  });

  const dropzoneClassName = [styles.dropzone, isDragActive ? styles.dropzoneActive : ''].filter(Boolean).join(' ');
  const dropzoneIconClass = [styles.dropzoneIcon, isDragActive ? styles.dropzoneIconActive : ''].filter(Boolean).join(' ');
  const getFatorBadgeClass = (status) => {
    if (!status) {
      return styles.badge;
    }
    const normalized = status.toLowerCase();
    const isNegative = normalized.includes('não') || normalized.includes('nao');
    return `${styles.badge} ${isNegative ? styles.badgeNegative : styles.badgePositive}`;
  };

  return (
    <>
      <PrincipalSidebar />
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1 className={styles.title}>
              Analisador RCT do Simples Nacional
            </h1>
            <p className={styles.subtitle}>
              Faça upload do extrato do Simples Nacional para análise do Fator R e
              tributação
            </p>
          </div>

          <div className={styles.sectionCard}>
            <div className={styles.sectionInner}>
              <div
                {...getRootProps()}
                className={dropzoneClassName}
              >
                <input {...getInputProps()} />
                <Upload className={dropzoneIconClass} />
                <p className={styles.dropzoneText}>
                  {isDragActive
                    ? 'Solte o arquivo aqui'
                    : 'Arraste ou clique para fazer upload do extrato do Simples Nacional'}
                </p>
                <p className={styles.dropzoneHint}>Apenas arquivos PDF</p>
              </div>

              {loading && (
                <div className={styles.loadingWrapper}>
                  <div className={styles.loadingSpinner}></div>
                  <p className={styles.loadingText}>
                    Processando arquivo...
                  </p>
                </div>
              )}
            </div>
          </div>

          {currentAnalysis && (
            <div className={`${styles.sectionCard} ${styles.highlightCard}`}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionHeaderRow}>
                  <h3 className={styles.sectionTitle}>
                    Resultado da Análise Recente
                  </h3>
                  <button
                    type="button"
                    onClick={() => setCurrentAnalysis(null)}
                    className={styles.iconButton}
                    title="Fechar"
                  >
                    <X className={styles.iconButtonIcon} />
                  </button>
                </div>
              </div>
              <div className={styles.sectionInner}>
                <dl className={styles.analysisGrid}>
                  <div className={styles.analysisItem}>
                    <dt className={styles.analysisLabel}>CNPJ</dt>
                    <dd className={styles.analysisValue}>
                      {currentAnalysis.cnpj ? currentAnalysis.cnpj.replace(
                        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
                        '$1.$2.$3/$4-$5'
                      ) : 'CNPJ não encontrado'}
                    </dd>
                  </div>
                  <div className={`${styles.analysisItem} ${styles.analysisItemWide}`}>
                    <dt className={styles.analysisLabel}>Nome da Empresa</dt>
                    <dd className={styles.analysisValue}>
                      {currentAnalysis.nome || 'Nome não encontrado'}
                      {currentAnalysis.tipo_cadastro === 'pre_cliente' && (
                        <span className={styles.badge}>Pré-Cliente</span>
                      )}
                    </dd>
                  </div>
                  <div className={styles.analysisItem}>
                    <dt className={styles.analysisLabel}>Data da Análise</dt>
                    <dd className={styles.analysisValue}>
                      {currentAnalysis.data_extracao ? new Date(currentAnalysis.data_extracao).toLocaleDateString('pt-BR') : 'Data não encontrada'}
                    </dd>
                  </div>
                  <div className={styles.analysisItem}>
                    <dt className={styles.analysisLabel}>Período do Documento</dt>
                    <dd className={styles.analysisValue}>
                      {currentAnalysis.periodo_documento || 'Não identificado'}
                    </dd>
                  </div>
                  <div className={styles.analysisItem}>
                    <dt className={styles.analysisLabel}>Fator R</dt>
                    <dd className={styles.analysisValue}>
                      <span className={getFatorBadgeClass(currentAnalysis.fator_r_status)}>
                        {currentAnalysis.fator_r_status || 'Não identificado'}
                      </span>
                    </dd>
                  </div>

                  <div className={styles.analysisItem}>
                    <dt className={styles.analysisLabel}>% ICMS</dt>
                    <dd className={styles.analysisValue}>
                      {Number.isFinite(Number(currentAnalysis.icms_percentage))
                        ? `${Number(currentAnalysis.icms_percentage).toFixed(2)}%`
                        : 'N/A'}
                    </dd>
                  </div>
                  <div className={styles.analysisItem}>
                    <dt className={styles.analysisLabel}>% PIS/COFINS</dt>
                    <dd className={styles.analysisValue}>
                      {Number.isFinite(Number(currentAnalysis.pis_cofins_percentage))
                        ? `${Number(currentAnalysis.pis_cofins_percentage).toFixed(2)}%`
                        : 'N/A'}
                    </dd>
                  </div>
                  <div className={`${styles.analysisItem} ${styles.analysisItemWide}`}>
                    <dt className={styles.analysisLabel}>Atividade Principal</dt>
                    <dd className={styles.analysisValue}>
                      {currentAnalysis.atividade_principal || 'Não identificada'}
                    </dd>
                  </div>
                </dl>
                <div className={styles.analysisActions}>
                  <button
                    type="button"
                    onClick={() => viewAnalysisDetails(currentAnalysis)}
                    className={styles.primaryButton}
                  >
                    Ver Análise Detalhada
                  </button>
                </div>
              </div>
            </div>
          )}

          {analyses.length > 0 && (
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionHeaderRow}>
                  <h3 className={styles.sectionTitle}>
                    Análises Anteriores
                  </h3>
                  <input
                    type="text"
                    placeholder="Pesquisar por CNPJ, empresa, atividade ou período..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className={styles.searchInput}
                  />
                </div>
              </div>
              <div className={styles.sectionInner}>
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead className={styles.tableHead}>
                    <tr>
                        <th className={styles.tableHeadCell}>Nome da Empresa</th>
                        <th className={styles.tableHeadCell}>CNPJ</th>
                        <th className={styles.tableHeadCell}>Atividade Principal</th>
                        <th className={styles.tableHeadCell}>Data da Análise</th>
                        <th className={styles.tableHeadCell}>Período do Documento</th>
                        <th className={styles.tableHeadCell}>Fator R</th>
                        <th className={styles.tableHeadCell}>% ICMS</th>
                        <th className={styles.tableHeadCell}>% PIS/COFINS</th>
                        <th className={styles.tableHeadCell}>Ações</th>
                    </tr>
                    </thead>
                    <tbody>
                      {filteredAnalyses.map((analysis) => {
                        const formattedCnpj = analysis.cnpj
                          ? analysis.cnpj.replace(
                              /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
                              '$1.$2.$3/$4-$5'
                            )
                          : 'CNPJ não encontrado';

                        return (
                          <tr key={analysis.id} className={styles.tableRow}>
                            <td className={styles.tableCell}>
                              {analysis.nome ||
                                analysis.nome_empresa ||
                                'Nome não encontrado'}
                              {analysis.tipo_cadastro === 'pre_cliente' && (
                                <span className={styles.badge}>Pré-Cliente</span>
                              )}
                            </td>
                            <td className={styles.tableCell}>{formattedCnpj}</td>
                            <td className={styles.tableCell}>
                              {analysis.atividade_principal || 'Não identificada'}
                            </td>
                            <td className={styles.tableCell}>
                              {analysis.data_extracao
                                ? new Date(analysis.data_extracao).toLocaleDateString('pt-BR')
                                : 'Data não encontrada'}
                            </td>
                            <td className={styles.tableCell}>
                              {analysis.periodo_documento || 'Não identificado'}
                            </td>
                            <td className={styles.tableCell}>
                              <span className={getFatorBadgeClass(analysis.fator_r_status)}>
                                {analysis.fator_r_status || 'Não identificado'}
                              </span>
                            </td>
                            <td className={styles.tableCell}>
                              {Number.isFinite(Number(analysis.icms_percentage))
                                ? `${Number(analysis.icms_percentage).toFixed(2)}%`
                                : 'N/A'}
                            </td>
                            <td className={styles.tableCell}>
                              {Number.isFinite(Number(analysis.pis_cofins_percentage))
                                ? `${Number(analysis.pis_cofins_percentage).toFixed(2)}%`
                                : 'N/A'}
                            </td>
                            <td className={styles.tableCell}>
                              <div className={styles.tableActions}>
                                <span className={styles.tableCellSecondary}>Ver detalhes</span>
                                <span className={styles.tableCellSecondary}>(Em breve)</span>
                                <button
                                  type="button"
                                  className={styles.actionDanger}
                                  title="Excluir análise"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (window.confirm('Tem certeza que deseja excluir esta análise?')) {
                                      deleteAnalysis(analysis.id);
                                    }
                                  }}
                                >
                                  Excluir
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick={false}
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
          transition={Bounce}
        />
      </div>
    </>
  );
}
