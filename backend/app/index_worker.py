"""Run with python -m app.index_worker; reconciliation defaults to inspection."""

import argparse
import asyncio
import logging
import signal

from app.database import assert_database_revision, async_session_maker
from app.services.article_index_jobs_service import (
    pending_article_index_tasks,
    process_article_index_task,
    reconcile_project_indexes,
)
from app.services.article_index_service import get_article_index_service

logger = logging.getLogger(__name__)


async def run_worker(stop_event: asyncio.Event) -> None:
    await assert_database_revision()
    index_service = get_article_index_service()
    while not stop_event.is_set():
        try:
            async with async_session_maker() as db:
                ids = await pending_article_index_tasks(db)
            for task_id in ids:
                if stop_event.is_set():
                    break
                await process_article_index_task(
                    task_id, session_factory=async_session_maker, index_service=index_service
                )
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Index worker iteration failed")
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=1)
        except TimeoutError:
            pass


async def main(args) -> None:
    if args.reconcile_project is not None:
        await assert_database_revision()
        async with async_session_maker() as db:
            ids = await reconcile_project_indexes(
                db, project_id=args.reconcile_project, apply=args.apply
            )
            if args.apply:
                await db.commit()
            print({"projectId": args.reconcile_project, "articleIds": ids, "applied": args.apply})
        return
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for signum in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(signum, stop.set)
        except NotImplementedError:
            signal.signal(signum, lambda *_: loop.call_soon_threadsafe(stop.set))
    await run_worker(stop)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser()
    parser.add_argument("--reconcile-project", type=int)
    parser.add_argument("--apply", action="store_true")
    asyncio.run(main(parser.parse_args()))
