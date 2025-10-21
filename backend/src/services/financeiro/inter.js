const axios = require('axios');
const https = require('https');
const pool = require('../../config/database');

async function getAccountById(id) {
  // Primeiro tenta buscar na tabela inter_accounts
  const [interRows] = await pool.query(
    'SELECT * FROM inter_accounts WHERE id = ? AND status = "ativo"',
    [id]
  );
  if (interRows.length) return interRows[0];

  // Se não encontrou, tenta buscar na tabela contas_api
  const [contasApiRows] = await pool.query(
    `SELECT 
       id,
       company_id,
       inter_apelido as apelido,
       inter_conta_corrente as conta_corrente,
       inter_client_id as client_id,
       inter_client_secret as client_secret,
       inter_cert_b64 as cert_b64,
       inter_key_b64 as key_b64,
       inter_ambiente as ambiente,
       inter_is_default as is_default,
       inter_status as status,
       created_at,
       updated_at
     FROM contas_api 
     WHERE id = ? AND inter_enabled = TRUE AND inter_status = "ativo"`,
    [id]
  );
  if (contasApiRows.length) return contasApiRows[0];

  throw new Error('Conta Inter não encontrada ou inativa.');
}

async function getDefaultAccountForCompany(companyId) {
  // Primeiro tenta buscar na tabela inter_accounts
  const [interRows] = await pool.query(
    `SELECT * FROM inter_accounts
     WHERE company_id = ? AND status = "ativo"
     ORDER BY is_default DESC, id ASC
     LIMIT 1`,
    [companyId]
  );
  if (interRows.length) return interRows[0];

  // Se não encontrou, tenta buscar na tabela contas_api
  const [contasApiRows] = await pool.query(
    `SELECT 
       id,
       company_id,
       inter_apelido as apelido,
       inter_conta_corrente as conta_corrente,
       inter_client_id as client_id,
       inter_client_secret as client_secret,
       inter_cert_b64 as cert_b64,
       inter_key_b64 as key_b64,
       inter_ambiente as ambiente,
       inter_is_default as is_default,
       inter_status as status,
       created_at,
       updated_at
     FROM contas_api 
     WHERE company_id = ? AND inter_enabled = TRUE AND inter_status = "ativo"
     ORDER BY inter_is_default DESC, id ASC
     LIMIT 1`,
    [companyId]
  );
  if (contasApiRows.length) return contasApiRows[0];

  throw new Error('Nenhuma conta Inter ativa para esta empresa.');
}

function buildHttpsAgentFromAccount(account) {
  const cert = Buffer.from(account.cert_b64, 'base64').toString('utf-8');
  const key  = Buffer.from(account.key_b64,  'base64').toString('utf-8');
  return new https.Agent({ cert, key });
}

function baseUrl(ambiente) {
  return ambiente === 'hml'
    ? 'https://cdpj-hml.partners.bancointer.com.br'
    : 'https://cdpj.partners.bancointer.com.br';
}

async function ensureValidToken(interAccountId, scope = 'boleto-cobranca.read boleto-cobranca.write') {
  // reaproveita token não expirado (com 60s de folga)
  const [[row]] = await pool.query(
    `SELECT access_token FROM inter_tokens_validate_cache
     WHERE inter_account_id = ?
       AND expires_at > DATE_ADD(UTC_TIMESTAMP(), INTERVAL 60 SECOND)
     ORDER BY created_at DESC
     LIMIT 1`,
    [interAccountId]
  );
  if (row?.access_token) return row.access_token;

  // senão, gera um novo token
  const account = await getAccountById(interAccountId);
  
  // Validar se a conta tem os campos necessários
  if (!account.client_id || !account.client_secret || !account.cert_b64 || !account.key_b64) {
    throw new Error('Conta Inter não possui credenciais válidas (client_id, client_secret, cert_b64, key_b64).');
  }
  
  const agent = buildHttpsAgentFromAccount(account);

  const params = new URLSearchParams();
  params.append('client_id', account.client_id);
  params.append('client_secret', account.client_secret);
  params.append('grant_type', 'client_credentials');
  params.append('scope', scope);

  const resp = await axios.post(
    `${baseUrl(account.ambiente)}/oauth/v2/token`,
    params,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, httpsAgent: agent }
  );

  const { access_token, expires_in, token_type } = resp.data;

  await pool.query(
    `INSERT INTO inter_tokens_validate_cache (inter_account_id, access_token, token_type, scope, expires_in)
     VALUES (?, ?, ?, ?, ?)`,
    [interAccountId, access_token, token_type || 'Bearer', scope, expires_in]
  );

  return access_token;
}

// Função utilitária para converter arquivo para base64
function convertFileToBase64(filePath) {
  const fs = require('fs');
  const fileBuffer = fs.readFileSync(filePath);
  return fileBuffer.toString('base64');
}

// Função utilitária para converter buffer para base64
function convertBufferToBase64(buffer) {
  return buffer.toString('base64');
}

// Função para criar conta com arquivos
async function createAccountWithFiles(accountData) {
  const fs = require('fs');
  const path = require('path');

  // Converter arquivos para base64 se fornecidos
  if (accountData.cert_file && fs.existsSync(accountData.cert_file)) {
    accountData.cert_b64 = convertFileToBase64(accountData.cert_file);
  }
  if (accountData.key_file && fs.existsSync(accountData.key_file)) {
    accountData.key_b64 = convertFileToBase64(accountData.key_file);
  }

  return accountData;
}

// Função para habilitar Inter em uma conta_api existente
async function enableInterForContaApi(contaApiId, interData) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Atualizar a conta_api com os dados Inter
    await conn.query(
      `UPDATE contas_api SET
       inter_enabled = TRUE,
       inter_client_id = ?,
       inter_client_secret = ?,
       inter_cert_b64 = ?,
       inter_key_b64 = ?,
       inter_conta_corrente = ?,
       inter_apelido = ?,
       inter_ambiente = ?,
       inter_is_default = ?,
       inter_status = ?,
       updated_at = NOW()
       WHERE id = ?`,
      [
        interData.client_id,
        interData.client_secret,
        interData.cert_b64,
        interData.key_b64,
        interData.conta_corrente,
        interData.apelido || `Conta ${interData.conta_corrente}`,
        interData.ambiente || 'prod',
        interData.is_default ? 1 : 0,
        interData.status || 'ativo',
        contaApiId
      ]
    );

    // 2. Se é conta padrão, desmarcar outras
    if (interData.is_default) {
      const [[contaApi]] = await conn.query('SELECT company_id FROM contas_api WHERE id = ?', [contaApiId]);
      if (contaApi?.company_id) {
        await conn.query(
          `UPDATE contas_api SET inter_is_default = FALSE 
           WHERE company_id = ? AND id <> ? AND inter_enabled = TRUE`,
          [contaApi.company_id, contaApiId]
        );
      }
    }

    await conn.commit();
    return { success: true, message: 'Conta habilitada para Inter com sucesso.' };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

// Função para desabilitar Inter em uma conta_api
async function disableInterForContaApi(contaApiId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Buscar o inter_account_id antes de desabilitar
    const [[contaApi]] = await conn.query(
      'SELECT inter_account_id FROM contas_api WHERE id = ?',
      [contaApiId]
    );

    // 2. Desabilitar Inter na conta_api
    await conn.query(
      `UPDATE contas_api SET
       inter_enabled = FALSE,
       inter_account_id = NULL,
       updated_at = NOW()
       WHERE id = ?`,
      [contaApiId]
    );

    // 3. Se havia uma conta Inter associada, deletar ela
    if (contaApi?.inter_account_id) {
      await conn.query(
        'DELETE FROM inter_accounts WHERE id = ?',
        [contaApi.inter_account_id]
      );
    }

    await conn.commit();
    return { success: true, message: 'Conta desabilitada para Inter com sucesso.' };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

// Função para listar contas_api com Inter habilitado
async function getContasApiWithInter(companyId) {
  const [rows] = await pool.query(
    `SELECT 
       id,
       banco,
       descricao_banco,
       tipo_conta,
       numero_conta,
       agencia,
       tipo,
       inter_enabled,
       inter_apelido,
       inter_conta_corrente,
       inter_ambiente,
       inter_is_default,
       inter_status,
       created_at,
       updated_at
     FROM contas_api 
     WHERE company_id = ? AND inter_enabled = TRUE
     ORDER BY inter_is_default DESC, created_at DESC`,
    [companyId]
  );
  return rows;
}

module.exports = {
  getAccountById,
  getDefaultAccountForCompany,
  buildHttpsAgentFromAccount,
  ensureValidToken,
  baseUrl,
  convertFileToBase64,
  convertBufferToBase64,
  createAccountWithFiles,
  enableInterForContaApi,
  disableInterForContaApi,
  getContasApiWithInter
};
