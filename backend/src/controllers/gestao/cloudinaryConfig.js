const cloudinary = require('cloudinary').v2; // Importa o SDK do Cloudinary


// Configuração do Cloudinary com as variáveis de ambiente
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

module.exports = cloudinary; // Exporta para ser utilizado nas rotas
