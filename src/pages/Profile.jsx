import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { num } from '../lib/format'
import { Avatar, Card, PageHeader, StatusBadge } from '../components/ui'

export default function Profile() {
  const { profile } = useAuth()
  const { settings } = useSettings()
  if (!profile) return null
  const rows = [
    ['Name', profile.full_name], ['IGN', profile.ign], ['Game UID', profile.game_uid], ['In-game role', profile.player_role],
    ['Email', profile.email], ['Phone', profile.phone], ['Monthly salary', `${num(profile.monthly_salary)} ${settings.currency}`],
  ]
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="My Profile" subtitle="These details were saved by your admin. Ask the admin if something needs changing." />
      <Card>
        <div className="mb-4 flex items-center gap-3">
          <Avatar name={profile.full_name} url={profile.avatar_url} size={56} />
          <div>
            <div className="text-lg font-semibold text-white">{profile.ign || profile.full_name}</div>
            <StatusBadge status={profile.status} />
          </div>
        </div>
        <dl className="divide-y divide-ink-700/60 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between py-2"><dt className="text-slate-400">{k}</dt><dd className="text-white">{v || '—'}</dd></div>
          ))}
        </dl>
      </Card>
    </div>
  )
}
