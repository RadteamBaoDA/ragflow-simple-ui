import React from 'react'
import { render } from '@testing-library/react'
import { vi } from 'vitest'

const startSpy = vi.fn()
const doneSpy = vi.fn()

vi.mock('nprogress', () => ({
  default: {
    configure: vi.fn(),
    start: (...args: any[]) => startSpy(...args),
    done: (...args: any[]) => doneSpy(...args),
  },
  configure: vi.fn(),
  start: (...args: any[]) => startSpy(...args),
  done: (...args: any[]) => doneSpy(...args),
}))

// Mock react-router-dom useLocation
let mockedPath = '/'
vi.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: mockedPath }) }))

import { RouteProgressBar } from '../../src/components/RouteProgressBar'

describe('RouteProgressBar', () => {
  beforeEach(() => {
    startSpy.mockReset()
    doneSpy.mockReset()
  })

  it('starts and finishes progress on new location', () => {
    mockedPath = '/a'
    const { rerender } = render(<RouteProgressBar />)
    // initial render starts progress and schedules done
    expect(startSpy).toHaveBeenCalled()

    // simulate navigation to same path (should not start again)
    mockedPath = '/a'
    rerender(<RouteProgressBar />)
    expect(startSpy).toHaveBeenCalledTimes(1)

    // simulate nav to new path
    mockedPath = '/b'
    rerender(<RouteProgressBar />)
    expect(startSpy).toHaveBeenCalledTimes(2)
  })
})
