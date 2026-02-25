# RestoBar SaaS

Sistema web estatico (PWA) para controle de restaurante/bar.

## Build local

```bash
npm install
npm run dev
npm run build
```

A pasta de saida sera `dist/`.

## Impressao instantanea da cozinha (QZ Tray)

Para imprimir automaticamente sem abrir dialogo:

1. Instale e deixe o QZ Tray aberto no computador que envia para a impressora da cozinha.
2. Entre como admin no painel `Monitor em Tempo Real`.
3. Em `Impressora da cozinha`, ative `Habilitar impressao direta (sem dialogo)`.
4. Informe o nome exato da impressora (opcional; se vazio usa a impressora padrao).
5. Clique em `Imprimir teste`.

Se a impressao direta falhar, o sistema faz fallback para popup de impressao do navegador.

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
