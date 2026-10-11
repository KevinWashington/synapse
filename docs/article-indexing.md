# Operação da indexação

Aplicar `python migrate_database.py` antes de iniciar API e workers. A revisão atual inclui `0006_article_index_jobs`, aditiva e sem alterações nos artigos existentes. A API apenas valida a revisão no startup. O Compose instala dependências na imagem e inicia `index-worker` após a API saudável.

Toda alteração relevante registra uma tarefa no mesmo commit SQL. Artigo/projeto excluído mantém IDs na outbox sem FK/cascade. O worker relê o artigo atual e sincroniza ou remove nos dois índices. Assim, uma tarefa antiga não ressuscita registros apagados. Locks PostgreSQL por artigo serializam workers e commits de mutações; exclusão de projeto também trava o projeto antes de listar IDs.

A busca tem consistência eventual: a decisão SQL fica disponível antes das projeções. A ausência do cache temporário de embedding não remove um vetor. Alteração do resumo compara fingerprint; falha de geração preserva o vetor anterior e deixa trabalho para nova tentativa.

Executar manualmente: `python -m app.index_worker`. Cada chamada externa tem timeout de 30 segundos. Há cinco tentativas, com intervalos de 5, 15, 60 e 300 segundos. Falha parcial não marca a tarefa como concluída. Interrupção desfaz o claim transacional; outro worker retoma a tarefa.

Consultar estado: `SELECT status, count(*) FROM article_index_tasks GROUP BY status;`. Erros persistidos são códigos sanitizados; detalhes ficam nos logs. Investigar tarefas `failed` antes de reprocessar.

Inspeção de reconciliação: `python -m app.index_worker --reconcile-project <id>`. O comando só lista IDs atuais e históricos. Para registrar novas tarefas e liberar falhas do projeto: acrescentar `--apply`. A operação usa SQL como fonte de verdade; inspecionar o destino e o resultado antes de aplicar em um ambiente compartilhado.

Rollback operacional: parar o novo worker e preservar a tabela e suas tarefas pendentes. Não apagar a outbox nem executar downgrade destrutivo como rotina de reversão. Ativar o worker novamente após corrigir o problema. O downgrade existe para validação de migration em banco descartável.

O smoke `python tests/index_projection_smoke.py` pressupõe o stack E2E descartável, `.e2e-sessions.json` local ignorado e o container `synapse-refactor-test-index-worker`. Exercita inclusão, atualização de notas com vetor preservado, parada/reinício e exclusão nos índices reais.
