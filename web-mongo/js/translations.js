// FireWire Language Translations
// English and Filipino (Tagalog)

const translations = {
  en: {
    appName: 'FireWire',
    tagline: 'Smart IoT Fire Monitoring System',

    tabMonitor: 'Live Monitor',
    tabHistory: 'History',
    tabNotifications: 'Alerts',
    tabSettings: 'Settings',
    tabDevice: 'Device',
    tabMembers: 'Members',

    greetingMorning: 'Good Morning',
    greetingAfternoon: 'Good Afternoon',
    greetingEvening: 'Good Evening',
    greetingNight: 'Good Evening',

    alarmNormal: 'System Normal',
    alarmNormalSub: 'All sensors within safe range',
    alarmTriggered: 'FIRE ALARM!',
    alarmWarning: 'WARNING',
    fireRiskDetected: 'FIRE RISK DETECTED',
    multipleTriggered: 'Multiple sensors triggered',

    sensorGas: 'Gas Level',
    sensorSmoke: 'Smoke Level',
    sensorCO: 'Carbon Monoxide',
    sensorAQI: 'Air Quality',
    sensorTemp: 'Temperature',
    sensorHumidity: 'Humidity',

    statusThreshold: 'Threshold',
    statusStatus: 'Status',
    statusLevel: 'Level',
    statusNormal: 'Normal',
    statusHigh: 'HIGH',
    statusDetected: 'DETECTED',
    statusGood: 'Good',
    statusModerate: 'Moderate',
    statusUnhealthy: 'Unhealthy',
    statusDanger: 'Danger',
    statusCritical: 'Critical',
    statusWarning: 'Warning',

    statVoltage: 'Voltage',
    statAlarms: 'Total Alarms',
    statDevice: 'Device Status',
    statLastUpdate: 'Last Update',
    statOnline: 'Online',
    statOffline: 'Offline',
    statJustNow: 'Just now',

    sidebarTitle: 'Quick Settings',
    sidebarAppearance: 'APPEARANCE',
    sidebarThemeDark: 'Dark',
    sidebarThemeLight: 'Light',
    sidebarLanguage: 'LANGUAGE',
    sidebarLangEnglish: 'English',
    sidebarLangFilipino: 'Filipino',
    sidebarAlarmControls: 'ALARM CONTROLS',
    sidebarSilenceAlarm: 'Silence Alarm',
    sidebarSirenOn: 'Siren On',
    sidebarSirenOff: 'Siren Off',
    sidebarSystemInfo: 'SYSTEM INFO',
    sidebarHousehold: 'HOUSEHOLD',
    sidebarLogout: 'Logout',

    statusConnecting: 'Connecting...',
    statusReconnecting: 'Reconnecting...',
    statusConnected: 'Connected',
    statusDisconnected: 'Disconnected',

    btnSilence: 'Silence',
    btnAcknowledge: 'Acknowledge',
    btnViewDetails: 'View Details',
    btnClose: 'Close',
    btnSave: 'Save',
    btnCancel: 'Cancel',
    btnDelete: 'Delete',
    btnClear: 'Clear',
    btnExport: 'Export',

    accessAdmin: 'Admin',
    accessHousehold: 'Household',
    householdPasskey: 'Household Passkey',
    enterPasskey: 'Enter your Household Passkey',
    createPasskey: 'Create your unique passkey',

    warmupMessage: 'Gas sensors warming up... Readings will be available shortly.',

    statsTitle: 'Sensor Statistics',
    statsToday: 'Today',
    statsWeek: 'Week',
    statsMonth: 'Month',
    statsMin: 'Min',
    statsAvg: 'Avg',
    statsMax: 'Max',
    statsReadings: 'readings',
    statsWarnings: 'warnings',
    statsAlerts: 'alerts',

    historyTitle: 'Alarm History',
    historyEmpty: 'No alarm history',
    historyExport: 'Export PDF',
    historyRefresh: 'Refresh',
    historyClearAll: 'Clear All',

    notifTitle: 'Alert Notifications',
    notifSubtitle: 'Stay informed when emergencies happen',
    notifPushTitle: 'Push Notifications',
    notifPushDesc: 'Instant browser alerts when alarm triggers',
    notifEmailTitle: 'Email Alerts',
    notifEmailDesc: 'Get notified via email even when offline',
    notifEnabled: 'Enabled',
    notifDisabled: 'Disabled',
    notifProTip: 'Pro Tip',
    notifProTipText: 'Enable Push Notifications for instant browser alerts when alarm triggers!',
    notifSpamWarning: 'Check Spam Folder',
    notifSpamText: 'First email may go to spam. Mark as "Not Spam" for future alerts.',
    notifAlarmControls: 'Alarm Controls',
    notifAlarmControlsDesc: 'Manage active alarms and siren settings',
    notifSilenceAlarm: 'Silence Alarm',

    settingsSmartAlarmTitle: 'Smart Alarm Mode',
    settingsSmartAlarmDesc: 'When enabled, smoke alone triggers a warning only. Full alarm requires smoke AND temperature rise. CO and gas alarms are always active.',
    settingsSmartModeOn: 'Smart Mode',
    settingsSmartModeOnDesc: 'Smoke alone = Warning only; needs temp rise for full alarm',
    settingsSensitiveMode: 'Sensitive Mode',
    settingsSensitiveModeDesc: 'Any sensor trigger = Full Alarm',
    settingsSmartEnabled: 'Smart Alarm Mode enabled',
    settingsSensitiveEnabled: 'Sensitive Mode enabled',

    settingsAlarmSoundTitle: 'Alarm Sound',
    settingsAlarmSoundDesc: 'Your personal alarm sound preference',
    settingsSaveSound: 'Save Sound',

    settingsGasThreshTitle: 'Gas Threshold (MQ-7)',
    settingsGasThreshDesc: 'Trigger alarm when gas level exceeds this value',
    settingsSmokeThreshTitle: 'Smoke Threshold (MQ-2)',
    settingsSmokeThreshDesc: 'Trigger alarm when smoke level exceeds this value',
    settingsTempThreshTitle: 'Temperature Threshold',
    settingsTempThreshDesc: 'Trigger alarm when temperature exceeds this value',
    settingsCOThreshTitle: 'CO Thresholds (MQ-7 PPM)',
    settingsCOThreshDesc: 'Carbon monoxide warning levels in parts per million',
    settingsCOWarning: 'Warning Level',
    settingsCODanger: 'Danger Level',
    settingsCOCritical: 'Critical Level',
    settingsResetTitle: 'Reset Thresholds',
    settingsResetDesc: 'Restore all sensor thresholds to factory defaults',
    settingsResetBtn: 'Reset All to Defaults',

    settingsDeviceInfoTitle: 'Device Information',
    settingsDeviceId: 'Device ID',
    settingsLastUpdate: 'Last Update',
    settingsFreeHeap: 'Free Heap',
    settingsConnStatus: 'Status',

    settingsDangerZone: 'Danger Zone',
    settingsDangerZoneDesc: 'Irreversible actions that affect all users',
    settingsFactoryReset: 'Factory Reset',

    deviceTitle: 'Device Configuration',
    deviceSubtitle: 'Manage WiFi and sensor settings for your ESP32',

    membersTitle: 'Household Members',

    footerCredits: 'Designed & Developed by',
    footerTeam: 'FireWire Research Team',
    footerRights: 'All rights reserved',

    toastSuccess: 'Success',
    toastError: 'Error',
    toastWarning: 'Warning',
    toastInfo: 'Info',
    toastAudioEnabled: 'Alarm sound enabled',
    toastFailedSmartMode: 'Failed to update Smart Alarm Mode',
  },

  tl: {
    appName: 'FireWire',
    tagline: 'Matalinong Sistema ng Pagbabantay sa Sunog',

    tabMonitor: 'Live Monitor',
    tabHistory: 'Kasaysayan',
    tabNotifications: 'Mga Alerto',
    tabSettings: 'Mga Setting',
    tabDevice: 'Aparato',
    tabMembers: 'Mga Miyembro',

    greetingMorning: 'Magandang Umaga',
    greetingAfternoon: 'Magandang Hapon',
    greetingEvening: 'Magandang Gabi',
    greetingNight: 'Magandang Gabi',

    alarmNormal: 'Ligtas ang Sistema',
    alarmNormalSub: 'Lahat ng sensor ay nasa ligtas na antas',
    alarmTriggered: 'ALARMA NG SUNOG!',
    alarmWarning: 'BABALA',
    fireRiskDetected: 'MAY PANGANIB NA SUNOG',
    multipleTriggered: 'Maraming sensor ang nag-trigger',

    sensorGas: 'Antas ng Gas',
    sensorSmoke: 'Antas ng Usok',
    sensorCO: 'Carbon Monoxide',
    sensorAQI: 'Kalidad ng Hangin',
    sensorTemp: 'Temperatura',
    sensorHumidity: 'Halumigmig',

    statusThreshold: 'Limitasyon',
    statusStatus: 'Kalagayan',
    statusLevel: 'Antas',
    statusNormal: 'Normal',
    statusHigh: 'MATAAS',
    statusDetected: 'NATUKOY',
    statusGood: 'Maayos',
    statusModerate: 'Katamtaman',
    statusUnhealthy: 'Mapanganib',
    statusDanger: 'Delikado',
    statusCritical: 'Kritikal',
    statusWarning: 'Babala',

    statVoltage: 'Boltahe',
    statAlarms: 'Kabuuang Alarma',
    statDevice: 'Katayuan ng Aparato',
    statLastUpdate: 'Huling Update',
    statOnline: 'Online',
    statOffline: 'Offline',
    statJustNow: 'Ngayon lang',

    sidebarTitle: 'Mabilis na Setting',
    sidebarAppearance: 'HITSURA',
    sidebarThemeDark: 'Madilim',
    sidebarThemeLight: 'Maliwanag',
    sidebarLanguage: 'WIKA',
    sidebarLangEnglish: 'Ingles',
    sidebarLangFilipino: 'Filipino',
    sidebarAlarmControls: 'KONTROL NG ALARMA',
    sidebarSilenceAlarm: 'Patahimikin ang Alarma',
    sidebarSirenOn: 'Siren Bukas',
    sidebarSirenOff: 'Siren Sarado',
    sidebarSystemInfo: 'IMPORMASYON NG SISTEMA',
    sidebarHousehold: 'SAMBAHAYAN',
    sidebarLogout: 'Mag-logout',

    statusConnecting: 'Kumukonekta...',
    statusReconnecting: 'Muling kumukonekta...',
    statusConnected: 'Nakakonekta',
    statusDisconnected: 'Hindi nakakonekta',

    btnSilence: 'Patahimikin',
    btnAcknowledge: 'Natanggap',
    btnViewDetails: 'Tingnan ang Detalye',
    btnClose: 'Isara',
    btnSave: 'I-save',
    btnCancel: 'Kanselahin',
    btnDelete: 'Tanggalin',
    btnClear: 'Burahin',
    btnExport: 'I-export',

    accessAdmin: 'Admin',
    accessHousehold: 'Sambahayan',
    householdPasskey: 'Passkey ng Sambahayan',
    enterPasskey: 'Ilagay ang Passkey ng Sambahayan',
    createPasskey: 'Gumawa ng natatanging passkey',

    warmupMessage: 'Nag-iinit ang mga gas sensor... Sandali lang para sa mga reading.',

    statsTitle: 'Istatistika ng Sensor',
    statsToday: 'Ngayon',
    statsWeek: 'Lingguhan',
    statsMonth: 'Buwanan',
    statsMin: 'Pinakamababa',
    statsAvg: 'Karaniwan',
    statsMax: 'Pinakamataas',
    statsReadings: 'mga reading',
    statsWarnings: 'mga babala',
    statsAlerts: 'mga alerto',

    historyTitle: 'Kasaysayan ng Alarma',
    historyEmpty: 'Walang naitalang alarma',
    historyExport: 'I-export sa PDF',
    historyRefresh: 'I-refresh',
    historyClearAll: 'Burahin Lahat',

    notifTitle: 'Mga Abiso at Alerto',
    notifSubtitle: 'Manatiling alerto tuwing may panganib',
    notifPushTitle: 'Push Notification',
    notifPushDesc: 'Agarang abiso sa browser kapag may alarma',
    notifEmailTitle: 'Abiso sa Email',
    notifEmailDesc: 'Makatanggap ng email kahit offline',
    notifEnabled: 'Bukas',
    notifDisabled: 'Sarado',
    notifProTip: 'Tip',
    notifProTipText: 'I-on ang Push Notification para sa agarang abiso kapag may alarma!',
    notifSpamWarning: 'Tingnan ang Spam',
    notifSpamText: 'Ang unang email ay maaaring mapunta sa spam. I-mark bilang "Hindi Spam".',
    notifAlarmControls: 'Kontrol ng Alarma',
    notifAlarmControlsDesc: 'Pamahalaan ang aktibong alarma at siren',
    notifSilenceAlarm: 'Patahimikin ang Alarma',

    settingsSmartAlarmTitle: 'Smart Alarm Mode',
    settingsSmartAlarmDesc: 'Kapag bukas, ang usok lamang ay nagbibigay ng babala. Kailangan ng usok AT pagtaas ng temperatura para sa buong alarma. Ang CO at gas ay palaging nagti-trigger ng buong alarma.',
    settingsSmartModeOn: 'Smart Mode',
    settingsSmartModeOnDesc: 'Usok lamang = Babala lang; kailangan ng pagtaas ng temperatura para sa buong alarma',
    settingsSensitiveMode: 'Sensitibong Mode',
    settingsSensitiveModeDesc: 'Anumang sensor = Buong Alarma agad',
    settingsSmartEnabled: 'Smart Alarm Mode ay nakabukas na',
    settingsSensitiveEnabled: 'Sensitibong Mode ay nakabukas na',

    settingsAlarmSoundTitle: 'Tunog ng Alarma',
    settingsAlarmSoundDesc: 'Piliin ang tunog ng alarma para sa iyo',
    settingsSaveSound: 'I-save ang Tunog',

    settingsGasThreshTitle: 'Limitasyon ng Gas (MQ-7)',
    settingsGasThreshDesc: 'Mag-trigger ng alarma kapag lumampas ang gas sa halagang ito',
    settingsSmokeThreshTitle: 'Limitasyon ng Usok (MQ-2)',
    settingsSmokeThreshDesc: 'Mag-trigger ng alarma kapag lumampas ang usok sa halagang ito',
    settingsTempThreshTitle: 'Limitasyon ng Temperatura',
    settingsTempThreshDesc: 'Mag-trigger ng alarma kapag lumampas ang temperatura sa halagang ito',
    settingsCOThreshTitle: 'Limitasyon ng CO (MQ-7 PPM)',
    settingsCOThreshDesc: 'Mga antas ng babala para sa carbon monoxide',
    settingsCOWarning: 'Antas ng Babala',
    settingsCODanger: 'Antas ng Panganib',
    settingsCOCritical: 'Kritikal na Antas',
    settingsResetTitle: 'I-reset ang mga Limitasyon',
    settingsResetDesc: 'Ibalik ang lahat ng limitasyon sa orihinal na halaga',
    settingsResetBtn: 'I-reset Lahat',

    settingsDeviceInfoTitle: 'Impormasyon ng Aparato',
    settingsDeviceId: 'ID ng Aparato',
    settingsLastUpdate: 'Huling Update',
    settingsFreeHeap: 'Libreng Memorya',
    settingsConnStatus: 'Katayuan',

    settingsDangerZone: 'Mapanganib na Aksyon',
    settingsDangerZoneDesc: 'Hindi na mababawi — makakaapekto sa lahat ng gumagamit',
    settingsFactoryReset: 'I-reset sa Factory',

    deviceTitle: 'Pagsasaayos ng Aparato',
    deviceSubtitle: 'Pamahalaan ang WiFi at sensor ng iyong ESP32',

    membersTitle: 'Mga Miyembro ng Sambahayan',

    footerCredits: 'Dinisenyo at Ginawa ng',
    footerTeam: 'FireWire Research Team',
    footerRights: 'Lahat ng karapatan ay nakalaan',

    toastSuccess: 'Tagumpay',
    toastError: 'May Mali',
    toastWarning: 'Babala',
    toastInfo: 'Impormasyon',
    toastAudioEnabled: 'Nakabukas na ang tunog ng alarma',
    toastFailedSmartMode: 'Hindi na-update ang Smart Alarm Mode',
  }
};


function getCurrentLanguage() {
  return localStorage.getItem('language') || 'en';
}

function setLanguage(lang) {
  localStorage.setItem('language', lang);
  applyTranslations(lang);
}

function t(key) {
  const lang = getCurrentLanguage();
  return (translations[lang] && translations[lang][key]) || translations.en[key] || key;
}

function applyTranslations(lang) {
  const trans = translations[lang] || translations.en;

  // data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (trans[key]) {
      if (el.tagName === 'INPUT' && el.placeholder !== undefined) {
        el.placeholder = trans[key];
      } else {
        el.textContent = trans[key];
      }
    }
  });

  updateSidebarTranslations(trans);
  updateSensorTranslations(trans);
  updateQuickStatsTranslations(trans);
  updateNotificationsTranslations(trans);
  updateSettingsTranslations(trans);
  updateHistoryTranslations(trans);

  document.querySelectorAll('.lang-option').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`lang-${lang}`)?.classList.add('active');

  document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
}

function updateSidebarTranslations(trans) {
  const sidebarTitle = document.querySelector('.sidebar-title');
  if (sidebarTitle) {
    const icon = sidebarTitle.querySelector('i');
    sidebarTitle.innerHTML = (icon ? icon.outerHTML + ' ' : '') + trans.sidebarTitle;
  }

  document.querySelectorAll('.sidebar-section-title').forEach(section => {
    const icon = section.querySelector('i');
    const iconHtml = icon ? icon.outerHTML + ' ' : '';
    const text = section.textContent.trim().toUpperCase();
    if (text.includes('APPEARANCE') || text.includes('HITSURA')) {
      section.innerHTML = iconHtml + trans.sidebarAppearance;
    } else if (text.includes('LANGUAGE') || text.includes('WIKA')) {
      section.innerHTML = iconHtml + trans.sidebarLanguage;
    } else if (text.includes('ALARM CONTROLS') || text.includes('KONTROL')) {
      section.innerHTML = iconHtml + trans.sidebarAlarmControls;
    } else if (text.includes('SYSTEM INFO') || text.includes('IMPORMASYON')) {
      section.innerHTML = iconHtml + trans.sidebarSystemInfo;
    } else if (text.includes('HOUSEHOLD') || text.includes('SAMBAHAYAN')) {
      section.innerHTML = iconHtml + trans.sidebarHousehold;
    }
  });

  const darkTheme = document.querySelector('#darkThemeOption span');
  const lightTheme = document.querySelector('#lightThemeOption span');
  if (darkTheme) darkTheme.textContent = trans.sidebarThemeDark;
  if (lightTheme) lightTheme.textContent = trans.sidebarThemeLight;

  const engLang = document.querySelector('#lang-en span');
  const filLang = document.querySelector('#lang-tl span');
  if (engLang) engLang.textContent = trans.sidebarLangEnglish;
  if (filLang) filLang.textContent = trans.sidebarLangFilipino;

  const silenceBtn = document.getElementById('silenceAlarmSideBtn');
  if (silenceBtn) {
    const icon = silenceBtn.querySelector('i');
    silenceBtn.innerHTML = (icon ? icon.outerHTML + ' ' : '') + trans.sidebarSilenceAlarm;
  }

  const logoutBtn = document.querySelector('.sidebar-section button[onclick="logout()"]');
  if (logoutBtn) {
    const icon = logoutBtn.querySelector('i');
    logoutBtn.innerHTML = (icon ? icon.outerHTML + ' ' : '') + trans.sidebarLogout;
  }

  // Siren toggle button in sidebar
  const sideText = document.getElementById('sirenTextSide');
  if (sideText) {
    const sirenOn = document.getElementById('sirenIconSide')?.classList.contains('fa-bell');
    sideText.textContent = sirenOn ? trans.sidebarSirenOn : trans.sidebarSirenOff;
  }
}

function updateSensorTranslations(trans) {
  const sensorMap = {
    'gas-card': trans.sensorGas,
    'smoke-card': trans.sensorSmoke,
    'co-card': trans.sensorCO,
    'aqi-card': trans.sensorAQI,
    'temp-card': trans.sensorTemp,
    'humidity-card': trans.sensorHumidity,
  };

  Object.entries(sensorMap).forEach(([cls, label]) => {
    const card = document.querySelector(`.${cls}`);
    if (card) {
      const header = card.querySelector('.sensor-header span');
      if (header) header.textContent = label;
    }
  });

  document.querySelectorAll('.status-label').forEach(label => {
    const text = label.textContent.replace(':', '').trim();
    if (text === 'Threshold' || text === 'Limitasyon') {
      label.textContent = trans.statusThreshold + ':';
    } else if (text === 'Status' || text === 'Kalagayan') {
      label.textContent = trans.statusStatus + ':';
    } else if (text === 'Level' || text === 'Antas') {
      label.textContent = trans.statusLevel + ':';
    }
  });

  // Warmup banner
  const warmup = document.querySelector('.warmup-banner span');
  if (warmup) warmup.textContent = trans.warmupMessage;
}

function updateQuickStatsTranslations(trans) {
  document.querySelectorAll('.stat-label').forEach(stat => {
    const text = stat.textContent.trim();
    if (text === 'Voltage' || text === 'Boltahe') stat.textContent = trans.statVoltage;
    else if (text === 'Total Alarms' || text === 'Kabuuang Alarma') stat.textContent = trans.statAlarms;
    else if (text === 'Device Status' || text === 'Katayuan ng Aparato') stat.textContent = trans.statDevice;
    else if (text === 'Last Update' || text === 'Huling Update') stat.textContent = trans.statLastUpdate;
  });
}

function updateNotificationsTranslations(trans) {
  // Notifications header
  const notifH2 = document.querySelector('.notif-header-text h2');
  const notifP = document.querySelector('.notif-header-text p');
  if (notifH2) notifH2.textContent = trans.notifTitle;
  if (notifP) notifP.textContent = trans.notifSubtitle;

  // Push card
  const pushCard = document.querySelector('.push-card');
  if (pushCard) {
    const h3 = pushCard.querySelector('h3');
    const p = pushCard.querySelector('p');
    if (h3) h3.textContent = trans.notifPushTitle;
    if (p) p.textContent = trans.notifPushDesc;
  }

  // Email card
  const emailCard = document.querySelector('.email-card');
  if (emailCard) {
    const h3 = emailCard.querySelector('h3');
    const p = emailCard.querySelector('p');
    if (h3) h3.textContent = trans.notifEmailTitle;
    if (p) p.textContent = trans.notifEmailDesc;
  }

  // Alarm controls card
  const alarmCtrlH3 = document.querySelector('.alarm-controls-header h3');
  const alarmCtrlP = document.querySelector('.alarm-controls-header p');
  if (alarmCtrlH3) alarmCtrlH3.textContent = trans.notifAlarmControls;
  if (alarmCtrlP) alarmCtrlP.textContent = trans.notifAlarmControlsDesc;

  const silenceAlarmBtn = document.getElementById('silenceAlarmBtn');
  if (silenceAlarmBtn) {
    const span = silenceAlarmBtn.querySelector('span');
    if (span) span.textContent = trans.notifSilenceAlarm;
  }

  // Info banner items
  const infoBannerItems = document.querySelectorAll('.notif-info-item');
  infoBannerItems.forEach(item => {
    const strong = item.querySelector('strong');
    const p = item.querySelector('p');
    if (!strong || !p) return;
    const key = strong.textContent.trim();
    if (key === 'Pro Tip' || key === 'Tip') {
      strong.textContent = trans.notifProTip;
      p.textContent = trans.notifProTipText;
    } else if (key === 'Check Spam Folder' || key === 'Tingnan ang Spam') {
      strong.textContent = trans.notifSpamWarning;
      p.textContent = trans.notifSpamText;
    }
  });
}

function updateSettingsTranslations(trans) {
  // Smart Alarm Mode card
  const smartCard = document.querySelector('.threshold-card .card-title i.fa-shield-halved');
  if (smartCard) {
    const cardTitle = smartCard.parentElement;
    cardTitle.innerHTML = smartCard.outerHTML + ' ' + trans.settingsSmartAlarmTitle;
    const subtitle = cardTitle.nextElementSibling;
    if (subtitle && subtitle.classList.contains('card-subtitle')) {
      subtitle.textContent = trans.settingsSmartAlarmDesc;
    }
  }

  // Smart mode label/desc (dynamic — only update if already rendered)
  const smartLabel = document.getElementById('smartAlarmModeLabel');
  const smartDesc = document.getElementById('smartAlarmModeDesc');
  if (smartLabel) {
    const isSmartOn = document.getElementById('smartAlarmModeToggle')?.checked;
    smartLabel.textContent = isSmartOn ? trans.settingsSmartModeOn : trans.settingsSensitiveMode;
    if (smartDesc) smartDesc.textContent = isSmartOn ? trans.settingsSmartModeOnDesc : trans.settingsSensitiveModeDesc;
  }

  // Alarm Sound card
  const alarmSoundTitle = document.querySelector('.card-title i.fa-volume-high');
  if (alarmSoundTitle) {
    const cardTitle = alarmSoundTitle.parentElement;
    cardTitle.innerHTML = alarmSoundTitle.outerHTML + ' ' + trans.settingsAlarmSoundTitle;
    const subtitle = cardTitle.nextElementSibling;
    if (subtitle && subtitle.classList.contains('card-subtitle')) subtitle.textContent = trans.settingsAlarmSoundDesc;
  }

  // Threshold card titles by icon
  const thresholdMap = [
    { icon: 'fa-fire-flame-simple', title: 'settingsGasThreshTitle', desc: 'settingsGasThreshDesc' },
    { icon: 'fa-smog', title: 'settingsSmokeThreshTitle', desc: 'settingsSmokeThreshDesc' },
    { icon: 'fa-temperature-high', title: 'settingsTempThreshTitle', desc: 'settingsTempThreshDesc' },
    { icon: 'fa-skull-crossbones', title: 'settingsCOThreshTitle', desc: 'settingsCOThreshDesc' },
    { icon: 'fa-rotate-left', title: 'settingsResetTitle', desc: 'settingsResetDesc' },
    { icon: 'fa-server', title: 'settingsDeviceInfoTitle', desc: null },
    { icon: 'fa-triangle-exclamation', title: 'settingsDangerZone', desc: 'settingsDangerZoneDesc' },
  ];

  thresholdMap.forEach(({ icon, title, desc }) => {
    const iconEl = document.querySelector(`.card-title i.${icon}`);
    if (!iconEl) return;
    const cardTitle = iconEl.parentElement;
    cardTitle.innerHTML = iconEl.outerHTML + ' ' + trans[title];
    if (desc) {
      const subtitle = cardTitle.nextElementSibling;
      if (subtitle && subtitle.classList.contains('card-subtitle')) subtitle.textContent = trans[desc];
    }
  });

  // CO level labels
  const coItems = document.querySelectorAll('.co-level-item label');
  const coKeys = ['settingsCOWarning', 'settingsCODanger', 'settingsCOCritical'];
  coItems.forEach((label, i) => {
    if (coKeys[i]) {
      const icon = label.querySelector('i');
      label.innerHTML = (icon ? icon.outerHTML : '') + ' ' + trans[coKeys[i]];
    }
  });

  // Device info labels
  const infoLabels = document.querySelectorAll('.info-label');
  infoLabels.forEach(label => {
    const icon = label.querySelector('i');
    const text = label.textContent.trim();
    const iconHtml = icon ? icon.outerHTML + ' ' : '';
    if (text.includes('Device ID') || text.includes('ID ng Aparato')) label.innerHTML = iconHtml + trans.settingsDeviceId;
    else if (text.includes('Last Update') || text.includes('Huling Update')) label.innerHTML = iconHtml + trans.settingsLastUpdate;
    else if (text.includes('Free Heap') || text.includes('Libreng Memorya')) label.innerHTML = iconHtml + trans.settingsFreeHeap;
    else if (text.includes('Status') || text.includes('Katayuan')) label.innerHTML = iconHtml + trans.settingsConnStatus;
  });

  // Reset button
  const resetBtn = document.querySelector('button[onclick="resetThresholdsToDefault()"]');
  if (resetBtn) {
    const icon = resetBtn.querySelector('i');
    resetBtn.innerHTML = (icon ? icon.outerHTML + ' ' : '') + trans.settingsResetBtn;
  }

  // Factory reset button
  const factoryBtn = document.querySelector('button[onclick="showFactoryResetModal()"]');
  if (factoryBtn) {
    const icon = factoryBtn.querySelector('i');
    factoryBtn.innerHTML = (icon ? icon.outerHTML + ' ' : '') + trans.settingsFactoryReset;
  }
}

function updateHistoryTranslations(trans) {
  // History card title
  const historyTitle = document.querySelector('#tab-history .card-title i.fa-triangle-exclamation');
  if (historyTitle) {
    const countSpan = document.getElementById('historyCount');
    const countHtml = countSpan ? ` (<span id="historyCount">${countSpan.textContent}</span>)` : '';
    historyTitle.parentElement.innerHTML = historyTitle.outerHTML + ' ' + trans.historyTitle + countHtml;
  }

  // History action buttons
  const exportBtn = document.querySelector('button[onclick="exportPDF()"]');
  if (exportBtn) {
    const icon = exportBtn.querySelector('i');
    exportBtn.innerHTML = (icon ? icon.outerHTML + ' ' : '') + trans.historyExport;
  }
  const refreshBtn = document.querySelector('button[onclick="refreshHistory()"]');
  if (refreshBtn) {
    const icon = refreshBtn.querySelector('i');
    refreshBtn.innerHTML = (icon ? icon.outerHTML + ' ' : '') + trans.historyRefresh;
  }
  const clearBtn = document.querySelector('button[onclick="clearHistory()"]');
  if (clearBtn) {
    const icon = clearBtn.querySelector('i');
    clearBtn.innerHTML = (icon ? icon.outerHTML + ' ' : '') + trans.historyClearAll;
  }

  // Stats panel title
  const statsTitle = document.querySelector('.stats-panel-title span');
  if (statsTitle) statsTitle.textContent = trans.statsTitle;

  // Stats period tabs
  document.querySelectorAll('.stats-period-tab').forEach(tab => {
    const period = tab.getAttribute('data-period');
    const icon = tab.querySelector('i');
    const iconHtml = icon ? icon.outerHTML + ' ' : '';
    if (period === 'today') tab.innerHTML = iconHtml + trans.statsToday;
    else if (period === 'week') tab.innerHTML = iconHtml + trans.statsWeek;
    else if (period === 'month') tab.innerHTML = iconHtml + trans.statsMonth;
  });

  // Stats min/avg/max labels
  document.querySelectorAll('.stats-label').forEach(label => {
    const text = label.textContent.trim();
    if (text === 'Min' || text === 'Pinakamababa') label.textContent = trans.statsMin;
    else if (text === 'Avg' || text === 'Karaniwan') label.textContent = trans.statsAvg;
    else if (text === 'Max' || text === 'Pinakamataas') label.textContent = trans.statsMax;
  });

  // Stats sensor headers
  const statsSensorMap = {
    'gas-stats': trans.sensorGas,
    'smoke-stats': trans.sensorSmoke,
    'co-stats': trans.sensorCO,
    'aqi-stats': trans.sensorAQI,
    'temp-stats': trans.sensorTemp,
    'humidity-stats': trans.sensorHumidity,
  };
  Object.entries(statsSensorMap).forEach(([cls, label]) => {
    const block = document.querySelector(`.${cls} .stats-sensor-header span`);
    if (block) block.textContent = label;
  });

  // Stats footer
  const readingsSpan = document.querySelector('#totalReadings');
  if (readingsSpan) {
    const container = readingsSpan.parentElement;
    if (container) container.innerHTML = `<i class="fas fa-database"></i> <span><span id="totalReadings">${readingsSpan.textContent}</span> ${trans.statsReadings}</span>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const currentLang = getCurrentLanguage();
  applyTranslations(currentLang);
});
