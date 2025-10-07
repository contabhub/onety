const express = require('express');
const path = require('path');

// Middleware para servir arquivos estáticos
const staticFiles = express.static(path.join(__dirname, '../uploads'));

// Middleware para servir arquivos de áudio
const audioFiles = express.static(path.join(__dirname, '../uploads/audio'));

module.exports = {
  staticFiles,
  audioFiles
};
