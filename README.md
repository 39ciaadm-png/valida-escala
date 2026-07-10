# Validador de Escala — 39ª Cia PM (web)

App para cruzar a escala **mensal** (.ods) com a escala **diária** (PDF do SISP),
mostrando quantos militares deveriam estar de serviço, quantos estão de fato
escalados, e as divergências entre os dois documentos.

## Como usar (depois de publicado)

1. Abra o site.
2. Envie o arquivo `.ods` da escala mensal — as abas (períodos) aparecem
   automaticamente no seletor.
3. Escolha a aba do período, o dia e o mês.
4. Envie o PDF "Relatório de acompanhamento diário" (SISP) daquele dia.
5. Clique em "Validar escala".

## Rodar localmente

```
npm install
npm run dev            # frontend (Vite) em http://localhost:5173
node scripts/dev-api-server.js   # API local em http://localhost:3001, em outro terminal
```

O `vite.config.js` já tem proxy de `/api` para `http://localhost:3001` só para
desenvolvimento. Em produção (Vercel) o `/api` é servido nativamente pelas
funções serverless em `api/`.

## Estrutura

- `src/` — frontend React (upload, formulário, exibição do resultado)
- `api/abas.js` — lista as abas do .ods enviado
- `api/validar.js` — recebe os dois arquivos e devolve o relatório de divergências
- `lib/` — parser do ODS (sem depender de LibreOffice/Excel), parser do PDF diário,
  e a lógica de cruzamento (compartilhados pelas duas rotas de API)

## Deploy

1. Suba esta pasta (sem `node_modules` e sem `dist` — já estão no `.gitignore`)
   para um repositório no GitHub.
2. No Vercel, importe o repositório — o Vercel detecta o Vite automaticamente
   (build `npm run build`, saída `dist`) e publica as funções em `api/` sem
   configuração extra.

## Limitações conhecidas

- Setores como Fiscalização às vezes não têm linha própria na planilha mensal —
  o app reporta como "não encontrado na mensal", o que pode ser normal (conferir
  antes de tratar como erro).
- A extração do PDF depende do texto seguir a ordem "Turno -> Escala -> militares".
  Relatórios com layout muito diferente do modelo SISP podem exigir ajuste em
  `lib/diaria.js`.
