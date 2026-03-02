import type { Knex } from "knex";

/**
 * @description Add is_private column to projects table.
 * When true, only teams listed in project_permissions can access the project.
 * Default is false (public access).
 */
export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn("projects", "is_private");
  if (!hasColumn) {
    await knex.schema.alterTable("projects", (table) => {
      table.boolean("is_private").defaultTo(false);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn("projects", "is_private");
  if (hasColumn) {
    await knex.schema.alterTable("projects", (table) => {
      table.dropColumn("is_private");
    });
  }
}
