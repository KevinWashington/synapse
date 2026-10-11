# Correção de arquitetura e manutenibilidade

Data: 2026-10-10
Status: implementada e verificada em 11/10/2026; integração da branch pendente da escolha do usuário. Resultados em `docs/audits/architecture-maintainability-2026-10-10/verification.md`.

## Objetivo e contexto

O usuário aprovou a direção da auditoria de frontend e backend e solicitou um plano de correção. O resultado esperado é tornar responsabilidades, contratos e dependências previsíveis, reduzindo a chance de uma alteração exigir mudanças em vários lugares.

A auditoria inicial foi estática. A execução registrou um baseline, reproduziu os problemas de indexação e divergências de regras e acrescentou regressões comportamentais. Não foi realizada medição de desempenho.

## Abordagens consideradas

1. **Refatoração incremental do monólito modular — recomendada.** Corrigir comportamento, centralizar regras e extrair responsabilidades em entregas pequenas. Aproveita serviços, features, testes e workers existentes. Exige manter adaptadores temporários até todos os consumidores migrarem.
2. **Reorganização física ampla logo no início.** Cria uma árvore uniforme rapidamente, mas aumenta o volume de imports alterados sem resolver, por si só, duplicação e acoplamento.
3. **Reescrita ou separação em aplicações/serviços independentes.** Aumenta coordenação, contratos e operação. A auditoria não identificou uma necessidade que justifique esse custo.

## Restrições

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

## Arquitetura de destino

### Backend

Manter a estrutura atual `routers`, `schemas`, `models` e `services` durante a primeira migração. A responsabilidade de cada serviço passa a ser funcional e explícita:

- Routers traduzem HTTP, resolvem o contexto autenticado e chamam casos de uso.
- Serviços de aplicação coordenam autorização, consultas, mutações e tarefas pendentes.
- Regras de revisão e projeção legada têm uma implementação canônica, sem FastAPI.
- Serialização constrói DTOs e nunca modifica a entidade SQLAlchemy.
- Adaptadores de IA, embedding, Qdrant e Neo4j expõem operações explícitas e aceitam dependências substituíveis em testes.
- O chamador do caso de uso controla uma transação SQL. Serviços internos usam `flush` quando necessário e não fazem commits ocultos. O worker abre e encerra suas próprias transações.
- Serviços não importam routers nem providers de dependência FastAPI. Routers não importam helpers privados de outros routers.

Extrair primeiro indexação, regras de revisão, respostas, deduplicação e relatórios. Mudanças físicas adicionais de pastas só devem ocorrer depois que as dependências estiverem claras.

### Frontend

- `src/app` concentra composição entre features, providers, rotas e layout de aplicação.
- `src/pages` permanece como adaptação de rota e composição de telas.
- `features/*/components` contém UI da funcionalidade; `hooks` contém consultas, mutações e coordenação; `utils` contém regras puras.
- `components/ui` e componentes compartilhados não buscam dados de negócio.
- Features publicam interfaces pequenas por entradas específicas: serviços, hooks e componentes de integração. Não reexportar toda a feature num barrel que prejudique o carregamento lazy.
- `services/api.js` permanece o transporte HTTP único.
- Estado remoto tem identidade por projeto e parâmetros, estado explícito de erro e descarte de respostas antigas. Estado de edição local permanece separado.

## Decisões de comportamento

### Revisão e compatibilidade

`currentPhase` e `reviewOutcome` determinam o fluxo. Campos legados são projeções de compatibilidade. A primeira unificação preserva o formato observável da API atual, incluindo `manualDecision="incluido"` após screening incluído na projeção legada; isso não significa inclusão final no corpus. A inclusão final é definida por `reviewOutcome="included"`.

A projeção cobre `duplicate_removed`, exclusões, texto indisponível, estados ativos e reabertura. Leitura/serialização não altera esses campos no banco. Regras de permissão e consolidação colaborativa permanecem nos serviços que já as implementam; não serão substituídas por verificações simplificadas de dono.

### Extração

`hasExtractionValue` e `getExtractionProgress`, em `reviewWorkspace.js`, são a fonte única do frontend. Espaços, objetos vazios, listas vazias, `null` e `undefined` não contam como preenchimento; `0` e `false` contam. `extractionCompletedAt` continua sendo o marcador de conclusão explícita.

### Indexação

Ausência de `_embedding_cache` nunca significa exclusão. Para artigo incluído, atualização de metadados preserva um vetor válido existente; primeira indexação ou alteração do conteúdo usado no embedding exige gerar o vetor correspondente. Exclusão é uma operação explícita para artigo removido ou retirado do corpus.

Na primeira entrega, corrigir atualização/remoção e tornar dependências testáveis. Na entrega de durabilidade, registrar uma tarefa na mesma transação SQL da alteração, processá-la fora da requisição e repetir falhas. PostgreSQL é a fonte de verdade; Neo4j e Qdrant são projeções reconstruíveis.

O processamento é serializado por artigo, inclusive entre workers. Cada tarefa relê o estado atual, evita ressuscitar artigos removidos, possui tentativas limitadas e permite reprocessamento manual. A falha de um índice não marca ambos como concluídos. Exclusões mantêm os identificadores necessários mesmo após a remoção SQL.

### Erros e respostas

Contrato público: `{"detail":{"code":"CODIGO_ESTAVEL","message":"Mensagem pública","context":{}}}`; `context` é opcional. Preservar status HTTP e códigos existentes. Normalizar erros de validação 422, mantendo informações dos campos em `context.fields`. Falhas inesperadas recebem mensagem pública sanitizada e detalhes apenas nos logs.

No frontend, `ApiError.data` é a propriedade canônica; `ApiError.code` facilita decisões por código. O transporte normaliza também respostas antigas durante a migração. O conflito de síntese preserva o rascunho e expõe o código/mensagem recebidos.

Respostas JSON de síntese recebem schemas Pydantic explícitos. Downloads e respostas 204 mantêm seu comportamento próprio. Metadados semânticos de frameworks vêm do endpoint já existente; cores e apresentação permanecem no frontend.

## Padronização e testes

- Documentar nomenclatura: Python interno em `snake_case`; componentes React em PascalCase; hooks com `use`; campos da API legada preservados.
- Adotar lint/formatação de Python com introdução por arquivos alterados e baseline explícito para dívida preexistente.
- Adotar verificação gradual de JavaScript com JSDoc/checkJs, começando no transporte, contratos e regras puras; não converter toda a aplicação para TypeScript nesta iniciativa.
- Definir limites de imports verificáveis, cobrindo backend e frontend.
- Separar testes puros de testes que precisam de PostgreSQL; fixtures com banco exclusivo por execução e validação do alvo antes de reset.
- Usar fakes de IA/Google em verificações automáticas; não depender de chaves pessoais ou chamadas pagas.

## Critérios globais de conclusão

1. Notas e inclusão não removem vetores por ausência de cache; exclusão remove projeções externas.
2. Decisões individuais e colaborativas usam a mesma transição e projeção de estado.
3. Serialização é livre de mutações; não há imports router→router ou serviço→dependência HTTP.
4. Fila, detalhes e painel concordam sobre progresso de extração.
5. Erro de rede é distinguível de lista vazia; respostas de outro projeto não substituem o contexto atual.
6. Conflitos preservam rascunhos e o contrato de erro é consistente.
7. As verificações de arquitetura, contratos e qualidade rodam por um comando documentado e na integração contínua.
8. Fluxos de revisão, síntese, colaboração e PDFs passam na regressão funcional acordada.

## Entrega e reversão

Cada tarefa do plano produz uma entrega revisável. Extrações estruturais não dependem de migração de dados. O worker de índices é ativado somente depois da migração e dos testes de recuperação. Ao reverter o worker, preservar sua tabela e os trabalhos pendentes; não apagar tarefas nem reconstruir índices automaticamente. A reconciliação dos índices é executada primeiro em banco de testes e depois de forma controlada no ambiente de destino.
