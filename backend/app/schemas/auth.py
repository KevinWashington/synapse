from datetime import datetime

from pydantic import BaseModel, Field


class GoogleCredentialRequest(BaseModel):
    credential: str = Field(..., min_length=1, max_length=8192)


class UserUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    googleSub: str | None = None
    role: str
    isActive: bool
    avatar: str | None = None
    lastLogin: datetime | None = None
    createdAt: datetime
    updatedAt: datetime

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    success: bool
    message: str
    user: UserResponse
