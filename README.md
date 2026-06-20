# Synapse

Sistema de apoio à revisão sistemática de literatura científica com IA, grafos de conhecimento e busca semântica vetorial.

## Visão Geral

O Synapse é uma aplicação web desenvolvida como TCC que auxilia pesquisadores no processo de revisão sistemática de literatura. A plataforma permite importar artigos (PDF ou BibTeX), analisar o conteúdo com LLM, construir um grafo de conhecimento entre autores e conceitos, e realizar buscas semânticas utilizando RAG (Retrieval-Augmented Generation) com múltiplos backends (vetorial, grafo e SQL).

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19, Vite, Tailwind CSS, Radix UI |
| Backend | FastAPI (Python 3.12), SQLAlchemy async |
| Banco relacional | PostgreSQL 16 + extensão pgvector |
| Banco de grafos | Neo4j 5 Community |
| Banco vetorial | Qdrant |
| LLM | DeepSeek via API compatível com OpenAI |
| Embeddings | HuggingFace Hub |
| Orquestração | Docker + Docker Compose |

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) e [Docker Compose](https://docs.docker.com/compose/install/) instalados
- Chave de API do [DeepSeek](https://platform.deepseek.com/)
- Token do [HuggingFace](https://huggingface.co/settings/tokens)

## Configuração

### 1. Clone o repositório

```bash
git clone <url-do-repositorio>
cd synapse
```

### 2. Configure as variáveis de ambiente

Copie o arquivo de exemplo e preencha com suas credenciais:

```bash
cp backend/.env.example backend/.env
```

Edite `backend/.env`:

```env
# Banco de dados PostgreSQL — não alterar se usar Docker Compose
DATABASE_URL=postgresql+asyncpg://synapse:synapse@postgres:5432/synapse

# JWT — gere uma chave aleatória segura (mínimo 32 caracteres)
JWT_SECRET=troque_por_uma_chave_secreta_longa_e_aleatoria
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080

# DeepSeek — obtenha em https://platform.deepseek.com/
DEEPSEEK_API_KEY=sua_chave_deepseek_aqui
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com

# HuggingFace — obtenha em https://huggingface.co/settings/tokens
HF_TOKEN=seu_token_huggingface_aqui

# Neo4j — não alterar se usar Docker Compose
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=synapse123

# Qdrant — não alterar se usar Docker Compose
QDRANT_URL=http://qdrant:6333
QDRANT_COLLECTION=articles

# Servidor
PORT=5000
DEBUG=false
```

> **Atenção:** As variáveis de banco de dados (`DATABASE_URL`, `NEO4J_*`, `QDRANT_*`) já estão pré-configuradas para funcionar com o Docker Compose. Só altere se subir os bancos manualmente.

### 3. Suba os serviços

```bash
docker-compose up -d
```

A primeira execução pode demorar alguns minutos para baixar as imagens e construir os containers.

Acompanhe os logs:

```bash
docker-compose logs -f
```

### 4. Acesse a aplicação

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000 |
| Swagger (docs da API) | http://localhost:5000/docs |
| Neo4j Browser | http://localhost:7474 |
| Qdrant Dashboard | http://localhost:6333/dashboard |

Crie uma conta diretamente pela interface do frontend.

## Dados de Teste

O repositório inclui um seed com os dados utilizados nos experimentos do TCC em `seeds/seed_avaliador.sql.zip`. Ele contém o usuário **Avaliador PA1**, seus 10 projetos de revisão sistemática e ~15.300 artigos importados.

### Credenciais do usuário de teste

| Campo | Valor |
|-------|-------|
| Email | avaliador.pa1@gmail.com |
| Senha | synapse123 |

### Como carregar o seed

Após subir os serviços com `docker-compose up -d`, execute:

```bash
# 1. Descompacte o arquivo
unzip seeds/seed_avaliador.sql.zip -d seeds/

# 2. Importe no banco
docker exec -i synapse-postgres psql -U synapse -d synapse < seeds/seed_avaliador.sql
```

> O seed usa `ON CONFLICT DO NOTHING`, então pode ser aplicado em um banco que já tenha outros dados sem conflito.

## Estrutura do Projeto

```
synapse/
├── backend/
│   ├── app/
│   │   ├── main.py           # Ponto de entrada FastAPI
│   │   ├── config.py         # Configurações via pydantic-settings
│   │   ├── database.py       # Conexão com PostgreSQL
│   │   ├── models/           # Modelos SQLAlchemy (User, Project, Article)
│   │   ├── routers/          # Rotas da API (auth, projetos, artigos, AI)
│   │   ├── schemas/          # Schemas Pydantic de request/response
│   │   └── services/         # Lógica de negócio (AI, Neo4j, Qdrant, RAG)
│   ├── init_qdrant.py        # Script de inicialização da coleção Qdrant
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── features/         # Módulos por funcionalidade (auth, articles, projects, ai…)
│   │   ├── components/       # Componentes reutilizáveis
│   │   ├── pages/            # Páginas da aplicação
│   │   ├── hooks/            # Custom hooks React
│   │   └── services/         # Chamadas à API do backend
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile.dev
└── docker-compose.yml
```

## Parar os serviços

```bash
# Parar sem remover os volumes (dados preservados)
docker-compose down

# Parar e remover todos os dados
docker-compose down -v
```

## Desenvolvimento local (sem Docker)

### Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
```

> Os bancos de dados (PostgreSQL, Neo4j, Qdrant) ainda precisam estar rodando. Você pode subir apenas os bancos via Docker: `docker-compose up -d postgres neo4j qdrant qdrant-init`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

O frontend ficará disponível em http://localhost:5173 (porta padrão do Vite em modo dev).


