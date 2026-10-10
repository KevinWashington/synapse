# Evidence Synthesis Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a aba Síntese em um workspace de evidências rastreáveis, com quatro modos consistentes, navegação escalável e rascunhos editáveis gerados por IA.

**Architecture:** Consultas SQL paginadas e agregadas alimentam um workspace React com regiões de índice, conteúdo e contexto. Rascunhos compartilhados por projeto/RQ têm controle otimista de versão e fingerprint das evidências; a geração usa a chave DeepSeek do solicitante em um trabalho persistido, com processamento em lotes e substituição atômica. A implementação reaproveita componentes e padrões existentes de Planejamento e Artigos, sem alterar os fluxos de extração e avaliação da qualidade.

**Tech Stack:** FastAPI, SQLAlchemy assíncrono, PostgreSQL, Alembic, serviço DeepSeek existente; React 19, Vite, Tailwind, Radix, Recharts; pytest, Vitest/Testing Library e Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-evidence-synthesis-workspace-design.md`

## Global Constraints

- Preservar `Perguntas de pesquisa`, `Matriz de extração`, `Visualizações` e `Avaliação da qualidade` como modos do mesmo workspace.
- Cabeçalho: `Síntese da revisão`; propósito: `Transforme dados extraídos em respostas sustentadas`.
- Layout estreito: `Lista`, `Conteúdo`, `Contexto`, com regiões montadas para preservar estado.
- Primeira geração com conteúdo vazio salva automaticamente; regeneração de conteúdo existente exige confirmação explícita.
- Falha, cancelamento, conflito ou resultado inválido nunca substituem conteúdo anterior.
- Sínteses são compartilhadas; leitura usa `CAP_READ_PROJECT`, escrita/geração usa `CAP_EDIT_PROJECT`.
- Usar credenciais DeepSeek por usuário; não persistir chave em trabalho, log ou payload.
- Nenhum PDF completo enviado à IA; nenhuma geração autônoma ao abrir uma aba.
- Paginar e filtrar no servidor, não carregar todo o corpus no navegador.
- Manter exports CSV/JSON; export filtrado não significa apenas a página visível.
- Em 390 px, largura do documento deve ser igual à largura do viewport.
- Não introduzir rich-text editor, biblioteca de virtualização, Redis/Celery ou novos serviços externos.
- Executar no diretório atual conforme preferência do usuário; não refatorar componentes compartilhados sem necessidade.
- Este documento planeja a implementação: sua criação não altera a aplicação nem inicia chamadas pagas.

## Review Focus

1. RQs reordenadas, editadas ou duplicadas não podem herdar silenciosamente uma resposta de outra pergunta — testes da tarefa 2.
2. Geração longa concorrente com edição, mudança de evidências ou reinício do worker deve preservar o texto válido — tarefas 5 e 9.
3. Justificativa de seleção ou avaliação por IA não é uma citação textual do artigo — pacote tipado e testes da tarefa 4.
4. Milhares de estudos, títulos longos e dezenas de campos não podem produzir consulta sem limite ou overflow global — tarefas 3, 10 e 14.
5. Troca de RQ/aba/projeto com alterações locais e respostas assíncronas fora de ordem não pode perder texto nem misturar seleções — tarefas 7, 9 e 13.

---

## Mapa de arquivos e responsabilidades

### Backend

- Criar `backend/app/models/synthesis.py`: rascunho e trabalho de geração persistidos.
- Criar `backend/app/schemas/synthesis.py`: contratos Pydantic de consultas, respostas e escrita.
- Criar `backend/app/services/synthesis_identity_service.py`: identidade de RQ e reconciliação no Planejamento.
- Criar `backend/app/services/synthesis_query_service.py`: projeções SQL, filtros, paginação e agregados.
- Criar `backend/app/services/synthesis_generation_service.py`: pacotes, fingerprints, lotes, redução e validação.
- Criar `backend/app/services/synthesis_job_service.py`: ciclo de vida, leases e aplicação atômica de resultados.
- Criar `backend/app/services/synthesis_export_service.py`: exportação iterativa do escopo completo ou filtrado.
- Criar `backend/app/workers/__init__.py` e `backend/app/workers/synthesis_worker.py`: execução durável com PostgreSQL.
- Criar `backend/app/routers/synthesis.py`: autorização e endpoints dedicados.
- Criar `backend/migrations/versions/0005_evidence_synthesis.py`; atualizar `models/__init__.py` e `migrations/env.py`.
- Modificar `backend/app/routers/projects.py`, `backend/app/routers/articles.py`, `backend/app/main.py`, `backend/app/config.py` e `docker-compose.yml` nos pontos de integração.
- Criar testes focados `backend/tests/test_synthesis_*.py` e apoio `backend/tests/synthesis_test_support.py`; atualizar `test_migrations.py`.

### Frontend

- Criar `frontend/src/features/articles/services/synthesisService.js` e `hooks/useSynthesisWorkspace.js`: API e estado/concorrência do workspace.
- Criar em `frontend/src/features/articles/components/synthesis/`: `SynthesisWorkspaceShell.jsx`, `SynthesisHeader.jsx`, `SynthesisRQMode.jsx`, `SynthesisDraftEditor.jsx`, `SynthesisMatrixMode.jsx`, `SynthesisDataTable.jsx`, `SynthesisVisualizationsMode.jsx`, `SynthesisQualityMode.jsx`.
- Modificar `SynthesisReportPanel.jsx`: composição dos modos; `RQSynthesisPanel.jsx`: retirar a implementação antiga após migrar todos os consumidores.
- Modificar `frontend/src/pages/ProjectDetails.jsx`, `hooks/useProjectArticles.js`, `services/articleService.js` e `utils/synthesisExport.js`: integração e compatibilidade.
- Criar testes colocalizados para os novos componentes/hook/serviço; atualizar `SynthesisReportPanel.test.jsx`, `ProjectDetails.test.jsx` e `synthesisExport.test.js`.
- Criar `frontend/e2e/synthesis-workspace.spec.js` e `docs/superpowers/reviews/2026-10-10-evidence-synthesis-workspace.md`: QA visual e evidências finais.

Todos os caminhos abreviados neste mapa pertencem a `frontend/src/features/articles/`, exceto onde o caminho completo está indicado.

## Contratos compartilhados

Definir os contratos na tarefa 1; as tarefas seguintes consomem esses nomes. JSON usa camelCase, como as APIs existentes. Identificadores de artigo/projeto mantêm os tipos atuais do modelo, sem inventar novos IDs públicos.

- `Page[T] = {items, page, pageSize, total}`; páginas começam em 1, padrão 20, máximo 100. Ordenação sempre tem desempate por ID; busca/filtro novo volta à página 1.
- `SynthesisFilters`: `search`, `rqNumber`, `yearFrom`, `yearTo`, `source`, `qualityRating`, `completion` (`all|complete|partial|empty`); ausentes não são serializados.
- `SynthesisContent`: `narrative`, `keyFindings`, `divergences`, `limitations`; cada item das três listas contém `text` e `articleIds`; `citations` contém `articleId` e título resolvido pelo servidor. Referências da narrativa são mostradas como fontes, não marcadores textuais inventados.
- `RQSummary`: `rqNumber`, `question`, `evidenceCount`, `draftState` (`not_started|draft|stale`), `duplicateQuestion`.
- `RQDetail`: `question`, `rqNumber`, `questionFingerprint`, `draft` (ou null), `activeGeneration` (ou null), `context`; draft contém `content`, `version`, `evidenceFingerprint`, autoria, horários e metadados do modelo. `context` inclui cobertura, qualidade, lacunas e freshness, nunca um score artificial de consistência.
- `EvidencePacket`: `articleId`, `title`, `year`, `excerpt`, `excerptKind`, `extractionValues`, `quality`, `rqNumbers`, `truncated`; `excerptKind` distingue `selection_reason|ai_evaluation|reviewer_note|extracted_value|none`.
- `GenerationRequest`: `expectedVersion` (0 se ausente), `questionFingerprint`, `replaceExisting`, `idempotencyKey` (UUID do clique).
- `GenerationJob`: `id`, `rqNumber`, `status` (`queued|running|succeeded|failed|cancelled|conflict`), `completedBatches`, `totalBatches`, `errorCode`; nunca inclui chave/prompt completo em resposta pública.
- Escrita manual: `{expectedVersion, questionFingerprint, content}`. Conflito retorna HTTP 409 com `SYNTHESIS_VERSION_CONFLICT`; cliente retém edição local.
- Conteúdo existente significa narrativa ou qualquer item textual não vazio após trim; somente referências não contam como conteúdo. Uma gravação manual não atualiza o fingerprint das evidências nem torna automaticamente atual um rascunho desatualizado.

## Sequência de implementação

Comandos backend abaixo partem de `backend/`: `..\.venv\Scripts\python.exe -m pytest ...`. Comandos frontend partem de `frontend/`. Antes de executar, ler spec e plano completos, verificar status Git e preservar alterações alheias. Cada commit inclui somente os arquivos daquela tarefa, nunca `git add .`.

### Tarefa 1: Persistência e contratos da síntese

**Arquivos:** modelos, schemas, migration, registros de metadata; `backend/tests/test_synthesis_models.py`, `test_migrations.py`, `synthesis_test_support.py`.

**Interfaces:** produz `RQSynthesis`, `SynthesisGenerationJob` e os DTOs acima. Modelos usam FKs compatíveis com `Project`/`User`, JSON para conteúdo/pacotes e versão inteira inicial 1.

- [ ] Escrever `test_one_active_draft_per_project_rq`, `test_archive_retains_content`, `test_job_contains_no_credentials` e teste upgrade/downgrade da revisão: afirmar unicidade ativa, preservação do conteúdo, FKs e defaults.
- [ ] Rodar `..\.venv\Scripts\python.exe -m pytest tests/test_synthesis_models.py tests/test_migrations.py -q`; confirmar falha pela ausência da nova revisão/modelos.
- [ ] Implementar migration `0005_evidence_synthesis` sobre `0004_inbox_invite_consent`: draft com snapshot/fingerprint, versão, conteúdo, fontes, autoria/horários/modelo; `rqNumber` nullable para registros arquivados e índice único parcial `(projectId,rqNumber)` para ativos. Trabalho guarda snapshot de entrada, versão esperada, idempotency key por projeto/solicitante, progresso, lease, tentativas, erro e resultado validado.
- [ ] Implementar schemas com limites de tamanho, enumerações e rejeição de IDs/tipos inválidos; fixtures de integração usam apenas banco explicitamente terminado em `_test`, sem fixture destrutiva autouse.
- [ ] Repetir testes; exigir PASS e upgrade até head. Commit: `feat: persist versioned research question syntheses`.

### Tarefa 2: Identidade de perguntas e freshness

**Arquivos:** `synthesis_identity_service.py`, `projects.py`; `backend/tests/test_synthesis_identity.py`.

**Interfaces:** produz `normalize_question(text: str) -> str`, `question_fingerprint(text: str) -> str`, `reconcile_research_questions(db, *, project, previous: list[str], current: list[str]) -> None`. Fingerprint de evidência será produzido pela tarefa 4.

- [ ] Escrever testes `test_unique_question_follows_reorder`, `test_edited_question_is_stale_candidate`, `test_duplicates_match_by_occurrence`, `test_removed_question_is_archived`, `test_reorder_remaps_current_article_links_without_rewriting_history`; afirmar preservação do texto e ausência de colisão/transação parcial.
- [ ] Rodar `..\.venv\Scripts\python.exe -m pytest tests/test_synthesis_identity.py -q`; confirmar RED.
- [ ] Normalizar Unicode NFC, espaços e casefold; hash SHA-256. Reconciliar sob lock do projeto: correspondências exatas por ocorrência primeiro; restantes na mesma posição ficam candidatas desatualizadas; deslocadas sem destino são arquivadas. Liberar posições antes das movimentações na mesma transação para evitar colisões do índice.
- [ ] Integrar antes do commit de `update_project` apenas quando `researchQuestions` muda. Remapear os vínculos atuais `Article.answeringRQs` das perguntas reconhecidas, remover vínculos de perguntas removidas e manter posição para edição da mesma pergunta; não reescrever decisões históricas. Dados sugeridos por IA não se tornam vínculos finais por esse remapeamento.
- [ ] Repetir testes incluindo rollback; exigir PASS. Commit: `feat: preserve synthesis identity across planning changes`.

### Tarefa 3: Consultas escaláveis e agregados consistentes

**Arquivos:** `synthesis_query_service.py`; `backend/tests/test_synthesis_queries.py`.

**Interfaces:** produz métodos assíncronos `get_overview(db, project)`, `list_rqs(db, project, *, search, state, page, page_size) -> Page[RQSummary]`, `get_rq_detail(db, project, rq_number) -> RQDetail`, `list_evidence(db, project, rq_number, filters, *, page, page_size, order)`, `list_matrix(db, project, filters, *, page, page_size, columns)`, `get_matrix_article(db, project, article_id)`, `get_chart_catalog(db, project, filters)`, `get_chart(db, project, chart_key, filters, *, page, page_size)`, `get_quality_criteria(db, project, filters)`, `list_quality_studies(db, project, criterion_key, filters, *, page, page_size)` e `get_quality_study(db, project, article_id)`; listas retornam `Page`, agregados DTOs tipados.

- [ ] Escrever testes para inclusão/fallback legado, vínculos RQ inválidos, filtros combinados antes da paginação, páginas vazias, ordenação estável, projeção sem `pdfData`, agregados no escopo completo e qualidade após mudança do schema. Usar 1.003 estudos em `test_large_corpus_has_bounded_pages` e capturar SQL para provar LIMIT/projeção.
- [ ] Rodar `..\.venv\Scripts\python.exe -m pytest tests/test_synthesis_queries.py -q`; confirmar RED.
- [ ] Implementar seleção explícita de colunas; reutilizar semântica de `_is_included_for_synthesis` e qualidade do `evidence_service`. Extrair helpers pequenos compartilhados se necessário, sem refatorar o restante de `articles.py`. Calcular count, distribuição e cobertura no SQL; para respostas de qualidade JSON, preservar a fórmula existente em expressão equivalente testada.
- [ ] Paginar RQs e linhas no servidor; manter catálogos de campos/critério limitados ao schema configurado. Charts categóricos: top 12 + `Outros`, com regra declarada; qualitativos retornam tabela paginada. Não atribuir campo a RQ por semelhança textual: conservar regra existente e expor o mapeamento no contexto.
- [ ] Repetir testes; exigir PASS e nenhuma consulta de corpus com ORM completo. Commit: `feat: query bounded synthesis evidence and aggregates`.

### Tarefa 4: Geração estruturada com fontes e lotes limitados

**Arquivos:** `synthesis_generation_service.py`, `config.py`; `backend/tests/test_synthesis_generation.py`.

**Interfaces:** produz `build_evidence_packets(rows, project) -> list[EvidencePacket]`, `evidence_fingerprint(question: str, packets: list[EvidencePacket]) -> str`, `generate_synthesis(ai_service, *, question: str, packets: list[EvidencePacket], on_progress) -> SynthesisContent` e `validate_content(content, *, allowed_article_ids) -> SynthesisContent`.

- [ ] Escrever testes com modelo falso: `test_fingerprint_ignores_unrelated_updated_at`, `test_fingerprint_tracks_relevant_changes`, `test_selection_reason_is_not_article_quote`, `test_rejects_unknown_citation_ids`, `test_thousand_studies_use_bounded_map_reduce`, `test_empty_evidence_never_calls_model`, `test_invalid_json_does_not_produce_content`.
- [ ] Rodar `..\.venv\Scripts\python.exe -m pytest tests/test_synthesis_generation.py -q`; confirmar RED.
- [ ] Construir pacotes somente com projeções da tarefa 3; ordenar determinísticamente por ID e chaves JSON. Fingerprint inclui pergunta, vínculos, inclusão, valores, qualidade e proveniência; não inclui data genérica do artigo. Truncamento deve ser registrado, não oculto.
- [ ] Implementar geração via `AIService` existente, saída validada por Pydantic. Budget inicial configurável de 24.000 caracteres de payload, 6.000 por pacote, 2 chamadas concorrentes, timeout por chamada de 90 s; contar prompt e entrada serializados antes de enviar. Reduzir hierarquicamente saídas limitadas até caber; rejeitar ausência de progresso na redução. Preservar IDs em cada nível e validar também resultado final contra o corpus original.
- [ ] Prompt distingue evidência extraída de justificativa/nota/avaliação automática; proíbe citações literais e conclusões não sustentadas. Ausência de evidência curada gera limitação explícita, não certeza. Repetir testes; exigir PASS e nenhuma chamada real DeepSeek. Commit: `feat: generate bounded traceable synthesis drafts`.

### Tarefa 5: Trabalho durável e substituição atômica

**Arquivos:** `synthesis_job_service.py`, `workers/synthesis_worker.py`, `workers/__init__.py`, `docker-compose.yml`; `backend/tests/test_synthesis_jobs.py`.

**Interfaces:** produz `enqueue_generation(db, *, project, user, rq_number, request) -> GenerationJob`, `claim_job(db, *, worker_id)`, `run_claimed_job(job_id, *, lease_token)`, `cancel_generation(db, *, project, user, job_id)` e `save_manual_draft(db, *, project, user, rq_number, request) -> RQDetail`.

- [ ] Escrever testes de primeira geração salva, regeneração sem confirmação rejeitada, conteúdo antigo visível durante execução, falha/timeout/cancelamento preservam conteúdo, idempotência, save concorrente retorna 409, evidência alterada retorna conflito e worker reiniciado não aplica resultado duplicado.
- [ ] Rodar `..\.venv\Scripts\python.exe -m pytest tests/test_synthesis_jobs.py -q`; confirmar RED.
- [ ] No enqueue, validar chave via dependência existente, bloquear projeto/RQ brevemente, validar snapshot/versão e persistir entrada imutável; permitir apenas um job ativo por projeto/RQ, retornando 409 para outro clique e o mesmo job para a mesma idempotency key. No worker, recuperar solicitante e credencial pelo vault existente; revalidar usuário ativo e capacidade de edição antes de gerar e antes de aplicar. Nunca levar transação aberta à chamada do modelo.
- [ ] Claim com `FOR UPDATE SKIP LOCKED`, lease de 180 s/heartbeat a cada 30 s e token CAS; recuperar leases expirados com no máximo 2 tentativas totais. Antes de aplicar, validar cancelamento, token, identidade, versão e fingerprint atual: mudança retorna `EVIDENCE_CHANGED`/conflict e preserva conteúdo. Sucesso grava draft e job na mesma transação.
- [ ] Adicionar worker ao Compose usando mesma imagem/env do backend, sem nova fila externa; `python -m app.workers.synthesis_worker`, encerramento gracioso e verificação da revisão do banco. Repetir testes e smoke com worker/modelo falso; exigir PASS. Commit: `feat: persist and safely execute synthesis generation jobs`.

### Tarefa 6: API autorizada, exports e transição do relatório antigo

**Arquivos:** `routers/synthesis.py`, `main.py`, `articles.py`, `synthesis_export_service.py`; `backend/tests/test_synthesis_routes.py`, `test_synthesis_exports.py`.

**Interfaces:** base `/api/projetos/{projectId}/synthesis`; GET `/overview`, `/rqs`, `/rqs/{n}`, `/rqs/{n}/evidence`, `/matrix`, `/matrix/{articleId}`, `/charts`, `/charts/{key}`, `/quality/criteria`, `/quality/studies`, `/quality/studies/{articleId}`. POST `/rqs/{n}/generations` retorna 202; GET `/generations/{id}`; POST `/generations/{id}/cancel`; PATCH `/rqs/{n}`; DELETE `/rqs/{n}` exige versão esperada e confirmação explícita. GET `/exports/{kind}` com `kind=matrix.csv|report.json|distributions.csv|quality.csv`, `scope=filtered|full` e filtros.

- [ ] Escrever testes 404 entre projetos, leitura sem escrita, chave ausente/ inválida sem mutação, CSRF, 409 por versão, validação dos limites de página, IDs de artigo fora do corpus, cancelamento e exclusão explícitos; exports com múltiplas páginas, Unicode, quebras de linha e valores iniciados por fórmulas.
- [ ] Rodar `..\.venv\Scripts\python.exe -m pytest tests/test_synthesis_routes.py tests/test_synthesis_exports.py -q`; confirmar RED.
- [ ] Implementar rotas finas usando `resolve_project_access` e `require_capability`; erros DeepSeek mantêm contrato acionável existente. Consultar job exige leitura do projeto; cancelar exige `CAP_EDIT_PROJECT` no mesmo projeto, inclusive para o solicitante, nunca acesso só por ID de job.
- [ ] Exportar iterativamente sem acumular corpus completo; CSV com quoting e proteção a fórmula; JSON streaming válido. Export filtrado inclui todas as páginas do filtro; full ignora filtros explicitamente. Fontes e autoria do rascunho entram no relatório.
- [ ] Alterar `/{projectId}/artigos/synthesis-report` e `/rq-synthesis` para usar agregados e páginas com defaults limitados, mantendo campos legados necessários até a tarefa 13. Documentar metadados de paginação; nenhum consumidor pode interpretar primeira página como corpus completo. Repetir testes; exigir PASS. Commit: `feat: expose authorized synthesis workspace APIs and exports`.

### Tarefa 7: Cliente e estado assíncrono por seleção

**Arquivos:** `services/synthesisService.js`, `hooks/useSynthesisWorkspace.js` e respectivos `.test.js`/`.test.jsx`.

**Interfaces:** produz `synthesisService` com métodos correspondentes à tarefa 6 e `useSynthesisWorkspace({projectId, canEdit, onDirtyChange}) -> {mode, setMode, selections, filters, pages, resources, draft, actions}`. Resources usam `{data,loading,error}` por chave de projeto/modo/seleção/filtro; ações incluem seleção, filtro, paginação, refresh, generate, save, cancel e export.

- [ ] Escrever testes de parâmetros omitidos, troca de projeto, resposta fora de ordem, manter último resultado em erro, reset de página ao filtrar, polling finalizado/desmontado, evento de chave ausente e rascunho local preservado em 409.
- [ ] Rodar `npx vitest run src/features/articles/services/synthesisService.test.js src/features/articles/hooks/useSynthesisWorkspace.test.jsx`; confirmar RED.
- [ ] Usar `api.js` existente e AbortController/identificador de requisição; chavear cada cache por seleção e filtros. Buscar apenas região ativa e pré-requisitos agregados; não pré-carregar corpus dos quatro modos. Poll a cada 2 s só enquanto job ativo; retomar job conhecido ao voltar à RQ. Export usa `requestRaw`/Blob com download e liberação de URL.
- [ ] Estado editável conserva versão base e dirty; geração não sobrescreve edição local posterior ao clique. Em conflito, expor comparação entre local e salvo e ação explícita de recarregar, nunca retry que force overwrite. Repetir testes; exigir PASS. Commit: `feat: manage synthesis workspace queries and drafts`.

### Tarefa 8: Shell comum e cabeçalho compacto

**Arquivos:** `SynthesisReportPanel.jsx`, `synthesis/SynthesisWorkspaceShell.jsx`, `synthesis/SynthesisHeader.jsx`, `SynthesisReportPanel.test.jsx` e teste do shell.

**Interfaces:** `SynthesisReportPanel({project, onDirtyChange, onOpenArticle})`; `SynthesisWorkspaceShell({index,content,context,region,onRegionChange})`; `SynthesisHeader({overview,loading,onRefresh,onExport})`.

- [ ] Escrever testes das quatro abas nomeadas, troca de região sem desmontar conteúdo, métricas agregadas, menu único de exports, loading localizado, permissões e navegação por teclado.
- [ ] Rodar `npx vitest run src/features/articles/components/SynthesisReportPanel.test.jsx src/features/articles/components/synthesis/SynthesisWorkspaceShell.test.jsx`; confirmar RED.
- [ ] Compor grid de três regiões no breakpoint `xl`, seguindo `AdaptiveReviewWorkspace`; abaixo, tabs Lista/Conteúdo/Contexto com painéis mantidos montados e só painel ativo acessível. Usar `min-w-0`, alturas/scroll contidos e switcher horizontal limitado. Não editar o shell de Artigos.
- [ ] Implementar copy aprovada, compactar métricas no cabeçalho e agrupar refresh/export; estados vazio e erro explicam dependência de estudos incluídos. Repetir testes; exigir PASS. Commit: `feat: compose adaptive evidence synthesis workspace`.

### Tarefa 9: RQs, editor e geração segura

**Arquivos:** `synthesis/SynthesisRQMode.jsx`, `synthesis/SynthesisDraftEditor.jsx` e testes colocalizados.

**Interfaces:** `SynthesisRQMode({workspace,onOpenArticle})`; `SynthesisDraftEditor({detail,value,dirty,canEdit,job,onChange,onSave,onGenerate,onCancel})`, usando `SynthesisContent` da tarefa 1 sem transformação destrutiva.

- [ ] Escrever testes de índice paginado/busca/estados, pergunta completa, primeira geração auto-salva, confirmação somente com conteúdo existente, texto antigo durante geração, erro e retry, read-only, evidência vazia, stale, pergunta duplicada, conflito de versão e edição feita enquanto IA executa.
- [ ] Rodar `npx vitest run src/features/articles/components/synthesis/SynthesisRQMode.test.jsx src/features/articles/components/synthesis/SynthesisDraftEditor.test.jsx`; confirmar RED.
- [ ] Editor com narrativa e listas de achados/divergências/limitações editáveis, fontes navegáveis, autoria/data e Salvar explícito; sem nova biblioteca rich text. Regenerar abre diálogo que informa substituição somente após sucesso. Chave ausente oferece Configurações; não apaga texto.
- [ ] Evidências paginadas com busca/filtros/ordenação por qualidade, título, ano, valores e rótulo de proveniência. Contexto traz cobertura, lacunas e freshness sem inferir consenso dos percentuais. Antes de trocar RQ com dirty, oferecer salvar/descartar/cancelar; primeira abertura de uma RQ mostra Conteúdo no layout estreito.
- [ ] Repetir testes; exigir PASS, live status de geração e fontes com nomes acessíveis incluindo título. Commit: `feat: edit and generate traceable research question findings`.

### Tarefa 10: Matriz contida, paginada e legível

**Arquivos:** `synthesis/SynthesisMatrixMode.jsx`, `synthesis/SynthesisDataTable.jsx` e testes colocalizados.

**Interfaces:** `SynthesisMatrixMode({workspace,onOpenArticle})`; `SynthesisDataTable({columns,rows,selectedCell,onSelectCell,onOpenArticle,pagination,onPageChange})`. Coluna contém `key,label,width,pinned`; célula selecionada identifica artigo e campo, não índice da página.

- [ ] Escrever testes de grupos/busca/toggle de campos, filtros no request antes da paginação, seleção de célula abre valor completo, sticky/pinned por classes e estilos, export filtrado vs full e preservação das colunas ao trocar modo.
- [ ] Rodar `npx vitest run src/features/articles/components/synthesis/SynthesisMatrixMode.test.jsx src/features/articles/components/synthesis/SynthesisDataTable.test.jsx`; confirmar RED.
- [ ] Implementar tabela própria com colgroup, largura fixa por coluna, header sticky e título/ano pinned; título tem elemento block truncado dentro de célula limitada. Container com overflow-x auto não expande grid/documento. Não modificar `components/ui/Table.jsx` globalmente.
- [ ] Contexto mostra valor integral e metadados do campo/estudo; índice agrupa campos base, por RQ e apoio. Página padrão 20 e anúncio da faixa; export usa endpoint, não array de linhas renderizadas. Repetir testes; exigir PASS. Commit: `feat: build scalable contained extraction matrix`.

### Tarefa 11: Visualizações com contexto e dados subjacentes

**Arquivos:** `synthesis/SynthesisVisualizationsMode.jsx` e teste colocalizado.

**Interfaces:** `SynthesisVisualizationsMode({workspace,onShowMatrix,onOpenArticle})`; `onShowMatrix(filters)` muda modo e aplica exatamente o escopo do gráfico.

- [ ] Escrever testes de um único gráfico selecionado, catálogo agrupado, qualitativo como tabela paginada, top 12 + Outros, missing/sample size, acessibilidade e navegação para matriz filtrada.
- [ ] Rodar `npx vitest run src/features/articles/components/synthesis/SynthesisVisualizationsMode.test.jsx`; confirmar RED.
- [ ] Usar Recharts existente, apenas agregados retornados; contexto informa origem/tipo/filtros/amostra/ausentes/agregação. Disponibilizar tabela dos dados e resumo textual, incluindo vazio/sem valores. Tabelas qualitativas reutilizam `SynthesisDataTable`, sem gráficos comprimidos.
- [ ] Repetir testes; exigir PASS e nenhum cálculo baseado somente na página atual. Commit: `feat: explain synthesis visualizations with evidence context`.

### Tarefa 12: Qualidade conectada aos estudos

**Arquivos:** `synthesis/SynthesisQualityMode.jsx` e teste colocalizado.

**Interfaces:** `SynthesisQualityMode({workspace,onOpenArticle})`, consumindo catálogo de critérios, agregados, lista e detalhe da tarefa 3.

- [ ] Escrever testes de distribuição geral/critério, busca/filtros/paginação, seleção de estudo, justificativa/respostas completas, qualidade ausente, schema sem critérios e seleção fora da nova página/filtro.
- [ ] Rodar `npx vitest run src/features/articles/components/synthesis/SynthesisQualityMode.test.jsx`; confirmar RED.
- [ ] Índice lista geral e critérios; centro mostra distribuição e estudos; contexto mostra respostas/justificativa/score do estudo selecionado e Abrir no workspace. Não criar edição de qualidade nesta aba. Ao filtro remover estudo selecionado, limpar detalhe com mensagem, sem mostrar dado de outra seleção.
- [ ] Repetir testes; exigir PASS e métricas independentes da página. Commit: `feat: connect quality distributions to source studies`.

### Tarefa 13: Integração e proteção de alterações locais

**Arquivos:** `frontend/src/pages/ProjectDetails.jsx`, `ProjectDetails.test.jsx`, `hooks/useProjectArticles.js`, `services/articleService.js`, `utils/synthesisExport.js`, `utils/synthesisExport.test.js`, `RQSynthesisPanel.jsx` e consumidores encontrados por `rg`.

**Interfaces:** ProjectDetails fornece `project`, capacidades e `onDirtyChange`; abrir artigo conserva `/projetos/{id}/artigos/{articleId}?flow=included&workspace=extracao`. Hooks antigos deixam de tratar relatório limitado como conjunto completo.

- [ ] Escrever testes de alternar Planejamento/Síntese/Artigos, sair com dirty, beforeunload, projeto diferente, read-only, refresh preservando editor e exports legados. Assertar que abrir Síntese não chama endpoint legado fetch-all.
- [ ] Rodar `npx vitest run src/pages/ProjectDetails.test.jsx` e `node --test src/features/articles/utils/synthesisExport.test.js`; confirmar novas asserções RED.
- [ ] Transferir fetch de Síntese para hook dedicado; combinar dirty de Planejamento e Síntese nos guards existentes. Troca de projeto limpa cache; aba interna conserva filtros/seleções. Interceptar navegação para artigo quando editor estiver dirty; não assumir que tabs são a única forma de sair.
- [ ] Migrar todos os consumidores antes de retirar `RQSynthesisPanel`/helpers mortos. Preservar exports públicos úteis e CSV/JSON existentes; downloads de corpus usam servidor. Conferir com `rg` ausência de consumidor dependente de listas completas do relatório antigo.
- [ ] Repetir testes e `npm run test:ci`; exigir PASS. Commit: `feat: integrate synthesis with project navigation safely`.

### Tarefa 14: Verificação integrada e revisão visual

**Arquivos:** `frontend/e2e/synthesis-workspace.spec.js`, `docs/superpowers/reviews/2026-10-10-evidence-synthesis-workspace.md`; ajustes focados nos arquivos anteriores conforme evidência.

**Interfaces:** cenários E2E simulam as APIs das tarefas 6/7; smoke local usa banco de teste e modelo falso. Nenhuma geração real paga necessária para verificar o fluxo.

- [ ] Escrever Playwright com 1.003 estudos, 40 campos, títulos e valores longos, RQs duplicadas, missing data e páginas vazias; criar cenários de gerar/salvar, confirmar regeneração, falhar, cancelar, stale e 409. Mock deve retornar páginas limitadas e totais reais, não todos os artigos.
- [ ] Rodar `npx playwright test e2e/synthesis-workspace.spec.js --project=desktop-chromium`; registrar resultado inicial e reproduzir falhas observadas antes de correções finais, sem fabricar RED quando o comportamento já estiver correto.
- [ ] Verificar os quatro modos em 1440×1024, 1024×768 e 390×844: `document.documentElement.scrollWidth === window.innerWidth`, scroll interno da matriz, header/pinned columns, foco e diálogos não encobertos, tabs por teclado, fontes navegáveis e estados mantidos. Capturar screenshots e registrar achados/correções na revisão, sem dados privados.
- [ ] Rodar backend `..\.venv\Scripts\python.exe -m pytest -q`; frontend `npm run test:ci`, `npm run lint`, `npm run build` e os E2E desktop/mobile. Executar smoke Compose: migration aplicada, worker recupera job interrompido, primeira geração persiste, leitor não escreve. Registrar comandos/saídas; separar falha de infraestrutura de falha do produto.
- [ ] Conferir matriz spec → tarefas, contratos API e ausência de overflow com inspeção dos screenshots; corrigir e repetir verificações afetadas. Commit: `test: verify synthesis workspace across evidence sizes and viewports`.

## Critério de conclusão e handoff

- Quatro modos entregues no mesmo padrão visual de Planejamento/Artigos; sem perda dos exports e vínculos ao workspace.
- IA salva a primeira geração válida, pede confirmação para substituir e preserva conteúdo em todos os caminhos de erro/conflito/cancelamento.
- Filtros, contagens, listas e exports funcionam com corpus grande; nenhuma consulta pública carrega PDFs ou coleção completa para paginar no cliente.
- Autorização, credenciais, identidade das RQs, versões concorrentes e freshness verificadas por testes.
- Evidências de testes e screenshots revisadas; não declarar concluído somente porque build passou.
- Não fazer push/deploy nem iniciar geração real automaticamente. Ao entregar, informar migrations/worker necessários e qualquer limitação observada.

## Revisão do plano

Revisão de cobertura realizada contra a spec: identidade/freshness (2–5), permissões/IA (4–6), quatro modos e responsividade (8–12), exports/escala (3, 6, 10–12), alterações locais (7, 9, 13), acessibilidade/QA (8–14). A escolha por paginação no servidor satisfaz a alternativa prevista na spec e evita nova biblioteca de virtualização. O worker persistido operacionaliza geração em lotes sem depender de uma requisição de navegador longa; não amplia o escopo para automação autônoma.
