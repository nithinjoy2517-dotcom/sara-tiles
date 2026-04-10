import MySQLdb
import MySQLdb.cursors
from config import Config

conn = MySQLdb.connect(host=Config.MYSQL_HOST,
                       user=Config.MYSQL_USER,
                       passwd=Config.MYSQL_PASSWORD,
                       db=Config.MYSQL_DB,
                       cursorclass=MySQLdb.cursors.DictCursor)
cur = conn.cursor()
cur.execute("SELECT * FROM order_items WHERE order_id=103")
print(cur.fetchall())
cur.close()
conn.close()
z