"""
Sara Construction V2 - Flask Backend
Theme: Kadal (Navy/Teal), White, Black, Orange
Features: Multi-role authentication & dynamic dashboards
"""

from flask import Flask, jsonify, request, send_from_directory, session, url_for, redirect
from flask_cors import CORS
from flask_mysqldb import MySQL
from config import Config
import os
from flask_mail import Mail, Message
from itsdangerous import URLSafeTimedSerializer, SignatureExpired
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
import razorpay
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch
import io
from datetime import datetime
import pandas as pd
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.legends import Legend

RAZORPAY_KEY_ID = "rzp_test_SMqZLUdF9R4kDW"
RAZORPAY_KEY_SECRET = "ZK88DcoYn9s0nI1v5gc1sx51"

razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

app = Flask(__name__, static_folder='../frontend/build', static_url_path='')
app.config.from_object(Config)
app.secret_key = 'kadal-sara-secret-2026' # Hardcoded for simplicity
CORS(app, supports_credentials=True)

mail = Mail(app)
serializer = URLSafeTimedSerializer(app.config['SECRET_KEY'])

mysql = MySQL(app)

import MySQLdb
from flask import g

def get_db():
    if 'db' not in g:
        try:
            g.db = MySQLdb.connect(
                host=app.config['MYSQL_HOST'],
                user=app.config['MYSQL_USER'],
                passwd=app.config['MYSQL_PASSWORD'],
                db=app.config['MYSQL_DB'],
                cursorclass=MySQLdb.cursors.DictCursor
            )
        except MySQLdb.Error as e:
            app.logger.error(f"Failed to connect to MySQL: {e}")
            raise Exception(f"Database connection error: {e}")
    return g.db.cursor()

@app.teardown_appcontext
def close_db(error):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def check_user_active():
    """Verify user is logged in and account is active. Returns user data or None."""
    if 'user_id' not in session:
        return None
    
    cur = get_db()
    cur.execute("SELECT * FROM users WHERE id = %s", (session['user_id'],))
    user = cur.fetchone()
    
    if not user or not user.get('is_active', 1):
        session.clear()
        return None
    
    # If courier, check partner status
    if user['role'] == 'courier':
        cur.execute("SELECT status FROM courier_partners WHERE LOWER(name) = LOWER(%s)", (user['name'],))
        cp = cur.fetchone()
        if cp and cp['status'] != 'active':
            session.clear()
            return None
    
    return user


# ===========================================================================
#  AUTH ROUTES
# ===========================================================================

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    cur = get_db()
    # Check if exists
    cur.execute("SELECT * FROM users WHERE email = %s", (data['email'],))
    if cur.fetchone():
        return jsonify({'error': 'Email already exists'}), 400
    
    cur.execute("""
        INSERT INTO users (name, email, password, role, is_verified, phone, address, pincode)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (data['name'], data['email'], generate_password_hash(data['password']), 'customer', 1, data.get('phone'), data.get('address'), data.get('pincode')))
    g.db.commit()

    # Send Welcome Email
    try:
        msg = Message("Welcome to Sara Construction!", 
                      recipients=[data['email']])
        msg.body = f"Welcome {data['name']}!\n\nThank you for choosing Sara Construction. We are thrilled to have you with us. Explore our premium paving, architectural landscaping services, and building materials to start your dream project today.\n\nBest regards,\nThe Sara Construction Team"
        msg.html = f"<h3>Welcome {data['name']}!</h3><p>Thank you for choosing Sara Construction. We are thrilled to have you with us.</p><p>Explore our premium paving, architectural landscaping services, and building materials to start your dream project today.</p><p>Best regards,<br/><b>The Sara Construction Team</b></p>"
        mail.send(msg)
    except Exception as e:
        app.logger.error(f"Failed to send email to {data['email']}: {str(e)}")

    return jsonify({'message': 'Registration successful! Welcome to Sara Construction.'}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    cur = get_db()
    cur.execute("SELECT * FROM users WHERE email = %s", (data['email'],))
    user = cur.fetchone()
    
    if user:
        # Check if user is active
        is_active = user.get('is_active', 1)
        if not is_active:
            return jsonify({'error': 'Your account has been deactivated. Please contact support.'}), 403
        
        # If courier, check partner status
        if user['role'] == 'courier':
            cur.execute("SELECT status FROM courier_partners WHERE LOWER(name) = LOWER(%s)", (user['name'],))
            cp = cur.fetchone()
            if cp and cp['status'] != 'active':
                return jsonify({'error': 'Your company account is currently inactive. Please contact the administrator.'}), 403

        is_plain = user['password'] == data['password']
        # Try hashing if it looks like a hash
        is_hashed = False
        if user['password'].startswith(('scrypt:', 'pbkdf2:', 'sha256:')):
             is_hashed = check_password_hash(user['password'], data['password'])
             
        if is_plain or is_hashed:
            # Login successful
            session['user_id'] = user['id']
            session['user_role'] = user['role']
            
            # In real apps, don't return password
            user_data = {
                'id': user['id'],
                'name': user['name'],
                'email': user['email'],
                'role': user['role'],
                'phone': user.get('phone'),
                'address': user.get('address'),
                'pincode': user.get('pincode')
            }
            return jsonify(user_data), 200
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out'})

# ===========================================================================
#  CATALOG & SERVICES
# ===========================================================================

@app.route('/api/categories', methods=['GET', 'POST'])
def handle_categories():
    cur = get_db()
    if request.method == 'POST':
        data = request.json
        cur.execute("INSERT INTO categories (name, slug, description) VALUES (%s, %s, %s)", 
                   (data.get('name'), data.get('slug'), data.get('description')))
        g.db.commit()
        return jsonify({'success': True, 'message': 'Category added'})
        
    cur.execute("SELECT * FROM categories")
    cats = cur.fetchall()
    return jsonify(cats)

@app.route('/api/subcategories', methods=['GET', 'POST'])
def handle_subcategories():
    cur = get_db()
    if request.method == 'POST':
        data = request.json
        try:
            cur.execute("INSERT INTO subcategories (category_id, name, slug) VALUES (%s, %s, %s)", 
                       (data.get('category_id'), data.get('name'), data.get('slug')))
            g.db.commit()
            return jsonify({'success': True, 'message': 'Subcategory added'})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 400
        
    cur.execute("SELECT s.*, c.name as category_name FROM subcategories s JOIN categories c ON s.category_id = c.id")
    return jsonify(cur.fetchall())

@app.route('/api/products', methods=['GET', 'POST'])
def handle_products():
    cur = get_db()
    if request.method == 'POST':
        data = request.form.to_dict() if request.form else request.json
        try:
            image_url = data.get('image_url') or 'https://placehold.co/400x300?text=Product+Image'
            if 'image_file' in request.files:
                file = request.files['image_file']
                if file.filename != '':
                    filename = secure_filename(file.filename)
                    filepath = os.path.join(app.static_folder, 'img', filename)
                    os.makedirs(os.path.dirname(filepath), exist_ok=True)
                    file.save(filepath)
                    image_url = 'img/' + filename

            def clean_int(val):
                if not val or val == 'null' or val == 'undefined': return None
                try: return int(val)
                except: return None

            def clean_float(val):
                if not val or val == 'null' or val == 'undefined': return 0.0
                try: return float(val)
                except: return 0.0

            # Check for duplicate
            product_name = data.get('name')
            product_slug = data.get('slug') or str(data.get('name', '')).strip().lower().replace(' ', '-')
            cur.execute("SELECT id FROM products WHERE name = %s OR slug = %s", (product_name, product_slug))
            if cur.fetchone():
                return jsonify({'success': False, 'message': 'Error: A product with this name already exists.'}), 400

            cur.execute("""
                INSERT INTO products (category_id, subcategory_id, name, slug, description, price, cost_price, unit, stock_quantity, image_url)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                  clean_int(data.get('category_id')) or 0, 
                  clean_int(data.get('subcategory_id')),
                  data.get('name'), 
                  data.get('slug') or str(data.get('name', '')).strip().lower().replace(' ', '-'),
                  data.get('description') or '', 
                  clean_float(data.get('price')), 
                  clean_float(data.get('cost_price')),
                  data.get('unit') or 'sqft', 
                  clean_int(data.get('stock_quantity')) or 0, 
                  image_url
            ))
            g.db.commit()
            return jsonify({'success': True, 'message': 'Product added'})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 400

    cat = request.args.get('category')
    featured = request.args.get('featured')
    query = "SELECT p.*, c.name as category_name, c.slug as category_slug, s.name as subcategory_name FROM products p JOIN categories c ON p.category_id = c.id LEFT JOIN subcategories s ON p.subcategory_id = s.id WHERE 1=1"
    params = []
    if cat:
        query += " AND c.slug = %s"
        params.append(cat)
    if featured:
        query += " AND p.is_featured = 1"
    cur.execute(query, params)
    return jsonify(cur.fetchall())

@app.route('/api/products/<int:id>', methods=['PUT', 'DELETE'])
def edit_product(id):
    cur = get_db()
    if request.method == 'PUT':
        data = request.form.to_dict() if request.form else request.json
        try:
            image_url = data.get('image_url') or 'https://placehold.co/400x300?text=Product+Image'
            if 'image_file' in request.files:
                file = request.files['image_file']
                if file.filename != '':
                    filename = secure_filename(file.filename)
                    filepath = os.path.join(app.static_folder, 'img', filename)
                    os.makedirs(os.path.dirname(filepath), exist_ok=True)
                    file.save(filepath)
                    image_url = 'img/' + filename

            def clean_int(val):
                if not val or val == 'null' or val == 'undefined': return None
                try: return int(val)
                except: return None

            def clean_float(val):
                if not val or val == 'null' or val == 'undefined': return 0.0
                try: return float(val)
                except: return 0.0

            # Check for duplicate
            product_name = data.get('name')
            product_slug = data.get('slug') or str(data.get('name', '')).strip().lower().replace(' ', '-')
            cur.execute("SELECT id FROM products WHERE (name = %s OR slug = %s) AND id != %s", (product_name, product_slug, id))
            if cur.fetchone():
                return jsonify({'success': False, 'message': 'Error: Another product with this name already exists.'}), 400

            cur.execute("""
                UPDATE products SET category_id=%s, subcategory_id=%s, name=%s, slug=%s, description=%s, price=%s, cost_price=%s, unit=%s, stock_quantity=%s, image_url=%s
                WHERE id=%s
            """, (
                  clean_int(data.get('category_id')) or 0, 
                  clean_int(data.get('subcategory_id')),
                  data.get('name'), 
                  data.get('slug'), 
                  data.get('description') or '', 
                  clean_float(data.get('price')), 
                  clean_float(data.get('cost_price')),
                  data.get('unit') or 'sqft', 
                  clean_int(data.get('stock_quantity')) or 0, 
                  image_url, 
                  id
            ))
            g.db.commit()
            return jsonify({'success': True, 'message': 'Product updated'})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 400

    if request.method == 'DELETE':
        cur.execute("DELETE FROM products WHERE id=%s", (id,))
        g.db.commit()
        return jsonify({'success': True, 'message': 'Product deleted'})
@app.route('/api/services', methods=['GET'])
def get_services():
    cur = get_db()
    cur.execute("SELECT * FROM services")
    return jsonify(cur.fetchall())

# ===========================================================================
#  ORDERS & DASHBOARDS
# ===========================================================================

@app.route('/api/orders/create', methods=['POST'])
def create_order():
    data = request.get_json()
    cur = get_db()
    try:
        cur.execute("""
            INSERT INTO orders (user_id, payment_id, total_amount, shipping_address, status)
            VALUES (%s, %s, %s, %s, %s)
        """, (data['user_id'], data.get('payment_id'), data['total'], data['address'], 'confirmed'))
        order_id = cur.lastrowid
        
        for item in data['items']:
            qty = int(item.get('quantity') or item.get('qty') or 1)
            price = item.get('price') or 0
            product_id = item['id']
            
            # 1. Verify Stock
            cur.execute("SELECT stock_quantity, name FROM products WHERE id = %s", (product_id,))
            p_data = cur.fetchone()
            if not p_data:
                g.db.rollback()
                return jsonify({'message': f"Product {product_id} not found", 'success': False}), 400
                
            current_stock = p_data['stock_quantity']
            p_name = p_data['name']
            if current_stock < qty:
                g.db.rollback()
                return jsonify({'message': f"Insufficient stock for {p_name}. Available: {current_stock}", 'success': False}), 400

            # 2. Add to Order Items
            cur.execute("""
                INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
                VALUES (%s, %s, %s, %s, %s)
            """, (order_id, product_id, qty, price, float(price) * qty))
            
            # 3. Reduce Stock
            cur.execute("UPDATE products SET stock_quantity = stock_quantity - %s WHERE id = %s", (qty, product_id))
        
        g.db.commit()
        return jsonify({'message': 'Order placed!', 'id': order_id, 'success': True}), 201
    except Exception as e:
        g.db.rollback()
        return jsonify({'message': str(e), 'success': False}), 500

@app.route('/api/payments/create_order', methods=['POST'])
def create_razorpay_order():
    data = request.get_json()
    amount_in_paise = int(float(data['amount']) * 100)
    
    order_params = {
        'amount': amount_in_paise,
        'currency': 'INR',
        'payment_capture': 1
    }
    
    try:
        razorpay_order = razorpay_client.order.create(data=order_params)
        return jsonify({
            'id': razorpay_order['id'],
            'amount': razorpay_order['amount'],
            'currency': razorpay_order['currency'],
            'key_id': RAZORPAY_KEY_ID
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# --- CUSTOMER DASH ---
@app.route('/api/customer/orders/<int:user_id>', methods=['GET'])
def get_customer_orders(user_id):
    cur = get_db()
    cur.execute("""
        SELECT o.*, 
        (SELECT GROUP_CONCAT(CONCAT(p.name, ' (x', oi.quantity, ')') SEPARATOR ', ')
         FROM order_items oi 
         JOIN products p ON oi.product_id = p.id 
         WHERE oi.order_id = o.id) as items_info
        FROM orders o 
        WHERE user_id = %s 
        ORDER BY created_at DESC
    """, (user_id,))
    return jsonify(cur.fetchall())

@app.route('/api/customer/inquiries', methods=['GET'])
def get_customer_inquiries():
    """Return the logged-in customer's previous contact inquiries by email."""
    user = check_user_active()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    cur = get_db()
    cur.execute("SELECT * FROM contacts WHERE email = %s ORDER BY created_at DESC", (user['email'],))
    return jsonify(cur.fetchall())

@app.route('/api/customer/order_items/<int:order_id>', methods=['GET'])
def get_order_items(order_id):
    cur = get_db()
    cur.execute("""
        SELECT oi.*, p.name, p.image_url, p.unit 
        FROM order_items oi 
        JOIN products p ON oi.product_id = p.id 
        WHERE oi.order_id = %s
    """, (order_id,))
    return jsonify(cur.fetchall())

@app.route('/api/customer/profile/update', methods=['PUT'])
def update_customer_profile():
    user = check_user_active()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    user_id = data.get('id')
    name = data.get('name')
    email = data.get('email')
    phone = data.get('phone')
    address = data.get('address')
    pincode = data.get('pincode')
    
    if int(session['user_id']) != int(user_id):
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        
    cur = get_db()
    try:
        if data.get('password'):
            cur.execute("""
                UPDATE users 
                SET name = %s, email = %s, phone = %s, address = %s, pincode = %s, password = %s
                WHERE id = %s
            """, (name, email, phone, address, pincode, generate_password_hash(data['password']), user_id))
        else:
            cur.execute("""
                UPDATE users 
                SET name = %s, email = %s, phone = %s, address = %s, pincode = %s 
                WHERE id = %s
            """, (name, email, phone, address, pincode, user_id))
            
        g.db.commit()
        
        cur.execute("SELECT id, name, email, role, phone, address, pincode FROM users WHERE id = %s", (user_id,))
        updated_user = cur.fetchone()
        return jsonify({'success': True, 'message': 'Profile updated successfully', 'user': updated_user})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

@app.route('/api/customer/update_address/<int:order_id>', methods=['POST'])
def update_order_address(order_id):
    data = request.get_json()
    address = data.get('address')
    
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        
    cur = get_db()
    # Verify order belongs to user and is still pending
    cur.execute("SELECT user_id, status FROM orders WHERE id = %s", (order_id,))
    order = cur.fetchone()
    
    if not order or int(order['user_id']) != int(session['user_id']):
        return jsonify({'success': False, 'message': 'Order not found or access denied'}), 404
        
    if order['status'] != 'pending':
        return jsonify({'success': False, 'message': 'Cannot update address for orders that are already processed'}), 400
    
    try:
        cur.execute("UPDATE orders SET shipping_address = %s WHERE id = %s", (address, order_id))
        g.db.commit()
        return jsonify({'success': True, 'message': 'Address updated successfully'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

# --- STAFF DASH ---
@app.route('/api/staff/inquiries', methods=['GET'])
def get_inquiries():
    cur = get_db()
    status_filter = request.args.get('status', '')
    priority_filter = request.args.get('priority', '')
    search_filter = request.args.get('search', '')
    
    query = "SELECT * FROM contacts WHERE 1=1"
    params = []
    if status_filter:
        query += " AND status = %s"
        params.append(status_filter)
    if priority_filter:
        query += " AND priority = %s"
        params.append(priority_filter)
    if search_filter:
        query += " AND (name LIKE %s OR email LIKE %s OR subject LIKE %s OR message LIKE %s)"
        like = f"%{search_filter}%"
        params.extend([like, like, like, like])
    query += " ORDER BY FIELD(priority,'high','normal','low'), created_at DESC"
    
    cur.execute(query, params)
    return jsonify(cur.fetchall())

@app.route('/api/staff/inquiries/stats', methods=['GET'])
def get_inquiry_stats():
    cur = get_db()
    cur.execute("""
        SELECT 
            COUNT(*) as total,
            SUM(status='new') as new_count,
            SUM(status='read') as read_count,
            SUM(status='in_progress') as in_progress,
            SUM(status='replied') as replied,
            SUM(status='cancelled') as cancelled,
            SUM(priority='high') as high_priority
        FROM contacts
    """)
    stats = cur.fetchone()
    return jsonify({k: int(v or 0) for k, v in stats.items()})

@app.route('/api/admin/inquiries/<int:id>/reply', methods=['PUT'])
def reply_to_inquiry(id):
    data = request.get_json()
    remarks = data.get('remarks', '')
    cur = get_db()
    cur.execute(
        "UPDATE contacts SET status='replied', remarks=%s WHERE id=%s",
        (remarks, id)
    )
    g.db.commit()
    return jsonify({'success': True, 'message': 'Reply recorded. Inquiry marked as replied.'})

@app.route('/api/admin/inquiries/<int:id>/status', methods=['PUT'])
def update_inquiry_status(id):
    data = request.get_json()
    new_status = data.get('status')
    new_priority = data.get('priority')
    new_remarks = data.get('remarks')
    
    cur = get_db()
    if new_status:
        cur.execute("UPDATE contacts SET status = %s WHERE id = %s", (new_status, id))
    if new_priority:
        cur.execute("UPDATE contacts SET priority = %s WHERE id = %s", (new_priority, id))
    if new_remarks is not None:
        cur.execute("UPDATE contacts SET remarks = %s WHERE id = %s", (new_remarks, id))
        
    g.db.commit()
    return jsonify({'success': True, 'message': 'Inquiry updated successfully'})

@app.route('/api/admin/inquiries/<int:id>', methods=['DELETE'])
def delete_inquiry(id):
    cur = get_db()
    cur.execute("DELETE FROM contacts WHERE id = %s", (id,))
    g.db.commit()
    return jsonify({'success': True, 'message': 'Inquiry deleted'})

# --- ADMIN DASH ---
@app.route('/api/admin/stats', methods=['GET'])
def get_admin_stats():
    cur = get_db()
    cur.execute("SELECT COUNT(*) as count FROM users WHERE role='customer'")
    customers = cur.fetchone()['count']
    cur.execute("SELECT COUNT(*) as count FROM orders")
    orders = cur.fetchone()['count']
    cur.execute("SELECT SUM(total_amount) as revenue FROM orders WHERE status != 'cancelled'")
    rev = cur.fetchone()['revenue'] or 0
    cur.execute("SELECT COUNT(*) as count FROM products")
    products = cur.fetchone()['count']
    cur.execute("SELECT COUNT(*) as count FROM orders WHERE status IN ('pending', 'confirmed') AND (courier_partner_id IS NULL OR courier_partner_id = 0)")
    pending = cur.fetchone()['count']
    # Mocking order growth
    return jsonify({'customers': customers, 'orders': orders, 'pending': pending, 'revenue': float(rev), 'products': products, 'total_orders': orders, 'order_growth': 12.5})

@app.route('/api/admin/users', methods=['GET'])
def get_all_users():
    cur = get_db()
    try:
        cur.execute("SELECT id, name, email, role, phone, address, is_active, created_at FROM users WHERE role='customer' ORDER BY name")
        users = cur.fetchall()
    except Exception:
        # If schema doesn't include is_active yet, fall back and assume active
        cur.execute("SELECT id, name, email, role, phone, address, created_at FROM users WHERE role='customer' ORDER BY name")
        users = cur.fetchall()
        for u in users:
            u['is_active'] = 1
    return jsonify(users)


@app.route('/api/admin/user/<int:id>/activate', methods=['PUT'])
def set_user_active(id):
    try:
        data = request.json or {}
        if 'active' not in data:
            return jsonify({'success': False, 'message': 'Missing active field'}), 400

        active = 1 if data.get('active') else 0
        cur = get_db()
        
        # Ensure column exists in case schema is older
        try:
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1")
            g.db.commit()
        except Exception as e:
            print(f"ALTER TABLE warning: {e}")
            pass

        # Update user status
        cur.execute("UPDATE users SET is_active = %s WHERE id = %s", (active, id))
        affected_rows = cur.rowcount
        g.db.commit()
        
        if affected_rows == 0:
            return jsonify({'success': False, 'message': 'User not found'}), 404
        
        return jsonify({'success': True, 'is_active': bool(active)})
    except Exception as e:
        print(f"Error in set_user_active: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ===========================================================================
#  NOTIFICATIONS API
# ===========================================================================
@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    cur = get_db()
    import datetime
    notifications = []

    # 1. New orders in last 24h
    cur.execute("""
        SELECT id, total_amount, status, created_at FROM orders
        WHERE created_at >= NOW() - INTERVAL 24 HOUR ORDER BY created_at DESC LIMIT 10
    """)
    for o in cur.fetchall():
        notifications.append({
            'id': f"order_{o['id']}", 'type': 'new_order',
            'icon': 'fa-shopping-cart', 'color': '#2563eb', 'bg': '#dbeafe',
            'title': 'New Order Received',
            'message': f"Order #ORD-{o['id']} \u2022 \u20b9{float(o['total_amount']):,.0f} \u2014 {o['status'].upper()}",
            'time': str(o['created_at']), 'priority': 1, 'action_tab': 'orders'
        })

    # 2. Low stock / out of stock
    cur.execute("SELECT id, name, stock_quantity FROM products WHERE stock_quantity <= 10 ORDER BY stock_quantity ASC")
    for p in cur.fetchall():
        out = p['stock_quantity'] == 0
        notifications.append({
            'id': f"stock_{p['id']}", 'type': 'low_stock',
            'icon': 'fa-exclamation-triangle',
            'color': '#dc2626' if out else '#d97706',
            'bg': '#fee2e2' if out else '#fef3c7',
            'title': 'Out of Stock' if out else 'Low Stock Alert',
            'message': f"{p['name']} \u2014 {p['stock_quantity']} units remaining",
            'time': None, 'priority': 0 if out else 2, 'action_tab': 'purchases'
        })

    # 3. Unread inquiries
    cur.execute("SELECT id, name, subject, created_at FROM contacts WHERE status='new' ORDER BY created_at DESC LIMIT 5")
    for inq in cur.fetchall():
        notifications.append({
            'id': f"inq_{inq['id']}", 'type': 'inquiry',
            'icon': 'fa-envelope', 'color': '#7c3aed', 'bg': '#ede9fe',
            'title': 'New Inquiry',
            'message': f"{inq['name']} \u2014 {inq['subject'] or 'General Inquiry'}",
            'time': str(inq['created_at']), 'priority': 1, 'action_tab': 'inquiries'
        })

    # 4. Orders awaiting courier assignment
    cur.execute("""
        SELECT COUNT(*) as cnt FROM orders
        WHERE status IN ('confirmed','processing') AND (courier_partner_id IS NULL OR courier_partner_id=0)
    """)
    unassigned = cur.fetchone()['cnt']
    if unassigned > 0:
        notifications.append({
            'id': 'dispatch_pending', 'type': 'dispatch',
            'icon': 'fa-truck', 'color': '#ea580c', 'bg': '#fff7ed',
            'title': 'Pending Dispatch',
            'message': f"{unassigned} order{'s' if unassigned > 1 else ''} confirmed but no courier assigned yet",
            'time': None, 'priority': 1, 'action_tab': 'delivery'
        })

    notifications.sort(key=lambda x: (x['priority'], x.get('time') or ''))
    return jsonify({'notifications': notifications, 'unread': len(notifications)})

# ===========================================================================
#  COURIER PARTNER DASHBOARD ROUTES
# ===========================================================================

@app.route('/api/courier/dashboard', methods=['GET'])
def courier_dashboard():
    u = check_user_active()
    if not u or u['role'] != 'courier':
        return jsonify({'error': 'Unauthorized'}), 401
    cur = get_db()
    cur.execute("SELECT id FROM courier_partners WHERE LOWER(name) = LOWER(%s) OR LOWER(contact_person) = LOWER(%s)", (u['name'], u['name']))
    cp = cur.fetchone()
    if not cp:
        return jsonify({'total': 0, 'pending': 0, 'shipped': 0, 'delivered': 0, 'revenue': 0, 'partner_id': None})
    pid = cp['id']
    cur.execute("SELECT COUNT(*) as total FROM orders WHERE courier_partner_id = %s AND status IN ('shipped','delivered')", (pid,))
    total = cur.fetchone()['total']
    cur.execute("SELECT COUNT(*) as cnt FROM orders WHERE courier_partner_id = %s AND status = 'shipped'", (pid,))
    shipped = cur.fetchone()['cnt']
    cur.execute("SELECT COUNT(*) as cnt FROM orders WHERE courier_partner_id = %s AND status = 'delivered'", (pid,))
    delivered = cur.fetchone()['cnt']
    cur.execute("SELECT COUNT(*) as cnt FROM orders WHERE courier_partner_id = %s AND status = 'confirmed'", (pid,))
    pending = cur.fetchone()['cnt']
    cur.execute("SELECT SUM(total_amount) as rev FROM orders WHERE courier_partner_id = %s AND status = 'delivered'", (pid,))
    revenue = float(cur.fetchone()['rev'] or 0)
    return jsonify({'total': total, 'shipped': shipped, 'delivered': delivered, 'pending': pending, 'revenue': revenue, 'partner_id': pid, 'partner_name': u['name']})

@app.route('/api/courier/shipments', methods=['GET'])
def courier_shipments():
    u = check_user_active()
    if not u or u['role'] != 'courier':
        return jsonify({'error': 'Unauthorized'}), 401
    
    cur = get_db()
    cur.execute("SELECT id FROM courier_partners WHERE LOWER(name) = LOWER(%s) OR LOWER(contact_person) = LOWER(%s)", (u['name'], u['name']))
    cp = cur.fetchone()
    if not cp:
        return jsonify([])
    pid = cp['id']
    cur.execute("""
        SELECT o.id, o.status, o.total_amount, o.shipping_address, o.tracking_id,
               o.estimated_delivery, o.dispatch_notes, o.created_at,
               u.name as customer_name, u.email as customer_email, u.phone as customer_phone
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.courier_partner_id = %s
        ORDER BY o.created_at DESC
    """, (pid,))
    return jsonify(cur.fetchall())

@app.route('/api/courier/shipment/<int:order_id>/status', methods=['PUT'])
def courier_update_shipment(order_id):
    u = check_user_active()
    if not u or u['role'] != 'courier':
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    new_status = data.get('status')
    tracking_id = data.get('tracking_id')
    cur = get_db()
    try:
        if tracking_id:
            cur.execute("UPDATE orders SET status = %s, tracking_id = %s WHERE id = %s", (new_status, tracking_id, order_id))
        else:
            cur.execute("UPDATE orders SET status = %s WHERE id = %s", (new_status, order_id))
        g.db.commit()
        return jsonify({'success': True, 'message': 'Shipment updated'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

@app.route('/api/courier/profile', methods=['GET'])
def courier_profile():
    u = check_user_active()
    if not u or u['role'] != 'courier':
        return jsonify({'error': 'Unauthorized'}), 401
    cur = get_db()
    cur.execute("SELECT * FROM courier_partners WHERE LOWER(name) = LOWER(%s) OR LOWER(contact_person) = LOWER(%s)", (u['name'], u['name']))
    cp = cur.fetchone()
    return jsonify({'user': u, 'company': cp})

@app.route('/api/admin/orders', methods=['GET'])
def get_all_orders():
    cur = get_db()
    cur.execute("""
        SELECT o.*, u.name as customer_name, u.email as customer_email, 
               cp.name as partner_name, cp.website as courier_website
        FROM orders o 
        JOIN users u ON o.user_id = u.id 
        LEFT JOIN courier_partners cp ON o.courier_partner_id = cp.id
        ORDER BY o.created_at DESC
    """)
    return jsonify(cur.fetchall())

@app.route('/api/admin/order/<int:order_id>/status', methods=['PUT'])
def update_order_status(order_id):
    status = request.json.get('status')
    cur = get_db()
    cur.execute("UPDATE orders SET status = %s WHERE id = %s", (status, order_id))
    g.db.commit()
    return jsonify({'success': True})

@app.route('/api/admin/order/<int:order_id>/courier', methods=['PUT'])
def update_order_courier(order_id):
    data = request.json
    partner_id = data.get('courier_partner_id')
    if not partner_id: partner_id = None
    
    tracking_id = data.get('tracking_id')
    # Auto-generate tracking ID if not provided
    if not tracking_id:
        import datetime
        now = datetime.datetime.now()
        tracking_id = f"SARA-{now.strftime('%y%m')}-{order_id:04d}"
        
    estimated_delivery = data.get('estimated_delivery')
    if not estimated_delivery: estimated_delivery = None
    
    dispatch_notes = data.get('dispatch_notes', '')
    
    cur = get_db()
    cur.execute("""
        UPDATE orders 
        SET courier_partner_id = %s, tracking_id = %s, estimated_delivery = %s, dispatch_notes = %s
        WHERE id = %s
    """, (partner_id, tracking_id, estimated_delivery, dispatch_notes, order_id))
    g.db.commit()
    return jsonify({'success': True, 'message': 'Logistics updated successfully', 'tracking_id': tracking_id})

# --- COURIER PARTNERS ---
@app.route('/api/admin/couriers', methods=['GET', 'POST'])
def handle_couriers():
    cur = get_db()
    if request.method == 'POST':
        data = request.json
        try:
            cur.execute("INSERT INTO courier_partners (name, contact_person, phone, website, status) VALUES (%s, %s, %s, %s, %s)",
                        (data.get('name'), data.get('contact_person'), data.get('phone'), data.get('website'), data.get('status', 'active')))
            g.db.commit()
            return jsonify({'success': True, 'message': 'Courier partner added'})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 400
        
    cur.execute("SELECT * FROM courier_partners ORDER BY name")
    return jsonify(cur.fetchall())

@app.route('/api/admin/couriers/<int:id>', methods=['PUT', 'DELETE'])
def edit_courier(id):
    cur = get_db()
    if request.method == 'PUT':
        data = request.json
        try:
            cur.execute("UPDATE courier_partners SET name=%s, contact_person=%s, phone=%s, website=%s, status=%s WHERE id=%s", 
                       (data.get('name'), data.get('contact_person'), data.get('phone'), data.get('website'), data.get('status'), id))
            g.db.commit()
            return jsonify({'success': True, 'message': 'Courier partner updated'})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 400
    if request.method == 'DELETE':
        cur.execute("DELETE FROM courier_partners WHERE id=%s", (id,))
        g.db.commit()
        return jsonify({'success': True, 'message': 'Courier partner deleted'})

@app.route('/api/admin/couriers/<int:id>/toggle_status', methods=['PUT'])
def toggle_courier_status(id):
    cur = get_db()
    try:
        cur.execute("UPDATE courier_partners SET status = CASE WHEN status = 'active' THEN 'inactive' ELSE 'active' END WHERE id = %s", (id,))
        g.db.commit()
        cur.execute("SELECT status FROM courier_partners WHERE id = %s", (id,))
        row = cur.fetchone()
        return jsonify({'success': True, 'new_status': row['status']})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

@app.route('/api/admin/couriers/<int:id>/create_account', methods=['POST'])
def courier_create_account(id):
    """Staff creates a login account for a courier partner."""
    data = request.json
    email = data.get('email')
    password = data.get('password')
    cur = get_db()
    # Get the courier partner name
    cur.execute("SELECT * FROM courier_partners WHERE id = %s", (id,))
    cp = cur.fetchone()
    if not cp:
        return jsonify({'success': False, 'message': 'Courier partner not found'}), 404
    # Check if account already exists
    cur.execute("SELECT id FROM users WHERE email = %s", (email,))
    if cur.fetchone():
        return jsonify({'success': False, 'message': 'An account with this email already exists'}), 400
    try:
        # Try to alter ENUM first (silently ignore if already done)
        try:
            cur.execute("ALTER TABLE users MODIFY role ENUM('admin','staff','customer','courier') DEFAULT 'customer'")
            g.db.commit()
        except Exception:
            pass
        cur.execute(
            "INSERT INTO users (name, email, password, role, phone) VALUES (%s, %s, %s, 'courier', %s)",
            (cp['name'], email, password, cp.get('phone', ''))
        )
        g.db.commit()
        return jsonify({'success': True, 'message': f"Login account created for {cp['name']}"})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

@app.route('/api/admin/couriers/<int:id>/account_status', methods=['GET'])
def courier_account_status(id):
    """Check if a courier partner already has a user account."""
    cur = get_db()
    cur.execute("SELECT * FROM courier_partners WHERE id = %s", (id,))
    cp = cur.fetchone()
    if not cp:
        return jsonify({'has_account': False})
    cur.execute("SELECT id, email, name FROM users WHERE role = 'courier' AND (name = %s OR email LIKE %s)", 
                (cp['name'], f"%{cp.get('contact_person','').split()[0].lower()}%"))
    user = cur.fetchone()
    return jsonify({'has_account': bool(user), 'user': user})


@app.route('/api/admin/staff', methods=['GET'])
def get_admin_staff():
    cur = get_db()
    # Only show users with role='staff' in the staff directory
    try:
        cur.execute("SELECT id, name, email, phone, created_at, role as staff_role, is_active FROM users WHERE role='staff' ORDER BY name")
    except:
        # Fallback for older schema without is_active
        cur.execute("SELECT id, name, email, phone, created_at, role as staff_role FROM users WHERE role='staff' ORDER BY name")
        users = cur.fetchall()
        for u in users:
            u['is_active'] = 1
        return jsonify(users)
    return jsonify(cur.fetchall())

@app.route('/api/admin/staff', methods=['POST'])
def add_admin_staff():
    data = request.json
    cur = get_db()
    try:
        email = data.get('staff_email') or data.get('email')
        # Check for duplicate email
        cur.execute("SELECT id FROM users WHERE email=%s", (email,))
        if cur.fetchone():
            return jsonify({'success': False, 'message': 'A member with this email already exists!'}), 400
            
        cur.execute("INSERT INTO users (name, email, password, role, phone) VALUES (%s, %s, %s, %s, %s)",
                    (f"{data.get('staff_fname', '')} {data.get('staff_lname', '')}".strip() or data.get('name'), 
                     email, data.get('password'), 'staff', data.get('staff_ph') or data.get('phone')))
        g.db.commit()
        return jsonify({'success': True, 'message': 'Staff added successfully!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

@app.route('/api/admin/staff/<int:id>', methods=['PUT', 'DELETE'])
def edit_admin_staff(id):
    cur = get_db()
    # Safety Check: Prevent modifying or deleting admins via this route
    cur.execute("SELECT role FROM users WHERE id=%s", (id,))
    user = cur.fetchone()
    if user and user['role'] == 'admin':
        return jsonify({'success': False, 'message': 'Administrative accounts cannot be modified here.'}), 403

    if request.method == 'PUT':
        data = request.json
        try:
            name = f"{data.get('staff_fname', '')} {data.get('staff_lname', '')}".strip() or data.get('name')
            email = data.get('staff_email') or data.get('email')
            phone = data.get('staff_ph') or data.get('phone')
            
            cur.execute("UPDATE users SET name=%s, email=%s, phone=%s WHERE id=%s", 
                       (name, email, phone, id))
            g.db.commit()
            return jsonify({'success': True, 'message': 'Staff updated'})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 400
    if request.method == 'DELETE':
        cur.execute("DELETE FROM users WHERE id=%s AND role='staff'", (id,))
        g.db.commit()
        return jsonify({'success': True, 'message': 'Staff member removed'})

@app.route('/api/admin/vendors', methods=['GET', 'POST'])
def handle_admin_vendors():
    cur = get_db()
    if request.method == 'POST':
        data = request.json
        try:
            email = data.get('email')
            # Check for duplicate vendor
            cur.execute("SELECT id FROM vendors WHERE email=%s OR name=%s", (email, data.get('name')))
            if cur.fetchone():
                return jsonify({'success': False, 'message': 'Vendor with this name or email already exists!'}), 400

            cur.execute("INSERT INTO vendors (name, email, phone, city, state) VALUES (%s, %s, %s, %s, %s)",
                        (data.get('name'), email, data.get('phone'), data.get('city'), data.get('state')))
            g.db.commit()
            return jsonify({'success': True, 'message': 'Vendor added'})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 400
        
    cur.execute("SELECT id, name, email, phone, city, state FROM vendors ORDER BY name")
    return jsonify(cur.fetchall())

@app.route('/api/admin/vendors/<int:id>', methods=['PUT', 'DELETE'])
def edit_vendor(id):
    cur = get_db()
    if request.method == 'PUT':
        data = request.json
        try:
            cur.execute("UPDATE vendors SET name=%s, email=%s, phone=%s, city=%s, state=%s WHERE id=%s", 
                       (data.get('name'), data.get('email'), data.get('phone'), data.get('city'), data.get('state'), id))
            g.db.commit()
            return jsonify({'success': True, 'message': 'Vendor updated'})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 400
    if request.method == 'DELETE':
        cur.execute("DELETE FROM vendors WHERE id=%s", (id,))
        g.db.commit()
        return jsonify({'success': True, 'message': 'Vendor deleted'})

# --- PURCHASE MANAGEMENT ---
@app.route('/api/staff/purchases', methods=['GET'])
def get_purchases():
    cur = get_db()
    cur.execute("""
        SELECT p.*, v.name as vendor_name,
        (SELECT GROUP_CONCAT(prod.name SEPARATOR ', ') FROM purchase_items pi JOIN products prod ON pi.product_id = prod.id WHERE pi.purchase_id = p.id) as items_info
        FROM purchases p 
        JOIN vendors v ON p.vendor_id = v.id 
        ORDER BY p.created_at DESC
    """)
    return jsonify(cur.fetchall())

@app.route('/api/staff/purchases', methods=['POST'])
def add_purchase():
    data = request.json
    vendor_id = data.get('vendor_id')
    items = data.get('items', [])
    total_amount = data.get('total_amount', 0)
    
    cur = get_db()
    try:
        cur.execute("INSERT INTO purchases (vendor_id, total_amount) VALUES (%s, %s)", 
                   (vendor_id, total_amount))
        purchase_id = cur.lastrowid
        
        for item in items:
            p_id = item.get('product_id')
            qty = int(item.get('quantity', 0))
            u_price = float(item.get('unit_price', 0))
            s_price = item.get('selling_price')
            t_price = qty * u_price
            
            cur.execute("""
                INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price, total_price)
                VALUES (%s, %s, %s, %s, %s)
            """, (purchase_id, p_id, qty, u_price, t_price))
            
            # Stock addition logic - Also update cost_price to the latest purchase rate
            if s_price is not None and s_price != '':
                cur.execute("UPDATE products SET stock_quantity = stock_quantity + %s, cost_price = %s, price = %s WHERE id = %s", (qty, u_price, float(s_price), p_id))
            else:
                cur.execute("UPDATE products SET stock_quantity = stock_quantity + %s, cost_price = %s WHERE id = %s", (qty, u_price, p_id))
            
        g.db.commit()
        return jsonify({'success': True, 'message': 'Inventory replenished successfully!'})
    except Exception as e:
        g.db.rollback()
        return jsonify({'success': False, 'message': str(e)}), 400

@app.route('/api/admin/staff/<int:id>', methods=['PUT', 'DELETE'])
def edit_staff(id):
    cur = get_db()
    if request.method == 'PUT':
        data = request.json
        try:
            cur.execute("UPDATE users SET name=%s, email=%s, phone=%s WHERE id=%s",
                        (f"{data.get('staff_fname', '')} {data.get('staff_lname', '')}".strip() or data.get('name', ''), data.get('staff_email', data.get('email', '')), data.get('staff_ph', data.get('phone', '')), id))
            g.db.commit()
            return jsonify({'success': True, 'message': 'Staff updated'})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 400
        return jsonify({'success': True, 'message': 'Staff updated'})
    if request.method == 'DELETE':
        cur.execute("DELETE FROM users WHERE id=%s AND role IN ('staff', 'admin')", (id,))
        g.db.commit()
        return jsonify({'success': True, 'message': 'Staff deleted'})

@app.route('/api/categories/<int:id>', methods=['PUT', 'DELETE'])
def edit_category(id):
    cur = get_db()
    if request.method == 'PUT':
        data = request.json
        try:
            cur.execute("UPDATE categories SET name=%s, slug=%s, description=%s WHERE id=%s",
                        (data.get('name'), data.get('slug'), data.get('description') or '', id))
            g.db.commit()
            return jsonify({'success': True, 'message': 'Category updated'})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 400
    if request.method == 'DELETE':
        cur.execute("DELETE FROM categories WHERE id=%s", (id,))
        g.db.commit()
        return jsonify({'success': True, 'message': 'Category deleted'})

@app.route('/api/subcategories/<int:id>', methods=['PUT', 'DELETE'])
def edit_subcategory(id):
    cur = get_db()
    if request.method == 'PUT':
        data = request.json
        try:
            cur.execute("UPDATE subcategories SET category_id=%s, name=%s, slug=%s WHERE id=%s",
                        (data.get('category_id'), data.get('name'), data.get('slug'), id))
            g.db.commit()
            return jsonify({'success': True, 'message': 'Subcategory updated'})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 400
    if request.method == 'DELETE':
        cur.execute("DELETE FROM subcategories WHERE id=%s", (id,))
        g.db.commit()
        return jsonify({'success': True, 'message': 'Subcategory deleted'})

@app.route('/api/admin/sales', methods=['GET'])
def get_sales_report():
    period = request.args.get('period', 'all')
    cur = get_db()
    
    # Date Filtering Logic
    date_filter = "1=1"
    today = datetime.now()
    if period == 'today':
        date_filter = f"DATE(o.created_at) = '{today.strftime('%Y-%m-%d')}'"
    elif period == 'month':
        date_filter = f"MONTH(o.created_at) = {today.month} AND YEAR(o.created_at) = {today.year}"
    elif period == 'year':
        date_filter = f"YEAR(o.created_at) = {today.year}"
    elif period == 'financial_year':
        start_year = today.year if today.month >= 4 else today.year - 1
        date_filter = f"o.created_at >= '{start_year}-04-01' AND o.created_at <= '{start_year+1}-03-31'"

    # Daily Sales with Profit
    cur.execute(f"""
        SELECT 
            DATE(o.created_at) as date, 
            COUNT(DISTINCT o.id) as orders, 
            SUM(COALESCE(oi.total_price, 0)) as revenue,
            SUM(COALESCE(oi.total_price, 0) - (oi.quantity * COALESCE(p.cost_price, 0))) as profit
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        JOIN products p ON oi.product_id = p.id
        WHERE o.status != 'cancelled' AND {date_filter}
        GROUP BY DATE(o.created_at) 
        ORDER BY date DESC 
        LIMIT 30
    """)
    daily = cur.fetchall()
    
    # Monthly Sales
    cur.execute("SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as orders, SUM(total_amount) as revenue FROM orders WHERE status != 'cancelled' GROUP BY month ORDER BY month DESC")
    monthly = cur.fetchall()
    
    # Top Customers
    cur.execute("""
        SELECT u.id, u.name, COUNT(o.id) as total_orders, SUM(COALESCE(o.total_amount, 0)) as total_spent 
        FROM users u 
        JOIN orders o ON u.id = o.user_id 
        WHERE o.status != 'cancelled' 
        GROUP BY u.id 
        ORDER BY total_spent DESC 
        LIMIT 5
    """)
    top_customers = cur.fetchall()
    
    # Product Performance with Profit
    cur.execute("""
        SELECT 
            p.id, 
            p.name, 
            SUM(COALESCE(oi.quantity, 0)) as units_sold, 
            SUM(COALESCE(oi.total_price, 0)) as total_revenue,
            SUM(COALESCE(oi.total_price, 0) - (COALESCE(oi.quantity, 0) * COALESCE(p.cost_price, 0))) as profit
        FROM products p
        JOIN order_items oi ON p.id = oi.product_id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status != 'cancelled'
        GROUP BY p.id
        ORDER BY units_sold DESC
        LIMIT 10
    """)
    product_performance = cur.fetchall()

    # Sales by Category
    cur.execute("""
        SELECT c.name as category, SUM(oi.total_price) as revenue
        FROM categories c
        JOIN products p ON c.id = p.category_id
        JOIN order_items oi ON p.id = oi.product_id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status != 'cancelled'
        GROUP BY c.id
        ORDER BY revenue DESC
    """)
    category_sales = cur.fetchall()

    # Low Stock Items
    cur.execute("SELECT id, name, stock_quantity FROM products WHERE stock_quantity < 10 ORDER BY stock_quantity ASC LIMIT 10")
    low_stock = cur.fetchall()

    return jsonify({
        'daily_sales': [{'date': str(d['date']), 'orders': d['orders'], 'revenue': float(d['revenue'] or 0), 'profit': float(d['profit'] or 0), 'avg_order_value': float(d['revenue'] or 0)/d['orders'] if d['orders'] > 0 else 0} for d in daily],
        'monthly_sales': [{'month': m['month'], 'orders': m['orders'], 'revenue': float(m['revenue'] or 0)} for m in monthly],
        'top_customers': [{'id': c['id'], 'name': c['name'], 'orders': c['total_orders'], 'spent': float(c['total_spent'] or 0)} for c in top_customers],
        'product_performance': [{'id': p['id'], 'name': p['name'], 'units': int(p['units_sold'] or 0), 'revenue': float(p['total_revenue'] or 0), 'profit': float(p['profit'] or 0)} for p in product_performance],
        'category_sales': [{'name': s['category'], 'revenue': float(s['revenue'] or 0)} for s in category_sales],
        'low_stock': [{'id': l['id'], 'name': l['name'], 'stock': l['stock_quantity']} for l in low_stock]
    })

def generate_pdf_chart(chart_type, data, labels, title="Report Chart"):
    """Helper to create ReportLab charts."""
    # Convert all data to floats to avoid Decimal errors with ReportLab
    try:
        clean_data = [float(v) for v in data]
    except (TypeError, ValueError):
        clean_data = data
        
    drawing = Drawing(400, 200)
    if chart_type == 'pie':
        pc = Pie()
        pc.x = 20
        pc.y = 10
        pc.width = 110
        pc.height = 110
        pc.data = clean_data
        pc.labels = None
        pc.slices.strokeWidth = 1
        pc.slices.strokeColor = colors.white # White borders between slices for premium look
        
        # Systematic color palette (Soft Pastels/Professional Blues)
        palette = [colors.HexColor("#3b82f6"), colors.HexColor("#60a5fa"), colors.HexColor("#93c5fd"), 
                   colors.HexColor("#bfdbfe"), colors.HexColor("#dbeafe")]
        for i in range(len(clean_data)):
            pc.slices[i].fillColor = palette[i % len(palette)]
            
        drawing.add(pc)
        
        legend = Legend()
        legend.x = 180 
        legend.y = 130
        legend.alignment = 'right'
        legend.fontSize = 8
        legend.fontName = 'Helvetica'
        legend.columnMaximum = 10
        legend.colorNamePairs = [(pc.slices[i].fillColor, labels[i][:40]) for i in range(len(labels))]
        drawing.add(legend)
    elif chart_type == 'bar':
        bc = VerticalBarChart()
        bc.x = 50
        bc.y = 30
        bc.height = 120
        bc.width = 320
        bc.data = [clean_data]
        bc.fillColor = colors.HexColor("#3b82f6") # Consistent blue
        bc.categoryAxis.categoryNames = labels
        bc.categoryAxis.labels.angle = 45
        bc.categoryAxis.labels.dx = 5
        bc.categoryAxis.labels.dy = -15
        bc.categoryAxis.labels.fontSize = 8
        bc.categoryAxis.labels.fontName = 'Helvetica'
        bc.valueAxis.valueMin = 0
        bc.valueAxis.labels.fontSize = 8
        drawing.add(bc)
    return drawing

@app.route('/api/admin/reports/download', methods=['GET'])
def download_report():
    period = request.args.get('period', 'all')
    report_type = request.args.get('type', 'overview')
    fmt = request.args.get('format', 'pdf').lower() # pdf, excel
    cur = get_db()
    
    # 1. Date Filtering Logic
    date_filter = "1=1"
    today = datetime.now()
    if period == 'today':
        date_filter = f"DATE(o.created_at) = '{today.strftime('%Y-%m-%d')}'"
    elif period == 'month':
        date_filter = f"MONTH(o.created_at) = {today.month} AND YEAR(o.created_at) = {today.year}"
    elif period == 'year':
        date_filter = f"YEAR(o.created_at) = {today.year}"
    elif period == 'financial_year':
        start_year = today.year if today.month >= 4 else today.year - 1
        date_filter = f"o.created_at >= '{start_year}-04-01' AND o.created_at <= '{start_year+1}-03-31'"
    elif period == 'custom':
        start_dt = request.args.get('start_date')
        end_dt = request.args.get('end_date')
        if start_dt and end_dt:
            date_filter = f"DATE(o.created_at) >= '{start_dt}' AND DATE(o.created_at) <= '{end_dt}'"

    # 2. Data Preparation
    data_frames = {}
    
    # Common stats for multiple reports
    cur.execute(f"SELECT COUNT(*) as count, SUM(total_amount) as revenue FROM orders o WHERE {date_filter} AND status != 'cancelled'")
    order_stats = cur.fetchone()
    total_revenue = float(order_stats['revenue'] or 0)
    total_orders = int(order_stats['count'] or 0)

    # Fetch data based on report type
    if report_type in ['overview', 'sales', 'intelligence']:
        cur.execute(f"""
            SELECT DATE(o.created_at) as date, COUNT(o.id) as orders, SUM(COALESCE(o.total_amount, 0)) as revenue
            FROM orders o WHERE {date_filter} AND status != 'cancelled'
            GROUP BY DATE(o.created_at) ORDER BY date ASC
        """)
        sales_data = cur.fetchall()
        data_frames['Revenue Analysis'] = pd.DataFrame(sales_data) if sales_data else pd.DataFrame(columns=['date', 'orders', 'revenue'])

        # Add Detailed Order List sorted by date
        cur.execute(f"""
            SELECT o.id as Order_ID, o.created_at as Date, u.name as Customer, 
                   o.total_amount as Amount, o.status as Status
            FROM orders o JOIN users u ON o.user_id = u.id 
            WHERE {date_filter} AND o.status != 'cancelled'
            ORDER BY o.created_at DESC
        """)
        detailed_data = cur.fetchall()
        data_frames['Detailed Order Log'] = pd.DataFrame(detailed_data) if detailed_data else pd.DataFrame(columns=['Order_ID', 'Date', 'Customer', 'Amount', 'Status'])

    if report_type in ['overview', 'inventory', 'warehouse']:
        cur.execute(f"""
            SELECT p.name, SUM(COALESCE(oi.quantity, 0)) as units_sold, SUM(COALESCE(oi.total_price, 0)) as gross_revenue, p.stock_quantity as current_stock
            FROM products p LEFT JOIN order_items oi ON p.id = oi.product_id
            LEFT JOIN orders o ON oi.order_id = o.id
            WHERE ({date_filter} OR o.id IS NULL) AND (o.status IS NULL OR o.status != 'cancelled')
            GROUP BY p.id ORDER BY units_sold DESC
        """)
        inv_data = cur.fetchall()
        data_frames['Product Performance & Stock'] = pd.DataFrame(inv_data) if inv_data else pd.DataFrame(columns=['name', 'units_sold', 'gross_revenue', 'current_stock'])

    if report_type in ['overview', 'customers', 'crm']:
        cur.execute(f"""
            SELECT u.name, u.email, u.phone, COUNT(o.id) as total_orders, SUM(COALESCE(o.total_amount, 0)) as total_spent
            FROM users u JOIN orders o ON u.id = o.user_id
            WHERE {date_filter} AND o.status != 'cancelled'
            GROUP BY u.id ORDER BY total_spent DESC LIMIT 25
        """)
        cus_data = cur.fetchall()
        data_frames['Top Client Intelligence'] = pd.DataFrame(cus_data) if cus_data else pd.DataFrame(columns=['name', 'email', 'phone', 'total_orders', 'total_spent'])

    if report_type in ['overview', 'logistics', 'supply_chain']:
        cur.execute(f"""
            SELECT COALESCE(cp.name, 'Direct Delivery') as courier, COUNT(o.id) as shipments, o.status as last_status
            FROM orders o LEFT JOIN courier_partners cp ON o.courier_partner_id = cp.id
            WHERE {date_filter} AND o.status IN ('shipped', 'delivered', 'processing')
            GROUP BY cp.id, o.status
        """)
        log_data = cur.fetchall()
        data_frames['Fulfillment & Logistics'] = pd.DataFrame(log_data) if log_data else pd.DataFrame(columns=['courier', 'shipments', 'last_status'])

    if report_type in ['vendors', 'procurement']:
        cur.execute("SELECT name, email, phone, city, state, created_at FROM vendors ORDER BY name")
        v_data = cur.fetchall()
        data_frames['Vendor Network Directory'] = pd.DataFrame(v_data) if v_data else pd.DataFrame(columns=['name', 'email', 'phone', 'city', 'state', 'created_at'])

    if report_type in ['staff', 'operations']:
        cur.execute("SELECT name, email, role, phone, created_at FROM users WHERE role IN ('staff', 'admin') ORDER BY role, name")
        s_data = cur.fetchall()
        data_frames['Staff & Access Audit'] = pd.DataFrame(s_data) if s_data else pd.DataFrame(columns=['name', 'email', 'role', 'phone', 'created_at'])

    # 3. EXCEL EXPORT LOGIC
    if fmt == 'excel':
        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            if not data_frames:
                pd.DataFrame({"Info": ["No data available for this selection"]}).to_excel(writer, index=False, sheet_name='Report')
            else:
                for sheet_name, df in data_frames.items():
                    df.to_excel(writer, index=False, sheet_name=sheet_name[:31]) # Excel sheet name limit 31 chars
        
        buffer.seek(0)
        filename = f"Sara_{report_type.title()}_Report_{period}_{today.strftime('%Y%m%d')}.xlsx"
        return (buffer.getvalue(), 200, {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control': 'no-cache',
            'Content-Disposition': f'attachment; filename={filename}'
        })

    # 4. PDF EXPORT LOGIC (Enhanced)
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=50, bottomMargin=50)
    elements = []
    styles = getSampleStyleSheet()
    
    # Systematic & Premium Branding Colors (Soft professional palette)
    PRIMARY = colors.HexColor("#1e293b") # Slate 800 - Deep, professional text
    ACCENT = colors.HexColor("#3b82f6")  # Blue 500 - Modern accent
    HEADER_BG = colors.HexColor("#f8fafc") # Slate 50 - Very light grey for header backgrounds
    BORDER_CLR = colors.HexColor("#e2e8f0") # Slate 200 - Soft borders
    
    # Custom Styles for Systematic Layout
    title_style = ParagraphStyle('TitleStyle', fontSize=22, textColor=PRIMARY, spaceAfter=2, fontName='Helvetica-Bold')
    subtitle_style = ParagraphStyle('SubtitleStyle', fontSize=10, textColor=colors.grey, spaceAfter=15, fontName='Helvetica')
    section_style = ParagraphStyle('SectionStyle', fontSize=14, textColor=ACCENT, spaceBefore=25, spaceAfter=12, fontName='Helvetica-Bold', leftIndent=0)
    summary_style = ParagraphStyle('SummaryStyle', fontSize=9, textColor=PRIMARY, leading=12)

    # 1. Header Section (Premium Minimalist)
    elements.append(Paragraph("SARA CONSTRUCTION ERP", title_style))
    elements.append(Spacer(1, 0.1*inch)) # Crucial gap
    elements.append(Paragraph(f"{report_type.upper()} ANALYSIS REPORT", ParagraphStyle('ReportType', fontSize=12, textColor=ACCENT, fontName='Helvetica-Bold')))
    elements.append(Spacer(1, 0.05*inch))
    elements.append(Paragraph(f"Period: {period.replace('_', ' ').title()} | Generation Date: {today.strftime('%d %B %Y')}", subtitle_style))
    elements.append(Spacer(1, 0.1*inch))
    
    # Summary Box (Systematic highlights)
    # Fixed widths to ensure NO text wraps or overlaps box boundaries
    box_width = 7.5 * inch
    summary_data = [
        [Paragraph(f"<b>TOTAL REVENUE</b><br/><font size=12>₹{total_revenue:,.2f}</font>", summary_style),
         Paragraph(f"<b>TOTAL ORDERS</b><br/><font size=12>{total_orders}</font>", summary_style),
         Paragraph(f"<b>AVG ORDER VALUE</b><br/><font size=12>₹{(total_revenue/total_orders if total_orders > 0 else 0):,.2f}</font>", summary_style)]
    ]
    summary_table = Table(summary_data, colWidths=[box_width/3.0]*3, rowHeights=[0.6*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), HEADER_BG),
        ('BOX', (0,0), (-1,-1), 1, BORDER_CLR),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 15),
        ('RIGHTPADDING', (0,0), (-1,-1), 15),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 0.4*inch))

    # Charts in PDF
    if report_type in ['overview', 'sales', 'intelligence'] and 'Revenue Analysis' in data_frames:
        df = data_frames['Revenue Analysis']
        if not df.empty:
            elements.append(Paragraph("Revenue Trendline Analysis", section_style))
            chart_df = df.tail(10)
            chart_vals = [float(v) for v in chart_df['revenue']]
            chart_labels = [str(d.strftime('%d %b') if hasattr(d, 'strftime') else d) for d in chart_df['date']]
            chart = generate_pdf_chart('bar', chart_vals, chart_labels, "Revenue Over Time")
            elements.append(chart)
            elements.append(Spacer(1, 0.2*inch))

    if report_type in ['overview', 'inventory', 'warehouse'] and 'Product Performance & Stock' in data_frames:
        df = data_frames['Product Performance & Stock']
        if not df.empty:
            elements.append(Paragraph("Asset Utilization Analysis", section_style))
            top_df = df.head(5)
            # Filter out zero-sale items for pie chart
            top_df = top_df[top_df['units_sold'] > 0]
            if not top_df.empty:
                chart = generate_pdf_chart('pie', list(top_df['units_sold']), list(top_df['name']), "Sales Distribution")
                elements.append(chart)
                elements.append(Spacer(1, 0.2*inch))

    # Tables in PDF
    for title, df in data_frames.items():
        if df.empty: continue
        elements.append(Paragraph(title, section_style))
        table_data = [df.columns.tolist()] + df.values.tolist()
        # Format currency/numbers for better look
        from decimal import Decimal
        for r in range(1, len(table_data)):
            for c in range(len(table_data[0])):
                val = table_data[r][c]
                if isinstance(val, (int, float, Decimal)):
                    if 'revenue' in table_data[0][c].lower() or 'spent' in table_data[0][c].lower():
                        table_data[r][c] = f"₹{float(val):,.2f}"
                    else:
                        table_data[r][c] = f"{int(val):,}" if isinstance(val, (int, Decimal)) and val == int(val) else f"{float(val):,}"
                elif isinstance(val, datetime):
                    table_data[r][c] = val.strftime('%d %b %y')
        
        # Calculate column widths to fit A4 page (total ~7.5 inches)
        col_count = len(df.columns)
        available_width = 7.5 * inch
        
        # Handle specifically identified wide tables
        if 'name' in df.columns:
            # Give name column more space
            widths = []
            for col in df.columns:
                if col.lower() == 'name': widths.append(2.5 * inch)
                elif col.lower() == 'email': widths.append(1.8 * inch)
                else: widths.append((available_width - 4.3*inch)/(col_count-2) if col_count > 2 else 0.5*inch)
            table = Table(table_data, colWidths=widths)
        else:
            table = Table(table_data, colWidths=[available_width/col_count]*col_count)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_BG),
            ('TEXTCOLOR', (0, 0), (-1, 0), PRIMARY),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_CLR),
            ('BOX', (0, 0), (-1, -1), 0.5, BORDER_CLR),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, HEADER_BG]), # Zebra striping
        ]))
        elements.append(table)
        elements.append(Spacer(1, 0.3*inch))

    # Footer
    def add_footer(canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica-Oblique', 8)
        canvas.drawString(40, 30, f"Sara Construction ERP - Private & Confidential - Page {doc.page}")
        canvas.restoreState()

    doc.build(elements, onFirstPage=add_footer, onLaterPages=add_footer)
    buffer.seek(0)
    
    filename = f"Sara_{report_type.title()}_Report_{period}_{today.strftime('%Y%m%d')}.pdf"
    return (buffer.getvalue(), 200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': f'attachment; filename={filename}'
    })

@app.route('/api/user/update-profile', methods=['PUT'])
def update_profile():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401
    
    data = request.json
    cur = get_db()
    
    updates = []
    params = []
    
    if 'name' in data:
        updates.append("name = %s")
        params.append(data['name'])
    if 'email' in data:
        updates.append("email = %s")
        params.append(data['email'])
    if 'phone' in data:
        updates.append("phone = %s")
        params.append(data['phone'])
    if 'password' in data and data['password']:
        updates.append("password = %s")
        params.append(generate_password_hash(data['password']))
        
    if not updates:
        return jsonify({'success': True, 'message': 'No changes provided'})
        
    params.append(session['user_id'])
    query = f"UPDATE users SET {', '.join(updates)} WHERE id = %s"
    
    try:
        cur.execute(query, tuple(params))
        g.db.commit()
        # Update session data if needed
        if 'name' in data: session['user_name'] = data['name']
        
        cur.execute("SELECT id, name, email, role, phone FROM users WHERE id = %s", (session['user_id'],))
        updated_user = cur.fetchone()
        return jsonify({'success': True, 'message': 'Profile updated successfully', 'user': updated_user})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
def search_admin():
    q = f"%{request.args.get('query', '')}%"
    cur = get_db()
    cur.execute("SELECT 'Order' as type, id, CAST(id as CHAR) as name, total_amount as value FROM orders WHERE CAST(id as CHAR) LIKE %s LIMIT 5", (q,))
    orders = cur.fetchall()
    cur.execute("SELECT 'Product' as type, id, name, price as value FROM products WHERE name LIKE %s LIMIT 5", (q,))
    products = cur.fetchall()
    cur.execute("SELECT 'Customer' as type, id, name, CAST(id as CHAR) as value FROM users WHERE name LIKE %s LIMIT 5", (q,))
    customers = cur.fetchall()
    return jsonify({'orders': orders, 'products': products, 'customers': customers})

# ===========================================================================
#  CONTACT
# ===========================================================================
# ===========================================================================
#  CUSTOMER INVOICE & STATEMENT (PDF)
# ===========================================================================

@app.route('/api/customer/invoice/<int:order_id>')
def download_invoice(order_id):
    cur = get_db()
    # Fetch Order with customer info
    cur.execute("SELECT o.*, u.name, u.email, u.phone, u.address FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = %s", (order_id,))
    order = cur.fetchone()
    if not order: return jsonify({'error': 'Order not found'}), 404
    
    # Fetch Items with product images
    cur.execute("SELECT oi.*, p.name, p.image_url FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = %s", (order_id,))
    items = cur.fetchall()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
    elements = []
    styles = getSampleStyleSheet()
    
    # Custom Brand Colors
    BRAND_KADAL = colors.HexColor("#083344")
    BRAND_ORANGE = colors.HexColor("#f97316")
    LIGHT_BG = colors.HexColor("#f8fafc")
    BORDER_COLOR = colors.HexColor("#e2e8f0")
    
    # Custom Styles
    brand_title = ParagraphStyle('BrandTitle', parent=styles['Heading1'], fontSize=20, textColor=BRAND_KADAL, fontName='Helvetica-Bold')
    sub_title = ParagraphStyle('SubTitle', parent=styles['Normal'], fontSize=8, textColor=colors.grey, letterSpacing=1)
    label_style = ParagraphStyle('LabelStyle', parent=styles['Normal'], fontSize=9, textColor=BRAND_ORANGE, fontName='Helvetica-Bold', spaceAfter=2)
    val_style = ParagraphStyle('ValueStyle', parent=styles['Normal'], fontSize=10, textColor=BRAND_KADAL, leading=14)
    table_header = ParagraphStyle('TableHeader', parent=styles['Normal'], fontSize=9, textColor=colors.white, fontName='Helvetica-Bold', alignment=1)
    item_name_style = ParagraphStyle('ItemName', parent=styles['Normal'], fontSize=10, textColor=BRAND_KADAL, fontName='Helvetica-Bold')

    # 1. TOP HEADER LOGO & CO. INFO
    logo_path = os.path.join(app.static_folder, 'img/logo_premium.png')
    co_info_rows = []
    
    # Logo and Company Details Table
    co_details = [
        [
            Image(logo_path, width=1.2*inch, height=0.6*inch) if os.path.exists(logo_path) else Paragraph("SARA.", brand_title),
            [
                Paragraph("<b>SARA CONSTRUCTION PVT LTD</b>", brand_title),
                Paragraph("Architectural Paving & Construction Solutions", sub_title),
                Paragraph("123 Industrial Parkway, Ernakulam, Kerala 682039", styles['Normal']),
                Paragraph("Phone: +91 800-SARA-APP | support@saraconstruction.com", styles['Normal'])
            ]
        ]
    ]
    t_header = Table(co_details, colWidths=[2*inch, 4.5*inch])
    t_header.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 20),
    ]))
    elements.append(t_header)
    elements.append(Spacer(1, 0.1*inch))
    
    # 2. INVOICE META BAR
    meta_bg = Table([
        [
            Paragraph("<b>TAX INVOICE</b>", ParagraphStyle('TaxInv', fontSize=18, textColor=BRAND_KADAL)),
            Paragraph(f"<b>#INV-{1000+order['id']}</b>", ParagraphStyle('InvNum', fontSize=14, textColor=BRAND_ORANGE, alignment=2))
        ]
    ], colWidths=[3.25*inch, 3.25*inch])
    meta_bg.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), LIGHT_BG),
        ('BOTTOMPADDING', (0,0), (-1,-1), 15),
        ('TOPPADDING', (0,0), (-1,-1), 15),
        ('LINEBELOW', (0,0), (-1,-1), 2, BRAND_KADAL)
    ]))
    elements.append(meta_bg)
    elements.append(Spacer(1, 0.3*inch))
    
    # 3. BILLING & SHIPPING INFO
    info_data = [
        [
            [Paragraph("BILL TO", label_style), Paragraph(order['name'], val_style), Paragraph(order['email'], styles['Normal']), Paragraph(order['phone'], styles['Normal'])],
            [Paragraph("SHIP TO", label_style), Paragraph(order['shipping_address'] or "Registered Address", val_style)],
            [Paragraph("PAYMENT STATUS", label_style), 
             Paragraph(f"<b>{order['status'].upper()}</b>", ParagraphStyle('Stat', fontSize=10, textColor=BRAND_ORANGE if order['status'] != 'delivered' else colors.green))]
        ]
    ]
    t_info = Table(info_data, colWidths=[2.3*inch, 2.3*inch, 1.9*inch])
    t_info.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP')]))
    elements.append(t_info)
    elements.append(Spacer(1, 0.4*inch))
    
    # 4. LINE ITEMS WITH PRODUCT IMAGES
    # Header
    data = [[Paragraph("Product", table_header), Paragraph("Description", table_header), Paragraph("Qty", table_header), Paragraph("Rate", table_header), Paragraph("Subtotal", table_header)]]
    
    for i in items:
        # Resolve product image
        img_url = i['image_url']
        if img_url:
            # Clean path from frontend notation
            if img_url.startswith('/'): img_url = img_url[1:]
            full_img_path = os.path.join(app.static_folder, img_url)
        else:
            full_img_path = None
            
        p_img = Image(full_img_path, width=0.6*inch, height=0.6*inch) if full_img_path and os.path.exists(full_img_path) else Paragraph("N/A", styles['Normal'])
        
        data.append([
            p_img,
            Paragraph(f"<b>{i['name']}</b>", item_name_style),
            Paragraph(str(i['quantity']), styles['Normal']),
            Paragraph(f"₹{i['unit_price']:,.2f}", styles['Normal']),
            Paragraph(f"<b>₹{i['total_price']:,.2f}</b>", styles['Normal']),
        ])
    
    t_items = Table(data, colWidths=[0.8*inch, 2.6*inch, 0.6*inch, 1.25*inch, 1.25*inch], repeatRows=1)
    t_items.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_KADAL),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_BG])
    ]))
    elements.append(t_items)
    
    # 5. FINANCIAL SUMMARY
    summary_data = [
        ["", "", "Order Subtotal:", f"INR {order['total_amount']:,.2f}"],
        ["", "", "GST (SGST + CGST):", "Included"],
        ["", "", "Grand Total:", f"INR {order['total_amount']:,.2f}"]
    ]
    t_sum = Table(summary_data, colWidths=[2.5*inch, 0.9*inch, 1.6*inch, 1.5*inch])
    t_sum.setStyle(TableStyle([
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
        ('FONTNAME', (2, 2), (3, 2), 'Helvetica-Bold'),
        ('FONTSIZE', (2, 2), (3, 2), 12),
        ('LINEABOVE', (2, 2), (3, 2), 2, BRAND_KADAL),
        ('TOPPADDING', (2, 2), (3, 2), 10),
        ('TEXTCOLOR', (2, 2), (3, 2), BRAND_KADAL)
    ]))
    elements.append(Spacer(1, 0.4*inch))
    elements.append(t_sum)
    
    # 6. FOOTER POLICY & THANKS
    elements.append(Spacer(1, 1*inch))
    elements.append(Paragraph("TERMS & CONDITIONS", label_style))
    elements.append(Paragraph("1. Goods once sold are not returnable without quality verification.", styles['Normal']))
    elements.append(Paragraph("2. This is a computer-generated invoice and requires no physical signature.", styles['Normal']))
    elements.append(Spacer(1, 0.4*inch))
    elements.append(Paragraph("<b>THANK YOU FOR BUILDING WITH SARA CONSTRUCTION</b>", ParagraphStyle('Foot', fontSize=12, alignment=1, textColor=BRAND_KADAL)))

    doc.build(elements)
    buffer.seek(0)
    return (buffer.getvalue(), 200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': f'attachment; filename=Invoice_{1000+order_id}.pdf'
    })

@app.route('/api/customer/statement/<int:user_id>')
def download_statement(user_id):
    cur = get_db()
    # Fetch User
    cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    user = cur.fetchone()
    # Fetch all orders
    cur.execute("SELECT * FROM orders WHERE user_id = %s ORDER BY created_at DESC", (user_id,))
    orders = cur.fetchall()
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    elements = []
    styles = getSampleStyleSheet()
    
    header_style = ParagraphStyle('HeaderStyle', parent=styles['Heading1'], fontSize=22, textColor=colors.HexColor("#083344"))
    
    elements.append(Paragraph("ACCOUNT STATEMENT", header_style))
    elements.append(Paragraph(f"Customer: {user['name']}", styles['Normal']))
    elements.append(Paragraph(f"Period: All Time (Generated {datetime.now().strftime('%d %b %Y')})", styles['Normal']))
    elements.append(Spacer(1, 0.3*inch))
    
    data = [["Date", "Order Ref", "Items", "Status", "Amount"]]
    total_spent = 0
    for o in orders:
        # Mini fetch for item count
        cur.execute("SELECT COUNT(*) as count FROM order_items WHERE order_id = %s", (o['id'],))
        icount = cur.fetchone()['count']
        data.append([
            o['created_at'].strftime('%d %b %Y'),
            f"ORD-{1000+o['id']}",
            f"{icount} Items",
            o['status'].upper(),
            f"INR {o['total_amount']:,.2f}"
        ])
        if o['status'] != 'cancelled':
            total_spent += float(o['total_amount'])
            
    t = Table(data, colWidths=[1.2*inch, 1.2*inch, 1.5*inch, 1*inch, 1.4*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f97316")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
    ]))
    elements.append(t)
    
    elements.append(Spacer(1, 0.2*inch))
    elements.append(Paragraph(f"<b>Total Order Value across account: INR {total_spent:,.2f}</b>", styles['Normal']))
    
    doc.build(elements)
    buffer.seek(0)
    return (buffer.getvalue(), 200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': f'attachment; filename=Statement_{user_id}.pdf'
    })

@app.route('/api/contact', methods=['POST'])
def contact():
    data = request.get_json()
    cur = get_db()
    cur.execute("""
        INSERT INTO contacts (name, email, phone, subject, message)
        VALUES (%s, %s, %s, %s, %s)
    """, (data['name'], data['email'], data.get('phone'), data['subject'], data['message']))
    g.db.commit()
    return jsonify({'message': 'Enquiry sent!'}), 201

# --- Static ---
@app.route('/')
def home():
    return send_from_directory(app.static_folder, 'index.html')

@app.errorhandler(404)
def not_found(e):
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    app.run(debug=True, port=5000)
