const express = require("express");
const router = express.Router();
const db = require("../config/database");
const verifyToken = require("../middlewares/auth");

// Criação de um novo cliente
router.post("/", verifyToken, async (req, res) => {
  try {
    const {
      type, name, cpf_cnpj, email, telefone, endereco, equipe_id, lead_id,
      rg, estado_civil, profissao, sexo, nacionalidade,
      cep, numero, complemento, bairro, cidade, estado,
      representante, funcao
    } = req.body;

    if (!type || !name || !cpf_cnpj || !email || !equipe_id) {
      return res.status(400).json({ error: "Preencha todos os campos obrigatórios (incluindo equipe_id)." });
    }

    const [existingClient] = await db.query("SELECT id FROM clients WHERE cpf_cnpj = ?", [cpf_cnpj]);
    if (existingClient.length > 0) {
      return res.status(400).json({ error: "Cliente já cadastrado com este CPF/CNPJ." });
    }

    const [result] = await db.query(
      `INSERT INTO clients 
       (
         type, name, cpf_cnpj, email, telefone, endereco, equipe_id, lead_id,
         rg, estado_civil, profissao, sexo, nacionalidade,
         cep, numero, complemento, bairro, cidade, estado,
         representante, funcao
       ) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        type, name, cpf_cnpj, email, telefone, endereco, equipe_id, lead_id || null,
        rg || null, estado_civil || null, profissao || null, sexo || null, nacionalidade || null,
        cep || null, numero || null, complemento || null, bairro || null, cidade || null, estado || null,
        representante || null, funcao || null
      ]
    );

    return res.status(201).json({ message: "Cliente criado com sucesso!", clientId: result.insertId });
  } catch (error) {
    console.error("Erro ao criar cliente:", error);
    return res.status(500).json({ error: "Erro ao criar cliente." });
  }
});


// Atualizar um cliente existente
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const {
      type, name, cpf_cnpj, email, telefone, endereco, equipe_id, lead_id,
      rg, estado_civil, profissao, sexo, nacionalidade,
      cep, numero, complemento, bairro, cidade, estado,
      representante, funcao
    } = req.body;

    // Verifica se o cliente existe
    const [clienteExistente] = await db.query("SELECT * FROM clients WHERE id = ?", [id]);
    if (clienteExistente.length === 0) {
      return res.status(404).json({ error: "Cliente não encontrado." });
    }

    await db.query(
      `UPDATE clients SET
        type = ?, name = ?, cpf_cnpj = ?, email = ?, telefone = ?, endereco = ?, 
        equipe_id = ?, lead_id = ?, rg = ?, estado_civil = ?, profissao = ?, sexo = ?, 
        nacionalidade = ?, cep = ?, numero = ?, complemento = ?, bairro = ?, cidade = ?, 
        estado = ?, representante = ?, funcao = ?
       WHERE id = ?`,
      [
        type, name, cpf_cnpj, email, telefone, endereco,
        equipe_id, lead_id || null, rg, estado_civil, profissao, sexo,
        nacionalidade, cep, numero, complemento, bairro, cidade,
        estado, representante, funcao, id
      ]
    );

    return res.status(200).json({ message: "Cliente atualizado com sucesso!" });
  } catch (error) {
    console.error("Erro ao atualizar cliente:", error);
    return res.status(500).json({ error: "Erro ao atualizar cliente." });
  }
});


// Listar todos os clientes
router.get("/",verifyToken, async (req, res) => {
  try {
    const [clients] = await db.query("SELECT * FROM clients ORDER BY created_at DESC");
    return res.status(200).json(clients);
  } catch (error) {
    return res.status(500).json({ error: "Erro ao listar clientes." });
  }
});

// Buscar um cliente específico por ID
router.get("/:id",verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [client] = await db.query("SELECT * FROM clients WHERE id = ?", [id]);

    if (client.length === 0) {
      return res.status(404).json({ error: "Cliente não encontrado." });
    }

    return res.status(200).json(client[0]);
  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar cliente." });
  }
});

// GET /clients/:equipeId
router.get("/equipe/:equipeId", verifyToken, async (req, res) => {
  try {
    const { equipeId } = req.params;


    const [clientes] = await db.query(
      "SELECT * FROM clients WHERE equipe_id = ?",
      [equipeId]
    );

    res.json(clientes);
  } catch (error) {
    console.error("Erro ao buscar clientes:", error);
    res.status(500).json({ error: "Erro interno ao buscar clientes." });
  }
});



// GET /clients/:clientId/contracts
router.get('/:clientId/contracts', verifyToken, async (req, res) => {
  const clientId = req.params.clientId;

  try {
    // Buscar o lead_id do cliente
    const [clients] = await db.query(`SELECT lead_id FROM clients WHERE id = ?`, [clientId]);
    if (clients.length === 0) {
      return res.status(404).json({ error: "Cliente não encontrado." });
    }

    const leadId = clients[0].lead_id;

    if (!leadId) {
      // Cliente não veio de lead, retorna vazio
      return res.json([]);
    }

    // Buscar contratos vinculados a clientes que vieram do mesmo lead
    const [contracts] = await db.query(
      `SELECT c.* FROM contracts c
       JOIN clients cl ON c.client_id = cl.id
       WHERE cl.lead_id = ?`,
      [leadId]
    );

    res.json(contracts);
  } catch (error) {
    console.error("Erro ao buscar contratos do cliente com lead_id:", error);
    res.status(500).json({ error: "Erro ao buscar contratos." });
  }
});

// Rota para excluir um cliente
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    // Verifica se o cliente existe
    const [cliente] = await db.query('SELECT * FROM clients WHERE id = ?', [id]);
    if (cliente.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }
    // Verifica se há contratos vinculados
    const [contratos] = await db.query('SELECT id FROM contracts WHERE client_id = ?', [id]);
    if (contratos.length > 0) {
      return res.status(409).json({ error: 'Não é possível excluir: este cliente possui contratos vinculados.' });
    }
    // Exclui o cliente
    await db.query('DELETE FROM clients WHERE id = ?', [id]);
    return res.json({ message: 'Cliente excluído com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir cliente:', error);
    return res.status(500).json({ error: 'Erro ao excluir cliente.' });
  }
});


module.exports = router;
