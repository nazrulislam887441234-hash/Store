// ==========================================================================
// FIREBASE MODULAR CDN INITIALIZATION & SHOP RESOLUTION SYSTEM
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, collection, query, where, getDocs, doc, getDoc, limit, orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Public Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBUhNhYvuo_FTvZ5RZR6Gn-4hsUY21S0XE",
  authDomain: "ghotimarket.firebaseapp.com",
  databaseURL: "https://ghotimarket-default-rtdb.firebaseio.com",
  projectId: "ghotimarket",
  storageBucket: "ghotimarket.firebasestorage.app",
  messagingSenderId: "481257644093",
  appId: "1:481257644093:web:0dfc3699d6b3c86afeca54",
  measurementId: "G-4SR8V2EKC1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Domain Normalization Helper
 * Removes https://, http://, www., trailing slash and converts to lowercase
 */
function normalizeDomain(domain) {
  if (!domain) return '';
  return domain.toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .trim();
}

/**
 * Parses query parameter string to extract shop username e.g. /shop?@testshop
 */
function getUsernameFromURL() {
  const search = window.location.search;
  if (!search) return null;

  const params = new URLSearchParams(search);
  
  // Check for key starting with @ e.g. ?@testshop
  for (const [key, val] of params.entries()) {
    if (key.startsWith('@')) {
      return key.substring(1).toLowerCase();
    }
  }

  // Fallback check for ?shop=@testshop or ?shop=testshop
  if (params.has('shop')) {
    const shopVal = params.get('shop');
    return shopVal.startsWith('@') ? shopVal.substring(1).toLowerCase() : shopVal.toLowerCase();
  }

  return null;
}

/**
 * Primary Shop Resolution System
 * Resolves current shop by Query Parameter or Hostname Match
 */
async function resolveCurrentShop() {
  const currentHostname = normalizeDomain(window.location.hostname);
  const isPrimaryDomain = currentHostname.includes('ghotimarket.com') || 
                          currentHostname.includes('github.io') || 
                          currentHostname === 'localhost' || 
                          currentHostname === '127.0.0.1';

  let shopData = null;

  if (isPrimaryDomain) {
    const username = getUsernameFromURL();
    if (username) {
      const q = query(collection(db, "shops"), where("usernameLower", "==", username.toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        shopData = { id: docSnap.id, ...docSnap.data() };
      }
    }
  } else {
    // Custom Domain Resolution
    const qNormalized = query(collection(db, "shops"), where("customDomainLower", "==", currentHostname));
    let snap = await getDocs(qNormalized);

    if (snap.empty) {
      // Fallback query to existing customDomain field
      const qFallback = query(collection(db, "shops"), where("customDomain", "==", currentHostname));
      snap = await getDocs(qFallback);
    }

    if (!snap.empty) {
      const docSnap = snap.docs[0];
      shopData = { id: docSnap.id, ...docSnap.data() };
    }
  }

  if (shopData) {
    applyShopSEOAndTheme(shopData);
  }

  return shopData;
}

/**
 * Dynamic SEO & OpenGraph Meta Tag Injector
 */
function applyShopSEOAndTheme(shop) {
  document.title = shop.shopName || "GHOTI Market Storefront";

  // Dynamic Favicon
  if (shop.shopLogo) {
    let favicon = document.querySelector("link[rel='icon']");
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
    favicon.href = shop.shopLogo;
  }

  // Meta Description & Keywords
  setMetaTag("description", shop.shopDescription || shop.shopName);
  if (Array.isArray(shop.shopKeyword)) {
    setMetaTag("keywords", shop.shopKeyword.join(", "));
  }

  // Canonical URL setup
  const canonicalUrl = shop.customDomain ? `https://${normalizeDomain(shop.customDomain)}/` : window.location.href;
  let canonicalLink = document.querySelector("link[rel='canonical']");
  if (!canonicalLink) {
    canonicalLink = document.createElement("link");
    canonicalLink.rel = "canonical";
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.href = canonicalUrl;

  // OpenGraph Tags
  setMetaTag("og:title", shop.shopName, "property");
  setMetaTag("og:description", shop.shopDescription || shop.shopName, "property");
  setMetaTag("og:image", shop.shopLogo || shop.shopBanner, "property");
  setMetaTag("og:url", canonicalUrl, "property");

  // JSON-LD Structured Data
  const schema = {
    "@context": "https://schema.org",
    "@type": "Store",
    "name": shop.shopName,
    "image": shop.shopLogo,
    "description": shop.shopDescription,
    "telephone": shop.businessNumber,
    "email": shop.email,
    "address": shop.address
  };

  let script = document.querySelector("script[type='application/ld+json']");
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.text = JSON.stringify(schema);
}

function setMetaTag(name, content, attrName = "name") {
  if (!content) return;
  let meta = document.querySelector(`meta[${attrName}='${name}']`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attrName, name);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}

export { db, resolveCurrentShop, normalizeDomain, collection, query, where, getDocs, doc, getDoc, limit, orderBy };
