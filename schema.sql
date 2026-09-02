-- ============================================================
-- Home Rent Status 2026 - Supabase Schema + RLS
-- Run this in Supabase SQL Editor (in order)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'tenant')) DEFAULT 'tenant',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_role ON public.profiles(role);

-- ============================================================
-- 2. HOUSES / PROPERTIES (to preserve original multi-house model)
-- ============================================================
CREATE TABLE public.houses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. ROOMS
-- ============================================================
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  house_id UUID NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  floor TEXT,
  monthly_rent NUMERIC(12,2) NOT NULL DEFAULT 4000 CHECK (monthly_rent >= 0),
  status TEXT NOT NULL DEFAULT 'occupied' CHECK (status IN ('occupied', 'vacant', 'maintenance')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(house_id, room_number)
);

CREATE INDEX idx_rooms_house ON public.rooms(house_id);

-- ============================================================
-- 4. TENANTS
-- ============================================================
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  move_in_date DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_user ON public.tenants(user_id);
CREATE INDEX idx_tenants_room ON public.tenants(room_id);
CREATE INDEX idx_tenants_active ON public.tenants(active);

-- ============================================================
-- 5. ELECTRICITY RATES
-- ============================================================
CREATE TABLE public.electricity_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rate_per_unit NUMERIC(10,2) NOT NULL CHECK (rate_per_unit > 0),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

-- ============================================================
-- 6. METER READINGS
-- ============================================================
CREATE TABLE public.meter_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  billing_month DATE NOT NULL, -- first day of month e.g. 2026-08-01
  previous_reading NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (previous_reading >= 0),
  current_reading NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (current_reading >= 0),
  units_used NUMERIC(12,2) GENERATED ALWAYS AS (GREATEST(current_reading - previous_reading, 0)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  UNIQUE(room_id, billing_month)
);

CREATE INDEX idx_meter_readings_month ON public.meter_readings(billing_month);

-- ============================================================
-- 7. BILLS
-- ============================================================
CREATE TABLE public.bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  billing_month DATE NOT NULL, -- first day of month
  rent_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (rent_amount >= 0),
  electricity_units NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (electricity_units >= 0),
  electricity_rate NUMERIC(10,2) NOT NULL DEFAULT 12 CHECK (electricity_rate >= 0),
  electricity_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (electricity_amount >= 0),
  previous_due NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_charge NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (other_charge >= 0),
  discount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total_bill NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  remaining_due NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid', 'overpaid')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  UNIQUE(tenant_id, billing_month)
);

CREATE INDEX idx_bills_tenant ON public.bills(tenant_id);
CREATE INDEX idx_bills_month ON public.bills(billing_month);
CREATE INDEX idx_bills_status ON public.bills(status);

-- ============================================================
-- 8. PAYMENTS (audit trail - never overwrite)
-- ============================================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  bill_id UUID REFERENCES public.bills(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'bKash', 'Nagad', 'Bank', 'Other')),
  transaction_reference TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX idx_payments_tenant ON public.payments(tenant_id);
CREATE INDEX idx_payments_bill ON public.payments(bill_id);
CREATE INDEX idx_payments_date ON public.payments(payment_date);

-- ============================================================
-- 9. AUDIT LOGS
-- ============================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ============================================================
-- 10. SETTINGS (key-value for property name, currency etc.)
-- ============================================================
CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id)
);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Is current user admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Get tenant_id for current user (if any)
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.tenants WHERE user_id = auth.uid() AND active = TRUE LIMIT 1;
$$;

-- Recalculate bill totals (trigger helper)
CREATE OR REPLACE FUNCTION public.recalc_bill()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.electricity_amount := ROUND(NEW.electricity_units * NEW.electricity_rate, 2);
  NEW.total_bill := ROUND(
    NEW.rent_amount + NEW.electricity_amount + NEW.previous_due + NEW.other_charge - NEW.discount
  , 2);
  NEW.remaining_due := ROUND(NEW.total_bill - NEW.amount_paid, 2);

  IF NEW.remaining_due <= 0 AND NEW.amount_paid > 0 THEN
    NEW.status := CASE WHEN NEW.amount_paid > NEW.total_bill THEN 'overpaid' ELSE 'paid' END;
  ELSIF NEW.amount_paid > 0 THEN
    NEW.status := 'partial';
  ELSE
    NEW.status := 'unpaid';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bills_recalc
  BEFORE INSERT OR UPDATE OF rent_amount, electricity_units, electricity_rate,
                             previous_due, other_charge, discount, amount_paid
  ON public.bills
  FOR EACH ROW
  EXECUTE FUNCTION public.recalc_bill();

-- After payment insert/update → update bill.amount_paid
CREATE OR REPLACE FUNCTION public.sync_bill_paid_from_payments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill_id UUID;
  v_total NUMERIC;
BEGIN
  v_bill_id := COALESCE(NEW.bill_id, OLD.bill_id);
  IF v_bill_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_total
  FROM public.payments
  WHERE bill_id = v_bill_id;

  UPDATE public.bills
  SET amount_paid = v_total
  WHERE id = v_bill_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_payments_sync_bill
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_bill_paid_from_payments();

-- Auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'tenant')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.houses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.electricity_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meter_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- ---------- PROFILES ----------
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own profile (non-role)"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admin full access profiles"
  ON public.profiles FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------- HOUSES ----------
CREATE POLICY "Anyone authenticated can read houses"
  ON public.houses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin manage houses"
  ON public.houses FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------- ROOMS ----------
CREATE POLICY "Authenticated can read rooms"
  ON public.rooms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin manage rooms"
  ON public.rooms FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------- TENANTS ----------
CREATE POLICY "Admin full access tenants"
  ON public.tenants FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Tenant can view own tenant record"
  ON public.tenants FOR SELECT
  USING (user_id = auth.uid());

-- ---------- ELECTRICITY RATES ----------
CREATE POLICY "Authenticated can read rates"
  ON public.electricity_rates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin manage rates"
  ON public.electricity_rates FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------- METER READINGS ----------
CREATE POLICY "Admin full access meter"
  ON public.meter_readings FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Tenant can view own room meter readings"
  ON public.meter_readings FOR SELECT
  USING (
    room_id IN (
      SELECT room_id FROM public.tenants WHERE user_id = auth.uid() AND active = TRUE
    )
  );

-- ---------- BILLS ----------
CREATE POLICY "Admin full access bills"
  ON public.bills FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Tenant can view own bills only"
  ON public.bills FOR SELECT
  USING (tenant_id = public.get_my_tenant_id());

-- ---------- PAYMENTS ----------
CREATE POLICY "Admin full access payments"
  ON public.payments FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Tenant can view own payments only"
  ON public.payments FOR SELECT
  USING (tenant_id = public.get_my_tenant_id());

-- ---------- AUDIT LOGS ----------
CREATE POLICY "Admin only audit logs"
  ON public.audit_logs FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------- SETTINGS ----------
CREATE POLICY "Authenticated can read settings"
  ON public.settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin manage settings"
  ON public.settings FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- SEED DATA (houses from original app)
-- ============================================================
INSERT INTO public.houses (name) VALUES
  ('SOUTH HOME'),
  ('WEST HOME'),
  ('GREAT WALL HOME')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.electricity_rates (rate_per_unit, effective_from, active)
VALUES (12, '2026-01-01', TRUE);

INSERT INTO public.settings (key, value) VALUES
  ('property_name', '"Home Rent Status 2026"'),
  ('currency', '"BDT"'),
  ('currency_symbol', '"৳"')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- NOTES FOR ADMIN SETUP
-- ============================================================
-- 1. Create first admin user via Supabase Auth (email/password)
-- 2. Then run:
--    UPDATE public.profiles SET role = 'admin' WHERE id = '<user-uuid>';
-- 3. For tenants: create auth user, then link tenants.user_id = auth.users.id
-- ============================================================
