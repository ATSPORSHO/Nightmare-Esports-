import { Link } from 'react-router-dom'
import { Settings, ArrowUp, ArrowDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/hooks'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { num } from '../lib/format'
import { movePlayer } from '../lib/roster'
import { Card, ErrorBox, PageHeader, Spinner, StatusBadge } from '../components/ui'

export default function Players() {
  const { isAdmin } = useAuth()
  const { settings } = useSettings()
  const { data, loading, error, reload } = useData(() =>
    supabase.from('profiles').select('*').eq('role', 'player').order('sort_order').order('created_at'))
  const move = async (i, dir) => { await movePlayer(data, i, dir); reload() }

  return (
    <div>
      <PageHeader
        title="Players"
        subtitle="Every player account created by the admin appears here automatically."
        actions={isAdmin && <Link to="/admin?tab=players" className="btn-primary"><Settings size={16} /> Manage players &amp; accounts</Link>}
      />
      <ErrorBox>{error}</ErrorBox>
      <Card className="overflow-x-auto">
        {loading ? <Spinner /> : (
          <table className="tbl">
            <thead>
              <tr><th>#</th>{isAdmin && <th>Order</th>}<th>Player</th><th>IGN</th><th>UID</th><th>Role</th><th>Phone</th><th>Email</th><th>Status</th><th className="text-right">Salary ({settings.currency})</th></tr>
            </thead>
            <tbody>
              {(data || []).map((p, i) => (
                <tr key={p.id}>
                  <td>{i + 1}</td>
                  {isAdmin && (
                    <td className="whitespace-nowrap">
                      <button className="btn-ghost btn-sm mr-1" disabled={i === 0} onClick={() => move(i, -1)} title="Move up"><ArrowUp size={13} /></button>
                      <button className="btn-ghost btn-sm" disabled={i === data.length - 1} onClick={() => move(i, 1)} title="Move down"><ArrowDown size={13} /></button>
                    </td>
                  )}
                  <td>{p.full_name}</td>
                  <td className="font-semibold text-white">{p.ign}</td>
                  <td>{p.game_uid}</td><td>{p.player_role}</td><td>{p.phone}</td><td>{p.email}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td className="text-right">{num(p.monthly_salary)}</td>
                </tr>
              ))}
              {!data?.length && <tr><td colSpan={10} className="py-6 text-center text-slate-500">No players yet.</td></tr>}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
