const APP_CONFIG = {
  org: {
    id: 'wrdiat',
    name: 'نظام الورديات',
    subtitle: 'إدارة الأقسام والشفتات'
  },
  firebaseConfig: {
    apiKey: "AIzaSyCLJlNT3wRz81MhukTwqPJ2KMD6lc7Zs3w",
    authDomain: "wrdiat-52c35.firebaseapp.com",
    databaseURL: "https://wrdiat-52c35-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "wrdiat-52c35",
    storageBucket: "wrdiat-52c35.firebasestorage.app",
    messagingSenderId: "998614011974",
    appId: "1:998614011974:web:50da3d1036d0f1c6d03a47"
  },
  // allowSignup:false يمنع أي زائر من إنشاء حساب أدمن لنفسه (يُخفي الزر ويرفض الإنشاء)
  allowSignup: false,
  appIconPath: 'images/icon-192x192.png'
};

async function hashPassword(password) {
  const data = new TextEncoder().encode('wrdiat:' + password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}
