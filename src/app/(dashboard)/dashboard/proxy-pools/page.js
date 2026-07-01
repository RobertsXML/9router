"use client";

import { Badge, Button, Card, CardSkeleton, Input, Modal, Toggle, ConfirmModal } from "@/shared/components";
import useProxyPools from "./useProxyPools";

function getStatusVariant(status) {
  if (status === "active") return "success";
  if (status === "error") return "error";
  return "default";
}

function formatDateTime(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString();
}

// ── Sub-components ──────────────────────────────────────────────

function DeployRelayMenu({ show, menuRef, onToggle, onCloudflare, onVercel, onDeno }) {
  return (
    <div className="relative" ref={menuRef}>
      <Button
        size="sm"
        variant="secondary"
        icon="rocket_launch"
        onClick={onToggle}
      >
        Deploy Relay
        <span className="material-symbols-outlined ml-1 text-[18px]">
          {show ? "expand_less" : "expand_more"}
        </span>
      </Button>

      {show && (
        <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-xl border border-black/10 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-zinc-900 sm:left-auto sm:right-0">
          <button
            type="button"
            onClick={onCloudflare}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-main transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          >
            <span className="material-symbols-outlined text-[20px] text-orange-500">cloud</span>
            Cloudflare Relay
          </button>
          <button
            type="button"
            onClick={onVercel}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-main transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          >
            <span className="material-symbols-outlined text-[20px] text-blue-500">cloud_upload</span>
            Vercel Relay
          </button>
          <button
            type="button"
            onClick={onDeno}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-main transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          >
            <span className="material-symbols-outlined text-[20px] text-green-500">terminal</span>
            Deno Relay
          </button>
        </div>
      )}
    </div>
  );
}

function ProxyPoolRow({ pool, selected, testingId, onSelect, onTest, onEdit, onDelete, onToggleActive }) {
  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          aria-label={`Select proxy pool ${pool.name}`}
          className="mt-1 size-4 shrink-0 rounded border-black/20 dark:border-white/20"
        />
        <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="min-w-0 max-w-full truncate text-sm font-medium sm:max-w-[18rem]">{pool.name}</p>
          <Badge variant={getStatusVariant(pool.testStatus)} size="sm" dot>
            {pool.testStatus || "unknown"}
          </Badge>
          <Badge variant={pool.isActive ? "success" : "default"} size="sm">
            {pool.isActive ? "active" : "inactive"}
          </Badge>
          {pool.type === "vercel" && (
            <Badge variant="default" size="sm">vercel relay</Badge>
          )}
          {pool.type === "cloudflare" && (
            <Badge variant="default" size="sm">cloudflare relay</Badge>
          )}
          <Badge variant="default" size="sm">
            {pool.boundConnectionCount || 0} bound
          </Badge>
        </div>
        <p className="text-xs text-text-muted truncate mt-1">{pool.proxyUrl}</p>
        {pool.noProxy ? (
          <p className="text-xs text-text-muted truncate">No proxy: {pool.noProxy}</p>
        ) : null}
        <p className="text-xs text-text-muted mt-1">
          Last tested: {formatDateTime(pool.lastTestedAt)}
          {pool.lastError ? ` · ${pool.lastError}` : ""}
        </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1">
        <Toggle
          size="sm"
          checked={pool.isActive === true}
          onChange={onToggleActive}
          title={pool.isActive ? "Disable" : "Enable"}
        />
        <button
          type="button"
          onClick={onTest}
          className="p-2 rounded hover:bg-black/5 dark:hover:bg-white/5 text-text-muted hover:text-primary"
          title="Test proxy"
          disabled={testingId === pool.id}
        >
          <span
            className="material-symbols-outlined text-[18px]"
            style={testingId === pool.id ? { animation: "spin 1s linear infinite" } : undefined}
          >
            {testingId === pool.id ? "progress_activity" : "science"}
          </span>
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="p-2 rounded hover:bg-black/5 dark:hover:bg-white/5 text-text-muted hover:text-primary"
          title="Edit"
        >
          <span className="material-symbols-outlined text-[18px]">edit</span>
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-2 rounded hover:bg-red-500/10 text-red-500"
          title="Delete"
        >
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </div>
    </div>
  );
}

function BulkActionBar({ selectedIds, healthChecking, healthProgress, bulkBusy, poolCount, onHealthCheck, onActivate, onDeactivate, onDelete, onClear }) {
  if (selectedIds.length === 0 && !healthChecking) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
      <span className="material-symbols-outlined text-[18px] text-primary">checklist</span>
      <span className="text-xs font-medium text-primary">
        {selectedIds.length > 0 ? `${selectedIds.length} selected` : "All pools"}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          icon={healthChecking ? "progress_activity" : "health_and_safety"}
          onClick={onHealthCheck}
          disabled={healthChecking || bulkBusy || poolCount === 0}
        >
          {healthChecking ? `Checking ${healthProgress.current}/${healthProgress.total}` : "Health Check"}
        </Button>
        {selectedIds.length > 0 && (
          <>
            <Button size="sm" variant="secondary" icon="toggle_on" onClick={onActivate} disabled={bulkBusy || healthChecking}>
              Activate
            </Button>
            <Button size="sm" variant="secondary" icon="toggle_off" onClick={onDeactivate} disabled={bulkBusy || healthChecking}>
              Deactivate
            </Button>
            <Button size="sm" variant="secondary" icon="delete" onClick={onDelete} disabled={bulkBusy || healthChecking}>
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={onClear} disabled={bulkBusy || healthChecking}>
              Clear
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function BatchImportModal({ isOpen, importing, text, onTextChange, onImport, onClose }) {
  return (
    <Modal isOpen={isOpen} title="Batch Import Proxies" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="proxy-batch-import" className="text-sm font-medium text-text-main mb-1 block">Paste Proxy List (One per line)</label>
          <textarea
            id="proxy-batch-import"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder={"http://user:pass@127.0.0.1:7897\n127.0.0.1:7897:user:pass"}
            className="w-full min-h-[180px] py-2 px-3 text-sm text-text-main bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-md focus:ring-1 focus:ring-primary/30 focus:border-primary/50 focus:outline-none transition-all"
          />
          <p className="text-xs text-text-muted mt-1">
            Supported formats: protocol://user:pass@host:port, host:port:user:pass
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button fullWidth onClick={onImport} disabled={!text.trim() || importing}>
            {importing ? "Importing..." : "Import"}
          </Button>
          <Button fullWidth variant="ghost" onClick={onClose} disabled={importing}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function VercelDeployModal({ isOpen, form, deploying, onChange, onDeploy, onClose }) {
  return (
    <Modal isOpen={isOpen} title="Deploy Vercel Relay" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-blue-500/5 border border-blue-500/10 p-3 flex flex-col gap-1.5">
          <p className="text-sm text-text-main font-medium">What is Vercel Relay?</p>
          <p className="text-xs text-text-muted">
            Deploys an edge relay function to Vercel. All AI provider requests will be forwarded through Vercel&apos;s edge network, masking your real IP from providers.
          </p>
          <ul className="text-xs text-text-muted list-disc pl-4 space-y-0.5">
            <li>Your IP is replaced by Vercel&apos;s dynamic edge IPs (hundreds of IPs across 20+ global regions)</li>
            <li>Vercel serves millions of apps — providers can&apos;t block Vercel IPs without affecting legitimate traffic</li>
            <li>Free tier: 100GB bandwidth/month, 500K edge invocations</li>
            <li>Deploy multiple relays on different accounts for more IP diversity</li>
          </ul>
        </div>
        <Input
          label="Vercel API Token"
          value={form.vercelToken}
          onChange={(e) => onChange({ ...form, vercelToken: e.target.value })}
          placeholder="your-vercel-api-token"
          hint="Token is used once for deployment and not stored."
          type="password"
        />
        <Input
          label="Project Name"
          value={form.projectName}
          onChange={(e) => onChange({ ...form, projectName: e.target.value })}
          placeholder="my-relay"
          hint="Unique name for your Vercel project. Leave empty for auto-generated name."
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button fullWidth onClick={onDeploy} disabled={!form.vercelToken.trim() || deploying}>
            {deploying ? "Deploying... (may take ~1 min)" : "Deploy"}
          </Button>
          <Button fullWidth variant="ghost" onClick={onClose} disabled={deploying}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CloudflareDeployModal({ isOpen, form, deploying, onChange, onDeploy, onClose }) {
  return (
    <Modal isOpen={isOpen} title="Deploy Cloudflare Relay" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-orange-500/5 border border-orange-500/10 p-3 flex flex-col gap-1.5">
          <p className="text-sm text-text-main font-medium">What is Cloudflare Relay?</p>
          <p className="text-xs text-text-muted">
            Deploys a Cloudflare Worker as a proxy relay. All AI provider requests will be forwarded through Cloudflare&apos;s global edge network.
          </p>
          <ul className="text-xs text-text-muted list-disc pl-4 space-y-0.5">
            <li>High performance global routing and IP masking via Cloudflare Workers</li>
            <li>Free tier: 100,000 requests per day</li>
            <li>Requires Cloudflare Account ID and a Workers API Token (Edit Workers permission)</li>
          </ul>
          <div className="mt-2 pt-2 border-t border-orange-500/10 text-xs text-text-muted">
            <p className="font-medium text-text-main mb-1">How to generate your API Token:</p>
            <ol className="list-decimal pl-4 space-y-0.5">
              <li>Go to <b>My Profile</b> → <b>API Tokens</b> → <b>Create Token</b></li>
              <li>Scroll down to <b>Custom Token</b> and click <b>Get started</b></li>
              <li>Under <b>Permissions</b>: Account | Workers Scripts | Edit</li>
              <li>Under <b>Account Resources</b>: Include | Account | <i>Your Account Name</i></li>
              <li>Click <b>Continue to summary</b> → <b>Create Token</b></li>
            </ol>
          </div>
        </div>
        <Input
          label="Account ID"
          value={form.accountId}
          onChange={(e) => onChange({ ...form, accountId: e.target.value })}
          placeholder="your-cloudflare-account-id"
          hint="Found on the right side of the Cloudflare dashboard overview page."
        />
        <Input
          label="API Token"
          value={form.apiToken}
          onChange={(e) => onChange({ ...form, apiToken: e.target.value })}
          placeholder="your-cloudflare-api-token"
          hint='Requires "Workers Scripts: Edit" permission.'
          type="password"
        />
        <Input
          label="Worker Name"
          value={form.projectName}
          onChange={(e) => onChange({ ...form, projectName: e.target.value })}
          placeholder="my-relay"
          hint="Unique name for your Cloudflare Worker. Leave empty for auto-generated name."
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button fullWidth onClick={onDeploy} disabled={!form.accountId.trim() || !form.apiToken.trim() || deploying}>
            {deploying ? "Deploying..." : "Deploy Worker"}
          </Button>
          <Button fullWidth variant="ghost" onClick={onClose} disabled={deploying}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DenoDeployModal({ isOpen, form, deploying, onChange, onDeploy, onClose }) {
  return (
    <Modal isOpen={isOpen} title="Deploy Deno Relay" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 p-3 flex flex-col gap-1.5">
          <p className="text-sm text-text-main font-medium">What is Deno Relay?</p>
          <p className="text-xs text-text-muted">
            Deploys a relay worker to Deno Deploy&apos;s global edge network. All AI provider requests are forwarded through Deno&apos;s edge, masking your real IP.
          </p>
          <ul className="text-xs text-text-muted list-disc pl-4 space-y-0.5">
            <li>Deno Deploy v2 runs on a high-performance global edge network</li>
            <li>Free tier: 1M requests & 100GiB outbound traffic per month</li>
            <li>No per-request CPU time limits (unlike Vercel/Cloudflare)</li>
            <li>Support up to 20 active apps & 50 custom domains</li>
            <li>Deploy multiple relays for maximum IP diversity</li>
          </ul>
          <div className="mt-2 pt-2 border-t border-black/10 dark:border-white/10 text-xs text-text-muted">
            <p className="font-medium text-text-main mb-1">How to generate API token:</p>
            <ol className="list-decimal pl-4 space-y-0.5">
              <li>Go to <b>console.deno.com</b></li>
              <li>Select your <b>Organization</b> → <b>Settings</b> → <b>Organization Tokens</b></li>
              <li>Create a <b>Organization Token</b> (prefix <b>ddo_</b>)</li>
            </ol>
          </div>
        </div>
        <Input
          label="Deno Deploy API Token"
          value={form.denoToken}
          onChange={(e) => onChange({ ...form, denoToken: e.target.value })}
          placeholder="ddo_xxxxxxxxxxxxxxxx"
          hint="Token is used once for deployment, not stored. Found in Organization Settings."
          type="password"
        />
        <Input
          label="Organization Domain"
          value={form.orgDomain}
          onChange={(e) => onChange({ ...form, orgDomain: e.target.value })}
          placeholder="your-org.deno.net"
          hint="Organization's default domain. Your relay URL will be in the format: https://my-relay.your-org.deno.net"
        />
        <Input
          label="App Name"
          value={form.projectName}
          onChange={(e) => onChange({ ...form, projectName: e.target.value })}
          placeholder="deno-relay"
          hint="Unique app name. Leave empty for auto-generated name."
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button fullWidth onClick={onDeploy} disabled={!form.denoToken.trim() || !form.orgDomain.trim() || deploying}>
            {deploying ? "Deploying..." : "Deploy Relay"}
          </Button>
          <Button fullWidth variant="ghost" onClick={onClose} disabled={deploying}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ProxyPoolFormModal({ isOpen, editingPool, formData, saving, onSave, onClose }) {
  return (
    <Modal
      isOpen={isOpen}
      title={editingPool ? "Edit Proxy Pool" : "Add Proxy Pool"}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Name"
          value={formData.name}
          onChange={(e) => onSave({ ...formData, name: e.target.value })}
          placeholder="Office Proxy"
        />
        <Input
          label="Proxy URL"
          value={formData.proxyUrl}
          onChange={(e) => onSave({ ...formData, proxyUrl: e.target.value })}
          placeholder="http://127.0.0.1:7897"
        />
        <Input
          label="No Proxy"
          value={formData.noProxy}
          onChange={(e) => onSave({ ...formData, noProxy: e.target.value })}
          placeholder="localhost,127.0.0.1,.internal"
          hint="Comma-separated hosts/domains to bypass proxy"
        />

        <div className="flex flex-col gap-3 rounded-lg border border-border/50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-sm">Active</p>
            <p className="text-xs text-text-muted">Inactive pools are ignored by runtime resolution.</p>
          </div>
          <Toggle
            checked={formData.isActive === true}
            onChange={() => onSave({ ...formData, isActive: !formData.isActive })}
            disabled={saving}
          />
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border/50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-sm">Strict Proxy</p>
            <p className="text-xs text-text-muted">Fail request if proxy is unreachable instead of falling back to direct.</p>
          </div>
          <Toggle
            checked={formData.strictProxy === true}
            onChange={() => onSave({ ...formData, strictProxy: !formData.strictProxy })}
            disabled={saving}
          />
        </div>
      </div>
    </Modal>
  );
}

function ProxyPoolsHeader({ showRelayMenu, relayMenuRef, onToggleRelayMenu, onCloudflare, onVercel, onDeno, onBatchImport, onCreatePool }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold sm:text-2xl">Proxy Pools</h1>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
        <DeployRelayMenu
          show={showRelayMenu}
          menuRef={relayMenuRef}
          onToggle={onToggleRelayMenu}
          onCloudflare={onCloudflare}
          onVercel={onVercel}
          onDeno={onDeno}
        />

        <Button size="sm" variant="secondary" icon="upload" onClick={onBatchImport}>
          Batch Import
        </Button>
        <Button size="sm" icon="add" onClick={onCreatePool}>Add Proxy Pool</Button>
      </div>
    </div>
  );
}

function ProxyPoolsListCard({ proxyPools, selectedIds, allSelected, activeCount, testingId, healthChecking, healthProgress, bulkBusy, onToggleSelectAll, onSelect, onTest, onEdit, onDelete, onToggleActive, onCreatePool, onHealthCheck, onBulkActivate, onBulkDeactivate, onBulkDelete, onClearSelection }) {
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {proxyPools.length > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleSelectAll}
              className="size-4 rounded border-black/20 dark:border-white/20"
            />
            {allSelected ? "Unselect all" : "Select all"}
          </label>
        )}
        <Badge variant="default">Total: {proxyPools.length}</Badge>
        <Badge variant="success">Active: {activeCount}</Badge>
      </div>

      <BulkActionBar
        selectedIds={selectedIds}
        healthChecking={healthChecking}
        healthProgress={healthProgress}
        bulkBusy={bulkBusy}
        poolCount={proxyPools.length}
        onHealthCheck={onHealthCheck}
        onActivate={onBulkActivate}
        onDeactivate={onBulkDeactivate}
        onDelete={onBulkDelete}
        onClear={onClearSelection}
      />

      {proxyPools.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-text-main font-medium mb-1">No proxy pool entries yet</p>
          <p className="text-sm text-text-muted mb-4">
            Create a proxy pool entry, then assign it to connections.
          </p>
          <Button icon="add" onClick={onCreatePool}>Add Proxy Pool</Button>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-black/[0.04] dark:divide-white/[0.05]">
          {proxyPools.map((pool) => (
            <ProxyPoolRow
              key={pool.id}
              pool={pool}
              selected={selectedIds.includes(pool.id)}
              testingId={testingId}
              onSelect={() => onSelect(pool.id)}
              onTest={() => onTest(pool.id)}
              onEdit={() => onEdit(pool)}
              onDelete={() => onDelete(pool)}
              onToggleActive={() => onToggleActive(pool)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function ProxyPoolsModals({ state, handlers }) {
  return (
    <>
      <BatchImportModal
        isOpen={state.showBatchImportModal}
        importing={state.importing}
        text={state.batchImportText}
        onTextChange={(text) => handlers.setBatchImportText(text)}
        onImport={handlers.batchImport}
        onClose={() => { if (!state.importing) handlers.closeBatchImport(); }}
      />

      <VercelDeployModal
        isOpen={state.showVercelModal}
        form={state.vercelForm}
        deploying={state.deploying}
        onChange={(form) => handlers.setVercelForm(form)}
        onDeploy={handlers.vercelDeploy}
        onClose={() => { if (!state.deploying) handlers.closeVercel(); }}
      />

      <CloudflareDeployModal
        isOpen={state.showCloudflareModal}
        form={state.cloudflareForm}
        deploying={state.deploying}
        onChange={(form) => handlers.setCloudflareForm(form)}
        onDeploy={handlers.cloudflareDeploy}
        onClose={() => { if (!state.deploying) handlers.closeCloudflare(); }}
      />

      <DenoDeployModal
        isOpen={state.showDenoModal}
        form={state.denoForm}
        deploying={state.deploying}
        onChange={(form) => handlers.setDenoForm(form)}
        onDeploy={handlers.denoDeploy}
        onClose={() => { if (!state.deploying) handlers.closeDeno(); }}
      />

      <ProxyPoolFormModal
        isOpen={state.showFormModal}
        editingPool={state.editingProxyPool}
        formData={state.formData}
        saving={state.saving}
        onSave={(data) => handlers.setFormData(data)}
        onClose={handlers.closeForm}
      />

      <ConfirmModal
        isOpen={!!state.confirmState}
        onClose={handlers.closeConfirm}
        onConfirm={state.confirmState?.onConfirm}
        title={state.confirmState?.title || "Confirm"}
        message={state.confirmState?.message}
        variant="danger"
      />
    </>
  );
}

// ── Main component ──────────────────────────────────────────────

export default function ProxyPoolsPage() {
  const {
    state,
    dispatch,
    relayMenuRef,
    allSelected,
    activeCount,
    toggleSelectAll,
    clearSelection,
    openCreateModal,
    openEditModal,
    handleDelete,
    handleTest,
    handleToggleActive,
    bulkSetActive,
    bulkDelete,
    handleHealthCheck,
    handlers,
  } = useProxyPools();

  if (state.loading) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-1 sm:gap-6 sm:px-0">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-1 sm:gap-6 sm:px-0">
      <ProxyPoolsHeader
        showRelayMenu={state.showRelayMenu}
        relayMenuRef={relayMenuRef}
        onToggleRelayMenu={() => dispatch({ type: "SET", key: "showRelayMenu", value: !state.showRelayMenu })}
        onCloudflare={() => { dispatch({ type: "MERGE", values: { showCloudflareModal: true, showRelayMenu: false, cloudflareForm: { accountId: "", apiToken: "", projectName: "cloudflare-relay" } } }); }}
        onVercel={() => { dispatch({ type: "MERGE", values: { showVercelModal: true, showRelayMenu: false, vercelForm: { vercelToken: "", projectName: "vercel-relay" } } }); }}
        onDeno={() => { dispatch({ type: "MERGE", values: { showDenoModal: true, showRelayMenu: false, denoForm: { denoToken: "", orgDomain: "", projectName: "" } } }); }}
        onBatchImport={() => dispatch({ type: "MERGE", values: { batchImportText: "", showBatchImportModal: true } })}
        onCreatePool={openCreateModal}
      />

      <ProxyPoolsListCard
        proxyPools={state.proxyPools}
        selectedIds={state.selectedIds}
        allSelected={allSelected}
        activeCount={activeCount}
        testingId={state.testingId}
        healthChecking={state.healthChecking}
        healthProgress={state.healthProgress}
        bulkBusy={state.bulkBusy}
        onToggleSelectAll={toggleSelectAll}
        onSelect={(id) => dispatch({ type: "TOGGLE_SELECT", id })}
        onTest={handleTest}
        onEdit={openEditModal}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
        onCreatePool={openCreateModal}
        onHealthCheck={handleHealthCheck}
        onBulkActivate={() => bulkSetActive(true)}
        onBulkDeactivate={() => bulkSetActive(false)}
        onBulkDelete={bulkDelete}
        onClearSelection={clearSelection}
      />

      <ProxyPoolsModals
        state={state}
        handlers={handlers}
      />
    </div>
  );
}
