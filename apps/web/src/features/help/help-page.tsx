import { Keyboard, LifeBuoy, Mail } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page'
import { useBranding, useTerm } from '@/app/terms'

export function HelpPage() {
  const t = useTerm()
  const b = useBranding()
  const faqs = [
    [`How do I add a ${t('member.singular', { lower: true })}?`, `Open ${t('member.plural')} and roles, choose Invite, then assign a role per ${t('unit.singular', { lower: true })} under Access.`],
    [`Why can I not see a ${t('unit.singular', { lower: true })}?`, `Members only see ${t('unit.plural', { lower: true })} where an administrator has given them a role. Ask an admin to update your access.`],
    [`Can I rename ${t('record.plural', { lower: true })} or ${t('unit.plural', { lower: true })}?`, 'Yes. Owners can change every visible word under Settings, Terminology.'],
    ['Where is the history of changes?', 'The audit log lists every important action with who did it and when.'],
  ]
  return (
    <>
      <PageHeader title="Help" description={`Guides and ways to reach ${b.productName} support.`} />
      <div className="grid max-w-3xl gap-3">
        <Card><CardHeader><div><CardTitle className="flex items-center gap-2"><LifeBuoy className="size-4" />Common questions</CardTitle></div></CardHeader>
          <CardContent className="grid gap-1">{faqs.map(([q, a]) => (
            <details key={q} className="group rounded-md border px-3 py-2 open:bg-muted/40"><summary className="min-h-6 cursor-pointer text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">{q}</summary><p className="mt-1.5 text-sm text-muted-foreground">{a}</p></details>
          ))}</CardContent></Card>
        <Card><CardHeader><div><CardTitle className="flex items-center gap-2"><Keyboard className="size-4" />Keyboard shortcuts</CardTitle><CardDescription>Work faster without the mouse</CardDescription></div></CardHeader>
          <CardContent className="grid gap-2 text-sm">{[['Ctrl K', 'Open search and command palette'], ['Esc', 'Close dialogs, sheets and the chat drawer'], ['Tab', 'Move between controls']].map(([k, d]) => <div key={k} className="flex items-center gap-3"><kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{k}</kbd><span className="text-muted-foreground">{d}</span></div>)}</CardContent></Card>
        <Card><CardHeader><div><CardTitle className="flex items-center gap-2"><Mail className="size-4" />Contact support</CardTitle><CardDescription>We usually reply within one working day.</CardDescription></div></CardHeader>
          <CardContent><Button asChild variant="outline"><a href={`mailto:${b.supportEmail}`}>{b.supportEmail}</a></Button></CardContent></Card>
      </div>
    </>
  )
}
