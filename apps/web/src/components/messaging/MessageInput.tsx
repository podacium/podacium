/**
 * Message Input - Enterprise Grade
 *
 * Input component for composing messages with rich features.
 * Features: auto-resize, emoji picker, file attachments, voice notes recording with live waveforms, keyboard shortcuts.
 */

"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import {
  Send,
  Loader2,
  Paperclip,
  Smile,
  X,
  Check,
  File as FileIcon,
  FileText,
  Table,
  FileCode2,
  Film,
  Music,
  Archive,
  Mic,
  Square,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize, getFileCategory } from "./FileAttachmentCard";
import { FileRejectionNotice, RejectedFile } from "./FileRejectionNotice";

interface MessageInputProps {
  onSend: (
    content: string,
    attachments?: File[],
    directAudioUrl?: string,
  ) => Promise<void>;
  onEdit?: (content: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  editingMessage?: { content: string } | null;
  replyingTo?: { senderName: string; content: string } | null;
  onCancelEdit?: () => void;
  onCancelReply?: () => void;
  maxAttachments?: number;
  maxFileSizeMB?: number;
  acceptedFileTypes?: string[];
  onTyping?: () => void;
}

const MAX_MESSAGE_LENGTH = 50000;
const BLOCKED_EXTENSIONS_REGEX =
  /\.(exe|dll|bat|cmd|sh|bash|pl|cgi|vbs|jar|msi|php\d?|phtml|phar|vbe|wsf|hta|asp|aspx|jsp|jspx)(\.|$)/i;

export function MessageInput({
  onSend,
  onEdit,
  disabled = false,
  className = "",
  placeholder,
  editingMessage,
  replyingTo,
  onCancelEdit,
  onCancelReply,
  maxAttachments = 10,
  maxFileSizeMB = 20,
  acceptedFileTypes,
  onTyping,
}: MessageInputProps) {
  const t = useTranslations("messaging");
  const { isRTL } = useBidi();
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [rejections, setRejections] = useState<RejectedFile[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio recording hook
  const {
    isRecording,
    duration: recordDuration,
    waveformData: liveWaveform,
    audioBlob,
    startRecording,
    stopRecording,
    cancelRecording,
    error: micError,
  } = useAudioRecorder();

  // Set content when editing
  useEffect(() => {
    if (editingMessage) {
      setContent(editingMessage.content);
      textareaRef.current?.focus();
    }
  }, [editingMessage]);

  // Close emoji picker on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      setAttachmentError(null);
      const newRejections: RejectedFile[] = [];
      const validFiles: File[] = [];

      // Check max attachments
      if (files.length + attachments.length > maxAttachments) {
        newRejections.push({
          id: `max-exceeded-${Date.now()}`,
          filename: `${files.length} files`,
          reasonCode: "file_too_large",
          customMessage: `Maximum ${maxAttachments} attachments allowed in total`,
        });
        setRejections(newRejections);
        return;
      }

      for (const file of files) {
        // 1. Check blocked executable / script extensions
        if (BLOCKED_EXTENSIONS_REGEX.test(file.name)) {
          newRejections.push({
            id: `sec-${file.name}-${Date.now()}`,
            filename: file.name,
            size: file.size,
            reasonCode: "executable_blocked",
          });
          continue;
        }

        // 2. Check size limit
        if (file.size > maxFileSizeMB * 1024 * 1024) {
          newRejections.push({
            id: `size-${file.name}-${Date.now()}`,
            filename: file.name,
            size: file.size,
            reasonCode: "file_too_large",
            maxSize: `${maxFileSizeMB} MB`,
          });
          continue;
        }

        validFiles.push(file);
      }

      if (newRejections.length > 0) {
        setRejections((prev) => [...prev, ...newRejections]);
      }

      if (validFiles.length > 0) {
        setAttachments((prev) => [...prev, ...validFiles]);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [attachments.length, maxAttachments, maxFileSizeMB],
  );

  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = content.trim();
    if ((!trimmed && attachments.length === 0) || sending || disabled) return;

    setSending(true);
    try {
      if (editingMessage && onEdit) {
        await onEdit(trimmed);
        onCancelEdit?.();
      } else {
        await onSend(trimmed, attachments.length > 0 ? attachments : undefined);
        setContent("");
        setAttachments([]);
        onCancelReply?.();
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  }, [
    content,
    attachments,
    sending,
    disabled,
    editingMessage,
    onEdit,
    onSend,
    onCancelEdit,
    onCancelReply,
  ]);

  const processedBlobRef = useRef<Blob | null>(null);

  const handleSendVoiceNote = useCallback(async () => {
    stopRecording();
  }, [stopRecording]);

  useEffect(() => {
    if (audioBlob && processedBlobRef.current !== audioBlob) {
      processedBlobRef.current = audioBlob;
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        const audioFile = new File(
          [audioBlob],
          `voice-note-${Date.now()}.${audioBlob.type.includes("mp4") ? "mp4" : "webm"}`,
          { type: audioBlob.type },
        );
        onSend("[Voice Note]", [audioFile], base64Data).catch(console.error);
      };
      reader.readAsDataURL(audioBlob);
    }
  }, [audioBlob, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === "Escape") {
        if (editingMessage) {
          onCancelEdit?.();
        } else if (replyingTo) {
          onCancelReply?.();
        }
      }
    },
    [handleSend, editingMessage, replyingTo, onCancelEdit, onCancelReply],
  );

  const handleEmojiSelect = useCallback((emoji: string) => {
    setContent((prev) => prev + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  }, []);

  const handleInput = useCallback(() => {
    onTyping?.();
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [onTyping]);

  const charCount = content.length;
  const isOverLimit = charCount > MAX_MESSAGE_LENGTH;

  const formatSecs = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div
      className={cn(
        "border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900",
        className,
      )}
    >
      {/* Reply/Edit indicator */}
      {(replyingTo || editingMessage) && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-slate-900/60 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            {editingMessage ? (
              <>
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  {t("message.editing")}
                </span>
                <span className="text-gray-500 dark:text-slate-400 truncate max-w-md">
                  {editingMessage.content.slice(0, 50)}
                  {editingMessage.content.length > 50 ? "..." : ""}
                </span>
              </>
            ) : replyingTo ? (
              <>
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  {t("message.replyingTo")}
                </span>
                <span className="text-gray-500 dark:text-slate-400 truncate max-w-md">
                  {replyingTo.senderName}: {replyingTo.content.slice(0, 50)}
                  {replyingTo.content.length > 50 ? "..." : ""}
                </span>
              </>
            ) : null}
          </div>
          <button
            type="button"
            onClick={editingMessage ? onCancelEdit : onCancelReply}
            className="p-1 hover:bg-gray-200 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-slate-400" />
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="p-3 sm:p-4">
        {/* Security & File Rejection Notice */}
        {rejections.length > 0 && (
          <div className="mb-3">
            <FileRejectionNotice
              rejections={rejections}
              onDismiss={(id) =>
                setRejections((prev) =>
                  id ? prev.filter((r) => r.id !== id) : [],
                )
              }
              onSelectAnother={() => fileInputRef.current?.click()}
            />
          </div>
        )}

        {/* Attachment preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {attachments.map((file, index) => {
              const cat = getFileCategory(file.name, file.type);
              const isImage = file.type.startsWith("image/");
              const objectUrl = isImage ? URL.createObjectURL(file) : null;

              return (
                <div
                  key={index}
                  className="flex items-center gap-2.5 ps-2 pe-1.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl text-xs shadow-xs animate-in fade-in zoom-in-95 duration-150"
                >
                  {/* Thumbnail or Icon */}
                  {isImage && objectUrl ? (
                    <img
                      src={objectUrl}
                      alt={file.name}
                      className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                      {cat === "pdf" ? (
                        <FileText className="w-4 h-4 text-rose-500" />
                      ) : cat === "sheet" ? (
                        <Table className="w-4 h-4 text-emerald-500" />
                      ) : cat === "code" ? (
                        <FileCode2 className="w-4 h-4 text-amber-500" />
                      ) : cat === "video" ? (
                        <Film className="w-4 h-4 text-indigo-500" />
                      ) : cat === "audio" ? (
                        <Music className="w-4 h-4 text-indigo-500" />
                      ) : cat === "archive" ? (
                        <Archive className="w-4 h-4 text-purple-500" />
                      ) : (
                        <FileIcon className="w-4 h-4" />
                      )}
                    </div>
                  )}

                  {/* Name and Size */}
                  <div className="min-w-0 max-w-[160px]">
                    <bdi
                      dir="ltr"
                      className="truncate font-semibold block text-slate-800 dark:text-slate-200"
                    >
                      {file.name}
                    </bdi>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {formatFileSize(file.size)}
                    </span>
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(index)}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
                    title={t("attachments.removeAttachment")}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {attachmentError && (
          <p className="text-red-500 dark:text-red-400 text-xs mb-2">
            {attachmentError}
          </p>
        )}

        {micError && (
          <p className="text-red-500 dark:text-red-400 text-xs mb-2">
            {micError}
          </p>
        )}

        {/* Audio Recording Live State */}
        {isRecording ? (
          <div className="flex items-center gap-3 p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl animate-in fade-in duration-200">
            {/* Pulsing indicator */}
            <div className="flex items-center gap-2 ps-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                {formatSecs(recordDuration)}
              </span>
            </div>

            {/* Live Waveform Visualization */}
            <div className="flex-1 h-6 flex items-center gap-[2px] px-2 overflow-hidden">
              {liveWaveform.map((val, idx) => (
                <div
                  key={idx}
                  className="flex-1 bg-rose-500 rounded-full transition-all duration-75"
                  style={{ height: `${Math.max(15, val)}%` }}
                />
              ))}
            </div>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={cancelRecording}
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-full transition-colors cursor-pointer"
              title={t("input.cancelRecording")}
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Send Voice Note Button */}
            <button
              type="button"
              onClick={handleSendVoiceNote}
              className="w-9 h-9 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer"
              title={t("input.sendVoice")}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2 sm:gap-3">
            {/* Attachments button */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept={acceptedFileTypes?.join(",")}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={
                  disabled || sending || attachments.length >= maxAttachments
                }
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
                title={t("input.attachFile")}
              >
                <Paperclip className="w-5 h-5 text-gray-500 dark:text-slate-400" />
              </button>
            </div>

            {/* Text input */}
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  onTyping?.();
                }}
                onKeyDown={handleKeyDown}
                onInput={handleInput}
                placeholder={placeholder || t("input.placeholder")}
                disabled={disabled || sending}
                rows={1}
                maxLength={MAX_MESSAGE_LENGTH}
                dir="auto"
                className={cn(
                  "w-full resize-none rounded-2xl border bg-gray-50 dark:bg-slate-900/60 px-4 py-2.5 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  isOverLimit
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-200 dark:border-slate-800",
                )}
              />

              {/* Character count */}
              <div
                className={cn(
                  "absolute bottom-2 end-3 text-xs pointer-events-none transition-opacity",
                  isOverLimit ? "text-red-500" : "text-gray-400",
                  charCount > MAX_MESSAGE_LENGTH * 0.8
                    ? "opacity-100"
                    : "opacity-0",
                )}
              >
                {charCount}/{MAX_MESSAGE_LENGTH}
              </div>
            </div>

            {/* Emoji button */}
            <div className="relative" ref={emojiPickerRef}>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                disabled={disabled || sending}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
                title={t("input.emoji")}
              >
                <Smile className="w-5 h-5 text-gray-500 dark:text-slate-400" />
              </button>

              {/* Emoji picker */}
              {showEmojiPicker && (
                <div className="absolute bottom-full end-0 mb-2 p-2 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-800 grid grid-cols-6 gap-1 z-50">
                  {[
                    "😀",
                    "😂",
                    "🥰",
                    "😎",
                    "🤔",
                    "👍",
                    "❤️",
                    "🎉",
                    "🔥",
                    "👏",
                    "🙏",
                    "💯",
                  ].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleEmojiSelect(emoji)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl text-xl cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Send or Voice Note Button */}
            {!content.trim() && attachments.length === 0 && !editingMessage ? (
              <button
                type="button"
                onClick={startRecording}
                disabled={disabled}
                title={t("input.recordVoice")}
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 transition-colors cursor-pointer shadow-xs"
              >
                <Mic className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={
                  (!content.trim() && attachments.length === 0) ||
                  sending ||
                  disabled ||
                  isOverLimit
                }
                title={editingMessage ? t("input.save") : t("input.send")}
                className={cn(
                  "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs",
                  editingMessage
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white",
                )}
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : editingMessage ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Send className={cn("w-4 h-4", isRTL ? "rotate-180" : "")} />
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MessageInput;
