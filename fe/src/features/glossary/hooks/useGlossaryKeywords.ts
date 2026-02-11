/**
 * Custom hook for glossary keyword management.
 * Handles fetching, CRUD operations, filtering, and form state.
 * Keywords are standalone entities (not linked to tasks).
 * @module features/glossary/hooks/useGlossaryKeywords
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Form } from 'antd'
import { useTranslation } from 'react-i18next'
import { glossaryApi, type GlossaryKeyword, type CreateKeywordDto } from '../api/glossaryApi'
import { globalMessage } from '@/app/App'

// ============================================================================
// Return type
// ============================================================================

/** Return type for the useGlossaryKeywords hook. */
export interface UseGlossaryKeywordsReturn {
    /** Filtered list of keywords matching the current search. */
    filteredKeywords: GlossaryKeyword[]
    /** Whether data is being loaded. */
    loading: boolean
    /** Current search text. */
    search: string
    /** Set the search text. */
    setSearch: (value: string) => void
    /** Whether the create/edit modal is open. */
    isModalOpen: boolean
    /** The keyword being edited (null for create). */
    editingKeyword: GlossaryKeyword | null
    /** Whether a form submission is in progress. */
    submitting: boolean
    /** Ant Design form instance. */
    form: ReturnType<typeof Form.useForm>[0]
    /** Open the modal for creating or editing a keyword. */
    openModal: (keyword?: GlossaryKeyword) => void
    /** Close the modal. */
    closeModal: () => void
    /** Handle form submission (create or update). */
    handleSubmit: (values: CreateKeywordDto) => Promise<void>
    /** Handle keyword deletion with confirmation. */
    handleDelete: (keyword: GlossaryKeyword) => void
    /** Refresh the keyword list. */
    refresh: () => void
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing glossary keywords.
 * @param enabled - Whether to fetch keywords (set false to defer)
 * @returns Object with keyword state and handlers
 */
export function useGlossaryKeywords(enabled = true): UseGlossaryKeywordsReturn {
    const { t } = useTranslation()
    const [form] = Form.useForm()

    // State
    const [keywords, setKeywords] = useState<GlossaryKeyword[]>([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingKeyword, setEditingKeyword] = useState<GlossaryKeyword | null>(null)
    const [submitting, setSubmitting] = useState(false)

    // ========================================================================
    // Data Fetching
    // ========================================================================

    /** Fetch all keywords. */
    const fetchKeywords = useCallback(async () => {
        setLoading(true)
        try {
            const data = await glossaryApi.listKeywords()
            setKeywords(data)
        } catch (error) {
            console.error('Error fetching keywords:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    // Fetch on mount / when enabled changes
    useEffect(() => {
        if (enabled) fetchKeywords()
    }, [enabled, fetchKeywords])

    // ========================================================================
    // Filtering
    // ========================================================================

    /** Filter keywords by search text (matches name, en_keyword, description). */
    const filteredKeywords = useMemo(() => {
        if (!search.trim()) return keywords

        const query = search.toLowerCase()
        return keywords.filter((kw) =>
            kw.name.toLowerCase().includes(query) ||
            kw.en_keyword?.toLowerCase().includes(query) ||
            kw.description?.toLowerCase().includes(query)
        )
    }, [keywords, search])

    // ========================================================================
    // Modal Handlers
    // ========================================================================

    /**
     * Open the create/edit modal.
     * @param keyword - If provided, opens in edit mode.
     */
    const openModal = useCallback((keyword?: GlossaryKeyword) => {
        if (keyword) {
            setEditingKeyword(keyword)
            form.setFieldsValue({
                name: keyword.name,
                en_keyword: keyword.en_keyword || '',
                description: keyword.description || '',
                sort_order: keyword.sort_order,
                is_active: keyword.is_active,
            })
        } else {
            setEditingKeyword(null)
            form.setFieldsValue({
                name: '',
                en_keyword: '',
                description: '',
                sort_order: 0,
                is_active: true,
            })
        }
        setIsModalOpen(true)
    }, [form])

    /** Close the modal and reset form. */
    const closeModal = useCallback(() => {
        setIsModalOpen(false)
        setEditingKeyword(null)
        form.resetFields()
    }, [form])

    // ========================================================================
    // CRUD Handlers
    // ========================================================================

    /**
     * Handle form submission — create or update.
     * @param values - Form values from Ant Design form
     */
    const handleSubmit = useCallback(async (values: CreateKeywordDto) => {
        setSubmitting(true)
        try {
            if (editingKeyword) {
                // Update existing keyword
                await glossaryApi.updateKeyword(editingKeyword.id, values)
                globalMessage.success(t('glossary.keyword.updateSuccess'))
            } else {
                // Create new keyword
                await glossaryApi.createKeyword(values)
                globalMessage.success(t('glossary.keyword.createSuccess'))
            }
            closeModal()
            await fetchKeywords()
        } catch (error: any) {
            globalMessage.error(error?.message || t('common.error'))
        } finally {
            setSubmitting(false)
        }
    }, [editingKeyword, closeModal, fetchKeywords, t])

    /**
     * Handle keyword deletion with confirmation dialog.
     * @param keyword - The keyword to delete
     */
    const handleDelete = useCallback((keyword: GlossaryKeyword) => {
        if (!confirm(t('glossary.keyword.deleteConfirm', { name: keyword.name }))) return

        glossaryApi.deleteKeyword(keyword.id)
            .then(() => {
                globalMessage.success(t('glossary.keyword.deleteSuccess'))
                fetchKeywords()
            })
            .catch((error: any) => {
                globalMessage.error(error?.message || t('common.error'))
            })
    }, [fetchKeywords, t])

    // ========================================================================
    // Return
    // ========================================================================

    return {
        filteredKeywords,
        loading,
        search,
        setSearch,
        isModalOpen,
        editingKeyword,
        submitting,
        form,
        openModal,
        closeModal,
        handleSubmit,
        handleDelete,
        refresh: fetchKeywords,
    }
}
