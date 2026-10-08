# Checklist de produção do Synapse

Data de referência: 6 de outubro de 2026.

## Dependências externas pendentes

- Criar o registro DNS de `synapse.labit.dev.br` apontando para a infraestrutura de produção.
- Emitir e renovar automaticamente um certificado TLS válido.
- Criar um OAuth Client ID Web no Google Cloud.
- Autorizar `https://synapse.labit.dev.br` como origem JavaScript no OAuth Client. O fluxo atual usa o callback do Google Identity Services e não requer uma URI de redirecionamento própria.
- Configurar os segredos no gerenciador de segredos da infraestrutura, nunca em arquivos versionados.

## Ambiente do backend

Definir, no mínimo:

```env
APP_ENV=production
PUBLIC_APP_URL=https://synapse.labit.dev.br
GOOGLE_CLIENT_ID=<client-id-web-do-google>
SESSION_SECRET=<segredo-aleatorio-forte>
SESSION_COOKIE_NAME=synapse_session
SESSION_COOKIE_SECURE=true
SESSION_TTL_MINUTES=10080
CREDENTIAL_ENCRYPTION_KEY=<chave-de-criptografia>
ALLOWED_ORIGINS=https://synapse.labit.dev.br
DATABASE_URL=<postgresql-asyncpg-de-producao>
NEO4J_URI=<neo4j-de-producao>
NEO4J_USER=<usuario>
NEO4J_PASSWORD=<segredo>
QDRANT_URL=<qdrant-de-producao>
QDRANT_COLLECTION=articles
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com
HF_TOKEN=<token-quando-necessario>
ASSIGNED_REVIEW_FLOW_ENABLED=false
```

Não definir `DEEPSEEK_API_KEY` no backend. A chave pertence ao usuário, é opcional e fica no cofre criptografado da aplicação.

O valor de `ALLOWED_ORIGINS` deve ser uma lista exata de origens permitidas, sem curinga. Guarde uma cópia segura da `CREDENTIAL_ENCRYPTION_KEY`: perdê-la torna as credenciais existentes irrecuperáveis. `ASSIGNED_REVIEW_FLOW_ENABLED` é booleano, assume `false` quando omitido e deve continuar `false` no início do rollout; equipe e convites podem ser verificados antes de ativar o fluxo de revisão distribuída.

## Build do frontend

Fornecer os argumentos no build da imagem:

```powershell
docker build `
  --build-arg VITE_API_URL=https://synapse.labit.dev.br `
  --build-arg VITE_GOOGLE_CLIENT_ID=<client-id-web-do-google> `
  --build-arg VITE_SESSION_COOKIE_NAME=synapse_session `
  -t synapse-frontend:release frontend
```

O container serve a SPA com Nginx na porta 3000 e possui fallback para rotas do React.

## Ordem segura de implantação

1. Criar o dump pré-migração do PostgreSQL e conferir manifesto e checksum.
2. Restaurar e verificar o dump em uma base isolada nova `synapse_restore_check_*`; exigir `integrityPassed=true` no relatório.
3. Implantar schema e código com `ASSIGNED_REVIEW_FLOW_ENABLED=false`, sem liberar tráfego.
4. Executar `alembic upgrade head` exatamente uma vez.
5. Subir backend e frontend, conferir `/health` e `/ready` e testar equipe e convite interno com a flag ainda desligada.
6. Ativar `ASSIGNED_REVIEW_FLOW_ENABLED=true` e reiniciar apenas os processos que leem a configuração no startup.
7. Testar distribuição e decisões colaborativas conforme a seção abaixo.
8. Liberar tráfego gradualmente e monitorar erros, latência, conflitos, filas de reatribuição e consumo dos serviços.

## Testes de fumaça

- Login Google com uma conta nova e com uma conta legada do mesmo e-mail.
- Restauração da sessão após recarregar a página e logout efetivo.
- Dashboard, projetos, visão do projeto, importação/lista de artigos, triagem, grafo, chat e configurações.
- Funções sem IA quando nenhuma chave DeepSeek estiver cadastrada.
- Mensagem orientativa ao tentar usar IA sem chave.
- Cadastro, mascaramento, substituição e exclusão da chave por usuário.
- Isolamento: um usuário nunca enxerga chave, projeto ou artigo de outro.
- Autorização compartilhada: proprietário, coordenador e revisor conseguem consultar todo o projeto; usuário sem vínculo recebe acesso negado; revisor só altera revisões atribuídas a ele.
- Projeto com 1 revisor: distribuição, decisão e avanço do fluxo legado/individual continuam funcionando.
- Projeto com 2 ou mais revisores: distribuição automática mantém os dois slots distintos e balanceados.
- Revisão cega: a primeira decisão submetida não revela a decisão do outro revisor.
- Concordância e conflito: duas decisões iguais avançam o artigo; decisões diferentes abrem conflito para arbitragem do proprietário/coordenador.
- Reatribuição: remoção ou indisponibilidade de revisor sinaliza e permite redistribuir atribuições sem perder o histórico.
- Central de notificações: convite, lote atribuído/redistribuído e conflito aparecem dentro do projeto e podem ser marcados como lidos.
- Layout desktop e mobile sem rolagem horizontal inesperada.
- Ausência de erros no console e de respostas 5xx.

DNS, TLS e o login Google real permanecem pré-requisitos externos até serem configurados. O teste real do login Google e uma chamada real ao DeepSeek também permanecem externos ao ambiente local até existirem Client ID, DNS/TLS e uma chave de teste.

## Operação e rollback

- Centralizar logs do Nginx e do FastAPI, alertando para 5xx e falhas em `/ready`.
- Monitorar PostgreSQL, Neo4j e Qdrant, além de uso e custo do provedor de IA.
- Aplicar limites de requisição no proxy e restringir os painéis administrativos dos bancos.
- Manter a imagem anterior identificada por tag e o dump verificado disponível.
- Em qualquer rollback, primeiro definir `ASSIGNED_REVIEW_FLOW_ENABLED=false`. Isso preserva o fluxo solo legado e mantém intactos o histórico, as atribuições e as decisões colaborativas já gravadas.
- Em seguida, retirar tráfego conforme necessário e restaurar a imagem anterior da aplicação.
- Não executar downgrade nem remover o schema de colaboração enquanto houver linhas novas nas tabelas colaborativas.
- Restaurar o dump somente para um rollback em nível de banco, dentro de janela de manutenção, aceitando explicitamente a perda de dados posteriores ao dump.
