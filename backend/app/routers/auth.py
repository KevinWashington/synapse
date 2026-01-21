from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    UserRegister, 
    UserLogin, 
    UserUpdate, 
    PasswordChange,
    UserResponse, 
    AuthResponse
)
from app.core.security import hash_password, verify_password, create_access_token
from app.core.dependencies import get_current_user


router = APIRouter()


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    """Registrar novo usuário."""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Email já cadastrado",
                "message": "Este email já está sendo usado por outro usuário"
            }
        )
    
    # Create user
    user = User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        last_login=datetime.now(timezone.utc)
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    token = create_access_token(user.id)
    
    return AuthResponse(
        success=True,
        message="Usuário criado com sucesso",
        user=UserResponse.model_validate(user),
        token=token
    )


@router.post("/login", response_model=AuthResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    """Fazer login."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "Credenciais inválidas",
                "message": "Email ou senha incorretos"
            }
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "Conta desativada",
                "message": "Sua conta foi desativada"
            }
        )
    
    # Update last login
    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    
    token = create_access_token(user.id)
    
    return AuthResponse(
        success=True,
        message="Login realizado com sucesso",
        user=UserResponse.model_validate(user),
        token=token
    )


@router.get("/profile", response_model=dict)
async def get_profile(current_user: User = Depends(get_current_user)):
    """Obter perfil do usuário."""
    return {
        "success": True,
        "user": UserResponse.model_validate(current_user)
    }


@router.put("/profile", response_model=dict)
async def update_profile(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Atualizar perfil do usuário."""
    # Check if new email already exists
    if data.email and data.email != current_user.email:
        result = await db.execute(
            select(User).where(User.email == data.email, User.id != current_user.id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "Email já cadastrado",
                    "message": "Este email já está sendo usado por outro usuário"
                }
            )
    
    # Update fields
    if data.name:
        current_user.name = data.name
    if data.email:
        current_user.email = data.email
    
    await db.commit()
    await db.refresh(current_user)
    
    return {
        "success": True,
        "message": "Perfil atualizado com sucesso",
        "user": UserResponse.model_validate(current_user)
    }


@router.put("/change-password", response_model=dict)
async def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Alterar senha do usuário."""
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Senha atual incorreta",
                "message": "A senha atual informada está incorreta"
            }
        )
    
    current_user.password_hash = hash_password(data.new_password)
    await db.commit()
    
    return {
        "success": True,
        "message": "Senha alterada com sucesso"
    }


@router.post("/logout", response_model=dict)
async def logout(current_user: User = Depends(get_current_user)):
    """Fazer logout."""
    return {
        "success": True,
        "message": "Logout realizado com sucesso"
    }
