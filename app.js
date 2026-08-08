// ==========================================================================
// CORE STOREFRONT LOGIC, MULTI-SHOP CART ENGINE & UI CONTROLLERS
// ==========================================================================

import { db, resolveCurrentShop, collection, query, where, getDocs, doc, getDoc, limit } from "./firebase-config.js";

let currentShop = null;
let selectedVariantsMap = {};

// LocalStorage Multi-Shop Cart Engine
function getCartKey() {
  const shopIdentifier = currentShop ? (currentShop.usernameLower || currentShop.id) : "default";
  return `ghoti_builder_cart_${shopIdentifier}`;
}

export function getCart() {
  try {
    const raw = localStorage.getItem(getCartKey());
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Cart Storage Corrupted. Resetting local cart.", e);
    localStorage.removeItem(getCartKey());
    return [];
  }
}

export function saveCart(cart) {
  try {
    localStorage.setItem(getCartKey(), JSON.stringify(cart));
    updateCartUI();
  } catch (e) {
    showToast("কার্ট সেভ করা সম্ভব হয়নি");
  }
}

export function addToCart(product, selectedVariants = [], quantity = 1) {
  const cart = getCart();
  
  let variantExtra = 0;
  selectedVariants.forEach(v => variantExtra += (v.extraPrice || 0));
  
  const unitPrice = Number(product.productPrice) + variantExtra;
  const variantKey = selectedVariants.map(v => `${v.title}:${v.option}`).sort().join("|");
  const cartItemId = `${product.id}_${variantKey}`;

  const existingIndex = cart.findIndex(item => item.cartItemId === cartItemId);

  if (existingIndex > -1) {
    cart[existingIndex].quantity += quantity;
    cart[existingIndex].totalPrice = cart[existingIndex].quantity * cart[existingIndex].unitPrice;
  } else {
    cart.push({
      cartItemId,
      productId: product.id,
      shopsId: currentShop.uid,
      productName: product.productName,
      image: (product.images && product.images.length > 0) ? product.images[0] : "",
      basePrice: Number(product.productPrice),
      selectedVariants,
      unitPrice,
      quantity,
      totalPrice: unitPrice * quantity
    });
  }

  saveCart(cart);
  showToast("পণ্যটি কার্টে যোগ করা হয়েছে");
}

export function updateCartQuantity(cartItemId, delta) {
  let cart = getCart();
  const index = cart.findIndex(item => item.cartItemId === cartItemId);
  
  if (index > -1) {
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) {
      cart.splice(index, 1);
    } else {
      cart[index].totalPrice = cart[index].quantity * cart[index].unitPrice;
    }
    saveCart(cart);
  }
}

export function updateCartUI() {
  const cart = getCart();
  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  document.querySelectorAll(".cart-badge-count").forEach(badge => {
    badge.textContent = totalCount;
    badge.style.display = totalCount > 0 ? "flex" : "none";
  });
}

// Toast System
export function showToast(message) {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span>✓</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Drawer & Modal Logic
export function initNavigationDrawers() {
  const menuBtn = document.getElementById("hamburger-btn");
  const drawer = document.getElementById("side-drawer");
  const overlay = document.getElementById("drawer-overlay");
  const closeBtn = document.getElementById("drawer-close-btn");

  if (!menuBtn || !drawer || !overlay) return;

  function openDrawer() {
    drawer.classList.add("active");
    overlay.classList.add("active");
  }

  function closeDrawer() {
    drawer.classList.remove("active");
    overlay.classList.remove("active");
  }

  menuBtn.addEventListener("click", openDrawer);
  overlay.addEventListener("click", closeDrawer);
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });
}

// Banner Slider Engine
export function setupBannerCarousel(banners) {
  const track = document.getElementById("banner-track");
  const dotsNav = document.getElementById("banner-dots");
  if (!track || !banners || banners.length === 0) return;

  let bannerList = Array.isArray(banners) ? banners : [banners];
  
  track.innerHTML = bannerList.map(src => `
    <div class="carousel-slide">
      <img src="${src}" alt="Shop Banner" loading="lazy" />
    </div>
  `).join('');

  if (bannerList.length <= 1) return;

  dotsNav.innerHTML = bannerList.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`).join('');

  let currentIndex = 0;
  let interval = null;

  function goToSlide(index) {
    currentIndex = index;
    track.style.transform = `translateX(-${currentIndex * 100}%)`;
    document.querySelectorAll(".dot").forEach((d, i) => {
      d.classList.toggle("active", i === currentIndex);
    });
  }

  function startAutoSlide() {
    interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % bannerList.length;
      goToSlide(currentIndex);
    }, 4000);
  }

  startAutoSlide();

  track.addEventListener("mouseenter", () => clearInterval(interval));
  track.addEventListener("mouseleave", startAutoSlide);
}

// Price Formatter (Bangladeshi Taka)
export function formatPrice(amount) {
  return `৳${Number(amount).toLocaleString('en-IN')}`;
}

// Global Shop Init Helper
export async function initializeStorefront() {
  currentShop = await resolveCurrentShop();
  if (!currentShop) {
    document.body.innerHTML = `
      <div class="state-box container" style="margin-top:80px;">
        <div class="state-icon">🏪</div>
        <div class="state-title">দোকানটি পাওয়া যায়নি</div>
        <div class="state-desc">URL সঠিক কিনা তা চেক করুন অথবা দোকানটি সাময়িকভাবে বন্ধ রয়েছে।</div>
      </div>
    `;
    return null;
  }

  // Populate Common Header/Drawer Elements
  document.querySelectorAll(".shop-name-display").forEach(el => el.textContent = currentShop.shopName);
  document.querySelectorAll(".shop-logo-display").forEach(el => {
    if (el.tagName === "IMG") el.src = currentShop.shopLogo || "https://via.placeholder.com/40";
  });

  if (document.getElementById("drawer-phone")) {
    document.getElementById("drawer-phone").href = `tel:${currentShop.businessNumber}`;
    document.getElementById("drawer-email").href = `mailto:${currentShop.email}`;
  }

  updateCartUI();
  initNavigationDrawers();

  return currentShop;
}
