from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


# Request schemas
class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    email: EmailStr | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


# Response schemas
class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    avatar: str | None = None
    last_login: datetime | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    success: bool
    message: str
    user: UserResponse
    token: str


class TokenPayload(BaseModel):
    user_id: int
    exp: datetime
