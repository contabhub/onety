const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

// 🔹 Criar cliente
router.post("/", verifyToken, async (req, res) => {
  const {
    tipo_de_pessoa, cnpj, nome_fantasia, tipo_de_papel, codigo_do_cadastro,
    e_mail_principal, telefone_comercial, telefone_celular, abertura_da_empresa,
    razao_social, optante_pelo_simples, pais, cep, endereco, numero, estado, cidade,
    bairro, complemento, pessoa_de_contato, e_mail_pessoa_contato,
    telefone_comercial_pessoa_contato, telefone_celular_pessoa_contato, cargo, observacoes,
    company_id // 👈 agora vem do body
  } = req.body;

  if (!company_id) {
    return res.status(400).json({ error: "O campo company_id é obrigatório." });
  }

  try {
    // Sanitizar dados antes de salvar
    const emailPrincipalSanitizado = e_mail_principal ? e_mail_principal.toLowerCase().trim() : null;
    const emailPessoaContatoSanitizado = e_mail_pessoa_contato ? e_mail_pessoa_contato.toLowerCase().trim() : null;
    const cepSanitizado = cep ? cep.replace(/\D/g, '') : null; // Remove todos os caracteres não numéricos
    
    const [result] = await pool.query(`
      INSERT INTO clientes (
        tipo_de_pessoa, cnpj, nome_fantasia, tipo_de_papel, codigo_do_cadastro,
        e_mail_principal, telefone_comercial, telefone_celular, abertura_da_empresa,
        razao_social, optante_pelo_simples, pais, cep, endereco, numero, estado, cidade,
        bairro, complemento, pessoa_de_contato, e_mail_pessoa_contato,
        telefone_comercial_pessoa_contato, telefone_celular_pessoa_contato, cargo, observacoes,
        created_at, company_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
    `, [
      tipo_de_pessoa, cnpj, nome_fantasia, tipo_de_papel, codigo_do_cadastro,
      emailPrincipalSanitizado, telefone_comercial, telefone_celular, abertura_da_empresa?.trim() === "" ? null : abertura_da_empresa,
      razao_social, optante_pelo_simples, pais, cepSanitizado, endereco, numero, estado, cidade,
      bairro, complemento, pessoa_de_contato, emailPessoaContatoSanitizado,
      telefone_comercial_pessoa_contato, telefone_celular_pessoa_contato, cargo, observacoes,
      company_id
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
    const [clientes] = await pool.query("SELECT * FROM clientes ORDER BY created_at DESC");
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

// 🔹 Listar clientes por company_id
router.get("/company/:companyId", verifyToken, async (req, res) => {
  const { companyId } = req.params;

  try {
    const [clientes] = await pool.query(
      "SELECT * FROM clientes WHERE company_id = ? ORDER BY created_at DESC",
      [companyId]
    );

    res.json(clientes);
  } catch (error) {
    console.error("Erro ao buscar clientes por company_id:", error);
    res.status(500).json({ error: "Erro ao buscar clientes da empresa." });
  }
});

// 🔹 Atualizar cliente
router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const {
    tipo_de_pessoa, cnpj, nome_fantasia, tipo_de_papel, codigo_do_cadastro,
    e_mail_principal, telefone_comercial, telefone_celular, abertura_da_empresa,
    razao_social, optante_pelo_simples, pais, cep, endereco, numero, estado, cidade,
    bairro, complemento, pessoa_de_contato, e_mail_pessoa_contato,
    telefone_comercial_pessoa_contato, telefone_celular_pessoa_contato, cargo, observacoes
  } = req.body;

  try {
    // Sanitizar dados antes de atualizar
    const emailPrincipalSanitizado = e_mail_principal ? e_mail_principal.toLowerCase().trim() : null;
    const emailPessoaContatoSanitizado = e_mail_pessoa_contato ? e_mail_pessoa_contato.toLowerCase().trim() : null;
    const cepSanitizado = cep ? cep.replace(/\D/g, '') : null; // Remove todos os caracteres não numéricos
    
    const [result] = await pool.query(`
      UPDATE clientes SET
        tipo_de_pessoa = ?, cnpj = ?, nome_fantasia = ?, tipo_de_papel = ?, codigo_do_cadastro = ?,
        e_mail_principal = ?, telefone_comercial = ?, telefone_celular = ?, abertura_da_empresa = ?,
        razao_social = ?, optante_pelo_simples = ?, pais = ?, cep = ?, endereco = ?, numero = ?, 
        estado = ?, cidade = ?, bairro = ?, complemento = ?, pessoa_de_contato = ?, 
        e_mail_pessoa_contato = ?, telefone_comercial_pessoa_contato = ?, 
        telefone_celular_pessoa_contato = ?, cargo = ?, observacoes = ?
      WHERE id = ?
    `, [
      tipo_de_pessoa, cnpj, nome_fantasia, tipo_de_papel, codigo_do_cadastro,
      emailPrincipalSanitizado, telefone_comercial, telefone_celular, abertura_da_empresa,
      razao_social, optante_pelo_simples, pais, cepSanitizado, endereco, numero, estado, cidade,
      bairro, complemento, pessoa_de_contato, emailPessoaContatoSanitizado,
      telefone_comercial_pessoa_contato, telefone_celular_pessoa_contato, cargo, observacoes, id
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