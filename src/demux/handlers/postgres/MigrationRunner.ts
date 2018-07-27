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
      await this.pgp.tx(async (tx) => {
        try {
          await tx.none(migration.upQueryFile)
        } catch (err) {
          console.log("ERROR!!!", err)
        }
      })
    }
  }

  // public async revertTo(migrationName) {} // Down migrations

  protected async checkOrCreateTable() {
    await this.pgp.none(`
      CREATE TABLE IF NOT EXISTS $1:raw.$2:raw(
        id serial PRIMARY KEY,
        name TEXT
      );
    `, [this.schemaName, this.tableName])
  }

  protected async checkOrCreateSchema() {
    await this.pgp.none(`
      CREATE SCHEMA IF NOT EXISTS $1:raw;
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
      SELECT name FROM $1:raw.$2:raw;
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
