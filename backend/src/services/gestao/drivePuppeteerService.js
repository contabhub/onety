const puppeteer = require("puppeteer");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// (removido: funções de login)

// =================== EXTRAÇÃO SEM LOGIN ===================

const PT_BR_MESES = {
  'janeiro': 1, 'jan': 1,
  'fevereiro': 2, 'fev': 2,
  'março': 3, 'marco': 3, 'mar': 3,
  'abril': 4, 'abr': 4,
  'maio': 5, 'mai': 5,
  'junho': 6, 'jun': 6,
  'julho': 7, 'jul': 7,
  'agosto': 8, 'ago': 8,
  'setembro': 9, 'set': 9,
  'outubro': 10, 'out': 10,
  'novembro': 11, 'nov': 11,
  'dezembro': 12, 'dez': 12,
};

function pad2(n) { return String(n).padStart(2, '0'); }

function normalizeYear(twoOrFourDigits) {
  const y = Number(twoOrFourDigits);
  if (String(twoOrFourDigits).length === 4) return y;
  if (y <= 79) return 2000 + y;
  return 1900 + y;
}

function normalizeCompetencia(texto) {
  const raw = (texto || '').toString().trim();
  const lower = raw.toLowerCase().replace(/\s+/g, ' ');

  // 1) Formatos 09/25, 9/2025, 09-2025
  let m = lower.match(/(^|\b)(\d{1,2})\s*[\/-]\s*(\d{2,4})(\b|$)/);
  if (m) {
    const month = Number(m[2]);
    const year = normalizeYear(m[3]);
    if (month >= 1 && month <= 12) return { month, year, key: `${year}-${pad2(month)}`, source: raw };
  }

  // 2) Formatos "Agosto/2025", "Agosto de 2025", "Agosto 2025"
  m = lower.match(/(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s*(?:\/?| de )\s*(\d{2,4})/);
  if (m) {
    const monthName = m[1];
    const year = normalizeYear(m[2]);
    const month = PT_BR_MESES[monthName] || null;
    if (month) return { month, year, key: `${year}-${pad2(month)}`, source: raw };
  }

  // 3) Formatos "Jun/30" (abreviado)
  m = lower.match(/(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s*\/?\s*(\d{2})/);
  if (m) {
    const month = PT_BR_MESES[m[1]] || null;
    const year = normalizeYear(m[2]);
    if (month) return { month, year, key: `${year}-${pad2(month)}`, source: raw };
  }

  return { month: null, year: null, key: null, source: raw };
}

async function listCompetenciasFromDrive(folderUrl, options = {}) {
  const { headless = 'new', executablePath, slowMoMs = 0, timeoutMs = 30000 } = options;
  const browser = await puppeteer.launch({ headless, executablePath, slowMo: slowMoMs });
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  try {
    await page.goto(folderUrl, { waitUntil: 'domcontentloaded' });

    // Captura blocos de item de pasta e spans com o nome visível
    const items = await page.evaluate(() => {
      const results = [];
      const nodes = Array.from(document.querySelectorAll('div.JxSEve, div.i92Sbe.a65Cwf'));
      for (const n of nodes) {
        const nameEl = n.querySelector('span.WQJtxb strong.DNoYtb') || n.querySelector('strong.DNoYtb') || n.querySelector('span.WQJtxb') || n;
        const name = (nameEl && nameEl.textContent) ? nameEl.textContent.trim() : '';
        if (!name) continue;
        const dataId = n.getAttribute('data-id') || (n.closest('[data-id]') && n.closest('[data-id]').getAttribute('data-id')) || null;
        const tooltip = n.getAttribute('data-tooltip') || null;
        const aria = n.getAttribute('aria-label') || null;
        results.push({ name, dataId, tooltip, aria });
      }
      return results;
    });

    const competencias = items.map(it => ({
      ...it,
      competencia: normalizeCompetencia(it.name),
    }));

    // Ordena crescente por chave normalizada (YYYY-MM), nulos vão para o fim
    competencias.sort((a, b) => {
      const ka = a.competencia.key || '9999-99';
      const kb = b.competencia.key || '9999-99';
      return ka.localeCompare(kb);
    });

    return { ok: true, competencias };
  } catch (error) {
    return { ok: false, error: String(error) };
  } finally {
    await browser.close();
  }
}

module.exports.normalizeCompetencia = normalizeCompetencia;
module.exports.listCompetenciasFromDrive = listCompetenciasFromDrive;

// Navega para a primeira competência elegível (menor para maior), ignorando pastas "Baixados ..."
async function navigateToFirstCompetencia(folderUrl, options = {}) {
  const { headless = 'new', executablePath, slowMoMs = 0, timeoutMs = 30000, atividadesPendentes = [] } = options;
  const browser = await puppeteer.launch({ headless, executablePath, slowMo: slowMoMs });
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  try {
    await page.goto(folderUrl, { waitUntil: 'domcontentloaded' });

    const items = await page.evaluate(() => {
      const results = [];
      const nodes = Array.from(document.querySelectorAll('div.JxSEve, div.i92Sbe.a65Cwf'));
      for (const n of nodes) {
        const nameEl = n.querySelector('span.WQJtxb strong.DNoYtb') || n.querySelector('strong.DNoYtb') || n.querySelector('span.WQJtxb') || n;
        const name = (nameEl && nameEl.textContent) ? nameEl.textContent.trim() : '';
        if (!name) continue;
        const dataId = n.getAttribute('data-id') || (n.closest('[data-id]') && n.closest('[data-id]').getAttribute('data-id')) || null;
        const tooltip = n.getAttribute('data-tooltip') || null;
        const aria = n.getAttribute('aria-label') || null;
        results.push({ name, dataId, tooltip, aria });
      }
      return results;
    });

    const enriched = items.map(it => ({ ...it, competencia: normalizeCompetencia(it.name) }));
    let elegiveis = enriched
      .filter(i => i.competencia.key)
      .filter(i => !/^baixados\b/i.test(i.name));

    // Se não houver sem "Baixados", permitir "Baixados <competencia>"
    if (!elegiveis.length) {
      elegiveis = enriched.filter(i => i.competencia.key);
    }

    if (!elegiveis.length) return { ok: false, message: 'Nenhuma competência elegível encontrada.' };

    elegiveis.sort((a, b) => (a.competencia.key).localeCompare(b.competencia.key));
    
    // 🎯 CORREÇÃO: Selecionar competência que tem atividades pendentes
    let chosen = elegiveis[0]; // fallback para primeira elegível
    
    if (atividadesPendentes && atividadesPendentes.length > 0) {
      // Criar mapa de competências das atividades pendentes
      const competenciasPendentes = new Set();
      for (const atividade of atividadesPendentes) {
        if (atividade.ano_referencia && atividade.mes_referencia) {
          const key = `${atividade.ano_referencia}-${String(atividade.mes_referencia).padStart(2, '0')}`;
          competenciasPendentes.add(key);
        }
      }
      
      // Procurar a primeira competência elegível que tem atividades pendentes
      const competenciaComAtividades = elegiveis.find(elegivel => 
        competenciasPendentes.has(elegivel.competencia.key)
      );
      
      if (competenciaComAtividades) {
        chosen = competenciaComAtividades;
        console.log(`🎯 Selecionada competência com atividades pendentes: ${chosen.name} (${chosen.competencia.key})`);
      } else {
        console.log(`⚠️ Nenhuma competência elegível tem atividades pendentes. Usando primeira elegível: ${chosen.name}`);
      }
    }

    const attempts = [];

    // Função de clique robusto com múltiplas estratégias
    async function robustClickByDataId(dataId, visibleName) {
      // 1) Handle direto
      const handle = dataId ? await page.$(`[data-id="${dataId}"]`) : null;
      if (handle) {
        try {
          await page.evaluate((node) => { node.scrollIntoView({ behavior: 'instant', block: 'center' }); node.tabIndex = 0; node.focus(); }, handle);
          await sleep(60);
          try { await handle.click({ delay: 0, clickCount: 2 }); attempts.push('handle.dblclick'); return true; } catch (_) {}
          const box = await handle.boundingBox();
          if (box) {
            try { await page.mouse.click(box.x + box.width/2, box.y + box.height/2, { clickCount: 2 }); attempts.push('mouse.dblclick bbox'); return true; } catch (_) {}
          }
          // JS click na árvore
          const ok = await page.evaluate((node) => {
            try {
              const ev1 = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
              const ev2 = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
              const evDb = new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window });
              node.dispatchEvent(ev1);
              node.dispatchEvent(ev2);
              node.dispatchEvent(evDb);
              return true;
            } catch { return false; }
          }, handle);
          if (ok) { attempts.push('dispatchEvent dblclick'); return true; }
        } catch (_) { /* ignore */ }
      }
      // 2) Pelo texto visível
      if (visibleName) {
        const byText = await page.evaluate((name) => {
          const el = Array.from(document.querySelectorAll('strong.DNoYtb, span.WQJtxb')).find(e => (e.textContent||'').trim() === name);
          if (!el) return false;
          const node = el.closest('[data-id]') || el.closest('div');
          if (!node) return false;
          node.scrollIntoView({ behavior: 'instant', block: 'center' });
          node.tabIndex = 0; node.focus();
          node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
          return true;
        }, visibleName);
        if (byText) { attempts.push('dblclick by text'); return true; }
      }
      // 3) Foco + Enter
      if (dataId) {
        const focusOk = await page.evaluate((id) => {
          const node = document.querySelector(`[data-id="${id}"]`);
          if (!node) return false;
          node.scrollIntoView({ behavior: 'instant', block: 'center' });
          node.tabIndex = 0; node.focus();
          return document.activeElement === node;
        }, dataId);
        if (focusOk) {
          try { await page.keyboard.press('Enter'); attempts.push('keyboard Enter'); return true; } catch (_) {}
        }
      }
      return false;
    }

    // Tenta várias vezes com estratégias combinadas
    let clicked = false;
    for (let i = 0; i < 5 && !clicked; i++) {
      clicked = await robustClickByDataId(chosen.dataId, chosen.name);
      if (!clicked) await sleep(150);
    }

    if (!clicked) return { ok: false, message: 'Falha ao clicar na competência alvo.', target: chosen, attempts };

    // Clicar repetidamente até a navegação realmente ocorrer (URL contem o dataId) ou até timeout
    const maxTries = 10;
    for (let i = 0; i < maxTries; i++) {
      const url = page.url();
      const inTarget = chosen.dataId ? url.includes(chosen.dataId) : false;
      if (inTarget) break;
      // Reforça o clique
      try {
        if (chosen.dataId) {
          const handle = await page.$(`[data-id="${chosen.dataId}"]`);
          if (handle) {
            const box = await handle.boundingBox();
            if (box) {
              await page.evaluate((node) => node.scrollIntoView({ behavior: 'instant', block: 'center' }), handle);
              await sleep(60);
              try { await handle.click({ delay: 0, clickCount: 2 }); } catch (_) {
                try { await page.mouse.click(box.x + box.width/2, box.y + box.height/2, { clickCount: 2 }); } catch (_) {}
              }
            } else {
              await page.evaluate((targetName) => {
                const el = Array.from(document.querySelectorAll('strong.DNoYtb, span.WQJtxb'))
                  .find(e => (e.textContent||'').trim() === targetName);
                if (el) (el.closest('[data-id]') || el.closest('div'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
              }, chosen.name);
            }
          }
        }
      } catch (_) {}
      await sleep(300);
    }

    // Aguarda render da pasta filha e coleta itens (nomes de arquivos/pastas)
    await sleep(500);
    const list = await page.evaluate(() => {
      const out = [];
      const rows = Array.from(document.querySelectorAll('div[role="row"], div.JxSEve, div.i92Sbe.a65Cwf'));
      for (const r of rows) {
        const nameEl = r.querySelector('span.WQJtxb strong.DNoYtb') || r.querySelector('strong.DNoYtb') || r.querySelector('span.WQJtxb') || r;
        const name = (nameEl && nameEl.textContent) ? nameEl.textContent.trim() : '';
        if (!name) continue;
        out.push({ name });
      }
      return out;
    });

    return { ok: true, target: chosen, items: list, attempts, url: page.url() };
  } catch (error) {
    return { ok: false, error: String(error) };
  } finally {
    await browser.close();
  }
}

module.exports.navigateToFirstCompetencia = navigateToFirstCompetencia;



// =================== NAVEGAR PARA COMPETÊNCIA ESPECÍFICA E ABRIR ARQUIVOS ===================

function removeDiacritics(str) {
  return (str || '').normalize('NFD').replace(/\p{Diacritic}+/gu, '');
}

function normalizeTitle(s) {
  return removeDiacritics((s || '').toString().trim().toLowerCase());
}

async function dblclickByVisibleName(page, name) {
  return await page.evaluate((targetName) => {
    const all = Array.from(document.querySelectorAll('span.WQJtxb strong.DNoYtb, strong.DNoYtb, span[aria-hidden="true"], span.WQJtxb'));
    const el = all.find(e => (e.textContent || '').trim() === targetName);
    if (!el) return false;
    const node = el.closest('div[role="row"]') || el.closest('div.JxSEve') || el.closest('div.i92Sbe.a65Cwf') || el.closest('[data-id]') || el;
    if (!node) return false;
    node.scrollIntoView({ behavior: 'instant', block: 'center' });
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    return true;
  }, name);
}

async function dblclickByDataId(page, dataId, attemptsLog) {
  if (!dataId) return false;
  const handle = await page.$(`[data-id="${dataId}"]`);
  if (!handle) return false;
  try {
    await page.evaluate((node) => { node.scrollIntoView({ behavior: 'instant', block: 'center' }); node.tabIndex = 0; node.focus(); }, handle);
    const box = await handle.boundingBox();
    // Hover antes do clique (alguns grids dependem de hover)
    if (box) {
      try { await page.mouse.move(box.x + box.width/2, box.y + box.height/2); attemptsLog && attemptsLog.push('arquivo.hover'); } catch (_) {}
    }
    try { await handle.click({ clickCount: 2, delay: 0 }); attemptsLog && attemptsLog.push('arquivo.handle.dblclick'); return true; } catch (_) {}
    if (box) {
      try { await page.mouse.click(box.x + box.width/2, box.y + box.height/2, { clickCount: 2 }); attemptsLog && attemptsLog.push('arquivo.mouse.dblclick'); return true; } catch (_) {}
    }
    const ok = await page.evaluate((node) => {
      // Sequência completa de eventos como o navegador faria
      const ev = (type) => node.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      ev('pointerdown'); ev('mousedown'); ev('mouseup'); ev('click');
      ev('pointerdown'); ev('mousedown'); ev('mouseup'); ev('click');
      ev('dblclick');
      return true;
    }, handle);
    if (ok) { attemptsLog && attemptsLog.push('arquivo.dispatchEvent.dblclick'); return true; }
    // Fallback: selecionar e pressionar Enter (Drive abre com Enter)
    try {
      await handle.click({ clickCount: 1 });
      await page.keyboard.press('Enter');
      attemptsLog && attemptsLog.push('arquivo.select+Enter');
      return true;
    } catch (_) {}
  } catch (_) { /* ignore */ }
  return false;
}

async function navigateToCompetenciaAndOpenFiles(folderUrl, targetKey, expectedTitles = [], options = {}) {
  const { headless = 'new', executablePath, slowMoMs = 0, timeoutMs = 30000, openFileInNewPage = true, debugLogCandidates = true } = options;
  const browser = await puppeteer.launch({ headless, executablePath, slowMo: slowMoMs });
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const actions = [];
  try {
    await page.goto(folderUrl, { waitUntil: 'domcontentloaded' });

    // Coleta itens e encontra a competencia alvo
    const items = await page.evaluate(() => {
      const results = [];
      const nodes = Array.from(document.querySelectorAll('div.JxSEve, div.i92Sbe.a65Cwf'));
      for (const n of nodes) {
        const nameEl = n.querySelector('span.WQJtxb strong.DNoYtb') || n.querySelector('strong.DNoYtb') || n.querySelector('span.WQJtxb') || n;
        const name = (nameEl && nameEl.textContent) ? nameEl.textContent.trim() : '';
        if (!name) continue;
        const dataId = n.getAttribute('data-id') || (n.closest('[data-id]') && n.closest('[data-id]').getAttribute('data-id')) || null;
        const tooltip = n.getAttribute('data-tooltip') || null;
        const aria = n.getAttribute('aria-label') || null;
        results.push({ name, dataId, tooltip, aria });
      }
      return results;
    });
    const enriched = items.map(it => ({ ...it, competencia: normalizeCompetencia(it.name) }));
    let candidatos = enriched.filter(i => i.competencia.key === targetKey);
    // Prioriza não-baixados, depois aceita "Baixados ..."
    let chosen = candidatos.find(c => !/^baixados\b/i.test(c.name)) || candidatos[0];
    if (!chosen) return { ok: false, message: 'Competência alvo não encontrada', targetKey };

    // Reutiliza robustClick
    async function robustClickByDataId(dataId, visibleName) {
      const handle = dataId ? await page.$(`[data-id="${dataId}"]`) : null;
      if (handle) {
        try {
          await page.evaluate((node) => { node.scrollIntoView({ behavior: 'instant', block: 'center' }); node.tabIndex = 0; node.focus(); }, handle);
          await sleep(40);
          try { await handle.click({ clickCount: 2 }); actions.push('competencia.handle.dblclick'); } catch (_) {}
          const box = await handle.boundingBox();
          if (box) { try { await page.mouse.click(box.x + box.width/2, box.y + box.height/2, { clickCount: 2 }); actions.push('competencia.mouse.dblclick'); } catch (_) {} }
          const ok = await page.evaluate((node) => { node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return true; }, handle);
          if (ok) actions.push('competencia.dispatchEvent.dblclick');
          return true;
        } catch (_) {}
      }
      const byText = await dblclickByVisibleName(page, visibleName);
      if (byText) { actions.push('competencia.dblclick.byText'); return true; }
      return false;
    }

    // Dblclick repetido até URL mudar
    for (let i = 0; i < 10; i++) {
      await robustClickByDataId(chosen.dataId, chosen.name);
      await sleep(250);
      if (chosen.dataId && page.url().includes(chosen.dataId)) break;
    }

    // Lista itens da pasta (com espera ativa até aparecerem PDFs)
    let arquivos = [];
    for (let tries = 0; tries < 10; tries++) {
      await sleep(300);
      arquivos = await page.evaluate(() => {
        const out = [];
        const nodes = Array.from(document.querySelectorAll('div[role="row"], div.JxSEve, div.i92Sbe.a65Cwf'));
        for (const n of nodes) {
          const nameEl = n.querySelector('span.WQJtxb strong.DNoYtb') || n.querySelector('strong.DNoYtb') || n.querySelector('span[aria-hidden="true"]') || n.querySelector('span.WQJtxb') || n;
          const name = (nameEl && nameEl.textContent) ? nameEl.textContent.trim() : '';
          if (!name) continue;
          const dataId = n.getAttribute('data-id') || (n.closest('[data-id]') && n.closest('[data-id]').getAttribute('data-id')) || null;
          out.push({ name, dataId });
        }
        return out;
      });
      const hasPdf = arquivos.some(a => /\.pdf$/i.test(a.name));
      if (arquivos.length > 0 && hasPdf) break;
      // Força scroll para carregar mais linhas
      await page.evaluate(() => { window.scrollBy(0, 400); });
    }

    const normTitles = expectedTitles.map(normalizeTitle);
    const matchingFiles = arquivos.filter(a => /\.pdf$/i.test(a.name) && normTitles.some(t => normalizeTitle(a.name).includes(t)));
    
    // Deduplica por dataId (mesmo arquivo não deve ser processado 2x)
    const uniqueFiles = [];
    const seenDataIds = new Set();
    for (const file of matchingFiles) {
      if (file.dataId && !seenDataIds.has(file.dataId)) {
        seenDataIds.add(file.dataId);
        uniqueFiles.push(file);
      }
    }
    
    let results = [];
    console.log(`[DrivePuppeteer] Processando ${uniqueFiles.length} arquivos únicos (de ${matchingFiles.length} encontrados)`);
    
    // Processa TODOS os arquivos únicos que dão match nominal
    for (const file of uniqueFiles) {
      console.log(`[DrivePuppeteer] Processando arquivo: ${file.name} (dataId: ${file.dataId})`);
      let opened = false;
      let openedBy = null;
      let extraction = null;
      let fileUrl = null;

      // Helper: dump de candidatos do viewer
      const dumpViewerCandidates = async (targetPage, label) => {
        if (!debugLogCandidates) return;
        try {
          const collected = await targetPage.evaluate(() => {
            const selectors = [
              'div.textLayer span',
              'div.textLayer p',
              'p.ndfHFb-c4YZDc-cYSp0e-DARUcf-Df1ZY-eEGnhe',
              'span.ndfHFb-c4YZDc-cYSp0e-DARUcf-Df1ZY-eEGnhe',
              'p[class*="ndfHFb-"]',
              'span[class*="ndfHFb-"]',
              'p[style*="left:"][style*="top:"]',
              'span[style*="left:"][style*="top:"]'
            ];
            const nodes = Array.from(document.querySelectorAll(selectors.join(',')));
            const normalize = (s) => (s || '').replace(/\s+/g,' ').trim();
            return nodes.slice(0, 300).map(n => {
              const cs = getComputedStyle(n);
              return {
                tag: n.tagName.toLowerCase(),
                class: n.className || '',
                style: n.getAttribute('style') || '',
                left: cs.left || '',
                top: cs.top || '',
                width: cs.width || '',
                height: cs.height || '',
                text: normalize(n.textContent || '').slice(0, 240)
              };
            });
          });
          actions.push(`viewer.debug.${label}:${Array.isArray(collected) ? collected.length : 0}`);
          try { console.log(`[DrivePuppeteer][viewer DEBUG ${label}]`, Array.isArray(collected) ? collected : []); } catch (_) {}
        } catch (_) { /* ignore */ }
      };

      // Função: tentar clicar em todos os nós relevantes do card
      async function clickAllNodesFor(dataId, visibleName) {
        const selectors = [];
        if (dataId) selectors.push(`[data-id="${dataId}"]`);
        if (dataId) selectors.push(`div.i92Sbe.a65Cwf[data-id="${dataId}"]`);
        if (dataId) selectors.push(`div.JxSEve:has(div.i92Sbe.a65Cwf[data-id="${dataId}"])`);
        if (dataId) selectors.push(`div.i92Sbe.a65Cwf[data-id="${dataId}"] [jsname="vtaz5c"]`);
        if (dataId) selectors.push(`[data-id="${dataId}"] [jsname="vtaz5c"]`);
        if (visibleName) selectors.push(`span.WQJtxb strong.DNoYtb:text-is("${visibleName}")`);
        // Fallback por texto (busca manual)
        const handles = [];
        for (const sel of selectors) {
          try { const h = await page.$(sel); if (h) handles.push(h); } catch (_) {}
        }
        // Busca manual por texto quando o :text-is não existir
        if (!handles.length && visibleName) {
          const byText = await page.evaluateHandle((name) => {
            const all = Array.from(document.querySelectorAll('span.WQJtxb strong.DNoYtb, strong.DNoYtb, span[aria-hidden="true"], span.WQJtxb'));
            const el = all.find(e => (e.textContent||'').trim() === name);
            return el ? (el.closest('div.i92Sbe.a65Cwf') || el.closest('div.JxSEve') || el.closest('[data-id]') || el) : null;
          }, visibleName);
          if (byText) handles.push(byText);
        }
        for (const h of handles) {
          try {
            const box = await h.boundingBox();
            if (box) {
              await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
              actions.push('arquivo.hover');
            }
            await h.click({ clickCount: 1 }); actions.push('arquivo.singleclick');
            await h.click({ clickCount: 2 }); actions.push('arquivo.handle.dblclick');
            if (box) { await page.mouse.click(box.x + box.width/2, box.y + box.height/2, { clickCount: 2 }); actions.push('arquivo.mouse.dblclick'); }
            // Dblclick direto via page.click no seletor literal (quando disponível)
            try {
              const sel = await page.evaluate((node) => {
                // tenta reconstruir um seletor simples usando data-id
                const cont = node.closest('[data-id]');
                return cont ? `[data-id="${cont.getAttribute('data-id')}"]` : null;
              }, h);
              if (sel) { await page.click(sel, { clickCount: 2 }); actions.push('arquivo.pageclick.dblclick'); }
            } catch (_) {}
            await page.evaluate((node) => {
              const ev = (t)=>node.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,view:window}));
              ev('pointerdown');ev('mousedown');ev('mouseup');ev('click');
              ev('pointerdown');ev('mousedown');ev('mouseup');ev('click');
              ev('dblclick');
            }, h);
            actions.push('arquivo.dispatchEvent.dblclick');
            // Garante aria-selected
            await page.evaluate((node) => {
              const cont = node.closest('[data-id]') || node;
              cont.setAttribute('aria-selected','true');
            }, h).catch(()=>{});
          } catch (_) {}
        }
      }

      // 1º: Se configurado, abrir em nova página pelo dataId para isolar DOM
      if (openFileInNewPage && file.dataId) {
        try {
          const directUrl = `https://drive.google.com/file/d/${file.dataId}/view`;
          const viewerPage = await browser.newPage();
          viewerPage.setDefaultTimeout(timeoutMs);
          try { await viewerPage.setViewport({ width: 1366, height: 2000 }); } catch (_) {}
          await viewerPage.goto(directUrl, { waitUntil: 'networkidle2' });
          actions.push('open.newPage.goto');
          opened = true; 
          openedBy = 'new-page';

          // Dump antes de extrair
          await dumpViewerCandidates(viewerPage, 'before');

          // Função local para extrair texto na página do viewer isolada
          const extractInPage = async (targetPage, expectedName) => {
            try {
              const tryInContext = async () => {
                return await targetPage.evaluate((fname) => {
                  const normalize = (s) => (s || '').replace(/\s+/g,' ').trim();
                  const parsePercent = (v) => { if (!v) return null; const m = /([\d.]+)%/.exec(v); return m ? parseFloat(m[1]) : null; };
                  const parsePx = (v) => { if (!v) return null; const m = /([\d.]+)px/.exec(v); return m ? parseFloat(m[1]) : null; };
                  const getPos = (el) => {
                    const style = getComputedStyle(el);
                    const tr = style.transform || '';
                    const m = tr.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
                    if (m) { return { left: parseFloat(m[1]), top: parseFloat(m[2]) }; }
                    const leftPx = parsePx(style.left); const topPx = parsePx(style.top);
                    if (leftPx !== null && topPx !== null) { return { left: leftPx, top: topPx }; }
                    const leftPct = parsePercent(style.left); const topPct = parsePercent(style.top);
                    if (leftPct !== null && topPct !== null) { return { left: leftPct, top: topPct, isPercent: true }; }
                    const rect = el.getBoundingClientRect();
                    return { left: rect.left, top: rect.top };
                  };
                  const selectors = [
                    'p.ndfHFb-c4YZDc-cYSp0e-DARUcf-Df1ZY-eEGnhe',
                    'span.ndfHFb-c4YZDc-cYSp0e-DARUcf-Df1ZY-eEGnhe',
                    'p.a-b-Xa-La-mf-Ic',
                    'span.a-b-Xa-La-mf-Ic',
                    'div.textLayer > span',
                    'div.textLayer > p',
                    'div[role="dialog"] .textLayer span',
                    'div[role="dialog"] .textLayer p'
                  ];
                  let nodes = [];
                  for (const sel of selectors) {
                    const found = Array.from(document.querySelectorAll(sel));
                    if (found.length) { nodes = found; break; }
                  }
                  const boxes = nodes.map(el => {
                    const style = getComputedStyle(el);
                    const pos = getPos(el);
                    const width = parsePx(style.width);
                    const height = parsePx(style.height);
                    return { text: normalize(el.textContent || ''), left: pos.left, top: pos.top, width, height };
                  }).filter(b => b.text && b.text.length > 0 && b.top != null && b.left != null);
                  boxes.sort((a,b) => a.top === b.top ? (a.left - b.left) : (a.top - b.top));
                  const lines = [];
                  const tol = 3;
                  for (const b of boxes) {
                    const line = lines.find(l => Math.abs(l.top - b.top) <= tol);
                    if (line) { line.items.push(b); } else { lines.push({ top: b.top, items: [b] }); }
                  }
                  const lineTexts = lines.map(l => l.items.sort((a,b)=>a.left-b.left).map(i=>i.text).join(' ').trim()).filter(Boolean);
                  const text = lineTexts.join('\n');
                  return { ok: true, stats: { nodes: nodes.length, boxes: boxes.length, lines: lineTexts.length, hasTextLayer: nodes.length > 0 }, boxes, lines: lineTexts, text };
                }, expectedName);
              };
              let result = await tryInContext();
              if (!result || !result.ok || result.stats.boxes === 0) {
                const frames = targetPage.frames();
                for (const fr of frames) {
                  try {
                    const r = await fr.evaluate((fname) => {
                      const normalize = (s) => (s || '').replace(/\s+/g,' ').trim();
                      const parsePercent = (v) => { if (!v) return null; const m = /([\d.]+)%/.exec(v); return m ? parseFloat(m[1]) : null; };
                      const parsePx = (v) => { if (!v) return null; const m = /([\d.]+)px/.exec(v); return m ? parseFloat(m[1]) : null; };
                      const getPos = (el) => {
                        const style = getComputedStyle(el);
                        const tr = style.transform || '';
                        const m = tr.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
                        if (m) { return { left: parseFloat(m[1]), top: parseFloat(m[2]) }; }
                        const leftPx = parsePx(style.left); const topPx = parsePx(style.top);
                        if (leftPx !== null && topPx !== null) { return { left: leftPx, top: topPx }; }
                        const leftPct = parsePercent(style.left); const topPct = parsePercent(style.top);
                        if (leftPct !== null && topPct !== null) { return { left: leftPct, top: topPct, isPercent: true }; }
                        const rect = el.getBoundingClientRect();
                        return { left: rect.left, top: rect.top };
                      };
                      const selectors = [
                        'p.ndfHFb-c4YZDc-cYSp0e-DARUcf-Df1ZY-eEGnhe',
                        'span.ndfHFb-c4YZDc-cYSp0e-DARUcf-Df1ZY-eEGnhe',
                        'p.a-b-Xa-La-mf-Ic',
                        'span.a-b-Xa-La-mf-Ic',
                        'div.textLayer > span',
                        'div.textLayer > p'
                      ];
                      let nodes = [];
                      for (const sel of selectors) {
                        const found = Array.from(document.querySelectorAll(sel));
                        if (found.length) { nodes = found; break; }
                      }
                      const boxes = nodes.map(el => {
                        const style = getComputedStyle(el);
                        const pos = getPos(el);
                        const width = parsePx(style.width);
                        const height = parsePx(style.height);
                        return { text: normalize(el.textContent || ''), left: pos.left, top: pos.top, width, height };
                      }).filter(b => b.text && b.top != null && b.left != null);
                      boxes.sort((a,b) => a.top === b.top ? (a.left - b.left) : (a.top - b.top));
                      const lines = [];
                      const tol = 3;
                      for (const b of boxes) {
                        const line = lines.find(l => Math.abs(l.top - b.top) <= tol);
                        if (line) { line.items.push(b); } else { lines.push({ top: b.top, items: [b] }); }
                      }
                      const lineTexts = lines.map(l => l.items.sort((a,b)=>a.left-b.left).map(i=>i.text).join(' ').trim()).filter(Boolean);
                      const text = lineTexts.join('\n');
                      return { ok: true, stats: { nodes: nodes.length, boxes: boxes.length, lines: lineTexts.length, hasTextLayer: nodes.length > 0 }, boxes, lines: lineTexts, text };
                    }, expectedName);
                    if (r && r.ok && r.stats.boxes > 0) { result = r; break; }
                  } catch(_) {}
                }
              }
              return result || { ok: false };
            } catch (err) {
              return { ok: false, error: String(err) };
            }
          };

          // Espera ativa até que a camada de texto/iframe do viewer esteja presente
          let ready = false;
          for (let i = 0; i < Math.ceil(timeoutMs / 300); i++) {
            try {
              const state = await viewerPage.evaluate(() => {
                const sel = 'div.textLayer, p.a-b-Xa-La-mf-Ic, span.a-b-Xa-La-mf-Ic, p.ndfHFb-c4YZDc-cYSp0e-DARUcf-Df1ZY-eEGnhe, span.ndfHFb-c4YZDc-cYSp0e-DARUcf-Df1ZY-eEGnhe, p[class*="ndfHFb-"], span[class*="ndfHFb-"], p[style*="left:"][style*="top:"], span[style*="left:"][style*="top:"]';
                const hasTL = !!document.querySelector(sel);
                const hasFrame = Array.from(document.querySelectorAll('iframe, embed, canvas')).length > 0;
                return { hasTL, hasFrame };
              });
              if (state && (state.hasTL || state.hasFrame)) { ready = true; break; }
            } catch (_) {}
            try { await viewerPage.evaluate(() => { window.scrollBy(0, 600); }); } catch (_) {}
            await sleep(300);
          }
          actions.push(`newPage.wait.viewerReady:${ready}`);
          try { await viewerPage.waitForFunction(() => !!document.querySelector('p[class*="ndfHFb-"]') || !!document.querySelector('div.textLayer span, div.textLayer p') || !!document.querySelector('p[style*="left:"][style*="top:"]'), { timeout: Math.max(1000, Math.floor(timeoutMs/2)) }); } catch(_) {}

          // Tentativas progressivas de extração até obter boxes > 0
          let attempts = 0;
          for (; attempts < 40; attempts++) {
            extraction = await extractInPage(viewerPage, file.name);
            if (extraction && extraction.ok && (extraction.stats?.boxes || 0) > 0) {
              actions.push(`viewer.extract.retry.${attempts}`);
              break;
            }
            try { await viewerPage.evaluate(() => { window.scrollBy(0, 900); }); } catch (_) {}
            try { await viewerPage.keyboard.press('PageDown'); } catch (_) {}
            await sleep(500);
          }
          actions.push(`viewer.extract.${extraction && extraction.ok ? 'ok' : 'fail'}`);
          // Dump depois
          await dumpViewerCandidates(viewerPage, 'after');
          // Log de stats da extração na nova aba
          if (extraction && extraction.ok) {
            try {
              const textLen = typeof extraction.text === 'string' ? extraction.text.length : 0;
              actions.push(`newPage.extract.stats.nodes:${extraction.stats?.nodes ?? 0}`);
              actions.push(`newPage.extract.stats.boxes:${extraction.stats?.boxes ?? 0}`);
              actions.push(`newPage.extract.stats.lines:${extraction.stats?.lines ?? 0}`);
              actions.push(`newPage.extract.text.length:${textLen}`);
              console.log('[DrivePuppeteer][newPage] extraction.stats', extraction.stats);
            } catch (_) {}
          }
          // Pequena folga antes de fechar a aba para garantir conclusão do render
          await sleep(400);
          try { await viewerPage.close(); actions.push('newPage.close'); } catch(_) {}
        } catch (err) {
          actions.push(`open.newPage.error:${String(err)}`);
        }
      }

      // Fallback para fluxo antigo se não abriu ou extração vazia
      if (!openFileInNewPage || !extraction || !(extraction.stats && extraction.stats.boxes > 0)) {
        await clickAllNodesFor(file.dataId, file.name);
        for (let i = 0; i < 60; i++) {
          const p = await getViewerPresent(file.name);
          if (p.present) { opened = true; openedBy = p.by; break; }
          await clickAllNodesFor(file.dataId, file.name);
          try { await page.keyboard.press(' '); actions.push('arquivo.press.Space'); } catch (_) {}
          try { await page.keyboard.press('Enter'); actions.push('arquivo.press.Enter'); } catch (_) {}
          try { await page.keyboard.press('KeyO'); actions.push('arquivo.press.O'); } catch (_) {}
          await sleep(100);
        }
      }

      // Quando abrir, tentar extrair a camada de texto do viewer
      if (opened && (!openFileInNewPage || !extraction || !(extraction.stats && extraction.stats.boxes > 0))) {
        // Dump no grid antes
        await dumpViewerCandidates(page, 'grid.before');
        const extractTextFromViewer = async (expectedName) => {
          try {
            // Algumas instâncias do viewer ficam em iframes; tentamos dentro e fora
            const tryInContext = async () => {
              return await page.evaluate((fname) => {
                const normalize = (s) => (s || '').replace(/\s+/g,' ').trim();
                const parsePercent = (v) => {
                  if (!v) return null;
                  const m = /([\d.]+)%/.exec(v);
                  return m ? parseFloat(m[1]) : null;
                };
                const parsePx = (v) => {
                  if (!v) return null;
                  const m = /([\d.]+)px/.exec(v);
                  return m ? parseFloat(m[1]) : null;
                };
                const getPos = (el) => {
                  const style = getComputedStyle(el);
                  // 1) tentar transform: translate(xpx, ypx)
                  const tr = style.transform || '';
                  const m = tr.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
                  if (m) {
                    return { left: parseFloat(m[1]), top: parseFloat(m[2]) };
                  }
                  // 2) tentar left/top em px
                  const leftPx = parsePx(style.left);
                  const topPx = parsePx(style.top);
                  if (leftPx !== null && topPx !== null) {
                    return { left: leftPx, top: topPx };
                  }
                  // 3) tentar % (menos preciso, mas mantém ordem relativa)
                  const leftPct = parsePercent(style.left);
                  const topPct = parsePercent(style.top);
                  if (leftPct !== null && topPct !== null) {
                    return { left: leftPct, top: topPct, isPercent: true };
                  }
                  // 4) fallback: boundingClientRect
                  const rect = el.getBoundingClientRect();
                  return { left: rect.left, top: rect.top };
                };

                // Seletores candidatos para a text-layer do PDF.js/Drive
                const selectors = [
                  'p.ndfHFb-c4YZDc-cYSp0e-DARUcf-Df1ZY-eEGnhe',
                  'span.ndfHFb-c4YZDc-cYSp0e-DARUcf-Df1ZY-eEGnhe',
                  'p[class*="ndfHFb-"]',
                  'span[class*="ndfHFb-"]',
                  'div.textLayer > span',
                  'div.textLayer > p',
                  'div[role="dialog"] .textLayer span',
                  'div[role="dialog"] .textLayer p',
                  'p[style*="left:"][style*="top:"]',
                  'span[style*="left:"][style*="top:"]'
                ];
                let nodes = [];
                for (const sel of selectors) {
                  const found = Array.from(document.querySelectorAll(sel));
                  if (found.length) { nodes = found; break; }
                }

                const boxes = nodes.map(el => {
                  const style = getComputedStyle(el);
                  const pos = getPos(el);
                  const width = parsePx(style.width);
                  const height = parsePx(style.height);
                  return {
                    text: normalize(el.textContent || ''),
                    left: pos.left,
                    top: pos.top,
                    width,
                    height
                  };
                }).filter(b => b.text && b.text.length > 0 && b.top != null && b.left != null);

                boxes.sort((a,b) => a.top === b.top ? (a.left - b.left) : (a.top - b.top));

                // Agrupar por linhas com tolerância de Y
                const lines = [];
                const tol = 3; // tolerância em px
                for (const b of boxes) {
                  const line = lines.find(l => Math.abs(l.top - b.top) <= tol);
                  if (line) {
                    line.items.push(b);
                  } else {
                    lines.push({ top: b.top, items: [b] });
                  }
                }
                const lineTexts = lines.map(l => l.items.sort((a,b)=>a.left-b.left).map(i=>i.text).join(' ').trim()).filter(Boolean);
                const text = lineTexts.join('\n');

                return {
                  ok: true,
                  stats: {
                    nodes: nodes.length,
                    boxes: boxes.length,
                    lines: lineTexts.length,
                    hasTextLayer: nodes.length > 0
                  },
                  boxes,
                  lines: lineTexts,
                  text
                };
              }, expectedName);
            };

            // Primeiro tentar no topo
            let result = await tryInContext();
            if (!result || !result.ok || result.stats.boxes === 0) {
              // Tentar dentro de iframes visíveis
              const frames = page.frames();
              for (const fr of frames) {
                try {
                  const r = await fr.evaluate((fname) => {
                    const normalize = (s) => (s || '').replace(/\s+/g,' ').trim();
                    const parsePercent = (v) => {
                      if (!v) return null;
                      const m = /([\d.]+)%/.exec(v);
                      return m ? parseFloat(m[1]) : null;
                    };
                    const parsePx = (v) => {
                      if (!v) return null;
                      const m = /([\d.]+)px/.exec(v);
                      return m ? parseFloat(m[1]) : null;
                    };
                    const getPos = (el) => {
                      const style = getComputedStyle(el);
                      const tr = style.transform || '';
                      const m = tr.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
                      if (m) { return { left: parseFloat(m[1]), top: parseFloat(m[2]) }; }
                      const leftPx = parsePx(style.left);
                      const topPx = parsePx(style.top);
                      if (leftPx !== null && topPx !== null) { return { left: leftPx, top: topPx }; }
                      const leftPct = parsePercent(style.left);
                      const topPct = parsePercent(style.top);
                      if (leftPct !== null && topPct !== null) { return { left: leftPct, top: topPct, isPercent: true }; }
                      const rect = el.getBoundingClientRect();
                      return { left: rect.left, top: rect.top };
                    };
                    const selectors = [
                      'p.ndfHFb-c4YZDc-cYSp0e-DARUcf-Df1ZY-eEGnhe',
                      'span.ndfHFb-c4YZDc-cYSp0e-DARUcf-Df1ZY-eEGnhe',
                      'p[class*="ndfHFb-"]',
                      'span[class*="ndfHFb-"]',
                      'div.textLayer > span',
                      'div.textLayer > p',
                      'p[style*="left:"][style*="top:"]',
                      'span[style*="left:"][style*="top:"]'
                    ];
                    let nodes = [];
                    for (const sel of selectors) {
                      const found = Array.from(document.querySelectorAll(sel));
                      if (found.length) { nodes = found; break; }
                    }
                    const boxes = nodes.map(el => {
                      const style = getComputedStyle(el);
                      const pos = getPos(el);
                      const width = parsePx(style.width);
                      const height = parsePx(style.height);
                      return { text: normalize(el.textContent || ''), left: pos.left, top: pos.top, width, height };
                    }).filter(b => b.text && b.top != null && b.left != null);
                    boxes.sort((a,b) => a.top === b.top ? (a.left - b.left) : (a.top - b.top));
                    const lines = [];
                    const tol = 3;
                    for (const b of boxes) {
                      const line = lines.find(l => Math.abs(l.top - b.top) <= tol);
                      if (line) { line.items.push(b); } else { lines.push({ top: b.top, items: [b] }); }
                    }
                    const lineTexts = lines.map(l => l.items.sort((a,b)=>a.left-b.left).map(i=>i.text).join(' ').trim()).filter(Boolean);
                    const text = lineTexts.join('\n');
                    return { ok: true, stats: { nodes: nodes.length, boxes: boxes.length, lines: lineTexts.length, hasTextLayer: nodes.length > 0 }, boxes, lines: lineTexts, text };
                  }, expectedName);
                  if (r && r.ok && r.stats.boxes > 0) { result = r; break; }
                } catch (_) {}
              }
            }
            return result || { ok: false };
          } catch (err) {
            return { ok: false, error: String(err) };
          }
        };

        // Aguardar explicitamente que algum dos seletores do viewer apareça no grid
        try {
          await page.waitForFunction(() => !!document.querySelector('p[class*="ndfHFb-"]') || !!document.querySelector('div.textLayer span, div.textLayer p') || !!document.querySelector('p[style*="left:"][style*="top:"]'), { timeout: 3000 });
        } catch (_) {}

          extraction = await extractTextFromViewer(file.name);
          actions.push(`viewer.extract.${extraction && extraction.ok ? 'ok' : 'fail'}`);
        if (extraction && extraction.ok) {
          try {
            const sampleLines = Array.isArray(extraction.lines) ? extraction.lines.slice(0, 12) : [];
            const sampleBoxes = Array.isArray(extraction.boxes) ? extraction.boxes.slice(0, 8) : [];
            const textLen = typeof extraction.text === 'string' ? extraction.text.length : 0;
            actions.push(`viewer.extract.stats.nodes:${extraction.stats?.nodes ?? 0}`);
            actions.push(`viewer.extract.stats.boxes:${extraction.stats?.boxes ?? 0}`);
            actions.push(`viewer.extract.stats.lines:${extraction.stats?.lines ?? 0}`);
            actions.push(`viewer.extract.text.length:${textLen}`);
            console.log('[DrivePuppeteer] extraction.stats', extraction.stats);
            console.log('[DrivePuppeteer] extraction.sample.lines', sampleLines);
            console.log('[DrivePuppeteer] extraction.sample.boxes', sampleBoxes);
          } catch (_) {}
        } else {
          console.log('[DrivePuppeteer] extraction.fail');
        }
        // Dump no grid depois
        await dumpViewerCandidates(page, 'grid.after');
      }

      // Fechar o modal PDF clicando no X (apenas quando no mesmo grid)
      if (opened && !openFileInNewPage) {
        try {
          const closeButton = await page.$('div.a-b-va-d[aria-label="Fechar"]');
          if (closeButton) {
            await closeButton.click();
            actions.push('modal.close.click');
            await sleep(500); // Aguarda fechamento
          } else {
            // Fallback: ESC
            await page.keyboard.press('Escape');
            actions.push('modal.close.escape');
            await sleep(500);
          }
        } catch (err) {
          actions.push(`modal.close.error:${String(err)}`);
        }
      }

      // Copiar/derivar link do arquivo
      try {
        // Evita seletor inválido; se tiver dataId usamos direto
              fileUrl = `https://drive.google.com/file/d/${file.dataId}/view`;
      } catch (err) {
        actions.push(`share.error:${String(err)}`);
        fileUrl = `https://drive.google.com/file/d/${file.dataId}/view`;
      }

      // Adiciona resultado deste arquivo
      results.push({
        file: file,
        opened,
        openedBy,
        extraction,
        fileUrl,
        actions: [...actions] // cópia das ações
      });
    }

    return { ok: true, key: targetKey, chosen, arquivos, results, url: page.url() };
  } catch (error) {
    return { ok: false, error: String(error), actions };
  } finally {
    await browser.close();
  }
}

module.exports.navigateToCompetenciaAndOpenFiles = navigateToCompetenciaAndOpenFiles;

// Processa todas as competências em ordem crescente, tentando abrir arquivos que casem com os títulos esperados por competência
async function processCompetenciasSequential(folderUrl, competenciasKeysOrdered, titlesByKey, options = {}) {
  const results = [];
  for (const key of competenciasKeysOrdered) {
    const expected = Array.from(new Set(titlesByKey[key] || [])).filter(Boolean);
    if (!expected.length) {
      results.push({ key, skipped: true, reason: 'Sem titulos para esta competencia.' });
      continue;
    }
    const res = await navigateToCompetenciaAndOpenFiles(folderUrl, key, expected, options);
    results.push(res);
  }
  return results;
}

module.exports.processCompetenciasSequential = processCompetenciasSequential;