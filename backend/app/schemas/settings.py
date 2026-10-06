from datetime import datetime

from pydantic import BaseModel, Field


class DeepSeekKeyUpdate(BaseModel):
    apiKey: str = Field(..., min_length=8, max_length=512)


class DeepSeekKeyStatus(BaseModel):
    configured: bool
    maskedKey: str | None = None
    updatedAt: datetime | None = None
