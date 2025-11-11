import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from '../lib/supabase';

// Configure PDF.js worker
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

/**
 * Extrai informações detalhadas do PDF do Simples Nacional
 * @param file Arquivo PDF do extrato do Simples Nacional
 * @returns Dados estruturados extraídos do PDF
 */
export const extractSimplesDadosPDF = async (file) => {
  console.log('=== CHAMOU extractSimplesDadosPDF ===', file);
  try {
    // Carregar o PDF
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Resultado padrão
    const result = {
      cnpj: null,
      razaoSocial: null,
      dataAbertura: null,
      optanteSimples: false,
      periodoApuracao: null,
      receitaBrutaPA: null,
      receitaBrutaAcumulada12Meses: null,
      receitaBrutaAnoCorrente: null,
      receitaBrutaAnoAnterior: null,
      fatorR: null,
      folhaSalarios: null,
      valoresTotais: {
        irpj: null,
        csll: null,
        cofins: null,
        pis: null,
        inss: null,
        icms: null,
        ipi: null,
        iss: null,
        total: null,
      },
      atividades: [],
    };

    // Extrair texto de todas as páginas
    const pagesText = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(' ');
      pagesText.push(pageText);
    }
    console.log('Páginas extraídas:', pagesText);

    // Texto completo do documento
    const fullText = pagesText.join(' ');

    console.log(fullText);
    alert(fullText);

    // Normalizar texto: remover quebras de linha e múltiplos espaços
    const normalizedText = fullText.replace(/\s+/g, ' ');

    // Buscar exclusivamente o CNPJ Estabelecimento no formato correto
    let cnpj = null;
    const cnpjEstabMatch = normalizedText.match(/CNPJ Estabelecimento:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
    if (cnpjEstabMatch) {
      cnpj = cnpjEstabMatch[1].replace(/\D/g, '');
    }
    // Validar se tem 14 dígitos, senão setar como null
    if (!cnpj || cnpj.length !== 14) {
      cnpj = null;
    }
    result.cnpj = cnpj;
    // Nunca buscar em outros lugares para evitar falsos positivos

    const nomeMatch = fullText.match(/Nome Empresarial: ([^Data]+)/);
    result.razaoSocial = nomeMatch ? nomeMatch[1].trim() : null;

    const dataAberturaMatch = fullText.match(
      /Data de Abertura: (\d{2}\/\d{2}\/\d{4})/
    );
    result.dataAbertura = dataAberturaMatch ? dataAberturaMatch[1] : null;

    result.optanteSimples = fullText.includes(
      'Optante pelo Simples Nacional: Sim'
    );

    const periodoMatch = fullText.match(
      /Período de Apuração \(PA\): (\d{2}\/\d{4})/
    );
    result.periodoApuracao = periodoMatch ? periodoMatch[1] : null;

    // Extrair receitas
    const receitaPAMatch = fullText.match(
      /Receita Bruta do PA \(RPA\) - Competência\s+([\d\.,]+)/
    );
    if (receitaPAMatch) {
      result.receitaBrutaPA = parseFloat(
        receitaPAMatch[1].replace(/\./g, '').replace(',', '.')
      );
    }

    const receita12MesesMatch = fullText.match(
      /Receita bruta acumulada nos doze meses anteriores ao PA\s+\(RBT12\)\s+([\d\.,]+)/
    );
    if (receita12MesesMatch) {
      result.receitaBrutaAcumulada12Meses = parseFloat(
        receita12MesesMatch[1].replace(/\./g, '').replace(',', '.')
      );
    }

    const receitaAnoCorrenteMatch = fullText.match(
      /Receita bruta acumulada no ano-calendário corrente \(RBA\)\s+([\d\.,]+)/
    );
    if (receitaAnoCorrenteMatch) {
      result.receitaBrutaAnoCorrente = parseFloat(
        receitaAnoCorrenteMatch[1].replace(/\./g, '').replace(',', '.')
      );
    }

    const receitaAnoAnteriorMatch = fullText.match(
      /Receita bruta acumulada no ano-calendário anterior\s+\(RBAA\)\s+([\d\.,]+)/
    );
    if (receitaAnoAnteriorMatch) {
      result.receitaBrutaAnoAnterior = parseFloat(
        receitaAnoAnteriorMatch[1].replace(/\./g, '').replace(',', '.')
      );
    }

    // Extrair Fator R
    const fatorRMatch = fullText.match(/Fator r = (.+?)(?:\s|\.|$)/);
    result.fatorR = fatorRMatch ? fatorRMatch[1].trim() : null;

    // Extrair folha de salários
    if (
      fullText.includes('Folha de Salários Anteriores') &&
      !fullText.includes('Nenhuma')
    ) {
      // Lógica para extrair valores da folha de salários se existirem
      // Implementar conforme o formato específico do PDF
    }

    // Extrair valores totais de impostos
    const totalTributosSection = fullText.match(
      /Total do Débito Exigível \(R\$\)([\s\S]+?)(?=\.|$)/
    );

    if (totalTributosSection) {
      const sectionText = totalTributosSection[1];

      const irpjMatch = sectionText.match(/IRPJ\s+([\d\.,]+)/);
      if (irpjMatch)
        result.valoresTotais.irpj = parseFloat(
          irpjMatch[1].replace(/\./g, '').replace(',', '.')
        );

      const csllMatch = sectionText.match(/CSLL\s+([\d\.,]+)/);
      if (csllMatch)
        result.valoresTotais.csll = parseFloat(
          csllMatch[1].replace(/\./g, '').replace(',', '.')
        );

      const cofinsMatch = sectionText.match(/COFINS\s+([\d\.,]+)/);
      if (cofinsMatch)
        result.valoresTotais.cofins = parseFloat(
          cofinsMatch[1].replace(/\./g, '').replace(',', '.')
        );

      const pisMatch = sectionText.match(/PIS\/Pasep\s+([\d\.,]+)/);
      if (pisMatch)
        result.valoresTotais.pis = parseFloat(
          pisMatch[1].replace(/\./g, '').replace(',', '.')
        );

      const inssMatch = sectionText.match(/INSS\/CPP\s+([\d\.,]+)/);
      if (inssMatch)
        result.valoresTotais.inss = parseFloat(
          inssMatch[1].replace(/\./g, '').replace(',', '.')
        );

      const icmsMatch = sectionText.match(/ICMS\s+([\d\.,]+)/);
      if (icmsMatch)
        result.valoresTotais.icms = parseFloat(
          icmsMatch[1].replace(/\./g, '').replace(',', '.')
        );

      const ipiMatch = sectionText.match(/IPI\s+([\d\.,]+)/);
      if (ipiMatch)
        result.valoresTotais.ipi = parseFloat(
          ipiMatch[1].replace(/\./g, '').replace(',', '.')
        );

      const issMatch = sectionText.match(/ISS\s+([\d\.,]+)/);
      if (issMatch)
        result.valoresTotais.iss = parseFloat(
          issMatch[1].replace(/\./g, '').replace(',', '.')
        );

      const totalMatch = sectionText.match(/Total\s+([\d\.,]+)/);
      if (totalMatch)
        result.valoresTotais.total = parseFloat(
          totalMatch[1].replace(/\./g, '').replace(',', '.')
        );
    }

    // Extrair informações por atividade
    const atividadesPattern =
      /Valor do Débito por Tributo para a Atividade \(R\$\):\s+([\s\S]+?)(?=Valor do Débito por Tributo para a Atividade|Informações por Estabelecimento|$)/g;
    let atividadeMatch;

    while ((atividadeMatch = atividadesPattern.exec(fullText)) !== null) {
      const atividadeText = atividadeMatch[1];

      const descricaoMatch = atividadeText.match(/^([^Receita]+)/);
      const receitaMatch = atividadeText.match(
        /Receita Bruta Informada: R\$ ([\d\.,]+)/
      );

      if (descricaoMatch && receitaMatch) {
        const descricao = descricaoMatch[1].trim();
        const receita = parseFloat(
          receitaMatch[1].replace(/\./g, '').replace(',', '.')
        );

        // Extrair valores de impostos para esta atividade
        const impostos = {
          irpj: 0,
          csll: 0,
          cofins: 0,
          pis: 0,
          inss: 0,
          icms: 0,
          ipi: 0,
          iss: 0,
          total: 0,
        };

        const impostosPattern =
          /IRPJ\s+([\d\.,]+)\s+CSLL\s+([\d\.,]+)\s+COFINS\s+([\d\.,]+)\s+PIS\/Pasep\s+([\d\.,]+)\s+INSS\/CPP\s+([\d\.,]+)\s+ICMS\s+([\d\.,]+)\s+IPI\s+([\d\.,]+)\s+ISS\s+([\d\.,]+)\s+Total\s+([\d\.,]+)/;
        const impostosMatch = atividadeText.match(impostosPattern);

        if (impostosMatch) {
          impostos.irpj = parseFloat(
            impostosMatch[1].replace(/\./g, '').replace(',', '.')
          );
          impostos.csll = parseFloat(
            impostosMatch[2].replace(/\./g, '').replace(',', '.')
          );
          impostos.cofins = parseFloat(
            impostosMatch[3].replace(/\./g, '').replace(',', '.')
          );
          impostos.pis = parseFloat(
            impostosMatch[4].replace(/\./g, '').replace(',', '.')
          );
          impostos.inss = parseFloat(
            impostosMatch[5].replace(/\./g, '').replace(',', '.')
          );
          impostos.icms = parseFloat(
            impostosMatch[6].replace(/\./g, '').replace(',', '.')
          );
          impostos.ipi = parseFloat(
            impostosMatch[7].replace(/\./g, '').replace(',', '.')
          );
          impostos.iss = parseFloat(
            impostosMatch[8].replace(/\./g, '').replace(',', '.')
          );
          impostos.total = parseFloat(
            impostosMatch[9].replace(/\./g, '').replace(',', '.')
          );
        }

        // Adicionar atividade ao resultado
        result.atividades.push({
          descricao,
          receitaBruta: receita,
          impostos,
        });
      }
    }

    return result;
  } catch (error) {
    console.error('Erro ao extrair dados do PDF:', error);
    throw new Error('Falha ao processar o PDF do Simples Nacional');
  }
};

/**
 * Determina se a empresa tem atividades de comércio
 * @param atividades Lista de atividades extraídas do PDF
 * @returns true se a empresa tem atividades de comércio
 */
export const hasCommerceActivities = (
  atividades: Array<{ descricao }>
) => {
  return atividades.some(
    (atividade) =>
      atividade.descricao.toLowerCase().includes('comércio') ||
      atividade.descricao.toLowerCase().includes('comercio') ||
      atividade.descricao.toLowerCase().includes('revenda') ||
      atividade.descricao.toLowerCase().includes('mercadoria')
  );
};

/**
 * Calcula percentuais de impostos em relação à receita
 * @param data Dados do Simples Nacional
 * @returns Objeto com percentuais de ICMS e PIS/COFINS
 */
export const calcularPercentuaisImpostos = (
  data: SimplesNacionalData
): { icms ; pisCofins  } => {
  if (!data.receitaBrutaPA || data.receitaBrutaPA === 0) {
    return { icms: null, pisCofins: null };
  }

  const icmsPercentage = data.valoresTotais.icms
    ? (data.valoresTotais.icms / data.receitaBrutaPA) * 100
    : null;

  const pisCofinsPercentage =
    data.valoresTotais.pis && data.valoresTotais.cofins
      ? ((data.valoresTotais.pis + data.valoresTotais.cofins) /
          data.receitaBrutaPA) *
        100
      : null;

  return {
    icms: icmsPercentage,
    pisCofins: pisCofinsPercentage,
  };
};

/**
 * Extrai apenas o CNPJ de um PDF
 * @param file Arquivo PDF
 * @returns CNPJ extraído ou null se não encontrado
 */
export const extractCnpjFromPdf = async (
  file)string > => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item) => item.str).join(' ');

    const cnpjMatch = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}\-\d{2}/);
    return cnpjMatch ? cnpjMatch[0] : null;
  } catch (error) {
    console.error('Erro ao extrair CNPJ do PDF:', error);
    return null;
  }
};

/**
 * Extrai o valor da folha de salários quando há fator r
 * @param file Arquivo PDF
 * @returns Valor da folha de salários ou null se não encontrado
 */
export const extractFolhaSalariosFromPdf = async (file)number > => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Verificar todas as páginas
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item) => item.str).join(' ');

      // Procurar pela seção do Fator R
      if (text.includes('Fator r =')) {
        const fatorRMatch = text.match(/Fator r = (.+?)(?:\s*-\s*|\.|$)/);
        if (fatorRMatch && fatorRMatch[1]) {
          const fatorR = fatorRMatch[1].trim();
          
          
          // Se o fator r não é "Não se aplica", procurar pelo valor da folha de salários
          if (fatorR !== 'Não se aplica' && !fatorR.includes('Não se aplica') && !fatorR.startsWith('Não')) {
            console.log('Fator R encontrado:', fatorR, '- Procurando valor da folha de salários...');
            
            // PRIORIDADE 1: Procurar pelo último mês na seção de folhas (capturar qualquer mês/ano antes do total)
            const ultimoMesMatch = text.match(/(\d{2}\/\d{4})[^0-9]*([\d\.,]+)[^0-9]*2\.3\.1\)[^0-9]*TOTAL DE FOLHAS DE SALARIOS ANTERIORES/i);
            if (ultimoMesMatch && ultimoMesMatch[2]) {
              console.log('Valor da última folha encontrado via último mês:', ultimoMesMatch[1], ultimoMesMatch[2]);
              return parseFloat(ultimoMesMatch[2].replace(/\./g, '').replace(',', '.'));
            }
            
            // PRIORIDADE 2: Procurar pelo último mês na seção de folhas (mais flexível com parênteses)
            const ultimoMesMatch2 = text.match(/(\d{2}\/\d{4})[^0-9]*([\d\.,]+)[^0-9]*2\.3\.1\)[^0-9]*TOTAL DE FOLHAS DE SALARIOS ANTERIORES[^0-9]*\(R\$\)/i);
            if (ultimoMesMatch2 && ultimoMesMatch2[2]) {
              console.log('Valor da última folha encontrado via último mês (com parênteses):', ultimoMesMatch2[1], ultimoMesMatch2[2]);
              return parseFloat(ultimoMesMatch2[2].replace(/\./g, '').replace(',', '.'));
            }
            
            // PRIORIDADE 3: Procurar pelo último mês na seção de folhas (mais simples)
            const ultimoMesMatch3 = text.match(/(\d{2}\/\d{4})[^0-9]*([\d\.,]+)[^0-9]*2\.3\.1\)/i);
            if (ultimoMesMatch3 && ultimoMesMatch3[2]) {
              console.log('Valor da última folha encontrado via último mês (simples):', ultimoMesMatch3[1], ultimoMesMatch3[2]);
              return parseFloat(ultimoMesMatch3[2].replace(/\./g, '').replace(',', '.'));
            }
            

            

            

            
            console.log('Nenhum valor da folha encontrado para fator r:', fatorR);
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Erro ao extrair folha de salários do PDF:', error);
    return null;
  }
};

export const extractFatorRFromPdf = async (file)string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Verificar todas as páginas
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item) => item.str).join(' ');

      // Procurar pela seção do Fator R
      if (text.includes('Fator r =')) {
        const fatorRMatch = text.match(/Fator r = (.+?)(?:\s|\.|$)/);
        if (fatorRMatch && fatorRMatch[1]) {
          return fatorRMatch[1].trim();
        }
      }
    }

    return 'Não identificado';
  } catch (error) {
    console.error('Erro ao extrair Fator R do PDF:', error);
    return 'Erro na extração';
  }
};

/**
 * Extrai a planilha 2.3) Folha de Salários Anteriores como lista de competências e valores
 * Retorna apenas os pares { competencia: 'MM/AAAA', valor }
 */
export const extractFolhasAnterioresFromPdf = async (
  file)Array<{ competencia; valor }>> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(' ');
      fullText += pageText + ' ';
    }

    // Normalizar texto (sem acentos, caixa alta e espaços simples)
    let normalized = fullText
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .toUpperCase();

    // Localizar o bloco da seção 2.3) FOLHA DE SALARIOS ANTERIORES
    const startIdx = normalized.search(/2\.3\)\s*FOLHA?\s+DE\s+SALARIOS\s+ANTERIORES/);
    if (startIdx === -1) return [];

    // Cortar até antes do 2.3.1) TOTAL ou limitar janela
    const afterStart = normalized.slice(startIdx);
    const endMatch = afterStart.search(/2\.3\.1\)/);
    const section = endMatch !== -1 ? afterStart.slice(0, endMatch) : afterStart.slice(0, 1200);

    // Extrair pares MM/AAAA e valor (inclui 0,00)
    const resultados: Array<{ competencia; valor }> = [];
    const regex = /(\d{2}\/\d{4})[^0-9]*([\d\.]+,[\d]{2}|0,00)/g;
    let match: RegExpExecArray ;
    while ((match = regex.exec(section)) !== null) {
      const competencia = match[1];
      const valor = parseFloat(match[2].replace(/\./g, '').replace(',', '.')) || 0;
      resultados.push({ competencia, valor });
    }

    return resultados;
  } catch (error) {
    console.error('Erro ao extrair Folhas de Salários Anteriores (2.3):', error);
    return [];
  }
};

/**
 * Extrai o valor do DAS (item 6, primeiro valor à direita após 'total') do PDF do Simples Nacional
 * @param file Arquivo PDF
 * @returns Valor do DAS ou null se não encontrado
 */
export const extractDasValueFromPdf = async (file)number > => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(' ');
      fullText += pageText + ' ';
    }
    // Normalizar texto
    fullText = fullText.replace(/\s+/g, ' ').toUpperCase();

    // Procurar o bloco do item 6
    const item6Match = fullText.match(/6\)[\s\S]{0,600}?(?=\d+\))/);
    let item6Block = '';
    if (item6Match) {
      item6Block = item6Match[0];
    } else {
      // fallback: pegar do '6)' até o final
      const fallbackMatch = fullText.match(/6\)[\s\S]+/);
      if (fallbackMatch) item6Block = fallbackMatch[0];
    }
    if (item6Block) {
      // Procurar valor após 'PRINCIPAL'
      const principalMatch = item6Block.match(/PRINCIPAL\s+([\d\.]+,[\d]{2})/);
      if (principalMatch && principalMatch[1]) {
        return parseFloat(principalMatch[1].replace(/\./g, '').replace(',', '.'));
      }
      // Fallback: valor após 'TOTAL' (mas dentro do item 6)
      const totalMatch = item6Block.match(/TOTAL\s+([\d\.]+,[\d]{2})/);
      if (totalMatch && totalMatch[1]) {
        return parseFloat(totalMatch[1].replace(/\./g, '').replace(',', '.'));
      }
    }
    return null;
  } catch (error) {
    console.error('Erro ao extrair valor do DAS:', error);
    return null;
  }
};

/**
 * Extrai a data de pagamento do PDF do Simples Nacional
 * @param file Arquivo PDF
 * @returns Data de pagamento no formato DD/MM/AAAA ou null se não encontrado
 */
export const extractDataPagamentoFromPdf = async (file)string > => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    // Extrair texto de todas as páginas
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(' ');
      fullText += pageText + ' ';
    }
    
    // Normalizar texto
    fullText = fullText.replace(/\s+/g, ' ').toUpperCase();
    

    console.log(fullText);
    
    // Padrões para encontrar a data de pagamento na seção 6.2
    const dataPagamentoPatterns = [
      // Padrão específico para seção 6.2 - Informações da Arrecadação
      /6\.2\)\s+INFORMACOES\s+DA\s+ARRECADACAO[^0-9]*(\d{2}\/\d{2}\/\d{4})/i,
      /INFORMACOES\s+DA\s+ARRECADACAO[^0-9]*(\d{2}\/\d{2}\/\d{4})/i,
      /ARRECADACAO\s+DO\s+DAS[^0-9]*(\d{2}\/\d{2}\/\d{4})/i,
      /DATA\s+DE\s+PAGAMENTO[^0-9]*(\d{2}\/\d{2}\/\d{4})/i,
      
      // Padrões mais genéricos para data de pagamento
      /PAGAMENTO[^0-9]*(\d{2}\/\d{2}\/\d{4})/i,
      /PAGO[^0-9]*(\d{2}\/\d{2}\/\d{4})/i,
      
      // Procurar por data seguida de banco/agência
      /(\d{2}\/\d{2}\/\d{4})[^0-9]*\d{3}\/\d{4}/i,
      /(\d{2}\/\d{2}\/\d{4})[^0-9]*BANCO[^0-9]*AGENCIA/i,
      
      // Procurar por data no formato DD/MM/AAAA
      /(\d{2}\/\d{2}\/\d{4})/i
    ];
    
    for (const pattern of dataPagamentoPatterns) {
      const match = fullText.match(pattern);
      if (match && match[1]) {
        const dataPagamento = match[1].trim();
        
        // Validar se é uma data válida
        const [dia, mes, ano] = dataPagamento.split('/').map(Number);
        const data = new Date(ano, mes - 1, dia);
        
        if (data.getDate() === dia && 
            data.getMonth() === mes - 1 && 
            data.getFullYear() === ano &&
            ano >= 2000 && ano <= 2030) {
          
          console.log('Data de pagamento encontrada:', dataPagamento);
          return dataPagamento;
        }
      }
    }
    
    console.log('Data de pagamento não encontrada no PDF');
    return null;
  } catch (error) {
    console.error('Erro ao extrair data de pagamento do PDF:', error);
    return null;
  }
};

/**
 * Salva ou atualiza o perfil da empresa na tabela clientes via API
 */
export async function saveEmpresaSimplesNacionalToSupabase({
  cnpj,
  nome,
  atividade_principal,
  uf,
  cnae_empresa
}: {
  cnpj;
  nome;
  atividade_principal?;
  uf?;
  cnae_empresa?;
}) {
  try {
    // Validação dos campos obrigatórios
    const cleanCnpj = cnpj ? cnpj.replace(/[^\d]/g, '') : '';
    if (!cleanCnpj || cleanCnpj.length !== 14 || cleanCnpj === '00000000000000' || cleanCnpj === 'NAOIDENTIFICADO') {
      console.error('CNPJ inválido ao tentar salvar empresa no Supabase:', cnpj);
      return;
    }
    if (!nome || typeof nome !== 'string' || nome.trim().length < 3) {
      console.error('Nome da empresa inválido ao tentar salvar empresa no Supabase:', nome);
      return;
    }

    console.log('Tentando salvar empresa SN:', {
      cnpj: cleanCnpj,
      nome,
      atividade_principal,
      uf,
      cnae_empresa,
      regime_tributario: 'simples_nacional',
    });

    // Buscar company_id do usuário logado (assumindo que está disponível no contexto)
    // Por enquanto, vamos usar o Supabase diretamente para buscar o company_id
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      console.error('Usuário não autenticado:', userError);
      return;
    }

    // Buscar company_id do usuário
    const { data: userCompany, error: companyError } = await supabase
      .from('user-company')
      .select('company_id')
      .eq('user_id', userData.user.id)
      .single();

    if (companyError || !userCompany) {
      console.error('Company não encontrada para o usuário:', companyError);
      return;
    }

    // Usar a nova API para criar/atualizar cliente
    const clienteData = {
      company_id: userCompany.company_id,
      cnpj: cleanCnpj,
      nome: nome.trim(),
      atividade_principal: atividade_principal |,
      uf: uf |,
      regime_tributario: 'simples_nacional',
      // Adicionar CNAEs se disponível
      ...(cnae_empresa && { cnaes: cnae_empresa })
    };

    // Tentar criar/atualizar via API
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/clientes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(clienteData)
      });

      if (response.ok) {
        console.log('Cliente salvo/atualizado via API:', cleanCnpj);
      } else {
        // Se falhar, tentar atualizar (PUT) se já existir
        const updateResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/clientes/por-cnpj/${cleanCnpj}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify(clienteData)
        });

        if (updateResponse.ok) {
          console.log('Cliente atualizado via API:', cleanCnpj);
        } else {
          console.error('Erro ao atualizar cliente via API:', updateResponse.statusText);
          // Fallback para o método antigo se necessário
          await fallbackToOldMethod(clienteData);
        }
      }
    } catch (apiError) {
      console.error('Erro na API, usando fallback:', apiError);
      // Fallback para o método antigo
      await fallbackToOldMethod(clienteData);
    }

  } catch (err) {
    console.error('Erro inesperado ao salvar empresa simples nacional:', err);
  }
}

/**
 * Método de fallback para compatibilidade temporária
 */
async function fallbackToOldMethod(clienteData) {
  try {
    const { error } = await supabase.from('clientes').upsert([clienteData], {
      onConflict: 'cnpj',
    });
    
    if (error) {
      console.error('Erro ao salvar cliente na tabela clientes (fallback):', error);
    } else {
      console.log('Cliente salvo/atualizado na tabela clientes (fallback):', clienteData.cnpj);
    }
  } catch (fallbackError) {
    console.error('Erro no fallback:', fallbackError);
  }
}
