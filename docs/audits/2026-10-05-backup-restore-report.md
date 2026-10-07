# Relatório de backup anterior às migrações

Data da execução: 2026-10-05 (America/Fortaleza)
Escopo: banco PostgreSQL local existente antes de alterações de autenticação ou esquema.

## Artefato verificado

- Arquivo: `synapse-postgres-20261006T013312Z.dump`
- Formato: dump customizado do PostgreSQL (`pg_dump -Fc`)
- Tamanho: 13.791.093 bytes
- SHA-256: `fa0991a94c664ac50b670c5d53e2fa54c7eca78421d78c484e9721f405334cc9`
- PostgreSQL: 16.14 (Debian 16.14-1.pgdg12+1)
- Armazenamento: diretório local ignorado pelo Git; o caminho absoluto e o conteúdo dos documentos não são registrados neste relatório.

## Prova de restauração

O dump foi restaurado no banco temporário isolado `synapse_restore_check_20261006T013312Z`. A restauração, a conferência do checksum e as consultas de integridade terminaram com sucesso. O banco temporário foi removido explicitamente ao final.

| Entidade | Linhas restauradas |
| --- | ---: |
| Usuários | 4 |
| Projetos | 16 |
| Artigos | 18.849 |

| Verificação de integridade | Resultado |
| --- | ---: |
| Projetos sem proprietário | 0 |
| Artigos sem proprietário | 0 |
| Artigos sem projeto | 0 |

## Dados derivados

- Neo4j 5.26.26 estava em execução. Não foi criado snapshot, pois o grafo é derivado dos dados relacionais e deve ser reconstruído.
- Qdrant 1.18.1 estava em execução. Não foi criado snapshot, pois os vetores são derivados dos dados relacionais e devem ser reconstruídos.

## Resultado

O backup atende ao gate anterior às migrações: arquivo não vazio, checksum confirmado, restauração concluída, contagens registradas e nenhuma referência órfã encontrada.
