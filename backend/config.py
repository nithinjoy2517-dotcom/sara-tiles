import os

class Config:
    """Flask application configuration."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'sara-construction-secret-key-2026')

    # MySQL Database Configuration
    MYSQL_HOST = os.environ.get('MYSQL_HOST', '127.0.0.1')
    MYSQL_USER = os.environ.get('MYSQL_USER', 'root')
    MYSQL_PASSWORD = os.environ.get('MYSQL_PASSWORD', 'root')
    MYSQL_DB = os.environ.get('MYSQL_DB', 'sara_construction')
    MYSQL_CURSORCLASS = 'DictCursor'

    # CORS
    CORS_HEADERS = 'Content-Type'
    
    # Mail Config
    MAIL_SERVER = 'smtp.gmail.com'
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_USE_SSL = False
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME', 'nithinjoy2517@gmail.com')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD', 'tloz hclv zbyi cirg')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER', 'nithinjoy2517@gmail.com')
