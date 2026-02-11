/**
 * Barrel exports for the glossary feature module.
 * Exports only what is necessary for other features to consume.
 * @module features/glossary
 */
export { glossaryApi } from './api/glossaryApi'
export { PromptBuilderModal } from './components/PromptBuilderModal'
export type {
    GlossaryTask,
    GlossaryKeyword,
    CreateTaskDto,
    CreateKeywordDto,
    BulkImportRow,
    BulkImportResult,
} from './api/glossaryApi'
