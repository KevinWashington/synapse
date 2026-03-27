from __future__ import annotations

import hashlib
import re


class AnchorService:
    """Generates and normalizes canonical paper_id values."""

    _INVALID_CHARS = re.compile(r"[^a-z0-9]+")

    def normalize(self, paper_id: str | None) -> str | None:
        if not paper_id:
            return None
        normalized = self._INVALID_CHARS.sub("-", paper_id.strip().lower()).strip("-")
        return normalized or None

    def generate(self, doi: str | None, title: str | None, year: int | None) -> str:
        doi_normalized = self.normalize(doi)
        if doi_normalized:
            return doi_normalized

        title_base = self.normalize(title or "paper") or "paper"
        year_base = str(year) if year is not None else "unknown"
        digest = hashlib.sha1(f"{title_base}|{year_base}".encode("utf-8")).hexdigest()[:10]
        return f"{title_base}-{year_base}-{digest}"

    def resolve(self, provided: str | None, doi: str | None, title: str | None, year: int | None) -> str:
        normalized = self.normalize(provided)
        if normalized:
            return normalized
        return self.generate(doi=doi, title=title, year=year)


_anchor_service: AnchorService | None = None


def get_anchor_service() -> AnchorService:
    global _anchor_service
    if _anchor_service is None:
        _anchor_service = AnchorService()
    return _anchor_service
