import type { Knex } from "knex";

/**
 * @description Migration for per-entity permission management.
 * Creates table: project_entity_permissions.
 * Allows granular permission control per document category, chat, or search.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable("project_entity_permissions"))) {
    await knex.schema.createTable("project_entity_permissions", (table) => {
      table.text("id").primary().defaultTo(knex.raw("gen_random_uuid()::TEXT"));
      table.text("project_id").notNullable();
      table.text("entity_type").notNullable(); // 'category' | 'chat' | 'search'
      table.text("entity_id").notNullable();
      table.text("grantee_type").notNullable(); // 'user' | 'team'
      table.text("grantee_id").notNullable();
      table.text("permission_level").defaultTo("none"); // none | view | create | edit | delete
      table.text("created_by");
      table.text("updated_by");
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

      table.foreign("project_id").references("projects.id").onDelete("CASCADE");
      table.unique([
        "project_id",
        "entity_type",
        "entity_id",
        "grantee_type",
        "grantee_id",
      ]);
      table.index("project_id");
      table.index("entity_id");
      table.index("grantee_id");
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("project_entity_permissions");
}
