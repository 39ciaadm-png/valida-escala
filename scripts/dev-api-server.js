// Servidor HTTP minimo so para DESENVOLVIMENTO LOCAL, expondo as mesmas
// funcoes serverless usadas pela Vercel (api/abas.js, api/validar.js).
// Nao e usado em producao - la o Vercel chama os handlers diretamente.
const http = require('http');
const abasHandler = require('../api/abas');
const validarHandler = require('../api/validar');

const PORT = 3001;

// A Vercel injeta res.status()/res.json() no runtime real; aqui simulamos isso
// para o teste local funcionar identico ao que roda em producao.
function withVercelHelpers(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)); };
  return res;
}

const server = http.createServer((req, res) => {
  withVercelHelpers(res);
  if (req.url === '/api/abas') return abasHandler(req, res);
  if (req.url === '/api/validar') return validarHandler(req, res);
  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, () => console.log(`Dev API server rodando em http://localhost:${PORT}`));
