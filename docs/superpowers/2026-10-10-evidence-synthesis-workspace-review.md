# Revisão final — workspace de síntese de evidências

## Resultado visual

O workspace mantém as quatro áreas — perguntas de pesquisa, matriz de extração, visualizações e avaliação da qualidade — sob o mesmo cabeçalho e métricas. Em telas estreitas, Lista/Conteúdo/Contexto viram regiões alternáveis; a tabela continua com scroll horizontal interno e não expande o documento. O E2E confirmou `document.documentElement.scrollWidth === window.innerWidth` em 1440×1024, 1024×768 e 390×844.

Capturas com 1.003 estudos simulados e 40 campos:

- [RQs — 1440 px](../audits/synthesis-workspace-2026-10-10/desktop-chromium-1440-rqs.png)
- [Matriz — 1440 px](../audits/synthesis-workspace-2026-10-10/desktop-chromium-1440-matrix.png)
- [RQs — 1024 px](../audits/synthesis-workspace-2026-10-10/desktop-chromium-1024-rqs.png)
- [Matriz — 1024 px](../audits/synthesis-workspace-2026-10-10/desktop-chromium-1024-matrix.png)
- [RQs — 390 px](../audits/synthesis-workspace-2026-10-10/desktop-chromium-390-rqs.png)
- [Matriz — 390 px](../audits/synthesis-workspace-2026-10-10/desktop-chromium-390-matrix.png)

O E2E foi repetido também no projeto Chromium mobile. Os endpoints foram interceptados com dados controlados; nenhuma chamada real à IA foi feita.

## Verificações

- Backend: `..\.venv\Scripts\python.exe -m pytest -q --disable-warnings` — 236 aprovados.
- Frontend: `npm run lint` — aprovado; `npm run test:ci` — 54 arquivos / 294 testes aprovados; `npm run build` — aprovado. O build ainda informa o aviso de chunks circulares `vendor`/`react-vendor`.
- Playwright: `npx playwright test e2e/synthesis-workspace.spec.js --project=desktop-chromium --project=mobile-chromium` — 2 aprovados. O cenário percorre os quatro modos nos viewports 1440×1024, 1024×768 e 390×844, verifica contenção horizontal e faz a primeira geração simulada.
- Compose: `docker compose config -q` — aprovado.
- Serviço local: `/ready` informa configuração, banco e migration `ok`.

## Limites operacionais

O Docker Desktop recusou acesso ao pipe do engine (`docker compose ps`: Access denied), então o container `synthesis-worker` não pôde ser iniciado nem o smoke real de geração com banco e worker executado. O worker está no Compose como `app.synthesis_worker`; uma inicialização/recriação dos serviços é necessária para habilitar geração em background. A rota de geração não executa o modelo dentro da requisição.

O teste Playwright simula as respostas HTTP; não substitui o smoke de recuperação do worker nem verifica interações de regeneração/falha/cancelamento/conflito de ponta a ponta. Esses caminhos têm cobertura nos testes unitários/integrados de serviços, rotas e componentes. Nenhuma chamada real ao modelo foi feita.

A revisão de código encontrou que uma falha ao salvar durante a navegação guardada poderia fechar o diálogo e perder a edição local. O fluxo agora só prossegue quando `save()` retorna o rascunho persistido; a falha é apresentada no próprio diálogo. A regressão está coberta em `SynthesisWorkspacePanel.test.jsx`.

O código deixa o módulo do worker em `backend/app/synthesis_worker.py`, pois o sandbox não autorizou criar `backend/app/workers/`. O efeito de runtime é o mesmo; o caminho difere do plano.

## Segurança e integridade

Leitura e escrita são autorizadas separadamente por capacidade de projeto. Jobs e rascunhos são persistidos antes da resposta, conflitos são HTTP 409 e não sobrescrevem conteúdo. Exportações percorrem páginas, aplicam escopo `filtered` ou `full`, escapam células de fórmula e mantêm Unicode/quebras de linha.

## Correção após uso local — 2026-10-10

O reinício simples deixou o backend com a imagem antiga de migrations. Logs anteriores mostravam 404 nas novas rotas; após o reinício as rotas estavam registradas, mas o container ainda identificava `0004_inbox_invite_consent` como head e não continha a migration de Síntese. `docker compose up -d --build --no-deps backend` atualizou a imagem e aplicou `0005_evidence_synthesis`. Consultas reais do projeto 7 retornaram 5 RQs, 3 estudos incluídos e 2 avaliados.

O smoke de dados também revelou que `overall` estava sendo aplicado como chave de resposta na listagem de Qualidade. A consulta geral agora lista os estudos incluídos; a distribuição respeita os mesmos filtros da lista. Esse caso tem regressão backend.

A composição passou a usar um único painel com divisórias, abas integradas, cabeçalho compacto e as mesmas cores/espaçamentos de Planejamento e Artigos. Os tokens de destaque antes indefinidos foram definidos no escopo da Síntese. Erros HTTP agora aparecem com tentativa novamente; atualizar dados conserva o rascunho local e recarrega o modo ativo.

Verificação desta correção: 12 testes backend de consultas/geração, 54 arquivos / 296 testes frontend, lint, build e os 2 E2E desktop/mobile aprovados. Houve um timeout inicial no teste de Artigos durante execução paralela com build; ele passou isoladamente e a suíte completa passou com `--maxWorkers=2`. As capturas foram atualizadas e inspecionadas. A validação visual usa o cenário E2E com dados simulados; a validação dos dados reais foi feita por consultas de leitura no backend. O worker real ainda não foi exercitado.

Este registro descreve a validação de Síntese de 2026-10-10. As verificações posteriores da refatoração e da correção no Neo4j estão no [relatório de arquitetura](../audits/architecture-maintainability-2026-10-10/verification.md).
