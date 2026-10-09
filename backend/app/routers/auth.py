from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.security import clear_session_cookies, set_session_cookies
from app.database import get_db
from app.models.user import User
from app.schemas.auth import AuthResponse, GoogleCredentialRequest, UserResponse, UserUpdate
from app.services.google_identity_service import (
    GoogleIdentityError,
    GoogleIdentityService,
    get_google_identity_service,
)


router = APIRouter()


def _account_disabled() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": "ACCOUNT_DISABLED", "message": "Sua conta foi desativada."},
    )


def _new_user(identity) -> User:
    return User(
        name=identity.name,
        email=identity.email,
        passwordHash=None,
        googleSub=identity.sub,
        role="user",
        isActive=True,
        avatar=identity.avatar,
    )


@router.post("/google", response_model=AuthResponse)
async def google_login(
    data: GoogleCredentialRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    identity_service: GoogleIdentityService = Depends(get_google_identity_service),
):
    try:
        identity = identity_service.verify(data.credential)
    except GoogleIdentityError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": exc.code, "message": exc.public_message},
        ) from exc

    result = await db.execute(select(User).where(User.googleSub == identity.sub))
    user = result.scalar_one_or_none()

    if user is None:
        result = await db.execute(
            select(User).where(func.lower(func.trim(User.email)) == identity.email)
        )
        user = result.scalar_one_or_none()
        if user is not None and user.googleSub and user.googleSub != identity.sub:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "IDENTITY_CONFLICT",
                    "message": "Este e-mail já está vinculado a outra identidade Google.",
                },
            )
        if user is None:
            user = _new_user(identity)
            db.add(user)
        else:
            user.googleSub = identity.sub

    if not user.isActive:
        raise _account_disabled()

    user.name = identity.name
    user.email = identity.email
    user.avatar = identity.avatar
    user.lastLogin = datetime.now(timezone.utc)
    try:
        if getattr(user, "id", None) is None:
            await db.flush()
        await db.commit()
        await db.refresh(user)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "IDENTITY_CONFLICT", "message": "Não foi possível vincular esta identidade."},
        ) from exc

    set_session_cookies(response, user.id)
    return AuthResponse(
        success=True,
        message="Login com Google realizado com sucesso.",
        user=UserResponse.model_validate(user),
    )


@router.get("/profile", response_model=dict)
def get_profile(current_user: User = Depends(get_current_user)):
    return {"success": True, "user": UserResponse.model_validate(current_user)}


@router.put("/profile", response_model=dict)
async def update_profile(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.name:
        current_user.name = data.name
    await db.commit()
    await db.refresh(current_user)
    return {
        "success": True,
        "message": "Perfil atualizado com sucesso.",
        "user": UserResponse.model_validate(current_user),
    }


@router.post("/logout", response_model=dict)
def logout(response: Response, current_user: User = Depends(get_current_user)):
    clear_session_cookies(response)
    return {"success": True, "message": "Logout realizado com sucesso."}
