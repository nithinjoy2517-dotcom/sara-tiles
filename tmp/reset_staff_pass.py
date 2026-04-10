import MySQLdb
from werkzeug.security import generate_password_hash

try:
    conn = MySQLdb.connect(
        host='127.0.0.1',
        user='root',
        passwd='root',
        db='sara_construction'
    )
    cur = conn.cursor()
    new_pass = "staff123"
    hashed_pass = generate_password_hash(new_pass)
    cur.execute("UPDATE users SET password = %s WHERE email = 'staff@sara.com'", (hashed_pass,))
    conn.commit()
    print(f"Updated staff@sara.com password to '{new_pass}' (hashed)")
    conn.close()
except Exception as e:
    print(f"Failed to update password: {e}")
