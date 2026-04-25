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

  // Convert markdown dividers
  text = text.replace(/^---$/gm, '<hr>');
  text = text.replace(/^===$/gm, '<hr>');

  // Basic markdown conversion
  // Bold
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic (be careful with list items starting with *, we need a space check or similar)
  // Only match *word* not * list
  text = text.replace(/(?<!\*)\*(?!\s)(.*?)(?<!\s)\*(?!\*)/g, '<em>$1</em>');

  // Headings
  text = text.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  text = text.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  text = text.replace(/^# (.*$)/gm, '<h1>$1</h1>');

  // Code blocks (simplified)
  text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Simple lists processing
  // This is a naive conversion for requirement compliance.
  // Actually, sending clean markdown to Tiptap or Marked is safer. We will structure it as HTML.
  const lines = text.split('\n');
  let inUl = false;
  let inOl = false;
  let htmlResult = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Is it a hr, h1, h2, pre etc?
    if (line.match(/^<h[1-3]>|^<hr>|^<pre>/)) {
      if (inUl) { htmlResult += '</ul>\n'; inUl = false; }
      if (inOl) { htmlResult += '</ol>\n'; inOl = false; }
      htmlResult += line + '\n';
      continue;
    }

    const ulMatch = line.match(/^[-*]\s+(.*)/);
    const olMatch = line.match(/^\d+\.\s+(.*)/);

    if (ulMatch) {
      if (inOl) { htmlResult += '</ol>\n'; inOl = false; }
      if (!inUl) { htmlResult += '<ul>\n'; inUl = true; }
      htmlResult += `<li>${ulMatch[1]}</li>\n`;
    } else if (olMatch) {
      if (inUl) { htmlResult += '</ul>\n'; inUl = false; }
      if (!inOl) { htmlResult += '<ol>\n'; inOl = true; }
      htmlResult += `<li>${olMatch[1]}</li>\n`;
    } else {
      if (inUl) { htmlResult += '</ul>\n'; inUl = false; }
      if (inOl) { htmlResult += '</ol>\n'; inOl = false; }
      
      // If none of the above and not empty, wrap in P
      if (line.trim() !== '') {
        // If it's not already wrapped
        if (!line.startsWith('<')) {
          htmlResult += `<p>${line}</p>\n`;
        } else {
          htmlResult += line + '\n';
        }
      }
    }
  }

  if (inUl) htmlResult += '</ul>\n';
  if (inOl) htmlResult += '</ol>\n';

  return htmlResult;
}
