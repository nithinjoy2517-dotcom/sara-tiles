-- ============================================================
-- Sara Construction (V2) - Database Setup Script
-- Theme: Kadal (Ocean) with White, Black, Orange
-- ============================================================

CREATE DATABASE IF NOT EXISTS sara_construction;
USE sara_construction;

-- -----------------------------------------------------------
-- Drop existing tables in correct order
-- -----------------------------------------------------------
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS contacts;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------
-- Users Table (Admin, Staff, Customer)
-- -----------------------------------------------------------
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(200) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- In production, use hashed passwords
    role ENUM('admin', 'staff', 'customer', 'courier') DEFAULT 'customer',
    phone VARCHAR(20),
    address TEXT,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------
-- Categories Table
-- -----------------------------------------------------------
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------
-- Products Table
-- -----------------------------------------------------------
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL UNIQUE,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    unit VARCHAR(50) NOT NULL DEFAULT 'sqft',
    stock_quantity INT DEFAULT 0,
    image_url VARCHAR(500),
    is_featured TINYINT(1) DEFAULT 0,
    rating DECIMAL(2,1) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------
-- Services Table
-- -----------------------------------------------------------
CREATE TABLE services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL UNIQUE,
    description TEXT,
    price_range VARCHAR(100),
    image_url VARCHAR(500),
    is_featured TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------
-- Contacts / Enquiry Table
-- -----------------------------------------------------------
CREATE TABLE contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(200) NOT NULL,
    phone VARCHAR(20),
    subject VARCHAR(300),
    message TEXT NOT NULL,
    status ENUM('new','read','replied') DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------
-- Orders Table
-- -----------------------------------------------------------
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    status ENUM('pending','confirmed','processing','shipped','delivered','cancelled') DEFAULT 'pending',
    shipping_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- -----------------------------------------------------------
-- Order Items Table
-- -----------------------------------------------------------
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Users
INSERT INTO users (name, email, password, role) VALUES
('Admin User', 'admin@sara.com', 'admin123', 'admin'),
('Staff Member', 'staff@sara.com', 'staff123', 'staff'),
('Test Customer', 'customer@sara.com', 'customer123', 'customer');

-- Categories (Paving, Exterior Tiles, Landscaping)
INSERT INTO categories (name, slug, description) VALUES
('Paving Stones', 'paving', 'Durable and interlocking paving stones for driveways and walkways.'),
('External Wall Tiles', 'wall-tiles', 'Weather-resistant external tiles for building elevations.'),
('Landscaping Materials', 'landscaping', 'Soil, gravel, and decorative stones for customized landscaping.');

-- Products
INSERT INTO products (category_id, name, slug, description, price, unit, stock_quantity, is_featured, rating, image_url) VALUES
(1, 'Interlocking Block Paving', 'interlock-paving', 'Highly durable 80mm paving blocks for heavy traffic.', 45.00, 'sqft', 5000, 1, 4.8, 'img/travertine.png'),
(1, 'Natural Stone Pavers', 'stone-pavers', 'Elegant natural stone finish for garden paths.', 85.00, 'sqft', 2000, 1, 4.9, 'img/travertine.png'),
(2, 'Travertine Exterior Tile', 'travertine-tile', 'Classic travertine finish for high-end elevations.', 120.00, 'sqft', 3000, 1, 4.7, 'img/travertine.png'),
(2, 'Slate Wall Cladding', 'slate-cladding', 'Rusted slate texture for a modern rustic look.', 95.00, 'sqft', 1500, 0, 4.5, 'img/travertine.png'),
(3, 'Decorative White Pebbles', 'white-pebbles', 'Polished white stones for garden decoration.', 25.00, 'kg', 1000, 1, 4.6, 'img/cement.png'),
(3, 'Quality Red Garden Soil', 'garden-soil', 'Nutrient-rich soil for optimal plant growth.', 450.00, 'bag', 500, 0, 4.4, 'img/cement.png'),
(1, 'Premium Red Bricks', 'red-bricks', 'High-strength burnt clay bricks for robust construction.', 8.50, 'piece', 10000, 1, 4.7, 'img/bricks.png'),
(3, 'Grade 53 OPC Cement', 'opc-cement', 'High-grade cement for structural concrete and heavy-duty work.', 420.00, 'bag', 1000, 1, 4.9, 'img/cement.png'),
(3, 'FE 550 TMT Steel Bars', 'tmt-steel', 'Corrosion-resistant TMT bars with superior bonding strength.', 65.00, 'kg', 5000, 1, 4.8, 'img/tmt.png');



-- Services (Paving, Landscaping)
INSERT INTO services (name, slug, description, price_range, is_featured) VALUES
('Professional Paving', 'paving-service', 'Expert installation of driveways and walkways with precision drainage.', '₹60 - ₹120 per sqft', 1),
('Complete Landscaping', 'landscaping-service', 'End-to-end landscape design including planning, leveling, and planting.', 'Starts from ₹25,000', 1),
('Exterior Tile Installation', 'tile-service', 'Vertical cladding and external flooring services for residential blocks.', '₹45 - ₹90 per sqft', 1);

SELECT 'Database V2 setup complete!' AS status;
