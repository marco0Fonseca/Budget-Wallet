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
| Verificação | `node:test`, `node:assert/strict`, TypeScript e Playwright CLI para inspeção no navegador |

A Vercel foi considerada como opção de hospedagem, mas não integra uma publicação validada. A escolha de hospedagem e banco para produção permanece em BW-08.

O frontend usa React com Vite e o backend HTTP usa Express, executado em Node.js. Login, cadastro e recuperação provisória de senha já se comunicam com a API. Após o login, a área autenticada oferece navegação lateral para Dashboard, Transações, Categorias, Investimentos e Planejamento diário. Dashboard, Categorias, Transações e Investimentos usam dados da conta pela API. O Planejamento diário ainda usa uma prévia local. O chat de IA é apenas visual. A escolha do Express está registrada em [ADR 0003](docs/decisions/0003-express-backend.md).

## Status

🚧 **Em desenvolvimento**

## Ambiente de desenvolvimento e testes

Use Node.js 22.19 ou uma versão posterior da linha 22 (referência em `.nvmrc`) e npm. As ferramentas são dependências locais do projeto; instalações globais de TypeScript ou `ts-node` não são necessárias.

Na raiz, instale as versões do lockfile:

```sh
npm ci
```

| Comando | Finalidade |
| --- | --- |
| `npm test` | Executar os testes com o executor nativo `node:test`. |
| `npm run test:watch` | Reexecutar os testes ao alterar os arquivos; encerrar com Ctrl+C. |
| `npm run typecheck` | Verificar tipos TypeScript sem gerar arquivos JavaScript. |
| `npm run check` | Verificar tipos e, se passarem, executar os testes. |
| `npm run dev:frontend` | Abrir o frontend local em modo de desenvolvimento. |
| `npm run build:frontend` | Gerar o build do frontend em `dist/frontend/`. |
| `npm run db:deploy` | Aplicar as migrations versionadas no banco configurado. |

No PowerShell, caso a política de execução bloqueie `npm.ps1`, use `npm.cmd` nos comandos acima.

Crie testes `tests/*.test.ts` com `node:test` e `node:assert/strict`. Antes de entregar alterações, execute `npm run check` para validar tipos e testes. Use imports relativos com `.ts`, `import type` e sintaxe compatível com `erasableSyntaxOnly`.

Os testes cobrem ferramentas locais, entidades, schema e persistência dos repositórios em SQLite temporário. O `tsconfig.json` da raiz cobre backend, testes e scripts Prisma; `frontend/tsconfig.json` cobre a interface. O servidor Express está em desenvolvimento; consulte [Autenticação e JWT](docs/AUTHENTICATION.md) para a configuração e o contrato do token.

Para executar a aplicação localmente, copie `.env.example` para `.env`, substitua `JWT_SECRET` por um segredo privado (consulte [Autenticação e JWT](docs/AUTHENTICATION.md)) e execute os comandos em terminais separados:

```sh
npm run db:deploy
node --env-file=.env src/server/server.ts
npm run dev:frontend
```

O servidor Express usa a porta 5000; o Vite informa a URL local do frontend no terminal. Login, cadastro e recuperação provisória usam as rotas de autenticação; no login bem-sucedido, a interface mantém o JWT na sessão do navegador. A Dashboard consulta `GET /api/dashboard?month=YYYY-MM` para totais, gráfico mensal, despesas por categoria e últimos lançamentos, e `GET /api/investments` para o resumo dos investimentos. A tela de Categorias usa `GET/POST /api/categories`, `PATCH /api/categories/:id`, `GET /api/categories/:id/deletion-status` e `DELETE /api/categories/:id`. A tela de Transações usa `GET/POST /api/transactions`, `PATCH /api/transactions/:id` e `DELETE /api/transactions/:id`; a consulta aceita `month=YYYY-MM` ou todo o período sem `month`. A tela de Investimentos usa `GET/POST /api/investments`, `PATCH /api/investments/:id` e `DELETE /api/investments/:id`, além da consulta de categorias. As rotas financeiras exigem `Authorization: Bearer <token>`. O Planejamento diário ainda usa uma prévia local; o chat de IA é apenas visual. Os painéis financeiros do login são ilustrações.

## Automação de navegador

O Playwright CLI está instalado como dependência local. Inicialize o workspace uma vez com `npx playwright cli install`; `.playwright-cli/` fica ignorado pelo Git. Para abrir uma página local e inspecioná-la:

```sh
npx playwright cli open http://localhost:5173
npx playwright cli snapshot
npx playwright cli close
```

Use a URL mostrada pelo Vite caso a porta seja diferente. Consulte os comandos disponíveis com `npx playwright cli --help`.

## Banco local e migrations

O schema Prisma usa SQLite e acompanha as quatro entidades iniciais. Para criar ou atualizar o banco local com as migrations versionadas, execute na raiz:

```sh
npm run db:validate
npm run db:deploy
npm run db:status
```

O banco padrão é `dev.db` na raiz, ignorado pelo Git. Para mudar a conexão, copie `.env.example` para `.env` e ajuste `DATABASE_URL`. Para futuras alterações no schema, use `npm run db:migrate -- --name nome_da_alteracao` em um banco de desenvolvimento.

Prisma Client é gerado em `src/generated/prisma/`, pasta local ignorada pelo Git. Após instalar as dependências e alterar o schema, gere o cliente com:

```sh
npx prisma generate --config prisma.config.ts
```

O adapter SQLite, a conexão e os repositórios de usuário, categorias, movimentações e investimentos já estão configurados. Os testes de integração usam bancos SQLite temporários. O catálogo de categorias padrão está em `src/entities/transactions/defaultCategories.ts` e é copiado para o usuário no fluxo de cadastro. Decisões de IDs, timestamps e relações estão em [Persistência inicial](docs/decisions/0001-initial-persistence.md) e [exclusão de usuário](docs/decisions/0002-user-deletion.md).

## Planejamento

O [backlog inicial](docs/BACKLOG.md) organiza os primeiros incrementos, os critérios de aceite e uma proposta de modelagem de dados e estrutura do código. Ele será refinado conforme as entregas e o feedback da equipe.

O [fluxo do usuário](docs/USER-FLOW.md) descreve a navegação e as interações. As [regras de negócio](docs/BUSINESS-RULES.md) centralizam validações, cálculos e regras do domínio. Ambos serão atualizados durante o desenvolvimento.

## Desenvolvedor

Marco Antônio Pereira Alves Fonseca

## Licença

Este projeto possui finalidade acadêmica.
