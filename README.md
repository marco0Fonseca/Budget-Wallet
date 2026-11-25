# Budget-Wallet

O **BudgetWallet** é uma aplicação web de controle e planejamento financeiro pessoal, desenvolvida como projeto da disciplina de **Engenharia de Software** da Universidade Federal de São Paulo, no segundo semestre de 2026.

O sistema tem como objetivo ajudar usuários a organizar sua vida financeira por meio do registro de receitas, despesas, gastos recorrentes, assinaturas e investimentos, além de oferecer dashboards e recursos de previsão financeira.

O projeto também contará com um **agente de IA** para auxiliar no registro de movimentações e na interpretação das informações financeiras do usuário.

## Funcionalidades

| Funcionalidade | Estado atual |
| --- | --- |
| Cadastro, login e logout | Implementados localmente. A recuperação de senha ainda é provisória: não comprova a posse da conta. |
| Categorias e subcategorias | Consulta, criação, edição e exclusão condicionada aos vínculos implementadas pela API. |
| Receitas e despesas | Cadastro, consulta por período, edição, exclusão, filtros e totais implementados pela API. |
| Dashboard | Totais do mês, gráfico de seis meses, despesas por categoria principal, últimas transações e resumo de investimentos alimentados pela API. |
| Investimentos | Cadastro, consulta, edição, exclusão e projeções estimadas implementados pela API. |
| Planejamento diário | Prévia visual; regras e persistência ainda não implementadas. |
| Assistente de IA | Botão e painel visuais; sem integração com IA. |
| Recorrências, assinaturas e previsão financeira avançada | Planejadas para incrementos posteriores. |

**Produção:** nenhuma funcionalidade está confirmada como publicada. A estratégia de hospedagem e a persistência após reinício ou redeploy ainda precisam ser validadas em BW-08. A recuperação provisória de senha deve ser substituída antes de uso compartilhado ou real.

## Stack

Stack utilizada até agora:

| Parte | Tecnologia em uso |
| --- | --- |
| Frontend | React, React DOM, TypeScript e Vite |
| API | Node.js, Express, TypeScript e CORS |
| Autenticação | bcrypt para hash de senha e JSON Web Token (`jsonwebtoken`) |
| Persistência | Prisma Client e migrations, adapter `@prisma/adapter-better-sqlite3` e SQLite |
| Verificação | `node:test`, `node:assert/strict` e TypeScript |

A Vercel foi considerada como opção de hospedagem, mas não integra uma publicação validada. A escolha de hospedagem e banco para produção permanece em BW-08.

O frontend usa React com Vite e o backend HTTP usa Express, executado em Node.js. Login, cadastro e recuperação provisória de senha já se comunicam com a API. Após o login, a área autenticada oferece navegação lateral para Dashboard, Transações, Categorias, Investimentos e Planejamento diário. Dashboard, Categorias, Transações e Investimentos usam dados da conta pela API. O Planejamento diário ainda usa uma prévia local. O chat de IA é apenas visual. A escolha do Express está registrada em [ADR 0003](docs/decisions/0003-express-backend.md).

## Status

🚧 **Em desenvolvimento**

## Ambiente de desenvolvimento e testes

Use Node.js 22.19+ da linha 22 e npm. Na raiz do projeto, instale as dependências:

```sh
npm ci
```

| Comando | Finalidade |
| --- | --- |
| `npm test` | Testes automatizados. |
| `npm run test:watch` | Testes em modo de observação. |
| `npm run typecheck` | Tipos do backend e dos testes. |
| `npm run typecheck:frontend` | Tipos do frontend. |
| `npm run check` | Todos os tipos e testes. |
| `npm run dev:frontend` | Servidor de desenvolvimento React/Vite. |
| `npm run build:frontend` | Build do frontend. |

No PowerShell, caso a política de execução bloqueie `npm.ps1`, use `npm.cmd` nos comandos acima.

Os testes ficam em `tests/*.test.ts` e usam `node:test`; testes de persistência usam SQLite temporário. `npm run check` verifica tipos e testes antes da entrega. O backend e os testes usam o `tsconfig.json` da raiz; o frontend usa `frontend/tsconfig.json`.

Para abrir a aplicação, copie `.env.example` para `.env`, defina um `JWT_SECRET` privado e aplique as migrations conforme a seção abaixo. Depois, execute em terminais separados:

```sh
node --env-file=.env src/server/server.ts
npm run dev:frontend
```

O Express usa a porta 5000. O Vite mostra a URL do frontend no terminal. Após o login, o JWT fica na sessão do navegador e acompanha as requisições financeiras como `Authorization: Bearer <token>`.

| Tela | Dados obtidos da API |
| --- | --- |
| Dashboard | `GET /api/dashboard?month=YYYY-MM` e `GET /api/investments`. |
| Categorias | Consulta, criação, edição e exclusão em `/api/categories`. |
| Transações | Consulta por mês ou todo o período, criação, edição e exclusão em `/api/transactions`. |
| Investimentos | Consulta, criação, edição e exclusão em `/api/investments`; categorias em `/api/categories`. |

Cadastro, login e recuperação provisória usam `/api/auth`. O Planejamento diário e o chat de IA ainda são prévias visuais. Consulte [Autenticação e JWT](docs/AUTHENTICATION.md) para o contrato do token e a limitação da recuperação de senha.

## Banco local e migrations

O Prisma usa SQLite. O banco local padrão é `dev.db`, ignorado pelo Git; ajuste `DATABASE_URL` em `.env` se precisar de outro arquivo. Para aplicar as migrations:

```sh
npm run db:deploy
```

Após mudar o schema, crie uma migration com `npm run db:migrate -- --name nome_da_alteracao` e gere o Prisma Client:

```sh
npx prisma generate --config prisma.config.ts
```

Migrations ficam em `prisma/migrations/`; o client gerado em `src/generated/prisma/` não é versionado. Para conferir o schema ou o estado das migrations, use `npm run db:validate` ou `npm run db:status`. Os testes de integração usam bancos temporários, separados de `dev.db`.

## Planejamento

O [backlog inicial](docs/BACKLOG.md) organiza os primeiros incrementos, os critérios de aceite e uma proposta de modelagem de dados e estrutura do código. Ele será refinado conforme as entregas e o feedback da equipe.

O [fluxo do usuário](docs/USER-FLOW.md) descreve a navegação e as interações. As [regras de negócio](docs/BUSINESS-RULES.md) centralizam validações, cálculos e regras do domínio. Ambos serão atualizados durante o desenvolvimento.

## Desenvolvedor

Marco Antônio Pereira Alves Fonseca

## Licença

Este projeto possui finalidade acadêmica.
