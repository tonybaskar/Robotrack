import { Settings as SettingsIcon } from 'lucide-react'
import ComingSoon from '../components/ui/ComingSoon'

export default function Settings() {
  return (
    <ComingSoon
      icon={SettingsIcon}
      title="Settings"
      phase="Phase 2"
      description="Trainer profile and application preferences."
    />
  )
}
