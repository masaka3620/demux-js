import AbstractActionHandler from "./AbstractActionHandler"
import MassiveActionHandler from "./postgres/MassiveActionHandler"
import Migration from "./postgres/Migration"
import MigrationRunner from "./postgres/MigrationRunner"

module.exports = {
  AbstractActionHandler,
  postgres: {
    MassiveActionHandler,
    Migration,
    MigrationRunner,
  },
}
