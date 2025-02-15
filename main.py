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
        # Проверяем и создаем необходимые директории
        required_dirs = [
            '/data',
            '/data/logs',
            '/data/db',
            '/data/temp'
        ]
        
        for dir_path in required_dirs:
            if not os.path.exists(dir_path):
                try:
                    os.makedirs(dir_path, exist_ok=True)
                    logger.info(f"Created directory: {dir_path}")
                except Exception as e:
                    logger.error(f"Failed to create directory {dir_path}: {str(e)}")
                    continue
        
        # Настраиваем логирование
        log_path = '/data/logs/app.log'
        logger.add(
            log_path,
            level=settings.log_level,
            rotation="500 MB",
            retention="10 days",
            enqueue=True,
            backtrace=True,
            diagnose=True
        )
        logger.info(f"Logging initialized: {log_path}")
        
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
    password: str
    status: str

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
        # Проверяем доступность директорий
        log_dir = os.path.dirname(settings.log_file)
        db_path = settings.database_url.replace('sqlite:////', '')
        db_dir = os.path.dirname(db_path)
        
        health_status = {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "version": "1.0.0",
            "checks": {
                "log_directory": {
                    "status": os.path.exists(log_dir),
                    "path": log_dir,
                    "writable": os.access(log_dir, os.W_OK) if os.path.exists(log_dir) else False
                },
                "database_directory": {
                    "status": os.path.exists(db_dir),
                    "path": db_dir,
                    "writable": os.access(db_dir, os.W_OK) if os.path.exists(db_dir) else False
                },
                "disk_space": {
                    "available": True,
                    "path": "/data"
                }
            }
        }
        
        # Проверяем свободное место на диске
        try:
            stat = os.statvfs('/data')
            free_space = (stat.f_bavail * stat.f_frsize) / (1024 * 1024 * 1024)  # в ГБ
            total_space = (stat.f_blocks * stat.f_frsize) / (1024 * 1024 * 1024)  # в ГБ
            used_space = total_space - free_space
            
            health_status["checks"]["disk_space"].update({
                "free_space_gb": round(free_space, 2),
                "total_space_gb": round(total_space, 2),
                "used_space_gb": round(used_space, 2),
                "usage_percent": round((used_space / total_space) * 100, 1)
            })
            
            # Если свободного места меньше 100МБ или использовано более 90%, помечаем как проблему
            if free_space < 0.1 or (used_space / total_space) > 0.9:
                health_status["status"] = "warning"
                health_status["checks"]["disk_space"]["available"] = False
                logger.warning(f"Low disk space: {free_space:.2f}GB remaining, {(used_space / total_space) * 100:.1f}% used")
        except Exception as e:
            logger.error(f"Error checking disk space: {str(e)}")
            health_status["checks"]["disk_space"]["error"] = str(e)
        
        # Проверяем работоспособность сервисов
        services_status = {"email_creator": False, "email_reader": False}
        
        try:
            await email_creator.health_check()
            services_status["email_creator"] = True
        except Exception as e:
            health_status["status"] = "warning"
            logger.error(f"Email creator health check failed: {str(e)}")
            services_status["email_creator_error"] = str(e)
        
        try:
            await email_reader.health_check()
            services_status["email_reader"] = True
        except Exception as e:
            health_status["status"] = "warning"
            logger.error(f"Email reader health check failed: {str(e)}")
            services_status["email_reader_error"] = str(e)
        
        health_status["checks"]["services"] = services_status
        
        # Добавляем информацию о системных ресурсах
        try:
            import psutil
            memory = psutil.virtual_memory()
            health_status["checks"]["system"] = {
                "cpu_percent": psutil.cpu_percent(interval=1),
                "memory_percent": memory.percent,
                "memory_available_mb": round(memory.available / (1024 * 1024), 2)
            }
            
            # Предупреждение при высокой нагрузке
            if memory.percent > 90 or psutil.cpu_percent() > 80:
                health_status["status"] = "warning"
                logger.warning(f"High system load: CPU {psutil.cpu_percent()}%, Memory {memory.percent}%")
        except Exception as e:
            logger.error(f"Error checking system resources: {str(e)}")
        
        return health_status
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}", exc_info=True)
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
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
        # Convert service name to match the expected format
        service = "temp-mail" if request.service.lower() in ["temp-mail", "tempmail", "temp_mail"] else request.service.lower()
        
        email_account = await email_creator.create_email_account(
            service=service,
            username=request.username
        )
            
        return CreateEmailResponse(
            email=email_account.email,
            password=email_account.password,
            status="success"
        )
    except Exception as e:
        logger.error(f"Error creating email account: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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
        logger.debug(f"Message found: {message is not None}")
        
        if not message:
            logger.error(f"Message {message_id} not found")
            raise HTTPException(status_code=404, detail="Message not found")
            
        logger.info(f"Returning message: {message.subject}")
        return EmailMessage(
            subject=message.subject,
            sender=message.sender,
            date=message.date,
            content=message.content,
            message_id=message.message_id,
            html_content=message.html_content
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting message: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

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