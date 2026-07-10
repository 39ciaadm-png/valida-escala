const { formidable } = require('formidable');
const { listarAbas } = require('../lib/mensal');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metodo nao permitido' });
    return;
  }
  try {
    const form = formidable({ maxFileSize: 20 * 1024 * 1024 });
    const [, files] = await form.parse(req);
    const mensalFile = files.mensal && files.mensal[0];
    if (!mensalFile) throw new Error('Arquivo da escala mensal (.ods) nao enviado.');

    const fs = require('fs');
    const buf = fs.readFileSync(mensalFile.filepath);
    const abas = listarAbas(buf);
    res.status(200).json({ abas });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
