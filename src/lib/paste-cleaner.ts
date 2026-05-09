import { marked } from 'marked';

export function cleanAIPaste(rawText: string): { html: string, stats: { disclaimersRemoved: number, formattingCleaned: number } } {
  let text = rawText;
  let disclaimersRemoved = 0;
  let formattingCleaned = 0;

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
    const matches = text.match(regex);
    if (matches) disclaimersRemoved += matches.length;
    text = text.replace(regex, '');
  });

  // 1. Remove box/block characters and orphaned geometric shapes/arrows
  const formatRegex1 = /[□■▪▫▶▷◀◁◆◇◉●]/g;
  const matches1 = text.match(formatRegex1);
  if (matches1) formattingCleaned += matches1.length;
  text = text.replace(formatRegex1, '');

  const formatRegex2 = /[\u25A0-\u25FF\u2700-\u27BF]/g;
  const matches2 = text.match(formatRegex2);
  if (matches2) formattingCleaned += matches2.length;
  text = text.replace(formatRegex2, '');

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

  return {
    html: htmlResult,
    stats: {
      disclaimersRemoved,
      formattingCleaned
    }
  };
}
