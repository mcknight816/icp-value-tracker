import type { UrlPreview } from "@/backend";
import type { ChatMessage } from "@/backend";
import {
  useChatMessages,
  useDeleteChatMessage,
  usePostChatMessage,
  useToggleChatLike,
  useToggleChatShill,
} from "@/hooks/useQueries";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import {
  AlertTriangle,
  ExternalLink,
  Heart,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Reply,
  Rocket,
  Send,
  Smile,
  ThumbsDown,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const COMMON_EMOJIS = [
  "😀",
  "😂",
  "😍",
  "🤩",
  "😎",
  "🤔",
  "😅",
  "🙌",
  "👍",
  "👎",
  "🔥",
  "💎",
  "🚀",
  "🌙",
  "⭐",
  "💰",
  "💸",
  "📈",
  "📉",
  "🏦",
  "🦁",
  "🐻",
  "🦊",
  "🐉",
  "🌊",
  "⚡",
  "❄️",
  "🎯",
  "🏆",
  "🎉",
  "✅",
  "❌",
  "⚠️",
  "💡",
  "🔑",
  "🛡️",
  "⚔️",
  "🌐",
  "🔗",
  "💻",
  "👀",
  "💪",
  "🤝",
  "👏",
  "🙏",
  "❤️",
  "💙",
  "💚",
  "💜",
  "🖤",
];

// ─── URL preview helpers ────────────────────────────────────────────────────

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0];
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
  } catch {
    // malformed URL
  }
  return null;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function buildUrlPreview(url: string): UrlPreview | null {
  const ytId = extractYouTubeId(url);
  if (ytId) {
    return {
      url,
      title: "YouTube Video",
      description: "Click to watch on YouTube",
      thumbnailUrl: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
    };
  }
  return {
    url,
    title: url.length > 50 ? `${url.slice(0, 50)}…` : url,
    description: "",
    thumbnailUrl: "",
  };
}

const URL_REGEX = /(https?:\/\/[^\s]+)/i;

// ─── Preview card (shared between compose + message) ─────────────────────────

interface UrlPreviewCardProps {
  preview: UrlPreview;
  onDismiss?: () => void;
  clickable?: boolean;
}

function UrlPreviewCard({
  preview,
  onDismiss,
  clickable = false,
}: UrlPreviewCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const domain = getDomain(preview.url);

  const inner = (
    <div className="flex items-start gap-3">
      {preview.thumbnailUrl && !imgFailed && (
        <img
          src={preview.thumbnailUrl}
          alt=""
          className="w-20 h-14 object-cover rounded flex-shrink-0"
          onError={() => setImgFailed(true)}
          loading="lazy"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <p className="text-sm font-semibold text-foreground truncate leading-snug">
            {preview.title}
          </p>
          <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        </div>
        {preview.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {preview.description}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground/60 mt-1 truncate">
          {domain}
        </p>
      </div>
    </div>
  );

  return (
    <div className="relative mt-2">
      {clickable ? (
        <a
          href={preview.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg border border-border bg-muted/50 dark:bg-muted/30 shadow-sm p-3 hover:bg-muted/70 transition-colors"
          data-ocid="chat.url_preview_link"
        >
          {inner}
        </a>
      ) : (
        <div className="rounded-lg border border-border bg-muted/50 dark:bg-muted/30 shadow-sm p-3">
          {inner}
        </div>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-muted border border-border text-muted-foreground text-xs flex items-center justify-center leading-none hover:bg-destructive hover:text-background transition-colors"
          aria-label="Dismiss link preview"
          data-ocid="chat.url_preview_dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
}

const PAGE_SIZE = 20;

function formatChatTime(ns: bigint): string {
  const ms = Number(ns / 1_000_000n);
  const d = new Date(ms);
  const now = new Date();
  const diffMs = now.getTime() - ms;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7)
    return d.toLocaleDateString([], {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function abbrevPrincipal(p: string): string {
  if (!p) return "anon";
  return `${p.slice(0, 5)}…${p.slice(-4)}`;
}

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-2 left-0 z-50 bg-card border border-border rounded-xl shadow-lg p-3 w-56"
      data-ocid="chat.emoji_picker"
    >
      <div className="grid grid-cols-10 gap-1">
        {COMMON_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSelect(emoji)}
            className="text-lg hover:bg-muted rounded p-0.5 transition-colors leading-none"
            aria-label={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ComposeAreaProps {
  onPost: (
    content: string,
    imageKey: string | null,
    replyToId: bigint | null,
    urlPreview?: UrlPreview | null,
  ) => void;
  isPosting: boolean;
  replyToId?: bigint | null;
  replyToAuthor?: string;
  onCancelReply?: () => void;
  placeholder?: string;
  compact?: boolean;
}

function ComposeArea({
  onPost,
  isPosting,
  replyToId = null,
  replyToAuthor,
  onCancelReply,
  placeholder = "Share your thoughts on ICP…",
  compact = false,
}: ComposeAreaProps) {
  const [content, setContent] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [urlPreview, setUrlPreview] = useState<UrlPreview | null>(null);
  const [urlDismissed, setUrlDismissed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handlePost = () => {
    const trimmed = content.trim();
    if (!trimmed && !imagePreview) return;
    const activePreview = urlPreview && !urlDismissed ? urlPreview : null;
    onPost(trimmed || "📷", null, replyToId ?? null, activePreview);
    setContent("");
    setShowEmoji(false);
    setImagePreview(null);
    setUrlPreview(null);
    setUrlDismissed(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handlePost();
    }
  };

  const insertEmoji = (emoji: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setContent((c) => c + emoji);
      return;
    }
    const start = ta.selectionStart ?? content.length;
    const end = ta.selectionEnd ?? content.length;
    const next = content.slice(0, start) + emoji + content.slice(end);
    setContent(next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  return (
    <div
      className={`bg-card border border-border rounded-xl p-3 space-y-2 ${compact ? "" : ""}`}
    >
      {replyToAuthor && (
        <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-1.5">
          <span>
            Replying to{" "}
            <span className="font-mono text-accent">{replyToAuthor}</span>
          </span>
          {onCancelReply && (
            <button
              type="button"
              onClick={onCancelReply}
              className="text-muted-foreground hover:text-foreground ml-2 transition-colors"
              aria-label="Cancel reply"
            >
              ✕
            </button>
          )}
        </div>
      )}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            const val = e.target.value;
            setContent(val);
            // Detect URL and build preview
            const match = val.match(URL_REGEX);
            if (match) {
              const detected = buildUrlPreview(match[1]);
              setUrlPreview(detected);
              setUrlDismissed(false);
            } else {
              setUrlPreview(null);
              setUrlDismissed(false);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={compact ? 2 : 3}
          maxLength={1000}
          className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors"
          data-ocid="chat.message_input"
        />
      </div>
      {urlPreview && !urlDismissed && (
        <UrlPreviewCard
          preview={urlPreview}
          onDismiss={() => setUrlDismissed(true)}
        />
      )}
      {imagePreview && (
        <div className="relative inline-block">
          <img
            src={imagePreview}
            alt="Preview"
            className="max-h-28 rounded-lg border border-border object-contain"
          />
          <button
            type="button"
            onClick={() => setImagePreview(null)}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-background text-xs flex items-center justify-center leading-none"
            aria-label="Remove image"
          >
            ✕
          </button>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 relative">
          <button
            type="button"
            onClick={() => setShowEmoji((v) => !v)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-accent hover:bg-muted transition-colors"
            aria-label="Open emoji picker"
            data-ocid="chat.emoji_button"
          >
            <Smile className="w-4 h-4" />
          </button>
          {showEmoji && (
            <EmojiPicker
              onSelect={(e) => {
                insertEmoji(e);
              }}
              onClose={() => setShowEmoji(false)}
            />
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
            data-ocid="chat.image_file_input"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-accent hover:bg-muted transition-colors"
            aria-label="Attach image"
            data-ocid="chat.image_upload_button"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
          <span className="text-[11px] text-muted-foreground/60 ml-1">
            {content.length}/1000
          </span>
        </div>
        <button
          type="button"
          onClick={handlePost}
          disabled={isPosting || !content.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          data-ocid="chat.post_button"
        >
          {isPosting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          {compact ? "Reply" : "Post"}
        </button>
      </div>
      {!compact && (
        <p className="text-[11px] text-muted-foreground/60">
          Ctrl+Enter to post · Markdown not supported
        </p>
      )}
    </div>
  );
}

interface MessageCardProps {
  msg: ChatMessage;
  currentPrincipal: string | null;
  onLike: (id: bigint) => void;
  onDislike: (id: bigint) => void;
  onShill: (id: bigint) => void;
  onFud: (id: bigint) => void;
  onDelete: (id: bigint) => void;
  onReply: (id: bigint, authorName: string) => void;
  isReply?: boolean;
}

function MessageCard({
  msg,
  currentPrincipal,
  onLike,
  onDislike,
  onShill,
  onFud,
  onDelete,
  onReply,
  isReply = false,
}: MessageCardProps) {
  const authorStr = msg.authorPrincipal.toString();
  const isOwn = currentPrincipal === authorStr;
  const likeCount = msg.likes.length;
  const dislikeCount = msg.dislikes.length;
  const shillCount = msg.shills.length;
  const fudCount = msg.fuds.length;
  const hasLiked = currentPrincipal
    ? msg.likes.some((p) => p.toString() === currentPrincipal)
    : false;
  const hasDisliked = currentPrincipal
    ? msg.dislikes.some((p) => p.toString() === currentPrincipal)
    : false;
  const hasShill = currentPrincipal
    ? msg.shills.some((p) => p.toString() === currentPrincipal)
    : false;
  const hasFud = currentPrincipal
    ? msg.fuds.some((p) => p.toString() === currentPrincipal)
    : false;

  if (msg.isDeleted) {
    return (
      <div
        className={`${isReply ? "ml-8 border-l-2 border-border pl-3" : ""} py-2`}
      >
        <p className="text-xs text-muted-foreground/60 italic">
          This message was deleted.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`group ${
        isReply
          ? "ml-8 border-l-2 border-accent/20 pl-3"
          : "bg-card border border-border rounded-xl p-4 hover:border-accent/30 transition-colors"
      }`}
      data-ocid={"chat.message.card"}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-[11px] font-mono font-bold text-accent flex-shrink-0"
            title={authorStr}
          >
            {authorStr.slice(0, 2).toUpperCase()}
          </div>
          <span
            className="text-xs font-mono font-medium text-foreground truncate"
            title={authorStr}
          >
            {msg.authorName || abbrevPrincipal(authorStr)}
          </span>
          {isOwn && (
            <span className="text-[10px] font-semibold uppercase tracking-wider bg-accent/15 text-accent border border-accent/25 rounded px-1 py-0.5 flex-shrink-0">
              You
            </span>
          )}
        </div>
        <span
          className="text-[11px] text-muted-foreground/70 flex-shrink-0"
          title={new Date(Number(msg.timestamp / 1_000_000n)).toLocaleString()}
        >
          {formatChatTime(msg.timestamp)}
        </span>
      </div>

      {/* Content */}
      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
        {msg.content}
      </p>

      {/* Image */}
      {msg.imageKey && (
        <div className="mt-2 rounded-lg overflow-hidden border border-border max-w-sm">
          <img
            src={msg.imageKey}
            alt="Shared content"
            className="w-full h-auto object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* URL Preview */}
      {msg.urlPreview && <UrlPreviewCard preview={msg.urlPreview} clickable />}

      {/* Actions */}
      <div className="flex items-center flex-wrap gap-1 mt-3 -ml-1">
        <button
          type="button"
          onClick={() => onLike(msg.id)}
          disabled={!currentPrincipal}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
            hasLiked
              ? "text-emerald-400 bg-emerald-400/10"
              : "text-muted-foreground hover:text-emerald-400 hover:bg-emerald-400/10"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          aria-label="Like"
          data-ocid="chat.like_button"
        >
          <Heart className="w-3.5 h-3.5" />
          <span>{likeCount}</span>
        </button>

        <button
          type="button"
          onClick={() => onDislike(msg.id)}
          disabled={!currentPrincipal}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
            hasDisliked
              ? "text-destructive bg-destructive/10"
              : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          aria-label="Dislike"
          data-ocid="chat.dislike_button"
        >
          <ThumbsDown className="w-3.5 h-3.5" />
          <span>{dislikeCount}</span>
        </button>

        <button
          type="button"
          onClick={() => onShill(msg.id)}
          disabled={!currentPrincipal}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
            hasShill
              ? "text-amber-400 bg-amber-400/10"
              : "text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          aria-label="Shill"
          data-ocid="chat.shill_button"
        >
          <Rocket className="w-3.5 h-3.5" />
          <span>{shillCount > 0 ? shillCount : ""}</span>
          <span className="text-[10px] font-semibold">Shill</span>
        </button>

        <button
          type="button"
          onClick={() => onFud(msg.id)}
          disabled={!currentPrincipal}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
            hasFud
              ? "text-orange-500 bg-orange-500/10"
              : "text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          aria-label="FUD"
          data-ocid="chat.fud_button"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{fudCount > 0 ? fudCount : ""}</span>
          <span className="text-[10px] font-semibold">FUD</span>
        </button>

        {!isReply && (
          <button
            type="button"
            onClick={() =>
              onReply(msg.id, msg.authorName || abbrevPrincipal(authorStr))
            }
            disabled={!currentPrincipal}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Reply"
            data-ocid="chat.reply_button"
          >
            <Reply className="w-3.5 h-3.5" />
            Reply
          </button>
        )}

        {isOwn && (
          <button
            type="button"
            onClick={() => onDelete(msg.id)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 ml-auto"
            aria-label="Delete message"
            data-ocid="chat.delete_button"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

type ChatTab = "icp" | "shills" | "fud";

export function ICPCommunityChat() {
  const { isAuthenticated, identity, login } = useInternetIdentity();
  const currentPrincipal = identity?.getPrincipal().toString() ?? null;

  const [offset, setOffset] = useState(0);
  const [_replyToId, setReplyToId] = useState<bigint | null>(null);
  const [replyToAuthor, setReplyToAuthor] = useState<string | null>(null);
  const [replyOpenForMsgId, setReplyOpenForMsgId] = useState<bigint | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<ChatTab>("icp");

  const {
    data: messages = [],
    isLoading,
    isError,
    refetch,
  } = useChatMessages(PAGE_SIZE, offset);
  const { mutate: postMessage, isPending: isPosting } = usePostChatMessage();
  const { mutate: toggleLike } = useToggleChatLike();
  const { mutate: toggleShill } = useToggleChatShill();
  const { mutate: deleteMessage } = useDeleteChatMessage();

  // Split messages by tab (backend computes tab based on reaction counts)
  const allTopLevel = messages.filter((m) => !m.replyToId);
  const icpMessages = allTopLevel.filter((m) => m.tab === "icp");
  const shillMessages = allTopLevel.filter((m) => m.tab === "shills");
  const fudMessages = allTopLevel.filter((m) => m.tab === "fud");

  const topLevel =
    activeTab === "shills"
      ? shillMessages
      : activeTab === "fud"
        ? fudMessages
        : icpMessages;

  // Replies indexed by parent id
  const repliesByParent = messages.reduce<Record<string, ChatMessage[]>>(
    (acc, m) => {
      if (m.replyToId) {
        const key = m.replyToId.toString();
        if (!acc[key]) acc[key] = [];
        acc[key].push(m);
      }
      return acc;
    },
    {},
  );

  const handlePost = useCallback(
    (
      content: string,
      imageKey: string | null,
      rToId: bigint | null,
      urlPreview?: UrlPreview | null,
    ) => {
      postMessage(
        { content, imageKey, replyToId: rToId, urlPreview: urlPreview ?? null },
        {
          onSuccess: () => {
            toast.success("Message posted!");
            setReplyToId(null);
            setReplyToAuthor(null);
            setReplyOpenForMsgId(null);
          },
          onError: (err) =>
            toast.error(`Failed to post: ${(err as Error).message}`),
        },
      );
    },
    [postMessage],
  );

  const handleLike = (id: bigint) => {
    toggleLike(
      { messageId: id, isLike: true },
      { onError: () => toast.error("Like failed") },
    );
  };

  const handleDislike = (id: bigint) => {
    toggleLike(
      { messageId: id, isLike: false },
      { onError: () => toast.error("Dislike failed") },
    );
  };

  const handleShill = (id: bigint) => {
    toggleShill(
      { messageId: id, isShill: true },
      { onError: () => toast.error("Shill reaction failed") },
    );
  };

  const handleFud = (id: bigint) => {
    toggleShill(
      { messageId: id, isShill: false },
      { onError: () => toast.error("FUD reaction failed") },
    );
  };

  const handleDelete = (id: bigint) => {
    deleteMessage(id, {
      onSuccess: () => toast.success("Message deleted"),
      onError: () => toast.error("Delete failed"),
    });
  };

  const handleReply = (msgId: bigint, authorName: string) => {
    setReplyOpenForMsgId((prev) => (prev === msgId ? null : msgId));
    setReplyToId(msgId);
    setReplyToAuthor(authorName);
  };

  const handleLoadMore = () => setOffset((o) => o + PAGE_SIZE);

  const TAB_CONFIG: {
    id: ChatTab;
    label: string;
    count: number;
    activeClass: string;
    hoverClass: string;
  }[] = [
    {
      id: "icp",
      label: "ICP",
      count: icpMessages.length,
      activeClass: "bg-accent text-background",
      hoverClass: "hover:bg-accent/10 hover:text-accent",
    },
    {
      id: "shills",
      label: "Shills",
      count: shillMessages.length,
      activeClass: "bg-amber-400 text-background",
      hoverClass: "hover:bg-amber-400/10 hover:text-amber-400",
    },
    {
      id: "fud",
      label: "FUD",
      count: fudMessages.length,
      activeClass: "bg-orange-500 text-background",
      hoverClass: "hover:bg-orange-500/10 hover:text-orange-500",
    },
  ];

  return (
    <div className="space-y-5" data-ocid="chat.section">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-accent" />
          <h2 className="font-display font-semibold text-foreground text-lg">
            ICP Community Chat
          </h2>
          <span className="text-[11px] font-semibold uppercase tracking-wider bg-accent/15 text-accent border border-accent/25 rounded px-1.5 py-0.5">
            Live
          </span>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-xs text-muted-foreground hover:text-accent transition-colors"
          data-ocid="chat.refresh_button"
        >
          Refresh
        </button>
      </div>

      {/* Sub-tabs */}
      <div
        className="flex items-center gap-1 bg-muted/40 rounded-xl p-1"
        data-ocid="chat.tabs"
      >
        {TAB_CONFIG.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 flex-1 justify-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.id
                ? t.activeClass
                : `text-muted-foreground ${t.hoverClass}`
            }`}
            data-ocid={`chat.${t.id}_tab`}
          >
            {t.label}
            {t.count > 0 && (
              <span
                className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none ${
                  activeTab === t.id
                    ? "bg-background/25 text-inherit"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Compose or login prompt */}
      {isAuthenticated ? (
        <ComposeArea
          onPost={(content, imgKey, rId, preview) =>
            handlePost(content, imgKey, rId, preview)
          }
          isPosting={isPosting}
        />
      ) : (
        <div
          className="bg-card border border-border rounded-xl p-6 text-center space-y-3"
          data-ocid="chat.login_prompt"
        >
          <MessageSquare className="w-8 h-8 text-muted-foreground/50 mx-auto" />
          <p className="text-sm text-muted-foreground">
            Log in with Internet Identity to join the conversation.
          </p>
          <button
            type="button"
            onClick={() => login()}
            className="px-4 py-2 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent/90 transition-colors"
            data-ocid="chat.login_button"
          >
            Log In
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3" data-ocid="chat.loading_state">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-xl p-4 space-y-3 animate-pulse"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-muted" />
                <div className="h-3.5 w-28 bg-muted rounded" />
                <div className="h-3 w-14 bg-muted rounded ml-auto" />
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-4/5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <div
          className="bg-destructive/10 border border-destructive/30 rounded-xl p-5 text-center space-y-2"
          data-ocid="chat.error_state"
        >
          <p className="text-sm text-destructive">Failed to load messages.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-xs text-destructive hover:underline transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && topLevel.length === 0 && (
        <div
          className="bg-card border border-border rounded-xl p-8 text-center space-y-3"
          data-ocid="chat.empty_state"
        >
          {activeTab === "shills" ? (
            <>
              <Rocket className="w-10 h-10 text-amber-400/40 mx-auto" />
              <p className="font-medium text-foreground">No Shills yet</p>
              <p className="text-sm text-muted-foreground">
                Messages that get more Shill votes than Likes will appear here.
              </p>
            </>
          ) : activeTab === "fud" ? (
            <>
              <AlertTriangle className="w-10 h-10 text-orange-500/40 mx-auto" />
              <p className="font-medium text-foreground">No FUD here</p>
              <p className="text-sm text-muted-foreground">
                Messages that get more FUD votes than Likes will appear here.
              </p>
            </>
          ) : (
            <>
              <MessageSquare className="w-10 h-10 text-muted-foreground/40 mx-auto" />
              <p className="font-medium text-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground">
                Be the first to start a conversation about ICP!
              </p>
            </>
          )}
        </div>
      )}

      {/* Message feed — newest first */}
      {!isLoading && topLevel.length > 0 && (
        <div className="space-y-3">
          {topLevel.map((msg, idx) => {
            const replies = repliesByParent[msg.id.toString()] ?? [];
            const isReplyOpen = replyOpenForMsgId === msg.id;

            return (
              <div
                key={msg.id.toString()}
                data-ocid={`chat.message.item.${idx + 1}`}
              >
                <MessageCard
                  msg={msg}
                  currentPrincipal={currentPrincipal}
                  onLike={handleLike}
                  onDislike={handleDislike}
                  onShill={handleShill}
                  onFud={handleFud}
                  onDelete={handleDelete}
                  onReply={handleReply}
                />

                {/* Inline replies */}
                {replies.length > 0 && (
                  <div className="mt-2 space-y-2 pl-2">
                    {replies.map((reply) => (
                      <MessageCard
                        key={reply.id.toString()}
                        msg={reply}
                        currentPrincipal={currentPrincipal}
                        onLike={handleLike}
                        onDislike={handleDislike}
                        onShill={handleShill}
                        onFud={handleFud}
                        onDelete={handleDelete}
                        onReply={handleReply}
                        isReply
                      />
                    ))}
                  </div>
                )}

                {/* Reply compose */}
                {isAuthenticated && isReplyOpen && (
                  <div className="mt-2 pl-2">
                    <ComposeArea
                      onPost={(content, imgKey, rId, preview) =>
                        handlePost(content, imgKey, rId, preview)
                      }
                      isPosting={isPosting}
                      replyToId={msg.id}
                      replyToAuthor={replyToAuthor ?? undefined}
                      onCancelReply={() => {
                        setReplyOpenForMsgId(null);
                        setReplyToId(null);
                        setReplyToAuthor(null);
                      }}
                      placeholder={`Reply to ${replyToAuthor ?? "user"}…`}
                      compact
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {!isLoading && topLevel.length >= PAGE_SIZE && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={handleLoadMore}
            className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            data-ocid="chat.load_more_button"
          >
            Load earlier messages
          </button>
        </div>
      )}
    </div>
  );
}
