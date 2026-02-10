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
