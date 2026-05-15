import { AnnouncementType } from "@/backend";
import type { Announcement } from "@/backend";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useAdminICPBalance,
  useAllAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useIsAdmin,
  useToggleAnnouncementPublished,
  useUpdateAnnouncement,
} from "@/hooks/useQueries";
import { useQueryClient } from "@tanstack/react-query";
import {
  Edit2,
  ExternalLink,
  Eye,
  EyeOff,
  Megaphone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type FormState = {
  title: string;
  body: string;
  announcementType: AnnouncementType;
};

const DEFAULT_FORM: FormState = {
  title: "",
  body: "",
  announcementType: AnnouncementType.general,
};

function typeBadge(type: AnnouncementType) {
  switch (type) {
    case AnnouncementType.system_notice:
      return {
        label: "System Notice",
        className: "bg-blue-500/15 text-blue-400 border-blue-500/25",
      };
    case AnnouncementType.market_tip:
      return {
        label: "Market Tip",
        className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
      };
    default:
      return {
        label: "General",
        className: "bg-muted text-muted-foreground border-border",
      };
  }
}

function formatRelativeTime(ns: bigint): string {
  const ms = Number(ns / 1_000_000n);
  const diffMs = Date.now() - ms;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(ms).toLocaleDateString();
}

function AnnouncementForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial: FormState;
  onSave: (f: FormState) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <div
      className="card-metric space-y-4 border-accent/30 bg-accent/5"
      data-ocid="admin.form"
    >
      <div className="space-y-1.5">
        <Label htmlFor="ann-title" className="text-xs font-medium">
          Title
        </Label>
        <Input
          id="ann-title"
          placeholder="Announcement title"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          data-ocid="admin.title_input"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ann-body" className="text-xs font-medium">
          Body
        </Label>
        <Textarea
          id="ann-body"
          placeholder="Announcement content..."
          value={form.body}
          onChange={(e) => set("body", e.target.value)}
          rows={4}
          data-ocid="admin.body_textarea"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Type</Label>
        <Select
          value={form.announcementType}
          onValueChange={(v) => set("announcementType", v as AnnouncementType)}
        >
          <SelectTrigger data-ocid="admin.type_select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={AnnouncementType.general}>General</SelectItem>
            <SelectItem value={AnnouncementType.market_tip}>
              Market Tip
            </SelectItem>
            <SelectItem value={AnnouncementType.system_notice}>
              System Notice
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          onClick={() => onSave(form)}
          disabled={isSaving || !form.title.trim() || !form.body.trim()}
          data-ocid="admin.save_button"
        >
          {isSaving ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          data-ocid="admin.cancel_button"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function AnnouncementRow({
  item,
  index,
  onEdit,
  onDelete,
  onToggle,
  isToggling,
  isDeleting,
}: {
  item: Announcement;
  index: number;
  onEdit: (a: Announcement) => void;
  onDelete: (a: Announcement) => void;
  onToggle: (id: bigint) => void;
  isToggling: boolean;
  isDeleting: boolean;
}) {
  const badge = typeBadge(item.announcementType);
  return (
    <div
      className="card-metric space-y-2 hover:border-border/60 transition-smooth"
      data-ocid={`admin.item.${index}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}
            >
              {badge.label}
            </span>
            {item.isPublished ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                <Eye className="w-2.5 h-2.5" /> Published
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted border border-border rounded-full px-2 py-0.5">
                <EyeOff className="w-2.5 h-2.5" /> Draft
              </span>
            )}
            <span className="text-xs text-muted-foreground/60">
              {formatRelativeTime(item.updatedAt)}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground truncate">
            {item.title}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {item.body}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onToggle(item.id)}
            disabled={isToggling}
            title={item.isPublished ? "Unpublish" : "Publish"}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth disabled:opacity-50"
            data-ocid={`admin.toggle_button.${index}`}
          >
            {item.isPublished ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onEdit(item)}
            title="Edit"
            className="p-1.5 rounded-md text-muted-foreground hover:text-accent hover:bg-accent/10 transition-smooth"
            data-ocid={`admin.edit_button.${index}`}
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            disabled={isDeleting}
            title="Delete"
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-smooth disabled:opacity-50"
            data-ocid={`admin.delete_button.${index}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

const WALLET_ADDRESS =
  "b089c3ed099d1c3501c06fd6855c2152fb542b01e858872ac23269bb12c6f2d1";

function formatICP(raw: string): string {
  // raw is already formatted as "7.9999" from integer arithmetic
  const num = Number.parseFloat(raw);
  if (Number.isNaN(num)) return "0.0000 ICP";
  const [whole, dec = "0000"] = raw.split(".");
  const paddedDec = dec.padEnd(4, "0").slice(0, 4);
  const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${formattedWhole}.${paddedDec} ICP`;
}

function ICPWalletCard() {
  useEffect(() => {
    console.log("[ADMIN TAB MOUNT] ICPWalletCard mounted");
  }, []);

  const queryClient = useQueryClient();
  const {
    data: balance,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useAdminICPBalance();

  const handleRefresh = () => {
    console.log("[ADMIN BALANCE] manual refresh triggered");
    queryClient.invalidateQueries({ queryKey: ["adminICPBalance"] });
    refetch();
  };

  const loading = isLoading || isFetching;
  // balance is a string like "7.9999" from direct browser ledger fetch
  const displayRaw = balance ?? null;
  const parsedBalance =
    displayRaw != null ? Number.parseFloat(displayRaw) : Number.NaN;
  const hasValidBalance =
    displayRaw != null && !Number.isNaN(parsedBalance) && parsedBalance > 0;

  console.log("[ADMIN BALANCE] render", {
    balance,
    isLoading,
    isFetching,
    isError,
    displayRaw,
    hasValidBalance,
  });

  return (
    <div
      className="card-metric border-primary/20 bg-primary/5 space-y-3"
      data-ocid="admin.wallet_card"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground tracking-tight text-sm">
              ICP Wallet Balance
            </h3>
            <p className="text-[11px] text-muted-foreground/70 font-mono truncate max-w-[260px]">
              {WALLET_ADDRESS.slice(0, 8)}...{WALLET_ADDRESS.slice(-6)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh balance"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth disabled:opacity-50"
            data-ocid="admin.wallet_refresh_button"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </button>
          <a
            href="https://nns.ic0.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-smooth"
            data-ocid="admin.nns_link"
          >
            Open NNS Wallet
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        {loading ? (
          <div
            className="h-8 w-40 bg-muted/60 rounded animate-pulse"
            data-ocid="admin.wallet_balance.loading_state"
          />
        ) : isError || !hasValidBalance ? (
          <span
            className="text-2xl font-display font-bold text-muted-foreground tracking-tight"
            data-ocid="admin.wallet_balance"
          >
            —
          </span>
        ) : (
          <span
            className="text-2xl font-display font-bold text-foreground tracking-tight"
            data-ocid="admin.wallet_balance"
          >
            {formatICP(displayRaw as string)}
          </span>
        )}
        {!loading && hasValidBalance && (
          <span className="text-xs text-muted-foreground">
            at current wallet address
          </span>
        )}
      </div>

      {!loading && (isError || !hasValidBalance) && (
        <p
          className="text-xs text-destructive/80 mt-1"
          data-ocid="admin.wallet_balance.error_state"
        >
          Unable to load balance — tap Refresh to try again
        </p>
      )}

      {!loading && hasValidBalance && (
        <p className="text-[10px] text-muted-foreground/50">
          Source: ICP Ledger (icp-api.io)
        </p>
      )}
    </div>
  );
}

export function AdminTab() {
  const { data: isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { data: announcements = [], isLoading } = useAllAnnouncements();
  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();
  const deleteMutation = useDeleteAnnouncement();
  const toggleMutation = useToggleAnnouncementPublished();

  const [showNewForm, setShowNewForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);

  if (isAdminLoading) {
    return (
      <div className="space-y-3" data-ocid="admin.loading_state">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card-metric animate-pulse">
            <div className="h-4 w-1/2 bg-muted rounded" />
            <div className="h-3 w-3/4 bg-muted/70 rounded mt-2" />
          </div>
        ))}
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div
        className="card-metric text-center py-16 space-y-3"
        data-ocid="admin.unauthorized_state"
      >
        <ShieldCheck className="w-10 h-10 text-muted-foreground mx-auto" />
        <p className="text-sm font-medium text-foreground">
          Admin access required
        </p>
        <p className="text-xs text-muted-foreground/70">
          This section is restricted to the app owner.
        </p>
      </div>
    );
  }

  const sorted = [...announcements].sort((a, b) =>
    Number(b.createdAt - a.createdAt),
  );

  const handleCreate = (form: FormState) => {
    createMutation.mutate(
      {
        title: form.title,
        body: form.body,
        announcementType: form.announcementType,
      },
      {
        onSuccess: () => {
          toast.success("Announcement created");
          setShowNewForm(false);
        },
        onError: () => toast.error("Failed to create announcement"),
      },
    );
  };

  const handleUpdate = (form: FormState) => {
    if (!editingItem) return;
    updateMutation.mutate(
      {
        id: editingItem.id,
        title: form.title,
        body: form.body,
        announcementType: form.announcementType,
      },
      {
        onSuccess: () => {
          toast.success("Announcement updated");
          setEditingItem(null);
        },
        onError: () => toast.error("Failed to update announcement"),
      },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success("Announcement deleted");
        setDeleteTarget(null);
      },
      onError: () => toast.error("Failed to delete announcement"),
    });
  };

  const handleToggle = (id: bigint) => {
    toggleMutation.mutate(id, {
      onSuccess: () => toast.success("Visibility updated"),
      onError: () => toast.error("Failed to update visibility"),
    });
  };

  return (
    <div className="space-y-5" data-ocid="admin.section">
      {/* ICP Wallet Balance */}
      <ICPWalletCard />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Megaphone className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-foreground tracking-tight">
              Announcements
            </h2>
            <p className="text-xs text-muted-foreground">
              Manage messages pushed to all users
            </p>
          </div>
        </div>
        {!showNewForm && !editingItem && (
          <Button
            type="button"
            size="sm"
            onClick={() => setShowNewForm(true)}
            className="gap-1.5"
            data-ocid="admin.new_announcement_button"
          >
            <Plus className="w-3.5 h-3.5" />
            New Announcement
          </Button>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          <strong className="text-foreground">{announcements.length}</strong>{" "}
          total
        </span>
        <span>
          <strong className="text-emerald-400">
            {announcements.filter((a) => a.isPublished).length}
          </strong>{" "}
          published
        </span>
        <span>
          <strong className="text-muted-foreground">
            {announcements.filter((a) => !a.isPublished).length}
          </strong>{" "}
          drafts
        </span>
      </div>

      {/* New announcement form */}
      {showNewForm && (
        <AnnouncementForm
          initial={DEFAULT_FORM}
          onSave={handleCreate}
          onCancel={() => setShowNewForm(false)}
          isSaving={createMutation.isPending}
        />
      )}

      {/* Edit form */}
      {editingItem && (
        <AnnouncementForm
          initial={{
            title: editingItem.title,
            body: editingItem.body,
            announcementType: editingItem.announcementType,
          }}
          onSave={handleUpdate}
          onCancel={() => setEditingItem(null)}
          isSaving={updateMutation.isPending}
        />
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3" data-ocid="admin.list.loading_state">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card-metric animate-pulse">
              <div className="h-4 w-1/2 bg-muted rounded" />
              <div className="h-3 w-3/4 bg-muted/70 rounded mt-2" />
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div
          className="card-metric text-center py-12 space-y-2"
          data-ocid="admin.list.empty_state"
        >
          <Megaphone className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-foreground">
            No announcements yet
          </p>
          <p className="text-xs text-muted-foreground/70">
            Create one to push a message to all users.
          </p>
        </div>
      ) : (
        <div className="space-y-3" data-ocid="admin.list">
          {sorted.map((item, i) => (
            <AnnouncementRow
              key={item.id.toString()}
              item={item}
              index={i + 1}
              onEdit={(a) => {
                setShowNewForm(false);
                setEditingItem(a);
              }}
              onDelete={setDeleteTarget}
              onToggle={handleToggle}
              isToggling={
                toggleMutation.isPending && toggleMutation.variables === item.id
              }
              isDeleting={
                deleteMutation.isPending && deleteMutation.variables === item.id
              }
            />
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent data-ocid="admin.delete_dialog">
          <DialogHeader>
            <DialogTitle>Delete Announcement</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{" "}
              <strong>"{deleteTarget?.title}"</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              data-ocid="admin.delete_dialog.cancel_button"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-ocid="admin.delete_dialog.confirm_button"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
