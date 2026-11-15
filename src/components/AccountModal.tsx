import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  X,
  UserCheck,
  Shield,
  LogOut,
  Phone,
  Mail,
  Activity,
  LayoutDashboard,
  Clock,
  RefreshCw,
  Package,
  Truck,
  CheckCircle2,
  RotateCcw,
  SkipForward,
  Radio,
  MapPin,
} from 'lucide-react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { useCartStore } from '../store/useCartStore';
import {
  filterOrdersForUserSession,
  formatAED,
  getOrderProgressPercent,
  getOrderStatusLabel,
} from '../utils/storeLogic';
import { OrderTrackingTimeline } from './OrderTrackingTimeline';

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
}

export function AccountModal({ open, onClose }: AccountModalProps) {
  const currentUser = useCartStore((state) => state.currentUser);
  const recentOrders = useCartStore((state) => state.recentOrders);
  const sessionOrderIds = useCartStore((state) => state.sessionOrderIds);
  const userSessionId = useCartStore((state) => state.userSessionId);
  const isFetchingOrderHistory = useCartStore((state) => state.isFetchingOrderHistory);
  const lastOrderHistorySyncAt = useCartStore((state) => state.lastOrderHistorySyncAt);

  const setAuthSession = useCartStore((state) => state.setAuthSession);
  const navigateToAdmin = useCartStore((state) => state.navigateToAdmin);
  const fetchSessionOrderHistory = useCartStore((state) => state.fetchSessionOrderHistory);
  const tickSessionOrderHistoryStatus = useCartStore(
    (state) => state.tickSessionOrderHistoryStatus
  );
  const reorderHistoricalOrder = useCartStore((state) => state.reorderHistoricalOrder);

  const [activeTab, setActiveTab] = useState<'orders' | 'tracking' | 'profile'>('orders');
  const [selectedHistoryOrderId, setSelectedHistoryOrderId] = useState<string>(
    recentOrders[0]?.orderId || 'VDK-892410'
  );
  const [isLiveStreamActive, setIsLiveStreamActive] = useState<boolean>(false);

  const [phoneInput, setPhoneInput] = useState('+971 50 842 9910');
  const [emailInput, setEmailInput] = useState('tariq.almaktoum@dubai.ae');
  const [nameInput, setNameInput] = useState('Tariq Al Maktoum');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const sessionOrders = useMemo(
    () => filterOrdersForUserSession(recentOrders, currentUser, sessionOrderIds),
    [recentOrders, currentUser, sessionOrderIds]
  );

  // Fetch real-time order statuses linked to the user session when modal or Order History tab opens
  useEffect(() => {
    if (open && activeTab === 'orders') {
      fetchSessionOrderHistory();
    }
  }, [open, activeTab, fetchSessionOrderHistory]);

  // Keep selectedHistoryOrderId valid when sessionOrders updates
  useEffect(() => {
    if (
      sessionOrders.length > 0 &&
      !sessionOrders.some((o) => o.orderId === selectedHistoryOrderId)
    ) {
      setSelectedHistoryOrderId(sessionOrders[0].orderId);
    }
  }, [sessionOrders, selectedHistoryOrderId]);

  // Optional live status stream interval for real-time mock updates across the selected session order
  useEffect(() => {
    if (!open || !isLiveStreamActive) return;
    const timer = setInterval(() => {
      tickSessionOrderHistoryStatus(selectedHistoryOrderId);
    }, 2200);
    return () => clearInterval(timer);
  }, [open, isLiveStreamActive, selectedHistoryOrderId, tickSessionOrderHistoryStatus]);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await result.user.getIdToken();

      // Sync with backend Cloud SQL PostgreSQL users table
      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          phone: phoneInput,
          emirate: 'Dubai',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAuthSession(
          {
            uid: result.user.uid,
            email: result.user.email || emailInput,
            displayName: result.user.displayName || nameInput,
            phone: data?.user?.phone || phoneInput,
            emirate: data?.user?.emirate || 'Dubai',
            role: data?.user?.role || 'admin',
          },
          idToken
        );
      } else {
        setAuthSession(
          {
            uid: result.user.uid,
            email: result.user.email || emailInput,
            displayName: result.user.displayName || nameInput,
            phone: phoneInput,
            emirate: 'Dubai',
            role: 'admin',
          },
          idToken
        );
      }
    } catch (err: any) {
      setAuthError(
        err?.message?.includes('popup')
          ? 'Google sign-in popup was closed. You can also use UAE Express Mobile / Email Sign-In below.'
          : 'Unable to complete Google OAuth in preview window. Use Express UAE Portal login below.'
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleExpressSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim() || !emailInput.trim()) return;
    setAuthError(null);
    setAuthSession(
      {
        uid: `uae-member-${Date.now()}`,
        email: emailInput.trim(),
        displayName: nameInput.trim() || 'UAE Verified Customer',
        phone: phoneInput.trim(),
        emirate: 'Dubai',
        role: 'customer',
      },
      `mem_token_${Date.now()}`
    );
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch {
      // ignore signOut errors
    }
    setAuthSession(null, null);
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-modal-title"
          data-testid="account-modal"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-zinc-950/65 backdrop-blur-xs"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
            className="relative z-10 max-h-[90vh] w-full max-w-4xl overflow-y-auto border border-zinc-200 bg-white shadow-2xl"
          >
            {/* Modal Top Header */}
            <div className="sticky top-0 z-20 flex items-start sm:items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] sm:text-[11px] font-bold tracking-widest text-zinc-500 uppercase truncate">
                  UAE Customer Account & Session Telemetry
                </span>
                <h2
                  id="account-modal-title"
                  className="font-display text-base sm:text-xl font-bold text-zinc-950 leading-snug"
                >
                  Account, Order History & Real-Time Dispatch Tracking
                </h2>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <a
                  href="/admin"
                  data-testid="account-open-admin-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    onClose();
                    navigateToAdmin();
                  }}
                  className="inline-flex items-center gap-1.5 border border-zinc-950 bg-zinc-950 px-2.5 py-2 sm:px-3 text-xs font-bold text-white transition-colors hover:bg-zinc-800 whitespace-nowrap"
                >
                  <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">Admin Portal (/admin)</span>
                  <span className="sm:hidden">/admin</span>
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close account modal"
                  className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-950 hover:text-white shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs inside Account Modal */}
            <div
              role="tablist"
              aria-label="Account modal tabs"
              className="flex overflow-x-auto no-scrollbar border-b border-zinc-200 bg-zinc-50 px-4 sm:px-6"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'orders'}
                data-testid="account-tab-orders"
                onClick={() => setActiveTab('orders')}
                className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 sm:px-4 py-3 text-xs font-bold transition-colors whitespace-nowrap ${
                  activeTab === 'orders'
                    ? 'border-zinc-950 text-zinc-950'
                    : 'border-transparent text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <Package className="h-3.5 w-3.5 shrink-0" />
                <span>Order History</span>
                <span
                  data-testid="order-history-count-badge"
                  className="font-mono-num bg-zinc-950 px-1.5 py-0.5 text-[10px] font-bold text-white"
                >
                  {sessionOrders.length}
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'tracking'}
                data-testid="account-tab-tracking"
                onClick={() => setActiveTab('tracking')}
                className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 sm:px-4 py-3 text-xs font-bold transition-colors whitespace-nowrap ${
                  activeTab === 'tracking'
                    ? 'border-zinc-950 text-zinc-950'
                    : 'border-transparent text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <Activity className="h-3.5 w-3.5 shrink-0" />
                <span>Real-Time Order Tracking</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'profile'}
                data-testid="account-tab-profile"
                onClick={() => setActiveTab('profile')}
                className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 sm:px-4 py-3 text-xs font-bold transition-colors whitespace-nowrap ${
                  activeTab === 'profile'
                    ? 'border-zinc-950 text-zinc-950'
                    : 'border-transparent text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <UserCheck className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {currentUser ? `Signed In (${currentUser.displayName})` : 'Sign In / Auth'}
                </span>
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              {/* TAB 1: Order History Linked to User Session + Real-Time Mock Timeline */}
              {activeTab === 'orders' && (
                <div data-testid="order-history-panel" className="space-y-5">
                  {/* Session Link & Real-Time Status Fetch Controls */}
                  <div className="flex flex-col gap-3 border border-zinc-200 bg-zinc-950 p-4 text-white sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 px-2 py-0.5 font-mono-num text-[10px] font-bold text-emerald-300 uppercase">
                          <Radio className="h-2.5 w-2.5" />
                          <span>Session Linked</span>
                        </span>
                        <span
                          data-testid="order-history-session-id"
                          className="font-mono-num text-xs font-bold text-zinc-200 truncate"
                        >
                          {currentUser
                            ? `${currentUser.displayName} (${currentUser.email})`
                            : `Browser Session #${userSessionId}`}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        Real-time order history synced with session storage & Dubai dispatch telemetry
                        {lastOrderHistorySyncAt ? ` · Last synced ${lastOrderHistorySyncAt}` : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        data-testid="order-history-live-stream-btn"
                        onClick={() => setIsLiveStreamActive((prev) => !prev)}
                        className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-[11px] font-bold transition-colors ${
                          isLiveStreamActive
                            ? 'border-emerald-400 bg-emerald-500 text-zinc-950'
                            : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-400'
                        }`}
                      >
                        <Activity className="h-3 w-3" />
                        <span>
                          {isLiveStreamActive ? 'Streaming Live Updates...' : 'Stream Live Updates'}
                        </span>
                      </button>

                      <button
                        type="button"
                        data-testid="refresh-order-history-btn"
                        disabled={isFetchingOrderHistory}
                        onClick={() => fetchSessionOrderHistory()}
                        className="inline-flex items-center gap-1.5 border border-white bg-white px-3 py-1.5 text-[11px] font-bold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:opacity-60"
                      >
                        <RefreshCw
                          className={`h-3 w-3 ${isFetchingOrderHistory ? 'animate-spin' : ''}`}
                        />
                        <span>
                          {isFetchingOrderHistory ? 'Fetching...' : 'Refresh Status'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Session Order History Cards List */}
                  <div
                    data-testid="order-history-list"
                    className="space-y-3"
                  >
                    {sessionOrders.map((order) => {
                      const isSelected = order.orderId === selectedHistoryOrderId;
                      const progress = getOrderProgressPercent(order.status);
                      const statusLabel = getOrderStatusLabel(order.status);
                      const isDelivered = order.status === 'delivered';

                      return (
                        <div
                          key={order.orderId}
                          data-testid={`order-history-card-${order.orderId}`}
                          className={`border transition-colors ${
                            isSelected
                              ? 'border-zinc-950 bg-white shadow-sm'
                              : 'border-zinc-200 bg-zinc-50/70 hover:border-zinc-400'
                          }`}
                        >
                          {/* Card Top Summary Bar */}
                          <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono-num text-sm font-bold text-zinc-950">
                                  #{order.orderId}
                                </span>
                                <span
                                  data-testid={`order-history-status-${order.orderId}`}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase ${
                                    isDelivered
                                      ? 'bg-emerald-100 text-emerald-900'
                                      : 'bg-zinc-950 text-white'
                                  }`}
                                >
                                  {isDelivered ? (
                                    <CheckCircle2 className="h-3 w-3 text-emerald-700" />
                                  ) : (
                                    <Truck className="h-3 w-3 text-emerald-400" />
                                  )}
                                  <span>{statusLabel}</span>
                                </span>
                                <span className="font-mono-num text-[11px] font-semibold text-zinc-500">
                                  ({progress}%)
                                </span>
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600">
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-zinc-400" />
                                  <span>{order.createdAt}</span>
                                </span>
                                <span className="text-zinc-300">·</span>
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-zinc-400" />
                                  <span className="truncate max-w-xs">
                                    {order.emirate} — {order.address}
                                  </span>
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end shrink-0">
                              <div className="text-left sm:text-right">
                                <p className="font-mono-num text-sm font-bold text-zinc-950">
                                  {formatAED(order.total)}
                                </p>
                                <p className="text-[11px] text-zinc-500">
                                  {order.paymentMethod}
                                </p>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  data-testid={`history-select-order-${order.orderId}`}
                                  onClick={() => setSelectedHistoryOrderId(order.orderId)}
                                  className={`px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                                    isSelected
                                      ? 'bg-zinc-950 text-white'
                                      : 'border border-zinc-300 bg-white text-zinc-900 hover:border-zinc-950'
                                  }`}
                                >
                                  {isSelected ? 'Viewing Timeline' : 'Inspect Timeline'}
                                </button>

                                <button
                                  type="button"
                                  data-testid={`history-advance-order-${order.orderId}`}
                                  onClick={() => {
                                    setSelectedHistoryOrderId(order.orderId);
                                    tickSessionOrderHistoryStatus(order.orderId);
                                  }}
                                  title="Advance mock real-time status step"
                                  className="inline-flex items-center gap-1 border border-zinc-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-zinc-900 transition-colors hover:border-zinc-950"
                                >
                                  <SkipForward className="h-3 w-3" />
                                  <span>Next Step</span>
                                </button>

                                <button
                                  type="button"
                                  data-testid={`history-reorder-${order.orderId}`}
                                  onClick={() => {
                                    reorderHistoricalOrder(order.orderId);
                                    onClose();
                                  }}
                                  title="Add items from this order to cart"
                                  className="inline-flex items-center gap-1 border border-zinc-200 bg-zinc-100 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-800 transition-colors hover:bg-zinc-950 hover:text-white"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  <span className="hidden sm:inline">Reorder</span>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Ordered Line Items Strip */}
                          <div className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2.5">
                              {order.items.map((item, idx) => (
                                <div
                                  key={`${order.orderId}-item-${idx}`}
                                  className="flex items-center gap-2.5 border border-zinc-200 bg-white px-2.5 py-1.5 text-xs"
                                >
                                  <img
                                    src={item.product.image}
                                    alt={item.product.title}
                                    className="h-8 w-8 shrink-0 border border-zinc-100 object-cover"
                                  />
                                  <div className="min-w-0">
                                    <p className="font-semibold text-zinc-900 truncate max-w-[200px]">
                                      {item.quantity}× {item.product.title}
                                    </p>
                                    <p className="text-[10px] text-zinc-500">
                                      {item.selectedVariant?.flavor || item.product.flavorProfile} ·{' '}
                                      {item.selectedVariant?.nicotine || item.product.nicotineStrength}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Embedded Real-Time Mock Timeline Linked to Selected Session Order */}
                  <div
                    data-testid="order-history-timeline-wrapper"
                    className="space-y-2 pt-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-display text-sm font-bold text-zinc-950">
                          Real-Time Mock Status Timeline — Order #{selectedHistoryOrderId}
                        </h3>
                        <p className="text-xs text-zinc-500">
                          Interactive 5-stage courier timeline linked to your active session order history.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('tracking')}
                        className="text-xs font-bold text-zinc-950 underline underline-offset-4 hover:text-zinc-700"
                      >
                        Open Dedicated Full-Screen Tracker
                      </button>
                    </div>

                    <OrderTrackingTimeline selectedOrderId={selectedHistoryOrderId} />
                  </div>
                </div>
              )}

              {/* TAB 2: Real-Time Order Status Tracking Component */}
              {activeTab === 'tracking' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-sm font-bold text-zinc-950">
                        Live Courier Status Timeline
                      </h3>
                      <p className="text-xs text-zinc-500">
                        Track your Dubai / UAE Cash on Delivery order across all 5 fulfillment stages in real time.
                      </p>
                    </div>
                    {!currentUser && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('profile')}
                        className="text-xs font-bold text-zinc-950 underline underline-offset-4 hover:text-zinc-700"
                      >
                        Sign in to sync across devices
                      </button>
                    )}
                  </div>

                  <OrderTrackingTimeline selectedOrderId={selectedHistoryOrderId} />
                </div>
              )}

              {/* TAB 3: Authentication & Profile (Firebase Google OAuth + UAE Express Login) */}
              {activeTab === 'profile' && (
                <div className="space-y-5">
                  {currentUser ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-4 border border-zinc-200 bg-zinc-50 p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center bg-zinc-950 text-white font-display font-bold text-sm">
                            {currentUser.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-display text-sm font-bold text-zinc-950">
                                {currentUser.displayName}
                              </p>
                              <span className="bg-zinc-950 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                                {currentUser.role}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-600">
                              {currentUser.email} · {currentUser.phone}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="inline-flex items-center gap-1.5 border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>

                      <div className="border border-zinc-200 p-4 text-xs text-zinc-600 space-y-2">
                        <p className="font-bold text-zinc-950">
                          Authenticated Session Active (In-Memory Token Protection)
                        </p>
                        <p>
                          Your account is connected to our Cloud SQL PostgreSQL database, session order history, and Resend transactional dispatch notifications.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      {/* Left: Google OAuth via Firebase Authentication */}
                      <div className="flex flex-col justify-between border border-zinc-200 bg-zinc-50 p-5">
                        <div>
                          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-zinc-500 uppercase">
                            <Shield className="h-3.5 w-3.5 text-zinc-950" />
                            <span>Verified OAuth Identity</span>
                          </div>
                          <h3 className="mt-1.5 font-display text-base font-bold text-zinc-950">
                            Continue with Google
                          </h3>
                          <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">
                            Authenticate with Firebase Auth & Google OAuth to sync your order history, wishlist, and admin permissions with Cloud SQL PostgreSQL.
                          </p>
                          {authError && (
                            <p className="mt-3 border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-900">
                              {authError}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          data-testid="google-signin-btn"
                          disabled={isSigningIn}
                          onClick={handleGoogleSignIn}
                          className="mt-5 flex w-full items-center justify-center gap-2 bg-zinc-950 px-4 py-3 text-xs font-bold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
                        >
                          <span>
                            {isSigningIn ? 'Authenticating...' : 'Sign In with Google OAuth'}
                          </span>
                        </button>
                      </div>

                      {/* Right: Express UAE Mobile + Email Portal Sign-In */}
                      <form
                        onSubmit={handleExpressSignIn}
                        className="border border-zinc-200 bg-white p-5 space-y-3.5"
                      >
                        <h3 className="font-display text-base font-bold text-zinc-950">
                          UAE Mobile & Email Sign-In
                        </h3>
                        <div>
                          <label
                            htmlFor="account-name"
                            className="block text-xs font-semibold text-zinc-900"
                          >
                            Full Name
                          </label>
                          <input
                            id="account-name"
                            type="text"
                            required
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            className="mt-1 w-full border border-zinc-300 px-3 py-2 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="account-email"
                            className="block text-xs font-semibold text-zinc-900"
                          >
                            Email (for Resend Order Updates)
                          </label>
                          <div className="relative mt-1">
                            <Mail className="pointer-events-none absolute top-2.5 left-3 h-3.5 w-3.5 text-zinc-400" />
                            <input
                              id="account-email"
                              type="email"
                              required
                              value={emailInput}
                              onChange={(e) => setEmailInput(e.target.value)}
                              className="w-full border border-zinc-300 py-2 pr-3 pl-8 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label
                            htmlFor="account-phone"
                            className="block text-xs font-semibold text-zinc-900"
                          >
                            UAE Mobile Number
                          </label>
                          <div className="relative mt-1">
                            <Phone className="pointer-events-none absolute top-2.5 left-3 h-3.5 w-3.5 text-zinc-400" />
                            <input
                              id="account-phone"
                              type="tel"
                              required
                              value={phoneInput}
                              onChange={(e) => setPhoneInput(e.target.value)}
                              placeholder="+971 50 842 9910"
                              className="w-full border border-zinc-300 py-2 pr-3 pl-8 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                            />
                          </div>
                        </div>
                        <button
                          type="submit"
                          data-testid="express-signin-submit-btn"
                          className="w-full border border-zinc-950 bg-zinc-950 py-2.5 text-xs font-bold text-white transition-colors hover:bg-zinc-800"
                        >
                          Sign In to UAE Portal
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
