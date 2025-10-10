# ===========================================
# Dockerfile para Backend Onety
# ===========================================
# Imagem base: Node.js 20 LTS sobre Debian
FROM node:20-bullseye-slim

# Definir diretório de trabalho
WORKDIR /app

# Instalar dependências do sistema necessárias para:
# - Puppeteer/Chromium
# - Canvas (node-canvas)
# - Outras bibliotecas nativas
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    libpixman-1-0 \
    libcairo-gobject2 \
    libpangoft2-1.0-0 \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências do Node.js
# - Usar cache do npm para acelerar builds
# - Limpar cache após instalação
RUN npm ci --only=production \
    && npm cache clean --force

# Copiar todo o código fonte
COPY . .

# Criar diretórios necessários para uploads
RUN mkdir -p uploads/audio uploads/documents uploads/images

# Configurar permissões apropriadas
RUN chown -R node:node /app

# Usar usuário não-root por segurança
USER node

# Expor a porta da aplicação
EXPOSE 5000

# Variáveis de ambiente padrão (podem ser sobrescritas)
ENV NODE_ENV=production
ENV PORT=5000

# Healthcheck para verificar se o servidor está respondendo
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Comando para iniciar a aplicação
CMD ["npm", "start"]

