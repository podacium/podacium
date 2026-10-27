const fs = require("fs");
const path = require("path");

const localesDir = path.resolve(__dirname, "../apps/web/locales");
const locales = ["en", "fr", "ar", "kab"];

const dictionaryAdditions = {
  learn: {
    classroom: {
      arrete1275: {
        en: "Arrêté 1275",
        fr: "Arrêté ministériel 1275",
        ar: "القرار 1275",
        kab: "Asun 1275",
      },
      resetTitle: {
        en: "Reset to starter template",
        fr: "Réinitialiser au modèle de départ",
        ar: "إعادة التعيين إلى النموذج الأولي",
        kab: "Ales ɣer tanafa tamenzut",
      },
      resetBtn: {
        en: "Reset",
        fr: "Réinitialiser",
        ar: "إعادة تعيين",
        kab: "Ales",
      },
      running: {
        en: "Running...",
        fr: "Exécution...",
        ar: "جارٍ التشغيل...",
        kab: "Aselkem...",
      },
      runTests: {
        en: "Run Tests",
        fr: "Exécuter les tests",
        ar: "تشغيل الاختبارات",
        kab: "Selkem ikayaden",
      },
      submitCapstone: {
        en: "Submit Capstone",
        fr: "Soumettre le projet capstone",
        ar: "إرسال المشروع النهائي",
        kab: "Azen asenfar amezwaru",
      },
      exitFullscreen: {
        en: "Exit Fullscreen",
        fr: "Quitter le plein écran",
        ar: "الخروج من ملء الشاشة",
        kab: "Ffeɣ seg ugdil ačuran",
      },
      fullscreen: {
        en: "Fullscreen",
        fr: "Plein écran",
        ar: "ملء الشاشة",
        kab: "Agdil ačuran",
      },
      curriculumMilestone: {
        en: "Curriculum Milestone",
        fr: "Étape du programme",
        ar: "محطة في المنهج التعليمي",
        kab: "Aseqqar n uselmed",
      },
      estimatedEffort: {
        en: "Estimated effort: ~{minutes} minutes",
        fr: "Effort estimé : ~{minutes} minutes",
        ar: "الوقت التقديري: ~{minutes} دقيقة",
        kab: "Azal n wakud: ~{minutes} tesdatin",
      },
      pedagogicalRequirements: {
        en: "Pedagogical Requirements",
        fr: "Exigences pédagogiques",
        ar: "المتطلبات البيداغوجية",
        kab: "Isutar ifedagugiyen",
      },
      progressiveHints: {
        en: "Progressive Hints ({revealed}/3 Unlocked)",
        fr: "Indices progressifs ({revealed}/3 débloqués)",
        ar: "تلميحات تدريجية ({revealed}/3 متاحة)",
        kab: "Tinfusin timazzalin ({revealed}/3 reẓment)",
      },
      unlockNextHint: {
        en: "Unlock Next Hint",
        fr: "Débloquer l'indice suivant",
        ar: "فتح التلميح التالي",
        kab: "Rẓem tanfust d-iteddun",
      },
      hint1Title: {
        en: "Hint 1: Conceptual Strategy",
        fr: "Indice 1 : Stratégie conceptuelle",
        ar: "التلميح 1: الإستراتيجية المفاهيمية",
        kab: "Tanfust 1: Tasertit tamadwant",
      },
      hint2Title: {
        en: "Hint 2: Structural Algorithm",
        fr: "Indice 2 : Algorithme structurel",
        ar: "التلميح 2: الخوارزمية الهيكلية",
        kab: "Tanfust 2: Talɣawit tamessit",
      },
      hint3Title: {
        en: "Hint 3: Solution Architecture",
        fr: "Indice 3 : Architecture de la solution",
        ar: "التلميح 3: بنية الحل البرمجي",
        kab: "Tanfust 3: Tasendast n tifrat",
      },
      stuckPrompt: {
        en: 'Stuck on this capstone? Click "Unlock Next Hint" to reveal progressive scaffolding without spoiling the answer.',
        fr: 'Bloqué sur ce projet ? Cliquez sur "Débloquer l\'indice suivant" pour afficher une aide progressive sans dévoiler la solution.',
        ar: 'هل تواجه صعوبة في هذا المشروع؟ انقر على "فتح التلميح التالي" للحصول على توجيه تدريجي دون كشف الحل.',
        kab: 'Tḥelṣeḍ deg usenfar-agi? Ssed "Rẓem tanfust d-iteddun" i wakken ad twaliḍ tinfusin mebla ma tesrewteḍ tifrat.',
      },
      dragResizeDesc: {
        en: "Drag to resize problem description width",
        fr: "Faites glisser pour redimensionner la description",
        ar: "اسحب لتعديل عرض وصف المسألة",
        kab: "Zuɣer i wakken ad tbeddleḍ tehri n uglam",
      },
      pythonSandboxed: {
        en: "(Python 3.11 • Sandboxed)",
        fr: "(Python 3.11 • Bac à sable)",
        ar: "(بايثون 3.11 • بيئة معزولة)",
        kab: "(Python 3.11 • Aglawan yemxallafen)",
      },
      copyCode: {
        en: "Copy code to clipboard",
        fr: "Copier le code dans le presse-papiers",
        ar: "نسخ الرمز البرمجي إلى الحافظة",
        kab: "Nɣel tangalt ɣer tseddast",
      },
      copied: {
        en: "Copied",
        fr: "Copié",
        ar: "تم النسخ",
        kab: "Yettwanɣel",
      },
      copy: {
        en: "Copy",
        fr: "Copier",
        ar: "نسخ",
        kab: "Nɣel",
      },
      dragResizeEditor: {
        en: "Drag to resize editor and console heights",
        fr: "Faites glisser pour redimensionner l'éditeur et la console",
        ar: "اسحب لتعديل ارتفاع المحرر ووحدة التحكم",
        kab: "Zuɣer i wakken ad tbeddleḍ tiddi n umaẓrag",
      },
      testCases: {
        en: "Test Cases ({passed}/{total})",
        fr: "Cas de test ({passed}/{total})",
        ar: "حالات الاختبار ({passed}/{total})",
        kab: "Ikayaden ({passed}/{total})",
      },
      xtermOutput: {
        en: "xterm Output",
        fr: "Sortie xterm",
        ar: "مخرجات xterm",
        kab: "Uffiɣ n xterm",
      },
      sandboxMetrics: {
        en: "Sandbox Metrics",
        fr: "Métriques du bac à sable",
        ar: "مقاييس البيئة المعزولة",
        kab: "Isektiyen n uselkem",
      },
      antiCheatActive: {
        en: "Anti-Cheat Active",
        fr: "Anti-triche actif",
        ar: "نظام منع الغش نشط",
        kab: "Aseḥbiber mgal tukerḍa urmisen",
      },
      testItem: {
        en: "Test {index}: {name}",
        fr: "Test {index} : {name}",
        ar: "اختبار {index}: {name}",
        kab: "Akayad {index}: {name}",
      },
      executionLatency: {
        en: "Execution Latency",
        fr: "Latence d'exécution",
        ar: "زمن استجابة التنفيذ",
        kab: "Akud n uselkem",
      },
      latencyTarget: {
        en: "Target: < 500ms • FastAPI Event Loop Unblocked",
        fr: "Objectif : < 500ms • Boucle d'événements FastAPI débloquée",
        ar: "الهدف: < 500 ملي ثانية • حلقة أحداث FastAPI غير محجوبة",
        kab: "Aswir: < 500ms • Tasut n FastAPI tebded",
      },
      memoryQuota: {
        en: "{memory} MB / 128 MB",
        fr: "{memory} Mo / 128 Mo",
        ar: "{memory} م.ب / 128 م.ب",
        kab: "{memory} MAT / 128 MAT",
      },
      cgroupsQuota: {
        en: "Cgroups v2 isolated sandbox quota",
        fr: "Quota bac à sable isolé Cgroups v2",
        ar: "حصة البيئة المعزولة Cgroups v2",
        kab: "Aselkem n Cgroups v2 yemxallafen",
      },
      astWinnowing: {
        en: "AST Winnowing Plagiarism Check",
        fr: "Vérification de plagiat par fenêtrage AST",
        ar: "فحص الانتحال عبر تحليل شجرة النحو (AST Winnowing)",
        kab: "Akayad n tukerḍa s uselken AST",
      },
      similarityPercent: {
        en: "{similarity}% Similarity",
        fr: "{similarity}% de similarité",
        ar: "{similarity}% نسبة التشابه",
        kab: "{similarity}% n tmeyyift",
      },
      mossHashes: {
        en: "MOSS sliding-window hashes (Pass threshold: < 85%)",
        fr: "Hachages de fenêtres glissantes MOSS (Seuil de réussite : < 85%)",
        ar: "تجزئة النوافذ المنزلقة MOSS (حد النجاح: < 85%)",
        kab: "Isallen n MOSS (Asɣel n ukemmel: < 85%)",
      },
      credentialStatus: {
        en: "W3C Credential Status",
        fr: "Statut du justificatif W3C",
        ar: "حالة شهادة اعتماد W3C",
        kab: "Addad n uselkin W3C",
      },
      eligibleBadge: {
        en: "Eligible for Open Badge v3",
        fr: "Éligible pour Open Badge v3",
        ar: "مؤهل للحصول على شارة Open Badge v3",
        kab: "Yuklal Open Badge v3",
      },
      pendingTests: {
        en: "Pending Tests",
        fr: "Tests en attente",
        ar: "الاختبارات قيد الانتظار",
        kab: "Ikayaden ttraǧun",
      },
      startupPassportReady: {
        en: "MESRS Arrêté 1275 startup passport ready",
        fr: "Passeport startup MESRS Arrêté 1275 prêt",
        ar: "جواز المؤسسة الناشئة (القرار 1275 MESRS) جاهز",
        kab: "Apaspuṛ n tnezzut MESRS Asun 1275 yewjed",
      },
    },
    video: {
      player: {
        availableOffline: {
          en: "Available Offline",
          fr: "Disponible hors ligne",
          ar: "متاح دون اتصال",
          kab: "Yella mebla internet",
        },
        videoPlayerAria: {
          en: "Video Player",
          fr: "Lecteur vidéo",
          ar: "مشغل الفيديو",
          kab: "Ameɣri n uvidyu",
        },
        tamperAlert: {
          en: "Tamper Alert: Playback Suspended",
          fr: "Alerte de sécurité : lecture suspendue",
          ar: "تنبيه أمان: تم تعليق تشغيل الفيديو",
          kab: "Alɣu n tɣellist: aḥbas n tɣuri",
        },
      },
      uploader: {
        tusHeader: {
          en: "TUS v1.0.0 Resumable Upload with Multi-CDN Transcoding Ladder",
          fr: "Téléversement réversible TUS v1.0.0 avec échelle de transcodage Multi-CDN",
          ar: "رفع قابل للاستئناف TUS v1.0.0 مع شبكة تشفير متعددة CDN",
          kab: "Asali TUS v1.0.0 i zemren ad ikemmel s Multi-CDN",
        },
        supportedFormats: {
          en: "MP4, MOV, WebM, MKV up to 5 GB • Resumable on Algerian 4G LTE",
          fr: "MP4, MOV, WebM, MKV jusqu'à 5 Go • Reprise sur 4G LTE algérienne",
          ar: "صيغ MP4، MOV، WebM، MKV حتى 5 جيغابايت • قابل للاستئناف عبر 4G الجزائري",
          kab: "MP4, MOV, WebM, MKV ar 5 GB • Yettkemmil ɣef 4G n Lezzayer",
        },
        startUpload: {
          en: "Start Resumable Upload ({provider})",
          fr: "Démarrer le téléversement réversible ({provider})",
          ar: "بدء الرفع القابل للاستئناف ({provider})",
          kab: "Bdu asali ({provider})",
        },
        resumeUpload: {
          en: "Resume Upload",
          fr: "Reprendre le téléversement",
          ar: "استئناف الرفع",
          kab: "Kemmel asali",
        },
        pauseUpload: {
          en: "Pause Upload",
          fr: "Suspendre le téléversement",
          ar: "إيقاف الرفع مؤقتًا",
          kab: "Sbedd asali",
        },
        paused: {
          en: "Paused",
          fr: "En pause",
          ar: "متوقف مؤقتًا",
          kab: "Yebded",
        },
        speed: {
          en: "Speed: {speed}",
          fr: "Vitesse : {speed}",
          ar: "السرعة: {speed}",
          kab: "Arured: {speed}",
        },
        chunk: {
          en: "Chunk {current}/{total}",
          fr: "Bloc {current}/{total}",
          ar: "الجزء {current}/{total}",
          kab: "Aḥric {current}/{total}",
        },
        retryBackoff: {
          en: "Carrier connection drop detected. Retrying with exponential backoff (attempt {attempt})",
          fr: "Coupure réseau détectée. Nouvelle tentative avec repli exponentiel (tentative {attempt})",
          ar: "تم اكتشاف انقطاع اتصال الشبكة. إعادة المحاولة مع تأخير أسي (محاولة {attempt})",
          kab: "Tebded tdukli n uẓeṭṭa. Aɛraweḍ s ukud (armud {attempt})",
        },
      },
    },
  },
  component: {
    copilot: {
      container: {
        openAria: {
          en: "Open Podacium Copilot",
          fr: "Ouvrir Podacium Copilot",
          ar: "فتح مساعد بوداسيوم",
          kab: "Ldi Podacium Copilot",
        },
        title: {
          en: "Podacium Copilot",
          fr: "Copilote Podacium",
          ar: "مساعد بوداسيوم الذكي",
          kab: "Amɛawen Podacium",
        },
        geminiVersion: {
          en: "Gemini 2.5",
          fr: "Modèle Gemini 2.5",
          ar: "جيميني 2.5",
          kab: "Alɣu Gemini 2.5",
        },
        agentSafety: {
          en: "Autonomous Agent & HITL Safety",
          fr: "Agent autonome & Sécurité HITL",
          ar: "وكيل ذكي مستقل مع حماية المراجعة البشرية (HITL)",
          kab: "Aɣersiw amagan & Taɣellist HITL",
        },
        expandAria: {
          en: "Expand to full composer",
          fr: "Agrandir le compositeur",
          ar: "توسيع إلى محرر كامل",
          kab: "Semɣer ɣer umsegraw ačuran",
        },
        dockRightSideAria: {
          en: "Dock to right side",
          fr: "Ancrer à droite",
          ar: "تثبيت في الجانب الأيمن",
          kab: "Sbedd ɣer uyeffus",
        },
        dockRightAria: {
          en: "Dock to right",
          fr: "Ancrer à droite",
          ar: "تثبيت لليمين",
          kab: "Kmes ɣer uyeffus",
        },
        floatingBubbleAria: {
          en: "Switch to floating bubble",
          fr: "Passer à la bulle flottante",
          ar: "التبديل إلى النافذة العائمة",
          kab: "Snifel ɣer tfulit tettferfuren",
        },
        closeAria: {
          en: "Close copilot",
          fr: "Fermer le copilote",
          ar: "إغلاق المساعد",
          kab: "Mdel amɛawen",
        },
        copied: {
          en: "Copied",
          fr: "Copié",
          ar: "تم النسخ",
          kab: "Yettwanɣel",
        },
      },
      composer: {
        removeEntityAria: {
          en: "Remove {label}",
          fr: "Supprimer {label}",
          ar: "إزالة {label}",
          kab: "Kkes {label}",
        },
        contextEntities: {
          en: "Context Entities",
          fr: "Entités contextuelles",
          ar: "كيانات السياق",
          kab: "Tifekkiwin n usekkir",
        },
        attachContextTitle: {
          en: "Attach entity context (@)",
          fr: "Attacher un contexte d'entité (@)",
          ar: "إرفاق سياق الكيان (@)",
          kab: "Senteḍ asatal n tfekka (@)",
        },
      },
      hitl: {
        action: {
          replayError: {
            en: "Action replay prevented: This action token has already been executed or has expired.",
            fr: "Rejeu d'action empêché : ce jeton d'action a déjà été exécuté ou a expiré.",
            ar: "تم منع إعادة الإجراء: تم تنفيذ رمز الإجراء مسبقًا أو انتهت صلاحيته.",
            kab: "Ales n tigawt yebded: aselkin-agi yettwaselkem neɣ yemmut.",
          },
          confirmationRequired: {
            en: "Confirmation Required: {toolName}",
            fr: "Confirmation requise : {toolName}",
            ar: "تأكيد مطلوب: {toolName}",
            kab: "Asentem yettwasuter: {toolName}",
          },
          intentHash: {
            en: "Intent #{id}",
            fr: "Intention n°{id}",
            ar: "النية رقم {id}",
            kab: "Iswi umḍin {id}",
          },
          proposedChangesTitle: {
            en: "Proposed State Changes",
            fr: "Changements d'état proposés",
            ar: "تغييرات الحالة المقترحة",
            kab: "Ibeddilen n waddad i d-yettwasumren",
          },
          actionApproved: {
            en: "Action approved & executed with cryptographic nonce verification.",
            fr: "Action approuvée et exécutée avec vérification cryptographique du nonce.",
            ar: "تمت الموافقة على الإجراء وتنفيذه مع التحقق التشفيري.",
            kab: "Tigawt tettwaqbel u tettwaselkem s tɣellist.",
          },
          actionRejected: {
            en: "Action was rejected by user. No mutations were applied.",
            fr: "L'action a été rejetée par l'utilisateur. Aucune modification appliquée.",
            ar: "تم رفض الإجراء من طرف المستخدم. لم يتم تطبيق أي تعديلات.",
            kab: "Tigawt teggiḍ-tt. Ulac ibeddilen i yettwaxedmen.",
          },
          rejectBtn: {
            en: "Reject / Edit Parameters",
            fr: "Rejeter / Modifier les paramètres",
            ar: "رفض / تعديل المعلمات",
            kab: "Aggi / Beddel tiwila",
          },
          approveBtn: {
            en: "Approve & Execute",
            fr: "Approuver et exécuter",
            ar: "موافقة وتنفيذ",
            kab: "Qbel u selkem",
          },
        },
        diff: {
          splitViewAria: {
            en: "Split view",
            fr: "Vue scindée",
            ar: "عرض منقسم",
            kab: "Tamuɣli ibeḍlen",
          },
          split: {
            en: "Split",
            fr: "Scindé",
            ar: "منقسم",
            kab: "Ibeḍlen",
          },
          unifiedViewAria: {
            en: "Unified view",
            fr: "Vue unifiée",
            ar: "عرض موحد",
            kab: "Tamuɣli d yiwet",
          },
          unified: {
            en: "Unified",
            fr: "Unifié",
            ar: "موحد",
            kab: "D yiwet",
          },
          before: {
            en: "Before",
            fr: "Avant",
            ar: "قبل",
            kab: "Uqbel",
          },
          after: {
            en: "After",
            fr: "Après",
            ar: "بعد",
            kab: "Deffir",
          },
        },
      },
    },
  },
  docs: {
    developer: {
      portal: {
        badgePlatform: {
          en: "Developer Platform",
          fr: "Plateforme Développeur",
          ar: "منصة المطورين",
          kab: "Asalay n inefkaren",
        },
        badgeLayer13: {
          en: "Layer 13 Enterprise",
          fr: "Couche 13 Entreprise",
          ar: "الطبقة 13 للمؤسسات",
          kab: "Aswir 13 n tkebbaniyin",
        },
        apiDocs: {
          en: "API Documentation",
          fr: "Documentation de l'API",
          ar: "توثيق واجهة البرمجة (API)",
          kab: "Aglam n API",
        },
        apiKeysTitle: {
          en: "API Keys",
          fr: "Clés d'API",
          ar: "مفاتيح API",
          kab: "Tisarutin n API",
        },
        apiKeysDesc: {
          en: "Authenticate server-to-server requests using Bearer tokens with strict domain scopes.",
          fr: "Authentifiez les requêtes de serveur à serveur à l'aide de jetons Bearer avec des portées de domaine strictes.",
          ar: "مصادقة الطلبات بين الخوادم باستخدام رموز Bearer مع نطاقات صلاحيات دقيقة.",
          kab: "Sented tuttriwin n uselkam s Bearer tokens d tsertiyin teqqen.",
        },
        createApiKey: {
          en: "Create API Key",
          fr: "Créer une clé API",
          ar: "إنشاء مفتاح API جديد",
          kab: "Snulfu tasarut n API",
        },
        badgeActive: {
          en: "Active",
          fr: "Actif",
          ar: "نشط",
          kab: "Irmad",
        },
        badgeRotationGrace: {
          en: "Rotation Grace Active",
          fr: "Période de grâce de rotation active",
          ar: "فترة السماح بالتدوير نشطة",
          kab: "Tallit n usenfel termad",
        },
        badgeRevoked: {
          en: "Revoked",
          fr: "Révoqué",
          ar: "ملغى",
          kab: "Yettwakkes",
        },
        copyMaskedKey: {
          en: "Copy Masked Key",
          fr: "Copier la clé masquée",
          ar: "نسخ المفتاح المقنع",
          kab: "Nɣel tasarut yeffren",
        },
        graceWindow: {
          en: "Grace Window: 6d 21h left",
          fr: "Délai de grâce : 6j 21h restants",
          ar: "فترة السماح: متبقي 6 أيام و21 ساعة",
          kab: "Tallit n uraju: d-yeqqim 6w 21s",
        },
        quickstart: {
          en: "Quickstart",
          fr: "Démarrage rapide",
          ar: "البدء السريع",
          kab: "Tazwara tuzribt",
        },
        rotateKey: {
          en: "Rotate Key",
          fr: "Faire pivoter la clé",
          ar: "تدوير المفتاح",
          kab: "Zzi tasarut",
        },
        revokeKey: {
          en: "Revoke",
          fr: "Révoquer",
          ar: "إلغاء الصلاحية",
          kab: "Kkes tasarut",
        },
        deliveriesTitle: {
          en: "Standard Webhooks Deliveries",
          fr: "Livraisons Standard Webhooks",
          ar: "عمليات تسليم Webhooks المعيارية",
          kab: "Asali n Standard Webhooks",
        },
        deliveriesDesc: {
          en: "Real-time delivery log conforming to Standard Webhooks spec (webhook-id, webhook-timestamp, webhook-signature).",
          fr: "Journal de livraison en temps réel conforme aux spécifications Standard Webhooks (webhook-id, webhook-timestamp, webhook-signature).",
          ar: "سجل التسليم الفوري المتوافق مع معيار Webhooks (المعرف، الطابع الزمني، التوقيع الرقمي).",
          kab: "Aɣmis n usali deg wakud n tidet s lqanun n Standard Webhooks.",
        },
        dispatchTest: {
          en: "Dispatch Test Event",
          fr: "Envoyer un événement de test",
          ar: "إرسال حدث تجريبي",
          kab: "Azen asari n ukayad",
        },
        svixCompliant: {
          en: "Svix Standard V1 Compliant",
          fr: "Conforme au standard Svix V1",
          ar: "متوافق مع معيار Svix V1",
          kab: "Iquder aswir n Svix V1",
        },
        thStatus: {
          en: "Status",
          fr: "Statut",
          ar: "الحالة",
          kab: "Addad",
        },
        thEventType: {
          en: "Event Type",
          fr: "Type d'événement",
          ar: "نوع الحدث",
          kab: "Anaw n usari",
        },
        thDuration: {
          en: "Duration",
          fr: "Durée",
          ar: "المدة",
          kab: "Tallit",
        },
        thTimestamp: {
          en: "Timestamp (UTC)",
          fr: "Horodatage (UTC)",
          ar: "الطابع الزمني (UTC)",
          kab: "Akud (UTC)",
        },
        thAction: {
          en: "Action",
          fr: "Action",
          ar: "الإجراء",
          kab: "Tigawt",
        },
        inspectBtn: {
          en: "Inspect",
          fr: "Inspecter",
          ar: "معاينة",
          kab: "Sseqqed",
        },
        createModalTitle: {
          en: "Create Scoped API Key",
          fr: "Créer une clé API avec portée",
          ar: "إنشاء مفتاح API محدد الصلاحيات",
          kab: "Snulfu tasarut n API s usekkir",
        },
        createModalDesc: {
          en: "Generate a high-security server API key with granular domain permissions.",
          fr: "Générez une clé API de serveur haute sécurité avec des autorisations de domaine granulaires.",
          ar: "إنشاء مفتاح خادم عالي الأمان مع أذونات دقيقة للنطاقات.",
          kab: "Snekmu tasarut n usekkar s tɣellist tameqqrant.",
        },
        keyNameLabel: {
          en: "Key Name / Description",
          fr: "Nom de la clé / Description",
          ar: "اسم المفتاح / الوصف",
          kab: "Isem n tsarut / Aglam",
        },
        keyNamePlaceholder: {
          en: "e.g. Oran Campus ERP Integration",
          fr: "ex. Intégration ERP Campus d'Oran",
          ar: "مثال: ربط نظام ERP لجامعة وهران",
          kab: "Amedya: Azeddi ERP n Wehran",
        },
        scopesLabel: {
          en: "Granular Scopes & Permissions",
          fr: "Portées et autorisations granulaires",
          ar: "نطاقات الصلاحيات والأذونات",
          kab: "Isutar d tewwura timuxalifin",
        },
        cancelBtn: {
          en: "Cancel",
          fr: "Annuler",
          ar: "إلغاء",
          kab: "Semmet",
        },
        generateBtn: {
          en: "Generate Key",
          fr: "Générer la clé",
          ar: "توليد المفتاح",
          kab: "Snulfu tasarut",
        },
        secretModalTitle: {
          en: "Copy Your API Secret Key",
          fr: "Copiez votre clé secrète d'API",
          ar: "انسخ مفتاح API السري الخاص بك",
          kab: "Nɣel tasarut-ik tuffirt n API",
        },
        secretModalDesc: {
          en: "Make sure to copy your API key now. You will not be able to see it again!",
          fr: "Assurez-vous de copier votre clé API maintenant. Vous ne pourrez plus la revoir !",
          ar: "تأكد من نسخ مفتاحك الآن، فلن تتمكن من رؤيته مرة أخرى!",
          kab: "Ḍmen ad tenɣleḍ tasarut-ik tura. Ur tettizriḍ ara tikkelt nniḍen!",
        },
        securityWarning: {
          en: "Security Warning",
          fr: "Avertissement de sécurité",
          ar: "تحذير أمني",
          kab: "Alɣu n tɣellist",
        },
        securityWarningText: {
          en: "This token carries authorization for the scopes you selected. Store it in an environment secret or encrypted vault. Podacium only stores the SHA-256 hash.",
          fr: "Ce jeton porte l'autorisation pour les portées que vous avez sélectionnées. Conservez-le dans un coffre-fort chiffré. Podacium ne conserve que le hachage SHA-256.",
          ar: "يحمل هذا الرمز تفويضًا بالصلاحيات التي اخترتها. احفظه في خزينة مشفرة، فبوداسيوم يحفظ فقط تجزئة SHA-256.",
          kab: "Aselkin-agi yeṭṭef tisuraf i textareḍ. Ḥrez-it deg uḥuddu iqudren. Podacium yeṭṭef kan SHA-256 hash.",
        },
        copiedToClipboard: {
          en: "Copied to clipboard!",
          fr: "Copié dans le presse-papiers !",
          ar: "تم النسخ إلى الحافظة!",
          kab: "Yettwanɣel ɣer tseddast!",
        },
        clickCopyPrompt: {
          en: "Click copy before closing",
          fr: "Cliquez sur copier avant de fermer",
          ar: "انقر نسخ قبل الإغلاق",
          kab: "Ssed nɣel uqbel ad tmedleḍ",
        },
        copiedBtn: {
          en: "Copied",
          fr: "Copié",
          ar: "تم النسخ",
          kab: "Yettwanɣel",
        },
        copyKeyBtn: {
          en: "Copy Key",
          fr: "Copier la clé",
          ar: "نسخ المفتاح",
          kab: "Nɣel tasarut",
        },
        doneBtn: {
          en: "Done",
          fr: "Terminé",
          ar: "تم",
          kab: "Yekfa",
        },
        inspectorTitle: {
          en: "Delivery Inspector",
          fr: "Inspecteur de livraison",
          ar: "فاحص عمليات التسليم",
          kab: "Aseqqad n usali",
        },
        httpStatusLabel: {
          en: "HTTP Status",
          fr: "Statut HTTP",
          ar: "رمز استجابة HTTP",
          kab: "Addad HTTP",
        },
        latencyLabel: {
          en: "Latency",
          fr: "Latence",
          ar: "زمن الاستجابة",
          kab: "Akud n uraju",
        },
        deliveredAtLabel: {
          en: "Delivered At",
          fr: "Livré à",
          ar: "تاريخ ووقت التسليم",
          kab: "Yessawed deg",
        },
        headersTitle: {
          en: "Standard Webhooks Headers",
          fr: "En-têtes Standard Webhooks",
          ar: "ترويسات Webhooks القياسية",
          kab: "Iqeṛṛay n Standard Webhooks",
        },
        payloadTitle: {
          en: "Dispatched JSON Payload",
          fr: "Charge utile JSON envoyée",
          ar: "حمولة بيانات JSON المرسلة",
          kab: "Afaris JSON yettwaznen",
        },
        upstreamResponseTitle: {
          en: "Upstream Response Body",
          fr: "Corps de la réponse amont",
          ar: "نص استجابة الخادم الوجهة",
          kab: "Tiririt n usekkir",
        },
        resendSuccess: {
          en: "Resend Succeeded (200 OK)",
          fr: "Renvoi réussi (200 OK)",
          ar: "تمت إعادة الإرسال بنجاح (200 OK)",
          kab: "Tulsa n tuzna terbeḥ (200 OK)",
        },
        resending: {
          en: "Resending...",
          fr: "Renvoi en cours...",
          ar: "جارٍ إعادة الإرسال...",
          kab: "Tulsa n tuzna...",
        },
        resendPayload: {
          en: "Resend Payload",
          fr: "Renvoyer la charge utile",
          ar: "إعادة إرسال البيانات",
          kab: "Ales tuzna n ufaris",
        },
        quickstartTitle: {
          en: "SDK Quickstart: {name}",
          fr: "Démarrage rapide du SDK : {name}",
          ar: "البدء السريع مع حزمة SDK: {name}",
          kab: "Tazwara tuzribt n SDK: {name}",
        },
        quickstartDesc: {
          en: "Copy production-ready integration code snippets for your preferred language runtime.",
          fr: "Copiez des extraits de code d'intégration prêts pour la production pour votre langage préféré.",
          ar: "انسخ نماذج التعليمات البرمجية الجاهزة للإنتاج للغتك المفضلة.",
          kab: "Nɣel tanafa n tengalt i d-yewjden i usekkar-ik.",
        },
        closeBtn: {
          en: "Close",
          fr: "Fermer",
          ar: "إغلاق",
          kab: "Mdel",
        },
        dispatchModalTitle: {
          en: "Dispatch Test Webhook Event",
          fr: "Envoyer un événement Webhook de test",
          ar: "إرسال حدث Webhook تجريبي",
          kab: "Azen asari n ukayad n Webhook",
        },
        dispatchModalDesc: {
          en: "Simulate an instant event dispatch with Standard Webhooks cryptographic signing.",
          fr: "Simulez l'envoi instantané d'un événement avec signature cryptographique Standard Webhooks.",
          ar: "محاكاة إرسال حدث فوري مع التوقيع التشفيري القياسي لـ Webhooks.",
          kab: "Azen asari uzrib s uzmul n tɣellist n Webhooks.",
        },
        eventTypeLabel: {
          en: "Event Type",
          fr: "Type d'événement",
          ar: "نوع الحدث",
          kab: "Anaw n usari",
        },
        destinationUrlLabel: {
          en: "Destination Webhook URL",
          fr: "URL du Webhook de destination",
          ar: "رابط URL لوجهة Webhook",
          kab: "Tansa URL n Webhook",
        },
        dispatchedSuccess: {
          en: "Standard Webhook Dispatched (200 OK)",
          fr: "Webhook standard envoyé (200 OK)",
          ar: "تم إرسال Webhook القياسي بنجاح (200 OK)",
          kab: "Standard Webhook yettwazen (200 OK)",
        },
        dispatchMockBtn: {
          en: "Dispatch Mock Event",
          fr: "Envoyer l'événement simulé",
          ar: "إرسال الحدث المحاكى",
          kab: "Azen asari amedya",
        },
      },
      workflows: {
        builder: {
          cycleAlert: {
            en: "Cannot execute workflow with cyclic dependencies. Please resolve cycle first.",
            fr: "Impossible d'exécuter un flux contenant des dépendances cycliques. Veuillez d'abord résoudre la boucle.",
            ar: "لا يمكن تنفيذ سير العمل الذي يحتوي على تبعيات دائرية. يرجى حل الدورة أولاً.",
            kab: "Ur tezmireḍ ara ad tselkmeḍ asenfar s tuzzya. Fren tuzzya uqbel.",
          },
          invalidJsonAlert: {
            en: "Invalid workflow DAG JSON file format.",
            fr: "Format de fichier JSON de DAG de flux non valide.",
            ar: "تنسيق ملف JSON لمخطط التدفق (DAG) غير صالح.",
            kab: "Talɣa n ufaylu JSON n DAG ur teṣliḥ ara.",
          },
          orchestratorTitle: {
            en: "Automated Workflow DAG Orchestrator",
            fr: "Orchestrateur DAG de flux automatisés",
            ar: "منسق مخطط التدفق (DAG) لسير العمل الآلي",
            kab: "Amsuddes n ifarisen n DAG s wudem awurman",
          },
          orchestratorDesc: {
            en: "Build event-driven pipelines with Extism WebAssembly transformations and Standard Webhooks.",
            fr: "Créez des pipelines basés sur les événements avec des transformations WebAssembly Extism et des Standard Webhooks.",
            ar: "بناء خطوط معالجة معتمدة على الأحداث باستخدام تحويلات WebAssembly وWebhooks القياسية.",
            kab: "Bnu ibriden s isurifen n Extism WebAssembly d Standard Webhooks.",
          },
          exportJsonTitle: {
            en: "Export DAG to JSON",
            fr: "Exporter le DAG en JSON",
            ar: "تصدير المخطط إلى ملف JSON",
            kab: "Sifeḍ DAG ɣer JSON",
          },
          exportJsonBtn: {
            en: "Export JSON",
            fr: "Exporter JSON",
            ar: "تصدير JSON",
            kab: "Sifeḍ JSON",
          },
          importJsonTitle: {
            en: "Import DAG from JSON",
            fr: "Importer le DAG depuis JSON",
            ar: "استيراد المخطط من ملف JSON",
            kab: "Kter DAG seg JSON",
          },
          importJsonBtn: {
            en: "Import JSON",
            fr: "Importer JSON",
            ar: "استيراد JSON",
            kab: "Kter JSON",
          },
          dryRunBtn: {
            en: "Dry-Run Pipeline",
            fr: "Test à blanc du pipeline",
            ar: "تشغيل تجريبي لخط المعالجة",
            kab: "Akayad n ubrid mebla aselkem",
          },
          deployBtn: {
            en: "Deploy Workflow",
            fr: "Déployer le flux",
            ar: "نشر سير العمل",
            kab: "Sers asenfar n uxeddim",
          },
        },
        canvas: {
          connectInputTitle: {
            en: "Connect input",
            fr: "Connecter l'entrée",
            ar: "ربط المدخل",
            kab: "Qqen anekcum",
          },
          dragConnectTitle: {
            en: "Drag to connect next step",
            fr: "Faites glisser pour connecter l'étape suivante",
            ar: "اسحب لربط الخطوة التالية",
            kab: "Zuɣer i wakken ad teqqneḍ asurif d-iteddun",
          },
          addTrigger: {
            en: "+ Trigger",
            fr: "+ Déclencheur",
            ar: "+ مشغل حدث",
            kab: "+ Anekcum",
          },
          addAction: {
            en: "+ Action",
            fr: "+ Ajouter une action",
            ar: "+ إجراء",
            kab: "+ Tigawt",
          },
          addWasm: {
            en: "+ Wasm Step",
            fr: "+ Étape Wasm",
            ar: "+ خطوة Wasm",
            kab: "+ Asurif Wasm",
          },
          addLogic: {
            en: "+ Logic",
            fr: "+ Logique",
            ar: "+ شرط منطقي",
            kab: "+ Tameẓla",
          },
          cycleDetected: {
            en: "Cycle Detected! Infinite loop prevented",
            fr: "Cycle détecté ! Boucle infinie évitée",
            ar: "تم اكتشاف دورة دائرية! تم تفادي التكرار اللانهائي",
            kab: "Tuzzya tettwazra! Tuzzya ur nfuk tettwaḥbes",
          },
          dagVerified: {
            en: "DAG Verified: Acyclic (O(V+E))",
            fr: "DAG vérifié : Acyclique (O(V+E))",
            ar: "تم التحقق من المخطط: لا حلقي (O(V+E))",
            kab: "DAG yettwasenqed: Acyclique (O(V+E))",
          },
          zoomInTitle: {
            en: "Zoom In",
            fr: "Zoomer",
            ar: "تكبير",
            kab: "Semɣer",
          },
          zoomOutTitle: {
            en: "Zoom Out",
            fr: "Dézoomer",
            ar: "تصغير",
            kab: "Semẓi",
          },
          resetViewTitle: {
            en: "Reset View",
            fr: "Réinitialiser la vue",
            ar: "إعادة ضبط العرض",
            kab: "Ales tamuɣli",
          },
        },
        logs: {
          outputTitle: {
            en: "Execution Output & Live Logs",
            fr: "Sortie d'exécution & Journaux en direct",
            ar: "مخرجات التنفيذ وسجلات النظام المباشرة",
            kab: "Uffiɣ n uselkem d iɣmisen n wakud n tidet",
          },
          clearBtn: {
            en: "Clear",
            fr: "Effacer",
            ar: "مسح",
            kab: "Sfeḍ",
          },
          executing: {
            en: "Executing...",
            fr: "Exécution...",
            ar: "جارٍ التنفيذ...",
            kab: "Aselkem...",
          },
          testWorkflow: {
            en: "Test Workflow",
            fr: "Tester le flux",
            ar: "اختبار سير العمل",
            kab: "Akayad n usenfar",
          },
          noLogs: {
            en: 'No execution logs yet. Click "Test Workflow" to dry-run the DAG pipeline.',
            fr: 'Aucun journal d\'exécution pour le moment. Cliquez sur "Tester le flux" pour tester le pipeline DAG.',
            ar: 'لا توجد سجلات تنفيذ حتى الآن. انقر على "اختبار سير العمل" لإجراء تشغيل تجريبي.',
            kab: 'Ulac iɣmisen n uselkem tura. Ssed "Akayad n usenfar" i wakken ad tɛerḍeḍ abrid n DAG.',
          },
        },
        drawer: {
          configureStep: {
            en: "Configure Step",
            fr: "Configurer l'étape",
            ar: "تكوين الخطوة",
            kab: "Swel asurif",
          },
          closeDrawerAria: {
            en: "Close drawer",
            fr: "Fermer le panneau",
            ar: "إغلاق اللوحة",
            kab: "Mdel afur",
          },
          stepName: {
            en: "Step Name",
            fr: "Nom de l'étape",
            ar: "اسم الخطوة",
            kab: "Isem n usurif",
          },
          stepNamePlaceholder: {
            en: "e.g. Dispatch Contract Webhook",
            fr: "ex. Envoi de webhook de contrat",
            ar: "مثال: إرسال إشعار العقد عبر Webhook",
            kab: "Amedya: Azen Webhook n ukaṛṭi",
          },
          triggerEvent: {
            en: "Trigger Event",
            fr: "Événement déclencheur",
            ar: "الحدث المشغل",
            kab: "Asari n unekcum",
          },
          contractCreated: {
            en: "Contract Created",
            fr: "Contrat créé",
            ar: "تم إنشاء العقد",
            kab: "Akaṛṭi yettwaxdem",
          },
          paymentReceived: {
            en: "Payment Received (Chargily / EDAHABIA)",
            fr: "Paiement reçu (Chargily / EDAHABIA)",
            ar: "تم استلام الدفعة (شارجيلي / البطاقة الذهبية)",
            kab: "Afaris yettwaqbel (Chargily / EDAHABIA)",
          },
          courseCompleted: {
            en: "Course Completed",
            fr: "Formation terminée",
            ar: "تم إكمال الدورة",
            kab: "Tamsirt tekfa",
          },
          actionType: {
            en: "Action Type",
            fr: "Type d'action",
            ar: "نوع الإجراء",
            kab: "Anaw n tigawt",
          },
          standardWebhookOption: {
            en: "Standard Webhook (HTTP POST)",
            fr: "Webhook standard (HTTP POST)",
            ar: "Webhook قياسي (HTTP POST)",
            kab: "Asenfal Webhook amagnu (HTTP POST)",
          },
          wasmTransformOption: {
            en: "Extism Wasm Sandboxed Transform",
            fr: "Transformation Wasm isolée Extism",
            ar: "تحويل برمجيات Wasm المعزولة (Extism)",
            kab: "Asenfel n Wasm s Extism",
          },
          whatsappAlertOption: {
            en: "Send WhatsApp Alert (Concierge)",
            fr: "Envoyer une alerte WhatsApp (Concierge)",
            ar: "إرسال تنبيه عبر واتساب (الكونسيرج)",
            kab: "Azen alɣu n WhatsApp (Concierge)",
          },
          anaeInvoiceOption: {
            en: "Generate ANAE Invoice (Loi 22-23)",
            fr: "Générer une facture auto-entrepreneur ANAE (Loi 22-23)",
            ar: "إنشاء فاتورة المقاول الذاتي ANAE (القانون 22-23)",
            kab: "Snulfu tafakturt n ANAE (Asaduf 22-23)",
          },
          supportTicketOption: {
            en: "Create Support Ticket",
            fr: "Créer un ticket de support",
            ar: "إنشاء تذكرة دعم فني",
            kab: "Snulfu tikit n tallelt",
          },
          destinationUrl: {
            en: "Destination URL",
            fr: "URL de destination",
            ar: "رابط URL الوجهة",
            kab: "Tansa URL n unekcum",
          },
          standardWebhooksActive: {
            en: "Standard Webhooks Active",
            fr: "Standard Webhooks Actif",
            ar: "خدمة Webhooks القياسية مفعلة",
            kab: "Standard Webhooks Irmad",
          },
          stampsDesc: {
            en: "Stamps webhook-id, webhook-timestamp, and dual HMAC-SHA256 signatures (webhook-signature: v1,<sig>).",
            fr: "Génère webhook-id, webhook-timestamp et double signatures HMAC-SHA256 (webhook-signature: v1,<sig>).",
            ar: "يختم الترويسات بـ webhook-id وwebhook-timestamp مع توقيعين HMAC-SHA256 (webhook-signature: v1,<sig>).",
            kab: "Isemres webhook-id, webhook-timestamp d uzmulen n HMAC-SHA256 (webhook-signature: v1,<sig>).",
          },
          wasmFunction: {
            en: "Extism Wasm Transform Function",
            fr: "Fonction de transformation Wasm Extism",
            ar: "دالة تحويل Extism Wasm",
            kab: "Tawuri n usenfel n Extism Wasm",
          },
          ceilingDesc: {
            en: "Ceiling: 50ms / 16MB",
            fr: "Plafond : 50ms / 16Mo",
            ar: "الحد الأقصى: 50 ملي ثانية / 16 ميغابايت",
            kab: "Afella: 50ms / 16MAT",
          },
          sandboxedDesc: {
            en: "Runs sandboxed in WebAssembly with zero filesystem or network permissions.",
            fr: "Exécution en bac à sable WebAssembly sans accès au système de fichiers ni au réseau.",
            ar: "يعمل داخل بيئة WebAssembly معزولة تمامًا دون أذونات لنظام الملفات أو الشبكة.",
            kab: "Itteddu deg WebAssembly mebla tisuraf n uẓeṭṭa neɣ ifuyla.",
          },
          logicCondition: {
            en: "Logic Filter Condition",
            fr: "Condition de filtre logique",
            ar: "شرط التصفية المنطقي",
            kab: "Tawtilt n tmeẓla",
          },
          logicConditionPlaceholder: {
            en: "e.g. data.status == 'COMPLETED'",
            fr: "ex. data.status == 'COMPLETED'",
            ar: "مثال: data.status == 'COMPLETED'",
            kab: "Amedya: data.status == 'COMPLETED'",
          },
          delaySeconds: {
            en: "Delay (seconds)",
            fr: "Délai (secondes)",
            ar: "التأخير (بالثواني)",
            kab: "Asgunfu (tasdatin)",
          },
          deleteNode: {
            en: "Delete Node",
            fr: "Supprimer le nœud",
            ar: "حذف العقدة",
            kab: "Kkes tiqqit",
          },
          doneBtn: {
            en: "Done",
            fr: "Terminé",
            ar: "تم",
            kab: "Yekfa",
          },
        },
      },
    },
  },
};

function deepMerge(target, source, lang) {
  for (const key of Object.keys(source)) {
    const val = source[key];
    if (
      val &&
      typeof val === "object" &&
      ("en" in val || "fr" in val || "ar" in val || "kab" in val)
    ) {
      target[key] = val[lang] || val["en"];
    } else if (val && typeof val === "object") {
      if (!target[key] || typeof target[key] !== "object") {
        target[key] = {};
      }
      deepMerge(target[key], val, lang);
    } else {
      target[key] = val;
    }
  }
}

for (const namespace of Object.keys(dictionaryAdditions)) {
  for (const lang of locales) {
    const filePath = path.join(localesDir, lang, `${namespace}.json`);
    let data = {};
    if (fs.existsSync(filePath)) {
      data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
    deepMerge(data, dictionaryAdditions[namespace], lang);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
    console.log(`Updated ${filePath}`);
  }
}

console.log("Successfully injected all dictionary additions!");
