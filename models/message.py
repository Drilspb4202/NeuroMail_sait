from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Optional, List
from bs4 import BeautifulSoup

class Message(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    message_id: str = Field(default="")
    subject: str = Field(default="")
    sender: str = Field(default="")
    recipient: str = Field(default="")
    date: datetime
    content: str = Field(default="")
    html_content: Optional[str] = Field(default=None)
    attachments: List[str] = Field(default_factory=list)
    
    def __init__(self, **data):
        # Ensure message_id is a string
        if 'message_id' in data:
            data['message_id'] = str(data['message_id'])
            
        # Convert potential None values to empty strings
        for field in ['subject', 'sender', 'recipient', 'content']:
            if field in data and data[field] is None:
                data[field] = ""
                
        super().__init__(**data)
        
        # Если html_content не указан, используем обычный content
        if not self.html_content:
            self.html_content = self.content
        # Если content пустой, но есть html_content, извлекаем текст
        elif not self.content and self.html_content:
            soup = BeautifulSoup(self.html_content, 'html.parser')
            self.content = soup.get_text() 