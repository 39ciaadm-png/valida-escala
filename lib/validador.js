const { lerRosterMensal, listarAbas } = require('./mensal');
const { lerRosterDiaria } = require('./diaria');

function norm(m) { return (m || '').replace(/\D/g, ''); }

// Classe do posto (para agrupar/estilizar). Serve tanto para o formato da mensal
// ("Cap", "1º Ten", "Sub Ten", "2º Sgt", "Cb", "Sd") quanto do PDF ("CAP", "2 TEN"...).
function classePosto(posto) {
  const p = (posto || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/CAP|MAJ|CEL|TENCEL|TEN$|(\d)TEN|ASPOF/.test(p) || /\bTEN\b/.test(posto || '')) {
    if (/SUBTEN/.test(p)) return 'PRACA'; // Sub Ten é praça especial, tratamos à parte
    return 'OFICIAL';
  }
  if (/SUBTEN/.test(p)) return 'SUBTEN';
  if (/SGT/.test(p)) return 'SGT';
  if (/^CB/.test(p)) return 'CB';
  return 'SD';
}
function ehOficial(posto) {
  const p = (posto || '').toUpperCase();
  return /\bCAP\b|\bMAJ\b|\bCEL\b|\bTEN\b|ASP/.test(p) && !/SUB\s*TEN/.test(p);
}

// Rótulo curto do status vindo da mensal.
function rotuloStatus(status) {
  if (status === 'SERVICO') return 'Serviço';
  if (status === 'FOLGA') return 'Folga';
  if (status && status.startsWith('AFASTAMENTO')) return 'Afastado';
  return status || '—';
}

async function validar({ odsInput, sheetName, dia, mes, pdfInput, tipo }) {
  const { roster: mensal, weekday, avisos } = lerRosterMensal(odsInput, sheetName, dia, mes);
  const diaria = await lerRosterDiaria(pdfInput);

  const mensalByMat = new Map();
  for (const m of mensal) mensalByMat.set(norm(m.matricula), m);

  const diariaByMat = new Map();
  for (const d of diaria) {
    const key = norm(d.matricula);
    if (!diariaByMat.has(key)) diariaByMat.set(key, []);
    diariaByMat.get(key).push(d);
  }

  const deveriamServico = mensal.filter((m) => m.status === 'SERVICO');
  const emFolga = mensal.filter((m) => m.status === 'FOLGA');
  const afastados = mensal.filter((m) => m.status && m.status.startsWith('AFASTAMENTO'));

  // --- Divergências ---
  const escaladoMasNaoDeveria = [];
  for (const [mat, entries] of diariaByMat) {
    const m = mensalByMat.get(mat);
    if (m && m.status !== 'SERVICO') {
      escaladoMasNaoDeveria.push({
        matricula: mat, nome: entries[0].nome, posto: entries[0].posto,
        statusMensal: m.status, rotulo: rotuloStatus(m.status),
        detalheMensal: m.status.startsWith('AFASTAMENTO') ? m.status.replace('AFASTAMENTO:', '') : m.valor,
        escalas: entries.map((e) => e.escala),
      });
    }
  }

  const naoEncontrado = [];
  for (const [mat, entries] of diariaByMat) {
    if (!mensalByMat.has(mat)) {
      naoEncontrado.push({
        matricula: mat, nome: entries[0].nome, posto: entries[0].posto,
        escalas: entries.map((e) => e.escala),
      });
    }
  }

  const deveriaMasNaoEscalado = [];
  for (const m of deveriamServico) {
    if (!diariaByMat.has(norm(m.matricula))) {
      deveriaMasNaoEscalado.push({
        matricula: m.matricula, nome: m.nome, posto: m.posto, setor: m.setor, valor: m.valor,
      });
    }
  }

  const duplicidadeSuspeita = [];
  for (const [mat, entries] of diariaByMat) {
    if (entries.length > 1) {
      const escalasDistintas = [...new Set(entries.map((e) => e.escala.split(' (')[0]))];
      if (escalasDistintas.length > 1) {
        duplicidadeSuspeita.push({ matricula: mat, nome: entries[0].nome, entries });
      }
    }
  }

  // --- Detalhamento da diária agrupado por turno + escala, com o status de cada um na mensal ---
  const grupoMap = new Map();
  for (const d of diaria) {
    const chave = `${d.turno} ||| ${d.escala}`;
    if (!grupoMap.has(chave)) grupoMap.set(chave, { turno: d.turno, escala: d.escala, militares: [] });
    const m = mensalByMat.get(norm(d.matricula));
    let flag = 'ok';
    if (!m) flag = 'fora-mensal';
    else if (m.status === 'FOLGA') flag = 'folga';
    else if (m.status && m.status.startsWith('AFASTAMENTO')) flag = 'afastado';
    grupoMap.get(chave).militares.push({
      matricula: d.matricula, nome: d.nome, posto: d.posto, funcao: d.funcao,
      classe: classePosto(d.posto),
      mensalStatus: m ? m.status : null,
      mensalRotulo: m ? rotuloStatus(m.status) : 'Fora da mensal',
      mensalSetor: m ? m.setor : null,
      flag,
    });
  }
  const porTurno = [...grupoMap.values()];

  // --- Efetivo da mensal que deveria estar de serviço, por setor ---
  const setorMap = new Map();
  for (const m of deveriamServico) {
    if (!setorMap.has(m.setor)) setorMap.set(m.setor, []);
    const escalado = diariaByMat.has(norm(m.matricula));
    setorMap.get(m.setor).push({
      matricula: m.matricula, nome: m.nome, posto: m.posto, valor: m.valor, escalado,
    });
  }
  const mensalPorSetor = [...setorMap.entries()].map(([setor, militares]) => ({ setor, militares }));

  return {
    meta: { dia, mes, weekday, sheetName, tipo: tipo || 'geral' },
    resumo: {
      totalMensal: mensal.length,
      deveriamServico: deveriamServico.length,
      emFolga: emFolga.length,
      afastados: afastados.length,
      escaladosDiaria: diariaByMat.size,
      lancamentosDiaria: diaria.length,
      diferenca: diariaByMat.size - deveriamServico.length,
      divergenciasCriticas: escaladoMasNaoDeveria.length + naoEncontrado.length + deveriaMasNaoEscalado.length,
    },
    divergencias: { escaladoMasNaoDeveria, naoEncontrado, deveriaMasNaoEscalado, duplicidadeSuspeita },
    porTurno,
    mensalPorSetor,
    avisos,
  };
}

module.exports = { validar, listarAbas };
