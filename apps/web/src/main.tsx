import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import './index.css'
import { router } from '@/app/router'
import { PrefsProvider } from '@/app/prefs'
import { TermProvider } from '@/app/terms'
import { ChatDrawerProvider } from '@/app/chat-drawer-context'
import { PaletteProvider } from '@/app/command-palette'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } } })

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <PrefsProvider>
        <TermProvider>
          <TooltipProvider>
            <ChatDrawerProvider>
              <RouterProvider router={router} context={{ queryClient }} InnerWrap={({ children }) => <PaletteProvider>{children}</PaletteProvider>} />
            </ChatDrawerProvider>
          </TooltipProvider>
          <Toaster position="bottom-right" />
        </TermProvider>
      </PrefsProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
