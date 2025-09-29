# Dockerfile para o projeto Front-Aura8 (Next.js)
# Baseado no Node.js 18 Alpine para otimização de tamanho
FROM node:18-alpine AS base

# Instalar dependências necessárias para o Alpine
RUN apk add --no-cache libc6-compat

# Definir diretório de trabalho
WORKDIR /app

# ===========================================
# STAGE 1: Dependencies
# ===========================================
FROM base AS deps

# Copiar arquivos de dependências
COPY package.json package-lock.json* ./

# Instalar todas as dependências (incluindo devDependencies para o build)
RUN npm ci --ignore-scripts && npm cache clean --force

# ===========================================
# STAGE 2: Builder
# ===========================================
FROM base AS builder

# Copiar dependências instaladas
COPY --from=deps /app/node_modules ./node_modules

# Copiar código fonte
COPY . .

# Garantir que o diretório public existe e tem conteúdo
RUN mkdir -p ./public && \
    if [ ! -f "./public/.gitkeep" ]; then touch ./public/.gitkeep; fi

# Configurar variáveis de ambiente para build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build da aplicação
RUN npm run build

# ===========================================
# STAGE 3: Runner
# ===========================================
FROM base AS runner

# Configurar ambiente de produção
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Criar usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar arquivos públicos
RUN mkdir -p ./public
COPY --from=builder /app/public ./public

# Copiar build standalone do Next.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Mudar para usuário não-root
USER nextjs

# Expor porta
EXPOSE 3000

# Configurar variáveis de ambiente
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Comando para iniciar a aplicação
CMD ["node", "server.js"]
