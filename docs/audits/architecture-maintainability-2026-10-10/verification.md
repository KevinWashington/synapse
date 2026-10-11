# Verificação da refatoração — 11/10/2026

Entrega na branch `refactor/architecture-maintainability`, derivada de `5902948`, em `.worktrees/architecture-maintainability`. O checkout original e suas alterações preexistentes foram preservados.

## Responsabilidades e contratos

- Revisão individual e colaborativa compartilham validações, transições, reabertura e projeção legada. Serialização de artigos é pura.
- Relatórios, deduplicação, importação, CRUD e PDF têm serviços próprios. Rotas continuam responsáveis por autenticação, capacidades, projeto e transação.
- Indexação usa outbox PostgreSQL na transação da mutação; worker relê o estado atual, serializa por artigo e tenta novamente após falhas. Exclusões preservam IDs sem FK na outbox.
- Síntese declara respostas Pydantic concretas, incluindo texto paginado e valores dinâmicos da matriz. Composição de IA por usuário e MCP não depende da borda HTTP.
- Frontend compartilha ciclo de estado remoto com proteção contra respostas antigas, preserva rascunhos e separa workspaces, ações e cálculos de analytics.
- Shell compõe Menu; features expõem entradas públicas; catálogo semântico de frameworks vem da API, com valores armazenados visíveis durante falhas.
- Erros preservam status/códigos e usam envelope normalizado. Progresso de extração possui uma regra única para vazios, `0`, `false` e conclusão manual.

## Verificações executadas

| Verificação | Resultado |
|---|---|
| Backend completo, Linux Python 3.12 + PostgreSQL descartável | 312 testes passaram |
| Backend unitário sem banco | 173 passaram no comando de qualidade; 3 regressões AST adicionais passaram depois |
| Migrações | 9 testes passaram; bootstrap legado, upgrade e roundtrip 0005 → 0006 → 0005 → head |
| Ruff no escopo adotado | lint e formato passaram, 32 arquivos |
| Frontend | 384 Vitest + 3 Node passaram; typecheck, ESLint e build passaram |
| Comando unificado `scripts/check-quality.ps1` | passou na execução isolada |
| Imagem `synapse-refactor-verified` | build com lock Linux passou; `pip check` sem conflitos |
| Smoke real de índices | inclusão em Neo4j/Qdrant, notas preservando vetor, reinício com pendência e exclusão passaram |
| Playwright integrado | 9 passaram, 1 skip intencional: o fluxo completo de artigos cobre desktop e tela estreita em uma execução |

PostgreSQL/Neo4j/Qdrant/API/worker foram exclusivos desta execução, sem volumes do usuário. Embeddings E2E foram determinísticos e locais. Quatro atores fictícios usam sessões em arquivo ignorado; o seed recusa banco diferente de `synapse_refactor_test`. Google e fornecedores pagos não foram exercitados ao vivo.

Os testes de jobs cobrem rollback/commit, tentativas esgotadas visíveis, retomada após cancelamento, workers concorrentes, atualização seguida de exclusão, deduplicação de incluídos e exclusão de projeto concorrente com inserção. Falhas de grafo não impedem a tentativa no índice vetorial. Os testes de contratos cobrem respostas reais de charts/matriz e schemas OpenAPI.

Revisões independentes de backend e frontend identificaram problemas corrigidos antes da entrega: enqueue em dedup, lock de exclusão de projeto, contratos de chart/matriz, timeout por chamada, hidratação ao concluir polling, invalidação de GET após mutação, erro explícito do detalhe, fallback do framework e alias `@features` na regra de imports. O E2E revelou detalhe desatualizado após upload de PDF; o sucesso agora atualiza fila e detalhe.

## Evidências e limites

Os oito critérios da spec são cobertos por regressões de índices/workflow/serialização, progresso, estado remoto, conflitos, verificações de fronteiras e fluxos de navegador. A regra AST inclui imports de submódulos via `from app import routers` e formas relativas; ESLint cobre os aliases configurados, imports/exports e carregamento dinâmico. Screenshots e traces locais ficam em `frontend/test-results`; execuções não sobrescrevem mais auditorias versionadas.

A primeira tentativa de baseline teve infraestrutura indisponível, conforme [baseline](baseline.md). Seletores E2E de diálogos antigos foram atualizados para os painéis que já existiam no commit base; a aba Fila é aberta explicitamente em viewport estreito. O teste aguarda confirmação de salvamento antes de navegar e aceita múltiplas notificações do mesmo tipo. Execuções concorrentes causaram disputa de arquivos Playwright e timeouts de interface; a rodada final usa execução em série e diretório exclusivo.

Ruff e checkJs são adoções graduais, com escopos documentados; não significam que todo o legado foi formatado ou tipado. O build mantém um aviso preexistente de ciclo entre chunks `vendor` e `react-vendor`. A configuração CI foi adicionada e validada localmente pelos mesmos comandos; a execução no provedor remoto depende da integração da branch.

Aplicar a migration `0006_article_index_jobs` antes de iniciar API/worker no ambiente de destino. Busca possui consistência eventual. O [guia de operação](../../article-indexing.md) descreve inspeção, reconciliação e reversão preservando tarefas. Consulte [arquitetura](../../architecture.md) para novas mudanças.

Os commits iniciais isolam correções de erros, índices e progresso. T4–T7 e a infraestrutura backend foram integrados em um commit coeso porque compartilham router, transações e dependências; essa adaptação evita commits intermediários quebrados.
