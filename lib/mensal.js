const fs = require('fs');
const AdmZip = require('adm-zip');
const { parseSheet } = require('./ods_to_grid');

const MATRICULA_RE = /^\d{3}\.\d{3}-\d$/;

// odsInput pode ser um caminho de arquivo (string) ou um Buffer (upload em memoria)
function loadContentXml(odsInput) {
  const buf = Buffer.isBuffer(odsInput) ? odsInput : fs.readFileSync(odsInput);
  const zip = new AdmZip(buf);
  const entry = zip.getEntry('content.xml');
  if (!entry) throw new Error('content.xml nao encontrado no .ods (arquivo corrompido ou nao e um ODS valido).');
  return entry.getData().toString('utf8');
}

function listarAbas(odsInput) {
  const xml = loadContentXml(odsInput);
  return [...xml.matchAll(/<table:table table:name="([^"]*)"/g)].map(m => m[1]);
}

function extractSheetXml(odsInput, sheetName) {
  const xml = loadContentXml(odsInput);
  const startMarker = `<table:table table:name="${sheetName}"`;
  const startIdx = xml.indexOf(startMarker);
  if (startIdx === -1) {
    const names = [...xml.matchAll(/<table:table table:name="([^"]*)"/g)].map(m => m[1]);
    throw new Error(`Aba "${sheetName}" nao encontrada. Abas disponiveis: ${names.join(', ')}`);
  }
  const endIdx = xml.indexOf('</table:table>', startIdx);
  return xml.slice(startIdx, endIdx + '</table:table>'.length);
}

// Retorna o roster (lista de militares com status naquela data) de uma aba de periodo.
function lerRosterMensal(odsInput, sheetName, targetDay, targetMonth) {
  const sectionXml = extractSheetXml(odsInput, sheetName);
  const grid = parseSheet(sectionXml, 45, 400);

  const monthLabel = targetMonth.toUpperCase();
  let monthCol = -1, monthRow = -1;
  for (let r = 0; r < grid.length && monthCol === -1; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c].trim().toUpperCase() === monthLabel) { monthRow = r; monthCol = c; break; }
    }
  }
  if (monthCol === -1) {
    throw new Error(`Mes "${targetMonth}" nao encontrado nos cabecalhos da aba "${sheetName}".`);
  }
  const dateCol = monthCol + (targetDay - 1);
  const weekday = (grid[monthRow + 2] || [])[dateCol] || '?';

  let currentSetor = '';
  const roster = [];
  for (const row of grid) {
    if (row[0] && row[0].trim()) currentSetor = row[0].trim();
    const mat = (row[2] || '').trim();
    if (MATRICULA_RE.test(mat)) {
      const posto = (row[3] || '').trim();
      const nome = (row[4] || '').trim();
      const valor = (row[dateCol] || '').trim();
      let status;
      if (valor === '') status = 'FOLGA';
      else if (/^\d+([.,]\d+)?$/.test(valor)) status = 'SERVICO';
      else status = 'AFASTAMENTO:' + valor.replace(/\n/g, ' | ');
      roster.push({ setor: currentSetor, matricula: mat, posto, nome, valor, status });
    }
  }
  return { roster, weekday, dateCol };
}

module.exports = { lerRosterMensal, extractSheetXml, listarAbas };
