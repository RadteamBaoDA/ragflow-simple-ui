import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (s: string) => s }) }))

const navigateMock = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }))

import ErrorPage from '../../src/components/ErrorPage'

describe('ErrorPage', () => {
  it.each([403, 404, 500, 503])('renders default content for %i', (code) => {
    render(<ErrorPage code={code as any} />)
    // default title keys from t(...) should be present
    const expectedKey = code === 403 ? 'errorPage.accessDenied' : code === 404 ? 'errorPage.pageNotFound' : code === 503 ? 'errorPage.serviceUnavailable' : 'errorPage.internalServerError'
    expect(screen.getByText(expectedKey)).toBeInTheDocument()
  })

  it('goBack and goHome buttons call navigate', () => {
    render(<ErrorPage code={404} />)
    const backBtn = screen.getByText('common.goBack')
    fireEvent.click(backBtn)
    expect(navigateMock).toHaveBeenCalledWith(-1)

    const homeBtn = screen.getByText('common.goHome')
    fireEvent.click(homeBtn)
    expect(navigateMock).toHaveBeenCalledWith('/')
  })
})
