/**
 * @fileoverview Hook for glossary task state management and CRUD operations.
 * Encapsulates task list, search, modal state, and API interactions.
 * @module features/glossary/hooks/useGlossaryTasks
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Form } from 'antd'
import type { FormInstance } from 'antd'
import {
    glossaryApi,
    type GlossaryTask,
    type CreateTaskDto,
} from '../api/glossaryApi'
import { globalMessage } from '@/app/App'

/**
 * Return type for the useGlossaryTasks hook.
 * @description Exposes state values and handler functions for task management.
 */
export interface UseGlossaryTasksReturn {
    /** All fetched tasks (unfiltered). Shared with keyword tab for dropdown. */
    tasks: GlossaryTask[]
    /** Tasks filtered by search term. */
    filteredTasks: GlossaryTask[]
    /** Whether the task list is loading. */
    loading: boolean
    /** Current search input value. */
    search: string
    /** Update the search input value. */
    setSearch: (value: string) => void
    /** Whether the create/edit modal is open. */
    isModalOpen: boolean
    /** The task being edited, or null for create mode. */
    editingTask: GlossaryTask | null
    /** Whether the form is submitting. */
    submitting: boolean
    /** Ant Design form instance for the task modal. */
    form: FormInstance
    /** Open the modal for creating or editing a task. */
    openModal: (task?: GlossaryTask) => void
    /** Close the modal. */
    closeModal: () => void
    /** Handle form submission (create or update). */
    handleSubmit: (values: CreateTaskDto & { sort_order?: number; is_active?: boolean }) => Promise<void>
    /** Confirm and delete a task. */
    handleDelete: (task: GlossaryTask) => void
    /** Re-fetch the task list from the server. */
    refresh: () => void
}

/**
 * Custom hook for managing glossary tasks.
 * @description Handles fetching, searching, CRUD operations, and modal state.
 * @returns Task state and handler functions.
 */
export const useGlossaryTasks = (): UseGlossaryTasksReturn => {
    const { t } = useTranslation()

    // List state
    const [tasks, setTasks] = useState<GlossaryTask[]>([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingTask, setEditingTask] = useState<GlossaryTask | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [form] = Form.useForm()

    /**
     * Fetch all tasks from the API.
     * @description Called on mount and after any CRUD operation.
     */
    const fetchTasks = useCallback(async () => {
        setLoading(true)
        try {
            const data = await glossaryApi.listTasks()
            setTasks(data)
        } catch (error) {
            console.error('Error fetching tasks:', error)
            globalMessage.error(t('common.error'))
        } finally {
            setLoading(false)
        }
    }, [t])

    // Load tasks on mount
    useEffect(() => {
        fetchTasks()
    }, [fetchTasks])

    /** Filter tasks by search term (client-side). */
    const filteredTasks = tasks.filter((task) =>
        task.name.toLowerCase().includes(search.toLowerCase())
    )

    /**
     * Open task create/edit modal.
     * @param task - Task to edit, or undefined for create mode.
     */
    const openModal = (task?: GlossaryTask) => {
        setEditingTask(task || null)
        if (task) {
            form.setFieldsValue({
                name: task.name,
                description: task.description,
                task_instruction_en: task.task_instruction_en,
                task_instruction_ja: task.task_instruction_ja,
                task_instruction_vi: task.task_instruction_vi,
                context_template: task.context_template,
                sort_order: task.sort_order,
                is_active: task.is_active,
            })
        } else {
            form.resetFields()
            form.setFieldsValue({ is_active: true, sort_order: 0 })
        }
        setIsModalOpen(true)
    }

    /** Close the modal. */
    const closeModal = () => setIsModalOpen(false)

    /**
     * Handle task form submit (create or update).
     * @param values - Form values from Ant Design form.
     */
    const handleSubmit = async (values: CreateTaskDto & { sort_order?: number; is_active?: boolean }) => {
        setSubmitting(true)
        try {
            if (editingTask) {
                await glossaryApi.updateTask(editingTask.id, values)
                globalMessage.success(t('glossary.task.updateSuccess'))
            } else {
                await glossaryApi.createTask(values)
                globalMessage.success(t('glossary.task.createSuccess'))
            }
            setIsModalOpen(false)
            fetchTasks()
        } catch (error: any) {
            const msg = error?.response?.data?.error || error?.message || t('common.error')
            globalMessage.error(msg)
        } finally {
            setSubmitting(false)
        }
    }

    /**
     * Confirm and delete a task.
     * @param task - The task to delete.
     */
    const handleDelete = (task: GlossaryTask) => {
        Modal.confirm({
            title: t('glossary.task.confirmDelete'),
            content: t('glossary.task.confirmDeleteMessage', { name: task.name }),
            okText: t('common.delete'),
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await glossaryApi.deleteTask(task.id)
                    globalMessage.success(t('glossary.task.deleteSuccess'))
                    fetchTasks()
                } catch (error: any) {
                    globalMessage.error(error?.message || t('common.error'))
                }
            },
        })
    }

    return {
        tasks,
        filteredTasks,
        loading,
        search,
        setSearch,
        isModalOpen,
        editingTask,
        submitting,
        form,
        openModal,
        closeModal,
        handleSubmit,
        handleDelete,
        refresh: fetchTasks,
    }
}
