from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db, engine
from app.routers import auth, projects, articles, ai, stats
from app.core.dependencies import get_mcp_host


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup: create database tables
    await init_db()

    # Bootstrap MCP host registry for local tools.
    host = get_mcp_host()
    configured_servers = [s.strip() for s in settings.MCP_REGISTERED_SERVERS.split(",") if s.strip()]
    if "qdrant" in configured_servers:
        host.register_server("qdrant", ["vector.search", "vector.upsert", "vector.health"])
    if "neo4j" in configured_servers:
        host.register_server("neo4j", ["graph.query", "graph.write", "graph.health"])
    if "postgres" in configured_servers:
        host.register_server("postgres", ["sql.query", "sql.write", "sql.health"])

    yield
    # Shutdown: close database connection
    await engine.dispose()


app = FastAPI(
    title="Synapse API",
    description="API para sistema de revisão literária com IA",
    version="2.0.0",
    lifespan=lifespan,
)
# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://0.0.0.0:3000",
        "http://localhost:5173",  # Porta padrão do Vite se mudar
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Autenticação"])
app.include_router(projects.router, prefix="/api/projetos", tags=["Projetos"])
app.include_router(articles.router, prefix="/api/projetos", tags=["Artigos"])
app.include_router(ai.router, prefix="/api", tags=["IA"])
app.include_router(stats.router, prefix="/api", tags=["Estatísticas"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "🚀 API Synapse funcionando!",
        "version": "2.0.0",
        "endpoints": {
            "auth": "/api/auth",
            "projetos": "/api/projetos",
            "health": "/health",
            "docs": "/docs",
        }
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "OK",
        "database": "PostgreSQL",
        "version": "2.0.0"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.DEBUG
    )
