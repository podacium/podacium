/**
 * Messaging System Types - Enterprise Grade
 *
 * TypeScript interfaces for the Podacium messaging system.
 * Supports: Freelance, Education, BI Collaboration, System, and Support pillars.
 */

// ============================================================================
// ENUMS
// ============================================================================

export type ConversationType =
  "FREELANCE" | "EDUCATION" | "SYSTEM" | "BI_COLLABORATION" | "SUPPORT";

export type ParticipantRole =
  | "CLIENT"
  | "FREELANCER"
  | "INSTRUCTOR"
  | "STUDENT"
  | "ADMIN"
  | "MEMBER"
  | "OWNER"
  | "MODERATOR"
  | "SUPPORT_AGENT"
  | "GUEST";

export type MessageType =
  "TEXT" | "FILE" | "SYSTEM" | "TYPING_INDICATOR" | "REACTION";

export type MessageStatus =
  "SENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";

// ============================================================================
// BASE INTERFACES
// ============================================================================

export interface User {
  id: number;
  fullName: string;
  username?: string;
  profilePictureUrl?: string;
  role?: string;
}

export interface UserMinimal {
  id: number;
  full_name: string;
  username?: string;
  profile_picture_url?: string;
  role?: string;
}

export interface Participant {
  id: number;
  userId: number;
  role: ParticipantRole;
  joinedAt: string;
  leftAt?: string;
  lastReadAt?: string;
  lastReadMessageId?: string;
  isArchived: boolean;
  isPinned: boolean;
  mutedUntil?: string;
  user?: User;
}

export interface MessageAttachment {
  id: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  thumbnailUrl?: string;
  createdAt: string;
}

export interface MessageReaction {
  id: number;
  userId: number;
  emoji: string;
  createdAt: string;
  user?: User;
}

export interface MessageReadReceipt {
  userId: number;
  readAt: string;
  user?: User;
}

export interface Message {
  id: number;
  messageId: string;
  conversationId: number;
  senderId: number;
  content: string;
  messageType: MessageType;
  status: MessageStatus;
  isEdited: boolean;
  editedAt?: string;
  editedById?: number;
  replyToId?: string;
  replyToMessage?: Message;
  createdAt: string;
  deletedAt?: string;
  metadata?: Record<string, any>;
  moderationStatus?: string;
  clientMessageId?: string;
  version: number;
  sender?: User;
  attachments: MessageAttachment[];
  reactions: MessageReaction[];
  readReceipts: MessageReadReceipt[];
  isOwnMessage: boolean;
}

export interface Conversation {
  id: number;
  conversationId: string;
  type: ConversationType;
  title?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  archivedAt?: string;
  metadata?: Record<string, any>;
  version: number;
  participants: Participant[];
  lastMessage?: Message;
  unreadCount: number;
  displayTitle?: string;
  avatarUrl?: string;
  isMuted: boolean;
  isArchived: boolean;
  isPinned: boolean;
}

// ============================================================================
// API RESPONSE INTERFACES
// ============================================================================

export interface ConversationListResponse {
  items: Conversation[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface MessageListResponse {
  items: Message[];
  nextCursor?: string;
  hasMore: boolean;
  totalCount: number;
}

export interface CanMessageResponse {
  canMessage: boolean;
  reason?: string;
}

// ============================================================================
// REQUEST INTERFACES
// ============================================================================

export interface CreateMessageRequest {
  content: string;
  messageType?: MessageType;
  replyToId?: string;
  metadata?: Record<string, any>;
  clientMessageId?: string;
}

export interface CreateDirectConversationRequest {
  otherUserId: number;
  type?: ConversationType;
  metadata?: Record<string, any>;
}

export interface CreateConversationRequest {
  type: ConversationType;
  title?: string;
  participants: Array<{
    userId: number;
    role: ParticipantRole;
  }>;
  metadata?: Record<string, any>;
}

export interface UpdateMessageRequest {
  content: string;
  expectedVersion?: number;
}

export interface MarkAsReadRequest {
  lastReadMessageId?: string;
}

export interface UpdateParticipantRequest {
  mutedUntil?: string;
  isArchived?: boolean;
  isPinned?: boolean;
}

export interface AddReactionRequest {
  emoji: string;
}

// ============================================================================
// WEBSOCKET EVENT INTERFACES
// ============================================================================

export interface MessageEvent {
  eventType: string;
  conversationId: string;
  timestamp: string;
  data: Record<string, any>;
}

export interface NewMessageEvent extends MessageEvent {
  eventType: "NEW_MESSAGE";
  message: Message;
}

export interface MessageUpdatedEvent extends MessageEvent {
  eventType: "MESSAGE_UPDATED";
  message: Message;
}

export interface MessageDeletedEvent extends MessageEvent {
  eventType: "MESSAGE_DELETED";
  messageId: string;
  deletedById: number;
}

export interface ReadReceiptEvent extends MessageEvent {
  eventType: "READ_RECEIPT";
  messageId: string;
  userId: number;
  readAt: string;
}

export interface ReactionEvent extends MessageEvent {
  eventType: "REACTION_ADDED" | "REACTION_REMOVED";
  messageId: string;
  emoji: string;
  userId: number;
}

export interface TypingIndicatorEvent extends MessageEvent {
  eventType: "TYPING_INDICATOR";
  userId: number;
  userName: string;
  isTyping: boolean;
}

export type MessagingEvent =
  | NewMessageEvent
  | MessageUpdatedEvent
  | MessageDeletedEvent
  | ReadReceiptEvent
  | ReactionEvent
  | TypingIndicatorEvent;

// ============================================================================
// STATE MANAGEMENT INTERFACES
// ============================================================================

export interface MessagingState {
  conversations: Record<string, Conversation>;
  messages: Record<string, Message[]>;
  activeConversationId: string | null;
  isLoading: boolean;
  error: string | null;
  hasMoreMessages: boolean;
  nextCursor?: string;
}

export interface ConversationCache {
  data: ConversationListResponse;
  timestamp: number;
  ttl: number;
}

export interface MessageCache {
  data: MessageListResponse;
  timestamp: number;
  ttl: number;
}

// ============================================================================
// COMPONENT PROPS INTERFACES
// ============================================================================

export interface MessagingLayoutProps {
  currentUserId: number;
  initialConversationId?: string;
  className?: string;
}

export interface ConversationListProps {
  selectedConversationId?: string;
  onSelectConversation: (conversation: Conversation) => void;
  currentUserId?: number;
  className?: string;
}

export interface MessageThreadProps {
  conversation: Conversation;
  currentUserId: number;
  onBack?: () => void;
  className?: string;
}

export interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export interface MessageBubbleProps {
  message: Message;
  currentUserId: number;
  showAvatar?: boolean;
  onReply?: (message: Message) => void;
  onReact?: (message: Message, emoji: string) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (message: Message) => void;
}

export interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  currentUserId: number;
  onClick: () => void;
}
