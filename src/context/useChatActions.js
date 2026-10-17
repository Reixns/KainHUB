import { useCallback } from 'react';
import { nextLocalId, normalizeChats } from '@/context/persistence';

const appendMessage = (chats, { chatId, vendorId, customerId, message }) => {
  const existing = chats.find(
    (chat) => sameParticipant(chat.vendorId, vendorId) && sameParticipant(chat.customerId, customerId),
  );
  if (existing) {
    return normalizeChats(chats.map((chat) => chat.id === existing.id
      ? { ...chat, messages: [...chat.messages, message], updatedAt: message.createdAt }
      : chat));
  }
  return normalizeChats([...chats, {
    id: chatId,
    vendorId,
    customerId,
    messages: [message],
    updatedAt: message.createdAt,
  }]);
};

const chatKey = (vendorId, customerId) => `chat-${vendorId}-${customerId}`;

/*
  Ids arrive as both numbers and strings: route params are strings, `vendors` and
  `customers` hold numbers, and a row that came back from Supabase carries
  whatever type the JSON decoder produced. Comparing them with `===` therefore
  misses an existing thread and opens a second, empty one under the same `id`.

  That is what emptied the conversation view. `Chat.jsx` resolves the open thread
  with `chats.find((chat) => chat.id === activeChatId)`, which returns the FIRST
  match, so a duplicate shadowed the real thread -- the header still named the
  shop, but `messages` came from the empty copy. `normalizeChats` already keys
  threads by a template literal, so it tolerates the mismatch; the lookups below
  have to be as lenient or the duplicate gets created in the first place.
*/
const sameParticipant = (left, right) => String(left ?? '') === String(right ?? '');

export function useChatActions({ setChats, auth, vendors, persistMessage, showToast }) {
  const persistImmediately = useCallback((payload, role = auth.role) => {
    if (!persistMessage || !auth.user) return;
    void persistMessage(payload, role).catch((error) => {
      console.error('[chat] message send failed:', error);
      showToast(error instanceof Error ? error.message : 'Message could not be sent. Check your connection and retry.', 'error');
    });
  }, [persistMessage, auth, showToast]);

  const toggleChatReaction = useCallback(({ chatId, messageId, emoji }) => {
    if (!chatId || !messageId || !emoji || !auth.user) return;
    setChats((current) => normalizeChats(current.map((chat) => {
      if (chat.id !== chatId) return chat;
      const isParticipant = auth.role === 'customer'
        ? sameParticipant(chat.customerId, auth.user.id)
        : sameParticipant(chat.vendorId, auth.user.id) || sameParticipant(chat.vendorId, auth.user.ownerId);
      if (!isParticipant) return chat;
      return {
        ...chat,
        messages: (chat.messages || []).map((message) => {
          if (String(message.id) !== String(messageId)) return message;
          const reactions = Array.isArray(message.reactions) ? message.reactions : [];
          const existing = reactions.find((reaction) => reaction.emoji === emoji);
          const userId = String(auth.user.id);
          const hasReacted = existing?.userIds?.some((id) => String(id) === userId);
          const nextReactions = existing
            ? reactions.map((reaction) => reaction.emoji !== emoji
              ? reaction
              : {
                ...reaction,
                userIds: hasReacted
                  ? reaction.userIds.filter((id) => String(id) !== userId)
                  : [...(reaction.userIds || []), auth.user.id],
              }).filter((reaction) => (reaction.userIds || []).length > 0)
            : [...reactions, { emoji, userIds: [auth.user.id] }];
          return { ...message, reactions: nextReactions };
        }),
      };
    })));
  }, [setChats, auth]);

  const getOrCreateChat = useCallback((vendorId, customerId = auth.role === 'customer' ? auth.user?.id : null) => {
    if (!vendorId || !customerId) return null;
    const chatId = chatKey(vendorId, customerId);
    let result = null;
    setChats((current) => {
      const existing = current.find(
        (chat) => sameParticipant(chat.vendorId, vendorId) && sameParticipant(chat.customerId, customerId),
      );
      if (existing) {
        // Returned rather than a fresh empty thread, so a caller that renders the
        // return value directly sees the history instead of a blank screen.
        result = existing;
        return current;
      }
      const created = { id: chatId, vendorId, customerId, messages: [], updatedAt: new Date().toISOString() };
      result = created;
      // Normalized even on insert: two tabs racing to open the same thread both
      // miss the `existing` lookup above and both insert, and this collapses the
      // pair into the single canonical row `Chat.jsx` can then find.
      return normalizeChats([...current, created]);
    });
    return result;
  }, [setChats, auth]);

  const sendChatMessage = useCallback(({ vendorId, customerId, text, image, replyTo }) => {
    // A photo on its own is a valid message, so the caption is optional. The
    // old `!text?.trim()` guard rejected image-only sends outright.
    const body = text?.trim() || '';
    if ((!body && !image) || !auth.user) return;
    const senderRole = auth.role;
    const senderId = auth.user.id;
    const chatId = `chat-${vendorId}-${customerId}`;
    const message = {
      id: nextLocalId(),
      senderId,
      senderRole,
      // Text messages carry no type at all, which is what the renderer keys
      // off for the plain bubble. Only photo messages are typed.
      ...(image ? { type: 'image', image } : {}),
      text: body,
      ...(replyTo?.messageId ? {
        replyTo: {
          messageId: replyTo.messageId,
          sender: replyTo.sender,
          text: replyTo.text,
        },
      } : {}),
      createdAt: new Date().toISOString(),
    };
    setChats((current) => appendMessage(current, {
      chatId,
      vendorId,
      customerId,
      message,
    }));
    persistImmediately({ chatId, vendorId, customerId, message });
  }, [setChats, auth, persistImmediately]);

  const sendChatMenu = useCallback(({ vendorId, customerId }) => {
    if (!auth.user || auth.role !== 'vendor') return;
    const vendor = vendors.find((item) => String(item.id) === String(vendorId));
    if (!vendor) return;
    const chatId = `chat-${vendorId}-${customerId}`;
    const message = {
      id: nextLocalId(),
      senderId: auth.user.id,
      senderRole: 'vendor',
      type: 'menu',
      menu: vendor.menu || [],
      text: `${vendor.name} shared the menu.`,
      createdAt: new Date().toISOString(),
    };
    setChats((current) => appendMessage(current, {
      chatId,
      vendorId,
      customerId,
      message,
    }));
    persistImmediately({ chatId, vendorId, customerId, message });
  }, [setChats, auth, vendors, persistImmediately]);

  const sendChatOrderReceipt = useCallback(({ order }) => {
    if (!order || !auth.user || auth.role !== 'customer') return;
    const chatId = `chat-${order.vendorId}-${order.customerId}`;
    const message = {
      id: nextLocalId(),
      senderId: auth.user.id,
      senderRole: 'customer',
      type: 'order_receipt',
      orderId: order.id,
      order,
      text: `Order ${order.id} receipt`,
      createdAt: new Date().toISOString(),
    };
    setChats((current) => appendMessage(current, {
      chatId,
      vendorId: order.vendorId,
      customerId: order.customerId,
      message,
    }));
    persistImmediately({
      chatId,
      vendorId: order.vendorId,
      customerId: order.customerId,
      message,
    });
    return chatId;
  }, [setChats, auth, persistImmediately]);

  return { getOrCreateChat, sendChatMessage, sendChatMenu, sendChatOrderReceipt, toggleChatReaction };
}
