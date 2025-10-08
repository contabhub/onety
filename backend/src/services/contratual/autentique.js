const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const AUTENTIQUE_URL = process.env.AUTENTIQUE_URL || "https://api.autentique.com.br/v2/graphql";
const AUTENTIQUE_TOKEN = process.env.AUTENTIQUE_TOKEN;

// ✅ Mutation baseada na doc oficial
const CREATE_DOCUMENT_MUTATION = `
  mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
    createDocument( document: $document, signers: $signers, file: $file) {
      id
      name
      refusable
      sortable
      created_at
      signatures {
        public_id
        name
        email
        created_at
        action { name }
        link { short_link }
        user { id name email }
      }
    }
  }
`;

async function createDocumentAutentique(name, base64File, signers) {
  try {
    console.log("🔑 AUTENTIQUE_TOKEN carregado?", !!AUTENTIQUE_TOKEN);
    console.log("📄 Enviando documento:", name);
    console.log("🌐 Modo: PRODUÇÃO (sem sandbox)");
    console.log("📋 Configuração refusable: true");

    // ✅ Monta form-data
    const form = new FormData();
    form.append("operations", JSON.stringify({
      query: CREATE_DOCUMENT_MUTATION,
      variables: {
        document: { 
          name,
          refusable: true // ✅ Permite que signatários recusem o documento
        },
        signers: signers.map(s => ({
          email: s.email,
          name: s.name,
          action: "SIGN" // importante: action precisa ser "SIGN"
        })),
        file: null
      }
    }));

    form.append("map", JSON.stringify({ "0": ["variables.file"] }));
    form.append("0", Buffer.from(base64File, "base64"), { filename: "contrato.pdf" });

    // ✅ Faz a requisição
    const response = await fetch(AUTENTIQUE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${AUTENTIQUE_TOKEN}`,
        ...form.getHeaders()
      },
      body: form
    });

    const json = await response.json();
    console.log("📥 Resposta bruta do Autentique:", JSON.stringify(json, null, 2));

    if (!json.data || !json.data.createDocument) {
      throw new Error("❌ Erro Autentique: " + JSON.stringify(json));
    }

    return json.data.createDocument;
  } catch (err) {
    console.error("❌ Falha em createDocumentAutentique:", err.message);
    throw err;
  }
}

// Query para buscar documento
async function getDocumentAutentique(id) {
  const query = `
    query GetDocument($id: UUID!) {
      document(id: $id) {
        id
        name
        created_at
        signatures {
          public_id
          name
          email
          created_at
          action { name }
          link { short_link }
        }
      }
    }
  `;

  try {
    const response = await fetch(AUTENTIQUE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${AUTENTIQUE_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query, variables: { id } })
    });

    const json = await response.json();
    console.log("📥 Resposta do getDocumentAutentique:", JSON.stringify(json, null, 2));

    if (!json.data || !json.data.document) {
      throw new Error("❌ Erro Autentique (getDocument): " + JSON.stringify(json));
    }

    return json.data.document;
  } catch (err) {
    console.error("❌ Falha em getDocumentAutentique:", err.message);
    throw err;
  }
}

// Query para buscar documento com informações de rejeição
async function getDocumentWithRejectionInfo(id) {
  const query = `
    query GetDocumentWithRejectionInfo($id: UUID!) {
      document(id: $id) {
        id
        name
        created_at
        refusable
        sortable
        signatures {
          public_id
          name
          email
          created_at
          action { name }
          link { short_link }
          status
          rejected_at
          rejection_reason
        }
      }
    }
  `;

  try {
    const response = await fetch(AUTENTIQUE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${AUTENTIQUE_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query, variables: { id } })
    });

    const json = await response.json();
    console.log("📥 Resposta do getDocumentWithRejectionInfo:", JSON.stringify(json, null, 2));

    if (!json.data || !json.data.document) {
      throw new Error("❌ Erro Autentique (getDocumentWithRejectionInfo): " + JSON.stringify(json));
    }

    return json.data.document;
  } catch (err) {
    console.error("❌ Falha em getDocumentWithRejectionInfo:", err.message);
    throw err;
  }
}

// ...
async function deleteDocumentAutentique(id) {
  const query = `
    mutation {
      deleteDocument(id: "${id}")
    }
  `;

  try {
    const response = await fetch(AUTENTIQUE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${AUTENTIQUE_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query })
    });

    const json = await response.json();
    console.log("📥 Resposta do deleteDocumentAutentique:", JSON.stringify(json, null, 2));

    if (!json.data || json.data.deleteDocument !== true) {
      throw new Error("❌ Erro Autentique (deleteDocument): " + JSON.stringify(json));
    }

    return true;
  } catch (err) {
    console.error("❌ Falha em deleteDocumentAutentique:", err.message);
    throw err;
  }
}


async function getDocumentFiles(id) {
  const query = `
    query GetDocumentFiles($id: UUID!) {
      document(id: $id) {
        id
        name
        files { original signed pades }
      }
    }
  `;
  const response = await fetch(AUTENTIQUE_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${AUTENTIQUE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { id } }),
  });
  const json = await response.json();
  if (!json.data || !json.data.document) {
    throw new Error("❌ Erro Autentique (getDocumentFiles): " + JSON.stringify(json));
  }
  return json.data.document;
}

module.exports = {
  createDocumentAutentique,
  getDocumentAutentique,
  getDocumentWithRejectionInfo,
  deleteDocumentAutentique,
  getDocumentFiles
};