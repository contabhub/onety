# Serviço Onvio

Serviço de integração com a Onvio via automação web. Este serviço pode ser hospedado separadamente do backend principal.

## 📋 Pré-requisitos

- Node.js 18+
- MySQL/MariaDB
- Acesso ao banco de dados principal
- Credenciais da Onvio configuradas

## 🚀 Instalação

1. Instale as dependências:
```bash
npm install
```

2. Configure as variáveis de ambiente criando um arquivo `.env`:
```env
# Banco de Dados
DB_HOST=localhost
DB_PORT=3306
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=nome_do_banco

# JWT
JWT_SECRET=seu_jwt_secret

# Porta do Serviço
PORT=3001
```

## 🏃 Executar

### Desenvolvimento
```bash
npm run dev
```

### Produção
```bash
npm start
```

## 📡 Endpoints

### Health Check
- `GET /health` - Verifica se o serviço está rodando

### API Principal
- `POST /api/gestao/onvio/baixar-atividades` - Baixar atividades automaticamente
- `POST /api/gestao/onvio/configurar-credenciais` - Configurar credenciais da Onvio
- `GET /api/gestao/onvio/gerar-codigo/:empresaId` - Gerar código TOTP
- `POST /api/gestao/onvio/buscar-automatico-por-cnpj` - Busca automática por CNPJ
- `POST /api/gestao/onvio/teste-extracao-base64` - Teste de extração base64

## 🔐 Autenticação

Todos os endpoints (exceto `/health` e `/`) requerem autenticação via JWT no header:
```
Authorization: Bearer <token>
```

## 🐳 Docker

Para hospedar separadamente, você pode usar Docker:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## 📦 Estrutura

```
onvio-service/
├── src/
│   ├── config/
│   │   └── database.js       # Configuração do banco de dados
│   ├── middlewares/
│   │   └── auth.js           # Middleware de autenticação
│   ├── routes/
│   │   └── onvioRoutes.js    # Rotas da API
│   ├── services/
│   │   └── onvioService.js   # Serviço principal de integração
│   └── server.js             # Servidor Express
├── package.json
└── README.md
```

## 🔄 Integração com Frontend

O frontend já está configurado para detectar automaticamente endpoints Onvio e direcionar para este serviço.

### Configuração no Frontend

1. **Desenvolvimento Local:**
   - O frontend já está configurado para usar `http://localhost:3001` por padrão
   - Basta iniciar o serviço Onvio na porta 3001

2. **Produção:**
   - Configure a variável de ambiente `NEXT_PUBLIC_ONVIO_SERVICE_URL` no frontend
   - Exemplo: `NEXT_PUBLIC_ONVIO_SERVICE_URL=https://onvio-service.seu-dominio.com`

### Como Funciona

O frontend detecta automaticamente quando uma requisição é para `/gestao/onvio/*` e direciona para o serviço Onvio separado. Exemplo:

```javascript
// Frontend faz requisição para:
POST /gestao/onvio/buscar-automatico-por-cnpj

// O código automaticamente redireciona para:
POST http://localhost:3001/api/gestao/onvio/buscar-automatico-por-cnpj
```

## 🔄 Integração com Backend Principal

Para integrar este serviço ao backend principal, você pode:

1. **Proxy reverso** (recomendado): Configure um nginx ou similar para rotear `/api/gestao/onvio` para este serviço
2. **API Gateway**: Use um API Gateway para rotear as requisições
3. **Chamadas HTTP**: Modifique o backend principal para fazer chamadas HTTP para este serviço

## ⚠️ Notas Importantes

- Este serviço precisa acessar o mesmo banco de dados do backend principal
- O JWT_SECRET deve ser o mesmo do backend principal para autenticação funcionar
- O serviço usa Puppeteer para automação web, então requer recursos adequados no servidor

## 📝 Licença

ISC

