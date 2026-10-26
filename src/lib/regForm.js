const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

/** Opens a printable A4 "Registration confirmation" page (the person can print it or save it as PDF). */
export function printConfirmation({ code, tournament, team, tag, country, contact, players, drive, created }) {
  const w = window.open('', '_blank')
  if (!w) { window.alert('Please allow pop-ups to print the confirmation.'); return }
  const when = new Date(created || Date.now()).toLocaleString('en-GB')
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Registration ${esc(code)}</title>
<style>
@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#111}
.page{width:210mm;min-height:297mm;padding:16mm 16mm 12mm;position:relative}
.bar{height:5mm;background:#c8102e;margin:-16mm -16mm 10mm}
h1{margin:0;font-size:22pt;letter-spacing:.04em;text-transform:uppercase}h2{margin:2mm 0 0;font-size:12pt;color:#c8102e;letter-spacing:.2em;text-transform:uppercase}
.code{margin:9mm 0;border:1mm solid #111;padding:6mm;text-align:center}.code small{display:block;letter-spacing:.3em;font-size:9pt;text-transform:uppercase}.code b{font-size:54pt;letter-spacing:.1em}
table{width:100%;border-collapse:collapse;font-size:11pt}td{border:.3mm solid #999;padding:3mm}td:first-child{width:45mm;background:#f2f2f2;font-weight:bold}
.note{margin-top:8mm;font-size:10pt;line-height:1.5;border-left:1.2mm solid #c8102e;padding-left:4mm}
.sign{position:absolute;left:16mm;right:16mm;bottom:14mm;display:flex;justify-content:space-between;font-size:9pt}.sign div{width:70mm;border-top:.3mm solid #111;padding-top:2mm}
</style></head><body><div class="page"><div class="bar"></div>
<h1>Registration confirmation</h1><h2>${esc(tournament)}</h2>
<div class="code"><small>Confirmation code</small><b>#${esc(code)}</b></div>
<table>
<tr><td>Team name</td><td>${esc(team)}${tag ? ` [${esc(tag)}]` : ''}</td></tr>
${country ? `<tr><td>Country</td><td>${esc(country)}</td></tr>` : ''}
<tr><td>Contact</td><td>${esc(contact)}</td></tr>
<tr><td>Players</td><td>${(players || []).map((p, i) => `${i + 1}. ${esc(p)}${i >= 4 ? ' (optional)' : ''}`).join('<br>')}</td></tr>
<tr><td>Player photos (Google Drive)</td><td style="word-break:break-all">${esc(drive)}</td></tr>
<tr><td>Submitted</td><td>${esc(when)}</td></tr>
<tr><td>Status</td><td>Pending – confirmed by the organizers</td></tr>
</table>
<div class="note">Keep this form. Your registration is only confirmed when the organizers approve it, and you will need the code <b>#${esc(code)}</b> to confirm it with them.</div>
<div class="sign"><div>Team leader signature</div><div>Organizer</div></div></div>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`)
  w.document.close()
}
