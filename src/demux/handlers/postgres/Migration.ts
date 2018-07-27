import * as path from "path"
import { ITask, QueryFile } from "pg-promise"

export default class Migration {
  public upQueryFile: QueryFile
  protected downQueryFile: QueryFile | null = null
  constructor(
    public name: string,
    protected schema: string,
    protected upSqlPath: string,
    protected downSqlPath: string | null = null,
    protected migrationFolderPath: string | null = null,
  ) {
    this.upQueryFile = this.loadQueryFile(upSqlPath)
    if (downSqlPath) {
      this.downQueryFile = this.loadQueryFile(downSqlPath)
    }
  }

  public async up(pgp: ITask<any>) {
    console.log("uQF", this.upQueryFile)
    await pgp.none(this.upQueryFile)
    console.log("SUCCESS!!")
  }

  public async down(pgp: ITask<any>) {
    if (!this.downQueryFile) {
      throw Error("This migration has no down query!")
    }
    await pgp.none(this.downQueryFile)
  }

  private loadQueryFile(file: string) {
    let fullPath: string
    if (this.migrationFolderPath) {
      fullPath = path.join(this.migrationFolderPath, file)
    } else {
      fullPath = path.join(__dirname, file)
    }
    const options = {
      // minify: true,
      params: {
        schema: this.schema,
      },
    }
    const qf = new QueryFile(fullPath, options)
    if (qf.error) {
      throw qf.error
    }
    return qf
  }
}
