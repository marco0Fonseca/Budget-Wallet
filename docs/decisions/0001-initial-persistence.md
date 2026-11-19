# 0001 — Persistência inicial em SQLite/Prisma

## Contexto

O schema inicial acompanha `User`, `TransactionCategory`, `Transaction` e `Investment`, sem implementar repositórios, geração de ocorrências ou autenticação.

## Decisão

- `User.id` é String com UUID padrão do Prisma; preservar IDs fornecidos pela entidade. As outras entidades usam `Int` autoincremental. O `-1` das classes é provisório e não deve ser enviado na criação de registros; reconstrução com o ID persistido será implementada com os repositórios.
- Timestamps em milissegundos usam `BigInt`, evitando o limite de 32 bits de `Int`. O futuro mapeamento converterá `number` inteiro seguro para `bigint` ao gravar e de volta para `number` validado ao ler. Não serializar `bigint` diretamente em JSON.
- Dinheiro usa `Int` em centavos; taxa mensal usa `Float`, coerente com a simulação atual. Métodos e resultados calculados não viram colunas.
- Categoria do lançamento/investimento é uma relação por `categoryId`, com chave estrangeira composta incluindo `userId`. A relação pai/filha também inclui tipo. Exclusões de registros referenciados são restritas.
- `email` e `username` são únicos por comparação exata do SQLite. Username minúsculo é validado na entidade; normalização definitiva de e-mail será refinada no cadastro.
- O schema usa enum Prisma para `TransactionType`, persistido como texto no SQLite. Não é o enum TypeScript incompatível com `erasableSyntaxOnly`.
- A conexão é configurada em `prisma.config.ts`, com `DATABASE_URL` opcional e banco local padrão `dev.db` na raiz. `.env`, banco e arquivos auxiliares não são versionados; schema, migrations e `.env.example` são versionados.

## Limites e próximos passos

A migration garante relações e unicidade de usuário. Validações de valores, formato de campos, tipo INVESTMENT, ausência de ciclos, profundidade de categorias e unicidade de labels normalizados não são todas expressas no schema e precisam ser garantidas pela camada de domínio/persistência antes de expor gravações. SQLite não garante o conjunto de valores de um enum Prisma por si só.

Prisma Client, adapter SQLite, repositórios, conversões, seed e testes através do ORM continuam pendentes de BW-03. Os testes de schema executam a migration em SQLite em memória, sem acessar o banco local. Não há generator configurado enquanto o cliente não for integrado.

Revisar esta decisão ao implementar os repositórios, refinar regras de identidade ou escolher o ambiente de publicação. Regras de banco adicionais exigem nova migration, pois a inicial já foi aplicada localmente.
