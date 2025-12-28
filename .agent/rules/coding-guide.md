---
trigger: always_on
---

# Coding guide for antigravity
## 1 Coding Standards & Guidelines
1. General
- terminal using is git bash(linux command). If change too much need run : npm run build 
- TypeScript strict mode
- Single quotes, no semicolons
- Use functional patterns where possible
- Add JSDoc headers to every function/class and provide step-by-step inline comments for all logic. 
- JSDoc: Include @param, @returns, and @description.
- Inline: Add a comment above every significant line of logic or control flow.

2. FE 
- when add new page must implement locales for new html string in en, vi, jp.
- Always check and add theme(dark and light) for new html control or new pages
- The "Public API" Rule (Barrel Files): Avoid "deep imports" that reach into the internals of another feature.
- Component Colocation: Keep files as close to their usage as possible.
- UI Layer: Uses ref as a prop directly.
- Feature Layer: Implements useActionState and useFormStatus.
- Service Layer: Optimized for the use hook and Server Actions.
- When create new feature must follow source code structure in source code folder structure to create
- Using ant design for implement UI control

3. BE
- Nodejs 22+ (ExpressJS)
- Implement Factory Pattern to design all data schemas and interfaces.
- Implement Singleton Pattern to design all global services and utils in be.
- If change or create impact to database, must create migration file in be/db/migrations.
- Always using knex orm to create new model file in be/src/models and not write raw sql query. If Knex ORM not support, you can use raw sql query.
- Complex SQL must using transaction on knex