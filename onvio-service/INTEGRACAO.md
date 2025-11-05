# Guia de Integração - Serviço Onvio

Este documento explica como integrar o serviço Onvio separado ao seu sistema.

## 🎯 Opções de Integração

### Opção 1: Desenvolvimento Local (Recomendado para testar)

1. **Inicie o serviço Onvio:**
```bash
cd onvio-service
npm install
npm start
# Serviço rodará em http://localhost:3001
```

2. **O frontend já está configurado:**
   - O código detecta automaticamente endpoints `/gestao/onvio/*`
   - Redireciona para `http://localhost:3001` automaticamente
   - Não precisa fazer nada adicional!

3. **Teste:**
   - Acesse a página de atividades de uma obrigação
   - Clique no botão de busca automática para integração Onvio
   - A requisição será feita para o serviço separado

### Opção 2: Produção (Hospedagem Separada)

#### Configuração no Frontend

Crie um arquivo `.env.local` no diretório `frontend/`:

```env
NEXT_PUBLIC_ONVIO_SERVICE_URL=https://onvio-service.seu-dominio.com
```

Ou configure na variável de ambiente do seu servidor de hospedagem.

#### Configuração no Servidor

1. **Hospede o serviço Onvio separadamente:**
   - Pode ser em outro servidor, container Docker, ou mesmo servidor mas porta diferente
   - Configure o `.env` do serviço Onvio com as credenciais do banco

2. **Certifique-se que o JWT_SECRET é o mesmo:**
   - O serviço Onvio precisa do mesmo `JWT_SECRET` do backend principal
   - Isso garante que os tokens sejam válidos

3. **Acesso ao banco de dados:**
   - O serviço Onvio precisa acessar o mesmo banco de dados
   - Configure as variáveis `DB_*` no `.env` do serviço

### Opção 3: Usar Proxy Reverso (Nginx)

Se quiser manter a mesma URL para o frontend, configure um proxy reverso:

```nginx
# nginx.conf
location /api/gestao/onvio {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

Neste caso, você NÃO precisa configurar `NEXT_PUBLIC_ONVIO_SERVICE_URL`, pois o proxy faz o roteamento automaticamente.

## ✅ Quando Usar Cada Opção

- **Desenvolvimento Local**: Use a Opção 1 (já configurado, funciona automaticamente)
- **Produção Simples**: Use a Opção 2 (configure a variável de ambiente)
- **Produção Avançada**: Use a Opção 3 (proxy reverso para URL única)

## 🧪 Testando a Integração

1. Inicie o serviço Onvio:
```bash
cd onvio-service
npm start
```

2. Verifique se está rodando:
```bash
curl http://localhost:3001/health
# Deve retornar: {"status":"ok","service":"onvio-service",...}
```

3. Teste no frontend:
   - Acesse uma página que use integração Onvio
   - Verifique no console do navegador (F12) qual URL está sendo chamada
   - Deve aparecer `http://localhost:3001/api/gestao/onvio/...`

## ⚠️ Importante

- O serviço Onvio precisa do mesmo banco de dados do backend principal
- O `JWT_SECRET` deve ser o mesmo em ambos os serviços
- Em produção, configure CORS se necessário (já está configurado por padrão)

