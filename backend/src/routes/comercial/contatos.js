const express = require("express");
const router = express.Router();
const db = require("../../config/database"); // Adapte o caminho conforme necessário





// Buscar crm_contatos por nome OU telefone, com parâmetro único "q"
router.get('/search', async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: "Informe o nome ou telefone para buscar." });
  }

  // Busca em ambos os campos, independente do que foi passado
  const query = 'SELECT * FROM crm_contatos WHERE nome LIKE ? OR telefone LIKE ?';
  const values = [`%${q}%`, `%${q}%`];

  try {
    const [crm_contatos] = await db.query(query, values);
    return res.json(crm_contatos);
  } catch (error) {
    console.error('Erro ao buscar crm_contatos:', error);
    return res.status(500).json({ error: 'Erro ao buscar crm_contatos' });
  }
});

router.get('/equipe/:empresa_id', async (req, res) => {
  const { empresa_id } = req.params;

  try {
    const [crm_contatos] = await db.query(
      'SELECT * FROM crm_contatos WHERE empresa_id = ?',
      [empresa_id]
    );

    res.json(crm_contatos);
  } catch (error) {
    console.error("Erro ao buscar crm_contatos da equipe:", error);
    res.status(500).json({ error: "Erro ao buscar crm_contatos da equipe" });
  }
});





// 1. Listar os crm_contatos de um lead
router.get('/:lead_id', async (req, res) => {
  const { lead_id } = req.params; // Agora estamos pegando o lead_id diretamente da URL

  try {
    const [crm_contatos] = await db.query(
      'SELECT * FROM crm_contatos WHERE lead_id = ?',
      [lead_id]
    );

    if (crm_contatos.length === 0) {
      return res.status(404).json({ error: 'Nenhum contato encontrado para este lead' });
    }

    return res.json(crm_contatos);
  } catch (error) {
    console.error('Erro ao buscar crm_contatos:', error);
    return res.status(500).json({ error: 'Erro ao buscar crm_contatos' });
  }
});

// 5. Buscar um contato específico por ID
router.get("/contato/:id", async (req, res) => {
  const { id } = req.params; // Pegamos o id do contato diretamente da URL

  try {
    const [contato] = await db.query(
      'SELECT * FROM crm_contatos WHERE id = ?',
      [id]
    );

    if (contato.length === 0) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }

    return res.json(contato[0]); // Retorna o primeiro (e único) contato encontrado
  } catch (error) {
    console.error('Erro ao buscar contato:', error);
    return res.status(500).json({ error: 'Erro ao buscar contato' });
  }
});


// 2. Criar um novo contato
router.post("/", async (req, res) => {
  const { lead_id, nome, email, telefone, cpf, empresa_id } = req.body;

  if (!nome || !email || !telefone) {
    return res.status(400).json({ error: "nome, email e telefone são obrigatórios" });
  }

  try {
    const [result] = await db.query(
      "INSERT INTO crm_contatos (lead_id, nome, email, telefone, cpf, empresa_id ) VALUES (?, ?, ?, ?, ?, ?)",
      [lead_id, nome, email, telefone, cpf || null, empresa_id]
    );
    res.status(201).json({ message: "Contato criado com sucesso", id: result.insertId });
  } catch (error) {
    console.error("Erro ao criar contato:", error);
    res.status(500).json({ error: "Erro ao criar contato" });
  }
});

// 4. Atualizar um contato existente
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { nome, email, telefone, cpf, empresa_id } = req.body;

  if (!nome || !email || !telefone) {
    return res.status(400).json({ error: "Nome, email e telefone são obrigatórios" });
  }

  try {
    const [result] = await db.query(
      "UPDATE crm_contatos SET nome = ?, email = ?, telefone = ?, cpf = ?, empresa_id = ? WHERE id = ?",
      [nome, email, telefone, cpf || null, empresa_id || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Contato não encontrado" });
    }

    res.json({ message: "Contato atualizado com sucesso" });
  } catch (error) {
    console.error("Erro ao atualizar contato:", error);
    res.status(500).json({ error: "Erro ao atualizar contato" });
  }
});



// 3. Deletar um contato
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query("DELETE FROM crm_contatos WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Contato não encontrado" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao deletar contato:", error);
    res.status(500).json({ error: "Erro ao deletar contato" });
  }
});


// Vincular contato existente a um lead
router.patch("/:id/vincular", async (req, res) => {
  const { id } = req.params;
  const { lead_id } = req.body;

  if (!lead_id) {
    return res.status(400).json({ error: "lead_id é obrigatório" });
  }

  try {
    const [result] = await db.query(
      "UPDATE crm_contatos SET lead_id = ? WHERE id = ?",
      [lead_id, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Contato não encontrado" });
    }

    res.json({ message: "Contato vinculado com sucesso" });
  } catch (error) {
    console.error("Erro ao vincular contato:", error);
    res.status(500).json({ error: "Erro ao vincular contato" });
  }
});


// Desvincular um contato de um lead
router.patch("/:id/desvincular", async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query(
      "UPDATE crm_contatos SET lead_id = NULL WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Contato não encontrado" });
    }

    res.json({ message: "Contato desvinculado com sucesso" });
  } catch (error) {
    console.error("Erro ao desvincular contato:", error);
    res.status(500).json({ error: "Erro ao desvincular contato" });
  }
});


module.exports = router;
