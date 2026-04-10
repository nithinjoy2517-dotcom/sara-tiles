import MySQLdb
try:
    db = MySQLdb.connect(
        host='127.0.0.1', 
        user='root', 
        passwd='root', 
        db='sara_construction'
    )
    print("Direct connection success!")
    cur = db.cursor()
    cur.execute("SELECT name FROM users WHERE email='admin@sara.com'")
    print(f"User check: {cur.fetchone()}")
    db.close()
except Exception as e:
    print(f"Direct connection failed: {e}")
