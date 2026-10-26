import { Modal } from '../../components/ui'
import RegistrationsAll from './RegistrationsAll'

/** Registrations of one tournament (opened from the tournaments list). */
export default function RegistrationsAdmin({ tournament, onClose }) {
  return (
    <Modal title={`Registrations — ${tournament.title}`} onClose={onClose} wide>
      <RegistrationsAll tournamentId={tournament.id} />
    </Modal>
  )
}
