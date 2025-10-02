const cloudinary = require('../config/cloudinary');

/**
 * 📸 Upload de imagem para Cloudinary
 * @param {string} base64Data - Data URI da imagem (data:image/jpeg;base64,...)
 * @param {string} folder - Pasta no Cloudinary (opcional)
 * @returns {Promise<Object>} - URL da imagem no Cloudinary
 */
const uploadImageToCloudinary = async (base64Data, folder = 'aura8-images') => {
  try {
    console.log('☁️ Iniciando upload para Cloudinary...');
    
    // Extrair apenas o base64 do data URI
    let base64String = base64Data;
    if (base64Data.startsWith('data:')) {
      base64String = base64Data.split(',')[1];
    }
    
    // Upload para Cloudinary
    const result = await cloudinary.uploader.upload(
      `data:image/jpeg;base64,${base64String}`,
      {
        folder: folder,
        resource_type: 'image',
        transformation: [
          { quality: 'auto:good' }, // Otimização automática
          { fetch_format: 'auto' }  // Formato automático (webp quando possível)
        ]
      }
    );
    
    console.log('✅ Upload para Cloudinary concluído:', {
      url: result.secure_url,
      public_id: result.public_id,
      size: result.bytes,
      format: result.format
    });
    
    return {
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      size: result.bytes
    };
    
  } catch (error) {
    console.error('❌ Erro no upload para Cloudinary:', error);
    throw new Error(`Falha no upload da imagem: ${error.message}`);
  }
};

/**
 * 🎵 Upload de áudio para Cloudinary
 * @param {string} base64Data - Data URI do áudio (data:audio/ogg;base64,...)
 * @param {string} folder - Pasta no Cloudinary (opcional)
 * @returns {Promise<Object>} - URL do áudio no Cloudinary
 */
const uploadAudioToCloudinary = async (base64Data, folder = 'aura8-audios') => {
  try {
    console.log('🎵 Iniciando upload de áudio para Cloudinary...');
    
    // Extrair apenas o base64 do data URI
    let base64String = base64Data;
    if (base64Data.startsWith('data:')) {
      base64String = base64Data.split(',')[1];
    }
    
    // Upload para Cloudinary (áudio é tratado como 'video' no Cloudinary)
    const result = await cloudinary.uploader.upload(
      `data:audio/ogg;base64,${base64String}`,
      {
        folder: folder,
        resource_type: 'video', // Cloudinary trata áudio como vídeo
        transformation: [
          { quality: 'auto:good' }, // Otimização automática
          { fetch_format: 'auto' }  // Formato automático
        ]
      }
    );
    
    console.log('✅ Upload de áudio para Cloudinary concluído:', {
      url: result.secure_url,
      public_id: result.public_id,
      size: result.bytes,
      format: result.format,
      duration: result.duration
    });
    
    return {
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      size: result.bytes,
      duration: result.duration
    };
    
  } catch (error) {
    console.error('❌ Erro no upload de áudio para Cloudinary:', error);
    throw new Error(`Falha no upload do áudio: ${error.message}`);
  }
};

/**
 * 🎥 Upload de vídeo para Cloudinary
 * @param {string} base64Data - Data URI do vídeo (data:video/mp4;base64,...)
 * @param {string} folder - Pasta no Cloudinary (opcional)
 * @returns {Promise<Object>} - URL do vídeo no Cloudinary
 */
const uploadVideoToCloudinary = async (base64Data, folder = 'aura8-videos') => {
  try {
    console.log('🎥 Iniciando upload de vídeo para Cloudinary...');
    
    // Extrair apenas o base64 do data URI
    let base64String = base64Data;
    if (base64Data.startsWith('data:')) {
      base64String = base64Data.split(',')[1];
    }
    
    // Upload para Cloudinary
    const result = await cloudinary.uploader.upload(
      `data:video/mp4;base64,${base64String}`,
      {
        folder: folder,
        resource_type: 'video',
        transformation: [
          { quality: 'auto:good' }, // Otimização automática
          { fetch_format: 'auto' }  // Formato automático
        ]
      }
    );
    
    console.log('✅ Upload de vídeo para Cloudinary concluído:', {
      url: result.secure_url,
      public_id: result.public_id,
      size: result.bytes,
      format: result.format,
      duration: result.duration
    });
    
    return {
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      size: result.bytes,
      duration: result.duration
    };
    
  } catch (error) {
    console.error('❌ Erro no upload de vídeo para Cloudinary:', error);
    throw new Error(`Falha no upload do vídeo: ${error.message}`);
  }
};

/**
 * 📄 Upload de documento para Cloudinary
 * @param {string} base64Data - Data URI do documento (data:application/pdf;base64,...)
 * @param {string} fileName - Nome do arquivo
 * @param {string} mimeType - Tipo MIME do documento
 * @param {string} folder - Pasta no Cloudinary (opcional)
 * @returns {Promise<Object>} - URL do documento no Cloudinary
 */
const uploadDocumentToCloudinary = async (base64Data, fileName, mimeType, folder = 'aura8-documents') => {
  try {
    console.log('📄 Iniciando upload de documento para Cloudinary...');
    
    // Extrair apenas o base64 do data URI
    let base64String = base64Data;
    if (base64Data.startsWith('data:')) {
      base64String = base64Data.split(',')[1];
    }
    
    // Determinar o resource_type baseado no mimeType
    let resourceType = 'raw';
    if (mimeType.startsWith('image/')) {
      resourceType = 'image';
    } else if (mimeType.startsWith('video/')) {
      resourceType = 'video';
    } else if (mimeType.startsWith('audio/')) {
      resourceType = 'video'; // Cloudinary trata áudio como vídeo
    }
    
    // Upload para Cloudinary
    const result = await cloudinary.uploader.upload(
      `data:${mimeType};base64,${base64String}`,
      {
        folder: folder,
        resource_type: resourceType,
        public_id: fileName.replace(/\.[^/.]+$/, ""), // Remove extensão do nome
        use_filename: true,
        unique_filename: true
      }
    );
    
    console.log('✅ Upload de documento para Cloudinary concluído:', {
      url: result.secure_url,
      public_id: result.public_id,
      size: result.bytes,
      format: result.format,
      fileName: fileName,
      mimeType: mimeType
    });
    
    return {
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      size: result.bytes,
      fileName: fileName,
      mimeType: mimeType
    };
    
  } catch (error) {
    console.error('❌ Erro no upload de documento para Cloudinary:', error);
    throw new Error(`Falha no upload do documento: ${error.message}`);
  }
};

/**
 * 🗑️ Deletar imagem do Cloudinary
 * @param {string} publicId - ID público da imagem no Cloudinary
 * @returns {Promise<Object>} - Resultado da deleção
 */
const deleteImageFromCloudinary = async (publicId) => {
  try {
    console.log('🗑️ Deletando imagem do Cloudinary:', publicId);
    
    const result = await cloudinary.uploader.destroy(publicId);
    
    console.log('✅ Imagem deletada do Cloudinary:', result);
    
    return result;
    
  } catch (error) {
    console.error('❌ Erro ao deletar imagem do Cloudinary:', error);
    throw new Error(`Falha ao deletar imagem: ${error.message}`);
  }
};

module.exports = {
  uploadImageToCloudinary,
  uploadAudioToCloudinary,
  uploadVideoToCloudinary,
  uploadDocumentToCloudinary,
  deleteImageFromCloudinary
};
