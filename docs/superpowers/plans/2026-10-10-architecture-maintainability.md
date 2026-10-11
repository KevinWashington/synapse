# Architecture and Maintainability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir inconsistências funcionais e tornar responsabilidades, contratos e padrões de frontend e backend verificáveis.

**Architecture:** Refatoração incremental do monólito modular. Centralizar regras e extrair serviços antes de reorganizar imports e componentes. Registrar indexação de forma durável em PostgreSQL e preservar contratos públicos por adaptadores.

**Tech Stack:** React/JavaScript, Vite, FastAPI, SQLAlchemy assíncrono, Alembic, PostgreSQL, Neo4j, Qdrant, pytest, Vitest e Playwright; ferramentas de qualidade introduzidas gradualmente.

**Spec:** `docs/superpowers/specs/2026-10-10-architecture-maintainability-design.md`

Status: plano proposto; nenhuma tarefa de implementação executada. Os nomes de arquivos novos abaixo são decisões de destino, não arquivos já existentes. Linhas citadas são referências da auditoria e devem ser revalidadas quando a tarefa começar.

## Global Constraints

- Preservar rotas públicas, autenticação por cookies/CSRF, capacidades e isolamento por projeto.
- Preservar revisão cega, atribuições, desempate, reabertura e adaptação da equipe.
- Preservar paginação no servidor, totais reais e carregamento de PDF sob demanda.
- Preservar rascunhos locais durante atualização, erro e conflito de versão.
- Preservar endpoints e campos legados por adaptadores; não renomear payloads em massa.
- Não alterar layout ou fluxos de produto como parte de uma extração estrutural.
- Não criar um repository genérico por tabela ou um framework interno de consultas.
- Separar correções funcionais de movimentos de código nos commits e revisões.
- Manter alterações locais preexistentes fora dos commits desta iniciativa.
- Migrações são aditivas, executadas pelo procedimento de deployment; a API continua apenas validando a revisão.

## Review Focus

- Artigo incluído recarregado do banco e edição de notas sem cache de embedding: vetor preservado ou reconstruído (T2).
- Falha parcial/reinício de worker e exclusão concorrente com atualização: tarefa retomável e ausência de ressurreição nos índices (T6).
- Mesmo screening por fluxo individual e colaborativo, seguido de reabertura: mesmo estado canônico, projeção compatível e permissões preservadas (T4).
- Troca rápida de projeto com respostas fora de ordem e falha da API: dados não atravessam projetos; erro não vira lista vazia (T8).
- Rascunho local e conflito 409, valores `0`/`false`, espaços e objetos vazios: texto preservado e progresso consistente (T1/T3).

## Sequência de entregas

| Etapa | Tarefas | Dependência | Resultado para revisão |
|---|---|---|---|
| Preparação | T0 | — | Baseline reproduzível e escopo isolado |
| Estabilização | T1–T3 | T0 | Erros, índices e progresso corrigidos |
| Backend | T4–T7 | T1–T3 | Regras únicas, rotas finas, jobs duráveis e contratos explícitos |
| Frontend | T8–T10 | T3/T7; T9 também depende de T8 | Consultas uniformes, telas coesas e fronteiras públicas |
| Padrões e encerramento | T11–T12 | Todas as entregas afetadas | Verificações automáticas e regressão integrada |

As etapas podem ser entregues separadamente. T1, T2 e T3 são independentes após o baseline. T8 pode começar enquanto o backend avança, usando os contratos de T1. O método de execução e o uso de agentes serão definidos antes da implementação; este documento não inicia execução.

## Convenções de execução

Comandos Python abaixo partem de `backend/` e usam `..\.venv\Scripts\python.exe`. Comandos npm partem de `frontend/`. Testes novos de bug devem falhar pelo comportamento esperado antes da correção e passar depois. Registrar a saída real; não considerar comando descrito neste plano como comando executado.

Em extrações puramente estruturais, caracterizar apenas lacunas relevantes e executar os testes comportamentais existentes. Não criar testes que só repetem a disposição dos arquivos. Cada tarefa termina em revisão e commit contendo apenas sua entrega; os comandos de commit são `git add <arquivos da tarefa>` e `git commit -m "<mensagem da tarefa>"`, com revisão prévia do diff staged.

### Task 0: Registrar baseline e preparar a execução

**Files:** criar `docs/audits/architecture-maintainability-2026-10-10/baseline.md`; consultar README, configurações, histórico e `git status`.

**Interfaces:** produz lista de verificações, resultados reais e alterações preexistentes. Não produz mudanças na aplicação.

- [ ] Criar isolamento de execução respeitando o estado local; identificar se o checkout já é uma worktree e não transportar alterações alheias automaticamente.
- [ ] Registrar `git status --short` e os requisitos de PostgreSQL/Neo4j/Qdrant e tokens E2E. Credenciais e tokens não entram no relatório.
- [ ] Executar baseline: backend `..\.venv\Scripts\python.exe -m pytest`; frontend `npm run lint`, `npm run test:ci`, `npm run build`.
- [ ] Executar os E2E de revisão/colaboração/síntese em banco exclusivo de testes. Revalidar a baseURL: o Playwright atual usa 5173, enquanto o Vite está configurado em 3000. Não usar dados do usuário para setups destrutivos.
- [ ] Registrar falhas preexistentes separadas de falhas introduzidas e confirmar o conjunto de regressão para cada entrega. Commit: `docs: record architecture refactor baseline`.

### Task 1: Corrigir e unificar o transporte de erros

**Files:** modificar `frontend/src/services/api.js`, `api.test.js`, `frontend/src/features/articles/hooks/useSynthesisWorkspace.js`, `useSynthesisWorkspace.test.jsx`; criar `backend/app/core/errors.py`, `backend/tests/test_error_contract.py`; modificar `backend/app/main.py` e os routers com formatos divergentes.

**Interfaces:** `ApiError(message, status, data)` preserva `.data` e adiciona `.code`; `ApplicationError(code: str, message: str, *, status_code: int, context: dict | None = None)` é independente de FastAPI; handlers HTTP produzem o envelope definido na spec.

- [ ] Adicionar testes para 409 com `detail.code/message`, respostas antigas com string ou `error/message`, 422 com lista de campos, erro de rede, 204 e download. No hook, afirmar `draft.dirty === true`, texto local intacto e `draft.conflict.code === 'SYNTHESIS_VERSION_CONFLICT'`.
- [ ] Reproduzir a falha atual de `error.detail` versus `ApiError.data`. Executar `npx vitest run src/services/api.test.js src/features/articles/hooks/useSynthesisWorkspace.test.jsx`.
- [ ] Implementar normalização no transporte e handlers; preservar códigos/status existentes. Manter o evento de chave DeepSeek ausente e sanitizar erros inesperados.
- [ ] Executar novamente os testes frontend e `..\.venv\Scripts\python.exe -m pytest tests/test_error_contract.py tests/test_google_auth.py tests/test_session_security.py`. Esperado: todos passam, inclusive CSRF/autenticação. Commit: `fix: standardize API error handling`.

### Task 2: Corrigir atualização e remoção dos índices

**Files:** criar `backend/app/services/article_index_service.py`, `backend/tests/test_article_index_service.py`; modificar `routers/articles.py:833`, `routers/collaboration.py:396`, `services/qdrant_retrieval_service.py`, `services/graph_sync_service.py`, `tests/test_article_index_sync.py`.

**Interfaces:** `ArticleIndexService(graph, vector, embedder)` recebe adaptadores; `async sync(article: Article, db: AsyncSession) -> None`; `async remove(*, article_id: int, project_id: int) -> None`. O método assíncrono `QdrantRetrievalService.get_article_point(*, article_id: int, project_id: int) -> dict | None` retorna vetor/payload quando existente e pertencente ao projeto.

- [ ] Escrever regressões: artigo incluído sem `_embedding_cache` não chama delete; atualização só de notas preserva vetor; conteúdo alterado reconstrói embedding; primeira inclusão gera vetor; ausência de abstract não apaga vetor válido; exclusão chama delete em ambos os índices, nunca upsert; artigo fora do corpus é removido.
- [ ] Executar `..\.venv\Scripts\python.exe -m pytest tests/test_article_index_service.py tests/test_article_index_sync.py` e confirmar a falha correspondente ao bug antes de implementar.
- [ ] Extrair serviço, montar dependências fora dele e remover import router→router. Comparar o texto usado no embedding por fingerprint no payload; sem fingerprint existente, reconstruir na primeira sincronização com conteúdo válido. Adaptar clientes síncronos com execução em thread; falha de embedding deve sinalizar falha, nunca exclusão.
- [ ] Preservar a disponibilidade da decisão SQL quando o índice falha, com log explícito. A recuperação automática só será garantida por T6; registrar essa limitação temporária na entrega.
- [ ] Executar regressões e testes de colaboração/adaptação afetados. Esperado: atualização preserva conteúdo vetorial e remoção é idempotente. Commit: `fix: preserve article indexes across updates and deletion`.

### Task 3: Unificar progresso de extração

**Files:** modificar `frontend/src/features/articles/utils/reviewWorkspace.js`, `reviewWorkspace.test.js`, `components/ProjectArticles.jsx:264`, `frontend/src/pages/ArticleDetails.jsx:83` e seus testes.

**Interfaces:** consumir as funções existentes `hasExtractionValue(value)` e `getExtractionProgress(article, schema)`; manter `{completed,total,state,label}` e o marcador de conclusão explícita.

- [ ] Acrescentar casos de objeto vazio e string com espaços; testar fila, detalhe e contagem do painel com o mesmo artigo. Afirmar `completed === 0` para esses vazios; `completed === 2` para `{a:0,b:false}` com duas colunas.

```javascript
expect(getExtractionProgress({ extractionData: { a: '  ', b: {} } }, [{ key: 'a' }, { key: 'b' }]))
  .toMatchObject({ completed: 0, state: 'not_started' });
expect(getExtractionProgress({ extractionData: { a: 0, b: false } }, [{ key: 'a' }, { key: 'b' }]))
  .toMatchObject({ completed: 2, state: 'in_progress' });
```

- [ ] Executar `npx vitest run src/features/articles/utils/reviewWorkspace.test.js src/features/articles/components/ProjectArticles.test.jsx src/pages/ArticleDetails.test.jsx` e reproduzir a inconsistência de UI.
- [ ] Substituir predicados duplicados pelos helpers; preservar os rótulos contextuais de artigo selecionado e a conclusão manual.
- [ ] Executar novamente os testes e a navegação de notas afetada. Commit: `fix: unify extraction progress rules`.

### Task 4: Centralizar transições, projeção legada e serialização

**Files:** criar `backend/app/services/review_workflow_service.py`, `article_response_service.py`, `backend/tests/test_review_workflow.py`, `test_article_response_service.py`; modificar `review_decision_service.py`, `review_adaptation_service.py`, `routers/articles.py:210`, `schemas/article.py` somente se necessário para DTOs existentes.

**Interfaces:** `apply_review_decision(article: Article, *, phase: str, decision: ReviewDecisionData, now: datetime) -> None`; dataclass `ReviewDecisionData(decision: str, reason_text: str | None, checklist_answers: dict, answering_rqs: list[int])`; `legacy_review_fields(article: Article) -> dict`; `build_article_response(article: Article) -> ArticleResponse`. Transição não faz commit; projeção/serialização não modificam `article`.

- [ ] Caracterizar estado ativo, screening incluído/excluído, elegibilidade incluída/excluída, texto indisponível, duplicata e reabertura. Afirmar equivalência do estado canônico entre decisão solo e consolidada e compatibilidade dos campos legados definidos na spec.
- [ ] Adicionar teste que captura campos da entidade antes/depois de serializar e afirma igualdade; cobrir decisões de pares ainda ocultas, PDF obrigatório, revisor sem atribuição e redistribuição.

```python
before = {name: getattr(article, name) for name in (
    "status", "manualDecision", "manualDecisionReason", "decisionUpdatedAt", "exclusionCriteria"
)}
response = build_article_response(article)
assert before == {name: getattr(article, name) for name in before}
assert response.reviewOutcome == article.reviewOutcome
```

- [ ] Executar `..\.venv\Scripts\python.exe -m pytest tests/test_review_workflow.py tests/test_article_response_service.py tests/test_review_decision_service.py tests/test_article_collaboration.py tests/test_review_adaptation_service.py`.
- [ ] Extrair regra canônica, adaptar ambos os fluxos e remover implementações duplicadas. Validação de negócio nessa regra usa `ApplicationError` de T1; autorização de capacidades e quorum colaborativo permanecem nos serviços atuais.
- [ ] Verificar regressões, inclusive concorrência de submissão em `tests/test_collaboration_concurrency.py`. Commit: `refactor: centralize review transitions and article projection`.

### Task 5: Extrair casos de uso do router de artigos

**Files:** criar `services/article_import_service.py`, `article_dedup_service.py`, `article_report_service.py`, `article_mutation_service.py`, `article_file_service.py`, `backend/tests/test_article_application_services.py`; modificar `routers/articles.py` e testes que importam helpers privados.

**Interfaces:** mover algoritmos de dedup/relatório preservando suas assinaturas de argumentos; publicar `analyze_duplicates`, `build_selection_report`, `build_synthesis_report`. Serviços assíncronos de mutação recebem `db: AsyncSession` e `access: ProjectAccess`, retornam entidades/DTOs e não fazem commit. Publicar `import_bibtex_articles(db, *, access, request, actor_user_id)`, `create_article(db, *, access, request, actor_user_id)`, `update_article(db, *, access, article_id, request, actor_user_id)`, `delete_article(db, *, access, article_id, actor_user_id)`. `ArticleFileService` mantém PDFs no armazenamento atual e recebe os mesmos identificadores/contexto; não introduz serviço externo.

- [ ] Identificar lacunas de caracterização em importação, normalização de DOI, dedup, promoção em lote, relatórios e upload. Reutilizar testes existentes e adicionar apenas os comportamentos não cobertos.
- [ ] Extrair uma responsabilidade por commit, primeiro relatórios/dedup, depois importação/mutações/arquivos. Routers retêm rotas e parâmetros; handlers chamam os serviços e controlam a transação.
- [ ] Adaptar testes para interfaces públicas; não manter helpers privados nos routers apenas para satisfazer monkeypatches antigos.
- [ ] Executar `..\.venv\Scripts\python.exe -m pytest tests/test_article_application_services.py tests/test_identification_bulk_promotion.py tests/test_article_collaboration.py tests/test_synthesis_queries.py tests/test_synthesis_exports.py`.
- [ ] Revisar que autorização, PDF sob demanda, totais paginados e regras de inclusão estão preservados. Commit final da tarefa: `refactor: extract article application services`.

### Task 6: Tornar a indexação durável e recuperável

**Files:** criar `backend/app/models/article_index.py`, `backend/app/services/article_index_jobs_service.py`, `backend/app/index_worker.py`, `backend/tests/test_article_index_jobs.py`, `backend/tests/test_article_index_concurrency.py`, `backend/migrations/versions/0006_article_index_jobs.py`; modificar exports de modelos, `migrations/env.py`, mutações de artigos/projetos, `docker-compose.yml` e documentação de deployment. Revalidar o número da migration contra o head antes de criar.

**Interfaces:** `enqueue_article_index(db, *, article_id: int, project_id: int) -> None` apenas faz flush; `process_article_index_task(task_id: int, *, session_factory, index_service) -> None` relê o artigo e sincroniza ou remove. Tarefa mantém IDs sem FK que desapareça em cascade, status, tentativas, próxima tentativa e erro sanitizado.

- [ ] Testar que rollback da mutação também remove a tarefa; commit preserva ambos; falha de Neo4j não perde o trabalho de Qdrant; reinício retoma pendências; dois workers não processam o mesmo artigo simultaneamente; exclusão durante sync termina com remoção de ambos os índices.
- [ ] Executar os testes novos antes da implementação. Cobrir explicitamente update→delete e delete→tarefa antiga, afirmando ausência de ressurreição.
- [ ] Implementar migração aditiva e fila SQL dedicada. Serializar processamento por artigo com lock PostgreSQL mantido durante a operação externa e timeout dos adaptadores; reusar o padrão operacional do worker de síntese, sem compartilhar tabelas/estado de jobs de síntese.
- [ ] Política inicial: no máximo 5 tentativas, esperas de 5/15/60/300 segundos, timeout de 30 segundos por chamada externa; esgotamento permanece visível como `failed` e pode ser reprocessado. Só marcar tarefa concluída depois dos dois índices. Reexecução deve ser idempotente.
- [ ] Substituir a sincronização pós-commit nas requisições por enqueue na transação. Cobrir edição/exclusão de artigo, alteração de inclusão, adaptação, reabertura e exclusão de projeto. Adicionar comando de reconciliação por projeto com modo de inspeção antes de aplicar.
- [ ] Executar `..\.venv\Scripts\python.exe -m pytest tests/test_article_index_jobs.py tests/test_article_index_concurrency.py tests/test_migrations.py`; validar migration/worker em banco exclusivo, parada/reinício e falha parcial. Commit: `feat: persist recoverable article index jobs`.

### Task 7: Formalizar respostas de síntese e desacoplar IA de HTTP

**Files:** modificar `backend/app/schemas/synthesis.py`, `routers/synthesis.py`, `core/dependencies.py`, `services/synthesis_jobs_service.py`; criar `services/user_ai_service.py`, `backend/tests/test_synthesis_contracts.py`; modificar `tests/test_user_ai_service.py`, `test_synthesis_routes.py`.

**Interfaces:** schemas `SynthesisOverviewResponse`, `RQListResponse`, `RQDetailResponse`, `EvidenceListResponse`, `MatrixResponse`, `ChartCatalogResponse`, `ChartResponse`, `QualityCriteriaResponse`, `QualityStudyListResponse`, `QualityStudyResponse`, `SynthesisDraftResponse`; reutilizar `GenerationStatus`. Schemas preservam chaves e nulabilidade efetivamente consumidas pelo frontend; campos dinâmicos de extração permanecem dicionários tipados.

- [ ] Capturar fixtures representativas de cada resposta JSON e validar contra schemas; cobrir vazio, paginação, datas, draft nulo e jobs cancelados/falhos. Afirmar no OpenAPI que cada rota JSON tem schema de saída concreto; exports/204 são exceções intencionais.
- [ ] Implementar `build_user_ai_service(user: User, vault: CredentialVault) -> AIService` no novo serviço; ausência/erro de chave usa exceção de aplicação de T1. FastAPI apenas resolve dependências e traduz erro; worker usa a mesma fábrica sem importar `core.dependencies`.
- [ ] Declarar modelos nas rotas, sem remover campos válidos por filtragem acidental. Executar `..\.venv\Scripts\python.exe -m pytest tests/test_synthesis_contracts.py tests/test_synthesis_routes.py tests/test_user_ai_service.py tests/test_synthesis_jobs.py`.
- [ ] Confirmar cancelamento, conflito e chave por usuário. Commit: `refactor: formalize synthesis contracts and AI composition`.

### Task 8: Padronizar estado remoto no frontend

**Files:** criar `frontend/src/hooks/useRemoteResource.js`, `useRemoteResource.test.jsx`; modificar `features/articles/hooks/useProjectArticles.js`, `useArticleDetailsPage.js`, `useSynthesisWorkspace.js` e respectivos testes.

**Interfaces:** `useRemoteResource({ key, enabled = true, load })` retorna `{ data, loading, error, reload }`. `key` identifica recurso/projeto/parâmetros; `load` é callback estável. Hook gerencia carregamento e descarte de respostas antigas, sem cache global, navegação, toast ou estado de rascunho.

- [ ] Testar troca de projeto com respostas fora de ordem, unmount, reload, erro após dados carregados e lista legitimamente vazia. Dados de uma chave antiga não aparecem na nova; erro preserva dados apenas da mesma chave e fica visível.
- [ ] Executar `npx vitest run src/hooks/useRemoteResource.test.jsx` antes/depois de implementar; migrar um recurso por vez, começando por projeto/lista do detalhe.
- [ ] Nos hooks de feature, explicitar a invalidação: decisão atualiza artigo/fila/resumo; dedup atualiza candidatos/fila/resumo; evidência atualiza artigo/síntese afetada. Remover recargas globais apenas depois de provar dependências com testes.
- [ ] Manter rascunhos e controle de conflito fora do recurso remoto. Polling tem cleanup, captura erro e evita chamadas sobrepostas.
- [ ] Executar os testes de hooks e páginas afetadas. Esperado: erro distinguível de vazio, contexto estável e rascunho preservado. Commit: `refactor: standardize remote resource lifecycle`.

### Task 9: Separar composição de tela, painéis e cálculos

**Files:** extrair de `pages/ArticleDetails.jsx` para `features/articles/components/details/PrismaExtractionWorkspace.jsx` e `PrismaArticleReviewWorkspace.jsx`; extrair `DuplicateReviewPanel.jsx`, `ArticleDetailPanel.jsx`, `StageSidebar.jsx` de `ProjectArticles.jsx` para `components/review`; criar `features/articles/hooks/useReviewWorkspaceActions.js`; extrair funções de analytics para `features/projects/utils/projectAnalytics.js` e gráficos para `components/analytics/ProjectAnalyticsCharts.jsx`.

**Interfaces:** preservar props dos componentes extraídos. `useReviewWorkspaceActions({ project, article, refreshArticle, refreshQueue, onGraphNeedsRefresh })` centraliza gravação/exportação e retorna ações/estados de mutação; componentes recebem callbacks. Utilitários de analytics preservam entradas/saídas de `buildStats`, `buildYearData`, `buildSourceData`, `buildStudyTypeData`, `buildStatusData`, `buildKeywordData`, `buildTrendData`.

- [ ] Executar a suíte existente de ProjectArticles, ArticleDetails, analytics e navegação de notas para caracterizar os comportamentos atuais; cobrir somente lacunas de cálculos críticos.
- [ ] Extrair componentes sem mudar markup, textos, atalhos, guardas de rascunho ou carregamento lazy de PDF. Preservar exports temporários usados pelos consumidores e removê-los quando a migração terminar.
- [ ] Migrar chamadas de persistência dos componentes para o hook de ações e reutilizar regras de T3. Substituir cards/cores duplicados por primitivas/tokens já existentes quando equivalentes.
- [ ] Executar `npx vitest run src/pages/ArticleDetails.test.jsx src/pages/ArticleDetails.notesNavigation.test.jsx src/features/articles/components/ProjectArticles.test.jsx src/features/projects/components/ProjectAnalytics.test.jsx` e build.
- [ ] Executar E2E de revisão e analytics desktop/mobile em ambiente de testes. O critério é responsabilidade coesa e comportamento preservado, não um teto de linhas. Commit: `refactor: separate article workspaces and analytics presentation`.

### Task 10: Definir fronteiras de features e fonte única de frameworks

**Files:** criar `frontend/src/app/AppShell.jsx`, `features/articles/public/{components,hooks,services}.js`, `features/projects/public/services.js`, `features/collaboration/public/services.js`, `features/projects/hooks/useFrameworkCatalog.js`; modificar `App.jsx`, `pages/Layout.jsx`, `components/Menu.jsx`, imports consumidores, `projectService.js`, `useProjectPlanning.js`, `lib/frameworkConfig.js`; criar testes do catálogo.

**Interfaces:** `projectService.getFrameworks()` consome `/api/projetos/frameworks`; `useFrameworkCatalog()` retorna `{ frameworks, loading, error, reload }`. Metadados semânticos vêm da API; `frameworkConfig.js` retém apenas apresentação local e helpers que recebem o catálogo. Entradas públicas exportam apenas símbolos necessários à integração.

- [ ] Mapear consumidores e separar composição da aplicação de UI compartilhada. `Menu` recebe dados/ações por props a partir do shell; não busca projetos por conta própria.
- [ ] Migrar imports cruzados para entradas públicas, mantendo imports relativos internos à própria feature. Composição de artigos/projetos/colaboração ocorre na página/shell ou em componente público de integração.
- [ ] Testar catálogo disponível, falha, nova tentativa e framework desconhecido em projeto antigo. Falha não substitui/salva framework diferente; dados do projeto permanecem visíveis, com ações dependentes do catálogo desabilitadas e erro explícito.
- [ ] Executar testes de planejamento, criação de projeto, Menu e `npm run build`. Confirmar que entradas públicas não carregam PDF/grafo antecipadamente. Commit: `refactor: define feature interfaces and framework source`.

### Task 11: Automatizar padrões e isolar infraestrutura de testes

**Files:** criar `docs/architecture.md`, `backend/pyproject.toml`, `backend/requirements-dev.txt`, `backend/tests/conftest.py`, `backend/tests/test_architecture_boundaries.py`, `frontend/jsconfig.check.json`, `frontend/src/types/api.js`, `scripts/check-quality.ps1`, `.github/workflows/quality.yml`; modificar `.gitignore` para permitir versionar `.github`, ESLint/package scripts, requirements de runtime/dev e fixtures legadas.

**Interfaces:** comando raiz `./scripts/check-quality.ps1` executa as verificações; comando frontend `npm run typecheck` usa `tsc --project jsconfig.check.json`; projeto de verificação tem `allowJs`, `checkJs`, `noEmit` e inclui inicialmente transporte/contratos/regras puras. Testes recebem banco exclusivo por execução e os marcadores `unit`/`integration`.

- [ ] Documentar direção das dependências, transações, erros, convenções e local para novas responsabilidades. Configurar ESLint contra deep imports entre features e dependência de negócio em UI compartilhada, considerando as entradas de T10.
- [ ] Adicionar TypeScript apenas como ferramenta de análise e JSDoc dos arquivos incluídos; expandir o escopo por área corrigida. Usar o lockfile para reprodutibilidade. Introduzir Ruff para lint/formatação com regras iniciais de sintaxe/imports e escopo explícito; registrar dívida antiga sem silenciar novas violações.
- [ ] Escrever teste de dependências por AST para impedir serviço→router/dependências HTTP e router→router. Testes validam imports reais, não buscas frágeis por substrings.
- [ ] Centralizar fixtures e migrar cada suíte que cria bancos fixos. Validar nome/prefixo de banco de testes antes de qualquer reset; testes unitários não disparam fixture autouse de PostgreSQL. Não usar `Base.metadata.create_all` como substituto dos testes de migration.
- [ ] Fixar dependências resolvidas de runtime/dev, remover instalação de pacotes no startup do Compose e preservar a imagem reprodutível. Introduzir CI com unitários/lint/build em toda mudança e integração em PostgreSQL dedicado; cenários E2E de serviços externos usam ambiente/fakes controlados.
- [ ] Verificar `..\.venv\Scripts\python.exe -m pytest -m unit` no backend; `npm run typecheck`, `npm run lint`, `npm run test:ci`, `npm run build` no frontend; `./scripts/check-quality.ps1` na raiz. Commit: `chore: enforce architecture and quality checks`.

### Task 12: Regressão integrada e entrega operacional

**Files:** criar `docs/audits/architecture-maintainability-2026-10-10/results.md`; atualizar README e documentação de deployment/indexação; modificar testes E2E apenas para cobrir lacunas de comportamento.

**Interfaces:** produz evidências reais, instruções de operação/reprocessamento e lista residual de melhorias fora desta entrega.

- [ ] Executar a suíte backend e os checks frontend completos uma vez após a integração das tarefas.
- [ ] Executar `npx playwright test article-flow-stability.spec.js collaboration-flow.spec.js synthesis-workspace.spec.js team-adaptation.spec.js analytics-layout.spec.js` em ambiente exclusivo, com tokens de teste e baseURL configurados. Falta de infraestrutura é registrada como verificação pendente, nunca como aprovação.
- [ ] Exercitar inclusão→busca, edição de notas→busca, exclusão→ausência nos índices, falha/reinício do worker, conflito de síntese e reabertura colaborativa.
- [ ] Registrar contratos preservados, responsabilidades extraídas, resultado dos limites de importação e migrações testadas. Verificar os oito critérios globais da spec.
- [ ] Revisar diff completo, confirmar que alterações preexistentes ficaram fora e preparar a entrega. Commit: `docs: record architecture refactor verification`.

## Limites e riscos acompanhados

- Nenhum prazo foi estimado antes do baseline; o volume de testes de integração e consumidores privados pode alterar o esforço de extração.
- A entrega intermediária T2 corrige perda de índices, mas a recuperação garantida de falhas depende de T6.
- A indexação assíncrona introduz consistência eventual: edição SQL fica disponível antes da conclusão de grafo/vetor. Isso precisa estar documentado para operação e testes.
- Verificação de tipos é incremental e não equivale a uma aplicação totalmente tipada.
- Mudanças de schema público, armazenamento de PDFs, redesign visual e nova arquitetura distribuída ficam fora deste plano.

## Handoff

Antes de escrever código, revisar a spec e este plano, confirmar as decisões de compatibilidade e escolher a execução. Recomenda-se execução sequencial nesta sessão, porque as tarefas compartilham contratos e a migração deve manter cada etapa utilizável. Revisões independentes podem ser concentradas nas entregas de revisão canônica, indexação durável e fechamento. Este documento registra o planejamento; a implementação ainda não começou.
