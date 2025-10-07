const fs = require('fs');
const path = require('path');

const createDirectories = () => {
  const directories = [
    'uploads',
    'uploads/audio',
    'uploads/images',
    'uploads/documents'
  ];

  directories.forEach(dir => {
    const fullPath = path.join(__dirname, '../../', dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`Diretório criado: ${fullPath}`);
    } else {
      console.log(`Diretório já existe: ${fullPath}`);
    }
  });
};

// Executar se chamado diretamente
if (require.main === module) {
  createDirectories();
}

module.exports = createDirectories;
