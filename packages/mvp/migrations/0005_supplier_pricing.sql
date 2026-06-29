-- 0005_supplier_pricing.sql
-- V2 Phase 4: versioned supplier catalog, price-lists, supplier-aware estimates.

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  contact TEXT,
  phone TEXT,
  email TEXT,
  note TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS supplier_price_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  effective_from TEXT,
  effective_to TEXT,
  note TEXT,
  created_by TEXT NOT NULL DEFAULT 'manager',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS supplier_price_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  price_list_id INTEGER NOT NULL,
  supplier_id INTEGER NOT NULL,
  furniture_type TEXT NOT NULL,
  material TEXT NOT NULL DEFAULT 'standard',
  label TEXT NOT NULL,
  base_price_kzt INTEGER NOT NULL DEFAULT 0,
  unit_price_kzt INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'м.п.',
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (price_list_id) REFERENCES supplier_price_lists(id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS supplier_estimate_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  estimate_id INTEGER NOT NULL,
  price_list_id INTEGER NOT NULL,
  supplier_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (estimate_id) REFERENCES pdf_estimates(id),
  FOREIGN KEY (price_list_id) REFERENCES supplier_price_lists(id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers(code);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_price_lists_supplier_id ON supplier_price_lists(supplier_id);
CREATE INDEX IF NOT EXISTS idx_price_lists_status ON supplier_price_lists(status);
CREATE INDEX IF NOT EXISTS idx_price_items_price_list_id ON supplier_price_items(price_list_id);
CREATE INDEX IF NOT EXISTS idx_price_items_supplier_id ON supplier_price_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_price_items_furniture_type ON supplier_price_items(furniture_type);
CREATE INDEX IF NOT EXISTS idx_estimate_links_estimate_id ON supplier_estimate_links(estimate_id);
