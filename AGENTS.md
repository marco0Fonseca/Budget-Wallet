# Orientações para agentes — BudgetWallet

## Contexto e referências

O BudgetWallet é uma aplicação web de controle financeiro pessoal, desenvolvida como projeto acadêmico de Engenharia de Software da UNIFESP. Comunique-se com a equipe em português brasileiro.

Estas orientações se aplicam ao repositório inteiro. Respeite instruções mais específicas de eventuais `AGENTS.md` nas pastas em que trabalhar e as instruções explícitas do usuário.

Antes de implementar:

1. Leia o `README.md`, os itens relevantes de `docs/BACKLOG.md` e as seções aplicáveis de `docs/USER-FLOW.md` e `docs/BUSINESS-RULES.md`.
2. Confira o estado atual do código, as configurações e o `git status`. Preserve alterações existentes que não façam parte da tarefa.
3. Consulte decisões em `docs/decisions/`, quando a pasta existir.
4. Identifique o objetivo e os critérios de aceite da tarefa. Faça escolhas técnicas locais e reversíveis com autonomia; esclareça ambiguidades que alterem regras de negócio ou o escopo da entrega.

O backlog contém propostas e hipóteses, não prova de funcionalidades implementadas. Verifique o código antes de descrever o comportamento do sistema.

## Desenvolvimento incremental

- Trabalhe no incremento solicitado, com mudanças pequenas, coesas e demonstráveis.
- Após a configuração local de BW-02, priorize classes iniciais, mapeamento ORM e testes em BW-03. A integração React/backend e lint/CI ficam para BW-15/BW-16; não são pré-requisitos para começar o domínio.
- O primeiro fluxo priorizado é Login → Dashboard, com cadastro e consulta de receitas e despesas categorizadas; em seguida, consultar o resultado mensal e corrigir registros. Consulte `docs/USER-FLOW.md` para a navegação e as pendências. Investimentos e Previsões / Acompanhamento mensal dia a dia são abas previstas para incrementos posteriores.
- Evolua modelagem, implementação e testes juntos. Não modele todo o produto antes de entregar o primeiro fluxo.
- Não antecipe IA, investimentos, recorrências, cartões ou outras funcionalidades futuras sem necessidade da tarefa atual.
- Evite refatorações amplas, abstrações genéricas e novas dependências sem benefício concreto para a entrega.
- Registre decisões arquiteturais relevantes em ADRs curtos em `docs/decisions/`: contexto, decisão, consequências e condições para revisão. Não crie um ADR para cada detalhe de código.
- Atualize a documentação quando uma mudança invalidar instruções ou decisões existentes. Não marque um item como concluído se faltarem critérios de aceite ou revisão da equipe.
- Mantenha `docs/USER-FLOW.md` como referência evolutiva de navegação e interação, e `docs/BUSINESS-RULES.md` como referência de regras, cálculos e validações do domínio. Evite duplicar definições: use links entre os documentos. O backlog organiza prioridades e critérios de aceite; ADRs registram decisões técnicas.

## Stack e organização

A stack definida é TypeScript e React no frontend, com Node.js e Express no backend; Prisma e SQLite cuidam da persistência. React, React DOM, Express e seus tipos TypeScript já são dependências locais. A configuração do frontend e a integração HTTP ainda pertencem a BW-15. A Vercel é a opção de hospedagem prevista, sujeita à validação de persistência descrita em BW-08. A decisão sobre Express está em `docs/decisions/0003-express-backend.md`.

Organização inicial, a ajustar conforme as decisões registradas:

| Caminho | Responsabilidade |
| --- | --- |
| `frontend/` | Interface React, organizada por funcionalidades quando necessário. |
| `src/server/` | Aplicação HTTP Express, rotas e integração com os casos de uso. |
| `src/` | Entidades, casos de uso, validação e regras de negócio. |
| `src/db/` | Configuração do acesso ao banco pelo Prisma. |
| `prisma/` | Schema, migrations e seed de desenvolvimento. |
| `docs/` | Backlog e decisões técnicas. |

- Mantenha um monólito modular simples, com limites claros entre interface, regras e persistência.
- Acesso ao banco e segredos pertencem ao backend. O frontend se comunica por contratos de API explícitos.
- Não crie diretórios, camadas ou arquivos vazios somente para reproduzir a estrutura proposta.
- Antes de adicionar ferramentas, confira o que já existe no projeto. Use npm e mantenha o lockfile correspondente; não misture gerenciadores.
- Ao configurar TypeScript, habilite modo estrito. Prefira tipos explícitos nas fronteiras e evite `any` e supressões de erros sem justificativa.
- Use nomes de arquivos, diretórios e código em inglês. O conteúdo da documentação e os textos da interface podem permanecer em português brasileiro. Ao renomear arquivos, atualize seus links e referências. Siga os padrões de formatação existentes.
- Valide dados externos em tempo de execução no servidor; tipos TypeScript e validação no formulário não substituem essa proteção.
- Trate erros de forma consistente, com mensagens úteis ao usuário e sem expor detalhes internos ou dados sensíveis.

## Regras financeiras e modelagem

As seguintes convenções orientam o primeiro incremento. Se o escopo mudar, atualize as regras e seus testes de forma coerente.

- Trabalhe inicialmente em BRL e armazene valores como inteiros em centavos (`amountCents`). Evite cálculos monetários com frações de ponto flutuante.
- Valide a conversão do texto digitado para centavos, a precisão permitida e os limites do banco e da aritmética utilizada, incluindo totais.
- O valor do lançamento é positivo; `INCOME` ou `EXPENSE` determina seu efeito no resultado.
- Resultado mensal é receitas menos despesas do período. Não o apresente como saldo bancário.
- A classe `Transaction` usa provisoriamente `dateTimestamp` em milissegundos; preserve o valor ao persistir. Por decisão do usuário, não restaurar a proibição de datas futuras nesta etapa. A representação definitiva da data financeira e as regras de recorrência serão refinadas em BW-17.
- `createdAt` e `updatedAt` representam instantes técnicos, separados da data financeira.
- Filtros mensais incluem o início do mês e excluem o início do mês seguinte. Totais devem considerar todo o período, independentemente da paginação.
- Cada lançamento tem uma categoria do mesmo proprietário e compatível com seu tipo. Valide essas relações no servidor; uma chave estrangeira isolada não basta.
- Categorias são editáveis e podem ter subcategorias via `parentId`. Consulte `docs/BUSINESS-RULES.md` para sugestões e regras ainda em refinamento. Agregações devem evitar dupla contagem entre pai e filhas.
- No incremento de planejamento, separe previsões de realizações, meta de economia de despesas e orçamento diário de saldo bancário. Redistribuições devem conservar centavos e não ser aplicadas novamente a cada consulta.
- Evite armazenar totais derivados enquanto consultas simples atenderem ao caso de uso.
- Evolua o schema com migrations versionadas. Não reescreva migrations já compartilhadas ou aplicadas; crie uma nova migration.
- Use seed repetível com dados fictícios. Não execute reset de banco, exclusão de dados ou migrations destrutivas fora de banco descartável de teste sem autorização explícita.
- Testes de persistência devem usar banco isolado, nunca o banco pessoal do desenvolvedor.

## Privacidade e acesso

- Não versione credenciais, arquivos `.env` com valores reais, bancos locais ou dados financeiros pessoais. Documente as variáveis necessárias em um arquivo de exemplo sem segredos.
- Evite registrar tokens, credenciais ou conteúdo financeiro pessoal em logs.
- O primeiro incremento usa acesso demonstrativo com e-mail ou username e qualquer senha não vazia (BW-10), sem validar credenciais ou criar contas. Não persista nem registre essa senha. Um usuário fixo só é aceitável na demonstração local com dados fictícios e deve ficar indisponível no ambiente de uso real. Autenticação real, cadastro e recuperação na mesma página ficam para BW-09 e BW-11.
- Antes de uso real, implemente autenticação e isolamento por proprietário. Obtenha a identidade da sessão validada, sem confiar em `userId` enviado pelo cliente.
- Aplique autorização em consultas, totais e mutações. Teste acesso indevido com dois usuários e IDs conhecidos.
- Antes de publicar, comprove a persistência no ambiente escolhido, incluindo reinício/redeploy, migrations e recuperação. Não trate o arquivo SQLite local como garantia de persistência na hospedagem.

## Interface e experiência

- Inclua estados de carregamento, vazio, erro e sucesso nos fluxos implementados.
- Use HTML semântico, rótulos associados aos campos, foco visível e navegação por teclado.
- Mantenha o fluxo utilizável em telas pequenas e formate dinheiro e datas de forma consistente em pt-BR.
- Bloqueie reenvios enquanto uma operação estiver em andamento e só indique sucesso após confirmação do servidor.
- Para exclusão de lançamentos, ofereça confirmação clara e atualize lista e totais após sucesso.

## Verificação e entrega

O projeto possui dependências locais, lockfile e comandos de testes e verificação de tipos (`npm run check`). Banco e testes de persistência serão configurados em BW-03; aplicação/build em BW-15 e lint/CI em BW-16. Consulte os scripts atuais antes de executar verificações e documente novos comandos no README; não afirme ter executado verificações indisponíveis.

Em cada alteração:

1. Execute os scripts existentes de lint, verificação de tipos, testes e build pertinentes à mudança, no diretório correto.
2. Cubra regras de negócio com testes focados no comportamento. Priorize precisão monetária, limites de datas, validação de categorias, persistência e isolamento entre usuários.
3. Para um fluxo completo, verifique a integração entre interface, API e banco; para mudanças visuais, confira também a interface renderizada quando possível.
4. Em mudanças apenas documentais, revise coerência, caminhos e formatação; não crie testes de código sem necessidade.
5. Revise o diff para remover alterações acidentais e arquivos gerados indevidos.
6. Informe o que mudou, como foi verificado e o que continua pendente. Distinga verificações aprovadas, falhas e verificações não executadas.

Respeite a definição de concluído do backlog, incluindo revisão por outro integrante. Não declare que essa revisão ocorreu sem evidência.

## Colaboração e Git

- Mantenha alterações limitadas ao objetivo pedido e preserve o trabalho dos demais integrantes.
- Não faça commits, pushes, merges ou publicação sem solicitação ou autorização correspondente. Se for solicitado criar uma branch sem nome definido, use o prefixo `codex/`.
- Não reverta arquivos, reescreva histórico ou remova trabalho existente para simplificar a tarefa.
- Ao preparar commits ou pull requests solicitados, explique o problema, a mudança de comportamento e as verificações realizadas; associe o item `BW-XX` quando pertinente.
- Mantenha este guia curto o suficiente para ser consultado e atualizado conforme o projeto evolui. Detalhes de produto pertencem ao backlog; instruções de execução pertencem ao README.
