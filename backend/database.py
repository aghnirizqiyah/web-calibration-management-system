import psycopg2
from psycopg2.extras import RealDictCursor

def get_connection():
    return psycopg2.connect(
        host="localhost",
        database="Kalibrasi",
        user="postgres",
        password="nrghnrzqyh1712",
        port="5432"
    )


def get_cursor():
    """
    Cursor yang langsung return hasil dalam bentuk dictionary
    (lebih cocok untuk API karena langsung bisa jadi JSON)
    """
    conn = get_connection()
    return conn, conn.cursor(cursor_factory=RealDictCursor)