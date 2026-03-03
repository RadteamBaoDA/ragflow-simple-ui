import type { Knex } from "knex";

/**
 * @description Consolidated project management migration.
 *
 * Tables created (in dependency order):
 *  1.  ragflow_servers
 *  2.  projects                        (+ is_private column)
 *  3.  project_permissions
 *  4.  project_entity_permissions
 *  5.  document_categories
 *  6.  document_category_versions
 *  7.  project_chats
 *  8.  project_searches
 *  9.  document_category_version_files
 *  10. converter_version_jobs
 *
 * Originally split across:
 *   20260209_project_management.ts
 *   20260227_entity_permissions.ts
 *   20260302_project_private_access.ts
 *   20260302_project_searches.ts
 *   20260303_version_files.ts
 *   20260303_converter_jobs.ts
 */
export async function up(knex: Knex): Promise<void> {
  // --------------------------------------------------------------------------
  // 1. RAGFlow Servers — Admin-managed RAGFlow connections
  // --------------------------------------------------------------------------
  if (!(await knex.schema.hasTable("ragflow_servers"))) {
    await knex.schema.createTable("ragflow_servers", (table) => {
      table.text("id").primary().defaultTo(knex.raw("gen_random_uuid()::TEXT"));
      table.text("name").unique().notNullable();
      table.text("endpoint_url").notNullable();
      table.text("api_key").notNullable();
      table.text("description");
      table.boolean("is_active").defaultTo(true);
      table.jsonb("embedding_models").defaultTo("[]");
      table.jsonb("chat_models").defaultTo("[]");
      table.text("created_by");
      table.text("updated_by");
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
    });
  }

  // --------------------------------------------------------------------------
  // 2. Projects — Central project entity
  // --------------------------------------------------------------------------
  if (!(await knex.schema.hasTable("projects"))) {
    await knex.schema.createTable("projects", (table) => {
      table.text("id").primary().defaultTo(knex.raw("gen_random_uuid()::TEXT"));
      table.text("name").notNullable();
      table.text("description");
      table.text("avatar");
      table.text("ragflow_server_id");
      table.text("default_embedding_model");
      table.text("default_chunk_method").defaultTo("naive");
      table.jsonb("default_parser_config").defaultTo("{}");
      table.text("status").defaultTo("active");
      // is_private: when true only teams listed in project_permissions can access
      table.boolean("is_private").defaultTo(false);
      table.text("created_by");
      table.text("updated_by");
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

      table
        .foreign("ragflow_server_id")
        .references("ragflow_servers.id")
        .onDelete("SET NULL");
      table.index("ragflow_server_id");
      table.index("status");
    });
  } else {
    // Idempotent: add is_private if the table already exists without it
    if (!(await knex.schema.hasColumn("projects", "is_private"))) {
      await knex.schema.alterTable("projects", (table) => {
        table.boolean("is_private").defaultTo(false);
      });
    }
  }

  // --------------------------------------------------------------------------
  // 3. Project Permissions — Granular per-tab access
  // --------------------------------------------------------------------------
  if (!(await knex.schema.hasTable("project_permissions"))) {
    await knex.schema.createTable("project_permissions", (table) => {
      table.text("id").primary().defaultTo(knex.raw("gen_random_uuid()::TEXT"));
      table.text("project_id").notNullable();
      table.text("grantee_type").notNullable(); // 'user' | 'team'
      table.text("grantee_id").notNullable();
      table.text("tab_documents").defaultTo("none"); // none | view | manage
      table.text("tab_chat").defaultTo("none");
      table.text("tab_settings").defaultTo("none");
      table.text("created_by");
      table.text("updated_by");
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

      table.foreign("project_id").references("projects.id").onDelete("CASCADE");
      table.unique(["project_id", "grantee_type", "grantee_id"]);
      table.index("project_id");
      table.index("grantee_id");
    });
  }

  // --------------------------------------------------------------------------
  // 4. Project Entity Permissions — Granular per-entity (category/chat/search)
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // 5. Document Categories — Categories within a project
  // --------------------------------------------------------------------------
  if (!(await knex.schema.hasTable("document_categories"))) {
    await knex.schema.createTable("document_categories", (table) => {
      table.text("id").primary().defaultTo(knex.raw("gen_random_uuid()::TEXT"));
      table.text("project_id").notNullable();
      table.text("name").notNullable();
      table.text("description");
      table.integer("sort_order").defaultTo(0);
      table.jsonb("dataset_config").defaultTo("{}");
      table.text("created_by");
      table.text("updated_by");
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

      table.foreign("project_id").references("projects.id").onDelete("CASCADE");
      table.unique(["project_id", "name"]);
      table.index("project_id");
    });
  }

  // --------------------------------------------------------------------------
  // 6. Document Category Versions — Each version = 1 RAGFlow dataset
  // --------------------------------------------------------------------------
  if (!(await knex.schema.hasTable("document_category_versions"))) {
    await knex.schema.createTable("document_category_versions", (table) => {
      table.text("id").primary().defaultTo(knex.raw("gen_random_uuid()::TEXT"));
      table.text("category_id").notNullable();
      table.text("version_label").notNullable();
      table.text("ragflow_dataset_id");
      table.text("ragflow_dataset_name");
      table.text("status").defaultTo("active"); // active | archived
      table.timestamp("last_synced_at", { useTz: true });
      table.jsonb("metadata").defaultTo("{}");
      table.text("created_by");
      table.text("updated_by");
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

      table
        .foreign("category_id")
        .references("document_categories.id")
        .onDelete("CASCADE");
      table.unique(["category_id", "version_label"]);
      table.index("category_id");
      table.index("ragflow_dataset_id");
    });
  }

  // --------------------------------------------------------------------------
  // 7. Project Chats — Chat assistants linked to project
  // --------------------------------------------------------------------------
  if (!(await knex.schema.hasTable("project_chats"))) {
    await knex.schema.createTable("project_chats", (table) => {
      table.text("id").primary().defaultTo(knex.raw("gen_random_uuid()::TEXT"));
      table.text("project_id").notNullable();
      table.text("name").notNullable();
      table.text("ragflow_chat_id");
      table.jsonb("dataset_ids").defaultTo("[]");
      table.jsonb("ragflow_dataset_ids").defaultTo("[]");
      table.jsonb("llm_config").defaultTo("{}");
      table.jsonb("prompt_config").defaultTo("{}");
      table.text("status").defaultTo("active");
      table.timestamp("last_synced_at", { useTz: true });
      table.text("created_by");
      table.text("updated_by");
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

      table.foreign("project_id").references("projects.id").onDelete("CASCADE");
      table.index("project_id");
      table.index("ragflow_chat_id");
    });
  }

  // --------------------------------------------------------------------------
  // 8. Project Searches — AI Search apps linked to project
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // 9. Document Category Version Files — Durable per-file tracking (Redis → Postgres)
  //    One row per (version, file_name). ragflow_doc_id preserved for delete/parse.
  // --------------------------------------------------------------------------
  if (!(await knex.schema.hasTable("document_category_version_files"))) {
    await knex.schema.createTable(
      "document_category_version_files",
      (table) => {
        table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
        table
          .text("version_id")
          .notNullable()
          .references("id")
          .inTable("document_category_versions")
          .onDelete("CASCADE");
        table.string("file_name", 512).notNullable();
        table.string("ragflow_doc_id", 255).nullable();
        table.string("status", 50).notNullable().defaultTo("pending");
        table.text("error").nullable();
        table
          .timestamp("created_at", { useTz: true })
          .notNullable()
          .defaultTo(knex.fn.now());
        table
          .timestamp("updated_at", { useTz: true })
          .notNullable()
          .defaultTo(knex.fn.now());
        table.unique(["version_id", "file_name"]);
        table.index(["version_id"], "idx_version_files_version_id");
      },
    );
  }

  // --------------------------------------------------------------------------
  // 10. Converter Version Jobs — Durable history for finished/failed jobs
  //     Active (pending/converting) jobs live in Redis only.
  //     Written here once archiveJobToPostgres() is called.
  // --------------------------------------------------------------------------
  if (!(await knex.schema.hasTable("converter_version_jobs"))) {
    await knex.schema.createTable("converter_version_jobs", (table) => {
      table.uuid("id").primary();
      table.text("project_id").notNullable();
      table.text("category_id").notNullable();
      table
        .text("version_id")
        .notNullable()
        .references("id")
        .inTable("document_category_versions")
        .onDelete("CASCADE");
      table.text("server_id").notNullable();
      table.text("dataset_id").notNullable();
      table.string("status", 50).notNullable().defaultTo("finished");
      table.integer("file_count").notNullable().defaultTo(0);
      table.integer("finished_count").notNullable().defaultTo(0);
      table.integer("failed_count").notNullable().defaultTo(0);
      table
        .timestamp("job_created_at", { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());
      table
        .timestamp("job_updated_at", { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());
      table
        .timestamp("archived_at", { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());
      table.index(["project_id"], "idx_cvj_project_id");
      table.index(["category_id"], "idx_cvj_category_id");
      table.index(["version_id"], "idx_cvj_version_id");
      table.index(["status"], "idx_cvj_status");
      table.index(["archived_at"], "idx_cvj_archived_at");
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop in reverse dependency order
  await knex.schema.dropTableIfExists("converter_version_jobs");
  await knex.schema.dropTableIfExists("document_category_version_files");
  await knex.schema.dropTableIfExists("project_searches");
  await knex.schema.dropTableIfExists("project_chats");
  await knex.schema.dropTableIfExists("document_category_versions");
  await knex.schema.dropTableIfExists("document_categories");
  await knex.schema.dropTableIfExists("project_entity_permissions");
  await knex.schema.dropTableIfExists("project_permissions");
  await knex.schema.dropTableIfExists("projects");
  await knex.schema.dropTableIfExists("ragflow_servers");
}
