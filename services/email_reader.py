from imap_tools import MailBox, AND
from typing import List, Optional
from datetime import datetime, timedelta
from loguru import logger
import httpx
import re
from bs4 import BeautifulSoup

from models.message import Message
from config import Settings

class EmailReader:
    BASE_URL = "https://tempmail.glitchy.workers.dev"
    SEE_MESSAGES_URL = f"{BASE_URL}/see"
    GET_MESSAGE_URL = f"{BASE_URL}/message"

    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = httpx.AsyncClient()
        
    async def __del__(self):
        await self.client.aclose()
        
    async def get_messages(self, email: str, since: Optional[datetime] = None) -> List[Message]:
        if not since:
            since = datetime.now() - timedelta(days=1)
            
        try:
            return await self._get_temp_mail_messages(email, since)
        except Exception as e:
            logger.error(f"Error reading messages for {email}: {str(e)}")
            return []
    
    async def _get_temp_mail_messages(self, email: str, since: datetime) -> List[Message]:
        try:
            logger.info(f"Fetching messages for {email}")
            # Get message list
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
                    logger.debug(f"Processing message data: {msg_data}")
                    
                    # Ensure message has an ID
                    if not msg_data.get("id"):
                        logger.warning("Message without ID, skipping")
                        continue
                    
                    # Parse date from string
                    date_str = msg_data.get("date", "")
                    try:
                        date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                    except:
                        logger.warning(f"Could not parse date: {date_str}, using current time")
                        date = datetime.now()
                    
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
                        logger.debug(f"Created message object: {message}")
                        messages.append(message)
                except Exception as e:
                    logger.error(f"Error processing message: {str(e)}", exc_info=True)
                    continue
            
            return messages
                
        except Exception as e:
            logger.error(f"Error reading temp mail messages: {str(e)}", exc_info=True)
            return [] 