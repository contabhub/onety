const express = require('express');
const router = express.Router();
const multer = require('multer');

// Polyfill para DOMMatrix no Node.js
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor(init) {
      if (init) {
        this.a = init.a || 1;
        this.b = init.b || 0;
        this.c = init.c || 0;
        this.d = init.d || 1;
        this.e = init.e || 0;
        this.f = init.f || 0;
      } else {
        this.a = 1;
        this.b = 0;
        this.c = 0;
        this.d = 1;
        this.e = 0;
        this.f = 0;
      }
    }
  };
}

const pdfParse = require('pdf-parse');
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

/** Extrai linha digitável ou dados PIX de texto extraído do PDF */
function extractBoletoData(text) {
  // Remove quebras de linha e espaços extras
  const cleanText = text.replace(/\s+/g, '');
  
  // 1. Tentar encontrar linha digitável tradicional (47 dígitos)
  const patterns = [
    /(\d{4}\.\d{5}\.\d{10}\.\d{11}\.\d{11}\.\d{11}\.\d{11}\.\d{11})/g,
    /(\d{47})/g,
    /(\d{4}\d{5}\d{10}\d{11}\d{11}\d{11}\d{11}\d{11})/g
  ];
  
  for (const pattern of patterns) {
    const matches = cleanText.match(pattern);
    if (matches && matches.length > 0) {
      const linha = matches[0].replace(/[^\d]/g, '');
      if (linha.length === 47) {
        return { tipo: 'linha_digitavel', valor: linha };
      }
    }
  }
  
  // 2. Tentar extrair dados de boletos (PIX e tradicionais)
  const boletoPatterns = {
    valor: /R\$\s*([\d,]+\.?\d*)/i,
    beneficiario: /(?:Quem vai receber|Beneficiário|Beneficiário Final):\s*([^\n\r]+)/i,
    pagador: /(?:Pagador|Pagador Final):\s*([^\n\r]+)/i,
    cnpj_cpf_beneficiario: /(?:CNPJ\/CPF|CNPJ|CPF):\s*([\d\.\-]+)/gi,
    cnpj_cpf_pagador: /(?:CNPJ\/CPF|CNPJ|CPF):\s*([\d\.\-]+)/gi
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
      boletoData.valor = parseFloat(valorMatch[1].replace(',', '.'));
      console.log('[DEBUG] Valor extraído:', boletoData.valor);
    }
    
    // Extrair beneficiário - tentar múltiplos padrões
    let beneficiarioMatch = text.match(boletoPatterns.beneficiario);
    if (beneficiarioMatch) {
      boletoData.beneficiario = beneficiarioMatch[1].trim();
      console.log('[DEBUG] Beneficiário extraído:', boletoData.beneficiario);
    } else {
      // Tentar padrão alternativo
      const altBeneficiarioMatch = text.match(/(?:Beneficiário Final|Beneficiario Final)\s*([^\n\r]+)/i);
      if (altBeneficiarioMatch) {
        boletoData.beneficiario = altBeneficiarioMatch[1].trim();
        console.log('[DEBUG] Beneficiário extraído (padrão alternativo):', boletoData.beneficiario);
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
    
    // Extrair CNPJ/CPF do beneficiário
    const cnpjBeneficiarioMatches = [...text.matchAll(boletoPatterns.cnpj_cpf_beneficiario)];
    if (cnpjBeneficiarioMatches.length > 0) {
      boletoData.cnpj_cpf_beneficiario = cnpjBeneficiarioMatches[0][1];
      console.log('[DEBUG] CNPJ/CPF Beneficiário extraído:', boletoData.cnpj_cpf_beneficiario);
    }
    
    // Extrair CNPJ/CPF do pagador
    const cnpjPagadorMatches = [...text.matchAll(boletoPatterns.cnpj_cpf_pagador)];
    if (cnpjPagadorMatches.length > 1) { // Segundo match geralmente é do pagador
      boletoData.cnpj_cpf_pagador = cnpjPagadorMatches[1][1];
      console.log('[DEBUG] CNPJ/CPF Pagador extraído:', boletoData.cnpj_cpf_pagador);
    }
    
    console.log('[DEBUG] Dados de boleto extraídos:', boletoData);
    return boletoData;
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
    const { company_id, user_id = null, status = 'draft' } = req.query;
    
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

    // Extrair texto do PDF
    const pdfData = await pdfParse(req.file.buffer);
    const pdfText = pdfData.text;
    
    // Extrair dados do boleto (linha digitável ou PIX)
    const boletoData = extractBoletoData(pdfText);
    
    if (!boletoData) {
      return res.status(400).json({ 
        error: 'Não foi possível extrair dados do boleto no PDF.',
        pdfText: pdfText.substring(0, 500) + '...' // Primeiros 500 chars para debug
      });
    }

    const nowISO = new Date().toISOString().slice(0,19).replace('T',' ');
    const pdfBase64 = pdfToBase64(req.file.buffer);

    let form, boletoMeta, linhaDigitavel;

    if (boletoData.tipo === 'linha_digitavel') {
      // Processar boleto tradicional
      const parsed = parseLinhaDigitavel47(boletoData.valor);
      boletoMeta = parsed;
      linhaDigitavel = boletoData.valor;
      
      form = {
        conta_id: null,
        empresa_id: company_id,
        tipo,
        valor: parsed.valor,
        descricao: `Boleto ${parsed.bank_code} - ${parsed.barcode.slice(0,5)}... (Pagador: ${boletoData.pagador || 'N/A'})`,
        data_transacao: nowISO,
        origem: 'boleto',
        data_vencimento: parsed.data_vencimento,
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
    } else if (boletoData.tipo === 'pix' || boletoData.tipo === 'boleto_tradicional') {
      // Processar boleto PIX ou tradicional com dados extraídos
      boletoMeta = boletoData;
      linhaDigitavel = boletoData.tipo === 'pix' ? `PIX_${Date.now()}` : `BOLETO_${Date.now()}`;
      
      form = {
        conta_id: null,
        empresa_id: company_id,
        tipo,
        valor: boletoData.valor || 0,
        descricao: `${boletoData.tipo === 'pix' ? 'Boleto PIX' : 'Boleto Tradicional'} - ${boletoData.beneficiario || 'Beneficiário não identificado'} (Pagador: ${boletoData.pagador || 'N/A'})`,
        data_transacao: nowISO,
        origem: boletoData.tipo === 'pix' ? 'boleto_pix' : 'boleto',
        data_vencimento: null, // PIX geralmente não tem vencimento
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
        form.centro_de_custo_id || null,
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