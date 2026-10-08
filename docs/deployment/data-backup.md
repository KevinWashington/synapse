# Backup e restauração dos dados do Synapse

O backup precisa ser criado e restaurado com sucesso antes de qualquer migração de esquema. O PostgreSQL é a fonte autoritativa de usuários, projetos, artigos, decisões e evidências; Neo4j e Qdrant contêm dados derivados reconstruíveis.

## Criar o backup

Com os serviços atuais em execução, escolha uma pasta absoluta dedicada:

```powershell
$backupDirectory = "C:\backups\synapse-pre-migration"
powershell -File scripts\backup-data.ps1 `
  -OutputDirectory $backupDirectory `
  -PostgresContainer synapse-postgres
```

O comando cria um dump PostgreSQL em formato customizado e um manifesto adjacente com tamanho, SHA-256, versão do servidor e o estado dos serviços derivados. Arquivos de backup são ignorados pelo Git.

## Verificar por restauração

Use sempre um banco temporário novo cujo nome comece com `synapse_restore_check_`:

```powershell
$dump = "C:\backups\synapse-pre-migration\synapse-postgres-AAAAMMDDTHHMMSSZ.dump"
powershell -File scripts\verify-backup.ps1 `
  -BackupFile $dump `
  -TemporaryDatabase synapse_restore_check_20261005
```

A verificação confere o checksum, restaura o dump e contabiliza usuários, projetos, artigos e todas as tabelas de colaboração: membros, convites, atribuições, decisões, conflitos, notificações e auditoria. Também rejeita qualquer referência órfã dessas tabelas para projeto, artigo, usuário, atribuição ou decisão, inclusive IDs inexistentes ou incompatíveis no campo `review_conflicts.decisionIds`.

O relatório JSON registra `rowCounts`, `orphanCounts` e `integrityPassed`. Ele é escrito mesmo quando uma contagem órfã é diferente de zero; nesse caso o comando termina com erro, mas o diagnóstico continua disponível em formato legível por máquina. O banco restaurado é mantido para inspeção. Para removê-lo apenas após revisar o relatório, repita com um nome temporário novo e `-Cleanup`, ou remova explicitamente o banco já inspecionado.

Nunca use `synapse` como destino de restauração. O script recusa o nome de produção e também recusa sobrescrever um banco temporário existente.

## Retenção e relatório

Mantenha o dump, seu `*.backup-manifest.json` e o `*.restore-report.json` juntos em armazenamento criptografado. Registre no relatório de implantação somente o nome do arquivo, SHA-256, tamanho, contagens e resultados de integridade; não registre caminhos pessoais nem conteúdo dos artigos.

Uma migração pode começar somente depois de:

1. o dump possuir tamanho maior que zero e checksum válido;
2. a restauração terminar sem erro;
3. todas as contagens esperadas, inclusive as sete tabelas colaborativas, serem registradas;
4. `integrityPassed` ser `true` e todas as contagens de referências órfãs serem zero.

## Uso no rollout colaborativo

O dump deve ser criado **antes** da migração de colaboração. A ordem operacional é:

1. criar o dump pré-migração e guardar seu manifesto;
2. verificar o dump por restauração isolada em um novo `synapse_restore_check_*`;
3. revisar o relatório JSON e confirmar `integrityPassed=true`;
4. somente então implantar schema e código com `ASSIGNED_REVIEW_FLOW_ENABLED=false`.

Nunca execute a verificação contra o banco de produção, nunca reutilize um banco temporário existente e nunca use um arquivo que não seja um caminho absoluto terminado em `.dump`. O script mantém essas proteções obrigatórias.

Em rollback, preservar o dump e o relatório. A restauração do dump é uma medida de rollback em nível de banco e deve ocorrer somente em janela de manutenção, após retirada do tráfego e decisão explícita de descartar os dados posteriores ao backup. Não faça downgrade nem remova as tabelas colaborativas enquanto existirem linhas novas nelas.
