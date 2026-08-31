-- ===========================================================================
-- Bookly SaaS — Seed Inicial para Cloudflare D1
-- ===========================================================================

-- 1. Planes SaaS
INSERT INTO saas_plans (code, name, monthly_price_qtz, max_staff, monthly_appointments, max_locations, features_json, is_active)
VALUES 
  ('basic', 'Básico', 14900, 1, 100, 1, '{"portal": true, "reminders": "basic"}', 1),
  ('pro', 'Pro', 29900, 5, 500, 5, '{"portal": true, "multi_service": true, "payments": true}', 1),
  ('enterprise', 'Enterprise', 59900, -1, -1, -1, '{"portal": true, "multi_branch": true, "vip_support": true}', 1)
ON CONFLICT (code) DO NOTHING;

-- 2. Empresa / Tenant Demo (plan pro)
INSERT INTO companies (id, plan_id, name, slug, email, phone, timezone, currency, brand_color, theme, subscription_status)
VALUES (
  1,
  2,
  'Clínica Dental Dr. Morales',
  'dr-morales',
  'contacto@dentalmorales.com',
  '+502 5555-1234',
  'America/Guatemala',
  'GTQ',
  '#10b981',
  'midnight-emerald',
  'active'
)
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name,
  theme = excluded.theme;

-- 3. Usuarios (Admin & Staff)
INSERT INTO users (id, company_id, name, email, password_hash, role, phone, is_active)
VALUES 
  (1, 1, 'Dr. Carlos Morales', 'admin@dentalmorales.com', 'pbkdf2$100000$84199cf99c6f2949b5ec1c1c0f36aae2$f95371ca6d27db9f31df2ebb77c9ce0e3667670db5bfa4901f67ce631e27013b', 'admin', '+502 5555-1111', 1),
  (2, 1, 'Dra. Sofía Méndez', 'sofia@dentalmorales.com', 'pbkdf2$100000$84199cf99c6f2949b5ec1c1c0f36aae2$f95371ca6d27db9f31df2ebb77c9ce0e3667670db5bfa4901f67ce631e27013b', 'staff', '+502 5555-2222', 1)
ON CONFLICT (id) DO NOTHING;

-- 4. Servicios
INSERT INTO services (id, company_id, name, description, duration_minutes, buffer_after_minutes, price_qtz, is_active, display_order)
VALUES 
  (1, 1, 'Limpieza Dental Profunda', 'Profilaxis ultrasónica y desmanchado', 45, 10, 25000, 1, 1),
  (2, 1, 'Blanqueamiento Láser Zoom', 'Sesión intensiva de blanqueamiento estético', 60, 15, 65000, 1, 2),
  (3, 1, 'Consulta Odontológica y Diagnóstico', 'Evaluación integral y plan de tratamiento', 30, 10, 15000, 1, 3)
ON CONFLICT (id) DO NOTHING;

-- 5. Ubicaciones (lugares de atención: 1 fijo + 1 móvil)
INSERT INTO locations (id, company_id, name, address, slug, type, service_radius_km, is_active)
VALUES 
  (1, 1, 'Consultorio Zona 10', 'Av. Reforma 10-12, Zona 10', 'consultorio-zona-10', 'fixed', NULL, 1),
  (2, 1, 'A domicilio', 'Radio de cobertura', 'a-domicilio', 'mobile', 15, 1)
ON CONFLICT (id) DO NOTHING;

-- 6. Asignación de Staff a Servicios
INSERT INTO staff_services (user_id, service_id, company_id)
VALUES 
  (1, 1, 1),
  (1, 2, 1),
  (1, 3, 1),
  (2, 1, 1),
  (2, 3, 1)
ON CONFLICT (user_id, service_id) DO NOTHING;

-- 7. Asignación de Staff a Ubicaciones
INSERT INTO staff_locations (user_id, location_id, company_id)
VALUES 
  (1, 1, 1),
  (1, 2, 1),
  (2, 1, 1)
ON CONFLICT (user_id, location_id) DO NOTHING;

-- 8. Asignación de Servicios a Ubicaciones
INSERT INTO service_locations (service_id, location_id, company_id)
VALUES 
  (1, 1, 1),
  (2, 1, 1),
  (3, 1, 1),
  (1, 2, 1),
  (2, 2, 1),
  (3, 2, 1)
ON CONFLICT (service_id, location_id) DO NOTHING;

-- 9. Horarios Laborales (Lunes a Viernes 09:00 - 17:00 con almuerzo 13:00 - 14:00) — general, aplica a todas las ubicaciones
INSERT INTO working_hours (company_id, user_id, location_id, day_of_week, start_time, end_time, break_start_time, break_end_time, is_active)
VALUES 
  (1, NULL, NULL, 1, '09:00', '17:00', '13:00', '14:00', 1),
  (1, NULL, NULL, 2, '09:00', '17:00', '13:00', '14:00', 1),
  (1, NULL, NULL, 3, '09:00', '17:00', '13:00', '14:00', 1),
  (1, NULL, NULL, 4, '09:00', '17:00', '13:00', '14:00', 1),
  (1, NULL, NULL, 5, '09:00', '17:00', '13:00', '14:00', 1);
