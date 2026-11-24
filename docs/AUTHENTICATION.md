# Autenticação e JWT

## Configuração local

O backend usa `jsonwebtoken` para assinar tokens e `bcrypt` para gerar hashes de senha. Configure estas variáveis no ambiente do servidor:

| Variável | Uso | Padrão atual |
| --- | --- | --- |
| `JWT_SECRET` | Segredo usado para assinar tokens | `your-secret-key-change-in-production` (temporário para desenvolvimento local) |
| `JWT_EXPIRES_IN` | Validade do token | `7d` |

O segredo deve permanecer no backend e nunca ser enviado ao frontend, commitado em arquivos ou incluído em logs. O valor padrão é apenas uma conveniência temporária de desenvolvimento; antes de qualquer ambiente compartilhado ou produção, configure um segredo forte e privado.

## Uso do token

Após o `POST /api/auth/signin` validar e-mail ou username e senha, o servidor devolve um JWT ao cliente. Em requisições posteriores a rotas protegidas, o cliente envia:

```http
Authorization: Bearer <token>
```

O servidor deve verificar assinatura e validade antes de aceitar a requisição. A identidade do usuário deve vir do conteúdo verificado do token, nunca de um `userId` confiado no corpo ou nos parâmetros enviados pelo cliente. Respostas públicas não devem incluir hash de senha, segredo JWT ou detalhes internos de exceções.

## Redefinição de senha em desenvolvimento

`UserRepository.updatePasswordHashByIdentifier(identifier, newPasswordHash)` permite localizar a conta por e-mail ou username e atualizar seu hash sem uma sessão autenticada. Esta operação é apenas provisória para o fluxo local em desenvolvimento: e-mail e username não comprovam a posse da conta, então qualquer pessoa que conheça um identificador pode assumir o acesso. Não exponha essa operação em um ambiente compartilhado ou de produção.

A rota provisória `POST /api/auth/recover` recebe `{ identifier, newPassword, confirmPassword }`, valida o preenchimento e a confirmação da senha e retorna `200` quando atualiza a conta ou `404` quando não localiza o identificador. Essa resposta revela se a conta existe; o contrato também deverá ser substituído quando o fluxo seguro com token for implementado.

Antes do uso real, a redefinição deve exigir um token aleatório, temporário e de uso único enviado ao endereço de e-mail verificado da conta. Depois de validar esse token, o serviço pode atualizar a senha pelo `id` interno do usuário. O método `updatePasswordHash(id, newPasswordHash)` foi mantido comentado como referência para esse fluxo autenticado por token.

## Estado da implementação

O helper em `src/server/auth.ts` contém geração/verificação de hash e assinatura de token. A rota `POST /api/auth/signup` cria o usuário e suas categorias padrão individuais. A rota `POST /api/auth/signin` valida e-mail ou username com a senha e devolve o JWT. A emissão do token não implementa sua verificação nem protege outras rotas; middleware de autenticação, isolamento por usuário e testes do fluxo permanecem necessários antes de considerar a autenticação completa.

O contrato de cadastro e recuperação está evoluindo em BW-11 e a autenticação de sessão e proteção de rotas está definida em BW-09 no [backlog](BACKLOG.md). Atualize esta página conforme as rotas e a validação do JWT forem implementadas.
