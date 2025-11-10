/**
 * Garante que APIs DOM necessárias por bibliotecas como pdf-parse/pdfjs
 * existam no ambiente Node, reutilizando as implementações do pacote canvas.
 */
function ensureNodeCanvasPolyfills() {
  try {
    const { DOMMatrix, ImageData, Path2D } = require('canvas');

    if (typeof global.DOMMatrix === 'undefined' && typeof DOMMatrix !== 'undefined') {
      global.DOMMatrix = DOMMatrix;
    }

    if (typeof global.ImageData === 'undefined' && typeof ImageData !== 'undefined') {
      global.ImageData = ImageData;
    }

    if (typeof global.Path2D === 'undefined' && typeof Path2D !== 'undefined') {
      global.Path2D = Path2D;
    }

    // pdfjs pode tentar usar atob/btoa; garante implementação se necessário
    if (typeof global.atob === 'undefined') {
      global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
    }

    if (typeof global.btoa === 'undefined') {
      global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
    }
  } catch (error) {
    console.error('[Polyfills] Falha ao carregar canvas para polyfills:', error);
  }
}

ensureNodeCanvasPolyfills();

module.exports = {
  ensureNodeCanvasPolyfills,
};

