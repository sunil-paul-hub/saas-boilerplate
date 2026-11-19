import * as React from 'react'
import { Slot } from 'radix-ui'
import { Controller, FormProvider, useFormContext, useFormState, type ControllerProps, type FieldPath, type FieldValues } from 'react-hook-form'
import { cn } from '@/lib/utils'
import { Label } from './label'

export const Form = FormProvider

type FieldCtx = { name: string }
const FormFieldContext = React.createContext<FieldCtx>({} as FieldCtx)
const FormItemContext = React.createContext<{ id: string }>({} as { id: string })

export function FormField<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>(props: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

export function useFormField() {
  const field = React.useContext(FormFieldContext)
  const item = React.useContext(FormItemContext)
  const { getFieldState } = useFormContext()
  const formState = useFormState({ name: field.name })
  const state = getFieldState(field.name, formState)
  return {
    id: item.id, name: field.name, formItemId: `${item.id}-form-item`, formDescriptionId: `${item.id}-form-item-description`,
    formMessageId: `${item.id}-form-item-message`, ...state,
  }
}

export function FormItem({ className, ...props }: React.ComponentProps<'div'>) {
  const id = React.useId()
  return <FormItemContext.Provider value={{ id }}><div className={cn('grid gap-1.5', className)} {...props} /></FormItemContext.Provider>
}
export function FormLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  const { error, formItemId } = useFormField()
  return <Label className={cn(error && 'text-destructive', className)} htmlFor={formItemId} {...props} />
}
export function FormControl(props: React.ComponentProps<typeof Slot.Root>) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()
  return <Slot.Root id={formItemId} aria-describedby={!error ? formDescriptionId : `${formDescriptionId} ${formMessageId}`} aria-invalid={!!error} {...props} />
}
export function FormDescription({ className, ...props }: React.ComponentProps<'p'>) {
  const { formDescriptionId } = useFormField()
  return <p id={formDescriptionId} className={cn('text-xs text-muted-foreground', className)} {...props} />
}
export function FormMessage({ className, children, ...props }: React.ComponentProps<'p'>) {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error?.message ?? '') : children
  if (!body) return null
  return <p id={formMessageId} role="alert" className={cn('text-xs text-destructive', className)} {...props}>{body}</p>
}
