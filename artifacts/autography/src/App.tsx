import { useEffect, useRef, type ReactNode } from 'react';
import {
  ClerkProvider,
  SignIn,
  SignUp,
  Show,
  useClerk,
} from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Link,
  Redirect,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

import { Layout } from '@/components/layout';
import { Board } from '@/pages/board';
import { Constellation } from '@/pages/constellation';
import { PR } from '@/pages/pr';
import { DropView } from '@/pages/drop';
import { Verify } from '@/pages/verify';
import { Receipts } from '@/pages/receipts';
import Podcast from '@/pages/podcast';
import { CutKeyView } from '@/pages/cut';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL
  ?? (import.meta.env.PROD
    ? `${window.location.origin}/api/__clerk`
    : undefined);

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#b9975b',
    colorForeground: '#e7ded7',
    colorMutedForeground: '#a79b93',
    colorDanger: '#e04b43',
    colorBackground: '#171112',
    colorInput: '#241b1c',
    colorInputForeground: '#f4efeb',
    colorNeutral: '#5a4945',
    fontFamily: '"Archivo", sans-serif',
    borderRadius: '2px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#171112] border border-[#4a3937] w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: '!font-[Archivo] !uppercase !tracking-[0.18em] !text-[#f4efeb]',
    headerSubtitle: '!text-[#a79b93]',
    socialButtonsBlockButtonText: '!text-[#e7ded7]',
    formFieldLabel: '!text-[#c7bdb7]',
    footerActionLink: '!text-[#d0ad6b] hover:!text-[#e2c58c]',
    footerActionText: '!text-[#a79b93]',
    dividerText: '!text-[#8f827b]',
    identityPreviewEditButton: '!text-[#d0ad6b]',
    formFieldSuccessText: '!text-[#9fc5ae]',
    alertText: '!text-[#f1c2bc]',
    logoImage: '!h-10',
    socialButtonsBlockButton: '!border-[#5a4945] !bg-[#241b1c] hover:!bg-[#302425]',
    formButtonPrimary: '!bg-[#d8cdc4] !text-[#171112] hover:!bg-[#eee5df] !uppercase !tracking-[0.14em]',
    formFieldInput: '!border-[#5a4945] !bg-[#241b1c] !text-[#f4efeb]',
    dividerLine: '!bg-[#4a3937]',
    alert: '!border-[#78443f] !bg-[#342121]',
    otpCodeFieldInput: '!border-[#5a4945] !bg-[#241b1c] !text-[#f4efeb]',
    main: '!gap-5',
  },
};

function AuthenticatedRoutes() {
  return (
    <Layout>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Board} />
          <Route path="/constellation" component={Constellation} />
          <Route path="/pr/:id" component={PR} />
          <Route path="/drop/:id" component={DropView} />
          <Route path="/verify" component={Verify} />
          <Route path="/receipts" component={Receipts} />
          <Route path="/podcast" component={Podcast} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Layout>
  );
}

function PublicHome() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#100c0d] px-6 text-[#e7ded7]">
      <section className="w-full max-w-3xl border border-[#382d2e] bg-[#171112] px-8 py-14 text-center shadow-2xl shadow-black/30 md:px-16">
        <img src={`${basePath}/logo.svg`} alt="Autography" className="mx-auto h-14 w-auto" />
        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.22em] text-[#8f827b]">Verified production workspace</p>
        <h1 className="mx-auto mt-5 max-w-xl font-serif text-4xl leading-tight text-[#f1e9e3] md:text-6xl">
          Decisions with a human name behind them.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-[#b9ada6]">
          Sign in to review podcast development, briefs, scripts, and audio. Every approval is attributed to your verified session.
        </p>
        <Link
          href="/sign-in"
          className="mt-9 inline-flex min-h-12 items-center justify-center bg-[#d8cdc4] px-8 font-mono text-xs uppercase tracking-[0.16em] text-[#171112] transition hover:bg-[#eee5df]"
        >
          Producer sign in
        </Link>
        <Link href="/verify" className="mt-5 block font-mono text-[10px] uppercase tracking-[0.16em] text-[#d0ad6b] hover:text-[#e2c58c]">
          Verify a public artifact
        </Link>
      </section>
    </main>
  );
}

function PublicRegistryRoute({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-house text-oyster">
      <header className="flex items-center justify-between border-b border-sepia/30 px-4 py-4 sm:px-6">
        <Link href="/" className="font-serif text-lg tracking-[0.08em] text-brass">AUTOGRAPHY</Link>
        <Link href="/sign-in" className="font-system text-xs tracking-[0.12em] text-sepia hover:text-oyster">PRODUCER SIGN IN</Link>
      </header>
      <main>{children}</main>
    </div>
  );
}

function PublicVerifyRoute() {
  return <PublicRegistryRoute><Verify /></PublicRegistryRoute>;
}

function PublicDropRoute() {
  return <PublicRegistryRoute><DropView /></PublicRegistryRoute>;
}

function PublicCutKeyRoute() {
  return <PublicRegistryRoute><CutKeyView /></PublicRegistryRoute>;
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#100c0d] px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#100c0d] px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function HomeRoute() {
  return (
    <>
      <Show when="signed-in"><AuthenticatedRoutes /></Show>
      <Show when="signed-out"><PublicHome /></Show>
    </>
  );
}

function ProtectedRoutes() {
  return (
    <>
      <Show when="signed-in"><AuthenticatedRoutes /></Show>
      <Show when="signed-out"><Redirect to="/" /></Show>
    </>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => addListener(({ user }) => {
    const userId = user?.id ?? null;
    if (previousUserId.current !== undefined && previousUserId.current !== userId) {
      queryClient.clear();
    }
    previousUserId.current = userId;
  }), [addListener]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/verify" component={PublicVerifyRoute} />
      <Route path="/drop/:id" component={PublicDropRoute} />
      <Route path="/cut/:key" component={PublicCutKeyRoute} />
      <Route path="/" component={HomeRoute} />
      <Route component={ProtectedRoutes} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Producer access', subtitle: 'Sign in to review and approve production work' } },
        signUp: { start: { title: 'Create producer access', subtitle: 'Verify your identity before recording decisions' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkQueryClientCacheInvalidator />
      <Router />
    </ClerkProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <ClerkProviderWithRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
