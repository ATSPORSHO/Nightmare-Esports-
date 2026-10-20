/**
 * Send report tables to the admin's Google Sheet through a Google Apps Script "web app".
 * Each tab is rewritten completely on every export, so sending twice never creates duplicates.
 */
export async function pushToSheet({ url, token, scope, from, to, tabs }) {
  const body = JSON.stringify({ token, scope, from, to, tabs })
  const headers = { 'Content-Type': 'text/plain;charset=utf-8' }
  try {
    const res = await fetch(url, { method: 'POST', headers, body })
    const j = await res.json().catch(() => null)
    if (j?.ok) return { ok: true }
    if (j?.error) return { ok: false, error: j.error }
    return { ok: true, unconfirmed: true }
  } catch {
    // the browser may block reading the answer; the data is still delivered
    try {
      await fetch(url, { method: 'POST', mode: 'no-cors', headers, body })
      return { ok: true, unconfirmed: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }
}

export const toCsv2d = (rows) =>
  rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
