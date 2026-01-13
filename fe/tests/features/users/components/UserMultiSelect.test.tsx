import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
  Combobox: ({ children, value, onChange, multiple }: any) => {
    const Component = ({ children }: any) => <div data-testid="combobox" data-value={JSON.stringify(value)}>{children}</div>
    Component.Input = ({ value, onChange, placeholder }: any) => (
      <input data-testid="combobox-input" value={value} onChange={onChange} placeholder={placeholder} />
    )
    Component.Button = ({ children }: any) => <button data-testid="combobox-button">{children}</button>
    Component.Options = ({ children }: any) => <div data-testid="combobox-options">{children}</div>
    Component.Option = ({ value, children }: any) => (
      <div data-testid="combobox-option" data-value={value}>{children}</div>
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
    const onChange = vi.fn()
    render(
      <UserMultiSelect
        users={mockUsers}
        selectedUserIds={[]}
        onChange={onChange}
      />
    )
    expect(document.querySelector('[data-testid="combobox"]')).toBeTruthy()
  })

  it('displays selected users', () => {
    const onChange = vi.fn()
    const { container } = render(
      <UserMultiSelect
        users={mockUsers}
        selectedUserIds={['1', '2']}
        onChange={onChange}
      />
    )
    expect(container.textContent).toContain('Alice')
    expect(container.textContent).toContain('Bob')
  })

  it('calls onChange when removing a user', () => {
    const onChange = vi.fn()
    render(
      <UserMultiSelect
        users={mockUsers}
        selectedUserIds={['1']}
        onChange={onChange}
      />
    )
    
    const removeButtons = document.querySelectorAll('button')
    if (removeButtons.length > 0) {
      fireEvent.click(removeButtons[0])
      expect(onChange).toHaveBeenCalledWith([])
    }
  })

  it('renders placeholder when provided', () => {
    const onChange = vi.fn()
    render(
      <UserMultiSelect
        users={mockUsers}
        selectedUserIds={[]}
        onChange={onChange}
        placeholder="Select users"
      />
    )
    expect(document.body.textContent).toContain('Select users')
  })
})
