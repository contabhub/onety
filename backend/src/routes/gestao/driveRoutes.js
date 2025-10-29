const express = require("express");
const router = express.Router();
const { listCompetenciasFromDrive, navigateToFirstCompetencia, navigateToCompetenciaAndOpenFiles, processCompetenciasSequential } = require("../../services/gestao/drivePuppeteerService");
const { matchExtractionToAtividade } = require("../../services/gestao/pdfMatchingService");
const { autenticarToken } = require("../../middlewares/auth");
const db = require("../../config/database");

// POST /api/drive/open-and-login
// Agora inclui a verificação de pendências “Integração: Drive antes de iniciar o login
router.post("/open-and-login", autenticarToken, async (req, res) => {
  const { folderUrl, headless, timeoutMs, slowMoMs, keepBrowserOpen, credentials, openFileInNewPage } = req.body || {};
  const empresaId = req.usuario?.empresaId;

  console.log("[OPEN-LOGIN][START] Iniciando fluxo.", { empresaId, hasFolderUrl: !!folderUrl });

  if (!folderUrl) return res.status(400).json({ error: "folderUrl é obrigatório" });
  if (!empresaId) return res.status(400).json({ error: "empresaId não identificado no token." });

  try {
    console.log("[OPEN-LOGIN][CHECK] Verificando pendências Integração: Drive...");
    const [atividades] = await db.query(`
      SELECT 
        oac.id, oac.concluida, oac.obrigacaoClienteId, oac.texto, oac.descricao, oac.tipo,
        o.nome AS obrigacao_nome,
        c.id AS clienteId, c.nome AS cliente_nome, c.cnpjCpf AS cliente_cnpj,
        oc.status AS obrigacaoClienteStatus, oc.baixadaAutomaticamente AS obrigacaoClienteBaixadaAutomatica,
        oc.ano_referencia, oc.mes_referencia,
        o.id AS obrigacaoId,
        ocr.usuarioId AS responsavel_usuarioId,
        ao.pdf_layout_id AS pdf_layout_id,
        ao.titulo_documento AS pdf_titulo_documento
      FROM obrigacoes_atividades_clientes oac
      JOIN obrigacoes_clientes oc ON oac.obrigacaoClienteId = oc.id
      JOIN obrigacoes o ON oc.obrigacaoId = o.id
      JOIN clientes c ON oc.clienteId = c.id
      LEFT JOIN (
        SELECT obrigacaoClienteId, MAX(id) AS id, MAX(usuarioId) AS usuarioId
        FROM obrigacoes_clientes_responsaveis
        GROUP BY obrigacaoClienteId
      ) ocr ON ocr.obrigacaoClienteId = oc.id
      LEFT JOIN atividades_obrigacao ao ON ao.obrigacaoId = o.id AND ao.ordem = oac.ordem
      WHERE c.empresaId = ?
        AND oac.tipo = 'Integração: Drive'
        AND oac.concluida = 0
        AND oc.status != 'concluida'
        AND oc.baixadaAutomaticamente = 0
    `, [empresaId]);

    console.log(`[OPEN-LOGIN][CHECK] Encontradas ${atividades.length} atividades pendentes.`);
    if (atividades.length) {
      console.log("[OPEN-LOGIN][SAMPLE]", atividades.slice(0, Math.min(5, atividades.length)));
    }

    if (!atividades.length) {
      console.log("[OPEN-LOGIN][END] Nenhuma pendência. Encerrando sem login.");
      return res.json({ ok: true, message: "Nenhuma atividade pendente para Integração: Drive.", atividades: [] });
    }

    // Enriquecer com campos do pdf layout, se houver
    const layoutIds = [...new Set(atividades.map(a => a.pdf_layout_id).filter(Boolean))];
    let camposPorLayout = {};
    let layoutsInfo = {};
    if (layoutIds.length) {
      const [campos] = await db.query(`
        SELECT layout_id, id, tipo_campo, valor_esperado, posicao_linha, posicao_coluna, regex_validacao
        FROM pdf_layout_campos
        WHERE layout_id IN (${layoutIds.map(() => '?').join(',')})
      `, layoutIds);
      for (const c of campos) {
        if (!camposPorLayout[c.layout_id]) camposPorLayout[c.layout_id] = [];
        camposPorLayout[c.layout_id].push(c);
      }
      const [layouts] = await db.query(`
        SELECT id, nome, departamento_id, status, versao
        FROM pdf_layouts
        WHERE id IN (${layoutIds.map(() => '?').join(',')})
      `, layoutIds);
      for (const l of layouts) layoutsInfo[l.id] = l;
    }

    const atividadesEnriquecidas = atividades.map(a => ({
      ...a,
      pdf_layout: a.pdf_layout_id ? (layoutsInfo[a.pdf_layout_id] || null) : null,
      pdf_campos: a.pdf_layout_id ? (camposPorLayout[a.pdf_layout_id] || []) : []
    }));

    console.log("[OPEN-LOGIN][SKIP_LOGIN] Login ignorado. Listando competências e navegando para a competência com atividades pendentes...");
    const competencias = await listCompetenciasFromDrive(folderUrl, { headless, timeoutMs, slowMoMs });
    const navega = await navigateToFirstCompetencia(folderUrl, { 
      headless, 
      timeoutMs, 
      slowMoMs, 
      atividadesPendentes: atividadesEnriquecidas 
    });

    // Monta titles por competência com base nas atividades pendentes
    const titlesByKey = {};
    for (const a of atividadesEnriquecidas) {
      const key = `${a.ano_referencia}-${String(a.mes_referencia).padStart(2,'0')}`;
      if (!titlesByKey[key]) titlesByKey[key] = [];
      if (a.pdf_titulo_documento) titlesByKey[key].push(a.pdf_titulo_documento);
    }

    // Ordena competências detectadas e processa em sequência do menor para o maior
    const keysOrdered = Array.from(
      new Set(
        (competencias.competencias || [])
          .map(c => c.competencia?.key)
          .filter(Boolean)
      )
    ).sort();

    const sequencia = await processCompetenciasSequential(
      folderUrl,
      keysOrdered,
      titlesByKey,
      { headless, timeoutMs, slowMoMs, openFileInNewPage: openFileInNewPage !== false }
    );

    // Dry-run de matching: tentar casar conteúdos extraídos com atividades
    // Agora processamos TODOS os arquivos que deram match nominal
    const matches = [];
    for (const step of (sequencia || [])) {
      if (!step || !step.ok || !step.results) continue;
      
      // Processa cada resultado (arquivo) desta competência
      for (const result of step.results) {
        if (!result.extraction) continue;
        
        for (const atv of atividadesEnriquecidas) {
          const keyAtividade = `${atv.ano_referencia}-${String(atv.mes_referencia).padStart(2,'0')}`;
          if (keyAtividade !== step.key) continue;
          
          const matchResult = matchExtractionToAtividade(result.extraction, atv);
          const fileUrl = result.fileUrl || (result.file?.dataId ? `https://drive.google.com/file/d/${result.file.dataId}/view` : null);
          matches.push({
            competenciaKey: step.key,
            arquivo: result.file?.name,
            dataId: result.file?.dataId,
            fileUrl,
            obrigacaoClienteId: atv.obrigacaoClienteId,
            atividadeId: atv.id,
            ok: matchResult.ok,
            score: matchResult.score,
            details: matchResult.details,
            extractionStats: result.extraction?.stats
          });
        }
      }
    }

    // Aplicar baixa automática quando houve match OK (melhor score por atividade)
    const bestMatchByAtividade = new Map();
    for (const m of matches) {
      if (!m.ok) continue;
      const current = bestMatchByAtividade.get(m.atividadeId);
      if (!current || (m.score ?? 0) > (current.score ?? 0)) {
        bestMatchByAtividade.set(m.atividadeId, m);
      }
    }

    for (const atv of atividadesEnriquecidas) {
      const bm = bestMatchByAtividade.get(atv.id);
      if (!bm) continue;

      const agora = new Date();
      const dataHora = new Date(agora.getTime() - (agora.getTimezoneOffset() * 60000)).toISOString().slice(0, 19).replace('T', ' ');
      const responsavelIdPreferido = atv.responsavel_usuarioId || req.usuario?.id;

      try {
        // Confirma algum responsável; se não houver, tenta buscar 1 na relação
        let responsavelParaConclusao = responsavelIdPreferido;
        if (!responsavelParaConclusao) {
          const [rowsResp] = await db.query(`SELECT usuarioId FROM obrigacoes_clientes_responsaveis WHERE obrigacaoClienteId = ? LIMIT 1`, [atv.obrigacaoClienteId]);
          responsavelParaConclusao = rowsResp?.[0]?.usuarioId || null;
        }

        // 1) Concluir atividade do cliente
        await db.query(`
          UPDATE obrigacoes_atividades_clientes
          SET concluida = 1, dataConclusao = ?, concluidoPor = ?
          WHERE id = ?
        `, [dataHora, responsavelParaConclusao, atv.id]);

        // 2) Marcar a obrigação do cliente como concluída e baixada automaticamente
        await db.query(`
          UPDATE obrigacoes_clientes 
          SET status = 'concluida', baixadaAutomaticamente = 1, dataBaixa = ?, concluido_por = COALESCE(concluido_por, ?)
          WHERE id = ?
        `, [dataHora, responsavelParaConclusao, atv.obrigacaoClienteId]);

        // 3) Registrar comentário na obrigação com o link do arquivo correspondido
        if (atv.obrigacaoClienteId && bm.fileUrl) {
          await db.query(`
            INSERT INTO comentarios_obrigacao (obrigacaoId, usuarioId, comentario, tipo, criadoEm, anexos)
            VALUES (?, ?, ?, 'arquivo', ?, NULL)
          `, [atv.obrigacaoClienteId, responsavelParaConclusao || req.usuario?.id || null, `Encontrado match com arquivo: ${bm.fileUrl}`, dataHora]);
        }
      } catch (err) {
        console.warn('[OPEN-LOGIN][BAIXA_AUTO][WARN] Falha ao concluir atividade/obrigação:', { atividadeId: atv.id, obrigacaoClienteId: atv.obrigacaoClienteId, err: String(err) });
      }
    }

    return res.json({ ok: true, message: "Pendências encontradas. Competências listadas e navegação executada.", atividades: atividadesEnriquecidas, competencias, navegacao: navega, sequencia, matches });
  } catch (err) {
    console.error("[OPEN-LOGIN][ERROR] Falha no fluxo:", err);
    return res.status(500).json({ ok: false, error: "Erro interno no open-and-login.", details: String(err) });
  }
});


module.exports = router;


