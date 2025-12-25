/**
 * React 19 / antd 6 JSX compatibility type declarations.
 * 
 * This file resolves type incompatibilities between React 19's updated
 * JSX types and libraries that haven't fully updated their type definitions.
 * 
 * @see https://github.com/ant-design/ant-design/issues/51579
 */

// Override the JSX namespace to allow React 18 style components
declare namespace React {
    interface Component<P = object, S = object> {
        render(): React.ReactNode
    }
}

// Fix for "X cannot be used as a JSX component" errors
declare module 'antd' {
    import * as React from 'react'

    export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
        children?: React.ReactNode
        className?: string
        styles?: { body?: React.CSSProperties }
        title?: React.ReactNode
        [key: string]: unknown
    }

    export const Card: React.FC<CardProps> & {
        Meta: React.FC<{ title?: React.ReactNode; description?: React.ReactNode }>
    }

    export interface RowProps extends React.HTMLAttributes<HTMLDivElement> {
        children?: React.ReactNode
        gutter?: number | [number, number]
        [key: string]: unknown
    }

    export const Row: React.FC<RowProps>

    export interface ColProps extends React.HTMLAttributes<HTMLDivElement> {
        children?: React.ReactNode
        span?: number
        [key: string]: unknown
    }

    export const Col: React.FC<ColProps>
}

export { }
