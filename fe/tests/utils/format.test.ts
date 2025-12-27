import { describe, it, expect } from 'vitest'
import { formatFileSize } from '@/utils/format'

describe('formatFileSize', () => {
  it('should format zero bytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
  })

  it('should format bytes', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(1023)).toBe('1023 B')
  })

  it('should format kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1 KiB')
    expect(formatFileSize(1536)).toBe('1.5 KiB')
    expect(formatFileSize(2048)).toBe('2 KiB')
  })

  it('should format megabytes', () => {
    expect(formatFileSize(1048576)).toBe('1 MiB')
    expect(formatFileSize(1572864)).toBe('1.5 MiB')
    expect(formatFileSize(5242880)).toBe('5 MiB')
  })

  it('should format gigabytes', () => {
    expect(formatFileSize(1073741824)).toBe('1 GiB')
    expect(formatFileSize(1610612736)).toBe('1.5 GiB')
    expect(formatFileSize(10737418240)).toBe('10 GiB')
  })

  it('should format terabytes', () => {
    expect(formatFileSize(1099511627776)).toBe('1 TiB')
    expect(formatFileSize(1649267441664)).toBe('1.5 TiB')
  })

  it('should format petabytes', () => {
    expect(formatFileSize(1125899906842624)).toBe('1 PiB')
  })

  it('should format exabytes', () => {
    expect(formatFileSize(1152921504606846976)).toBe('1 EiB')
  })

  it('should format zettabytes', () => {
    expect(formatFileSize(1180591620717411303424)).toBe('1 ZiB')
  })

  it('should format yottabytes', () => {
    expect(formatFileSize(1208925819614629174706176)).toBe('1 YiB')
  })

  it('should respect decimal places parameter', () => {
    expect(formatFileSize(1024, 0)).toBe('1 KiB')
    expect(formatFileSize(1536, 1)).toBe('1.5 KiB')
    expect(formatFileSize(1536, 2)).toBe('1.5 KiB')
    expect(formatFileSize(1536, 3)).toBe('1.5 KiB')
  })

  it('should clamp decimal places to zero for negative values', () => {
    expect(formatFileSize(1536, -1)).toBe('2 KiB')
    expect(formatFileSize(1536, -5)).toBe('2 KiB')
  })

  it('should use default decimal places of 1', () => {
    expect(formatFileSize(1536)).toBe('1.5 KiB')
    expect(formatFileSize(5368709)).toBe('5.1 MiB')
  })

  it('should handle large numbers correctly', () => {
    expect(formatFileSize(Number.MAX_SAFE_INTEGER)).toBeDefined()
    const result = formatFileSize(Number.MAX_SAFE_INTEGER)
    expect(result).toMatch(/PiB|EiB/)
  })

  it('should preserve precision in calculations', () => {
    expect(formatFileSize(1048576 + 524288)).toBe('1.5 MiB')
    expect(formatFileSize(1024 * 1024 * 1024 + 536870912)).toBe('1.5 GiB')
  })

  it('should format specific common file sizes correctly', () => {
    expect(formatFileSize(524288)).toBe('512 KiB')
    expect(formatFileSize(10485760)).toBe('10 MiB')
    expect(formatFileSize(104857600)).toBe('100 MiB')
    expect(formatFileSize(1073741824)).toBe('1 GiB')
  })

  it('should handle edge cases between units', () => {
    expect(formatFileSize(1023)).toBe('1023 B')
    expect(formatFileSize(1024)).toBe('1 KiB')
    expect(formatFileSize(1024 * 1024 - 1)).toBe('1024 KiB')
    expect(formatFileSize(1024 * 1024)).toBe('1 MiB')
  })

  it('should format with 0 decimal places for round numbers', () => {
    const result1 = formatFileSize(1048576, 0)
    const result2 = formatFileSize(2097152, 0)
    expect(result1).toBe('1 MiB')
    expect(result2).toBe('2 MiB')
  })

  it('should format fractional sizes with high precision', () => {
    expect(formatFileSize(1572864, 2)).toBe('1.5 MiB')
    expect(formatFileSize(1572864, 3)).toBe('1.5 MiB')
  })
})
