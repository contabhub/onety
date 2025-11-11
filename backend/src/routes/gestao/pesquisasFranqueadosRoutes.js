const express = require("express");
const crypto = require("crypto");
const verifyToken = require("../../middlewares/auth");
const db = require("../../config/database");

const router = express.Router();
const DUPLICATE_INTERVAL_DAYS = 60;

class ServiceError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

async function getFranqueadora(empresaId) {
  const [[empresa]] = await db.query(
    `SELECT id, tipo_empresa, razaoSocial, logo_url, pesquisaSatisfacaoAtiva
     FROM empresas
     WHERE id = ?`,
    [empresaId]
  );

  if (!empresa) {
    throw new ServiceError("Empresa não encontrada.", 404);
  }

  if (empresa.tipo_empresa !== "franqueadora") {
    throw new ServiceError(
      "Apenas empresas franqueadoras podem gerar pesquisas para franqueados.",
      403
    );
  }

  return empresa;
}

async function getFranqueados(empresaId) {
  try {
    const [franqueadosVinculados] = await db.query(
      `SELECT id
       FROM empresas
       WHERE tipo_empresa = 'franqueado' AND franqueadora_id = ?`,
      [empresaId]
    );

    return franqueadosVinculados;
  } catch (error) {
    if (error.code !== "ER_BAD_FIELD_ERROR") {
      throw error;
    }

    const [franqueados] = await db.query(
      `SELECT id
       FROM empresas
       WHERE tipo_empresa = 'franqueado'`
    );
    return franqueados;
  }
}

async function getRecentSurveyIds(empresaId) {
  const [rows] = await db.query(
    `SELECT franqueado_id
     FROM pesquisas_satisfacao_franqueados
     WHERE empresa_id = ? AND data_envio >= DATE_SUB(NOW(), INTERVAL ${DUPLICATE_INTERVAL_DAYS} DAY)`,
    [empresaId]
  );

  return new Set(rows.map((row) => row.franqueado_id));
}

async function insertSurveys(empresaId, franqueadoIds) {
  if (!franqueadoIds.length) {
    return { inserted: 0, tokens: [] };
  }

  const now = new Date();
  const tokens = franqueadoIds.map(() => crypto.randomBytes(24).toString("hex"));
  const values = franqueadoIds.map((franqueadoId, index) => [
    empresaId,
    franqueadoId,
    tokens[index],
    "enviado",
    now,
    now,
    now,
  ]);

  const placeholders = values.map(() => "(?,?,?,?,?,?,?)").join(", ");

  await db.query(
    `INSERT INTO pesquisas_satisfacao_franqueados
      (empresa_id, franqueado_id, token, status, data_envio, criado_em, atualizado_em)
     VALUES ${placeholders}`,
    values.flat()
  );

  return {
    inserted: franqueadoIds.length,
    tokens: franqueadoIds.map((id, index) => ({
      franqueadoId: id,
      token: tokens[index],
    })),
  };
}

async function generateSurveysForFranqueadora(empresaId) {
  if (!empresaId) {
    throw new ServiceError("empresaId é obrigatório.", 400);
  }

  const empresa = await getFranqueadora(empresaId);
  const franqueados = await getFranqueados(empresaId);

  if (!franqueados.length) {
    return {
      empresa,
      totalFranqueados: 0,
      gerados: 0,
      ignoradosPorDuplicidade: 0,
      tokens: [],
    };
  }

  const recentes = await getRecentSurveyIds(empresaId);
  const elegiveis = franqueados
    .map((f) => f.id)
    .filter((id) => !recentes.has(id));

  const { inserted, tokens } = await insertSurveys(empresaId, elegiveis);

  return {
    empresa,
    totalFranqueados: franqueados.length,
    gerados: inserted,
    ignoradosPorDuplicidade: franqueados.length - inserted,
    tokens,
  };
}

router.post("/gerar", verifyToken, async (req, res) => {
  try {
    const empresaId =
      req.body?.empresaId ??
      req.query?.empresaId ??
      req.usuario?.empresaId ??
      req.user?.empresaId ??
      null;

    const resultado = await generateSurveysForFranqueadora(empresaId);

    return res.json({
      sucesso: true,
      empresaId: resultado.empresa.id,
      totalFranqueados: resultado.totalFranqueados,
      pesquisasGeradas: resultado.gerados,
      ignoradosPorDuplicidade: resultado.ignoradosPorDuplicidade,
      tokens: resultado.tokens,
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return res.status(error.status).json({ erro: error.message });
    }

    console.error("Erro ao gerar pesquisas para franqueados:", error);
    return res
      .status(500)
      .json({ erro: "Erro interno ao gerar pesquisas para franqueados." });
  }
});

router.get("/externo/estatisticas/:empresaId", verifyToken, async (req, res) => {
  const { empresaId } = req.params;

  try {
    const [[empresa]] = await db.query(
      "SELECT tipo_empresa FROM empresas WHERE id = ? LIMIT 1",
      [empresaId]
    );

    if (!empresa || empresa.tipo_empresa !== "franqueadora") {
      return res.json({ isFranqueadora: false });
    }

    const [[totalEnvios]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM pesquisas_satisfacao_franqueados
       WHERE empresa_id = ?`,
      [empresaId]
    );

    const [[totalRespostas]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM pesquisas_satisfacao_franqueados
       WHERE empresa_id = ? AND status = 'respondido'`,
      [empresaId]
    );

    const [[estatisticasSalas]] = await db.query(
      `SELECT
         SUM(CASE WHEN nps_classificacao = 'sala_verde' THEN 1 ELSE 0 END) AS verde,
         SUM(CASE WHEN nps_classificacao = 'sala_amarela' THEN 1 ELSE 0 END) AS amarela,
         SUM(CASE WHEN nps_classificacao = 'sala_vermelha' THEN 1 ELSE 0 END) AS vermelha
       FROM pesquisas_satisfacao_franqueados
       WHERE empresa_id = ? AND status = 'respondido'`,
      [empresaId]
    );

    const [[notasMedias]] = await db.query(
      `SELECT
         AVG(nota_dep_fiscal) AS fiscal,
         AVG(nota_dep_pessoal) AS pessoal,
         AVG(nota_dep_contabil) AS contabil
       FROM pesquisas_satisfacao_franqueados
       WHERE empresa_id = ? AND status = 'respondido'`,
      [empresaId]
    );

    const salasVerde = Number(estatisticasSalas.verde ?? 0);
    const salasAmarela = Number(estatisticasSalas.amarela ?? 0);
    const salasVermelha = Number(estatisticasSalas.vermelha ?? 0);

    const totalRespondidas = salasVerde + salasAmarela + salasVermelha;

    const totalSatisfeitos = salasVerde + salasAmarela;

    const taxaSatisfacao =
      totalRespondidas > 0
        ? Math.round((totalSatisfeitos / totalRespondidas) * 100)
        : 0;

    return res.json({
      isFranqueadora: true,
      total_envios: Number(totalEnvios.total ?? 0),
      total_respostas: Number(totalRespostas.total ?? 0),
      salas: {
        verde: salasVerde,
        amarela: salasAmarela,
        vermelha: salasVermelha,
      },
      taxa_satisfacao: taxaSatisfacao,
      notas_medias: {
        fiscal: notasMedias.fiscal ? Number(notasMedias.fiscal.toFixed(1)) : 0,
        pessoal: notasMedias.pessoal
          ? Number(notasMedias.pessoal.toFixed(1))
          : 0,
        contabil: notasMedias.contabil
          ? Number(notasMedias.contabil.toFixed(1))
          : 0,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar estatísticas públicas:", error);
    return res.status(500).json({ error: "Erro ao buscar estatísticas." });
  }
});

router.get("/externo/detalhado/:empresaId", verifyToken, async (req, res) => {
  const { empresaId } = req.params;

  try {
    const [pesquisas] = await db.query(
      `SELECT 
         psf.id,
         psf.franqueado_id,
         ef.nome AS unidade_razao_social,
         u.nome AS admin_nome,
         psf.nota_satisfacao_geral,
         psf.nps_classificacao,
         psf.data_resposta,
         psf.comentario_geral,
         psf.nota_atendimento,
         psf.nota_ti,
         psf.nota_parceiros,
         psf.nota_dep_fiscal,
         psf.nota_dep_pessoal,
         psf.nota_dep_contabil,
         psf.comentario_atendimento,
         psf.comentario_ti,
         psf.comentario_parceiros,
         psf.comentario_fiscal,
         psf.comentario_pessoal,
         psf.comentario_contabil,
         psf.nota_demanda_fiscal,
         psf.nota_demanda_pessoal,
         psf.nota_demanda_contabil,
         psf.utiliza_backoffice_pessoal,
         psf.utiliza_backoffice_fiscal,
         psf.utiliza_backoffice_contabil,
         psf.nao_utiliza_backoffice
       FROM pesquisas_satisfacao_franqueados psf
       INNER JOIN empresas ef ON ef.id = psf.franqueado_id
       LEFT JOIN usuarios u ON u.id = ef.admin_usuario_id
       WHERE psf.empresa_id = ? AND psf.status = 'respondido'
       ORDER BY psf.data_resposta DESC`,
      [empresaId]
    );

    const formatado = pesquisas.map((pesquisa) => {
      const franqueadoNome = (pesquisa.admin_nome || "").trim() || "Administrador";
      const unidadeRazao = (pesquisa.unidade_razao_social || "").trim() || "Unidade sem razão social";

      return {
        ...pesquisa,
        franqueado_nome: franqueadoNome,
        unidade: unidadeRazao,
      };
    });

    return res.json({ pesquisas: formatado });
  } catch (error) {
    console.error("Erro ao buscar dados detalhados públicos:", error);
    return res.status(500).json({ error: "Erro ao buscar dados detalhados." });
  }
});

router.get("/externo/sem-resposta/:empresaId", verifyToken, async (req, res) => {
  const { empresaId } = req.params;

  try {
    const [franqueados] = await db.query(
      `SELECT 
         ef.id,
         ef.razaoSocial AS nome,
         COALESCE(ef.cidade, '') AS cidade,
         COALESCE(ef.estado, '') AS estado,
         psf.data_envio
       FROM pesquisas_satisfacao_franqueados psf
       INNER JOIN empresas ef ON ef.id = psf.franqueado_id
       WHERE psf.empresa_id = ? 
         AND psf.status = 'enviado'
         AND psf.data_resposta IS NULL
       ORDER BY psf.data_envio DESC`,
      [empresaId]
    );

    const formatado = franqueados.map((franqueado) => ({
      ...franqueado,
      unidade: [
        franqueado.cidade?.trim() || null,
        franqueado.estado?.trim() || null,
      ]
        .filter(Boolean)
        .join(" - "),
    }));

    return res.json({ franqueados: formatado });
  } catch (error) {
    console.error("Erro ao buscar franqueados sem resposta públicos:", error);
    return res.status(500).json({ error: "Erro ao buscar franqueados." });
  }
});

router.post("/externo/reenviar", verifyToken, async (req, res) => {
  try {
    const { empresaId, franqueadoIds, reenviarTodos } = req.body || {};

    if (!empresaId) {
      return res.status(400).json({ error: "empresaId é obrigatório." });
    }

    const [[empresa]] = await db.query(
      `SELECT tipo_empresa, razaoSocial, logo_url FROM empresas WHERE id = ?`,
      [empresaId]
    );

    if (!empresa || empresa.tipo_empresa !== "franqueadora") {
      return res
        .status(403)
        .json({ error: "Empresa não é franqueadora ou não encontrada." });
    }

    let franqueadosParaReenviar = [];

    if (reenviarTodos) {
      const [franqueados] = await db.query(
        `SELECT psf.id AS pesquisa_id, ef.id, ef.razaoSocial AS nome,
                COALESCE(ef.cidade, '') AS cidade, COALESCE(ef.estado, '') AS estado
         FROM pesquisas_satisfacao_franqueados psf
         INNER JOIN empresas ef ON ef.id = psf.franqueado_id
         WHERE psf.empresa_id = ? AND psf.status = 'enviado'`,
        [empresaId]
      );
      franqueadosParaReenviar = franqueados;
    } else if (Array.isArray(franqueadoIds) && franqueadoIds.length > 0) {
      const placeholders = franqueadoIds.map(() => "?").join(",");
      const [franqueados] = await db.query(
        `SELECT psf.id AS pesquisa_id, ef.id, ef.razaoSocial AS nome,
                COALESCE(ef.cidade, '') AS cidade, COALESCE(ef.estado, '') AS estado
         FROM pesquisas_satisfacao_franqueados psf
         INNER JOIN empresas ef ON ef.id = psf.franqueado_id
         WHERE psf.empresa_id = ?
           AND psf.status = 'enviado'
           AND ef.id IN (${placeholders})`,
        [empresaId, ...franqueadoIds]
      );
      franqueadosParaReenviar = franqueados;
    } else {
      return res.status(400).json({
        error: "Selecione franqueados ou marque reenviarTodos.",
      });
    }

    if (!franqueadosParaReenviar.length) {
      return res.status(404).json({
        error: "Nenhum franqueado elegível para reenvio.",
      });
    }

    const now = new Date();
    const atualizacoes = [];

    for (const franqueado of franqueadosParaReenviar) {
      const novoToken = crypto.randomBytes(24).toString("hex");
      atualizacoes.push(
        db.query(
          `UPDATE pesquisas_satisfacao_franqueados
           SET token = ?, data_envio = ?, atualizado_em = ?
           WHERE id = ?`,
          [novoToken, now, now, franqueado.pesquisa_id]
        )
      );
    }

    await Promise.all(atualizacoes);

    return res.json({
      success: true,
      message: `${franqueadosParaReenviar.length} pesquisa(s) reenviada(s) com sucesso.`,
      totalReenviadas: franqueadosParaReenviar.length,
    });
  } catch (error) {
    console.error("Erro ao reenviar pesquisas:", error);
    return res.status(500).json({ error: "Erro ao reenviar pesquisas." });
  }
});

router.get("/externo/info/:token", async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: "Token é obrigatório." });
    }

    const [[pesquisa]] = await db.query(
      `SELECT psf.id,
              psf.empresa_id,
              psf.franqueado_id,
              psf.status,
              psf.data_envio,
              e.razaoSocial,
              e.logo_url,
              ef.razaoSocial AS nomeFranqueado,
              ef.nome AS nomeFantasiaFranqueado,
              ef.cidade,
              ef.estado
       FROM pesquisas_satisfacao_franqueados psf
       LEFT JOIN empresas e ON e.id = psf.empresa_id
       LEFT JOIN empresas ef ON ef.id = psf.franqueado_id
       WHERE psf.token = ?
       LIMIT 1`,
      [token]
    );

    if (!pesquisa || pesquisa.status !== "enviado") {
      return res.status(404).json({
        error: "Token de pesquisa inválido ou já utilizado.",
      });
    }

    return res.json({
      razaoSocial: pesquisa.razaoSocial,
      logo_url: pesquisa.logo_url,
      nomeFranqueado:
        pesquisa.nomeFranqueado || pesquisa.nomeFantasiaFranqueado || "Franqueado",
      unidade: pesquisa.cidade
        ? `${pesquisa.cidade || ""}${pesquisa.estado ? ` - ${pesquisa.estado}` : ""}`
        : pesquisa.estado || "",
    });
  } catch (error) {
    console.error("Erro ao buscar info pública da pesquisa:", error);
    return res.status(500).json({ error: "Erro ao buscar dados da pesquisa." });
  }
});

router.post("/externo/responder", async (req, res) => {
  const {
    token,
    notaSatisfacaoGeral,
    comentarioGeral,
    notaAtendimento,
    notaTi,
    notaParceiros,
    comentarioAtendimento,
    comentarioTi,
    comentarioParceiros,
    utilizaBackofficePessoal,
    utilizaBackofficeFiscal,
    utilizaBackofficeContabil,
    naoUtilizaBackoffice,
    notaDepPessoal,
    notaDemandasPessoal,
    comentarioPessoal,
    notaDepFiscal,
    notaDemandasFiscal,
    comentarioFiscal,
    notaDepContabil,
    notaDemandasContabil,
    comentarioContabil,
  } = req.body || {};

  if (!token || typeof notaSatisfacaoGeral !== "number") {
    return res
      .status(400)
      .json({ error: "Token e nota de satisfação geral são obrigatórios." });
  }

  try {
    const [[pesquisa]] = await db.query(
      `SELECT id, franqueado_id, empresa_id, status
       FROM pesquisas_satisfacao_franqueados
       WHERE token = ?
       LIMIT 1`,
      [token]
    );

    if (!pesquisa || pesquisa.status !== "enviado") {
      return res.status(404).json({ error: "Token inválido ou pesquisa já respondida." });
    }

    let nps_classificacao = "sem_resposta";
    if (notaSatisfacaoGeral >= 7) nps_classificacao = "sala_verde";
    else if (notaSatisfacaoGeral === 5 || notaSatisfacaoGeral === 6)
      nps_classificacao = "sala_amarela";
    else if (notaSatisfacaoGeral >= 0 && notaSatisfacaoGeral <= 4)
      nps_classificacao = "sala_vermelha";

    await db.query(
      `UPDATE pesquisas_satisfacao_franqueados
       SET status = 'respondido',
           data_resposta = NOW(),
           nota_satisfacao_geral = ?,
           comentario_geral = ?,
           nota_atendimento = ?,
           nota_ti = ?,
           nota_parceiros = ?,
           comentario_atendimento = ?,
           comentario_ti = ?,
           comentario_parceiros = ?,
           utiliza_backoffice_pessoal = ?,
           utiliza_backoffice_fiscal = ?,
           utiliza_backoffice_contabil = ?,
           nao_utiliza_backoffice = ?,
           nota_dep_pessoal = ?,
           nota_demanda_pessoal = ?,
           comentario_pessoal = ?,
           nota_dep_fiscal = ?,
           nota_demanda_fiscal = ?,
           comentario_fiscal = ?,
           nota_dep_contabil = ?,
           nota_demanda_contabil = ?,
           comentario_contabil = ?,
           nps_classificacao = ?,
           atualizado_em = NOW()
       WHERE id = ?`,
      [
        notaSatisfacaoGeral,
        comentarioGeral || null,
        notaAtendimento || null,
        notaTi || null,
        notaParceiros || null,
        comentarioAtendimento || null,
        comentarioTi || null,
        comentarioParceiros || null,
        !!utilizaBackofficePessoal,
        !!utilizaBackofficeFiscal,
        !!utilizaBackofficeContabil,
        !!naoUtilizaBackoffice,
        notaDepPessoal || null,
        notaDemandasPessoal || null,
        comentarioPessoal || null,
        notaDepFiscal || null,
        notaDemandasFiscal || null,
        comentarioFiscal || null,
        notaDepContabil || null,
        notaDemandasContabil || null,
        comentarioContabil || null,
        nps_classificacao,
        pesquisa.id,
      ]
    );

    return res.json({
      success: true,
      message: "Resposta registrada com sucesso!",
      nps_classificacao,
    });
  } catch (error) {
    console.error("Erro ao registrar resposta pública:", error);
    return res.status(500).json({ error: "Erro ao registrar resposta." });
  }
});

module.exports = router;

