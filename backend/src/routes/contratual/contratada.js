const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

// Listar todos os registros
router.get("/", verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM contratada ORDER BY id DESC");
    res.json(rows);
  } catch (error) {
    console.error("Erro ao buscar contratadas:", error);
    res.status(500).json({ error: "Erro ao buscar contratadas." });
  }
});

// Buscar por id
router.get("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query("SELECT * FROM contratada WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Registro não encontrado." });
    res.json(rows[0]);
  } catch (error) {
    console.error("Erro ao buscar contratada:", error);
    res.status(500).json({ error: "Erro ao buscar contratada." });
  }
});

router.get("/empresa/:empresaId", verifyToken, async (req, res) => {
  const { empresaId } = req.params;
  try {
    const [contratadas] = await pool.query(
      "SELECT * FROM contratada WHERE empresa_id = ? ORDER BY id DESC",
      [empresaId]
    );
    res.json(contratadas); // retorna array de contratadas
  } catch (error) {
    console.error("Erro ao buscar contratadas da empresa:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});


// Criar novo registro
router.post("/", verifyToken, async (req, res) => {
  const {
    nome,
    razao_social,
    endereco,
    numero,
    complemento,
    bairro,
    cidade,
    estado,
    cep,
    cnpj,
    telefone,
    empresa_id,
    ativo = 1,
  } = req.body;

  if (!nome || !empresa_id) {
    return res.status(400).json({ error: "Campos obrigatórios: nome e empresa_id." });
  }

  try {
    // Verificar se já existe uma contratada com o mesmo CNPJ na mesma empresa
    if (cnpj) {
      const [existingCnpj] = await pool.query(
        "SELECT id FROM contratada WHERE cnpj = ? AND empresa_id = ?",
        [cnpj, empresa_id]
      );
      
      if (existingCnpj.length > 0) {
        return res.status(400).json({ error: "Já existe uma empresa contratada com este CNPJ nesta empresa." });
      }
    }

    const [result] = await pool.query(
      `INSERT INTO contratada 
      (nome, razao_social, endereco, numero, complemento, bairro, cidade, estado, cep, cnpj, telefone, empresa_id, ativo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nome, razao_social, endereco, numero, complemento, bairro, cidade, estado, cep, cnpj, telefone, empresa_id, ativo]
    );

    res.status(201).json({ message: "Contratada criada com sucesso!", id: result.insertId });
  } catch (error) {
    console.error("Erro ao criar contratada:", error);
    res.status(500).json({ error: "Erro ao criar contratada." });
  }
});

// Atualizar registro
router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const {
    nome,
    razao_social,
    endereco,
    numero,
    complemento,
    bairro,
    cidade,
    estado,
    cep,
    cnpj,
    telefone,
    empresa_id,
    ativo,
  } = req.body;

  try {
    // Verificar se já existe uma contratada com o mesmo CNPJ na mesma empresa (excluindo o registro atual)
    if (cnpj) {
      const [existingCnpj] = await pool.query(
        "SELECT id FROM contratada WHERE cnpj = ? AND empresa_id = ? AND id != ?",
        [cnpj, empresa_id, id]
      );
      
      if (existingCnpj.length > 0) {
        return res.status(400).json({ error: "Já existe uma empresa contratada com este CNPJ nesta empresa." });
      }
    }

    const [result] = await pool.query("UPDATE contratada SET nome=?, razao_social=?, endereco=?, numero=?, complemento=?, bairro=?, cidade=?, estado=?, cep=?, cnpj=?, telefone=?, empresa_id=?, ativo=? WHERE id = ?",
      [nome, razao_social, endereco, numero, complemento, bairro, cidade, estado, cep, cnpj, telefone, empresa_id, ativo, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Registro não encontrado." });
    }

    res.json({ message: "Contratada atualizada com sucesso!" });
  } catch (error) {
    console.error("Erro ao atualizar contratada:", error);
    res.status(500).json({ error: "Erro ao atualizar contratada." });
  }
});

// Deletar registro
router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query("DELETE FROM contratada WHERE id = ?", [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Registro não encontrado." });
    res.json({ message: "Contratada deletada com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar contratada:", error);
    res.status(500).json({ error: "Erro ao deletar contratada." });
  }
});


router.patch("/:id/ativar", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query("UPDATE contratada SET ativo = 1 WHERE id = ?", [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Registro não encontrado." });
    res.json({ message: "Contratada ativada com sucesso!" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao ativar contratada." });
  }
});

router.patch("/:id/inativar", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query("UPDATE contratada SET ativo = 0 WHERE id = ?", [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Registro não encontrado." });
    res.json({ message: "Contratada inativada com sucesso!" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao inativar contratada." });
  }
});


module.exports = router;
