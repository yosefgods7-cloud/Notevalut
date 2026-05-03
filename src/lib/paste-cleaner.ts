import { marked } from 'marked';

export function cleanAIPaste(rawText: string): string {
  let text = rawText;

  // Remove standard AI disclaimers
  const disclaimers = [
    /As an AI language model,?\s*/gi,
    /I am an AI.?.?.?\s*/gi,
    /Here is the information.?.?.?\s*/gi,
    /Certainly! Here is.?.?.?\s*/gi,
    /Sure, here is.?.?.?\s*/gi,
    /Here are some suggestions:?\s*/gi,
    /I hope this helps!?.?.?\s*/gi
  ];
  disclaimers.forEach(regex => {
    text = text.replace(regex, '');
  });

  // 1. Remove box/block characters and orphaned geometric shapes/arrows
  // U+25A0-U+25FF: Geometric Shapes
  // U+2700-U+27BF: Dingbats
  // Removing common bullets/blocks but keeping basic arrows
  text = text.replace(/[□■▪▫▶▷◀◁◆◇◉●]/g, '');
  text = text.replace(/[\u25A0-\u25FF\u2700-\u27BF]/g, '');

  // Strip trailing whitespace per line
  text = text.split('\n').map(line => line.trimEnd()).join('\n');

  // Collapse 3+ consecutive blank lines into 2
  text = text.replace(/\n{3,}/g, '\n\n');

  // Parse markdown into HTML using marked synchronously
  let htmlResult = '';
  try {
    const rawHtml = marked.parse(text);
    if (typeof rawHtml === 'string') {
      htmlResult = rawHtml;
    }
  } catch (e) {
    // Fallback to naive replacement if marked somehow fails
    htmlResult = `<p>${text.replace(/\n/g, '<br>')}</p>`;
  }
  
  if (!htmlResult) {
    // Minimal fallback
    htmlResult = text;
  }

  return htmlResult;
}
