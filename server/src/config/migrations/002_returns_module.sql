-- StockPilot: Returns Module
-- Run on your existing database:
-- psql -U mesudcati -d stockpilot -f 002_returns_module.sql

-- Expand stock_movements type constraint to include RETURN
ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_type_check;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_type_check
    CHECK (type IN ('IN', 'OUT', 'ADJUSTMENT', 'RETURN'));

-- Return transaction header
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

-- Return line items
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

-- Indexes
CREATE INDEX idx_returns_user ON returns(user_id);
CREATE INDEX idx_returns_sale ON returns(sale_id);
CREATE INDEX idx_return_items_return ON return_items(return_id);
CREATE INDEX idx_return_items_sale_item ON return_items(sale_item_id);
