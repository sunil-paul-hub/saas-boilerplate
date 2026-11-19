import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

export function Calendar({ className, ...props }: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays
      className={cn('p-2', className)}
      classNames={{
        months: 'flex flex-col', month: 'space-y-2', month_caption: 'flex h-8 items-center justify-center text-sm font-medium',
        nav: 'absolute inset-x-2 top-2 flex items-center justify-between', root: 'relative',
        button_previous: 'inline-flex size-7 items-center justify-center rounded-md border hover:bg-accent', button_next: 'inline-flex size-7 items-center justify-center rounded-md border hover:bg-accent',
        month_grid: 'w-full border-collapse', weekdays: 'flex', weekday: 'w-9 text-center text-xs font-normal text-muted-foreground',
        week: 'mt-1 flex w-full', day: 'size-9 p-0 text-center text-sm',
        day_button: 'inline-flex size-9 items-center justify-center rounded-md hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
        selected: '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary', today: '[&>button]:font-bold [&>button]:underline',
        outside: 'text-muted-foreground opacity-50', disabled: 'opacity-40',
      }}
      components={{ Chevron: ({ orientation }) => (orientation === 'left' ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />) }}
      {...props}
    />
  )
}

/** Value is an ISO date string (yyyy-mm-dd) or null. */
export function DatePicker({ value, onChange, placeholder = 'Pick a date', id, invalid }: { value: string | null | undefined; onChange: (v: string | null) => void; placeholder?: string; id?: string; invalid?: boolean }) {
  const [open, setOpen] = React.useState(false)
  const date = value ? new Date(value) : undefined
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" aria-invalid={invalid} className={cn('w-full justify-start font-normal', !date && 'text-muted-foreground')}>
          <CalendarIcon />{date ? format(date, 'd MMM yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={(d) => { onChange(d ? format(d, 'yyyy-MM-dd') : null); setOpen(false) }} />
        {date && <div className="border-t p-1"><Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => { onChange(null); setOpen(false) }}>Clear date</Button></div>}
      </PopoverContent>
    </Popover>
  )
}
