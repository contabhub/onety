const express = require('express');
const pool = require('../config/database'); // Seu pool MySQL
const { makePluggyPostRequest } = require('../middlewares/pluggyToken');
require('dotenv').config();

const router = express.Router();

// ✅ 1) Cria Item Pluggy
router.post('/create', async (req, res) => {
    const { connectorId, parameters, clientUserId } = req.body;
    const cpf = parameters?.cpf || null;
    const agency = parameters?.agency || null;
    const account = parameters?.account || null;
    const password = parameters?.password || null;

    console.log('🟢 Body recebido:', req.body);
    console.log('➡️ Conector ID:', connectorId);
    console.log('➡️ Parameters:', parameters);

    if (!connectorId || !cpf) {
        console.log('❌ Validação falhou: CPF ou connectorId faltando');
        return res.status(400).json({ success: false, message: 'Campos obrigatórios faltando.' });
    }

    try {
        // ✅ MONTE O PAYLOAD PRIMEIRO
        const payload = {
            connectorId: Number(connectorId),
            parameters: { cpf },
            products: ['ACCOUNTS', 'TRANSACTIONS'],
            oauthRedirectUri: 'https://www.front-rh-novo.vercel.app/api/pluggy/callback',
            clientUserId: clientUserId || null,
        };

        // Se for credenciais (não OAuth), inclui outros campos
        if (agency && account && password) {
            payload.parameters.agency = agency;
            payload.parameters.account = account;
            payload.parameters.password = password;
            payload.webhookUrl = 'https://SEUSITE.com/webhook-events/callback';
        }

        console.log('🟢 Payload Pluggy:', payload);

        // ✅ FAÇA O POST UMA VEZ com retry automático
        const { data: item } = await makePluggyPostRequest(
            'https://api.pluggy.ai/items',
            payload
        );

        // ✅ LOG DA RESPOSTA COMPLETA
        console.log('🔍 Resposta completa do Pluggy:', JSON.stringify(item, null, 2));

        // Salva no banco
        await pool.query(
            `INSERT INTO contas_api 
        (item_id, client_user_id, connector_id, status, cpf, agency, account, password)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                item.id,
                clientUserId || null,
                connectorId,
                'PENDING',
                cpf,
                agency,
                account,
                password
            ]
        );

        console.log('🟢 Item salvo no banco com sucesso!');

        res.json({
            success: true,
            itemId: item.id,
            linkUrl: item.linkUrl || null  // 👀 IMPORTANTE: veja se vem undefined aqui!
        });

    } catch (err) {
        console.error('❌ Erro Pluggy:', err?.response?.data || err.message);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar item Pluggy',
            details: err?.response?.data || err.message
        });
    }
});

// ✅ 2) Callback OAuth Pluggy ➜ troca publicToken pelo itemId
router.get('/callback', async (req, res) => {
    const { publicToken } = req.query;

    if (!publicToken) {
        return res.status(400).send('❌ PublicToken não encontrado na query!');
    }

    console.log('✅ OAuth callback recebido! PublicToken:', publicToken);

    try {
        const { data: itemToken } = await makePluggyPostRequest(
            'https://api.pluggy.ai/items/token',
            { publicToken }
        );

        console.log('✅ ItemID trocado com sucesso:', itemToken);

        // 🔄 Atualiza status da conta no banco
        await pool.query(
            `UPDATE contas_api 
       SET status = ?, execution_status = ?
       WHERE item_id = ?`,
            [
                'UPDATED',
                'SYNCING',
                itemToken.itemId
            ]
        );

        res.send(`
      <h2>Consentimento Pluggy concluído!</h2>
      <p>✅ ItemID: ${itemToken.itemId}</p>
      <p>Status da conta atualizado no banco.</p>
      <p>Você pode fechar esta aba agora.</p>
    `);

    } catch (err) {
        console.error('❌ Erro ao trocar publicToken:', err?.response?.data || err.message);
        res.status(500).send('Erro ao trocar publicToken.');
    }
});

module.exports = router;
