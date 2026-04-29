// FireWire Language Translations
// English and Filipino (Tagalog)

const translations = {
  en: {
    appName: 'FireWire',
    tagline: 'Home Fire & Gas Safety Monitor',

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

    alarmNormal: 'Your Home is Safe',
    alarmNormalSub: 'All sensors are reading normal',
    alarmTriggered: 'FIRE! GET OUT NOW!',
    alarmWarning: 'CAUTION — Check Your Home',
    fireRiskDetected: 'FIRE RISK — Act Now!',
    multipleTriggered: 'Multiple danger signs detected',

    sensorGas: 'Gas / LPG Leak',
    sensorSmoke: 'Smoke Detected',
    sensorCO: 'Carbon Monoxide (CO)',
    sensorAQI: 'Air Quality',
    sensorTemp: 'Room Temperature',
    sensorHumidity: 'Humidity',

    statusThreshold: 'Alarm at',
    statusStatus: 'Status',
    statusLevel: 'Air',
    statusNormal: 'Safe',
    statusHigh: 'HIGH',
    statusDetected: 'DETECTED',
    statusGood: 'Clean',
    statusModerate: 'Moderate',
    statusUnhealthy: 'Poor',
    statusDanger: 'Danger!',
    statusCritical: 'Critical!',
    statusWarning: 'Warning!',

    statVoltage: 'Power Level',
    statAlarms: 'Times Alarm Fired',
    statDevice: 'Sensor Status',
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
    sidebarSilenceAlarm: 'Stop the Alarm',
    sidebarSirenOn: 'Alarm Sound: On',
    sidebarSirenOff: 'Alarm Sound: Off',
    sidebarSystemInfo: 'SYSTEM INFO',
    sidebarHousehold: 'HOUSEHOLD',
    sidebarLogout: 'Logout',

    statusConnecting: 'Connecting...',
    statusReconnecting: 'Reconnecting...',
    statusConnected: 'Connected',
    statusDisconnected: 'Disconnected',

    btnSilence: 'Stop Alarm',
    btnAcknowledge: 'I Understand',
    btnViewDetails: 'View Details',
    btnClose: 'Close',
    btnSave: 'Save',
    btnCancel: 'Cancel',
    btnDelete: 'Delete',
    btnClear: 'Clear',
    btnExport: 'Save Report',

    accessAdmin: 'Admin',
    accessHousehold: 'Household',
    householdPasskey: 'Home Password',
    enterPasskey: 'Enter your Home Password',
    createPasskey: 'Create a password for your home',

    warmupMessage: 'Sensors are starting up — readings coming soon.',

    hintCO: 'Invisible gas — from fire or engines',
    hintAQI: 'Lower number = cleaner air',

    statsTitle: 'Sensor Readings Summary',
    statsToday: 'Today',
    statsWeek: 'This Week',
    statsMonth: 'This Month',
    statsMin: 'Lowest',
    statsAvg: 'Average',
    statsMax: 'Highest',
    statsReadings: 'readings',
    statsWarnings: 'warnings',
    statsAlerts: 'alerts',

    historyTitle: 'Alarm History',
    historyEmpty: 'No alarms recorded yet',
    historyExport: 'Save Report',
    historyRefresh: 'Refresh',
    historyClearAll: 'Clear All',

    notifTitle: 'Notifications',
    notifSubtitle: 'Get notified right away when something is wrong',
    notifPushTitle: 'Phone / Browser Alerts',
    notifPushDesc: 'Get an instant alert on your phone or browser when the alarm goes off',
    notifEmailTitle: 'Email Alerts',
    notifEmailDesc: 'Receive an email even when you are away from home',
    notifEnabled: 'On',
    notifDisabled: 'Off',
    notifProTip: 'Tip',
    notifProTipText: 'Turn on Phone Alerts so you get notified right away when the alarm fires — even if the app is closed.',
    notifSpamWarning: 'Check your Junk/Spam folder',
    notifSpamText: 'The first email may land in your spam folder. Open it and mark it as "Not Spam" so future alerts get through.',
    notifAlarmControls: 'Alarm Controls',
    notifAlarmControlsDesc: 'Stop or manage the alarm siren',
    notifSilenceAlarm: 'Stop the Alarm',

    settingsSmartAlarmTitle: 'Smart Alarm Mode',
    settingsSmartAlarmDesc: 'When ON: if only smoke is detected, the alarm gives a soft warning instead of a full alarm. The full alarm only sounds if the heat also rises. Gas and CO leaks always trigger the full alarm.',
    settingsSmartModeOn: 'Smart Mode',
    settingsSmartModeOnDesc: 'Smoke only = soft warning; full alarm needs heat rise too',
    settingsSensitiveMode: 'High Sensitivity Mode',
    settingsSensitiveModeDesc: 'Any sensor reading danger = Full alarm right away',
    settingsSmartEnabled: 'Smart Alarm Mode is now ON',
    settingsSensitiveEnabled: 'High Sensitivity Mode is now ON',

    settingsAlarmSoundTitle: 'Alarm Sound',
    settingsAlarmSoundDesc: 'Choose which sound plays when the alarm goes off',
    settingsSaveSound: 'Save Sound',

    settingsGasThreshTitle: 'Gas Alert Level',
    settingsGasThreshDesc: 'The alarm will go off when gas reaches this level',
    settingsSmokeThreshTitle: 'Smoke Alert Level',
    settingsSmokeThreshDesc: 'The alarm will go off when smoke reaches this level',
    settingsTempThreshTitle: 'Heat Alert Level',
    settingsTempThreshDesc: 'The alarm will go off when temperature reaches this level',
    settingsCOThreshTitle: 'Carbon Monoxide (CO) Alert Levels',
    settingsCOThreshDesc: 'Set how much CO gas triggers each level of warning',
    settingsCOWarning: 'Caution Level',
    settingsCODanger: 'Danger Level',
    settingsCOCritical: 'Critical Level',
    settingsResetTitle: 'Restore Default Levels',
    settingsResetDesc: 'Put all alert levels back to the original settings',
    settingsResetBtn: 'Restore Defaults',

    settingsDeviceInfoTitle: 'Device Information',
    settingsDeviceId: 'Device ID',
    settingsLastUpdate: 'Last Update',
    settingsFreeHeap: 'Device Memory',
    settingsConnStatus: 'Status',

    settingsDangerZone: 'Erase All Data',
    settingsDangerZoneDesc: 'This cannot be undone — it will remove everything for all users',
    settingsFactoryReset: 'Erase Everything & Start Over',

    deviceTitle: 'Device Setup',
    deviceSubtitle: 'Manage the WiFi and sensor settings for your device',

    membersTitle: 'Household Members',

    footerCredits: 'Designed & Developed by',
    footerTeam: 'FireWire Research Team',
    footerRights: 'All rights reserved',

    toastSuccess: 'Done',
    toastError: 'Something went wrong',
    toastWarning: 'Warning',
    toastInfo: 'Info',
    toastAudioEnabled: 'Alarm sound is now on',
    toastFailedSmartMode: 'Could not update Smart Alarm Mode',
  },

  tl: {
    appName: 'FireWire',
    tagline: 'Bantay-Sunog at Bantay-Gas para sa Tahanan',

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

    alarmNormal: 'LIGTAS ANG BAHAY',
    alarmNormalSub: 'Lahat ng sensor ay normal — walang panganib',
    alarmTriggered: 'SUNOG! LUMABAS NA!',
    alarmWarning: 'BABALA — Tingnan ang Bahay',
    fireRiskDetected: 'PANGANIB NG SUNOG!',
    multipleTriggered: 'Maraming sensor ang nagbabala',

    sensorGas: 'Gas / LPG Leak',
    sensorSmoke: 'Natukoy na Usok',
    sensorCO: 'Carbon Monoxide (CO)',
    sensorAQI: 'Kalidad ng Hangin',
    sensorTemp: 'Init ng Silid',
    sensorHumidity: 'Halumigmig',

    statusThreshold: 'Alarma sa',
    statusStatus: 'Kalagayan',
    statusLevel: 'Hangin',
    statusNormal: 'Ligtas',
    statusHigh: 'MATAAS',
    statusDetected: 'NATUKOY',
    statusGood: 'Malinis',
    statusModerate: 'Katamtaman',
    statusUnhealthy: 'Masamang Hangin',
    statusDanger: 'Delikado!',
    statusCritical: 'Kritikal!',
    statusWarning: 'Babala!',

    statVoltage: 'Lakas ng Kuryente',
    statAlarms: 'Bilang ng Alarma',
    statDevice: 'Katayuan ng Sensor',
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
    sidebarSilenceAlarm: 'Itigil ang Alarma',
    sidebarSirenOn: 'Tunog: Bukas',
    sidebarSirenOff: 'Tunog: Sarado',
    sidebarSystemInfo: 'IMPORMASYON NG SISTEMA',
    sidebarHousehold: 'SAMBAHAYAN',
    sidebarLogout: 'Mag-logout',

    statusConnecting: 'Kumukonekta...',
    statusReconnecting: 'Muling kumukonekta...',
    statusConnected: 'Nakakonekta',
    statusDisconnected: 'Hindi nakakonekta',

    btnSilence: 'Itigil ang Alarma',
    btnAcknowledge: 'Naintindihan Ko',
    btnViewDetails: 'Tingnan ang Detalye',
    btnClose: 'Isara',
    btnSave: 'I-save',
    btnCancel: 'Kanselahin',
    btnDelete: 'Tanggalin',
    btnClear: 'Burahin',
    btnExport: 'I-save ang Ulat',

    accessAdmin: 'Admin',
    accessHousehold: 'Sambahayan',
    householdPasskey: 'Password ng Bahay',
    enterPasskey: 'Ilagay ang Password ng Bahay',
    createPasskey: 'Gumawa ng password para sa inyong bahay',

    warmupMessage: 'Nagsisimula ang mga sensor — sandali lang, darating na ang mga reading.',

    hintCO: 'Di-nakikitang gas — mula sa sunog o makina',
    hintAQI: 'Mas mababa = mas malinis na hangin',

    statsTitle: 'Buod ng mga Sensor',
    statsToday: 'Ngayon',
    statsWeek: 'Lingguhan',
    statsMonth: 'Buwanan',
    statsMin: 'Pinakamababa',
    statsAvg: 'Karaniwan',
    statsMax: 'Pinakamataas',    statsReadings: 'mga reading',
    statsWarnings: 'mga babala',
    statsAlerts: 'mga alerto',

    historyTitle: 'Kasaysayan ng Alarma',
    historyEmpty: 'Wala pang naitalang alarma',
    historyExport: 'I-save ang Ulat',
    historyRefresh: 'I-refresh',
    historyClearAll: 'Burahin Lahat',

    notifTitle: 'Mga Abiso',
    notifSubtitle: 'Maabisuhan agad kapag may panganib sa bahay',
    notifPushTitle: 'Abiso sa Telepono / Browser',
    notifPushDesc: 'Makatanggap ng agarang abiso sa iyong telepono o browser kapag may alarma',
    notifEmailTitle: 'Abiso sa Email',
    notifEmailDesc: 'Makatanggap ng email kahit wala ka sa bahay',
    notifEnabled: 'Bukas',
    notifDisabled: 'Sarado',
    notifProTip: 'Tip',
    notifProTipText: 'I-on ang Abiso sa Telepono para maabisuhan ka agad kapag may alarma — kahit sarado ang app.',
    notifSpamWarning: 'Tingnan ang Spam',
    notifSpamText: 'Ang unang email ay maaaring mapunta sa spam. Buksan ito at i-mark bilang "Hindi Spam" para matanggap mo ang susunod na mga alerto.',
    notifAlarmControls: 'Kontrol ng Alarma',
    notifAlarmControlsDesc: 'Itigil o pamahalaan ang tunog ng alarma',
    notifSilenceAlarm: 'Itigil ang Alarma',

    settingsSmartAlarmTitle: 'Smart Alarm Mode',
    settingsSmartAlarmDesc: 'Kapag BUKAS: kung usok lang ang natukoy, magbibigay ng mahinang babala — hindi pa buong alarma. Tutunog ang buong alarma kapag tumaas din ang init. Ang gas at CO ay palaging nagpapatunog ng buong alarma.',
    settingsSmartModeOn: 'Smart Mode',
    settingsSmartModeOnDesc: 'Usok lang = mahinang babala; kailangan ding tumaas ang init para sa buong alarma',
    settingsSensitiveMode: 'Mataas na Sensitivity',
    settingsSensitiveModeDesc: 'Anumang sensor na nagbabala = Buong alarma agad',
    settingsSmartEnabled: 'Smart Alarm Mode ay nakabukas na',
    settingsSensitiveEnabled: 'Mataas na Sensitivity ay nakabukas na',

    settingsAlarmSoundTitle: 'Tunog ng Alarma',
    settingsAlarmSoundDesc: 'Piliin kung anong tunog ang maririnig kapag may alarma',
    settingsSaveSound: 'I-save ang Tunog',

    settingsGasThreshTitle: 'Antas ng Alarma para sa Gas',
    settingsGasThreshDesc: 'Tutunog ang alarma kapag umabot ang gas sa antas na ito',
    settingsSmokeThreshTitle: 'Antas ng Alarma para sa Usok',
    settingsSmokeThreshDesc: 'Tutunog ang alarma kapag umabot ang usok sa antas na ito',
    settingsTempThreshTitle: 'Antas ng Alarma para sa Init',
    settingsTempThreshDesc: 'Tutunog ang alarma kapag umabot ang init sa antas na ito',
    settingsCOThreshTitle: 'Carbon Monoxide (CO) Alert Levels',
    settingsCOThreshDesc: 'Itakda kung gaano karaming CO ang magpapatunog ng bawat antas ng babala',
    settingsCOWarning: 'Antas ng Babala',
    settingsCODanger: 'Antas ng Panganib',
    settingsCOCritical: 'Kritikal na Antas',
    settingsResetTitle: 'Ibalik sa Orihinal na Setting',
    settingsResetDesc: 'Ibabalik ang lahat ng babala-antas sa orihinal na halaga',
    settingsResetBtn: 'Ibalik sa Orihinal',

    settingsDeviceInfoTitle: 'Impormasyon ng Aparato',
    settingsDeviceId: 'ID ng Aparato',
    settingsLastUpdate: 'Huling Update',
    settingsFreeHeap: 'Memorya ng Aparato',
    settingsConnStatus: 'Katayuan',

    settingsDangerZone: 'Burahin Lahat ng Data',
    settingsDangerZoneDesc: 'Hindi na mababawi — maaapektuhan ang lahat ng gumagamit',
    settingsFactoryReset: 'Burahin Lahat at Magsimula Muli',

    deviceTitle: 'Pagsasaayos ng Aparato',
    deviceSubtitle: 'Pamahalaan ang WiFi at sensor ng inyong aparato',

    membersTitle: 'Mga Miyembro ng Sambahayan',

    footerCredits: 'Dinisenyo at Ginawa ng',
    footerTeam: 'FireWire Research Team',
    footerRights: 'Lahat ng karapatan ay nakalaan',

    toastSuccess: 'Tagumpay',
    toastError: 'May Nangyaring Mali',
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
    if (text === 'Threshold' || text === 'Limitasyon' || text === 'Alert Level' || text === 'Babala-Antas' || text === 'Alarm at' || text === 'Alarma sa') {
      label.textContent = trans.statusThreshold + ':';
    } else if (text === 'Status' || text === 'Kalagayan' || text === 'Smoke' || text === 'Usok') {
      label.textContent = trans.statusStatus + ':';
    } else if (text === 'Level' || text === 'Antas' || text === 'Air' || text === 'Hangin') {
      label.textContent = trans.statusLevel + ':';
    }
  });

  const warmup = document.querySelector('.warmup-banner span');
  if (warmup) warmup.textContent = trans.warmupMessage;
}

function updateQuickStatsTranslations(trans) {
  document.querySelectorAll('.stat-label').forEach(stat => {
    const text = stat.textContent.trim();
    if (text === 'Voltage' || text === 'Boltahe' || text === 'Power Level' || text === 'Lakas ng Kuryente') stat.textContent = trans.statVoltage;
    else if (text === 'Total Alarms' || text === 'Kabuuang Alarma' || text === 'Times Alarm Fired' || text === 'Bilang ng Alarma') stat.textContent = trans.statAlarms;
    else if (text === 'Device Status' || text === 'Katayuan ng Aparato' || text === 'Sensor Status' || text === 'Katayuan ng Sensor') stat.textContent = trans.statDevice;
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
  const coKeys = ['settingsCOWarning', 'settingsCODanger', 'settingsCOCritical'];  coItems.forEach((label, i) => {
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
