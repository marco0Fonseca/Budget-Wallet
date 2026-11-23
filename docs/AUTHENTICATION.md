# Autenticação e JWT

## Configuração local

O backend usa `jsonwebtoken` para assinar tokens e `bcrypt` para gerar hashes de senha. Configure estas variáveis no ambiente do servidor:

| Variável | Uso | Padrão atual |
| --- | --- | --- |
| `JWT_SECRET` | Segredo usado para assinar tokens | `your-secret-key-change-in-production` (temporário para desenvolvimento local) |
| `JWT_EXPIRES_IN` | Validade do token | `7d` |

O segredo deve permanecer no backend e nunca ser enviado ao frontend, commitado em arquivos ou incluído em logs. O valor padrão é apenas uma conveniência temporária de desenvolvimento; antes de qualquer ambiente compartilhado ou produção, configure um segredo forte e privado.

## Uso do token

Após autenticação bem-sucedida, o servidor pode devolver o JWT ao cliente. Em requisições posteriores a rotas protegidas, o cliente envia:

```http
Authorization: Bearer <token>
```

O servidor deve verificar assinatura e validade antes de aceitar a requisição. A identidade do usuário deve vir do conteúdo verificado do token, nunca de um `userId` confiado no corpo ou nos parâmetros enviados pelo cliente. Respostas públicas não devem incluir hash de senha, segredo JWT ou detalhes internos de exceções.

## Estado da implementação

O helper em `src/server/auth.ts` contém geração de hash e assinatura de token. A rota `POST /api/auth/signup` cria o usuário, suas categorias padrão individuais e emite um token. A emissão de token no cadastro, por si só, não implementa verificação do token nem protege outras rotas; login, middleware de autenticação, isolamento por usuário e testes do fluxo permanecem necessários antes de considerar a autenticação completa.

O contrato de cadastro está evoluindo em BW-11 e a autenticação de sessão e proteção de rotas está definida em BW-09 no [backlog](BACKLOG.md). Atualize esta página conforme as rotas e a validação do JWT forem implementadas.
