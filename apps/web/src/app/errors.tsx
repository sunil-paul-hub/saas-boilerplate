import * as React from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { FileQuestion, ServerCrash, ShieldAlert, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { branding } from '@base/config'

function ErrorPage({ icon: Icon, code, title, text, children }: { icon: React.ElementType; code: string; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted"><Icon className="size-7 text-muted-foreground" /></div>
      <div className="text-sm font-medium text-muted-foreground">{code}</div>
      <h1 className="page-title">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      <div className="mt-2 flex gap-2">{children}</div>
    </div>
  )
}

export function NotFoundPage() {
  return <ErrorPage icon={FileQuestion} code="404" title="Page not found" text="The page you are looking for does not exist or was moved."><Button asChild><Link to="/">Go to dashboard</Link></Button></ErrorPage>
}
export function ForbiddenPage() {
  return <ErrorPage icon={ShieldAlert} code="403" title="Access denied" text="You do not have permission to view this page."><Button asChild variant="outline"><Link to="/">Back to dashboard</Link></Button></ErrorPage>
}
export function ServerErrorPage({ error, reset }: { error?: unknown; reset?: () => void }) {
  const router = useRouter()
  return (
    <ErrorPage icon={ServerCrash} code="500" title="Something went wrong" text="An unexpected error occurred. Try again, and contact support if it keeps happening.">
      <Button onClick={() => (reset ? reset() : router.invalidate())}>Try again</Button>
      <Button asChild variant="outline"><Link to="/">Dashboard</Link></Button>
      {import.meta.env.DEV && !!error && <pre className="sr-only">{String((error as Error).message)}</pre>}
    </ErrorPage>
  )
}
export function MaintenancePage() {
  return <ErrorPage icon={Wrench} code="503" title="Down for maintenance" text={`${branding.productName} is being updated and will be back shortly.`}><Button variant="outline" onClick={() => location.reload()}>Refresh</Button></ErrorPage>
}
