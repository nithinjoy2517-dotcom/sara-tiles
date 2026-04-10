import MySQLdb
from config import Config

def seed_db():
    try:
        db = MySQLdb.connect(
            host=Config.MYSQL_HOST,
            user=Config.MYSQL_USER,
            passwd=Config.MYSQL_PASSWORD,
            db=Config.MYSQL_DB
        )
        cur = db.cursor()
        
        # Insert or ignore categories
        categories = [
            ('Cement', 'cement', 'High-quality portland and blended cements.'),
            ('TMT Steel Bars', 'tmt', 'Thermo Mechanically Treated steel bars for maximum strength.'),
            ('Construction Bricks', 'bricks', 'Solid red clay and concrete bricks for construction.'),
            ('External Tiles', 'external-tiles', 'Premium weather-proof exterior tiles.')
        ]

        # Ignore if exists by doing a simple check
        for name, slug, desc in categories:
            cur.execute("SELECT id FROM categories WHERE slug = %s", (slug,))
            if not cur.fetchone():
                cur.execute("INSERT INTO categories (name, slug, description) VALUES (%s, %s, %s)", (name, slug, desc))
                print(f"Inserted Category: {name}")

        db.commit()

        # Let's add some products for these new categories
        # Getting the mapped IDs
        cur.execute("SELECT id, slug FROM categories")
        cat_map = {row[1]: row[0] for row in cur.fetchall()}

        products = [
            (cat_map.get('cement'), 'UltraTech Cement 50kg', 'ultratech-50', 'Portland pozzolana cement', 400.00, 'bag', 1),
            (cat_map.get('cement'), 'Ramco Super Grade', 'ramco-50', 'High strength blended cement', 380.00, 'bag', 0),
            (cat_map.get('tmt'), 'Tata Tiscon 550SD - 12mm', 'tiscon-12', '12mm TMT rebar for columns', 88.00, 'kg', 1),
            (cat_map.get('tmt'), 'JSW Neosteel - 8mm', 'jsw-8', '8mm TMT for structural core', 82.00, 'kg', 0),
            (cat_map.get('bricks'), 'Premium Red Clay Brick', 'red-brick', 'Standard 9x4x3 inch clay brick', 8.50, 'piece', 1),
            (cat_map.get('bricks'), 'Fly Ash Brick', 'flyash-brick', 'Eco-friendly solid block', 6.00, 'piece', 0),
        ]

        for p in products:
            if p[0]: # If category id was found
                cur.execute("SELECT id FROM products WHERE slug = %s", (p[2],))
                if not cur.fetchone():
                    cur.execute("""
                        INSERT INTO products (category_id, name, slug, description, price, unit, is_featured) 
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """, p)
                    print(f"Inserted Product: {p[1]}")

        db.commit()
        db.close()
        print("Database seeding completed.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    seed_db()
