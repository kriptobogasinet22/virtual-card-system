-- Veritabanı şeması
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS virtual_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_number TEXT NOT NULL,
  cvv TEXT NOT NULL,
  expiry_date TEXT NOT NULL,
  balance DECIMAL(10, 2) NOT NULL,
  is_assigned BOOLEAN DEFAULT FALSE,
  is_used BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES users(id),
  assigned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) NOT NULL,
  card_balance DECIMAL(10, 2) NOT NULL,
  service_fee DECIMAL(10, 2) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS card_redemption_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) NOT NULL,
  card_id UUID REFERENCES virtual_cards(id) NOT NULL,
  remaining_balance DECIMAL(10, 2) NOT NULL,
  trx_wallet_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, rejected
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) NOT NULL,
  card_id UUID REFERENCES virtual_cards(id),
  type TEXT NOT NULL, -- purchase, redemption
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin kullanıcısı oluştur (şifreyi değiştirmeyi unutmayın!)
INSERT INTO admins (username, password) 
VALUES ('admin', crypt('admin123', gen_salt('bf')))
ON CONFLICT (username) DO NOTHING;
