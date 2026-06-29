-- 0002_package_payments.sql
-- Платёжные записи для пакетов и зачёт в заказ.

CREATE TABLE IF NOT EXISTS package_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  engagement_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  amount_kzt INTEGER NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pending',
  reference TEXT,
  created_by TEXT NOT NULL DEFAULT 'manager',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TEXT,
  FOREIGN KEY (engagement_id) REFERENCES order_package_engagements(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX IF NOT EXISTS idx_payments_engagement_id ON package_payments(engagement_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON package_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON package_payments(status);
