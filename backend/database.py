import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("postgresql://postgres:XjDrZLdIfplcbSqLzHONZcSIeBLxcIIx@postgres.railway.internal:5432/railway")


def get_connection():
    return psycopg2.connect(DATABASE_URL)


def get_cursor():
    conn = get_connection()
    return conn, conn.cursor(cursor_factory=RealDictCursor)