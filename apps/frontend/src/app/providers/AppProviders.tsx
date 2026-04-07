import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/shared/components/ui/sonner";
import { Toaster } from "@/shared/components/ui/toaster";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import AppErrorBoundary from "@/app/providers/AppErrorBoundary";
import { DataProvider } from "@/features/data/context/DataContext";

const queryClient = new QueryClient();

interface AppProvidersProps {
  children: ReactNode;
}

const AppProviders = ({ children }: AppProvidersProps) => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppErrorBoundary>
          <DataProvider>{children}</DataProvider>
        </AppErrorBoundary>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default AppProviders;
