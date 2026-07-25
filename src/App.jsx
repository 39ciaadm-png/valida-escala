import { useState, useEffect } from 'react';
import { THEMES, MESES } from './themes';
import Validador from './Validador';
import './App.css';

const THEME_KEY = 'validador-escala-theme';
const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

let seqGlobal = 0;
function diaTabFromDate(data) {
  return {
    id: `dia-${Date.now()}-${seqGlobal++}-${Math.random().toString(36).slice(2, 7)}`,
    ts: data.getTime(),
    label: DIAS_SEMANA[data.getDay()],
    dia: data.getDate(),
    mes: MESES[data.getMonth()],
  };
}

export default function App() {
  const [themeKey, setThemeKey] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved && THEMES[saved] ? saved : 'escuro';
  });
  const [themeOpen, setThemeOpen] = useState(false);
  const [tab, setTab] = useState('geral');
  // Abas de dia: começa com um único dia (hoje). O usuário adiciona mais dias no "+" conforme
  // precisar (ex.: na sexta, adicionar sábado, domingo e segunda para conferir cada um numa aba).
  const [diaTabs, setDiaTabs] = useState(() => [diaTabFromDate(new Date())]);
  const [diaAtivo, setDiaAtivo] = useState(() => diaTabs[0]?.id);
  const t = THEMES[themeKey];

  useEffect(() => { localStorage.setItem(THEME_KEY, themeKey); }, [themeKey]);

  // Se o usuário arrastar um arquivo e soltar fora dos campos de upload (ex.: erra o alvo), o
  // Chrome por padrão tenta ABRIR o arquivo direto na aba — o que pode travar o navegador com
  // PDFs problemáticos (RESULT_CODE_KILLED_BAD_MESSAGE). Bloqueando dragover/drop na página
  // inteira, um drop "perdido" simplesmente não faz nada, em vez de travar. Os campos de upload
  // continuam funcionando: eles têm seus próprios onDrop que já chama preventDefault antes disso.
  useEffect(() => {
    const bloquear = (e) => e.preventDefault();
    window.addEventListener('dragover', bloquear);
    window.addEventListener('drop', bloquear);
    return () => {
      window.removeEventListener('dragover', bloquear);
      window.removeEventListener('drop', bloquear);
    };
  }, []);

  function addDiaTab() {
    setDiaTabs((prev) => {
      // Novo dia = dia seguinte ao da última aba (ts guarda a data real, robusto na virada de mês/ano).
      const ultimaTs = prev.length ? prev[prev.length - 1].ts : Date.now();
      const nova = diaTabFromDate(new Date(ultimaTs + 24 * 60 * 60 * 1000));
      setDiaAtivo(nova.id);
      return [...prev, nova];
    });
  }
  function removeDiaTab(id) {
    setDiaTabs((prev) => {
      const resto = prev.filter((d) => d.id !== id);
      if (diaAtivo === id && resto.length) setDiaAtivo(resto[0].id);
      return resto;
    });
  }
  function renameDiaTab(id, label) {
    setDiaTabs((prev) => prev.map((d) => (d.id === id ? { ...d, label } : d)));
  }

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text, transition: 'background .4s, color .3s' }}>
      <style>{`
        @keyframes pulseGlow { 0%,100%{ box-shadow:0 0 12px -2px rgba(${t.glow},0.5) } 50%{ box-shadow:0 0 26px 0 rgba(${t.glow},0.85) } }
        .tab-btn:hover { filter: brightness(1.15); }
        @media print { .no-print { display:none !important; } body { background:#fff !important; } }
      `}</style>

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '24px 18px 60px' }}>
        {/* HEADER */}
        <header style={{
          background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: '16px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
          boxShadow: `0 8px 26px -14px rgba(${t.glow},0.5)`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => setThemeOpen((o) => !o)} title="Mudar tema"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}>
              <img src="/logo-pmmg.svg" alt="Brasão PMMG" style={{ width: 66, height: 66, objectFit: 'contain', filter: `drop-shadow(0 0 10px rgba(${t.glow},0.6))` }} />
            </button>
            <div style={{ borderLeft: `1px solid ${t.border}`, paddingLeft: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3em', color: t.accent }}>
                39ª Companhia · PMMG
              </div>
              <h1 style={{ margin: '3px 0 2px', fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em', color: t.text }}>
                Validador de Escala
              </h1>
              <p style={{ margin: 0, fontSize: 12.5, color: t.muted }}>
                Cruza a escala mensal (.ods) com a diária (PDF do SISP) e aponta divergências.
              </p>
            </div>
          </div>
          <button className="no-print" title="Tema" onClick={() => setThemeOpen((o) => !o)}
            style={{ background: `rgba(${t.glow},0.1)`, border: `1px solid ${t.border}`, color: t.accent, cursor: 'pointer', padding: '8px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
            🎨 Tema
          </button>
        </header>

        {/* ABAS DE DIA — com um único dia não mostra as abas (fica limpo como antes); só
            aparecem quando o usuário clica em "+ Comparar outro dia" e passa a ter mais de um. */}
        {diaTabs.length > 1 ? (
          <div className="no-print" style={{ display: 'flex', gap: 6, marginTop: 20, background: `rgba(${t.glow},0.06)`, padding: 5, borderRadius: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {diaTabs.map((d) => (
              <DiaTabButton key={d.id} t={t} d={d} active={diaAtivo === d.id}
                onSelect={() => setDiaAtivo(d.id)} onRename={(lbl) => renameDiaTab(d.id, lbl)}
                onRemove={() => removeDiaTab(d.id)} />
            ))}
            <button className="tab-btn" onClick={addDiaTab} title="Adicionar mais um dia"
              style={{ border: `1px dashed ${t.border}`, background: 'transparent', color: t.muted, cursor: 'pointer', borderRadius: 9, padding: '9px 14px', fontSize: 14, fontWeight: 700 }}>
              + Dia
            </button>
          </div>
        ) : (
          <div className="no-print" style={{ marginTop: 20 }}>
            <button className="tab-btn" onClick={addDiaTab} title="Adicionar outro dia para conferir em abas separadas"
              style={{ border: `1px dashed ${t.border}`, background: `rgba(${t.glow},0.06)`, color: t.muted, cursor: 'pointer', borderRadius: 10, padding: '9px 16px', fontSize: 13.5, fontWeight: 700 }}>
              + Comparar outro dia
            </button>
          </div>
        )}

        {/* ABAS Praças / Oficiais */}
        <div className="no-print" style={{ display: 'flex', gap: 6, marginTop: 10, background: `rgba(${t.glow},0.06)`, padding: 5, borderRadius: 12, width: 'fit-content' }}>
          {[['geral', 'Praças / Geral'], ['oficiais', 'Oficiais']].map(([k, lbl]) => {
            const active = tab === k;
            return (
              <button key={k} className="tab-btn" onClick={() => setTab(k)}
                style={{
                  border: 'none', cursor: 'pointer', padding: '9px 18px', borderRadius: 9, fontSize: 14, fontWeight: 700,
                  background: active ? t.card : 'transparent', color: active ? t.accent : t.muted,
                  boxShadow: active ? `inset 0 -2px 0 ${t.accent}` : 'none', transition: 'all .2s',
                }}>
                {lbl}
              </button>
            );
          })}
        </div>

        {/* CONTEÚDO — mantém tudo montado (todas as abas de dia x Praças/Oficiais) para não
            perder o estado (arquivos já enviados, resultado) ao trocar de aba */}
        <div style={{ marginTop: 18 }}>
          {diaTabs.map((d) => (
            <div key={d.id} style={{ display: diaAtivo === d.id ? 'block' : 'none' }}>
              <div style={{ display: tab === 'geral' ? 'block' : 'none' }}>
                <Validador t={t} tipo="geral" initialDia={d.dia} initialMes={d.mes} />
              </div>
              <div style={{ display: tab === 'oficiais' ? 'block' : 'none' }}>
                <Validador t={t} tipo="oficiais" initialDia={d.dia} initialMes={d.mes} />
              </div>
            </div>
          ))}
        </div>

        <footer style={{ marginTop: 40, textAlign: 'center', fontSize: 12, color: t.muted }}>
          PMMG · 39ª CIA — Validador de Escala
        </footer>
      </div>

      {/* PAINEL DE TEMA */}
      {themeOpen && (
        <div onClick={() => setThemeOpen(false)} className="no-print" style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            position: 'fixed', top: 16, right: 16, width: 230, background: t.card, border: `1px solid ${t.border}`,
            borderRadius: 14, padding: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 51,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.accent, marginBottom: 10 }}>🎨 Tema</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {Object.entries(THEMES).map(([k, th]) => (
                <button key={k} onClick={() => { setThemeKey(k); setThemeOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                    background: themeKey === k ? `rgba(${t.glow},0.12)` : 'transparent',
                    border: `1px solid ${themeKey === k ? t.accent : 'transparent'}`, color: t.text, fontSize: 13, textAlign: 'left',
                  }}>
                  <span style={{ width: 18, height: 18, borderRadius: 99, background: th.swatch, boxShadow: `0 0 8px ${th.swatch}` }} />
                  {th.label}
                  {themeKey === k && <span style={{ marginLeft: 'auto', color: t.accent }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Aba de dia: clique seleciona, duplo-clique renomeia, "✕" remove (some se só sobrar 1 aba).
function DiaTabButton({ t, d, active, onSelect, onRename, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(d.label);

  useEffect(() => { setVal(d.label); }, [d.label]);

  function commit() {
    setEditing(false);
    const v = val.trim();
    if (v) onRename(v); else setVal(d.label);
  }

  return (
    <div className="tab-btn" onClick={!editing ? onSelect : undefined} onDoubleClick={() => setEditing(true)}
      title="Clique para selecionar · duplo-clique para renomear"
      style={{
        display: 'flex', alignItems: 'center', gap: 6, cursor: editing ? 'text' : 'pointer',
        padding: '7px 10px 7px 16px', borderRadius: 9, fontSize: 14, fontWeight: 700,
        background: active ? t.card : 'transparent', color: active ? t.accent : t.muted,
        boxShadow: active ? `inset 0 -2px 0 ${t.accent}` : 'none', transition: 'all .2s',
      }}>
      {editing ? (
        <input autoFocus value={val} onClick={(e) => e.stopPropagation()}
          onChange={(e) => setVal(e.target.value)} onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setVal(d.label); setEditing(false); }
          }}
          style={{
            background: 'transparent', border: 'none', borderBottom: `1px solid ${t.accent}`,
            color: t.text, fontSize: 14, fontWeight: 700, outline: 'none', width: `${Math.max(8, val.length + 2)}ch`,
          }} />
      ) : (
        <span>{d.label} <span style={{ fontWeight: 500, opacity: 0.7 }}>· {d.dia}/{d.mes.slice(0, 3)}</span></span>
      )}
      {onRemove && (
        <span onClick={(e) => { e.stopPropagation(); onRemove(); }} title="Remover aba"
          style={{ marginLeft: 2, fontSize: 12, color: t.muted, cursor: 'pointer', lineHeight: 1, padding: 2 }}>
          ✕
        </span>
      )}
    </div>
  );
}
