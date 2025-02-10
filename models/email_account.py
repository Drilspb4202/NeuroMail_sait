from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional

class EmailAccount(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    email: str
    password: str
    service: str
    created_at: datetime = datetime.now()
    last_accessed: Optional[datetime] = None
    is_active: bool = True
    proxy: Optional[str] = None 