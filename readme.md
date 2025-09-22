# Synapse - Sistema de Revisão Literária

Sistema completo para gerenciamento de projetos de revisão literária acadêmica, com funcionalidades de IA integradas para análise e recomendações de artigos científicos.

## 🚀 Funcionalidades

### 📚 Gerenciamento de Projetos

- Criação e organização de projetos de revisão literária
- Dashboard com estatísticas e visualizações
- Planejamento e acompanhamento de progresso

### 📄 Gestão de Artigos

- Importação de artigos via BibTeX
- Upload e visualização de PDFs
- Sistema de notas e anotações
- Categorização e tags

### 🤖 Inteligência Artificial

- **Múltiplos provedores de IA**: Google Gemini, Ollama (local)
- Análise automática de artigos
- Recomendações inteligentes de artigos relacionados
- Chat com IA para suporte na pesquisa
- Configuração flexível de modelos de IA

### 📊 Visualizações e Análises

- Gráfico de relacionamentos entre artigos
- Estatísticas interativas

### 🔐 Autenticação e Segurança

- Sistema de login/registro
- Autenticação JWT
- Rotas protegidas
- Gerenciamento de usuários

## 🛠️ Tecnologias

### Frontend

- **React 19** com Vite
- **Tailwind CSS** para estilização
- **Radix UI** para componentes
- **React Router** para navegação

### Backend

- **Node.js** com Express
- **MongoDB** com Mongoose
- **JWT** para autenticação
- **Multer** para upload de arquivos
- **Swagger** para documentação da API

### IA e Processamento

- **Google Generative AI** (Gemini)
- **Ollama** para modelos locais
- **PDF Parse** para extração de texto
- **BibTeX Parse** para importação de referências

### Infraestrutura

- **Docker** e **Docker Compose**
- **MongoDB** containerizado
- **Ollama** para IA local

## 📦 Instalação

### Pré-requisitos

- Docker e Docker Compose
- Node.js 18+ (para desenvolvimento local)

### 1. Clone o repositório

```bash
git clone <url-do-repositorio>
cd revisaoliteraria
```

### 2. Configure as variáveis de ambiente

Crie o arquivo `.env` na pasta `synapse-backend/`:

```env
MONGODB_URI=mongodb://mongo:27017/synapse
JWT_SECRET=seu_jwt_secret_aqui
API_KEY=sua_chave_do_gemini_aqui
PORT=5000
```

### 3. Execute com Docker Compose

```bash
# Iniciar todos os serviços
docker-compose up -d

# Iniciar com Ollama (IA local)
docker-compose --profile ollama up -d
```

### 4. Acesse a aplicação

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Documentação da API**: http://localhost:5000/api-docs
- **MongoDB**: localhost:27017

## 🚀 Desenvolvimento Local

### Frontend

```bash
cd synapse
npm install
npm run dev
```

### Backend

```bash
cd synapse-backend
npm install
npm run dev
```

### Banco de Dados

```bash
# Iniciar apenas o MongoDB
docker-compose up mongo -d
```

## 📖 Uso

### 1. Primeiro Acesso

1. Acesse http://localhost:3000
2. Registre uma nova conta
3. Faça login

### 2. Criando um Projeto

1. Vá para a página "Projetos"
2. Clique em "Novo Projeto"
3. Preencha as informações do projeto
4. Configure as configurações de IA se necessário

### 3. Importando Artigos

1. Acesse o projeto criado
2. Use "Importar BibTeX" para importar referências
3. Ou faça upload de PDFs individuais
4. Configure as anotações e categorias

### 4. Usando IA

1. Vá para "Configurações" para configurar provedores de IA
2. Use o chat de IA para obter recomendações
3. Visualize o grafo de relacionamentos entre artigos

## 🔧 Configuração de IA

### Google Gemini

1. Obtenha uma API key do Google AI Studio
2. Configure no arquivo `.env` ou nas configurações da aplicação

### Ollama (Local)

1. Use o perfil `ollama` do Docker Compose
2. Modelos disponíveis: phi3, llama2, codellama, mistral
3. Configure a URL e modelo nas configurações

## 📁 Estrutura do Projeto

```
revisaoliteraria/
├── synapse/                 # Frontend React
│   ├── src/
│   │   ├── components/      # Componentes reutilizáveis
│   │   ├── pages/          # Páginas da aplicação
│   │   ├── context/        # Contextos React
│   │   ├── hooks/          # Hooks customizados
│   │   └── services/       # Serviços de API
├── synapse-backend/         # Backend Node.js
│   ├── src/
│   │   ├── controllers/    # Controladores da API
│   │   ├── models/         # Modelos do MongoDB
│   │   ├── routes/         # Rotas da API
│   │   └── services/       # Serviços de negócio
├── docker-compose.yml      # Configuração Docker
└── entrypoint-ollama.sh    # Script de inicialização Ollama
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🆘 Suporte

Para suporte e dúvidas:

- Abra uma issue no GitHub
- Consulte a documentação da API em `/api-docs`
- Verifique os logs dos containers Docker

## 🔄 Atualizações Futuras
- [ ] Algoritmo de clusterização dos grafos
- [ ] Integração com mais provedores de IA
- [ ] Exportação de relatórios em PDF
- [ ] Colaboração em tempo real
- [ ] Integração com bases de dados acadêmicas
- [ ] Sistema de revisão por pares
