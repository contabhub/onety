FROM node:18-alpine

WORKDIR /app

# Copiar arquivos de dependência
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código fonte
COPY . .

# Expor porta
EXPOSE 3001

# Comando para iniciar o serviço
CMD ["npm", "start"]

