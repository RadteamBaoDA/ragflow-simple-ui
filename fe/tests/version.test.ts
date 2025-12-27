import { it, expect } from 'vitest'
import React from 'react'
import ReactDOM from 'react-dom'

it('checks react version', () => {
  console.log('React version:', React.version)
  console.log('ReactDOM version:', (ReactDOM as any).version)
})
