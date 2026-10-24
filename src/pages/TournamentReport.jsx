import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/hooks'
import ImageField from '../components/ImageField'
import { Spinner } from '../components/ui'
import { rank, totalOf } from '../lib/tournament'
import bgGreen from '../assets/report/green.jpg'
import bgBlue from '../assets/report/blue.jpg'
import bgRed from '../assets/report/red.jpg'

const fmtDate = (d) => (d ? d.split('-').reverse().join('/') : '')
const fmtTime = (t) => {
  if (!t) return ''
  const [h, m] = String(t).split(':').map(Number)
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

/** Your 3 designs. `bg` is the A4 background; the other colours style the white board, like your Grand Final result post. */
const THEMES = [
  { key: 'green', name: 'Green', bg: bgGreen, head: '#0a6b57', block: '#08755c', line: '#12b98c', fill: '#08755c' },
  { key: 'blue', name: 'Blue', bg: bgBlue, head: '#1d4a9a', block: '#0f3f9e', line: '#2d66dc', fill: '#0d3a94' },
  { key: 'red', name: 'Red', bg: bgRed, head: '#8c1111', block: '#a31212', line: '#e23b3b', fill: '#a31212' },
]
const FONT = "'Bebas Neue', Oswald, 'Arial Narrow', Impact, sans-serif"
const two = (n) => String(Number(n) || 0).padStart(2, '0')

/** Roast-chicken ("chicken dinner") icon for the CD column. */
function Chicken({ w = '4.8mm' }) {
  return (
    <svg viewBox="0 0 64 40" style={{ width: w, height: `calc(${w} / 1.6)`, display: 'block', flexShrink: 0 }} fill="#111">
      <rect x="2" y="34" width="60" height="5" rx="2.5" />
      <path d="M8 33 C6 21 16 13 28 14 C40 15 49 23 49 33 Z" />
      <path d="M44 21 L55 9 a3.2 3.2 0 1 1 4.5 4.5 L48 25 Z" />
      <path d="M13 22 L6 15 a3 3 0 1 0 -4.2 4.2 L10 27 Z" />
    </svg>
  )
}

/** A4 report: one group per page, on your 3 designs. Open from Admin → Tournaments → "A4 report". */
export default function TournamentReport() {
  const { id } = useParams()
  const { data, loading, reload } = useData(async () => {
    const [t, r, g, gt, tm] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).maybeSingle(),
      supabase.from('tournament_rounds').select('*').eq('tournament_id', id).order('sort'),
      supabase.from('tournament_groups').select('*').eq('tournament_id', id).order('sort'),
      supabase.from('tournament_group_teams').select('*').eq('tournament_id', id),
      supabase.from('tournament_teams').select('*').eq('tournament_id', id),
    ])
    return { data: { t: t.data, rounds: r.data || [], groups: g.data || [], gts: gt.data || [], teams: tm.data || [] } }
  }, [id])
  const [themeKey, setThemeKey] = useState(() => { try { return localStorage.getItem('reportTheme2') || 'blue' } catch { return 'blue' } })
  const [rid, setRid] = useState('all')
  const [mode, setMode] = useState('fixture') // 'fixture' = slot list, 'results' = leaderboard
  const [style, setStyle] = useState(() => { try { return localStorage.getItem('reportStyle') || 'list' } catch { return 'list' } }) // 'list' | 'cards'
  const [extra, setExtra] = useState(() => { try { return localStorage.getItem('reportExtra') || '' } catch { return '' } })

  if (loading || !data) return <div className="flex justify-center py-24"><Spinner /></div>
  if (!data.t) return <div className="py-24 text-center text-slate-400">Tournament not found.</div>

  const { t, rounds, groups, gts, teams } = data
  const th = THEMES.find((x) => x.key === themeKey) || THEMES[1]
  const teamById = Object.fromEntries(teams.map((x) => [x.id, x]))
  const roundById = Object.fromEntries(rounds.map((r) => [r.id, r]))
  const pages = groups
    .filter((g) => rid === 'all' || g.round_id === rid)
    .sort((a, b) => (roundById[a.round_id]?.sort || 0) - (roundById[b.round_id]?.sort || 0) || a.sort - b.sort)
  const results = mode === 'results'
  const cards = !results && style === 'cards'

  const pickTheme = (k) => { setThemeKey(k); try { localStorage.setItem('reportTheme2', k) } catch { /* ignore */ } }
  const saveLogo = async (url) => { await supabase.from('tournaments').update({ logo_url: url }).eq('id', id); reload() }
  const saveSponsor = async (url) => { await supabase.from('tournaments').update({ sponsor_url: url }).eq('id', id); reload() }
  const title = String(t.title || '').toUpperCase()
  const titlePt = Math.min(48, Math.max(18, 760 / Math.max(title.length, 1)))

  return (
    <div>
      {/* ---------- controls (not printed) ---------- */}
      <div className="no-print mb-4 space-y-3">
        <Link to="/admin?tab=tournaments" className="inline-flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-300"><ArrowLeft size={13} /> Back to tournaments</Link>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <span className="label">Theme</span>
            <div className="flex gap-2">
              {THEMES.map((x) => (
                <button key={x.key} onClick={() => pickTheme(x.key)} className={`flex items-center gap-2 rounded-lg border p-1.5 pr-3 text-xs font-semibold ${themeKey === x.key ? 'border-accent bg-accent/15 text-white' : 'border-ink-600 text-slate-300'}`}>
                  <img src={x.bg} alt="" className="h-10 w-7 rounded object-cover" /> {x.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">Print</span>
            <div className="flex overflow-hidden rounded-lg border border-ink-600">
              {[['fixture', 'Fixture (slot list)'], ['results', 'Results']].map(([k, l]) => (
                <button key={k} onClick={() => setMode(k)} className={`px-4 py-2 text-xs font-semibold ${mode === k ? 'bg-accent text-white' : 'text-slate-300 hover:bg-ink-700'}`}>{l}</button>
              ))}
            </div>
          </div>
          {!results && (
            <div>
              <span className="label">Slot list style</span>
              <div className="flex overflow-hidden rounded-lg border border-ink-600">
                {[['list', 'List'], ['cards', 'Logo cards']].map(([k, l]) => (
                  <button key={k} onClick={() => { setStyle(k); try { localStorage.setItem('reportStyle', k) } catch { /* ignore */ } }} className={`px-4 py-2 text-xs font-semibold ${style === k ? 'bg-accent text-white' : 'text-slate-300 hover:bg-ink-700'}`}>{l}</button>
                ))}
              </div>
            </div>
          )}
          <label>
            <span className="label">Extra line (optional)</span>
            <input className="input" placeholder="Back to back 5 matches" value={extra} onChange={(e) => { setExtra(e.target.value); try { localStorage.setItem('reportExtra', e.target.value) } catch { /* ignore */ } }} />
          </label>
          <label>
            <span className="label">Round</span>
            <select className="input" value={rid} onChange={(e) => setRid(e.target.value)}>
              <option value="all">All rounds</option>
              {rounds.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <button className="btn-primary" onClick={() => window.print()}><Printer size={16} /> Print / Save PDF ({pages.length} page{pages.length === 1 ? '' : 's'})</button>
        </div>
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <ImageField label="Tournament logo (top right corner)" folder="tournament" value={t.logo_url} onChange={saveLogo} hint="PNG with a transparent background looks best." />
          <ImageField label="Sponsor image (placed above “Sponsored by”)" folder="sponsor" value={t.sponsor_url} onChange={saveSponsor} hint="PNG with a transparent background looks best." />
        </div>
        <p className="text-xs text-slate-500">Fixture = slot list before the match, Results = leaderboard after it (teams that qualified are filled in). One group per A4 page. In the print window choose A4, Portrait, margins None, and tick “Background graphics”.</p>
      </div>

      {/* ---------- A4 pages ---------- */}
      <div className="a4-area overflow-x-auto">
        {!pages.length && <div className="card py-10 text-center text-sm text-slate-400">No groups yet. Draw the groups first.</div>}
        {pages.map((g) => {
          const round = roundById[g.round_id]
          const rows = gts.filter((x) => x.group_id === g.id)
          const list = results ? rank(rows) : [...rows].sort((a, b) => (a.slot || 0) - (b.slot || 0))
          const nRows = Math.max(1, results ? Math.max(Math.min(10, list.length), Math.ceil(list.length / 2)) : Math.ceil(list.length / 2)) // results: 10 on the left, rest on the right, like the Grand Final post
          const GAP = nRows > 10 ? 1.4 : 2.2 // mm between rows
          const h = Math.min(20, ((results ? 145 : 127) - GAP * (nRows - 1)) / nRows) // box height, mm: rows stretch so the board fills the page
          const fs = Math.min(13, h * 0.9) // pt
          const halves = [list.slice(0, nRows), list.slice(nRows)]
          const info = fmtDate(g.match_date)
          const timeTxt = g.match_time ? `${fmtTime(g.match_time)}${g.match_note ? ` (${g.match_note.toUpperCase()})` : ''}` : ''
          const nCols = list.length <= 9 ? 3 : list.length <= 16 ? 4 : 5
          const nCardRows = Math.max(1, Math.ceil(list.length / nCols))
          const cardH = Math.min(42, (140 - 3 * (nCardRows - 1)) / nCardRows)
          const BLK = 12 // rank block width, mm
          const inner = results ? '1fr 8mm 8mm 11mm 9mm' : '1fr'
          const cell = { textAlign: 'center' }
          return (
            <section
              key={g.id}
              className="a4-page relative mx-auto mb-6 overflow-hidden shadow-xl"
              style={{ width: '210mm', height: '297mm', backgroundImage: `url(${th.bg})`, backgroundSize: '100% 100%', color: '#fff', fontFamily: FONT, fontWeight: 400 }}
            >
              {/* tournament logo, top right corner */}
              {t.logo_url && (
                <img src={t.logo_url} alt="" style={{ position: 'absolute', right: '3.5%', top: '1.6%', width: '14%', height: '9.6%', objectFit: 'contain', objectPosition: 'right top' }} />
              )}

              {/* tournament name (replaces the "TOURNAMENT NAME" placeholder) */}
              <div style={{ position: 'absolute', left: '14%', right: '14%', top: '12.4%', height: '6.6%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', whiteSpace: 'nowrap', fontSize: `${titlePt}pt`, lineHeight: 1, letterSpacing: '.02em', textShadow: '0 1px 4px rgba(0,0,0,.35)' }}>
                {title}
              </div>

              {/* group name, in the bar */}
              <div style={{ position: 'absolute', left: '29.7%', width: '42%', top: '19%', height: '4.3%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24pt', letterSpacing: '.06em', textTransform: 'uppercase', textShadow: '0 1px 3px rgba(0,0,0,.45)' }}>
                {g.name}
              </div>

              {/* white board, like the Grand Final result post */}
              <div style={{ position: 'absolute', left: '5%', right: '5%', top: '25.8%' }}>
                <div style={{ background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,.35)' }}>
                  {cards ? (
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${nCols}, 1fr)`, gridAutoRows: `${cardH}mm`, gap: '3mm', padding: '4mm' }}>
                      {list.map((x) => {
                        const tm = teamById[x.team_id]
                        return (
                          <div key={x.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', border: `0.5mm solid ${th.line}`, background: '#fff', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', left: 0, top: 0, zIndex: 1, minWidth: '8.5mm', height: '8.5mm', display: 'flex', alignItems: 'center', justifyContent: 'center', background: th.block, color: '#fff', fontSize: '13pt' }}>{x.slot}</div>
                            <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
                              {tm?.logo_url
                                ? <img src={tm.logo_url} alt="" style={{ position: 'absolute', inset: '2.5mm 4mm 1.5mm', width: 'calc(100% - 8mm)', height: 'calc(100% - 4mm)', objectFit: 'contain' }} />
                                : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: th.line, opacity: 0.35, fontSize: '30pt' }}>{String(tm?.name || '?').slice(0, 2)}</div>}
                            </div>
                            <div style={{ height: '8mm', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2mm', background: th.head, color: '#fff', fontSize: '10.5pt', letterSpacing: '.03em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tm?.name}</div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (<>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '4mm', padding: '0 4mm', height: '11mm', alignItems: 'center', background: th.head, fontSize: '14pt', letterSpacing: '.03em' }}>
                    {[0, 1].map((k) => (
                      <div key={k} style={{ display: 'grid', gridTemplateColumns: `${BLK}mm 1fr`, columnGap: '1.5mm', alignItems: 'center' }}>
                        <span style={{ textAlign: 'center' }}>{results ? 'RANK' : 'SLOT'}</span>
                        <div style={{ display: 'grid', gridTemplateColumns: inner, padding: '0 2mm' }}>
                          <span>TEAM</span>
                          {results && ['PP', 'KP', 'CD', 'TP'].map((c) => <span key={c} style={cell}>{c}</span>)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '4mm', padding: '4mm', alignItems: 'start' }}>
                    {halves.map((half, k) => (
                      <div key={k} style={{ display: 'grid', rowGap: `${GAP}mm` }}>
                        {half.map((x, j) => {
                          const i = k * nRows + j
                          const tm = teamById[x.team_id]
                          const q = results && (x.qualified || (g.qualify > 0 && i < g.qualify))
                          const wwcd = Number(x.wwcd) || 0
                          return (
                            <div key={x.id} style={{ display: 'grid', gridTemplateColumns: `${BLK}mm 1fr`, columnGap: '1.5mm', height: `${h}mm` }}>
                              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: th.block, color: '#fff', fontSize: `${fs * 1.5}pt` }}>
                                {results ? i + 1 : x.slot}
                                <i style={{ position: 'absolute', left: 0, bottom: 0, width: '2mm', height: '2mm', background: '#fff', clipPath: 'polygon(0 0, 100% 100%, 0 100%)' }} />
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: inner, alignItems: 'center', padding: '0 2mm', border: `0.4mm solid ${th.line}`, background: q ? th.fill : '#fff', color: q ? '#fff' : '#0b0b0b', fontSize: `${fs}pt`, letterSpacing: '.02em', textTransform: 'uppercase' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '2mm', minWidth: 0 }}>
                                  {tm?.logo_url && <img src={tm.logo_url} alt="" style={{ height: `${Math.min(h - 2, 9)}mm`, width: `${Math.min(h - 2, 9)}mm`, objectFit: 'contain', flexShrink: 0 }} />}
                                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tm?.name}</span>
                                </span>
                                {results && (
                                  <>
                                    <span style={cell}>{two(x.place_pts)}</span>
                                    <span style={cell}>{two(x.kill_pts)}</span>
                                    <span style={{ ...cell, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.6mm', filter: q ? 'invert(1)' : 'none' }}>
                                      {wwcd > 0 && wwcd <= 2 && Array.from({ length: wwcd }, (_, n) => <Chicken key={n} />)}
                                      {wwcd > 2 && <><Chicken /><span style={{ fontSize: `${fs * 0.8}pt` }}>x{wwcd}</span></>}
                                    </span>
                                    <span style={cell}>{two(totalOf(x))}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                  </>)}
                </div>

                {results && g.qualify > 0 && (
                  <div style={{ marginTop: '6mm', textAlign: 'center', fontSize: '20pt', letterSpacing: '.12em', textTransform: 'uppercase', lineHeight: 1.1, textShadow: '0 1px 3px rgba(0,0,0,.5)' }}>
                    Top {g.qualify} teams qualify
                  </div>
                )}
                {!results && (timeTxt || extra.trim() || info || g.qualify > 0) && (
                  <div style={{ marginTop: '6mm', textAlign: 'center', textShadow: '0 1px 3px rgba(0,0,0,.5)' }}>
                    {timeTxt && <div style={{ fontSize: '22pt', letterSpacing: '.1em', textTransform: 'uppercase', lineHeight: 1.1 }}>Match time : {timeTxt}</div>}
                    {extra.trim() && <div style={{ marginTop: '1mm', fontSize: '16pt', letterSpacing: '.12em', textTransform: 'uppercase', lineHeight: 1.1 }}>{extra}</div>}
                    {info && <div style={{ marginTop: '2mm', fontSize: '12pt', letterSpacing: '.14em', textTransform: 'uppercase', lineHeight: 1.1, opacity: 0.9 }}>Match date : {info}</div>}
                    {g.qualify > 0 && <div style={{ marginTop: '1mm', fontSize: '12pt', letterSpacing: '.14em', textTransform: 'uppercase', lineHeight: 1.1, opacity: 0.9 }}>Top {g.qualify} teams will qualify</div>}
                  </div>
                )}
              </div>

              {/* sponsor image, sits on the line above "SPONSORED BY" */}
              <div style={{ position: 'absolute', left: '47.5%', width: '16.8%', bottom: '5.9%', height: '6.4%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                {t.sponsor_url
                  ? <img src={t.sponsor_url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  : <div className="no-print" style={{ width: '100%', textAlign: 'center', border: '1px dashed rgba(255,255,255,.5)', fontSize: '7pt', padding: '2mm 0', opacity: 0.8 }}>Sponsor image</div>}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
