# 0003 — Express para o backend HTTP

## Contexto

O BudgetWallet usará TypeScript no backend Node.js e precisa expor uma API HTTP para o frontend React. A aplicação ainda está no incremento de domínio e persistência; não há servidor HTTP implementado.

## Decisão

Usar Express como framework HTTP do backend. As rotas devem delegar validação e operações aos casos de uso e repositórios, mantendo acesso a banco e segredos no servidor. A integração e configuração local do Express pertencem a BW-15.

## Consequências

- O contrato HTTP será explícito e independente dos componentes React.
- A camada de rotas não deve concentrar regras de negócio nem expor erros internos.
- Express e seus tipos TypeScript são dependências locais. A configuração e integração do servidor HTTP permanecem em BW-15.

Reconsiderar a escolha se requisitos de execução, hospedagem ou manutenção mostrarem que Express não atende ao projeto.
