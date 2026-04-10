import MySQLdb
import os
from config import Config

def update_db():
    try:
        db = MySQLdb.connect(
            host=Config.MYSQL_HOST,
            user=Config.MYSQL_USER,
            passwd=Config.MYSQL_PASSWORD,
            db=Config.MYSQL_DB
        )
        cursor = db.cursor()
        
        # Check if column exists, and if not add it
        cursor.execute("SHOW COLUMNS FROM users LIKE 'is_verified'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE users ADD COLUMN is_verified TINYINT(1) DEFAULT 0")
            print("Added is_verified column.")
            
            # Since there are probably existing users, let's verify them so they aren't locked out
            cursor.execute("UPDATE users SET is_verified = 1")
            print("Set existing users to verified.")
            
        db.commit()
        db.close()
        print("Database updated successfully.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    update_db()
