import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Send, Store, Utensils, MessageSquare, FileText, MapPin, Phone, CreditCard, Package, ImagePlus, X, Search, Reply, SmilePlus, Info, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Avatar, Button, Card, EmptyState, getProductImage, formatPeso, formatDateTime, formatQueue, StatusBadge, timeAgo, isImageSource, isEmojiSource, Modal } from '@/components/UI';
import ShopRatingForm from '@/components/ShopRatingForm';
import { ORDER_STATUSES_DELIVERY, ORDER_STATUSES_PICKUP } from '@/data/mockData';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const THREAD_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'image', label: 'Photos' },
  { id: 'menu', label: 'Menus' },
  { id: 'order_receipt', label: 'Orders' },
];
const REACTION_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

/*
  Sidebar line for a receipt message: the live status when the order is still in
  `orders`, otherwise whatever the snapshot carried.

  Lives out here rather than inline in the ternary because a nested IIFE inside a
  five-way nested ternary is unreadable, and this is the only place that needs it.
*/
function receiptPreviewText(message, liveOrdersById) {
  if (!message?.orderId) return 'Order receipt';
  const live = liveOrdersById.get(String(message.orderId));
  const status = live?.status || message.order?.status;
  return status ? `${status} · Order ${message.orderId}` : `Order ${message.orderId} receipt`;
}

export default function Chat() {
  /*
    `orders` is read so the receipt card can resolve the live row instead of the
    frozen snapshot the message carries. See `liveOrdersById`.
  */
  const {
    auth,
    chats,
    vendors,
    customers,
    orders,
    shopRatings,
    getOrCreateChat,
    sendChatMessage,
    sendChatMenu,
    toggleChatReaction,
    uploadMediaFile,
    rateShop,
  } = useApp();
  const [searchParams] = useSearchParams();
  const requestedChatId = searchParams.get('chatId');
  const requestedVendorId = Number(searchParams.get('vendorId')) || null;
  const [activeChatId, setActiveChatId] = useState(null);
  const [mobileShowConversations, setMobileShowConversations] = useState(true);
  const [mobileShowDetails, setMobileShowDetails] = useState(false);
  const [desktopShowDetails, setDesktopShowDetails] = useState(true);
  const [conversationQuery, setConversationQuery] = useState('');
  const [threadQuery, setThreadQuery] = useState('');
  const [threadSearchOpen, setThreadSearchOpen] = useState(false);
  const [threadFiltersOpen, setThreadFiltersOpen] = useState(false);
  const [threadFilter, setThreadFilter] = useState('all');
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState(null);
  const [draft, setDraft] = useState('');
  const [pendingImage, setPendingImage] = useState(null);
  const [imageError, setImageError] = useState('');
  const [sendingImage, setSendingImage] = useState(false);
  const [viewingImage, setViewingImage] = useState('');
  const messagesRef = useRef(null);
  const detailsScrollRef = useRef(null);
  const draftRef = useRef(null);
  const previewUrlRef = useRef('');
  const messageElementsRef = useRef(new Map());
  const highlightTimeoutRef = useRef(null);

  // The preview uses a blob: URL. Revoking it on unmount stops the blob from
  // outliving the composer; every other path clears it explicitly.
  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (detailsScrollRef.current) detailsScrollRef.current.scrollTop = 0;
  }, [activeChatId, mobileShowDetails]);

  const myChats = useMemo(() => chats
    .filter((chat) => auth.role === 'customer'
      ? String(chat.customerId) === String(auth.user.id)
      : String(chat.vendorId) === String(auth.user.id)
        || String(chat.vendorId) === String(auth.user.ownerId))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)), [chats, auth.role, auth.user]);

  useEffect(() => {
    if (requestedChatId && myChats.some((chat) => chat.id === requestedChatId)) {
      setActiveChatId(requestedChatId);
      setMobileShowConversations(false);
    }
  }, [myChats, requestedChatId]);

  useEffect(() => {
    if (auth.role !== 'customer' || !requestedVendorId) return;
    const chat = getOrCreateChat(requestedVendorId, auth.user.id);
    if (chat) {
      setActiveChatId(chat.id);
      setMobileShowConversations(false);
    }
  }, [auth, requestedVendorId, getOrCreateChat]);

  useEffect(() => {
    if (!activeChatId && myChats[0]) setActiveChatId(myChats[0].id);
  }, [activeChatId, myChats]);

  /*
    `find` returns the first match on `id`, so any duplicate row -- one left over
    from a `getOrCreateChat` that opened a second empty thread because a Supabase
    string id failed to equal the numeric one from a route param -- would shadow
    the real thread and render it blank under a correct-looking header.

    Prefer the longest thread among the rows sharing this id, then fall back to
    the first. `normalizeChats` already collapses duplicates sharing a canonical
    `chat-<vendor>-<customer>` key; this covers the rows whose `id` itself differs,
    which is the case where the duplicate was written before normalization ran.
  */
  const activeChat = useMemo(() => {
    const matches = chats.filter((chat) => chat.id === activeChatId);
    if (matches.length < 2) return matches[0];
    return matches.reduce((best, chat) => ((chat.messages?.length || 0) > (best.messages?.length || 0) ? chat : best));
  }, [chats, activeChatId]);

  /*
    Live orders, keyed by a string id.

    `message.order` is a snapshot: `sendChatOrderReceipt` embeds a copy of the
    order at the moment the message was sent, and the receipt card rendered
    `message.order.status` and `message.order.queueNumber` off it. Nothing
    rewrote that copy, so the card said "Received" for the whole life of the
    order while the order itself moved through Preparing, Ready and Completed.
    The vendor changed the status in another tab and the conversation -- the one
    place a customer is actually watching while they wait -- never showed it.

    Resolving by `orderId` on every render ties the card to the `orders` list
    instead, which is already kept current by the 15s remote tick, the
    BroadcastChannel feed and the cross-tab storage listener, so the status moves
    without the chat message itself ever being rewritten.

    Keyed by `String(id)` for the same reason the chat participant lookups are:
    `orderId` is stored on the message as whatever type it had when the order was
    placed, and `orders` carries a mix of numeric and string ids from Supabase.
    A numeric Map key would miss a `'12'` lookup and silently fall back to the
    stale snapshot, which is the bug being fixed.
  */
  const liveOrdersById = useMemo(() => {
    const map = new Map();
    orders.forEach((order) => {
      if (order?.id != null) map.set(String(order.id), order);
    });
    return map;
  }, [orders]);

  const visibleMessages = useMemo(() => {
    const messages = activeChat?.messages || [];
    const query = threadQuery.trim().toLocaleLowerCase();
    return messages.filter((message) => {
      if (threadFilter !== 'all' && message.type !== threadFilter) return false;
      if (!query) return true;
      const liveOrder = message.orderId != null ? liveOrdersById.get(String(message.orderId)) : null;
      const order = liveOrder || message.order;
      const searchable = [
        message.text,
        message.type,
        message.orderId,
        order?.status,
        order?.queueNumber,
        message.replyTo?.sender,
        message.replyTo?.text,
        ...(message.menu || []).flatMap((item) => [item.name, item.description]),
        ...(order?.items || []).flatMap((item) => [item.name, item.notes]),
      ].filter(Boolean).join(' ').toLocaleLowerCase();
      return searchable.includes(query);
    });
  }, [activeChat, liveOrdersById, threadFilter, threadQuery]);

  const visibleChats = useMemo(() => {
    const query = conversationQuery.trim().toLocaleLowerCase();
    if (!query) return myChats;
    return myChats.filter((chat) => {
      const person = auth.role === 'customer'
        ? vendors.find((vendor) => String(vendor.id) === String(chat.vendorId))
        : customers.find((customer) => String(customer.id) === String(chat.customerId));
      const history = (chat.messages || []).map((message) => {
        if (message.type === 'order_receipt') return receiptPreviewText(message, liveOrdersById);
        if (message.type === 'image') return `${message.text || ''} Photo`;
        if (message.type === 'menu') return `${message.text || ''} ${(message.menu || []).map((item) => item.name).join(' ')}`;
        return message.text || '';
      }).join(' ');
      return `${person?.name || person?.fullName || ''} ${history}`.toLocaleLowerCase().includes(query);
    });
  }, [auth.role, conversationQuery, customers, liveOrdersById, myChats, vendors]);

  const latestMessageId = activeChat?.messages.at(-1)?.id;

  useLayoutEffect(() => {
    const container = messagesRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [activeChatId, latestMessageId, mobileShowConversations]);

  const counterpart = useMemo(() => {
    if (!activeChat) return null;
    if (auth.role === 'customer') return vendors.find((vendor) => vendor.id === activeChat.vendorId);
    return customers.find((customer) => customer.id === activeChat.customerId);
  }, [activeChat, auth.role, vendors, customers]);

  // A logo/avatar is either a short emoji or an uploaded image reference.
  // Rendering the raw value put a full URL inside the circle whenever an image
  // had been uploaded, so both are split apart here and handed to Avatar.
  const counterpartAvatar = auth.role === 'customer' ? counterpart?.logo : counterpart?.avatar;
  const counterpartEmoji = isEmojiSource(counterpartAvatar) ? counterpartAvatar : undefined;
  const counterpartSrc = isImageSource(counterpartAvatar) ? counterpartAvatar : undefined;
  const sharedPhotos = (activeChat?.messages || []).filter((message) => message.type === 'image' && isImageSource(message.image));
  const orderMessages = (activeChat?.messages || []).filter((message) => message.type === 'order_receipt');
  const quickReplies = auth.role === 'customer'
    ? ['Hi! Is this available?', 'What time can I pick up my order?', 'Thank you!']
    : ['Thanks for reaching out!', 'We are preparing your order.', 'Your order is ready for pickup.'];
  const isCustomer = auth.role === 'customer';
  const isDarkChat = auth.role === 'customer' || auth.role === 'vendor';
  const pageClass = isCustomer
    ? 'flex min-h-0 flex-1 flex-col bg-[#101014] text-white lg:-mx-8 lg:-my-4 lg:px-8 lg:py-4'
    : 'mx-auto max-w-[1440px] p-3 text-white sm:p-5 lg:p-7';
  const panelClass = isDarkChat
    ? 'border border-white/10 bg-white/[0.045] shadow-none'
    : 'border border-hairline bg-white shadow-sm';
  const panelHeaderClass = isDarkChat ? 'border-b border-white/10' : 'border-b border-hairline';
  const messageCanvasClass = isDarkChat ? 'bg-[#141419]' : 'bg-surface-sunken/70';
  const composerClass = isDarkChat ? 'border-t border-white/10 bg-[#19191f]' : 'border-t border-hairline bg-white';

  const clearImage = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = '';
    }
    setPendingImage(null);
    setImageError('');
  }, []);

  // Validation is duplicated in uploadMediaFile, but it has to run here too:
  // this is what keeps an unsupported file from becoming a preview the user
  // then discovers cannot be sent.
  const selectImage = useCallback((file) => {
    setImageError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageError('Please select an image file.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Images must be 5 MB or smaller.');
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = URL.createObjectURL(file);
    setPendingImage(file);
  }, []);

  const handlePickImage = (event) => {
    const file = event.target.files?.[0];
    // Reset the input so picking the same file twice still fires a change.
    event.target.value = '';
    selectImage(file);
  };

  // Pasting a screenshot straight into the composer.
  const handlePaste = (event) => {
    const file = Array.from(event.clipboardData?.items || [])
      .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
      ?.getAsFile();
    if (!file) return;
    event.preventDefault();
    selectImage(file);
  };

  const handleSend = async (event) => {
    event.preventDefault();
    if (!activeChat || sendingImage) return;
    const target = { vendorId: activeChat.vendorId, customerId: activeChat.customerId };
    if (!pendingImage) {
      if (!draft.trim()) return;
      sendChatMessage({ ...target, text: draft, replyTo });
      setDraft('');
      setReplyTo(null);
      if (draftRef.current) draftRef.current.style.height = '40px';
      return;
    }

    const file = pendingImage;
    const caption = draft;
    setSendingImage(true);
    setImageError('');
    try {
      const result = await uploadMediaFile(file, 'chat');
      if (!result.success) {
        setImageError(result.message || 'Unable to send the photo.');
        return;
      }
      sendChatMessage({ ...target, text: caption, image: result.url, replyTo });
      setDraft('');
      setReplyTo(null);
      if (draftRef.current) draftRef.current.style.height = '40px';
      clearImage();
    } catch (error) {
      // The preview stays put so the send can be retried without re-picking.
      setImageError(error?.message || 'Unable to send the photo.');
    } finally {
      setSendingImage(false);
    }
  };

  const handleDraftChange = (event) => {
    setDraft(event.target.value);
    event.target.style.height = '40px';
    event.target.style.height = `${Math.min(event.target.scrollHeight, 128)}px`;
  };

  const getMessagePreview = (message) => {
    if (message.type === 'image') return message.text || 'Photo';
    if (message.type === 'order_receipt') return `Order receipt #${message.orderId ?? message.order?.id ?? ''}`;
    if (message.type === 'menu') return message.text || 'Shared menu';
    return message.text || 'Message';
  };

  const handleReply = (message) => {
    const sender = message.senderRole === auth.role
      ? 'You'
      : counterpart?.name || counterpart?.fullName || (auth.role === 'customer' ? 'Seller' : 'Buyer');
    setReplyTo({
      messageId: message.id,
      sender,
      text: getMessagePreview(message),
    });
    requestAnimationFrame(() => draftRef.current?.focus());
  };

  const jumpToMessage = (messageId) => {
    setThreadQuery('');
    setThreadFilter('all');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const element = messageElementsRef.current.get(String(messageId));
        if (!element) return;
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedMessageId(String(messageId));
        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = setTimeout(() => setHighlightedMessageId(null), 1600);
      });
    });
  };

  const handleReaction = (messageId, emoji) => {
    toggleChatReaction({ chatId: activeChatId, messageId, emoji });
    setReactionPickerMessageId(null);
  };

  return (
    <div className={pageClass}>
      <div className={`mb-3 flex items-center gap-2 ${isCustomer && !mobileShowConversations ? 'hidden lg:flex' : ''}`}>
        <Link
          to={auth.role === 'customer' ? '/customer' : '/vendor/dashboard'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-line bg-brand-soft text-brand-strong transition hover:bg-brand-muted"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-ink sm:text-xl">Messages</h1>
          </div>
          <p className={`mt-0.5 text-xs ${isDarkChat ? 'text-white/50' : 'text-muted'}`}>Chat directly with {auth.role === 'customer' ? 'sellers' : 'buyers'}.</p>
        </div>
      </div>

      {/*
        The customer shell gives this screen the space between its header and
        bottom navigation. The thread and composer can fill that space without
        guessed viewport offsets or sitting underneath the navigation.
      */}
      <div className={`${isCustomer ? 'grid min-h-0 flex-1 grid-rows-1 gap-2' : 'grid h-[calc(100dvh-11rem-env(safe-area-inset-top)-2*env(safe-area-inset-bottom))] max-h-[820px] grid-rows-1 gap-2 lg:h-[calc(100dvh-8rem-env(safe-area-inset-top)-2*env(safe-area-inset-bottom))]'} ${desktopShowDetails ? 'lg:grid-cols-[220px_minmax(0,1fr)_260px] xl:grid-cols-[240px_minmax(0,1fr)_280px]' : 'lg:grid-cols-[240px_minmax(0,1fr)]'}`}>
        <Card className={`${mobileShowConversations ? 'flex' : 'hidden'} min-h-0 flex-col overflow-hidden rounded-2xl ${panelClass} p-2 lg:flex lg:p-3`}>
          <div className={`shrink-0 px-3 pb-3 pt-2 ${panelHeaderClass}`}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-ink">Conversations</h2>
                <p className="mt-0.5 text-[11px] text-muted">Your recent chats</p>
              </div>
              <span className={`flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-bold ${isDarkChat ? 'bg-violet-500/15 text-violet-300' : 'bg-brand-muted text-brand-deep'}`}>{myChats.length}</span>
            </div>
            <label className={`mt-3 flex min-h-10 items-center gap-2 rounded-xl border px-3 transition focus-within:ring-2 ${isDarkChat ? 'border-white/10 bg-white/[0.06] text-white/50 focus-within:border-violet-400 focus-within:bg-white/[0.09] focus-within:ring-violet-400/20' : 'border-hairline bg-surface-sunken/60 text-muted focus-within:border-brand focus-within:bg-white focus-within:ring-brand-muted'}`}>
              <Search className={`h-4 w-4 shrink-0 ${isDarkChat ? 'text-white/45' : ''}`} aria-hidden="true" />
              <span className="sr-only">Search conversations</span>
              <input
                value={conversationQuery}
                onChange={(event) => setConversationQuery(event.target.value)}
                placeholder="Search conversations"
                className={`min-w-0 flex-1 bg-transparent text-xs outline-none ${isDarkChat ? 'text-white placeholder:text-white/40' : 'text-ink placeholder:text-subtle'}`}
              />
              {conversationQuery && (
                <button type="button" onClick={() => setConversationQuery('')} aria-label="Clear search" className={`flex h-6 w-6 items-center justify-center rounded-md ${isDarkChat ? 'hover:bg-white/10 hover:text-white' : 'hover:bg-white hover:text-ink'}`}>
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pt-2">
            {myChats.length === 0 ? (
              <div className={`mx-2 my-1 rounded-xl px-3 py-8 text-center ${isDarkChat ? 'bg-white/[0.04]' : 'bg-surface-sunken'}`}>
                <MessageSquare className={`mx-auto h-5 w-5 ${isDarkChat ? 'text-white/35' : 'text-subtle'}`} aria-hidden="true" />
                <p className={`mt-2 text-xs ${isDarkChat ? 'text-white/55' : 'text-muted'}`}>No conversations yet.</p>
              </div>
            ) : visibleChats.length === 0 ? (
              <div className={`mx-2 my-1 rounded-xl px-3 py-8 text-center ${isDarkChat ? 'bg-white/[0.04]' : 'bg-surface-sunken'}`}>
                <Search className={`mx-auto h-5 w-5 ${isDarkChat ? 'text-white/35' : 'text-subtle'}`} aria-hidden="true" />
                <p className={`mt-2 text-xs font-medium ${isDarkChat ? 'text-white' : 'text-ink'}`}>No matches found</p>
                <p className={`mt-1 text-[11px] ${isDarkChat ? 'text-white/55' : 'text-muted'}`}>Try another name or keyword.</p>
              </div>
            ) : visibleChats.map((chat) => {
              const person = auth.role === 'customer'
                ? vendors.find((vendor) => vendor.id === chat.vendorId)
                : customers.find((customer) => customer.id === chat.customerId);
              const lastMessage = chat.messages[chat.messages.length - 1];
              const isActive = activeChatId === chat.id;
              const rawAvatar = auth.role === 'customer' ? person?.logo : person?.avatar;
              const emoji = isEmojiSource(rawAvatar) ? rawAvatar : undefined;
              const src = isImageSource(rawAvatar) ? rawAvatar : undefined;
              return (
                <button type="button"
                  key={chat.id}
                  onClick={() => {
                    setActiveChatId(chat.id);
                    setMobileShowConversations(false);
                    setReplyTo(null);
                    setQuickRepliesOpen(false);
                    setThreadQuery('');
                    setThreadFilter('all');
                  }}
                  aria-current={isActive ? 'true' : undefined}
                  className={`mb-1 flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
                    isDarkChat
                      ? isActive ? 'border-violet-400/30 bg-violet-500/15' : 'border-transparent hover:border-white/10 hover:bg-white/[0.06]'
                      : isActive ? 'border-brand-line bg-brand-muted shadow-sm' : 'border-transparent hover:border-brand-line/70 hover:bg-brand-soft/60'
                  }`}
                >
                  <Avatar name={person?.name || person?.fullName || 'User'} emoji={emoji} src={src} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className={`truncate text-sm ${isActive ? 'font-semibold text-ink' : 'font-medium text-ink'}`}>
                        {person?.name || person?.fullName || 'User'}
                      </div>
                      {lastMessage?.createdAt && <span className="shrink-0 text-[10px] text-subtle">{timeAgo(lastMessage.createdAt)}</span>}
                    </div>
                    <div className={`mt-0.5 truncate text-xs ${isDarkChat ? 'text-white/55' : 'text-muted'}`}>
                      {lastMessage?.type === 'menu'
                        ? 'Menu sent'
                        : lastMessage?.type === 'image'
                          ? lastMessage.text || 'Photo sent'
                          : lastMessage?.type === 'order_receipt'
                            /*
                              Live status, not the snapshot. The sidebar is the first
                              thing read when the vendor changes something, and it
                              previously showed the fixed `text` the receipt was sent
                              with ("Order 12 receipt") -- so the list looked dead
                              while the open thread was already tracking.
                            */
                            ? receiptPreviewText(lastMessage, liveOrdersById)
                            : lastMessage?.text || 'Start a conversation'}
                    </div>
                  </div>
                  {isActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className={`${mobileShowConversations || mobileShowDetails ? 'hidden' : 'flex'} min-h-0 flex-col overflow-hidden rounded-2xl ${panelClass} lg:flex`}>
          {!activeChat || !counterpart ? (
            <div className={`flex flex-1 items-center justify-center p-8 ${messageCanvasClass}`}>
              <EmptyState icon={MessageSquare} title="Choose a conversation" description="Open a shop or select a conversation to start chatting." />
            </div>
          ) : (
            <>
              <div className={`flex shrink-0 items-center gap-3 px-3 py-3 sm:px-5 ${panelHeaderClass} ${isDarkChat ? 'bg-[#19191f]' : 'bg-white'}`}>
                <button
                  type="button"
                  onClick={() => {
                    if (mobileShowDetails) setMobileShowDetails(false);
                    else setMobileShowConversations(true);
                  }}
                  aria-label={mobileShowDetails ? 'Back to conversation' : 'Back to conversations'}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition lg:hidden ${isDarkChat ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-muted hover:bg-surface-sunken hover:text-ink'}`}
                >
                  <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <Avatar name={counterpart.name || counterpart.fullName} emoji={counterpartEmoji} src={counterpartSrc} size="md" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-ink">{counterpart.name || counterpart.fullName}</div>
                  <div className={`mt-0.5 text-xs ${isDarkChat ? 'text-white/55' : 'text-muted'}`}>{auth.role === 'customer' ? 'Seller' : 'Buyer'} · Direct message</div>
                </div>
                <div className="ml-auto flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setMobileShowDetails(true)}
                    aria-label="Open chat details"
                    className={`flex h-9 w-9 items-center justify-center rounded-xl transition lg:hidden ${isDarkChat ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-muted hover:bg-surface-sunken hover:text-ink'}`}
                  >
                    <Info className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDesktopShowDetails((visible) => !visible)}
                    aria-label={desktopShowDetails ? 'Hide chat details' : 'Show chat details'}
                    aria-expanded={desktopShowDetails}
                    title={desktopShowDetails ? 'Hide chat details' : 'Show chat details'}
                    className={`hidden h-9 items-center gap-2 rounded-xl px-2.5 text-xs font-medium transition lg:inline-flex ${isDarkChat ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-muted hover:bg-surface-sunken hover:text-ink'}`}
                  >
                    <Info className="h-4 w-4" aria-hidden="true" />
                    <span>Details</span>
                  </button>
                </div>
              </div>
              {activeChat.messages.length > 0 && threadFiltersOpen && (
                <div className={`flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-4 ${panelHeaderClass} ${isDarkChat ? 'bg-[#19191f]' : 'bg-white'}`} aria-label="Conversation tools">
                  <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                    {THREAD_FILTERS.map((filter) => {
                    const count = filter.id === 'all'
                      ? activeChat.messages.length
                      : activeChat.messages.filter((message) => message.type === filter.id).length;
                    const selected = threadFilter === filter.id;
                    return (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => {
                          setThreadFilter(filter.id);
                          setThreadFiltersOpen(false);
                        }}
                        aria-pressed={selected}
                        className={`inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-medium transition-colors ${
                          isDarkChat
                            ? selected ? 'bg-violet-500/15 text-violet-200' : 'text-white/55 hover:bg-white/[0.06] hover:text-white'
                            : selected ? 'bg-brand-soft text-brand-deep' : 'text-muted hover:bg-surface-sunken hover:text-ink'
                        }`}
                      >
                        {filter.label}
                        <span className={selected ? 'opacity-75' : 'opacity-55'}>{count}</span>
                      </button>
                    );
                    })}
                  </div>
                </div>
              )}
              <div ref={messagesRef} className={`flex-1 min-h-0 space-y-3 overflow-y-auto p-3 sm:p-4 ${messageCanvasClass}`} aria-live="polite" aria-label="Messages">
                {activeChat.messages.length === 0 ? (
                  <div className="flex h-full min-h-40 flex-col items-center justify-center text-center">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${isDarkChat ? 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-300/20' : 'bg-white text-brand shadow-sm ring-1 ring-hairline'}`}>
                      <MessageSquare className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <p className={`mt-3 text-sm font-semibold ${isDarkChat ? 'text-white' : 'text-ink'}`}>Start the conversation</p>
                    <p className={`mt-1 max-w-xs text-xs ${isDarkChat ? 'text-white/55' : 'text-muted'}`}>Send a message to connect with {auth.role === 'customer' ? 'the seller' : 'your customer'}.</p>
                  </div>
                ) : visibleMessages.length === 0 ? (
                  <div className="flex h-full min-h-40 flex-col items-center justify-center text-center">
                    <Search className={`h-5 w-5 ${isDarkChat ? 'text-white/40' : 'text-subtle'}`} aria-hidden="true" />
                    <p className={`mt-3 text-sm font-semibold ${isDarkChat ? 'text-white' : 'text-ink'}`}>No messages found</p>
                    <p className={`mt-1 text-xs ${isDarkChat ? 'text-white/55' : 'text-muted'}`}>Try searching for another word or order number.</p>
                  </div>
                ) : visibleMessages.map((message) => {
                  const isMine = message.senderRole === auth.role;
                  const isReceipt = message.type === 'order_receipt';
                  // isImageSource guards the whole branch: a message whose image
                  // failed validation, or one written before this field existed,
                  // must still render as text rather than an empty bubble.
                  const photo = message.type === 'image' && isImageSource(message.image) ? message.image : '';
                  return (
                  <div
                    key={message.id}
                    ref={(element) => {
                      const id = String(message.id);
                      if (element) messageElementsRef.current.set(id, element);
                      else messageElementsRef.current.delete(id);
                    }}
                    className={`group flex scroll-mt-4 flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    data-message-id={message.id}
                  >
                    <div className={`transition-shadow duration-300 ${String(message.id) === highlightedMessageId ? 'rounded-2xl ring-2 ring-violet-400 ring-offset-2 ring-offset-[#141419]' : ''} ${isReceipt ? 'max-w-[94%] sm:max-w-[420px]' : `rounded-2xl ${isMine ? 'bg-violet-600 text-white rounded-br-md shadow-sm shadow-black/20' : isDarkChat ? 'rounded-bl-md border border-white/10 bg-white/[0.07] text-white shadow-none' : 'rounded-bl-md border border-hairline bg-white text-ink shadow-sm'} ${photo ? 'max-w-[80%] sm:max-w-[300px] p-1' : 'max-w-[90%] px-3.5 py-2.5 sm:max-w-[75%]'}`}`}>
                      {message.replyTo && (
                        <button
                          type="button"
                          onClick={() => jumpToMessage(message.replyTo.messageId)}
                          className={`mb-2 block w-full rounded-lg border-l-2 px-2.5 py-1.5 text-left transition ${isMine ? 'border-white/70 bg-white/10 hover:bg-white/15' : isDarkChat ? 'border-violet-300 bg-white/[0.06] hover:bg-white/10' : 'border-brand bg-brand-soft hover:bg-brand-muted'}`}
                          aria-label={`View reply to ${message.replyTo.sender}: ${message.replyTo.text}`}
                        >
                          <span className={`block truncate text-[10px] font-semibold ${isMine ? 'text-white' : isDarkChat ? 'text-violet-300' : 'text-brand-strong'}`}>{message.replyTo.sender}</span>
                          <span className={`mt-0.5 block truncate text-xs ${isMine ? 'text-white/75' : isDarkChat ? 'text-white/70' : 'text-muted'}`}>{message.replyTo.text}</span>
                        </button>
                      )}
                      {photo ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setViewingImage(photo)}
                            className="block w-full overflow-hidden rounded-xl bg-surface-sunken"
                          >
                            <img
                              src={photo}
                              alt={message.text || 'Photo sent'}
                              loading="lazy"
                              decoding="async"
                              className="w-full max-h-72 object-cover"
                            />
                          </button>
                          {message.text && <p className="text-sm whitespace-pre-wrap px-2 pt-2 pb-1">{message.text}</p>}
                        </>
                      ) : message.type === 'order_receipt' ? (
                        (() => {
                          /*
                            Live row when it is still around, snapshot otherwise.
                            The snapshot keeps the receipt readable if the order is
                            ever removed from state, so the card degrades to what
                            it showed before instead of blanking out.
                          */
                          const live = message.orderId != null ? liveOrdersById.get(String(message.orderId)) : undefined;
                          const order = live || message.order;
                          if (!order) return null;
                          const statuses = order.fulfillment === 'DELIVERY' ? ORDER_STATUSES_DELIVERY : ORDER_STATUSES_PICKUP;
                          const currentIdx = statuses.indexOf(order.status);
                          const isFinal = order.status === 'COMPLETED' || order.status === 'CANCELLED' || order.status === 'REJECTED';
                          /*
                            A visible "live" cue only while the order is actually
                            in progress. A permanent pulse on a Completed receipt
                            would be noise, and one that never stops would also
                            announce movement that is not there -- the card updates
                            on the next `orders` tick, not continuously.
                          */
                          const isTracking = !isFinal;
                          return (
                        <div className={`w-full max-w-[360px] sm:max-w-[400px] overflow-hidden rounded-2xl border text-ink ${isDarkChat ? 'border-white/10 bg-[#19191f]' : 'border-hairline bg-white shadow-sm'}`}>
                          <div className={`flex items-center gap-3 border-b px-4 py-3 ${isDarkChat ? 'border-white/10 bg-violet-500/10' : 'border-hairline bg-brand-soft'}`}>
                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isDarkChat ? 'bg-violet-500/15 text-violet-300' : 'bg-white text-brand-strong shadow-sm'}`}>
                              <FileText className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-ink">Order receipt</span>
                                {isTracking && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-brand-strong" title="Updates as the order progresses">
                                    <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" aria-hidden="true" />
                                    Live
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 text-xs text-muted">Order #{message.orderId ?? order.id}</div>
                            </div>
                            {order.status && <StatusBadge status={order.status} />}
                          </div>
                          <div className="space-y-4 p-4">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="rounded-xl bg-surface-sunken px-3 py-2.5">
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Queue number</div>
                                <div className="mt-1 text-sm font-bold text-ink">{formatQueue(order.queueNumber)}</div>
                              </div>
                              <div className="rounded-xl bg-surface-sunken px-3 py-2.5">
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Order placed</div>
                                <div className="mt-1 text-xs font-medium text-ink">{order.createdAt ? formatDateTime(order.createdAt) : '—'}</div>
                              </div>
                            </div>
                            <section>
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                                  <Package className="h-4 w-4 text-brand" aria-hidden="true" />
                                  Items
                                </div>
                                <span className="text-xs text-muted">{(order.items || []).length} {((order.items || []).length === 1) ? 'item' : 'items'}</span>
                              </div>
                              <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                                {(order.items || []).map((item, index) => (
                                  <div key={`${item.menuId}-${index}`} className="flex items-start justify-between gap-3 rounded-xl border border-hairline px-3 py-2.5">
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold text-ink">{item.quantity}× {item.name}</div>
                                      {item.notes && <div className="mt-1 break-words text-[11px] text-muted">{item.notes}</div>}
                                    </div>
                                    <span className="shrink-0 text-xs font-semibold text-ink">{formatPeso(item.price * item.quantity)}</span>
                                  </div>
                                ))}
                              </div>
                            </section>
                            <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-soft px-3 py-3">
                              <span className="text-sm font-semibold text-brand-deep">Total</span>
                              <span className="text-lg font-bold text-brand-deep">{formatPeso(order.total || 0)}</span>
                            </div>
                            <div className="space-y-3 border-t border-dashed border-hairline pt-3 text-xs">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex shrink-0 items-center gap-1.5 text-muted"><CreditCard className="h-3.5 w-3.5" aria-hidden="true" /> <span>Payment</span></div>
                                <span className="text-right font-medium text-ink">{order.paymentMethod || 'To be discussed'}</span>
                              </div>
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex shrink-0 items-center gap-1.5 text-muted"><Package className="h-3.5 w-3.5" aria-hidden="true" /> <span>Fulfillment</span></div>
                                <span className="text-right font-medium text-ink">{order.fulfillment === 'DELIVERY' ? 'Delivery' : 'Pickup'}</span>
                              </div>
                              {order.fulfillment === 'DELIVERY' && (
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex shrink-0 items-center gap-1.5 text-muted"><MapPin className="h-3.5 w-3.5" aria-hidden="true" /> <span>Address</span></div>
                                  <span className="max-w-[65%] break-words text-right font-medium text-ink">{order.customerAddress || 'Not provided'}</span>
                                </div>
                              )}
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex shrink-0 items-center gap-1.5 text-muted"><Phone className="h-3.5 w-3.5" aria-hidden="true" /> <span>Mobile</span></div>
                                <span className="text-right font-medium text-ink">{order.customerMobile || 'Not provided'}</span>
                              </div>
                            </div>
                          {/*
                            The step bar mirrors OrderDetail's ProgressTracker so
                            the two screens read identically. Rendered only while
                            the status is one the tracker knows: `indexOf` returns
                            -1 for a status outside the fulfillment's list, and a
                            -1 index would light up nothing while still drawing a
                            full bar, which reads as progress that never happened.
                            Rejected and Cancelled have no steps, so they get the
                            badge alone.
                          */}
                          {currentIdx >= 0 && !isFinal && (
                            <div className="mt-3 flex items-center gap-1">
                              {statuses.map((step, index) => (
                                <div key={step} className="flex-1 flex flex-col gap-1 min-w-0">
                                  <div
                                    className={`h-1 rounded-full ${
                                      index <= currentIdx
                                        ? 'bg-brand'
                                        : 'bg-hairline-strong'
                                    }`}
                                  />
                                  <div className={`text-[9px] leading-tight truncate ${index <= currentIdx ? 'text-ink font-medium' : 'text-subtle'}`}>
                                    {step}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          </div>
                          {auth.role === 'customer' && order.status === 'COMPLETED' && (
                            <div className="border-t border-white/10">
                              <ShopRatingForm
                                order={order}
                                savedRating={shopRatings.find((rating) => String(rating.orderNumber) === String(order.id))}
                                shop={vendors.find((vendor) => String(vendor.id) === String(order.vendorId))}
                                rateShop={rateShop}
                                dark
                              />
                            </div>
                          )}
                        </div>
                          );
                        })()
                      ) : message.type === 'menu' ? (
                        <div className="w-full max-w-[340px]">
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Utensils className="h-4 w-4" /> {message.text}</div>
                        <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                            {(message.menu || []).map((item) => (
                              <div key={item.id} className={`flex items-center gap-2 p-1.5 rounded-control ${isMine ? 'bg-brand-deep/40' : 'bg-surface-sunken'}`}>
                                <div className="w-8 h-8 rounded-md overflow-hidden bg-hairline shrink-0">
                                  {getProductImage(item.image) && <img src={getProductImage(item.image)} alt={item.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-semibold truncate">{item.name}</div>
                                  <div className={`text-xs truncate ${isMine ? 'text-white/75' : 'text-muted'}`}>{item.description || 'Menu item'}</div>
                                </div>
                                <div className="text-xs font-bold shrink-0">{formatPeso(item.price)}</div>
                              </div>
                            ))}
                          </div>
                          {auth.role === 'customer' && (
                            <Button as={Link} to={`/customer/shops/${activeChat.vendorId}`} size="sm" full className="mt-2">
                              <Store className="w-3.5 h-3.5" /> Open menu / Order now
                            </Button>
                          )}
                        </div>
                      ) : <p className="text-sm whitespace-pre-wrap">{message.text}</p>}
                      <div className={`text-xs mt-1 ${photo ? 'px-2 pb-1' : ''} ${isReceipt ? 'px-1 text-subtle' : isMine ? 'text-white/70' : 'text-subtle'}`}>{timeAgo(message.createdAt)}</div>
                    </div>
                    {(message.reactions || []).length > 0 && (
                      <div className={`mt-1 flex flex-wrap gap-1.5 ${isMine ? 'justify-end' : 'justify-start'}`} aria-label="Message reactions">
                        {message.reactions.map((reaction) => {
                          const reacted = (reaction.userIds || []).some((id) => String(id) === String(auth.user.id));
                          return (
                            <button
                              key={reaction.emoji}
                              type="button"
                              onClick={() => handleReaction(message.id, reaction.emoji)}
                              aria-pressed={reacted}
                              aria-label={`${reaction.emoji} reaction, ${reaction.userIds?.length || 0} ${reaction.userIds?.length === 1 ? 'person' : 'people'}`}
                              className={`inline-flex min-h-7 items-center gap-1 rounded-full border px-2 text-xs transition-colors ${
                                isDarkChat
                                  ? reacted ? 'border-violet-400/40 bg-violet-500/20 text-white' : 'border-white/10 bg-[#19191f] text-white/80 hover:bg-white/10'
                                  : reacted ? 'border-brand-line bg-brand-muted text-brand-deep' : 'border-hairline bg-white text-body hover:bg-surface-sunken'
                              }`}
                            >
                              <span aria-hidden="true">{reaction.emoji}</span>
                              <span>{reaction.userIds?.length || 0}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className={`mt-1 flex items-center gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setReactionPickerMessageId((current) => String(current) === String(message.id) ? null : message.id)}
                          aria-label={`Add reaction to ${getMessagePreview(message)}`}
                          aria-expanded={String(reactionPickerMessageId) === String(message.id)}
                          className={`inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 ${isDarkChat ? 'text-white/45 hover:bg-white/[0.06] hover:text-violet-300' : 'text-muted hover:bg-brand-soft hover:text-brand-strong'}`}
                        >
                          <SmilePlus className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="sr-only sm:not-sr-only">React</span>
                        </button>
                        {String(reactionPickerMessageId) === String(message.id) && (
                          <div
                            role="group"
                            aria-label="Choose a reaction"
                            className={`absolute z-20 bottom-full mb-1 flex gap-1 rounded-full border p-1 shadow-lg ${isMine ? 'right-0' : 'left-0'} ${isDarkChat ? 'border-white/10 bg-[#19191f]' : 'border-hairline bg-white'}`}
                          >
                            {REACTION_OPTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleReaction(message.id, emoji)}
                                aria-label={`React ${emoji}`}
                                className={`flex h-9 w-9 items-center justify-center rounded-full text-lg transition hover:scale-110 ${isDarkChat ? 'hover:bg-white/10' : 'hover:bg-brand-soft'}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleReply(message)}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-medium transition-colors sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 ${isDarkChat ? 'text-white/45 hover:bg-white/[0.06] hover:text-violet-300' : 'text-muted hover:bg-brand-soft hover:text-brand-strong'}`}
                        aria-label={`Reply to ${getMessagePreview(message)}`}
                        title="Reply"
                      >
                        <Reply className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
              <form onSubmit={handleSend} onPaste={handlePaste} className={`shrink-0 px-2.5 py-2 sm:px-4 sm:py-2.5 ${composerClass}`}>
                {replyTo && (
                  <div className={`mb-3 flex items-center gap-3 rounded-xl border px-3 py-2 ${isDarkChat ? 'border-white/10 bg-white/[0.05]' : 'border-brand-line/70 bg-brand-soft/60'}`}>
                    <span className={`h-8 w-1 shrink-0 rounded-full ${isDarkChat ? 'bg-violet-400' : 'bg-brand'}`} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className={`text-[11px] font-semibold ${isDarkChat ? 'text-violet-300' : 'text-brand-strong'}`}>Replying to {replyTo.sender}</div>
                      <div className={`truncate text-xs ${isDarkChat ? 'text-white/65' : 'text-muted'}`}>{replyTo.text}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                      aria-label="Cancel reply"
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${isDarkChat ? 'text-white/55 hover:bg-white/10 hover:text-white' : 'text-muted hover:bg-white hover:text-ink'}`}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
                {quickRepliesOpen && activeChat.messages.length > 0 && !draft && !pendingImage && !replyTo && (
                  <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
                    {quickReplies.map((reply) => (
                      <button
                        key={reply}
                        type="button"
                        onClick={() => {
                          setDraft(reply);
                          setQuickRepliesOpen(false);
                        }}
                        className={`min-h-8 shrink-0 rounded-lg px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${isDarkChat ? 'bg-white/[0.06] text-white/80 hover:bg-violet-500/15' : 'bg-brand-soft text-brand-deep hover:bg-brand-muted'}`}
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                )}
                {pendingImage && (
                  <div className={`mb-3 flex items-center gap-3 rounded-xl border p-2 ${isDarkChat ? 'border-white/10 bg-white/[0.05]' : 'border-brand-line/70 bg-brand-soft/60'}`}>
                    <div className="w-16 h-16 shrink-0 overflow-hidden rounded-control border border-hairline bg-surface-sunken">
                      <img src={previewUrlRef.current} alt="Photo to send" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-ink truncate">{pendingImage.name}</p>
                      <button
                        type="button"
                        onClick={clearImage}
                        className="mt-1 inline-flex min-h-8 items-center gap-1 rounded-md px-1 text-xs text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden="true" /> Remove
                      </button>
                    </div>
                  </div>
                )}
                {imageError && <p className="pb-2 text-xs text-danger">{imageError}</p>}
                <div className={`flex items-center gap-1.5 rounded-xl border p-1 transition focus-within:ring-2 ${isDarkChat ? 'border-white/10 bg-white/[0.05] focus-within:border-violet-400 focus-within:bg-white/[0.08] focus-within:ring-violet-400/20' : 'border-brand-line/70 bg-brand-soft/50 focus-within:border-brand focus-within:bg-white focus-within:ring-brand-muted'}`}>
                  <label
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${isDarkChat ? 'text-violet-300 hover:bg-white/10' : 'text-brand-strong hover:bg-brand-muted'} ${sendingImage ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
                    title="Attach a photo"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePickImage}
                      disabled={sendingImage}
                      className="sr-only"
                    />
                    <ImagePlus className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Attach a photo</span>
                  </label>
                  {activeChat.messages.length > 0 && !draft && !pendingImage && !replyTo && (
                    <button
                      type="button"
                      onClick={() => setQuickRepliesOpen((open) => !open)}
                      aria-label="Quick replies"
                      aria-expanded={quickRepliesOpen}
                      title="Quick replies"
                      className={`flex h-9 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${isDarkChat ? 'text-white/45 hover:bg-white/10 hover:text-violet-300' : 'text-muted hover:bg-brand-muted hover:text-brand-strong'}`}
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${quickRepliesOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                  )}
                  <label htmlFor="chat-draft" className="sr-only">Message</label>
                  <textarea
                    id="chat-draft"
                    ref={draftRef}
                    value={draft}
                    onChange={handleDraftChange}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    rows={1}
                    placeholder="Write a message..."
                    className={`max-h-32 min-h-9 min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-2 py-1.5 text-sm outline-none focus:ring-0 ${isDarkChat ? 'text-white placeholder:text-white/40' : 'text-ink placeholder:text-subtle'}`}
                  />
                  <Button
                    type="submit"
                    aria-label="Send message"
                    disabled={!draft.trim() && !pendingImage}
                    loading={sendingImage}
                    className="h-9 w-9 shrink-0 rounded-lg p-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            </>
          )}
        </Card>
        <Card className={`${mobileShowDetails ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl ${panelClass} ${desktopShowDetails ? 'lg:static lg:flex' : 'lg:hidden'}`}>
          {!activeChat || !counterpart ? (
            <div className={`flex flex-1 items-center justify-center p-6 ${messageCanvasClass}`}>
              <p className={`text-center text-sm ${isDarkChat ? 'text-white/55' : 'text-muted'}`}>Chat details appear when you open a conversation.</p>
            </div>
          ) : (
            <>
              <div className={`flex shrink-0 items-center gap-2 px-4 py-3 ${panelHeaderClass}`}>
                <button
                  type="button"
                  onClick={() => setMobileShowDetails(false)}
                  aria-label="Back to conversation"
                  className={`flex h-9 w-9 items-center justify-center rounded-xl lg:hidden ${isDarkChat ? 'text-white/60 hover:bg-white/10' : 'text-muted hover:bg-surface-sunken'}`}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <h2 className={`text-sm font-semibold ${isDarkChat ? 'text-white' : 'text-ink'}`}>Chat details</h2>
              </div>
              <div ref={detailsScrollRef} className="min-h-0 flex-1 overflow-y-auto">
                <section className={`flex flex-col items-center px-4 py-5 text-center ${panelHeaderClass}`}>
                  <Avatar
                    name={counterpart.name || counterpart.fullName}
                    emoji={counterpartEmoji}
                    src={counterpartSrc}
                    size="lg"
                  />
                  <h3 className={`mt-2.5 max-w-full truncate text-sm font-semibold ${isDarkChat ? 'text-white' : 'text-ink'}`}>
                    {counterpart.name || counterpart.fullName}
                  </h3>
                  <p className={`mt-1 text-xs ${isDarkChat ? 'text-white/55' : 'text-muted'}`}>
                    {auth.role === 'customer' ? 'Seller' : 'Customer'}
                  </p>
                </section>

                <div className="px-4 py-2">
                  <div className={`space-y-2 border-b pb-3 ${isDarkChat ? 'border-white/10' : 'border-hairline'}`}>
                    {auth.role === 'customer' && (
                      <Link
                        to={`/customer/shops/${activeChat.vendorId}`}
                        className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors ${isDarkChat ? 'bg-violet-500/15 text-violet-200 hover:bg-violet-500/25' : 'bg-brand-soft text-brand-deep hover:bg-brand-muted'}`}
                      >
                        <Store className="h-4 w-4" aria-hidden="true" />
                        View shop
                      </Link>
                    )}
                    {activeChat.messages.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setThreadSearchOpen((open) => !open);
                            setThreadQuery('');
                          }}
                          aria-expanded={threadSearchOpen}
                          className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold transition-colors ${isDarkChat ? 'text-white/75 hover:bg-white/[0.06]' : 'text-body hover:bg-surface-sunken'}`}
                        >
                          <Search className="h-4 w-4" aria-hidden="true" />
                          Search messages
                          <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${threadSearchOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                        </button>
                        {threadSearchOpen && (
                          <label className={`flex min-h-9 items-center gap-2 rounded-lg px-2.5 ${isDarkChat ? 'bg-white/[0.06] text-white/45' : 'bg-surface-sunken text-muted'}`}>
                            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className="sr-only">Search messages in this conversation</span>
                            <input
                              autoFocus
                              value={threadQuery}
                              onChange={(event) => setThreadQuery(event.target.value)}
                              placeholder="Search messages"
                              className={`min-w-0 flex-1 bg-transparent text-xs outline-none ${isDarkChat ? 'text-white placeholder:text-white/40' : 'text-ink placeholder:text-subtle'}`}
                            />
                            {threadQuery && <span className="shrink-0 text-[10px]">{visibleMessages.length}</span>}
                          </label>
                        )}
                      </>
                    )}
                    {activeChat.messages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setThreadFiltersOpen((open) => !open)}
                        aria-expanded={threadFiltersOpen}
                        className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold transition-colors ${isDarkChat ? 'text-white/75 hover:bg-white/[0.06]' : 'text-body hover:bg-surface-sunken'}`}
                      >
                        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                        Filter messages
                        {threadFilter !== 'all' && (
                          <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] ${isDarkChat ? 'bg-violet-500/20 text-violet-200' : 'bg-brand-muted text-brand-deep'}`}>
                            {THREAD_FILTERS.find((filter) => filter.id === threadFilter)?.label}
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                  <div className={`flex items-center justify-between py-3 text-xs ${isDarkChat ? 'text-white/55' : 'text-muted'}`}>
                    <span>Messages in this chat</span>
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${isDarkChat ? 'bg-white/[0.06] text-white/75' : 'bg-surface-sunken text-body'}`}>{activeChat.messages.length}</span>
                  </div>

                  <section className={`border-t py-3 ${panelHeaderClass}`}>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className={`text-xs font-semibold ${isDarkChat ? 'text-white/85' : 'text-body'}`}>Shared photos</h3>
                      <span className={`text-[11px] ${isDarkChat ? 'text-white/45' : 'text-muted'}`}>{sharedPhotos.length}</span>
                    </div>
                    {sharedPhotos.length > 0 ? (
                      <div className="grid grid-cols-3 gap-1.5">
                        {sharedPhotos.slice(-9).reverse().map((message) => (
                          <button
                            key={message.id}
                            type="button"
                            onClick={() => setViewingImage(message.image)}
                            aria-label={`View shared photo${message.text ? `: ${message.text}` : ''}`}
                            className="aspect-square overflow-hidden rounded-lg bg-black/10 transition-opacity hover:opacity-80"
                          >
                            <img src={message.image} alt={message.text || 'Shared photo'} loading="lazy" className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className={`py-2 text-xs ${isDarkChat ? 'text-white/40' : 'text-subtle'}`}>Photos shared in this chat will appear here.</p>
                    )}
                  </section>

                  <section className={`border-t py-3 ${panelHeaderClass}`}>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className={`text-xs font-semibold ${isDarkChat ? 'text-white/85' : 'text-body'}`}>Order receipts</h3>
                      <span className={`text-[11px] ${isDarkChat ? 'text-white/45' : 'text-muted'}`}>{orderMessages.length}</span>
                    </div>
                    {orderMessages.length > 0 ? (
                      <div className="space-y-1">
                        {orderMessages.slice(-5).reverse().map((message) => {
                          const order = liveOrdersById.get(String(message.orderId)) || message.order;
                          return (
                            <button
                              key={message.id}
                              type="button"
                              onClick={() => {
                                setMobileShowDetails(false);
                                jumpToMessage(message.id);
                              }}
                              className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-2 text-left transition-colors ${isDarkChat ? 'hover:bg-white/[0.06]' : 'hover:bg-surface-sunken'}`}
                            >
                              <span className={`truncate text-xs font-medium ${isDarkChat ? 'text-white/85' : 'text-body'}`}>Order #{message.orderId ?? order?.id}</span>
                              <span className={`shrink-0 text-[10px] ${isDarkChat ? 'text-white/50' : 'text-muted'}`}>{order?.status || 'Receipt'}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className={`py-2 text-xs ${isDarkChat ? 'text-white/40' : 'text-subtle'}`}>Order receipts will appear here.</p>
                    )}
                  </section>
                  {auth.role === 'vendor' && (
                    <Button type="button" size="sm" variant="outline" full onClick={() => sendChatMenu({ vendorId: auth.user.id, customerId: activeChat.customerId })} className="mt-2">
                      <Utensils className="h-4 w-4" aria-hidden="true" />
                      Send menu
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      {/*
        Reusing Modal gives the full-size view the Escape key, scrim tap and
        focus restore that a hand-rolled overlay would have to reimplement.
      */}
      {viewingImage && (
        <Modal open onClose={() => setViewingImage('')} title="Photo" size="full">
          <img
            src={viewingImage}
            alt="Photo"
            className="max-h-[70vh] w-full object-contain"
          />
        </Modal>
      )}
    </div>
  );
}
