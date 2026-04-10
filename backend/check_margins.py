import MySQLdb
import os
from config import Config

def check_prices():
    try:
        from MySQLdb import cursors
        db = MySQLdb.connect(
            host=Config.MYSQL_HOST,
            user=Config.MYSQL_USER,
            passwd=Config.MYSQL_PASSWORD,
            db=Config.MYSQL_DB,
            cursorclass=cursors.DictCursor
        )
        cur = db.cursor()
        cur.execute("SELECT id, name, price, cost_price FROM products")
        products = cur.fetchall()
        
        print(f"{'ID':<5} | {'Name':<25} | {'Price':<10} | {'Cost':<10} | {'Margin':<10}")
        print("-" * 70)
        for p in products:
            margin = p['price'] - p['cost_price']
            print(f"{p['id']:<5} | {p['name']:<25} | {p['price']:<10.2f} | {p['cost_price']:<10.2f} | {margin:<10.2f}")
        
        db.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_prices()
