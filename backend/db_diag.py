import MySQLdb
import MySQLdb.cursors

def check():
    try:
        db = MySQLdb.connect(host='127.0.0.1', user='root', passwd='root', db='sara_construction', cursorclass=MySQLdb.cursors.DictCursor)
        cur = db.cursor()
        cur.execute("SELECT id, name FROM users WHERE role='customer'")
        users = cur.fetchall()
        print(f"TOTAL_CUSTOMERS: {len(users)}")
        for u in users:
            cur.execute("SELECT id, total_amount, status FROM orders WHERE user_id=%s", (u['id'],))
            orders = cur.fetchall()
            print(f"CUSTOMER: {u['name']} (ID:{u['id']}) ORDERS: {len(orders)}")
            for o in orders:
                print(f"  - Order #{o['id']} Amount: {o['total_amount']}")
        db.close()
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == '__main__':
    check()
