const fs = require('fs');
const path = require('path');

class AudioProcessor {
  constructor() {
    this.sampleRate = 24000;
    this.audioBuffer = new Map();
  }

  /**
   * Processa dados de áudio PCM 16-bit
   * @param {Buffer} audioData - Dados de áudio em formato PCM
   * @param {string} sessionId - ID da sessão
   * @returns {Object} Dados processados do áudio
   */
  processAudioData(audioData, sessionId) {
    if (!this.audioBuffer.has(sessionId)) {
      this.audioBuffer.set(sessionId, []);
    }

    const buffer = this.audioBuffer.get(sessionId);
    buffer.push(audioData);

    // Analisa frequências do áudio
    const frequencies = this.analyzeFrequencies(audioData);
    
    return {
      sessionId,
      frequencies,
      bufferSize: buffer.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Analisa frequências do áudio usando FFT simples
   * @param {Buffer} audioData - Dados de áudio
   * @returns {Array} Array de frequências normalizadas
   */
  analyzeFrequencies(audioData) {
    const samples = this.bufferToFloat32Array(audioData);
    const frequencies = new Array(64).fill(0);
    
    // Análise simples de frequências
    for (let i = 0; i < samples.length; i++) {
      const bin = Math.floor((i / samples.length) * frequencies.length);
      frequencies[bin] += Math.abs(samples[i]);
    }

    // Normaliza os valores
    const max = Math.max(...frequencies);
    if (max > 0) {
      for (let i = 0; i < frequencies.length; i++) {
        frequencies[i] = frequencies[i] / max;
      }
    }

    return frequencies;
  }

  /**
   * Converte Buffer para Float32Array
   * @param {Buffer} buffer - Buffer de áudio
   * @returns {Float32Array} Array de floats
   */
  bufferToFloat32Array(buffer) {
    const samples = new Float32Array(buffer.length / 2);
    for (let i = 0; i < samples.length; i++) {
      const sample = buffer.readInt16LE(i * 2);
      samples[i] = sample / 32768.0; // Normaliza para -1 a 1
    }
    return samples;
  }

  /**
   * Salva áudio em arquivo WAV
   * @param {string} sessionId - ID da sessão
   * @param {string} filename - Nome do arquivo
   * @returns {string} Caminho do arquivo salvo
   */
  saveAudioToFile(sessionId, filename) {
    const buffer = this.audioBuffer.get(sessionId);
    if (!buffer || buffer.length === 0) {
      throw new Error('No audio data to save');
    }

    const audioDir = path.join(__dirname, '../uploads/audio');
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    const filePath = path.join(audioDir, `${filename}.wav`);
    const wavData = this.createWavFile(Buffer.concat(buffer));
    
    fs.writeFileSync(filePath, wavData);
    return filePath;
  }

  /**
   * Cria arquivo WAV a partir dos dados de áudio
   * @param {Buffer} audioData - Dados de áudio
   * @returns {Buffer} Dados do arquivo WAV
   */
  createWavFile(audioData) {
    const header = Buffer.alloc(44);
    const dataSize = audioData.length;
    const fileSize = dataSize + 36;

    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(fileSize, 4);
    header.write('WAVE', 8);

    // fmt chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // fmt chunk size
    header.writeUInt16LE(1, 20);  // audio format (PCM)
    header.writeUInt16LE(1, 22);  // number of channels
    header.writeUInt32LE(this.sampleRate, 24); // sample rate
    header.writeUInt32LE(this.sampleRate * 2, 28); // byte rate
    header.writeUInt16LE(2, 32);  // block align
    header.writeUInt16LE(16, 34); // bits per sample

    // data chunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, audioData]);
  }

  /**
   * Limpa buffer de áudio de uma sessão
   * @param {string} sessionId - ID da sessão
   */
  clearSessionBuffer(sessionId) {
    this.audioBuffer.delete(sessionId);
  }

  /**
   * Obtém estatísticas do áudio de uma sessão
   * @param {string} sessionId - ID da sessão
   * @returns {Object} Estatísticas do áudio
   */
  getSessionStats(sessionId) {
    const buffer = this.audioBuffer.get(sessionId);
    if (!buffer) {
      return { duration: 0, samples: 0, size: 0 };
    }

    const totalSamples = buffer.reduce((acc, chunk) => acc + chunk.length / 2, 0);
    const duration = totalSamples / this.sampleRate;
    const size = buffer.reduce((acc, chunk) => acc + chunk.length, 0);

    return {
      duration: Math.round(duration * 100) / 100,
      samples: totalSamples,
      size: size
    };
  }
}

module.exports = AudioProcessor;
