import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './button'

/** Cursor-style pager: Previous / Next with a range label. */
export function Pagination({ page, pageSize, total, hasNext, onPrev, onNext, label = 'results' }: {
  page: number; pageSize: number; total?: number; hasNext: boolean; onPrev: () => void; onNext: () => void; label?: string
}) {
  const from = page * pageSize + 1
  return (
    <nav aria-label="pagination" className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>{total !== undefined ? `${from} to ${Math.min(total, (page + 1) * pageSize)} of ${total} ${label}` : `Page ${page + 1}`}</span>
      <div className="flex gap-1.5">
        <Button variant="outline" size="sm" onClick={onPrev} disabled={page === 0}><ChevronLeft />Previous</Button>
        <Button variant="outline" size="sm" onClick={onNext} disabled={!hasNext}>Next<ChevronRight /></Button>
      </div>
    </nav>
  )
}
