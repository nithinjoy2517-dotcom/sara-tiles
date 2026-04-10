import MySQLdb
from config import Config

def list_tables():
    db = MySQLdb.connect(
        host=Config.MYSQL_HOST,
        user=Config.MYSQL_USER,
        passwd=Config.MYSQL_PASSWORD,
        db=Config.MYSQL_DB
    )
    cur = db.cursor()
    cur.execute("SHOW TABLES")
    tables = cur.fetchall()
    for table in tables:
        tname = table[0]
        print(f"--- TABLE: {tname} ---")
        cur.execute(f"DESCRIBE `{tname}`")
        cols = cur.fetchall()
        for col in cols:
            print(col)
        print("\n")

if __name__ == "__main__":
    list_tables()
