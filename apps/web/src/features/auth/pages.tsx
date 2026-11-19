import * as React from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { onboarding } from '@base/config'
import { api, USE_MOCK } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form'
import { useTerm } from '@/app/terms'
import { AuthLayout } from './auth-layout'

/** Seeded by packages/db/src/seed.mjs. */
const DEMO_PASSWORD = 'Passw0rd!'
const DEMO_LOGINS = [['owner@acme.test', 'Owner, all branches'], ['manager@acme.test', 'Manager, North Branch only'], ['viewer@acme.test', 'Viewer, read-only'], ['owner@globex.test', 'Owner, trial (setup wizard)'], ['admin@platform.test', 'Platform operator']] as const
const MOCK_LOGINS = [['priya@acme.test', 'Owner'], ['ana@acme.test', 'Member (limited)'], ['operator@platform.test', 'Platform operator']] as const

function afterLogin(me: { isPlatformAdmin: boolean; org: unknown }) {
  return me.isPlatformAdmin && !me.org ? '/platform' : '/'
}

const signInSchema = z.object({ email: z.string().email('Enter a valid email address'), password: z.string().min(1, 'Enter your password') })

export function SignInPage() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const t = useTerm()
  const search = useSearch({ strict: false }) as { redirect?: string }
  const form = useForm<z.infer<typeof signInSchema>>({ resolver: zodResolver(signInSchema), defaultValues: { email: '', password: '' } })
  const login = useMutation({
    mutationFn: api.auth.login,
    onSuccess: (me) => { qc.setQueryData(['me'], me); nav({ to: search.redirect && search.redirect.startsWith('/') ? search.redirect : afterLogin(me) }) },
  })
  return (
    <AuthLayout
      title="Sign in"
      subtitle={`Use your work email to open your ${t('organisation.singular', { lower: true })}.`}
      footer={onboarding.selfServeAllowed ? <>New here? <Link to="/sign-up" className="font-medium text-foreground underline underline-offset-2">Request an account</Link></> : undefined}
    >
      <Form {...form}>
        <form className="grid gap-4" onSubmit={form.handleSubmit((v) => login.mutate(v))} noValidate>
          {login.error && <Alert variant="destructive"><AlertDescription>{login.error.message}</AlertDescription></Alert>}
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" autoComplete="username" placeholder="you@company.com" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="password" render={({ field }) => (
            <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" autoComplete="current-password" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <Button type="submit" size="lg" disabled={login.isPending}>{login.isPending && <Loader2 className="animate-spin" />}Sign in</Button>
        </form>
      </Form>
      {(USE_MOCK || import.meta.env.DEV) && (
        <div className="mt-6 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          <div className="mb-1 font-medium text-foreground">{USE_MOCK ? 'Demo mode (mock data)' : 'Demo logins (local seed data)'}</div>
          <div className="grid gap-1.5">
            {(USE_MOCK ? MOCK_LOGINS : DEMO_LOGINS).map(([e, r]) => (
              <button key={e} type="button" className="flex min-h-8 items-center justify-between rounded px-1 text-left hover:bg-accent" onClick={() => { form.setValue('email', e!); form.setValue('password', USE_MOCK ? 'password' : DEMO_PASSWORD) }}>
                <span>{e}</span><span>{r}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthLayout>
  )
}

const signUpSchema = z.object({
  orgName: z.string().min(2, 'Enter a name'), contactName: z.string().min(2, 'Enter your name'),
  email: z.string().email('Enter a valid email address'), message: z.string().max(500).optional(),
})
export function SignUpPage() {
  const t = useTerm()
  const [done, setDone] = React.useState(false)
  const form = useForm<z.infer<typeof signUpSchema>>({ resolver: zodResolver(signUpSchema), defaultValues: { orgName: '', contactName: '', email: '', message: '' } })
  const req = useMutation({ mutationFn: (v: z.infer<typeof signUpSchema>) => api.onboarding.request({ orgName: v.orgName, contactName: v.contactName, contactEmail: v.email, details: v.message ? { message: v.message } : undefined }), onSuccess: () => setDone(true) })
  const org = t('organisation.singular', { lower: true })
  if (!onboarding.selfServeAllowed) {
    return <AuthLayout title="Invitation only" subtitle="Accounts are created by invitation. Ask your administrator for an invite link." footer={<Link to="/sign-in" className="underline">Back to sign in</Link>}><span /></AuthLayout>
  }
  if (done) {
    return (
      <AuthLayout title="Request received" footer={<Link to="/sign-in" className="font-medium text-foreground underline underline-offset-2">Back to sign in</Link>}>
        <div className="flex flex-col items-center gap-3 rounded-xl border p-6 text-center">
          <CheckCircle2 className="size-8 text-success" />
          <p className="text-sm">{onboarding.approvalRequired ? `Thanks. An operator will review your ${org} request and email you at ${form.getValues('email')} once it is approved.` : `Thanks. Check ${form.getValues('email')} for a link to finish setting up.`}</p>
        </div>
      </AuthLayout>
    )
  }
  return (
    <AuthLayout title={`Request a ${org}`} subtitle={`Tell us about your ${org}. ${onboarding.approvalRequired ? 'We review each request before access is granted.' : `You will get a ${onboarding.trialDays}-day trial.`}`}
      footer={<>Already have an account? <Link to="/sign-in" className="font-medium text-foreground underline underline-offset-2">Sign in</Link></>}>
      <Form {...form}>
        <form className="grid gap-4" onSubmit={form.handleSubmit((v) => req.mutate(v))} noValidate>
          {req.error && <Alert variant="destructive"><AlertDescription>{req.error.message}</AlertDescription></Alert>}
          <FormField control={form.control} name="orgName" render={({ field }) => (<FormItem><FormLabel>{t('organisation.singular')} name</FormLabel><FormControl><Input autoComplete="organization" {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="contactName" render={({ field }) => (<FormItem><FormLabel>Your name</FormLabel><FormControl><Input autoComplete="name" {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Work email</FormLabel><FormControl><Input type="email" autoComplete="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="message" render={({ field }) => (<FormItem><FormLabel>Anything we should know? (optional)</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormDescription>For example how many sites you run.</FormDescription><FormMessage /></FormItem>)} />
          <Button type="submit" size="lg" disabled={req.isPending}>{req.isPending && <Loader2 className="animate-spin" />}Send request</Button>
        </form>
      </Form>
    </AuthLayout>
  )
}

const inviteSchema = z.object({ name: z.string(), password: z.string().min(8, 'Use at least 8 characters'), confirm: z.string() })
export function AcceptInvitePage() {
  const search = useSearch({ strict: false }) as { token?: string }
  const nav = useNavigate()
  const qc = useQueryClient()
  const t = useTerm()
  const form = useForm<z.infer<typeof inviteSchema>>({ resolver: zodResolver(inviteSchema), defaultValues: { name: '', password: '', confirm: '' } })
  const info = useQuery({ queryKey: ['invite-info', search.token], queryFn: () => api.auth.inviteInfo(search.token!), enabled: !!search.token, retry: false })
  const accept = useMutation({
    mutationFn: (v: z.infer<typeof inviteSchema>) => api.auth.acceptInvite({ token: search.token ?? '', name: info.data?.userExists ? undefined : v.name, password: v.password }),
    onSuccess: (me) => { qc.setQueryData(['me'], me); nav({ to: '/' }) },
  })
  return (
    <AuthLayout title="Accept your invitation" subtitle={info.data ? (info.data.userExists ? `Sign in with your existing password to join ${info.data.orgName}.` : `Set a password to join ${info.data.orgName} as ${info.data.email}.`) : `Set a password to join your ${t('organisation.singular', { lower: true })}.`}>
      {(!search.token || info.isError) ? <Alert variant="destructive"><AlertDescription>{!search.token ? 'This invitation link is missing its token.' : (info.error as Error).message}</AlertDescription></Alert> : null}
      <Form {...form}>
        <form className="grid gap-4" onSubmit={form.handleSubmit((v) => {
          if (!info.data?.userExists) {
            if (v.name.trim().length < 2) return form.setError('name', { message: 'Enter your name' })
            if (v.password !== v.confirm) return form.setError('confirm', { message: 'Passwords do not match' })
          }
          accept.mutate(v)
        })} noValidate>
          {accept.error && <Alert variant="destructive"><AlertDescription>{accept.error.message}</AlertDescription></Alert>}
          {!info.data?.userExists && <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Your name</FormLabel><FormControl><Input autoComplete="name" {...field} /></FormControl><FormMessage /></FormItem>)} />}
          <FormField control={form.control} name="password" render={({ field }) => (<FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" autoComplete="new-password" {...field} /></FormControl><FormMessage /></FormItem>)} />
          {!info.data?.userExists && <FormField control={form.control} name="confirm" render={({ field }) => (<FormItem><FormLabel>Confirm password</FormLabel><FormControl><Input type="password" autoComplete="new-password" {...field} /></FormControl><FormMessage /></FormItem>)} />}
          <Button type="submit" size="lg" disabled={accept.isPending || !search.token || info.isError}>{accept.isPending && <Loader2 className="animate-spin" />}Join</Button>
        </form>
      </Form>
    </AuthLayout>
  )
}
