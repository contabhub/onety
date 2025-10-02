
const pool = require("../config/database");
const { getCompanyIdFromTeamInstance, findContactByPhone } = require("../utils/contactHelper");

// Formata uma data no fuso America/Sao_Paulo em ISO com offset (ex: 2025-09-24T11:03:00-03:00)
function formatDateInSaoPauloISO(dateLike) {
  const inputDate = dateLike instanceof Date ? dateLike : new Date(dateLike);
  const timeZone = 'America/Sao_Paulo';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(inputDate);

  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));

  // Obtém o offset do fuso em formato curto (ex: GMT-03:00 ou UTC-03:00)
  const tzNameParts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'shortOffset',
  }).formatToParts(inputDate);
  let offsetToken = tzNameParts.find(p => p.type === 'timeZoneName')?.value || 'UTC-03:00';
  // Normaliza para "+/-HH:MM"
  offsetToken = offsetToken.replace(/^GMT|^UTC/, '');
  if (!/[+-]\d{2}:?\d{2}$/.test(offsetToken)) {
    // Fallback simples para -03:00
    offsetToken = '-03:00';
  } else if (/^[+-]\d{2}\d{2}$/.test(offsetToken)) {
    // Converte -0300 -> -03:00
    offsetToken = offsetToken.replace(/^([+-]\d{2})(\d{2})$/, '$1:$2');
  }

  const yyyy = map.year;
  const mm = map.month;
  const dd = map.day;
  const HH = map.hour;
  const MI = map.minute;
  const SS = map.second;

  return `${yyyy}-${mm}-${dd}T${HH}:${MI}:${SS}${offsetToken}`;
}

// Mapeia message_type (DB) -> tipo do payload
const TYPE_MAP = {
  text: "TEXT",
  image: "IMAGE",
  audio: "AUDIO",
  video: "VIDEO",
  file: "FILE",
};

/**
 * Monta o payload do evento MESSAGE_RECEIVED com base
 * nas linhas já inseridas em messages e conversations.
 * Retorna { companyId, payload } para ser usado no enqueue.
 */
async function buildMessageReceivedPayload(messageRow, conversationRow) {
  // Precisamos do companyId para fan-out por webhooks da empresa
  const companyId = await getCompanyIdFromTeamInstance(
    conversationRow.team_whatsapp_instance_id
  );

  // Buscar nome da instância WhatsApp vinculada ao team_whatsapp_instance_id
  let instanceName = null;
  try {
    const [inst] = await pool.query(
      `SELECT wi.instance_name
         FROM team_whatsapp_instances twi
         JOIN whatsapp_instances wi ON twi.whatsapp_instance_id = wi.id
        WHERE twi.id = ?
        LIMIT 1`,
      [conversationRow.team_whatsapp_instance_id]
    );
    instanceName = inst?.[0]?.instance_name || null;
  } catch (e) {
    // Mantém compatibilidade caso falhe a consulta do nome
    instanceName = null;
  }

  const type = TYPE_MAP[messageRow.message_type] || "TEXT";

  // Buscar status da empresa
  let companyStatus = null;
  try {
    const [crows] = await pool.query(
      `SELECT status FROM company WHERE id = ? LIMIT 1`,
      [companyId]
    );
    companyStatus = crows?.[0]?.status || null;
  } catch (_) {
    companyStatus = null;
  }

  // Resolver contato (se possível) e buscar etiquetas
  let contactLabels = [];
  let contactIdForPayload = conversationRow.contact_id || null;
  try {
    if (!contactIdForPayload) {
      const resolved = await findContactByPhone(conversationRow.customer_phone, companyId);
      if (resolved && resolved.id) {
        contactIdForPayload = resolved.id;
      }
    }
    if (contactIdForPayload) {
      const [lrows] = await pool.query(
        `SELECT e.id, e.nome, e.cor
           FROM contatos_etiquetas ce
           JOIN etiquetas e ON e.id = ce.etiqueta_id
          WHERE ce.contato_id = ?
          ORDER BY e.nome ASC`,
        [contactIdForPayload]
      );
      contactLabels = Array.isArray(lrows) ? lrows : [];
    }
  } catch (_) {
    contactLabels = [];
  }

  const payload = {
    eventType: "MESSAGE_RECEIVED",
    date: formatDateInSaoPauloISO(new Date()),
    content: {
      messageId: messageRow.id,
      companyId,
      conversationId: conversationRow.id,
      type,
      direction: "FROM_CUSTOMER", // recebido do cliente
      text: type === "TEXT" ? messageRow.content || null : null,
      media:
        type !== "TEXT"
          ? {
              url: messageRow.media_url || null,
              mimeType: null, // preencha se você armazenar; opcional
              seconds: null,  // idem (áudio/vídeo); opcional
            }
          : null,
      from: {
        number: conversationRow.customer_phone,
        name: conversationRow.customer_name || null,
      },
      to: {
        teamWhatsappInstanceId: conversationRow.team_whatsapp_instance_id,
        instanceName: instanceName,
      },
      company: {
        id: companyId,
        status: companyStatus,
      },
      contact: contactIdForPayload
        ? { id: contactIdForPayload, labels: contactLabels }
        : null,
      timestamps: {
        createdAt: messageRow.created_at
          ? formatDateInSaoPauloISO(messageRow.created_at)
          : formatDateInSaoPauloISO(new Date()),
      },
    },
  };

  return { companyId, payload };
}

/**
 * Enfileira um evento para TODOS os webhooks ativos da empresa
 * que assinam esse eventType. (fan-out por webhook)
 *
 * Estrutura esperada do DB:
 * - webhooks(event_types JSON) com valores tipo ["MESSAGE_RECEIVED", ...]
 * - webhook_events com coluna webhook_id
 */
async function enqueueWebhookEvent({ companyId, eventType, payload }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Seleciona webhooks ativos que assinam o eventType
    const [hooks] = await conn.query(
      `SELECT id FROM webhooks
         WHERE company_id = ?
           AND status = 'ativo'
           AND JSON_CONTAINS(event_types, JSON_QUOTE(?))`,
      [companyId, eventType]
    );

    if (!hooks.length) {
      await conn.commit();
      return { enqueued: 0 };
    }

    // 2) Fan-out: 1 registro em webhook_events por webhook
    const values = hooks.map((h) => [
      companyId,
      h.id, // webhook_id
      eventType,
      JSON.stringify(payload),
      "pending", // status
      0,         // attempts
      null,      // next_retry_at
      null,      // last_error
    ]);

    await conn.query(
      `INSERT INTO webhook_events
         (company_id, webhook_id, type, payload, status, attempts, next_retry_at, last_error)
       VALUES ?`,
      [values]
    );

    await conn.commit();

    // ⚡ Disparar processamento imediato do worker com debounce e lock distribuído
    try {
      const webhookWorker = require('../workers/webhookWorker');
      webhookWorker.triggerNow?.();
    } catch (e) {
      console.warn('⚠️ Falha ao acionar worker imediatamente (não crítico):', e?.message || e);
    }

    return { enqueued: hooks.length };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  buildMessageReceivedPayload,
  enqueueWebhookEvent,
};
