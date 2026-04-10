#!/usr/bin/env python
import MySQLdb
import MySQLdb.cursors
from config import Config

try:
    conn = MySQLdb.connect(
        host=Config.MYSQL_HOST,
        user=Config.MYSQL_USER,
        passwd=Config.MYSQL_PASSWORD,
        db=Config.MYSQL_DB,
        cursorclass=MySQLdb.cursors.DictCursor
    )
    cur = conn.cursor()
    
    # Check if is_active column exists
    cur.execute("DESCRIBE users")
    columns = cur.fetchall()
    
    print("Users table columns:")
    for col in columns:
        print(f"  - {col['Field']}: {col['Type']}")
    
    # Check if is_active exists
    has_is_active = any(col['Field'] == 'is_active' for col in columns)
    print(f"\nis_active column exists: {has_is_active}")
    
    if not has_is_active:
        print("\nAdding is_active column...")
        cur.execute("ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1")
        conn.commit()
        print("Column added successfully!")
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")


