import { marked } from 'marked';

function formatMarkdownTables(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inTable = false;
  let inCodeBlock = false;
  let tableLines: string[] = [];

  const processTable = (lines: string[]) => {
    if (lines.length < 2) return lines.join('\n'); // Not a real table
    // Check if second line is a separator
    const separatorLine = lines[1];
    if (!/^\|?[\s\-\:\.\+]*\|[\|\s\-\:\.\+]*$/.test(separatorLine) && !separatorLine.includes('---')) {
      return lines.join('\n');
    }

    // Auto-align columns and fix broken spacing
    const parsedRows = lines.map(line => {
      // Handle missing leading/trailing pipes if there are active internal pipes
      let processed = line.trim();
      if (!processed.startsWith('|') && processed.includes('|')) processed = '| ' + processed;
      if (!processed.endsWith('|') && processed.includes('|')) processed = processed + ' |';
      
      const cells = processed.split('|').map(c => c.trim());
      // remove first & last if they are empty from boundary pipes
      if (cells.length > 0 && cells[0] === '') cells.shift();
      if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
      return cells;
    });

    // Make separator standard
    const colCount = Math.max(...parsedRows.map(r => r.length));
    const headerCells = parsedRows[0];
    const separatorCells = parsedRows[1].map(c => {
      const isLeft = c.startsWith(':');
      const isRight = c.endsWith(':');
      if (isLeft && isRight) return ':---:';
      if (isRight) return '---:';
      if (isLeft) return ':---';
      return '---'; // default alignment
    });

    // Make sure separator has exactly colCount
    while(separatorCells.length < colCount) separatorCells.push('---');
    parsedRows[1] = separatorCells;

    return parsedRows.map(row => {
      // pad row if missing columns
      const cells = [...row];
      while(cells.length < colCount) cells.push('');
      return '| ' + cells.join(' | ') + ' |';
    }).join('\n');
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      if (inTable) {
        result.push(processTable(tableLines));
        tableLines = [];
        inTable = false;
      }
      result.push(lines[i]);
      continue;
    }

    if (inCodeBlock) {
      result.push(lines[i]);
      continue;
    }

    const isTableLine = line.includes('|') && (line.startsWith('|') || (i < lines.length - 1 && lines[i+1].includes('|') && lines[i+1].includes('-')));
    
    if (isTableLine) {
      if (!inTable) inTable = true;
      tableLines.push(lines[i]);
    } else {
      if (inTable) {
        result.push(processTable(tableLines));
        tableLines = [];
        inTable = false;
      }
      result.push(lines[i]);
    }
  }

  if (inTable) {
    result.push(processTable(tableLines));
  }

  return result.join('\n');
}

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

  // Clean and auto-format broken markdown tables
  text = formatMarkdownTables(text);

  // Parse markdown into HTML using marked synchronously
  let htmlResult = '';
  try {
    const preprocessedText = text.replace(/==([^=]+)==/g, '<mark>$1</mark>');
    const rawHtml = marked.parse(preprocessedText);
    if (typeof rawHtml === 'string') {
      htmlResult = rawHtml.replace(/<(td|th)([^>]*) align="(left|right|center|justify)"([^>]*)>/gi, '<$1$2 style="text-align: $3"$4>');
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
