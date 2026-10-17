import { Link } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/hooks'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { num } from '../lib/format'
import { Avatar, Card, ErrorBox, PageHeader, Spinner, StatusBadge } from '../components/ui'

export default function Players() {
  const { isAdmin } = useAuth()
  const { settings } = useSettings()
  const { data, loading, error } = useData(() =>
    supabase.from('profiles').select('*').eq('role', 'player').order('created_at'))

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
              <tr><th>#</th><th>Player</th><th>IGN</th><th>UID</th><th>Role</th><th>Phone</th><th>Email</th><th>Status</th><th className="text-right">Salary ({settings.currency})</th></tr>
            </thead>
            <tbody>
              {(data || []).map((p, i) => (
                <tr key={p.id}>
                  <td>{i + 1}</td>
                  <td><span className="flex items-center gap-2"><Avatar name={p.full_name} url={p.avatar_url} size={26} />{p.full_name}</span></td>
                  <td className="font-semibold text-white">{p.ign}</td>
                  <td>{p.game_uid}</td><td>{p.player_role}</td><td>{p.phone}</td><td>{p.email}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td className="text-right">{num(p.monthly_salary)}</td>
                </tr>
              ))}
              {!data?.length && <tr><td colSpan={9} className="py-6 text-center text-slate-500">No players yet.</td></tr>}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
