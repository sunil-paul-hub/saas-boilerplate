import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { RecordItem } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { RECORD_STATUSES, recordStatusLabel } from '@/components/status'
import { useTerm } from '@/app/terms'
import { useRecordMutations } from './hooks'

const schema = z.object({
  title: z.string().min(3, 'Enter at least 3 characters').max(200),
  status: z.enum(['open', 'in_progress', 'done', 'archived']),
  notes: z.string().max(5000).optional(),
})
type Values = z.infer<typeof schema>

export function RecordSheet({ open, onOpenChange, record }: { open: boolean; onOpenChange: (o: boolean) => void; record: RecordItem | null }) {
  const t = useTerm()
  const { create, update } = useRecordMutations()
  const form = useForm<Values>({ resolver: zodResolver(schema) as never, defaultValues: { title: '', status: 'open', notes: '' } })
  React.useEffect(() => {
    if (open) form.reset(record ? { title: record.title, status: record.status, notes: record.notes ?? '' } : { title: '', status: 'open', notes: '' })
  }, [open, record, form])
  const pending = create.isPending || update.isPending
  const one = t('record.singular', { lower: true })
  const submit = form.handleSubmit(async (v) => {
    const body = { title: v.title, status: v.status, notes: v.notes ? v.notes : null }
    try {
      if (record) await update.mutateAsync({ id: record.id, ...body }); else await create.mutateAsync(body)
      toast.success(record ? `${t('record.singular')} updated` : `${t('record.singular')} created`)
      onOpenChange(false)
    } catch (e) { toast.error((e as Error).message) }
  })
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 p-0">
        <SheetHeader><SheetTitle>{record ? `Edit ${one}` : `New ${one}`}</SheetTitle><SheetDescription>{record ? record.title : `Fill in the details. You can change them later.`}</SheetDescription></SheetHeader>
        <Form {...form}>
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
            <div className="grid flex-1 content-start gap-4 overflow-y-auto p-4">
              <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input autoFocus {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{RECORD_STATUSES.map((s) => <SelectItem key={s} value={s}>{recordStatusLabel(s)}</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}{record ? 'Save changes' : `Create ${one}`}</Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
