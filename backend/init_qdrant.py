import asyncio
import os

from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models


async def init_qdrant():
    qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
    collection_name = os.getenv("QDRANT_COLLECTION", "articles")
    vector_size = int(os.getenv("QDRANT_VECTOR_SIZE", "768"))
    client = AsyncQdrantClient(url=qdrant_url)
    
    print(f"Conectando ao Qdrant em {qdrant_url}...")

    for attempt in range(1, 31):
        try:
            await client.get_collections()
            break
        except Exception as exc:
            if attempt == 30:
                raise RuntimeError(f"Falha ao conectar no Qdrant após {attempt} tentativas: {exc}") from exc
            await asyncio.sleep(2)
    
    # Verifica quais coleções já existem
    collections = await client.get_collections()
    exists = any(c.name == collection_name for c in collections.collections)
    
    if not exists:
        print(f"Criando coleção '{collection_name}' preparada para embeddings ({vector_size} dimensões)...")
        await client.create_collection(
            collection_name=collection_name,
            vectors_config=models.VectorParams(
                size=vector_size,
                distance=models.Distance.COSINE # Distância do cosseno é o padrão-ouro para textos
            )
        )
        print("✅ Coleção criada com sucesso!")
    else:
        print("✅ Coleção já existe. O banco vetorial está pronto para uso.")

if __name__ == "__main__":
    asyncio.run(init_qdrant())