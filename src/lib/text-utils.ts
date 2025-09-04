export function wrapText(text: string, maxLength: number = 15): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  const words = text.split(/[\s_-]+/);
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if (currentLine.length === 0) {
      currentLine = word;
    } else if (currentLine.length + word.length + 1 <= maxLength) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }
  
  const finalLines: string[] = [];
  for (const line of lines) {
    if (line.length <= maxLength) {
      finalLines.push(line);
    } else {
      for (let i = 0; i < line.length; i += maxLength) {
        finalLines.push(line.substring(i, i + maxLength));
      }
    }
  }
  
  return finalLines.join('<br>');
}
