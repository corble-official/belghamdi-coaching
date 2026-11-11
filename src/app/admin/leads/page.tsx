"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Search, Trash2, Pencil } from "lucide-react";
import { useAdminStore } from "@/lib/demo/admin-store";
import { Drawer, ConfirmDialog, StatusBadge } from "@/components/admin/ui";
import type { Lead } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { logEvent } from "@/lib/integrations/dispatcher";
import { eventBus } from "@/lib/integrations/dispatcher";

const SOURCE_LABELS: Lead["source"][] = ["website-form", "program-selector", "contact-page", "referral", "social"];
const STATUSES: Lead["status"][] = ["new", "contacted", "qualified", "converted", "lost"];
const PAGE_SIZE = 8;

const emptyForm = {
  fullName: "",
  email: "",
  phone: "",
  source: "website-form" as Lead["source"],
  interestedProgram: "",
  fitnessGoal: "Build muscle",
  status: "new" as Lead["status"],
  assignedCoach: "Coach Belghamdi",
  notes: "",
};

export default function AdminLeadsPage() {
  const { leads, addLead, updateLead, deleteLead, addNote, notesFor } = useAdminStore();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Lead["status"] | "all">("all");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [details, setDetails] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState<Lead | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [noteText, setNoteText] = useState("");

  const filtered = useMemo(() => {
    let list = leads.filter(
      (l) =>
        (statusFilter === "all" || l.status === statusFilter) &&
        (l.fullName.toLowerCase().includes(query.toLowerCase()) ||
          l.email.toLowerCase().includes(query.toLowerCase()) ||
          l.interestedProgram.toLowerCase().includes(query.toLowerCase()))
    );
    list = [...list].sort((a, b) =>
      sortDesc ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)
    );
    return list;
  }, [leads, query, statusFilter, sortDesc]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const openCreate = () => {
    setForm(emptyForm);
    setCreating(true);
  };

  const openEdit = (lead: Lead) => {
    setForm({ ...lead });
    setEditing(lead);
  };

  const save = () => {
    if (!form.fullName || !form.email) return;
    if (editing) {
      updateLead(editing.id, form);
      logEvent("lead.updated", `${editing.id}`);
    } else {
      const created = addLead(form);
      eventBus
        .dispatch({
          type: "lead.created",
          source: "admin",
          payloadRef: created.id,
          status: "processed",
          createdAt: new Date().toISOString(),
          processedAt: new Date().toISOString(),
        })
        .catch(() => undefined);
    }
    setCreating(false);
    setEditing(null);
  };

  const detailsNotes = details ? notesFor("lead", details.id) : [];
  const detailLead = details ? leads.find((l) => l.id === details.id) ?? details : null;

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl text-bone">Leads</h1>
          <p className="text-sm text-wgray mt-1">{leads.length} total leads</p>
        </div>
        <button onClick={openCreate} className="btn-primary !px-5 !py-3">
          <Plus className="h-4 w-4" /> New Lead
        </button>
      </div>

      <div className="mt-8 flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-60">
          <Search className="h-4 w-4 text-wgray-dim absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search name, email, program..."
            className="input-dark pl-9"
            aria-label="Search leads"
          />
        </div>
        <select
          value={sortDesc ? "new" : "old"}
          onChange={(e) => setSortDesc(e.target.value === "new")}
          className="input-dark w-40"
          aria-label="Sort leads"
        >
          <option value="new">Newest first</option>
          <option value="old">Oldest first</option>
        </select>
        <div className="flex flex-wrap gap-2">
          {(["all", ...STATUSES] as (Lead["status"] | "all")[]).map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(s);
                setPage(0);
              }}
              className={`px-3 py-2 text-xs font-display uppercase tracking-widest border transition-colors ${
                statusFilter === s
                  ? "border-copper text-copper bg-copper/10"
                  : "border-wgray-dim text-wgray hover:text-bone"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-wgray-dim py-20 text-center">No leads match your filters.</p>
      ) : (
        <div className="card-surface mt-6 overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr>
                <th className="table-head">ID</th>
                <th className="table-head">Name</th>
                <th className="table-head">Interest</th>
                <th className="table-head">Source</th>
                <th className="table-head">Status</th>
                <th className="table-head">Created</th>
                <th className="table-head text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((lead) => (
                <tr key={lead.id} className="hover:bg-surface/40 transition-colors">
                  <td className="table-cell font-mono text-xs text-wgray">{lead.id}</td>
                  <td className="table-cell">
                    <button
                      onClick={() => setDetails(lead)}
                      className="text-bone hover:text-copper transition-colors"
                    >
                      {lead.fullName}
                    </button>
                  </td>
                  <td className="table-cell text-wgray">{lead.interestedProgram}</td>
                  <td className="table-cell text-xs text-wgray">{lead.source}</td>
                  <td className="table-cell">
                    <StatusBadge status={lead.status} />
                  </td>
                  <td className="table-cell text-xs text-wgray">{formatDate(lead.createdAt)}</td>
                  <td className="table-cell">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(lead)}
                        className="p-2 text-wgray hover:text-copper transition-colors"
                        aria-label={`Edit lead ${lead.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleting(lead)}
                        className="p-2 text-wgray hover:text-red-400 transition-colors"
                        aria-label={`Delete lead ${lead.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-wgray">
            Page {safePage + 1} of {pageCount} — {filtered.length} results
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, safePage - 1))}
              disabled={safePage === 0}
              className="p-2 border border-wgray-dim text-wgray hover:text-bone disabled:opacity-30 transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
              disabled={safePage === pageCount - 1}
              className="p-2 border border-wgray-dim text-wgray hover:text-bone disabled:opacity-30 transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <Drawer
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? `Edit lead — ${editing.id}` : "New lead"}
      >
        <div className="space-y-4">
          <div>
            <label className="label-dark">Full name</label>
            <input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="input-dark"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-dark">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input-dark"
              />
            </div>
            <div>
              <label className="label-dark">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="input-dark"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-dark">Source</label>
              <select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value as Lead["source"] })}
                className="input-dark"
              >
                {SOURCE_LABELS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-dark">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Lead["status"] })}
                className="input-dark"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label-dark">Interested program</label>
            <input
              value={form.interestedProgram}
              onChange={(e) => setForm({ ...form, interestedProgram: e.target.value })}
              className="input-dark"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-dark">Fitness goal</label>
              <input
                value={form.fitnessGoal}
                onChange={(e) => setForm({ ...form, fitnessGoal: e.target.value })}
                className="input-dark"
              />
            </div>
            <div>
              <label className="label-dark">Assigned coach</label>
              <input
                value={form.assignedCoach}
                onChange={(e) => setForm({ ...form, assignedCoach: e.target.value })}
                className="input-dark"
              />
            </div>
          </div>
          <div>
            <label className="label-dark">Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input-dark"
            />
          </div>
          <button onClick={save} className="btn-primary w-full">
            {editing ? "Save Changes" : "Create Lead"}
          </button>
        </div>
      </Drawer>

      <Drawer
        open={detailLead !== null}
        onClose={() => setDetails(null)}
        title={detailLead ? `${detailLead.fullName} — ${detailLead.id}` : ""}
      >
        {detailLead && (
          <div className="space-y-8">
            <div>
              <div className="flex items-center gap-4 mb-5">
                <StatusBadge status={detailLead.status} />
                <select
                  value={detailLead.status}
                  onChange={(e) => {
                    updateLead(detailLead.id, { status: e.target.value as Lead["status"] });
                    logEvent("lead.updated", `${detailLead.id}:status:${e.target.value}`);
                  }}
                  className="input-dark w-40"
                  aria-label="Update lead status"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <dl className="space-y-3 text-sm">
                {[
                  ["Email", detailLead.email],
                  ["Phone", detailLead.phone],
                  ["Source", detailLead.source],
                  ["Interested in", detailLead.interestedProgram],
                  ["Goal", detailLead.fitnessGoal],
                  ["Coach", detailLead.assignedCoach],
                  ["Created", formatDate(detailLead.createdAt)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-wgray-dim/30 pb-2">
                    <dt className="text-wgray">{k}</dt>
                    <dd className="text-bone text-right">{v}</dd>
                  </div>
                ))}
                {detailLead.notes && (
                  <div className="border-b border-wgray-dim/30 pb-2">
                    <dt className="text-wgray mb-1">Notes</dt>
                    <dd className="text-bone">{detailLead.notes}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div>
              <h3 className="font-display font-semibold text-bone mb-3">Activity history</h3>
              <ol className="border-l border-wgray-dim ml-2 space-y-4">
                {detailLead.history.map((h, i) => (
                  <li key={i} className="pl-5 relative text-sm">
                    <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-copper" />
                    <p className="text-bone">{h.action}</p>
                    <p className="text-xs text-wgray-dim mt-0.5">{formatDate(h.at)}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <h3 className="font-display font-semibold text-bone mb-3">Internal notes</h3>
              {detailsNotes.length > 0 && (
                <div className="space-y-3 mb-4">
                  {detailsNotes.map((n) => (
                    <div key={n.id} className="bg-surface p-4 border border-wgray-dim/40">
                      <p className="text-sm text-bone">{n.note}</p>
                      <p className="text-xs text-wgray-dim mt-1">
                        {n.author} — {formatDate(n.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add an internal note..."
                  className="input-dark flex-1"
                />
                <button
                  onClick={() => {
                    if (!noteText.trim() || !detailLead) return;
                    addNote({ entityType: "lead", entityId: detailLead.id, note: noteText.trim() });
                    setNoteText("");
                  }}
                  className="btn-primary !px-4 !py-2"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete lead"
        message={`This permanently removes ${deleting?.fullName} (${deleting?.id}) from the CRM.`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteLead(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}
