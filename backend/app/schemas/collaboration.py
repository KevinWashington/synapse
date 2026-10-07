from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator


MemberRole = Literal["coordinator", "reviewer"]
TeamRole = Literal["owner", "coordinator", "reviewer"]


class InvitationCreate(BaseModel):
    email: EmailStr
    role: MemberRole = "reviewer"
    participatesInReview: bool = True

    @model_validator(mode="after")
    def reviewer_always_participates(self):
        if self.role == "reviewer":
            self.participatesInReview = True
        return self


class InvitationUpdate(BaseModel):
    role: MemberRole | None = None
    participatesInReview: bool | None = None


class InvitationResponse(BaseModel):
    id: int
    projectId: int
    emailNormalized: str
    role: MemberRole
    participatesInReview: bool
    status: str
    expiresAt: datetime
    acceptedAt: datetime | None = None
    createdAt: datetime

    class Config:
        from_attributes = True


class MemberUpdate(BaseModel):
    role: MemberRole | None = None
    participatesInReview: bool | None = None


class MemberResponse(BaseModel):
    id: int | None = None
    projectId: int
    userId: int
    name: str | None = None
    email: str | None = None
    avatar: str | None = None
    role: TeamRole
    status: str
    participatesInReview: bool
    joinedAt: datetime | None = None
    deactivatedAt: datetime | None = None

    class Config:
        from_attributes = True


class TeamResponse(BaseModel):
    members: list[MemberResponse] = Field(default_factory=list)
    invitations: list[InvitationResponse] = Field(default_factory=list)


class OwnershipTransferRequest(BaseModel):
    userId: int


class NotificationResponse(BaseModel):
    id: int
    projectId: int
    recipientUserId: int
    type: str
    title: str
    body: str
    entityType: str | None = None
    entityId: int | None = None
    payload: dict | None = None
    readAt: datetime | None = None
    createdAt: datetime

    class Config:
        from_attributes = True


class DistributionRequest(BaseModel):
    phase: Literal["screening", "eligibility"]


class AssignmentPlanItemResponse(BaseModel):
    articleId: int
    reviewerUserId: int
    slot: int


class DistributionPreviewResponse(BaseModel):
    phase: Literal["screening", "eligibility"]
    articleCount: int
    reviewerCount: int
    assignments: list[AssignmentPlanItemResponse] = Field(default_factory=list)
    loads: dict[int, int] = Field(default_factory=dict)


class ReassignmentRequest(BaseModel):
    reviewerUserId: int


class AssignmentResponse(BaseModel):
    id: int
    projectId: int
    articleId: int
    phase: Literal["screening", "eligibility"]
    reviewerUserId: int
    slot: int
    status: str
    assignedAt: datetime
    submittedAt: datetime | None = None

    class Config:
        from_attributes = True


class ConflictResolutionRequest(BaseModel):
    decision: Literal["included", "excluded", "full_text_unavailable"]
    reason: str = Field(..., min_length=1, max_length=2000)


class ReopenReviewRequest(BaseModel):
    phase: Literal["screening", "eligibility"]
    reason: str = Field(..., min_length=1, max_length=2000)


class ConflictResponse(BaseModel):
    id: int
    projectId: int
    articleId: int
    phase: Literal["screening", "eligibility"]
    status: str
    decisionIds: list[int]
    resolvedDecision: str | None = None
    resolutionReason: str | None = None
    resolvedByUserId: int | None = None
    createdAt: datetime
    resolvedAt: datetime | None = None
    decisions: list[dict] = Field(default_factory=list)

    class Config:
        from_attributes = True
