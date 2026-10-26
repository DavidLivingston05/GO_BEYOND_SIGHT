// Internationalization dictionary for Beyond Sight Smart Walk Mode
// Languages: English (en), Hindi (hi), Tamil (ta), Spanish (es), Arabic (ar)
import type { SupportedLanguage } from '../../types';

export interface TranslationDictionary {
  disclaimer: string;
  walkModeActive: string;
  askingDestination: string;
  confirmDestination: (name: string) => string;
  multipleChoices: (count: number, list: string) => string;
  routeStarting: (dest: string, steps: number, unitLabel: string) => string;
  straightAhead: (count: number, unitLabel: string) => string;
  turnUpcoming: (count: number, unitLabel: string, turn: string, street?: string) => string;
  turnNow: (turn: string, street?: string) => string;
  turnClock: (turn: string, clock: string) => string;
  driftingCorrection: (driftSide: string, turnSide: string, clock?: string) => string;
  offRoute: string;
  arrived: (dest: string) => string;
  routeStopped: string;
  cameraNotVisible: string;
  cameraVisible: string;
  gpsAccuracyLow: (acc: number) => string;
  lowBatteryWarning: string;
  obstacleAhead: (name: string, steps: number, unitLabel: string, side: string) => string;
  vehicleWarning: (name: string, clock: string) => string;
  vibrationExplanation: string;
  emergencySpeakingAddress: (addr: string) => string;
  emergencyNoContact: (addr: string) => string;
  contactSaved: (name: string, phone: string) => string;
  dataCleared: string;
  micDenied: string;
  camDenied: string;
  locationDenied: string;
  turnLeft: string;
  turnRight: string;
  turnSlightLeft: string;
  turnSlightRight: string;
  moveLeft: string;
  moveRight: string;
  driftingLeft: string;
  driftingRight: string;
  stepsLabel: string;
  metersLabel: string;
  feetLabel: string;
}

export const translations: Record<SupportedLanguage, TranslationDictionary> = {
  en: {
    disclaimer:
      'Beyond Sight assists you but does not replace your cane or guide dog. Keep using them.',
    walkModeActive:
      'Smart Walk Mode activated. Hands-free walking companion with road hazard sentinel.',
    askingDestination: 'Where would you like to walk to?',
    confirmDestination: (name) => `Found ${name}. Say yes to confirm, or no to cancel.`,
    multipleChoices: (count, list) => `Found ${count} places: ${list}. Say 1, 2, or 3.`,
    routeStarting: (dest, steps, unit) =>
      `Starting route to ${dest}. Walk straight for ${steps} ${unit}.`,
    straightAhead: (count, unit) => `Walk straight for ${count} ${unit}.`,
    turnUpcoming: (count, unit, turn, street) =>
      `In ${count} ${unit}, turn ${turn}${street ? ' onto ' + street : ''}.`,
    turnNow: (turn, street) =>
      `Turn ${turn} now${street ? ' onto ' + street : ''}, then continue straight.`,
    turnClock: (turn, clock) => `Turn slightly ${turn}, ${clock}.`,
    driftingCorrection: (driftSide, turnSide, clock) =>
      `You are drifting ${driftSide}, turn ${turnSide}${clock ? ' towards ' + clock : ''}.`,
    offRoute: 'You are off route. Recalculating your walking path.',
    arrived: (dest) => `You have arrived at your destination, ${dest}.`,
    routeStopped: 'Walk route ended. Silence active.',
    cameraNotVisible: 'Camera not visible. Using GPS guidance only.',
    cameraVisible: 'Camera visible. Obstacle awareness resumed.',
    gpsAccuracyLow: (acc) =>
      `GPS accuracy is low at ${acc} meters. Proceed with extra caution using your cane.`,
    lowBatteryWarning:
      'Battery is below 15%. Consider enabling screen curtain with a 3-finger tap to save power.',
    obstacleAhead: (name, steps, unit, side) =>
      `${name} ahead, ${steps} ${unit}, move ${side}.`,
    vehicleWarning: (name, clock) =>
      `Warning! ${name} approaching at ${clock}. Step back on curb!`,
    vibrationExplanation:
      'One short pulse means go straight. Two pulses mean turn left. Three pulses mean turn right. One long pulse means arrived or stop.',
    emergencySpeakingAddress: (addr) =>
      `Emergency alert triggered. You are near ${addr}. Sending your live location to your trusted contact.`,
    emergencyNoContact: (addr) =>
      `Emergency alert triggered. You are near ${addr}. Opening maps link.`,
    contactSaved: (name, phone) => `Saved trusted emergency contact ${name} ${phone}.`,
    dataCleared:
      'All local data, emergency contacts, destinations, and acquaintance memory have been forgotten.',
    micDenied: 'Microphone permission is required for voice control. Please allow microphone access.',
    camDenied: 'Camera permission was denied. Obstacle detection is paused.',
    locationDenied: 'Location permission is required for walking navigation. Please enable location services.',
    turnLeft: 'left',
    turnRight: 'right',
    turnSlightLeft: 'slight left',
    turnSlightRight: 'slight right',
    moveLeft: 'left',
    moveRight: 'right',
    driftingLeft: 'left',
    driftingRight: 'right',
    stepsLabel: 'steps',
    metersLabel: 'meters',
    feetLabel: 'feet',
  },

  hi: {
    disclaimer:
      'बियॉन्ड साइट आपकी सहायता करता है लेकिन आपकी छड़ी या गाइड डॉग की जगह नहीं लेता। उनका उपयोग जारी रखें।',
    walkModeActive:
      'स्मार्ट वॉक मोड सक्रिय हो गया है। सड़क सुरक्षा प्रहरी के साथ हैंड्स-फ्री मार्गदर्शन।',
    askingDestination: 'आप कहाँ जाना चाहते हैं?',
    confirmDestination: (name) => `${name} मिला। पुष्टि करने के लिए हाँ कहें, या रद्द करने के लिए ना कहें।`,
    multipleChoices: (count, list) => `${count} स्थान मिले: ${list}। 1, 2, या 3 कहें।`,
    routeStarting: (dest, steps, unit) =>
      `${dest} के लिए रास्ता शुरू। ${steps} ${unit} सीधे चलें।`,
    straightAhead: (count, unit) => `${count} ${unit} सीधे चलें।`,
    turnUpcoming: (count, unit, turn, street) =>
      `${count} ${unit} में, ${turn} मुड़ें${street ? ' ' + street + ' पर' : ''}।`,
    turnNow: (turn, street) =>
      `अब ${turn} मुड़ें${street ? ' ' + street + ' पर' : ''}, फिर सीधे चलें।`,
    turnClock: (turn, clock) => `थोड़ा ${turn} मुड़ें, ${clock} बजे।`,
    driftingCorrection: (driftSide, turnSide, clock) =>
      `आप ${driftSide} भटक रहे हैं, ${turnSide} मुड़ें${clock ? ' ' + clock + ' बजे की ओर' : ''}।`,
    offRoute: 'आप रास्ते से भटक गए हैं। नए रास्ते की गणना की जा रही है।',
    arrived: (dest) => `आप अपनी मंजिल, ${dest} पर पहुँच गए हैं।`,
    routeStopped: 'वॉक रूट समाप्त हो गया।',
    cameraNotVisible: 'कैमरा दृश्यमान नहीं है। केवल जीपीएस मार्गदर्शन का उपयोग हो रहा है।',
    cameraVisible: 'कैमरा दृश्यमान है। बाधा पहचान फिर से शुरू हो गई है।',
    gpsAccuracyLow: (acc) =>
      `जीपीएस सटीकता कम है (${acc} मीटर)। अपनी छड़ी का ध्यानपूर्वक उपयोग करें।`,
    lowBatteryWarning:
      'बैटरी 15% से कम है। बिजली बचाने के लिए 3 उंगलियों से टैप करके स्क्रीन कर्टेन चालू करें।',
    obstacleAhead: (name, steps, unit, side) =>
      `आगे ${name}, ${steps} ${unit}, ${side} हटें।`,
    vehicleWarning: (name, clock) =>
      `चेतावनी! ${name} ${clock} बजे से तेज़ी से आ रहा है। फुटपाथ पर पीछे हटें!`,
    vibrationExplanation:
      'एक छोटा कंपन मतलब सीधा चलें। दो कंपन मतलब बाएं मुड़ें। तीन कंपन मतलब दाएं मुड़ें। एक लंबा कंपन मतलब मंजिल पर पहुँच गए।',
    emergencySpeakingAddress: (addr) =>
      `आपातकालीन अलर्ट। आप ${addr} के पास हैं। आपके संपर्क को लाइव लोकेशन भेजी जा रही है।`,
    emergencyNoContact: (addr) =>
      `आपातकालीन अलर्ट। आप ${addr} के पास हैं। मैप्स लिंक खोला जा रहा है।`,
    contactSaved: (name, phone) => `आपातकालीन संपर्क ${name} ${phone} सहेजा गया।`,
    dataCleared: 'आपका सारा डेटा हटा दिया गया है।',
    micDenied: 'आवाज नियंत्रण के लिए माइक्रोफोन अनुमति आवश्यक है।',
    camDenied: 'कैमरा अनुमति अस्वीकृत है।',
    locationDenied: 'चलने के मार्गदर्शन के लिए स्थान अनुमति आवश्यक है।',
    turnLeft: 'बाएं',
    turnRight: 'दाएं',
    turnSlightLeft: 'हल्का बाएं',
    turnSlightRight: 'हल्का दाएं',
    moveLeft: 'बाएं',
    moveRight: 'दाएं',
    driftingLeft: 'बाएं',
    driftingRight: 'दाएं',
    stepsLabel: 'कदम',
    metersLabel: 'मीटर',
    feetLabel: 'फीट',
  },

  ta: {
    disclaimer:
      'பியாண்ட் சைட் உங்களுக்கு உதவுகிறது ஆனால் உங்கள் ஊன்றுகோல் அல்லது வழிகாட்டி நாயை மாற்றாது.',
    walkModeActive:
      'ஸ்மார்ட் வாக் பயன்முறை இயக்கப்பட்டது. சாலைப் பாதுகாப்புடன் வழிகாட்டுதல்.',
    askingDestination: 'நீங்கள் எங்கு செல்ல விரும்புகிறீர்கள்?',
    confirmDestination: (name) => `${name} கண்டறியப்பட்டது. உறுதிப்படுத்த ஆம் என்றும், ரத்து செய்ய இல்லை என்றும் கூறவும்.`,
    multipleChoices: (count, list) => `${count} இடங்கள் கிடைத்தன: ${list}. 1, 2, அல்லது 3 என சொல்லவும்.`,
    routeStarting: (dest, steps, unit) =>
      `${dest} நோக்கிய பாதை தொடங்கியது. ${steps} ${unit} நேராக நடக்கவும்.`,
    straightAhead: (count, unit) => `${count} ${unit} நேராக நடக்கவும்.`,
    turnUpcoming: (count, unit, turn, street) =>
      `${count} ${unit} தூரத்தில், ${turn} திரும்பவும்${street ? ' ' + street + ' இல்' : ''}.`,
    turnNow: (turn, street) =>
      `இப்போது ${turn} திரும்பவும்${street ? ' ' + street + ' இல்' : ''}.`,
    turnClock: (turn, clock) => `சற்று ${turn} திரும்பவும், ${clock}.`,
    driftingCorrection: (driftSide, turnSide, clock) =>
      `நீங்கள் ${driftSide} விலகுகிறீர்கள், ${turnSide} திரும்பவும்${clock ? ' ' + clock : ''}.`,
    offRoute: 'நீங்கள் பாதையை விட்டு விலகிவிட்டீர்கள். மீண்டும் வழியமைக்கப்படுகிறது.',
    arrived: (dest) => `நீங்கள் உங்கள் இலக்கை அடைந்துவிட்டீர்கள், ${dest}.`,
    routeStopped: 'நடைப் பாதை நிறுத்தப்பட்டது.',
    cameraNotVisible: 'கேமரா தெரியவில்லை. ஜிபிஎஸ் வழிகாட்டுதல் மட்டுமே இயங்குகிறது.',
    cameraVisible: 'கேமரா தெரிந்தது. தடைகள் கண்காணிப்பு தொடர்கிறது.',
    gpsAccuracyLow: (acc) =>
      `ஜிபிஎஸ் துல்லியம் குறைவு (${acc} மீட்டர்). உங்கள் கைத்தடியுடன் கவனமாக நடக்கவும்.`,
    lowBatteryWarning:
      'பேட்டரி 15% கீழ் உள்ளது. மின்சாரத்தை சேமிக்க 3 விரல்களால் தட்டவும்.',
    obstacleAhead: (name, steps, unit, side) =>
      `முன்னே ${name}, ${steps} ${unit}, ${side} நகரவும்.`,
    vehicleWarning: (name, clock) =>
      `எச்சரிக்கை! ${name} ${clock} திசையிலிருந்து வருகிறது. பின்வாங்கவும்!`,
    vibrationExplanation:
      'ஒரு குறுகிய அதிர்வு நேராக செல்லவும். இரண்டு இடதுபுறம் திரும்பவும். மூன்று வலதுபுறம் திரும்பவும். நீண்ட அதிர்வு வந்து சேர்ந்ததை குறிக்கிறது.',
    emergencySpeakingAddress: (addr) =>
      `அவசர எச்சரிக்கை. நீங்கள் ${addr} அருகில் உள்ளீர்கள். உங்கள் இருப்பிடம் அனுப்பப்படுகிறது.`,
    emergencyNoContact: (addr) =>
      `அவசர எச்சரிக்கை. நீங்கள் ${addr} அருகில் உள்ளீர்கள். வரைபடம் திறக்கப்படுகிறது.`,
    contactSaved: (name, phone) => `அவசர தொடர்பு ${name} ${phone} சேமிக்கப்பட்டது.`,
    dataCleared: 'அனைத்து உள்ளூர் தரவும் அழிக்கப்பட்டது.',
    micDenied: 'மைக்ரோஃபோன் அனுமதி தேவை.',
    camDenied: 'கேமரா அனுமதி மறுக்கப்பட்டது.',
    locationDenied: 'இருப்பிட அனுமதி தேவை.',
    turnLeft: 'இடதுபுறம்',
    turnRight: 'வலதுபுறம்',
    turnSlightLeft: 'சற்று இடதுபுறம்',
    turnSlightRight: 'சற்று வலதுபுறம்',
    moveLeft: 'இடதுபுறம்',
    moveRight: 'வலதுபுறம்',
    driftingLeft: 'இடதுபுறம்',
    driftingRight: 'வலதுபுறம்',
    stepsLabel: 'படிகள்',
    metersLabel: 'மீட்டர்கள்',
    feetLabel: 'அடிகள்',
  },

  es: {
    disclaimer:
      'Beyond Sight te asiste pero no reemplaza tu bastón ni tu perro guía. Sigue usándolos.',
    walkModeActive:
      'Modo Caminata Inteligente activado. Guía manos libres con centinela de tráfico.',
    askingDestination: '¿A dónde te gustaría caminar?',
    confirmDestination: (name) => `Encontrado ${name}. Di sí para confirmar, o no para cancelar.`,
    multipleChoices: (count, list) => `Encontré ${count} lugares: ${list}. Di 1, 2 o 3.`,
    routeStarting: (dest, steps, unit) =>
      `Iniciando ruta hacia ${dest}. Camina recto durante ${steps} ${unit}.`,
    straightAhead: (count, unit) => `Camina recto durante ${count} ${unit}.`,
    turnUpcoming: (count, unit, turn, street) =>
      `En ${count} ${unit}, gira a la ${turn}${street ? ' hacia ' + street : ''}.`,
    turnNow: (turn, street) =>
      `Gira a la ${turn} ahora${street ? ' hacia ' + street : ''}, luego continúa recto.`,
    turnClock: (turn, clock) => `Gira ligeramente a la ${turn}, a las ${clock}.`,
    driftingCorrection: (driftSide, turnSide, clock) =>
      `Te estás desviando a la ${driftSide}, muévete a la ${turnSide}${clock ? ' hacia las ' + clock : ''}.`,
    offRoute: 'Te has desviado de la ruta. Recalculando camino peatonal.',
    arrived: (dest) => `Has llegado a tu destino, ${dest}.`,
    routeStopped: 'Ruta de caminata finalizada.',
    cameraNotVisible: 'Cámara no visible. Usando únicamente guía GPS.',
    cameraVisible: 'Cámara visible. Detección de obstáculos reanudada.',
    gpsAccuracyLow: (acc) =>
      `La precisión GPS es baja (${acc} metros). Avanza con precaución usando tu bastón.`,
    lowBatteryWarning:
      'Batería inferior al 15%. Considera activar la cortina de pantalla con 3 dedos.',
    obstacleAhead: (name, steps, unit, side) =>
      `${name} adelante, a ${steps} ${unit}, muévete a la ${side}.`,
    vehicleWarning: (name, clock) =>
      `¡Advertencia! ${name} acercándose a las ${clock}. ¡Retrocede a la acera!`,
    vibrationExplanation:
      'Una vibración corta significa ir recto. Dos significan girar a la izquierda. Tres significan girar a la derecha. Una larga significa llegada o detenerse.',
    emergencySpeakingAddress: (addr) =>
      `Alerta de emergencia. Estás cerca de ${addr}. Enviando ubicación a tu contacto de confianza.`,
    emergencyNoContact: (addr) =>
      `Alerta de emergencia. Estás cerca de ${addr}. Abriendo enlace de mapa.`,
    contactSaved: (name, phone) => `Contacto de emergencia ${name} ${phone} guardado.`,
    dataCleared: 'Todos tus datos guardados han sido borrados.',
    micDenied: 'Se requiere permiso de micrófono para comandos de voz.',
    camDenied: 'Permiso de cámara denegado.',
    locationDenied: 'Se requiere permiso de ubicación para la navegación peatonal.',
    turnLeft: 'izquierda',
    turnRight: 'derecha',
    turnSlightLeft: 'ligera izquierda',
    turnSlightRight: 'ligera derecha',
    moveLeft: 'izquierda',
    moveRight: 'derecha',
    driftingLeft: 'izquierda',
    driftingRight: 'derecha',
    stepsLabel: 'pasos',
    metersLabel: 'metros',
    feetLabel: 'pies',
  },

  ar: {
    disclaimer:
      'تطبيق بيوند سايت يساعدك لكنه لا يحل محل عصاك أو كلب الإرشاد. واصل استخدامهما.',
    walkModeActive:
      'تم تفعيل وضع المشي الذكي. مرافق مشي بدون لمس مع حارس أمان الطريق.',
    askingDestination: 'إلى أين تريد الذهاب سيراً على الأقدام؟',
    confirmDestination: (name) => `تم العثور على ${name}. قل نعم للتأكيد، أو لا للإلغاء.`,
    multipleChoices: (count, list) => `تم العثور على ${count} أماكن: ${list}. قل 1 أو 2 أو 3.`,
    routeStarting: (dest, steps, unit) =>
      `بدء المسار نحو ${dest}. امشِ للأمام ${steps} ${unit}.`,
    straightAhead: (count, unit) => `امشِ للأمام ${count} ${unit}.`,
    turnUpcoming: (count, unit, turn, street) =>
      `خلال ${count} ${unit}، انعطف ${turn}${street ? ' إلى ' + street : ''}.`,
    turnNow: (turn, street) =>
      `انعطف ${turn} الآن${street ? ' إلى ' + street : ''}، ثم تابع للأمام.`,
    turnClock: (turn, clock) => `انعطف قليلاً نحو ${turn}، عند الساعة ${clock}.`,
    driftingCorrection: (driftSide, turnSide, clock) =>
      `أنت تنحرف ${driftSide}، تحرك ${turnSide}${clock ? ' نحو الساعة ' + clock : ''}.`,
    offRoute: 'خرجت عن المسار. جاري إعادة حساب طريق المشي.',
    arrived: (dest) => `لقد وصلت إلى وجهتك، ${dest}.`,
    routeStopped: 'تم إنهاء مسار المشي.',
    cameraNotVisible: 'الكاميرا محجوبة. يتم استخدام التوجيه عبر نظام تحديد المواقع فقط.',
    cameraVisible: 'الكاميرا واضحة. تم استئناف رصد العقبات.',
    gpsAccuracyLow: (acc) =>
      `دقة نظام تحديد المواقع منخفضة (${acc} أمتار). تقدم بحذر باستخدام عصاك.`,
    lowBatteryWarning:
      'البطارية أقل من 15%. يُنصح بتفعيل ستارة الشاشة باللمس بثلاثة أصابع لتوفير الطاقة.',
    obstacleAhead: (name, steps, unit, side) =>
      `يوجد ${name} أمامك، بعد ${steps} ${unit}، تحرك ${side}.`,
    vehicleWarning: (name, clock) =>
      `تحذير! ${name} تقترب عند الساعة ${clock}. تراجع إلى الرصيف!`,
    vibrationExplanation:
      'نبضة قصيرة تعني تقدم للأمام. نبضتان تعنيان انعطف يساراً. ثلاث نبضات تعني انعطف يميناً. نبضة طويلة تعني الوصول أو التوقف.',
    emergencySpeakingAddress: (addr) =>
      `تنبيه طوارئ. أنت بالقرب من ${addr}. جاري إرسال موقعك المباشر لجهة الاتصال الموثوقة.`,
    emergencyNoContact: (addr) =>
      `تنبيه طوارئ. أنت بالقرب من ${addr}. جاري فتح رابط الخريطة.`,
    contactSaved: (name, phone) => `تم حفظ جهة اتصال الطوارئ ${name} ${phone}.`,
    dataCleared: 'تم مسح جميع البيانات الشخصية والمحفوظات محلياً.',
    micDenied: 'إذن الميكروفون مطلوب للتحكم الصوتي.',
    camDenied: 'تم رفض إذن الكاميرا.',
    locationDenied: 'إذن تحديد الموقع مطلوب للتوجيه أثناء المشي.',
    turnLeft: 'يساراً',
    turnRight: 'يميناً',
    turnSlightLeft: 'قليلاً إلى اليسار',
    turnSlightRight: 'قليلاً إلى اليمين',
    moveLeft: 'يساراً',
    moveRight: 'يميناً',
    driftingLeft: 'يساراً',
    driftingRight: 'يميناً',
    stepsLabel: 'خطوات',
    metersLabel: 'أمتار',
    feetLabel: 'أقدام',
  },
};
