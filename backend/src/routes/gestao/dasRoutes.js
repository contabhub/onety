const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const { consultarServico } = require("../../services/gestao/consultarService"); // serviço genérico para consulta API Serpro
const autenticarToken = require("../../middlewares/auth");

const CONTRATANTE_CNPJ = "17422651000172"; // fixo

// Funções para obter CNPJ empresa e cliente
async function obterCnpjEmpresa(empresaId) {
  const [result] = await db.execute(`SELECT cnpj FROM empresas WHERE id = ?`, [empresaId]);
  if (result.length === 0) throw new Error(`Empresa ${empresaId} não encontrada`);
  return result[0].cnpj;
}

async function obterCnpjCliente(clienteId) {
  const [result] = await db.execute(`SELECT cnpjCpf FROM clientes WHERE id = ?`, [clienteId]);
  if (result.length === 0) throw new Error(`Cliente ${clienteId} não encontrado`);
  return result[0].cnpjCpf;
}

// Rota para consultar a última declaração/recibo PGDAS-D
router.post("/consultar-ultima-declaracao", autenticarToken, async (req, res) => {
  const { empresaId, clienteId, ano, mes } = req.body;

  if (!empresaId || !clienteId || !ano || !mes) {
    return res.status(400).json({ error: "empresaId, clienteId, ano e mes são obrigatórios." });
  }

  try {
    const cnpjEmpresa = await obterCnpjEmpresa(empresaId);
    const cnpjCliente = await obterCnpjCliente(clienteId);

    const periodoApuracao = `${ano.toString()}${mes.toString().padStart(2, "0")}`;

    const resposta = await consultarServico(
      CONTRATANTE_CNPJ,
      cnpjEmpresa,
      cnpjCliente,
      "PGDASD",
      "CONSULTIMADECREC14",
      { periodoApuracao }
    );

    if (!resposta) {
      return res.status(500).json({ error: "Resposta vazia da API." });
    }

    const statusHttp = resposta.status || null;
    const mensagens = resposta.mensagens || [];
    const mensagensTexto = mensagens.map(m => `${m.codigo || m.codigoMensagem || ''}: ${m.texto || m.mensagem || ''}`).join(" | ");

    if (statusHttp !== 200) {
      return res.status(500).json({ error: `Erro da API Serpro: ${mensagensTexto}` });
    }

    if (!resposta.dados) {
      return res.status(500).json({ error: "Resposta da API sem dados." });
    }

    let dadosDeclaracao;
    try {
      dadosDeclaracao = JSON.parse(typeof resposta.dados === 'string' ? JSON.parse(resposta.dados) : resposta.dados);
    } catch {
      dadosDeclaracao = resposta.dados;
    }

    // Salvar arquivos base64 no banco (crie a tabela `das` ou adapte para a sua estrutura)
    await db.query(`
      INSERT INTO das (clienteId, empresaId, periodoApuracao, numeroDeclaracao, reciboBase64, declaracaoBase64, maedNotificacaoBase64, maedDarfBase64, dataConsulta)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        reciboBase64 = VALUES(reciboBase64),
        declaracaoBase64 = VALUES(declaracaoBase64),
        maedNotificacaoBase64 = VALUES(maedNotificacaoBase64),
        maedDarfBase64 = VALUES(maedDarfBase64),
        dataConsulta = NOW()
    `, [
      clienteId,
      empresaId,
      periodoApuracao,
      dadosDeclaracao.numeroDeclaracao || null,
      dadosDeclaracao.recibo?.pdf || null,
      dadosDeclaracao.declaracao?.pdf || null,
      dadosDeclaracao.maed?.pdfNotificacao || null,
      dadosDeclaracao.maed?.pdfDarf || null,
    ]);

    // Atualizar o status da obrigação no banco
    await db.query(`
      UPDATE obrigacoes_clientes
      SET status = 'concluida', baixadaAutomaticamente = 1, dataBaixa = NOW()
      WHERE clienteId = ? AND empresaId = ? AND ano_referencia = ? AND mes_referencia = ? 
      AND obrigacaoId = (SELECT id FROM obrigacoes WHERE aliasValidacao = 'DAS' LIMIT 1)
    `, [clienteId, empresaId, ano, mes]);

    return res.json({ message: "Consulta e armazenamento da declaração DAS realizados com sucesso." });

  } catch (error) {
    console.error("Erro na consulta DAS:", error);
    return res.status(500).json({ error: "Erro interno na consulta DAS." });
  }
});

router.post("/integrar-das", autenticarToken, async (req, res) => {
  const { empresaId, clienteId, ano, mes } = req.body;

  if (!empresaId || !ano || !mes) {
    return res.status(400).json({ error: "empresaId, ano e mes são obrigatórios." });
  }

  try {
    // Buscar obrigações DAS que têm tarefas geradas para o período
    const [obrigacoes] = await db.query(
      `SELECT DISTINCT o.*
       FROM obrigacoes o
       JOIN obrigacoes_clientes oc ON o.id = oc.obrigacaoId
       WHERE o.empresaId = ? 
         AND (LOWER(o.nome) LIKE '%das%' OR LOWER(o.aliasValidacao) LIKE '%das%')
         AND oc.ano_referencia = ? 
         AND oc.mes_referencia = ?
      `,
      [empresaId, ano, mes]
    );

    if (obrigacoes.length === 0) {
      return res.status(404).json({ message: "Nenhuma obrigação DAS com tarefas geradas encontrada para essa empresa nesse período." });
    }

    // Se clienteId foi informado, usar só ele; senão, buscar todos os clientes da empresa
    let clientes = [];
    if (clienteId) {
      clientes = [{ id: clienteId }];
    } else {
      const [clientesRows] = await db.query(`SELECT id FROM clientes WHERE empresaId = ?`, [empresaId]);
      clientes = clientesRows;
    }

    const cnpjEmpresa = await obterCnpjEmpresa(empresaId);

    const resultados = [];

    for (const obrigacao of obrigacoes) {
      for (const cliente of clientes) {
        try {
          // Verifica se o cliente possui tarefa gerada para a obrigação, ano e mês
          const [tarefas] = await db.query(
            `SELECT id FROM obrigacoes_clientes 
             WHERE clienteId = ? AND obrigacaoId = ? AND ano_referencia = ? AND mes_referencia = ?`,
            [cliente.id, obrigacao.id, ano, mes]
          );

          if (tarefas.length === 0) {
            resultados.push({ clienteId: cliente.id, obrigacaoId: obrigacao.id, sucesso: false, motivo: "Sem tarefa gerada para o período" });
            continue; // pula para o próximo cliente
          }

          const cnpjCliente = await obterCnpjCliente(cliente.id);

          // Ajustar o período para o mês anterior ao vencimento
          let anoApuracao = ano;
          let mesApuracao = mes - 1;
          if (mesApuracao === 0) {
            mesApuracao = 12;
            anoApuracao = ano - 1;
          }

          const periodoApuracao = `${anoApuracao.toString()}${mesApuracao.toString().padStart(2, "0")}`;

          const resposta = await consultarServico(
            CONTRATANTE_CNPJ,
            cnpjEmpresa,
            cnpjCliente,
            "PGDASD",
            "CONSULTIMADECREC14",
            { periodoApuracao }
          );

          if (!resposta || !resposta.dados) {
            resultados.push({ clienteId: cliente.id, obrigacaoId: obrigacao.id, sucesso: false, motivo: "Sem dados da API" });
            continue;
          }

          let dadosDeclaracao;
          try {
            dadosDeclaracao = JSON.parse(typeof resposta.dados === 'string' ? JSON.parse(resposta.dados) : resposta.dados);
          } catch {
            dadosDeclaracao = resposta.dados;
          }

          await db.query(`
            INSERT INTO das (clienteId, empresaId, periodoApuracao, numeroDeclaracao, reciboBase64, declaracaoBase64, maedNotificacaoBase64, maedDarfBase64, dataConsulta)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
              reciboBase64 = VALUES(reciboBase64),
              declaracaoBase64 = VALUES(declaracaoBase64),
              maedNotificacaoBase64 = VALUES(maedNotificacaoBase64),
              maedDarfBase64 = VALUES(maedDarfBase64),
              dataConsulta = NOW()
          `, [
            cliente.id,
            empresaId,
            periodoApuracao,
            dadosDeclaracao.numeroDeclaracao || null,
            dadosDeclaracao.recibo?.pdf || null,
            dadosDeclaracao.declaracao?.pdf || null,
            dadosDeclaracao.maed?.pdfNotificacao || null,
            dadosDeclaracao.maed?.pdfDarf || null,
          ]);

          // Faz o update na obrigação cliente
          const [updateResult] = await db.query(`
            UPDATE obrigacoes_clientes
            SET status = 'concluida', baixadaAutomaticamente = 1, dataBaixa = NOW()
            WHERE clienteId = ? AND ano_referencia = ? AND mes_referencia = ? AND obrigacaoId = ?
          `, [cliente.id, ano, mes, obrigacao.id]);

          console.log(`Update obrigacoes_clientes - clienteId: ${cliente.id}, obrigacaoId: ${obrigacao.id}, rowsAffected: ${updateResult.affectedRows}`);

          // Buscar o id do registro atualizado na obrigacoes_clientes para inserir comentário
          const [obrigacaoClienteRows] = await db.query(`
            SELECT id FROM obrigacoes_clientes
            WHERE clienteId = ? AND ano_referencia = ? AND mes_referencia = ? AND obrigacaoId = ?
            LIMIT 1
          `, [cliente.id, ano, mes, obrigacao.id]);

          if (obrigacaoClienteRows.length > 0) {
            const obrigacaoClienteId = obrigacaoClienteRows[0].id;

            const usuarioIdSistema = 1; // Ajuste aqui para o ID do usuário sistema ou autenticado

const anexosJson = JSON.stringify({
  recibo: dadosDeclaracao.recibo?.pdf || null,
  declaracao: dadosDeclaracao.declaracao?.pdf || null,
  notificacao: dadosDeclaracao.maed?.pdfNotificacao || null,
  darf: dadosDeclaracao.maed?.pdfDarf || null,
});

await db.query(`
  INSERT INTO comentarios_obrigacao (obrigacaoId, usuarioId, comentario, tipo, criadoEm, anexos)
  VALUES (?, ?, ?, ?, NOW(), ?)
`, [
  obrigacaoClienteId,
  usuarioIdSistema,
  "Declaração DAS integrada automaticamente via integração.",
  "sistema",
  anexosJson
]);
          }

          resultados.push({ clienteId: cliente.id, obrigacaoId: obrigacao.id, sucesso: true });

        } catch (error) {
          resultados.push({ clienteId: cliente.id, obrigacaoId: obrigacao.id, sucesso: false, motivo: error.message });
        }
      }
    }

    return res.json({ resultados });

  } catch (error) {
    console.error("Erro na integração DAS:", error);
    return res.status(500).json({ error: "Erro interno na integração DAS." });
  }
});

module.exports = router;
