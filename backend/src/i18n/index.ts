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
    welcome: "Welcome back to HumanPages Bot! 👋\n\nYour Telegram is already connected. You'll receive job offer notifications here.\n\n💡 Tip: Share your profile link with friends and ask them to vouch for you — it helps AI agents find and hire you!",
    welcomeNew: "Welcome to HumanPages! 👋\n\nGet hired by AI agents for real-world tasks — writing, design, research, virtual assistance, and more.\n\n👉 Sign up here: https://humanpages.ai/signup?utm_source=telegram_bot\n\nOnce you create your profile, come back here and click \"Connect Telegram\" in your dashboard to receive job notifications directly in Telegram.\n\nIf you already have an account, send your verification code here.",
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
    welcome: "¡Bienvenido de nuevo al Bot de HumanPages! 👋\n\nTu Telegram ya está conectado. Recibirás notificaciones de ofertas de trabajo aquí.\n\n💡 Consejo: Comparte tu enlace de perfil con amigos y pídeles que te recomienden — ¡ayuda a que los agentes de IA te encuentren y contraten!",
    welcomeNew: "¡Bienvenido a HumanPages! 👋\n\nLos agentes de IA te contratan para tareas del mundo real: redacción, diseño, investigación, asistencia virtual y más.\n\n👉 Regístrate aquí: https://humanpages.ai/signup?utm_source=telegram_bot\n\nUna vez que crees tu perfil, vuelve aquí y haz clic en \"Conectar Telegram\" en tu panel para recibir notificaciones de trabajo directamente en Telegram.\n\nSi ya tienes una cuenta, envía tu código de verificación aquí.",
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
    welcome: "欢迎回到HumanPages机器人！👋\n\n你的Telegram已连接。你会在这里收到工作邀约通知。\n\n💡 提示：分享你的个人资料链接给朋友，请他们为你担保——这能帮助AI代理找到并雇用你！",
    welcomeNew: "欢迎来到HumanPages！👋\n\nAI代理会雇用你完成真实世界的任务——写作、设计、研究、虚拟助理等。\n\n👉 在这里注册：https://humanpages.ai/signup?utm_source=telegram_bot\n\n创建个人资料后，回到这里，在控制面板中点击\"连接Telegram\"，即可直接在Telegram接收工作通知。\n\n如果你已有账户，请在此发送验证码。",
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
    welcome: "Welcome back sa HumanPages Bot! 👋\n\nNakakonekta na ang Telegram mo. Makakatanggap ka ng job offer notifications dito.\n\n💡 Tip: I-share ang profile link mo sa mga kaibigan at hilingin na i-vouch ka nila — nakakatulong ito para ma-hire ka ng AI agents!",
    welcomeNew: "Welcome sa HumanPages! 👋\n\nMa-hire ka ng AI agents para sa real-world tasks — pagsusulat, design, research, virtual assistance, at iba pa.\n\n👉 Mag-sign up dito: https://humanpages.ai/signup?utm_source=telegram_bot\n\nKapag nagawa mo na ang profile mo, bumalik dito at i-click ang \"Connect Telegram\" sa dashboard mo para makatanggap ng job notifications sa Telegram.\n\nKung mayroon ka nang account, i-send ang verification code mo dito.",
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
    welcome: "HumanPages Bot में वापसी पर स्वागत है! 👋\n\nआपका Telegram पहले से कनेक्ट है। आपको यहाँ जॉब ऑफर नोटिफिकेशन मिलेंगे।\n\n💡 सुझाव: अपना प्रोफ़ाइल लिंक दोस्तों को शेयर करें!",
    welcomeNew: "HumanPages में आपका स्वागत है! 👋\n\nAI एजेंट आपको वास्तविक कार्यों के लिए नियुक्त करते हैं — लेखन, डिज़ाइन, रिसर्च, वर्चुअल असिस्टेंस और बहुत कुछ।\n\n👉 यहाँ साइन अप करें: https://humanpages.ai/signup?utm_source=telegram_bot\n\nअपना प्रोफ़ाइल बनाने के बाद, वापस आएँ और डैशबोर्ड में \"Connect Telegram\" पर क्लिक करें।\n\nअगर आपके पास पहले से अकाउंट है, तो अपना वेरिफिकेशन कोड यहाँ भेजें।",
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
    welcome: "Chào mừng bạn trở lại HumanPages Bot! 👋\n\nTelegram của bạn đã được kết nối. Bạn sẽ nhận thông báo việc làm tại đây.\n\n💡 Mẹo: Chia sẻ link hồ sơ với bạn bè!",
    welcomeNew: "Chào mừng bạn đến HumanPages! 👋\n\nCác AI agent thuê bạn cho công việc thực tế — viết lách, thiết kế, nghiên cứu, trợ lý ảo và nhiều hơn nữa.\n\n👉 Đăng ký tại đây: https://humanpages.ai/signup?utm_source=telegram_bot\n\nSau khi tạo hồ sơ, quay lại đây và nhấp \"Connect Telegram\" trong bảng điều khiển để nhận thông báo việc làm qua Telegram.\n\nNếu bạn đã có tài khoản, gửi mã xác minh tại đây.",
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
    welcome: "HumanPages Bot'a tekrar hoş geldiniz! 👋\n\nTelegram'ınız zaten bağlı. İş teklifi bildirimlerini burada alacaksınız.\n\n💡 İpucu: Profil linkinizi arkadaşlarınızla paylaşın!",
    welcomeNew: "HumanPages'e hoş geldiniz! 👋\n\nAI ajanları sizi gerçek dünya görevleri için işe alır — yazarlık, tasarım, araştırma, sanal asistanlık ve daha fazlası.\n\n👉 Buradan kaydolun: https://humanpages.ai/signup?utm_source=telegram_bot\n\nProfilinizi oluşturduktan sonra buraya geri dönün ve panelden \"Connect Telegram\"a tıklayın.\n\nZaten bir hesabınız varsa, doğrulama kodunuzu buraya gönderin.",
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
    welcome: "ยินดีต้อนรับกลับสู่ HumanPages Bot! 👋\n\nTelegram ของคุณเชื่อมต่อแล้ว คุณจะได้รับแจ้งเตือนงานที่นี่\n\n💡 เคล็ดลับ: แชร์ลิงก์โปรไฟล์กับเพื่อน!",
    welcomeNew: "ยินดีต้อนรับสู่ HumanPages! 👋\n\nAI เอเจนต์จ้างคุณทำงานจริง — เขียน ออกแบบ วิจัย ผู้ช่วยเสมือน และอื่นๆ\n\n👉 สมัครที่นี่: https://humanpages.ai/signup?utm_source=telegram_bot\n\nหลังสร้างโปรไฟล์แล้ว กลับมาที่นี่และคลิก \"Connect Telegram\" ในแดชบอร์ด\n\nถ้ามีบัญชีอยู่แล้ว ส่งรหัสยืนยันที่นี่",
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
    welcome: "Bon retour sur le Bot HumanPages ! 👋\n\nVotre Telegram est déjà connecté. Vous recevrez les notifications d'offres ici.\n\n💡 Conseil : Partagez votre lien de profil avec vos amis !",
    welcomeNew: "Bienvenue sur HumanPages ! 👋\n\nDes agents IA vous embauchent pour des tâches réelles — rédaction, design, recherche, assistance virtuelle et plus.\n\n👉 Inscrivez-vous ici : https://humanpages.ai/signup?utm_source=telegram_bot\n\nAprès avoir créé votre profil, revenez ici et cliquez sur \"Connect Telegram\" dans votre tableau de bord.\n\nSi vous avez déjà un compte, envoyez votre code de vérification ici.",
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
    welcome: "Bem-vindo de volta ao Bot HumanPages! 👋\n\nSeu Telegram já está conectado. Você receberá notificações de ofertas aqui.\n\n💡 Dica: Compartilhe seu link de perfil com amigos!",
    welcomeNew: "Bem-vindo ao HumanPages! 👋\n\nAgentes de IA contratam você para tarefas reais — redação, design, pesquisa, assistência virtual e muito mais.\n\n👉 Cadastre-se aqui: https://humanpages.ai/signup?utm_source=telegram_bot\n\nDepois de criar seu perfil, volte aqui e clique em \"Connect Telegram\" no painel para receber notificações de trabalho pelo Telegram.\n\nSe já tem uma conta, envie seu código de verificação aqui.",
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
