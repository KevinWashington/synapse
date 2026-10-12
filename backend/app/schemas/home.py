from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class HomeSummary(BaseModel):
    screeningPending: int
    eligibilityPending: int


class ReadingArticle(BaseModel):
    id: int
    projectId: int
    title: str
    currentPhase: str
    reviewOutcome: str


class ReadingProject(BaseModel):
    id: int
    title: str


class HomeReading(BaseModel):
    article: ReadingArticle
    project: ReadingProject


class HomeTask(BaseModel):
    assignmentId: int
    articleId: int
    projectId: int
    projectTitle: str
    title: str
    year: int
    journal: str
    phase: Literal["screening", "eligibility"]
    assignedAt: datetime


class HomeTaskPage(BaseModel):
    items: list[HomeTask]
    total: int
    page: int
    pageSize: int


class HomeActivity(BaseModel):
    id: str
    articleId: int
    projectId: int
    projectTitle: str
    title: str
    phase: str
    type: Literal["created", "screening", "eligibility", "included"]
    timestamp: datetime


class HomeActivityPage(BaseModel):
    items: list[HomeActivity]
    total: int
    page: int
    pageSize: int
