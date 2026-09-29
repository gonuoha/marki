import { findSentenceRange, splitSentences } from '@/lib/sentences'

describe('splitSentences', () => {
  it('splits on period, question and exclamation', () => {
    const text = 'Hello world. How are you? Fine!'
    expect(splitSentences(text).map((r) => text.slice(r.start, r.end))).toEqual([
      'Hello world.',
      'How are you?',
      'Fine!'
    ])
  })

  it('handles closing quotes and brackets after punctuation', () => {
    const text = 'She said "hello." Then left.'
    expect(splitSentences(text).map((r) => text.slice(r.start, r.end))).toEqual([
      'She said "hello."',
      'Then left.'
    ])
  })

  it('does not split on ellipses', () => {
    const text = 'Wait... really?'
    expect(splitSentences(text).map((r) => text.slice(r.start, r.end))).toEqual(['Wait... really?'])
  })

  it('does not split on decimal numbers', () => {
    const text = 'Pi is 3.14 exactly.'
    expect(splitSentences(text).map((r) => text.slice(r.start, r.end))).toEqual(['Pi is 3.14 exactly.'])
  })

  it('handles common abbreviations', () => {
    const text = 'Use e.g. this and i.e. that. Done.'
    expect(splitSentences(text).map((r) => text.slice(r.start, r.end))).toEqual([
      'Use e.g. this and i.e. that.',
      'Done.'
    ])
  })

  it('handles titles like Mr. and Dr.', () => {
    const text = 'Mr. Smith met Dr. Jones. They talked.'
    expect(splitSentences(text).map((r) => text.slice(r.start, r.end))).toEqual([
      'Mr. Smith met Dr. Jones.',
      'They talked.'
    ])
  })

  it('handles vs. and Fig.', () => {
    const text = 'A vs. B in Fig. 2. Next.'
    expect(splitSentences(text).map((r) => text.slice(r.start, r.end))).toEqual([
      'A vs. B in Fig. 2.',
      'Next.'
    ])
  })

  it('handles approx. and etc.', () => {
    const text = 'About approx. 5 items, etc. Finished.'
    expect(splitSentences(text).map((r) => text.slice(r.start, r.end))).toEqual([
      'About approx. 5 items, etc.',
      'Finished.'
    ])
  })

  it('handles initials like J. R. R. Tolkien', () => {
    const text = 'J. R. R. Tolkien wrote books. Many books.'
    expect(splitSentences(text).map((r) => text.slice(r.start, r.end))).toEqual([
      'J. R. R. Tolkien wrote books.',
      'Many books.'
    ])
  })
})

describe('findSentenceRange', () => {
  const text = 'First sentence. Second sentence! Third?'

  it('finds the sentence containing a middle offset', () => {
    const range = findSentenceRange(text, 20)
    expect(text.slice(range.start, range.end)).toBe('Second sentence!')
  })

  it('finds the sentence at a boundary between sentences', () => {
    const range = findSentenceRange(text, 15)
    expect(text.slice(range.start, range.end)).toBe('First sentence.')
  })

  it('finds the sentence at the very start', () => {
    const range = findSentenceRange(text, 0)
    expect(text.slice(range.start, range.end)).toBe('First sentence.')
  })

  it('finds the sentence at the very end', () => {
    const endRange = findSentenceRange(text, text.length)
    expect(text.slice(endRange.start, endRange.end)).toBe('Third?')
    const lastChar = findSentenceRange(text, text.length - 1)
    expect(text.slice(lastChar.start, lastChar.end)).toBe('Third?')
  })
})
