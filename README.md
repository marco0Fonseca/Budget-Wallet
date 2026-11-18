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
- **Prisma**
- **SQLite**
- **Node.js / npm**
- **Vercel**

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

No PowerShell, caso a política de execução bloqueie `npm.ps1`, use `npm.cmd` nos comandos acima.

Crie testes `tests/*.test.ts` com `node:test` e `node:assert/strict`. Antes de entregar alterações, execute `npm run check` para validar tipos e testes. Use imports relativos com `.ts`, `import type` e sintaxe compatível com `erasableSyntaxOnly`.

O teste inicial valida apenas as ferramentas locais. O `tsconfig.json` cobre backend, testes e scripts Prisma; frontend, banco, build e servidor ainda serão configurados.

## Planejamento

O [backlog inicial](docs/BACKLOG.md) organiza os primeiros incrementos, os critérios de aceite e uma proposta de modelagem de dados e estrutura do código. Ele será refinado conforme as entregas e o feedback da equipe.

O [fluxo do usuário](docs/USER-FLOW.md) descreve a navegação e as interações. As [regras de negócio](docs/BUSINESS-RULES.md) centralizam validações, cálculos e regras do domínio. Ambos serão atualizados durante o desenvolvimento.

## Equipe

Bernardo Friske de Souza
Gustavo Guardia dos Santos Prado
Marco Antônio Pereira Alves Fonseca

## Licença

Este projeto possui finalidade acadêmica.
