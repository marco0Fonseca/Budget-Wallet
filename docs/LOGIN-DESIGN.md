# Direção visual da tela de login

**Estado:** versão 2, com painéis distribuídos, escolhida pelo usuário em 22/11/2026 e implementada na tela de login React. Detalhes visuais podem evoluir após avaliação no navegador.

## Referências recebidas

- Imagens 1 e 2: composição de duas áreas, com formulário de entrada em uma lateral e visual amplo na outra.
- Imagem 3: cantos arredondados e espaçamento generoso. O formato vertical e os efeitos de brilho não definem a página desktop.

## Elementos comuns às propostas

- Tela pensada primeiro para computador, com área de formulário e prévia ilustrativa do Dashboard.
- Paleta azul, interface financeira sóbria e sem personagens. A prévia mostra componentes plausíveis do BudgetWallet: resumo do mês, receitas, despesas, resultado e gráfico.
- Superfícies com cantos arredondados moderados, campos legíveis, contraste e espaços regulares.
- Campos **E-mail ou username** e **Senha** e ação **Entrar**, conforme [fluxo do usuário](USER-FLOW.md). O estudo inicial incluía acesso demonstrativo; a implementação atual usa cadastro e login reais, com recuperação de senha ainda provisória.
- As imagens foram geradas como estudos visuais. Números, gráficos e alguns rótulos são ilustrativos; a prévia não promete funcionalidades já implementadas. A interface final usará apenas ações e conceitos aprovados no fluxo do produto.
- Layout para telas pequenas será definido após a direção desktop, preservando semântica e acesso por teclado.

## Opções visuais

| Opção | Composição | Característica principal | Imagem |
| --- | --- | --- | --- |
| A — Azul claro | Formulário à esquerda, prévia do Dashboard à direita | Tela leve e direta, com azul vivo em pontos de ação. | [Abrir A](design/login-concept-a.png) |
| B — Azul profundo | Prévia do Dashboard à esquerda, formulário à direita | Maior contraste e presença visual, mantendo o formulário claro. | [Abrir B](design/login-concept-b.png) |
| C — Carteira em foco | Formulário à esquerda, prévia em cartões à direita | A ideia de carteira aparece nos cartões financeiros e na organização da informação. | [Abrir C](design/login-concept-c.png) |

## Direção escolhida e revisão A2

O usuário escolheu a composição e a paleta da opção A, com estes ajustes:

- Formulário em um painel branco independente, à esquerda, com bordas arredondadas e espaço livre ao redor.
- O Dashboard aparece como conjunto de painéis no fundo, com azul mais claro e baixa ênfase visual. O formulário permanece como foco principal.
- Os painéis de fundo apenas sugerem a próxima tela; na implementação do login serão decorativos, sem controles ativos ou dados reais.

[Abrir a revisão A2](design/login-concept-a-v2.png). Ela registra o primeiro ajuste, com os painéis de fundo discretos.

## Variações para escolha

As duas imagens preservam o painel independente de login da A2. Elas diferem na apresentação do produto ao fundo:

| Versão | Composição | Imagem |
| --- | --- | --- |
| 1 — Dashboard nítido | Uma prévia completa do Dashboard à direita, com cores e gráficos em destaque, como na opção A original. | [Abrir versão 1](design/login-concept-a-v3-dashboard.png) |
| 2 — Painéis distribuídos | Cartões separados de resumo mensal, despesas, transações, investimentos e planejamento, inspirados na opção C e distribuídos pela área ao lado do login. | [Abrir versão 2](design/login-concept-a-v3-panels.png) |

As duas imagens são estudos visuais, com dados fictícios. A versão 2 orienta a implementação atual. Os painéis de fundo são decorativos e sua presença não antecipa a implementação das funcionalidades representadas.

Na implementação, o login usa um painel branco independente, base azul clara, cantos arredondados e cinco cartões distribuídos. O layout foi compactado para caber em 1366 × 768 a 100% de zoom, e os ícones têm alinhamento uniforme. O formulário recebe foco visível e mensagens de validação. Cadastro e login usam a API; a recuperação de senha também está conectada, mas permanece provisória e não comprova a posse da conta. Após entrar, a Dashboard mostra dados reais da conta; os cartões de fundo da página de login continuam ilustrativos.

[Ver captura da implementação em 1366 × 768](design/login-implemented-desktop.png).

Após comparar as capturas enviadas pelo usuário em 100% e 90% de zoom, a composição desktop ganhou largura máxima menor e espaçamentos verticais compactos em janelas largas e baixas. A intenção é reproduzir em 100% o encaixe aprovado em 90%, sem aplicar escala artificial ao conteúdo. As setas de receitas e despesas e os símbolos de Restaurante e Mercado foram substituídos por ícones SVG alinhados ao centro. [Ver captura da composição ajustada](design/login-implemented-wide.png).

## Revisão da interface

Na revisão do protótipo inicial com Playwright, o login coube em 1534 × 695, 1366 × 768 e 1024 × 768 a 100% de zoom, sem rolagem, e permaneceu utilizável em 390 × 844. Em 320 × 700 houve rolagem vertical curta, sem rolagem horizontal. Aquela revisão conferiu entrada demonstrativa, mensagens para campos vazios, foco no primeiro erro, saída e navegação para os estados de cadastro e recuperação; o fluxo real posterior exige nova verificação específica.

Pelas regras aplicáveis da skill `web-design-guidelines`, a interface usa controles nativos, rótulos de campos, foco visível, link para pular ao formulário, erros próximos aos campos, URLs para os estados informativos e formatação `pt-BR` dos valores ilustrativos. O detalhamento responsivo para celulares continua previsto para uma etapa posterior.
