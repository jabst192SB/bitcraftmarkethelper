-- Supabase Schema for Bitcraft Market Helper
-- Run this in your Supabase SQL Editor to set up the database

-- Market items with current order counts
CREATE TABLE IF NOT EXISTS market_items (
  item_id INTEGER PRIMARY KEY,
  item_name TEXT NOT NULL,
  item_type INTEGER DEFAULT 0,
  sell_orders INTEGER DEFAULT 0,
  buy_orders INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Full order details for items (JSONB for flexibility)
CREATE TABLE IF NOT EXISTS order_details (
  item_id INTEGER PRIMARY KEY REFERENCES market_items(item_id) ON DELETE CASCADE,
  sell_orders JSONB DEFAULT '[]'::jsonb,
  buy_orders JSONB DEFAULT '[]'::jsonb,
  stats JSONB,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Change history (stores change events)
CREATE TABLE IF NOT EXISTS market_changes (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  changes JSONB NOT NULL
);

-- Metadata (stores last update time, change count, etc.)
CREATE TABLE IF NOT EXISTS monitor_metadata (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_market_items_updated ON market_items(last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_market_items_total_orders ON market_items(total_orders DESC);
CREATE INDEX IF NOT EXISTS idx_changes_timestamp ON market_changes(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_order_details_updated ON order_details(last_updated DESC);

-- Initialize metadata
INSERT INTO monitor_metadata (key, value)
VALUES
  ('last_update', 'null'::jsonb),
  ('change_count', '0'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Enable Row Level Security (RLS) for public access
ALTER TABLE market_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitor_metadata ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public read access (anon role)
CREATE POLICY "Allow public read access to market_items"
  ON market_items FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public read access to order_details"
  ON order_details FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public read access to market_changes"
  ON market_changes FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public read access to monitor_metadata"
  ON monitor_metadata FOR SELECT
  TO anon
  USING (true);

-- Create policies to allow service role full access (for local monitor)
CREATE POLICY "Allow service role full access to market_items"
  ON market_items FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to order_details"
  ON order_details FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to market_changes"
  ON market_changes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to monitor_metadata"
  ON monitor_metadata FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to automatically cleanup old changes (keep last 1000)
CREATE OR REPLACE FUNCTION cleanup_old_changes()
RETURNS void AS $$
BEGIN
  DELETE FROM market_changes
  WHERE id NOT IN (
    SELECT id FROM market_changes
    ORDER BY timestamp DESC
    LIMIT 1000
  );
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a trigger to auto-cleanup after inserts (can be heavy)
-- Or run cleanup_old_changes() manually/periodically
