import i18next from 'i18next';

// Translation resources bundled inline for ESM/CJS compatibility
const en = {
  email: {
    jobOffer: {
      subject: "New job offer: {{jobTitle}}",
      greeting: "Hi {{name}},",
      newOffer: "You have a new job offer on Humans!",
      title: "Title",
      category: "Category",
      from: "From",
      price: "Price",
      description: "Description",
      viewOffer: "View Offer",
      loginToView: "Log in to accept or reject this offer",
      footer: "Humans - The AI-to-Human Marketplace"
    },
    common: { newJobOffer: "New Job Offer" }
  }
};

const es = {
  email: {
    jobOffer: {
      subject: "Nueva oferta de trabajo: {{jobTitle}}",
      greeting: "Hola {{name}},",
      newOffer: "¡Tienes una nueva oferta de trabajo en Humans!",
      title: "Título",
      category: "Categoría",
      from: "De",
      price: "Precio",
      description: "Descripción",
      viewOffer: "Ver Oferta",
      loginToView: "Inicia sesión para aceptar o rechazar esta oferta",
      footer: "Humans - El Mercado de IA a Humanos"
    },
    common: { newJobOffer: "Nueva Oferta de Trabajo" }
  }
};

const zh = {
  email: {
    jobOffer: {
      subject: "新工作邀约：{{jobTitle}}",
      greeting: "{{name}}，你好，",
      newOffer: "你在Humans上收到了新的工作邀约！",
      title: "标题",
      category: "类别",
      from: "来自",
      price: "价格",
      description: "描述",
      viewOffer: "查看邀约",
      loginToView: "登录以接受或拒绝此邀约",
      footer: "Humans - AI到人类的市场"
    },
    common: { newJobOffer: "新工作邀约" }
  }
};

const tl = {
  email: {
    jobOffer: {
      subject: "Bagong job offer: {{jobTitle}}",
      greeting: "Hi {{name}},",
      newOffer: "May bagong job offer ka sa Humans!",
      title: "Titulo",
      category: "Kategorya",
      from: "Mula sa",
      price: "Presyo",
      description: "Deskripsyon",
      viewOffer: "Tingnan ang Offer",
      loginToView: "Mag-log in para tanggapin o tanggihan ang offer na ito",
      footer: "Humans - Ang AI-to-Human Marketplace"
    },
    common: { newJobOffer: "Bagong Job Offer" }
  }
};

const hi = {
  email: {
    jobOffer: {
      subject: "नया जॉब ऑफर: {{jobTitle}}",
      greeting: "नमस्ते {{name}},",
      newOffer: "आपको Humans पर एक नया जॉब ऑफर मिला है!",
      title: "शीर्षक",
      category: "श्रेणी",
      from: "से",
      price: "कीमत",
      description: "विवरण",
      viewOffer: "ऑफर देखें",
      loginToView: "इस ऑफर को स्वीकार या अस्वीकार करने के लिए लॉग इन करें",
      footer: "Humans - AI से मानव मार्केटप्लेस"
    },
    common: { newJobOffer: "नया जॉब ऑफर" }
  }
};

const vi = {
  email: {
    jobOffer: {
      subject: "Offer công việc mới: {{jobTitle}}",
      greeting: "Xin chào {{name}},",
      newOffer: "Bạn có offer công việc mới trên Humans!",
      title: "Tiêu đề",
      category: "Danh mục",
      from: "Từ",
      price: "Giá",
      description: "Mô tả",
      viewOffer: "Xem Offer",
      loginToView: "Đăng nhập để chấp nhận hoặc từ chối offer này",
      footer: "Humans - Thị trường AI-tới-Con người"
    },
    common: { newJobOffer: "Offer Công Việc Mới" }
  }
};

const tr = {
  email: {
    jobOffer: {
      subject: "Yeni iş teklifi: {{jobTitle}}",
      greeting: "Merhaba {{name}},",
      newOffer: "Humans'da yeni bir iş teklifiniz var!",
      title: "Başlık",
      category: "Kategori",
      from: "Gönderen",
      price: "Fiyat",
      description: "Açıklama",
      viewOffer: "Teklifi Görüntüle",
      loginToView: "Bu teklifi kabul etmek veya reddetmek için giriş yapın",
      footer: "Humans - AI'dan İnsana Pazar Yeri"
    },
    common: { newJobOffer: "Yeni İş Teklifi" }
  }
};

const th = {
  email: {
    jobOffer: {
      subject: "ข้อเสนองานใหม่: {{jobTitle}}",
      greeting: "สวัสดี {{name}},",
      newOffer: "คุณมีข้อเสนองานใหม่บน Humans!",
      title: "ชื่อ",
      category: "หมวดหมู่",
      from: "จาก",
      price: "ราคา",
      description: "รายละเอียด",
      viewOffer: "ดูข้อเสนอ",
      loginToView: "เข้าสู่ระบบเพื่อยอมรับหรือปฏิเสธข้อเสนอนี้",
      footer: "Humans - ตลาด AI สู่มนุษย์"
    },
    common: { newJobOffer: "ข้อเสนองานใหม่" }
  }
};

export const supportedLanguages = ['en', 'es', 'zh', 'tl', 'hi', 'vi', 'tr', 'th'] as const;
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
