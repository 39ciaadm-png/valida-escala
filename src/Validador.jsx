import { useState } from 'react';
import { MESES } from './themes';

// Componente de uma validação (Praças ou Oficiais). Mantém seu próprio estado
// para que trocar de aba não perca os arquivos/resultado já carregados.
export default function Validador({ t, tipo, initialDia, initialMes }) {
  const ehOficiais = tipo === 'oficiais';
  const [mensalFile, setMensalFile] = useState(null);
  const [diariaFile, setDiariaFile] = useState(null);
  const [abas, setAbas] = useState([]);
  const [aba, setAba] = useState('');
  const [dia, setDia] = useState(initialDia ?? new Date().getDate());
  const [mes, setMes] = useState(initialMes ?? MESES[new Date().getMonth()]);
  const [loadingAbas, setLoadingAbas] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [r, setR] = useState(null);

  async function handleMensalChange(e) {
    const file = e.target.files[0];
    setMensalFile(file);
    setAbas([]); setAba(''); setError('');
    if (!file) return;
    setLoadingAbas(true);
    try {
      const fd = new FormData();
      fd.append('mensal', file);
      const resp = await fetch('/api/abas', { method: 'POST', body: fd });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erro ao ler abas.');
      setAbas(data.abas);
      // heurística: p/ oficiais tenta achar aba com "ofici"; senão última aba
      const alvo = ehOficiais ? data.abas.find((a) => /ofici/i.test(a)) : null;
      setAba(alvo || (data.abas.length ? data.abas[data.abas.length - 1] : ''));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAbas(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setR(null);
    if (!mensalFile || !diariaFile || !aba || !dia || !mes) {
      setError('Preencha todos os campos antes de validar.');
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('mensal', mensalFile);
      fd.append('diaria', diariaFile);
      fd.append('aba', aba);
      fd.append('dia', String(dia));
      fd.append('mes', mes);
      fd.append('tipo', tipo);
      const resp = await fetch('/api/validar', { method: 'POST', body: fd });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erro ao validar.');
      setR(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const cardStyle = {
    background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
    boxShadow: `0 6px 22px -12px rgba(${t.glow},0.4), inset 0 1px 0 rgba(255,255,255,0.03)`,
    backdropFilter: 'blur(8px)',
  };
  const labelInfo = ehOficiais
    ? 'Envie o .ods da escala de OFICIAIS (arquivo separado) e o PDF diário do SISP.'
    : 'Envie a escala mensal (.ods) das praças e o PDF diário do SISP.';

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ ...cardStyle, padding: 20, display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 12.5, color: t.muted }}>{labelInfo}</div>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))' }}>
          <Campo t={t} label={ehOficiais ? 'Escala mensal de oficiais (.ods)' : 'Escala mensal (.ods)'}>
            <input type="file" accept=".ods" onChange={handleMensalChange} style={fileStyle(t)} />
          </Campo>
          <Campo t={t} label="Aba / Período">
            <select value={aba} onChange={(e) => setAba(e.target.value)} disabled={!abas.length} style={inpStyle(t)}>
              <option value="" disabled>
                {loadingAbas ? 'Lendo abas...' : abas.length ? 'Selecione a aba' : 'Envie o .ods primeiro'}
              </option>
              {abas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Campo>
        </div>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))' }}>
          <Campo t={t} label="Dia">
            <input type="number" min="1" max="31" value={dia} onChange={(e) => setDia(e.target.value)} style={inpStyle(t)} />
          </Campo>
          <Campo t={t} label="Mês">
            <select value={mes} onChange={(e) => setMes(e.target.value)} style={inpStyle(t)}>
              {MESES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Campo>
          <Campo t={t} label="Escala diária (PDF do SISP)">
            <input type="file" accept=".pdf" onChange={(e) => setDiariaFile(e.target.files[0])} style={fileStyle(t)} />
          </Campo>
        </div>
        <button type="submit" disabled={loading} style={{
          background: t.accent, color: t.accentText, border: 'none', borderRadius: 10,
          padding: '11px 16px', fontSize: 15, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.7 : 1, boxShadow: `0 4px 14px -4px rgba(${t.glow},0.7)`,
        }}>
          {loading ? 'Validando...' : `Validar escala ${ehOficiais ? '— Oficiais' : ''}`}
        </button>
        {error && (
          <div style={{ background: `${t.danger}18`, border: `1px solid ${t.danger}`, color: t.danger, padding: '10px 12px', borderRadius: 8, fontSize: 13 }}>
            {error}
          </div>
        )}
      </form>

      {r && <Resultado t={t} r={r} cardStyle={cardStyle} />}
    </div>
  );
}

function Resultado({ t, r, cardStyle }) {
  const { meta, resumo, divergencias, porTurno, mensalPorSetor, avisos } = r;
  const semDivergencia = resumo.divergenciasCriticas === 0;

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: t.text }}>
          Resultado — {meta.dia}/{meta.mes} <span style={{ color: t.muted, fontWeight: 500 }}>({meta.weekday})</span>
          <span style={{ marginLeft: 8, fontSize: 12, padding: '2px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: `rgba(${t.glow},0.08)`, color: t.accent }}>
            aba "{meta.sheetName}"
          </span>
        </h2>
        <button onClick={() => window.print()} style={{
          background: 'transparent', border: `1px solid ${t.border}`, color: t.text, borderRadius: 8,
          padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }} className="no-print">🖨️ Imprimir / PDF</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', marginBottom: 18 }}>
        <KPI t={t} label="Efetivo na mensal" value={resumo.totalMensal} color={t.accent} />
        <KPI t={t} label="Deveriam servir" value={resumo.deveriamServico} color={t.accent} />
        <KPI t={t} label="Escalados na diária" value={resumo.escaladosDiaria} color={t.ok} />
        <KPI t={t} label="Em folga" value={resumo.emFolga} color={t.muted} />
        <KPI t={t} label="Afastados" value={resumo.afastados} color={t.warn} />
        <KPI t={t} label="Diferença" value={resumo.diferenca > 0 ? `+${resumo.diferenca}` : resumo.diferenca} color={resumo.diferenca === 0 ? t.ok : t.warn} pulse={resumo.diferenca !== 0} />
        <KPI t={t} label="Divergências" value={resumo.divergenciasCriticas} color={semDivergencia ? t.ok : t.danger} pulse={!semDivergencia} />
      </div>

      {semDivergencia ? (
        <div style={{ ...cardStyle, padding: 16, marginBottom: 14, borderColor: t.ok, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>✅</span>
          <span style={{ color: t.ok, fontWeight: 700 }}>Nenhuma divergência crítica encontrada. Efetivo da diária bate com a mensal.</span>
        </div>
      ) : (
        <div style={{ ...cardStyle, padding: '12px 16px', marginBottom: 14, borderColor: t.danger, background: `${t.danger}10` }}>
          <span style={{ color: t.danger, fontWeight: 700 }}>⚠ {resumo.divergenciasCriticas} ponto(s) para conferir</span>
          <span style={{ color: t.muted, fontSize: 13 }}> — veja as seções abaixo antes de fechar a escala.</span>
        </div>
      )}

      {avisos && avisos.length > 0 && (
        <div style={{ ...cardStyle, padding: '12px 16px', marginBottom: 14, borderColor: t.warn, background: `${t.warn}10` }}>
          <div style={{ color: t.warn, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
            ⚠ {avisos.length} aviso(s) na leitura da mensal — confira manualmente
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
            {avisos.map((a, i) => <li key={i} style={{ fontSize: 12.5, color: t.muted }}>{a}</li>)}
          </ul>
        </div>
      )}

      <Secao t={t} cardStyle={cardStyle} cor={t.danger}
        titulo={`1) Escalado hoje mas a mensal diz que NÃO deveria (${divergencias.escaladoMasNaoDeveria.length})`}
        vazio="Nenhum caso.">
        {divergencias.escaladoMasNaoDeveria.map((x) => (
          <li key={x.matricula}>
            <PostoTag t={t} posto={x.posto} /> <strong>{x.nome}</strong> <Mat t={t} m={x.matricula} />
            <div style={{ fontSize: 12.5, color: t.muted, marginTop: 2 }}>
              Mensal: <b style={{ color: t.warn }}>{x.rotulo}{x.detalheMensal ? ` (${x.detalheMensal})` : ''}</b> · Diária: {x.escalas.join(', ')}
            </div>
          </li>
        ))}
      </Secao>

      <Secao t={t} cardStyle={cardStyle} cor={t.warn}
        titulo={`2) Na diária mas NÃO encontrado na mensal (${divergencias.naoEncontrado.length})`}
        vazio="Nenhum caso.">
        {divergencias.naoEncontrado.map((x) => (
          <li key={x.matricula}>
            <PostoTag t={t} posto={x.posto} /> <strong>{x.nome}</strong> <Mat t={t} m={x.matricula} />
            <div style={{ fontSize: 12.5, color: t.muted, marginTop: 2 }}>Diária: {x.escalas.join(', ')}</div>
          </li>
        ))}
      </Secao>

      <Secao t={t} cardStyle={cardStyle} cor={t.warn}
        titulo={`3) Mensal diz serviço mas NÃO apareceu na diária (${divergencias.deveriaMasNaoEscalado.length})`}
        vazio="Nenhum caso.">
        {divergencias.deveriaMasNaoEscalado.map((x) => (
          <li key={x.matricula}>
            <PostoTag t={t} posto={x.posto} /> <strong>{x.nome}</strong> <Mat t={t} m={x.matricula} />
            <div style={{ fontSize: 12.5, color: t.muted, marginTop: 2 }}>Setor: {x.setor} · valor mensal: {x.valor}</div>
          </li>
        ))}
      </Secao>

      <Secao t={t} cardStyle={cardStyle} cor={t.danger}
        titulo={`4) Duplicidade suspeita (mesma pessoa em escalas diferentes) (${divergencias.duplicidadeSuspeita.length})`}
        vazio="Nenhuma duplicidade.">
        {divergencias.duplicidadeSuspeita.map((x) => (
          <li key={x.matricula}>
            <strong>{x.nome}</strong> <Mat t={t} m={x.matricula} />
            <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
              {x.entries.map((e, i) => <li key={i} style={{ fontSize: 12.5, color: t.muted }}>{e.turno} · {e.escala}</li>)}
            </ul>
          </li>
        ))}
      </Secao>

      {/* Detalhamento por turno */}
      <div style={{ ...cardStyle, padding: 16, marginTop: 8 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: t.accent }}>
          Efetivo escalado hoje — por turno / escala
        </h3>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))' }}>
          {porTurno.map((g, gi) => (
            <div key={gi} style={{ border: `1px solid ${t.border}`, borderRadius: 10, padding: 12, background: `rgba(${t.glow},0.03)` }}>
              <div style={{ fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{g.turno}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>{g.escala}</div>
              {g.militares.map((m, mi) => (
                <div key={mi} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderTop: mi ? `1px solid rgba(${t.glow},0.08)` : 'none' }}>
                  <FlagDot t={t} flag={m.flag} />
                  <span style={{ fontSize: 12.5, flex: 1 }}>
                    <b>{m.posto}</b> {m.nome}
                    {m.funcao ? <span style={{ color: t.muted }}> · {m.funcao}</span> : null}
                  </span>
                  {m.flag !== 'ok' && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: flagColor(t, m.flag), whiteSpace: 'nowrap' }}>
                      {m.mensalRotulo}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: t.muted }}>
          <span><FlagDot t={t} flag="ok" /> Confere com a mensal</span>
          <span><FlagDot t={t} flag="folga" /> Mensal marca folga</span>
          <span><FlagDot t={t} flag="afastado" /> Mensal marca afastamento</span>
          <span><FlagDot t={t} flag="fora-mensal" /> Fora da mensal</span>
        </div>
      </div>

      {/* Efetivo por setor */}
      {mensalPorSetor.length > 0 && (
        <div style={{ ...cardStyle, padding: 16, marginTop: 14 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: t.accent }}>
            Quem deveria estar de serviço (mensal) — por setor
          </h3>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))' }}>
            {mensalPorSetor.map((s, si) => (
              <div key={si} style={{ border: `1px solid ${t.border}`, borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: t.text, marginBottom: 6 }}>{s.setor}</div>
                {s.militares.map((m, mi) => (
                  <div key={mi} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 12.5 }}>
                    <span style={{ color: m.escalado ? t.ok : t.danger }}>{m.escalado ? '✓' : '✕'}</span>
                    <span style={{ flex: 1 }}><b>{m.posto}</b> {m.nome}</span>
                    <span style={{ color: t.muted, fontSize: 11 }}>{m.valor}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: t.muted }}>
            <span style={{ color: t.ok }}>✓</span> apareceu na diária · <span style={{ color: t.danger }}>✕</span> não apareceu
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- subcomponentes ---------- */
function Campo({ t, label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 12, color: t.muted }}>{label}</span>
      {children}
    </label>
  );
}
function KPI({ t, label, value, color, pulse }) {
  return (
    <div style={{
      background: t.card, border: `1px solid ${pulse ? color : t.border}`, borderRadius: 14, padding: 14,
      boxShadow: `0 6px 18px -10px rgba(${t.glow},0.4)`,
      animation: pulse ? 'pulseGlow 1.8s ease-in-out infinite' : 'none',
    }}>
      <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: t.muted }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 30, fontWeight: 800, color, textShadow: `0 0 14px ${color}55` }}>{value}</div>
    </div>
  );
}
function Secao({ t, cardStyle, cor, titulo, vazio, children }) {
  const has = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div style={{ ...cardStyle, padding: '14px 16px', marginBottom: 12, borderColor: has ? cor : t.border }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 13.5, fontWeight: 700, color: has ? cor : t.text }}>{titulo}</h3>
      {has ? <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>{children}</ul>
           : <p style={{ margin: 0, fontSize: 13, color: t.ok }}>{vazio}</p>}
    </div>
  );
}
function PostoTag({ t, posto }) {
  if (!posto) return null;
  return <span style={{ fontSize: 10.5, fontWeight: 700, color: t.accent, background: `rgba(${t.glow},0.14)`, padding: '1px 6px', borderRadius: 5, marginRight: 4 }}>{posto}</span>;
}
function Mat({ t, m }) {
  return <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: t.muted }}>({m})</span>;
}
function flagColor(t, flag) {
  return flag === 'fora-mensal' ? t.danger : flag === 'afastado' ? t.warn : flag === 'folga' ? t.warn : t.ok;
}
function FlagDot({ t, flag }) {
  return <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 99, background: flagColor(t, flag), boxShadow: flag === 'ok' ? 'none' : `0 0 6px ${flagColor(t, flag)}` }} />;
}
const inpStyle = (t) => ({ background: `rgba(0,0,0,0.25)`, border: `1px solid ${t.border}`, color: t.text, borderRadius: 8, padding: '8px 10px', fontSize: 14, outline: 'none' });
const fileStyle = (t) => ({ background: `rgba(0,0,0,0.25)`, border: `1px solid ${t.border}`, color: t.text, borderRadius: 8, padding: '7px 8px', fontSize: 12.5, outline: 'none' });
