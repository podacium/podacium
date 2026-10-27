from pydantic import BaseModel
from typing import Optional, List


class OnboardingSubmit(BaseModel):
    role: Optional[str] = None
    primaryGoal: Optional[str] = None
    experienceLevel: Optional[str] = None
    fieldOfInterest: Optional[str] = None
    weeklyTime: Optional[str] = None
    discoverySource: Optional[str] = None
    openAnswer: Optional[str] = None
    password: Optional[str] = None
    skills: Optional[List[str]] = None
