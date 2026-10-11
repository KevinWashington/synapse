from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.core.csrf import require_csrf
from app.core.error_handlers import install_error_handlers, normalize_http_detail
from app.database import assert_database_revision, db_health_check, init_db, engine
from app.routers import auth, projects, articles, ai, collaboration, inbox, settings as settings_router, stats, synthesis
from app.core.dependencies import get_mcp_host, get_graph_mcp_service, get_sql_mcp_service
from app.services.qdrant_retrieval_service import get_qdrant_retrieval_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    settings.validate_runtime()

    # Deployment applies migrations before startup; the API only validates them.
    await init_db()

    # Bootstrap MCP host registry for local tools.
    host = get_mcp_host()
    configured_servers = [s.strip() for s in settings.MCP_REGISTERED_SERVERS.split(",") if s.strip()]
    if "qdrant" in configured_servers:
        host.register_server("qdrant", ["search_semantic", "vector.search", "vector.upsert", "vector.health"])
        qdrant = get_qdrant_retrieval_service()
        qdrant_health = await qdrant.mcp_health()
        host.set_server_health("qdrant", qdrant_health.get("connected", False), qdrant_health.get("details"))
    if "neo4j" in configured_servers:
        host.register_server(
            "neo4j",
            [
                "execute_expansion",
                "graph.query",
                "graph.write",
                "graph.health",
                "graph.cluster_project",
                "graph.bridge_authors",
                "graph.timeline_by_methodology",
                "graph.recommend_related_reads",
                "graph.find_author_topic_paths",
            ],
        )
        graph = get_graph_mcp_service()
        graph_health = await graph.mcp_health()
        host.set_server_health("neo4j", graph_health.get("connected", False), graph_health.get("details"))
    if "postgres" in configured_servers:
        host.register_server("postgres", ["rerank_by_impact", "sql.query", "sql.write", "sql.health"])
        sql = get_sql_mcp_service()
        sql_health = await sql.mcp_health()
        host.set_server_health("postgres", sql_health.get("connected", False), sql_health.get("details"))

    yield
    # Shutdown: close database connection
    await engine.dispose()


app = FastAPI(
    title="Synapse API",
    description="API para sistema de revisão literária com IA",
    version="2.0.0",
    lifespan=lifespan,
)
install_error_handlers(app)


@app.middleware("http")
async def csrf_protection(request, call_next):
    try:
        require_csrf(request)
    except HTTPException as exc:
        return JSONResponse(status_code=exc.status_code,
                            content={"detail": normalize_http_detail(exc.detail, exc.status_code)})
    return await call_next(request)


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Autenticação"])
app.include_router(projects.router, prefix="/api/projetos", tags=["Projetos"])
app.include_router(articles.router, prefix="/api/projetos", tags=["Artigos"])
app.include_router(synthesis.router, prefix="/api/projetos", tags=["Síntese"])
app.include_router(collaboration.router, prefix="/api/projetos", tags=["Colaboração"])
app.include_router(inbox.router, prefix="/api", tags=["Caixa de entrada"])
app.include_router(ai.router, prefix="/api", tags=["IA"])
app.include_router(stats.router, prefix="/api", tags=["Estatísticas"])
app.include_router(settings_router.router, prefix="/api/settings", tags=["Configurações"])


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
            "ready": "/ready",
            "docs": "/docs",
        }
    }


@app.get("/health")
async def health():
    """Report process liveness without probing external dependencies."""
    return {
        "status": "ok",
        "version": "2.0.0"
    }


@app.get("/ready")
async def ready():
    """Report sanitized configuration, database, and schema readiness."""
    checks = {
        "configuration": "pending",
        "database": "pending",
        "migration": "pending",
    }

    try:
        settings.validate_runtime()
        checks["configuration"] = "ok"
    except Exception:
        checks["configuration"] = "error"
        return JSONResponse(status_code=503, content={"status": "not_ready", "checks": checks})

    database = await db_health_check()
    if not database.get("connected", False):
        checks["database"] = "error"
        return JSONResponse(status_code=503, content={"status": "not_ready", "checks": checks})
    checks["database"] = "ok"

    try:
        await assert_database_revision()
        checks["migration"] = "ok"
    except Exception:
        checks["migration"] = "error"
        return JSONResponse(status_code=503, content={"status": "not_ready", "checks": checks})

    return {"status": "ready", "checks": checks}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.DEBUG
    )
