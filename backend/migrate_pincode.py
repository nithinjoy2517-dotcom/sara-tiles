import MySQLdb
import os
from config import Config

def add_pincode_column():
    try:
        db = MySQLdb.connect(
            host=Config.MYSQL_HOST,
            user=Config.MYSQL_USER,
            passwd=Config.MYSQL_PASSWORD,
            db=Config.MYSQL_DB
        )
        cursor = db.cursor()
        
        # Check if pincode exists
        cursor.execute("SHOW COLUMNS FROM users LIKE 'pincode'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE users ADD COLUMN pincode VARCHAR(10)")
            print("Added pincode column.")
            
        db.commit()
        db.close()
        print("Database migration complete.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    add_pincode_column()
