import os
from pathlib import Path

from dotenv import load_dotenv

# Always load .env from repo root (parent of /app).
ENV_PATH = Path(__file__).resolve().parents[1] / '.env'
load_dotenv(ENV_PATH)

ENV = os.getenv('ENV', 'prod')
ALLOW_PLACEHOLDER_AUTH = ENV.lower() == 'dev'
DATABASE_PATH = os.getenv('DATABASE_PATH', './data/isthisfishy.db')
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
ADMIN_KEY = os.getenv('ADMIN_KEY', 'change-me')
INVITE_REQUIRED = os.getenv('INVITE_REQUIRED', 'true').lower() == 'true'

DEMO_AUTH_TOKEN = os.getenv('DEMO_AUTH_TOKEN', '')
DEMO_AUTH_USER_ID = os.getenv('DEMO_AUTH_USER_ID', 'demo_user')
DEMO_AUTH_EMAIL = os.getenv('DEMO_AUTH_EMAIL', 'demo@local')

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
