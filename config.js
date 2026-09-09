const APP_CONFIG = {
  org: {
    id: 'wrdiat',
    name: 'نظام الورديات',
    subtitle: 'إدارة الأقسام والشفتات'
  },
  firebaseConfig: {
    apiKey: "AIzaSyCHd1yY27vSskKuvvNZ_XmtwgoHc3lPe5k",
    authDomain: "ytcalender-bae88.firebaseapp.com",
    databaseURL: "https://ytcalender-bae88-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ytcalender-bae88",
    storageBucket: "ytcalender-bae88.firebasestorage.app",
    messagingSenderId: "625139846676",
    appId: "1:625139846676:web:691be456f3f31e6572e101"
  },
  appIconPath: 'images/icon-192x192.png'
};

async function hashPassword(password) {
  const data = new TextEncoder().encode('wrdiat:' + password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}
