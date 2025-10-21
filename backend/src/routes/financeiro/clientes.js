const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

// 🔹 Criar cliente
router.post("/", verifyToken, async (req, res) => {
  const {
    tipo_pessoa, cpf_cnpj, nome_fantasia, razao_social, apelido,
    email_principal, telefone_comercial, telefone_celular, abertura_empresa,
    optante_simples, pais, cep, endereco, numero, estado, cidade,
    bairro, complemento, observacoes, empresa_id
  } = req.body;

  if (!empresa_id) {
    return res.status(400).json({ error: "O campo empresa_id é obrigatório." });
  }

  try {
    // Sanitizar dados antes de salvar
    const emailPrincipalSanitizado = email_principal ? email_principal.toLowerCase().trim() : null;
    const cepSanitizado = cep ? cep.replace(/\D/g, '') : null; // Remove todos os caracteres não numéricos
    
    const [result] = await pool.query(`
      INSERT INTO clientes (
        tipo_pessoa, cpf_cnpj, nome_fantasia, razao_social, apelido,
        email_principal, telefone_comercial, telefone_celular, abertura_empresa,
        optante_simples, pais, cep, endereco, numero, estado, cidade,
        bairro, complemento, observacoes, empresa_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tipo_pessoa, cpf_cnpj, nome_fantasia, razao_social, apelido,
      emailPrincipalSanitizado, telefone_comercial, telefone_celular, abertura_empresa?.trim() === "" ? null : abertura_empresa,
      optante_simples, pais, cepSanitizado, endereco, numero, estado, cidade,
      bairro, complemento, observacoes, empresa_id
    ]);

    res.status(201).json({ id: result.insertId, message: "Cliente criado com sucesso!" });
  } catch (error) {
    console.error("Erro ao criar cliente:", error);
    res.status(500).json({ error: "Erro ao criar cliente." });
  }
});

// 🔹 Listar todos os clientes
router.get("/", verifyToken, async (req, res) => {
  try {
    const [clientes] = await pool.query("SELECT * FROM clientes ORDER BY criado_em DESC");
    res.json(clientes);
  } catch (error) {
    console.error("Erro ao buscar clientes:", error);
    res.status(500).json({ error: "Erro ao buscar clientes." });
  }
});

// 🔹 Buscar cliente por ID
router.get("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query("SELECT * FROM clientes WHERE id = ?", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Cliente não encontrado." });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error("Erro ao buscar cliente:", error);
    res.status(500).json({ error: "Erro ao buscar cliente." });
  }
});

// 🔹 Listar clientes por empresa_id
router.get("/empresa/:empresaId", verifyToken, async (req, res) => {
  const { empresaId } = req.params;

  try {
    const [clientes] = await pool.query(
      "SELECT * FROM clientes WHERE empresa_id = ? ORDER BY criado_em DESC",
      [empresaId]
    );

    res.json(clientes);
  } catch (error) {
    console.error("Erro ao buscar clientes por empresa_id:", error);
    res.status(500).json({ error: "Erro ao buscar clientes da empresa." });
  }
});

// 🔹 Atualizar cliente
router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const {
    tipo_pessoa, cpf_cnpj, nome_fantasia, razao_social, apelido,
    email_principal, telefone_comercial, telefone_celular, abertura_empresa,
    optante_simples, pais, cep, endereco, numero, estado, cidade,
    bairro, complemento, observacoes
  } = req.body;

  try {
    // Sanitizar dados antes de atualizar
    const emailPrincipalSanitizado = email_principal ? email_principal.toLowerCase().trim() : null;
    const cepSanitizado = cep ? cep.replace(/\D/g, '') : null; // Remove todos os caracteres não numéricos
    
    const [result] = await pool.query(`
      UPDATE clientes SET
        tipo_pessoa = ?, cpf_cnpj = ?, nome_fantasia = ?, razao_social = ?, apelido = ?,
        email_principal = ?, telefone_comercial = ?, telefone_celular = ?, abertura_empresa = ?,
        optante_simples = ?, pais = ?, cep = ?, endereco = ?, numero = ?, 
        estado = ?, cidade = ?, bairro = ?, complemento = ?, observacoes = ?,
        atualizado_em = NOW()
      WHERE id = ?
    `, [
      tipo_pessoa, cpf_cnpj, nome_fantasia, razao_social, apelido,
      emailPrincipalSanitizado, telefone_comercial, telefone_celular, abertura_empresa,
      optante_simples, pais, cepSanitizado, endereco, numero, estado, cidade,
      bairro, complemento, observacoes, id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Cliente não encontrado." });
    }

    res.json({ message: "Cliente atualizado com sucesso!" });
  } catch (error) {
    console.error("Erro ao atualizar cliente:", error);
    res.status(500).json({ error: "Erro ao atualizar cliente." });
  }
});

// 🔹 Deletar cliente
router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query("DELETE FROM clientes WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Cliente não encontrado." });
    }

    res.json({ message: "Cliente deletado com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar cliente:", error);
    res.status(500).json({ error: "Erro ao deletar cliente." });
  }
});

// 🔹 Atualizar apenas o status do cliente (ativo/inativo)
router.patch("/:id/status", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  // Validação do status
  if (!['ativo', 'inativo'].includes(status)) {
    return res.status(400).json({ error: "Status inválido. Use 'ativo' ou 'inativo'." });
  }

  try {
    const [result] = await pool.query(
      "UPDATE clientes SET status = ? WHERE id = ?",
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Cliente não encontrado." });
    }

    res.json({ message: `Status atualizado para '${status}' com sucesso.` });
  } catch (error) {
    console.error("Erro ao atualizar status do cliente:", error);
    res.status(500).json({ error: "Erro ao atualizar status do cliente." });
  }
});

module.exports = router;