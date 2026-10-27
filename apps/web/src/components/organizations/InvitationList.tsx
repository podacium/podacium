import { motion, AnimatePresence } from "framer-motion";
import { Mail, Check, X, Building2 } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { InvitationResponse } from "@/lib/api";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";

interface InvitationListProps {
  invitations: InvitationResponse[];
  onAccept: (token: string) => Promise<void>;
  onDecline: (token: string) => Promise<void>;
  loading: boolean;
}

export function InvitationList({
  invitations,
  onAccept,
  onDecline,
  loading,
}: InvitationListProps) {
  const t = useTranslations();

  if (invitations.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Mail className="w-5 h-5 text-blue-600" />
        {t("bi.organizations.invitations.title")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {invitations.map((invitation) => (
            <motion.div
              key={invitation.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-xl p-5 border border-blue-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group"
            >
              <div className="absolute top-0 end-0 w-24 h-24 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-bl-full -me-10 -mt-10 opacity-50 group-hover:scale-110 transition-transform duration-500" />

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <PodaciumBadge variant="default">
                    {invitation.role}
                  </PodaciumBadge>
                </div>

                <h3 className="font-semibold text-gray-900 mb-1">
                  {invitation.organization?.name}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {t("bi.organizations.invitations.invitedBy")}{" "}
                  <span className="font-medium text-gray-700">
                    {invitation.inviter?.fullName}
                  </span>
                </p>

                <div className="flex items-center gap-2 pt-2">
                  <PodaciumButton
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => onAccept(invitation.token)}
                    disabled={loading}
                    icon={<Check className="w-4 h-4" />}
                    className="flex-1"
                  >
                    {t("bi.organizations.invitations.actions.accept")}
                  </PodaciumButton>
                  <PodaciumButton
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onDecline(invitation.token)}
                    disabled={loading}
                    icon={<X className="w-4 h-4" />}
                    className="flex-1"
                  >
                    {t("bi.organizations.invitations.actions.decline")}
                  </PodaciumButton>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
