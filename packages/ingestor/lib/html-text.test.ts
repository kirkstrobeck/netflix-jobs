import { describe, expect, it } from 'vitest';

import { decodeHtmlEntities, htmlToText, normalizeTitle } from './html-text.ts';

describe('decodeHtmlEntities', () => {
  it('decodes hex numeric entities in either case', () => {
    expect(decodeHtmlEntities('&#x2014;')).toBe('—');
    expect(decodeHtmlEntities('&#X2014;')).toBe('—');
    expect(decodeHtmlEntities('&#x1F600;')).toBe('😀');
  });

  it('decodes decimal numeric entities', () => {
    expect(decodeHtmlEntities('&#8212;')).toBe('—');
    expect(decodeHtmlEntities('a&#38;b')).toBe('a&b');
  });

  it('decodes every named entity in the table', () => {
    const encoded =
      '&amp;&quot;&apos;&lt;&gt;&nbsp;&ndash;&mdash;&rsquo;&lsquo;&ldquo;&rdquo;&hellip;&bull;';
    // The table maps nbsp to a plain space, not U+00A0.
    expect(decodeHtmlEntities(encoded)).toBe('&"\'<> \u2013\u2014\u2019\u2018\u201c\u201d\u2026\u2022');
  });

  it('matches named entities case-insensitively', () => {
    expect(decodeHtmlEntities('&AMP;&Quot;')).toBe('&"');
  });

  it('leaves unknown named entities untouched', () => {
    expect(decodeHtmlEntities('&notarealentity;')).toBe('&notarealentity;');
    expect(decodeHtmlEntities('5 &lt; 6 &whatever; 7')).toBe('5 < 6 &whatever; 7');
  });

  it('passes through text with no entities', () => {
    expect(decodeHtmlEntities('plain text')).toBe('plain text');
    expect(decodeHtmlEntities('')).toBe('');
  });
});

describe('htmlToText', () => {
  it('strips script blocks and their contents', () => {
    expect(htmlToText('<p>Keep</p><script>var x = "<b>drop</b>";</script>')).toBe('Keep');
  });

  it('strips style blocks and their contents', () => {
    expect(htmlToText('<style>.a { color: red }</style><p>Keep</p>')).toBe('Keep');
  });

  it('renders list items as bullets', () => {
    // The closing </li> contributes its own newline before the next bullet.
    expect(htmlToText('<ul><li>One</li><li class="x">Two</li></ul>')).toBe('• One\n\n• Two');
  });

  it('turns br tags into newlines', () => {
    expect(htmlToText('a<br>b<br/>c<br />d')).toBe('a\nb\nc\nd');
  });

  it('breaks on closing block tags', () => {
    const html = '<h1>Title</h1><div>Body</div><section>End</section>';
    expect(htmlToText(html)).toBe('Title\nBody\nEnd');
  });

  it('drops remaining tags and decodes entities', () => {
    expect(htmlToText('<p>Netflix &amp; <b>chill</b> &mdash; now</p>')).toBe(
      'Netflix & chill — now',
    );
  });

  it('collapses runs of spaces, tabs and non-breaking spaces', () => {
    expect(htmlToText('<p>a  \t b&nbsp;&nbsp;c</p>')).toBe('a b c');
  });

  it('collapses three or more newlines into a blank line', () => {
    expect(htmlToText('<p>a</p><p></p><p></p><p>b</p>')).toBe('a\n\nb');
  });

  it('trims leading and trailing whitespace', () => {
    expect(htmlToText('   <p>  spaced  </p>   ')).toBe('spaced');
  });

  it('returns an empty string for empty input', () => {
    expect(htmlToText('')).toBe('');
  });
});

describe('normalizeTitle', () => {
  it('lowercases and collapses punctuation into single spaces', () => {
    expect(normalizeTitle('Senior Software Engineer (L5) - Ads')).toBe(
      'senior software engineer l5 ads',
    );
  });

  it('strips combining marks left by NFKD decomposition', () => {
    expect(normalizeTitle('Café Manager')).toBe('cafe manager');
    expect(normalizeTitle('Söftware Enginéer')).toBe('software engineer');
  });

  it('normalizes compatibility forms via NFKD', () => {
    // U+FB01 (ﬁ ligature) decomposes to "fi"; U+2168 (Ⅸ) decomposes to "IX".
    expect(normalizeTitle('Oﬁce Ⅸ')).toBe('ofice ix');
  });

  it('trims and returns an empty string when nothing survives', () => {
    expect(normalizeTitle('   ---   ')).toBe('');
    expect(normalizeTitle('')).toBe('');
  });
});
