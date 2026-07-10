// Parses a single <table:table>...</table:table> XML section into a 2D grid of cell values.
// Usage: node ods_to_grid.js <sheet_xml_file> <maxCols> <maxRows>
const fs = require('fs');

function parseSheet(xml, maxCols = 80, maxRows = 300) {
  const rows = [];
  // split into table-row elements (top-level, not nested - ODS doesn't nest rows)
  const rowRegex = /<table:table-row\b([^>]*)>([\s\S]*?)<\/table:table-row>/g;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    if (rows.length >= maxRows) break;
    const rowAttrs = rowMatch[1];
    const rowBody = rowMatch[2];
    const rowsRepeatedMatch = rowAttrs.match(/table:number-rows-repeated="(\d+)"/);
    const rowsRepeated = rowsRepeatedMatch ? parseInt(rowsRepeatedMatch[1], 10) : 1;

    // parse cells within this row
    const cellRegex = /<table:(table-cell|covered-table-cell)\b([^>]*?)(\/>|>([\s\S]*?)<\/table:table-cell>)/g;
    let cellMatch;
    const rowCells = [];
    while ((cellMatch = cellRegex.exec(rowBody)) !== null) {
      if (rowCells.length >= maxCols) break;
      const tag = cellMatch[1];
      const attrs = cellMatch[2];
      const inner = cellMatch[4] || '';
      const colsRepeatedMatch = attrs.match(/table:number-columns-repeated="(\d+)"/);
      const colsRepeated = colsRepeatedMatch ? parseInt(colsRepeatedMatch[1], 10) : 1;

      let value = '';
      if (tag === 'table-cell') {
        const valueTypeMatch = attrs.match(/office:value-type="([^"]*)"/);
        const valueType = valueTypeMatch ? valueTypeMatch[1] : '';
        if (valueType === 'float' || valueType === 'currency' || valueType === 'percentage') {
          const vMatch = attrs.match(/office:value="([^"]*)"/);
          value = vMatch ? vMatch[1] : '';
        } else if (valueType === 'date') {
          const vMatch = attrs.match(/office:date-value="([^"]*)"/);
          value = vMatch ? vMatch[1] : '';
        } else {
          // string or empty - extract text:p content(s), join with newline, strip tags
          const textMatches = [...inner.matchAll(/<text:p[^>]*>([\s\S]*?)<\/text:p>/g)];
          value = textMatches.map(m => m[1].replace(/<[^>]+>/g, '').trim()).join('\n');
          value = value.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
        }
      }
      const colsToAdd = Math.min(colsRepeated, maxCols - rowCells.length);
      for (let i = 0; i < colsToAdd; i++) rowCells.push(value);
      if (rowCells.length >= maxCols) break;
    }
    while (rowCells.length < maxCols) rowCells.push('');

    const isBlankRow = rowCells.every(v => v === '');
    const effectiveRepeated = isBlankRow ? 1 : rowsRepeated; // don't burn the row budget on blank filler
    const repeatsToAdd = Math.min(effectiveRepeated, maxRows - rows.length);
    for (let i = 0; i < repeatsToAdd; i++) rows.push(rowCells.slice());
  }
  return rows;
}

if (require.main === module) {
  const file = process.argv[2];
  const maxCols = parseInt(process.argv[3] || '80', 10);
  const maxRows = parseInt(process.argv[4] || '300', 10);
  const xml = fs.readFileSync(file, 'utf8');
  const grid = parseSheet(xml, maxCols, maxRows);
  console.log(JSON.stringify(grid));
}

module.exports = { parseSheet };
