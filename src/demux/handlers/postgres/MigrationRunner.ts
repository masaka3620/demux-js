import {IDatabase, ITask} from "pg-promise"
import Migration from "./Migration"

export default class MigrationRunner {
  constructor(
    protected pgp: IDatabase<any>,
    protected migrations: Migration[],
    protected tableName: string = "_migrations",
    protected schemaName: string = "public",
  ) {
    const migrationNames = migrations.map((f) => f.name)
    const nameDups = this.findDups(migrationNames)
    if (nameDups.length > 0) {
      throw Error(`Migrations named ${nameDups.join(", ")} are non-unique.`)
    }
  }

  public async migrate() {
    await this.checkOrCreateSchema()
    await this.checkOrCreateTable()
    const unapplied = await this.getUnappliedMigrations()
    for (const migration of unapplied) {
      await new Promise((resolve, reject) => {
        this.pgp.tx(async (tx) => {
          try {
            await migration.up(tx)
            await this.registerMigration(tx, migration.name)
            await tx
            resolve()
          } catch (err) {
            reject()
          }
        })
      })
    }
  }

  // public async revertTo(migrationName) {} // Down migrations

  protected async checkOrCreateTable() {
    await this.pgp.none(`
      DO $$
        BEGIN
          IF NOT EXISTS(
            SELECT table_name
              FROM information_schema.tables
              WHERE schema_name = $1
              AND table_name = $2
          )
          THEN
            EXECUTE 'CREATE TABLE $1.$2(
              id serial primary key,
              name TEXT,
            )';
          ENDIF;
        END
      $$;
    `, [this.schemaName, this.tableName])
  }

  protected async checkOrCreateSchema() {
    await this.pgp.none(`
      DO $$
        BEGIN
          IF NOT EXISTS(
            SELECT schema_name
              FROM information_schema.schemata
              WHERE schema_name = $1
          )
          THEN
            EXECUTE 'CREATE SCHEMA $1';
          END IF;
        END
      $$;
    `, [this.schemaName])
  }

  protected async registerMigration(pgp: ITask<any>, migrationName: string) {
    await pgp.none(`
      INSERT INTO $1.$2 (name) VALUE $3;
    `, [this.schemaName, this.tableName, migrationName])
  }

  protected async getUnappliedMigrations(): Promise<Migration[]> {
    const migrationHistory = await this.getMigrationHistory()
    await this.validateMigrationHistory(migrationHistory)
    return this.migrations.slice(migrationHistory.length)
  }

  protected async getMigrationHistory(): Promise<any[]> {
    return await this.pgp.manyOrNone(`
      SELECT name FROM $1.$2;
    `, [this.schemaName, this.tableName])
  }

  protected async validateMigrationHistory(migrationHistory: any[]) {
    // Make sure that the migrations in this.migrations match to the migration history
    if (migrationHistory.length > this.migrations.length) {
      // tslint:disable-next-line
      throw new Error("The migration history is longer than the migrations passed in. Check to make sure migrations have not been deleted.")
    }

    for (let i = 0; i < migrationHistory.length; i++) {
      if (migrationHistory[i].name !== this.migrations[i].name) {
        // tslint:disable-next-line
        throw new Error("Mismatched migrations. Make sure migrations are in the same order that they have been previously run.")
      }
    }
  }

  private findDups(arr: any[]) {
    return arr.reduce((acc: any, el: any, i: number) => {
      if (arr.indexOf(el) !== i && acc.indexOf(el) < 0) {
        acc.push(el)
      }
      return acc
    }, [])
  }
}
