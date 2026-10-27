"use client";

import React from "react";
import { WorkflowNode } from "./types";
import { useTranslations } from "@/lib/i18n";
import {
  PodaciumButton,
  PodaciumInput,
  PodaciumTextarea,
  PodaciumSelect,
  PodaciumBadge,
  PodaciumDrawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/design-system";
import { Trash2, Code2, Play, Zap, GitBranch, ShieldCheck } from "lucide-react";

interface WorkflowStepDrawerProps {
  node: WorkflowNode | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateNode: (updated: WorkflowNode) => void;
  onDeleteNode: (nodeId: string) => void;
}

export function WorkflowStepDrawer({
  node,
  isOpen,
  onClose,
  onUpdateNode,
  onDeleteNode,
}: WorkflowStepDrawerProps) {
  const t = useTranslations();

  if (!isOpen || !node) return null;

  const handleChange = (field: keyof WorkflowNode, value: any) => {
    onUpdateNode({
      ...node,
      [field]: value,
    });
  };

  const handleConfigChange = (key: string, value: any) => {
    onUpdateNode({
      ...node,
      config: {
        ...node.config,
        [key]: value,
      },
    });
  };

  return (
    <PodaciumDrawer
      isOpen={isOpen}
      onClose={onClose}
      position="end"
      size="md"
      variant="persistent"
    >
      <DrawerContent className="w-96 border-slate-800 bg-slate-900 text-slate-100 dark:bg-slate-900">
        {/* Header */}
        <DrawerHeader className="items-center border-slate-800 p-4">
          <div className="flex min-w-0 items-center gap-2">
            <PodaciumBadge
              variant="outline"
              className="text-xs uppercase font-mono"
            >
              {node.type}
            </PodaciumBadge>
            <DrawerTitle className="truncate text-base font-semibold text-slate-100">
              {t("developer.workflows.drawer.configureStep")}
            </DrawerTitle>
          </div>
          <DrawerClose
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label={t("developer.workflows.drawer.closeDrawerAria")}
          />
        </DrawerHeader>

        {/* Content Form */}
        <DrawerBody className="space-y-4 p-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              {t("developer.workflows.drawer.stepName")}
            </label>
            <PodaciumInput
              value={node.name || ""}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder={t("developer.workflows.drawer.stepNamePlaceholder")}
            />
          </div>

          {/* Trigger-Specific Fields */}
          {node.type === "trigger" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {t("developer.workflows.drawer.triggerEvent")}
                </label>
                <select
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  value={node.triggerType || "contract.created"}
                  onChange={(e) => handleChange("triggerType", e.target.value)}
                >
                  <option value="contract.created">
                    {t("developer.workflows.drawer.contractCreated")}
                  </option>
                  <option value="milestone.delivered">
                    Milestone Delivered
                  </option>
                  <option value="payment.received">
                    {t("developer.workflows.drawer.paymentReceived")}
                  </option>
                  <option value="course.completed">
                    {t("developer.workflows.drawer.courseCompleted")}
                  </option>
                </select>
              </div>
            </div>
          )}

          {/* Action-Specific Fields */}
          {node.type === "action" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {t("developer.workflows.drawer.actionType")}
                </label>
                <select
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  value={node.actionType || "execute_webhook"}
                  onChange={(e) => handleChange("actionType", e.target.value)}
                >
                  <option value="execute_webhook">
                    {t("developer.workflows.drawer.standardWebhookOption")}
                  </option>
                  <option value="wasm_transform">
                    {t("developer.workflows.drawer.wasmTransformOption")}
                  </option>
                  <option value="send_whatsapp_alert">
                    {t("developer.workflows.drawer.whatsappAlertOption")}
                  </option>
                  <option value="generate_anae_invoice">
                    {t("developer.workflows.drawer.anaeInvoiceOption")}
                  </option>
                  <option value="create_support_ticket">
                    {t("developer.workflows.drawer.supportTicketOption")}
                  </option>
                </select>
              </div>

              {node.actionType === "execute_webhook" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      {t("developer.workflows.drawer.destinationUrl")}
                    </label>
                    <PodaciumInput
                      value={(node.config?.url as string) || ""}
                      onChange={(e) =>
                        handleConfigChange("url", e.target.value)
                      }
                      placeholder="https://api.merchant.dz/webhooks/podacium"
                    />
                  </div>
                  <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700/60 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                      <ShieldCheck className="w-4 h-4" />
                      {t("developer.workflows.drawer.standardWebhooksActive")}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {t("developer.workflows.drawer.stampsDesc")}
                    </p>
                  </div>
                </>
              )}

              {node.actionType === "wasm_transform" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-purple-400 flex items-center gap-1">
                      <Code2 className="w-3.5 h-3.5" />{" "}
                      {t("developer.workflows.drawer.wasmFunction")}
                    </label>
                    <span className="text-[10px] font-mono text-slate-400">
                      {t("developer.workflows.drawer.ceilingDesc")}
                    </span>
                  </div>
                  <PodaciumTextarea
                    rows={6}
                    value={
                      (node.config?.transformScript as string) ||
                      "// Extism JavaScript transformation plugin\nfunction transform(payload) {\n  return {\n    event: payload.event_type,\n    dzd_amount: payload.data.amount_dzd,\n    fee_rate: 0.05,\n    timestamp_utc: new Date().toISOString()\n  };\n}"
                    }
                    onChange={(e) =>
                      handleConfigChange("transformScript", e.target.value)
                    }
                    className="font-mono text-xs text-purple-200 bg-slate-950"
                  />
                  <p className="text-[11px] text-slate-400">
                    {t("developer.workflows.drawer.sandboxedDesc")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Logic-Specific Fields */}
          {node.type === "logic" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {t("developer.workflows.drawer.logicCondition")}
                </label>
                <PodaciumInput
                  value={
                    (node.config?.condition as string) ||
                    "data.amount_dzd >= 50000"
                  }
                  onChange={(e) =>
                    handleConfigChange("condition", e.target.value)
                  }
                  placeholder={t(
                    "developer.workflows.drawer.logicConditionPlaceholder",
                  )}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {t("developer.workflows.drawer.delaySeconds")}
                </label>
                <PodaciumInput
                  type="number"
                  value={node.config?.delaySeconds ?? 0}
                  onChange={(e) =>
                    handleConfigChange(
                      "delaySeconds",
                      parseInt(e.target.value) || 0,
                    )
                  }
                />
              </div>
            </div>
          )}
        </DrawerBody>

        {/* Footer Actions */}
        <DrawerFooter className="justify-between border-slate-800 bg-slate-900/50 p-4">
          <PodaciumButton
            variant="outline"
            size="sm"
            onClick={() => {
              onDeleteNode(node.id);
              onClose();
            }}
            className="text-rose-400 border-rose-900/40 hover:bg-rose-950/50"
          >
            <Trash2 className="w-4 h-4 me-1.5" />{" "}
            {t("developer.workflows.drawer.deleteNode")}
          </PodaciumButton>
          <PodaciumButton variant="primary" size="sm" onClick={onClose}>
            {t("developer.workflows.drawer.doneBtn")}
          </PodaciumButton>
        </DrawerFooter>
      </DrawerContent>
    </PodaciumDrawer>
  );
}
