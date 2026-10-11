# Organização e responsabilidades

O Synapse mantém um monólito modular. PostgreSQL é a fonte de verdade; Neo4j e Qdrant são projeções reconstruíveis.

## Backend

Rotas resolvem autenticação, parâmetros, acesso ao projeto, resposta HTTP e transação. Serviços recebem contexto explícito e não importam routers nem `core.dependencies`. Não criar repositórios genéricos para embrulhar SQLAlchemy.

- `review_workflow_service`: validação e transições canônicas, reabertura e projeção legada. Recebe horário explicitamente; não faz I/O ou commit.
- `review_decision_service` / `review_adaptation_service`: atribuições, revisão cega, quorum, conflitos, auditoria e coordenação.
- `article_response_service`: serialização pura, sem escrever na entidade ou carregar decisões privadas.
- `article_import_service`, `article_mutation_service`, `article_file_service`: importação, CRUD e política de PDF. O chamador controla commit/rollback.
- `article_dedup_service` / `article_report_service`: algoritmos de deduplicação e relatórios, independentes de HTTP.
- `article_index_jobs_service` / `index_worker`: outbox transacional e recuperação das projeções. Não compartilhar jobs com a síntese.
- `article_index_service`: coordena os adaptadores; recupera vetor existente ou gera embedding pelo fingerprint do resumo.
- `user_ai_service`: construção de IA por usuário, compartilhada por requisições e worker. Dependências FastAPI apenas compõem os serviços.

Erros novos usam `ApplicationError(code, message, status_code=..., context=...)`. A borda HTTP produz `{detail:{code,message,context?}}`; validação 422 usa `context.fields`. Mensagens inesperadas são sanitizadas. Respostas legadas continuam normalizadas durante a migração.

Python interno usa `snake_case`; campos públicos legados permanecem compatíveis. Serviços de mutação não fazem commit. Registrar trabalho de indexação antes do commit da alteração; nunca executar rede no lugar da gravação durável.

## Frontend

`app/AppShell` compõe dados e ações da aplicação. `Menu` recebe props. Páginas compõem features através de `features/<nome>/public/*`; imports relativos internos permanecem locais. Entradas públicas de PDF/grafo preservam carregamento lazy.

`useRemoteResource` controla dados/loading/error/reload por chave, descarta respostas antigas e invalida GETs anteriores quando recebe uma resposta de mutação. Não possui cache global nem controla navegação, toast ou rascunhos. Hooks de feature determinam invalidação e erros visíveis; rascunhos e conflitos permanecem separados.

Workspaces de revisão/extração e painéis de fila ficam em `features/articles/components`; ações persistentes ficam em hooks. Cálculos de analytics são funções puras em `features/projects/utils`, separados dos gráficos.

`hasExtractionValue` / `getExtractionProgress` são a única regra de progresso: espaços, arrays/objetos vazios e null não contam; `0` e `false` contam. Conclusão manual permanece explícita.

Metadados semânticos de frameworks vêm de `/api/projetos/frameworks`. Apresentação local permanece em `frameworkConfig`. Falha de catálogo mantém valores armazenados visíveis e bloqueia ações dependentes até nova tentativa.

## Verificações e testes

Instale runtime com `pip install -r backend/requirements.txt` e ferramentas com `pip install -r backend/requirements-dev.txt`; na imagem Linux Python 3.12 use `requirements-linux.lock`. Execute `npm ci` em `frontend`.

Na raiz: `./scripts/check-quality.ps1 -Python <python-do-venv>`. `-Integration` acrescenta testes PostgreSQL. CI executa qualidade e integração em PostgreSQL dedicado.

Testes são marcados `unit` ou `integration` pela necessidade de fixtures externas. Unitários não criam bancos. Bancos de integração recebem nomes únicos `synapse_test_*`, validados antes de criação/remoção. Configure `TEST_DATABASE_ADMIN_URL` e `TEST_DATABASE_URL_BASE` quando necessário. Migrações são verificadas com Alembic, sem substituir isso por `create_all`.

Ruff tem escopo explícito nos arquivos refatorados; a dívida dos demais arquivos permanece fora dessa primeira adoção e deve entrar junto da próxima mudança em cada área. JSDoc/checkJs começa em transporte, contratos e regras de extração; não equivale a toda a aplicação tipada. Testes AST/ESLint impedem regressões nas fronteiras de imports.

E2E: configure `E2E_BASE_URL` e sessões exclusivas de teste. `backend/tests/e2e_server.py` só inicia com `APP_ENV=test` e banco de testes, substituindo embeddings por resultados locais determinísticos. Nunca apontar esses testes ao banco de desenvolvimento/produção.
