// Serviço de matching entre conteúdo extraído do viewer e atividades/pdf_layout

function removeDiacritics(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/\p{Diacritic}+/gu, '');
}

function normalizeText(str) {
  return removeDiacritics(String(str || '').toLowerCase()).replace(/\s+/g, ' ').trim();
}

function onlyDigits(str) {
  return String(str || '').replace(/\D+/g, '');
}

function normalizeCnpj(cnpj) {
  const d = onlyDigits(cnpj);
  return d.length === 14 ? d : d.padStart(14, '0');
}

function extractCnpjCandidates(text) {
  const out = new Set();
  const regex = /(\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\/]?\d{4}[-\s]?\d{2})/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    out.add(normalizeCnpj(m[1]));
  }
  return Array.from(out);
}

function extractPeriodo(text) {
  // Tenta capturar padrões tipo 01/08/2025 - 31/08/2025 e também mm/yyyy
  const result = {};
  const periodo = text.match(/(\d{2})\/(\d{2})\/(\d{4})\s*[-–]\s*(\d{2})\/(\d{2})\/(\d{4})/);
  if (periodo) {
    result.start = { d: periodo[1], m: periodo[2], y: periodo[3] };
    result.end = { d: periodo[4], m: periodo[5], y: periodo[6] };
  }
  const mmYYYY = text.match(/(0?[1-9]|1[0-2])\/(\d{4})/);
  if (mmYYYY) {
    result.month = parseInt(mmYYYY[1], 10);
    result.year = parseInt(mmYYYY[2], 10);
  }
  return result;
}

function competenciaKeyFromPeriodo(per) {
  const month = per?.end?.m || per?.month;
  const year = per?.end?.y || per?.year;
  if (!month || !year) return null;
  return `${year}-${String(month).padStart(2,'0')}`;
}

function testCampoAgainstText(campo, text) {
  const ntext = normalizeText(text);
  const esperado = normalizeText(campo.valor_esperado || '');
  if (campo.regex_validacao) {
    try {
      const re = new RegExp(campo.regex_validacao, 'i');
      return re.test(text);
    } catch (_) {
      // fallback para contains
    }
  }
  if (esperado) {
    return ntext.includes(esperado);
  }
  return false;
}

function matchExtractionToAtividade(extraction, atividade) {
  if (!extraction?.ok) {
    return { ok: false, reason: 'no_extraction' };
  }
  const text = extraction.text || '';
  const textNorm = normalizeText(text);

  // 1) Título sugerido
  let score = 0;
  if (atividade.pdf_titulo_documento) {
    const tit = normalizeText(atividade.pdf_titulo_documento);
    if (textNorm.includes(tit)) score += 1;
  }

  // 2) CNPJ do cliente
  const cnpjAtv = normalizeCnpj(atividade.cliente_cnpj || '');
  const cnpjs = extractCnpjCandidates(text);
  const cnpjOk = cnpjs.includes(cnpjAtv);
  const matchedCnpj = cnpjOk ? cnpjAtv : null;
  if (cnpjOk) score += 2;

  // 3) Competência comparando com período/mes/ano
  const per = extractPeriodo(text);
  const keyFromPdf = competenciaKeyFromPeriodo(per);
  const keyAtividade = `${atividade.ano_referencia}-${String(atividade.mes_referencia).padStart(2,'0')}`;
  const compOk = keyFromPdf === keyAtividade;
  if (compOk) score += 2;

  // 4) Campos do layout
  let camposOkCount = 0;
  for (const campo of (atividade.pdf_campos || [])) {
    if (testCampoAgainstText(campo, text)) camposOkCount += 1;
  }
  if (camposOkCount > 0) score += 1 + Math.min(2, camposOkCount);

  // Regra ajustada: se o CNPJ do cliente for encontrado, consideramos match suficiente
  // (competência e campos contribuem para score/telemetria, mas não bloqueiam).
  const ok = cnpjOk;
  return {
    ok,
    score,
    details: { cnpjOk, matchedCnpj, compOk, keyFromPdf, keyAtividade, camposOkCount, cnpjs }
  };
}

module.exports = {
  matchExtractionToAtividade,
  normalizeCnpj,
  extractPeriodo,
};


