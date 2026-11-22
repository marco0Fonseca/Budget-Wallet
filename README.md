# Budget-Wallet

O **BudgetWallet** é uma aplicação web de controle e planejamento financeiro pessoal, desenvolvida como projeto da disciplina de **Engenharia de Software** da Universidade Federal de São Paulo, no segundo semestre de 2026.

O sistema tem como objetivo ajudar usuários a organizar sua vida financeira por meio do registro de receitas, despesas, gastos recorrentes, assinaturas e investimentos, além de oferecer dashboards e recursos de previsão financeira.

O projeto também contará com um **agente de IA** para auxiliar no registro de movimentações e na interpretação das informações financeiras do usuário.

## Funcionalidades

Entre as principais funcionalidades previstas estão:

- Registro de receitas e despesas;
- Categorização de gastos;
- Cadastro de despesas recorrentes;
- Controle de assinaturas;
- Cadastro e acompanhamento de investimentos;
- Planejamento financeiro mensal;
- Previsão de gastos futuros;
- Dashboards para visualização de dados financeiros;
- Histórico de movimentações;
- Agente de IA para auxiliar no registro e consulta de informações financeiras.

## Stack

O projeto será desenvolvido utilizando:

- **TypeScript**
- **React**
- **Express** (backend HTTP)
- **Prisma**
- **SQLite**
- **Node.js / npm**
- **Vercel**

O frontend usa React com Vite e o backend HTTP será Express, executado em Node.js. A tela de login e uma página de destino vazia já funcionam localmente; a integração HTTP e o restante da aplicação continuam em BW-15. A escolha do Express está registrada em [ADR 0003](docs/decisions/0003-express-backend.md).

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

No PowerShell, caso a política de execução bloqueie `npm.ps1`, use `npm.cmd` nos comandos acima.

Crie testes `tests/*.test.ts` com `node:test` e `node:assert/strict`. Antes de entregar alterações, execute `npm run check` para validar tipos e testes. Use imports relativos com `.ts`, `import type` e sintaxe compatível com `erasableSyntaxOnly`.

Os testes cobrem ferramentas locais, entidades, schema e persistência dos repositórios em SQLite temporário. O `tsconfig.json` da raiz cobre backend, testes e scripts Prisma; `frontend/tsconfig.json` cobre a interface. O servidor HTTP ainda será configurado.

Para ver a tela de login, execute `npm run dev:frontend` e abra o endereço exibido pelo Vite. No ambiente local, qualquer identificador e senha não vazios permitem entrar na página vazia do Dashboard. O acesso demonstrativo não valida credenciais, não cria conta e não salva a senha. Os controles **Criar conta** e **Esqueceu a senha?** mostram estados informativos; cadastro e recuperação ainda não enviam dados. Os painéis financeiros do login usam valores fictícios e são apenas ilustrações. O acesso demonstrativo fica indisponível no build de produção até a autenticação real ser implementada.

## Automação de navegador

O Playwright CLI está instalado como dependência local. Inicialize o workspace uma vez com `npx playwright cli install`; `.playwright-cli/` fica ignorado pelo Git. Para abrir uma página local e inspecioná-la:

```sh
npx playwright cli open http://localhost:3000
npx playwright cli snapshot
npx playwright cli close
```

Consulte os comandos disponíveis com `npx playwright cli --help`.

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

O adapter SQLite, a conexão e os repositórios de usuário, categorias, movimentações e investimentos já estão configurados. Os testes de integração usam bancos SQLite temporários. O catálogo de categorias padrão está em `src/entities/transactions/defaultCategories.ts`; ele ainda será integrado ao fluxo de criação de conta. Decisões de IDs, timestamps e relações estão em [Persistência inicial](docs/decisions/0001-initial-persistence.md) e [exclusão de usuário](docs/decisions/0002-user-deletion.md).

## Planejamento

O [backlog inicial](docs/BACKLOG.md) organiza os primeiros incrementos, os critérios de aceite e uma proposta de modelagem de dados e estrutura do código. Ele será refinado conforme as entregas e o feedback da equipe.

O [fluxo do usuário](docs/USER-FLOW.md) descreve a navegação e as interações. As [regras de negócio](docs/BUSINESS-RULES.md) centralizam validações, cálculos e regras do domínio. Ambos serão atualizados durante o desenvolvimento.

## Equipe

Bernardo Friske de Souza
Gustavo Guardia dos Santos Prado
Marco Antônio Pereira Alves Fonseca

## Licença

Este projeto possui finalidade acadêmica.
