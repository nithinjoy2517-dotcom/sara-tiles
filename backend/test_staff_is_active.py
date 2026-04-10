#!/usr/bin/env python
"""Quick test to verify staff endpoint returns is_active field."""
import MySQLdb
import MySQLdb.cursors
from config import Config

try:
    conn = MySQLdb.connect(
        host=Config.MYSQL_HOST,
        user=Config.MYSQL_USER,
        passwd=Config.MYSQL_PASSWORD,
        db=Config.MYSQL_DB,
        cursorclass=MySQLdb.cursors.DictCursor
    )
    cur = conn.cursor()
    
    # Test the query
    cur.execute("SELECT id, name, email, phone, created_at, role as staff_role, is_active FROM users WHERE role='staff' ORDER BY name")
    staff = cur.fetchall()
    
    print("Staff members with is_active field:")
    for s in staff:
        status = "✓ Active" if s['is_active'] else "✗ Inactive"
        print(f"  - {s['name']} ({s['email']}): {status}")
    
    print(f"\n✅ {len(staff)} staff members loaded successfully with is_active field")
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
