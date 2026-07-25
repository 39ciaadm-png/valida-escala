const fs = require('fs');

const POSTOS = [
  'SUB TEN', 'ASP OF', '1 TEN', '2 TEN', 'CAP', 'MAJ', 'TEN CEL', 'CEL',
  '1 SGT', '2 SGT', '3 SGT', 'CB', 'SD 1 CL', 'SD 2 CL', 'SD',
];

function splitPostoNome(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  for (const p of POSTOS) {
    const re = new RegExp('^' + p.replace(/\s+/g, '\\s+') + '\\s+(.+)$', 'i');
    const m = clean.match(re);
    if (m) return { posto: p, nome: m[1].trim() };
  }
  return { posto: '', nome: clean };
}

// pdfjs-dist@4 é ESM-only; carregamos via import() dinâmico (funciona em CommonJS e na Vercel).
// Usamos o pdfjs em vez do pdf-parse porque alguns PDFs do SISP saem com a tabela de xref
// danificada ("Invalid PDF structure" no pdf-parse) — o pdfjs reconstrói e lê normalmente.
let _pdfjsPromise = null;
function getPdfjs() {
  if (!_pdfjsPromise) _pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  return _pdfjsPromise;
}

// Extrai o texto do PDF como uma lista de "linhas" (cada trecho de texto do pdfjs vira uma linha,
// já na ordem de leitura). Ignora a marca d'água diagonal (texto rotacionado, ex.: a matrícula do
// sargenteante carimbada repetidamente na diagonal), que senão poluiria o efetivo.
async function extrairLinhas(buf) {
  const { getDocument } = await getPdfjs();
  const doc = await getDocument({
    data: new Uint8Array(buf),
    stopAtErrors: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
  const linhas = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    for (const it of content.items) {
      if (!it.str) continue;
      const t = it.transform;
      if (Math.abs(t[1]) > 0.01 || Math.abs(t[2]) > 0.01) continue; // texto rotacionado = marca d'água
      const s = it.str.replace(/\s+/g, ' ').trim();
      if (s) linhas.push(s);
    }
    page.cleanup();
  }
  await doc.destroy();
  return linhas;
}

async function lerRosterDiaria(pdfInput) {
  const buf = Buffer.isBuffer(pdfInput) ? pdfInput : fs.readFileSync(pdfInput);
  const rawLines = await extrairLinhas(buf);

  const roster = [];
  let currentTurno = '';
  let currentEscala = '';

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (!line) continue;

    const turnoMatch = line.match(/^Turno:\s*(.+)$/i);
    if (turnoMatch) { currentTurno = turnoMatch[1].trim(); continue; }

    const escalaMatch = line.match(/^Escala:\s*(.+)$/i);
    if (escalaMatch) {
      // "POLICIAMENTO A PE - 13/06/2026 a 16/07/2026 - M6426 - ... (PA - CEASAMINAS)"
      const full = escalaMatch[1].trim();
      const nomeEscala = full.split(' - ')[0].trim();
      const equipeMatch = full.match(/\(([^()]*)\)\s*$/);
      currentEscala = equipeMatch ? `${nomeEscala} (${equipeMatch[1].trim()})` : nomeEscala;
      continue;
    }

    // linha de militar: "(1815654) 2 SGT  FULANO DE TAL - Cmte"
    // o nome as vezes quebra para a linha seguinte antes do "-" aparecer
    const startMatch = line.match(/^\((\d{6,8})\)\s*(.*)$/);
    if (startMatch) {
      const matricula = startMatch[1];
      let combined = startMatch[2];
      let consumed = 0;
      const isStructural = (l) => !l || /^\(/.test(l) || /^Turno:/i.test(l) || /^Escala:/i.test(l) || /^Equipe/i.test(l);
      while (!combined.includes('-') && consumed < 3 && rawLines[i + consumed + 1] && !isStructural(rawLines[i + consumed + 1])) {
        consumed++;
        combined += ' ' + rawLines[i + consumed];
      }
      const parts = combined.split(/\s*-\s*/);
      const postoNome = parts.shift().trim();
      let funcao = parts.join(' - ').trim();
      const { posto, nome } = splitPostoNome(postoNome);

      // a funcao as vezes continua na linha seguinte (quebra de celula do PDF)
      const next = rawLines[i + consumed + 1] || '';
      if (next && !/^\(/.test(next) && !/^Turno:/i.test(next) && !/^Escala:/i.test(next) &&
          !/^Equipe/i.test(next) && next.length < 40 && /^[A-ZÀ-Ú]/.test(next)) {
        funcao = (funcao + ' ' + next).trim();
        consumed++;
      }
      if (nome) {
        roster.push({ matricula, posto, nome, funcao, turno: currentTurno, escala: currentEscala });
      }
      i += consumed;
    }
  }

  // Deduplica lancamentos identicos: o PDF repete a ultima linha da tabela na
  // quebra de pagina (fim de uma pagina + topo da seguinte). Chave = matricula+turno+escala.
  const vistos = new Set();
  return roster.filter((r) => {
    const chave = `${r.matricula}|${r.turno}|${r.escala}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

module.exports = { lerRosterDiaria };
