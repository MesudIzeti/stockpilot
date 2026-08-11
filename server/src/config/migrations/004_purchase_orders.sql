-- Migration 004: Purchase Orders (supplier reorder management)

CREATE TABLE purchase_orders (
    id          SERIAL PRIMARY KEY,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    user_id     INTEGER NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
    status      VARCHAR(20) NOT NULL DEFAULT 'in_transit'
                    CHECK (status IN ('in_transit', 'received', 'cancelled')),
    notes       TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE purchase_order_items (
    id               SERIAL PRIMARY KEY,
    order_id         INTEGER        NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id       INTEGER        NOT NULL REFERENCES products(id)        ON DELETE RESTRICT,
    quantity_ordered DECIMAL(10,2)  NOT NULL
);

CREATE INDEX idx_purchase_orders_user     ON purchase_orders(user_id);
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status   ON purchase_orders(status);
CREATE INDEX idx_po_items_order           ON purchase_order_items(order_id);
CREATE INDEX idx_po_items_product         ON purchase_order_items(product_id);
