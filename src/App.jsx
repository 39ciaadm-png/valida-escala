import { useState, useEffect } from 'react';
import { THEMES } from './themes';
import Validador from './Validador';
import './App.css';

const THEME_KEY = 'validador-escala-theme';

export default function App() {
  const [themeKey, setThemeKey] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved && THEMES[saved] ? saved : 'amareloOuro';
  });
  const [themeOpen, setThemeOpen] = useState(false);
  const [tab, setTab] = useState('geral');
  const t = THEMES[themeKey];

  useEffect(() => { localStorage.setItem(THEME_KEY, themeKey); }, [themeKey]);

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

        {/* ABAS */}
        <div className="no-print" style={{ display: 'flex', gap: 6, marginTop: 20, background: `rgba(${t.glow},0.06)`, padding: 5, borderRadius: 12, width: 'fit-content' }}>
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

        {/* CONTEÚDO — mantém ambos montados para não perder o estado ao trocar de aba */}
        <div style={{ marginTop: 18 }}>
          <div style={{ display: tab === 'geral' ? 'block' : 'none' }}><Validador t={t} tipo="geral" /></div>
          <div style={{ display: tab === 'oficiais' ? 'block' : 'none' }}><Validador t={t} tipo="oficiais" /></div>
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
