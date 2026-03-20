import i18next from 'i18next';

// Translation resources bundled inline for ESM/CJS compatibility
const en = {
  email: {
    jobOffer: {
      subject: "New job offer: {{jobTitle}}",
      greeting: "Hi {{name}},",
      newOffer: "You have a new job offer on Human Pages!",
      title: "Title",
      category: "Category",
      from: "From",
      price: "Price",
      description: "Description",
      viewOffer: "View Offer",
      loginToView: "Log in to accept or reject this offer",
      footer: "Human Pages - Get hired for real-world tasks"
    },
    common: { newJobOffer: "New Job Offer" }
  },
  telegram: {
    linked: "✅ Your Telegram is now connected to HumanPages!\n\nYou'll receive notifications here when agents send you job offers.\n\n🔗 Share your profile with friends and ask them to vouch for you — vouches boost your visibility and help you get more jobs:\n{{profileUrl}}\n\nThe more vouches you have, the higher you rank in agent searches!",
    welcome: "Welcome to HumanPages Bot! 👋\n\nTo connect your account, go to your HumanPages dashboard and click \"Connect Telegram\" to get a verification link.\n\nIf you already have a code, just send it here as a message.\n\n💡 Tip: Once connected, share your profile link with friends and ask them to vouch for you — it helps AI agents find and hire you!",
    invalidCode: "Invalid or expired code. Please generate a new link from your HumanPages dashboard.",
    expiredCode: "This code has expired. Please generate a new link from your HumanPages dashboard.",
    alreadyLinked: "This Telegram account is already linked to another profile. Please disconnect it first.",
    accountNotFound: "Account not found. Please try again from your dashboard.",
    unknownMessage: "I only understand verification codes. Go to your HumanPages dashboard to connect your account.",
  }
};

const es = {
  email: {
    jobOffer: {
      subject: "Nueva oferta de trabajo: {{jobTitle}}",
      greeting: "Hola {{name}},",
      newOffer: "¡Tienes una nueva oferta de trabajo en Human Pages!",
      title: "Título",
      category: "Categoría",
      from: "De",
      price: "Precio",
      description: "Descripción",
      viewOffer: "Ver Oferta",
      loginToView: "Inicia sesión para aceptar o rechazar esta oferta",
      footer: "Human Pages - Encuentra trabajo en el mundo real"
    },
    common: { newJobOffer: "Nueva Oferta de Trabajo" }
  },
  telegram: {
    linked: "✅ ¡Tu Telegram está conectado a HumanPages!\n\nRecibirás notificaciones aquí cuando los agentes te envíen ofertas de trabajo.\n\n🔗 Comparte tu perfil con amigos y pídeles que te recomienden — las recomendaciones aumentan tu visibilidad y te ayudan a conseguir más trabajos:\n{{profileUrl}}\n\n¡Cuantas más recomendaciones tengas, más alto apareces en las búsquedas!",
    welcome: "¡Bienvenido al Bot de HumanPages! 👋\n\nPara conectar tu cuenta, ve a tu panel de HumanPages y haz clic en \"Conectar Telegram\" para obtener un enlace de verificación.\n\nSi ya tienes un código, simplemente envíalo aquí como mensaje.\n\n💡 Consejo: Una vez conectado, comparte tu enlace de perfil con amigos y pídeles que te recomienden — ¡ayuda a que los agentes de IA te encuentren y contraten!",
    invalidCode: "Código inválido o expirado. Genera un nuevo enlace desde tu panel de HumanPages.",
    expiredCode: "Este código ha expirado. Genera un nuevo enlace desde tu panel de HumanPages.",
    alreadyLinked: "Esta cuenta de Telegram ya está vinculada a otro perfil. Desconéctala primero.",
    accountNotFound: "Cuenta no encontrada. Inténtalo de nuevo desde tu panel.",
    unknownMessage: "Solo entiendo códigos de verificación. Ve a tu panel de HumanPages para conectar tu cuenta.",
  }
};

const zh = {
  email: {
    jobOffer: {
      subject: "新工作邀约：{{jobTitle}}",
      greeting: "{{name}}，你好，",
      newOffer: "你在Human Pages上收到了新的工作邀约！",
      title: "标题",
      category: "类别",
      from: "来自",
      price: "价格",
      description: "描述",
      viewOffer: "查看邀约",
      loginToView: "登录以接受或拒绝此邀约",
      footer: "Human Pages - 接受真实世界的工作任务"
    },
    common: { newJobOffer: "新工作邀约" }
  },
  telegram: {
    linked: "✅ 你的Telegram已连接到HumanPages！\n\n当代理向你发送工作邀约时，你会在这里收到通知。\n\n🔗 将你的个人资料分享给朋友，请他们为你担保——担保可以提升你的曝光度，帮助你获得更多工作：\n{{profileUrl}}\n\n担保越多，你在搜索中的排名越高！",
    welcome: "欢迎使用HumanPages机器人！👋\n\n要连接你的账户，请前往HumanPages控制面板，点击\"连接Telegram\"获取验证链接。\n\n如果你已有验证码，直接发送即可。\n\n💡 提示：连接后，分享你的个人资料链接给朋友，请他们为你担保——这能帮助AI代理找到并雇用你！",
    invalidCode: "验证码无效或已过期。请从HumanPages控制面板生成新链接。",
    expiredCode: "此验证码已过期。请从HumanPages控制面板生成新链接。",
    alreadyLinked: "此Telegram账户已关联到其他个人资料。请先断开连接。",
    accountNotFound: "未找到账户。请从控制面板重试。",
    unknownMessage: "我只能识别验证码。请前往HumanPages控制面板连接你的账户。",
  }
};

const tl = {
  email: {
    jobOffer: {
      subject: "Bagong job offer: {{jobTitle}}",
      greeting: "Hi {{name}},",
      newOffer: "May bagong job offer ka sa Human Pages!",
      title: "Titulo",
      category: "Kategorya",
      from: "Mula sa",
      price: "Presyo",
      description: "Deskripsyon",
      viewOffer: "Tingnan ang Offer",
      loginToView: "Mag-log in para tanggapin o tanggihan ang offer na ito",
      footer: "Human Pages - Mag-apply sa mga tunay na trabaho"
    },
    common: { newJobOffer: "Bagong Job Offer" }
  },
  telegram: {
    linked: "✅ Nakakonekta na ang iyong Telegram sa HumanPages!\n\nMakakatanggap ka ng mga notification dito kapag may nagpadala ng job offer.\n\n🔗 I-share ang iyong profile sa mga kaibigan at hilingin na i-vouch ka nila — ang mga vouch ay nagpapataas ng visibility mo at nakakatulong makakuha ng mas maraming trabaho:\n{{profileUrl}}\n\nMas maraming vouch, mas mataas ang ranggo mo sa mga search!",
    welcome: "Welcome sa HumanPages Bot! 👋\n\nPara i-connect ang account mo, pumunta sa HumanPages dashboard at i-click ang \"Connect Telegram\" para makakuha ng verification link.\n\nKung mayroon ka nang code, i-send lang dito.\n\n💡 Tip: Kapag nakakonekta na, i-share ang profile link mo sa mga kaibigan at hilingin na i-vouch ka nila — nakakatulong ito para ma-hire ka ng AI agents!",
    invalidCode: "Invalid o expired na code. Gumawa ng bagong link mula sa HumanPages dashboard.",
    expiredCode: "Expired na ang code na ito. Gumawa ng bagong link mula sa HumanPages dashboard.",
    alreadyLinked: "Ang Telegram account na ito ay nakalink na sa ibang profile. I-disconnect muna.",
    accountNotFound: "Hindi nahanap ang account. Subukan ulit mula sa dashboard.",
    unknownMessage: "Verification codes lang ang naiintindihan ko. Pumunta sa HumanPages dashboard para i-connect ang account mo.",
  }
};

const hi = {
  email: {
    jobOffer: {
      subject: "नया जॉब ऑफर: {{jobTitle}}",
      greeting: "नमस्ते {{name}},",
      newOffer: "आपको Human Pages पर एक नया जॉब ऑफर मिला है!",
      title: "शीर्षक",
      category: "श्रेणी",
      from: "से",
      price: "कीमत",
      description: "विवरण",
      viewOffer: "ऑफर देखें",
      loginToView: "इस ऑफर को स्वीकार या अस्वीकार करने के लिए लॉग इन करें",
      footer: "Human Pages - वास्तविक कार्यों के लिए नियुक्त हों"
    },
    common: { newJobOffer: "नया जॉब ऑफर" }
  },
  telegram: {
    linked: "✅ आपका Telegram HumanPages से जुड़ गया है!\n\nजब एजेंट आपको जॉब ऑफर भेजेंगे तो आपको यहाँ सूचना मिलेगी।\n\n🔗 अपना प्रोफ़ाइल दोस्तों के साथ शेयर करें और उनसे वाउच करने को कहें — वाउच आपकी दृश्यता बढ़ाते हैं:\n{{profileUrl}}\n\nजितने ज़्यादा वाउच, उतनी ऊँची रैंकिंग!",
    welcome: "HumanPages Bot में आपका स्वागत है! 👋\n\nअपना अकाउंट कनेक्ट करने के लिए HumanPages डैशबोर्ड पर जाएँ और \"Connect Telegram\" पर क्लिक करें।\n\nअगर आपके पास कोड है, तो उसे यहाँ भेजें।\n\n💡 सुझाव: कनेक्ट होने के बाद, अपना प्रोफ़ाइल लिंक दोस्तों को शेयर करें!",
    invalidCode: "अमान्य या समय-सीमित कोड। HumanPages डैशबोर्ड से नया लिंक बनाएँ।",
    expiredCode: "यह कोड समाप्त हो गया है। कृपया नया लिंक बनाएँ।",
    alreadyLinked: "यह Telegram अकाउंट पहले से किसी अन्य प्रोफ़ाइल से जुड़ा है।",
    accountNotFound: "अकाउंट नहीं मिला। डैशबोर्ड से पुनः प्रयास करें।",
    unknownMessage: "मैं केवल वेरिफ़िकेशन कोड समझता हूँ। अपना अकाउंट कनेक्ट करने के लिए HumanPages डैशबोर्ड पर जाएँ।",
  }
};

const vi = {
  email: {
    jobOffer: {
      subject: "Offer công việc mới: {{jobTitle}}",
      greeting: "Xin chào {{name}},",
      newOffer: "Bạn có offer công việc mới trên Human Pages!",
      title: "Tiêu đề",
      category: "Danh mục",
      from: "Từ",
      price: "Giá",
      description: "Mô tả",
      viewOffer: "Xem Offer",
      loginToView: "Đăng nhập để chấp nhận hoặc từ chối offer này",
      footer: "Human Pages - Nhận việc làm thực tế"
    },
    common: { newJobOffer: "Offer Công Việc Mới" }
  },
  telegram: {
    linked: "✅ Telegram của bạn đã kết nối với HumanPages!\n\nBạn sẽ nhận thông báo tại đây khi có offer công việc mới.\n\n🔗 Chia sẻ hồ sơ với bạn bè và nhờ họ xác nhận — điều này giúp tăng khả năng hiển thị:\n{{profileUrl}}\n\nCàng nhiều xác nhận, bạn càng được xếp hạng cao!",
    welcome: "Chào mừng bạn đến HumanPages Bot! 👋\n\nĐể kết nối tài khoản, vào bảng điều khiển HumanPages và nhấp \"Connect Telegram\".\n\nNếu bạn đã có mã, hãy gửi ngay tại đây.\n\n💡 Mẹo: Sau khi kết nối, chia sẻ link hồ sơ với bạn bè!",
    invalidCode: "Mã không hợp lệ hoặc đã hết hạn. Tạo link mới từ bảng điều khiển.",
    expiredCode: "Mã này đã hết hạn. Vui lòng tạo link mới.",
    alreadyLinked: "Tài khoản Telegram này đã liên kết với hồ sơ khác. Vui lòng ngắt kết nối trước.",
    accountNotFound: "Không tìm thấy tài khoản. Vui lòng thử lại từ bảng điều khiển.",
    unknownMessage: "Tôi chỉ hiểu mã xác minh. Vào bảng điều khiển HumanPages để kết nối tài khoản.",
  }
};

const tr = {
  email: {
    jobOffer: {
      subject: "Yeni iş teklifi: {{jobTitle}}",
      greeting: "Merhaba {{name}},",
      newOffer: "Human Pages'da yeni bir iş teklifiniz var!",
      title: "Başlık",
      category: "Kategori",
      from: "Gönderen",
      price: "Fiyat",
      description: "Açıklama",
      viewOffer: "Teklifi Görüntüle",
      loginToView: "Bu teklifi kabul etmek veya reddetmek için giriş yapın",
      footer: "Human Pages - Gerçek dünya işleri için işe alının"
    },
    common: { newJobOffer: "Yeni İş Teklifi" }
  },
  telegram: {
    linked: "✅ Telegram'ınız HumanPages'e bağlandı!\n\nAjanlar size iş teklifi gönderdiğinde burada bildirim alacaksınız.\n\n🔗 Profilinizi arkadaşlarınızla paylaşın ve sizi tavsiye etmelerini isteyin — tavsiyeler görünürlüğünüzü artırır:\n{{profileUrl}}\n\nNe kadar çok tavsiye, o kadar yüksek sıralama!",
    welcome: "HumanPages Bot'a hoş geldiniz! 👋\n\nHesabınızı bağlamak için HumanPages paneline gidin ve \"Connect Telegram\"a tıklayın.\n\nZaten bir kodunuz varsa, buraya gönderin.\n\n💡 İpucu: Bağlandıktan sonra profil linkinizi arkadaşlarınızla paylaşın!",
    invalidCode: "Geçersiz veya süresi dolmuş kod. Panelden yeni link oluşturun.",
    expiredCode: "Bu kodun süresi dolmuş. Lütfen yeni link oluşturun.",
    alreadyLinked: "Bu Telegram hesabı başka bir profile bağlı. Önce bağlantıyı kesin.",
    accountNotFound: "Hesap bulunamadı. Panelden tekrar deneyin.",
    unknownMessage: "Sadece doğrulama kodlarını anlıyorum. Hesabınızı bağlamak için HumanPages paneline gidin.",
  }
};

const th = {
  email: {
    jobOffer: {
      subject: "ข้อเสนองานใหม่: {{jobTitle}}",
      greeting: "สวัสดี {{name}},",
      newOffer: "คุณมีข้อเสนองานใหม่บน Human Pages!",
      title: "ชื่อ",
      category: "หมวดหมู่",
      from: "จาก",
      price: "ราคา",
      description: "รายละเอียด",
      viewOffer: "ดูข้อเสนอ",
      loginToView: "เข้าสู่ระบบเพื่อยอมรับหรือปฏิเสธข้อเสนอนี้",
      footer: "Human Pages - รับจ้างงานจริงในโลกจริง"
    },
    common: { newJobOffer: "ข้อเสนองานใหม่" }
  },
  telegram: {
    linked: "✅ Telegram ของคุณเชื่อมต่อกับ HumanPages แล้ว!\n\nคุณจะได้รับแจ้งเตือนที่นี่เมื่อเอเจนต์ส่งข้อเสนองาน\n\n🔗 แชร์โปรไฟล์กับเพื่อนและขอให้พวกเขารับรอง — การรับรองจะเพิ่มการมองเห็นของคุณ:\n{{profileUrl}}\n\nยิ่งมีการรับรองมาก ยิ่งอันดับสูง!",
    welcome: "ยินดีต้อนรับสู่ HumanPages Bot! 👋\n\nเชื่อมต่อบัญชีของคุณโดยไปที่แดชบอร์ด HumanPages แล้วคลิก \"Connect Telegram\"\n\nถ้ามีรหัสแล้ว ส่งมาได้เลย\n\n💡 เคล็ดลับ: หลังเชื่อมต่อแล้ว แชร์ลิงก์โปรไฟล์กับเพื่อน!",
    invalidCode: "รหัสไม่ถูกต้องหรือหมดอายุ สร้างลิงก์ใหม่จากแดชบอร์ด",
    expiredCode: "รหัสนี้หมดอายุแล้ว กรุณาสร้างลิงก์ใหม่",
    alreadyLinked: "บัญชี Telegram นี้เชื่อมต่อกับโปรไฟล์อื่นอยู่แล้ว กรุณายกเลิกการเชื่อมต่อก่อน",
    accountNotFound: "ไม่พบบัญชี กรุณาลองใหม่จากแดชบอร์ด",
    unknownMessage: "ฉันเข้าใจเฉพาะรหัสยืนยัน ไปที่แดชบอร์ด HumanPages เพื่อเชื่อมต่อบัญชี",
  }
};

const fr = {
  email: {
    jobOffer: {
      subject: "Nouvelle offre d'emploi : {{jobTitle}}",
      greeting: "Bonjour {{name}},",
      newOffer: "Vous avez une nouvelle offre d'emploi sur Human Pages !",
      title: "Titre",
      category: "Catégorie",
      from: "De",
      price: "Prix",
      description: "Description",
      viewOffer: "Voir l'offre",
      loginToView: "Connectez-vous pour accepter ou refuser cette offre",
      footer: "Human Pages - Soyez embauché pour des tâches concrètes"
    },
    common: { newJobOffer: "Nouvelle offre d'emploi" }
  },
  telegram: {
    linked: "✅ Votre Telegram est connecté à HumanPages !\n\nVous recevrez des notifications ici lorsque des agents vous enverront des offres d'emploi.\n\n🔗 Partagez votre profil avec vos amis et demandez-leur de vous recommander — les recommandations augmentent votre visibilité :\n{{profileUrl}}\n\nPlus vous avez de recommandations, plus vous êtes visible !",
    welcome: "Bienvenue sur le Bot HumanPages ! 👋\n\nPour connecter votre compte, allez sur votre tableau de bord HumanPages et cliquez sur \"Connect Telegram\".\n\nSi vous avez déjà un code, envoyez-le ici.\n\n💡 Conseil : Une fois connecté, partagez votre lien de profil avec vos amis !",
    invalidCode: "Code invalide ou expiré. Créez un nouveau lien depuis votre tableau de bord.",
    expiredCode: "Ce code a expiré. Veuillez créer un nouveau lien.",
    alreadyLinked: "Ce compte Telegram est déjà lié à un autre profil. Déconnectez-le d'abord.",
    accountNotFound: "Compte introuvable. Réessayez depuis votre tableau de bord.",
    unknownMessage: "Je ne comprends que les codes de vérification. Allez sur votre tableau de bord HumanPages pour connecter votre compte.",
  }
};

const pt = {
  email: {
    jobOffer: {
      subject: "Nova oferta de trabalho: {{jobTitle}}",
      greeting: "Olá {{name}},",
      newOffer: "Você tem uma nova oferta de trabalho no Human Pages!",
      title: "Título",
      category: "Categoria",
      from: "De",
      price: "Preço",
      description: "Descrição",
      viewOffer: "Ver Oferta",
      loginToView: "Entre para aceitar ou recusar esta oferta",
      footer: "Human Pages - Seja contratado para tarefas do mundo real"
    },
    common: { newJobOffer: "Nova Oferta de Trabalho" }
  },
  telegram: {
    linked: "✅ Seu Telegram está conectado ao HumanPages!\n\nVocê receberá notificações aqui quando agentes enviarem ofertas de trabalho.\n\n🔗 Compartilhe seu perfil com amigos e peça que eles te recomendem — recomendações aumentam sua visibilidade:\n{{profileUrl}}\n\nQuanto mais recomendações, melhor seu ranking nas buscas!",
    welcome: "Bem-vindo ao Bot HumanPages! 👋\n\nPara conectar sua conta, vá ao painel do HumanPages e clique em \"Connect Telegram\".\n\nSe já tem um código, envie aqui.\n\n💡 Dica: Depois de conectado, compartilhe seu link de perfil com amigos!",
    invalidCode: "Código inválido ou expirado. Gere um novo link no painel.",
    expiredCode: "Este código expirou. Por favor, gere um novo link.",
    alreadyLinked: "Esta conta do Telegram já está vinculada a outro perfil. Desconecte primeiro.",
    accountNotFound: "Conta não encontrada. Tente novamente pelo painel.",
    unknownMessage: "Eu só entendo códigos de verificação. Vá ao painel do HumanPages para conectar sua conta.",
  }
};

export const supportedLanguages = ['en', 'es', 'zh', 'tl', 'hi', 'vi', 'tr', 'th', 'fr', 'pt'] as const;
export type SupportedLanguage = typeof supportedLanguages[number];

i18next.init({
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: supportedLanguages,
  resources: {
    en: { translation: en },
    es: { translation: es },
    zh: { translation: zh },
    tl: { translation: tl },
    hi: { translation: hi },
    vi: { translation: vi },
    tr: { translation: tr },
    th: { translation: th },
    fr: { translation: fr },
    pt: { translation: pt },
  },
  interpolation: {
    escapeValue: false,
  },
});

export function t(key: string, options?: { lng?: string; [key: string]: any }): string {
  return i18next.t(key, options);
}

export function getTranslator(lng: string) {
  const language = supportedLanguages.includes(lng as SupportedLanguage) ? lng : 'en';
  return (key: string, options?: Record<string, any>) => t(key, { lng: language, ...options });
}

export default i18next;
