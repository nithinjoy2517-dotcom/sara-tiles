import MySQLdb

try:
    db = MySQLdb.connect(
        host="127.0.0.1",
        user="root",
        passwd="root",
        db="sara_construction"
    )
    cur = db.cursor()
    
    # Check if admin already exists to avoid duplicates
    cur.execute("SELECT id FROM users WHERE email = 'admin@sara.com'")
    if cur.fetchone():
        print("Admin user 'admin@sara.com' already exists.")
    else:
        # Re-insert the admin user
        cur.execute("INSERT INTO users (name, email, password, role) VALUES (%s, %s, %s, %s)", 
                   ('Admin User', 'admin@sara.com', 'admin123', 'admin'))
        db.commit()
        print("Successfully re-inserted Admin User!")
    
    db.close()
except Exception as e:
    print(f"Error: {e}")
