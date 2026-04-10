from app import app, mysql
import sys

def check_db():
    try:
        with app.app_context():
            conn = mysql.connection
            if conn is None:
                print("Connection is None")
                return
            cur = conn.cursor()
            cur.execute("SELECT DATABASE()")
            db_name = cur.fetchone()
            print(f"Connected to database: {db_name}")
            cur.execute("SELECT name FROM users LIMIT 1")
            user = cur.fetchone()
            print(f"Sample user: {user}")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_db()
