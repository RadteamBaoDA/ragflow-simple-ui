import { describe, it, expect } from 'vitest'
import { SUPPORTED_LANGUAGES } from '@/i18n'

describe('i18n configuration', () => {
  it('should export SUPPORTED_LANGUAGES array', () => {
    expect(Array.isArray(SUPPORTED_LANGUAGES)).toBe(true)
    expect(SUPPORTED_LANGUAGES.length).toBe(3)
  })

  it('should have English language with correct metadata', () => {
    const enLang = SUPPORTED_LANGUAGES.find(l => l.code === 'en')
    expect(enLang).toEqual({
      code: 'en',
      name: 'English',
      nativeName: 'English',
      flag: '🇺🇸'
    })
  })

  it('should have Vietnamese language with correct metadata', () => {
    const viLang = SUPPORTED_LANGUAGES.find(l => l.code === 'vi')
    expect(viLang).toEqual({
      code: 'vi',
      name: 'Vietnamese',
      nativeName: 'Tiếng Việt',
      flag: '🇻🇳'
    })
  })

  it('should have Japanese language with correct metadata', () => {
    const jaLang = SUPPORTED_LANGUAGES.find(l => l.code === 'ja')
    expect(jaLang).toEqual({
      code: 'ja',
      name: 'Japanese',
      nativeName: '日本語',
      flag: '🇯🇵'
    })
  })

  it('should include all required language fields', () => {
    SUPPORTED_LANGUAGES.forEach(lang => {
      expect(lang).toHaveProperty('code')
      expect(lang).toHaveProperty('name')
      expect(lang).toHaveProperty('nativeName')
      expect(lang).toHaveProperty('flag')
      expect(typeof lang.code).toBe('string')
      expect(typeof lang.name).toBe('string')
      expect(typeof lang.nativeName).toBe('string')
      expect(typeof lang.flag).toBe('string')
    })
  })

  it('should have unique language codes', () => {
    const codes = SUPPORTED_LANGUAGES.map(l => l.code)
    const uniqueCodes = new Set(codes)
    expect(uniqueCodes.size).toBe(codes.length)
  })

  it('should have exactly 3 languages', () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(3)
  })
})
