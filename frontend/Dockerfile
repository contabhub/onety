# Multi-stage build para otimizar a imagem final
FROM node:20-alpine AS base

# Instalar dependências apenas quando necessário
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copiar arquivos de dependência
COPY package.json package-lock.json* ./
RUN npm ci --only=production --ignore-scripts

# Builder: reconstruir o código quando necessário
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variáveis de ambiente necessárias para o build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build do Next.js
RUN npm run build

# Imagem de produção: copiar todos os arquivos e executar next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar arquivos públicos
COPY --from=builder /app/public ./public

# Copiar arquivos de build
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copiar arquivos necessários do builder
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Executar o servidor Next.js
CMD ["node", "server.js"]

