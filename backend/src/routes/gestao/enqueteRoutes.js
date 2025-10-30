const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const autenticarToken = require("../../middlewares/auth");

// 🔸 Middleware para extrair empresaId do token
router.use(autenticarToken, (req, res, next) => {
  req.empresaId = req.usuario.empresaId;
  next();
});

/** ------------------ GRUPOS ------------------ **/

// Criar grupo (sem nomes duplicados)
router.post("/grupos", async (req, res) => {
  const { grupo } = req.body;
  const empresaId = req.empresaId;

  try {
    // Verifica se já existe um grupo com o mesmo nome para a mesma empresa
    const [existentes] = await db.query(
      `SELECT id FROM enquete_grupos WHERE titulo = ? AND empresaId = ?`,
      [grupo, empresaId]
    );

    if (existentes.length > 0) {
      return res.status(409).json({ error: "Já existe um grupo com esse nome." });
    }

    // Continua a lógica normal de classificação
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM enquete_grupos WHERE empresaId = ?`,
      [empresaId]
    );
    const classificacao = (total + 1).toString().padStart(2, '0');

    const [r] = await db.query(
      `INSERT INTO enquete_grupos (empresaId, classificacao, titulo) VALUES (?, ?, ?)`,
      [empresaId, classificacao, grupo]
    );

    res.status(201).json({ success: true, grupoId: r.insertId, classificacao });
} catch (error) {
    console.error('Erro ao criar grupo:', error);
    res.status(500).json({ error: "Erro ao criar grupo" });
}
});

// Listar grupos da empresa
router.get("/grupos", async (req, res) => {
  try {
    const [grupos] = await db.query(
      `SELECT * FROM enquete_grupos WHERE empresaId = ?`,
      [req.empresaId]
    );
    res.json(grupos);
  } catch (err) {
    console.error("Erro ao listar grupos:", err);
    res.status(500).json({ error: "Erro ao listar grupos" });
  }
});

// Rota para obter um grupo específico pelo ID
router.get("/grupos/:grupoId", async (req, res) => {
  const { grupoId } = req.params; // Obtendo o grupoId da URL

  try {
    // Consulta no banco de dados para obter o grupo com o grupoId
    const [grupo] = await db.query(
      `SELECT * FROM enquete_grupos WHERE id = ? AND empresaId = ?`,
      [grupoId, req.empresaId] // Certifique-se de que o grupo pertence à empresa do usuário
    );

    if (grupo.length === 0) {
      return res.status(404).json({ error: "Grupo não encontrado" });
    }

    res.json(grupo[0]); // Retorna o primeiro grupo encontrado
  } catch (err) {
    console.error("Erro ao buscar grupo:", err);
    res.status(500).json({ error: "Erro ao buscar grupo" });
  }
});


// Atualizar grupo
router.put("/grupos/:id", async (req, res) => {
  const { id } = req.params;
  const { classificacao, grupo } = req.body;

  try {
    const [r] = await db.query(
      `UPDATE enquete_grupos SET classificacao = ?, titulo = ? WHERE id = ? AND empresaId = ?`,
      [classificacao, grupo, id, req.empresaId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao atualizar grupo:", err);
    res.status(500).json({ error: "Erro ao atualizar grupo" });
  }
});

// Deletar grupo + child perguntas
router.delete("/grupos/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Primeiro exclui todas as perguntas do grupo
    await db.query(
      `DELETE FROM enquete_perguntas WHERE grupoId = ?`,
      [id]
    );

    // Depois exclui o grupo
    await db.query(
      `DELETE FROM enquete_grupos WHERE id = ? AND empresaId = ?`,
      [id, req.empresaId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao deletar grupo e perguntas:", err);
    res.status(500).json({ error: "Erro ao deletar grupo e perguntas" });
  }
});


/** ------------------ PERGUNTAS ------------------ **/

// Criar pergunta
router.post("/perguntas", async (req, res) => {
  const { grupoId, pergunta, multiplaEscolha } = req.body;

  try {
    const tipo = multiplaEscolha ? 'múltipla' : 'única';
    const [r] = await db.query(
      `INSERT INTO enquete_perguntas (grupoId, texto, tipo) VALUES (?, ?, ?)`,
      [grupoId, pergunta, tipo]
    );
    res.status(201).json({ success: true, perguntaId: r.insertId });
  } catch (err) {
    console.error("Erro ao criar pergunta:", err);
    res.status(500).json({ error: "Erro ao criar pergunta" });
  }
});

// Listar perguntas de um grupo
router.get("/grupos/:grupoId/perguntas", async (req, res) => {
  const { grupoId } = req.params;

  try {
    const [perguntas] = await db.query(
      `SELECT * FROM enquete_perguntas WHERE grupoId = ?`,
      [grupoId]
    );
    res.json(perguntas);
  } catch (err) {
    console.error("Erro ao listar perguntas:", err);
    res.status(500).json({ error: "Erro ao listar perguntas" });
  }
});

// Obter uma pergunta específica
router.get("/perguntas/:perguntaId", async (req, res) => {
  const { perguntaId } = req.params;

  try {
    const [pergunta] = await db.query(
      `SELECT ep.id, ep.texto, ep.tipo, eg.classificacao AS classificacaoGrupo 
       FROM enquete_perguntas ep 
       JOIN enquete_grupos eg ON ep.grupoId = eg.id 
       WHERE ep.id = ?`,
      [perguntaId]
    );

    if (pergunta.length === 0) {
      return res.status(404).json({ error: "Pergunta não encontrada" });
    }

    res.json(pergunta[0]); // Retorna a pergunta encontrada
  } catch (err) {
    console.error("Erro ao buscar pergunta:", err);
    res.status(500).json({ error: "Erro ao buscar pergunta" });
  }
});

// Atualizar pergunta
router.put("/perguntas/:id", async (req, res) => {
  const { id } = req.params;
  const { pergunta, multiplaEscolha } = req.body;
  const tipo = multiplaEscolha ? 'múltipla' : 'única';

  try {
    const [r] = await db.query(
      `UPDATE enquete_perguntas SET texto = ?, tipo = ? WHERE id = ?`,
      [pergunta, tipo, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao atualizar pergunta:", err);
    res.status(500).json({ error: "Erro ao atualizar pergunta" });
  }
});

// Deletar pergunta
router.delete("/perguntas/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(
      `DELETE FROM enquete_perguntas WHERE id = ?`,
      [id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao deletar pergunta:", err);
    res.status(500).json({ error: "Erro ao deletar pergunta" });
  }
});

/** ------------------ RESPOSTAS ------------------ **/

// Criar resposta
router.post("/respostas", async (req, res) => {
  const { perguntaId, particularidadeId } = req.body;

  try {
    const [r] = await db.query(
      `INSERT INTO enquete_respostas (perguntaId, particularidadeId) VALUES (?, ?)`,
      [perguntaId, particularidadeId]
    );
    res.status(201).json({ success: true, respostaId: r.insertId });
  } catch (err) {
    console.error("Erro ao criar resposta:", err);
    res.status(500).json({ error: "Erro ao criar resposta" });
  }
});

// Listar respostas por pergunta
router.get("/respostas/:perguntaId", async (req, res) => {
  const { perguntaId } = req.params;

  try {
    const [respostas] = await db.query(
      `SELECT r.*, p.nome AS particularidade FROM enquete_respostas r
       JOIN particularidades p ON r.particularidadeId = p.id
       WHERE r.perguntaId = ?`,
      [perguntaId]
    );
    res.json(respostas);
  } catch (err) {
    console.error("Erro ao listar respostas:", err);
    res.status(500).json({ error: "Erro ao listar respostas" });
  }
});

// Deletar resposta
router.delete("/respostas/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(
      `DELETE FROM enquete_respostas WHERE id = ?`,
      [id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao deletar resposta:", err);
    res.status(500).json({ error: "Erro ao deletar resposta" });
  }
});

/** ------------------ PARTICULARIDADES ------------------ **/

// Criar particularidade
router.post("/particularidades", async (req, res) => {
  const { nome, descricao, categoriaId } = req.body;
  const empresaId = req.empresaId;

  try {
    let categoriaNome = null;

    if (categoriaId) {
      // Busca o nome da categoria correspondente
      const [result] = await db.query(
        `SELECT nome FROM particularidades_categorias WHERE id = ? AND empresaId = ?`,
        [categoriaId, empresaId]
      );

      if (result.length > 0) {
        categoriaNome = result[0].nome;
      }
    }

    // Faz o insert com o nome da categoria já preenchido
    const [r] = await db.query(
      `INSERT INTO particularidades (empresaId, nome, descricao, categoriaId, categoria) VALUES (?, ?, ?, ?, ?)`,
      [empresaId, nome, descricao, categoriaId, categoriaNome]
    );

    res.status(201).json({ success: true, id: r.insertId });
  } catch (err) {
    console.error("Erro ao criar particularidade:", err);
    res.status(500).json({ error: "Erro ao criar particularidade" });
  }
});

// Listar todas as particularidades da empresa
router.get("/particularidades", async (req, res) => {
  try {
    const [dados] = await db.query(
      `SELECT * FROM particularidades WHERE empresaId = ?`,
      [req.empresaId]
    );
    res.json(dados);
  } catch (err) {
    console.error("Erro ao buscar particularidades:", err);
    res.status(500).json({ error: "Erro ao buscar particularidades" });
  }
});

// Atualizar particularidade
router.put("/particularidades/:id", async (req, res) => {
  const { id } = req.params;
  const { nome, descricao, categoria } = req.body;

  try {
    const [r] = await db.query(
      `UPDATE particularidades SET nome = ?, descricao = ?, categoria = ? WHERE id = ? AND empresaId = ?`,
      [nome, descricao, categoria, id, req.empresaId]
    );
    res.json({ success: true, affectedRows: r.affectedRows });
  } catch (err) {
    console.error("Erro ao atualizar:", err);
    res.status(500).json({ error: "Erro ao atualizar" });
  }
});

// Deletar particularidade
router.delete("/particularidades/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [r] = await db.query(
      `DELETE FROM particularidades WHERE id = ? AND empresaId = ?`,
      [id, req.empresaId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao deletar:", err);
    res.status(500).json({ error: "Erro ao deletar" });
  }
});

/** ------------------ PARTICULARIDADES CATEGORIAS ------------------ **/

// Criar categoria
router.post("/categorias", async (req, res) => {
  const { nome } = req.body;
  const empresaId = req.empresaId;

  try {
    const [r] = await db.query(
      `INSERT INTO particularidades_categorias (empresaId, nome) VALUES (?, ?)`,
      [empresaId, nome]
    );
    res.status(201).json({ success: true, id: r.insertId });
  } catch (err) {
    console.error("Erro ao criar categoria:", err);
    res.status(500).json({ error: "Erro ao criar categoria" });
  }
});

// Listar categorias
router.get("/categorias", async (req, res) => {
  try {
    const [dados] = await db.query(
      `SELECT * FROM particularidades_categorias WHERE empresaId = ?`,
      [req.empresaId]
    );
    res.json(dados);
  } catch (err) {
    console.error("Erro ao listar categorias:", err);
    res.status(500).json({ error: "Erro ao listar categorias" });
  }
});

// Atualizar categoria
router.put("/categorias/:id", async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body;

  try {
    const [r] = await db.query(
      `UPDATE particularidades_categorias SET nome = ? WHERE id = ? AND empresaId = ?`,
      [nome, id, req.empresaId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao atualizar categoria:", err);
    res.status(500).json({ error: "Erro ao atualizar categoria" });
  }
});

// Deletar categoria
router.delete("/categorias/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(
      `DELETE FROM particularidades_categorias WHERE id = ? AND empresaId = ?`,
      [id, req.empresaId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao deletar categoria:", err);
    res.status(500).json({ error: "Erro ao deletar categoria" });
  }
});

// Adicione este endpoint no seu arquivo existente

router.get("/arvore", async (req, res) => {
  try {
    const empresaId = req.empresaId;
    console.log(`🔄 Iniciando busca da árvore para empresa ${empresaId}`);
    const startTime = Date.now();

    // Consulta otimizada com JOINs para buscar tudo de uma vez
    const [dados] = await db.query(`
      SELECT 
        eg.id AS grupoId,
        eg.classificacao AS grupoClassificacao,
        eg.titulo AS grupoTitulo,
        ep.id AS perguntaId,
        ep.texto AS perguntaTexto,
        ep.tipo AS perguntaTipo,
        er.id AS respostaId,
        p.nome AS particularidade
      FROM enquete_grupos eg
      LEFT JOIN enquete_perguntas ep ON eg.id = ep.grupoId
      LEFT JOIN enquete_respostas er ON ep.id = er.perguntaId
      LEFT JOIN particularidades p ON er.particularidadeId = p.id
      WHERE eg.empresaId = ?
      ORDER BY eg.classificacao ASC, ep.id ASC, er.id ASC
    `, [empresaId]);

    // Agrupa os dados em uma estrutura hierárquica
    const arvore = [];
    const gruposMap = new Map();

    dados.forEach(row => {
      const grupoId = row.grupoId;
      
      // Cria o grupo se não existir
      if (!gruposMap.has(grupoId)) {
        const grupo = {
          tipo: "G",
          id: grupoId,
          classificacao: row.grupoClassificacao,
          titulo: row.grupoTitulo,
          filhos: []
        };
        gruposMap.set(grupoId, grupo);
        arvore.push(grupo);
      }

      const grupo = gruposMap.get(grupoId);
      
      // Adiciona pergunta se existir
      if (row.perguntaId) {
        const perguntaExistente = grupo.filhos.find(p => p.id === row.perguntaId);
        
        if (!perguntaExistente) {
          const perguntaIndex = grupo.filhos.length + 1;
          const classificacaoPergunta = `${row.grupoClassificacao}.${perguntaIndex.toString().padStart(2, '0')}`;
          
          const pergunta = {
            tipo: "P",
            tipoResposta: row.perguntaTipo,
            id: row.perguntaId,
            classificacao: classificacaoPergunta,
            texto: row.perguntaTexto,
            filhos: []
          };
          grupo.filhos.push(pergunta);
        }
        
        // Adiciona resposta se existir
        if (row.respostaId) {
          const pergunta = grupo.filhos.find(p => p.id === row.perguntaId);
          const respostaIndex = pergunta.filhos.length + 1;
          const classificacaoResposta = `${pergunta.classificacao}.${respostaIndex.toString().padStart(2, '0')}`;
          
          const resposta = {
            tipo: "R",
            id: row.respostaId,
            classificacao: classificacaoResposta,
            particularidade: row.particularidade
          };
          pergunta.filhos.push(resposta);
        }
      }
    });

    const endTime = Date.now();
    console.log(`✅ Árvore montada em ${endTime - startTime}ms`);
    console.log(`📊 Grupos retornados: ${arvore.length}`);
    
    res.json(arvore);
  } catch (err) {
    console.error("❌ Erro ao montar árvore:", err);
    res.status(500).json({ error: "Erro ao montar árvore" });
  }
});

/** ------------------ CLIENTES_RESPOSTAS  ------------------ **/

// Listar respostas de um cliente
router.get("/respostas-cliente/:clienteId", async (req, res) => {
  const { clienteId } = req.params;
  const [respostas] = await db.query(`
    SELECT respostaId FROM cliente_respostas WHERE clienteId = ?`, [clienteId]);
  res.json(respostas.map(r => r.respostaId));
});

// Salvar respostas (substitui todas)
router.post("/respostas-cliente/:clienteId", async (req, res) => {
  const { clienteId } = req.params;
  const { respostaIds } = req.body;

  console.log("=== DEBUG BACKEND ===");
  console.log("clienteId:", clienteId);
  console.log("respostaIds recebidos:", respostaIds);
  console.log("Tipo de respostaIds:", typeof respostaIds);
  console.log("É array?", Array.isArray(respostaIds));

  try {
    if (!Array.isArray(respostaIds)) {
      console.log("ERRO: respostaIds não é um array");
      return res.status(400).json({ error: "respostaIds inválidos" });
    }

    // Se estiver vazio, só apaga e sai
    if (respostaIds.length === 0) {
      console.log("Array vazio - removendo todas as respostas do cliente");
      await db.query(`DELETE FROM cliente_respostas WHERE clienteId = ?`, [clienteId]);
      console.log("Respostas removidas com sucesso");
      return res.json({ success: true });
    }

    // Buscar dados das perguntas associadas às respostas
    const [dados] = await db.query(`
      SELECT r.id AS respostaId, p.id AS perguntaId, p.tipo
      FROM enquete_respostas r
      JOIN enquete_perguntas p ON r.perguntaId = p.id
      WHERE r.id IN (?)
    `, [respostaIds]);

    // Agrupar por pergunta
    const mapa = {};
    for (const { respostaId, perguntaId, tipo } of dados) {
      if (!mapa[perguntaId]) {
        mapa[perguntaId] = { tipo, respostas: [] };
      }
      mapa[perguntaId].respostas.push(respostaId);
    }

    // Validação: pergunta tipo UNICA não pode ter mais de uma resposta
    for (const perguntaId in mapa) {
      const { tipo, respostas } = mapa[perguntaId];
      if (tipo.toLowerCase() === "única" && respostas.length > 1) {
        return res.status(400).json({
          error: `A pergunta ${perguntaId} permite apenas uma resposta.`,
        });
      }
    }

    // Substitui respostas anteriores
    console.log("Removendo respostas anteriores do cliente");
    await db.query(`DELETE FROM cliente_respostas WHERE clienteId = ?`, [clienteId]);
    
    const values = respostaIds.map((id) => [clienteId, id]);
    console.log("Inserindo novas respostas:", values);
    await db.query(`INSERT INTO cliente_respostas (clienteId, respostaId) VALUES ?`, [values]);
    
    console.log("Respostas salvas com sucesso");
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao salvar respostas:", err);
    res.status(500).json({ error: "Erro ao salvar respostas" });
  }
});


module.exports = router;
