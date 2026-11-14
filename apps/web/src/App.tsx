import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { Shell } from './shell/Shell';
import { Skeleton, Toaster } from './ui';
import { SignIn } from './pages/SignIn';

const Home = lazy(() => import('./pages/Home'));
const Leads = lazy(() => import('./pages/Leads'));
const LeadDetail = lazy(() => import('./pages/LeadDetail'));
const LeadForm = lazy(() => import('./pages/LeadForm'));
const FollowUps = lazy(() => import('./pages/FollowUps'));
const Customers = lazy(() => import('./pages/Customers'));
const CustomerForm = lazy(() => import('./pages/CustomerForm'));
const Customer360 = lazy(() => import('./pages/Customer360'));
const SalesHub = lazy(() => import('./pages/SalesHub'));
const QuoteBuilder = lazy(() => import('./pages/QuoteBuilder'));
const QuoteDetail = lazy(() => import('./pages/QuoteDetail'));
const InvoiceDetail = lazy(() => import('./pages/InvoiceDetail'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const PaymentForm = lazy(() => import('./pages/PaymentForm'));
const PaymentDetail = lazy(() => import('./pages/PaymentDetail'));
const Reports = lazy(() => import('./pages/Reports'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Me = lazy(() => import('./pages/Me'));
const Settings = lazy(() => import('./pages/settings/Settings'));
const PublicDoc = lazy(() => import('./pages/PublicDoc'));

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
    <BrowserRouter>
      <AuthProvider>
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
              <Route path="sales/invoices/:id" element={<InvoiceDetail />} />
              <Route path="sales/orders/:id" element={<OrderDetail />} />
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
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}
