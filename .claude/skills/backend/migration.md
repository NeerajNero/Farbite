---
name: backend:migration
description: Create SQL migrations following the SQL-first workflow
---

# Backend Migration

## Trigger

Use when creating database schema changes in `./`.

## SQL-First Workflow

**Never use Drizzle Kit to generate migrations. Write raw SQL.**

## Steps

1. **Create the migration file** — `pnpm db:create-migration {name}` (auto-assigns the next sequential 4-digit prefix and updates the journal — e.g. `0009_my_feature.sql`)
2. **Write raw SQL** in the generated file — use the templates below (CREATE TABLE, ADD COLUMN, etc.)
3. **Follow naming conventions** — file prefix must be strictly sequential (0001, 0002, … 0008, 0009), `snake_case` for the descriptor, `snake_case` tables, `idx_` prefix for indexes, `uq_` for unique constraints, `chk_` for check constraints. **Never hand-create a file with a prefix that duplicates or skips an existing number — always use `pnpm db:create-migration`.**
4. **Add the `updated_at` trigger** on every new table that has an `updated_at` column
5. **Apply the migration** — `pnpm db:migrate`
6. **Regenerate the schema** — `pnpm db:introspect` (updates `src/db/drizzle/schema.ts`)
7. **Verify schema.ts** — confirm the new table/columns appear correctly; add relations manually if needed
8. **Proceed to repository** — create `src/db/{domain}/{domain}.repository.ts` (see `backend:repository`)

## SQL Templates

### Create Table

```sql
CREATE TABLE {table_name} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_{table_name}_user_id ON {table_name} (user_id);
CREATE INDEX idx_{table_name}_status ON {table_name} (status);
CREATE INDEX idx_{table_name}_created_at ON {table_name} (created_at DESC);

-- Auto-update trigger
CREATE TRIGGER set_{table_name}_updated_at
  BEFORE UPDATE ON {table_name}
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Add Column

```sql
ALTER TABLE {table_name}
  ADD COLUMN {column_name} VARCHAR(255);

ALTER TABLE {table_name}
  ADD COLUMN {column_name} INTEGER NOT NULL DEFAULT 0;
```

### Add Foreign Key

```sql
ALTER TABLE {table_name}
  ADD COLUMN {fk_name}_id UUID REFERENCES {other_table}(id) ON DELETE SET NULL;

CREATE INDEX idx_{table_name}_{fk_name}_id ON {table_name} ({fk_name}_id);
```

### Create Enum

```sql
CREATE TYPE {enum_name} AS ENUM ('value1', 'value2', 'value3');

ALTER TABLE {table_name}
  ADD COLUMN {column_name} {enum_name} NOT NULL DEFAULT 'value1';
```

### Add Unique Constraint

```sql
ALTER TABLE {table_name}
  ADD CONSTRAINT uq_{table_name}_{column} UNIQUE ({column});

-- Composite unique
ALTER TABLE {table_name}
  ADD CONSTRAINT uq_{table_name}_{col1}_{col2} UNIQUE ({col1}, {col2});
```

### Add Check Constraint

```sql
ALTER TABLE {table_name}
  ADD CONSTRAINT chk_{table_name}_{column} CHECK ({column} > 0);
```

### Create Index

```sql
-- Single column
CREATE INDEX idx_{table_name}_{column} ON {table_name} ({column});

-- Composite
CREATE INDEX idx_{table_name}_{col1}_{col2} ON {table_name} ({col1}, {col2});

-- Partial
CREATE INDEX idx_{table_name}_active ON {table_name} (id) WHERE status = 'active';

-- GIN for JSONB
CREATE INDEX idx_{table_name}_metadata ON {table_name} USING GIN (metadata);
```

## Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Tables | `snake_case` plural | `user_profiles` |
| Columns | `snake_case` | `created_at` |
| Indexes | `idx_{table}_{column}` | `idx_users_email` |
| Foreign keys | `{table}_id` or `{ref}_id` | `user_id` |
| Unique | `uq_{table}_{column}` | `uq_users_email` |
| Check | `chk_{table}_{desc}` | `chk_orders_amount` |

## After Migration

1. Run `pnpm db:migrate`
2. Run `pnpm db:introspect`
3. Check `schema.ts` was updated
4. Add relations manually if needed
