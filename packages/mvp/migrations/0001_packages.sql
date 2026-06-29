-- 0001_packages.sql
-- V2 core schema: clients, orders, service package catalog, engagements, conversion events.

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER,
  status TEXT NOT NULL DEFAULT 'new',
  engagement_level TEXT NOT NULL DEFAULT 'rough_quote',
  service_package TEXT,
  budget_kzt INTEGER,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE IF NOT EXISTS service_package_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_kzt INTEGER NOT NULL DEFAULT 0,
  credited_on_order INTEGER NOT NULL DEFAULT 0,
  deliverables_json TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_package_engagements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  package_code TEXT NOT NULL,
  engagement_level TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offered',
  price_kzt INTEGER NOT NULL DEFAULT 0,
  credited_on_order INTEGER NOT NULL DEFAULT 0,
  credited_amount_kzt INTEGER NOT NULL DEFAULT 0,
  visual_state TEXT NOT NULL DEFAULT 'none',
  proposal_depth TEXT NOT NULL DEFAULT 'none',
  revision_round INTEGER NOT NULL DEFAULT 0,
  max_revisions INTEGER NOT NULL DEFAULT 0,
  source_material_type TEXT NOT NULL DEFAULT 'manual',
  upgrade_offer_state TEXT NOT NULL DEFAULT 'none',
  offered_at TEXT,
  accepted_at TEXT,
  paid_at TEXT,
  delivered_at TEXT,
  credited_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS package_conversion_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER,
  engagement_id INTEGER,
  from_level TEXT,
  to_level TEXT,
  event_type TEXT NOT NULL,
  amount_kzt INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (engagement_id) REFERENCES order_package_engagements(id)
);

CREATE INDEX IF NOT EXISTS idx_orders_engagement_level ON orders(engagement_level);
CREATE INDEX IF NOT EXISTS idx_orders_service_package ON orders(service_package);
CREATE INDEX IF NOT EXISTS idx_engagements_order_id ON order_package_engagements(order_id);
CREATE INDEX IF NOT EXISTS idx_engagements_status ON order_package_engagements(status);
CREATE INDEX IF NOT EXISTS idx_conversion_events_order_id ON package_conversion_events(order_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_event_type ON package_conversion_events(event_type);

INSERT INTO service_package_catalog (code, name, price_kzt, credited_on_order, deliverables_json, sort_order) VALUES
  ('level_1', 'Быстрый ориентир', 0, 0, '["rough_price_per_meter","no_estimate","no_visual"]', 1),
  ('package_a', 'Package A — 10 000 тг', 10000, 1, '["commercial_proposal","line_item_estimate","bw_preview_visual"]', 2),
  ('package_b', 'Package B — 20 000 тг', 20000, 1, '["color_multi_view_visual","commercial_proposal","detailed_dimensions","2_3_layout_variants","one_revision_round","inclusions_sheet","recommended_materials"]', 3);
