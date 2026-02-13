# RestoBar SaaS

Sistema web estatico (PWA) para controle de restaurante/bar.

## Build local

```bash
npm install
npm run dev
npm run build
```

A pasta de saida sera `dist/`.

## Deploy no Cloudflare Pages

Use estas configuracoes no projeto Pages:

- Framework preset: `None`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/` (raiz do repositorio)

## Supabase

Projeto configurado:

- Project ID: `fquiicsdvjqzrbeiuaxo`
- URL: `https://fquiicsdvjqzrbeiuaxo.supabase.co`

Para ativar a sincronizacao em nuvem, execute no SQL Editor:

- `supabase/schema.sql`

## Logins de teste

- Admin: `admin` / `admin`
- Garcom: `user` / `user`
- Cozinheiro: `cook` / `cook`
