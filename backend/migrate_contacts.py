
import MySQLdb
import os

# Database configuration from environment or defaults
host = "127.0.0.1"
user = "root"
passwd = "root"
db = "sara_construction"

try:
    conn = MySQLdb.connect(host=host, user=user, passwd=passwd, db=db)
    cursor = conn.cursor()
    
    # 1. Update status enum
    print("Updating status enum...")
    cursor.execute("ALTER TABLE contacts MODIFY COLUMN status ENUM('new','read','replied','in_progress', 'cancelled') DEFAULT 'new'")
    
    # 2. Add remarks column
    print("Adding remarks column...")
    try:
        cursor.execute("ALTER TABLE contacts ADD COLUMN remarks TEXT AFTER message")
    except Exception as e:
        print(f"Remarks column might already exist: {e}")
        
    # 3. Add priority column
    print("Adding priority column...")
    try:
        cursor.execute("ALTER TABLE contacts ADD COLUMN priority ENUM('low','normal','high') DEFAULT 'normal' AFTER status")
    except Exception as e:
        print(f"Priority column might already exist: {e}")
        
    conn.commit()
    print("Database migration successful!")
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Database migration failed: {e}")
