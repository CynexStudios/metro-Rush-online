declare module 'sql.js' {
  export interface SqlStatement {
    bind(params?: unknown[]): boolean;
    step(): boolean;
    getAsObject(params?: unknown[]): Record<string, unknown>;
    free(): boolean;
  }
  export interface SqlDatabase {
    run(sql: string, params?: unknown[]): SqlDatabase;
    exec(sql: string): Array<{ columns: string[]; values: unknown[][] }>;
    prepare(sql: string): SqlStatement;
    export(): Uint8Array;
    close(): void;
  }
  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => SqlDatabase;
  }
  export default function initSqlJs(config?: {
    locateFile?: (file: string, prefix: string) => string;
  }): Promise<SqlJsStatic>;
}
