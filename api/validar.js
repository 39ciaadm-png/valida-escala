const { formidable } = require('formidable');
const fs = require('fs');
const { validar } = require('../lib/validador');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metodo nao permitido' });
    return;
  }
  try {
    const form = formidable({ maxFileSize: 20 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);

    const mensalFile = files.mensal && files.mensal[0];
    const diariaFile = files.diaria && files.diaria[0];
    const sheetName = fields.aba && fields.aba[0];
    const dia = parseInt(fields.dia && fields.dia[0], 10);
    const mes = fields.mes && fields.mes[0];
    const tipo = (fields.tipo && fields.tipo[0]) || 'geral';

    if (!mensalFile) throw new Error('Arquivo da escala mensal (.ods) nao enviado.');
    if (!diariaFile) throw new Error('Arquivo da escala diaria (.pdf) nao enviado.');
    if (!sheetName) throw new Error('Selecione a aba/periodo da escala mensal.');
    if (!dia || !mes) throw new Error('Informe o dia e o mes.');

    const odsBuf = fs.readFileSync(mensalFile.filepath);
    const pdfBuf = fs.readFileSync(diariaFile.filepath);

    const resultado = await validar({ odsInput: odsBuf, sheetName, dia, mes, pdfInput: pdfBuf, tipo });
    res.status(200).json(resultado);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
