from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, FileResponse
from fastapi import Request
from pydantic import BaseModel
from loguru import logger
import uvicorn
import os
from dotenv import load_dotenv
from typing import List, Optional
from datetime import datetime
from pathlib import Path
import logging

from services.email_creator import EmailCreator
from services.email_reader import EmailReader
from services.code_extractor import CodeExtractor
from models.email_account import EmailAccount
from models.message import Message
from config import Settings

# Load environment variables
load_dotenv()

# Initialize settings
settings = Settings()

# Initialize FastAPI app
app = FastAPI(
    title="Email Bot API",
    description="API for automated email account creation and management",
    version="1.0.0"
)

# Добавляем обработчик событий запуска и остановки
@app.on_event("startup")
async def startup_event():
    logger.info("=== Starting up server ===")
    try:
        # Создаем необходимые директории
        required_dirs = [
            'data',
            'data/logs',
            'data/db',
            'data/temp'
        ]
        
        for dir_path in required_dirs:
            try:
                Path(dir_path).mkdir(parents=True, exist_ok=True)
                logger.info(f"Created directory: {dir_path}")
            except Exception as e:
                logger.warning(f"Error creating directory {dir_path}: {e}")
        
        # Настраиваем логирование
        logging.basicConfig(
            filename='data/logs/app.log',
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        logger.info("Logging initialized")
        
        # Проверяем доступность сервисов
        await email_creator.health_check()
        await email_reader.health_check()
        logger.info("All services initialized successfully")
        
    except Exception as e:
        logger.error(f"Startup error: {str(e)}", exc_info=True)
        # Не вызываем raise, чтобы приложение могло запуститься даже при ошибках
        logger.warning("Continuing startup despite errors...")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("=== Server shutdown initiated ===")
    try:
        # Освобождаем ресурсы
        await email_creator.cleanup()
        await email_reader.cleanup()
        logger.info("Resources cleaned up successfully")
    except Exception as e:
        logger.error(f"Shutdown error: {str(e)}", exc_info=True)
    finally:
        logger.info("=== Server shutdown complete ===")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add cache control middleware
@app.middleware("http")
async def add_cache_control_headers(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/static"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# Configure logging
logger.remove()  # Remove default handler
logger.add(
    settings.log_file,
    level=settings.log_level,
    rotation="500 MB",
    retention="10 days",
    enqueue=True,
    backtrace=True,
    diagnose=True
)

# Add error logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    try:
        response = await call_next(request)
        logger.info(f"Request: {request.method} {request.url.path} - Status: {response.status_code}")
        return response
    except Exception as e:
        logger.error(f"Request failed: {request.method} {request.url.path} - Error: {str(e)}")
        raise

# Mount static files with custom config
app.mount("/static", StaticFiles(directory="static", html=True, check_dir=True), name="static")

# Initialize templates with custom config
templates = Jinja2Templates(directory="templates")
templates.env.globals.update({
    "static_url": lambda path: f"/static/{path}?v={os.path.getmtime(os.path.join('static', path))}"
})

# Initialize services
email_creator = EmailCreator(settings)
email_reader = EmailReader(settings)
code_extractor = CodeExtractor()

# Models for API requests/responses
class CreateEmailRequest(BaseModel):
    service: str
    proxy: Optional[str] = None
    username: Optional[str] = None

class CreateEmailResponse(BaseModel):
    email: str
    status: str = "success"

class EmailMessage(BaseModel):
    subject: str
    sender: str
    date: datetime
    content: str
    message_id: str
    verification_code: Optional[str] = None
    verification_link: Optional[str] = None
    html_content: Optional[str] = None

@app.get("/health")
async def health_check():
    try:
        # Проверяем директории
        log_dir = Path("data/logs")
        db_dir = Path("data/db")
        
        health_status = {
            "status": "ok",
            "timestamp": datetime.now().isoformat(),
            "version": "1.0.0",
            "checks": {
                "log_directory": {
                    "status": log_dir.exists() and log_dir.is_dir(),
                    "path": str(log_dir.absolute()),
                    "writable": os.access(log_dir, os.W_OK)
                },
                "database_directory": {
                    "status": db_dir.exists() and db_dir.is_dir(),
                    "path": str(db_dir.absolute()),
                    "writable": os.access(db_dir, os.W_OK)
                },
                "disk_space": {
                    "available": True,
                    "path": str(Path("data").absolute())
                },
                "services": {
                    "email_creator": True,
                    "email_reader": True
                }
            }
        }
        
        # Проверяем общее состояние
        all_checks_ok = all([
            health_status["checks"]["log_directory"]["status"],
            health_status["checks"]["database_directory"]["status"],
            health_status["checks"]["disk_space"]["available"],
            health_status["checks"]["services"]["email_creator"],
            health_status["checks"]["services"]["email_reader"]
        ])
        
        health_status["status"] = "ok" if all_checks_ok else "warning"
        
        return health_status
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "error",
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }

@app.get("/yandex_80d47bc6703d08b0.html")
async def yandex_verification():
    verification_html = """<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    </head>
    <body>Verification: 80d47bc6703d08b0</body>
</html>"""
    return HTMLResponse(content=verification_html, status_code=200)

@app.get("/")
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/api/email/create", response_model=CreateEmailResponse)
async def create_email(request: CreateEmailRequest):
    try:
        # Валидация и нормализация service
        service = request.service.lower().replace("_", "-").strip()
        if service not in ["temp-mail", "tempmail"]:
            raise HTTPException(
                status_code=400,
                detail="Поддерживается только сервис temp-mail"
            )
        
        logger.info(f"Creating new email account with service: {service}")
        
        # Создание email аккаунта с обработкой ошибок
        try:
            email = await email_creator.create_email_account(
                service="temp-mail",
                username=request.username
            )
        except Exception as e:
            logger.error(f"Failed to create email account: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="Не удалось создать почтовый ящик. Сервис временно недоступен."
            )
            
        if not email:
            logger.error("Email creation failed - no email returned")
            raise HTTPException(
                status_code=500,
                detail="Не удалось создать почтовый ящик. Пожалуйста, попробуйте позже."
            )
            
        logger.info(f"Successfully created email account: {email}")
        
        # Возвращаем ответ
        return CreateEmailResponse(
            email=email,
            status="success"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error during email creation")
        raise HTTPException(
            status_code=500,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )

@app.get("/api/email/list", response_model=List[EmailAccount])
async def list_emails():
    try:
        return await email_creator.list_accounts()
    except Exception as e:
        logger.error(f"Error listing email accounts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/email/messages/{email}", response_model=List[EmailMessage])
async def get_messages(email: str):
    try:
        logger.info(f"Getting messages for email: {email}")
        messages = await email_reader.get_messages(email)
        logger.info(f"Found {len(messages)} messages")
        
        formatted_messages = []
        for msg in messages:
            try:
                formatted_msg = EmailMessage(
                    subject=msg.subject,
                    sender=msg.sender,
                    date=msg.date,
                    content=msg.content,
                    message_id=msg.message_id,
                    verification_code=code_extractor.extract_code(msg.content),
                    verification_link=code_extractor.extract_link(msg.content),
                    html_content=msg.html_content
                )
                logger.debug(f"Formatted message: {formatted_msg}")
                formatted_messages.append(formatted_msg)
            except Exception as e:
                logger.error(f"Error formatting message: {str(e)}", exc_info=True)
                continue
                
        return formatted_messages
    except Exception as e:
        logger.error(f"Error getting messages: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/email/codes/{email}", response_model=List[str])
async def get_verification_codes(email: str):
    try:
        messages = await email_reader.get_messages(email)
        codes = [
            code for msg in messages
            if (code := code_extractor.extract_code(msg.content)) is not None
        ]
        return codes
    except Exception as e:
        logger.error(f"Error getting verification codes: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/email/messages/{email}/{message_id}", response_model=EmailMessage)
async def get_message(email: str, message_id: str):
    try:
        logger.info(f"Getting message {message_id} for email: {email}")
        
        if not message_id:
            logger.error("Message ID is missing")
            raise HTTPException(status_code=400, detail="Message ID is required")
            
        messages = await email_reader.get_messages(email)
        logger.debug(f"Found {len(messages)} messages")
        
        # Ищем сообщение по ID
        message = next((msg for msg in messages if str(msg.message_id) == str(message_id)), None)
        
        if not message:
            logger.warning(f"Message {message_id} not found for email {email}")
            raise HTTPException(
                status_code=404,
                detail=f"Сообщение с ID {message_id} не найдено"
            )
            
        logger.info(f"Returning message: {message.subject}")
        return EmailMessage(
            subject=message.subject,
            sender=message.sender,
            date=message.date,
            content=message.content,
            message_id=message.message_id,
            html_content=message.html_content,
            verification_code=code_extractor.extract_code(message.content),
            verification_link=code_extractor.extract_link(message.content)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting message: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Произошла ошибка при получении сообщения"
        )

@app.delete("/api/email/delete/{email}")
async def delete_email(email: str):
    try:
        logger.info(f"Attempting to delete email account: {email}")
        
        # Проверяем существование email
        if not await email_creator.email_exists(email):
            logger.warning(f"Email account not found: {email}")
            # Возвращаем 200 даже если почта не найдена, так как результат тот же - почты нет
            return {"status": "success", "message": "Email account deleted or not found"}
            
        # Удаляем почту
        success = await email_creator.delete_email_account(email)
        if not success:
            logger.error(f"Failed to delete email account: {email}")
            raise HTTPException(
                status_code=500,
                detail="Не удалось удалить почтовый ящик"
            )
            
        logger.info(f"Successfully deleted email account: {email}")
        return {"status": "success", "message": "Email account deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error deleting email account: {email}")
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка при удалении почтового ящика: {str(e)}"
        )

if __name__ == "__main__":
    logger.add(
        settings.log_file,
        level=settings.log_level,
        rotation="500 MB",
        retention="10 days"
    )
    
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True
    ) 