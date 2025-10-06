const pool = require("../../config/database");

/**
 * 🔍 Normaliza o número de telefone para um formato padrão
 * @param {string} phone - Número de telefone bruto
 * @returns {string} - Número normalizado
 */
function normalizePhone(phone) {
  if (!phone) return phone;
  let normalized = String(phone).replace(/\D/g, "");
  
  // Se já começa com 55, mantém
  if (normalized.startsWith("55")) return normalized;
  
  // Remove zeros à esquerda
  if (normalized.startsWith("0")) {
    normalized = normalized.replace(/^0+/, "");
  }
  
  // Adiciona código do país (55 - Brasil)
  return `55${normalized}`;
}

/**
 * 📞 Busca um contato existente pelo telefone na empresa
 * @param {string} phone - Número de telefone
 * @param {number} companyId - ID da empresa
 * @returns {Promise<Object|null>} - Contato encontrado ou null
 */
async function findContactByPhone(phone, companyId) {
  const normalizedPhone = normalizePhone(phone);
  
  const [contacts] = await pool.query(
    `SELECT * FROM leads 
     WHERE telefone = ? AND empresa_id = ? 
     LIMIT 1`,
    [normalizedPhone, companyId]
  );
  
  return contacts.length > 0 ? contacts[0] : null;
}

/**
 * 👤 Cria um novo contato na empresa
 * @param {Object} contactData - Dados do contato
 * @param {string} contactData.nome - Nome do contato
 * @param {string} contactData.telefone - Telefone do contato
 * @param {number} contactData.companyId - ID da empresa
 * @param {string} [contactData.email] - Email opcional
 * @returns {Promise<Object>} - Contato criado
 */
async function createContact({ nome, telefone, companyId, email = null }) {
  const normalizedPhone = normalizePhone(telefone);
  
  const [result] = await pool.query(
    `INSERT INTO leads (nome, telefone, email, empresa_id, notas_internas)
     VALUES (?, ?, ?, ?, ?)`,
    [nome, normalizedPhone, email, companyId, JSON.stringify([])]
  );
  
  return {
    id: result.insertId,
    nome,
    telefone: normalizedPhone,
    email,
    empresa_id: companyId,
    notas_internas: []
  };
}

/**
 * 🔄 Busca um contato existente ou cria um novo
 * Esta é a função principal que implementa a lógica solicitada
 * 
 * @param {Object} params - Parâmetros
 * @param {string} params.phone - Número de telefone
 * @param {number} params.companyId - ID da empresa
 * @param {string} [params.customerName] - Nome do cliente (para criar se não existir)
 * @returns {Promise<Object>} - Contato existente ou criado
 */
async function resolveOrCreateContact({ phone, companyId, customerName = null }) {
  try {
    console.log(`🔍 Buscando contato para telefone ${phone} na empresa ${companyId}`);
    
    // 1. Tenta encontrar contato existente
    const existingContact = await findContactByPhone(phone, companyId);
    
    if (existingContact) {
      console.log(`✅ Contato existente encontrado: ID ${existingContact.id} - ${existingContact.nome}`);
      return existingContact;
    }
    
    // 2. Se não encontrou e tem nome, cria novo contato
    if (customerName) {
      console.log(`🆕 Criando novo contato: ${customerName} - ${phone}`);
      const newContact = await createContact({
        nome: customerName,
        telefone: phone,
        companyId
      });
      
      console.log(`✅ Novo contato criado: ID ${newContact.id} - ${newContact.nome}`);
      return newContact;
    }
    
    // 3. Se não tem nome, cria com telefone como nome
    const fallbackName = `Contato ${normalizePhone(phone)}`;
    console.log(`🆕 Criando contato sem nome: ${fallbackName}`);
    
    const newContact = await createContact({
      nome: fallbackName,
      telefone: phone,
      companyId
    });
    
    console.log(`✅ Contato criado com nome padrão: ID ${newContact.id} - ${newContact.nome}`);
    return newContact;
    
  } catch (error) {
    console.error("🚨 Erro ao resolver/criar contato:", error);
    throw error;
  }
}

/**
 * 🏢 Busca o company_id através do team_whatsapp_instance_id
 * @param {number} teamWhatsappInstanceId - ID da instância do time
 * @returns {Promise<number|null>} - ID da empresa ou null
 */
async function getCompanyIdFromTeamInstance(teamWhatsappInstanceId) {
  const [rows] = await pool.query(
    `SELECT t.empresa_id 
     FROM times_atendimento_instancias twi
     JOIN times_atendimento t ON twi.times_atendimento_id = t.id
     WHERE twi.id = ?`,
    [teamWhatsappInstanceId]
  );
  
  return rows.length > 0 ? rows[0].empresa_id : null;
}

module.exports = {
  normalizePhone,
  findContactByPhone,
  createContact,
  resolveOrCreateContact,
  getCompanyIdFromTeamInstance
};
