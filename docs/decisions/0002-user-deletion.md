# 0002 — Exclusão de usuário em cascata

## Contexto

Em 20/11/2026, foi definido que excluir uma conta deve remover suas categorias, subcategorias, transações e investimentos. Esta decisão substitui a restrição de exclusão do usuário descrita na decisão 0001.

## Decisão

- As relações diretas com `User` usam `onDelete: Cascade`.
- As relações entre categorias e entre categoria e movimentações usam `onDelete: NoAction`. No SQLite, isso permite concluir a cascata do usuário antes da verificação das referências, sem o bloqueio imediato de `Restrict`.
- Excluir apenas uma categoria em uso continua proibido: não há cascata da categoria para as movimentações ou subcategorias.
- As chaves compostas com `userId` continuam impedindo vínculos entre proprietários diferentes.
- A alteração é entregue em uma nova migration, sem modificar as anteriores.

## Consequências e verificação

A exclusão da conta remove definitivamente todos os seus registros relacionados. A futura API deve obter a identidade da sessão e exigir confirmação no fluxo de exclusão. Este incremento implementa a regra de persistência, sem criar uma rota de exclusão de conta.

O teste de integração cria dois usuários com categorias, subcategoria, transação e investimento. Confirma a remoção completa de um deles, a preservação dos registros do outro e a rejeição da exclusão isolada de categorias em uso.
