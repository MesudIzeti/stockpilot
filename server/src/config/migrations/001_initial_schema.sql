-- StockPilot Database Schema
-- Run: psql -U mesudcati -d stockpilot -f 001_initial_schema.sql

-- ============================================
-- TABLE 1: users
-- WHO uses the system
-- ============================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLE 2: categories
-- HOW products are organized
-- ============================================
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLE 3: suppliers
-- WHERE products come from
-- ============================================
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLE 4: products
-- WHAT the business sells (heart of the system)
-- ============================================
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    sku VARCHAR(100),
    barcode VARCHAR(100),
    price DECIMAL(10,2) NOT NULL,
    cost_price DECIMAL(10,2),
    quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'piece',
    min_stock_level DECIMAL(10,2) DEFAULT 0,
    expiry_date DATE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, sku),
    UNIQUE (user_id, barcode)
);

-- ============================================
-- TABLE 5: sales
-- WHEN a customer buys (receipt header)
-- ============================================
CREATE TABLE sales (
    id SERIAL PRIMARY KEY,
    total_amount DECIMAL(10,2) NOT NULL,
    notes TEXT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLE 6: sale_items
-- WHAT exactly was in each sale (receipt lines)
-- ============================================
CREATE TABLE sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    cost_price DECIMAL(10,2),
    total_price DECIMAL(10,2) NOT NULL
);

-- ============================================
-- TABLE 7: returns
-- WHEN a customer returns a product
-- ============================================
CREATE TABLE returns (
    id             SERIAL PRIMARY KEY,
    return_number  INTEGER NOT NULL,
    sale_id        INTEGER NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason         VARCHAR(20) NOT NULL CHECK (reason IN ('refund', 'warranty', 'exchange')),
    notes          TEXT,
    total_refund   DECIMAL(10,2) NOT NULL,
    performed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sale_id),
    UNIQUE(user_id, return_number)
);

-- ============================================
-- TABLE 8: return_items
-- WHICH products were in the return
-- ============================================
CREATE TABLE return_items (
    id            SERIAL PRIMARY KEY,
    return_id     INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    sale_item_id  INTEGER NOT NULL REFERENCES sale_items(id) ON DELETE RESTRICT,
    product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity      DECIMAL(10,2) NOT NULL,
    unit_price    DECIMAL(10,2) NOT NULL,
    cost_price    DECIMAL(10,2),
    total_price   DECIMAL(10,2) NOT NULL,
    UNIQUE(sale_item_id)
);

-- ============================================
-- TABLE 9: stock_movements
-- WHAT changed in inventory and WHY
-- ============================================
CREATE TABLE stock_movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('IN', 'OUT', 'ADJUSTMENT', 'RETURN')),
    quantity DECIMAL(10,2) NOT NULL,
    reference_id INTEGER,
    reason TEXT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLE 10: notifications
-- WHAT needs the owner's attention
-- ============================================
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL CHECK (type IN ('LOW_STOCK', 'OUT_OF_STOCK', 'EXPIRY_WARNING')),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_products_user ON products(user_id);
CREATE INDEX idx_products_quantity ON products(quantity, min_stock_level);
CREATE INDEX idx_sales_user ON sales(user_id);
CREATE INDEX idx_sales_created_at ON sales(created_at);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(type);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_returns_user ON returns(user_id);
CREATE INDEX idx_returns_sale ON returns(sale_id);
CREATE INDEX idx_return_items_return ON return_items(return_id);
CREATE INDEX idx_return_items_sale_item ON return_items(sale_item_id);
