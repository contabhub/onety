// // routes/pluggyConnect.js

// const express = require('express');
// const axios = require('axios');
// require('dotenv').config();

// const router = express.Router();

// // 🚨 Garanta que PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET estão no seu .env
// const clientId = process.env.PLUGGY_CLIENT_ID;
// const clientSecret = process.env.PLUGGY_CLIENT_SECRET;

// let pluggyApiKey = null;
// let pluggyApiKeyExpiresAt = null;

// async function getPluggyApiKey() {
//   const now = new Date();
//   if (pluggyApiKey && pluggyApiKeyExpiresAt > now) {
//     console.log('[Pluggy] Usando API KEY em cache');
//     return pluggyApiKey;
//   }
//   const { data } = await axios.post('https://api.pluggy.ai/auth', { clientId, clientSecret });
//   pluggyApiKey = data.apiKey;
//   pluggyApiKeyExpiresAt = new Date(now.getTime() + 23 * 60 * 60 * 1000);
//   console.log('[Pluggy] Nova API KEY gerada');
//   return pluggyApiKey;
// }

// router.post('/connect', async (req, res) => {
//   try {
//     const apiKey = await getPluggyApiKey();

//     const payload = {
//       clientUserId: req.body.clientUserId || 'user-id-demo',
//       oauthRedirectUri: 'https://www.front-rh-novo.vercel.app/api/pluggy/callback',
//       webhookUrl: 'https://www.front-rh-novo.vercel.app/api/pluggy/webhook'
//     };

//     console.log('➡️ Payload Pluggy Connect:', payload);

//     const { data } = await axios.post(
//       'https://api.pluggy.ai/connect_token',
//       payload,
//       {
//         headers: {
//           'X-API-KEY': apiKey
//         }
//       }
//     );

//     console.log('✅ Connect Token:', data.accessToken);

//     res.json({ connectToken: data.accessToken });

//   } catch (err) {
//     console.error('❌ Erro criando connect_token:', err?.response?.data || err.message);
//     res.status(500).json({ error: 'Erro criando connect_token', details: err?.response?.data || err.message });
//   }
// });

// module.exports = router;
