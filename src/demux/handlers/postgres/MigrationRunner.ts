import {IDatabase, ITask} from "pg-promise"
import Migration from "./Migration"

class MigrationRunner {
  constructor(
    protected pgp: IDatabase<any>,
    protected migrations: Migration[],
    protected tableName: string = "_migrations",
    protected schemaName: string = "public",
  ) {
    const migrationNames = Object.keys(migrations).map((f) => elements[f].name)
    const nameDups = this.findDups(migrationNames)
    if (nameDups.length > 0) {
      throw Error(`Migrations named ${nameDups.join(", ")} are non-unique.`)
    }
  }

  public async migrate() {
    await this.checkOrCreateSchema()
    await this.checkOrCreateTable()
    const unapplied = this.getUnappliedMigrations()
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

  public async revertTo(migrationName) {} // Down migrations

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

  protected registerMigration(pgp: ITask<any>, migrationName: string) {}

  protected async getUnappliedMigrations() {
    const migrationHistory = await this.getMigrationHistory()
    await this.validateMigrationHistory(migrationHistory)
    return this.migrations.slice(migrationHistory.length)
  }

  protected getMigrationHistory() {}

  protected async validateMigrationHistory(migrationHistory: any[]) {
    // Make sure that the migrations in this.migrations match to the migration history
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
