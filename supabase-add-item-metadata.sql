-- Migration: Add tier, rarity, and category fields to market_items
-- Run this in your Supabase SQL Editor to add the missing item metadata fields

ALTER TABLE market_items
ADD COLUMN IF NOT EXISTS tier INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rarity TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '';

-- Create index for tier-based queries
CREATE INDEX IF NOT EXISTS idx_market_items_tier ON market_items(tier);

-- Create index for rarity-based queries
CREATE INDEX IF NOT EXISTS idx_market_items_rarity ON market_items(rarity);

-- Create index for category-based queries
CREATE INDEX IF NOT EXISTS idx_market_items_category ON market_items(category);
