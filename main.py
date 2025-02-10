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

# Initialize FastAPI app
app = FastAPI(
    title="Email Bot API",
    description="API for automated email account creation and management",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for root directory
app.mount("/", StaticFiles(directory="."), name="root")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Initialize templates
templates = Jinja2Templates(directory="templates")

# Initialize services
settings = Settings()
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

@app.get("/verification", response_class=HTMLResponse)
async def verification(request: Request):
    return templates.TemplateResponse("verification.html", {"request": request})

@app.get("/", response_class=HTMLResponse)
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