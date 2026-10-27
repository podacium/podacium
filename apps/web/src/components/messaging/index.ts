/**
 * Messaging Components - Enterprise Grade
 *
 * Export all messaging components and hooks.
 */

// Components
export { MessagingLayout } from "./MessagingLayout";
export { ConversationList } from "./ConversationList";
export { MessageThread } from "./MessageThread";
export { MessageInput } from "./MessageInput";
export { AudioWaveformPlayer } from "./AudioWaveformPlayer";
export { FileAttachmentCard } from "./FileAttachmentCard";
export { FilePreviewModal } from "./FilePreviewModal";
export { FileRejectionNotice } from "./FileRejectionNotice";

// Hooks
export { useMessaging } from "./hooks/useMessaging";

// Types
export type {
  // Enums
  ConversationType,
  ParticipantRole,
  MessageType,
  MessageStatus,

  // Base interfaces
  User,
  Participant,
  MessageAttachment,
  MessageReaction,
  MessageReadReceipt,
  Message,
  Conversation,

  // API responses
  ConversationListResponse,
  MessageListResponse,
  CanMessageResponse,

  // Requests
  CreateMessageRequest,
  CreateDirectConversationRequest,
  CreateConversationRequest,
  UpdateMessageRequest,
  MarkAsReadRequest,
  UpdateParticipantRequest,
  AddReactionRequest,

  // Events
  MessageEvent,
  NewMessageEvent,
  MessageUpdatedEvent,
  MessageDeletedEvent,
  ReadReceiptEvent,
  ReactionEvent,
  TypingIndicatorEvent,
  MessagingEvent,

  // State
  MessagingState,
  ConversationCache,
  MessageCache,

  // Props
  MessagingLayoutProps,
  ConversationListProps,
  MessageThreadProps,
  MessageInputProps,
  MessageBubbleProps,
  ConversationItemProps,
} from "./types";
