#!/bin/sh

# Inicia o servidor do Ollama em background
ollama serve &

# Captura o Process ID (PID) do servidor
pid=$!

echo "Servidor Ollama iniciando com PID: $pid"

# Espera um pouco para o servidor começar a escutar
sleep 3

echo "Verificando se o modelo 'phi3' já existe..."

# Verifica se o modelo 'phi3' já está na lista de modelos
if ollama list | grep -q "phi3"; then
    echo "Modelo 'phi3' já existe. Nenhuma ação necessária."
else
    echo "Modelo 'phi3' não encontrado. Baixando agora..."
    ollama pull phi3
fi

echo "Inicialização concluída. O servidor continua em execução."

# Espera o processo do servidor terminar, mantendo o container ativo
wait $pid