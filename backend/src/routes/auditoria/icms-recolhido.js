const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

// ===== ROTAS PARA TABELA ICMS_RECOLHIDO =====

// POST /icms-recolhido - Criar novo registro de ICMS recolhido
router.post("/", verifyToken, async (req, res) => {
  try {
    const { clientes_id, ano, mes, valor } = req.body;

    if (!clientes_id || ano === undefined || mes === undefined || valor === undefined) {
      return res.status(400).json({
        error: "Todos os campos são obrigatórios: clientes_id, ano, mes, valor",
      });
    }

    const clienteId = parseInt(clientes_id, 10);
    const anoInt = parseInt(ano, 10);
    const mesInt = parseInt(mes, 10);
    const valorNumber = Number(valor);

    if (Number.isNaN(clienteId)) {
      return res.status(400).json({ error: "clientes_id inválido" });
    }

    if (!Number.isInteger(anoInt) || anoInt < 2000 || anoInt > 2100) {
      return res.status(400).json({ error: "Ano deve ser um número inteiro entre 2000 e 2100" });
    }

    if (!Number.isInteger(mesInt) || mesInt < 1 || mesInt > 12) {
      return res.status(400).json({ error: "Mês deve ser um número inteiro entre 1 e 12" });
    }

    if (Number.isNaN(valorNumber) || valorNumber < 0) {
      return res.status(400).json({ error: "Valor deve ser um número positivo" });
    }

    const [clienteRows] = await pool.query(
      `
        SELECT id
        FROM clientes
        WHERE id = ?
        LIMIT 1
      `,
      [clienteId]
    );

    if (!clienteRows.length) {
      return res.status(400).json({ error: "Cliente não encontrado" });
    }

    const [existenteRows] = await pool.query(
      `
        SELECT id
        FROM icms_recolhido
        WHERE cliente_id = ?
          AND ano = ?
          AND mes = ?
        LIMIT 1
      `,
      [clienteId, anoInt, mesInt]
    );

    if (existenteRows.length) {
      return res.status(400).json({
        error: "Já existe um registro de ICMS recolhido para este cliente no ano/mês especificado",
      });
    }

    const [resultadoInsercao] = await pool.query(
      `
        INSERT INTO icms_recolhido (cliente_id, ano, mes, valor)
        VALUES (?, ?, ?, ?)
      `,
      [clienteId, anoInt, mesInt, valorNumber]
    );

    const [registro] = await pool.query(
      `
        SELECT
          ir.id,
          ir.cliente_id AS clientes_id,
          ir.ano,
          ir.mes,
          ir.valor,
          ir.criado_em AS created_at,
          c.id AS cliente_id,
          c.nome_fantasia AS nome,
          c.cpf_cnpj AS cnpj,
          c.estado AS uf
        FROM icms_recolhido ir
        LEFT JOIN clientes c ON c.id = ir.cliente_id
        WHERE ir.id = ?
        LIMIT 1
      `,
      [resultadoInsercao.insertId]
    );

    res.status(201).json(registro[0]);
  } catch (err) {
    console.error("Erro ao criar registro de ICMS recolhido:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// GET /icms-recolhido - Listar registros de ICMS recolhido
router.get("/", verifyToken, async (req, res) => {
  try {
    const { clientes_id, ano, mes, limit = 100, offset = 0 } = req.query;

    const limite = parseInt(limit, 10);
    const deslocamento = parseInt(offset, 10);
    const filtros = [];
    const params = [];

    if (clientes_id) {
      filtros.push("ir.cliente_id = ?");
      params.push(parseInt(clientes_id, 10));
    }

    if (ano) {
      filtros.push("ir.ano = ?");
      params.push(parseInt(ano, 10));
    }

    if (mes) {
      filtros.push("ir.mes = ?");
      params.push(parseInt(mes, 10));
    }

    const whereClause = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

    const consulta = `
      SELECT
        ir.id,
        ir.cliente_id AS clientes_id,
        ir.ano,
        ir.mes,
        ir.valor,
        ir.criado_em AS created_at,
        c.id AS cliente_id,
        c.nome_fantasia AS nome,
        c.cpf_cnpj AS cnpj,
        c.estado AS uf
      FROM icms_recolhido ir
      LEFT JOIN clientes c ON c.id = ir.cliente_id
      ${whereClause}
      ORDER BY ir.ano DESC, ir.mes DESC, ir.criado_em DESC
      LIMIT ?
      OFFSET ?
    `;

    const [rows] = await pool.query(consulta, [...params, limite, deslocamento]);

    res.json(
      rows.map((row) => ({
        id: row.id,
        clientes_id: row.clientes_id,
        ano: row.ano,
        mes: row.mes,
        valor: row.valor,
        created_at: row.created_at,
        clientes: row.cliente_id
          ? {
              id: row.cliente_id,
              nome: row.nome,
              cnpj: row.cnpj,
              uf: row.uf,
            }
          : null,
      }))
    );
  } catch (err) {
    console.error("Erro ao buscar registros de ICMS recolhido:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// GET /icms-recolhido/:id - Buscar registro por ID
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const [rows] = await pool.query(
      `
        SELECT
          ir.id,
          ir.cliente_id AS clientes_id,
          ir.ano,
          ir.mes,
          ir.valor,
          ir.criado_em AS created_at,
          c.id AS cliente_id,
          c.nome_fantasia AS nome,
          c.cpf_cnpj AS cnpj,
          c.estado AS uf
        FROM icms_recolhido ir
        LEFT JOIN clientes c ON c.id = ir.cliente_id
        WHERE ir.id = ?
        LIMIT 1
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Registro de ICMS recolhido não encontrado." });
    }

    const row = rows[0];

    res.json({
      id: row.id,
      clientes_id: row.clientes_id,
      ano: row.ano,
      mes: row.mes,
      valor: row.valor,
      created_at: row.created_at,
      clientes: row.cliente_id
        ? {
            id: row.cliente_id,
            nome: row.nome,
            cnpj: row.cnpj,
            uf: row.uf,
          }
        : null,
    });
  } catch (err) {
    console.error("Erro ao buscar registro de ICMS recolhido:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// PUT /icms-recolhido/:id - Atualizar registro
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { ano, mes, valor } = req.body;

    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    if (ano === undefined && mes === undefined && valor === undefined) {
      return res.status(400).json({
        error: "Pelo menos um campo deve ser fornecido para atualização: ano, mes, valor",
      });
    }

    if (ano !== undefined) {
      const anoInt = parseInt(ano, 10);
      if (!Number.isInteger(anoInt) || anoInt < 2000 || anoInt > 2100) {
        return res.status(400).json({ error: "Ano deve ser um número inteiro entre 2000 e 2100" });
      }
    }

    if (mes !== undefined) {
      const mesInt = parseInt(mes, 10);
      if (!Number.isInteger(mesInt) || mesInt < 1 || mesInt > 12) {
        return res.status(400).json({ error: "Mês deve ser um número inteiro entre 1 e 12" });
      }
    }

    if (valor !== undefined) {
      const valorNumber = Number(valor);
      if (Number.isNaN(valorNumber) || valorNumber < 0) {
        return res.status(400).json({ error: "Valor deve ser um número positivo" });
      }
    }

    const campos = [];
    const params = [];

    if (ano !== undefined) {
      campos.push("ano = ?");
      params.push(parseInt(ano, 10));
    }

    if (mes !== undefined) {
      campos.push("mes = ?");
      params.push(parseInt(mes, 10));
    }

    if (valor !== undefined) {
      campos.push("valor = ?");
      params.push(Number(valor));
    }

    if (!campos.length) {
      return res.status(400).json({ error: "Nenhum campo válido para atualizar" });
    }

    params.push(id);

    const [resultado] = await pool.query(
      `
        UPDATE icms_recolhido
        SET ${campos.join(", ")}
        WHERE id = ?
      `,
      params
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: "Registro de ICMS recolhido não encontrado." });
    }

    const [[registroAtualizado]] = await pool.query(
      `
        SELECT
          ir.id,
          ir.cliente_id AS clientes_id,
          ir.ano,
          ir.mes,
          ir.valor,
          ir.criado_em AS created_at,
          c.id AS cliente_id,
          c.nome_fantasia AS nome,
          c.cpf_cnpj AS cnpj,
          c.estado AS uf
        FROM icms_recolhido ir
        LEFT JOIN clientes c ON c.id = ir.cliente_id
        WHERE ir.id = ?
        LIMIT 1
      `,
      [id]
    );

    res.json({
      id: registroAtualizado.id,
      clientes_id: registroAtualizado.clientes_id,
      ano: registroAtualizado.ano,
      mes: registroAtualizado.mes,
      valor: registroAtualizado.valor,
      created_at: registroAtualizado.created_at,
      clientes: registroAtualizado.cliente_id
        ? {
            id: registroAtualizado.cliente_id,
            nome: registroAtualizado.nome,
            cnpj: registroAtualizado.cnpj,
            uf: registroAtualizado.uf,
          }
        : null,
    });
  } catch (err) {
    console.error("Erro ao atualizar registro de ICMS recolhido:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// DELETE /icms-recolhido/:id - Deletar registro
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const [resultado] = await pool.query(
      `
        DELETE FROM icms_recolhido
        WHERE id = ?
      `,
      [id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: "Registro de ICMS recolhido não encontrado." });
    }

    res.json({ success: true, message: "Registro de ICMS recolhido deletado com sucesso" });
  } catch (err) {
    console.error("Erro ao deletar registro de ICMS recolhido:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// GET /icms-recolhido/cliente/:clientes_id - Buscar registros por cliente
router.get("/cliente/:clientes_id", verifyToken, async (req, res) => {
  try {
    const clienteId = parseInt(req.params.clientes_id, 10);
    const { ano, mes, limit = 100, offset = 0 } = req.query;

    if (Number.isNaN(clienteId)) {
      return res.status(400).json({ error: "clientes_id inválido" });
    }

    const limite = parseInt(limit, 10);
    const deslocamento = parseInt(offset, 10);

    const filtros = ["ir.cliente_id = ?"];
    const params = [clienteId];

    if (ano) {
      filtros.push("ir.ano = ?");
      params.push(parseInt(ano, 10));
    }

    if (mes) {
      filtros.push("ir.mes = ?");
      params.push(parseInt(mes, 10));
    }

    const whereClause = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

    const consulta = `
      SELECT
        ir.id,
        ir.cliente_id AS clientes_id,
        ir.ano,
        ir.mes,
        ir.valor,
        ir.criado_em AS created_at,
        c.id AS cliente_id,
        c.nome_fantasia AS nome,
        c.cpf_cnpj AS cnpj,
        c.estado AS uf
      FROM icms_recolhido ir
      LEFT JOIN clientes c ON c.id = ir.cliente_id
      ${whereClause}
      ORDER BY ir.ano DESC, ir.mes DESC, ir.criado_em DESC
      LIMIT ?
      OFFSET ?
    `;

    const [rows] = await pool.query(consulta, [...params, limite, deslocamento]);

    res.json(
      rows.map((row) => ({
        id: row.id,
        clientes_id: row.clientes_id,
        ano: row.ano,
        mes: row.mes,
        valor: row.valor,
        created_at: row.created_at,
        clientes: row.cliente_id
          ? {
              id: row.cliente_id,
              nome: row.nome,
              cnpj: row.cnpj,
              uf: row.uf,
            }
          : null,
      }))
    );
  } catch (err) {
    console.error("Erro ao buscar registros de ICMS recolhido por cliente:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// GET /icms-recolhido/resumo/:clientes_id - Resumo de ICMS recolhido por cliente
router.get("/resumo/:clientes_id", verifyToken, async (req, res) => {
  try {
    const clienteId = parseInt(req.params.clientes_id, 10);
    const { ano } = req.query;

    if (Number.isNaN(clienteId)) {
      return res.status(400).json({ error: "clientes_id inválido" });
    }

    const filtros = ["cliente_id = ?"];
    const params = [clienteId];

    if (ano) {
      filtros.push("ano = ?");
      params.push(parseInt(ano, 10));
    }

    const [rows] = await pool.query(
      `
        SELECT ano, mes, valor
        FROM icms_recolhido
        WHERE ${filtros.join(" AND ")}
        ORDER BY ano DESC, mes DESC
      `,
      params
    );

    const totalValor =
      rows.reduce((soma, registro) => soma + Number.parseFloat(registro.valor || 0), 0) || 0;
    const totalRegistros = rows.length;
    const valorMedio = totalRegistros > 0 ? totalValor / totalRegistros : 0;

    const porAno = {};
    rows.forEach((registro) => {
      if (!porAno[registro.ano]) {
        porAno[registro.ano] = {
          ano: registro.ano,
          totalValor: 0,
          totalRegistros: 0,
          meses: [],
        };
      }

      porAno[registro.ano].totalValor += Number.parseFloat(registro.valor || 0);
      porAno[registro.ano].totalRegistros += 1;
      porAno[registro.ano].meses.push({
        mes: registro.mes,
        valor: Number.parseFloat(registro.valor || 0),
      });
    });

    res.json({
      cliente_id: clienteId,
      resumo_geral: {
        total_valor: totalValor,
        total_registros: totalRegistros,
        valor_medio: valorMedio,
      },
      por_ano: Object.values(porAno),
    });
  } catch (err) {
    console.error("Erro ao buscar resumo de ICMS recolhido:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

module.exports = router;
