# NewGenST — Gestão Inteligente de Estoque

Sistema fullstack de controle de estoque por **código de barras individual de cada item**, construído com **Next.js (App Router)**, **TypeScript**, **Tailwind CSS** e **PostgreSQL (Drizzle ORM)**.

---

## Como colocar o NewGenST online pelo GitHub (Passo a Passo Gratuito)

> **Importante:** O *GitHub Pages* tradicional serve apenas para páginas HTML estáticas (sem servidor ou banco de dados PostgreSQL). Como o **NewGenST** possui rotas de API e banco de dados real compartilhado entre dispositivos, a forma padrão, gratuita e automática de colocá-lo no ar pelo GitHub é **subir o código para o GitHub** e conectá-lo à **Vercel** com um banco **Neon PostgreSQL**.

### Passo 1 — Subir o projeto para o seu GitHub

1. Crie uma conta (ou entre) em [github.com](https://github.com) e clique em **New repository**.
2. Dê o nome de `newgenst` e clique em **Create repository** (sem marcar README, pois o projeto já possui).
3. Na pasta do projeto no seu computador, abra o terminal e execute:

```bash
git init
git add .
git commit -m "Primeira versao do NewGenST"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/newgenst.git
git push -u origin main
```

*(O arquivo `.gitignore` já está configurado para proteger o seu `.env` e ignorar `node_modules`.)*

---

### Passo 2 — Criar o banco PostgreSQL gratuito na nuvem (Neon)

1. Acesse [neon.tech](https://neon.tech) (você pode entrar direto com sua conta do GitHub, plano gratuito).
2. Crie um novo projeto (ex.: `newgenst-db`).
3. Copie a **Connection String** fornecida pelo painel (ela começa com `postgresql://...` e termina com `?sslmode=require`).

---

### Passo 3 — Publicar automaticamente na Vercel conectado ao GitHub

1. Acesse [vercel.com](https://vercel.com) e clique em **Continue with GitHub**.
2. Clique em **Add New... → Project** e selecione o repositório **`newgenst`** do seu GitHub.
3. Antes de clicar em Deploy, abra a seção **Environment Variables** e adicione:
   - **Key (Nome):** `DATABASE_URL`
   - **Value (Valor):** cole a URL `postgresql://...` que você copiou no Passo 2.
4. Clique em **Deploy**.

Pronto! Em cerca de 1 minuto a Vercel vai gerar o seu link público `https://newgenst.vercel.app` (acessível no celular para usar a câmera e também no computador):
- **Criação automática das tabelas:** No primeiro acesso ao site, o **NewGenST** cria todas as tabelas no PostgreSQL automaticamente (`bancos_itens`, `itens_individuais`, `movimentacoes`, `confirmacoes_etapas` e `operadores`).
- **Atualização contínua:** Sempre que você alterar algo no código e fizer `git push` para o GitHub, o site online atualiza sozinho!

---

## Como rodar localmente no seu computador

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Copie `.env.example` para `.env` e preencha sua `DATABASE_URL`.
3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
4. Acesse `http://localhost:3000`.
