# NewGenST — Gestão Inteligente de Estoque & Rastreamento de Dispositivos

Sistema fullstack de controle de estoque por **código de barras individual**, autenticação por **nome e senha** e controle de **retiradas/devoluções com data, hora e localização**, construído com **Next.js 16**, **TypeScript**, **Tailwind CSS** e **PostgreSQL (Drizzle ORM)**.

Já configurado nativamente tanto para **Cloudflare Workers (`npx wrangler deploy`)** quanto para **Vercel**.

---

## Opção 1 — Colocar no ar pela Cloudflare Workers & Pages (conectado ao GitHub)

### 1. Verifique a raiz do seu repositório no GitHub
Certifique-se de que os arquivos (`package.json`, `wrangler.jsonc`, `next.config.ts`, pasta `src/`, pasta `config/`) estejam **diretamente na raiz** do repositório no GitHub — e **não** dentro de uma subpasta (ex.: `meu-repo/pasta/package.json`).
*(Caso tenha subido dentro de uma subpasta, informe o nome dessa pasta no campo **Root directory** nas configurações de Build da Cloudflare.)*

### 2. Crie um banco PostgreSQL gratuito na nuvem (Neon)
1. Acesse [neon.tech](https://neon.tech) e entre com sua conta do GitHub.
2. Crie um projeto e copie a **Connection String** (`postgresql://...?sslmode=require`).

### 3. Configure na Cloudflare Workers & Pages
1. No painel da Cloudflare, vá em **Compute (Workers) → Workers & Pages → Create → Import a repository** e selecione seu repositório do GitHub.
2. Em **Build configuration**:
   - **Build command:** pode deixar em branco (o `wrangler.jsonc` já executa o build do OpenNext automaticamente) ou usar `npx opennextjs-cloudflare build --openNextConfigPath=config/open-next.config.ts`
   - **Deploy command:** `npx wrangler deploy`
3. Após criar (ou em **Settings → Variables and Secrets** do seu Worker), adicione as variáveis:
   - **`DATABASE_URL`** *(Secret)*: cole a URL `postgresql://...` do seu banco Neon/Supabase.
   - **`AUTH_SECRET`** *(Secret — opcional)*: uma frase secreta longa para assinatura dos logins.

No primeiro acesso ao site publicado, o **NewGenST** criará automaticamente todas as tabelas no PostgreSQL!

---

## Opção 2 — Colocar no ar pela Vercel (conectado ao GitHub)

1. Acesse [vercel.com](https://vercel.com), clique em **Add New... → Project** e importe seu repositório do GitHub.
2. Em **Environment Variables**, adicione `DATABASE_URL` com sua URL do PostgreSQL (Neon/Supabase).
3. Clique em **Deploy**.

---

## Rodando localmente

```bash
npm install
npm run dev
```
Acesse `http://localhost:3000`.
