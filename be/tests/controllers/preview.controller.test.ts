/**
 * @fileoverview Tests for PreviewController.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PreviewController } from '../../src/controllers/preview.controller.js'

const mockService = vi.hoisted(() => ({
  generatePreview: vi.fn(),
}))

const mockLog = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock('../../src/services/preview.service.js', () => ({
  previewService: mockService,
}))

vi.mock('../../src/services/logger.service.js', () => ({
  log: mockLog,
}))

const makeRes = () => {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.sendFile = vi.fn(() => res)
  return res
}

describe('PreviewController', () => {
  const controller = new PreviewController()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getPreview validates missing params', async () => {
    const res = makeRes()

    await controller.getPreview({ params: {} } as any, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('getPreview generates and sends file', async () => {
    const res = makeRes()
    mockService.generatePreview.mockResolvedValueOnce('/path/to/preview.png')

    await controller.getPreview({ params: { bucketName: 'docs', fileName: 'file.pdf' } } as any, res)

    expect(mockService.generatePreview).toHaveBeenCalledWith('docs', 'file.pdf')
    expect(res.sendFile).toHaveBeenCalledWith('/path/to/preview.png')
  })

  it('getPreview handles errors', async () => {
    const res = makeRes()
    mockService.generatePreview.mockRejectedValueOnce(new Error('fail'))

    await controller.getPreview({ params: { bucketName: 'docs', fileName: 'file.pdf' } } as any, res)

    expect(mockLog.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })
})
