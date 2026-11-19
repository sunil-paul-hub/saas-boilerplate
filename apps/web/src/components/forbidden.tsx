import { Link } from '@tanstack/react-router'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCan } from '@/app/session'

export function Forbidden() {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted"><ShieldAlert className="size-6 text-muted-foreground" /></div>
      <h1 className="page-title">403: Access denied</h1>
      <p className="max-w-sm text-sm text-muted-foreground">You do not have permission to view this page. Ask an administrator to grant access.</p>
      <Button asChild variant="outline"><Link to="/">Back to dashboard</Link></Button>
    </div>
  )
}

/** Permission gate for a whole page. Use inside a route component. */
export function RequirePermission({ permission, children }: { permission: string; children: React.ReactNode }) {
  const can = useCan()
  return can(permission) ? <>{children}</> : <Forbidden />
}
