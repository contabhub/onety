const express = require('express');
const router = express.Router();
const multer = require('multer');

// Garante polyfills necessários antes de carregar pdf-parse
require('../../lib/nodeCanvasPolyfills');

let pdfParse;
try {
  pdfParse = require('pdf-parse');
} catch (error) {
  console.error('Erro ao importar pdf-parse:', error);
  pdfParse = null;
}
const pool = require('../../config/database');
const verifyToken = require('../../middlewares/auth');

// Configuração do multer para upload de PDFs
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PDF são permitidos.'), false);
    }
  },
});

/** Parser FEBRABAN 47 dígitos (bancário) */
function parseLinhaDigitavel47(linhaDigitavelRaw) {
  const onlyDigits = String(linhaDigitavelRaw || '').replace(/\D/g, '');
  if (onlyDigits.length !== 47) throw new Error('Linha digitável inválida (47 dígitos).');

  const campo1 = onlyDigits.slice(0, 9);
  const dv1    = onlyDigits.slice(9, 10);
  const campo2 = onlyDigits.slice(10, 20);
  const dv2    = onlyDigits.slice(20, 21);
  const campo3 = onlyDigits.slice(21, 31);
  const dv3    = onlyDigits.slice(31, 32);
  const dvGeral = onlyDigits.slice(32, 33);
  const fatorVencimento = onlyDigits.slice(33, 37);
  const valorStr = onlyDigits.slice(37, 47);

  const bankCode = campo1.slice(0, 3);
  const currencyCode = campo1.slice(3, 4);
  const freeField = campo1.slice(4) + campo2 + campo3;
  const barcode = bankCode + currencyCode + dvGeral + fatorVencimento + valorStr + freeField;
  if (barcode.length !== 44) throw new Error('Falha ao montar código de barras.');

  const valor = Number.parseInt(valorStr, 10) / 100;
  const fator = Number.parseInt(fatorVencimento, 10);
  let data_vencimento = null;
  if (!Number.isNaN(fator) && fator > 0) {
    const base = new Date(Date.UTC(1997, 9, 7));
    base.setUTCDate(base.getUTCDate() + fator);
    data_vencimento = base.toISOString().slice(0, 10);
  }

  return {
    bank_code: bankCode,
    currency_code: currencyCode,
    dv_barcode: dvGeral,
    fator_vencimento: fatorVencimento,
    valor,
    data_vencimento,
    barcode,
    linha_digitavel: onlyDigits
  };
}

/** Parser 48 dígitos (arrecadação/concessionárias)
 * Observação: o padrão de montagem do código de barras para 48 dígitos difere e varia por segmento.
 * Para fins práticos, retornamos os blocos e a linha digitável limpa, permitindo identificação correta do código.
 */
function parseLinhaDigitavel48(linhaDigitavelRaw) {
  const onlyDigits = String(linhaDigitavelRaw || '').replace(/\D/g, '');
  if (onlyDigits.length !== 48) throw new Error('Linha digitável inválida (48 dígitos).');

  // Blocos de 12 dígitos (formato comum de exibição)
  const blocos = [
    onlyDigits.slice(0, 12),
    onlyDigits.slice(12, 24),
    onlyDigits.slice(24, 36),
    onlyDigits.slice(36, 48)
  ];

  return {
    tipo: 'arrecadacao',
    blocos,
    linha_digitavel: onlyDigits
  };
}

/** Extrai linha digitável ou dados PIX de texto extraído do PDF */
function extractBoletoData(text) {
  // Remove quebras de linha e espaços extras
  const cleanText = text.replace(/\s+/g, '');
  const rawText = text; // mantém original para buscas alternativas
  
  // 1. Detectar linha digitável FEBRABAN (47) ou arrecadação (48)
  // Aceita tanto compacta quanto pontuada/espacada
  const pattern47 = /(\d[\d\.\s-]{45,})/g; // tolerante para pegar formatos com pontos
  const pattern48 = /(\d[\d\.\s-]{46,})/g;

  const candidates = [];
  for (const m of cleanText.matchAll(pattern47)) {
    const digits = String(m[0]).replace(/[^\d]/g, '');
    if (digits.length === 47) candidates.push({ len: 47, digits });
  }
  for (const m of cleanText.matchAll(pattern48)) {
    const digits = String(m[0]).replace(/[^\d]/g, '');
    if (digits.length === 48) candidates.push({ len: 48, digits });
  }

  // Busca adicional no texto bruto por sequências cruas de 47/48 dígitos
  const raw47 = [...rawText.matchAll(/(\d{47})/g)].map(m => m[1]);
  const raw48 = [...rawText.matchAll(/(\d{48})/g)].map(m => m[1]);
  raw47.forEach(d => candidates.push({ len: 47, digits: d }));
  raw48.forEach(d => candidates.push({ len: 48, digits: d }));

  // Ordena priorizando 47 (bancário) e depois 48 (arrecadação), e por ordem de aparição
  if (candidates.length > 0) {
    const selected = candidates.sort((a, b) => a.len - b.len)[0];
    if (selected.len === 47) {
      return { tipo: 'linha_digitavel_47', valor: selected.digits };
    }
    if (selected.len === 48) {
      return { tipo: 'linha_digitavel_48', valor: selected.digits };
    }
  }
  
  // 2. Tentar extrair dados de boletos (PIX e tradicionais) por palavras-chave
  const boletoPatterns = {
    // Valor em PT-BR: permite milhares com ponto e decimais com vírgula
    valor: /R\$\s*([0-9\.,]+)/i,
    beneficiario: /(?:Quem\s+vai\s+receber|Nome\s+do\s+Benefici[áa]rio|NOME\s+DO\s+BENEFICI[ÁA]RIO|Benefici[áa]rio(?:\s*Final)?|BENEFICI[ÁA]RIO)\s*[:\-–]?\s*([^\r\n]+)/i,
    pagador: /(?:Pagador|Pagador Final):\s*([^\n\r]+)/i,
    // CNPJ estritamente formatado: xx.xxx.xxx/xxxx-xx
    cnpj_formatado: /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/g,
    // Data de vencimento (dd/mm/yyyy) próxima a palavras-chave
    // Captura imediata após o rótulo ou em até 50 caracteres seguintes
    vencimentoLabel: /(data\s*de\s*vencimento|vencimento)/i,
    dataBR: /(\b[0-3]?\d\/[01]?\d\/\d{4}\b)/
  };
  
  // Verificar se tem dados de pagador/beneficiário (boleto tradicional ou PIX)
  const hasPagador = text.toLowerCase().includes('pagador');
  const hasBeneficiario = text.toLowerCase().includes('beneficiário') || text.toLowerCase().includes('beneficiario');
  const hasPixKeywords = text.toLowerCase().includes('pix') || text.toLowerCase().includes('boleto pix');
  
  if (hasPagador || hasBeneficiario || hasPixKeywords) {
    console.log('[DEBUG] Extraindo dados de boleto do texto:', text.substring(0, 500));
    
    const boletoData = {
      tipo: hasPixKeywords ? 'pix' : 'boleto_tradicional',
      valor: null,
      beneficiario: null,
      pagador: null,
      cnpj_cpf_beneficiario: null,
      cnpj_cpf_pagador: null
    };
    
    // Extrair valor
    const valorMatch = text.match(boletoPatterns.valor);
    if (valorMatch) {
      const raw = valorMatch[1];
      // Normaliza formato brasileiro: remove separador de milhar "." e troca "," por "."
      const normalized = raw.replace(/\./g, '').replace(',', '.');
      const parsed = parseFloat(normalized);
      if (!Number.isNaN(parsed)) {
        boletoData.valor = parsed;
      }
      console.log('[DEBUG] Valor extraído:', boletoData.valor);
    }
    
    // Extrair beneficiário - tentar múltiplos padrões
    let beneficiarioMatch = text.match(boletoPatterns.beneficiario);
    if (beneficiarioMatch) {
      boletoData.beneficiario = beneficiarioMatch[1].trim();
      console.log('[DEBUG] Beneficiário extraído:', boletoData.beneficiario);
    } else {
      // Alternativa: localizar o rótulo e capturar o texto ao lado/abaixo até a próxima quebra/label comum
      const labelRegex = /(Nome\s+do\s+Benefici[áa]rio|NOME\s+DO\s+BENEFICI[ÁA]RIO|Benefici[áa]rio(?:\s*Final)?|BENEFICI[ÁA]RIO)/i;
      const label = text.match(labelRegex);
      if (label) {
        const start = text.toLowerCase().indexOf(label[0].toLowerCase());
        if (start !== -1) {
          const after = text.slice(start + label[0].length, start + label[0].length + 200)
            .replace(/^\s*[:\-–]?\s*/, '');
          console.log('[DEBUG] Texto após rótulo beneficiário:', after.substring(0, 100));
          
          // Corta ao encontrar outro rótulo comum
          const stopper = /(\r?\n|Pagador|CNPJ|CPF|Valor|R\$|Ag[êe]ncia|Conta|Linha\s*Digit[aá]vel|Data\s+de\s+Vencimento)/i;
          let cut = after.split(stopper)[0];
          
          // Se vazio, tenta pegar a primeira linha não vazia logo abaixo do rótulo
          if (!cut || /^\s*$/.test(cut)) {
            const lineBelow = after.match(/(?:^|\r?\n)\s*([^\r\n]{3,})/);
            if (lineBelow) {
              cut = lineBelow[1];
            }
          }
          
          const candidate = (cut || '').replace(/[\r\n]+/g, ' ').trim();
          console.log('[DEBUG] Candidato beneficiário:', candidate);
          
          if (candidate && candidate.length > 3) {
            boletoData.beneficiario = candidate;
            console.log('[DEBUG] Beneficiário extraído (adjacente ao rótulo):', boletoData.beneficiario);
          }
        }
      }
    }
    
    // Extrair pagador - tentar múltiplos padrões
    let pagadorMatch = text.match(boletoPatterns.pagador);
    if (pagadorMatch) {
      boletoData.pagador = pagadorMatch[1].trim();
      console.log('[DEBUG] Pagador extraído:', boletoData.pagador);
    } else {
      // Tentar padrão alternativo
      const altPagadorMatch = text.match(/(?:Pagador|Pagador Final)\s*([^\n\r]+)/i);
      if (altPagadorMatch) {
        boletoData.pagador = altPagadorMatch[1].trim();
        console.log('[DEBUG] Pagador extraído (padrão alternativo):', boletoData.pagador);
      }
    }
    
    // Extrair CNPJs estritamente formatados
    const cnpjs = [...text.matchAll(boletoPatterns.cnpj_formatado)].map(m => m[1]);
    if (cnpjs.length > 0) {
      boletoData.cnpj_cpf_beneficiario = cnpjs[0];
      if (cnpjs[1]) boletoData.cnpj_cpf_pagador = cnpjs[1];
      console.log('[DEBUG] CNPJs extraídos:', cnpjs);
    }

    // Extrair data de vencimento próxima a labels
    // Estratégia 1: regex direta "(Vencimento|Data de Vencimento) : dd/mm/yyyy"
    const directVectoRegex = /(data\s*de\s*vencimento|vencimento)\s*[:\-–]?\s*([0-3]?\d\/[01]?\d\/\d{4})/i;
    const directMatch = text.match(directVectoRegex);
    let dataVencimentoBR = null;
    if (directMatch) {
      dataVencimentoBR = directMatch[2];
    } else {
      // Estratégia 2: localizar o rótulo e buscar dd/mm/yyyy nos próximos 50 chars
      const labelMatch = text.match(boletoPatterns.vencimentoLabel);
      if (labelMatch) {
        const idx = text.toLowerCase().indexOf(labelMatch[0].toLowerCase());
        if (idx !== -1) {
          const slice = text.slice(idx, idx + 120); // janela próxima ao label
          const dateNearby = slice.match(boletoPatterns.dataBR);
          if (dateNearby) dataVencimentoBR = dateNearby[1];
        }
      }
    }

    if (dataVencimentoBR) {
      const [d, m, y] = dataVencimentoBR.split('/').map((v) => v.padStart(2, '0'));
      // Validação simples de data e conversão para ISO yyyy-mm-dd
      const iso = `${y}-${m}-${d}`;
      boletoData.data_vencimento = iso;
      console.log('[DEBUG] Data de vencimento extraída (ISO):', iso);
    }
    
    console.log('[DEBUG] Dados de boleto extraídos:', boletoData);
    return boletoData;
  }

  // 3. Fallback: se encontrarmos valor e/ou vencimento, ainda retornamos como boleto_tradicional
  const valorFallback = text.match(boletoPatterns.valor);
  const vencLabel = text.match(boletoPatterns.vencimentoLabel);
  let dataVcto = null;
  if (vencLabel) {
    const idx = text.toLowerCase().indexOf(vencLabel[0].toLowerCase());
    if (idx !== -1) {
      const slice = text.slice(idx, idx + 120);
      const dateNearby = slice.match(boletoPatterns.dataBR);
      if (dateNearby) {
        const [d, m, y] = dateNearby[1].split('/').map(v => v.padStart(2, '0'));
        dataVcto = `${y}-${m}-${d}`;
      }
    }
  }
  if (valorFallback || dataVcto) {
    const raw = valorFallback ? valorFallback[1] : null;
    const normalized = raw ? raw.replace(/\./g, '').replace(',', '.') : null;
    const parsedValor = normalized ? parseFloat(normalized) : null;
    return {
      tipo: 'boleto_tradicional',
      valor: parsedValor ?? null,
      data_vencimento: dataVcto ?? null
    };
  }
  
  return null;
}

/** Converte PDF para base64 */
function pdfToBase64(pdfBuffer) {
  return pdfBuffer.toString('base64');
}

/** Parse JSON de forma segura */
function safeJsonParse(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.error('Erro ao fazer parse JSON:', error);
      return null;
    }
  }
  return null;
}

/** 1) Gera FORM (rascunho em memória do front ou já salva como draft) */
router.post('/form', verifyToken, async (req, res) => {
  try {
    const { linha_digitavel, company_id, tipo = 'saida', nome_arquivo } = req.body;
    if (!linha_digitavel) return res.status(400).json({ error: 'Envie "linha_digitavel".' });

    const parsed = parseLinhaDigitavel47(linha_digitavel);
    const nowISO = new Date().toISOString().slice(0,19).replace('T',' ');

    const form = {
      conta_id: null,
      empresa_id: company_id ?? null,
      tipo,
      valor: parsed.valor,
      descricao: `Boleto ${parsed.bank_code} - ${parsed.barcode.slice(0,5)}...`,
      data_transacao: nowISO,
      origem: 'boleto',
      data_vencimento: parsed.data_vencimento,
      situacao: 'em_aberto',
      observacao: '',
      parcelamento: 1,
      intervalo_parcelas: null,
      categoria_id: null,
      subcategoria_id: null,
      cliente_id: null,
      anexo: null,
      centro_custo_id: null,
      pluggy_transacao_id: null,
      boleto_id: null,
      nome_arquivo: nome_arquivo || null // Adicionar nome do arquivo
    };

    res.json({ form, boleto_meta: parsed });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || 'Erro ao processar boleto.' });
  }
});

/** 2) Salva/Atualiza rascunho no banco (idempotente via draft_id) */
router.post('/drafts', verifyToken, async (req, res) => {
  try {
    const {
      draft_id = null,
      user_id = null,
      company_id = null,
      linha_digitavel,
      boleto_meta,
      form,
      nome_arquivo
    } = req.body;

    if (!linha_digitavel || !boleto_meta || !form) {
      return res.status(400).json({ error: 'Envie linha_digitavel, boleto_meta e form.' });
    }

    // Adicionar nome do arquivo ao form se fornecido
    if (nome_arquivo && form) {
      form.nome_arquivo = nome_arquivo;
    }

    if (draft_id) {
      const [r] = await pool.query(
        `UPDATE boleto_drafts SET usuario_id=?, empresa_id=?, linha_digitavel=?, boleto_meta=?, formulario=?, atualizado_em=NOW()
         WHERE id=? AND status='rascunho'`,
        [user_id, company_id, linha_digitavel, JSON.stringify(boleto_meta), JSON.stringify(form), draft_id]
      );
      if (r.affectedRows === 0) return res.status(404).json({ error: 'Rascunho não encontrado ou finalizado.' });
      return res.json({ draft_id });
    }

    const [ins] = await pool.query(
      `INSERT INTO boleto_drafts (usuario_id, empresa_id, linha_digitavel, boleto_meta, formulario)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, company_id, linha_digitavel, JSON.stringify(boleto_meta), JSON.stringify(form)]
    );
    res.status(201).json({ draft_id: ins.insertId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao salvar rascunho.' });
  }
});

/** 3) Listar todos os rascunhos de boletos da empresa */
router.get('/drafts', verifyToken, async (req, res) => {
  try {
    const { company_id, user_id = null, status = 'rascunho' } = req.query;
    
    if (!company_id) {
      return res.status(400).json({ error: 'company_id é obrigatório.' });
    }

    let query = `
      SELECT 
        id,
        usuario_id,
        empresa_id,
        linha_digitavel,
        boleto_meta,
        formulario,
        status,
        criado_em,
        atualizado_em
      FROM boleto_drafts
      WHERE empresa_id = ?
    `;
    
    const params = [company_id];
    
    if (user_id) {
      query += ' AND usuario_id = ?';
      params.push(user_id);
    }
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY atualizado_em DESC';

    const [rows] = await pool.query(query, params);
    
    // Parse JSON fields
    const drafts = rows.map(row => ({
      ...row,
      boleto_meta: safeJsonParse(row.boleto_meta),
      form: safeJsonParse(row.formulario)
    }));

    res.json({
      total: drafts.length,
      drafts: drafts
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao buscar rascunhos.' });
  }
});

/** 4) Buscar último rascunho do usuário/empresa (para recuperar após refresh) */
router.get('/drafts/ultimo', verifyToken, async (req, res) => {
  try {
    const { user_id = null, company_id = null } = req.query;
    const [rows] = await pool.query(
      `SELECT * FROM boleto_drafts
       WHERE status='rascunho'
         AND ( (usuario_id IS NULL OR ? IS NULL) OR usuario_id = ? )
         AND ( (empresa_id IS NULL OR ? IS NULL) OR empresa_id = ? )
       ORDER BY atualizado_em DESC
       LIMIT 1`,
      [user_id, user_id, company_id, company_id]
    );
    if (!rows.length) return res.status(204).send(); // sem conteúdo
    
    const draft = rows[0];
    draft.boleto_meta = safeJsonParse(draft.boleto_meta);
    draft.form = safeJsonParse(draft.formulario);
    
    res.json(draft);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao buscar rascunho.' });
  }
});

/** 5) Ler/Apagar rascunho por id */
router.get('/drafts/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const [rows] = await pool.query(`SELECT * FROM boleto_drafts WHERE id=?`, [id]);
  if (!rows.length) return res.status(404).json({ error: 'Rascunho não encontrado.' });
  
  const draft = rows[0];
  draft.boleto_meta = safeJsonParse(draft.boleto_meta);
  draft.form = safeJsonParse(draft.formulario);
  
  res.json(draft);
});

router.delete('/drafts/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const [r] = await pool.query(`DELETE FROM boleto_drafts WHERE id=? AND status='rascunho'`, [id]);
  if (r.affectedRows === 0) return res.status(404).json({ error: 'Rascunho não encontrado.' });
  res.json({ message: 'Rascunho apagado.' });
});

/** 5.1) Atualizar rascunho existente */
router.put('/drafts/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { form } = req.body;
  
  try {
    if (!form) {
      return res.status(400).json({ error: 'form é obrigatório.' });
    }

    const [result] = await pool.query(
      `UPDATE boleto_drafts SET formulario = ?, atualizado_em = NOW() WHERE id = ? AND status = 'rascunho'`,
      [JSON.stringify(form), id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Rascunho não encontrado ou já finalizado.' });
    }

    res.json({ 
      message: 'Rascunho atualizado com sucesso.',
      draft_id: id 
    });
  } catch (error) {
    console.error('Erro ao atualizar rascunho:', error);
    res.status(500).json({ error: 'Erro ao atualizar rascunho.' });
  }
});

/** 6) Importar PDF de boleto e salvar como rascunho */
router.post('/importar-pdf', verifyToken, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo PDF enviado.' });
    }

    const { company_id, tipo = 'saida', user_id = null, nome_arquivo } = req.body;
    if (!company_id) {
      return res.status(400).json({ error: 'company_id é obrigatório.' });
    }

    // Verificar se pdfParse está disponível
    if (!pdfParse) {
      return res.status(500).json({ error: 'Biblioteca de parsing de PDF não disponível.' });
    }

    // Extrair texto do PDF
    const pdfData = await pdfParse(req.file.buffer);
    const pdfText = pdfData.text;
    // LOG: Texto completo extraído do PDF (delimitado)
    try {
      console.log('===== [DEBUG] PDF TEXT START =====');
      console.log(`[DEBUG] PDF TEXT LENGTH: ${pdfText?.length ?? 0}`);
      console.log(pdfText);
      console.log('===== [DEBUG] PDF TEXT END =====');
    } catch (e) {
      console.log('[DEBUG] Falha ao logar PDF text:', e?.message);
    }
    
    // Extrair dados do boleto (linha digitável ou PIX)
    const boletoData = extractBoletoData(pdfText);
    
    if (!boletoData) {
      return res.status(400).json({ 
        error: 'Não foi possível extrair dados do boleto no PDF.',
        pdfText: pdfText.substring(0, 500) + '...' // Primeiros 500 chars para debug
      });
    }

    // Log estruturado do resultado da extração
    try {
      console.log('[DEBUG] Resultado da extração do boleto:', JSON.stringify({
        tipo: boletoData.tipo,
        valor: boletoData.valor ?? null,
        beneficiario: boletoData.beneficiario ?? null,
        pagador: boletoData.pagador ?? null,
        cnpj_cpf_beneficiario: boletoData.cnpj_cpf_beneficiario ?? null,
        cnpj_cpf_pagador: boletoData.cnpj_cpf_pagador ?? null,
        data_vencimento: boletoData.data_vencimento ?? null,
        linha_digitavel: boletoData.valor?.length === 47 || boletoData.valor?.length === 48 ? boletoData.valor : undefined
      }, null, 2));
    } catch (e) {
      console.log('[DEBUG] Resultado da extração do boleto (safe):', boletoData);
    }

    const nowISO = new Date().toISOString().slice(0,19).replace('T',' ');
    const pdfBase64 = pdfToBase64(req.file.buffer);

    let form, boletoMeta, linhaDigitavel;

    if (boletoData.tipo === 'linha_digitavel_47') {
      // Processar boleto tradicional
      const parsed = parseLinhaDigitavel47(boletoData.valor);
      console.log('[DEBUG] Parsed 47 dígitos:', parsed);
      boletoMeta = parsed;
      linhaDigitavel = boletoData.valor;
      
      form = {
        conta_id: null,
        empresa_id: company_id,
        tipo,
        valor: typeof boletoData.valor === 'number' ? boletoData.valor : parsed.valor,
        descricao: `Boleto ${parsed.bank_code} - ${parsed.barcode.slice(0,5)}... (Pagador: ${boletoData.pagador || 'N/A'})`,
        data_transacao: nowISO,
        origem: 'boleto',
        // A partir daqui, não inferimos mais vencimento pelo fator; só usamos se veio do PDF
        data_vencimento: boletoData.data_vencimento || null,
        situacao: 'em_aberto',
        observacao: `Importado via PDF (Boleto Tradicional)
Beneficiário: ${boletoData.beneficiario || 'N/A'}
Pagador: ${boletoData.pagador || 'N/A'}
CNPJ/CPF Beneficiário: ${boletoData.cnpj_cpf_beneficiario || 'N/A'}
CNPJ/CPF Pagador: ${boletoData.cnpj_cpf_pagador || 'N/A'}
Valor: R$ ${boletoData.valor || parsed.valor || 'N/A'}`,
        parcelamento: 1,
        intervalo_parcelas: null,
        categoria_id: null,
        subcategoria_id: null,
        cliente_id: null,
        anexo: pdfBase64,
        centro_custo_id: null,
        pluggy_transacao_id: null,
        boleto_id: null,
        nome_arquivo: nome_arquivo || req.file.originalname // Adicionar nome do arquivo
      };
    } else if (boletoData?.tipo === 'linha_digitavel_48') {
      // Arrecadação/concessionárias: manter os blocos e a linha para identificação
      const parsed48 = parseLinhaDigitavel48(boletoData.valor);
      console.log('[DEBUG] Parsed 48 dígitos (arrecadação):', parsed48);
      boletoMeta = parsed48;
      linhaDigitavel = boletoData.valor;

      form = {
        conta_id: null,
        empresa_id: company_id,
        tipo,
        valor: boletoData.valor || 0,
        descricao: `Boleto Arrecadação - ${parsed48.blocos[0].slice(0,5)}...`,
        data_transacao: nowISO,
        origem: 'boleto_arrecadacao',
        data_vencimento: null,
        situacao: 'em_aberto',
        observacao: `Importado via PDF (Boleto Arrecadação)\nLinha digitável: ${parsed48.linha_digitavel}`,
        parcelamento: 1,
        intervalo_parcelas: null,
        categoria_id: null,
        subcategoria_id: null,
        cliente_id: null,
        anexo: pdfBase64,
        centro_custo_id: null,
        pluggy_transacao_id: null,
        boleto_id: null,
        nome_arquivo: nome_arquivo || req.file.originalname
      };
    } else if (boletoData.tipo === 'pix' || boletoData.tipo === 'boleto_tradicional') {
      // Processar boleto PIX ou tradicional com dados extraídos
      boletoMeta = boletoData;
      linhaDigitavel = boletoData.tipo === 'pix' ? `PIX_${Date.now()}` : `BOLETO_${Date.now()}`;
      
      form = {
        conta_id: null,
        empresa_id: company_id,
        tipo,
        valor: typeof boletoData.valor === 'number' ? boletoData.valor : 0,
        descricao: `${boletoData.tipo === 'pix' ? 'Boleto PIX' : 'Boleto Tradicional'} - ${boletoData.beneficiario || 'Beneficiário não identificado'} (Pagador: ${boletoData.pagador || 'N/A'})`,
        data_transacao: nowISO,
        origem: boletoData.tipo === 'pix' ? 'boleto_pix' : 'boleto',
        data_vencimento: boletoData.data_vencimento || null, // PIX geralmente não tem vencimento
        situacao: 'em_aberto',
        observacao: `Importado via PDF (${boletoData.tipo === 'pix' ? 'Boleto PIX' : 'Boleto Tradicional'})
Beneficiário: ${boletoData.beneficiario || 'N/A'}
Pagador: ${boletoData.pagador || 'N/A'}
CNPJ/CPF Beneficiário: ${boletoData.cnpj_cpf_beneficiario || 'N/A'}
CNPJ/CPF Pagador: ${boletoData.cnpj_cpf_pagador || 'N/A'}
Valor: R$ ${boletoData.valor || 'N/A'}
Tipo: ${boletoData.tipo}`,
        parcelamento: 1,
        intervalo_parcelas: null,
        categoria_id: null,
        subcategoria_id: null,
        cliente_id: null,
        anexo: pdfBase64,
        centro_custo_id: null,
        pluggy_transacao_id: null,
        boleto_id: null,
        nome_arquivo: nome_arquivo || req.file.originalname // Adicionar nome do arquivo
      };
    }

    // Log resumido do formulário que será salvo
    try {
      console.log('[DEBUG] Form para salvar draft (resumo):', JSON.stringify({
        descricao: form.descricao,
        valor: form.valor,
        data_vencimento: form.data_vencimento,
        origem: form.origem,
        empresa_id: form.empresa_id
      }, null, 2));
    } catch (e) {}

    // Salvar como rascunho na tabela boleto_drafts
    const [result] = await pool.query(
      `INSERT INTO boleto_drafts (usuario_id, empresa_id, linha_digitavel, boleto_meta, formulario)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, company_id, linhaDigitavel, JSON.stringify(boletoMeta), JSON.stringify(form)]
    );

    res.status(201).json({
      draft_id: result.insertId,
      message: `Boleto salvo como rascunho (${boletoData.tipo === 'pix' ? 'PIX' : 'Tradicional'}).`,
      boleto_meta: boletoMeta,
      tipo_boleto: boletoData.tipo,
      form: form,
      ...(boletoData.tipo === 'linha_digitavel' && { linha_digitavel: boletoData.valor })
    });

  } catch (error) {
    console.error('Erro ao importar PDF:', error);
    
    if (error.message === 'Apenas arquivos PDF são permitidos.') {
      return res.status(400).json({ error: error.message });
    }
    
    if (error.message.includes('Linha digitável inválida')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Erro ao processar PDF do boleto.' });
  }
});

/** 6) Finalizar: cria a transação usando O MESMO formato do seu POST /transacoes e marca o draft */
router.post('/drafts/:id/finalizar', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [[draft]] = await pool.query(`SELECT * FROM boleto_drafts WHERE id=? AND status='rascunho'`, [id]);
    if (!draft) return res.status(404).json({ error: 'Rascunho não encontrado.' });

    const form = safeJsonParse(draft.formulario);
    // Insere em transacoes com criado_em = NOW() (igual sua rota atual)
    const [result] = await pool.query(
      `
      INSERT INTO transacoes (
        conta_id, empresa_id, tipo, valor, descricao, data_transacao, origem,
        data_vencimento, situacao, observacao, parcelamento, intervalo_parcelas,
        categoria_id, subcategoria_id, cliente_id,
        anexo, centro_custo_id,
        pluggy_transacao_id,
        boleto_id,
        criado_em
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        form.conta_id,
        form.empresa_id,
        form.tipo,
        form.valor,
        form.descricao,
        form.data_transacao,
        form.origem,
        form.data_vencimento,
        form.situacao,
        form.observacao,
        form.parcelamento,
        form.intervalo_parcelas,
        form.categoria_id,
        form.subcategoria_id || null,
        form.cliente_id || null,
        form.anexo || null,
        form.centro_custo_id || null,
        form.pluggy_transacao_id || null,
        form.boleto_id || null
      ]
    );

    await pool.query(`UPDATE boleto_drafts SET status='finalizado', atualizado_em=NOW() WHERE id=?`, [id]);
    // Dica: você já tem endpoint para pegar codigo_solicitacao/token do Inter depois, se quiser exibir PDF.

    res.status(201).json({
      transacao_id: result.insertId,
      message: 'Transação criada a partir do rascunho.'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao finalizar rascunho.' });
  }
});

// Middleware para tratar erros do multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: "Arquivo muito grande. Tamanho máximo: 10MB." });
    }
  }
  next(error);
});

module.exports = router; 