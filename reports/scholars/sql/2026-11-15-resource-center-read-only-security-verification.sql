-- =============================================================================
-- Scholars Resource Centre — Read-Only Security Verification SQL
-- =============================================================================
--
-- Purpose: Verify the effective PostgreSQL privileges on public.profiles,
--          specifically whether the "authenticated" role can structurally
--          modify profiles.is_admin through any database-supported write path.
--
-- Safety: This script contains SELECT and read-only metadata queries ONLY.
--         It does NOT:
--           - Modify any database object, privilege, or data
--           - Read actual profile rows or personal data
--           - Execute public.is_admin(uuid) with arbitrary IDs
--           - Expose secrets, credentials, or connection strings
--
-- Usage: Execute manually through the Supabase SQL Editor in the Scholars
--        production project dashboard. Do not modify the script before running.
--
-- File: reports/scholars/sql/2026-11-15-resource-center-read-only-security-verification.sql
-- Repository: ImperioKDB/Updates
-- Status: Static review only. Not executed against any database.
-- =============================================================================

--------------------------------------------------------------------------------
-- SECTION A: Schema-level privileges on public
--------------------------------------------------------------------------------

-- A.1 Schema USAGE privilege on public
-- USAGE on a schema is required to access objects within it. Without USAGE,
-- even table-level privileges cannot be exercised because the schema itself
-- cannot be entered.
SELECT
  'anon' AS role_name,
  has_schema_privilege('anon', 'public', 'USAGE') AS schema_usage,
  has_schema_privilege('anon', 'public', 'CREATE') AS schema_create
UNION ALL
SELECT
  'authenticated',
  has_schema_privilege('authenticated', 'public', 'USAGE'),
  has_schema_privilege('authenticated', 'public', 'CREATE')
UNION ALL
SELECT
  'service_role',
  has_schema_privilege('service_role', 'public', 'USAGE'),
  has_schema_privilege('service_role', 'public', 'CREATE')
UNION ALL
SELECT
  'public',
  has_schema_privilege('public', 'public', 'USAGE'),
  has_schema_privilege('public', 'public', 'CREATE');

--------------------------------------------------------------------------------
-- SECTION B: Role membership and inheritance checks
--------------------------------------------------------------------------------

-- B.1 Direct role membership via pg_auth_members
-- Reports every direct membership relationship involving the API roles
-- (anon, authenticated, service_role) as either member or granted role.
-- pg_auth_members is available in all supported PostgreSQL versions.
-- Columns:
--   member     = the role that is a member (the grantee)
--   roleid     = the role that is granted (the grant target)
--   grantor    = the role that granted the membership
--   admin_option = whether the member can grant the membership to others
--   inherit_option = whether inherited privileges flow from granted role
--                    to member (PostgreSQL 16+; NULL on older versions)
--   set_option = whether the member can SET ROLE to the granted role
--                (PostgreSQL 16+; NULL on older versions)
-- Optional membership columns are accessed via to_jsonb(m)->>'...' so the
-- query does not fail on PostgreSQL versions that do not expose them.
SELECT
  pg_get_userbyid(m.member) AS member_role,
  pg_get_userbyid(m.roleid) AS granted_role,
  pg_get_userbyid(m.grantor) AS grantor,
  m.admin_option AS can_admin_grant,
  to_jsonb(m)->>'inherit_option' AS inherits_privileges,
  to_jsonb(m)->>'set_option' AS can_set_role
FROM pg_auth_members m
WHERE pg_get_userbyid(m.member) IN ('anon', 'authenticated', 'service_role')
   OR pg_get_userbyid(m.roleid) IN ('anon', 'authenticated', 'service_role')
ORDER BY member_role, granted_role;

-- B.2 Role attributes from pg_roles
-- Shows whether each API role can log in and whether it inherits privileges
-- by default. pg_roles is available in all supported PostgreSQL versions.
SELECT
  rolname AS role_name,
  rolcanlogin AS can_login,
  rolinherit AS inherits_by_default,
  rolsuper AS is_superuser
FROM pg_roles
WHERE rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY rolname;

--------------------------------------------------------------------------------
-- SECTION C: Effective privileges on public.profiles
--------------------------------------------------------------------------------

-- C.1 Table-level INSERT/UPDATE privilege on public.profiles
-- Checks whether each role can INSERT/UPDATE into the profiles table at the
-- table level. These are the primary effective-privilege tests for the named
-- API roles.
SELECT
  'anon' AS role_name,
  has_table_privilege('anon', 'public.profiles', 'INSERT') AS table_level_insert,
  has_table_privilege('anon', 'public.profiles', 'UPDATE') AS table_level_update
UNION ALL
SELECT
  'authenticated',
  has_table_privilege('authenticated', 'public.profiles', 'INSERT'),
  has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
UNION ALL
SELECT
  'service_role',
  has_table_privilege('service_role', 'public.profiles', 'INSERT'),
  has_table_privilege('service_role', 'public.profiles', 'UPDATE')
UNION ALL
SELECT
  'public',
  has_table_privilege('public', 'public.profiles', 'INSERT'),
  has_table_privilege('public', 'public.profiles', 'UPDATE');

-- C.2 Column-level INSERT/UPDATE privilege on profiles.is_admin
-- Checks whether each role can INSERT/UPDATE into the is_admin column
-- specifically. A column-level revoke does NOT cancel a table-level grant,
-- so table-level UPDATE (Section C.1) may still permit UPDATE on is_admin
-- even if column-level UPDATE is revoked.
SELECT
  'anon' AS role_name,
  has_column_privilege('anon', 'public.profiles', 'is_admin', 'INSERT') AS column_insert_is_admin,
  has_column_privilege('anon', 'public.profiles', 'is_admin', 'UPDATE') AS column_update_is_admin
UNION ALL
SELECT
  'authenticated',
  has_column_privilege('authenticated', 'public.profiles', 'is_admin', 'INSERT'),
  has_column_privilege('authenticated', 'public.profiles', 'is_admin', 'UPDATE')
UNION ALL
SELECT
  'service_role',
  has_column_privilege('service_role', 'public.profiles', 'is_admin', 'INSERT'),
  has_column_privilege('service_role', 'public.profiles', 'is_admin', 'UPDATE')
UNION ALL
SELECT
  'public',
  has_column_privilege('public', 'public.profiles', 'is_admin', 'INSERT'),
  has_column_privilege('public', 'public.profiles', 'is_admin', 'UPDATE');

-- C.3 Column-level privileges on ordinary profile columns (for comparison)
-- Shows that ordinary fields have column grants while is_admin may not at
-- column level, even though table-level UPDATE may still cover is_admin.
SELECT
  'authenticated' AS role_name,
  'full_name' AS column_name,
  has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE') AS column_update_allowed
UNION ALL
SELECT
  'authenticated',
  'is_admin',
  has_column_privilege('authenticated', 'public.profiles', 'is_admin', 'UPDATE');

--------------------------------------------------------------------------------
-- SECTION D: Row-Level Security (RLS) on public.profiles
--------------------------------------------------------------------------------

-- D.1 RLS enablement and FORCE status
-- relrowsecurity = RLS is enabled (policies apply to ordinary access).
-- relforcerowsecurity = FORCE ROW LEVEL SECURITY (subjects the table owner
-- to RLS as well). Superusers and roles with BYPASSRLS still bypass RLS
-- regardless of FORCE RLS; FORCE RLS does not override superuser or
-- BYPASSRLS privileges.
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS force_rls,
  pg_get_userbyid(c.relowner) AS table_owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'profiles'
  AND c.relkind = 'r';

-- D.2 RLS policies on public.profiles
-- Shows policy name, command type, ALL policy roles (expanded from the
-- polroles array), USING expression, and WITH CHECK expression.
-- The PUBLIC pseudo-role appears as role OID 0 in polroles and is resolved
-- via pg_get_userbyid(0).
SELECT
  polname AS policy_name,
  polcmd AS command_type,  -- r = SELECT, a = INSERT, w = UPDATE, d = DELETE, * = ALL
  unnest_roles.policy_role,
  pg_get_expr(polqual, polrelid) AS using_expression,
  pg_get_expr(polwithcheck, polrelid) AS with_check_expression
FROM pg_policy
JOIN pg_class ON pg_class.oid = polrelid
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
CROSS JOIN LATERAL (
  SELECT pg_get_userbyid(rol.rolid) AS policy_role
  FROM unnest(polroles) AS rol(rolid)
) AS unnest_roles
WHERE pg_namespace.nspname = 'public'
  AND pg_class.relname = 'profiles'
ORDER BY polname, polcmd, unnest_roles.policy_role;

-- D.3 Effective table grants on public.profiles (from information_schema)
-- Shows the grantee, privilege type, and whether it is grantable.
SELECT
  grantee AS role_name,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY grantee, privilege_type;

-- D.4 Effective column grants on profiles.is_admin (from information_schema)
SELECT
  grantee AS role_name,
  column_name,
  privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'is_admin'
ORDER BY grantee, privilege_type;

--------------------------------------------------------------------------------
-- SECTION E: Function metadata for public.is_admin(uuid)
--------------------------------------------------------------------------------

-- E.1 Function existence, owner, SECURITY DEFINER status, and configuration
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS argument_types,
  pg_get_userbyid(p.proowner) AS function_owner,
  p.prosecdef AS security_definer,
  p.proconfig AS configuration,  -- includes search_path setting
  p.prokind AS function_kind  -- f = function, p = procedure, a = aggregate
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'is_admin'
  AND pg_get_function_identity_arguments(p.oid) = 'uuid'
ORDER BY p.proname;

-- E.2 Effective EXECUTE privilege on public.is_admin(uuid) for each role
-- has_function_privilege checks whether the role can execute the function.
-- Does NOT execute the function; only checks privilege metadata.
SELECT
  'public' AS role_name,
  has_function_privilege('public', 'public.is_admin(uuid)', 'EXECUTE') AS execute_privilege
UNION ALL
SELECT
  'anon',
  has_function_privilege('anon', 'public.is_admin(uuid)', 'EXECUTE')
UNION ALL
SELECT
  'authenticated',
  has_function_privilege('authenticated', 'public.is_admin(uuid)', 'EXECUTE')
UNION ALL
SELECT
  'service_role',
  has_function_privilege('service_role', 'public.is_admin(uuid)', 'EXECUTE');

-- E.3 Function ACL (access control list) details from pg_proc
-- Shows the raw ACL entries for the function. NULL if no explicit ACL
-- (defaults apply).
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS argument_types,
  p.proacl AS function_acl_raw
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'is_admin'
  AND pg_get_function_identity_arguments(p.oid) = 'uuid';

--------------------------------------------------------------------------------
-- END OF SCRIPT
--------------------------------------------------------------------------------
