import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';

// Function to read text file with proper encoding
const readTextFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'ISO-8859-1'); // Use Latin1 encoding
  });
};

// Function to extract period from SPED file header considering different SPED types
const extractPeriod = (
  content
) => {
  try {
    const lines = content.split('\n');
    for (const line of lines) {
      // Look for the period info in block 0000
      if (line.startsWith('|0000|')) {
        const parts = line.split('|');
        const layoutVersion = parts[2];
      
        if (parts[1] === 'LECF') {
          // Para ECF, o período está nos campos 10 e 11 (DT_INI e DT_FIN)
          const dtIni = parts[10];
      
          if (!dtIni || dtIni.length !== 8) {
            console.error('Invalid date format in ECF header');
            return null;
          }
      
          const month = 12;
          const year = parseInt(dtIni.substring(4), 10);
      
          if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
            console.error('Invalid month/year values in ECF:', { month, year });
            return null;
          }
      
          return { month, year };
        } else if (layoutVersion === "018" || layoutVersion === "019") {
          // Para ambos os layouts, o período está nos campos 4 e 5
          const dtIni = parts[4];
      
          if (!dtIni || dtIni.length !== 8) {
            console.error('Invalid date format in SPED Fiscal header');
            return null;
          }
      
          const month = parseInt(dtIni.substring(2, 4), 10);
          const year = parseInt(dtIni.substring(4), 10);
      
          if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
            console.error('Invalid month/year values in SPED Fiscal:', { month, year });
            return null;
          }
      
          return { month, year };
        } else if (layoutVersion === "006") {
          // For SPED Contribuições, period is in fields 6 and 7
          const dtIni = parts[6];
      
          if (!dtIni || dtIni.length !== 8) {
            console.error('Invalid date format in SPED Contribuições header');
            return null;
          }
      
          const month = parseInt(dtIni.substring(2, 4), 10);
          const year = parseInt(dtIni.substring(4), 10);
      
          if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
            console.error('Invalid month/year values in SPED Contribuições:', { month, year });
            return null;
          }
      
          return { month, year };
        } else {
          // Other SPED types (fallback)
          console.warn(`Unknown SPED type with layout version: ${layoutVersion}`);
      
          // Try different positions for period info
          for (let i = 4; i < parts.length; i++) {
            const part = parts[i];
            // Look for date pattern (DDMMYYYY)
            if (part && part.length === 8 && /^\d{8}$/.test(part)) {
              const month = parseInt(part.substring(2, 4), 10);
              const year = parseInt(part.substring(4), 10);
      
              if (month >= 1 && month <= 12 && year >= 2000) {
                console.debug(`Found potential date at position ${i}: ${part}`);
                return { month, year };
              }
            }
          }
      
          console.error('Could not find period information in unknown SPED type');
          return null;
        }
      }
    }
    console.error('No header block (0000) found in file');
    return null;
  } catch (error) {
    console.error('Error extracting period:', error);
    return null;
  }
};

// Function to extract company info from SPED file header considering different SPED types
const extractCompanyInfo = (
  content
) => {
  try {
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.startsWith('|0000|')) {
        const parts = line.split('|');
        const layoutVersion = parts[2];
      
        if (parts[1] === 'LECF') {
          // Para ECF, o CNPJ está no campo 4 e o nome no campo 5
          const cnpj = parts[4];
          const nome = parts[5];
      
          if (!cnpj || !nome) {
            console.error('Missing company info in ECF header');
            return null;
          }
      
          const cleanCnpj = cnpj.replace(/[^\d]/g, '');
          if (cleanCnpj.length !== 14) {
            console.error('Invalid CNPJ length in ECF:', cleanCnpj.length);
            return null;
          }
      
          return { cnpj: cleanCnpj, nome };
        } else if (layoutVersion === "018" || layoutVersion === "019") {
          // Para ambos os layouts, as informações estão nos campos 6 e 7
          const nome = parts[6];
          const cnpj = parts[7];
      
          if (!cnpj || !nome) {
            console.error('Missing company info in SPED Fiscal header');
            return null;
          }
      
          const cleanCnpj = cnpj.replace(/[^\d]/g, '');
          if (cleanCnpj.length !== 14) {
            console.error('Invalid CNPJ length in SPED Fiscal:', cleanCnpj.length);
            return null;
          }
      
          return { cnpj: cleanCnpj, nome };
        } else if (layoutVersion === "006") {
          // For SPED Contribuições, company info is in fields 8 and 9
          const nome = parts[8];
          const cnpj = parts[9];
      
          if (!cnpj || !nome) {
            console.error('Missing company info in SPED Contribuições header');
            return null;
          }
      
          const cleanCnpj = cnpj.replace(/[^\d]/g, '');
          if (cleanCnpj.length !== 14) {
            console.error('Invalid CNPJ length in SPED Contribuições:', cleanCnpj.length);
            return null;
          }
      
          return { cnpj: cleanCnpj, nome };
        } else {
          // Other SPED types (generic fallback)
          console.warn(`Unknown SPED type with layout version: ${layoutVersion}`);
      
          // Try to find CNPJ pattern (14 digits) in parts
          let cnpj = null;
          let nome = null;
      
          for (let i = 1; i < parts.length; i++) {
            const part = parts[i];
            if (part && part.length >= 14 && /^\d{14}/.test(part)) {
              cnpj = part.replace(/[^\d]/g, '');
      
              // Name is likely to be in the part before or after CNPJ
              if (i > 1 && parts[i-1] && parts[i-1].length > 5) {
                nome = parts[i-1];
              } else if (i < parts.length - 1 && parts[i+1] && parts[i+1].length > 5) {
                nome = parts[i+1];
              }
      
              if (cnpj && nome) {
                return { cnpj, nome };
              }
            }
          }
      
          console.error('Could not find company info in unknown SPED type');
          return null;
        }
      }
    }
    console.error('No header block (0000) found in file');
    return null;
  } catch (error) {
    console.error('Error extracting company info:', error);
    return null;
  }
};

// Save or update company using our backend API
const saveCompanyToSupabase = async (cnpj, nome) => {
  try {
    console.log('🔍 [DEBUG] Salvando empresa via API do backend:', { cnpj, nome });
    
    const token = getAuthToken();
    if (!token) {
      throw new Error('Token de autenticação não encontrado');
    }

    const companyId = getSelectedCompanyId();
    if (!companyId) {
      throw new Error('ID da empresa não encontrado');
    }

    // Preparar dados para a API
    const clienteData = {
      company_id: companyId,
      nome: nome || 'Cliente',
      cnpj: cnpj.replace(/[^\d]/g, ''),
      uf: 'RJ',
      regime_tributario: 'regime_normal'
    };

    console.log('🔍 [DEBUG] Dados do cliente:', clienteData);

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/auditoria/clientes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(clienteData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      
      // Se o cliente já existe, buscar o cliente existente
      if (response.status === 400 && errorData.error?.includes('já existe')) {
        console.log('🔄 [INFO] Cliente já existe, buscando dados existentes...');
        return await getExistingClient(cnpj, companyId, token, baseUrl);
      }
      
      throw new Error(`Erro ao criar cliente: ${errorData.error || response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ [SUCCESS] Cliente criado com sucesso:', result);
    return result;

  } catch (error) {
    console.error('❌ [ERROR] Erro ao salvar empresa:', error);
    return null;
  }
};

// Função para buscar cliente existente
const getExistingClient = async (cnpj, companyId, token, baseUrl) => {
  try {
    console.log('🔍 [DEBUG] Buscando cliente existente:', { cnpj, companyId });
    
    const response = await fetch(`${baseUrl}/auditoria/clientes?cnpj=${cnpj}&company_id=${companyId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.error('❌ [ERROR] Erro ao buscar cliente existente:', response.statusText);
      return null;
    }

    const result = await response.json();
    console.log('🔍 [DEBUG] Resposta da API:', result);
    
    // A API retorna { data: [...], pagination: {...} }
    const clients = result.data || result;
    
    if (clients && clients.length > 0) {
      const client = clients[0];
      console.log('✅ [SUCCESS] Cliente existente encontrado:', client);
      return { id: client.id };
    }
    
    console.log('⚠️ [WARNING] Cliente não encontrado na busca');
    return null;
    
  } catch (error) {
    console.error('❌ [ERROR] Erro ao buscar cliente existente:', error);
    return null;
  }
};

// Process SPED PIS/COFINS blocks with improved error handling and logging
const processSpedPisCofins = (content) => {
  
  
  // let receitaTotal = 0; // Removido - não utilizado no cálculo final
  let pisTotal = 0;
  let cofinsTotal = 0;

  // Contadores para os novos blocos de receita
  let blocoATotal = 0;
  let blocoCTotal = 0;
  let blocoDTotal = 0;
  let blocoFTotal = 0;

  try {
    // Verificar se o conteúdo é válido
    if (!content || content.trim().length === 0) {
      console.error('[SPED_PROCESSOR] Empty or invalid content');
      throw new Error('Empty or invalid content');
    }

    // Contar linhas para estatísticas
    const lines = content.split('\n');
    
  // Contadores para logs
  let m210Count = 0;
  let m610Count = 0;
  let a100Count = 0;
  let c100Count = 0;
  let c100ValidCount = 0;
  let d100Count = 0;
  let d100ValidCount = 0;
  let d300Count = 0;
  let d500Count = 0;
  let d600Count = 0;
  let f100Count = 0;
    
    // Verificar se temos os blocos necessários
    const hasM210 = content.includes('|M210|');
    const hasM610 = content.includes('|M610|');
    const hasA100 = content.includes('|A100|');
    const hasC100 = content.includes('|C100|');
    const hasD100 = content.includes('|D100|');
    const hasD300 = content.includes('|D300|');
    const hasD500 = content.includes('|D500|');
    const hasD600 = content.includes('|D600|');
    const hasF100 = content.includes('|F100|');
    
    console.log(`[SPED_PROCESSOR] M210 blocks present: ${hasM210}`);
    console.log(`[SPED_PROCESSOR] M610 blocks present: ${hasM610}`);
    console.log(`[SPED_PROCESSOR] A100 blocks present: ${hasA100}`);
    console.log(`[SPED_PROCESSOR] C100 blocks present: ${hasC100}`);
    console.log(`[SPED_PROCESSOR] D100 blocks present: ${hasD100}`);
    console.log(`[SPED_PROCESSOR] D300 blocks present: ${hasD300}`);
    console.log(`[SPED_PROCESSOR] D500 blocks present: ${hasD500}`);
    console.log(`[SPED_PROCESSOR] D600 blocks present: ${hasD600}`);
    console.log(`[SPED_PROCESSOR] F100 blocks present: ${hasF100}`);
    
    // Se não tivermos os blocos, faça uma verificação adicional
    if (!hasM210 && !hasM610 && !hasA100 && !hasC100 && !hasD100 && !hasD300 && !hasD500 && !hasD600 && !hasF100) {
      console.warn('[SPED_PROCESSOR] No known blocks found in content');
      
      // Verificar os primeiros 500 caracteres para depuração
      console.log('[SPED_PROCESSOR] Content preview:', content.substring(0, 500));
      
      // Tentar encontrar qualquer bloco para depuração
      const blocks = lines
        .filter(line => line.split('|').length > 2)
        .map(line => line.split('|')[1])
        .filter(block => block && block.length > 0);
      
      const uniqueBlocks = [...new Set(blocks)];
      console.log('[SPED_PROCESSOR] Found block types:', uniqueBlocks.join(', '));
    }

    for (const line of lines) {
      try {
        const parts = line.split('|');
        if (parts.length < 2) continue;
        
        const blockType = parts[1];

        if (blockType === 'M210') {
          m210Count++;
          // Process PIS values from M210
          // Campo 3 - Base de cálculo
          // Campo 11 - Valor de PIS a pagar
          if (parts.length < 12) {
            console.warn('[SPED_PROCESSOR] M210 line with insufficient fields:', line);
            continue;
          }
          
          // Acesso seguro com valor padrão
          const receitaBruta = parseFloat((parts[3] || '0').replace(',', '.')) || 0;
          const pisValor = parseFloat((parts[11] || '0').replace(',', '.')) || 0;

          // receitaTotal += receitaBruta; // Removido - não utilizado no cálculo final
          pisTotal += pisValor;
          
          // Log de todos os registros
          console.log(`[SPED_PROCESSOR] Processed M210 #${m210Count}: Base=${receitaBruta}, PIS=${pisValor}`);
        } else if (blockType === 'M610') {
          m610Count++;
          // Process COFINS values from M610
          // Campo 11 - Valor de COFINS a pagar
          if (parts.length < 12) {
            console.warn('[SPED_PROCESSOR] M610 line with insufficient fields:', line);
            continue;
          }
          
          // Acesso seguro com valor padrão
          const cofinsValor = parseFloat((parts[11] || '0').replace(',', '.')) || 0;
          cofinsTotal += cofinsValor;
          
          // Log de todos os registros
          console.log(`[SPED_PROCESSOR] Processed M610 #${m610Count}: COFINS=${cofinsValor}`);
        } else if (blockType === 'A100') {
          // Bloco A (A100) - Campo 12 (Valor do documento) - Campo 14 (Desconto)
          a100Count++;
          if (parts.length < 15) {
            console.warn('[SPED_PROCESSOR] A100 line with insufficient fields:', line);
            continue;
          }
          
          const valorDocumento = parseFloat((parts[12] || '0').replace(',', '.')) || 0;
          const desconto = parseFloat((parts[14] || '0').replace(',', '.')) || 0;
          const valorReal = valorDocumento - desconto;
          
          blocoATotal += valorReal;
          
          // Log de todos os registros
          console.log(`[SPED_PROCESSOR] Processed A100 #${a100Count}: Doc=${valorDocumento}, Desc=${desconto}, Real=${valorReal}`);
        } else if (blockType === 'C100') {
          // Bloco C (C100) - Verificar campo 3 = 0 e usar campo 16
          c100Count++;
          if (parts.length < 17) {
            console.warn('[SPED_PROCESSOR] C100 line with insufficient fields:', line);
            continue;
          }
          
          // Verificar se Campo 3 = 0 (condição para incluir no cálculo)
          const campo3 = parts[3];
          if (campo3 === '0') {
            const valorTotal = parseFloat((parts[16] || '0').replace(',', '.')) || 0;
            blocoCTotal += valorTotal;
            c100ValidCount++;
            
            // Log de todos os registros válidos
            console.log(`[SPED_PROCESSOR] Processed C100 #${c100ValidCount}: Campo3=${campo3}, Valor=${valorTotal}`);
          } else {
            // Log para registros que não atendem à condição
            console.log(`[SPED_PROCESSOR] C100 #${c100Count}: Campo3=${campo3} (ignored - not 0)`);
          }
        } else if (blockType === 'D100') {
          // Bloco D (D100 - Transportadora) - Verificar campo 3 = 0 e usar campo 15
          d100Count++;
          if (parts.length < 16) {
            console.warn('[SPED_PROCESSOR] D100 line with insufficient fields:', line);
            continue;
          }
          
          // Verificar se Campo 3 = 0 (condição para incluir no cálculo)
          const campo3 = parts[3];
          if (campo3 === '0') {
            const valorTotal = parseFloat((parts[15] || '0').replace(',', '.')) || 0;
            blocoDTotal += valorTotal;
            d100ValidCount++;
            
            // Log de todos os registros válidos
            console.log(`[SPED_PROCESSOR] Processed D100 #${d100ValidCount}: Campo3=${campo3}, Valor=${valorTotal}`);
          } else {
            // Log para registros que não atendem à condição
            console.log(`[SPED_PROCESSOR] D100 #${d100Count}: Campo3=${campo3} (ignored - not 0)`);
          }
        } else if (blockType === 'D300') {
          // Bloco D (D300) - Campo 9 (Valor total)
          d300Count++;
          if (parts.length < 10) {
            console.warn('[SPED_PROCESSOR] D300 line with insufficient fields:', line);
            continue;
          }
          
          const valorTotal = parseFloat((parts[9] || '0').replace(',', '.')) || 0;
          blocoDTotal += valorTotal;
          
          // Log de todos os registros
          console.log(`[SPED_PROCESSOR] Processed D300 #${d300Count}: Valor=${valorTotal}`);
        } else if (blockType === 'D500') {
          // Bloco D (D500 - Telecomunicação) - Campo 12 (Valor total)
          d500Count++;
          if (parts.length < 13) {
            console.warn('[SPED_PROCESSOR] D500 line with insufficient fields:', line);
            continue;
          }
          
          const valorTotal = parseFloat((parts[12] || '0').replace(',', '.')) || 0;
          blocoDTotal += valorTotal;
          
          // Log de todos os registros
          console.log(`[SPED_PROCESSOR] Processed D500 #${d500Count}: Valor=${valorTotal}`);
        } else if (blockType === 'D600') {
          // Bloco D (D600) - Campo 10 (Valor total)
          d600Count++;
          if (parts.length < 11) {
            console.warn('[SPED_PROCESSOR] D600 line with insufficient fields:', line);
            continue;
          }
          
          const valorTotal = parseFloat((parts[10] || '0').replace(',', '.')) || 0;
          blocoDTotal += valorTotal;
          
          // Log de todos os registros
          console.log(`[SPED_PROCESSOR] Processed D600 #${d600Count}: Valor=${valorTotal}`);
        } else if (blockType === 'F100') {
          // Bloco F (F100) - Verificar Indicador de Operação (Campo 2)
          f100Count++;
          if (parts.length < 3) {
            console.warn('[SPED_PROCESSOR] F100 line with insufficient fields:', line);
            continue;
          }
          
          const indicadorOperacao = parts[2];
          // Se = 1 ou 2 → Somar o Campo 6
          if (indicadorOperacao === '1' || indicadorOperacao === '2') {
            if (parts.length < 7) {
              console.warn('[SPED_PROCESSOR] F100 line with insufficient fields for value:', line);
              continue;
            }
            
            const valorTotal = parseFloat((parts[6] || '0').replace(',', '.')) || 0;
            blocoFTotal += valorTotal;
            
            // Log de todos os registros
            console.log(`[SPED_PROCESSOR] Processed F100 #${f100Count}: Ind=${indicadorOperacao}, Valor=${valorTotal}`);
          } else {
            // Se = 0 → Não somar
            // Log de todos os registros
            console.log(`[SPED_PROCESSOR] Processed F100 #${f100Count}: Ind=${indicadorOperacao}, Valor=0 (ignored)`);
          }
        }
      } catch (lineError) {
        // Continue com a próxima linha em caso de erro
        console.error('[SPED_PROCESSOR] Error processing line:', lineError);
        continue;
      }
    }

    // Calcular totalRevenue como somatório dos blocos A, C, D, F
    const totalRevenue = blocoATotal + blocoCTotal + blocoDTotal + blocoFTotal;

    // Log de estatísticas finais
    console.log('[SPED_PROCESSOR] Processing completed with statistics:', {
      m210Blocks: m210Count,
      m610Blocks: m610Count,
      a100Blocks: a100Count,
      c100Blocks: c100Count,
      c100ValidBlocks: c100ValidCount,
      d100Blocks: d100Count,
      d100ValidBlocks: d100ValidCount,
      d300Blocks: d300Count,
      d500Blocks: d500Count,
      d600Blocks: d600Count,
      f100Blocks: f100Count,
      blocoATotal: blocoATotal,
      blocoCTotal: blocoCTotal,
      blocoDTotal: blocoDTotal,
      blocoFTotal: blocoFTotal,
      totalRevenue: totalRevenue,
      totalPIS: pisTotal,
      totalCOFINS: cofinsTotal
    });

    return {
      totais: {
        receita: totalRevenue, // Usar o novo cálculo de totalRevenue
        pis: {
          valor: pisTotal,
        },
        cofins: {
          valor: cofinsTotal,
        },
      },
    };
  } catch (error) {
    console.error('[SPED_PROCESSOR] Error processing SPED PIS/COFINS:', error);
    
    // Retornar estrutura válida em caso de erro
    return {
      totais: {
        receita: 0,
        pis: {
          valor: 0,
        },
        cofins: {
          valor: 0,
        },
      },
      error: true, // Flag indicando que ocorreu um erro
    };
  }
};

// Função para processar ECD e extrair faturamento
const processEcd = (content) => {
  let faturamentoTotal = 0;

  try {
    const lines = content.split('\n');

    for (const line of lines) {
      const parts = line.split('|');
      const blockType = parts[1];

      // Bloco I155 contém os saldos das contas periódicas
      // Procurar contas de receita (geralmente começam com 3)
      if (blockType === 'I155') {
        const codConta = parts[2];
        // Identificar contas de receita - ajuste conforme plano de contas da empresa
        if (codConta && codConta.startsWith('3')) {
          const saldoFinal = parseFloat(parts[6].replace(',', '.')) || 0;
          if (saldoFinal > 0) {
            faturamentoTotal += saldoFinal;
          }
        }
      }
    }

    return {
      totais: {
        faturamento: faturamentoTotal,
      },
    };
  } catch (error) {
    console.error('Error processing ECD:', error);
    throw new Error('Failed to process ECD file');
  }
};

// Função para processar ECF e extrair faturamento
const processEcf = (content) => {
  let faturamentoTotal = 0;

  try {
    const lines = content.split('\n');

    for (const line of lines) {
      const parts = line.split('|');
      const blockType = parts[1];

      // Bloco Y520 ou Y540 contém informações de receita bruta
      if (blockType === 'Y520' || blockType === 'Y540') {
        const valor = parseFloat(parts[4].replace(',', '.')) || 0;
        faturamentoTotal += valor;
      }
    }

    return {
      totais: {
        faturamento: faturamentoTotal,
      },
    };
  } catch (error) {
    console.error('Error processing ECF:', error);
    throw new Error('Failed to process ECF file');
  }
};

// Função para processar SPED Fiscal e extrair faturamento, ICMS e IPI
const processSpedFiscal = (content) => {
  let faturamentoTotal = 0;
  let icmsTotal = 0;
  let ipiTotal = 0; // Soma do IPI apenas da última coluna do E520
  let layoutSped = null;

  // Contadores para logs
  let c100Count = 0;
  let c100ValidCount = 0;
  let d100Count = 0;
  let d100ValidCount = 0;

  try {
    const lines = content.split('\n');

    for (const line of lines) {
      const parts = line.split('|');
      const blockType = parts[1];

      // Identificar o layout do SPED Fiscal
      if (blockType === '0000' && !layoutSped) {
        layoutSped = parts[9]; // O campo do layout geralmente é o índice 9
        // Se não encontrar, tenta o campo 19 (índice 19)
        if (!layoutSped || layoutSped.trim() === '') {
          layoutSped = parts[19];
        }
        // Se ainda não encontrar, procura por "018" ou "019" nos campos
        if (!layoutSped || layoutSped.trim() === '') {
          layoutSped = parts.find(p => p === '018' || p === '019') || null;
        }
      }

      // Processar registros C100 para faturamento
      if (blockType === 'C100') {
        c100Count++;
        
        // Verificar se Campo 3 = 0 (condição para incluir no cálculo)
        const campo3 = parts[3];
        if (campo3 === '0') {
          // Usar Campo 12 - Valor total do documento
          if (parts.length >= 13) {
            const valDoc = parseFloat(parts[12].replace(',', '.')) || 0;
            faturamentoTotal += valDoc;
            c100ValidCount++;
            
            // Log de todos os registros válidos
            console.log(`[SPED_FISCAL] Processed C100 #${c100ValidCount}: Campo3=${campo3}, Valor=${valDoc}`);
          } else {
            console.warn('[SPED_FISCAL] C100 line with insufficient fields:', line);
          }
        } else {
          // Log para registros que não atendem à condição
          console.log(`[SPED_FISCAL] C100 #${c100Count}: Campo3=${campo3} (ignored - not 0)`);
        }
      }

      // Processar registros D100 para faturamento
      if (blockType === 'D100') {
        d100Count++;
        
        // Verificar se Campo 3 = 0 (condição para incluir no cálculo)
        const campo3 = parts[3];
        if (campo3 === '0') {
          // Usar Campo 15 - Valor total do documento
          if (parts.length >= 16) {
            const valDoc = parseFloat(parts[15].replace(',', '.')) || 0;
            faturamentoTotal += valDoc;
            d100ValidCount++;
            
            // Log de todos os registros válidos
            console.log(`[SPED_FISCAL] Processed D100 #${d100ValidCount}: Campo3=${campo3}, Valor=${valDoc}`);
          } else {
            console.warn('[SPED_FISCAL] D100 line with insufficient fields:', line);
          }
        } else {
          // Log para registros que não atendem à condição
          console.log(`[SPED_FISCAL] D100 #${d100Count}: Campo3=${campo3} (ignored - not 0)`);
        }
      }

      // Registro E110 - Total do ICMS
      if (blockType === 'E110') {
        // Campo 13 + Campo 15 - Valor total do ICMS a recolher (indexação baseada em 0)
        const campo13 = parseFloat(parts[13].replace(',', '.')) || 0;
        const campo15 = parseFloat(parts[15].replace(',', '.')) || 0;
        const icmsRecolher = campo13 + campo15;
        icmsTotal += icmsRecolher;
        
        // Log individual do E110 processado
        console.log(`[SPED_FISCAL] Processed E110: Campo13=${campo13}, Campo15=${campo15}, ICMS Total=${icmsRecolher}`);
      }

      // Registro E520 - Valor do IPI (última coluna preenchida)
      if (blockType === 'E520') {
        // A penúltima posição (parts.length - 2) é a última coluna numérica antes do pipe final
        const ipiValor = parseFloat(parts[parts.length - 2]?.replace(',', '.') || '0') || 0;
        ipiTotal += ipiValor;
      }
    }

    // Log de estatísticas finais
    console.log('[SPED_FISCAL] Processing completed with statistics:', {
      c100Total: c100Count,
      c100Valid: c100ValidCount,
      d100Total: d100Count,
      d100Valid: d100ValidCount,
      faturamentoTotal: faturamentoTotal,
      icmsTotal: icmsTotal,
      ipiTotal: ipiTotal
    });

    return {
      layout: layoutSped,
      totais: {
        faturamento: faturamentoTotal,
        icms: {
          valor: icmsTotal,
        },
        ipi: {
          valor: ipiTotal, // <-- Agora apenas do E520
        },
      },
    };
  } catch (error) {
    console.error('Error processing SPED Fiscal:', error);
    throw new Error('Failed to process SPED Fiscal file');
  }
};

// Função para processar arquivo PDF da DCTF
const processDctfPdf = async (file) => {
  try {
    console.log('[PROCESSOR] Processing DCTF PDF file:', file.name);

    // Usar função específica para extrair texto de DCTF
    const pdfText = await extractTextFromDctfPdf(file);

    // Validar se o texto contém indicadores de DCTF
    if (!isDctfDocument(pdfText)) {
      console.warn('[PROCESSOR] Documento não parece ser uma DCTF válida');
      return null;
    }

    // Identificar CNPJ, Mês/Ano e valores dos tributos
    const dctfData = extractDctfData(pdfText);

    if (!dctfData) {
      console.error('[PROCESSOR] Failed to extract DCTF data');
      return null;
    }

    console.log('[PROCESSOR] Extracted DCTF data:', dctfData);

    return {
      type: 'DCTF',
      ...dctfData,
    };
  } catch (error) {
    console.error('[PROCESSOR] Error processing DCTF PDF:', error);
    throw error;
  }
};

// Função específica para extrair texto de DCTF usando PDF.js
const extractTextFromDctfPdf = async (file) => {
  try {
    console.log('[DCTF] Extraindo texto do PDF:', file.name);
    
    // Importar PDF.js dinamicamente
    const pdfjsLib = await import('pdfjs-dist');
    
    // Configurar worker se necessário
    if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    }

    // Carregar o PDF
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let allTextContent = '';
    
    // Extrair texto de todas as páginas
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
      allTextContent += pageText + '\n';
    }
    
    console.log('[DCTF] Texto extraído com sucesso, tamanho:', allTextContent.length);
    return allTextContent;
    
  } catch (error) {
    console.error('[DCTF] Erro ao extrair texto do PDF:', error);
    throw error;
  }
};

// Função para validar se o documento é uma DCTF
const isDctfDocument = (pdfText) => {
  const dctfIndicators = [
    /DCTF/i,
    /Declaração de Débitos e Créditos Tributários Federais/i,
    /Receita Federal/i,
    /CNPJ:\s*\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/i,
    /Mês\/Ano:/i
  ];
  
  const matchCount = dctfIndicators.filter(regex => regex.test(pdfText)).length;
  console.log('[DCTF] Indicadores encontrados:', matchCount, 'de', dctfIndicators.length);
  
  return matchCount >= 3; // Pelo menos 3 indicadores devem estar presentes
};

/**
 * Extrai valores dos tributos do formato compacto do DCTF
 * Baseado na análise do texto: IRPJ IRRF IPI IOF CSLL PIS/PASEP COFINS ... valores...
 */
const extractTributosFromCompactFormat = (pdfText) => {
  console.log('[DCTF-COMPACT] Iniciando extração de tributos do formato compacto');
  
  // Encontrar a seção de totalização (com espaços extras e hífen)
  const totalizacaoMatch = pdfText.match(/TOTALIZAÇÃO\s+DOS\s+TRIBUTOS\s+E\s+CONTRIBUIÇÕES\s+APURADOS\s+NO\s+MÊS\s*-\s*R\$[\s\S]*?(?=TOTALIZAÇÃO\s+DOS\s+TRIBUTOS\s+E\s+CONTRIBUIÇÕES\s+APURADOS\s+NO\s+TRIMESTRE|$)/i);
  
  if (!totalizacaoMatch) {
    console.log('[DCTF-COMPACT] Seção de totalização não encontrada');
    return { irpj: 0, csll: 0, pis: 0, cofins: 0 };
  }
  
  const textoTotalizacao = totalizacaoMatch[0];
  console.log('[DCTF-COMPACT] Texto da totalização:', textoTotalizacao.substring(0, 200));
  
  // Extrair todos os valores numéricos da seção
  const valores = textoTotalizacao.match(/\d+,\d+/g) || [];
  console.log('[DCTF-COMPACT] Valores encontrados:', valores);
  
  // Converter para números
  const valoresNumericos = valores.map(v => parseFloat(v.replace(',', '.')));
  console.log('[DCTF-COMPACT] Valores numéricos:', valoresNumericos);
  
  // Baseado na análise do texto real:
  // 0,00 50,64 50,64  0,00 0,00  0,00 0,00  0,00 0,00  0,00 45,58 45,58  0,00 0,00  22,46 22,46  0,00 0,00  0,00 0,00  0,00 0,00  0,00 0,00  0,00 0,00  0,00 0,00
  // IRPJ: 0,00 50,64 50,64 (posições 0,1,2) - usar posição 1 = 50,64
  // CSLL: 0,00 45,58 45,58 (posições 9,10,11) - usar posição 10 = 45,58  
  // PIS: 0,00 0,00 (posições 12,13) - usar posição 13 = 0,00
  // COFINS: 0,00 22,46 22,46 (posições 14,15,16) - usar posição 15 = 22,46
  
  const tributos = {
    irpj: 0,
    csll: 0,
    pis: 0,
    cofins: 0
  };
  
  // IRPJ: posição 1 (saldo a pagar)
  if (valoresNumericos.length > 1) {
    tributos.irpj = valoresNumericos[1];
    console.log('[DCTF-COMPACT] IRPJ extraído:', tributos.irpj);
  }
  
  // CSLL: posição 10 (saldo a pagar)
  if (valoresNumericos.length > 10) {
    tributos.csll = valoresNumericos[10];
    console.log('[DCTF-COMPACT] CSLL extraído:', tributos.csll);
  }
  
  // PIS: posição 13 (saldo a pagar)
  if (valoresNumericos.length > 13) {
    tributos.pis = valoresNumericos[13];
    console.log('[DCTF-COMPACT] PIS extraído:', tributos.pis);
  }
  
  // COFINS: posição 15 (saldo a pagar)
  if (valoresNumericos.length > 15) {
    tributos.cofins = valoresNumericos[15];
    console.log('[DCTF-COMPACT] COFINS extraído:', tributos.cofins);
  }
  
  console.log('[DCTF-COMPACT] Resultado final:', tributos);
  return tributos;
};

// Função para extrair dados da DCTF do texto do PDF
const extractDctfData = (pdfText) => {
  try {
    console.log('[DCTF] Iniciando extração de dados do texto DCTF');
    console.log('[DCTF] Tamanho do texto:', pdfText.length);
    
    // Padrões de expressão regular melhorados para extrair informações
    const cnpjRegex = /CNPJ:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i;
    const periodoRegex = /Mês\/Ano:\s*([A-Z]{3})\s*(\d{4})/i;
    const empresaRegex = /Nome\s*Empresarial:\s*([^\n\r]+)/i;

    // Usar nova função de extração baseada em posição

    // Extrair dados do texto
    const cnpjMatch = cnpjRegex.exec(pdfText);
    const periodoMatch = periodoRegex.exec(pdfText);
    const empresaMatch = empresaRegex.exec(pdfText);

    console.log('[DCTF] CNPJ encontrado:', cnpjMatch ? cnpjMatch[1] : 'Não encontrado');
    console.log('[DCTF] Período encontrado:', periodoMatch ? `${periodoMatch[1]} ${periodoMatch[2]}` : 'Não encontrado');
    console.log('[DCTF] Empresa encontrada:', empresaMatch ? empresaMatch[1] : 'Não encontrada');

    if (!cnpjMatch || !periodoMatch) {
      console.error('[DCTF] Falha ao extrair informações básicas da DCTF');
      console.log('[DCTF] Texto de amostra:', pdfText.substring(0, 500));
      return null;
    }

    // Mapear mês de texto para número
    const mesMap = {
      JAN: 1,
      FEV: 2,
      MAR: 3,
      ABR: 4,
      MAI: 5,
      JUN: 6,
      JUL: 7,
      AGO: 8,
      SET: 9,
      OUT: 10,
      NOV: 11,
      DEZ: 12,
    };

    const mesTxt = periodoMatch[1];
    const mes = mesMap[mesTxt] || 0;
    const ano = parseInt(periodoMatch[2], 10);

    // Extrair CNPJ sem formatação
    const cnpj = cnpjMatch[1].replace(/[^\d]/g, '');

    // Extrair nome da empresa
    const nomeEmpresa = empresaMatch ? empresaMatch[1].trim() : '';

    // Extrair valores dos tributos usando abordagem específica para formato compacto
    const tributos = extractTributosFromCompactFormat(pdfText);

    console.log('[DCTF] Valores encontrados:');
    console.log('[DCTF] IRPJ:', tributos.irpj);
    console.log('[DCTF] CSLL:', tributos.csll);
    console.log('[DCTF] PIS:', tributos.pis);
    console.log('[DCTF] COFINS:', tributos.cofins);

    // Valores já extraídos pela função extractTributosFromCompactFormat

    const irpjValor = tributos.irpj;
    const csllValor = tributos.csll;
    const pisValor = tributos.pis;
    const cofinsValor = tributos.cofins;

    const result = {
      cnpj,
      nomeEmpresa,
      periodo: { mes, ano },
      tributos: {
        irpj: irpjValor,
        csll: csllValor,
        pis: pisValor,
        cofins: cofinsValor,
      },
    };

    console.log('[DCTF] Dados extraídos com sucesso:', result);
    return result;
  } catch (error) {
    console.error('Error extracting DCTF data:', error);
    return null;
  }
};

// Função extractDctfWebData removida - agora é usada a do ecacProcessor.ts

// Função normalizeTributoName removida - agora é usada a do ecacProcessor.ts

// Função auxiliar para capturar erros de duplicação
const handleSaveAnalysisError = (error) => {
  if (error instanceof Error && error.message?.includes('Já existe uma análise')) {
    return error.message.replace('Erro ao criar análise: ', '');
  }
  return null;
};

// Função centralizada para processar e salvar DCTF
const processAndSaveDctf = async (
  dctfData,
  fileName,
  clienteResult
) => {
  console.log('🔍 [DCTF-CENTRAL] Processando e salvando DCTF:', fileName);
  
  try {
    console.log('🔍 [DCTF-CENTRAL] INICIANDO TRY BLOCK');
    await saveAnalysisToSupabase(
      dctfData.cnpj,
      (dctfData.periodo).mes,
      (dctfData.periodo).ano,
      dctfData,
      fileName,
      'DCTF',
      clienteResult.id
    );
    console.log('🔍 [DCTF-CENTRAL] TRY BLOCK COMPLETO - SEM ERRO');
  } catch (saveError) {
    console.log('🚨 [DCTF-CENTRAL] ERRO CAPTURADO DIRETO:', saveError);
    const duplicateError = handleSaveAnalysisError(saveError);
    if (duplicateError) {
      console.log('🚨 [DCTF-CENTRAL] RETORNANDO DUPLICATE ERROR:', duplicateError);
      return {
        success: false,
        duplicateError
      };
    }
    throw saveError;
  }
  
  console.log('✅ [DCTF-CENTRAL] DCTF salvo com sucesso:', fileName);
    
    const result = {
      fileName,
      type: 'DCTF',
      period: dctfData.periodo,
      ...dctfData,
    };
    
    console.log('🔍 [DCTF-CENTRAL] Retornando resultado:', result);
    
    return {
      success: true,
      result
    };
};

// Save analysis using our backend API
const saveAnalysisToSupabase = async (
  cnpj,
  mes,
  ano,
  dados,
  fileName,
  tipo = 'SPED_CONTRIBUICOES', // Valor padrão para compatibilidade
  clientesId
) => {
  try {
    console.log('🔍 [DEBUG] Salvando análise via API do backend:', { cnpj, mes, ano, tipo, fileName });
    
    const token = getAuthToken();
    if (!token) {
      throw new Error('Token de autenticação não encontrado');
    }

    // Validação básica de entradas
    if (!cnpj || typeof cnpj !== 'string') {
      console.error('Invalid CNPJ provided:', cnpj);
      return false;
    }

    // Limpar o CNPJ para garantir que contenha apenas dígitos
    const cleanCnpj = cnpj.replace(/[^\d]/g, '');
    if (cleanCnpj.length !== 14) {
      console.error('Invalid CNPJ length:', cleanCnpj.length);
      return false;
    }

    // Validar mês e ano
    if (!mes || !ano || mes < 1 || mes > 12 || ano < 2000 || ano > 2100) {
      console.error('Invalid period:', { mes, ano });
      return false;
    }

    // Validar se dados existe
    if (!dados) {
      console.error('No data provided for analysis');
      return false;
    }

    // Usar clientesId se fornecido, senão buscar por CNPJ
    let cliente = { id: clientesId };
    
    if (clientesId) {
      console.log('🔍 [DEBUG] Usando clientesId fornecido:', clientesId);
      cliente = { id: clientesId };
    } else {
      console.log('🔍 [DEBUG] Buscando cliente por CNPJ:', cleanCnpj);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const clienteResponse = await fetch(
        `${baseUrl}/auditoria/clientes/por-cnpj/${cleanCnpj}?company_id=${getSelectedCompanyId()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!clienteResponse.ok) {
        throw new Error('Erro ao buscar cliente');
      }

      const clientes = await clienteResponse.json();
      if (!clientes || clientes.length === 0) {
        throw new Error('Cliente não encontrado');
      }

      cliente = clientes[0];
      console.log('🔍 [DEBUG] Cliente encontrado:', cliente);
    }

    // Inicializar resumo com objeto vazio
    let resumo = {};

    // Formatar o resumo de acordo com o tipo de arquivo, com validações para evitar erros
    try {
      switch (tipo) {
        case 'SPED_CONTRIBUICOES': {
          // Verificar se a estrutura de dados esperada existe
          if (!dados.totais) {
            console.warn('Missing "totais" in SPED_CONTRIBUICOES data');
            dados.totais = { receita: 0, pis: { valor: 0 }, cofins: { valor: 0 } }; // Inicializar para evitar erros
          }
          
          // Usar valores default para propriedades ausentes
          const receita = dados.totais.receita || 0;
          const pisValor = dados.totais.pis?.valor || 0;
          const cofinsValor = dados.totais.cofins?.valor || 0;
          
          resumo = {
            totalRevenue: Number(receita),
            pisCofins: {
              pis: Number(pisValor),
              cofins: Number(cofinsValor),
            },
          };
          break;
        }
          
        case 'ECD': {
          // Verificar se a estrutura esperada existe
          if (!dados.totais) {
            console.warn('Missing "totais" in ECD data');
            dados.totais = { faturamento: 0 }; // Inicializar para evitar erros
          }
          
          resumo = {
            faturamento: Number(dados.totais.faturamento || 0),
          };
          break;
        }
          
        case 'ECF': {
          // Verificar se a estrutura esperada existe
          if (!dados.totais) {
            console.warn('Missing "totais" in ECF data');
            dados.totais = { faturamento: 0 }; // Inicializar para evitar erros
          }
          
          resumo = {
            faturamento: Number(dados.totais.faturamento || 0),
          };
          break;
        }
          
          case 'SPED_FISCAL': {
            // Verificar se a estrutura esperada existe
            if (!dados.totais) {
              console.warn('Missing "totais" in SPED_FISCAL data');
              dados.totais = { faturamento: 0, icms: { valor: 0 }, ipi: { valor: 0 } }; // Inicializar para evitar erros
            }
            
            // Acessar propriedades aninhadas com segurança
            const faturamento = dados.totais.faturamento || 0;
            const icmsValor = dados.totais.icms?.valor || 0;
            const ipiValor = dados.totais.ipi?.valor || 0; 
            
            resumo = {
              faturamento: Number(faturamento),
              icms: Number(icmsValor),
              ipi: Number(ipiValor),
            };
            break;
          }
          
        case 'DCTF': {
          // Verificar se a estrutura esperada existe
          if (!dados.tributos) {
            console.warn('Missing "tributos" in DCTF data');
            dados.tributos = { irpj: 0, csll: 0, pis: 0, cofins: 0 }; // Inicializar para evitar erros
          }
          
          resumo = {
            tributos: {
              irpj: Number(dados.tributos.irpj || 0),
              csll: Number(dados.tributos.csll || 0),
              pis: Number(dados.tributos.pis || 0),
              cofins: Number(dados.tributos.cofins || 0),
            },
          };
          break;
        }
          
        case 'DCTFWEB': {
          // Verificar se a estrutura esperada existe
          if (!dados.tributos) {
            console.warn('Missing "tributos" in DCTFWEB data');
            dados.tributos = {}; // Inicializar para evitar erros
          }
          
          // Copiar tributos com segurança, convertendo para números
          const tributos = {};
          if (typeof dados.tributos === 'object' && dados.tributos !== null) {
            Object.keys(dados.tributos).forEach(key => {
              tributos[key] = Number((dados.tributos)[key] || 0);
            });
          }
          
          resumo = { tributos };
          break;
        }
          
        default:
          // Caso genérico, assume-se que dados.totais existe
          if (!dados.totais) {
            console.warn(`Missing "totais" in ${tipo || 'unknown'} data`);
            resumo = { ...(dados || {}) }; // Usar dados diretamente neste caso
          } else {
            resumo = { ...dados.totais };
          }
      }
      
      // Log do resumo para depuração
      console.log('Generated summary:', JSON.stringify(resumo, null, 2));
      
    } catch (formatError) {
      // Se ocorrer erro na formatação do resumo, registrar e usar um objeto vazio
      console.error('Error formatting summary:', formatError);
      resumo = { error: 'Error formatting data', originalData: dados };
    }

    // Preparar dados para a análise
    const analiseData = {
      clientes_id: cliente.id,
            cnpj: cleanCnpj,
            arquivo_nome: fileName,
      tipo,
      mes,
      ano,
      resumo
    };

    console.log('🔍 [DEBUG] Dados da análise:', analiseData);

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/auditoria/regime-normal/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(analiseData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Erro ao criar análise: ${errorData.error || response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ [SUCCESS] Análise criada com sucesso:', result);
    return true;

  } catch (error) {
    console.error('❌ [ERROR] Erro ao salvar análise:', error);
    throw error; // Re-lançar o erro para ser capturado pelo try-catch externo
  }
};


// Process ZIP file containing SPED and eCAC files with improved error handling and logging
export const processInvoiceZip = async (file) => {
  const zip = new JSZip();
  const results = [];

  try {
    // Se o arquivo for um PDF, processar diretamente
    if (
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf')
    ) {
      console.log('[PROCESSOR] Processing direct PDF file:', file.name);
      try {
        // --- INTEGRAÇÃO PARA SIMPLES NACIONAL ---
        // Sempre tentar processar como Simples Nacional
        const { extractSimplesDadosPDF, saveEmpresaSimplesNacionalToSupabase } = await import('./pdf-extractor');
        const simplesData = await extractSimplesDadosPDF(file);
        console.log('[PROCESSOR] Dados extraídos do Simples Nacional:', simplesData);
        if (simplesData && simplesData.cnpj && simplesData.cnpj !== 'NAO_IDENTIFICADO') {
          await saveEmpresaSimplesNacionalToSupabase({
            cnpj: simplesData.cnpj,
            nome: simplesData.razaoSocial || 'Empresa Simples Nacional',
            atividade_principal: simplesData.atividades[0]?.descricao,
            // uf: (não extraído do PDF, pode ser null)
            // cnae_empresa: (não extraído do PDF, será null)
          });
        } else {
          console.warn('[PROCESSOR] CNPJ do Simples Nacional não identificado, empresa não será salva.');
        }
        // Verificar o tipo de PDF pelo nome ou conteúdo
        if (file.name.toLowerCase().includes('dctfweb')) {
          // Processar como DCTFWeb
          const dctfWebData = await processDctfWebPdf(file);

          if (dctfWebData) {
            console.log('[PROCESSOR] Successfully processed DCTFWeb data');

            // Salvar informações no Supabase
            if (dctfWebData.cnpj && dctfWebData.periodo) {
              const clienteResult = await saveCompanyToSupabase(
                dctfWebData.cnpj,
                (dctfWebData.nomeEmpresa || 'Empresa DCTFWeb')
              );

              if (clienteResult && clienteResult.id) {
                try {
                  await saveAnalysisToSupabase(
                    dctfWebData.cnpj,
                    (dctfWebData.periodo).mes,
                    (dctfWebData.periodo).ano,
                    dctfWebData,
                    file.name,
                    'DCTFWEB',
                    clienteResult.id
                  );
                } catch (saveError) {
                  const duplicateError = handleSaveAnalysisError(saveError);
                  if (duplicateError) {
                    return { results: [], duplicateError };
                  }
                  throw saveError;
                }
              }
            }

            results.push({
              fileName: file.name,
              type: 'DCTFWEB',
              ...dctfWebData,
            });
          }
        } else if (file.name.toLowerCase().includes('dctf') && file.type === 'application/pdf') {
          // Processar como DCTF tradicional
          const dctfData = await processDctfPdf(file);

          if (dctfData) {
            console.log('[PROCESSOR] Successfully processed DCTF data');

            // Salvar informações no Supabase
            if (dctfData.cnpj && dctfData.periodo) {
              const clienteResult = await saveCompanyToSupabase(
                dctfData.cnpj,
                (dctfData.nomeEmpresa || 'Empresa DCTF')
              );

              if (clienteResult && clienteResult.id) {
                try {
                  await saveAnalysisToSupabase(
                    dctfData.cnpj,
                    (dctfData.periodo).mes,
                    (dctfData.periodo).ano,
                    dctfData,
                    file.name,
                    'DCTF',
                    clienteResult.id
                  );
                  
                  // Só adicionar aos resultados se não houve erro
                  results.push({
                    fileName: file.name,
                    type: 'DCTF',
                    ...dctfData,
                  });
                } catch (saveError) {
                  const duplicateError = handleSaveAnalysisError(saveError);
                  if (duplicateError) {
                    return { results: [], duplicateError };
                  }
                  throw saveError;
                }
              }
            }
          }
        } else {
          // Tentar detectar o tipo de PDF pelo conteúdo usando função específica para DCTF
          const pdfText = await extractTextFromDctfPdf(file);

          if (pdfText.includes('DCTFWeb') || pdfText.includes('DCTF Web')) {
            // Não há processamento de DCTFWeb pois foi removido o ecacProcessor
            console.log('[PROCESSOR] DCTFWeb detectado, mas processamento removido (ecacProcessor excluído)');
          } else if (isDctfDocument(pdfText)) {
            // Processar como DCTF tradicional
            const dctfData = extractDctfData(pdfText);

            if (dctfData) {
              console.log(
                '[PROCESSOR] Detected and processed DCTF data from',
                file.name
              );

              // Salvar informações no Supabase
              if (dctfData.cnpj && dctfData.periodo) {
                const clienteResult = await saveCompanyToSupabase(
                  dctfData.cnpj,
                  (dctfData.nomeEmpresa || 'Empresa DCTF')
                );

                if (clienteResult && clienteResult.id) {
                  const dctfResult = await processAndSaveDctf(dctfData, file.name, clienteResult);
                  
                  if (dctfResult.duplicateError) {
                    return { results: [], duplicateError: dctfResult.duplicateError };
                  }
                  
                  if (dctfResult.success && dctfResult.result) {
                    results.push(dctfResult.result);
                  }
                }
              }
            }
          } else {
            // Processar como um PDF do eCAC normalmente
            const paymentData = await processEcacPdf(file);

            if (paymentData && paymentData.length > 0) {
              console.log(
                `[PROCESSOR] Successfully extracted ${paymentData.length} payment records from ${file.name}`
              );

              results.push({
                fileName: file.name,
                type: 'PDF_PAYMENTS',
                paymentData,
              });
            } else {
              console.log(`[PROCESSOR] No payment data found in ${file.name}`);
            }
          }
        }
      } catch (error) {
        console.error('[PROCESSOR] Error processing PDF:', error);
      }

      return { results };
    }

    // Processar arquivo ZIP
    console.log('[ZIP] Loading ZIP file:', file.name);
    const zipContent = await zip.loadAsync(file);
    let spedData = null;
    let ecdData = null;
    let ecfData = null;
    let spedFiscalData = null;

    // First pass: Process SPED files to get company info and period
    for (const fileName in zipContent.files) {
      if (
        !zipContent.files[fileName].dir &&
        fileName.toLowerCase().endsWith('.txt')
      ) {
        console.log('[ZIP] Processing text file:', fileName);

        try {
          const blob = await zipContent.files[fileName].async('blob');
          const content = await readTextFile(blob);

          // Extrair informações comuns
          const period = extractPeriod(content);
          const companyInfo = extractCompanyInfo(content);

          if (!period || !companyInfo) {
            console.error(
              '[ZIP] Missing period or company info in file:',
              fileName
            );
            continue;
          }

          console.log('[ZIP] Extracted info:', { 
            period, 
            companyInfo,
            fileSize: blob.size,
            contentLength: content.length
          });

          // Salvar informações da empresa no Supabase primeiro
          let clienteId = null;
          try {
            const clienteResult = await saveCompanyToSupabase(companyInfo.cnpj, companyInfo.nome);
            if (clienteResult && clienteResult.id) {
              clienteId = clienteResult.id;
              console.log('[ZIP] Company saved successfully:', companyInfo.cnpj, companyInfo.nome, 'ID:', clienteId);
            } else {
              console.error('[ZIP] Failed to get client ID from save result');
            }
          } catch (companyError) {
            console.error('[ZIP] Error saving company:', companyError);
            // Continue para tentar processar o arquivo mesmo se falhar ao salvar a empresa
          }

          // Identificar tipo de arquivo SPED pelo conteúdo
          // SPED Contribuições (PIS/COFINS)
          if (content.includes('|0000|006|') || content.includes('|0000|SPED|1|01')) {
            console.log('[ZIP] Detected SPED Contribuições file');
            
            try {
              // Verificar se a função processSpedPisCofins existe
              if (typeof processSpedPisCofins !== 'function') {
                console.error('[ZIP] processSpedPisCofins is not a function');
                continue;
              }
              
              const processedData = processSpedPisCofins(content);
              
              // Verificar se processedData é válido
              if (!processedData) {
                console.error('[ZIP] processSpedPisCofins returned null or undefined');
                continue;
              }
              
              console.log('[ZIP] SPED Contribuições processed data:', 
                JSON.stringify(processedData).substring(0, 300) + '...');
              
              try {
                // Verificar se temos os dados mínimos necessários para salvar
                if (!processedData.totais) {
                  console.error('[ZIP] Missing totais in processedData');
                  processedData.totais = { receita: 0, pis: { valor: 0 }, cofins: { valor: 0 } }; // Inicializar para evitar erro
                }
                
                // Garantir que as propriedades existam
                if (!processedData.totais.pis) {
                  processedData.totais.pis = { valor: 0 };
                }
                
                if (!processedData.totais.cofins) {
                  processedData.totais.cofins = { valor: 0 };
                }
                
                // Salvar análise no Supabase
                const saveResult = await saveAnalysisToSupabase(
                  companyInfo.cnpj,
                  period.month,
                  period.year,
                  processedData,
                  fileName,
                  'SPED_CONTRIBUICOES',
                  clienteId || undefined
                );
                
                console.log('[ZIP] Save analysis result:', saveResult);
                
                if (saveResult === false) {
                  console.error('[ZIP] Failed to save SPED Contribuições analysis');
                } else {
                  console.log('[ZIP] SPED Contribuições analysis saved successfully');
                }
              } catch (saveError) {
                console.error('[ZIP] Error saving SPED Contribuições analysis:', saveError);
                // Se for erro de duplicação, retornar informação sobre ele
                if (saveError instanceof Error && saveError.message?.includes('Já existe uma análise')) {
                  return { results: [], duplicateError: saveError.message };
                }
                // Para outros erros, re-lançar normalmente
                throw saveError;
              }

              spedData = {
                fileName,
                cnpj: companyInfo.cnpj,
                period,
                data: processedData,
              };

              results.push(spedData);
            } catch (processingError) {
              console.error('[ZIP] Error processing SPED Contribuições:', processingError);
            }
          }
          // ECD - Identificar pela versão do leiaute
          else if (content.includes('|0000|LECD')) {
            console.log('[ZIP] Detected ECD file');
            
            try {
              const processedData = processEcd(content);
              
              if (!processedData) {
                console.error('[ZIP] processEcd returned null or undefined');
                continue;
              }
              
              console.log('[ZIP] ECD processed data:', 
                JSON.stringify(processedData).substring(0, 300) + '...');
              
              try {
                const saveResult = await saveAnalysisToSupabase(
                  companyInfo.cnpj,
                  period.month,
                  period.year,
                  processedData,
                  fileName,
                  'ECD',
                  clienteId || undefined
                );
                
                console.log('[ZIP] Save ECD analysis result:', saveResult);
              } catch (saveError) {
                console.error('[ZIP] Error saving ECD analysis:', saveError);
              }

              ecdData = {
                fileName,
                cnpj: companyInfo.cnpj,
                period,
                type: 'ECD',
                data: processedData,
              };

              results.push(ecdData);
            } catch (processingError) {
              console.error('[ZIP] Error processing ECD:', processingError);
            }
          }
          // ECF - Identificar pela versão do leiaute
          else if (content.includes('|0000|LECF')) {
            console.log('[ZIP] Detected ECF file');
            
            try {
              const processedData = processEcf(content);
              
              if (!processedData) {
                console.error('[ZIP] processEcf returned null or undefined');
                continue;
              }
              
              console.log('[ZIP] ECF processed data:', 
                JSON.stringify(processedData).substring(0, 300) + '...');
              
              try {
                const saveResult = await saveAnalysisToSupabase(
                  companyInfo.cnpj,
                  period.month,
                  period.year,
                  processedData,
                  fileName,
                  'ECF',
                  clienteId || undefined
                );
                
                console.log('[ZIP] Save ECF analysis result:', saveResult);
              } catch (saveError) {
                console.error('[ZIP] Error saving ECF analysis:', saveError);
              }

              ecfData = {
                fileName,
                cnpj: companyInfo.cnpj,
                period,
                type: 'ECF',
                data: processedData,
              };

              results.push(ecfData);
            } catch (processingError) {
              console.error('[ZIP] Error processing ECF:', processingError);
            }
          }
          // SPED Fiscal (ICMS/IPI)
          else if (content.includes('|0000|018|') ||
          content.includes('|0000|019|') || content.includes('|0000|SPED|2|11')) {
            console.log('[ZIP] Detected SPED Fiscal file');
            
            try {
              const processedData = processSpedFiscal(content);
              
              if (!processedData) {
                console.error('[ZIP] processSpedFiscal returned null or undefined');
                continue;
              }
              
              console.log('[ZIP] SPED Fiscal processed data:', 
                JSON.stringify(processedData).substring(0, 300) + '...');
              
              try {
                const saveResult = await saveAnalysisToSupabase(
                  companyInfo.cnpj,
                  period.month,
                  period.year,
                  processedData,
                  fileName,
                  'SPED_FISCAL',
                  clienteId || undefined
                );
                
                console.log('[ZIP] Save SPED Fiscal analysis result:', saveResult);
              } catch (saveError) {
                console.error('[ZIP] Error saving SPED Fiscal analysis:', saveError);
              }

              spedFiscalData = {
                fileName,
                cnpj: companyInfo.cnpj,
                period,
                type: 'SPED_FISCAL',
                data: processedData,
              };

              results.push(spedFiscalData);
            } catch (processingError) {
              console.error('[ZIP] Error processing SPED Fiscal:', processingError);
            }
          } else {
            console.log('[ZIP] Unknown SPED file type, content preview:', 
              content.substring(0, 300) + '...');
          }
        } catch (fileError) {
          console.error('[ZIP] Error processing file:', fileName, fileError);
        }
      }
    }

    // Second pass: Process all PDF files (not just when SPED was processed)
    for (const fileName in zipContent.files) {
      if (
        !zipContent.files[fileName].dir &&
        fileName.toLowerCase().endsWith('.pdf')
      ) {
        console.log('[ZIP] Processing PDF file:', fileName);

        const blob = await zipContent.files[fileName].async('blob');
        const pdfFile = new File([blob], fileName, { type: 'application/pdf' });

        try {
          // Verificar o tipo de PDF pelo nome ou conteúdo
          if (fileName.toLowerCase().includes('dctfweb')) {
            // Processar como DCTFWeb
            console.log('[ZIP] Processing DCTFWeb PDF:', fileName);

            const dctfWebData = await processDctfWebPdf(pdfFile);

            if (dctfWebData) {
              console.log(
                '[ZIP] Successfully processed DCTFWeb data from',
                fileName
              );

              // Salvar informações no Supabase
              if (dctfWebData.cnpj && dctfWebData.periodo) {
                const clienteResult = await saveCompanyToSupabase(
                  dctfWebData.cnpj,
                  (dctfWebData.nomeEmpresa || 'Empresa DCTFWeb')
                );

                if (clienteResult && clienteResult.id) {
                  try {
                    await saveAnalysisToSupabase(
                      dctfWebData.cnpj,
                      (dctfWebData.periodo).mes,
                      (dctfWebData.periodo).ano,
                      dctfWebData,
                      fileName,
                      'DCTFWEB',
                      clienteResult.id
                    );
                  } catch (saveError) {
                    const duplicateError = handleSaveAnalysisError(saveError);
                    if (duplicateError) {
                      return { results: [], duplicateError };
                    }
                    throw saveError;
                  }
                }
              }

              results.push({
                fileName,
                type: 'DCTFWEB',
                ...dctfWebData,
              });
            }
          } else if (fileName.toLowerCase().includes('dctf')) {
            // Processar como DCTF tradicional
            console.log('[ZIP] Processing DCTF PDF:', fileName);

            const dctfData = await processDctfPdf(pdfFile);

            if (dctfData) {
              console.log(
                '[ZIP] Successfully processed DCTF data from',
                fileName
              );

              // Salvar informações no Supabase
              if (dctfData.cnpj && dctfData.periodo) {
                const clienteResult = await saveCompanyToSupabase(
                  dctfData.cnpj,
                  (dctfData.nomeEmpresa || 'Empresa DCTF')
                );

                if (clienteResult && clienteResult.id) {
                  const dctfResult = await processAndSaveDctf(dctfData, fileName, clienteResult);
                  
                  if (dctfResult.duplicateError) {
                    return { results: [], duplicateError: dctfResult.duplicateError };
                  }
                  
                  if (dctfResult.success && dctfResult.result) {
                    results.push(dctfResult.result);
                  }
                }
              }
            }
          } else if (fileName.toLowerCase().includes('ecac') || 
                     fileName.toLowerCase().includes('pagamento') ||
                     fileName.toLowerCase().includes('relação') ||
                     fileName.toLowerCase().includes('relacao')) {
            // Processar como arquivo do eCAC/pagamentos
            console.log('[ZIP] Processing eCAC/Payment PDF:', fileName);

            // Primeiro, tentar extrair o CNPJ do arquivo para buscar o cliente
            let clientesId;
            try {
              const arrayBuffer = await pdfFile.arrayBuffer();
              const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
              let allTextContent = '';
              for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const pageText = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
                allTextContent += pageText + '\n';
              }
              
              console.log('[ZIP] Texto extraído do eCAC PDF:', allTextContent.substring(0, 200) + '...');
              
              // Tentar extrair CNPJ do texto
              const cnpjMatch = allTextContent.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
              if (cnpjMatch) {
                const cnpj = cnpjMatch[1].replace(/[^\d]/g, '');
                console.log(`[ZIP] CNPJ encontrado no PDF eCAC: ${cnpj}`);
                
                // Buscar cliente por CNPJ
                const token = getAuthToken();
                if (token) {
                  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
                  const clienteResponse = await fetch(
                    `${baseUrl}/auditoria/clientes/por-cnpj/${cnpj}?company_id=${getSelectedCompanyId()}`,
                    {
                      headers: {
                        'Authorization': `Bearer ${token}`
                      }
                    }
                  );

                  if (clienteResponse.ok) {
                    const clientes = await clienteResponse.json();
                    if (clientes && clientes.length > 0) {
                      clientesId = clientes[0].id;
                      console.log(`[ZIP] Cliente encontrado para eCAC: ${clientesId}`);
                    }
                  }
                }
              }
            } catch (error) {
              console.warn('[ZIP] Erro ao extrair CNPJ do PDF eCAC:', error);
            }

            try {
              const paymentData = await processEcacPdf(pdfFile, clientesId);

              if (paymentData && paymentData.length > 0) {
                console.log(
                  `[ZIP] Successfully extracted ${paymentData.length} payment records from ${fileName}`
                );

                // Adicione os dados de pagamento aos resultados
                // Para que seja reconhecido como resultado válido, adicionar period e cnpj
                const firstPayment = paymentData[0];
                results.push({
                  fileName,
                  type: 'PDF_PAYMENTS',
                  paymentData,
                  period: { mes: firstPayment.mes, ano: firstPayment.ano },
                  cnpj: firstPayment.cnpj,
                });
              } else {
                console.log(`[ZIP] No payment data found in ${fileName}`);
              }
            } catch (ecacError) {
              console.error(`[ZIP] Error processing eCAC PDF ${fileName}:`, ecacError);
              // Se for erro de duplicação, retornar informação sobre ele
              if (ecacError instanceof Error && ecacError.message?.includes('Já existe uma análise')) {
                return { results: [], duplicateError: ecacError.message };
              }
              // Para outros erros, continuar o processamento
            }
          } else {
            // Tentar detectar o tipo de PDF pelo conteúdo usando função específica para DCTF
            const pdfText = await extractTextFromDctfPdf(pdfFile);

            if (pdfText.includes('DCTFWeb') || pdfText.includes('DCTF Web')) {
              // Não há processamento de DCTFWeb pois foi removido o ecacProcessor
              console.log('[ZIP] DCTFWeb detectado, mas processamento removido (ecacProcessor excluído)');
            } else if (isDctfDocument(pdfText)) {
              // Processar como DCTF tradicional
              const dctfData = extractDctfData(pdfText);

              if (dctfData) {
                console.log(
                  '[ZIP] Detected and processed DCTF data from',
                  fileName
                );

                // Salvar informações no Supabase
                if (dctfData.cnpj && dctfData.periodo) {
                  const clienteResult = await saveCompanyToSupabase(
                    dctfData.cnpj,
                    (dctfData.nomeEmpresa || 'Empresa DCTF')
                  );

                  if (clienteResult && clienteResult.id) {
                    const dctfResult = await processAndSaveDctf(dctfData, fileName, clienteResult);
                    
                    if (dctfResult.duplicateError) {
                      return { results: [], duplicateError: dctfResult.duplicateError };
                    }
                    
                    if (dctfResult.success && dctfResult.result) {
                      results.push(dctfResult.result);
                    }
                  }
                }
              }
            } else {
              // Processar como um PDF do eCAC normalmente
              // Primeiro, tentar extrair o CNPJ do arquivo para buscar o cliente
              let clientesId;
              try {
                const arrayBuffer = await pdfFile.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let allTextContent = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                  const page = await pdf.getPage(i);
                  const content = await page.getTextContent();
                  const pageText = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
                  allTextContent += pageText + '\n';
                }
                
                // Tentar extrair CNPJ do texto
                const cnpjMatch = allTextContent.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
                if (cnpjMatch) {
                  const cnpj = cnpjMatch[1].replace(/[^\d]/g, '');
                  console.log(`[ZIP] CNPJ encontrado no PDF: ${cnpj}`);
                  
                  // Buscar cliente por CNPJ
                  const token = getAuthToken();
                  if (token) {
                    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
                    const clienteResponse = await fetch(
                      `${baseUrl}/auditoria/clientes/por-cnpj/${cnpj}?company_id=${getSelectedCompanyId()}`,
                      {
                        headers: {
                          'Authorization': `Bearer ${token}`
                        }
                      }
                    );

                    if (clienteResponse.ok) {
                      const clientes = await clienteResponse.json();
                      if (clientes && clientes.length > 0) {
                        clientesId = clientes[0].id;
                        console.log(`[ZIP] Cliente encontrado: ${clientesId}`);
                      }
                    }
                  }
                }
              } catch (error) {
                console.warn('[ZIP] Erro ao extrair CNPJ do PDF:', error);
              }

              try {
                const paymentData = await processEcacPdf(pdfFile, clientesId);

                if (paymentData && paymentData.length > 0) {
                  console.log(
                    `[ZIP] Successfully extracted ${paymentData.length} payment records from ${fileName}`
                  );

                  // Adicione os dados de pagamento aos resultados
                  results.push({
                    fileName,
                    type: 'PDF_PAYMENTS',
                    paymentData,
                  });
                } else {
                  console.log(`[ZIP] No payment data found in ${fileName}`);
                }
              } catch (ecacError) {
                console.error(`[ZIP] Error processing eCAC PDF ${fileName}:`, ecacError);
                // Se for erro de duplicação, retornar informação sobre ele
                if (ecacError instanceof Error && ecacError.message?.includes('Já existe uma análise')) {
                  return { results: [], duplicateError: ecacError.message };
                }
                // Para outros erros, continuar o processamento
              }
            }
          }
        } catch (error) {
          console.error(`[ZIP] Error processing PDF ${fileName}:`, error);
        }
      }
    }

    return { results };
  } catch (error) {
    console.error('[ZIP] Error processing file:', error);
    return { results }; // Retornar resultados parciais em vez de lançar erro
  }
};
