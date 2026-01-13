import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DocumentStorageController } from '@/controllers/document-storage.controller.js'
import { documentStorageService } from '@/services/document-storage.service.js'
import { log } from '@/services/logger.service.js'

const makeReq = (overrides: any = {}) => ({ params: {}, query: {}, body: {}, file: undefined, files: undefined, user: { id: 'u1' }, headers: {}, socket: { remoteAddress: '1.2.3.4' }, ...overrides }) as any
const makeRes = () => {
  const json = vi.fn()
  const status = vi.fn(() => ({ json, send: vi.fn() }))
  const send = vi.fn()
  return { status: vi.fn(() => ({ json, send })), json, send, _status: status } as any
}

describe('DocumentStorageController', () => {
  let c: DocumentStorageController

  beforeEach(() => {
    c = new DocumentStorageController()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('listFiles returns 400 when bucketId is missing', async () => {
    const req = makeReq()
    const res = makeRes()
    await c.listFiles(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Bucket ID is required' })
  })

  it('listFiles returns objects on success', async () => {
    const req = makeReq({ params: { bucketId: 'b1' }, query: { prefix: 'p' } })
    const res = makeRes()
    vi.spyOn(documentStorageService, 'listFiles').mockResolvedValue([{ name: 'f' } as any])
    await c.listFiles(req, res)
    expect(res.json).toHaveBeenCalledWith({ objects: [{ name: 'f' }] })
  })

  it('listFiles handles access denied', async () => {
    const req = makeReq({ params: { bucketId: 'b' } })
    const res = makeRes()
    vi.spyOn(documentStorageService, 'listFiles').mockRejectedValue(new Error('Access Denied'))
    await c.listFiles(req, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'Access Denied' })
  })

  it('uploadFile returns 400 when bucketId missing', async () => {
    const req = makeReq()
    const res = makeRes()
    await c.uploadFile(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('uploadFile returns 400 when no files', async () => {
    const req = makeReq({ params: { bucketId: 'b' } })
    const res = makeRes()
    await c.uploadFile(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('uploadFile returns 201 on success', async () => {
    const req = makeReq({ params: { bucketId: 'b' }, files: [{ originalname: 'f' }] })
    const res = makeRes()
    vi.spyOn(documentStorageService, 'uploadFile').mockResolvedValue({ results: [] } as any)
    await c.uploadFile(req, res)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ results: [] })
  })

  it('uploadFile accepts single file via req.file and includes prefix from query', async () => {
    const req = makeReq({ params: { bucketId: 'b' }, file: { originalname: 'f2' }, query: { prefix: 'qq' } })
    const res = makeRes()
    const spy = vi.spyOn(documentStorageService, 'uploadFile').mockResolvedValue({ results: [] } as any)
    await c.uploadFile(req, res)
    expect(spy).toHaveBeenCalledWith(req.user, 'b', undefined, expect.objectContaining({ prefix: 'qq' }), '1.2.3.4')
  })

  it('deleteObject passes isFolder flag and returns 204 on success', async () => {
    const req = makeReq({ params: { bucketId: 'b' }, body: { path: 'p', isFolder: true } })
    const res = makeRes()
    const spy = vi.spyOn(documentStorageService, 'deleteObject').mockResolvedValue(undefined)
    await c.deleteObject(req, res)
    expect(spy).toHaveBeenCalledWith(req.user, 'b', 'p', true, '1.2.3.4')
    expect(res.status).toHaveBeenCalledWith(204)
  })

  it('getDownloadUrl uses params[0] when present and passes preview flag', async () => {
    const req = makeReq({ params: { bucketId: 'b', 0: 'o' }, query: { preview: 'true' } })
    const res = makeRes()
    const spy = vi.spyOn(documentStorageService, 'getDownloadUrl').mockResolvedValue('https://preview')
    await c.getDownloadUrl(req, res)
    expect(spy).toHaveBeenCalledWith(req.user, 'b', 'o', true, '1.2.3.4')
    expect(res.json).toHaveBeenCalledWith({ download_url: 'https://preview' })
  })

  it('createFolder validates input and creates', async () => {
    const reqBad = makeReq({ params: {}, body: {} })
    const resBad = makeRes()
    await c.createFolder(reqBad, resBad)
    expect(resBad.status).toHaveBeenCalledWith(400)

    const req = makeReq({ params: { bucketId: 'b' }, body: { folderName: 'f' } })
    const res = makeRes()
    vi.spyOn(documentStorageService, 'createFolder').mockResolvedValue(undefined)
    await c.createFolder(req, res)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ message: 'Folder created' })
  })

  it('deleteObject validates and deletes', async () => {
    const reqBad = makeReq({ params: {}, body: {} })
    const resBad = makeRes()
    await c.deleteObject(reqBad, resBad)
    expect(resBad.status).toHaveBeenCalledWith(400)

    const req = makeReq({ params: { bucketId: 'b' }, body: { path: 'p' } })
    const res = makeRes()
    vi.spyOn(documentStorageService, 'deleteObject').mockResolvedValue(undefined)
    await c.deleteObject(req, res)
    expect(res.status).toHaveBeenCalledWith(204)
  })

  it('batchDelete validates and calls service', async () => {
    const reqBad = makeReq({ params: {}, body: {} })
    const resBad = makeRes()
    await c.batchDelete(reqBad, resBad)
    expect(resBad.status).toHaveBeenCalledWith(400)

    const req = makeReq({ params: { bucketId: 'b' }, body: { items: ['a'] } })
    const res = makeRes()
    vi.spyOn(documentStorageService, 'batchDelete').mockResolvedValue(undefined)
    await c.batchDelete(req, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ message: 'Batch delete completed' })
  })

  it('getDownloadUrl validates and returns url', async () => {
    const reqBad = makeReq({ params: {} })
    const resBad = makeRes()
    await c.getDownloadUrl(reqBad, resBad)
    expect(resBad.status).toHaveBeenCalledWith(400)

    const req = makeReq({ params: { bucketId: 'b', objectPath: 'o' } })
    const res = makeRes()
    vi.spyOn(documentStorageService, 'getDownloadUrl').mockResolvedValue('https://x')
    await c.getDownloadUrl(req, res)
    expect(res.json).toHaveBeenCalledWith({ download_url: 'https://x' })
  })

  it('downloadFile returns 404', async () => {
    const req = makeReq()
    const res = makeRes()
    await c.downloadFile(req, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: "Use getDownloadUrl" })
  })

  it('checkFilesExistence validates and returns results', async () => {
    const reqBad = makeReq({ params: {}, body: {} })
    const resBad = makeRes()
    await c.checkFilesExistence(reqBad, resBad)
    expect(resBad.status).toHaveBeenCalledWith(400)

    const req = makeReq({ params: { bucketId: 'b' }, body: { files: ['a'] } })
    const res = makeRes()
    vi.spyOn(documentStorageService, 'checkFilesExistence').mockResolvedValue({ a: true } as any)
    await c.checkFilesExistence(req, res)
    expect(res.json).toHaveBeenCalledWith({ a: true })
  })

  // Error branches
  it('listFiles returns 404 when bucket not found and 500 for other errors', async () => {
    const req = makeReq({ params: { bucketId: 'b' } })
    const res404 = makeRes()
    vi.spyOn(documentStorageService, 'listFiles').mockRejectedValueOnce(new Error('Bucket not found'))
    await c.listFiles(req, res404)
    expect(res404.status).toHaveBeenCalledWith(404)
    expect(res404.json).toHaveBeenCalledWith({ error: 'Bucket not found' })

    const res500 = makeRes()
    const spy = vi.spyOn(log, 'error')
    vi.spyOn(documentStorageService, 'listFiles').mockRejectedValueOnce(new Error('boom'))
    await c.listFiles(req, res500)
    expect(res500.status).toHaveBeenCalledWith(500)
    expect(spy).toHaveBeenCalledWith('Failed to list files', { error: 'boom' })
  })

  it('uploadFile handles Access Denied and Bucket not found and generic error', async () => {
    const req = makeReq({ params: { bucketId: 'b' }, files: [{ originalname: 'f' }] })
    const res403 = makeRes()
    vi.spyOn(documentStorageService, 'uploadFile').mockRejectedValueOnce(new Error('Access Denied'))
    await c.uploadFile(req, res403)
    expect(res403.status).toHaveBeenCalledWith(403)
    expect(res403.json).toHaveBeenCalledWith({ error: 'Access Denied' })

    const res404 = makeRes()
    vi.spyOn(documentStorageService, 'uploadFile').mockRejectedValueOnce(new Error('Bucket not found'))
    await c.uploadFile(req, res404)
    expect(res404.status).toHaveBeenCalledWith(404)
    expect(res404.json).toHaveBeenCalledWith({ error: 'Bucket not found' })

    const res500 = makeRes()
    const spy = vi.spyOn(log, 'error')
    vi.spyOn(documentStorageService, 'uploadFile').mockRejectedValueOnce(new Error('oops'))
    await c.uploadFile(req, res500)
    expect(res500.status).toHaveBeenCalledWith(500)
    expect(spy).toHaveBeenCalledWith('Failed to upload file', { error: 'oops' })
  })

  it('createFolder handles Access Denied and Bucket not found', async () => {
    const req = makeReq({ params: { bucketId: 'b' }, body: { folderName: 'f' } })
    const res403 = makeRes()
    vi.spyOn(documentStorageService, 'createFolder').mockRejectedValueOnce(new Error('Access Denied'))
    await c.createFolder(req, res403)
    expect(res403.status).toHaveBeenCalledWith(403)

    const res404 = makeRes()
    vi.spyOn(documentStorageService, 'createFolder').mockRejectedValueOnce(new Error('Bucket not found'))
    await c.createFolder(req, res404)
    expect(res404.status).toHaveBeenCalledWith(404)
  })

  it('deleteObject handles Access Denied and Bucket not found and generic error', async () => {
    const req = makeReq({ params: { bucketId: 'b' }, body: { path: 'p' } })
    const res403 = makeRes()
    vi.spyOn(documentStorageService, 'deleteObject').mockRejectedValueOnce(new Error('Access Denied'))
    await c.deleteObject(req, res403)
    expect(res403.status).toHaveBeenCalledWith(403)

    const res404 = makeRes()
    vi.spyOn(documentStorageService, 'deleteObject').mockRejectedValueOnce(new Error('Bucket not found'))
    await c.deleteObject(req, res404)
    expect(res404.status).toHaveBeenCalledWith(404)

    const res500 = makeRes()
    const spy = vi.spyOn(log, 'error')
    vi.spyOn(documentStorageService, 'deleteObject').mockRejectedValueOnce(new Error('bad'))
    await c.deleteObject(req, res500)
    expect(res500.status).toHaveBeenCalledWith(500)
    expect(spy).toHaveBeenCalledWith('Failed to delete object', { error: 'bad' })
  })

  it('batchDelete handles Access Denied', async () => {
    const req = makeReq({ params: { bucketId: 'b' }, body: { items: ['a'] } })
    const res403 = makeRes()
    vi.spyOn(documentStorageService, 'batchDelete').mockRejectedValueOnce(new Error('Access Denied'))
    await c.batchDelete(req, res403)
    expect(res403.status).toHaveBeenCalledWith(403)
  })

  it('getDownloadUrl handles Access Denied and Bucket not found', async () => {
    const req = makeReq({ params: { bucketId: 'b', objectPath: 'o' } })
    const res403 = makeRes()
    vi.spyOn(documentStorageService, 'getDownloadUrl').mockRejectedValueOnce(new Error('Access Denied'))
    await c.getDownloadUrl(req, res403)
    expect(res403.status).toHaveBeenCalledWith(403)

    const res404 = makeRes()
    vi.spyOn(documentStorageService, 'getDownloadUrl').mockRejectedValueOnce(new Error('Bucket not found'))
    await c.getDownloadUrl(req, res404)
    expect(res404.status).toHaveBeenCalledWith(404)
  })

  it('checkFilesExistence handles errors and returns 500 on generic failures', async () => {
    const req = makeReq({ params: { bucketId: 'b' }, body: { files: ['a'] } })
    const res500 = makeRes()
    const spy = vi.spyOn(log, 'error')
    vi.spyOn(documentStorageService, 'checkFilesExistence').mockRejectedValueOnce(new Error('boom'))
    await c.checkFilesExistence(req, res500)
    expect(res500.status).toHaveBeenCalledWith(500)
    expect(spy).toHaveBeenCalledWith('Failed to check file existence', { error: 'boom' })
  })
})
