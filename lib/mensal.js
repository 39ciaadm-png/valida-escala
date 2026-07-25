const fs = require('fs');
const AdmZip = require('adm-zip');
const { parseSheet } = require('./ods_to_grid');

// Nem toda matrícula na planilha vem formatada como "123.456-7": muitos militares (os mais novos)
// têm a matrícula digitada SEM pontuação (ex.: "1738459"). Usar regex estrita descartava a linha
// inteira desses militares (ex.: Cb Andre Neves Silva sumia da mensal).
// Porém, aceitar qualquer célula com 6-8 dígitos é permissivo demais: uma legenda como
// "nº 158.425-9 - Sargenteante" seria confundida com um militar e sobrescreveria o Diego real no
// cruzamento. Então exigimos que a célula seja SÓ a matrícula — apenas dígitos e, opcionalmente,
// os separadores ponto, hífen e espaço. Se houver qualquer letra/texto junto, não é matrícula.
function isMatricula(v) {
  const s = (v || '').trim();
  if (!/^[\d.\-\s]+$/.test(s)) return false;
  const digits = s.replace(/\D/g, '');
  return digits.length >= 6 && digits.length <= 8;
}
const MESES_LABELS = [
  'JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

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

  // Periodos podem comecar no meio do mes (ex.: "6 Periodo" comeca em 17/JULHO), entao a
  // coluna do dia 1 nao e necessariamente monthCol. Em vez de assumir contiguidade, lemos a
  // linha real de numeros dos dias (logo abaixo do rotulo do mes) e procuramos o dia exato,
  // limitando a busca ao bloco de colunas deste mes (ate o proximo rotulo de mes na mesma linha).
  const headerRow = grid[monthRow] || [];
  let nextMonthCol = headerRow.length;
  for (let c = monthCol + 1; c < headerRow.length; c++) {
    if (MESES_LABELS.includes((headerRow[c] || '').trim().toUpperCase())) { nextMonthCol = c; break; }
  }
  const diaRow = grid[monthRow + 1] || [];
  const alvo = String(targetDay);
  let dateCol = -1;
  for (let c = monthCol; c < nextMonthCol; c++) {
    if ((diaRow[c] || '').trim() === alvo) { dateCol = c; break; }
  }
  if (dateCol === -1) {
    throw new Error(`Dia ${targetDay} nao encontrado no bloco de ${targetMonth} da aba "${sheetName}".`);
  }
  const weekday = (grid[monthRow + 2] || [])[dateCol] || '?';

  let currentSetor = '';
  const roster = [];
  const avisos = [];
  for (const row of grid) {
    if (row[0] && row[0].trim()) currentSetor = row[0].trim();
    const mat = (row[2] || '').trim();
    const posto = (row[3] || '').trim();
    const nome = (row[4] || '').trim();
    if (isMatricula(mat)) {
      const valor = (row[dateCol] || '').trim();
      let status;
      if (valor === '') status = 'FOLGA';
      else if (/^\d+([.,]\d+)?$/.test(valor)) status = 'SERVICO';
      else status = 'AFASTAMENTO:' + valor.replace(/\n/g, ' | ');
      roster.push({ setor: currentSetor, matricula: mat, posto, nome, valor, status });
    } else if (nome && posto) {
      // Linha com posto e nome preenchidos mas sem matrícula reconhecível: provavelmente um
      // militar que não vai entrar na conferência por causa de uma célula mal formatada.
      avisos.push(`Linha com nome "${nome}" (${posto}) na célula de matrícula "${mat || '(vazia)'}" não reconhecida como matrícula — militar ficou de fora da conferência. Setor: ${currentSetor || '?'}.`);
    }
  }

  const porMatricula = new Map();
  for (const m of roster) {
    const chave = m.matricula.replace(/\D/g, '');
    if (porMatricula.has(chave) && porMatricula.get(chave).nome !== m.nome) {
      avisos.push(`Matrícula "${m.matricula}" repetida para nomes diferentes ("${porMatricula.get(chave).nome}" e "${m.nome}") — um deles vai sobrescrever o outro na conferência.`);
    }
    porMatricula.set(chave, m);
  }

  return { roster, weekday, dateCol, avisos };
}

module.exports = { lerRosterMensal, extractSheetXml, listarAbas };
