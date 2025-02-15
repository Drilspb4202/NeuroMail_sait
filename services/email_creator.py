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
        self.client = httpx.AsyncClient(timeout=30.0)
        
    def __del__(self):
        # Закрываем клиент синхронно
        if self.client and not self.client.is_closed:
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(self.client.aclose())
                else:
                    loop.run_until_complete(self.client.aclose())
            except Exception as e:
                logger.error(f"Error in EmailCreator cleanup: {e}")
        
    async def cleanup(self):
        """Метод для правильной очистки ресурсов"""
        if self.client and not self.client.is_closed:
            try:
                await self.client.aclose()
                logger.info("EmailCreator resources cleaned up")
            except Exception as e:
                logger.error(f"Error cleaning up EmailCreator: {e}")
    
    def _generate_password(self, length: int = 12) -> str:
        chars = string.ascii_letters + string.digits + "!@#$%^&*"
        return ''.join(random.choice(chars) for _ in range(length))
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def create_email_account(self, service: str, username: Optional[str] = None) -> str:
        if service.lower() != "temp-mail":
            raise ValueError("Поддерживается только сервис temp-mail")
            
        try:
            if username:
                account = await self._create_custom_temp_mail(username)
            else:
                account = await self._create_temp_mail()
            return account.email
        except Exception as e:
            logger.error(f"Ошибка создания почты: {str(e)}")
            raise Exception("Не удалось создать почту. Пожалуйста, попробуйте позже.")
    
    async def _create_temp_mail(self) -> EmailAccount:
        for attempt in range(3):
            try:
                response = await self.client.get(self.GET_MAIL_URL)
                response.raise_for_status()
                
                data = response.json()
                if not data.get("mail"):
                    raise Exception("Сервис не вернул адрес почты")
                
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
                logger.warning(f"Ошибка HTTP на попытке {attempt + 1}: {str(he)}")
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)
                continue
            except Exception as e:
                logger.error(f"Ошибка на попытке {attempt + 1}: {str(e)}")
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)
                continue
        
        raise Exception("Сервис временно недоступен. Пожалуйста, попробуйте позже.")
            
    async def _create_custom_temp_mail(self, username: str) -> EmailAccount:
        try:
            params = {"username": username}
            response = await self.client.get(self.CUSTOM_MAIL_URL, params=params)
            response.raise_for_status()
            
            data = response.json()
            if not data.get("mail"):
                raise Exception("Сервис не вернул адрес почты")
            
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
            logger.error(f"Ошибка создания кастомной почты: {str(e)}")
            raise Exception("Не удалось создать почту с указанным именем. Пожалуйста, попробуйте другое имя или позже.")
    
    async def _create_alternative_temp_mail(self) -> EmailAccount:
        """Создание почты через альтернативный сервис"""
        logger.error("Сервис временно перегружен, пожалуйста, попробуйте позже")
        raise Exception("Сервис временно перегружен, пожалуйста, попробуйте позже")
    
    async def list_accounts(self) -> List[EmailAccount]:
        return self.accounts 

    async def email_exists(self, email: str) -> bool:
        """Проверяет существование email аккаунта"""
        try:
            # Проверяем в локальном списке
            if any(account.email == email for account in self.accounts):
                return True
                
            # Пытаемся получить информацию о почте
            response = await self.client.get(
                f"{self.BASE_URL}/mailbox/{email}"
            )
            return response.status_code == 200
            
        except Exception as e:
            logger.error(f"Error checking email existence: {e}")
            return False
            
    async def delete_email_account(self, email: str) -> bool:
        """Удаляет email аккаунт"""
        try:
            # Удаляем из локального списка
            self.accounts = [acc for acc in self.accounts if acc.email != email]
            
            # Отправляем запрос на удаление
            response = await self.client.delete(
                f"{self.BASE_URL}/mailbox/{email}"
            )
            
            if response.status_code == 200:
                logger.info(f"Successfully deleted email account: {email}")
                return True
            else:
                logger.error(f"Failed to delete email account: {email}, status: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Error deleting email account: {e}")
            return False 