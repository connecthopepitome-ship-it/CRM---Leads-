import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { Shell } from './shell/Shell';
import { ErrorBoundary, Skeleton, Toaster } from './ui';
import { SignIn } from './pages/SignIn';

// Eagerly imported core navigation pages to guarantee instantaneous switching and eliminate chunk 404s
import Home from './pages/Home';
import Leads from './pages/Leads';
import Customers from './pages/Customers';
import SalesHub from './pages/SalesHub';
import FollowUps from './pages/FollowUps';
import Reports from './pages/Reports';
import Settings from './pages/settings/Settings';

// Lazy-loaded secondary pages with resilient auto-retry
function lazyWithRetry<T extends React.ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      console.warn('Chunk failed to load, attempting reload...', error);
      const retryKey = 'chunk_retry_' + window.location.pathname;
      const hasRetried = sessionStorage.getItem(retryKey);
      if (!hasRetried) {
        sessionStorage.setItem(retryKey, 'true');
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });
}

const LeadDetail = lazyWithRetry(() => import('./pages/LeadDetail'));
const LeadForm = lazyWithRetry(() => import('./pages/LeadForm'));
const CustomerForm = lazyWithRetry(() => import('./pages/CustomerForm'));
const Customer360 = lazyWithRetry(() => import('./pages/Customer360'));
const QuoteBuilder = lazyWithRetry(() => import('./pages/QuoteBuilder'));
const QuoteDetail = lazyWithRetry(() => import('./pages/QuoteDetail'));
const InvoiceDetail = lazyWithRetry(() => import('./pages/InvoiceDetail'));
const OrderDetail = lazyWithRetry(() => import('./pages/OrderDetail'));
const PaymentForm = lazyWithRetry(() => import('./pages/PaymentForm'));
const PaymentDetail = lazyWithRetry(() => import('./pages/PaymentDetail'));
const Notifications = lazyWithRetry(() => import('./pages/Notifications'));
const Me = lazyWithRetry(() => import('./pages/Me'));
const PublicDoc = lazyWithRetry(() => import('./pages/PublicDoc'));

function Protected({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="p-6"><Skeleton rows={4} /></div>;
  if (!user) return <Navigate to={`/sign-in?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (user.mustChangePassword && localStorage.getItem('ss-demo-active') !== 'true') return <Navigate to="/sign-in?change=1" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
            <Suspense fallback={<div className="p-6"><Skeleton rows={4} /></div>}>
              <Routes>
                <Route path="/sign-in" element={<SignIn />} />
                <Route path="/s/:token" element={<PublicDoc />} />
                <Route element={<Protected><Shell /></Protected>}>
                  <Route index element={<Home />} />
                  <Route path="leads" element={<Leads />} />
                  <Route path="leads/new" element={<LeadForm />} />
                  <Route path="leads/:id" element={<LeadDetail />} />
                  <Route path="leads/:id/edit" element={<LeadForm />} />
                  <Route path="follow-ups" element={<FollowUps />} />
                  <Route path="customers" element={<Customers />} />
                  <Route path="customers/new" element={<CustomerForm />} />
                  <Route path="customers/:id" element={<Customer360 />} />
                  <Route path="sales" element={<SalesHub />} />
                  <Route path="sales/quotes/new" element={<QuoteBuilder />} />
                  <Route path="sales/quotes/:id" element={<QuoteDetail />} />
                  <Route path="sales/quotes/:id/edit" element={<QuoteBuilder />} />
                  <Route path="sales/orders/new" element={<QuoteBuilder mode="order" />} />
                  <Route path="sales/orders/:id" element={<OrderDetail />} />
                  <Route path="sales/invoices/new" element={<QuoteBuilder mode="invoice" />} />
                  <Route path="sales/invoices/:id" element={<InvoiceDetail />} />
                  <Route path="sales/payments/new" element={<PaymentForm />} />
                  <Route path="sales/payments/:id" element={<PaymentDetail />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="notifications" element={<Notifications />} />
                  <Route path="me" element={<Me />} />
                  <Route path="settings/*" element={<Settings />} />
                  <Route path="*" element={<div className="p-6"><h1 className="text-xl font-semibold">Page not found</h1><p className="text-muted">Check the address or use the menu.</p></div>} />
                </Route>
              </Routes>
            </Suspense>
          </ErrorBoundary>
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
export default App;
