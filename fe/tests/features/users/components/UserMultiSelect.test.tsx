import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import UserMultiSelect from '../../../../src/features/users/components/UserMultiSelect'
import type { User } from '@/features/auth'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

vi.mock('lucide-react', () => {
  const mockIcon = ({ size }: any) => <span data-testid="icon">{size}</span>
  return {
    Check: mockIcon,
    ChevronsUpDown: mockIcon,
    X: mockIcon
  }
})

vi.mock('@headlessui/react', () => ({
  Combobox: ({ children, value }: any) => {
    const Component = ({ children }: any) => <div data-testid="combobox" data-value={JSON.stringify(value)}>{children}</div>
    Component.Input = ({ value, onChange, placeholder }: any) => (
      <input data-testid="combobox-input" value={value} onChange={onChange} placeholder={placeholder} />
    )
    Component.Button = ({ children }: any) => <button data-testid="combobox-button">{children}</button>
    Component.Options = ({ children }: any) => <div data-testid="combobox-options">{children}</div>
    Component.Option = ({ children }: any) => (
      <div data-testid="combobox-option">{children}</div>
    )
    
    if (typeof children === 'function') {
      return <Component>{children({ active: false, open: false })}</Component>
    }
    return <Component>{children}</Component>
  },
  Transition: ({ children }: any) => <div>{typeof children === 'function' ? children() : children}</div>
}))

const mockUsers: User[] = [
  { id: '1', displayName: 'Alice', email: 'alice@test.com', role: 'user' },
  { id: '2', displayName: 'Bob', email: 'bob@test.com', role: 'leader' },
  { id: '3', displayName: 'Charlie', email: 'charlie@test.com', role: 'admin' }
]

describe('UserMultiSelect', () => {
  it('renders without crashing', () => {
    render(
      <UserMultiSelect
        users={mockUsers}
        selectedUserIds={[]}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByTestId('combobox')).toBeTruthy()
  })

  it('displays selected users', () => {
    render(
      <UserMultiSelect
        users={mockUsers}
        selectedUserIds={['1', '2']}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('Alice')).toBeTruthy()
    expect(screen.getByText('Bob')).toBeTruthy()
  })

  it('renders placeholder when provided', () => {
    render(
      <UserMultiSelect
        users={mockUsers}
        selectedUserIds={[]}
        onChange={vi.fn()}
        placeholder="Select users"
      />
    )
    expect(screen.getByPlaceholderText('Select users')).toBeTruthy()
  })
})
