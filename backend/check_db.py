import MySQLdb
import os

try:
    conn = MySQLdb.connect(
        host='127.0.0.1',
        user='root',
        passwd='root',
        db='sara_construction'
    )
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM users")
    users = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM products")
    products = cur.fetchone()[0]
    print(f"Database 'sara_construction' check: {users} users, {products} products.")
    conn.close()
except Exception as e:
    print(f"Database check failed: {e}")
