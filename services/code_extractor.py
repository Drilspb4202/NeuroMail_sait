import re
from typing import Optional
from bs4 import BeautifulSoup
from loguru import logger

class CodeExtractor:
    def __init__(self):
        # Common patterns for verification codes
        self.code_patterns = [
            r'\b[0-9]{4,8}\b',  # 4-8 digit numbers
            r'\b[A-Z0-9]{6,8}\b',  # 6-8 character alphanumeric codes
            r'verification code[:\s]+([A-Z0-9]{4,8})',  # Codes preceded by "verification code"
            r'confirmation code[:\s]+([A-Z0-9]{4,8})',  # Codes preceded by "confirmation code"
            r'security code[:\s]+([A-Z0-9]{4,8})',  # Codes preceded by "security code"
            r'one-time code[:\s]+([A-Z0-9]{4,8})'  # Codes preceded by "one-time code"
        ]
        
        # Common patterns for verification links
        self.link_patterns = [
            r'https?://[^\s<>"]+?/verify[^\s<>"]+',
            r'https?://[^\s<>"]+?/confirm[^\s<>"]+',
            r'https?://[^\s<>"]+?/activate[^\s<>"]+',
            r'https?://[^\s<>"]+?/validation[^\s<>"]+',
        ]
    
    def extract_code(self, content: str) -> Optional[str]:
        try:
            # Try to parse HTML content
            soup = BeautifulSoup(content, 'html.parser')
            text_content = soup.get_text()
        except:
            text_content = content
            
        try:
            # Search for verification codes using patterns
            for pattern in self.code_patterns:
                matches = re.findall(pattern, text_content, re.IGNORECASE)
                if matches:
                    # Return the first match that looks most like a verification code
                    for match in matches:
                        # Prefer matches that are exactly 6 digits
                        if re.match(r'^\d{6}$', match):
                            return match
                    return matches[0]
                    
            return None
        except Exception as e:
            logger.error(f"Error extracting verification code: {str(e)}")
            return None
    
    def extract_link(self, content: str) -> Optional[str]:
        try:
            # Try to parse HTML content
            soup = BeautifulSoup(content, 'html.parser')
            
            # First try to find verification links in anchor tags
            for a in soup.find_all('a'):
                href = a.get('href', '')
                if any(keyword in href.lower() for keyword in ['verify', 'confirm', 'activate', 'validation']):
                    return href
            
            # If no anchor tags found, try regex patterns
            text_content = soup.get_text() if soup else content
            for pattern in self.link_patterns:
                matches = re.findall(pattern, text_content)
                if matches:
                    return matches[0]
                    
            return None
        except Exception as e:
            logger.error(f"Error extracting verification link: {str(e)}")
            return None 