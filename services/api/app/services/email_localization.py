"""Localized strings for all Podacium email types.
Organized by locale (en/fr/ar/kab) and email type."""

LOCALIZED = {
    "ar": {
        "account_deleted": {
            "badge": "تحديث الحساب",
            "body": "تمت جدولة حذف حسابك في بوداسيوم. نحن آسفون لفراقك.",
            "deletion_date": "تاريخ الحذف النهائي",
            "feedback": "نود سماع ملاحظاتك حول كيفية تحسيننا.",
            "heading": "مرحبًا {name}،",
            "preheader": "تمت جدولة حذف حسابك في بوداسيوم. لديك 30 يومًا " "لاستعادته.",
            "recover_button": "استعادة حسابي",
            "recovery_body": "لديك <strong>30 يومًا</strong> لاستعادة "
            "حسابك بمجرد تسجيل الدخول مرة أخرى. بعد ذلك، "
            "سيتم حذف بياناتك نهائيًا.",
            "recovery_window": "نافذة الاسترداد",
            "subject": "نأسف لفراقك — تم تأكيد حذف الحساب",
            "support_link": "مشاركة الملاحظات",
            "text": "مرحبًا {name},\n"
            "\n"
            "تمت جدولة حذف حسابك في بوداسيوم.\n"
            "\n"
            "لديك 30 يومًا لاستعادة حسابك عن طريق تسجيل الدخول.\n"
            "\n"
            "إذا غيرت رأيك، قم بتسجيل الدخول خلال 30 يومًا.\n"
            "\n"
            "— فريق بوداسيوم",
            "title": "تمت جدولة حذف الحساب",
        },
        "completion": {
            "badge": "تم تحقيق الإنجاز",
            "body": "لقد أكملت بنجاح <strong>{course_name}</strong>. تفانيك "
            "وعملك الجاد أثمرا!",
            "certificate_button": "عرض الشهادة",
            "explore_button": "استكشف الدورات",
            "heading": "عمل رائع، {name}!",
            "next_steps": "مستعد للمزيد؟ استكشف دوراتنا المتقدمة.",
            "preheader": "لقد أكملت {course_name} في بوداسيوم — احصل على " "شهادتك!",
            "score_label": "النتيجة النهائية",
            "share": "شارك إنجازك مع شبكتك:",
            "subject": "تهانينا! لقد أكملت {course_name}",
            "text": "مرحبًا {name},\n"
            "\n"
            "تهانينا! لقد أكملت بنجاح {course_name}.\n"
            "\n"
            "عرض شهادتك: {url}\n"
            "\n"
            "مستعد للمزيد؟ استكشف دوراتنا المتقدمة.\n"
            "\n"
            "— فريق بوداسيوم",
            "title": "تهانينا!",
        },
        "contact": {
            "action_required": "إجراء مطلوب: يرجى الرد على هذا الاستفسار خلال "
            "24-48 ساعة.",
            "badge": "إشعار المشرف",
            "category_label": "الفئة",
            "email_label": "البريد الإلكتروني",
            "general_inquiry": "استفسار عام",
            "message_label": "محتوى الرسالة",
            "name_label": "الاسم الكامل",
            "no_subject": "لا يوجد موضوع",
            "not_provided": "غير متوفر",
            "phone_label": "رقم الهاتف",
            "preheader": "إرسال جديد من نموذج الاتصال من {name}.",
            "priority_label": "الأولوية",
            "priority_normal": "عادية",
            "reply_button": "الرد على {name}",
            "source_label": "المصدر",
            "source_website": "الموقع",
            "subject": "نموذج الاتصال: {subject}",
            "subject_label": "الموضوع",
            "text": "إرسال نموذج الاتصال - بوداسيوم\n"
            "{'='*50}\n"
            "\n"
            "من: {name}\n"
            "البريد: {email}\n"
            "الهاتف: {phone}\n"
            "الفئة: {category}\n"
            "الموضوع: {subject}\n"
            "\n"
            "الرسالة:\n"
            "{'='*50}\n"
            "{message}\n"
            "{'='*50}\n"
            "\n"
            "يرجى الرد على {name} خلال 24-48 ساعة.\n"
            "الرد على: {email}",
            "time_label": "الوقت",
            "title": "تم استلام رسالة جديدة",
        },
        "csat_survey": {
            "badge": "استبيان الرضا",
            "body": "تم حل تذكرتك <strong>#{ticket_number}</strong> — "
            '"<em>{ticket_subject}</em>". نود سماع رأيك.',
            "feedback_note": "ملاحظاتك تساعدنا على التحسين.",
            "heading": "مرحبًا {user_name}،",
            "preheader": "كيف كانت تجربتك مع دعم بوداسيوم؟ قيم تذكرتك " "الأخيرة.",
            "rating_button": "قيم تجربتك",
            "rating_question": "ما مدى رضاك عن الدعم الذي تلقيته؟",
            "subject": "كيف كانت تجربتك مع الدعم؟ (التذكرة: {ticket_number})",
            "text": "مرحبًا {user_name},\n"
            "\n"
            'تم حل تذكرتك #{ticket_number} — "{ticket_subject}".\n'
            "\n"
            "يرجى تقييم تجربتك:\n"
            "{rating_url}\n"
            "\n"
            "ملاحظاتك تساعدنا على التحسين.\n"
            "\n"
            "— فريق بوداسيوم",
            "title": "نحن نقدر ملاحظاتك",
        },
        "email_changed": {
            "badge": "تحديث أمني",
            "body": "تم تغيير عنوان البريد الإلكتروني لحسابك في بوداسيوم.",
            "heading": "مرحبًا {name}،",
            "new_email_label": "البريد الجديد",
            "not_you": "لم تفعل هذا؟",
            "not_you_body": "إذا لم تقم بهذا التغيير، يرجى الاتصال بالدعم " "فورًا.",
            "old_email_label": "البريد السابق",
            "preheader": "تم تغيير عنوان بريدك الإلكتروني في بوداسيوم. تحقق "
            "من هذا التغيير.",
            "subject": "تم تغيير عنوان بريدك الإلكتروني في بوداسيوم",
            "support_link": "اتصل بالدعم",
            "text": "مرحبًا {name},\n"
            "\n"
            "تم تغيير عنوان بريدك الإلكتروني في بوداسيوم:\n"
            "\n"
            "السابق: {old_email}\n"
            "الجديد: {new_email}\n"
            "الوقت: {time}\n"
            "\n"
            "إذا لم تقم بهذا التغيير، يرجى الاتصال بالدعم فورًا.\n"
            "\n"
            "— فريق بوداسيوم",
            "time_label": "وقت التغيير",
            "title": "تم تحديث البريد الإلكتروني",
        },
        "enrollment": {
            "badge": "تسجيل جديد",
            "body": "لقد تم تسجيلك بنجاح في <strong>{course_name}</strong>.",
            "heading": "تم التسجيل، {name}!",
            "preheader": "أنت مسجل في {course_name} — ابدأ التعلم اليوم!",
            "progress_tip": "تابع تقدمك، واحصل على شهادات، واطلق العنان "
            "لمهارات جديدة.",
            "start_button": "ابدأ التعلم",
            "subject": "أنت مسجل في {course_name}",
            "text": "مرحبًا {name},\n"
            "\n"
            "لقد تم تسجيلك بنجاح في {course_name}.\n"
            "\n"
            "ابدأ: {url}\n"
            "\n"
            "تابع تقدمك واحصل على شهادات.\n"
            "\n"
            "— فريق بوداسيوم",
            "title": "تم تأكيد التسجيل",
        },
        "invite": {
            "badge": "دعوة جديدة",
            "body": "<strong>{inviter_name}</strong> يدعوك للانضمام إلى مؤسسته على "
            "<strong>بوداسيوم</strong>.",
            "button": "قبول الدعوة",
            "collab_note": "بالانضمام، ستتمكن من التعاون في مجموعات البيانات "
            "ولوحات المعلومات والتحليلات المتقدمة.",
            "heading": "تمت دعوتك!",
            "ignore": "إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذا البريد "
            "الإلكتروني.",
            "invited_by": "مدعو من {inviter_name}",
            "org_label": "المؤسسة",
            "preheader": "تمت دعوتك للانضمام إلى {org_name} في بوداسيوم بدور "
            "{role}.",
            "role_label": "الدور: {role}",
            "subject": "دعوة للانضمام إلى {org_name} في بوداسيوم",
            "text": "مرحبًا،\n"
            "\n"
            "تمت دعوتك من قبل {inviter_name} للانضمام إلى {org_name} بدور "
            "{role} في بوداسيوم.\n"
            "\n"
            "للقبول، يرجى زيارة الرابط أدناه:\n"
            "{url}\n"
            "\n"
            "إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذا البريد "
            "الإلكتروني.\n"
            "\n"
            "— فريق بوداسيوم",
            "title": "تمت دعوتك!",
        },
        "invite_accepted": {
            "badge": "تحديث الفريق",
            "body": "<strong>{user_name}</strong> قبل دعوتك للانضمام إلى "
            "<strong>{org_name}</strong> بدور "
            "<strong>{role}</strong>.",
            "heading": "أخبار رائعة!",
            "manage_button": "إدارة الفريق",
            "preheader": "{user_name} قبل دعوتك للانضمام إلى {org_name}.",
            "subject": "{user_name} قبل دعوتك إلى {org_name}",
            "team_label": "أعضاء الفريق",
            "text": "مرحبًا {inviter_name},\n"
            "\n"
            "{user_name} قبل دعوتك للانضمام إلى {org_name} بدور "
            "{role}.\n"
            "\n"
            "يمكنك إدارة فريقك من لوحة التحكم.\n"
            "\n"
            "— فريق بوداسيوم",
            "title": "تم قبول الدعوة",
        },
        "magic_link": {
            "badge": "تسجيل دخول بدون كلمة مرور",
            "body": "انقر على الزر أدناه لتسجيل الدخول إلى حسابك في بوداسيوم "
            "فورًا وبدون كلمة مرور.",
            "cta": "تسجيل الدخول إلى بوداسيوم",
            "expiry": "هذا الرابط صالح للاستخدام لمرة واحدة فقط وينتهي خلال "
            "{expires_in_minutes} دقيقة.",
            "greeting": "مرحبًا {name}،",
            "preheader": "انقر على الرابط الآمن لتسجيل الدخول الفوري إلى " "بوداسيوم.",
            "security_note": "إذا لم تطلب هذا الرابط، يمكنك تجاهل هذه الرسالة "
            "بأمان.",
            "subject": "رابط تسجيل الدخول الخاص بك في بوداسيوم",
            "text": "مرحبًا {name}،\n"
            "\n"
            "انقر على الرابط أدناه لتسجيل الدخول إلى حسابك في "
            "بوداسيوم:\n"
            "\n"
            "{magic_url}\n"
            "\n"
            "هذا الرابط صالح لمرة واحدة فقط وينتهي خلال "
            "{expires_in_minutes} دقيقة.\n"
            "\n"
            "— فريق بوداسيوم",
            "title": "تسجيل الدخول إلى بوداسيوم",
        },
        "member_removed": {
            "badge": "تحديث المؤسسة",
            "body": "تمت إزالتك من <strong>{org_name}</strong> في " "بوداسيوم.",
            "heading": "مرحبًا {name}،",
            "preheader": "تمت إزالتك من {org_name} في بوداسيوم.",
            "reason_body": "إذا كنت تعتقد أن هذا خطأ، يرجى الاتصال بمالك "
            "المؤسسة أو فريق الدعم.",
            "subject": "تمت إزالتك من {org_name}",
            "support_button": "اتصل بالدعم",
            "text": "مرحبًا {name},\n"
            "\n"
            "تمت إزالتك من {org_name} في بوداسيوم.\n"
            "\n"
            "إذا كنت تعتقد أن هذا خطأ، يرجى الاتصال بفريق الدعم.\n"
            "\n"
            "— فريق بوداسيوم",
            "title": "تحديث العضوية",
        },
        "new_device": {
            "badge": "تنبيه أمني",
            "body": "تم تسجيل دخول جهاز جديد إلى حسابك في بوداسيوم. إذا كان "
            "هذا أنت، لا حاجة لاتخاذ إجراء. إذا لم تتعرف على هذا "
            "النشاط، يرجى تأمين حسابك فورًا.",
            "browser_label": "المتصفح",
            "device_label": "الجهاز",
            "heading": "مرحبًا {name}،",
            "ip_label": "عنوان IP",
            "location_label": "الموقع",
            "os_label": "نظام التشغيل",
            "preheader": "تم تسجيل دخول جهاز جديد إلى حسابك في بوداسيوم من "
            "{location}.",
            "secure_button": "تأمين حسابي",
            "subject": "تسجيل دخول جديد إلى حسابك في بوداسيوم",
            "text": "مرحبًا {name},\n"
            "\n"
            "تم تسجيل دخول جهاز جديد إلى حسابك في بوداسيوم:\n"
            "\n"
            "الجهاز: {device}\n"
            "المتصفح: {browser}\n"
            "نظام التشغيل: {os}\n"
            "IP: {ip}\n"
            "الموقع: {location}\n"
            "الوقت: {time}\n"
            "\n"
            "إذا كان هذا أنت، تجاهل هذه الرسالة. إذا لم تتعرف على هذا "
            "النشاط، يرجى تغيير كلمة المرور فورًا.\n"
            "\n"
            "— فريق بوداسيوم",
            "time_label": "الوقت",
            "title": "تم اكتشاف جهاز جديد",
            "trust_button": "نعم، هذا أنا",
            "unknown": "غير معروف",
        },
        "newsletter": {
            "badge": "النشرة البريدية",
            "body": "أنت الآن مشترك في نشرتنا البريدية. سنرسل لك تحديثات منسقة "
            "حول الدورات الجديدة وفرص العمل الحر ورؤى ذكاء الأعمال "
            "وأخبار المنصة.",
            "footer": "شكرًا لانضمامك،<br><strong>فريق بوداسيوم</strong>",
            "heading": "مرحبًا بك في مجتمع بوداسيوم، {name}!",
            "prefs": "يمكنك إلغاء الاشتراك في أي وقت من إعدادات الإشعارات.",
            "preheader": "لقد اشتركت بنجاح في النشرة البريدية من بوداسيوم — "
            "مرحبًا بك!",
            "subject": "أنت على القائمة! مرحبًا بك في النشرة البريدية من " "بوداسيوم",
            "text": "مرحبًا {name}،\n"
            "\n"
            "مرحبًا بك في مجتمع بوداسيوم!\n"
            "\n"
            "أنت الآن مشترك في نشرتنا البريدية. سنرسل لك تحديثات منسقة "
            "حول الدورات الجديدة وفرص العمل الحر ورؤى ذكاء الأعمال "
            "وأخبار المنصة.\n"
            "\n"
            "ما الذي يمكنك توقعه:\n"
            "- إصدارات دورات جديدة وتوصيات مسارات التعلم\n"
            "- فرص مشاريع العمل الحر وتحديثات السوق\n"
            "- نصائح ذكاء الأعمال ومجموعات بيانات وإلهام لوحات "
            "المعلومات\n"
            "- فعاليات حصرية للمجتمع ووصول مبكر للميزات الجديدة\n"
            "\n"
            "يمكنك إلغاء الاشتراك في أي وقت من إعدادات الإشعارات.\n"
            "\n"
            "شكرًا لانضمامك!\n"
            "— فريق بوداسيوم",
            "title": "تم تأكيد الاشتراك",
            "whatsnext_1": "[دورات] إصدارات دورات جديدة وتوصيات مسارات التعلم",
            "whatsnext_2": "[مشاريع] فرص مشاريع العمل الحر وتحديثات السوق",
            "whatsnext_3": "[تحليلات] نصائح ذكاء الأعمال ومجموعات بيانات "
            "وإلهام لوحات المعلومات",
            "whatsnext_4": "[فعاليات] فعاليات حصرية للمجتمع ووصول مبكر للميزات "
            "الجديدة",
            "whatsnext_title": "ما الذي يمكنك توقعه:",
        },
        "otp": {
            "badge": "رمز الأمان",
            "body": "يرجى استخدام رمز التحقق أدناه لإكمال تسجيل الدخول إلى بوداسيوم:",
            "expiry": "ينتهي صلاحية هذا الرمز خلال 5 دقائق.",
            "heading": "التحقق مطلوب",
            "not_you": "إذا لم تحاول تسجيل الدخول، يرجى تغيير كلمة المرور فورًا.",
            "preheader": "استخدم هذا الرمز لإكمال تسجيل الدخول إلى بوداسيوم.",
            "subject": "رمز التحقق الخاص بك في بوداسيوم",
            "text": "رمز التحقق الخاص بك في بوداسيوم هو: {code}\n"
            "\n"
            "ينتهي صلاحية هذا الرمز خلال 5 دقائق. لا تشاركه.\n"
            "\n"
            "إذا لم تحاول تسجيل الدخول، يرجى تغيير كلمة المرور فورًا.",
            "title": "التحقق بخطوتين",
            "warning": "لا تشارك هذا الرمز مع أي شخص. لن يطلب منك بوداسيوم هذا الرمز "
            "أبدًا.",
        },
        "password_changed": {
            "badge": "تحديث أمني",
            "body": "تم تغيير كلمة مرور بوداسيوم الخاصة بك بنجاح. تم "
            "تسجيل خروج جميع الجلسات النشطة الأخرى لأمانك.",
            "heading": "مرحبًا {name}،",
            "ip_label": "عنوان IP",
            "not_you": "لم تفعل هذا؟",
            "not_you_body": "إذا لم تقم بتغيير كلمة المرور، يرجى الاتصال "
            "بالدعم فورًا.",
            "preheader": "تم تغيير كلمة مرور بوداسيوم الخاصة بك. إذا لم "
            "يكن هذا أنت، اتخذ إجراءً فورًا.",
            "reset_link": "إعادة تعيين كلمة المرور",
            "subject": "تم تغيير كلمة مرور بوداسيوم الخاصة بك",
            "support_link": "اتصل بالدعم",
            "text": "مرحبًا {name},\n"
            "\n"
            "تم تغيير كلمة مرور بوداسيوم الخاصة بك بنجاح.\n"
            "\n"
            "الوقت: {time}\n"
            "IP: {ip}\n"
            "\n"
            "تم تسجيل خروج جميع الجلسات الأخرى لأمانك.\n"
            "\n"
            "إذا لم تقم بتغيير كلمة المرور، يرجى الاتصال بالدعم "
            "فورًا.\n"
            "\n"
            "— فريق بوداسيوم",
            "time_label": "وقت التغيير",
            "title": "تم تغيير كلمة المرور بنجاح",
        },
        "payment": {
            "amount_label": "المبلغ",
            "badge": "إيصال",
            "body": "تمت معالجة دفعتك بنجاح.",
            "date_label": "التاريخ",
            "heading": "شكرًا لك، {name}!",
            "item_label": "العنصر",
            "preheader": "تمت معالجة دفعتك في بوداسيوم بقيمة {amount}.",
            "receipt_button": "عرض الإيصال",
            "status_label": "الحالة",
            "status_paid": "مدفوع",
            "subject": "تم تأكيد الدفع – إيصال من بوداسيوم",
            "text": "مرحبًا {name},\n"
            "\n"
            "تمت معالجة دفعتك بنجاح.\n"
            "\n"
            "المبلغ: {amount}\n"
            "العنصر: {item}\n"
            "التاريخ: {date}\n"
            "المعرف: {transaction_id}\n"
            "\n"
            "عرض إيصالك: {url}\n"
            "\n"
            "— فريق بوداسيوم",
            "title": "تم تأكيد الدفع",
            "transaction_label": "معرف المعاملة",
        },
        "proposal": {
            "amount_label": "الميزانية",
            "badge": "تحديث العمل الحر",
            "body": "لقد تلقيت اقتراحًا جديدًا لمشروعك "
            "<strong>{project_title}</strong>.",
            "freelancer_label": "المستقل",
            "heading": "مرحبًا {name}،",
            "message_label": "الرسالة",
            "preheader": "لقد تلقيت اقتراحًا جديدًا لمشروعك {project_title}.",
            "review_button": "مراجعة الاقتراح",
            "subject": "اقتراح جديد لـ {project_title}",
            "text": "مرحبًا {name},\n"
            "\n"
            "لقد تلقيت اقتراحًا جديدًا لمشروعك {project_title}.\n"
            "\n"
            "المستقل: {freelancer}\n"
            "المبلغ: {amount}\n"
            "\n"
            "المراجعة: {url}\n"
            "\n"
            "— فريق بوداسيوم",
            "title": "تم استلام اقتراح جديد",
        },
        "refund": {
            "amount_label": "المبلغ المسترد",
            "badge": "استرداد",
            "body": "تمت معالجة استردادك بنجاح. تم إيداع المبلغ في محفظتك في "
            "بوداسيوم.",
            "heading": "مرحبًا {name}،",
            "preheader": "تمت معالجة استرداد مبلغ {amount} من بوداسيوم وإيداعه في "
            "محفظتك.",
            "refund_label": "معرف الاسترداد",
            "status_label": "الحالة",
            "status_refunded": "مسترد",
            "subject": "تمت معالجة الاسترداد – تم إيداع {amount} في محفظتك",
            "text": "مرحبًا {name},\n"
            "\n"
            "تمت معالجة استردادك بنجاح.\n"
            "\n"
            "المبلغ المسترد: {amount}\n"
            "المعاملة: {transaction_id}\n"
            "الاسترداد: {refund_id}\n"
            "\n"
            "عرض محفظتك: {url}\n"
            "\n"
            "— فريق بوداسيوم",
            "title": "تمت معالجة الاسترداد",
            "transaction_label": "معرف المعاملة الأصلي",
            "wallet_button": "عرض محفظتي",
        },
        "reset": {
            "badge": "تحديث أمني",
            "body": "لقد تلقينا طلبًا لإعادة تعيين كلمة مرور بوداسيوم الخاصة بك لـ "
            "<strong>{email}</strong>.",
            "button": "إعادة تعيين كلمة المرور",
            "cta": "لإنشاء كلمة مرور جديدة وآمنة، يرجى النقر على الزر أدناه:",
            "heading": "مرحبًا {name},",
            "ignore": "إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد "
            "الإلكتروني.",
            "preheader": "أعد تعيين كلمة مرور بوداسيوم — ينتهي صلاحية هذا الرابط "
            "خلال 24 ساعة.",
            "security": "سينتهي صلاحية رابط إعادة التعيين هذا خلال 24 ساعة.",
            "subject": "إعادة تعيين كلمة المرور في بوداسيوم",
            "text": "مرحبًا {name},\n"
            "\n"
            "لقد تلقينا طلبًا لإعادة تعيين كلمة مرور بوداسيوم الخاصة بك لـ "
            "{email}.\n"
            "\n"
            "لإعادة تعيين كلمة المرور، يرجى زيارة هذا الرابط:\n"
            "{url}\n"
            "\n"
            "سينتهي صلاحية هذا الرابط خلال 24 ساعة.\n"
            "\n"
            "إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا البريد "
            "الإلكتروني.\n"
            "\n"
            "— فريق بوداسيوم",
            "title": "طلب إعادة تعيين كلمة المرور",
        },
        "role_changed": {
            "badge": "تحديث المؤسسة",
            "body": "تم تحديث دورك في <strong>{org_name}</strong>.",
            "heading": "مرحبًا {name}،",
            "new_role_label": "الدور الجديد",
            "old_role_label": "الدور السابق",
            "org_button": "افتح المؤسسة",
            "preheader": "تم تغيير دورك في {org_name} إلى {role}.",
            "subject": "تم تحديث دورك في {org_name}",
            "text": "مرحبًا {name},\n"
            "\n"
            "تم تحديث دورك في {org_name} من {old_role} إلى "
            "{new_role}.\n"
            "\n"
            "— فريق بوداسيوم",
            "title": "تم تحديث الدور",
        },
        "shared": {
            "alt_link": "إذا لم يعمل الزر، يمكنك نسخ ولصق هذا الرابط في متصفحك:",
            "brand": "بوداسيوم",
            "footer_company": "بوداسيوم — منصة علم البيانات والذكاء الاصطناعي "
            "وذكاء الأعمال",
            "footer_privacy": "سياسة الخصوصية",
            "footer_rights": "جميع الحقوق محفوظة.",
            "footer_sent_to": "أرسل إلى {email}",
            "footer_support": "اتصل بالدعم",
            "footer_terms": "شروط الخدمة",
            "ignore": "إذا لم تطلب هذا البريد الإلكتروني، يمكنك تجاهله بأمان. "
            "حسابك لا يزال آمنًا.",
            "manage_prefs": "تفضيلات الإشعارات",
            "regards": "مع أطيب التحيات،<br><strong>فريق بوداسيوم</strong>",
            "security_badge": "تحديث أمني",
            "tagline": "تمكين مستقبل الذكاء",
            "year": "{year}",
        },
        "subscription": {
            "amount_label": "المبلغ",
            "badge": "تحديث الفوترة",
            "body": "تم تحديث اشتراكك في بوداسيوم.",
            "cancelled_label": "ملغي",
            "heading": "مرحبًا {name}،",
            "manage_button": "إدارة الاشتراك",
            "plan_label": "الخطة",
            "preheader": "تم {status} اشتراكك في بوداسيوم في خطة {plan}.",
            "renewal_label": "التجديد القادم",
            "started_label": "تاريخ البدء",
            "status_label": "الحالة",
            "subject": "تم تحديث اشتراكك في بوداسيوم",
            "text": "مرحبًا {name},\n"
            "\n"
            "تم تحديث اشتراكك في بوداسيوم.\n"
            "\n"
            "الخطة: {plan}\n"
            "المبلغ: {amount}\n"
            "الحالة: {status}\n"
            "\n"
            "إدارة اشتراكك: {url}\n"
            "\n"
            "— فريق بوداسيوم",
            "title": "تحديث الاشتراك",
        },
        "verify": {
            "badge": "تحقق من حسابك",
            "body": "يسعدنا انضمامك إلى <strong>بوداسيوم</strong> — منصتك الرائدة "
            "في علم البيانات والذكاء الاصطناعي وذكاء الأعمال.",
            "button": "تأكيد بريدي الإلكتروني",
            "cta": "لتفعيل حسابك بالكامل، يرجى تأكيد بريدك الإلكتروني أدناه:",
            "heading": "مرحبًا بك في بوداسيوم، {name}!",
            "ignore": "إذا لم تقم بإنشاء حساب، يمكنك تجاهل هذا البريد الإلكتروني.",
            "preheader": "مرحبًا بك في بوداسيوم — قم بتأكيد بريدك الإلكتروني "
            "لتفعيل حسابك.",
            "security": "لحماية حسابك، ستنتهي صلاحية هذا الرابط بعد 7 أيام.",
            "subject": "تأكيد بريدك الإلكتروني – تفعيل حسابك في بوداسيوم",
            "text": "مرحبًا {name},\n"
            "\n"
            "مرحبًا بك في بوداسيوم — منصتك لعلم البيانات والذكاء الاصطناعي "
            "وذكاء الأعمال.\n"
            "\n"
            "لتفعيل حسابك، يرجى تأكيد بريدك الإلكتروني بالنقر على الرابط "
            "أدناه:\n"
            "\n"
            "{url}\n"
            "\n"
            "ستنتهي صلاحية هذا الرابط بعد 7 أيام.\n"
            "\n"
            "إذا لم تقم بإنشاء حساب، يمكنك تجاهل هذه الرسالة.\n"
            "\n"
            "— فريق بوداسيوم",
            "title": "مرحبًا بك في بوداسيوم",
        },
        "waitlist_confirmation": {
            "badge": "وصول مبكر",
            "footer": "مرحبًا بك،<br><strong>فريق بوداسيوم</strong>",
            "greeting": "مرحبًا {name}،",
            "position_info": "أنت رقم #{position} في قائمة انتظار "
            "بوداسيوم. سنخطرك بمجرد أن يصبح مكانك "
            "جاهزًا.",
            "prefs": "يمكنك إلغاء الاشتراك في أي وقت، لكننا نود " "إبقاءك على اطلاع.",
            "preheader": "أنت رقم #{position} في الطابور. شارك رابط "
            "الإحالة الخاص بك للتقدم!",
            "reward_info": "قم بدعوة 5 أصدقاء للحصول على شهر مجاني " "من بوداسيوم برو!",
            "share_button": "شارك رابطك",
            "share_title": "رابط الإحالة الخاص بك:",
            "subject": "أنت في قائمة انتظار بوداسيوم!",
            "text": "مرحبًا {name}،\n"
            "\n"
            "أنت رقم #{position} في قائمة انتظار بوداسيوم. "
            "شارك رابطك مع أصدقائك للتقدم في الطابور!\n"
            "\n"
            "رابط الإحالة الخاص بك: "
            "https://podacium.com/waitlist?ref={referral_code}\n"
            "\n"
            "قم بدعوة 5 أصدقاء للحصول على شهر مجاني من "
            "بوداسيوم برو!\n"
            "\n"
            "ما هو التالي:\n"
            "- وصول مبكر للدورات والعمل الحر وأدوات ذكاء "
            "الأعمال\n"
            "- أولوية التسجيل عند الإطلاق\n"
            "- وصول حصري للمجتمع\n"
            "- عروض خاصة لأعضاء قائمة الانتظار\n"
            "\n"
            "مرحبًا بك!\n"
            "— فريق بوداسيوم",
            "title": "مرحبًا بك في المستقبل",
            "whats_next": "ما هو التالي:\n"
            "• وصول مبكر للدورات والعمل الحر وأدوات "
            "ذكاء الأعمال\n"
            "• أولوية التسجيل عند الإطلاق\n"
            "• وصول حصري للمجتمع\n"
            "• عروض خاصة لأعضاء قائمة الانتظار",
        },
        "waitlist_drip_day14": {
            "badge": "قائمة الانتظار",
            "body": "يحصل الأعضاء الأوائل في قائمة الانتظار على "
            "أولوية التسجيل وعروض إطلاق حصرية. كلما دعوت "
            "أشخاصًا أكثر، ارتفع ترتيبك.",
            "footer": "نراك قريبًا،<br><strong>فريق بوداسيوم</strong>",
            "heading": "مرحبًا {name}،",
            "preheader": "الأصدقاء الذين تدعوهم اليوم ينضمون إليك عند " "الإطلاق.",
            "referral_button": "دعوة الأصدقاء",
            "referral_info": "قم بدعوة 5 أصدقاء للحصول على شهر مجاني "
            "من بوداسيوم برو!",
            "referral_label": "رابط الإحالة الشخصي الخاص بك:",
            "subject": "رمز الإحالة الخاص بك لا يزال نشطًا",
            "text": "مرحبًا {name}،\n"
            "\n"
            "رابط الإحالة الخاص بك لا يزال نشطًا:\n"
            "\n"
            "https://podacium.com/waitlist?ref={referral_code}\n"
            "\n"
            "الأعضاء الأوائل يحصلون على أولوية التسجيل وعروض "
            "حصرية.\n"
            "\n"
            "— فريق بوداسيوم",
            "title": "ادعُ شبكتك",
        },
        "waitlist_drip_day3": {
            "badge": "قائمة الانتظار",
            "body": "مكانك في قائمة الانتظار محجوز، لكن الوصول المبكر "
            "مخصص لمن يتقدم في الطابور. شارك رابط الإحالة "
            "الخاص بك أدناه — كل صديق ينضم يرفع ترتيبك.",
            "footer": "نراك قريبًا،<br><strong>فريق بوداسيوم</strong>",
            "heading": "مرحبًا {name}،",
            "preheader": "ادعُ 5 أصدقاء واحصل على شهر مجاني من " "بوداسيوم برو.",
            "referral_button": "دعوة الأصدقاء",
            "referral_info": "قم بدعوة 5 أصدقاء للحصول على شهر مجاني "
            "من بوداسيوم برو!",
            "referral_label": "رابط الإحالة الشخصي الخاص بك:",
            "subject": "مكانك في الوصول المبكر لبوداسيوم في انتظارك",
            "text": "مرحبًا {name}،\n"
            "\n"
            "مكانك في قائمة الانتظار محجوز. شارك رابط الإحالة "
            "الخاص بك للتقدم في الطابور:\n"
            "\n"
            "https://podacium.com/waitlist?ref={referral_code}\n"
            "\n"
            "قم بدعوة 5 أصدقاء للحصول على شهر مجاني من "
            "بوداسيوم برو!\n"
            "\n"
            "— فريق بوداسيوم",
            "title": "لا تفقد مكانك",
        },
        "waitlist_drip_day30": {
            "badge": "قائمة الانتظار",
            "body": "هذا تنبيهك الأخير: مكافآت الإحالة ومزايا الوصول "
            "المبكر مقتصرة على أعضاء قائمة الانتظار. شارك "
            "رابطك قبل الإطلاق.",
            "footer": "نراك قريبًا،<br><strong>فريق بوداسيوم</strong>",
            "heading": "مرحبًا {name}،",
            "preheader": "مكانك المحجوز ومزاياك لن تدوم إلى الأبد.",
            "referral_button": "دعوة الأصدقاء",
            "referral_info": "قم بدعوة 5 أصدقاء للحصول على شهر مجاني "
            "من بوداسيوم برو!",
            "referral_label": "رابط الإحالة الشخصي الخاص بك:",
            "subject": "تنبيه أخير — احجز مزايا بوداسيوم الخاصة بك",
            "text": "مرحبًا {name}،\n"
            "\n"
            "تنبيه أخير — مكافآت الإحالة ومزايا الوصول المبكر "
            "مقتصرة على أعضاء قائمة الانتظار:\n"
            "\n"
            "https://podacium.com/waitlist?ref={referral_code}\n"
            "\n"
            "قم بدعوة 5 أصدقاء للحصول على شهر مجاني من "
            "بوداسيوم برو!\n"
            "\n"
            "— فريق بوداسيوم",
            "title": "تنبيه أخير",
        },
        "waitlist_drip_day7": {
            "badge": "قائمة الانتظار",
            "body": "تنطلق بوداسيوم بثلاث ركائز متكاملة: دورات تعليمية "
            "مع شهادات موثقة، وسوق عمل حر بالدينار الجزائري، "
            "وأدوات ذكاء أعمال للشركات الصغيرة والمتوسطة. كلها "
            "متصلة بمحفظة واحدة.",
            "footer": "نراك قريبًا،<br><strong>فريق بوداسيوم</strong>",
            "heading": "مرحبًا {name}،",
            "preheader": "دورات تدريبية، عمل حر، وذكاء أعمال — منصة " "واحدة.",
            "referral_button": "دعوة الأصدقاء",
            "referral_info": "قم بدعوة 5 أصدقاء للحصول على شهر مجاني "
            "من بوداسيوم برو!",
            "referral_label": "رابط الإحالة الشخصي الخاص بك:",
            "subject": "ما الذي سيأتي أولاً إلى بوداسيوم",
            "text": "مرحبًا {name}،\n"
            "\n"
            "دورات مع شهادات موثقة. سوق عمل حر بالدينار "
            "الجزائري. ذكاء أعمال للمؤسسات. منصة واحدة، محفظة "
            "واحدة.\n"
            "\n"
            "شارك رابط الإحالة الخاص بك للتقدم:\n"
            "\n"
            "https://podacium.com/waitlist?ref={referral_code}\n"
            "\n"
            "— فريق بوداسيوم",
            "title": "مصمم لنموك المهني",
        },
        "welcome": {
            "badge": "مرحبًا بك",
            "bi_cta": "افتح BI Studio",
            "bi_desc": "أنشئ لوحات بيانات قوية واكتشف الرؤى باستخدام أدوات BI.",
            "bi_title": "حلل البيانات",
            "body": "تم التحقق من حسابك وهو جاهز. إليك بعض الأشياء التي يمكنك "
            "القيام بها:",
            "heading": "مرحبًا، {name}!",
            "hub_cta": "استكشف المركز",
            "hub_desc": "انضم إلى المشاريع، وتواصل مع المستقلين، ووسّع شبكتك.",
            "hub_title": "تواصل وتعاون",
            "learn_cta": "تصفح الدورات",
            "learn_desc": "تصفح مكتبتنا من دورات علم البيانات والذكاء الاصطناعي "
            "وذكاء الأعمال.",
            "learn_title": "استكشف الدورات",
            "preheader": "مرحبًا بك في بوداسيوم! إليك كل ما تحتاجه للبدء.",
            "profile_cta": "تعديل الملف الشخصي",
            "profile_desc": "أضف مهاراتك وخبراتك وصورة ملفك الشخصي لتتميز.",
            "profile_title": "أكمل ملفك الشخصي",
            "subject": "مرحبًا بك في بوداسيوم – لنبدأ!",
            "support": "تحتاج مساعدة؟ فريق الدعم لدينا في خدمتك.",
            "support_cta": "الحصول على المساعدة",
            "text": "مرحبًا {name},\n"
            "\n"
            "مرحبًا بك في بوداسيوم! تم التحقق من حسابك وهو جاهز.\n"
            "\n"
            "للبدء:\n"
            "- تصفح دوراتنا في علم البيانات والذكاء الاصطناعي وذكاء "
            "الأعمال\n"
            "- أنشئ لوحات بيانات باستخدام BI Studio\n"
            "- تواصل مع المستقلين وانضم إلى المشاريع\n"
            "- أكمل ملفك الشخصي\n"
            "\n"
            "ابدأ: {url}\n"
            "\n"
            "تحتاج مساعدة؟ اتصل بنا: {support_url}\n"
            "\n"
            "— فريق بوداسيوم",
            "title": "مرحبًا بك في بوداسيوم!",
        },
        "welcome_d1": {
            "badge": "نصائح",
            "body": "إليك نصيحتين سريعتين لبداية موفقة.",
            "heading": "يسعدنا وجودك معنا، {name}!",
            "preheader": "استفد إلى أقصى حد من أسبوعك الأول في بوداسيوم.",
            "subject": "نصيحة: مشروعك الأول في بوداسيوم",
            "support": "أسئلة؟ فريق الدعم لدينا يسعد بمساعدتك.",
            "support_cta": "الحصول على المساعدة",
            "text": "مرحبًا {name},\n"
            "\n"
            "إليك نصيحتين سريعتين للبدء:\n"
            "- خذ دورة قصيرة في مجالك\n"
            "- أكمل ملفك الشخصي لجذب الفرص\n"
            "\n"
            "تصفح الدورات: {url}/learn\n"
            "إكمال الملف الشخصي: {url}/settings\n"
            "\n"
            "— فريق بوداسيوم",
            "tip1_cta": "تصفح الدورات",
            "tip1_desc": "ابدأ بدورة قصيرة في مجال اهتمامك.",
            "tip1_title": "خذ دورة",
            "tip2_cta": "إكمال الملف الشخصي",
            "tip2_desc": "ملف شخصي كامل يساعدك على التواصل مع الأشخاص " "المناسبين.",
            "tip2_title": "أنشئ ملفك الشخصي",
            "title": "اليوم 1 – نصائح سريعة",
        },
        "welcome_d3": {
            "badge": "المجتمع",
            "body": "التعلم معًا أفضل. إليك كيفية التواصل مع مجتمع بوداسيوم.",
            "community_cta": "استكشف المجتمع",
            "community_desc": "شارك في المناقشات وتبادل المعرفة وابحث عن " "متعاونين.",
            "community_title": "انضم إلى المجتمع",
            "heading": "وسّع شبكتك، {name}!",
            "network_cta": "ابحث عن مرشدين",
            "network_desc": "تواصل مع محترفين ذوي خبرة مستعدين لإرشادك.",
            "network_title": "ابحث عن مرشدين",
            "preheader": "لست وحدك — تواصل مع زملائك والموجهين.",
            "subject": "تواصل مع مجتمع بوداسيوم",
            "support": "تحتاج مساعدة في العثور على مجتمعك؟ تواصل معنا.",
            "support_cta": "الحصول على المساعدة",
            "text": "مرحبًا {name},\n"
            "\n"
            "تواصل مع مجتمع بوداسيوم:\n"
            "- شارك في المناقشات وابحث عن متعاونين\n"
            "- تواصل مع مرشدين يمكنهم إرشادك\n"
            "\n"
            "استكشف: {url}/community\n"
            "\n"
            "— فريق بوداسيوم",
            "title": "اليوم 3 – المجتمع",
        },
        "welcome_d7": {
            "badge": "مميز",
            "body": "لقد مضى أسبوع — إليك كيفية الارتقاء بتجربتك.",
            "heading": "مر أسبوع، {name}!",
            "portal_cta": "افتح BI Studio",
            "portal_desc": "أنشئ لوحات بيانات متقدمة مع رؤى الذكاء الاصطناعي "
            "والبيانات في الوقت الفعلي.",
            "portal_title": "BI Studio Pro",
            "preheader": "افتح القوة الكاملة لبوداسيوم مع الميزات المميزة.",
            "premium_cta": "اطّلع على الخطط",
            "premium_desc": "احصل على دورات غير محدودة وأدوات BI متقدمة ودعم "
            "أولوية.",
            "premium_title": "اشترك في Premium",
            "subject": "افتح الميزات المميزة في بوداسيوم",
            "support": "أسئلة حول الميزات المميزة؟ نحن هنا للمساعدة.",
            "support_cta": "الحصول على المساعدة",
            "text": "مرحبًا {name},\n"
            "\n"
            "لقد مر أسبوع! إليك كيفية الذهاب أبعد:\n"
            "- اشترك في Premium للوصول غير المحدود\n"
            "- استكشف أدوات BI المتقدمة\n"
            "\n"
            "اطّلع على الخطط: {url}/pricing\n"
            "\n"
            "— فريق بوداسيوم",
            "title": "اليوم 7 – اذهب أبعد",
        },
    },
    "en": {
        "account_deleted": {
            "badge": "Account Update",
            "body": "Your Podacium account has been scheduled for "
            "deletion. We're sorry to see you go.",
            "deletion_date": "Permanent Deletion Date",
            "feedback": "We'd love to hear your feedback on how we can " "improve.",
            "heading": "Hi {name},",
            "preheader": "Your Podacium account has been scheduled for "
            "deletion. You have 30 days to recover it.",
            "recover_button": "Recover My Account",
            "recovery_body": "You have <strong>30 days</strong> to "
            "recover your account by simply logging back "
            "in. After that, your data will be "
            "permanently removed.",
            "recovery_window": "Recovery Window",
            "subject": "We're Sorry to See You Go — Account Deletion " "Confirmed",
            "support_link": "Share Feedback",
            "text": "Hi {name},\n"
            "\n"
            "Your Podacium account has been scheduled for "
            "deletion.\n"
            "\n"
            "You have 30 days to recover your account by logging "
            "back in. After that, your data will be permanently "
            "removed.\n"
            "\n"
            "If you change your mind, simply log in within the "
            "next 30 days.\n"
            "\n"
            "— The Podacium Team",
            "title": "Account Deletion Scheduled",
        },
        "completion": {
            "badge": "Achievement Unlocked",
            "body": "You have successfully completed "
            "<strong>{course_name}</strong>. Your dedication and hard "
            "work have paid off!",
            "certificate_button": "View Certificate",
            "explore_button": "Explore Courses",
            "heading": "Amazing work, {name}!",
            "next_steps": "Ready for more? Explore our advanced courses to "
            "continue your learning journey.",
            "preheader": "You completed {course_name} on Podacium — claim your "
            "certificate!",
            "score_label": "Final Score",
            "share": "Share your achievement with your network:",
            "subject": "Congratulations! You completed {course_name}",
            "text": "Hi {name},\n"
            "\n"
            "Congratulations! You have successfully completed "
            "{course_name}.\n"
            "\n"
            "View your certificate: {url}\n"
            "\n"
            "Ready for more? Explore our advanced courses.\n"
            "\n"
            "— The Podacium Team",
            "title": "Congratulations!",
        },
        "contact": {
            "action_required": "Action Required: Please respond to this inquiry "
            "within 24-48 hours.",
            "badge": "Admin Notification",
            "category_label": "Category",
            "email_label": "Email Address",
            "general_inquiry": "General Inquiry",
            "message_label": "Message Content",
            "name_label": "Full Name",
            "no_subject": "No subject provided",
            "not_provided": "Not provided",
            "phone_label": "Phone Number",
            "preheader": "New contact form submission from {name}.",
            "priority_label": "Priority",
            "priority_normal": "Normal",
            "reply_button": "Reply to {name}",
            "source_label": "Source",
            "source_website": "Website",
            "subject": "Contact Form: {subject}",
            "subject_label": "Subject",
            "text": "CONTACT FORM SUBMISSION - PODACIUM\n"
            "{'='*50}\n"
            "\n"
            "From: {name}\n"
            "Email: {email}\n"
            "Phone: {phone}\n"
            "Category: {category}\n"
            "Subject: {subject}\n"
            "\n"
            "Message:\n"
            "{'='*50}\n"
            "{message}\n"
            "{'='*50}\n"
            "\n"
            "Please respond to {name} within 24-48 hours.\n"
            "Reply to: {email}",
            "time_label": "Time",
            "title": "New Message Received",
        },
        "csat_survey": {
            "badge": "Support Survey",
            "body": "Your recent support ticket "
            "<strong>#{ticket_number}</strong> — "
            '"<em>{ticket_subject}</em>" — has been resolved. We\'d '
            "love to hear your feedback.",
            "feedback_note": "Your feedback helps us improve and serve you " "better.",
            "heading": "Hi {user_name},",
            "preheader": "How was your experience with Podacium support? Rate "
            "your recent ticket.",
            "rating_button": "Rate Your Experience",
            "rating_question": "How satisfied are you with the support you "
            "received?",
            "subject": "How was your support experience? (Ticket: " "{ticket_number})",
            "text": "Hi {user_name},\n"
            "\n"
            "Your recent support ticket #{ticket_number} — "
            '"{ticket_subject}" — has been resolved.\n'
            "\n"
            "Please take a moment to rate your experience:\n"
            "{rating_url}\n"
            "\n"
            "Your feedback helps us improve and serve you better.\n"
            "\n"
            "— The Podacium Team",
            "title": "We Value Your Feedback",
        },
        "email_changed": {
            "badge": "Security Update",
            "body": "Your Podacium account email address has been changed.",
            "heading": "Hi {name},",
            "new_email_label": "New Email",
            "not_you": "Didn't do this?",
            "not_you_body": "If you didn't make this change, please contact "
            "support immediately to secure your account.",
            "old_email_label": "Previous Email",
            "preheader": "Your Podacium email address has been changed. "
            "Verify this change if it wasn't you.",
            "subject": "Your Podacium Email Address Has Been Changed",
            "support_link": "Contact Support",
            "text": "Hi {name},\n"
            "\n"
            "Your Podacium email address has been changed:\n"
            "\n"
            "Previous: {old_email}\n"
            "New: {new_email}\n"
            "Time: {time}\n"
            "\n"
            "If you didn't make this change, please contact support "
            "immediately.\n"
            "\n"
            "— The Podacium Team",
            "time_label": "Time of Change",
            "title": "Email Address Updated",
        },
        "enrollment": {
            "badge": "New Enrollment",
            "body": "You have successfully enrolled in "
            "<strong>{course_name}</strong>.",
            "heading": "You're in, {name}!",
            "preheader": "You're enrolled in {course_name} — start learning " "today!",
            "progress_tip": "Track your progress, earn certificates, and "
            "unlock new skills along the way.",
            "start_button": "Start Learning",
            "subject": "You're enrolled in {course_name}",
            "text": "Hi {name},\n"
            "\n"
            "You have successfully enrolled in {course_name}.\n"
            "\n"
            "Start learning: {url}\n"
            "\n"
            "Track your progress, earn certificates, and unlock new "
            "skills.\n"
            "\n"
            "— The Podacium Team",
            "title": "Enrollment Confirmed",
        },
        "invite": {
            "badge": "New Invitation",
            "body": "<strong>{inviter_name}</strong> has invited you to join their "
            "organization on <strong>Podacium</strong>.",
            "button": "Accept Invitation",
            "collab_note": "By joining, you'll be able to collaborate on datasets, "
            "dashboards, and advanced analytics.",
            "heading": "You've been invited!",
            "ignore": "If you didn't expect this invitation, you can safely ignore "
            "this email.",
            "invited_by": "Invited by {inviter_name}",
            "org_label": "Organization",
            "preheader": "You've been invited to join {org_name} on Podacium as a "
            "{role}.",
            "role_label": "Role: {role}",
            "subject": "Invitation to join {org_name} on Podacium",
            "text": "Hi there,\n"
            "\n"
            "You have been invited by {inviter_name} to join {org_name} as "
            "a {role} on Podacium.\n"
            "\n"
            "Podacium is a platform where you can collaborate on Data "
            "Science, AI, and Business Intelligence projects.\n"
            "\n"
            "To join the organization, please click the link below:\n"
            "{url}\n"
            "\n"
            "If you didn't expect this invitation, you can safely ignore "
            "this email.\n"
            "\n"
            "— The Podacium Team",
            "title": "You've Been Invited",
        },
        "invite_accepted": {
            "badge": "Team Update",
            "body": "<strong>{user_name}</strong> has accepted your "
            "invitation to join <strong>{org_name}</strong> as a "
            "<strong>{role}</strong>.",
            "heading": "Great news!",
            "manage_button": "Manage Team",
            "preheader": "{user_name} has accepted your invitation to "
            "join {org_name}.",
            "subject": "{user_name} accepted your invitation to " "{org_name}",
            "team_label": "Team Members",
            "text": "Hi {inviter_name},\n"
            "\n"
            "{user_name} has accepted your invitation to join "
            "{org_name} as a {role}.\n"
            "\n"
            "You can manage your team from the organization "
            "dashboard.\n"
            "\n"
            "— The Podacium Team",
            "title": "Invitation Accepted",
        },
        "magic_link": {
            "badge": "Passwordless Sign-In",
            "body": "Click the button below to instantly sign in to your "
            "Podacium account without a password.",
            "cta": "Sign In to Podacium",
            "expiry": "This link is single-use and will expire in "
            "{expires_in_minutes} minutes.",
            "greeting": "Hello {name},",
            "preheader": "Click your secure link to sign in to Podacium " "instantly.",
            "security_note": "If you did not request this link, you can safely "
            "ignore this email.",
            "subject": "Your Podacium Sign-In Link",
            "text": "Hello {name},\n"
            "\n"
            "Click the link below to sign in to your Podacium "
            "account:\n"
            "\n"
            "{magic_url}\n"
            "\n"
            "This link is single-use and expires in "
            "{expires_in_minutes} minutes.\n"
            "\n"
            "— The Podacium Team",
            "title": "Sign In to Podacium",
        },
        "member_removed": {
            "badge": "Organization Update",
            "body": "You have been removed from "
            "<strong>{org_name}</strong> on Podacium.",
            "heading": "Hi {name},",
            "preheader": "You've been removed from {org_name} on Podacium.",
            "reason_body": "If you believe this was a mistake, please "
            "contact the organization owner or our support "
            "team.",
            "subject": "You've been removed from {org_name}",
            "support_button": "Contact Support",
            "text": "Hi {name},\n"
            "\n"
            "You have been removed from {org_name} on Podacium.\n"
            "\n"
            "If you believe this was a mistake, please contact our "
            "support team.\n"
            "\n"
            "— The Podacium Team",
            "title": "Membership Update",
        },
        "new_device": {
            "badge": "Security Alert",
            "body": "A new device just logged into your Podacium account. If "
            "this was you, no action is needed. If you don't recognize "
            "this activity, please secure your account immediately.",
            "browser_label": "Browser",
            "device_label": "Device",
            "heading": "Hi {name},",
            "ip_label": "IP Address",
            "location_label": "Location",
            "os_label": "Operating System",
            "preheader": "A new device just logged into your Podacium account "
            "from {location}.",
            "secure_button": "Secure My Account",
            "subject": "New login to your Podacium account",
            "text": "Hi {name},\n"
            "\n"
            "A new device just logged into your Podacium account:\n"
            "\n"
            "Device: {device}\n"
            "Browser: {browser}\n"
            "OS: {os}\n"
            "IP: {ip}\n"
            "Location: {location}\n"
            "Time: {time}\n"
            "\n"
            "If this was you, no action is needed. If you don't "
            "recognize this activity, please change your password "
            "immediately.\n"
            "\n"
            "— The Podacium Team",
            "time_label": "Time",
            "title": "New Device Detected",
            "trust_button": "Yes, It's Me",
            "unknown": "Unknown",
        },
        "newsletter": {
            "badge": "Newsletter",
            "body": "You're now subscribed to our newsletter. We'll send you "
            "curated updates about new courses, freelance "
            "opportunities, BI insights, and platform news.",
            "footer": "Thanks for joining,<br><strong>The Podacium " "Team</strong>",
            "heading": "Welcome to the Podacium community, {name}!",
            "prefs": "You can unsubscribe anytime from your notification " "settings.",
            "preheader": "You've successfully subscribed to the Podacium "
            "newsletter — welcome aboard!",
            "subject": "You're on the list! Welcome to the Podacium newsletter",
            "text": "Hi {name},\n"
            "\n"
            "Welcome to the Podacium community!\n"
            "\n"
            "You're now subscribed to our newsletter. We'll send you "
            "curated updates about new courses, freelance "
            "opportunities, BI insights, and platform news.\n"
            "\n"
            "What to expect:\n"
            "- New course releases and learning path recommendations\n"
            "- Freelance project opportunities and marketplace "
            "updates\n"
            "- Business Intelligence tips, datasets, and dashboard "
            "inspiration\n"
            "- Exclusive community events and early access to new "
            "features\n"
            "\n"
            "You can unsubscribe anytime from your notification "
            "settings.\n"
            "\n"
            "Thanks for joining!\n"
            "— The Podacium Team",
            "title": "Subscription Confirmed",
            "whatsnext_1": "[Courses] New course releases and learning path "
            "recommendations",
            "whatsnext_2": "[Projects] Freelance project opportunities and "
            "marketplace updates",
            "whatsnext_3": "[Analytics] Business Intelligence tips, datasets, "
            "and dashboard inspiration",
            "whatsnext_4": "[Events] Exclusive community events and early "
            "access to new features",
            "whatsnext_title": "What to expect:",
        },
        "otp": {
            "badge": "Security Code",
            "body": "Please use the following verification code to complete your "
            "login to Podacium:",
            "expiry": "This code expires in 5 minutes.",
            "heading": "Verification Required",
            "not_you": "If you didn't attempt to log in, please change your password "
            "immediately.",
            "preheader": "Use this code to complete your login to Podacium.",
            "subject": "Your Podacium Verification Code",
            "text": "Your Podacium verification code is: {code}\n"
            "\n"
            "This code expires in 5 minutes. Do not share it.\n"
            "\n"
            "If you didn't attempt to log in, please change your password "
            "immediately.",
            "title": "Two-Factor Authentication",
            "warning": "Never share this code with anyone. Podacium will never ask "
            "for your code.",
        },
        "password_changed": {
            "badge": "Security Update",
            "body": "Your Podacium password has been changed "
            "successfully. All other active sessions have been "
            "logged out for your security.",
            "heading": "Hi {name},",
            "ip_label": "IP Address",
            "not_you": "Didn't do this?",
            "not_you_body": "If you didn't change your password, please "
            "contact support immediately and reset your "
            "account.",
            "preheader": "Your Podacium password was just changed. If "
            "this wasn't you, take action immediately.",
            "reset_link": "Reset Your Password",
            "subject": "Your Podacium Password Has Been Changed",
            "support_link": "Contact Support",
            "text": "Hi {name},\n"
            "\n"
            "Your Podacium password has been changed "
            "successfully.\n"
            "\n"
            "Time: {time}\n"
            "IP: {ip}\n"
            "\n"
            "All other active sessions have been logged out for "
            "your security.\n"
            "\n"
            "If you didn't change your password, please contact "
            "support immediately.\n"
            "\n"
            "— The Podacium Team",
            "time_label": "Time of Change",
            "title": "Password Changed Successfully",
        },
        "payment": {
            "amount_label": "Amount",
            "badge": "Receipt",
            "body": "Your payment has been processed successfully.",
            "date_label": "Date",
            "heading": "Thank you, {name}!",
            "item_label": "Item",
            "preheader": "Your Podacium payment of {amount} has been processed.",
            "receipt_button": "View Receipt",
            "status_label": "Status",
            "status_paid": "Paid",
            "subject": "Payment Confirmed – Receipt from Podacium",
            "text": "Hi {name},\n"
            "\n"
            "Your payment has been processed successfully.\n"
            "\n"
            "Amount: {amount}\n"
            "Item: {item}\n"
            "Date: {date}\n"
            "Transaction ID: {transaction_id}\n"
            "\n"
            "View your receipt: {url}\n"
            "\n"
            "— The Podacium Team",
            "title": "Payment Confirmed",
            "transaction_label": "Transaction ID",
        },
        "proposal": {
            "amount_label": "Budget",
            "badge": "Freelancing Update",
            "body": "You've received a new proposal for your project "
            "<strong>{project_title}</strong>.",
            "freelancer_label": "Freelancer",
            "heading": "Hi {name},",
            "message_label": "Message",
            "preheader": "You've received a new proposal for your project "
            "{project_title}.",
            "review_button": "Review Proposal",
            "subject": "New proposal for {project_title}",
            "text": "Hi {name},\n"
            "\n"
            "You've received a new proposal for your project "
            "{project_title}.\n"
            "\n"
            "Freelancer: {freelancer}\n"
            "Amount: {amount}\n"
            "\n"
            "Review the proposal: {url}\n"
            "\n"
            "— The Podacium Team",
            "title": "New Proposal Received",
        },
        "refund": {
            "amount_label": "Amount Refunded",
            "badge": "Refund",
            "body": "Your refund has been processed successfully. The amount has "
            "been credited to your Podacium wallet.",
            "heading": "Hi {name},",
            "preheader": "Your Podacium refund of {amount} has been processed and "
            "credited to your wallet.",
            "refund_label": "Refund ID",
            "status_label": "Status",
            "status_refunded": "Refunded",
            "subject": "Refund Processed – {amount} Credited to Your Wallet",
            "text": "Hi {name},\n"
            "\n"
            "Your refund has been processed successfully.\n"
            "\n"
            "Amount Refunded: {amount}\n"
            "Transaction ID: {transaction_id}\n"
            "Refund ID: {refund_id}\n"
            "\n"
            "View your wallet: {url}\n"
            "\n"
            "— The Podacium Team",
            "title": "Refund Completed",
            "transaction_label": "Original Transaction ID",
            "wallet_button": "View My Wallet",
        },
        "reset": {
            "badge": "Security Update",
            "body": "We received a request to reset your Podacium password for "
            "<strong>{email}</strong>.",
            "button": "Reset My Password",
            "cta": "To establish a new, secure password, please click the button "
            "below:",
            "heading": "Hello {name},",
            "ignore": "If you didn't request a password reset, you can safely "
            "ignore this email. Your account remains secure.",
            "preheader": "Reset your Podacium password — this secure link expires "
            "in 24 hours.",
            "security": "This reset link will expire in 24 hours for your security.",
            "subject": "Reset Your Podacium Password",
            "text": "Hi {name},\n"
            "\n"
            "We received a request to reset your Podacium password for "
            "{email}.\n"
            "\n"
            "To reset your password, visit this link:\n"
            "{url}\n"
            "\n"
            "This link will expire in 24 hours for security reasons.\n"
            "\n"
            "If you didn't request a password reset, please ignore this "
            "email. Your account remains secure.\n"
            "\n"
            "— The Podacium Team",
            "title": "Password Reset Request",
        },
        "role_changed": {
            "badge": "Organization Update",
            "body": "Your role in <strong>{org_name}</strong> has been " "updated.",
            "heading": "Hi {name},",
            "new_role_label": "New Role",
            "old_role_label": "Previous Role",
            "org_button": "Open Organization",
            "preheader": "Your role in {org_name} has been changed to " "{role}.",
            "subject": "Your role in {org_name} has been updated",
            "text": "Hi {name},\n"
            "\n"
            "Your role in {org_name} has been updated from "
            "{old_role} to {new_role}.\n"
            "\n"
            "— The Podacium Team",
            "title": "Role Updated",
        },
        "shared": {
            "alt_link": "If the button doesn't work, copy and paste this link into "
            "your browser:",
            "brand": "Podacium",
            "footer_company": "Podacium — Data Science, AI & Business Intelligence "
            "Platform",
            "footer_privacy": "Privacy Policy",
            "footer_rights": "All rights reserved.",
            "footer_sent_to": "Sent to {email}",
            "footer_support": "Contact Support",
            "footer_terms": "Terms of Service",
            "ignore": "If you didn't request this email, you can safely ignore it. "
            "Your account remains secure.",
            "manage_prefs": "Notification Preferences",
            "regards": "Best regards,<br><strong>The Podacium Team</strong>",
            "security_badge": "Security Update",
            "tagline": "Empowering the Future of Intelligence",
            "year": "{year}",
        },
        "subscription": {
            "amount_label": "Amount",
            "badge": "Billing Update",
            "body": "Your Podacium subscription has been updated.",
            "cancelled_label": "Cancelled",
            "heading": "Hi {name},",
            "manage_button": "Manage Subscription",
            "plan_label": "Plan",
            "preheader": "Your Podacium subscription to {plan} has been " "{status}.",
            "renewal_label": "Next Renewal",
            "started_label": "Started",
            "status_label": "Status",
            "subject": "Your Podacium subscription has been updated",
            "text": "Hi {name},\n"
            "\n"
            "Your Podacium subscription has been updated.\n"
            "\n"
            "Plan: {plan}\n"
            "Amount: {amount}\n"
            "Status: {status}\n"
            "\n"
            "Manage your subscription: {url}\n"
            "\n"
            "— The Podacium Team",
            "title": "Subscription Update",
        },
        "verify": {
            "badge": "Verify Your Account",
            "body": "We're thrilled to have you at <strong>Podacium</strong> — "
            "your premier platform for Data Science, AI, and Business "
            "Intelligence.",
            "button": "Verify My Email",
            "cta": "To unlock the full potential of your account and start your "
            "journey, please verify your email address below:",
            "heading": "Welcome aboard, {name}!",
            "ignore": "If you didn't create an account, you can safely ignore this "
            "email.",
            "preheader": "Welcome to Podacium — verify your email to activate your "
            "account and unlock the full platform.",
            "security": "This link will expire in 7 days for your protection.",
            "subject": "Confirm Your Email – Activate Your Podacium Account",
            "text": "Hi {name},\n"
            "\n"
            "Welcome to Podacium — where your journey in Data Science, ML, "
            "AI, and BI begins.\n"
            "\n"
            "To activate your account, please verify your email by "
            "clicking the link below:\n"
            "\n"
            "{url}\n"
            "\n"
            "This link expires in 7 days for your security.\n"
            "\n"
            "If you didn't create an account, you can safely ignore this "
            "message.\n"
            "\n"
            "— The Podacium Team",
            "title": "Welcome to Podacium",
        },
        "waitlist_confirmation": {
            "badge": "Early Access",
            "footer": "Welcome aboard,<br><strong>The Podacium " "Team</strong>",
            "greeting": "Hi {name},",
            "position_info": "You're #{position} in the Podacium "
            "waitlist. We'll notify you as soon as "
            "your spot is ready.",
            "prefs": "You can unsubscribe anytime, but we'd love to "
            "keep you in the loop.",
            "preheader": "You're #{position} in line. Share your "
            "referral link to move up!",
            "reward_info": "Refer 5 friends to unlock a free month " "of Podacium Pro!",
            "share_button": "Share Your Link",
            "share_title": "Your referral link:",
            "subject": "You're on the Podacium Waitlist!",
            "text": "Hi {name},\n"
            "\n"
            "You're #{position} in the Podacium waitlist. "
            "Share your referral link with friends to move "
            "up!\n"
            "\n"
            "Your referral link: "
            "https://podacium.com/waitlist?ref={referral_code}\n"
            "\n"
            "Refer 5 friends to unlock a free month of "
            "Podacium Pro!\n"
            "\n"
            "What's next:\n"
            "- Early access to courses, freelancing, and BI "
            "tools\n"
            "- Priority onboarding when we launch\n"
            "- Exclusive community access\n"
            "- Special launch offers for waitlist members\n"
            "\n"
            "Welcome aboard!\n"
            "— The Podacium Team",
            "title": "Welcome to the Future",
            "whats_next": "What's next:\n"
            "• Early access to courses, freelancing, "
            "and BI tools\n"
            "• Priority onboarding when we launch\n"
            "• Exclusive community access\n"
            "• Special launch offers for waitlist "
            "members",
        },
        "waitlist_drip_day14": {
            "badge": "Waitlist",
            "body": "Early waitlist members get priority onboarding "
            "and exclusive launch offers. The more people you "
            "invite now, the higher your spot — and the "
            "stronger your network when we go live.",
            "footer": "See you inside,<br><strong>The Podacium " "Team</strong>",
            "heading": "Hi {name},",
            "preheader": "The friends you invite today join you at " "launch.",
            "referral_button": "Invite Friends",
            "referral_info": "Refer 5 friends to unlock a free month "
            "of Podacium Pro!",
            "referral_label": "Your personal referral link:",
            "subject": "Your referral code is still active",
            "text": "Hi {name},\n"
            "\n"
            "Your referral link is still active:\n"
            "\n"
            "https://podacium.com/waitlist?ref={referral_code}\n"
            "\n"
            "Early members get priority onboarding and "
            "exclusive launch offers.\n"
            "\n"
            "— The Podacium Team",
            "title": "Bring Your Network",
        },
        "waitlist_drip_day3": {
            "badge": "Waitlist",
            "body": "Your waitlist spot is reserved, but early access "
            "goes to those who move up the queue. Share your "
            "personal referral link below — every friend who "
            "joins bumps you up.",
            "footer": "See you inside,<br><strong>The Podacium " "Team</strong>",
            "heading": "Hi {name},",
            "preheader": "Invite 5 friends and unlock a free month of " "Podacium Pro.",
            "referral_button": "Invite Friends",
            "referral_info": "Refer 5 friends to unlock a free month "
            "of Podacium Pro!",
            "referral_label": "Your personal referral link:",
            "subject": "Your Podacium early-access spot awaits",
            "text": "Hi {name},\n"
            "\n"
            "Your waitlist spot is reserved. Share your "
            "referral link to move up the queue:\n"
            "\n"
            "https://podacium.com/waitlist?ref={referral_code}\n"
            "\n"
            "Refer 5 friends to unlock a free month of "
            "Podacium Pro!\n"
            "\n"
            "— The Podacium Team",
            "title": "Don't Lose Your Spot",
        },
        "waitlist_drip_day30": {
            "badge": "Waitlist",
            "body": "This is your final reminder: referral bonuses "
            "and early-access perks are limited to waitlist "
            "members. Share your link before launch to lock "
            "in a free month of Podacium Pro and priority "
            "onboarding.",
            "footer": "See you inside,<br><strong>The Podacium " "Team</strong>",
            "heading": "Hi {name},",
            "preheader": "Your reserved spot and perks won't last " "forever.",
            "referral_button": "Invite Friends",
            "referral_info": "Refer 5 friends to unlock a free month "
            "of Podacium Pro!",
            "referral_label": "Your personal referral link:",
            "subject": "Last call — reserve your Podacium perks",
            "text": "Hi {name},\n"
            "\n"
            "Final reminder — referral bonuses and "
            "early-access perks are limited to waitlist "
            "members:\n"
            "\n"
            "https://podacium.com/waitlist?ref={referral_code}\n"
            "\n"
            "Refer 5 friends to unlock a free month of "
            "Podacium Pro!\n"
            "\n"
            "— The Podacium Team",
            "title": "Final Reminder",
        },
        "waitlist_drip_day7": {
            "badge": "Waitlist",
            "body": "Podacium launches with three integrated pillars: "
            "EdTech courses with verifiable certificates, a "
            "DZD-native freelancing marketplace, and Business "
            "Intelligence for Algerian SMEs. All connected to "
            "one wallet.",
            "footer": "See you inside,<br><strong>The Podacium " "Team</strong>",
            "heading": "Hi {name},",
            "preheader": "Courses, freelancing, and BI — one platform.",
            "referral_button": "Invite Friends",
            "referral_info": "Refer 5 friends to unlock a free month "
            "of Podacium Pro!",
            "referral_label": "Your personal referral link:",
            "subject": "What's coming to Podacium first",
            "text": "Hi {name},\n"
            "\n"
            "Courses with verifiable certificates. A "
            "DZD-native freelancing marketplace. Business "
            "Intelligence for Algerian SMEs. One platform, one "
            "wallet.\n"
            "\n"
            "Share your referral link to move up:\n"
            "\n"
            "https://podacium.com/waitlist?ref={referral_code}\n"
            "\n"
            "— The Podacium Team",
            "title": "Built for Your Growth",
        },
        "welcome": {
            "badge": "Welcome Aboard",
            "bi_cta": "Open BI Studio",
            "bi_desc": "Create powerful dashboards and uncover insights with our "
            "BI tools.",
            "bi_title": "Analyze Data",
            "body": "Your account is verified and ready to go. Here are a few "
            "things you can do to get started:",
            "heading": "Welcome, {name}!",
            "hub_cta": "Explore Hub",
            "hub_desc": "Join projects, connect with freelancers, and grow your "
            "network.",
            "hub_title": "Connect & Collaborate",
            "learn_cta": "Browse Courses",
            "learn_desc": "Dive into our library of Data Science, AI, and BI "
            "courses.",
            "learn_title": "Explore Courses",
            "preheader": "Welcome to Podacium! Here's everything you need to get "
            "started.",
            "profile_cta": "Edit Profile",
            "profile_desc": "Add your skills, experience, and profile picture to "
            "stand out.",
            "profile_title": "Complete Your Profile",
            "subject": "Welcome to Podacium – Let's Get Started!",
            "support": "Need help? Our support team is here for you.",
            "support_cta": "Get Help",
            "text": "Hi {name},\n"
            "\n"
            "Welcome to Podacium! Your account is verified and ready to "
            "go.\n"
            "\n"
            "Here's how to get started:\n"
            "- Browse courses in Data Science, AI, and BI\n"
            "- Create dashboards with our BI Studio\n"
            "- Connect with freelancers and join projects\n"
            "- Complete your profile to stand out\n"
            "\n"
            "Get started: {url}\n"
            "\n"
            "Need help? Contact us at {support_url}\n"
            "\n"
            "— The Podacium Team",
            "title": "Welcome to Podacium!",
        },
        "welcome_d1": {
            "badge": "Tips & Tricks",
            "body": "Here are two quick tips to help you get started on the "
            "right foot.",
            "heading": "Great to have you, {name}!",
            "preheader": "Make the most of your first week on Podacium.",
            "subject": "Tip: Your first project on Podacium",
            "support": "Questions? Our support team is happy to help.",
            "support_cta": "Get Help",
            "text": "Hi {name},\n"
            "\n"
            "Here are two quick tips to get started:\n"
            "- Take a short course in your field\n"
            "- Complete your profile to attract opportunities\n"
            "\n"
            "Browse courses: {url}/learn\n"
            "Complete profile: {url}/settings\n"
            "\n"
            "— The Podacium Team",
            "tip1_cta": "Browse Courses",
            "tip1_desc": "Kick things off with a short course in your field of "
            "interest.",
            "tip1_title": "Take a Course",
            "tip2_cta": "Complete Profile",
            "tip2_desc": "A complete profile helps you connect with the right "
            "people.",
            "tip2_title": "Set Up Your Profile",
            "title": "Day 1 – Quick Tips",
        },
        "welcome_d3": {
            "badge": "Community",
            "body": "Learning is better together. Here's how to connect with "
            "the Podacium community.",
            "community_cta": "Explore Community",
            "community_desc": "Participate in discussions, share knowledge, "
            "and find collaborators.",
            "community_title": "Join the Community",
            "heading": "Growing your network, {name}!",
            "network_cta": "Find Mentors",
            "network_desc": "Connect with experienced professionals ready to "
            "guide you.",
            "network_title": "Find Mentors",
            "preheader": "You're not alone — connect with peers and mentors.",
            "subject": "Connect with the Podacium community",
            "support": "Need help finding your community? Reach out anytime.",
            "support_cta": "Get Help",
            "text": "Hi {name},\n"
            "\n"
            "Connect with the Podacium community:\n"
            "- Join discussions and find collaborators\n"
            "- Connect with mentors who can guide you\n"
            "\n"
            "Explore: {url}/community\n"
            "\n"
            "— The Podacium Team",
            "title": "Day 3 – Community",
        },
        "welcome_d7": {
            "badge": "Premium",
            "body": "You've been with us for a week — here's how to take your "
            "experience to the next level.",
            "heading": "One week in, {name}!",
            "portal_cta": "Open BI Studio",
            "portal_desc": "Build advanced dashboards with AI-powered insights "
            "and real-time data.",
            "portal_title": "BI Studio Pro",
            "preheader": "Unlock the full power of Podacium with premium " "features.",
            "premium_cta": "See Plans",
            "premium_desc": "Unlock unlimited courses, advanced BI tools, and "
            "priority support.",
            "premium_title": "Go Premium",
            "subject": "Unlock premium features on Podacium",
            "support": "Have questions about premium? We're here to help.",
            "support_cta": "Get Help",
            "text": "Hi {name},\n"
            "\n"
            "It's been a week! Here's how to go further:\n"
            "- Upgrade to Premium for unlimited access\n"
            "- Explore advanced BI tools\n"
            "\n"
            "See plans: {url}/pricing\n"
            "\n"
            "— The Podacium Team",
            "title": "Day 7 – Go Further",
        },
    },
    "fr": {
        "account_deleted": {
            "badge": "Mise à jour du compte",
            "body": "Votre compte Podacium a été programmé pour "
            "suppression. Nous sommes désolés de vous voir "
            "partir.",
            "deletion_date": "Date de suppression définitive",
            "feedback": "Nous aimerions connaître votre avis pour nous " "améliorer.",
            "heading": "Bonjour {name},",
            "preheader": "Votre compte Podacium a été programmé pour "
            "suppression. Vous avez 30 jours pour le "
            "récupérer.",
            "recover_button": "Récupérer mon compte",
            "recovery_body": "Vous avez <strong>30 jours</strong> pour "
            "récupérer votre compte en vous "
            "reconnectant. Après cela, vos données "
            "seront définitivement supprimées.",
            "recovery_window": "Délai de récupération",
            "subject": "Nous sommes désolés de vous voir partir — "
            "Suppression de compte confirmée",
            "support_link": "Partager votre avis",
            "text": "Bonjour {name},\n"
            "\n"
            "Votre compte Podacium a été programmé pour "
            "suppression.\n"
            "\n"
            "Vous avez 30 jours pour récupérer votre compte en "
            "vous reconnectant.\n"
            "\n"
            "Si vous changez d'avis, connectez-vous dans les 30 "
            "jours.\n"
            "\n"
            "— L'équipe Podacium",
            "title": "Suppression de compte programmée",
        },
        "completion": {
            "badge": "Succès débloqué",
            "body": "Vous avez terminé avec succès "
            "<strong>{course_name}</strong>. Votre dévouement a porté "
            "ses fruits !",
            "certificate_button": "Voir le certificat",
            "explore_button": "Explorer les cours",
            "heading": "Excellent travail, {name} !",
            "next_steps": "Prêt pour la suite ? Explorez nos cours avancés.",
            "preheader": "Vous avez terminé {course_name} sur Podacium — "
            "obtenez votre certificat !",
            "score_label": "Score final",
            "share": "Partagez votre réussite avec votre réseau :",
            "subject": "Félicitations ! Vous avez terminé {course_name}",
            "text": "Bonjour {name},\n"
            "\n"
            "Félicitations ! Vous avez terminé avec succès "
            "{course_name}.\n"
            "\n"
            "Voir votre certificat : {url}\n"
            "\n"
            "Prêt pour la suite ? Explorez nos cours avancés.\n"
            "\n"
            "— L'équipe Podacium",
            "title": "Félicitations !",
        },
        "contact": {
            "action_required": "Action requise : Veuillez répondre à cette "
            "demande sous 24 à 48 heures.",
            "badge": "Notification admin",
            "category_label": "Catégorie",
            "email_label": "Adresse email",
            "general_inquiry": "Demande générale",
            "message_label": "Contenu du message",
            "name_label": "Nom complet",
            "no_subject": "Aucun sujet fourni",
            "not_provided": "Non fourni",
            "phone_label": "Numéro de téléphone",
            "preheader": "Nouvelle soumission du formulaire de contact de {name}.",
            "priority_label": "Priorité",
            "priority_normal": "Normale",
            "reply_button": "Répondre à {name}",
            "source_label": "Source",
            "source_website": "Site Web",
            "subject": "Formulaire de contact : {subject}",
            "subject_label": "Sujet",
            "text": "SOUMISSION DE FORMULAIRE DE CONTACT - PODACIUM\n"
            "{'='*50}\n"
            "\n"
            "De : {name}\n"
            "Email : {email}\n"
            "Téléphone : {phone}\n"
            "Catégorie : {category}\n"
            "Sujet : {subject}\n"
            "\n"
            "Message :\n"
            "{'='*50}\n"
            "{message}\n"
            "{'='*50}\n"
            "\n"
            "Veuillez répondre à {name} sous 24 à 48 heures.\n"
            "Répondre à : {email}",
            "time_label": "Heure",
            "title": "Nouveau message reçu",
        },
        "csat_survey": {
            "badge": "Enquête de satisfaction",
            "body": "Votre ticket de support "
            "<strong>#{ticket_number}</strong> — "
            '"<em>{ticket_subject}</em>" — a été résolu. Nous '
            "aimerions connaître votre avis.",
            "feedback_note": "Vos commentaires nous aident à nous améliorer.",
            "heading": "Bonjour {user_name},",
            "preheader": "Comment s'est passée votre expérience avec le "
            "support Podacium ? Évaluez votre ticket.",
            "rating_button": "Évaluez votre expérience",
            "rating_question": "Quel est votre niveau de satisfaction ?",
            "subject": "Comment s'est passée votre expérience de support ? "
            "(Ticket : {ticket_number})",
            "text": "Bonjour {user_name},\n"
            "\n"
            "Votre ticket de support #{ticket_number} — "
            '"{ticket_subject}" — a été résolu.\n'
            "\n"
            "Prenez un moment pour évaluer votre expérience :\n"
            "{rating_url}\n"
            "\n"
            "Vos commentaires nous aident à nous améliorer.\n"
            "\n"
            "— L'équipe Podacium",
            "title": "Nous Apprécions Vos Retours",
        },
        "email_changed": {
            "badge": "Mise à jour de sécurité",
            "body": "L'adresse email de votre compte Podacium a été " "modifiée.",
            "heading": "Bonjour {name},",
            "new_email_label": "Nouvel email",
            "not_you": "Ce n'était pas vous ?",
            "not_you_body": "Si vous n'avez pas effectué ce changement, "
            "contactez le support immédiatement.",
            "old_email_label": "Email précédent",
            "preheader": "Votre adresse email Podacium a été modifiée. "
            "Vérifiez ce changement.",
            "subject": "Votre adresse email Podacium a été modifiée",
            "support_link": "Contacter le support",
            "text": "Bonjour {name},\n"
            "\n"
            "Votre adresse email Podacium a été modifiée :\n"
            "\n"
            "Précédent : {old_email}\n"
            "Nouveau : {new_email}\n"
            "Heure : {time}\n"
            "\n"
            "Si vous n'avez pas effectué ce changement, contactez "
            "le support immédiatement.\n"
            "\n"
            "— L'équipe Podacium",
            "time_label": "Heure du changement",
            "title": "Adresse email mise à jour",
        },
        "enrollment": {
            "badge": "Nouvelle inscription",
            "body": "Vous êtes inscrit avec succès à "
            "<strong>{course_name}</strong>.",
            "heading": "Vous êtes inscrit, {name} !",
            "preheader": "Vous êtes inscrit à {course_name} — commencez à "
            "apprendre dès aujourd'hui !",
            "progress_tip": "Suivez votre progression, obtenez des certificats "
            "et développez de nouvelles compétences.",
            "start_button": "Commencer à apprendre",
            "subject": "Vous êtes inscrit à {course_name}",
            "text": "Bonjour {name},\n"
            "\n"
            "Vous êtes inscrit avec succès à {course_name}.\n"
            "\n"
            "Commencer : {url}\n"
            "\n"
            "Suivez votre progression et obtenez des certificats.\n"
            "\n"
            "— L'équipe Podacium",
            "title": "Inscription confirmée",
        },
        "invite": {
            "badge": "Nouvelle invitation",
            "body": "<strong>{inviter_name}</strong> vous a invité à rejoindre son "
            "organisation sur <strong>Podacium</strong>.",
            "button": "Accepter l'invitation",
            "collab_note": "En rejoignant, vous pourrez collaborer sur des "
            "ensembles de données, des tableaux de bord et des "
            "analyses avancées.",
            "heading": "Vous êtes invité !",
            "ignore": "Si vous n'attendiez pas cette invitation, vous pouvez "
            "ignorer cet email.",
            "invited_by": "Invité par {inviter_name}",
            "org_label": "Organisation",
            "preheader": "Vous avez été invité à rejoindre {org_name} sur Podacium "
            "en tant que {role}.",
            "role_label": "Rôle : {role}",
            "subject": "Invitation à rejoindre {org_name} sur Podacium",
            "text": "Bonjour,\n"
            "\n"
            "Vous avez été invité par {inviter_name} à rejoindre "
            "{org_name} en tant que {role} sur Podacium.\n"
            "\n"
            "Pour rejoindre l'organisation, veuillez cliquer sur le lien "
            "ci-dessous :\n"
            "{url}\n"
            "\n"
            "Si vous n'attendiez pas cette invitation, vous pouvez ignorer "
            "cet email.\n"
            "\n"
            "— L'équipe Podacium",
            "title": "Vous êtes invité !",
        },
        "invite_accepted": {
            "badge": "Mise à jour de l'équipe",
            "body": "<strong>{user_name}</strong> a accepté votre "
            "invitation à rejoindre <strong>{org_name}</strong> "
            "en tant que <strong>{role}</strong>.",
            "heading": "Bonne nouvelle !",
            "manage_button": "Gérer l'équipe",
            "preheader": "{user_name} a accepté votre invitation à "
            "rejoindre {org_name}.",
            "subject": "{user_name} a accepté votre invitation à " "{org_name}",
            "team_label": "Membres de l'équipe",
            "text": "Bonjour {inviter_name},\n"
            "\n"
            "{user_name} a accepté votre invitation à rejoindre "
            "{org_name} en tant que {role}.\n"
            "\n"
            "Vous pouvez gérer votre équipe depuis le tableau de "
            "bord.\n"
            "\n"
            "— L'équipe Podacium",
            "title": "Invitation acceptée",
        },
        "magic_link": {
            "badge": "Connexion sans mot de passe",
            "body": "Cliquez sur le bouton ci-dessous pour vous connecter "
            "instantanément à votre compte Podacium sans mot de passe.",
            "cta": "Se connecter à Podacium",
            "expiry": "Ce lien est à usage unique et expirera dans "
            "{expires_in_minutes} minutes.",
            "greeting": "Bonjour {name},",
            "preheader": "Cliquez sur votre lien sécurisé pour vous connecter "
            "instantanément à Podacium.",
            "security_note": "Si vous n'êtes pas à l'origine de cette demande, "
            "vous pouvez ignorer cet email en toute sécurité.",
            "subject": "Votre lien de connexion Podacium",
            "text": "Bonjour {name},\n"
            "\n"
            "Cliquez sur le lien ci-dessous pour vous connecter à "
            "votre compte Podacium :\n"
            "\n"
            "{magic_url}\n"
            "\n"
            "Ce lien est à usage unique et expire dans "
            "{expires_in_minutes} minutes.\n"
            "\n"
            "— L'équipe Podacium",
            "title": "Connexion à Podacium",
        },
        "member_removed": {
            "badge": "Mise à jour de l'organisation",
            "body": "Vous avez été retiré de <strong>{org_name}</strong> "
            "sur Podacium.",
            "heading": "Bonjour {name},",
            "preheader": "Vous avez été retiré de {org_name} sur Podacium.",
            "reason_body": "Si vous pensez qu'il s'agit d'une erreur, "
            "veuillez contacter le propriétaire de "
            "l'organisation ou notre équipe de support.",
            "subject": "Vous avez été retiré de {org_name}",
            "support_button": "Contacter le support",
            "text": "Bonjour {name},\n"
            "\n"
            "Vous avez été retiré de {org_name} sur Podacium.\n"
            "\n"
            "Si vous pensez qu'il s'agit d'une erreur, contactez "
            "notre équipe de support.\n"
            "\n"
            "— L'équipe Podacium",
            "title": "Mise à jour d'adhésion",
        },
        "new_device": {
            "badge": "Alerte de sécurité",
            "body": "Un nouvel appareil vient de se connecter à votre compte "
            "Podacium. Si c'était vous, aucune action n'est "
            "nécessaire. Sinon, sécurisez votre compte immédiatement.",
            "browser_label": "Navigateur",
            "device_label": "Appareil",
            "heading": "Bonjour {name},",
            "ip_label": "Adresse IP",
            "location_label": "Localisation",
            "os_label": "Système d'exploitation",
            "preheader": "Un nouvel appareil vient de se connecter à votre "
            "compte Podacium depuis {location}.",
            "secure_button": "Sécuriser mon compte",
            "subject": "Nouvelle connexion à votre compte Podacium",
            "text": "Bonjour {name},\n"
            "\n"
            "Un nouvel appareil vient de se connecter à votre compte "
            "Podacium :\n"
            "\n"
            "Appareil : {device}\n"
            "Navigateur : {browser}\n"
            "OS : {os}\n"
            "IP : {ip}\n"
            "Localisation : {location}\n"
            "Heure : {time}\n"
            "\n"
            "Si c'était vous, ignorez ce message. Sinon, changez votre "
            "mot de passe immédiatement.\n"
            "\n"
            "— L'équipe Podacium",
            "time_label": "Heure",
            "title": "Nouvel appareil détecté",
            "trust_button": "Oui, c'est moi",
            "unknown": "Inconnu",
        },
        "newsletter": {
            "badge": "Newsletter",
            "body": "Vous êtes maintenant abonné à notre newsletter. Nous vous "
            "enverrons des mises à jour sur les nouveaux cours, les "
            "opportunités freelance, les insights BI et les actualités "
            "de la plateforme.",
            "footer": "Merci de nous rejoindre,<br><strong>L'équipe "
            "Podacium</strong>",
            "heading": "Bienvenue dans la communauté Podacium, {name} !",
            "prefs": "Vous pouvez vous désabonner à tout moment depuis vos "
            "paramètres de notifications.",
            "preheader": "Vous êtes abonné à la newsletter Podacium — " "bienvenue !",
            "subject": "Vous êtes sur la liste ! Bienvenue à la newsletter " "Podacium",
            "text": "Bonjour {name},\n"
            "\n"
            "Bienvenue dans la communauté Podacium !\n"
            "\n"
            "Vous êtes maintenant abonné à notre newsletter. Nous vous "
            "enverrons des mises à jour sur les nouveaux cours, les "
            "opportunités freelance, les insights BI et les actualités "
            "de la plateforme.\n"
            "\n"
            "Au programme :\n"
            "- Nouveaux cours et recommandations de parcours\n"
            "- Offres de projets freelance et mises à jour du marché\n"
            "- Astuces BI, jeux de données et inspiration de tableaux "
            "de bord\n"
            "- Événements exclusifs et accès anticipé aux nouvelles "
            "fonctionnalités\n"
            "\n"
            "Vous pouvez vous désabonner à tout moment depuis vos "
            "paramètres de notifications.\n"
            "\n"
            "Merci de nous rejoindre !\n"
            "— L'équipe Podacium",
            "title": "Abonnement confirmé",
            "whatsnext_1": "[Cours] Nouveaux cours et recommandations de " "parcours",
            "whatsnext_2": "[Projets] Offres de projets freelance et mises à "
            "jour du marché",
            "whatsnext_3": "[Analytics] Astuces BI, jeux de données et "
            "inspiration de tableaux de bord",
            "whatsnext_4": "[Evenements] Evenements exclusifs et acces "
            "anticipe aux nouvelles fonctionnalites",
            "whatsnext_title": "Au programme :",
        },
        "otp": {
            "badge": "Code de sécurité",
            "body": "Veuillez utiliser le code de vérification ci-dessous pour "
            "finaliser votre connexion à Podacium :",
            "expiry": "Ce code expire dans 5 minutes.",
            "heading": "Vérification requise",
            "not_you": "Si vous n'avez pas tenté de vous connecter, veuillez changer "
            "votre mot de passe immédiatement.",
            "preheader": "Utilisez ce code pour finaliser votre connexion à Podacium.",
            "subject": "Votre code de vérification Podacium",
            "text": "Votre code de vérification Podacium est : {code}\n"
            "\n"
            "Ce code expire dans 5 minutes. Ne le partagez pas.\n"
            "\n"
            "Si vous n'avez pas tenté de vous connecter, veuillez changer "
            "votre mot de passe immédiatement.",
            "title": "Authentification à deux facteurs",
            "warning": "Ne partagez jamais ce code. Podacium ne vous le demandera "
            "jamais.",
        },
        "password_changed": {
            "badge": "Mise à jour de sécurité",
            "body": "Votre mot de passe Podacium a été modifié avec "
            "succès. Toutes les autres sessions actives ont été "
            "déconnectées pour votre sécurité.",
            "heading": "Bonjour {name},",
            "ip_label": "Adresse IP",
            "not_you": "Ce n'était pas vous ?",
            "not_you_body": "Si vous n'avez pas modifié votre mot de "
            "passe, contactez immédiatement le support.",
            "preheader": "Votre mot de passe Podacium vient d'être "
            "modifié. Si ce n'était pas vous, agissez "
            "immédiatement.",
            "reset_link": "Réinitialiser votre mot de passe",
            "subject": "Votre mot de passe Podacium a été modifié",
            "support_link": "Contacter le support",
            "text": "Bonjour {name},\n"
            "\n"
            "Votre mot de passe Podacium a été modifié avec "
            "succès.\n"
            "\n"
            "Heure : {time}\n"
            "IP : {ip}\n"
            "\n"
            "Toutes les autres sessions ont été déconnectées.\n"
            "\n"
            "Si vous n'avez pas modifié votre mot de passe, "
            "contactez le support immédiatement.\n"
            "\n"
            "— L'équipe Podacium",
            "time_label": "Heure du changement",
            "title": "Mot de passe modifié avec succès",
        },
        "payment": {
            "amount_label": "Montant",
            "badge": "Reçu",
            "body": "Votre paiement a été traité avec succès.",
            "date_label": "Date",
            "heading": "Merci, {name} !",
            "item_label": "Article",
            "preheader": "Votre paiement Podacium de {amount} a été traité.",
            "receipt_button": "Voir le reçu",
            "status_label": "Statut",
            "status_paid": "Payé",
            "subject": "Paiement confirmé – Reçu de Podacium",
            "text": "Bonjour {name},\n"
            "\n"
            "Votre paiement a été traité avec succès.\n"
            "\n"
            "Montant : {amount}\n"
            "Article : {item}\n"
            "Date : {date}\n"
            "ID : {transaction_id}\n"
            "\n"
            "Voir votre reçu : {url}\n"
            "\n"
            "— L'équipe Podacium",
            "title": "Paiement confirmé",
            "transaction_label": "ID de transaction",
        },
        "proposal": {
            "amount_label": "Budget",
            "badge": "Mise à jour freelance",
            "body": "Vous avez reçu une nouvelle proposition pour votre projet "
            "<strong>{project_title}</strong>.",
            "freelancer_label": "Freelance",
            "heading": "Bonjour {name},",
            "message_label": "Message",
            "preheader": "Vous avez reçu une nouvelle proposition pour votre "
            "projet {project_title}.",
            "review_button": "Examiner la proposition",
            "subject": "Nouvelle proposition pour {project_title}",
            "text": "Bonjour {name},\n"
            "\n"
            "Vous avez reçu une nouvelle proposition pour votre projet "
            "{project_title}.\n"
            "\n"
            "Freelance : {freelancer}\n"
            "Montant : {amount}\n"
            "\n"
            "Examiner : {url}\n"
            "\n"
            "— L'équipe Podacium",
            "title": "Nouvelle proposition reçue",
        },
        "refund": {
            "amount_label": "Montant remboursé",
            "badge": "Remboursement",
            "body": "Votre remboursement a été traité avec succès. Le montant a "
            "été crédité sur votre portefeuille Podacium.",
            "heading": "Bonjour {name},",
            "preheader": "Votre remboursement Podacium de {amount} a été traité et "
            "crédité sur votre portefeuille.",
            "refund_label": "ID de remboursement",
            "status_label": "Statut",
            "status_refunded": "Remboursé",
            "subject": "Remboursement effectué – {amount} crédité sur votre "
            "portefeuille",
            "text": "Bonjour {name},\n"
            "\n"
            "Votre remboursement a été traité avec succès.\n"
            "\n"
            "Montant remboursé : {amount}\n"
            "Transaction : {transaction_id}\n"
            "Remboursement : {refund_id}\n"
            "\n"
            "Voir votre portefeuille : {url}\n"
            "\n"
            "— L'équipe Podacium",
            "title": "Remboursement effectué",
            "transaction_label": "ID de transaction d'origine",
            "wallet_button": "Voir mon portefeuille",
        },
        "reset": {
            "badge": "Mise à jour de sécurité",
            "body": "Nous avons reçu une demande de réinitialisation du mot de "
            "passe Podacium pour <strong>{email}</strong>.",
            "button": "Réinitialiser mon mot de passe",
            "cta": "Pour définir un nouveau mot de passe sécurisé, veuillez cliquer "
            "sur le bouton ci-dessous :",
            "heading": "Bonjour {name},",
            "ignore": "Si vous n'avez pas demandé de réinitialisation, vous pouvez "
            "ignorer cet email.",
            "preheader": "Réinitialisez votre mot de passe Podacium — ce lien "
            "expire dans 24 heures.",
            "security": "Ce lien de réinitialisation expirera dans 24 heures.",
            "subject": "Réinitialisez votre mot de passe Podacium",
            "text": "Bonjour {name},\n"
            "\n"
            "Nous avons reçu une demande de réinitialisation de votre mot "
            "de passe Podacium pour {email}.\n"
            "\n"
            "Pour réinitialiser votre mot de passe, visitez ce lien :\n"
            "{url}\n"
            "\n"
            "Ce lien expirera dans 24 heures.\n"
            "\n"
            "Si vous n'avez pas demandé cette réinitialisation, veuillez "
            "ignorer cet email.\n"
            "\n"
            "— L'équipe Podacium",
            "title": "Demande de réinitialisation de mot de passe",
        },
        "role_changed": {
            "badge": "Mise à jour de l'organisation",
            "body": "Votre rôle dans <strong>{org_name}</strong> a été mis à " "jour.",
            "heading": "Bonjour {name},",
            "new_role_label": "Nouveau rôle",
            "old_role_label": "Rôle précédent",
            "org_button": "Ouvrir l'organisation",
            "preheader": "Votre rôle dans {org_name} a été changé en {role}.",
            "subject": "Votre rôle dans {org_name} a été mis à jour",
            "text": "Bonjour {name},\n"
            "\n"
            "Votre rôle dans {org_name} a été mis à jour de "
            "{old_role} à {new_role}.\n"
            "\n"
            "— L'équipe Podacium",
            "title": "Rôle mis à jour",
        },
        "shared": {
            "alt_link": "Si le bouton ne fonctionne pas, copiez et collez ce lien "
            "dans votre navigateur :",
            "brand": "Podacium",
            "footer_company": "Podacium — Plateforme de Data Science, IA et "
            "Business Intelligence",
            "footer_privacy": "Politique de confidentialité",
            "footer_rights": "Tous droits réservés.",
            "footer_sent_to": "Envoyé à {email}",
            "footer_support": "Contactez-nous",
            "footer_terms": "Conditions d'utilisation",
            "ignore": "Si vous n'avez pas demandé cet email, vous pouvez "
            "l'ignorer. Votre compte reste sécurisé.",
            "manage_prefs": "Préférences de notification",
            "regards": "Cordialement,<br><strong>L'équipe Podacium</strong>",
            "security_badge": "Mise à jour de sécurité",
            "tagline": "L'avenir de l'intelligence",
            "year": "{year}",
        },
        "subscription": {
            "amount_label": "Montant",
            "badge": "Mise à jour de facturation",
            "body": "Votre abonnement Podacium a été mis à jour.",
            "cancelled_label": "Annulé",
            "heading": "Bonjour {name},",
            "manage_button": "Gérer l'abonnement",
            "plan_label": "Plan",
            "preheader": "Votre abonnement Podacium au plan {plan} a été " "{status}.",
            "renewal_label": "Prochain renouvellement",
            "started_label": "Début",
            "status_label": "Statut",
            "subject": "Votre abonnement Podacium a été mis à jour",
            "text": "Bonjour {name},\n"
            "\n"
            "Votre abonnement Podacium a été mis à jour.\n"
            "\n"
            "Plan : {plan}\n"
            "Montant : {amount}\n"
            "Statut : {status}\n"
            "\n"
            "Gérer votre abonnement : {url}\n"
            "\n"
            "— L'équipe Podacium",
            "title": "Mise à jour d'abonnement",
        },
        "verify": {
            "badge": "Vérifiez votre compte",
            "body": "Nous sommes ravis de vous accueillir sur "
            "<strong>Podacium</strong> — votre plateforme de référence "
            "pour la Data Science, l'IA et la Business Intelligence.",
            "button": "Vérifier mon email",
            "cta": "Pour profiter pleinement de votre compte, veuillez vérifier "
            "votre adresse email ci-dessous :",
            "heading": "Bienvenue à bord, {name} !",
            "ignore": "Si vous n'avez pas créé de compte, vous pouvez ignorer cet "
            "email.",
            "preheader": "Bienvenue sur Podacium — vérifiez votre email pour "
            "activer votre compte.",
            "security": "Ce lien expirera dans 7 jours pour votre sécurité.",
            "subject": "Confirmez votre email – Activez votre compte Podacium",
            "text": "Bonjour {name},\n"
            "\n"
            "Bienvenue sur Podacium — votre plateforme de Data Science, IA "
            "et Business Intelligence.\n"
            "\n"
            "Pour activer votre compte, veuillez vérifier votre email en "
            "cliquant sur le lien ci-dessous :\n"
            "\n"
            "{url}\n"
            "\n"
            "Ce lien expirera dans 7 jours.\n"
            "\n"
            "Si vous n'avez pas créé de compte, vous pouvez ignorer ce "
            "message.\n"
            "\n"
            "— L'équipe Podacium",
            "title": "Bienvenue sur Podacium",
        },
        "waitlist_confirmation": {
            "badge": "Accès anticipé",
            "footer": "Bienvenue à bord,<br><strong>L'équipe " "Podacium</strong>",
            "greeting": "Bonjour {name},",
            "position_info": "Vous êtes #{position} sur la liste "
            "d'attente Podacium. Nous vous "
            "informerons dès que votre place sera "
            "prête.",
            "prefs": "Vous pouvez vous désabonner à tout moment, "
            "mais nous aimerions vous garder informé.",
            "preheader": "Vous êtes #{position} dans la file. "
            "Partagez votre lien pour monter !",
            "reward_info": "Parrainez 5 amis pour débloquer un mois "
            "gratuit de Podacium Pro !",
            "share_button": "Partagez votre lien",
            "share_title": "Votre lien de parrainage :",
            "subject": "Vous êtes sur la liste d'attente Podacium !",
            "text": "Bonjour {name},\n"
            "\n"
            "Vous êtes #{position} sur la liste d'attente "
            "Podacium. Partagez votre lien avec vos amis "
            "pour monter dans la file !\n"
            "\n"
            "Votre lien de parrainage : "
            "https://podacium.com/waitlist?ref={referral_code}\n"
            "\n"
            "Parrainez 5 amis pour débloquer un mois "
            "gratuit de Podacium Pro !\n"
            "\n"
            "À venir :\n"
            "- Accès anticipé aux cours, freelancing et "
            "outils BI\n"
            "- Intégration prioritaire au lancement\n"
            "- Accès exclusif à la communauté\n"
            "- Offres spéciales pour les membres de la "
            "liste d'attente\n"
            "\n"
            "Bienvenue à bord !\n"
            "— L'équipe Podacium",
            "title": "Bienvenue dans le futur",
            "whats_next": "À venir :\n"
            "• Accès anticipé aux cours, freelancing "
            "et outils BI\n"
            "• Intégration prioritaire au lancement\n"
            "• Accès exclusif à la communauté\n"
            "• Offres spéciales pour les membres de "
            "la liste d'attente",
        },
        "waitlist_drip_day14": {
            "badge": "Liste d'attente",
            "body": "Les premiers membres bénéficient d'une "
            "intégration prioritaire et d'offres de lancement "
            "exclusives. Plus vous invitez d'amis maintenant, "
            "plus votre place sera élevée.",
            "footer": "À très bientôt,<br><strong>L'équipe " "Podacium</strong>",
            "heading": "Bonjour {name},",
            "preheader": "Les amis que vous invitez aujourd'hui vous "
            "rejoindront au lancement.",
            "referral_button": "Inviter des amis",
            "referral_info": "Parrainez 5 amis pour débloquer un mois "
            "gratuit de Podacium Pro !",
            "referral_label": "Votre lien personnel de parrainage :",
            "subject": "Votre code de parrainage est toujours actif",
            "text": "Bonjour {name},\n"
            "\n"
            "Votre lien de parrainage est toujours actif :\n"
            "\n"
            "https://podacium.com/waitlist?ref={referral_code}\n"
            "\n"
            "Les membres inscrits tôt bénéficient d'une "
            "intégration prioritaire et d'offres exclusives.\n"
            "\n"
            "— L'équipe Podacium",
            "title": "Invitez votre réseau",
        },
        "waitlist_drip_day3": {
            "badge": "Liste d'attente",
            "body": "Votre place sur la liste d'attente est réservée, "
            "mais l'accès anticipé revient à ceux qui "
            "progressent dans la file. Partagez votre lien de "
            "parrainage ci-dessous — chaque ami qui s'inscrit "
            "vous fait avancer.",
            "footer": "À très bientôt,<br><strong>L'équipe " "Podacium</strong>",
            "heading": "Bonjour {name},",
            "preheader": "Invitez 5 amis et débloquez un mois gratuit "
            "de Podacium Pro.",
            "referral_button": "Inviter des amis",
            "referral_info": "Parrainez 5 amis pour débloquer un mois "
            "gratuit de Podacium Pro !",
            "referral_label": "Votre lien personnel de parrainage :",
            "subject": "Votre place en accès anticipé sur Podacium " "vous attend",
            "text": "Bonjour {name},\n"
            "\n"
            "Votre place sur la liste d'attente est réservée. "
            "Partagez votre lien de parrainage pour remonter "
            "dans la file :\n"
            "\n"
            "https://podacium.com/waitlist?ref={referral_code}\n"
            "\n"
            "Parrainez 5 amis pour débloquer un mois gratuit "
            "de Podacium Pro !\n"
            "\n"
            "— L'équipe Podacium",
            "title": "Ne perdez pas votre place",
        },
        "waitlist_drip_day30": {
            "badge": "Liste d'attente",
            "body": "Ceci est votre dernier rappel : les bonus de "
            "parrainage et accès anticipés sont réservés aux "
            "membres de la liste d'attente. Partagez votre "
            "lien avant le lancement.",
            "footer": "À très bientôt,<br><strong>L'équipe " "Podacium</strong>",
            "heading": "Bonjour {name},",
            "preheader": "Votre place réservée et vos avantages ne "
            "dureront pas éternellement.",
            "referral_button": "Inviter des amis",
            "referral_info": "Parrainez 5 amis pour débloquer un mois "
            "gratuit de Podacium Pro !",
            "referral_label": "Votre lien personnel de parrainage :",
            "subject": "Dernier rappel — réservez vos avantages " "Podacium",
            "text": "Bonjour {name},\n"
            "\n"
            "Dernier rappel — les bonus de parrainage et "
            "accès anticipés sont réservés aux membres de la "
            "liste d'attente :\n"
            "\n"
            "https://podacium.com/waitlist?ref={referral_code}\n"
            "\n"
            "Parrainez 5 amis pour débloquer un mois gratuit "
            "de Podacium Pro !\n"
            "\n"
            "— L'équipe Podacium",
            "title": "Dernier rappel",
        },
        "waitlist_drip_day7": {
            "badge": "Liste d'attente",
            "body": "Podacium arrive avec trois piliers intégrés : "
            "cours EdTech avec certificats vérifiables, "
            "marketplace de freelancing en DZD, et Business "
            "Intelligence pour les PME algériennes. Le tout "
            "relié à un portefeuille unique.",
            "footer": "À très bientôt,<br><strong>L'équipe " "Podacium</strong>",
            "heading": "Bonjour {name},",
            "preheader": "Formations, freelancing et BI — une seule " "plateforme.",
            "referral_button": "Inviter des amis",
            "referral_info": "Parrainez 5 amis pour débloquer un mois "
            "gratuit de Podacium Pro !",
            "referral_label": "Votre lien personnel de parrainage :",
            "subject": "Ce qui arrive en premier sur Podacium",
            "text": "Bonjour {name},\n"
            "\n"
            "Des formations avec certificats vérifiables. Une "
            "marketplace de freelancing en DZD. De la Business "
            "Intelligence pour les PME algériennes. Une seule "
            "plateforme, un seul portefeuille.\n"
            "\n"
            "Partagez votre lien de parrainage pour avancer :\n"
            "\n"
            "https://podacium.com/waitlist?ref={referral_code}\n"
            "\n"
            "— L'équipe Podacium",
            "title": "Conçu pour votre croissance",
        },
        "welcome": {
            "badge": "Bienvenue",
            "bi_cta": "Ouvrir BI Studio",
            "bi_desc": "Créez des tableaux de bord puissants avec nos outils BI.",
            "bi_title": "Analyser les données",
            "body": "Votre compte est vérifié et prêt. Voici quelques actions "
            "pour commencer :",
            "heading": "Bienvenue, {name} !",
            "hub_cta": "Explorer le Hub",
            "hub_desc": "Rejoignez des projets, connectez-vous avec des "
            "freelances et développez votre réseau.",
            "hub_title": "Connectez-vous et collaborez",
            "learn_cta": "Parcourir les cours",
            "learn_desc": "Parcourez notre bibliothèque de cours en Data Science, "
            "IA et BI.",
            "learn_title": "Explorer les cours",
            "preheader": "Bienvenue sur Podacium ! Voici tout ce dont vous avez "
            "besoin pour commencer.",
            "profile_cta": "Modifier le profil",
            "profile_desc": "Ajoutez vos compétences et votre photo de profil.",
            "profile_title": "Complétez votre profil",
            "subject": "Bienvenue sur Podacium – Commençons !",
            "support": "Besoin d'aide ? Notre équipe est là pour vous.",
            "support_cta": "Obtenir de l'aide",
            "text": "Bonjour {name},\n"
            "\n"
            "Bienvenue sur Podacium ! Votre compte est vérifié et prêt.\n"
            "\n"
            "Pour commencer :\n"
            "- Parcourez nos cours en Data Science, IA et BI\n"
            "- Créez des tableaux de bord avec BI Studio\n"
            "- Connectez-vous avec des freelances\n"
            "- Complétez votre profil\n"
            "\n"
            "Commencer : {url}\n"
            "\n"
            "Besoin d'aide ? Contactez-nous : {support_url}\n"
            "\n"
            "— L'équipe Podacium",
            "title": "Bienvenue sur Podacium !",
        },
        "welcome_d1": {
            "badge": "Astuces",
            "body": "Voici deux astuces pour bien démarrer.",
            "heading": "Ravi de vous avoir parmi nous, {name} !",
            "preheader": "Tirez le meilleur parti de votre première semaine "
            "sur Podacium.",
            "subject": "Astuce : votre premier projet sur Podacium",
            "support": "Des questions ? Notre équipe est là pour vous aider.",
            "support_cta": "Obtenir de l'aide",
            "text": "Bonjour {name},\n"
            "\n"
            "Voici deux astuces pour bien démarrer :\n"
            "- Suivez un court cours dans votre domaine\n"
            "- Complétez votre profil pour attirer des opportunités\n"
            "\n"
            "Parcourir les cours : {url}/learn\n"
            "Compléter le profil : {url}/settings\n"
            "\n"
            "— L'équipe Podacium",
            "tip1_cta": "Parcourir les cours",
            "tip1_desc": "Commencez par un court cours dans votre domaine "
            "d'intérêt.",
            "tip1_title": "Suivez un cours",
            "tip2_cta": "Compléter le profil",
            "tip2_desc": "Un profil complet vous aide à vous connecter avec "
            "les bonnes personnes.",
            "tip2_title": "Configurez votre profil",
            "title": "Jour 1 – Astuces rapides",
        },
        "welcome_d3": {
            "badge": "Communauté",
            "body": "Apprendre ensemble est plus enrichissant. Voici comment "
            "vous connecter.",
            "community_cta": "Explorer la communauté",
            "community_desc": "Participez aux discussions, partagez vos "
            "connaissances et trouvez des collaborateurs.",
            "community_title": "Rejoignez la communauté",
            "heading": "Développez votre réseau, {name} !",
            "network_cta": "Trouver des mentors",
            "network_desc": "Connectez-vous avec des professionnels prêts à "
            "vous guider.",
            "network_title": "Trouvez des mentors",
            "preheader": "Vous n'êtes pas seul — connectez-vous avec vos pairs "
            "et mentors.",
            "subject": "Connectez-vous avec la communauté Podacium",
            "support": "Besoin d'aide pour trouver votre communauté ? "
            "Contactez-nous.",
            "support_cta": "Obtenir de l'aide",
            "text": "Bonjour {name},\n"
            "\n"
            "Connectez-vous avec la communauté Podacium :\n"
            "- Participez aux discussions et trouvez des "
            "collaborateurs\n"
            "- Connectez-vous avec des mentors\n"
            "\n"
            "Explorer : {url}/community\n"
            "\n"
            "— L'équipe Podacium",
            "title": "Jour 3 – Communauté",
        },
        "welcome_d7": {
            "badge": "Premium",
            "body": "Vous êtes avec nous depuis une semaine — voici comment "
            "passer au niveau supérieur.",
            "heading": "Une semaine déjà, {name} !",
            "portal_cta": "Ouvrir BI Studio",
            "portal_desc": "Créez des tableaux de bord avancés avec des "
            "analyses IA et des données en temps réel.",
            "portal_title": "BI Studio Pro",
            "preheader": "Débloquez toute la puissance de Podacium avec les "
            "fonctionnalités premium.",
            "premium_cta": "Voir les offres",
            "premium_desc": "Accédez à des cours illimités, des outils BI "
            "avancés et un support prioritaire.",
            "premium_title": "Passez à Premium",
            "subject": "Débloquez les fonctionnalités premium sur Podacium",
            "support": "Des questions sur Premium ? Nous sommes là pour vous.",
            "support_cta": "Obtenir de l'aide",
            "text": "Bonjour {name},\n"
            "\n"
            "Cela fait une semaine ! Voici comment aller plus loin :\n"
            "- Passez à Premium pour un accès illimité\n"
            "- Explorez les outils BI avancés\n"
            "\n"
            "Voir les offres : {url}/pricing\n"
            "\n"
            "— L'équipe Podacium",
            "title": "Jour 7 – Allez plus loin",
        },
    },
    "kab": {
        "account_deleted": {
            "badge": "Abeddel deg umiḍan",
            "body": "Amiḍan-inek n Podacium yettwahegga i wukkes. Neḥzen "
            "aṭas imi ara tefɣed.",
            "deletion_date": "Azemz n wukkes aneggaru",
            "feedback": "Bɣiɣ ad d-tiniḍ tannayt-ik ɣef wamek ara " "nenerni.",
            "heading": "Azul {name},",
            "preheader": "Amiḍan-inek n Podacium yettwahegga i wukkes. "
            "Tesɛid 30 wussan akken ad t-id-terrteḍ.",
            "recover_button": "Err-d amiḍan-iw",
            "recovery_body": "Tesɛid <strong>30 wussan</strong> akken ad "
            "d-terred amiḍan-ik s unekcum kan ɣer-s. "
            "Seld aya, isefka-inek ad ttwekksen i "
            "lebda.",
            "recovery_window": "Tallit n tririt",
            "subject": "Neḥzen imi trewled — Akkes n umiḍan yettwasentem",
            "support_link": "Bḍu tannayt-ik",
            "text": "Azul {name},\n"
            "\n"
            "Amiḍan-inek n Podacium yettwahegga i wukkes.\n"
            "\n"
            "Tesɛid 30 wussan akken ad d-terred amiḍan-ik s "
            "unekcum kan.\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "title": "Akkes n umiḍan yettwahegga",
        },
        "completion": {
            "badge": "Tawwurt teldi",
            "body": "Tfukked s rrbeḥ <strong>{course_name}</strong>. "
            "Amahil-ik d tiḥerci-ik fkant ayen yelhan!",
            "certificate_button": "Wali aselkin",
            "explore_button": "Wali tiɣuriwin",
            "heading": "Amahil ameqqran, {name}!",
            "next_steps": "Tebɣiḍ ugar? Wali tiɣuriwin-nneɣ timassanin akken "
            "ad tkemmleḍ.",
            "preheader": "Tfukked {course_name} deg Podacium — awi " "aselkin-inek !",
            "score_label": "Agmuḍ aneggaru",
            "share": "Bḍu rrbeḥ-ik d uẓeṭṭa-inek :",
            "subject": "Mebruk ! Tfukked {course_name}",
            "text": "Azul {name},\n"
            "\n"
            "Mebruk! Tfukked s rrbeḥ {course_name}.\n"
            "\n"
            "Aselkin: {url}\n"
            "\n"
            "Kemmel almad deg tɣuriwin nniḍen.\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "title": "Mebruk fell-ak !",
        },
        "contact": {
            "action_required": "Tigawt tettwasra: Ttxil-k err i usuter-a deg "
            "24-48 n tesragin.",
            "badge": "Alɣu n unedbal",
            "category_label": "Taggayt",
            "email_label": "Tansa n yimayl",
            "general_inquiry": "Asteqsi amatu",
            "message_label": "Agbur n yizen",
            "name_label": "Isem ummid",
            "no_subject": "Ulac asentel",
            "not_provided": "Ur d-yettunefk ara",
            "phone_label": "Uṭṭun n tiliɣri",
            "preheader": "Tiririt tamaynut n tfelwit n unermis sɣur {name}.",
            "priority_label": "Tazwirt",
            "priority_normal": "Tamagnut",
            "reply_button": "Err i {name}",
            "source_label": "Aɣbalu",
            "source_website": "Asmel web",
            "subject": "Tafelwit n unermis : {subject}",
            "subject_label": "Asentel",
            "text": "IZEN N UNERMIS - PODACIUM\n"
            "==================================================\n"
            "\n"
            "Sɣur: {name}\n"
            "Imayl: {email}\n"
            "Tiliɣri: {phone}\n"
            "Taggayt: {category}\n"
            "Asentel: {subject}\n"
            "\n"
            "Izen:\n"
            "==================================================\n"
            "{message}\n"
            "==================================================\n"
            "\n"
            "Ttxil err i {name} deg 24-48 n tesragin.\n"
            "Imayl n tririt: {email}",
            "time_label": "Akud",
            "title": "Izen amaynut yewweḍ-d",
        },
        "csat_survey": {
            "badge": "Tasleḍt n tallalt",
            "body": "Tikit-inek n tallalt tamaynut "
            "<strong>#{ticket_number}</strong> — "
            '"<em>{ticket_subject}</em>" — tefra. Nebɣa ad nsel i '
            "tannayt-ik.",
            "feedback_note": "Tannayt-ik ad aɣ-tɛiwen ad nenerni.",
            "heading": "Azul {user_name},",
            "preheader": "Amek telliḍ d tallalt n Podacium? Mudd azal i " "tikit-inek.",
            "rating_button": "Mudd azal i tarmit-ik",
            "rating_question": "Acḥal tefraḥed s tallalt i k-d-yettunefken?",
            "subject": "Amek telliḍ d tallalt? (Tikit: {ticket_number})",
            "text": "Azul {user_name},\n"
            "\n"
            'Tikit-inek #{ticket_number} — "{ticket_subject}" — '
            "tefra.\n"
            "\n"
            "Ttxil mudd azal i tarmit-ik:\n"
            "{rating_url}\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "title": "Nesɛa azal i tannayt-ik",
        },
        "email_changed": {
            "badge": "Abeddel n tɣellist",
            "body": "Tansa n yimayl n umiḍan-inek n Podacium tettwabeddel.",
            "heading": "Azul {name},",
            "new_email_label": "Imayl amaynut",
            "not_you": "Mačči d kečč?",
            "not_you_body": "Ma mačči d kečč i ixedmen abeddel-a, nermes "
            "tallalt imir-a akken ad tḥerzed amiḍan-ik.",
            "old_email_label": "Imayl aqbur",
            "preheader": "Tansa n yimayl-inek deg Podacium tettwabeddel. "
            "Sentem ma yella d kečč.",
            "subject": "Tansa n yimayl-inek deg Podacium tettwabeddel",
            "support_link": "Nermes tallalt",
            "text": "Azul {name},\n"
            "\n"
            "Tansa-inek n yimayl tettwabeddel:\n"
            "\n"
            "Aqbur: {old_email}\n"
            "Amaynut: {new_email}\n"
            "Akud: {time}\n"
            "\n"
            "Ma mačči d kečč, nermes tallalt imir-a.\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "time_label": "Akud n ubeddel",
            "title": "Tansa n yimayl tettwabeddel",
        },
        "enrollment": {
            "badge": "Ajerred amaynut",
            "body": "Tjerded s rrbeḥ deg <strong>{course_name}</strong>.",
            "heading": "Tettwaqebled, {name}!",
            "preheader": "Tettwaqebled deg {course_name} — bdu almad ass-a !",
            "progress_tip": "Ḍfeṛ asfari-inek, awi iselkinen, rnu tizemmar "
            "timaynutin.",
            "start_button": "Bdu almad",
            "subject": "Tettwaqebled deg {course_name}",
            "text": "Azul {name},\n"
            "\n"
            "Tjerded s rrbeḥ deg {course_name}.\n"
            "\n"
            "Bdu: {url}\n"
            "\n"
            "Ḍfeṛ asfari-inek u awi iselkinen.\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "title": "Ajerred yettwasentem",
        },
        "invite": {
            "badge": "Tanebzit tamaynut",
            "body": "<strong>{inviter_name}</strong> inebzed-ik ad terzid ɣer "
            "tsudut-is deg <strong>Podacium</strong>.",
            "button": "Qbel tanebzit",
            "collab_note": "S tnebzit-a, tzemred ad temɛawaned deg yisefka, "
            "tifelwiyin n yisefka d tesleḍt talqayant.",
            "heading": "Tettwanebzed !",
            "ignore": "Ma ur tettraǧuḍ ara tanebzit-a, tzemred ad teǧǧed " "tabrat-a.",
            "invited_by": "Yettwanebzed sɣur {inviter_name}",
            "org_label": "Tasudut",
            "preheader": "Tettwanebzed ad terzid ɣer {org_name} deg Podacium d "
            "{role}.",
            "role_label": "Tamhelt : {role}",
            "subject": "Tanebzit i werfud n {org_name} deg Podacium",
            "text": "Azul,\n"
            "\n"
            "{inviter_name} inebzed-ik ad terzid ɣer {org_name} d {role} "
            "deg Podacium.\n"
            "\n"
            "Akken ad tkecmed, senned ɣef useqqen:\n"
            "{url}\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "title": "Tettwanebzed !",
        },
        "invite_accepted": {
            "badge": "Abeddel deg terbaɛt",
            "body": "<strong>{user_name}</strong> yeqbel tanebzit-inek "
            "akken ad yili deg <strong>{org_name}</strong> d "
            "<strong>{role}</strong>.",
            "heading": "Isallen igerrzen!",
            "manage_button": "Sefrek tarbaɛt",
            "preheader": "{user_name} yeqbel tanebzit-inek akken ad yili "
            "deg {org_name}.",
            "subject": "{user_name} yeqbel tanebzit-inek ɣer {org_name}",
            "team_label": "Iɛeggalen n terbaɛt",
            "text": "Azul {inviter_name},\n"
            "\n"
            "{user_name} yeqbel tanebzit-inek ɣer {org_name} d "
            "{role}.\n"
            "\n"
            "Tzemred ad tsefreked tarbaɛt seg tfelwit n "
            "usefrek.\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "title": "Tanebzit tettwaqbal",
        },
        "magic_link": {
            "badge": "Anekcum war awal uffir",
            "body": "Senned ɣef tqeffalt ddaw-a akken ad tkecmed ɣer "
            "umiḍan-inek n Podacium war awal uffir.",
            "cta": "Kcem ɣer Podacium",
            "expiry": "Aseqqen-a yettuseqdec yiwet n tikkelt kan yerna ifennu "
            "deg {expires_in_minutes} n tesdatin.",
            "greeting": "Azul {name},",
            "preheader": "Senned ɣef useqqen-inek uḥriz akken ad tkecmed " "imir-a.",
            "security_note": "Ma mačči d kečč i d-yessutren aseqqen-a, "
            "tzemred ad t-teǧǧed.",
            "subject": "Aseqqen-inek n unekcum ɣer Podacium",
            "text": "Azul {name},\n"
            "\n"
            "Senned ɣef useqqen ddaw-a akken ad tkecmed ɣer "
            "Podacium:\n"
            "\n"
            "{magic_url}\n"
            "\n"
            "Aseqqen-a ifennu deg {expires_in_minutes} tesdatin.\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "title": "Kcem ɣer Podacium",
        },
        "member_removed": {
            "badge": "Abeddel n tsudut",
            "body": "Tettwakkseḍ seg <strong>{org_name}</strong> deg " "Podacium.",
            "heading": "Azul {name},",
            "preheader": "Tettwakkseḍ seg {org_name} deg Podacium.",
            "reason_body": "Ma tḥusseḍ d tuccḍa, ttxil-k nermes bab n "
            "tsudut neɣ tarbaɛt-nneɣ n tallalt.",
            "subject": "Tettwakkseḍ seg {org_name}",
            "support_button": "Nermes tallalt",
            "text": "Azul {name},\n"
            "\n"
            "Tettwakkseḍ seg {org_name} deg Podacium.\n"
            "\n"
            "Ma tḥusseḍ d tuccḍa, nermes tallalt.\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "title": "Abeddel n tmetti",
        },
        "new_device": {
            "badge": "Alɣu n tɣellist",
            "body": "Allal amaynut yekcem-d ɣer umiḍan-inek n Podacium. Ma d "
            "kečč, ulac d acu ara txedmed. Ma mačči d kečč, ḥrez "
            "amiḍan-inek imir-a.",
            "browser_label": "Iminig",
            "device_label": "Allal",
            "heading": "Azul {name},",
            "ip_label": "Tansa IP",
            "location_label": "Amkan",
            "os_label": "Anagraw n wammud",
            "preheader": "Allal amaynut yekcem-d ɣer umiḍan-inek n Podacium "
            "seg {location}.",
            "secure_button": "Ḥrez amiḍan-iw",
            "subject": "Anekcum amaynut ɣer umiḍan-inek n Podacium",
            "text": "Azul {name},\n"
            "\n"
            "Allal amaynut yekcem ɣer umiḍan-inek:\n"
            "\n"
            "Allal: {device}\n"
            "Iminig: {browser}\n"
            "Anagraw: {os}\n"
            "IP: {ip}\n"
            "Amkan: {location}\n"
            "Akud: {time}\n"
            "\n"
            "Ma d kečč, teǧǧed-t kan. Ma mačči d kečč, beddel awal "
            "uffir imir-a.\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "time_label": "Akud",
            "title": "Allal amaynut yettwafek",
            "trust_button": "Ih, d nekk",
            "unknown": "Ur yettwassen ara",
        },
        "newsletter": {
            "badge": "Tabratt n yisallen",
            "body": "Tura tjerded deg tebratt-nneɣ. Ad k-n-ttazen isallen ɣef "
            "tɣuriwin timaynutin, asenfaṛen n yimahilen ilelliyin d "
            "yisallen n tansa.",
            "footer": "Tanemmirt imi d-terzid,<br><strong>Tarbaɛt n "
            "Podacium</strong>",
            "heading": "Ansuf ɣer tmetti n Podacium, {name}!",
            "prefs": "Tzemred ad tekksed ajerred yal ass seg yisentyan n " "yilɣa.",
            "preheader": "Tjerded s rrbeḥ deg tebratt n yisallen n Podacium — "
            "ansuf yis-k !",
            "subject": "Telliḍ deg tebdart ! Ansuf ɣer tebratt n Podacium",
            "text": "Azul {name},\n"
            "\n"
            "Ansuf ɣer tmetti n Podacium!\n"
            "\n"
            "Tura tjerded deg tebratt-nneɣ n yisallen.\n"
            "\n"
            "Ayen ara d-yilin:\n"
            "- Tiɣuriwin timaynutin d yiberdan n ulmad\n"
            "- Tignatin n yisenfaṛen ilelliyin\n"
            "- Tifratin n BI d yisefka\n"
            "- Tedyanin timettiyin\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "title": "Ajerred yettwasentem",
            "whatsnext_1": "[Tiɣuriwin] Tiɣuriwin timaynutin d yiberdan n " "ulmad",
            "whatsnext_2": "[Isenfaṛen] Tignatin n umahil ilelli d yisallen n " "ssuq",
            "whatsnext_3": "[Tasleḍt] Tifratin n BI, tigrummiwin n yisefka",
            "whatsnext_4": "[Tedyanin] Tedyanin timettiyin d usebter amezwaru "
            "n tmahilin timaynutin",
            "whatsnext_title": "Ayen ara d-yilin :",
        },
        "otp": {
            "badge": "Tangalt n tɣellist",
            "body": "Ttxil-k seqdec tangalt n usentem ddaw-a akken ad tkecmed ɣer "
            "Podacium:",
            "expiry": "Tangalt-a tfennu deg 5 tesdatin.",
            "heading": "Asentem yettwasra",
            "not_you": "Ma mačči d kečč i iɛerḍen ad ikecm, beddel awal uffir "
            "imir-a.",
            "preheader": "Seqdec tangalt-a akken ad tkecmed ɣer Podacium.",
            "subject": "Tangalt-inek n usentem deg Podacium",
            "text": "Tangalt-inek n usentem deg Podacium d: {code}\n"
            "\n"
            "Tangalt-a tfennu deg 5 tesdatin. Ur tt-bḍu d yiwen.\n"
            "\n"
            "Ma mačči d kečč, beddel awal uffir-inek imir-a.",
            "title": "Asentem s sin n yisurifen",
            "warning": "Ur bḍu ara tangalt-a d wammus. Podacium d awezɣi ad "
            "k-d-yessuter tangalt-ik.",
        },
        "password_changed": {
            "badge": "Abeddel n tɣellist",
            "body": "Awal uffir-inek n Podacium yettwabeddel s rrbeḥ. "
            "Tiɣimiyin nniḍen irmizen meṛṛa fkant i "
            "tɣellist-inek.",
            "heading": "Azul {name},",
            "ip_label": "Tansa IP",
            "not_you": "Mačči d kečč?",
            "not_you_body": "Ma mačči d kečč i ibeddlen awal uffir, "
            "ttxil-k nermes tallalt imir-a akken ad "
            "tɛawded amiḍan-ik.",
            "preheader": "Awal uffir-inek n Podacium yettwabeddel tura "
            "kan. Ma mačči d kečč, ewwet tura.",
            "reset_link": "Ales awal uffir",
            "subject": "Awal uffir-inek n Podacium yettwabeddel",
            "support_link": "Nermes tallalt",
            "text": "Azul {name},\n"
            "\n"
            "Awal uffir-inek n Podacium yettwabeddel s rrbeḥ.\n"
            "\n"
            "Akud: {time}\n"
            "IP: {ip}\n"
            "\n"
            "Tiɣimiyin nniḍen meṛṛa rwant.\n"
            "\n"
            "Ma mačči d kečč, nermes tallalt imir-a.\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "time_label": "Akud n ubeddel",
            "title": "Awal uffir yettwabeddel s rrbeḥ",
        },
        "payment": {
            "amount_label": "Azal",
            "badge": "Tanfult",
            "body": "Axellas-inek yettedda s rrbeḥ.",
            "date_label": "Azemz",
            "heading": "Tanemmirt, {name}!",
            "item_label": "Aferdis",
            "preheader": "Axellas-inek n Podacium n {amount} yettedda.",
            "receipt_button": "Wali tanfult",
            "status_label": "Addad",
            "status_paid": "Yettwaxlles",
            "subject": "Axellas yettwasentem – Tanfult seg Podacium",
            "text": "Azul {name},\n"
            "\n"
            "Axellas-inek yettedda s rrbeḥ.\n"
            "\n"
            "Azal: {amount}\n"
            "Aferdis: {item}\n"
            "Azemz: {date}\n"
            "Asulay: {transaction_id}\n"
            "\n"
            "Tanfult: {url}\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "title": "Axellas yettwasentem",
            "transaction_label": "Asulay n tnezzut",
        },
        "proposal": {
            "amount_label": "Lmiwaza",
            "badge": "Abeddel deg umahil ilelli",
            "body": "Tewweḍ-ik-id tsudut tamaynut i usenfaṛ-inek "
            "<strong>{project_title}</strong>.",
            "freelancer_label": "Amahil ilelli",
            "heading": "Azul {name},",
            "message_label": "Izen",
            "preheader": "Tewweḍ-ik-id tsudut tamaynut i usenfaṛ-inek "
            "{project_title}.",
            "review_button": "Wali asumer",
            "subject": "Asumer amaynut i {project_title}",
            "text": "Azul {name},\n"
            "\n"
            "Tewweḍ-d tsudut tamaynut i {project_title}.\n"
            "\n"
            "Amahil ilelli: {freelancer}\n"
            "Azal: {amount}\n"
            "\n"
            "Wali asumer: {url}\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "title": "Asumer amaynut yewweḍ-d",
        },
        "refund": {
            "amount_label": "Azal yettwarran",
            "badge": "Tririt n wedrim",
            "body": "Tririt-inek n wedrim tedda s rrbeḥ. Adrim-nni yettwarnu ɣer "
            "wagalis-ik n Podacium.",
            "heading": "Azul {name},",
            "preheader": "Tririt-inek n wedrim n {amount} tedda yerna tettwarnu "
            "ɣer wagalis-ik n Podacium.",
            "refund_label": "Asulay n tririt",
            "status_label": "Addad",
            "status_refunded": "Yettwarra",
            "subject": "Tririt n wedrim tedda – {amount} tettwarnu ɣer wagalis-ik",
            "text": "Azul {name},\n"
            "\n"
            "Tririt n wedrim tedda s rrbeḥ.\n"
            "\n"
            "Azal: {amount}\n"
            "Tanezzut: {transaction_id}\n"
            "Tririt: {refund_id}\n"
            "\n"
            "Wali agalis-ik: {url}\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "title": "Tririt n wedrim temmed",
            "transaction_label": "Asulay n tnezzut tamezwarut",
            "wallet_button": "Wali agalis-iw",
        },
        "reset": {
            "badge": "Abeddel n tɣellist",
            "body": "Nermes-d asuter n wallus n wawal uffir n Podacium i "
            "<strong>{email}</strong>.",
            "button": "Ales awenned n wawal uffir",
            "cta": "Akken ad tseddid awal uffir amaynut, senned ɣef tqeffalt "
            "ddaw-a:",
            "heading": "Azul {name},",
            "ignore": "Ma mačči d kečč i d-yessutren allus, tzemred ad teǧǧed "
            "tabrat-a. Amiḍan-inek iḥrez.",
            "preheader": "Ales awenned n wawal uffir n Podacium — aseqqen-a ifennu "
            "deg 24 tesragin.",
            "security": "Aseqqen-a n wallus ad ifak deg 24 tesragin.",
            "subject": "Ales awenned n wawal uffir n Podacium",
            "text": "Azul {name},\n"
            "\n"
            "Nermes-d asuter n wallus n wawal uffir i {email}.\n"
            "\n"
            "Senned ɣef useqqen-a:\n"
            "{url}\n"
            "\n"
            "Aseqqen-a ad ifak deg 24 tesragin.\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "title": "Asuter n wallus n wawal uffir",
        },
        "role_changed": {
            "badge": "Abeddel n tsudut",
            "body": "Tamhelt-inek deg <strong>{org_name}</strong> " "tettwabeddel.",
            "heading": "Azul {name},",
            "new_role_label": "Tamhelt tamaynut",
            "old_role_label": "Tamhelt taqdimt",
            "org_button": "Ldi tasudut",
            "preheader": "Tamhelt-inek deg {org_name} tettwabeddel ɣer " "{role}.",
            "subject": "Tamhelt-inek deg {org_name} tettwabeddel",
            "text": "Azul {name},\n"
            "\n"
            "Tamhelt-inek deg {org_name} tettwabeddel seg "
            "{old_role} ɣer {new_role}.\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "title": "Tamhelt tettwabeddel",
        },
        "shared": {
            "alt_link": "Ma yella taqeffalt ur teddi ara, nɣel tansa-ya deg "
            "iminig-inek:",
            "brand": "Podacium",
            "footer_company": "Podacium — Tansa n tussna n yisefka, tasenselkimt "
            "tamg许可ayt d usnulfu",
            "footer_privacy": "Tasertit n tbaḍnit",
            "footer_rights": "Izerfan meṛṛa ttwabaḍen.",
            "footer_sent_to": "Yettwazen ɣer {email}",
            "footer_support": "Nermes tallalt",
            "footer_terms": "Tiwtilin n useqdec",
            "ignore": "Ma mačči d kečč i d-yessutren tabrat-a, tzemred ad "
            "tt-teǧǧed. Amiḍan-inek iḥrez.",
            "manage_prefs": "Isentyan n yilɣa",
            "regards": "S tezmert d leqder,<br><strong>Tarbaɛt n " "Podacium</strong>",
            "security_badge": "Abeddel n tɣellist",
            "tagline": "Iminig ɣer yimal n tmussni",
            "year": "{year}",
        },
        "subscription": {
            "amount_label": "Azal",
            "badge": "Abeddel n teftart",
            "body": "Ajerred-inek n Podacium yettwabeddel.",
            "cancelled_label": "Yettwasefsex",
            "heading": "Azul {name},",
            "manage_button": "Sefrek ajerred",
            "plan_label": "Ahil",
            "preheader": "Ajerred-inek deg {plan} yella d {status}.",
            "renewal_label": "Allus i d-iteddun",
            "started_label": "Yebda deg",
            "status_label": "Addad",
            "subject": "Ajerred-inek n Podacium yettwabeddel",
            "text": "Azul {name},\n"
            "\n"
            "Ajerred-inek n Podacium yettwabeddel.\n"
            "\n"
            "Ahil: {plan}\n"
            "Azal: {amount}\n"
            "Addad: {status}\n"
            "\n"
            "Sefrek ajerred: {url}\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "title": "Abeddel deg ujerred",
        },
        "verify": {
            "badge": "Sentem amiḍan-inek",
            "body": "Farḥen aṭas imi d-terzid ɣer <strong>Podacium</strong> — "
            "tansa-inek tamezwarut deg tussna n yisefka d usnulfu.",
            "button": "Sentem imayl-iw",
            "cta": "Akken ad tesqedced amiḍan-inek s wudem ummid, ttxil-k sentem "
            "tansa-inek n yimayl ddaw-a:",
            "heading": "Ansuf yis-k, {name}!",
            "ignore": "Ma mačči d kečč i d-yesnulfan amiḍan-a, tzemred ad teǧǧed "
            "tabrat-a.",
            "preheader": "Ansuf ɣer Podacium — sentem imayl-inek akken ad tremded "
            "amiḍan-inek.",
            "security": "Aseqqen-a ad ifak deg 7 wussan i tɣellist-inek.",
            "subject": "Sentem imayl-inek – Rmed amiḍan-inek n Podacium",
            "text": "Azul {name},\n"
            "\n"
            "Ansuf ɣer Podacium — ansa ideg tettbeddu tuzzya-inek deg "
            "tussna n yisefka.\n"
            "\n"
            "Akken ad tremded amiḍan-inek, sentem imayl-inek s usenned "
            "ɣef useqqen-a:\n"
            "\n"
            "{url}\n"
            "\n"
            "Aseqqen-a ifennu deg 7 wussan.\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "title": "Ansuf ɣer Podacium",
        },
        "waitlist_confirmation": {
            "badge": "Anekcum amezwaru",
            "footer": "Ansuf yis-k,<br><strong>Tarbaɛt n " "Podacium</strong>",
            "greeting": "Azul {name},",
            "position_info": "Uṭṭun-ik d #{position} deg tebdart n "
            "urbaɛi n Podacium. Ad k-n-mel imir "
            "mi ara d-yaweḍ wemkan-ik.",
            "prefs": "Tzemred ad tekksed ajerred yal ass.",
            "preheader": "Uṭṭun-ik d #{position} deg uḍfar. Bḍu "
            "aseqqen-inek akken ad taẓed ɣer zdat !",
            "reward_info": "Nebzed 5 n yimeddukklen akken ad "
            "tremded aggur baṭel n Podacium Pro !",
            "share_button": "Bḍu aseqqen-ik",
            "share_title": "Aseqqen-inek n usebded :",
            "subject": "Telliḍ deg tebdart n urbaɛi n Podacium !",
            "text": "Azul {name},\n"
            "\n"
            "Uṭṭun-ik d #{position} deg tebdart n urbaɛi n "
            "Podacium.\n"
            "\n"
            "Aseqqen-inek: "
            "https://podacium.com/waitlist?ref={referral_code}\n"
            "\n"
            "Nebzed 5 n yimeddukklen akken ad tawid aggur "
            "baṭel n Podacium Pro!\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "title": "Ansuf ɣer yimal",
            "whats_next": "Ayen i d-iteddun :\n"
            "• Anekcum amezwaru ɣer tɣuriwin, amahil "
            "ilelli d wallalen n BI\n"
            "• Tazwirt deg useddu mi ara nebdu\n"
            "• Anekcum ɣer tmetti\n"
            "• Asumer uzzig i wid yellan deg "
            "tebdart",
        },
        "waitlist_drip_day14": {
            "badge": "Tabdart n urbaɛi",
            "body": "Imdanen imezwura ad sɛun tazwirt deg unekcum d "
            "tisumirin tuzzigin. Yal tikkelt ara d-tnebzded "
            "ugar n yimdanen, ad yali wemkan-ik.",
            "footer": "Ad nemzer mbeɛd,<br><strong>Tarbaɛt n " "Podacium</strong>",
            "heading": "Azul {name},",
            "preheader": "Imeddukklen ara tnebzded ass-a ad d-kecmen " "yid-k.",
            "referral_button": "Nebzed imeddukklen",
            "referral_info": "Nebzed 5 n yimeddukklen i waggur baṭel "
            "n Podacium Pro !",
            "referral_label": "Aseqqen-inek udmawan :",
            "subject": "Tangalt-inek n usebded tura tella",
            "text": "Azul {name},\n"
            "\n"
            "Aseqqen-inek mazal-it yermed:\n"
            "\n"
            "https://podacium.com/waitlist?ref={referral_code}\n"
            "\n"
            "Imdanen imezwura ad sɛun tazwirt deg useddu d "
            "tisumirin tuzzigin.\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "title": "Awi-d aẓeṭṭa-inek",
        },
        "waitlist_drip_day3": {
            "badge": "Tabdart n urbaɛi",
            "body": "Amkan-ik deg tebdart n urbaɛi iḥrez. Bḍu "
            "aseqqen-inek udmawan ddaw-a — yal ameddakkel ara "
            "d-ikecmen ad k-yeǧǧ ad taẓed ɣer zdat.",
            "footer": "Ad nemzer mbeɛd,<br><strong>Tarbaɛt n " "Podacium</strong>",
            "heading": "Azul {name},",
            "preheader": "Nebzed 5 n yimeddukklen akken ad tawid "
            "aggur baṭel n Podacium Pro.",
            "referral_button": "Nebzed imeddukklen",
            "referral_info": "Nebzed 5 n yimeddukklen i waggur baṭel "
            "n Podacium Pro !",
            "referral_label": "Aseqqen-inek udmawan :",
            "subject": "Amkan-ik deg unekcum amezwaru n Podacium " "yettraǧu-k",
            "text": "Azul {name},\n"
            "\n"
            "Amkan-ik deg tebdart n urbaɛi iḥrez. Bḍu "
            "aseqqen-ik:\n"
            "\n"
            "https://podacium.com/waitlist?ref={referral_code}\n"
            "\n"
            "Nebzed 5 n yimeddukklen i waggur baṭel n "
            "Podacium Pro!\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "title": "Ur sṛuḥuy ara amkan-ik",
        },
        "waitlist_drip_day30": {
            "badge": "Tabdart n urbaɛi",
            "body": "D wagi i d alɣu-inek aneggaru: lfaydat n "
            "usebded d unekcum amezwaru d wid kan yellan deg "
            "tebdart. Bḍu aseqqen-ik uqbel tazwara.",
            "footer": "Ad nemzer mbeɛd,<br><strong>Tarbaɛt n " "Podacium</strong>",
            "heading": "Azul {name},",
            "preheader": "Amkan-ik d lbaṛakat-ik ur d-qqimen ara i " "lebda.",
            "referral_button": "Nebzed imeddukklen",
            "referral_info": "Nebzed 5 n yimeddukklen i waggur baṭel "
            "n Podacium Pro !",
            "referral_label": "Aseqqen-inek udmawan :",
            "subject": "Alɣu aneggaru — ḥrez lbaṛakat-ik deg " "Podacium",
            "text": "Azul {name},\n"
            "\n"
            "Alɣu aneggaru — lfaydat n usebded d tid n wid "
            "yellan deg tebdart kan:\n"
            "\n"
            "https://podacium.com/waitlist?ref={referral_code}\n"
            "\n"
            "Nebzed 5 n yimeddukklen i waggur baṭel n "
            "Podacium Pro!\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "title": "Alɣu aneggaru",
        },
        "waitlist_drip_day7": {
            "badge": "Tabdart n urbaɛi",
            "body": "Podacium ad yebdu s kraḍ n yiḥricen: tiɣuriwin s "
            "yiselkinen yettwasentmen, ssuq n umahil ilelli s "
            "DZD, d wallalen n BI i tfabrikatin. Yal ta "
            "tettuqqen ɣer yiwen n wagalis.",
            "footer": "Ad nemzer mbeɛd,<br><strong>Tarbaɛt n " "Podacium</strong>",
            "heading": "Azul {name},",
            "preheader": "Tiɣuriwin, amahil ilelli d BI — deg yiwet n " "tansa.",
            "referral_button": "Nebzed imeddukklen",
            "referral_info": "Nebzed 5 n yimeddukklen i waggur baṭel "
            "n Podacium Pro !",
            "referral_label": "Aseqqen-inek udmawan :",
            "subject": "Ayen ara d-yilin d amezwaru deg Podacium",
            "text": "Azul {name},\n"
            "\n"
            "Tiɣuriwin s yiselkinen. Ssuq n umahil ilelli s "
            "DZD. BI i tfabrikatin. Yiwet n tansa, yiwen "
            "wagalis.\n"
            "\n"
            "Bḍu aseqqen-ik:\n"
            "\n"
            "https://podacium.com/waitlist?ref={referral_code}\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "title": "Yettwag i usfari-inek",
        },
        "welcome": {
            "badge": "Ansuf yis-k",
            "bi_cta": "Ldi BI Studio",
            "bi_desc": "Snulfu-d tifelwiyin n yisefka d tmuɣliwin s "
            "wallalen-nneɣ n BI.",
            "bi_title": "Sleḍ isefka",
            "body": "Amiḍan-inek yettwasentem yerna yewjed. Hatan wayen tzemred "
            "ad texdmed akken ad tebduḍ:",
            "heading": "Ansuf, {name}!",
            "hub_cta": "Vali Hub",
            "hub_desc": "Kcem ɣer yisenfaṛen, nermes imahilen ilelliyin, snerni "
            "aẓeṭṭa-inek.",
            "hub_title": "Qen & Mɛawan",
            "learn_cta": "Vali tiɣuriwin",
            "learn_desc": "Kcem ɣer temkarḍit-nneɣ n tɣuriwin deg tussna n "
            "yisefka, AI d BI.",
            "learn_title": "Nadi tiɣuriwin",
            "preheader": "Ansuf ɣer Podacium! Hatan kullec i teḥwaǧed akken ad "
            "tebduḍ.",
            "profile_cta": "Beddel amaɣnu",
            "profile_desc": "Rnu tizemmar-inek, tarmit-inek d tugna n umaɣnu.",
            "profile_title": "Kemmel amaɣnu-inek",
            "subject": "Ansuf ɣer Podacium – Yebda umecwaṛ !",
            "support": "Teḥwaǧed tallalt? Tarbaɛt-nneɣ tella dima ɣer yidis-ik.",
            "support_cta": "Awi tallalt",
            "text": "Azul {name},\n"
            "\n"
            "Ansuf ɣer Podacium! Amiḍan-inek yewjed.\n"
            "\n"
            "Akken ad tebduḍ:\n"
            "- Wali tiɣuriwin deg Data Science, AI d BI\n"
            "- Snulfu-d tifelwiyin s BI Studio\n"
            "- Nermes imahilen ilelliyin deg yisenfaṛen\n"
            "- Kemmel amaɣnu-inek\n"
            "\n"
            "Bdu: {url}\n"
            "Tallalt: {support_url}\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "title": "Ansuf ɣer Podacium !",
        },
        "welcome_d1": {
            "badge": "Tarrayin & Tiḥerciwin",
            "body": "Hatan snat n tarrayin tifsasin ara k-iɛiwnen ad tebduḍ s "
            "tseddi.",
            "heading": "Farḥen yis-k, {name}!",
            "preheader": "Sqedced dduṛt-inek tamezwarut s wudem igerrzen deg "
            "Podacium.",
            "subject": "Tannayt: Asenfaṛ-inek amezwaru deg Podacium",
            "support": "Isteqsiyen? Tarbaɛt-nneɣ tesfarḥ ad k-tɛiwen.",
            "support_cta": "Awi tallalt",
            "text": "Azul {name},\n"
            "\n"
            "Hatan snat n tarrayin i lebdi:\n"
            "- Ṭṭef taɣuri tawezzlant\n"
            "- Kemmel amaɣnu-inek\n"
            "\n"
            "Tiɣuriwin: {url}/learn\n"
            "Amaɣnu: {url}/settings\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "tip1_cta": "Vali tiɣuriwin",
            "tip1_desc": "Bdu s yiwet n tɣuri tawezzlant deg taɣult i " "k-iɛeǧben.",
            "tip1_title": "Ṭṭef taɣuri",
            "tip2_cta": "Kemmel amaɣnu",
            "tip2_desc": "Amaɣnu ummid ad k-iɛiwen ad temsegzud d yimdanen " "iwulfan.",
            "tip2_title": "Seggem amaɣnu-inek",
            "title": "Ass 1 – Tarrayin tifsasin",
        },
        "welcome_d3": {
            "badge": "Tametti",
            "body": "Almad yif-it mi ara d-yili d lǧemɛ. Hatan wamek ara "
            "teqqneḍ ɣer tmetti n Podacium.",
            "community_cta": "Vali tametti",
            "community_desc": "Ttekki deg yidiwenniyen, bḍu tamussni, afeɣ "
            "wid ara k-iɛiwnen.",
            "community_title": "Kcem ɣer tmetti",
            "heading": "Snerni aẓeṭṭa-inek, {name}!",
            "network_cta": "Afeɣ iselmaden",
            "network_desc": "Qen ɣer yimassanen iweznen ara k-yemlen abrid.",
            "network_title": "Afeɣ iselmaden",
            "preheader": "Ur telliḍ ara weḥd-k — qen ɣer yimeddukklen d " "yiselmaden.",
            "subject": "Qen ɣer tmetti n Podacium",
            "support": "Teḥwaǧed tallalt akken ad tafeḍ tametti-inek? " "Nermes-aɣ-d.",
            "support_cta": "Awi tallalt",
            "text": "Azul {name},\n"
            "\n"
            "Qen ɣer tmetti n Podacium:\n"
            "- Ttekki deg yidiwenniyen\n"
            "- Qen ɣer yiselmaden\n"
            "\n"
            "Tametti: {url}/community\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "title": "Ass 3 – Tametti",
        },
        "welcome_d7": {
            "badge": "Tuzzigt",
            "body": "Tɛedda dduṛt seg mi telliḍ yid-nneɣ — hatan wamek ara "
            "tessnerniḍ tarmit-inek.",
            "heading": "Dduṛt tɛedda, {name}!",
            "portal_cta": "Ldi BI Studio",
            "portal_desc": "Bnu tifelwiyin n yisefka timassanin s tmuɣliwin n " "AI.",
            "portal_title": "BI Studio Pro",
            "preheader": "Ldi tazmert tamidagant n Podacium s tmahilin " "tuzzigin.",
            "premium_cta": "Wali tisiyin",
            "premium_desc": "Ldi tiɣuriwin war talast, allalen n BI "
            "imeqqranen d tallalt tazwart.",
            "premium_title": "Kcem ɣer Premium",
            "subject": "Ldi timahilin tuzzigin deg Podacium",
            "support": "Tesɛid isteqsiyen ɣef Premium? Nella da i tallalt.",
            "support_cta": "Awi tallalt",
            "text": "Azul {name},\n"
            "\n"
            "Dduṛt tɛedda! Hatan wamek ara taẓed ɣer zdat:\n"
            "- Beddel ɣer Premium\n"
            "- Nadi allalen n BI\n"
            "\n"
            "Tisiyin: {url}/pricing\n"
            "\n"
            "— Tarbaɛt n Podacium",
            "title": "Ass 7 – Aẓ ɣer zdat",
        },
    },
}


def get_strings(locale: str) -> dict:
    """Get all localized strings for a given locale. Falls back to English."""
    locale = locale or "en"
    return LOCALIZED.get(locale, LOCALIZED["en"])


def _deep_merge_dict(base: dict, override: dict) -> dict:
    """Recursively merge override dictionary into base dictionary.
    Keys present in override take precedence unless value is None or empty string.
    """
    merged = base.copy()
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(merged.get(k), dict):
            merged[k] = _deep_merge_dict(merged[k], v)
        elif v is not None and v != "":
            merged[k] = v
    return merged


def get_email_strings(locale: str, email_type: str) -> dict:
    """Get strings for a specific email type with recursive key-level English fallback."""
    norm_locale = (locale or "en").lower().split("-")[0].split("_")[0]
    if norm_locale not in LOCALIZED:
        norm_locale = "en"

    # Base English structures
    en_shared = LOCALIZED.get("en", {}).get("shared", {})
    en_type_strings = LOCALIZED.get("en", {}).get(email_type, {})

    if norm_locale == "en":
        return {**en_shared, **en_type_strings}

    # Locale structures
    lang_shared = LOCALIZED.get(norm_locale, {}).get("shared", {})
    lang_type_strings = LOCALIZED.get(norm_locale, {}).get(email_type, {})

    # Merge: English defaults overridden by localized strings on a per-key basis
    merged_shared = _deep_merge_dict(en_shared, lang_shared)
    merged_type = _deep_merge_dict(en_type_strings, lang_type_strings)

    return {**merged_shared, **merged_type}
