# Babaquinha Counter

Um contador simples de babaquinha, deployável no Cloudflare Workers.

## Deploy no Cloudflare Workers

### Pré-requisitos

1. Conta no Cloudflare
2. Node.js instalado (versão 16 ou superior)

### Passos para deploy

1. **Instalar dependências:**
   ```bash
   npm install
   ```

2. **Login no Cloudflare:**
   ```bash
   npx wrangler login
   ```

3. **Configurar Account ID (opcional):**
   - Acesse o Cloudflare Dashboard
   - Copie seu Account ID
   - Edite `wrangler.toml` e adicione: `account_id = "seu-account-id"`

4. **Deploy:**
   ```bash
   npm run deploy
   ```

### Desenvolvimento local

Para testar localmente antes do deploy:

```bash
npm run dev
```

Isso iniciará um servidor local em `http://localhost:8787`

## Arquivos importantes

- `worker.js` - Script principal do Cloudflare Worker
- `wrangler.toml` - Configuração do Cloudflare Workers
- `package.json` - Dependências e scripts npm
- `index.html` - HTML original (mantido para referência)

## Licença

MIT
