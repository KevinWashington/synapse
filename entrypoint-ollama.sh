#!/bin/bash

# Aguardar o Ollama inicializar
sleep 5

# Baixar modelos populares
ollama pull phi3
ollama pull llama2
ollama pull codellama
ollama pull mistral

# Manter o container rodando
tail -f /dev/null
