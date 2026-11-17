# Regras de negócio — BudgetWallet

Documento evolutivo das regras, validações, cálculos e restrições do domínio. Atualizar conforme decisões de produto forem tomadas, distinguindo definições aprovadas de propostas ainda em refinamento. Percursos e esboços de tela ficam em [Fluxo do usuário](USER-FLOW.md); prioridades e critérios de entrega ficam no [backlog](BACKLOG.md). Uma regra documentada não significa que já foi implementada.

## Definições confirmadas

- Moeda BRL, exibição com R$ e precisão de centavos.
- Categorias editáveis e criadas pelo usuário, incluindo categorias genéricas e subcategorias específicas.
- Calendário mensal com despesas fixas previstas, valor que o usuário pretende guardar e orçamento diário baseado na receita.
- O usuário pode alterar o orçamento diário. Sobras ou excessos devem poder ser distribuídos pelos dias restantes do mês.

As categorias e ideias de planejamento foram aprovadas pelo usuário em 17/11/2026. Adotar inicialmente dois níveis de categorias e redistribuição igual entre dias restantes, com prévia e confirmação. Detalhes operacionais indicados ao final continuam sujeitos a refinamento. Não representam funcionalidades já implementadas.

## Acesso e propriedade dos dados

- No protótipo local, qualquer e-mail ou username e senha não vazios permitem entrar, sem validar credenciais nem exigir formato de e-mail.
- Identificadores diferentes usam o mesmo usuário demonstrativo com dados fictícios; não criam contas ou identidades verificadas. Não persistir nem registrar a senha informada.
- Autenticação real, cadastro e recuperação de senha entram posteriormente em BW-09/BW-11, antes de uso real.
- No acesso real, categorias, lançamentos e planejamento pertencem ao usuário autenticado. A identidade vem da sessão validada; outro usuário não pode consultar nem modificar esses dados.

## Lançamentos, valores e datas

- Cada lançamento realizado tem tipo receita ou despesa, valor positivo em centavos, data civil e uma categoria do mesmo proprietário e tipo. Descrição é opcional.
- O tipo determina o efeito no resultado; o valor armazenado não deve ser negativo. Limites numéricos serão especificados em BW-03.
- Lançamentos realizados aceitam datas até hoje. Datas futuras pertencem às previsões do incremento de planejamento e não entram nos totais realizados.
- Convenção técnica inicial para “hoje”: `America/Sao_Paulo`. Manter a data civil informada sem deslocá-la por conversão de fuso. Configuração de fuso por usuário pode ser refinada posteriormente.
- Resultado mensal = receitas realizadas menos despesas realizadas no mês. O período inclui o primeiro dia e exclui o primeiro dia do mês seguinte; os totais independem da paginação.
- Resultado acumulado até um dia considera os lançamentos desde o início do mês até esse dia. Nenhum desses resultados representa saldo bancário.
- Mês sem lançamentos tem totais zerados. Exemplo: receita de R$ 2.000,00 menos despesa de R$ 150,50 resulta em R$ 1.849,50.
- A edição segue as mesmas validações da criação. Exclusão e correção devem atualizar os resultados derivados.

## Categorias

Usar uma única entidade `Category`, com `parentId` opcional apontando para outra categoria. Uma subcategoria é uma categoria com pai; não precisa de uma classe ou tabela separada. A representação em TypeScript pode acompanhar o modelo Prisma, sem exigir uma classe apenas para armazenar campos.

Sugestão inicial de categorias, copiadas para cada usuário e editáveis:

| Tipo | Categoria | Subcategorias sugeridas |
| --- | --- | --- |
| Receita | Trabalho | Salário, Freelance |
| Receita | Outras receitas | — |
| Despesa | Alimentação | Mercado, Delivery, Restaurantes |
| Despesa | Moradia | Aluguel, Condomínio, Água, Energia, Internet |
| Despesa | Transporte | Transporte público, Combustível, Aplicativos |
| Despesa | Saúde | Farmácia, Consultas |
| Despesa | Entretenimento | Cinema, Passeios |
| Despesa | Educação | Cursos, Livros |
| Despesa | Outras despesas | — |

Regras propostas:

- Começar com dois níveis: categoria e subcategoria. A quantidade de categorias é variável; profundidade maior pode ser refinada depois.
- Pai e filha pertencem ao mesmo usuário e têm o mesmo tipo (receita ou despesa). Impedir ciclos, autorreferência e um terceiro nível, inclusive ao mover categorias.
- Um lançamento aponta para uma única categoria, genérica ou específica. “Alimentação → Delivery” é exibido como caminho, sem criar dois lançamentos.
- Totais de uma categoria incluem seus lançamentos diretos e os das subcategorias, contando cada lançamento uma vez.
- Nomes normalizados são únicos entre categorias irmãs do mesmo usuário e tipo; aplicar também às categorias raiz, sem depender apenas de unicidade com `parentId` nulo no banco.
- Permitir criar, renomear e arquivar. Categorias arquivadas continuam visíveis no histórico e deixam de ser opção para novos lançamentos. Arquivar uma categoria com filhas requer tratar a árvore explicitamente.
- Não alterar o tipo de categoria usada nem excluir registros vinculados. Ao mover uma subcategoria, informar que a agregação histórica passará a seguir a nova árvore; essa política precisa ser validada antes da implementação.
- Despesa fixa/variável é uma característica do planejamento, não da categoria: “Alimentação” pode conter ambos os casos.

## Estado do dia

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
