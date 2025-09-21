import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Synapse API',
      version: '1.0.0',
      description: 'API para sistema de revisão literária acadêmica',
      contact: {
        name: 'Synapse Team',
        email: 'contato@synapse.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Servidor de desenvolvimento'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'ID único do usuário'
            },
            name: {
              type: 'string',
              description: 'Nome do usuário'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email do usuário'
            },
            role: {
              type: 'string',
              enum: ['user', 'admin'],
              description: 'Papel do usuário'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Data de atualização'
            }
          }
        },
        Project: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'ID único do projeto'
            },
            title: {
              type: 'string',
              description: 'Título do projeto'
            },
            description: {
              type: 'string',
              description: 'Descrição do projeto'
            },
            owner: {
              type: 'string',
              description: 'ID do proprietário do projeto'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Data de atualização'
            }
          }
        },
        Artigo: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'ID único do artigo'
            },
            title: {
              type: 'string',
              description: 'Título do artigo'
            },
            authors: {
              type: 'string',
              description: 'Autores do artigo'
            },
            year: {
              type: 'integer',
              description: 'Ano de publicação'
            },
            journal: {
              type: 'string',
              description: 'Periódico/Revista'
            },
            doi: {
              type: 'string',
              description: 'DOI do artigo'
            },
            abstract: {
              type: 'string',
              description: 'Resumo do artigo'
            },
            content: {
              type: 'string',
              description: 'Conteúdo completo do artigo'
            },
            status: {
              type: 'string',
              enum: ['pendente', 'analisado', 'rejeitado'],
              description: 'Status do artigo'
            },
            notas: {
              type: 'string',
              description: 'Notas do usuário sobre o artigo'
            },
            projectId: {
              type: 'string',
              description: 'ID do projeto ao qual o artigo pertence'
            },
            owner: {
              type: 'string',
              description: 'ID do proprietário do artigo'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Data de atualização'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Mensagem de erro'
            },
            details: {
              type: 'string',
              description: 'Detalhes do erro'
            }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Email do usuário'
            },
            password: {
              type: 'string',
              description: 'Senha do usuário'
            }
          }
        },
        RegisterRequest: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: {
              type: 'string',
              description: 'Nome do usuário'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email do usuário'
            },
            password: {
              type: 'string',
              minLength: 6,
              description: 'Senha do usuário (mínimo 6 caracteres)'
            }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'Token JWT de autenticação'
            },
            user: {
              $ref: '#/components/schemas/User'
            }
          }
        },
        StatsResponse: {
          type: 'object',
          properties: {
            totalProjects: {
              type: 'integer',
              description: 'Total de projetos do usuário'
            },
            totalArticles: {
              type: 'integer',
              description: 'Total de artigos do usuário'
            },
            totalArticlesReviewed: {
              type: 'integer',
              description: 'Total de artigos analisados'
            },
            textsReviewedToday: {
              type: 'integer',
              description: 'Artigos analisados hoje'
            },
            textsToReview: {
              type: 'integer',
              description: 'Artigos pendentes de análise'
            },
            progressPercentage: {
              type: 'integer',
              description: 'Percentual de progresso'
            },
            lastProject: {
              $ref: '#/components/schemas/Project'
            },
            pendingArticles: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Artigo'
              }
            },
            dailyReviews: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: {
                    type: 'string',
                    format: 'date'
                  },
                  count: {
                    type: 'integer'
                  },
                  dayName: {
                    type: 'string'
                  }
                }
              }
            }
          }
        },
        ChatRequest: {
          type: 'object',
          required: ['messages'],
          properties: {
            messages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  role: {
                    type: 'string',
                    enum: ['user', 'assistant']
                  },
                  content: {
                    type: 'string'
                  }
                }
              }
            },
            artigo: {
              $ref: '#/components/schemas/Artigo'
            },
            aiConfig: {
              type: 'object',
              properties: {
                provider: {
                  type: 'string',
                  enum: ['gemini', 'ollama']
                },
                gemini: {
                  type: 'object',
                  properties: {
                    apiKey: {
                      type: 'string'
                    },
                    model: {
                      type: 'string'
                    }
                  }
                },
                ollama: {
                  type: 'object',
                  properties: {
                    url: {
                      type: 'string'
                    },
                    model: {
                      type: 'string'
                    }
                  }
                }
              }
            }
          }
        },
        ChatResponse: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'Resposta do modelo de IA'
            }
          }
        },
        ResearchQuestionsRequest: {
          type: 'object',
          required: ['picocData'],
          properties: {
            picocData: {
              type: 'object',
              properties: {
                pessoa: {
                  type: 'string',
                  description: 'População/Pessoa do framework PICOC'
                },
                intervencao: {
                  type: 'string',
                  description: 'Intervenção do framework PICOC'
                },
                comparacao: {
                  type: 'string',
                  description: 'Comparação do framework PICOC'
                },
                outcome: {
                  type: 'string',
                  description: 'Outcome (Resultado) do framework PICOC'
                },
                contexto: {
                  type: 'string',
                  description: 'Contexto do framework PICOC'
                }
              }
            },
            projeto: {
              $ref: '#/components/schemas/Project'
            },
            aiConfig: {
              type: 'object',
              properties: {
                provider: {
                  type: 'string',
                  enum: ['gemini', 'ollama']
                },
                gemini: {
                  type: 'object',
                  properties: {
                    apiKey: {
                      type: 'string'
                    },
                    model: {
                      type: 'string'
                    }
                  }
                },
                ollama: {
                  type: 'object',
                  properties: {
                    url: {
                      type: 'string'
                    },
                    model: {
                      type: 'string'
                    }
                  }
                }
              }
            }
          }
        },
        ResearchQuestionsResponse: {
          type: 'object',
          properties: {
            researchQuestions: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Lista de perguntas de pesquisa geradas'
            }
          }
        },
        SearchStringsRequest: {
          type: 'object',
          required: ['researchQuestions', 'picocData'],
          properties: {
            researchQuestions: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Perguntas de pesquisa'
            },
            picocData: {
              type: 'object',
              properties: {
                pessoa: {
                  type: 'string',
                  description: 'População/Pessoa do framework PICOC'
                },
                intervencao: {
                  type: 'string',
                  description: 'Intervenção do framework PICOC'
                },
                comparacao: {
                  type: 'string',
                  description: 'Comparação do framework PICOC'
                },
                outcome: {
                  type: 'string',
                  description: 'Outcome (Resultado) do framework PICOC'
                },
                contexto: {
                  type: 'string',
                  description: 'Contexto do framework PICOC'
                }
              }
            },
            projeto: {
              $ref: '#/components/schemas/Project'
            },
            aiConfig: {
              type: 'object',
              properties: {
                provider: {
                  type: 'string',
                  enum: ['gemini', 'ollama']
                },
                gemini: {
                  type: 'object',
                  properties: {
                    apiKey: {
                      type: 'string'
                    },
                    model: {
                      type: 'string'
                    }
                  }
                },
                ollama: {
                  type: 'object',
                  properties: {
                    url: {
                      type: 'string'
                    },
                    model: {
                      type: 'string'
                    }
                  }
                }
              }
            }
          }
        },
        SearchStringsResponse: {
          type: 'object',
          properties: {
            searchStrings: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Lista de strings de busca geradas'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.js', './server.js']
};

const specs = swaggerJsdoc(options);
export default specs;
