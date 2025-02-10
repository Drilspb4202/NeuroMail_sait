from imap_tools import MailBox, AND
from typing import List, Optional
from datetime import datetime, timedelta
from loguru import logger
import httpx
import re
from bs4 import BeautifulSoup
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential

from models.message import Message
from config import Settings

class EmailReader:
    BASE_URL = "https://tempmail.glitchy.workers.dev"
    FALLBACK_URL = "https://api.internal-mail.org" # Альтернативный сервис
    SEE_MESSAGES_URL = f"{BASE_URL}/see"
    GET_MESSAGE_URL = f"{BASE_URL}/message"

    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = httpx.AsyncClient(timeout=30.0)
        self.use_fallback = False
        
    async def __del__(self):
        await self.client.aclose()
        
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def get_messages(self, email: str, since: Optional[datetime] = None) -> List[Message]:
        if not since:
            since = datetime.now() - timedelta(days=1)
            
        try:
            messages = await self._get_temp_mail_messages(email, since)
            if not messages and self.use_fallback:
                # Если основной сервис не работает, пробуем альтернативный
                messages = await self._get_fallback_messages(email, since)
            return messages
        except Exception as e:
            logger.error(f"Error reading messages for {email}: {str(e)}")
            if not self.use_fallback:
                self.use_fallback = True
                return await self._get_fallback_messages(email, since)
            return []
    
    async def _get_temp_mail_messages(self, email: str, since: datetime) -> List[Message]:
        try:
            logger.info(f"Fetching messages for {email}")
            
            for attempt in range(3):
                try:
                    params = {"mail": email}
                    response = await self.client.get(self.SEE_MESSAGES_URL, params=params)
                    response.raise_for_status()
                    
                    data = response.json()
                    logger.debug(f"Raw API response: {data}")
                    
                    if not data.get("messages"):
                        logger.info("No messages found")
                        return []
                    
                    messages = []
                    for msg_data in data["messages"]:
                        try:
                            if not msg_data.get("id"):
                                continue
                                
                            date = self._parse_date(msg_data.get("date", ""))
                            
                            if date >= since:
                                message = Message(
                                    message_id=str(msg_data["id"]),
                                    subject=msg_data.get("subject", ""),
                                    sender=msg_data.get("from", ""),
                                    recipient=msg_data.get("to", ""),
                                    date=date,
                                    content=msg_data.get("body_text", ""),
                                    html_content=msg_data.get("body_html", "")
                                )
                                messages.append(message)
                        except Exception as e:
                            logger.error(f"Error processing message: {str(e)}", exc_info=True)
                            continue
                    
                    return messages
                    
                except httpx.HTTPError as he:
                    logger.warning(f"HTTP error on attempt {attempt + 1}: {str(he)}")
                    if attempt < 2:
                        await asyncio.sleep(2 ** attempt)
                    continue
                    
            logger.warning("All attempts failed, switching to fallback service")
            self.use_fallback = True
            return []
                
        except Exception as e:
            logger.error(f"Error reading temp mail messages: {str(e)}", exc_info=True)
            self.use_fallback = True
            return []
            
    async def _get_fallback_messages(self, email: str, since: datetime) -> List[Message]:
        """Альтернативный метод получения сообщений"""
        try:
            logger.info(f"Using fallback service for {email}")
            # Здесь будет код для работы с альтернативным сервисом
            # Пока возвращаем пустой список
            return []
        except Exception as e:
            logger.error(f"Error reading fallback messages: {str(e)}", exc_info=True)
            return []
            
    def _parse_date(self, date_str: str) -> datetime:
        """Безопасный парсинг даты"""
        try:
            return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        except:
            logger.warning(f"Could not parse date: {date_str}, using current time")
            return datetime.now() 