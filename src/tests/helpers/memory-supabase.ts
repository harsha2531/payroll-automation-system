type Row = Record<string, unknown>;

export interface MemoryDb {
  employees: Row[];
  employee_payroll_details: Row[];
  payroll_runs: Row[];
  payroll_items: Row[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return "2026-07-01T00:00:00.000Z";
}

let seq = 0;
function uuid(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq.toString().padStart(4, "0")}`;
}

export function createMemoryDb(seed: Partial<MemoryDb> = {}): MemoryDb {
  seq = 0;
  return {
    employees: seed.employees ? clone(seed.employees) : [],
    employee_payroll_details: seed.employee_payroll_details
      ? clone(seed.employee_payroll_details)
      : [],
    payroll_runs: seed.payroll_runs ? clone(seed.payroll_runs) : [],
    payroll_items: seed.payroll_items ? clone(seed.payroll_items) : [],
  };
}

class QueryBuilder implements PromiseLike<{
  data: Row[] | null;
  error: { message: string; code?: string } | null;
  count: number | null;
}> {
  private filters: Array<(row: Row) => boolean> = [];
  private insertRows: Row[] | null = null;
  private updatePayload: Row | null = null;
  private deleteMode = false;
  private rangeFrom = 0;
  private rangeTo = Number.MAX_SAFE_INTEGER;
  private wantCount = false;

  constructor(
    private readonly db: MemoryDb,
    private readonly table: keyof MemoryDb
  ) {}

  select(_columns?: string, options?: { count?: string }) {
    this.wantCount = options?.count === "exact";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  or() {
    return this;
  }

  order() {
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  insert(payload: Row | Row[]) {
    this.insertRows = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  update(payload: Row) {
    this.updatePayload = payload;
    return this;
  }

  delete() {
    this.deleteMode = true;
    return this;
  }

  private currentRows(): Row[] {
    let list = this.db[this.table];
    for (const filter of this.filters) {
      list = list.filter(filter);
    }
    return list;
  }

  private applyInsert(): Row[] {
    return (this.insertRows ?? []).map((row) => {
      const withDefaults: Row = {
        id: row.id ?? uuid(this.table),
        created_at: nowIso(),
        updated_at: nowIso(),
        ...row,
      };
      this.db[this.table].push(withDefaults);
      return clone(withDefaults);
    });
  }

  private applyUpdate(): Row[] {
    const updated: Row[] = [];
    for (const row of this.currentRows()) {
      Object.assign(row, this.updatePayload, { updated_at: nowIso() });
      updated.push(clone(row));
    }
    return updated;
  }

  private applyDelete(): void {
    const remove = new Set(this.currentRows());
    this.db[this.table] = this.db[this.table].filter(
      (row) => !remove.has(row)
    ) as never;
  }

  private execute() {
    if (this.deleteMode) {
      this.applyDelete();
      return { data: [] as Row[], error: null, count: 0 };
    }
    if (this.insertRows) {
      const created = this.applyInsert();
      return { data: created, error: null, count: created.length };
    }
    if (this.updatePayload) {
      const updated = this.applyUpdate();
      return { data: updated, error: null, count: updated.length };
    }
    const all = this.currentRows();
    const sliced = all.slice(this.rangeFrom, this.rangeTo + 1);
    return {
      data: sliced.map(clone),
      error: null,
      count: this.wantCount ? all.length : null,
    };
  }

  async maybeSingle() {
    const result = this.execute();
    const row = result.data?.[0] ?? null;
    return { data: row, error: result.error };
  }

  async single() {
    const result = await this.maybeSingle();
    if (!result.data) {
      return { data: null, error: { message: "No rows", code: "PGRST116" } };
    }
    return result;
  }

  then<TResult1 = unknown, TResult2 = never>(
    resolve: (value: {
      data: Row[] | null;
      error: { message: string; code?: string } | null;
      count: number | null;
    }) => TResult1,
    reject?: (reason: unknown) => TResult2
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(resolve, reject);
  }
}

export function createMemorySupabase(db: MemoryDb) {
  return {
    db,
    from(table: keyof MemoryDb) {
      return new QueryBuilder(db, table);
    },
  };
}

export function sampleEmployeeRow(overrides: Row = {}): Row {
  return {
    id: "emp-jane",
    employee_number: "EPF-123",
    full_name: "Jane Doe",
    email: "jane@example.com",
    designation: "Software Engineer",
    department: null,
    phone: null,
    epf_number: "EPF-123",
    status: "active",
    hire_date: null,
    termination_date: null,
    created_at: nowIso(),
    updated_at: nowIso(),
    ...overrides,
  };
}
