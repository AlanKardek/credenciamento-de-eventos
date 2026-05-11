# Sistema de Credenciamento de Eventos

## Tecnologias
- Node.js
- Prisma
- PostgreSQL

Frontend: Next.js
Backend: Express
ORM: Prisma
Runtime: Node.js

## Como rodar
No backend, crie uma variavel `DATABASE_URL` com uma URL PostgreSQL.

Local:
```bash
cd backend
npm install
npx prisma migrate dev
npm run dev
```

Render:
- Root Directory: `backend`
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Environment Variables:
  - `DATABASE_URL`: URL interna do PostgreSQL no Render, comecando com `postgresql://` ou `postgres://`
  - `JWT_SECRET`: um segredo forte para assinar login
