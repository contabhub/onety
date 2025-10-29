const cloudinary = require('cloudinary').v2;
const axios = require('axios');

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Processa conteúdo HTML e faz upload de imagens base64 para Cloudinary
 * @param {string} htmlContent - Conteúdo HTML com imagens em base64
 * @returns {Promise<string>} - HTML com URLs das imagens do Cloudinary
 */
async function processarImagensHTML(htmlContent) {
  if (!htmlContent) return htmlContent;

  try {
    // Regex para encontrar imagens base64
    const base64Regex = /<img[^>]+src="data:image\/([^;]+);base64,([^"]+)"[^>]*>/g;
    let processedHTML = htmlContent;
    let match;

    // Processar cada imagem base64 encontrada
    while ((match = base64Regex.exec(htmlContent)) !== null) {
      const [fullMatch, imageType, base64Data] = match;
      
      try {
        // Converter base64 para buffer
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        // Upload para Cloudinary
        const result = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            {
              resource_type: 'auto',
              folder: 'guia-sistema',
              public_id: `artigo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              transformation: [
                { quality: 'auto', fetch_format: 'auto' },
                { width: 800, height: 600, crop: 'limit' }
              ]
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          ).end(imageBuffer);
        });

        // Substituir a imagem base64 pela URL do Cloudinary
        processedHTML = processedHTML.replace(fullMatch, fullMatch.replace(
          `data:image/${imageType};base64,${base64Data}`,
          result.secure_url
        ));

        console.log(`✅ Imagem processada e enviada para Cloudinary: ${result.secure_url}`);
      } catch (uploadError) {
        console.error('❌ Erro ao fazer upload da imagem para Cloudinary:', uploadError);
        // Manter a imagem original se o upload falhar
      }
    }

    return processedHTML;
  } catch (error) {
    console.error('❌ Erro ao processar imagens HTML:', error);
    return htmlContent; // Retornar conteúdo original em caso de erro
  }
}

/**
 * Extrai imagens de um URL e faz upload para Cloudinary
 * @param {string} imageUrl - URL da imagem
 * @returns {Promise<string>} - URL da imagem no Cloudinary
 */
async function uploadImagemDeURL(imageUrl) {
  try {
    // Baixar a imagem
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data);

    // Upload para Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'auto',
          folder: 'guia-sistema',
          public_id: `artigo_url_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          transformation: [
            { quality: 'auto', fetch_format: 'auto' },
            { width: 800, height: 600, crop: 'limit' }
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(imageBuffer);
    });

    return result.secure_url;
  } catch (error) {
    console.error('❌ Erro ao fazer upload de imagem de URL:', error);
    return imageUrl; // Retornar URL original em caso de erro
  }
}

/**
 * Processa conteúdo HTML e faz upload de todas as imagens (base64 e URLs) para Cloudinary
 * @param {string} htmlContent - Conteúdo HTML
 * @returns {Promise<string>} - HTML com URLs das imagens do Cloudinary
 */
async function processarTodasAsImagens(htmlContent) {
  if (!htmlContent) return htmlContent;

  try {
    let processedHTML = htmlContent;

    // 1. Processar imagens base64
    processedHTML = await processarImagensHTML(processedHTML);

    // 2. Processar imagens de URLs externas
    const urlRegex = /<img[^>]+src="(https?:\/\/[^"]+)"[^>]*>/g;
    let urlMatch;

    while ((urlMatch = urlRegex.exec(processedHTML)) !== null) {
      const [fullMatch, imageUrl] = urlMatch;
      
      // Verificar se já é uma URL do Cloudinary
      if (imageUrl.includes('cloudinary.com')) {
        continue;
      }

      try {
        const cloudinaryUrl = await uploadImagemDeURL(imageUrl);
        processedHTML = processedHTML.replace(fullMatch, fullMatch.replace(imageUrl, cloudinaryUrl));
        console.log(`✅ Imagem de URL processada: ${imageUrl} -> ${cloudinaryUrl}`);
      } catch (error) {
        console.error(`❌ Erro ao processar imagem de URL ${imageUrl}:`, error);
      }
    }

    return processedHTML;
  } catch (error) {
    console.error('❌ Erro ao processar todas as imagens:', error);
    return htmlContent;
  }
}

/**
 * Faz upload de uma imagem base64 para Cloudinary
 * @param {string} base64Image - Imagem em base64
 * @param {string} folder - Pasta no Cloudinary
 * @returns {Promise<string>} - URL da imagem no Cloudinary
 */
async function uploadImageToCloudinary(base64Image, folder = 'guia-sistema') {
  try {
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: folder,
      quality: 'auto:low',
      fetch_format: 'auto',
      transformation: [
        { width: 800, height: 600, crop: 'limit' }
      ]
    });
    return result.secure_url;
  } catch (error) {
    console.error('Erro ao fazer upload para Cloudinary:', error);
    throw new Error('Falha no upload da imagem para Cloudinary.');
  }
}

module.exports = {
  processarImagensHTML,
  uploadImagemDeURL,
  processarTodasAsImagens,
  uploadImageToCloudinary
};
