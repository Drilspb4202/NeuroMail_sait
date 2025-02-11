import random
import string
from loguru import logger
from typing import Optional, List
import httpx
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential

from models.email_account import EmailAccount
from config import Settings

class EmailCreator:
    # API URLs
    BASE_URL = "https://tempmail.glitchy.workers.dev"
    GET_MAIL_URL = f"{BASE_URL}/get"
    CUSTOM_MAIL_URL = f"{BASE_URL}/custom"

    def __init__(self, settings: Settings):
        self.settings = settings
        self.accounts: List[EmailAccount] = []
        self.client = httpx.AsyncClient(timeout=30.0)  # Увеличиваем timeout
        
    async def __del__(self):
        await self.client.aclose()
        
    def _generate_password(self, length: int = 12) -> str:
        chars = string.ascii_letters + string.digits + "!@#$%^&*"
        return ''.join(random.choice(chars) for _ in range(length))
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def create_email_account(self, service: str, username: Optional[str] = None) -> EmailAccount:
        if service.lower() != "temp-mail":
            raise ValueError("Only temp-mail service is supported")
            
        try:
            if username:
                return await self._create_custom_temp_mail(username)
            return await self._create_temp_mail()
        except Exception as e:
            logger.error(f"Failed to create email account: {str(e)}")
            # Пробуем альтернативный сервис
            return await self._create_alternative_temp_mail()
    
    async def _create_temp_mail(self) -> EmailAccount:
        try:
            for attempt in range(3):  # Попытки с текущим сервисом
                try:
                    response = await self.client.get(self.GET_MAIL_URL)
                    response.raise_for_status()
                    
                    data = response.json()
                    if not data.get("mail"):
                        raise Exception("No email address in response")
                    
                    email = data["mail"]
                    password = self._generate_password()
                    
                    account = EmailAccount(
                        email=email,
                        password=password,
                        service="temp-mail"
                    )
                    
                    self.accounts.append(account)
                    return account
                except httpx.HTTPError as he:
                    logger.warning(f"HTTP error on attempt {attempt + 1}: {str(he)}")
                    if attempt < 2:  # Если это не последняя попытка
                        await asyncio.sleep(2 ** attempt)  # Экспоненциальная задержка
                    continue
                except Exception as e:
                    logger.error(f"Error on attempt {attempt + 1}: {str(e)}")
                    if attempt < 2:
                        await asyncio.sleep(2 ** attempt)
                    continue
            
            # Если все попытки не удались, пробуем альтернативный сервис
            return await self._create_alternative_temp_mail()
                
        except Exception as e:
            logger.error(f"Error creating temp mail account: {str(e)}")
            raise
            
    async def _create_custom_temp_mail(self, username: str) -> EmailAccount:
        try:
            params = {"username": username}
            response = await self.client.get(self.CUSTOM_MAIL_URL, params=params)
            response.raise_for_status()
            
            data = response.json()
            if not data.get("mail"):
                raise Exception("No email address in response")
            
            email = data["mail"]
            password = self._generate_password()
            
            account = EmailAccount(
                email=email,
                password=password,
                service="temp-mail"
            )
            
            self.accounts.append(account)
            return account
                
        except Exception as e:
            logger.error(f"Error creating custom temp mail account: {str(e)}")
            raise
    
    async def _create_alternative_temp_mail(self) -> EmailAccount:
        """Создание почты через альтернативный сервис"""
        logger.error("Сервис временно перегружен, пожалуйста, попробуйте позже")
        raise Exception("Сервис временно перегружен, пожалуйста, попробуйте позже")
    
    async def list_accounts(self) -> List[EmailAccount]:
        return self.accounts 