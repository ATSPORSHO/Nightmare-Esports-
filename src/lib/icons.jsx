import {
  Image, Upload, CalendarPlus, Wallet, BarChart3, Zap, Trophy, Users, Bell, Mail, FileText,
  Camera, ClipboardList, Swords, Target, Calendar, Star, Settings, Flag, Gamepad2,
} from 'lucide-react'

// Names an admin can pick for a Quick Action button
export const ICONS = {
  Image, Upload, CalendarPlus, Wallet, BarChart3, Zap, Trophy, Users, Bell, Mail, FileText,
  Camera, ClipboardList, Swords, Target, Calendar, Star, Settings, Flag, Gamepad2,
}

export function Icon({ name, ...props }) {
  const C = ICONS[name] || Zap
  return <C {...props} />
}
