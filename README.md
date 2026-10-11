# Synapse

Aplicação web para apoiar revisões sistemáticas de literatura com IA, busca semântica e grafo de conhecimento.

## Stack

- React 19, Vite e Tailwind CSS
- FastAPI, SQLAlchemy assíncrono e Alembic
- PostgreSQL/pgvector, Neo4j e Qdrant
- Google Identity Services para autenticação
- DeepSeek com uma chave opcional e exclusiva por usuário

## Requisitos

- Docker e Docker Compose
- Um OAuth Client ID do tipo Web no Google Cloud
- Token do Hugging Face quando os recursos de embeddings forem usados
- Chave DeepSeek apenas para cada usuário que quiser usar funções de IA

O backend não aceita uma chave DeepSeek compartilhada. Cada usuário pode cadastrar, substituir ou excluir sua própria chave em **Configurações**; ela é armazenada criptografada e nunca volta em texto puro pela API.

## Configuração local

Copie os exemplos de ambiente:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Configure o mesmo Google Client ID em `GOOGLE_CLIENT_ID`, no backend, e `VITE_GOOGLE_CLIENT_ID`, no frontend. No Google Cloud, autorize as origens locais usadas no desenvolvimento, normalmente `http://localhost:3000` e `http://localhost:5173`.

Gere segredos próprios para a sessão e para o cofre de credenciais:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Use os valores em `SESSION_SECRET` e `CREDENTIAL_ENCRYPTION_KEY`, respectivamente. Consulte [o checklist de produção](docs/deployment/production-checklist.md) para a configuração completa.

## Executar com Docker

```powershell
docker compose up -d --build
```

| Serviço | URL local |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:5000 |
| Swagger | http://localhost:5000/docs |
| Neo4j | http://localhost:7474 |
| Qdrant | http://localhost:6333/dashboard |

Qualquer conta Google válida pode entrar. Se o e-mail já existir na base legada, o primeiro login Google vincula essa conta e preserva projetos e artigos.

## Desenvolvimento e validação

```powershell
# Backend
cd backend
..\.venv\Scripts\python.exe -m pytest

# Frontend
cd ..\frontend
npm run lint
npm run test:ci
npm run build
npm run test:e2e
```

O E2E local usa uma sessão de teste gerada pelo backend para validar as áreas autenticadas sem criar um atalho de autenticação na aplicação. O login Google real precisa de um Client ID válido.

A organização das camadas e o comando unificado de qualidade estão em [Arquitetura e responsabilidades](docs/architecture.md). Consulte [Operação da indexação](docs/article-indexing.md) para migração, worker, tentativas e reconciliação.

## Produção

O domínio planejado é `https://synapse.labit.dev.br`. Antes de liberar tráfego, ainda é necessário configurar DNS, TLS e o OAuth Client no Google Cloud. Siga:

- [Checklist de produção](docs/deployment/production-checklist.md)
- [Auditoria Playwright e UX](docs/audits/2026-10-06-playwright-product-audit.md)
- [Relatório do backup e restauração](docs/audits/2026-10-05-backup-restore-report.md)
- [Procedimento de backup](docs/deployment/data-backup.md)

