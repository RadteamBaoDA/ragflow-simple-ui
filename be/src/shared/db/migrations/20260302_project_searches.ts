import type { Knex } from "knex";

/**
 * @description Migration for project search apps.
 * Creates table: project_searches (AI Search apps linked to projects).
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable("project_searches"))) {
    await knex.schema.createTable("project_searches", (table) => {
      table.text("id").primary().defaultTo(knex.raw("gen_random_uuid()::TEXT"));
      table.text("project_id").notNullable();
      table.text("name").notNullable();
      table.text("description");
      table.text("ragflow_search_id");
      table.jsonb("dataset_ids").defaultTo("[]");
      table.jsonb("ragflow_dataset_ids").defaultTo("[]");
      table.jsonb("search_config").defaultTo("{}");
      table.text("status").defaultTo("active");
      table.timestamp("last_synced_at", { useTz: true });
      table.text("created_by");
      table.text("updated_by");
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

      table.foreign("project_id").references("projects.id").onDelete("CASCADE");
      table.index("project_id");
      table.index("ragflow_search_id");
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("project_searches");
}
