import os
from dotenv import load_dotenv

load_dotenv()

ENV = os.getenv("ENV", "dev")
DATABASE_PATH = os.getenv("DATABASE_PATH", "./data/isthisfishy.db")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
ADMIN_KEY = os.getenv("ADMIN_KEY", "change-me")

INVITE_REQUIRED = os.getenv("INVITE_REQUIRED", "true").lower() == "true"
