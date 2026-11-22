# 0001 — Persistência inicial em SQLite/Prisma

## Contexto

O schema inicial acompanha `User`, `TransactionCategory`, `Transaction` e `Investment`. A persistência usa Prisma 7 com adapter SQLite e client gerado localmente. Repositórios implementam criação, consultas, atualizações e exclusões no escopo das entidades; geração de ocorrências e autenticação real permanecem fora deste incremento.

## Decisão

- `User.id` é String com UUID padrão do Prisma; o repositório preserva IDs fornecidos pela entidade. As outras entidades usam `Int` autoincremental. O `-1` identifica entidades novas apenas em memória; os repositórios omitem esse ID ao criar e retornam entidades reconstruídas com o ID persistido.
- Timestamps em milissegundos usam `BigInt`. Os repositórios convertem `number` para `bigint` ao gravar e de volta para `number` ao ler. Não serializar `bigint` diretamente em JSON.
- Dinheiro usa `Int` em centavos; taxa mensal usa `Float`, coerente com a simulação atual. Métodos e resultados calculados não viram colunas.
- Categoria do lançamento/investimento é uma relação por `categoryId`, com chave estrangeira composta incluindo `userId`. A relação pai/filha também inclui tipo. Exclusões de registros referenciados são restritas.
- `email` e `username` são únicos por comparação exata do SQLite. Username minúsculo é validado na entidade; normalização definitiva de e-mail será refinada no cadastro.
- O schema usa enum Prisma para `TransactionType`, persistido como texto no SQLite. Não é o enum TypeScript incompatível com `erasableSyntaxOnly`.
- A conexão é configurada em `prisma.config.ts`, com `DATABASE_URL` opcional e banco local padrão `dev.db` na raiz. `.env`, banco e arquivos auxiliares não são versionados; schema, migrations e `.env.example` são versionados.

## Limites e próximos passos

A migration garante relações e unicidade de usuário. Validações de valores, formato de campos, tipo INVESTMENT, ausência de ciclos, profundidade de categorias e unicidade de labels normalizados não são todas expressas no schema e precisam ser garantidas pela camada de domínio/persistência antes de expor gravações. SQLite não garante o conjunto de valores de um enum Prisma por si só.

O catálogo de categorias padrão está em `src/entities/transactions/defaultCategories.ts`; todas as categorias iniciais são raízes. `TransactionCategoryRepository.createDefaultCategoriesForUser(userId)` persiste uma cópia individual e pode ser chamado pelo fluxo de criação da conta. Não há carga global de categorias compartilhadas. O Prisma Client é gerado em `src/generated/prisma/`, ignorado pelo Git e recriado com `npx prisma generate --config prisma.config.ts`. Testes de integração aplicam migrations em bancos SQLite temporários; testes do schema também exercitam o SQL em memória, sem usar `dev.db`.

Revisar esta decisão ao refinar regras de identidade ou escolher o ambiente de publicação. Regras de banco adicionais exigem nova migration, pois a inicial já foi aplicada localmente.
