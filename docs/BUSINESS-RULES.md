# Regras de negócio — BudgetWallet

Documento evolutivo das regras, validações, cálculos e restrições do domínio. Atualizar conforme decisões de produto forem tomadas, distinguindo definições aprovadas de propostas ainda em refinamento. Percursos e esboços de tela ficam em [Fluxo do usuário](USER-FLOW.md); prioridades e critérios de entrega ficam no [backlog](BACKLOG.md). Uma regra documentada não significa que já foi implementada.

## Definições confirmadas

- Moeda BRL, exibição com R$ e precisão de centavos.
- Categorias criadas pelo usuário são editáveis. Categorias padrão são individuais por usuário, mas não podem ser editadas nem excluídas isoladamente.
- Calendário mensal com despesas fixas previstas, valor que o usuário pretende guardar e orçamento diário baseado na receita.
- O usuário pode alterar o orçamento diário. Sobras ou excessos devem poder ser distribuídos pelos dias restantes do mês.

As categorias e ideias de planejamento foram aprovadas pelo usuário em 17/11/2026. Adotar inicialmente dois níveis de categorias e redistribuição igual entre dias restantes, com prévia e confirmação. Detalhes operacionais indicados ao final continuam sujeitos a refinamento. Não representam funcionalidades já implementadas.

## Acesso e propriedade dos dados

- O cadastro recebe nome, e-mail, username, senha e confirmação; a API valida os campos, armazena hash e cria categorias padrão individuais.
- O login aceita e-mail ou username e valida a senha; em caso de sucesso, emite JWT, mantido pela interface na sessão do navegador.
- O servidor verifica JWT por middleware na rota de listagem de categorias e confere se o usuário autenticado corresponde ao recurso solicitado. A proteção de outras rotas financeiras deve seguir o mesmo padrão; até então, não considerar toda a API financeira protegida.
- A recuperação provisória redefine a senha por e-mail ou username sem comprovar a posse da conta e revela se o identificador existe. É apenas para desenvolvimento local; antes de uso compartilhado ou real, exigir token temporário e de uso único enviado ao e-mail verificado, além de resposta que não revele a existência da conta. Detalhes em `AUTHENTICATION.md`.
- Os painéis financeiros atuais usam dados locais de exemplo. Quando forem integrados, categorias, lançamentos e planejamento devem pertencer ao usuário da sessão verificada; nunca confiar em `userId` enviado pelo cliente.

## Perfil do usuário

- Ao excluir um usuário, suas categorias, subcategorias, transações e investimentos são excluídos em cascata. Os dados dos demais usuários permanecem intactos. Excluir uma categoria isoladamente continua bloqueado enquanto houver subcategorias ou movimentações vinculadas. Decisão de persistência: [Exclusão de usuário](decisions/0002-user-deletion.md).

- A entidade `User` contém `id`, `name`, `email`, `username` e `createdAt`, sem senha. Novos usuários recebem UUID; a reconstrução do banco preserva identificador e data originais.
- Nome e e-mail são obrigatórios e têm espaços externos removidos; o e-mail recebe validação básica de formato, sem comprovar que o endereço existe.
- Convenção inicial de username: obrigatório, permitindo apenas letras ASCII minúsculas, números, ponto, hífen e sublinhado. Remover espaços externos; rejeitar maiúsculas sem convertê-las automaticamente. Não aceitar espaços internos ou `@`, distinguindo username de e-mail no login futuro.
- Os campos não podem ser alterados diretamente após a construção. Alterações de perfil deverão passar por operações validadas quando forem implementadas.
- Unicidade de e-mail e username depende da persistência e ainda não é garantida pela classe. Refinar a normalização de e-mail no cadastro antes de criar sua restrição de unicidade.

## Lançamentos, valores e datas

- Novos lançamentos usam `id = -1` apenas em memória. `TransactionRepository.create` exige esse estado e uma categoria já persistida, omite o ID na inserção e retorna a entidade com o ID gerado pelo banco. IDs de consultas/alterações são inteiros positivos de até 2.147.483.647.
- As consultas e alterações do repositório recebem `userId`. As listagens retornam arrays ordenados por ID; `findAllByCategory` inclui apenas a categoria informada, sem agregar subcategorias. `updateCategory` exige uma categoria do mesmo usuário; o tipo do lançamento acompanha a nova categoria.
- `updateDescription` remove espaços externos; texto vazio ou `undefined` limpa a descrição no banco. `updateAmountCents` valida centavos antes da gravação.

- Cada lançamento tem valor positivo em centavos, data e categoria do mesmo proprietário. Descrição é opcional; o tipo vem da categoria.
- `Transaction` aceita apenas categorias `INCOME` ou `EXPENSE`; `INVESTMENT` é reservado à entidade `Investment`.
- `Transaction.amountCents` é um campo `readonly` expresso em inteiros de 1 a 2.147.483.647 centavos, sem arredondamento automático. A conversão da entrada em reais deve ocorrer antes de construir a entidade. `monetaryValue()` retorna uma string com ponto e duas casas decimais (1550 → "15.50"), apenas para apresentação; cálculos usam centavos. Não há getter/setter `value`. Totais agregados precisam de validação própria de limite.
- A classe usa provisoriamente `dateTimestamp` em milissegundos inteiros seguros, com validação de data válida. A persistência converte o timestamp para `BigInt` e o reconstrói como `number`. A descrição opcional fica no final do construtor, tem espaços externos removidos e, se vazia, é omitida.
- Por decisão do usuário, a proibição de datas futuras foi suspensa nesta versão. Isso não significa que uma ocorrência futura já tenha sido paga ou recebida; a distinção entre previsto e realizado será refinada em BW-17 antes de automatizar recorrências.
- A convenção inicial de fuso para apresentação é `America/Sao_Paulo`; a representação definitiva da data financeira e sua aplicação às recorrências serão revisadas em BW-17.
- Resultado mensal = receitas realizadas menos despesas realizadas no mês. O período inclui o primeiro dia e exclui o primeiro dia do mês seguinte; os totais independem da paginação.
- Resultado acumulado até um dia considera os lançamentos desde o início do mês até esse dia. Nenhum desses resultados representa saldo bancário.
- Mês sem lançamentos tem totais zerados. Exemplo: receita de R$ 2.000,00 menos despesa de R$ 150,50 resulta em R$ 1.849,50.
- A edição segue as mesmas validações da criação. Exclusão e correção devem atualizar os resultados derivados.

## Categorias

O método updateParent aceita null para transformar uma subcategoria em raiz ou o ID de uma raiz do mesmo proprietário e tipo para movê-la. Categorias padrão não podem ser movidas. Uma categoria com filhas não pode virar subcategoria; autorreferência também é proibida. A alteração preserva ID, tipo e movimentações vinculadas: muda apenas o agrupamento. A validação da hierarquia e a gravação ocorrem na mesma transação.

Uma categoria nova tem `id = -1` apenas em memória. O repositório aceita esse estado no `create`, omite o ID na inserção e retorna outra entidade com o ID autoincremental gerado pelo banco. A entidade original mantém `-1`; categorias já persistidas não podem ser reenviadas ao `create`. IDs persistidos e usados em consultas/atualizações devem ser números inteiros de 1 a 2.147.483.647, compatíveis com `Int` do Prisma. `parentId` aceita `null` ou um ID positivo válido, nunca `-1`. A sequência é gerada pelo banco e pode apresentar lacunas.

Usar a entidade `TransactionCategory`, com `parentId` opcional apontando para uma categoria raiz. Subcategorias são categorias comuns vinculadas a um pai; não precisam de classe ou tabela separada. A entidade, o schema Prisma e as operações de persistência já estão implementados.

O catálogo inicial aprovado contém 21 categorias. Todas são raízes (`parentId: null`), são copiadas por usuário e recebem `isDefault: true`. O repositório inclui `createDefaultCategoriesForUser(userId)` para persistir a cópia individual; o fluxo atual de cadastro no servidor chama essa rotina após criar a conta.

O campo `isDefault` é `false` para categorias personalizadas. Edição e exclusão devem bloquear categorias padrão, inclusive alterações de nome, tipo, pai e do próprio indicador. Esse indicador é definido pelo servidor, não por dados livres enviados pelo cliente. A exclusão da conta continua removendo todas as categorias em cascata. `updateLabel`, `updateType`, `updateParent` e `delete` já verificam a proteção. A exclusão isolada exige categoria do próprio usuário, não padrão e sem subcategorias; vínculos com transações ou investimentos também impedem a exclusão pelo banco.

Em uma etapa futura, uma categoria usada por transações poderá ser excluída depois que o usuário escolher outra categoria compatível para receber esses lançamentos. A reclassificação e a exclusão deverão ocorrer de forma consistente. Investimentos vinculados também exigirão uma política explícita antes de permitir essa operação.

A alteração de tipo só pode partir de uma categoria raiz e deve atualizar também suas subcategorias diretas em uma única transação. É bloqueada se qualquer categoria envolvida for padrão ou tiver transações ou investimentos vinculados. A criação pelo repositório só aceita pai existente, do mesmo usuário e tipo, cujo parentId seja nulo. Assim, o limite de dois níveis é validado na entrada, e updateType trata apenas a raiz e suas filhas diretas. Escritas diretas no banco não recebem essa validação de profundidade. Para respeitar a chave estrangeira composta com `onUpdate: Restrict`, o repositório desvincula temporariamente as filhas, altera os tipos e restaura os vínculos dentro da mesma transação; qualquer falha desfaz todas as etapas.

| Tipo | Categorias padrão (todas raiz) |
| --- | --- |
| Receita | Salário, Freelance, Renda extra |
| Despesa | Alimentação, Moradia, Transporte, Saúde, Educação, Entretenimento, Compras, Contas e serviços, Assinaturas, Cuidados pessoais, Impostos e taxas |
| Investimento | Investimentos, CDI, Locação, Tesouro Direto, CDB, Ações, Fundos imobiliários |

Regras propostas:

- Categorias personalizadas podem ter até dois níveis; as categorias padrão aprovadas são todas raiz. A quantidade de categorias é variável; profundidade maior pode ser refinada depois.
- Pai e filha pertencem ao mesmo usuário e têm o mesmo tipo (`INCOME`, `EXPENSE` ou `INVESTMENT`). Impedir ciclos, autorreferência e um terceiro nível, inclusive ao mover categorias.
- Um lançamento aponta para uma única categoria, genérica ou específica. “Alimentação → Delivery” é exibido como caminho, sem criar dois lançamentos.
- Totais de uma categoria incluem seus lançamentos diretos e os das subcategorias, contando cada lançamento uma vez.
- Nomes normalizados são únicos entre categorias irmãs do mesmo usuário e tipo; aplicar também às categorias raiz, sem depender apenas de unicidade com `parentId` nulo no banco.
- Permitir criar, renomear e arquivar. Categorias arquivadas continuam visíveis no histórico e deixam de ser opção para novos lançamentos. Arquivar uma categoria com filhas requer tratar a árvore explicitamente.
- Não alterar o tipo de categoria usada nem excluir registros vinculados. Ao mover uma subcategoria, informar que a agregação histórica passará a seguir a nova árvore; essa política precisa ser validada antes da implementação.
- Despesa fixa/variável é uma característica do planejamento, não da categoria: “Alimentação” pode conter ambos os casos.

## Investimentos — projeção inicial de aporte único

- `Investment` é uma entidade independente de `Transaction`, com aporte inicial em `amountCents`, data em `dateTimestamp`, usuário, categoria do tipo `INVESTMENT`, `monthlyRate` e `monthsDuration`. Não gera lançamentos financeiros automaticamente.
- O usuário deve ser o proprietário da categoria. O aporte inicial segue o limite de 1 a 2.147.483.647 centavos. O ID numérico ainda é provisório até a persistência.
- `monthlyRate` é uma fração mensal constante: `0.01` corresponde a 1% ao mês. Taxa zero é válida; taxas negativas maiores que `-1` permitem simular perdas. Rejeitar taxas não finitas e valores iguais ou inferiores a `-1`.
- `monthsDuration` é um inteiro de 1 a 2.147.483.647, compatível com `Int` do Prisma. Projeções usam meses inteiros não negativos; períodos superiores ao prazo ficam limitados à duração informada.
- `InvestmentRepository` cria apenas entidades novas (`id = -1`) e devolve o ID gerado pelo banco. A categoria persistida precisa pertencer ao usuário e ter tipo `INVESTMENT`. Consultas, atualizações e exclusões são filtradas por proprietário; listagens são ordenadas por ID. Atualizações de valor, taxa, duração e descrição usam as validações da entidade. Descrição vazia ou `undefined` remove o texto existente.
- `projectedAmountCents(n)` calcula aporte × (1 + taxa mensal)^n; `projectedGainCents(n)` desconta o aporte inicial. Ambos retornam centavos, com arredondamento do montante apenas no resultado final e rejeição de resultados fora dos inteiros seguros do JavaScript. Sem argumento, usam o prazo completo.
- `projectedAmountOn(timestamp)` e `projectedGainOn(timestamp)` calculam por meses completos desde o início. Como convenção desta simulação, aniversários usam UTC e preservam o horário; dias inexistentes caem no último dia do mês, sem perder a referência ao dia original nos meses seguintes. Exemplo: 31/01 → 28 ou 29/02 → 31/03. Essa convenção não implementa a recorrência geral de BW-17.
- Datas de consulta anteriores ao início e timestamps inválidos são rejeitados. Uma data de início futura pode ser cadastrada, mas `projectedGainUntilNow()` também rejeita a consulta enquanto ela anteceder o início.
- A projeção considera somente aporte único e taxa constante, sem impostos, tarifas, resgates ou rentabilidade observada. Aportes periódicos e vínculos com movimentações continuam pendentes de modelagem; não usar a projeção como rendimento já realizado no Dashboard.

## Recorrências — pendência BW-17

Definir frequências diária, mensal e anual, início e término, tratamento de dias inexistentes no mês e anos bissextos. Também decidir geração de previsões ou lançamentos, confirmação, alterações da série, cancelamento e prevenção de duplicações. Não implementar essas regras na classe inicial; registrar e refinar antes do incremento de recorrência.

## Estado do dia no planejamento

Enquanto o dia estiver aberto, mostrar “disponível hoje”, não uma sobra definitiva. Proposta: permitir encerrar o dia manualmente e sugerir a redistribuição ao revisar um dia passado. Não tratar dia futuro sem lançamentos como economia realizada.

## Cálculo proposto

No início do mês:

`orçamento variável = receita prevista − despesas fixas previstas − meta de economia`

Exemplo: R$ 3.000,00 − R$ 1.000,00 − R$ 500,00 = R$ 1.500,00. Em 30 dias, a sugestão é R$ 50,00 por dia.

Durante o mês:

`restante variável = receita total estimada − custo total estimado das fixas − meta de economia − gastos variáveis realizados`

- Receita total estimada = receitas já recebidas + receitas ainda previstas. Uma receita recebida substitui sua previsão vinculada, sem somar ambas.
- Custo total estimado das fixas = fixas já pagas + fixas ainda previstas. O pagamento substitui a previsão vinculada; não é descontado novamente como gasto variável.
- A meta de economia é uma reserva do planejamento, não uma despesa realizada nem comprovação de dinheiro guardado.
- Esse cálculo é uma projeção do orçamento do mês, não garantia de dinheiro disponível hoje. Datas de recebimento/vencimento aparecem no calendário; uma projeção de saldo bancário exigiria saldo inicial e outro refinamento.
- Alterar o valor diário apenas realoca o orçamento. Não cria receita nem reduz automaticamente a meta de economia ou as despesas fixas.
- Ao entrar no meio do mês, considerar os valores já realizados e distribuir somente o restante; não dividir novamente todo o orçamento mensal.

## Redistribuição proposta

Escolha para a primeira versão: **divisão igual pelos dias restantes**, sempre com prévia e confirmação. “Próximo dia” e “Escolher dias e valores” podem entrar na sequência.

Exemplos com cinco dias futuros, inicialmente com R$ 50,00 cada:

| Situação do dia encerrado | Diferença | Divisão igual | Tudo no próximo dia |
| --- | --- | --- | --- |
| Orçamento R$ 50,00; gasto R$ 40,00 | +R$ 10,00 | Cinco dias de R$ 52,00 | Próximo dia R$ 60,00; demais R$ 50,00 |
| Orçamento R$ 50,00; gasto R$ 100,00 | −R$ 50,00 | Cinco dias de R$ 40,00 | Próximo dia R$ 0,00; demais R$ 50,00 |

Na opção manual, selecionar datas e valores de ajuste cuja soma corresponda à diferença. Sobra também pode permanecer identificada como “não distribuída” até o usuário decidir; excesso pendente aparece como déficit, nunca oculto.

Regras de consistência:

- Calcular em centavos. Ao dividir R$ 10,00 por três dias, distribuir R$ 3,34, R$ 3,33 e R$ 3,33 em ordem cronológica, preservando o total exato.
- Não criar orçamento diário negativo. Se os dias escolhidos não comportarem uma redução, apresentar o déficit restante e pedir outra distribuição ou revisão do plano.
- Ajustes afetam apenas dias elegíveis ainda não encerrados. No último dia do mês, apresentar sobra/déficit final, sem transferir automaticamente para outro mês.
- No dia atual, considerar orçamento ainda disponível após gastos já registrados. Não reduzir o orçamento abaixo do gasto existente sem mostrar explicitamente o excesso.
- Registrar a redistribuição aplicada para não reaplicar a mesma diferença a cada consulta. Novos gastos ou correções em dias encerrados geram somente o ajuste adicional necessário, com nova prévia.
- Preservar valores escolhidos manualmente até confirmação de uma nova distribuição. Mostrar quais dias serão alterados.
- Mudanças em receitas, fixas ou meta recalculam a projeção e sinalizam necessidade de revisão, sem sobrescrever silenciosamente escolhas anteriores.

## Modelagem futura, apenas conceitual

Além de `Category` e `Transaction`, o planejamento poderá precisar de `MonthlyPlan` (mês, usuário e meta), `PlannedEntry` (receita/despesa prevista, data e vínculo com realização), `DailyBudget` (alocação diária) e `BudgetAdjustment` (redistribuições aplicadas).

Refinar como representar pagamentos parciais e recorrências antes de implementar esses casos. Previsões não entram nos totais realizados do Dashboard. Criar tabelas do calendário somente no incremento correspondente.

## Decisões ainda abertas

- Detalhar a experiência de movimentação/arquivamento de categorias em BW-12.
- Definir o momento de fechamento do dia em BW-13/BW-14.
- Confirmar se a primeira versão trata receitas variáveis como estimativa manual e se o valor não distribuído pode ser reservado até decisão posterior.
