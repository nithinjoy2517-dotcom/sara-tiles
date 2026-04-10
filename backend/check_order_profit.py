import MySQLdb
import os
from config import Config

def check_order_profit():
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
        cur.execute("""
            SELECT 
                o.id as order_id, 
                oi.product_id, 
                p.name, 
                oi.quantity, 
                oi.unit_price as sold_at, 
                p.cost_price as current_cost,
                oi.total_price as total_revenue,
                (oi.quantity * p.cost_price) as total_cost,
                (oi.total_price - (oi.quantity * p.cost_price)) as profit
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN products p ON oi.product_id = p.id
            WHERE o.status != 'cancelled'
        """)
        items = cur.fetchall()
        
        print(f"{'OID':<5} | {'PID':<4} | {'Name':<25} | {'Qty':<4} | {'Sold@':<10} | {'Cost@':<10} | {'Profit':<10}")
        print("-" * 85)
        total_profit = 0
        for i in items:
            total_profit += float(i['profit'])
            print(f"{i['order_id']:<5} | {i['product_id']:<4} | {i['name']:<25} | {i['quantity']:<4} | {i['sold_at']:<10.2f} | {i['current_cost']:<10.2f} | {i['profit']:<10.2f}")
        
        print("-" * 85)
        print(f"Total Projected Profit: {total_profit:.2f}")
        
        db.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_order_profit()
