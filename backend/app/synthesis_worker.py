import asyncio
import logging
import signal
import socket

from app.database import assert_database_revision, async_session_maker
from app.services.synthesis_jobs_service import claim_job, run_claimed_job


logger = logging.getLogger("synapse.synthesis_worker")


async def run_worker(stop_event: asyncio.Event, *, worker_id: str | None = None) -> None:
    worker_id = worker_id or f"synthesis-{socket.gethostname()}"
    await assert_database_revision()
    logger.info("Synthesis worker %s is ready", worker_id)
    while not stop_event.is_set():
        try:
            async with async_session_maker() as db:
                job = await claim_job(db, worker_id=worker_id)
                if job is None:
                    await db.rollback()
                    job_info = None
                else:
                    job_info = (job.id, job.leaseToken)
                    await db.commit()
            if job_info is None:
                try:
                    await asyncio.wait_for(stop_event.wait(), timeout=1)
                except TimeoutError:
                    continue
                break
            await run_claimed_job(job_info[0], lease_token=job_info[1])
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Synthesis worker loop failed; retrying after a short delay")
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=1)
            except TimeoutError:
                continue


async def main() -> None:
    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    for signum in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(signum, stop_event.set)
        except (NotImplementedError, RuntimeError):
            signal.signal(signum, lambda *_: loop.call_soon_threadsafe(stop_event.set))
    await run_worker(stop_event)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
