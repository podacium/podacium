/**
 * Notification formatting, internationalization, and BiDi text isolation utility.
 */

export interface NotificationLike {
  title?: string | null;
  body?: string | null;
  type?: string | null;
  category?: any;
  priority?: any;
  is_read?: boolean;
  isRead?: boolean;
  data?: any;
  created_at?: string | null;
  [key: string]: any;
}

export interface FormattedNotificationContent {
  title: string;
  body: string;
  categoryLabel: string;
  variables: Record<string, string>;
}

export function formatNotificationContent(
  notification: NotificationLike,
  t: any,
): FormattedNotificationContent {
  const rawVariables =
    notification.data?.variables ||
    notification.data?.meta ||
    notification.data ||
    {};

  const variables: Record<string, string> = {};

  Object.entries(rawVariables).forEach(([key, value]) => {
    if (typeof value === "string") {
      variables[key] = t.isolate ? t.isolate(value) : value;
    } else if (typeof value === "number") {
      variables[key] = String(value);
    }
  });

  // Normalize common parameters
  if (rawVariables.sender_name || rawVariables.senderName) {
    const sender = String(rawVariables.sender_name || rawVariables.senderName);
    variables.sender_name = t.isolate ? t.isolate(sender) : sender;
    variables.senderName = variables.sender_name;
  }

  if (rawVariables.device) {
    const deviceStr = String(rawVariables.device);
    variables.device = t.isolate ? t.isolate(deviceStr) : deviceStr;
  }

  if (rawVariables.role) {
    variables.role = t(
      `notifications.roles.${rawVariables.role}`,
      {},
      String(rawVariables.role),
    );
  }

  // 1. Resolve Title
  let title = "";
  const rawTitle = notification.title || "";

  if (rawTitle) {
    if (!rawTitle.includes(" ") && rawTitle.includes(".")) {
      title = t(rawTitle, variables);
    } else {
      // Check legacy patterns
      const msgMatch = rawTitle.match(/^New message from (.*)$/i);
      const devMatch = rawTitle.match(/^New Device Detected$/i);
      const invMatch = rawTitle.match(/^Invitation to join (.*)$/i);

      if (msgMatch) {
        const sender = msgMatch[1];
        title = t("notifications.chat.new_message", {
          sender_name: t.isolate ? t.isolate(sender) : sender,
        });
      } else if (devMatch) {
        title = t("settings-devices.notifications.newDevice.title");
      } else if (invMatch) {
        title = t("notifications.invitation.title", {
          orgName: t.isolate ? t.isolate(invMatch[1]) : invMatch[1],
        });
      } else {
        title = t.isolate ? t.isolate(rawTitle) : rawTitle;
      }
    }
  }

  // 2. Resolve Body
  let body = "";
  const rawBody = notification.body || "";

  if (rawBody) {
    if (!rawBody.includes(" ") && rawBody.includes(".")) {
      body = t(rawBody, variables);
    } else if (
      rawBody === "[Voice Note]" ||
      rawBody === "Voice note" ||
      rawBody === "[تسجيل صوتي]" ||
      rawBody === "[Note vocale]" ||
      rawBody === "notifications.chat.voice_note"
    ) {
      body = t("notifications.chat.voice_note");
    } else if (
      rawBody.toLowerCase() === "sent an attachment" ||
      rawBody === "notifications.chat.sent_attachment"
    ) {
      body = t("notifications.chat.sent_attachment");
    } else {
      const devBodyMatch = rawBody.match(
        /^New device \((.*)\) accessed your account/i,
      );
      if (devBodyMatch) {
        body = t("settings-devices.notifications.newDevice.body", {
          device: t.isolate ? t.isolate(devBodyMatch[1]) : devBodyMatch[1],
        });
      } else {
        body = t.isolate ? t.isolate(rawBody) : rawBody;
      }
    }
  }

  // 3. Resolve Category
  let categoryLabel = "";
  const rawType = (notification.type || "").toUpperCase();
  const rawCat = (notification.category || "").toUpperCase();

  if (
    rawType === "NEW_MESSAGE" ||
    rawType === "CHAT" ||
    rawCat === "MESSAGING"
  ) {
    categoryLabel = t("notifications.categories.MESSAGING");
  } else if (rawCat === "SECURITY") {
    categoryLabel = t("notifications.categories.SECURITY");
  } else if (rawCat === "PROJECT" || rawCat === "FREELANCE") {
    categoryLabel = t("notifications.categories.PROJECT");
  } else if (rawCat === "COURSE" || rawCat === "EDUCATION") {
    categoryLabel = t("notifications.categories.COURSE");
  } else if (rawCat === "BILLING") {
    categoryLabel = t("notifications.categories.BILLING");
  } else if (rawCat === "LIVE") {
    categoryLabel = t("notifications.categories.LIVE");
  } else if (rawCat === "SUPPORT") {
    categoryLabel = t("notifications.categories.SUPPORT");
  } else if (rawCat === "MARKETING") {
    categoryLabel = t("notifications.categories.MARKETING");
  } else {
    categoryLabel = t("notifications.categories.SYSTEM");
  }

  return {
    title,
    body,
    categoryLabel,
    variables,
  };
}
