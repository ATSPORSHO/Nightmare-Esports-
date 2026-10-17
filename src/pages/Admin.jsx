import { useSearchParams } from 'react-router-dom'
import { Palette, Users, CalendarClock, Zap, Mail, Inbox } from 'lucide-react'
import { PageHeader } from '../components/ui'
import Branding from './admin/Branding'
import PlayersAdmin from './admin/PlayersAdmin'
import SchedulesAdmin from './admin/SchedulesAdmin'
import QuickActionsAdmin from './admin/QuickActionsAdmin'
import RemindersAdmin from './admin/RemindersAdmin'
import SubmissionsAdmin from './admin/SubmissionsAdmin'

const TABS = [
  { key: 'branding', label: 'Branding & Access', icon: Palette, C: Branding },
  { key: 'players', label: 'Players & Accounts', icon: Users, C: PlayersAdmin },
  { key: 'schedules', label: 'Schedules', icon: CalendarClock, C: SchedulesAdmin },
  { key: 'actions', label: 'Quick Actions', icon: Zap, C: QuickActionsAdmin },
  { key: 'reminders', label: 'Reminders', icon: Mail, C: RemindersAdmin },
  { key: 'submissions', label: 'Submissions', icon: Inbox, C: SubmissionsAdmin },
]

export default function Admin() {
  const [params, setParams] = useSearchParams()
  const active = TABS.find((t) => t.key === params.get('tab')) || TABS[0]
  const Active = active.C

  return (
    <div>
      <PageHeader title="Admin Panel" subtitle="Change anything about the team, the site, the players and what each role can do." />
      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setParams({ tab: t.key })}
            className={`btn btn-sm ${active.key === t.key ? 'bg-accent text-white' : 'border border-ink-600 bg-ink-800/60 text-slate-300 hover:bg-ink-700'}`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>
      <Active />
    </div>
  )
}
