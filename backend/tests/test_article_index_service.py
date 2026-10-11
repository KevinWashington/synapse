from types import SimpleNamespace

import pytest


class Graph:
    def __init__(self):
        self.nodes = {}

    async def sync_article_to_graph(self, article, db, embedding=None):
        self.nodes[article.id] = article.title

    async def delete_article_from_graph(self, article_id):
        self.nodes.pop(article_id, None)


class Vector:
    def __init__(self):
        self.points = {}

    async def get_article_point(self, *, article_id, project_id):
        point = self.points.get(article_id)
        return point if point and point['payload']['project_id'] == project_id else None

    def build_payload(self, *, paper_id, project_id, metadata):
        return {**metadata, 'paper_id': paper_id, 'project_id': project_id}

    async def upsert_payload(self, *, payload, embedding):
        self.points[payload['article_id']] = {'payload': payload, 'vector': embedding}

    async def delete_article(self, article_id):
        self.points.pop(article_id, None)


class Embedder:
    def generate_embedding(self, text):
        return [float(len(text)), 1.0]


def article(**patch):
    return SimpleNamespace(id=42, projectId=5, paperId='paper-42', title='Study',
                           authors='Author', year=2026, journal='Journal', aiMethodology=None,
                           aiDomain=None, aiKeywords=[], notas='original', reviewOutcome='included',
                           currentPhase='included', sourceName='Scopus', **patch)


@pytest.mark.asyncio
async def test_reloaded_article_keeps_vector_when_only_notes_change():
    from app.services.article_index_service import ArticleIndexService
    graph, vector = Graph(), Vector()
    service = ArticleIndexService(graph, vector, Embedder())
    first = article(abstract='original abstract')
    await service.sync(first, None)
    original_vector = vector.points[42]['vector'][:]
    reloaded = article(abstract='original abstract')
    reloaded.notas = 'updated note'
    await service.sync(reloaded, None)
    assert vector.points[42]['vector'] == original_vector
    assert vector.points[42]['payload']['notas'] == 'updated note'


@pytest.mark.asyncio
async def test_first_inclusion_generates_embedding_and_changed_content_rebuilds_it():
    from app.services.article_index_service import ArticleIndexService
    graph, vector = Graph(), Vector()
    service = ArticleIndexService(graph, vector, Embedder())
    await service.sync(article(abstract='short'), None)
    assert vector.points[42]['vector'] == [5.0, 1.0]
    await service.sync(article(abstract='a longer abstract'), None)
    assert vector.points[42]['vector'] == [17.0, 1.0]


@pytest.mark.asyncio
async def test_empty_abstract_does_not_remove_existing_vector():
    from app.services.article_index_service import ArticleIndexService
    graph, vector = Graph(), Vector()
    service = ArticleIndexService(graph, vector, Embedder())
    await service.sync(article(abstract='short'), None)
    await service.sync(article(abstract=None), None)
    assert vector.points[42]['vector'] == [5.0, 1.0]


@pytest.mark.asyncio
async def test_explicit_removal_and_exclusion_remove_both_projections_idempotently():
    from app.services.article_index_service import ArticleIndexService
    graph, vector = Graph(), Vector()
    service = ArticleIndexService(graph, vector, Embedder())
    await service.sync(article(abstract='short'), None)
    await service.remove(article_id=42, project_id=5)
    await service.remove(article_id=42, project_id=5)
    assert graph.nodes == vector.points == {}
    included = article(abstract='short')
    await service.sync(included, None)
    included.reviewOutcome = 'excluded_eligibility'
    await service.sync(included, None)
    assert graph.nodes == vector.points == {}


@pytest.mark.asyncio
async def test_embedding_failure_does_not_delete_existing_projection():
    from app.services.article_index_service import ArticleIndexService
    graph, vector = Graph(), Vector()
    service = ArticleIndexService(graph, vector, Embedder())
    await service.sync(article(abstract='short'), None)

    class FailedEmbedder:
        def generate_embedding(self, text):
            raise RuntimeError('embedding unavailable')

    service.embedder = FailedEmbedder()
    with pytest.raises(RuntimeError):
        await service.sync(article(abstract='changed'), None)
    assert vector.points[42]['vector'] == [5.0, 1.0]


@pytest.mark.asyncio
async def test_graph_failure_keeps_vector_work_and_can_retry():
    from app.services.article_index_service import ArticleIndexService

    class FailingGraph(Graph):
        async def sync_article_to_graph(self, article, db, embedding=None):
            raise RuntimeError('graph unavailable')

    vector = Vector()
    service = ArticleIndexService(FailingGraph(), vector, Embedder())
    with pytest.raises(RuntimeError, match='synchronization failed'):
        await service.sync(article(abstract='short'), None)
    assert vector.points[42]['vector'] == [5.0, 1.0]
    service.graph = Graph()
    await service.sync(article(abstract='short'), None)
    assert service.graph.nodes[42] == 'Study'
    assert vector.points[42]['vector'] == [5.0, 1.0]


@pytest.mark.asyncio
async def test_graph_removal_failure_still_attempts_vector_removal():
    from app.services.article_index_service import ArticleIndexService

    class FailingGraph(Graph):
        async def delete_article_from_graph(self, article_id):
            raise RuntimeError('graph unavailable')

    vector = Vector()
    service = ArticleIndexService(Graph(), vector, Embedder())
    await service.sync(article(abstract='short'), None)
    service.graph = FailingGraph()
    with pytest.raises(RuntimeError, match='removal failed'):
        await service.remove(article_id=42, project_id=5)
    assert vector.points == {}
