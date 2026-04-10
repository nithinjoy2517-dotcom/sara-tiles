import MySQLdb
import sys
import os

# Add the current directory to path to import config
sys.path.append(os.getcwd())
from backend.config import Config

try:
    db = MySQLdb.connect(
        host=Config.MYSQL_HOST,
        user=Config.MYSQL_USER,
        passwd=Config.MYSQL_PASSWORD,
        db=Config.MYSQL_DB
    )
    cur = db.cursor(MySQLdb.cursors.DictCursor)
    cur.execute("SELECT name, email, password, role FROM users WHERE role='courier'")
    couriers = cur.fetchall()
    for c in couriers:
        print(f"Name: {c['name']}, Email: {c['email']}, Pass: {c['password']}")
    db.close()
except Exception as e:
    print(f"Error: {e}")
