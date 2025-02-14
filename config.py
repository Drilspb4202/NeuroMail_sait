from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
import os

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', case_sensitive=False)
    
    # API Settings
    api_host: str = os.getenv("API_HOST", "0.0.0.0")
    api_port: int = int(os.getenv("API_PORT", "8000"))
    
    # Security
    secret_key: str = os.getenv("SECRET_KEY", "your-secret-key-here")
    
    # Proxy Settings
    proxy_enabled: bool = os.getenv("PROXY_ENABLED", "false").lower() == "true"
    proxy_list_file: str = os.getenv("PROXY_LIST_FILE", "proxies.txt")
    
    # Browser Settings
    browser_headless: bool = os.getenv("BROWSER_HEADLESS", "true").lower() == "true"
    user_agents_file: str = os.getenv("USER_AGENTS_FILE", "user_agents.txt")
    
    # Email Service Credentials
    gmail_app_password: Optional[str] = os.getenv("GMAIL_APP_PASSWORD")
    outlook_app_password: Optional[str] = os.getenv("OUTLOOK_APP_PASSWORD")
    
    # Database
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./emailbot.db")
    
    # Logging
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    log_file: str = os.getenv("LOG_FILE", "app.log") 