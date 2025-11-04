const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const autenticarToken = require("../../middlewares/auth");
const { verificarPermissao } = require("../../middlewares/permissao");

// Usar multer na memória (sem salvar no disco)
const upload = multer({ storage: multer.memoryStorage() });

// Função para converter nome do mês para número
function converterMesParaNumero(mes) {
  // Se já é um número (01-12), retornar como está
  if (/^\d{1,2}$/.test(mes)) {
    const numero = parseInt(mes);
    if (numero >= 1 && numero <= 12) {
      return mes.padStart(2, '0'); // Garantir formato 2 dígitos
    }
  }
  
  const meses = {
    'janeiro': '01', 'jan': '01', 'january': '01',
    'fevereiro': '02', 'fev': '02', 'february': '02',
    'março': '03', 'mar': '03', 'march': '03',
    'abril': '04', 'abr': '04', 'april': '04',
    'maio': '05', 'mai': '05', 'may': '05',
    'junho': '06', 'jun': '06', 'june': '06',
    'julho': '07', 'jul': '07', 'july': '07',
    'agosto': '08', 'ago': '08', 'august': '08',
    'setembro': '09', 'set': '09', 'september': '09',
    'outubro': '10', 'out': '10', 'october': '10',
    'novembro': '11', 'nov': '11', 'november': '11',
    'dezembro': '12', 'dez': '12', 'december': '12'
  };
  
  // Converter para minúsculas e remover acentos
  const mesNormalizado = mes.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  const resultado = meses[mesNormalizado];
  if (resultado) {
    return resultado;
  }
  
  // Se não encontrou, retornar o original (pode ser um número inválido)
  console.log(`⚠️ Mês não reconhecido: "${mes}"`);
  return mes;
}

function extrairValorPorRegex(texto, regex) {
  try {
    if (!regex) return null;
    
    const re = new RegExp(regex, "i");
    const match = texto.match(re);
    
    if (match) {
      // Retorna o primeiro grupo capturado se existir, senão o match completo
      return match[1] || match[0];
    }
    
    return null;
  } catch (error) {
    console.log(`❌ Erro ao aplicar regex "${regex}":`, error.message);
    return null;
  }
}

// Função utilitária para gerar data/hora do servidor (com ajuste para Brasília UTC-3)
function getDataHoraServidor() {
  const agora = new Date();
  agora.setHours(agora.getHours() - 3); // Ajusta para horário de Brasília (UTC-3)
  const pad = n => String(n).padStart(2, "0");
  return {
    dataHora: agora.getFullYear() + "-" +
      pad(agora.getMonth() + 1) + "-" +
      pad(agora.getDate()) + " " +
      pad(agora.getHours()) + ":" +
      pad(agora.getMinutes()) + ":" +
      pad(agora.getSeconds()),
    data: agora.getFullYear() + "-" +
      pad(agora.getMonth() + 1) + "-" +
      pad(agora.getDate()),
    hora: pad(agora.getHours()) + ":" +
      pad(agora.getMinutes()) + ":" +
      pad(agora.getSeconds())
  };
}

// Função global para quebrar texto de forma inteligente (usada em todas as rotas)
function quebrarTextoInteligente(texto) {
  console.log("🔧 INICIANDO QUEBRA DE TEXTO INTELIGENTE");
  console.log("📄 TEXTO ORIGINAL:", texto.substring(0, 200) + "...");
  
  // Primeiro, tenta quebrar por quebras de linha
  let linhas = texto
    .split(/\n/)
    .map(linha => linha.trim())
    .filter(linha => linha.length > 0);
  
  if (linhas.length > 1) {
    console.log("✅ Quebra por quebras de linha funcionou");
    // Aplicar quebra adicional DENTRO de cada linha
    let linhasProcessadas = [];
    linhas.forEach((linha, index) => {
      console.log(`🔧 Processando linha ${index + 1}: "${linha}"`);
      
      // QUEBRA SUPER AGRESSIVA DENTRO DA LINHA
      let linhaProcessada = linha;
      
      // Separar CNPJ seguido de outro número
      linhaProcessada = linhaProcessada.replace(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})(\d+)/g, (match, p1, p2) => {
        console.log(`🔧 Separando CNPJ + número na linha ${index + 1}: "${p1}" + "${p2}"`);
        return `${p1}\n${p2}`;
      });
      
      // Separar CPF seguido de outro número
      linhaProcessada = linhaProcessada.replace(/(\d{3}\.\d{3}\.\d{3}-\d{2})(\d+)/g, (match, p1, p2) => {
        console.log(`🔧 Separando CPF + número na linha ${index + 1}: "${p1}" + "${p2}"`);
        return `${p1}\n${p2}`;
      });
      
      // Separar número seguido de CNPJ
      linhaProcessada = linhaProcessada.replace(/(\d+)(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/g, (match, p1, p2) => {
        console.log(`🔧 Separando número + CNPJ na linha ${index + 1}: "${p1}" + "${p2}"`);
        return `${p1}\n${p2}`;
      });
      
      // Separar número seguido de CPF
      linhaProcessada = linhaProcessada.replace(/(\d+)(\d{3}\.\d{3}\.\d{3}-\d{2})/g, (match, p1, p2) => {
        console.log(`🔧 Separando número + CPF na linha ${index + 1}: "${p1}" + "${p2}"`);
        return `${p1}\n${p2}`;
      });
      
      // Separar números grandes que estão colados (ex: 090006172328.185.760/0001-30)
      linhaProcessada = linhaProcessada.replace(/(\d{12,})(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/g, (match, p1, p2) => {
        console.log(`🔧 Separando número grande + CNPJ na linha ${index + 1}: "${p1}" + "${p2}"`);
        return `${p1}\n${p2}`;
      });
      
      // Separar números grandes que estão colados (ex: 089.071.187-9517.422.651/0001-72)
      linhaProcessada = linhaProcessada.replace(/(\d{3}\.\d{3}\.\d{3}-\d{2})(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/g, (match, p1, p2) => {
        console.log(`🔧 Separando CPF + CNPJ na linha ${index + 1}: "${p1}" + "${p2}"`);
        return `${p1}\n${p2}`;
      });
      
      // Separar números que estão colados com letras (ex: RICARDO ANDRE ENGELMANN011.178.841-20)
      linhaProcessada = linhaProcessada.replace(/([A-Z\s]+)(\d{3}\.\d{3}\.\d{3}-\d{2})/g, (match, p1, p2) => {
        console.log(`🔧 Separando texto + CPF na linha ${index + 1}: "${p1.trim()}" + "${p2}"`);
        return `${p1.trim()}\n${p2}`;
      });
      
      // Separar números que estão colados com letras (ex: 089.071.187-9517.422.651/0001-72RJ)
      linhaProcessada = linhaProcessada.replace(/(\d{3}\.\d{3}\.\d{3}-\d{2})(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})([A-Z]{2})/g, (match, p1, p2, p3) => {
        console.log(`🔧 Separando CPF + CNPJ + UF na linha ${index + 1}: "${p1}" + "${p2}" + "${p3}"`);
        return `${p1}\n${p2}\n${p3}`;
      });
      
      // Separar números que estão colados (ex: (21)2699-9455(21)2699-945521.210-623)
      linhaProcessada = linhaProcessada.replace(/(\(\d{2}\)\d{4}-\d{4})(\(\d{2}\)\d{4}-\d{4})(\d+)/g, (match, p1, p2, p3) => {
        console.log(`🔧 Separando telefones + número na linha ${index + 1}: "${p1}" + "${p2}" + "${p3}"`);
        return `${p1}\n${p2}\n${p3}`;
      });
      
      // Separar números que estão colados (ex: 2025mai/2025Original)
      linhaProcessada = linhaProcessada.replace(/(\d{4})([a-z]{3})\/(\d{4})([A-Z]+)/g, (match, p1, p2, p3, p4) => {
        console.log(`🔧 Separando data + texto na linha ${index + 1}: "${p1}" + "${p2}" + "${p3}" + "${p4}"`);
        return `${p1}${p2}/${p3}\n${p4}`;
      });
      
      // Separar números que estão colados (ex: R 25 DE JULHO1985)
      linhaProcessada = linhaProcessada.replace(/([A-Z\s]+)(\d{4})/g, (match, p1, p2) => {
        console.log(`🔧 Separando texto + ano na linha ${index + 1}: "${p1.trim()}" + "${p2}"`);
        return `${p1.trim()}\n${p2}`;
      });
      
      // Separar números que estão colados (ex: VICENTE DE CARVALHO909)
      linhaProcessada = linhaProcessada.replace(/([A-Z\s]+)(\d+)/g, (match, p1, p2) => {
        console.log(`🔧 Separando texto + número na linha ${index + 1}: "${p1.trim()}" + "${p2}"`);
        return `${p1.trim()}\n${p2}`;
      });
      
      // Separar números que estão colados (ex: VILA DA PENHABLOCO 01 SALA 725)
      linhaProcessada = linhaProcessada.replace(/([A-Z\s]+)(\d+)([A-Z\s]+)(\d+)/g, (match, p1, p2, p3, p4) => {
        console.log(`🔧 Separando texto + número + texto + número na linha ${index + 1}: "${p1.trim()}" + "${p2}" + "${p3.trim()}" + "${p4}"`);
        return `${p1.trim()}\n${p2}\n${p3.trim()}\n${p4}`;
      });
      
      // Quebrar a linha processada em sublinhas
      const sublinhas = linhaProcessada.split('\n').map(sublinha => sublinha.trim()).filter(sublinha => sublinha.length > 0);
      linhasProcessadas.push(...sublinhas);
    });
    
    console.log(`🔧 RESULTADO: ${linhasProcessadas.length} linhas criadas após processamento`);
    return linhasProcessadas;
  }
  
  // Se não conseguiu, tenta quebrar por padrões específicos
  const padroesQuebra = [
    // CNPJ - quebra antes e depois
    /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g,
    // CNPJ sem formatação - quebra antes e depois
    /\d{14}/g,
    // CPF - quebra antes e depois
    /\d{3}\.\d{3}\.\d{3}-\d{2}/g,
    // CPF sem formatação - quebra antes e depois
    /\d{11}/g,
    // Datas MM/YYYY
    /\d{2}\/\d{4}/g,
    // Datas DD/MM/YYYY
    /\d{2}\/\d{2}\/\d{4}/g,
    // Competência (mês/ano)
    /(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\/\d{4}/gi,
    // Competência (mês abreviado/ano)
    /(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/\d{4}/gi,
    // Valores monetários
    /\d+,\d{2}/g,
    // Siglas em maiúsculo
    /[A-Z]{2,}/g,
    // Números grandes (possíveis códigos)
    /\d{10,}/g,
    // CEP
    /\d{5}-\d{3}/g,
    // Palavras com números misturados
    /\w+\d+/g,
    /\d+\w+/g,
    // Números consecutivos (que podem ser códigos)
    /\d{6,}/g,
  ];
  
  let textoProcessado = texto;
  
  console.log("🔧 APLICANDO PADRÕES DE QUEBRA...");
  
  // Adiciona quebras antes e depois de padrões específicos
  padroesQuebra.forEach((padrao, index) => {
    const matches = textoProcessado.match(padrao);
    if (matches) {
      console.log(`✅ Padrão ${index + 1} encontrou ${matches.length} matches`);
      textoProcessado = textoProcessado.replace(padrao, (match) => `\n${match}\n`);
    }
  });
  
  // Quebra por espaços múltiplos
  textoProcessado = textoProcessado.replace(/\s{2,}/g, '\n');
  
  // Quebra por caracteres especiais que podem separar informações
  textoProcessado = textoProcessado.replace(/[()\[\]{}]/g, (match) => `\n${match}\n`);
  
  // Quebra por pontos e vírgulas
  textoProcessado = textoProcessado.replace(/[.;]/g, (match) => `${match}\n`);
  
  // QUEBRA SUPER AGRESSIVA: Separar números que estão juntos
  console.log("🔧 QUEBRA SUPER AGRESSIVA - NÚMEROS GRANDES");
  textoProcessado = textoProcessado.replace(/(\d{6,})(\d{6,})/g, (match, p1, p2) => {
    console.log(`🔧 Separando números grandes: "${p1}" + "${p2}"`);
    return `${p1}\n${p2}`;
  });
  
  // QUEBRA SUPER AGRESSIVA: Separar CNPJs que estão juntos
  textoProcessado = textoProcessado.replace(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/g, (match, p1, p2) => {
    console.log(`🔧 Separando CNPJs: "${p1}" + "${p2}"`);
    return `${p1}\n${p2}`;
  });
  
  // QUEBRA SUPER AGRESSIVA: Separar CPFs que estão juntos
  textoProcessado = textoProcessado.replace(/(\d{3}\.\d{3}\.\d{3}-\d{2})(\d{3}\.\d{3}\.\d{3}-\d{2})/g, (match, p1, p2) => {
    console.log(`🔧 Separando CPFs: "${p1}" + "${p2}"`);
    return `${p1}\n${p2}`;
  });
  
  // QUEBRA SUPER AGRESSIVA: Separar números de 14 dígitos (possíveis CNPJs)
  textoProcessado = textoProcessado.replace(/(\d{14})(\d{14})/g, (match, p1, p2) => {
    console.log(`🔧 Separando números de 14 dígitos: "${p1}" + "${p2}"`);
    return `${p1}\n${p2}`;
  });
  
  // QUEBRA SUPER AGRESSIVA: Separar qualquer número grande seguido de outro número
  textoProcessado = textoProcessado.replace(/(\d{10,})(\d{6,})/g, (match, p1, p2) => {
    console.log(`🔧 Separando números grandes: "${p1}" + "${p2}"`);
    return `${p1}\n${p2}`;
  });
  
  // QUEBRA SUPER AGRESSIVA: Separar números que estão colados sem espaço
  console.log("🔧 QUEBRA SUPER AGRESSIVA - NÚMEROS COLADOS");
  
  // Separar CNPJ seguido de outro número
  textoProcessado = textoProcessado.replace(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})(\d+)/g, (match, p1, p2) => {
    console.log(`🔧 Separando CNPJ + número: "${p1}" + "${p2}"`);
    return `${p1}\n${p2}`;
  });
  
  // Separar CPF seguido de outro número
  textoProcessado = textoProcessado.replace(/(\d{3}\.\d{3}\.\d{3}-\d{2})(\d+)/g, (match, p1, p2) => {
    console.log(`🔧 Separando CPF + número: "${p1}" + "${p2}"`);
    return `${p1}\n${p2}`;
  });
  
  // Separar número seguido de CNPJ
  textoProcessado = textoProcessado.replace(/(\d+)(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/g, (match, p1, p2) => {
    console.log(`🔧 Separando número + CNPJ: "${p1}" + "${p2}"`);
    return `${p1}\n${p2}`;
  });
  
  // Separar número seguido de CPF
  textoProcessado = textoProcessado.replace(/(\d+)(\d{3}\.\d{3}\.\d{3}-\d{2})/g, (match, p1, p2) => {
    console.log(`🔧 Separando número + CPF: "${p1}" + "${p2}"`);
    return `${p1}\n${p2}`;
  });
  
  // Separar números grandes que estão colados (ex: 090006172328.185.760/0001-30)
  textoProcessado = textoProcessado.replace(/(\d{12,})(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/g, (match, p1, p2) => {
    console.log(`🔧 Separando número grande + CNPJ: "${p1}" + "${p2}"`);
    return `${p1}\n${p2}`;
  });
  
  // Separar números grandes que estão colados (ex: 089.071.187-9517.422.651/0001-72)
  textoProcessado = textoProcessado.replace(/(\d{3}\.\d{3}\.\d{3}-\d{2})(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/g, (match, p1, p2) => {
    console.log(`🔧 Separando CPF + CNPJ: "${p1}" + "${p2}"`);
    return `${p1}\n${p2}`;
  });
  
  // Separar números que estão colados com letras (ex: RICARDO ANDRE ENGELMANN011.178.841-20)
  textoProcessado = textoProcessado.replace(/([A-Z\s]+)(\d{3}\.\d{3}\.\d{3}-\d{2})/g, (match, p1, p2) => {
    console.log(`🔧 Separando texto + CPF: "${p1.trim()}" + "${p2}"`);
    return `${p1.trim()}\n${p2}`;
  });
  
  // Separar números que estão colados com letras (ex: 089.071.187-9517.422.651/0001-72RJ)
  textoProcessado = textoProcessado.replace(/(\d{3}\.\d{3}\.\d{3}-\d{2})(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})([A-Z]{2})/g, (match, p1, p2, p3) => {
    console.log(`🔧 Separando CPF + CNPJ + UF: "${p1}" + "${p2}" + "${p3}"`);
    return `${p1}\n${p2}\n${p3}`;
  });
  
  // Quebra por espaços simples, mas preserva palavras que devem ficar juntas
  textoProcessado = textoProcessado.replace(/(\w+)\s+(\w+)/g, (match, p1, p2) => {
    // Se são duas palavras que devem ficar juntas (ex: "Janeiro de 2019")
    if (p1.toLowerCase() === 'janeiro' && p2.toLowerCase() === 'de') return match;
    if (p1.toLowerCase() === 'fevereiro' && p2.toLowerCase() === 'de') return match;
    if (p1.toLowerCase() === 'março' && p2.toLowerCase() === 'de') return match;
    if (p1.toLowerCase() === 'abril' && p2.toLowerCase() === 'de') return match;
    if (p1.toLowerCase() === 'maio' && p2.toLowerCase() === 'de') return match;
    if (p1.toLowerCase() === 'junho' && p2.toLowerCase() === 'de') return match;
    if (p1.toLowerCase() === 'julho' && p2.toLowerCase() === 'de') return match;
    if (p1.toLowerCase() === 'agosto' && p2.toLowerCase() === 'de') return match;
    if (p1.toLowerCase() === 'setembro' && p2.toLowerCase() === 'de') return match;
    if (p1.toLowerCase() === 'outubro' && p2.toLowerCase() === 'de') return match;
    if (p1.toLowerCase() === 'novembro' && p2.toLowerCase() === 'de') return match;
    if (p1.toLowerCase() === 'dezembro' && p2.toLowerCase() === 'de') return match;
    
    // Se são siglas ou códigos
    if (/^[A-Z]{2,}$/.test(p1) || /^[A-Z]{2,}$/.test(p2)) return match;
    
    // Se são números
    if (/^\d+$/.test(p1) || /^\d+$/.test(p2)) return match;
    
    // Se uma é número e outra é texto, quebra
    if (/^\d+$/.test(p1) && /^[a-zA-Z]+$/.test(p2)) return `${p1}\n${p2}`;
    if (/^[a-zA-Z]+$/.test(p1) && /^\d+$/.test(p2)) return `${p1}\n${p2}`;
    
    // Quebra por espaço
    return `${p1}\n${p2}`;
  });
  
  console.log("🔧 TEXTO PROCESSADO:", textoProcessado.substring(0, 200) + "...");
  
  linhas = textoProcessado
    .split(/\n/)
    .map(linha => linha.trim())
    .filter(linha => linha.length > 0);
  
  console.log(`🔧 RESULTADO: ${linhas.length} linhas criadas`);
  
  if (linhas.length > 1) {
    return linhas;
  }
  
  // Fallback: quebra por espaços simples
  linhas = texto
    .split(/\s+/)
    .map(linha => linha.trim())
    .filter(linha => linha.length > 0);
  
  if (linhas.length > 1) {
    return linhas;
  }
  
  // Último fallback: quebra por caracteres especiais
  linhas = texto
    .split(/[•\-*]/)
    .map(linha => linha.trim())
    .filter(linha => linha.length > 0);
  
  if (linhas.length > 1) {
    return linhas;
  }
  
  // Fallback final: chunks de 80 caracteres
  const textoLimpo = texto.replace(/\s+/g, " ");
  const chunks = [];
  for (let i = 0; i < textoLimpo.length; i += 80) {
    chunks.push(textoLimpo.slice(i, i + 80).trim());
  }
  return chunks.filter(chunk => chunk.length > 0);
}

/* --------------------- Layouts (pdf_layouts) --------------------- */

// Listar layouts
router.get("/", autenticarToken, async (req, res) => {
  const { departamento_id } = req.query;
  const { empresaId } = req.usuario;

  // Verificar se a coluna empresa_id existe
  const [[colunas]] = await db.query(
    `SHOW COLUMNS FROM pdf_layouts LIKE 'empresa_id'`
  );
  
  let query;
  const params = [];
  
  if (colunas) {
    // Se a coluna empresa_id existe, usar ela para filtrar
    query = `SELECT pl.*, d.nome AS departamento 
             FROM pdf_layouts pl 
             JOIN departamentos d ON pl.departamento_id = d.id
             WHERE pl.empresa_id = ?`;
    params.push(empresaId);
  } else {
    // Fallback para o método anterior
    query = `SELECT pl.*, d.nome AS departamento 
             FROM pdf_layouts pl 
             JOIN departamentos d ON pl.departamento_id = d.id
             WHERE d.empresa_id = ?`;
    params.push(empresaId);
  }

  if (departamento_id) {
    query += " AND pl.departamento_id = ?";
    params.push(departamento_id);
  }

  const [rows] = await db.query(query, params);
  res.json(rows);
});

// Criar layout com campos obrigatórios
router.post("/", autenticarToken, async (req, res) => {
  try {
    const { name, departamento_id } = req.body;
    const { empresaId } = req.usuario;

    if (!name || !departamento_id) {
      return res.status(400).json({ erro: "Nome e departamento são obrigatórios." });
    }

    // Verificar se a coluna empresa_id existe na tabela pdf_layouts
    const [[colunas]] = await db.query(
      `SHOW COLUMNS FROM pdf_layouts LIKE 'empresa_id'`
    );
    
    if (!colunas) {
      console.log("⚠️ Coluna empresa_id não existe, criando...");
      await db.query(
        `ALTER TABLE pdf_layouts ADD COLUMN empresa_id INT`
      );
      console.log("✅ Coluna empresa_id criada com sucesso");
    }

    // Verificar se o departamento pertence à empresa do usuário
    const [[departamento]] = await db.query(
      `SELECT id FROM departamentos WHERE id = ? AND empresa_id = ?`,
      [departamento_id, empresaId]
    );

    if (!departamento) {
      return res.status(403).json({ erro: "Departamento não pertence à sua empresa." });
    }

    const [resultado] = await db.query(
      `INSERT INTO pdf_layouts (nome, departamento_id, status, versao, empresa_id) VALUES (?, ?, 'pendente', 1, ?)`,
      [name, departamento_id, empresaId]
    );

    const layoutId = resultado.insertId;
    const camposFixos = ["obrigacao", "inscricao", "competencia"];

    for (const tipo of camposFixos) {
      await db.query(
        `INSERT INTO pdf_layout_campos (layout_id, tipo_campo, valor_esperado, posicao_linha, posicao_coluna, regex_validacao)
         VALUES (?, ?, '', 0, 0, '')`,
        [layoutId, tipo]
      );
    }

    res.status(201).json({ mensagem: "Modelo criado com sucesso", layoutId });
  } catch (error) {
    console.error("Erro ao criar PDF layout:", error);
    res.status(500).json({ erro: "Erro interno ao criar layout." });
  }
});

// Listar todos os modelos de PDF Layout (id e nome)
router.get("/modelos", autenticarToken, async (req, res) => {
  const { empresaId } = req.usuario;
  try {
    const [modelos] = await db.query(
      `SELECT id, nome FROM pdf_layouts WHERE empresa_id = ?`,
      [empresaId]
    );
    console.log("[PDF Layouts] Modelos retornados:", modelos);
    res.json(modelos);
  } catch (err) {
    console.error("Erro ao listar modelos de PDF Layout:", err);
    res.status(500).json({ erro: "Erro ao listar modelos de PDF Layout." });
  }
});

// Buscar layout por ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  console.log("🔍 Buscando layout ID:", id);
  
  const [[layout]] = await db.query(
    `SELECT * FROM pdf_layouts WHERE id = ?`,
    [id]
  );
  
  console.log("📋 Layout encontrado:", layout ? "Sim" : "Não");
  if (layout) {
    console.log("📊 Campos do layout:", Object.keys(layout));
    console.log("📄 PDF base64 presente:", layout.pdf_base64 ? "Sim" : "Não");
  }
  
  res.json(layout);
});

// Atualizar layout
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, status } = req.body;
  await db.query(
    `UPDATE pdf_layouts SET nome = ?, status = ? WHERE id = ?`,
    [name, status, id]
  );
  res.json({ mensagem: "Atualizado com sucesso." });
});

// Atualizar status do layout
router.patch("/:id/status", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { empresaId } = req.usuario;

    // Validar status permitidos
    const statusPermitidos = ["pendente", "validando", "pronto"];
    if (!statusPermitidos.includes(status)) {
      return res.status(400).json({ 
        erro: "Status inválido. Valores permitidos: pendente, validando, pronto" 
      });
    }

    // Verificar se o layout pertence à empresa do usuário
    const [[layout]] = await db.query(
      `SELECT id FROM pdf_layouts WHERE id = ? AND empresa_id = ?`,
      [id, empresaId]
    );

    if (!layout) {
      return res.status(404).json({ erro: "Layout não encontrado ou não pertence à sua empresa." });
    }

    // Atualizar status
    await db.query(
      `UPDATE pdf_layouts SET status = ? WHERE id = ?`,
      [status, id]
    );

    console.log(`✅ Status do layout ${id} atualizado para: ${status}`);

    res.json({ 
      mensagem: "Status atualizado com sucesso.",
      layoutId: id,
      novoStatus: status
    });

  } catch (error) {
    console.error("❌ Erro ao atualizar status do layout:", error);
    res.status(500).json({ erro: "Erro interno ao atualizar status." });
  }
});

/* ------------------ Campos do Layout ------------------ */

// Listar campos
router.get("/:layoutId/campos", async (req, res) => {
  const { layoutId } = req.params;
  const [rows] = await db.query(
    `SELECT * FROM pdf_layout_campos WHERE layout_id = ?`,
    [layoutId]
  );
  res.json(rows);
});

// Adicionar campo
router.post("/:layoutId/campos", async (req, res) => {
  const { layoutId } = req.params;
  const { tipo_campo, valor_esperado, posicao_linha, posicao_coluna, regex_validacao } = req.body;

  await db.query(
    `INSERT INTO pdf_layout_campos 
     (layout_id, tipo_campo, valor_esperado, posicao_linha, posicao_coluna, regex_validacao) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [layoutId, tipo_campo, valor_esperado, posicao_linha, posicao_coluna, regex_validacao]
  );

  res.status(201).json({ mensagem: "Campo adicionado com sucesso." });
});

// Remover campo
router.delete("/campos/:id", async (req, res) => {
  const { id } = req.params;
  await db.query(
    `DELETE FROM pdf_layout_campos WHERE id = ?`,
    [id]
  );
  res.json({ mensagem: "Campo removido com sucesso." });
});

/* --------------------- Testar PDF --------------------- */

// Upload de arquivo PDF
router.post("/:layoutId/upload", upload.single("arquivo"), async (req, res) => {
  const { layoutId } = req.params;
  const arquivo = req.file;

  console.log("📤 Upload iniciado para layoutId:", layoutId);
  console.log("📁 Arquivo recebido:", arquivo ? arquivo.originalname : "Nenhum arquivo");

  if (!arquivo) {
    return res.status(400).json({ erro: "Nenhum arquivo enviado." });
  }

  try {
    // Converter o buffer para base64
    const pdfBase64 = arquivo.buffer.toString('base64');
    console.log("📊 PDF convertido para base64, tamanho:", pdfBase64.length);
    
    // Verificar se a coluna pdf_base64 existe
    const [[colunas]] = await db.query(
      `SHOW COLUMNS FROM pdf_layouts LIKE 'pdf_base64'`
    );
    
    if (!colunas) {
      console.log("⚠️ Coluna pdf_base64 não existe, criando...");
      await db.query(
        `ALTER TABLE pdf_layouts ADD COLUMN pdf_base64 LONGTEXT`
      );
      console.log("✅ Coluna pdf_base64 criada com sucesso");
    }
    
    // Atualizar o layout com o PDF em base64
    await db.query(
      `UPDATE pdf_layouts SET pdf_base64 = ? WHERE id = ?`,
      [pdfBase64, layoutId]
    );

    console.log("✅ PDF salvo no banco com sucesso");

    res.json({ 
      mensagem: "Arquivo anexado com sucesso.",
      pdf_base64: pdfBase64 
    });

  } catch (err) {
    console.error("❌ Erro ao fazer upload do PDF:", err);
    res.status(500).json({ erro: "Falha ao fazer upload do arquivo." });
  }
});

// Deletar PDF do layout
router.delete("/:layoutId/pdf", autenticarToken, async (req, res) => {
  const { layoutId } = req.params;
  const { empresaId } = req.usuario;

  try {
    // Verificar se o layout pertence à empresa do usuário
    const [[layout]] = await db.query(
      `SELECT id FROM pdf_layouts WHERE id = ? AND empresa_id = ?`,
      [layoutId, empresaId]
    );

    if (!layout) {
      return res.status(404).json({ erro: "Layout não encontrado ou não pertence à sua empresa." });
    }

    // Remover o PDF (definir pdf_base64 como NULL)
    await db.query(
      `UPDATE pdf_layouts SET pdf_base64 = NULL WHERE id = ?`,
      [layoutId]
    );

    console.log(`✅ PDF removido do layout ${layoutId}`);

    res.json({ 
      mensagem: "PDF removido com sucesso.",
      layoutId: layoutId
    });

  } catch (error) {
    console.error("❌ Erro ao remover PDF do layout:", error);
    res.status(500).json({ erro: "Erro interno ao remover PDF." });
  }
});

router.post("/:layoutId/testar-pdf", upload.single("arquivo"), async (req, res) => {
  const { layoutId } = req.params;
  const arquivo = req.file;

  if (!arquivo) {
    return res.status(400).json({ erro: "Nenhum arquivo enviado." });
  }

  try {
    const data = await pdfParse(arquivo.buffer);
    const primeiraPagina = data.text.split("\f")[0];
    
    // Usar a função global quebrarTextoInteligente
    let linhas = quebrarTextoInteligente(primeiraPagina);
    const textoCompleto = linhas.join(" ");
    
    // Log detalhado das linhas para debug
    console.log("📄 QUEBRA DE LINHAS DO PDF (TESTAR):");
    console.log(`Total de linhas: ${linhas.length}`);
    linhas.forEach((linha, index) => {
      console.log(`${String(index + 1).padStart(3, "0")}: "${linha}"`);
    });
    console.log("📄 FIM DAS LINHAS (TESTAR)");
    const [campos] = await db.query(
      `SELECT * FROM pdf_layout_campos WHERE layout_id = ?`,
      [layoutId]
    );
    // Funções utilitárias para validação linha a linha
    function validaLinhaPorRegex(linhas, regex) {
      try {
        const re = new RegExp(regex, "i");
        // Com splitting mais granular, procura no texto completo primeiro
        if (re.test(textoCompleto)) {
          return true;
        }
        // Fallback: procura em linhas individuais
        return linhas.some(linha => re.test(linha));
      } catch {
        return false;
      }
    }
    function validaLinhaPorValor(linhas, valor) {
      // Com splitting mais granular, procura no texto completo primeiro
      if (textoCompleto.includes(valor)) {
        return true;
      }
      // Fallback: procura em linhas individuais
      return linhas.some(linha => linha.includes(valor));
    }
    const resultados = campos.map((campo) => {
      let autoMatch = null;
      let found = null;
      if (campo.tipo_campo === "competencia") {
        // Primeiro, tenta encontrar o valor mapeado manualmente
        if (campo.valor_esperado) {
          // Com splitting mais granular, procura no texto completo
          if (textoCompleto.includes(campo.valor_esperado)) {
            autoMatch = campo.valor_esperado;
            console.log(`✅ Competência mapeada encontrada: ${campo.valor_esperado}`);
          } else {
            // Fallback: procura em linhas individuais
            found = linhas.find(linha => linha.includes(campo.valor_esperado));
            if (found) {
              autoMatch = found;
              console.log(`✅ Competência mapeada encontrada: ${found}`);
            }
          }
        }
        
        // Se não encontrou o valor mapeado, então tenta detecção automática
        if (!autoMatch) {
          const match = textoCompleto.match(/\b(0[1-9]|1[0-2])\/\d{4}\b/);
          if (match) {
            autoMatch = match[0];
            console.log(`🔍 Competência detectada automaticamente: ${autoMatch}`);
          }
        }
      }
      if (campo.tipo_campo === "inscricao") {
        const match = textoCompleto.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/);
        autoMatch = match ? match[0] : null;
      }
      if (campo.tipo_campo === "obrigacao") {
        if (campo.regex_validacao) {
          try {
            const regex = new RegExp(campo.regex_validacao, "i");
            found = linhas.find(linha => regex.test(linha));
            if (found) autoMatch = found;
          } catch (e) {}
        }
        if (!found && campo.valor_esperado) {
          // Com splitting mais granular, procura no texto completo primeiro
          if (textoCompleto.includes(campo.valor_esperado)) {
            autoMatch = campo.valor_esperado;
          } else {
            // Fallback: procura em linhas individuais
            found = linhas.find(linha => linha.includes(campo.valor_esperado));
            if (found) autoMatch = found;
          }
        }
        if (!found && !autoMatch) {
          const txtMaiusculo = textoCompleto.toUpperCase();
          if (txtMaiusculo.includes("BALANCETE")) autoMatch = "BALANCETE";
          else if (txtMaiusculo.includes("CAGED")) autoMatch = "CAGED";
          else if (txtMaiusculo.includes("DCTF")) autoMatch = "DCTF";
        }
      }
      const validadoViaRegex = campo.regex_validacao
        ? validaLinhaPorRegex(linhas, campo.regex_validacao)
        : null;
      const validadoViaTexto = campo.valor_esperado
        ? validaLinhaPorValor(linhas, campo.valor_esperado)
        : null;
      return {
        campo: campo.tipo_campo,
        linha: campo.posicao_linha,
        resultado:
          validadoViaRegex !== null
            ? validadoViaRegex
              ? "✅ OK (regex)"
              : "❌ Falhou (regex)"
            : validadoViaTexto
            ? "✅ OK (valor)"
            : "❌ Falhou (valor)",
        extraido: linhas,
        sugestao_detectada: autoMatch || "Não identificado",
        valor_mapeado: campo.valor_esperado || null,
        valor_detectado: autoMatch || null,
      };
    });
    res.json({ sucesso: true, resultados });
  } catch (err) {
    console.error("Erro ao processar PDF:", err);
    res.status(500).json({ erro: "Falha ao analisar o PDF." });
  }
});

/* --------------------- Auto-baixa por PDF --------------------- */

router.post("/auto-baixa", upload.array("arquivos"), async (req, res) => {
  const empresaId = req.headers["empresaid"];
  if (!empresaId)
    return res.status(400).json({ erro: "Empresa não especificada." });

  const arquivos = req.files;
  const resultados = [];

  const [layouts] = await db.query(
    "SELECT * FROM pdf_layouts WHERE empresa_id = ?",
    [empresaId]
  );

  if (!layouts.length) {
    return res.json({
      resultados: arquivos.map((a) => ({
        nomeArquivo: a.originalname,
        status: "❌ Nenhum layout encontrado para a empresa",
        log: { layoutsTestados: [], camposExtraidos: {} },
      })),
    });
  }

  const layoutIds = layouts.map((l) => l.id);
  const [todosCampos] = await db.query(
    `SELECT * FROM pdf_layout_campos WHERE layout_id IN (${layoutIds
      .map(() => "?")
      .join(",")})`,
    layoutIds
  );

  // 🔍 Função auxiliar para testar regex
  function testarRegex(label, campos, texto) {
    const matches = [];
  
    for (const c of campos) {
      try {
        if (c.regex_validacao) {
          const regex = new RegExp(c.regex_validacao, "i");
          const resultado = texto.match(regex);
          matches.push({ regex: c.regex_validacao, result: resultado });
        }
      } catch (e) {
        matches.push({ regex: c.regex_validacao, error: e.message });
      }
    }
  
    // fallback específico para competência
    if (label.toLowerCase().includes("competencia")) {
      // Primeiro tenta encontrar padrões específicos como "Período: MM/YYYY - MM/YYYY"
      const periodo = texto.match(/Período: *(\d{2})\/(\d{4}) *- *\d{2}\/\d{4}/i);
      if (periodo) {
        console.log(`🔍 Competência detectada via período: ${periodo[1]}/${periodo[2]}`);
        return `${periodo[1]}/${periodo[2]}`;
      }
      
      // Depois tenta encontrar padrões MM/YYYY simples
      const mesAno = texto.match(/\b(0[1-9]|1[0-2])\/\d{4}\b/);
      if (mesAno) {
        console.log(`🔍 Competência detectada via regex: ${mesAno[0]}`);
        return mesAno[0];
      }
    }
  
    // fallback para CNPJ
    if (label.toLowerCase().includes("cnpj")) {
      const fallback = texto.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/);
      if (fallback) return fallback[0];
    }
  
    console.log(`🧪 ${label} testes:`, matches);
    return (
      matches.find((m) => m.result)?.result?.[1] ||
      matches.find((m) => m.result)?.result?.[0] ||
      ""
    );
  }
  
  for (const arquivo of arquivos) {
         let texto = "";
     let linhas = [];
     try {
       const data = await pdfParse(arquivo.buffer);
       const primeiraPagina = data.text.split("\f")[0];
       
       // Usar a função global quebrarTextoInteligente
       linhas = quebrarTextoInteligente(primeiraPagina);

       texto = linhas.join(" "); // Para compatibilidade com o código existente
       console.log("📄 LINHAS EXTRAÍDAS DO PDF:");
       linhas.forEach((linha, index) => {
         console.log(`${String(index + 1).padStart(2, "0")}: ${linha}`);
       });
     } catch (pdfErr) {
      resultados.push({
        nomeArquivo: arquivo.originalname,
        status: "❌ Erro ao processar PDF",
        log: { erro: pdfErr.message },
      });
      continue;
    }

    const detalhesLogs = { layoutsTestados: [], camposExtraidos: {} };
    let matchEncontrado = false;

    for (const layout of layouts) {
      detalhesLogs.layoutsTestados.push(layout.nome);

      const campos = todosCampos
        .filter((c) => c.layout_id === layout.id)
        .map((c) => ({ ...c, tipo_campo: c.tipo_campo?.toLowerCase() }));

      const obrigacoes = campos.filter((c) => c.tipo_campo === "obrigacao");
      const inscricoes = campos.filter((c) => c.tipo_campo === "inscricao");
      const competencias = campos.filter((c) => c.tipo_campo === "competencia");

      // 🧠 Detectar automaticamente
      let obrigacaoDetectada = "";
      const txtMaiusculo = texto.toUpperCase();
      if (txtMaiusculo.includes("BALANCETE")) obrigacaoDetectada = "BALANCETE";
      else if (txtMaiusculo.includes("CAGED")) obrigacaoDetectada = "CAGED";
      else if (txtMaiusculo.includes("DCTF")) obrigacaoDetectada = "DCTF";

      const cnpjExtraido =
        testarRegex("CNPJ", inscricoes, texto) ||
        inscricoes.find(
          (c) => c.valor_esperado && texto.includes(c.valor_esperado)
        )?.valor_esperado ||
        "";

      const competenciaExtraida =
        testarRegex("Competência", competencias, texto) ||
        competencias.find(
          (c) => c.valor_esperado && texto.includes(c.valor_esperado)
        )?.valor_esperado ||
        "";

      console.log("🧠 Sugestões detectadas:");
      console.log("→ Obrigação:", obrigacaoDetectada);
      console.log("→ CNPJ:", cnpjExtraido);
      console.log("→ Competência:", competenciaExtraida);

      detalhesLogs.camposExtraidos = {
        obrigacao: obrigacaoDetectada,
        cnpj: cnpjExtraido,
        competencia: competenciaExtraida,
      };

      resultados.push({
        nomeArquivo: arquivo.originalname,
        status:
          obrigacaoDetectada && cnpjExtraido && competenciaExtraida
            ? "✅ Dados extraídos com sucesso (teste)"
            : "❌ Falhou na extração de algum campo",
        layout: layout.nome,
        log: detalhesLogs,
      });

      matchEncontrado = true;
      break;
    }

    if (!matchEncontrado) {
      resultados.push({
        nomeArquivo: arquivo.originalname,
        status: "❌ Nenhum layout correspondeu (nenhum campo extraído)",
        log: detalhesLogs,
      });
    }
  }

  return res.json({ resultados });
});

/* --------------------- Processar PDF e marcar atividades como concluídas --------------------- */

router.post("/processar-pdf", autenticarToken, upload.single("pdf"), async (req, res) => {
  const empresaId = req.headers["empresaid"];
  if (!empresaId)
    return res.status(400).json({ erro: "Empresa não especificada." });

  const arquivo = req.file;
  if (!arquivo) {
    return res.status(400).json({ erro: "Nenhum arquivo PDF enviado." });
  }

  try {
    // Extrair texto do PDF
    const data = await pdfParse(arquivo.buffer);
    const primeiraPagina = data.text.split("\f")[0];
    
            // Usar a função global quebrarTextoInteligente
    
    const linhas = quebrarTextoInteligente(primeiraPagina);
    const textoCompleto = linhas.join(" ");

    // Buscar todos os layouts da empresa
    const [layouts] = await db.query(
      "SELECT * FROM pdf_layouts WHERE empresa_id = ?",
      [empresaId]
    );

    if (layouts.length === 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Nenhum layout PDF encontrado para esta empresa"
      });
    }

    // Buscar todos os campos de todos os layouts
    const layoutIds = layouts.map(l => l.id);
    const [todosCampos] = await db.query(
      `SELECT * FROM pdf_layout_campos WHERE layout_id IN (${layoutIds.map(() => "?").join(",")})`,
      layoutIds
    );

    // Funções utilitárias para validação (mesmas do testar-pdf)
    function validaLinhaPorRegex(linhas, regex) {
      try {
        const re = new RegExp(regex, "i");
        // Com splitting mais granular, procura no texto completo primeiro
        if (re.test(textoCompleto)) {
          return true;
        }
        // Fallback: procura em linhas individuais
        return linhas.some(linha => re.test(linha));
      } catch {
        return false;
      }
    }

    function validaLinhaPorValor(linhas, valor) {
      // Com splitting mais granular, procura no texto completo primeiro
      if (textoCompleto.includes(valor)) {
        return true;
      }
      // Fallback: procura em linhas individuais
      return linhas.some(linha => linha.includes(valor));
    }

    // Extrair dados usando a lógica do testar-pdf
    let obrigacaoDetectada = "";
    let cnpjExtraido = "";
    let competenciaExtraida = "";

    // Processar cada campo dos layouts
    for (const campo of todosCampos) {
      let autoMatch = null;
      let found = null;

      if (campo.tipo_campo === "competencia") {
        // Primeiro, tenta encontrar o valor mapeado manualmente
        if (campo.valor_esperado) {
          // Com splitting mais granular, procura no texto completo
          if (textoCompleto.includes(campo.valor_esperado)) {
            autoMatch = campo.valor_esperado;
            console.log(`✅ Competência mapeada encontrada: ${campo.valor_esperado}`);
          } else {
            // Fallback: procura em linhas individuais
            found = linhas.find(linha => linha.includes(campo.valor_esperado));
            if (found) {
              autoMatch = found;
              console.log(`✅ Competência mapeada encontrada: ${found}`);
            }
          }
        }
        
        // Se não encontrou o valor mapeado, então tenta detecção automática
        if (!autoMatch) {
          const match = textoCompleto.match(/\b(0[1-9]|1[0-2])\/\d{4}\b/);
          if (match) {
            autoMatch = match[0];
            console.log(`🔍 Competência detectada automaticamente: ${autoMatch}`);
          }
        }

        if (autoMatch) {
          competenciaExtraida = autoMatch;
        }
      }

      if (campo.tipo_campo === "inscricao") {
        const match = textoCompleto.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/);
        autoMatch = match ? match[0] : null;
        
        if (autoMatch) {
          cnpjExtraido = autoMatch;
        }
      }

      if (campo.tipo_campo === "obrigacao") {
        if (campo.regex_validacao) {
          try {
            const regex = new RegExp(campo.regex_validacao, "i");
            found = linhas.find(linha => regex.test(linha));
            if (found) autoMatch = found;
          } catch (e) {}
        }
        if (!found && campo.valor_esperado) {
          // Com splitting mais granular, procura no texto completo primeiro
          if (textoCompleto.includes(campo.valor_esperado)) {
            autoMatch = campo.valor_esperado;
          } else {
            // Fallback: procura em linhas individuais
            found = linhas.find(linha => linha.includes(campo.valor_esperado));
            if (found) autoMatch = found;
          }
        }
        if (!found && !autoMatch) {
          const txtMaiusculo = textoCompleto.toUpperCase();
          if (txtMaiusculo.includes("BALANCETE")) autoMatch = "BALANCETE";
          else if (txtMaiusculo.includes("CAGED")) autoMatch = "CAGED";
          else if (txtMaiusculo.includes("DCTF")) autoMatch = "DCTF";
        }

        if (autoMatch) {
          obrigacaoDetectada = autoMatch;
        }
      }
    }

    console.log("🧠 Dados extraídos usando layouts:");
    console.log("→ Obrigação:", obrigacaoDetectada);
    console.log("→ CNPJ:", cnpjExtraido);
    console.log("→ Competência:", competenciaExtraida);

    if (!obrigacaoDetectada || !cnpjExtraido || !competenciaExtraida) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Não foi possível extrair todos os dados necessários do PDF usando os layouts configurados"
      });
    }

    // Converter competência para formato YYYY-MM
    const [mes, ano] = competenciaExtraida.split("/");
    
    // Converter nome do mês para número se necessário
    const mesConvertido = converterMesParaNumero(mes);
    console.log(`📅 Mês extraído: "${mes}" → Convertido: "${mesConvertido}"`);
    
    const competenciaFormato = `${ano}-${mesConvertido.padStart(2, "0")}`;

    // Buscar cliente pelo CNPJ
    const [clientes] = await db.query(
      "SELECT id, nome_fantasia, razao_social FROM clientes WHERE cpf_cnpj = ? AND empresa_id = ?",
      [cnpjExtraido, empresaId]
    );

    if (clientes.length === 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: `Cliente com CNPJ ${cnpjExtraido} não encontrado`
      });
    }

    const cliente = clientes[0];
    const clienteNome = cliente.nome_fantasia || cliente.razao_social;

    // Determinar qual layout foi usado para extrair os dados
    let layoutUsado = null;
    let melhorScore = 0;

    // Testar cada layout para ver qual extraiu melhor os dados
    for (const layout of layouts) {
      const camposDoLayout = todosCampos.filter(c => c.layout_id === layout.id);
      let score = 0;
      
      for (const campo of camposDoLayout) {
        if (campo.tipo_campo === "competencia" && competenciaExtraida) score++;
        if (campo.tipo_campo === "inscricao" && cnpjExtraido) score++;
        if (campo.tipo_campo === "obrigacao" && obrigacaoDetectada) score++;
      }
      
      if (score > melhorScore) {
        melhorScore = score;
        layoutUsado = layout;
      }
    }

    if (!layoutUsado) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Não foi possível determinar qual layout foi usado para extrair os dados"
      });
    }

    console.log("🎯 Layout usado para extração:", layoutUsado.nome);

    // Buscar atividades base que estão vinculadas a este layout
    const [atividadesBaseVinculadas] = await db.query(
      `SELECT ao.id as atividadeBaseId, ao.obrigacao_id, ao.texto as textoBase, ao.descricao as descricaoBase, o.nome as obrigacao_nome
       FROM atividades_obrigacao ao
       JOIN obrigacoes o ON ao.obrigacao_id = o.id
       WHERE ao.pdf_layout_id = ?`,
      [layoutUsado.id]
    );

    if (atividadesBaseVinculadas.length === 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: `Nenhuma atividade base vinculada ao layout ${layoutUsado.nome}`
      });
    }

    console.log(`🔍 Atividades base vinculadas ao layout:`, atividadesBaseVinculadas);

    // Buscar atividades do cliente que correspondem às atividades base vinculadas
    const obrigacaoIds = atividadesBaseVinculadas.map(a => a.obrigacao_id);
    const [atividadesCliente] = await db.query(
      `SELECT oac.id, oac.concluida, oac.obrigacao_cliente_id, oac.texto, oac.descricao, oac.tipo, o.nome as obrigacao_nome, c.nome_fantasia, c.razao_social
       FROM obrigacoes_atividades_clientes oac
       JOIN obrigacoes_clientes oc ON oac.obrigacao_cliente_id = oc.id
       JOIN obrigacoes o ON oc.obrigacao_id = o.id
       JOIN clientes c ON oc.cliente_id = c.id
       WHERE oc.cliente_id = ? 
       AND oc.obrigacao_id IN (${obrigacaoIds.map(() => "?").join(",")})
       AND oc.ano_referencia = ?
       AND oc.mes_referencia = ?
       AND oac.concluida = 0
       AND oac.tipo = 'PDF Layout'`,
      [cliente.id, ...obrigacaoIds, parseInt(ano), parseInt(mesConvertido)]
    );

    if (atividadesCliente.length === 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: `Nenhuma atividade pendente encontrada para ${clienteNome} - ${competenciaExtraida} usando layout ${layoutUsado.nome}`
      });
    }

    // Identificar qual atividade do cliente corresponde à atividade base que tem o PDF Layout configurado
    let atividadeEspecifica = null;
    
    console.log(`🔍 Procurando atividade do cliente que corresponde à atividade base com PDF Layout`);
    console.log(`📋 Atividades do cliente disponíveis:`, atividadesCliente.map(a => ({ 
      id: a.id, 
      texto: a.texto, 
      descricao: a.descricao, 
      tipo: a.tipo,
      obrigacao: a.obrigacao_nome 
    })));
    
    // Para cada atividade base vinculada, buscar a atividade do cliente correspondente
    for (const atividadeBase of atividadesBaseVinculadas) {
      console.log(`🔍 Procurando atividade do cliente para atividade base: "${atividadeBase.textoBase}" (ID: ${atividadeBase.atividadeBaseId})`);
      
      // Buscar atividade do cliente que corresponde a esta atividade base específica
      const [atividadeCliente] = await db.query(
        `SELECT oac.id, oac.concluida, oac.obrigacao_cliente_id, oac.texto, oac.descricao, oac.tipo, o.nome as obrigacao_nome, c.nome_fantasia, c.razao_social
         FROM obrigacoes_atividades_clientes oac
         JOIN obrigacoes_clientes oc ON oac.obrigacao_cliente_id = oc.id
         JOIN obrigacoes o ON oc.obrigacao_id = o.id
         JOIN clientes c ON oc.cliente_id = c.id
         WHERE oc.cliente_id = ? 
         AND oc.obrigacao_id = ?
         AND oc.ano_referencia = ?
         AND oc.mes_referencia = ?
         AND oac.concluida = 0
         AND oac.texto = ?
         AND oac.tipo = 'PDF Layout'`,
        [cliente.id, atividadeBase.obrigacao_id, parseInt(ano), parseInt(mesConvertido), atividadeBase.textoBase]
      );

      if (atividadeCliente.length > 0) {
        atividadeEspecifica = atividadeCliente[0];
        console.log(`✅ Atividade específica encontrada: "${atividadeEspecifica.texto}" (ID: ${atividadeEspecifica.id}) - corresponde à atividade base "${atividadeBase.textoBase}" (ID: ${atividadeBase.atividadeBaseId})`);
        break;
      }
    }
    
    // Se não encontrou correspondência específica, usar a primeira atividade do cliente
    if (!atividadeEspecifica) {
      atividadeEspecifica = atividadesCliente[0];
      console.log(`⚠️ Não foi possível identificar atividade específica, usando primeira atividade: "${atividadeEspecifica.texto || atividadeEspecifica.descricao}" (ID: ${atividadeEspecifica.id})`);
    }

    // Verificar se a atividade é do tipo "PDF Layout"
    if (atividadeEspecifica.tipo !== 'PDF Layout') {
      return res.status(400).json({
        sucesso: false,
        mensagem: `A atividade "${atividadeEspecifica.texto}" não é do tipo "PDF Layout" (tipo atual: ${atividadeEspecifica.tipo}). Apenas atividades do tipo "PDF Layout" podem ser marcadas como concluídas via processamento de PDF.`
      });
    }

    console.log(`✅ Atividade confirmada como tipo "PDF Layout": "${atividadeEspecifica.texto}" (ID: ${atividadeEspecifica.id})`);

    // Marcar apenas a atividade específica como concluída
    console.log(`🎯 Marcando atividade como concluída: "${atividadeEspecifica.texto || atividadeEspecifica.descricao}" (ID: ${atividadeEspecifica.id})`);
    
    // Usar a função getDataHoraServidor() para ajuste de Brasília
    const { dataHora } = getDataHoraServidor();

    await db.query(
      `UPDATE obrigacoes_atividades_clientes 
       SET concluida = 1, data_conclusao = ? 
       WHERE id = ?`,
      [dataHora, atividadeEspecifica.id]
    );
    
    console.log(`✅ Atividade marcada como concluída com sucesso!`);

    // Inserir comentário na obrigação específica
    const comentario = `Arquivo PDF processado automaticamente em ${new Date().toLocaleString('pt-BR')}. Dados extraídos: ${obrigacaoDetectada}, ${cnpjExtraido}, ${competenciaExtraida}. Layout usado: ${layoutUsado.nome}. Atividade marcada: ${atividadeEspecifica.texto || atividadeEspecifica.descricao}`;
    
    // Extrair ID do usuário do token de autenticação
    const usuarioId = req.usuario?.id || 1; // Fallback para ID 1 se não houver usuário autenticado
    
    await db.query(
      `INSERT INTO comentarios_obrigacao (obrigacao_id, usuario_id, comentario, criado_em) 
       VALUES (?, ?, ?, ?)`,
      [atividadeEspecifica.obrigacao_cliente_id, usuarioId, comentario, dataHora]
    );

    // Após marcar a atividade como concluída, armazenar o arquivo
    if (atividadeEspecifica && atividadeEspecifica.tipo === 'PDF Layout') {
      try {
        // Converter arquivo para base64
        const base64 = req.file.buffer.toString('base64');
        
        // Armazenar arquivo baixado automaticamente
        await armazenarArquivoBaixado(
          empresaId, 
          cliente.id, 
          base64, 
          req.file.originalname, 
          atividadeEspecifica.id
        );
        
        // Criar notificação
        await criarNotificacaoArquivoBaixado(
          empresaId, 
          cliente.id, 
          obrigacaoDetectada, 
          clienteNome, 
          usuarioId
        );
        
        console.log(`✅ Arquivo processado e armazenado com sucesso: ${req.file.originalname}`);
      } catch (error) {
        console.error("❌ Erro ao armazenar arquivo:", error);
        // Não falha o processamento se der erro no armazenamento
      }
    }

    return res.json({
      sucesso: true,
      mensagem: `Atividade "${atividadeEspecifica.texto || atividadeEspecifica.descricao}" marcada como concluída para ${clienteNome} - ${competenciaExtraida} usando layout ${layoutUsado.nome}`,
      dados: {
        cliente: clienteNome,
        obrigacao: atividadeEspecifica.obrigacao_nome,
        atividade: atividadeEspecifica.texto || atividadeEspecifica.descricao,
        competencia: competenciaExtraida,
        atividadesDisponiveis: atividadesCliente.length,
        atividadeProcessada: 1,
        layoutUsado: layoutUsado.nome
      }
    });

  } catch (error) {
    console.error("Erro ao processar PDF:", error);
    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro interno ao processar PDF"
    });
  }
});

// Listar atividades vinculadas a um modelo PDF Layout
router.get("/:id/atividades-vinculadas", autenticarToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT ao.*, o.nome as obrigacao_nome
       FROM atividades_obrigacao ao
       JOIN obrigacoes o ON ao.obrigacao_id = o.id
       WHERE ao.pdf_layout_id = ?`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar atividades vinculadas.' });
  }
});

// Processar múltiplos PDFs em lote
router.post("/processar-pdf-lote", autenticarToken, upload.array("pdfs", 50), async (req, res) => {
  const empresaId = req.headers["empresaid"];
  if (!empresaId) {
    return res.status(400).json({ erro: "Empresa não especificada." });
  }

  try {
    const arquivos = req.files;
    
    if (!arquivos || arquivos.length === 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Nenhum arquivo PDF enviado"
      });
    }

    console.log(`📦 Processando ${arquivos.length} arquivos PDF em lote...`);

    const resultados = [];
    const erros = [];

    // Processar cada arquivo individualmente
    for (let i = 0; i < arquivos.length; i++) {
      const arquivo = arquivos[i];
      console.log(`\n📄 Processando arquivo ${i + 1}/${arquivos.length}: ${arquivo.originalname}`);

      try {
        console.log(`🔍 Iniciando processamento do arquivo: ${arquivo.originalname}`);
        
        // Extrair texto do PDF
        const data = await pdfParse(arquivo.buffer);
        const primeiraPagina = data.text.split("\f")[0];
        
        // Usar a função global quebrarTextoInteligente
        const linhas = quebrarTextoInteligente(primeiraPagina);
        const textoCompleto = linhas.join(" ");

        // Log detalhado das linhas para debug
        console.log("📄 QUEBRA DE LINHAS DO PDF:");
        console.log(`Total de linhas: ${linhas.length}`);
        linhas.forEach((linha, index) => {
          console.log(`${String(index + 1).padStart(3, "0")}: "${linha}"`);
        });
        console.log("📄 FIM DAS LINHAS");

        // Log detalhado das linhas para debug
        console.log("📄 QUEBRA DE LINHAS DO PDF:");
        console.log(`Total de linhas: ${linhas.length}`);
        linhas.forEach((linha, index) => {
          console.log(`${String(index + 1).padStart(3, "0")}: "${linha}"`);
        });
        console.log("📄 FIM DAS LINHAS");

        // Buscar todos os layouts da empresa
        const [layouts] = await db.query(
          "SELECT * FROM pdf_layouts WHERE empresa_id = ?",
          [empresaId]
        );

        if (layouts.length === 0) {
          const erro = {
            arquivo: arquivo.originalname,
            erro: "Nenhum layout PDF encontrado para esta empresa",
            dados: {}
          };
          erros.push(erro);
          console.log(`❌ Erro no arquivo ${arquivo.originalname}: Nenhum layout encontrado`);
          continue;
        }

        // Buscar todos os campos de todos os layouts
        const layoutIds = layouts.map(l => l.id);
        const [todosCampos] = await db.query(
          `SELECT * FROM pdf_layout_campos WHERE layout_id IN (${layoutIds.map(() => "?").join(",")})`,
          layoutIds
        );

        // Funções utilitárias para validação (mesmas do processar-pdf)
        function validaLinhaPorRegex(linhas, regex) {
          try {
            const re = new RegExp(regex, "i");
            // Com splitting mais granular, procura no texto completo primeiro
            if (re.test(textoCompleto)) {
              return true;
            }
            // Fallback: procura em linhas individuais
            return linhas.some(linha => re.test(linha));
          } catch {
            return false;
          }
        }

        function validaLinhaPorValor(linhas, valor) {
          // Com splitting mais granular, procura no texto completo primeiro
          if (textoCompleto.includes(valor)) {
            return true;
          }
          // Fallback: procura em linhas individuais
          return linhas.some(linha => linha.includes(valor));
        }

        // Extrair dados usando lógica inteligente e flexível
        let obrigacaoDetectada = "";
        let cnpjExtraido = "";
        let competenciaExtraida = "";
        let layoutUsado = null;
        let melhorScore = 0;

        console.log("�� Iniciando extração inteligente de dados...");
        console.log(`📄 Total de layouts disponíveis: ${layouts.length}`);

        // Testar cada layout com lógica flexível
        for (const layout of layouts) {
          console.log(`\n🔍 Testando layout: ${layout.nome}`);
          
          const camposDoLayout = todosCampos.filter(c => c.layout_id === layout.id);
          let score = 0;
          let obrigacaoTemp = "";
          let cnpjTemp = "";
          let competenciaTemp = "";

          // 1. ANÁLISE DE OBRIGAÇÃO - Busca por similaridade
          const campoObrigacao = camposDoLayout.find(c => c.tipo_campo === "obrigacao");
          if (campoObrigacao) {
            console.log(`🎯 Analisando obrigação: "${campoObrigacao.valor_esperado}"`);
            
            // Busca flexível por obrigação
            const obrigacaoEncontrada = buscarObrigacaoFlexivel(
              textoCompleto, 
              campoObrigacao.valor_esperado, 
              campoObrigacao.regex_validacao
            );
            
            if (obrigacaoEncontrada) {
              obrigacaoTemp = obrigacaoEncontrada;
              score += 3; // Peso alto para obrigação
              console.log(`✅ Obrigação encontrada: ${obrigacaoTemp}`);
            }
          }

          // 2. ANÁLISE DE CNPJ - Busca por padrão e posição
          const campoInscricao = camposDoLayout.find(c => c.tipo_campo === "inscricao");
          if (campoInscricao) {
            console.log(`🔍 Analisando CNPJ na linha ${campoInscricao.posicao_linha}`);
            
            const cnpjEncontrado = buscarCnpjFlexivel(
              linhas, 
              campoInscricao.posicao_linha, 
              campoInscricao.valor_esperado
            );
            
            if (cnpjEncontrado) {
              cnpjTemp = cnpjEncontrado;
              score += 2; // Peso médio para CNPJ
              console.log(`✅ CNPJ encontrado: ${cnpjTemp}`);
            }
          }

          // 3. ANÁLISE DE COMPETÊNCIA - Busca por padrão e posição
          const campoCompetencia = camposDoLayout.find(c => c.tipo_campo === "competencia");
          if (campoCompetencia) {
            console.log(`📅 Analisando competência na linha ${campoCompetencia.posicao_linha}`);
            
            const competenciaEncontrada = buscarCompetenciaFlexivel(
              linhas, 
              campoCompetencia.posicao_linha, 
              campoCompetencia.valor_esperado
            );
            
            if (competenciaEncontrada) {
              competenciaTemp = competenciaEncontrada;
              score += 2; // Peso médio para competência
              console.log(`✅ Competência encontrada: ${competenciaTemp}`);
            }
          }

          // Se este layout teve melhor score, usar seus dados
          if (score > melhorScore) {
            melhorScore = score;
            layoutUsado = layout;
            obrigacaoDetectada = obrigacaoTemp;
            cnpjExtraido = cnpjTemp;
            competenciaExtraida = competenciaTemp;
            console.log(`🏆 Novo melhor layout: ${layout.nome} (score: ${score})`);
          }
        }

        // Funções auxiliares para busca flexível
        function buscarObrigacaoFlexivel(texto, valorEsperado, regexValidacao) {
          if (!valorEsperado) return null;
          
          const textoUpper = texto.toUpperCase();
          const valorEsperadoUpper = valorEsperado.toUpperCase();
          
          // 1. Tentar regex se disponível
          if (regexValidacao) {
            try {
              const regex = new RegExp(regexValidacao, "i");
              const match = texto.match(regex);
              if (match) {
                console.log(`✅ Obrigação encontrada por regex: ${match[0]}`);
                return valorEsperado; // Retorna o valor esperado, não o match
              }
            } catch (e) {
              console.log(`❌ Erro no regex: ${e.message}`);
            }
          }
          
          // 2. Busca exata
          if (textoUpper.includes(valorEsperadoUpper)) {
            console.log(`✅ Obrigação encontrada exata: ${valorEsperado}`);
            return valorEsperado;
          }
          
          // 3. Busca por palavras-chave similares
          const palavrasChave = extrairPalavrasChave(valorEsperado);
          for (const palavra of palavrasChave) {
            if (textoUpper.includes(palavra.toUpperCase())) {
              console.log(`✅ Obrigação encontrada por palavra-chave: ${palavra}`);
              return valorEsperado;
            }
          }
          
          // 4. Busca por similaridade (fuzzy match)
          const similaridade = calcularSimilaridade(textoUpper, valorEsperadoUpper);
          if (similaridade > 0.7) {
            console.log(`✅ Obrigação encontrada por similaridade: ${similaridade.toFixed(2)}`);
            return valorEsperado;
          }
          
          return null;
        }

        function buscarCnpjFlexivel(linhas, posicaoLinha, valorEsperado) {
          // 1. PRIORIDADE: Buscar na linha específica se definida
          if (posicaoLinha > 0 && linhas[posicaoLinha - 1]) {
            const linha = linhas[posicaoLinha - 1];
            console.log(`🎯 Procurando CNPJ na linha específica ${posicaoLinha}: "${linha}"`);
            const cnpj = extrairCnpjDaLinha(linha);
            if (cnpj) {
              console.log(`✅ CNPJ encontrado na linha específica ${posicaoLinha}: ${cnpj}`);
              return cnpj;
            }
          }
          
          // 2. FALLBACK: Buscar em linhas próximas (±2 linhas da posição específica)
          if (posicaoLinha > 0) {
            const linhaInicial = Math.max(0, posicaoLinha - 3);
            const linhaFinal = Math.min(linhas.length, posicaoLinha + 2);
            
            console.log(`🔍 Procurando CNPJ em linhas próximas (${linhaInicial + 1} a ${linhaFinal})`);
            
            for (let i = linhaInicial; i < linhaFinal; i++) {
              if (i === posicaoLinha - 1) continue; // Já verificou esta linha
              const linha = linhas[i];
              const cnpj = extrairCnpjDaLinha(linha);
              if (cnpj) {
                console.log(`✅ CNPJ encontrado na linha próxima ${i + 1}: ${cnpj}`);
                return cnpj;
              }
            }
          }
          
          // 3. ÚLTIMO RECURSO: Buscar em todas as linhas (apenas se não tem posição específica)
          if (!posicaoLinha || posicaoLinha <= 0) {
            console.log(`⚠️ Sem posição específica, procurando CNPJ em todas as linhas`);
            for (let i = 0; i < linhas.length; i++) {
              const linha = linhas[i];
              const cnpj = extrairCnpjDaLinha(linha);
              if (cnpj) {
                console.log(`✅ CNPJ encontrado na linha ${i + 1}: ${cnpj}`);
                return cnpj;
              }
            }
          }
          
          return null;
        }

        function buscarCompetenciaFlexivel(linhas, posicaoLinha, valorEsperado) {
          // 1. PRIORIDADE: Buscar na linha específica se definida
          if (posicaoLinha > 0 && linhas[posicaoLinha - 1]) {
            const linha = linhas[posicaoLinha - 1];
            console.log(`🎯 Procurando competência na linha específica ${posicaoLinha}: "${linha}"`);
            const competencia = extrairCompetenciaDaLinha(linha, valorEsperado);
            if (competencia) {
              console.log(`✅ Competência encontrada na linha específica ${posicaoLinha}: ${competencia}`);
              return competencia;
            }
          }
          
          // 2. FALLBACK: Buscar em linhas próximas (±2 linhas da posição específica)
          if (posicaoLinha > 0) {
            const linhaInicial = Math.max(0, posicaoLinha - 3);
            const linhaFinal = Math.min(linhas.length, posicaoLinha + 2);
            
            console.log(`🔍 Procurando competência em linhas próximas (${linhaInicial + 1} a ${linhaFinal})`);
            
            for (let i = linhaInicial; i < linhaFinal; i++) {
              if (i === posicaoLinha - 1) continue; // Já verificou esta linha
              const linha = linhas[i];
              const competencia = extrairCompetenciaDaLinha(linha, valorEsperado);
              if (competencia) {
                console.log(`✅ Competência encontrada na linha próxima ${i + 1}: ${competencia}`);
                return competencia;
              }
            }
          }
          
          // 3. ÚLTIMO RECURSO: Buscar em todas as linhas (apenas se não tem posição específica)
          if (!posicaoLinha || posicaoLinha <= 0) {
            console.log(`⚠️ Sem posição específica, procurando competência em todas as linhas`);
            for (let i = 0; i < linhas.length; i++) {
              const linha = linhas[i];
              const competencia = extrairCompetenciaDaLinha(linha, valorEsperado);
              if (competencia) {
                console.log(`✅ Competência encontrada na linha ${i + 1}: ${competencia}`);
                return competencia;
              }
            }
          }
          
          return null;
        }

        function extrairCnpjDaLinha(linha) {
          console.log(`🔍 Analisando linha para CNPJ: "${linha}"`);
          
          // Padrões de CNPJ
          const padroesCnpj = [
            // CNPJ formatado: XX.XXX.XXX/XXXX-XX
            /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g,
            // CNPJ sem formatação: 14 dígitos
            /\b\d{14}\b/g,
            // CNPJ com espaços: XX XXX XXX XXXX XX
            /\d{2}\s\d{3}\s\d{3}\s\d{4}\s\d{2}/g,
          ];
          
          for (const padrao of padroesCnpj) {
            const matches = linha.match(padrao);
            if (matches && matches.length > 0) {
              // Verificar se é realmente um CNPJ válido (não apenas 14 dígitos aleatórios)
              const cnpj = matches[0].replace(/[^\d]/g, '');
              if (cnpj.length === 14) {
                console.log(`✅ CNPJ encontrado: ${matches[0]}`);
                return matches[0];
              }
            }
          }
          
          console.log(`❌ Nenhum CNPJ válido encontrado na linha`);
          return null;
        }

        function extrairCompetenciaDaLinha(linha, valorEsperado) {
          console.log(`🔍 Analisando linha para competência: "${linha}"`);
          
          // Padrões de competência
          const padroesCompetencia = [
            // Mês/Ano (Janeiro/2025, jan/2025, 01/2025)
            /(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\/\d{4}/gi,
            /(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/\d{4}/gi,
            /\d{2}\/\d{4}/g, // MM/YYYY
            // Mês-Ano
            /(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)-\d{4}/gi,
            /(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)-\d{4}/gi,
            // Mês de Ano
            /(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{4}/gi,
            // Apenas ano (quando não há mês específico)
            /\b\d{4}\b/g,
          ];
          
          for (const padrao of padroesCompetencia) {
            const matches = linha.match(padrao);
            if (matches && matches.length > 0) {
              const competencia = matches[0];
              console.log(`✅ Competência encontrada: ${competencia}`);
              
              // Se encontrou apenas o ano, tentar extrair mês do contexto
              if (/^\d{4}$/.test(competencia)) {
                // Procurar por mês na mesma linha
                const mesMatch = linha.match(/(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/i);
                if (mesMatch) {
                  const mes = converterMesParaNumero(mesMatch[0]);
                  return `${mes}/${competencia}`;
                }
              }
              
              return competencia;
            }
          }
          
          console.log(`❌ Nenhuma competência encontrada na linha`);
          return null;
        }

        function extrairPalavrasChave(texto) {
          // Extrair palavras significativas (mais de 3 letras)
          return texto
            .split(/\s+/)
            .filter(palavra => palavra.length > 3)
            .map(palavra => palavra.replace(/[^\w]/g, ''));
        }

        function calcularSimilaridade(texto1, texto2) {
          // Implementação simples de similaridade
          const palavras1 = texto1.split(/\s+/);
          const palavras2 = texto2.split(/\s+/);
          
          let matches = 0;
          for (const palavra1 of palavras1) {
            for (const palavra2 of palavras2) {
              if (palavra1 === palavra2 && palavra1.length > 3) {
                matches++;
              }
            }
          }
          
          return matches / Math.max(palavras1.length, palavras2.length);
        }

        if (!obrigacaoDetectada || !cnpjExtraido || !competenciaExtraida) {
          const erro = {
            arquivo: arquivo.originalname,
            erro: "Não foi possível extrair todos os dados necessários do PDF usando os layouts configurados",
            dados: {
              obrigacao: obrigacaoDetectada,
              cnpj: cnpjExtraido,
              competencia: competenciaExtraida
            }
          };
          erros.push(erro);
          console.log(`❌ Erro no arquivo ${arquivo.originalname}: Dados insuficientes`);
          continue;
        }

        if (!layoutUsado) {
          const erro = {
            arquivo: arquivo.originalname,
            erro: "Não foi possível determinar qual layout foi usado para extrair os dados"
          };
          erros.push(erro);
          console.log(`❌ Erro no arquivo ${arquivo.originalname}: Layout não identificado`);
          continue;
        }

        // Converter competência para formato YYYY-MM
        const [mes, ano] = competenciaExtraida.split("/");
        
        // Converter nome do mês para número se necessário
        const mesConvertido = converterMesParaNumero(mes);
        console.log(`📅 Mês extraído: "${mes}" → Convertido: "${mesConvertido}"`);
        
        const competenciaFormato = `${ano}-${mesConvertido.padStart(2, "0")}`;

        // Buscar cliente pelo CNPJ
        console.log(`🔍 Buscando cliente com CNPJ: ${cnpjExtraido}`);
        const [clientes] = await db.query(
          "SELECT id, nome_fantasia, razao_social FROM clientes WHERE cpf_cnpj = ? AND empresa_id = ?",
          [cnpjExtraido, empresaId]
        );

        if (clientes.length === 0) {
          const erro = {
            arquivo: arquivo.originalname,
            erro: `Cliente com CNPJ ${cnpjExtraido} não encontrado`,
            dados: { cnpj: cnpjExtraido }
          };
          erros.push(erro);
          console.log(`❌ Erro no arquivo ${arquivo.originalname}: Cliente não encontrado`);
          continue;
        }

        const cliente = clientes[0];
        const clienteNome = cliente.nome_fantasia || cliente.razao_social;
        console.log(`✅ Cliente encontrado: ${clienteNome}`);

        console.log("🎯 Layout usado para extração:", layoutUsado.nome);

        // Buscar atividades base que estão vinculadas a este layout
        const [atividadesBaseVinculadas] = await db.query(
          `SELECT ao.id as atividadeBaseId, ao.obrigacao_id, ao.texto as textoBase, ao.descricao as descricaoBase, o.nome as obrigacao_nome
           FROM atividades_obrigacao ao
           JOIN obrigacoes o ON ao.obrigacao_id = o.id
           WHERE ao.pdf_layout_id = ?`,
          [layoutUsado.id]
        );

        if (atividadesBaseVinculadas.length === 0) {
          const erro = {
            arquivo: arquivo.originalname,
            erro: `Nenhuma atividade base vinculada ao layout ${layoutUsado.nome}`,
            dados: { layout: layoutUsado.nome }
          };
          erros.push(erro);
          console.log(`❌ Erro no arquivo ${arquivo.originalname}: Nenhuma atividade vinculada`);
          continue;
        }

        console.log(`🔍 Atividades base vinculadas ao layout:`, atividadesBaseVinculadas);

        // Buscar atividades do cliente que correspondem às atividades base vinculadas
        const obrigacaoIds = atividadesBaseVinculadas.map(a => a.obrigacao_id);
        const [atividadesCliente] = await db.query(
          `SELECT oac.id, oac.concluida, oac.obrigacao_cliente_id, oac.texto, oac.descricao, oac.tipo, o.nome as obrigacao_nome, c.nome_fantasia, c.razao_social
           FROM obrigacoes_atividades_clientes oac
           JOIN obrigacoes_clientes oc ON oac.obrigacao_cliente_id = oc.id
           JOIN obrigacoes o ON oc.obrigacao_id = o.id
           JOIN clientes c ON oc.cliente_id = c.id
           WHERE oc.cliente_id = ? 
           AND oc.obrigacao_id IN (${obrigacaoIds.map(() => "?").join(",")})
           AND oc.ano_referencia = ?
           AND oc.mes_referencia = ?
           AND oac.concluida = 0
           AND oac.tipo = 'PDF Layout'`,
          [cliente.id, ...obrigacaoIds, parseInt(ano), parseInt(mesConvertido)]
        );

        if (atividadesCliente.length === 0) {
          const erro = {
            arquivo: arquivo.originalname,
            erro: `Nenhuma atividade pendente encontrada para ${clienteNome} - ${competenciaExtraida} usando layout ${layoutUsado.nome}`,
            dados: { cliente: clienteNome, competencia: competenciaExtraida }
          };
          erros.push(erro);
          console.log(`❌ Erro no arquivo ${arquivo.originalname}: Nenhuma atividade pendente`);
          continue;
        }

        // Identificar qual atividade do cliente corresponde à atividade base que tem o PDF Layout configurado
        let atividadeEspecifica = null;
        
        console.log(`🔍 Procurando atividade do cliente que corresponde à atividade base com PDF Layout`);
        console.log(`📋 Atividades do cliente disponíveis:`, atividadesCliente.map(a => ({ 
          id: a.id, 
          texto: a.texto, 
          descricao: a.descricao, 
          tipo: a.tipo,
          obrigacao: a.obrigacao_nome 
        })));
        
        // Para cada atividade base vinculada, buscar a atividade do cliente correspondente
        for (const atividadeBase of atividadesBaseVinculadas) {
          console.log(`🔍 Procurando atividade do cliente para atividade base: "${atividadeBase.textoBase}" (ID: ${atividadeBase.atividadeBaseId})`);
          
          // Buscar atividade do cliente que corresponde a esta atividade base específica
          const [atividadeCliente] = await db.query(
            `SELECT oac.id, oac.concluida, oac.obrigacao_cliente_id, oac.texto, oac.descricao, oac.tipo, o.nome as obrigacao_nome, c.nome_fantasia, c.razao_social
             FROM obrigacoes_atividades_clientes oac
             JOIN obrigacoes_clientes oc ON oac.obrigacao_cliente_id = oc.id
             JOIN obrigacoes o ON oc.obrigacao_id = o.id
             JOIN clientes c ON oc.cliente_id = c.id
             WHERE oc.cliente_id = ? 
             AND oc.obrigacao_id = ?
             AND oc.ano_referencia = ?
             AND oc.mes_referencia = ?
             AND oac.concluida = 0
             AND oac.texto = ?
             AND oac.tipo = 'PDF Layout'`,
            [cliente.id, atividadeBase.obrigacao_id, parseInt(ano), parseInt(mesConvertido), atividadeBase.textoBase]
          );

          if (atividadeCliente.length > 0) {
            atividadeEspecifica = atividadeCliente[0];
            console.log(`✅ Atividade específica encontrada: "${atividadeEspecifica.texto}" (ID: ${atividadeEspecifica.id}) - corresponde à atividade base "${atividadeBase.textoBase}" (ID: ${atividadeBase.atividadeBaseId})`);
            break;
          }
        }
        
        // Se não encontrou correspondência específica, usar a primeira atividade do cliente
        if (!atividadeEspecifica) {
          atividadeEspecifica = atividadesCliente[0];
          console.log(`⚠️ Não foi possível identificar atividade específica, usando primeira atividade: "${atividadeEspecifica.texto || atividadeEspecifica.descricao}" (ID: ${atividadeEspecifica.id})`);
        }

        // Verificar se a atividade é do tipo "PDF Layout"
        if (atividadeEspecifica.tipo !== 'PDF Layout') {
          const erro = {
            arquivo: arquivo.originalname,
            erro: `A atividade "${atividadeEspecifica.texto}" não é do tipo "PDF Layout" (tipo atual: ${atividadeEspecifica.tipo}). Apenas atividades do tipo "PDF Layout" podem ser marcadas como concluídas via processamento de PDF.`,
            dados: { tipo: atividadeEspecifica.tipo }
          };
          erros.push(erro);
          console.log(`❌ Erro no arquivo ${arquivo.originalname}: Tipo incorreto`);
          continue;
        }

        console.log(`✅ Atividade confirmada como tipo "PDF Layout": "${atividadeEspecifica.texto}" (ID: ${atividadeEspecifica.id})`);

        // Marcar apenas a atividade específica como concluída
        console.log(`🎯 Marcando atividade como concluída: "${atividadeEspecifica.texto || atividadeEspecifica.descricao}" (ID: ${atividadeEspecifica.id})`);
        
        // Usar a função getDataHoraServidor() para ajuste de Brasília
        const { dataHora } = getDataHoraServidor();

        await db.query(
          `UPDATE obrigacoes_atividades_clientes 
           SET concluida = 1, data_conclusao = ? 
           WHERE id = ?`,
          [dataHora, atividadeEspecifica.id]
        );
        
        console.log(`✅ Atividade marcada como concluída com sucesso!`);

        // Inserir comentário na obrigação específica
        const comentario = `Arquivo PDF processado automaticamente em lote em ${new Date().toLocaleString('pt-BR')}. Dados extraídos: ${obrigacaoDetectada}, ${cnpjExtraido}, ${competenciaExtraida}. Layout usado: ${layoutUsado.nome}. Atividade marcada: ${atividadeEspecifica.texto || atividadeEspecifica.descricao}`;
        
        // Extrair ID do usuário do token de autenticação
        const usuarioId = req.usuario?.id || 1; // Fallback para ID 1 se não houver usuário autenticado
        
        await db.query(
          `INSERT INTO comentarios_obrigacao (obrigacao_id, usuario_id, comentario, criado_em) 
           VALUES (?, ?, ?, ?)`,
          [atividadeEspecifica.obrigacao_cliente_id, usuarioId, comentario, dataHora]
        );

        // Após marcar a atividade como concluída, armazenar o arquivo
        if (atividadeEspecifica && atividadeEspecifica.tipo === 'PDF Layout') {
          try {
            // Converter arquivo para base64
            const base64 = arquivo.buffer.toString('base64');
            
            // Armazenar arquivo baixado automaticamente
            await armazenarArquivoBaixado(
              empresaId, 
              cliente.id, 
              base64, 
              arquivo.originalname, 
              atividadeEspecifica.id
            );
            
            // Criar notificação
            await criarNotificacaoArquivoBaixado(
              empresaId, 
              cliente.id, 
              obrigacaoDetectada, 
              clienteNome, 
              usuarioId
            );
            
            console.log(`✅ Arquivo processado e armazenado com sucesso: ${arquivo.originalname}`);
          } catch (error) {
            console.error("❌ Erro ao armazenar arquivo:", error);
            // Não falha o processamento se der erro no armazenamento
          }
        }

        const resultado = {
          arquivo: arquivo.originalname,
          sucesso: true,
          dados: {
            cliente: clienteNome,
            obrigacao: atividadeEspecifica.obrigacao_nome,
            atividade: atividadeEspecifica.texto || atividadeEspecifica.descricao,
            competencia: competenciaExtraida,
            atividadesDisponiveis: atividadesCliente.length,
            atividadeProcessada: 1,
            layoutUsado: layoutUsado.nome
          }
        };

        resultados.push(resultado);
        console.log(`✅ Arquivo ${arquivo.originalname} processado com sucesso!`);

      } catch (error) {
        const erro = {
          arquivo: arquivo.originalname,
          erro: "Erro interno ao processar arquivo",
          detalhes: error.message,
          stack: error.stack
        };
        erros.push(erro);
        console.log(`❌ Erro interno no arquivo ${arquivo.originalname}:`, error.message);
        console.log(`Stack trace:`, error.stack);
      }
    }

    // Resumo final
    const totalProcessados = resultados.length + erros.length;
    const totalSucesso = resultados.length;
    const totalErros = erros.length;

    console.log(`\n📊 RESUMO DO PROCESSAMENTO EM LOTE:`);
    console.log(`📄 Total de arquivos: ${totalProcessados}`);
    console.log(`✅ Sucessos: ${totalSucesso}`);
    console.log(`❌ Erros: ${totalErros}`);

    return res.json({
      sucesso: true,
      mensagem: `Processamento em lote concluído. ${totalSucesso} arquivos processados com sucesso, ${totalErros} com erro.`,
      dados: {
        total: totalProcessados,
        sucessos: totalSucesso,
        erros: totalErros,
        resultados: resultados,
        erros: erros
      }
    });

  } catch (error) {
    console.error("Erro ao processar PDFs em lote:", error);
    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro interno ao processar PDFs em lote"
    });
  }
});

// Função para obter data e hora do servidor em Brasília
// Função duplicada removida - usar a versão da linha 72

// Função para criar notificação de arquivo baixado automaticamente
async function criarNotificacaoArquivoBaixado(empresaId, clienteId, obrigacaoNome, clienteNome, usuarioId) {
  try {
    const mensagem = `A atividade da obrigação "${obrigacaoNome}" foi baixada automaticamente via PDF Layout, cliente "${clienteNome}"`;
    
    // Verificar se a tabela user_notifications existe e usar ela, caso contrário usar notificacoes_sistema
    await db.query(`
      INSERT INTO user_notifications 
      (user_id, empresa_id, module, type, title, body, created_at) 
      VALUES (?, ?, 'gestao', 'pdf_baixado_automaticamente', 'PDF Processado', ?, NOW())
    `, [usuarioId, empresaId, mensagem]);
    
    console.log(`✅ Notificação criada: ${mensagem}`);
  } catch (error) {
    console.error("❌ Erro ao criar notificação:", error);
    // Se a tabela user_notifications não existir, tentar notificacoes_sistema
    try {
      await db.query(`
        INSERT INTO notificacoes_sistema 
        (empresa_id, usuario_id, tipo, mensagem, lida, criado_em) 
        VALUES (?, ?, 'pdf_baixado_automaticamente', ?, 0, NOW())
      `, [empresaId, usuarioId, mensagem]);
    } catch (err2) {
      console.error("❌ Erro ao criar notificação alternativa:", err2);
    }
  }
}

// Função para armazenar arquivo baixado automaticamente
async function armazenarArquivoBaixado(empresaId, clienteId, base64, nomeArquivo, atividadeId) {
  try {
    // Converter base64 para buffer
    const pdfBuffer = Buffer.from(base64, 'base64');
    
    // 1. Armazenar na tabela de arquivos baixados automaticamente
    await db.query(`
      INSERT INTO arquivos_baixados_automaticamente 
      (empresa_id, cliente_id, pdf, nome_arquivo, criado_em) 
      VALUES (?, ?, ?, ?, NOW())
    `, [empresaId, clienteId, pdfBuffer, nomeArquivo]);
    
    // 2. Armazenar como anexo na atividade
    await db.query(`
      UPDATE obrigacoes_atividades_clientes 
      SET anexo = ?, nome_arquivo = ? 
      WHERE id = ?
    `, [pdfBuffer, nomeArquivo, atividadeId]);
    
    console.log(`✅ Arquivo armazenado: ${nomeArquivo} para atividade ${atividadeId}`);
  } catch (error) {
    console.error("❌ Erro ao armazenar arquivo:", error);
    throw error;
  }
}

// Rota para buscar arquivos baixados automaticamente
router.get("/arquivos-baixados", autenticarToken, async (req, res) => {
  try {
    const empresaId = req.usuario.empresaId || req.headers["empresaid"];
    const { clienteId, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT id, cliente_id, nome_arquivo, criado_em
      FROM arquivos_baixados_automaticamente 
      WHERE empresa_id = ?
    `;
    let params = [empresaId];

    if (clienteId) {
      query += ` AND cliente_id = ?`;
      params.push(clienteId);
    }

    query += ` ORDER BY criado_em DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [arquivos] = await db.query(query, params);

    res.json(arquivos);
  } catch (error) {
    console.error("❌ Erro ao buscar arquivos baixados:", error);
    res.status(500).json({ error: "Erro ao buscar arquivos baixados" });
  }
});

// Rota para baixar arquivo baixado automaticamente
router.get("/arquivos-baixados/:id/download", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.usuario.empresaId || req.headers["empresaid"];

    const [arquivos] = await db.query(`
      SELECT pdf, nome_arquivo
      FROM arquivos_baixados_automaticamente 
      WHERE id = ? AND empresa_id = ?
    `, [id, empresaId]);

    if (arquivos.length === 0) {
      return res.status(404).json({ error: "Arquivo não encontrado" });
    }

    const arquivo = arquivos[0];

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${arquivo.nome_arquivo}"`);
    res.send(arquivo.pdf);
  } catch (error) {
    console.error("❌ Erro ao baixar arquivo:", error);
    res.status(500).json({ error: "Erro ao baixar arquivo" });
  }
});

// Verificar validação automática e atualizar status
router.post("/:id/verificar-validacao", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { empresaId } = req.usuario;

    // Verificar se o layout pertence à empresa do usuário
    const [[layout]] = await db.query(
      `SELECT id, status FROM pdf_layouts WHERE id = ? AND empresa_id = ?`,
      [id, empresaId]
    );

    if (!layout) {
      return res.status(404).json({ erro: "Layout não encontrado ou não pertence à sua empresa." });
    }

    // Buscar campos do layout
    const [campos] = await db.query(
      `SELECT * FROM pdf_layout_campos WHERE layout_id = ?`,
      [id]
    );

    if (campos.length === 0) {
      return res.json({
        status: "pendente",
        mensagem: "Nenhum campo configurado para validação",
        camposValidados: 0,
        totalCampos: 0
      });
    }

    // Contar campos com validação configurada
    const camposComValidacao = campos.filter(campo => 
      campo.valor_esperado && campo.valor_esperado.trim() !== '' ||
      campo.regex_validacao && campo.regex_validacao.trim() !== ''
    );

    const totalCampos = camposComValidacao.length;
    let camposValidados = 0;

    // Verificar cada campo
    for (const campo of camposComValidacao) {
      let campoValido = false;

      // Verificar se tem valor esperado
      if (campo.valor_esperado && campo.valor_esperado.trim() !== '') {
        campoValido = true;
      }

      // Verificar se tem regex de validação
      if (campo.regex_validacao && campo.regex_validacao.trim() !== '') {
        try {
          new RegExp(campo.regex_validacao);
          campoValido = true;
        } catch (e) {
          // Regex inválido, não conta como válido
        }
      }

      if (campoValido) {
        camposValidados++;
      }
    }

    // Determinar novo status baseado na validação
    let novoStatus = layout.status;
    let mensagem = "";

    if (totalCampos === 0) {
      novoStatus = "pendente";
      mensagem = "Nenhum campo configurado para validação";
    } else if (camposValidados === 0) {
      novoStatus = "pendente";
      mensagem = "Nenhum campo validado";
    } else if (camposValidados < totalCampos) {
      novoStatus = "validando";
      mensagem = `${camposValidados}/${totalCampos} campos validados`;
    } else {
      novoStatus = "pronto";
      mensagem = "Todos os campos validados";
    }

    // Atualizar status no banco se mudou
    if (novoStatus !== layout.status) {
      await db.query(
        `UPDATE pdf_layouts SET status = ? WHERE id = ?`,
        [novoStatus, id]
      );
      console.log(`✅ Status do layout ${id} atualizado automaticamente: ${layout.status} → ${novoStatus}`);
    }

    res.json({
      status: novoStatus,
      mensagem,
      camposValidados,
      totalCampos,
      percentualValidacao: totalCampos > 0 ? Math.round((camposValidados / totalCampos) * 100) : 0
    });

  } catch (error) {
    console.error("❌ Erro ao verificar validação do layout:", error);
    res.status(500).json({ erro: "Erro interno ao verificar validação." });
  }
});

// Verificar validação de todos os layouts da empresa
router.post("/verificar-validacao-todos", autenticarToken, async (req, res) => {
  try {
    const { empresaId } = req.usuario;

    // Buscar todos os layouts da empresa
    const [layouts] = await db.query(
      `SELECT id, nome, status FROM pdf_layouts WHERE empresa_id = ?`,
      [empresaId]
    );

    if (layouts.length === 0) {
      return res.json({
        mensagem: "Nenhum layout encontrado para esta empresa",
        layoutsAtualizados: 0,
        totalLayouts: 0
      });
    }

    let layoutsAtualizados = 0;
    const resultados = [];

    // Verificar cada layout
    for (const layout of layouts) {
      try {
        // Buscar campos do layout
        const [campos] = await db.query(
          `SELECT * FROM pdf_layout_campos WHERE layout_id = ?`,
          [layout.id]
        );

        // Contar campos com validação configurada
        const camposComValidacao = campos.filter(campo => 
          campo.valor_esperado && campo.valor_esperado.trim() !== '' ||
          campo.regex_validacao && campo.regex_validacao.trim() !== ''
        );

        const totalCampos = camposComValidacao.length;
        let camposValidados = 0;

        // Verificar cada campo
        for (const campo of camposComValidacao) {
          let campoValido = false;

          if (campo.valor_esperado && campo.valor_esperado.trim() !== '') {
            campoValido = true;
          }

          if (campo.regex_validacao && campo.regex_validacao.trim() !== '') {
            try {
              new RegExp(campo.regex_validacao);
              campoValido = true;
            } catch (e) {
              // Regex inválido
            }
          }

          if (campoValido) {
            camposValidados++;
          }
        }

        // Determinar novo status
        let novoStatus = layout.status;
        if (totalCampos === 0) {
          novoStatus = "pendente";
        } else if (camposValidados === 0) {
          novoStatus = "pendente";
        } else if (camposValidados < totalCampos) {
          novoStatus = "validando";
        } else {
          novoStatus = "pronto";
        }

        // Atualizar status se mudou
        if (novoStatus !== layout.status) {
          await db.query(
            `UPDATE pdf_layouts SET status = ? WHERE id = ?`,
            [novoStatus, layout.id]
          );
          layoutsAtualizados++;
          console.log(`✅ Layout ${layout.nome} (${layout.id}): ${layout.status} → ${novoStatus}`);
        }

        resultados.push({
          layoutId: layout.id,
          nome: layout.nome,
          statusAnterior: layout.status,
          novoStatus,
          camposValidados,
          totalCampos,
          atualizado: novoStatus !== layout.status
        });

      } catch (error) {
        console.error(`❌ Erro ao verificar layout ${layout.id}:`, error);
        resultados.push({
          layoutId: layout.id,
          nome: layout.nome,
          erro: "Erro ao verificar validação"
        });
      }
    }

    res.json({
      mensagem: `${layoutsAtualizados} layouts atualizados de ${layouts.length} total`,
      layoutsAtualizados,
      totalLayouts: layouts.length,
      resultados
    });

  } catch (error) {
    console.error("❌ Erro ao verificar validação de todos os layouts:", error);
    res.status(500).json({ erro: "Erro interno ao verificar validação." });
  }
});

module.exports = router;
