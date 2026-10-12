-- SpesaTeam — schema database (PostgreSQL)
-- Creato automaticamente all'avvio se le tabelle non esistono.

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin','operator','driver','customer')),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  points INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  marketing_consent BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS addresses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT,
  street TEXT NOT NULL,
  civic TEXT,
  cap TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Casavatore',
  intercom TEXT,
  floor TEXT,
  notes TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drivers (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  vehicle TEXT,
  plate TEXT,
  zone TEXT,
  tax_code TEXT,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('offline','available','busy')),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  position_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS stores (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  hours TEXT,
  min_order NUMERIC(10,2) NOT NULL DEFAULT 15,
  prep_minutes INTEGER NOT NULL DEFAULT 30,
  color TEXT DEFAULT '#1E7B4F',
  emoji TEXT DEFAULT '🛒',
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '🛒',
  sort INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  brand TEXT,
  size TEXT,
  price NUMERIC(10,2) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pz' CHECK (unit IN ('pz','kg')),
  step NUMERIC(10,3) NOT NULL DEFAULT 1,
  vat NUMERIC(5,2) NOT NULL DEFAULT 10,
  image_url TEXT,
  emoji TEXT DEFAULT '🛒',
  is_bio BOOLEAN NOT NULL DEFAULT FALSE,
  gluten_free BOOLEAN NOT NULL DEFAULT FALSE,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  popularity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS products_store_idx ON products(store_id, category_id);

CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_price NUMERIC(10,2),
  new_price NUMERIC(10,2),
  changed_by INTEGER REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promotions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percent','fixed','x_for_y')),
  value NUMERIC(10,2) NOT NULL DEFAULT 0,
  buy_qty INTEGER,
  pay_qty INTEGER,
  scope TEXT NOT NULL CHECK (scope IN ('product','category','store','all')),
  target_id INTEGER,
  starts_at DATE,
  ends_at DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('percent','fixed','free_delivery')),
  value NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_spend NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_uses INTEGER,
  max_uses_per_customer INTEGER DEFAULT 1,
  used INTEGER NOT NULL DEFAULT 0,
  first_order_only BOOLEAN NOT NULL DEFAULT FALSE,
  customer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  expires_at DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES users(id),
  store_id INTEGER NOT NULL REFERENCES stores(id),
  driver_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','accepted','shopping','delivering','delivered','cancelled')),
  street TEXT, civic TEXT, cap TEXT, city TEXT, intercom TEXT, floor TEXT, address_notes TEXT,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  slot_date DATE,
  slot_label TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('card','paypal','cash')),
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','authorized','captured','collected','refunded')),
  items_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  promo_discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  coupon_code TEXT,
  coupon_discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  points_used INTEGER NOT NULL DEFAULT 0,
  points_discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  estimated_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  points_earned INTEGER NOT NULL DEFAULT 0,
  cash_collected NUMERIC(10,2),
  notes TEXT,
  proof_note TEXT,
  rating INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  shopping_at TIMESTAMPTZ,
  delivering_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at);
CREATE INDEX IF NOT EXISTS orders_driver_idx ON orders(driver_id);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders(customer_id);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  emoji TEXT,
  category_id INTEGER,
  unit TEXT NOT NULL DEFAULT 'pz',
  list_price NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  qty NUMERIC(10,3) NOT NULL,
  final_qty NUMERIC(10,3),
  promo_label TEXT,
  line_discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','picked','missing','substituted')),
  sub_pref TEXT NOT NULL DEFAULT 'substitute' CHECK (sub_pref IN ('substitute','contact','remove')),
  note TEXT
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);

CREATE TABLE IF NOT EXISTS order_events (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loyalty_movements (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  points INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
