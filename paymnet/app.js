// Database Setup
const DB_NAME = 'kasir_pos_db';
const DB_VERSION = 2; // Increased version for schema updates

// Store names
const STORES = {
  PRODUCTS: 'products',
  TRANSACTIONS: 'transactions',
  SUPPLIERS: 'suppliers',
  SETTINGS: 'settings',
  NOTIFICATIONS: 'notifications'
};

let db;

// Open or create IndexedDB database
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      console.error('Database error:', event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;
      
      // Migration for version 1 to 2
      if (oldVersion < 1) {
        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
          const store = db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id', autoIncrement: true });
          store.createIndex('code', 'code', { unique: true });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('supplierId', 'supplierId', { unique: false });
        }
        
        if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
          const store = db.createObjectStore(STORES.TRANSACTIONS, { keyPath: 'id', autoIncrement: true });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('invoice', 'invoice', { unique: true });
        }
        
        if (!db.objectStoreNames.contains(STORES.SUPPLIERS)) {
          const store = db.createObjectStore(STORES.SUPPLIERS, { keyPath: 'id', autoIncrement: true });
          store.createIndex('code', 'code', { unique: true });
          store.createIndex('name', 'name', { unique: false });
        }
        
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains(STORES.NOTIFICATIONS)) {
          const store = db.createObjectStore(STORES.NOTIFICATIONS, { keyPath: 'id', autoIncrement: true });
          store.createIndex('read', 'read', { unique: false });
        }
      }
      
      // Add any additional migrations for future versions here
    };
  });
}

// Initialize the application
async function initApp() {
  try {
    await openDatabase();
    loadDefaultSettings();
    setupEventListeners();
    loadDashboard();
    updateNotificationBadge();
    updateCurrentDate();
    generateInvoiceNumberDisplay();
    
    // Set up file upload display
    document.getElementById('receipt-logo').addEventListener('change', function(e) {
      const fileName = e.target.files[0] ? e.target.files[0].name : 'Belum ada file dipilih';
      document.getElementById('file-name').textContent = fileName;
    });
    
    document.getElementById('restore-file').addEventListener('change', function(e) {
      const fileName = e.target.files[0] ? e.target.files[0].name : 'Belum ada file dipilih';
      document.getElementById('restore-file-name').textContent = fileName;
    });
  } catch (error) {
    console.error('Error initializing app:', error);
    showToast('Gagal memuat aplikasi. Silakan refresh halaman.', 'error');
  }
}

// Update current date display
function updateCurrentDate() {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const today = new Date();
  document.getElementById('current-date').textContent = today.toLocaleDateString('id-ID', options);
}

// Generate invoice number display
function generateInvoiceNumberDisplay() {
  document.getElementById('current-invoice').textContent = generateInvoiceNumber();
}

// Load default settings if they don't exist
function loadDefaultSettings() {
  const settings = [
    { id: 'store', name: 'Toko Saya', address: '', phone: '', email: '', taxId: '' },
    { id: 'receipt', header: 'Terima kasih telah berbelanja', footer: 'Barang yang sudah dibeli tidak dapat ditukar atau dikembalikan', showTax: false, logo: null },
    { id: 'taxRate', value: 10 },
    { id: 'currency', symbol: 'Rp', decimal: 0, separator: '.', precision: 0 }
  ];
  
  settings.forEach(setting => {
    getRecord(STORES.SETTINGS, setting.id).then(existing => {
      if (!existing) {
        addRecord(STORES.SETTINGS, setting);
      }
    });
  });
}

// Setup all event listeners
function setupEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = e.target.getAttribute('data-page') ||
        e.target.closest('.nav-link').getAttribute('data-page');
      showPage(page);
    });
  });
  
  // Notification
  document.getElementById('notification-btn').addEventListener('click', toggleNotificationPanel);
  document.getElementById('close-notification').addEventListener('click', toggleNotificationPanel);
  
  // Products
  document.getElementById('add-product-btn').addEventListener('click', () => showProductForm());
  document.getElementById('product-search').addEventListener('input', searchProducts);
  document.getElementById('product-form').addEventListener('submit', saveProduct);
  document.getElementById('refresh-restock').addEventListener('click', loadDashboard);
  document.getElementById('refresh-popular').addEventListener('click', loadDashboard);
  
  // Cashier
  document.getElementById('cashier-search').addEventListener('input', searchCashierProducts);
  document.getElementById('clear-cart-btn').addEventListener('click', clearCart);
  document.getElementById('discount-toggle').addEventListener('change', toggleDiscount);
  document.getElementById('tax-toggle').addEventListener('change', toggleTax);
  document.getElementById('amount-received').addEventListener('input', calculateChange);
  document.getElementById('process-payment').addEventListener('click', processPayment);
  
  // Suppliers
  document.getElementById('add-supplier-btn').addEventListener('click', () => showSupplierForm());
  document.getElementById('supplier-search').addEventListener('input', searchSuppliers);
  document.getElementById('supplier-form').addEventListener('submit', saveSupplier);
  
  // Reports
  document.getElementById('report-type').addEventListener('change', changeReportType);
  document.getElementById('generate-report').addEventListener('click', generateReport);
  document.getElementById('export-pdf').addEventListener('click', exportPDF);
  document.getElementById('export-excel').addEventListener('click', exportExcel);
  
  // Settings
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = e.target.getAttribute('data-tab') ||
        e.target.closest('.tab-btn').getAttribute('data-tab');
      showSettingsTab(tab);
    });
  });
  document.getElementById('store-form').addEventListener('submit', saveStoreSettings);
  document.getElementById('receipt-form').addEventListener('submit', saveReceiptSettings);
  document.getElementById('backup-btn').addEventListener('click', backupData);
  document.getElementById('restore-btn').addEventListener('click', restoreData);
  document.getElementById('reset-btn').addEventListener('click', resetData);
  
  // Close modals when clicking outside
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  });
  
  // Close modals with escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.add('hidden');
      });
    }
  });
  
  // Event delegation for dynamic elements
  document.addEventListener('click', function(e) {
    // Handle edit buttons
    if (e.target.classList.contains('btn-edit') || e.target.closest('.btn-edit')) {
      const btn = e.target.classList.contains('btn-edit') ? e.target : e.target.closest('.btn-edit');
      const id = parseInt(btn.getAttribute('data-id'));
      const page = btn.closest('.page').id.replace('-page', '');
      
      if (page === 'products') {
        showProductForm(id);
      } else if (page === 'suppliers') {
        showSupplierForm(id);
      }
    }
    
    // Handle delete buttons
    if (e.target.classList.contains('btn-delete') || e.target.closest('.btn-delete')) {
      const btn = e.target.classList.contains('btn-edit') ? e.target : e.target.closest('.btn-edit');
      const id = parseInt(btn.getAttribute('data-id'));
      const page = btn.closest('.page').id.replace('-page', '');
      
      if (page === 'products') {
        deleteProduct(id);
      } else if (page === 'suppliers') {
        deleteSupplier(id);
      }
    }
    
    // Handle view transaction buttons
    if (e.target.classList.contains('btn-view') || e.target.closest('.btn-view')) {
      const btn = e.target.classList.contains('btn-view') ? e.target : e.target.closest('.btn-view');
      const id = parseInt(btn.getAttribute('data-id'));
      viewTransactionDetails(id);
    }
  });
}

// Show a specific page
function showPage(pageId) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  
  // Deactivate all nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  
  // Show selected page
  document.getElementById(`${pageId}-page`).classList.add('active');
  
  // Activate selected nav link
  document.querySelector(`.nav-link[data-page="${pageId}"]`).classList.add('active');
  
  // Load page content
  switch (pageId) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'products':
      loadProducts();
      break;
    case 'cashier':
      loadCashierProducts();
      break;
    case 'reports':
      setupReportDates();
      break;
    case 'suppliers':
      loadSuppliers();
      break;
    case 'settings':
      loadSettings();
      break;
  }
}

// Toggle notification panel
function toggleNotificationPanel() {
  const panel = document.getElementById('notification-panel');
  panel.classList.toggle('hidden');
  
  if (!panel.classList.contains('hidden')) {
    loadNotifications();
  }
}

// Show toast notification
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast-notification');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  
  // Add icon based on type
  let icon;
  switch (type) {
    case 'success':
      icon = '<i class="fas fa-check-circle"></i>';
      break;
    case 'error':
      icon = '<i class="fas fa-exclamation-circle"></i>';
      break;
    case 'warning':
      icon = '<i class="fas fa-exclamation-triangle"></i>';
      break;
    default:
      icon = '<i class="fas fa-info-circle"></i>';
  }
  
  toast.innerHTML = `${icon} ${message}`;
  toast.classList.remove('hidden');
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 300);
  }, 5000);
}

// Update notification badge
function updateNotificationBadge() {
  const transaction = db.transaction(STORES.NOTIFICATIONS, 'readonly');
  const store = transaction.objectStore(STORES.NOTIFICATIONS);
  const index = store.index('read');
  const request = index.count(false);
  
  request.onsuccess = () => {
    const badge = document.querySelector('.notification-badge');
    if (request.result > 0) {
      badge.classList.remove('hidden');
      badge.textContent = request.result > 9 ? '9+' : request.result;
    } else {
      badge.classList.add('hidden');
    }
  };
}

// Load notifications
function loadNotifications() {
  const transaction = db.transaction(STORES.NOTIFICATIONS, 'readwrite');
  const store = transaction.objectStore(STORES.NOTIFICATIONS);
  const request = store.getAll();
  
  request.onsuccess = () => {
    const list = document.getElementById('notification-list');
    list.innerHTML = '';
    
    if (request.result.length === 0) {
      list.innerHTML = '<p class="no-notifications">Tidak ada notifikasi</p>';
      return;
    }
    
    request.result.reverse().forEach(notification => {
      const item = document.createElement('div');
      item.className = `notification-item ${notification.type}`;
      
      const message = document.createElement('p');
      message.textContent = notification.message;
      
      const date = document.createElement('small');
      date.textContent = new Date(notification.date).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      item.appendChild(message);
      item.appendChild(date);
      list.appendChild(item);
      
      // Mark as read
      if (!notification.read) {
        notification.read = true;
        store.put(notification);
      }
    });
    
    updateNotificationBadge();
  };
}

// Format currency
function formatCurrency(amount) {
  return new Promise((resolve) => {
    getRecord(STORES.SETTINGS, 'currency').then(settings => {
      if (!settings) {
        settings = { symbol: 'Rp', decimal: 0, separator: '.', precision: 0 };
      }
      
      let formatted = amount.toFixed(settings.precision);
      formatted = formatted.replace(/\B(?=(\d{3})+(?!\d))/g, settings.separator);
      
      if (settings.decimal) {
        const parts = formatted.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, settings.separator);
        formatted = parts.join(settings.decimal === ',' ? ',' : '.');
      }
      
      resolve(`${settings.symbol} ${formatted}`);
    });
  });
}

// Format currency synchronously (for table display)
function formatCurrencySync(amount) {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

// ==================== PRODUCTS MANAGEMENT ====================

// Load products
function loadProducts() {
  const transaction = db.transaction(STORES.PRODUCTS, 'readonly');
  const store = transaction.objectStore(STORES.PRODUCTS);
  const request = store.getAll();
  
  request.onsuccess = () => {
    const tbody = document.getElementById('products-list');
    tbody.innerHTML = '';
    
    if (request.result.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">Tidak ada produk</td></tr>';
      return;
    }
    
    request.result.forEach(product => {
      const row = document.createElement('tr');
      
      row.innerHTML = `
                <td>${product.code}</td>
                <td>${product.name}</td>
                <td>${product.category}</td>
                <td>${formatCurrencySync(product.price)}</td>
                <td>${product.stock}</td>
                <td>
                    <button class="btn-edit" data-id="${product.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-delete" data-id="${product.id}">
                        <i class="fas fa-trash"></i> Hapus
                    </button>
                </td>
            `;
      
      tbody.appendChild(row);
    });
  };
}

// Search products
function searchProducts() {
  const query = document.getElementById('product-search').value.toLowerCase();
  const transaction = db.transaction(STORES.PRODUCTS, 'readonly');
  const store = transaction.objectStore(STORES.PRODUCTS);
  const request = store.getAll();
  
  request.onsuccess = () => {
    const filtered = request.result.filter(product =>
      product.name.toLowerCase().includes(query) ||
      product.code.toLowerCase().includes(query) ||
      product.category.toLowerCase().includes(query)
    );
    
    const tbody = document.getElementById('products-list');
    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">Tidak ada produk yang cocok</td></tr>';
      return;
    }
    
    filtered.forEach(product => {
      const row = document.createElement('tr');
      
      row.innerHTML = `
                <td>${product.code}</td>
                <td>${product.name}</td>
                <td>${product.category}</td>
                <td>${formatCurrencySync(product.price)}</td>
                <td>${product.stock}</td>
                <td>
                    <button class="btn-edit" data-id="${product.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-delete" data-id="${product.id}">
                        <i class="fas fa-trash"></i> Hapus
                    </button>
                </td>
            `;
      
      tbody.appendChild(row);
    });
  };
}

// Show product form
function showProductForm(id = null) {
  const modal = document.getElementById('product-modal');
  const form = document.getElementById('product-form');
  const title = document.getElementById('product-modal-title');
  
  // Reset form and clear errors
  form.reset();
  clearFormErrors('product-form');
  
  if (id) {
    title.innerHTML = '<i class="fas fa-edit"></i> Edit Produk';
    getRecord(STORES.PRODUCTS, id).then(product => {
      if (product) {
        document.getElementById('product-id').value = product.id;
        document.getElementById('product-code').value = product.code;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-category').value = product.category;
        document.getElementById('product-price').value = product.price;
        document.getElementById('product-cost').value = product.cost;
        document.getElementById('product-stock').value = product.stock;
        document.getElementById('product-min-stock').value = product.minStock;
        document.getElementById('product-supplier').value = product.supplierId || '';
        
        modal.classList.remove('hidden');
        document.getElementById('product-code').focus();
      }
    }).catch(err => {
      console.error('Error loading product:', err);
      showToast('Gagal memuat data produk', 'error');
    });
  } else {
    title.innerHTML = '<i class="fas fa-plus"></i> Tambah Produk Baru';
    document.getElementById('product-id').value = '';
    modal.classList.remove('hidden');
    setTimeout(() => {
      document.getElementById('product-code').focus();
    }, 100);
  }
  
  // Load suppliers for dropdown
  loadSuppliersForDropdown();
}

// Clear form errors
function clearFormErrors(formId) {
  const form = document.getElementById(formId);
  const errorMessages = form.querySelectorAll('.error-message');
  errorMessages.forEach(el => {
    el.textContent = '';
    el.style.display = 'none';
  });
  
  const inputs = form.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    input.classList.remove('error');
  });
}

// Load suppliers for dropdown
function loadSuppliersForDropdown() {
  const dropdown = document.getElementById('product-supplier');
  dropdown.innerHTML = '<option value="">Pilih Supplier</option>';
  
  const transaction = db.transaction(STORES.SUPPLIERS, 'readonly');
  const store = transaction.objectStore(STORES.SUPPLIERS);
  const request = store.getAll();
  
  request.onsuccess = () => {
    request.result.forEach(supplier => {
      const option = document.createElement('option');
      option.value = supplier.id;
      option.textContent = supplier.name;
      dropdown.appendChild(option);
    });
  };
}

// Validate product form
function validateProductForm() {
  let isValid = true;
  const form = document.getElementById('product-form');
  
  // Validate code
  const code = document.getElementById('product-code').value.trim();
  if (!code) {
    showError('code-error', 'Kode produk wajib diisi');
    isValid = false;
  }
  
  // Validate name
  const name = document.getElementById('product-name').value.trim();
  if (!name) {
    showError('name-error', 'Nama produk wajib diisi');
    isValid = false;
  }
  
  // Validate category
  const category = document.getElementById('product-category').value.trim();
  if (!category) {
    showError('category-error', 'Kategori wajib diisi');
    isValid = false;
  }
  
  // Validate price
  const price = parseFloat(document.getElementById('product-price').value);
  if (isNaN(price)) {
    showError('price-error', 'Harga jual wajib diisi');
    isValid = false;
  } else if (price < 0) {
    showError('price-error', 'Harga jual tidak boleh negatif');
    isValid = false;
  }
  
  // Validate cost
  const cost = parseFloat(document.getElementById('product-cost').value);
  if (isNaN(cost)) {
    showError('cost-error', 'Harga beli wajib diisi');
    isValid = false;
  } else if (cost < 0) {
    showError('cost-error', 'Harga beli tidak boleh negatif');
    isValid = false;
  }
  
  // Validate stock
  const stock = parseInt(document.getElementById('product-stock').value);
  if (isNaN(stock)) {
    showError('stock-error', 'Stok wajib diisi');
    isValid = false;
  } else if (stock < 0) {
    showError('stock-error', 'Stok tidak boleh negatif');
    isValid = false;
  }
  
  // Validate min stock
  const minStock = parseInt(document.getElementById('product-min-stock').value);
  if (isNaN(minStock)) {
    showError('min-stock-error', 'Stok minimum wajib diisi');
    isValid = false;
  } else if (minStock < 0) {
    showError('min-stock-error', 'Stok minimum tidak boleh negatif');
    isValid = false;
  }
  
  return isValid;
}

// Show error message
function showError(elementId, message) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.style.display = 'block';
  
  // Highlight the input field
  const inputId = elementId.replace('-error', '');
  const input = document.getElementById(inputId);
  if (input) {
    input.classList.add('error');
    input.focus();
  }
}

// Save product
function saveProduct(e) {
  e.preventDefault();
  
  // Validate form
  if (!validateProductForm()) {
    return;
  }
  
  const id = document.getElementById('product-id').value;
  const product = {
    code: document.getElementById('product-code').value.trim(),
    name: document.getElementById('product-name').value.trim(),
    category: document.getElementById('product-category').value.trim(),
    price: parseFloat(document.getElementById('product-price').value),
    cost: parseFloat(document.getElementById('product-cost').value),
    stock: parseInt(document.getElementById('product-stock').value),
    minStock: parseInt(document.getElementById('product-min-stock').value),
    supplierId: document.getElementById('product-supplier').value || null,
    updatedAt: new Date()
  };
  
  if (id) {
    // Update existing product
    product.id = parseInt(id);
    updateRecord(STORES.PRODUCTS, product).then(() => {
      showToast('Produk berhasil diperbarui', 'success');
      document.getElementById('product-modal').classList.add('hidden');
      loadProducts();
      loadDashboard();
      loadCashierProducts();
    }).catch(err => {
      console.error('Error updating product:', err);
      showToast('Gagal memperbarui produk', 'error');
    });
  } else {
    // Add new product
    product.createdAt = new Date();
    addRecord(STORES.PRODUCTS, product).then(() => {
      showToast('Produk berhasil ditambahkan', 'success');
      document.getElementById('product-modal').classList.add('hidden');
      loadProducts();
      loadDashboard();
      loadCashierProducts();
    }).catch(err => {
      console.error('Error adding product:', err);
      if (err.name === 'ConstraintError') {
        showError('code-error', 'Kode produk sudah digunakan');
      } else {
        showToast('Gagal menambahkan produk', 'error');
      }
    });
  }
}

// Delete product
function deleteProduct(id) {
  if (confirm('Apakah Anda yakin ingin menghapus produk ini?')) {
    deleteRecord(STORES.PRODUCTS, id).then(() => {
      showToast('Produk berhasil dihapus', 'success');
      loadProducts();
      loadDashboard();
      loadCashierProducts();
    }).catch(err => {
      console.error('Error deleting product:', err);
      showToast('Gagal menghapus produk', 'error');
    });
  }
}

// ==================== CASHIER ====================

let cart = [];

// Load products for cashier
function loadCashierProducts() {
  const transaction = db.transaction(STORES.PRODUCTS, 'readonly');
  const store = transaction.objectStore(STORES.PRODUCTS);
  const request = store.getAll();
  
  request.onsuccess = () => {
    const container = document.getElementById('cashier-products');
    container.innerHTML = '';
    
    if (request.result.length === 0) {
      container.innerHTML = '<p class="no-products">Tidak ada produk</p>';
      return;
    }
    
    request.result.forEach(product => {
      if (product.stock > 0) {
        const item = document.createElement('div');
        item.className = 'product-item';
        item.setAttribute('data-id', product.id);
        item.setAttribute('title', `${product.name} - ${formatCurrencySync(product.price)}`);
        
        item.innerHTML = `
                    <div class="product-name">${product.name}</div>
                    <div class="product-price">${formatCurrencySync(product.price)}</div>
                    <div class="product-stock">Stok: ${product.stock}</div>
                `;
        
        item.addEventListener('click', () => addToCart(product));
        container.appendChild(item);
      }
    });
  };
}

// Search products in cashier
function searchCashierProducts() {
  const query = document.getElementById('cashier-search').value.toLowerCase();
  const transaction = db.transaction(STORES.PRODUCTS, 'readonly');
  const store = transaction.objectStore(STORES.PRODUCTS);
  const request = store.getAll();
  
  request.onsuccess = () => {
    const filtered = request.result.filter(product =>
      (product.name.toLowerCase().includes(query) ||
        product.code.toLowerCase().includes(query)) &&
      product.stock > 0
    );
    
    const container = document.getElementById('cashier-products');
    container.innerHTML = '';
    
    if (filtered.length === 0) {
      container.innerHTML = '<p class="no-products">Tidak ada produk yang cocok</p>';
      return;
    }
    
    filtered.forEach(product => {
      const item = document.createElement('div');
      item.className = 'product-item';
      item.setAttribute('data-id', product.id);
      item.setAttribute('title', `${product.name} - ${formatCurrencySync(product.price)}`);
      
      item.innerHTML = `
                <div class="product-name">${product.name}</div>
                <div class="product-price">${formatCurrencySync(product.price)}</div>
                <div class="product-stock">Stok: ${product.stock}</div>
            `;
      
      item.addEventListener('click', () => addToCart(product));
      container.appendChild(item);
    });
  };
}

// Add product to cart
function addToCart(product) {
  const existingItem = cart.find(item => item.id === product.id);
  
  if (existingItem) {
    if (existingItem.quantity < product.stock) {
      existingItem.quantity += 1;
      showToast(`Menambah jumlah ${product.name} di keranjang`, 'success');
    } else {
      showToast('Stok produk tidak mencukupi', 'warning');
      return;
    }
  } else {
    if (product.stock > 0) {
      cart.push({
        id: product.id,
        code: product.code,
        name: product.name,
        price: product.price,
        quantity: 1,
        stock: product.stock
      });
      showToast(`${product.name} ditambahkan ke keranjang`, 'success');
    } else {
      showToast('Stok produk habis', 'warning');
      return;
    }
  }
  
  updateCart();
}

// Update cart display
function updateCart() {
  const container = document.getElementById('cart-items');
  container.innerHTML = '';
  
  if (cart.length === 0) {
    container.innerHTML = '<p class="empty-cart">Keranjang kosong</p>';
    updateCartSummary();
    return;
  }
  
  cart.forEach(item => {
    const cartItem = document.createElement('div');
    cartItem.className = 'cart-item';
    
    cartItem.innerHTML = `
            <div class="cart-item-info">
                <div class="item-name">${item.name}</div>
                <div class="item-price">${formatCurrencySync(item.price)}</div>
            </div>
            <div class="cart-item-actions">
                <button class="btn-decrease" data-id="${item.id}" title="Kurangi">
                    <i class="fas fa-minus"></i>
                </button>
                <input type="number" class="item-quantity" value="${item.quantity}" min="1" max="${item.stock}" data-id="${item.id}">
                <button class="btn-increase" data-id="${item.id}" title="Tambah">
                    <i class="fas fa-plus"></i>
                </button>
                <button class="btn-remove" data-id="${item.id}" title="Hapus">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="item-total">${formatCurrencySync(item.price * item.quantity)}</div>
        `;
    
    container.appendChild(cartItem);
  });
  
  // Add event listeners
  document.querySelectorAll('.btn-decrease').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.target.closest('button').getAttribute('data-id'));
      decreaseQuantity(id);
    });
  });
  
  document.querySelectorAll('.btn-increase').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.target.closest('button').getAttribute('data-id'));
      increaseQuantity(id);
    });
  });
  
  document.querySelectorAll('.item-quantity').forEach(input => {
    input.addEventListener('change', (e) => {
      const id = parseInt(e.target.getAttribute('data-id'));
      const quantity = parseInt(e.target.value);
      updateQuantity(id, quantity);
    });
  });
  
  document.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.target.closest('button').getAttribute('data-id'));
      removeFromCart(id);
    });
  });
  
  updateCartSummary();
}

// Update cart summary
function updateCartSummary() {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  formatCurrency(subtotal).then(formatted => {
    document.getElementById('subtotal').textContent = formatted;
  });
  
  calculateTotal();
}

// Calculate total with discount and tax
function calculateTotal() {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  let total = subtotal;
  
  // Apply discount if enabled
  const discountToggle = document.getElementById('discount-toggle');
  const discountValue = document.getElementById('discount-value');
  
  if (discountToggle.checked && discountValue.value > 0) {
    const discount = subtotal * (parseFloat(discountValue.value) / 100);
    total -= discount;
  }
  
  // Apply tax if enabled
  const taxToggle = document.getElementById('tax-toggle');
  const taxValue = document.getElementById('tax-value');
  
  if (taxToggle.checked && taxValue.value > 0) {
    const tax = total * (parseFloat(taxValue.value) / 100);
    total += tax;
  }
  
  formatCurrency(total).then(formatted => {
    document.getElementById('total-amount').textContent = formatted;
  });
  
  // Update change if amount received is set
  calculateChange();
}

// Toggle discount
function toggleDiscount() {
  const discountValue = document.getElementById('discount-value');
  discountValue.disabled = !document.getElementById('discount-toggle').checked;
  
  if (discountValue.disabled) {
    discountValue.value = '';
  } else {
    discountValue.value = '10'; // Default discount 10%
    discountValue.focus();
  }
  
  calculateTotal();
}

// Toggle tax
function toggleTax() {
  const taxValue = document.getElementById('tax-value');
  taxValue.disabled = !document.getElementById('tax-toggle').checked;
  
  if (taxValue.disabled) {
    taxValue.value = '';
  } else {
    getRecord(STORES.SETTINGS, 'taxRate').then(settings => {
      taxValue.value = settings ? settings.value : '10';
      taxValue.focus();
      calculateTotal();
    });
  }
}

// Calculate change
function calculateChange() {
  const amountReceived = parseFloat(document.getElementById('amount-received').value) || 0;
  const totalText = document.getElementById('total-amount').textContent;
  const total = parseFloat(totalText.replace(/[^\d]/g, '')) || 0;
  
  const change = amountReceived - total;
  document.getElementById('change').value = change >= 0 ? change.toFixed(2) : '';
}

// Increase item quantity
function increaseQuantity(id) {
  const item = cart.find(item => item.id === id);
  if (item) {
    if (item.quantity < item.stock) {
      item.quantity += 1;
      updateCart();
    } else {
      showToast('Stok produk tidak mencukupi', 'warning');
    }
  }
}

// Decrease item quantity
function decreaseQuantity(id) {
  const item = cart.find(item => item.id === id);
  if (item && item.quantity > 1) {
    item.quantity -= 1;
    updateCart();
  }
}

// Update item quantity
function updateQuantity(id, quantity) {
  if (quantity < 1) {
    removeFromCart(id);
    return;
  }
  
  const item = cart.find(item => item.id === id);
  if (item) {
    if (quantity <= item.stock) {
      item.quantity = quantity;
      updateCart();
    } else {
      showToast('Stok produk tidak mencukupi', 'warning');
      // Reset to max available
      item.quantity = item.stock;
      updateCart();
    }
  }
}

// Remove item from cart
function removeFromCart(id) {
  const itemIndex = cart.findIndex(item => item.id === id);
  if (itemIndex !== -1) {
    const itemName = cart[itemIndex].name;
    cart.splice(itemIndex, 1);
    updateCart();
    showToast(`${itemName} dihapus dari keranjang`, 'info');
  }
}

// Clear cart
function clearCart() {
  if (cart.length > 0 && confirm('Apakah Anda yakin ingin mengosongkan keranjang?')) {
    cart = [];
    updateCart();
    showToast('Keranjang dikosongkan', 'info');
  }
}

// Process payment
function processPayment() {
  if (cart.length === 0) {
    showToast('Keranjang belanja kosong', 'warning');
    return;
  }
  
  const paymentMethod = document.getElementById('payment-method').value;
  const amountReceived = parseFloat(document.getElementById('amount-received').value) || 0;
  const totalText = document.getElementById('total-amount').textContent;
  const total = parseFloat(totalText.replace(/[^\d]/g, '')) || 0;
  
  if (amountReceived < total) {
    showToast('Jumlah pembayaran kurang', 'danger');
    return;
  }
  
  // Calculate subtotal, discount, tax
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  let discount = 0;
  let tax = 0;
  
  if (document.getElementById('discount-toggle').checked) {
    discount = subtotal * (parseFloat(document.getElementById('discount-value').value) / 100);
  }
  
  if (document.getElementById('tax-toggle').checked) {
    tax = (subtotal - discount) * (parseFloat(document.getElementById('tax-value').value) / 100);
  }
  
  // Create transaction
  const transaction = {
    invoice: document.getElementById('current-invoice').textContent,
    date: new Date(),
    items: cart.map(item => ({
      productId: item.id,
      code: item.code,
      name: item.name,
      price: item.price,
      quantity: item.quantity
    })),
    subtotal,
    discount,
    tax,
    total,
    paymentMethod,
    amountReceived,
    change: amountReceived - total
  };
  
  // Save transaction
  addRecord(STORES.TRANSACTIONS, transaction).then(() => {
    // Update product stocks
    const productUpdates = cart.map(item => {
      return getRecord(STORES.PRODUCTS, item.id).then(product => {
        product.stock -= item.quantity;
        return updateRecord(STORES.PRODUCTS, product);
      });
    });
    
    Promise.all(productUpdates).then(() => {
      // Show success
      showToast('Pembayaran berhasil diproses', 'success');
      
      // Print receipt
      printReceipt(transaction);
      
      // Clear cart
      cart = [];
      updateCart();
      document.getElementById('amount-received').value = '';
      document.getElementById('change').value = '';
      document.getElementById('discount-toggle').checked = false;
      document.getElementById('tax-toggle').checked = false;
      document.getElementById('discount-value').value = '';
      document.getElementById('discount-value').disabled = true;
      document.getElementById('tax-value').value = '';
      document.getElementById('tax-value').disabled = true;
      
      // Generate new invoice number
      generateInvoiceNumberDisplay();
      
      // Reload dashboard and products
      loadDashboard();
      loadCashierProducts();
    });
  }).catch(err => {
    console.error('Error processing payment:', err);
    showToast('Gagal memproses pembayaran', 'error');
  });
}

// Generate invoice number
function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  
  return `INV-${year}${month}${day}-${hours}${minutes}${seconds}`;
}

// Print receipt
function printReceipt(transaction) {
  // In a real app, this would open a print dialog with a formatted receipt
  // For this example, we'll just show the receipt in an alert
  
  let receipt = `=== STRUK PEMBAYARAN ===\n`;
  receipt += `No. Invoice: ${transaction.invoice}\n`;
  receipt += `Tanggal: ${new Date(transaction.date).toLocaleString('id-ID')}\n\n`;
  receipt += `ITEM\tQTY\tHARGA\n`;
  
  transaction.items.forEach(item => {
    receipt += `${item.name}\t${item.quantity}\t${formatCurrencySync(item.price * item.quantity)}\n`;
  });
  
  receipt += `\nSubtotal: ${formatCurrencySync(transaction.subtotal)}\n`;
  if (transaction.discount > 0) {
    receipt += `Diskon: -${formatCurrencySync(transaction.discount)}\n`;
  }
  if (transaction.tax > 0) {
    receipt += `Pajak: +${formatCurrencySync(transaction.tax)}\n`;
  }
  receipt += `TOTAL: ${formatCurrencySync(transaction.total)}\n\n`;
  receipt += `Pembayaran: ${transaction.paymentMethod.toUpperCase()}\n`;
  receipt += `Diterima: ${formatCurrencySync(transaction.amountReceived)}\n`;
  receipt += `Kembalian: ${formatCurrencySync(transaction.change)}\n\n`;
  receipt += `Terima kasih telah berbelanja!`;
  
  // In a real app, you would use window.print() with a styled receipt
  console.log(receipt);
  alert(receipt);
}

// ==================== REPORTS ====================

// Setup report dates
function setupReportDates() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('report-date').value = today;
  document.getElementById('start-date').value = today;
  document.getElementById('end-date').value = today;
  
  changeReportType();
}

// Change report type
function changeReportType() {
  const type = document.getElementById('report-type').value;
  
  document.getElementById('daily-filter').classList.toggle('hidden', type !== 'daily');
  document.getElementById('custom-filter').classList.toggle('hidden', type !== 'custom');
}

// Generate report
function generateReport() {
  const type = document.getElementById('report-type').value;
  let startDate, endDate;
  
  if (type === 'daily') {
    const date = new Date(document.getElementById('report-date').value);
    startDate = new Date(date.setHours(0, 0, 0, 0));
    endDate = new Date(date.setHours(23, 59, 59, 999));
  } else if (type === 'custom') {
    startDate = new Date(document.getElementById('start-date').value);
    endDate = new Date(document.getElementById('end-date').value);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
  } else {
    // Weekly, monthly, yearly
    const now = new Date();
    
    if (type === 'weekly') {
      startDate = new Date(now.setDate(now.getDate() - now.getDay()));
      endDate = new Date(now.setDate(now.getDate() + 6));
    } else if (type === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (type === 'yearly') {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
    }
    
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
  }
  
  // Get transactions in date range
  const transaction = db.transaction(STORES.TRANSACTIONS, 'readonly');
  const store = transaction.objectStore(STORES.TRANSACTIONS);
  const index = store.index('date');
  const range = IDBKeyRange.bound(startDate, endDate);
  const request = index.getAll(range);
  
  request.onsuccess = () => {
    const transactions = request.result;
    
    // Update summary
    const totalSales = transactions.reduce((sum, t) => sum + t.total, 0);
    const totalItems = transactions.reduce((sum, t) => sum + t.items.reduce((s, i) => s + i.quantity, 0), 0);
    
    formatCurrency(totalSales).then(formatted => {
      document.getElementById('report-total-sales').textContent = formatted;
    });
    
    document.getElementById('report-total-transactions').textContent = transactions.length;
    document.getElementById('report-total-items').textContent = totalItems;
    
    // Update transactions list
    const tbody = document.getElementById('transactions-list');
    tbody.innerHTML = '';
    
    if (transactions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">Tidak ada transaksi</td></tr>';
      return;
    }
    
    transactions.reverse().forEach(t => {
      const row = document.createElement('tr');
      
      row.innerHTML = `
                <td>${t.invoice}</td>
                <td>${new Date(t.date).toLocaleString('id-ID')}</td>
                <td>${t.items.length} item(s)</td>
                <td>${formatCurrencySync(t.total)}</td>
                <td>${t.paymentMethod}</td>
                <td>
                    <button class="btn-view" data-id="${t.id}">
                        <i class="fas fa-eye"></i> Lihat
                    </button>
                </td>
            `;
      
      tbody.appendChild(row);
    });
  };
}

// View transaction details
function viewTransactionDetails(id) {
  getRecord(STORES.TRANSACTIONS, id).then(transaction => {
    if (transaction) {
      let details = `=== DETAIL TRANSAKSI ===\n`;
      details += `No. Invoice: ${transaction.invoice}\n`;
      details += `Tanggal: ${new Date(transaction.date).toLocaleString('id-ID')}\n\n`;
      details += `ITEM\tQTY\tHARGA\n`;
      
      transaction.items.forEach(item => {
        details += `${item.name}\t${item.quantity}\t${formatCurrencySync(item.price * item.quantity)}\n`;
      });
      
      details += `\nSubtotal: ${formatCurrencySync(transaction.subtotal)}\n`;
      if (transaction.discount > 0) {
        details += `Diskon: -${formatCurrencySync(transaction.discount)}\n`;
      }
      if (transaction.tax > 0) {
        details += `Pajak: +${formatCurrencySync(transaction.tax)}\n`;
      }
      details += `TOTAL: ${formatCurrencySync(transaction.total)}\n\n`;
      details += `Pembayaran: ${transaction.paymentMethod.toUpperCase()}\n`;
      details += `Diterima: ${formatCurrencySync(transaction.amountReceived)}\n`;
      details += `Kembalian: ${formatCurrencySync(transaction.change)}`;
      
      alert(details);
    }
  });
}

// Export to PDF
function exportPDF() {
  showToast('Fitur export PDF akan diimplementasikan', 'info');
}

// Export to Excel
function exportExcel() {
  showToast('Fitur export Excel akan diimplementasikan', 'info');
}

// ==================== SUPPLIERS ====================

// Load suppliers
function loadSuppliers() {
  const transaction = db.transaction(STORES.SUPPLIERS, 'readonly');
  const store = transaction.objectStore(STORES.SUPPLIERS);
  const request = store.getAll();
  
  request.onsuccess = () => {
    const tbody = document.getElementById('suppliers-list');
    tbody.innerHTML = '';
    
    if (request.result.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">Tidak ada supplier</td></tr>';
      return;
    }
    
    request.result.forEach(supplier => {
      const row = document.createElement('tr');
      
      row.innerHTML = `
                <td>${supplier.code}</td>
                <td>${supplier.name}</td>
                <td>${supplier.contact}</td>
                <td>${supplier.address.substring(0, 30)}${supplier.address.length > 30 ? '...' : ''}</td>
                <td>
                    <button class="btn-edit" data-id="${supplier.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-delete" data-id="${supplier.id}">
                        <i class="fas fa-trash"></i> Hapus
                    </button>
                </td>
            `;
      
      tbody.appendChild(row);
    });
  };
}

// Search suppliers
function searchSuppliers() {
  const query = document.getElementById('supplier-search').value.toLowerCase();
  const transaction = db.transaction(STORES.SUPPLIERS, 'readonly');
  const store = transaction.objectStore(STORES.SUPPLIERS);
  const request = store.getAll();
  
  request.onsuccess = () => {
    const filtered = request.result.filter(supplier =>
      supplier.name.toLowerCase().includes(query) ||
      supplier.code.toLowerCase().includes(query) ||
      supplier.contact.toLowerCase().includes(query)
    );
    
    const tbody = document.getElementById('suppliers-list');
    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">Tidak ada supplier yang cocok</td></tr>';
      return;
    }
    
    filtered.forEach(supplier => {
      const row = document.createElement('tr');
      
      row.innerHTML = `
                <td>${supplier.code}</td>
                <td>${supplier.name}</td>
                <td>${supplier.contact}</td>
                <td>${supplier.address.substring(0, 30)}${supplier.address.length > 30 ? '...' : ''}</td>
                <td>
                    <button class="btn-edit" data-id="${supplier.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-delete" data-id="${supplier.id}">
                        <i class="fas fa-trash"></i> Hapus
                    </button>
                </td>
            `;
      
      tbody.appendChild(row);
    });
  };
}

// Show supplier form
function showSupplierForm(id = null) {
  const modal = document.getElementById('supplier-modal');
  const form = document.getElementById('supplier-form');
  const title = document.getElementById('supplier-modal-title');
  
  // Reset form and clear errors
  form.reset();
  clearFormErrors('supplier-form');
  
  if (id) {
    title.innerHTML = '<i class="fas fa-edit"></i> Edit Supplier';
    getRecord(STORES.SUPPLIERS, id).then(supplier => {
      if (supplier) {
        document.getElementById('supplier-id').value = supplier.id;
        document.getElementById('supplier-code').value = supplier.code;
        document.getElementById('supplier-name').value = supplier.name;
        document.getElementById('supplier-contact').value = supplier.contact;
        document.getElementById('supplier-address').value = supplier.address;
        document.getElementById('supplier-email').value = supplier.email || '';
        document.getElementById('supplier-phone').value = supplier.phone || '';
        
        modal.classList.remove('hidden');
        document.getElementById('supplier-code').focus();
      }
    });
  } else {
    title.innerHTML = '<i class="fas fa-plus"></i> Tambah Supplier Baru';
    document.getElementById('supplier-id').value = '';
    modal.classList.remove('hidden');
    setTimeout(() => {
      document.getElementById('supplier-code').focus();
    }, 100);
  }
}

// Validate supplier form
function validateSupplierForm() {
  let isValid = true;
  
  // Validate code
  const code = document.getElementById('supplier-code').value.trim();
  if (!code) {
    showError('supplier-code-error', 'Kode supplier wajib diisi');
    isValid = false;
  }
  
  // Validate name
  const name = document.getElementById('supplier-name').value.trim();
  if (!name) {
    showError('supplier-name-error', 'Nama supplier wajib diisi');
    isValid = false;
  }
  
  // Validate contact
  const contact = document.getElementById('supplier-contact').value.trim();
  if (!contact) {
    showError('supplier-contact-error', 'Kontak wajib diisi');
    isValid = false;
  }
  
  // Validate address
  const address = document.getElementById('supplier-address').value.trim();
  if (!address) {
    showError('supplier-address-error', 'Alamat wajib diisi');
    isValid = false;
  }
  
  return isValid;
}

// Save supplier
function saveSupplier(e) {
  e.preventDefault();
  
  // Validate form
  if (!validateSupplierForm()) {
    return;
  }
  
  const id = document.getElementById('supplier-id').value;
  const supplier = {
    code: document.getElementById('supplier-code').value.trim(),
    name: document.getElementById('supplier-name').value.trim(),
    contact: document.getElementById('supplier-contact').value.trim(),
    address: document.getElementById('supplier-address').value.trim(),
    email: document.getElementById('supplier-email').value.trim() || null,
    phone: document.getElementById('supplier-phone').value.trim() || null,
    updatedAt: new Date()
  };
  
  if (id) {
    // Update existing supplier
    supplier.id = parseInt(id);
    updateRecord(STORES.SUPPLIERS, supplier).then(() => {
      showToast('Supplier berhasil diperbarui', 'success');
      document.getElementById('supplier-modal').classList.add('hidden');
      loadSuppliers();
      loadSuppliersForDropdown();
    }).catch(err => {
      console.error('Error updating supplier:', err);
      showToast('Gagal memperbarui supplier', 'error');
    });
  } else {
    // Add new supplier
    supplier.createdAt = new Date();
    addRecord(STORES.SUPPLIERS, supplier).then(() => {
      showToast('Supplier berhasil ditambahkan', 'success');
      document.getElementById('supplier-modal').classList.add('hidden');
      loadSuppliers();
      loadSuppliersForDropdown();
    }).catch(err => {
      console.error('Error adding supplier:', err);
      if (err.name === 'ConstraintError') {
        showError('supplier-code-error', 'Kode supplier sudah digunakan');
      } else {
        showToast('Gagal menambahkan supplier', 'error');
      }
    });
  }
}

// Delete supplier
function deleteSupplier(id) {
  if (confirm('Apakah Anda yakin ingin menghapus supplier ini?')) {
    // Check if any products are using this supplier
    const transaction = db.transaction(STORES.PRODUCTS, 'readonly');
    const store = transaction.objectStore(STORES.PRODUCTS);
    const index = store.index('supplierId');
    const request = index.count(id);
    
    request.onsuccess = () => {
      if (request.result > 0) {
        showToast('Tidak dapat menghapus supplier karena ada produk yang terkait', 'error');
      } else {
        deleteRecord(STORES.SUPPLIERS, id).then(() => {
          showToast('Supplier berhasil dihapus', 'success');
          loadSuppliers();
          loadSuppliersForDropdown();
        }).catch(err => {
          console.error('Error deleting supplier:', err);
          showToast('Gagal menghapus supplier', 'error');
        });
      }
    };
  }
}

// ==================== SETTINGS ====================

// Show settings tab
function showSettingsTab(tabId) {
  // Deactivate all tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Hide all tab panes
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });
  
  // Activate selected tab button
  document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
  
  // Show selected tab pane
  document.getElementById(tabId).classList.add('active');
  
  // Load settings if needed
  if (tabId === 'store-settings' || tabId === 'receipt-settings') {
    loadSettings();
  }
}

// Load settings
function loadSettings() {
  // Load store settings
  getRecord(STORES.SETTINGS, 'store').then(settings => {
    if (settings) {
      document.getElementById('store-name').value = settings.name;
      document.getElementById('store-address').value = settings.address;
      document.getElementById('store-phone').value = settings.phone || '';
      document.getElementById('store-email').value = settings.email || '';
      document.getElementById('store-tax-id').value = settings.taxId || '';
    }
  });
  
  // Load receipt settings
  getRecord(STORES.SETTINGS, 'receipt').then(settings => {
    if (settings) {
      document.getElementById('receipt-header').value = settings.header;
      document.getElementById('receipt-footer').value = settings.footer;
      document.getElementById('receipt-tax').checked = settings.showTax;
    }
  });
  
  // Load tax rate
  getRecord(STORES.SETTINGS, 'taxRate').then(settings => {
    if (settings) {
      document.getElementById('tax-value').value = settings.value;
    }
  });
}

// Validate store settings
function validateStoreSettings() {
  let isValid = true;
  
  // Validate store name
  const name = document.getElementById('store-name').value.trim();
  if (!name) {
    showError('store-name-error', 'Nama toko wajib diisi');
    isValid = false;
  }
  
  // Validate store address
  const address = document.getElementById('store-address').value.trim();
  if (!address) {
    showError('store-address-error', 'Alamat toko wajib diisi');
    isValid = false;
  }
  
  return isValid;
}

// Save store settings
function saveStoreSettings(e) {
  e.preventDefault();
  
  // Validate form
  if (!validateStoreSettings()) {
    return;
  }
  
  const settings = {
    id: 'store',
    name: document.getElementById('store-name').value.trim(),
    address: document.getElementById('store-address').value.trim(),
    phone: document.getElementById('store-phone').value.trim() || null,
    email: document.getElementById('store-email').value.trim() || null,
    taxId: document.getElementById('store-tax-id').value.trim() || null
  };
  
  updateRecord(STORES.SETTINGS, settings).then(() => {
    showToast('Pengaturan toko berhasil disimpan', 'success');
  }).catch(err => {
    console.error('Error saving store settings:', err);
    showToast('Gagal menyimpan pengaturan toko', 'error');
  });
}

// Save receipt settings
function saveReceiptSettings(e) {
  e.preventDefault();
  
  const settings = {
    id: 'receipt',
    header: document.getElementById('receipt-header').value.trim(),
    footer: document.getElementById('receipt-footer').value.trim(),
    showTax: document.getElementById('receipt-tax').checked
  };
  
  // Handle logo upload if needed
  const logoInput = document.getElementById('receipt-logo');
  if (logoInput.files.length > 0) {
    const file = logoInput.files[0];
    const reader = new FileReader();
    
    reader.onload = (e) => {
      settings.logo = e.target.result;
      updateRecord(STORES.SETTINGS, settings).then(() => {
        showToast('Pengaturan struk berhasil disimpan', 'success');
        document.getElementById('file-name').textContent = 'Belum ada file dipilih';
        logoInput.value = '';
      }).catch(err => {
        console.error('Error saving receipt settings:', err);
        showToast('Gagal menyimpan pengaturan struk', 'error');
      });
    };
    
    reader.readAsDataURL(file);
  } else {
    updateRecord(STORES.SETTINGS, settings).then(() => {
      showToast('Pengaturan struk berhasil disimpan', 'success');
    }).catch(err => {
      console.error('Error saving receipt settings:', err);
      showToast('Gagal menyimpan pengaturan struk', 'error');
    });
  }
}

// Backup data
function backupData() {
  const backup = {};
  const stores = [STORES.PRODUCTS, STORES.TRANSACTIONS, STORES.SUPPLIERS, STORES.SETTINGS];
  const promises = stores.map(store => {
    return new Promise((resolve) => {
      const transaction = db.transaction(store, 'readonly');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.getAll();
      
      request.onsuccess = () => {
        backup[store] = request.result;
        resolve();
      };
    });
  });
  
  Promise.all(promises).then(() => {
    const dataStr = JSON.stringify(backup, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportName = `kasir-pos-backup-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportName);
    linkElement.click();
    
    showToast('Backup data berhasil dibuat', 'success');
  }).catch(err => {
    console.error('Error creating backup:', err);
    showToast('Gagal membuat backup data', 'error');
  });
}

// Restore data
function restoreData() {
  const fileInput = document.getElementById('restore-file');
  
  if (fileInput.files.length === 0) {
    showToast('Pilih file backup terlebih dahulu', 'warning');
    return;
  }
  
  if (!confirm('Restore data akan mengganti semua data yang ada. Lanjutkan?')) {
    return;
  }
  
  const file = fileInput.files[0];
  const reader = new FileReader();
  
  reader.onload = (e) => {
    try {
      const backup = JSON.parse(e.target.result);
      const stores = [STORES.PRODUCTS, STORES.TRANSACTIONS, STORES.SUPPLIERS, STORES.SETTINGS];
      
      // Clear existing data first
      const clearPromises = stores.map(store => {
        return new Promise((resolve) => {
          const transaction = db.transaction(store, 'readwrite');
          const objectStore = transaction.objectStore(store);
          const request = objectStore.clear();
          
          request.onsuccess = () => resolve();
        });
      });
      
      Promise.all(clearPromises).then(() => {
        // Restore data
        const restorePromises = stores.map(store => {
          if (backup[store]) {
            return new Promise((resolve) => {
              const transaction = db.transaction(store, 'readwrite');
              const objectStore = transaction.objectStore(store);
              
              backup[store].forEach(item => {
                objectStore.add(item);
              });
              
              transaction.oncomplete = () => resolve();
            });
          }
          return Promise.resolve();
        });
        
        Promise.all(restorePromises).then(() => {
          showToast('Data berhasil direstore', 'success');
          document.getElementById('restore-file-name').textContent = 'Belum ada file dipilih';
          fileInput.value = '';
          
          // Reload all pages
          loadDashboard();
          loadProducts();
          loadSuppliers();
          loadSettings();
          loadCashierProducts();
        });
      });
    } catch (error) {
      console.error('Error processing backup file:', error);
      showToast('Gagal memproses file backup', 'error');
    }
  };
  
  reader.readAsText(file);
}

// Reset data
function resetData() {
  if (confirm('Reset akan menghapus SEMUA data dan mengembalikan ke pengaturan awal. Lanjutkan?')) {
    indexedDB.deleteDatabase(DB_NAME).then(() => {
      showToast('Aplikasi berhasil direset. Halaman akan dimuat ulang.', 'success');
      setTimeout(() => location.reload(), 2000);
    }).catch(err => {
      console.error('Error resetting database:', err);
      showToast('Gagal mereset aplikasi', 'error');
    });
  }
}

// ==================== DASHBOARD ====================

// Load dashboard
function loadDashboard() {
  // Load today's sales
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const transaction = db.transaction(STORES.TRANSACTIONS, 'readonly');
  const store = transaction.objectStore(STORES.TRANSACTIONS);
  const index = store.index('date');
  const range = IDBKeyRange.bound(today, tomorrow);
  const request = index.getAll(range);
  
  request.onsuccess = () => {
    const todaySales = request.result.reduce((sum, t) => sum + t.total, 0);
    formatCurrency(todaySales).then(formatted => {
      document.getElementById('today-sales').textContent = formatted;
    });
  };
  
  // Load total products
  const productTransaction = db.transaction(STORES.PRODUCTS, 'readonly');
  const productStore = productTransaction.objectStore(STORES.PRODUCTS);
  const productCount = productStore.count();
  
  productCount.onsuccess = () => {
    document.getElementById('total-products').textContent = productCount.result;
  };
  
  // Load out of stock products
  const outOfStockIndex = productStore.index('stock');
  const outOfStockCount = outOfStockIndex.count(0);
  
  outOfStockCount.onsuccess = () => {
    document.getElementById('out-of-stock').textContent = outOfStockCount.result;
  };
  
  // Load products that need restocking
  const restockRequest = productStore.getAll();
  
  restockRequest.onsuccess = () => {
    const restockProducts = restockRequest.result.filter(p => p.stock <= p.minStock);
    const container = document.getElementById('restock-products');
    container.innerHTML = '';
    
    if (restockProducts.length === 0) {
      container.innerHTML = '<p class="no-products">Tidak ada produk yang perlu restok</p>';
    } else {
      restockProducts.forEach(product => {
        const item = document.createElement('div');
        item.className = 'product-item';
        
        item.innerHTML = `
                    <div class="product-name">${product.name}</div>
                    <div class="product-stock">Stok: ${product.stock} (min: ${product.minStock})</div>
                `;
        
        container.appendChild(item);
      });
    }
  };
  
  // Load popular products (top 5 by sales)
  loadPopularProducts();
}

// Load popular products
function loadPopularProducts() {
  const transaction = db.transaction(STORES.TRANSACTIONS, 'readonly');
  const store = transaction.objectStore(STORES.TRANSACTIONS);
  const request = store.getAll();
  
  request.onsuccess = () => {
    const productSales = {};
    
    request.result.forEach(transaction => {
      transaction.items.forEach(item => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = 0;
        }
        productSales[item.productId] += item.quantity;
      });
    });
    
    // Sort by quantity sold
    const sortedProducts = Object.entries(productSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    // Get product details
    const productTransaction = db.transaction(STORES.PRODUCTS, 'readonly');
    const productStore = productTransaction.objectStore(STORES.PRODUCTS);
    
    const popularProducts = [];
    let productsLoaded = 0;
    
    if (sortedProducts.length === 0) {
      const container = document.getElementById('popular-products');
      container.innerHTML = '<p class="no-products">Tidak ada data penjualan</p>';
      return;
    }
    
    sortedProducts.forEach(([productId, quantity]) => {
      const productRequest = productStore.get(parseInt(productId));
      
      productRequest.onsuccess = () => {
        if (productRequest.result) {
          popularProducts.push({
            ...productRequest.result,
            quantitySold: quantity
          });
        }
        
        productsLoaded++;
        
        if (productsLoaded === sortedProducts.length) {
          displayPopularProducts(popularProducts);
        }
      };
    });
  };
}

// Display popular products
function displayPopularProducts(products) {
  const container = document.getElementById('popular-products');
  container.innerHTML = '';
  
  products.sort((a, b) => b.quantitySold - a.quantitySold);
  
  products.forEach(product => {
    const item = document.createElement('div');
    item.className = 'product-item';
    
    item.innerHTML = `
            <div class="product-name">${product.name}</div>
            <div class="product-sales">Terjual: ${product.quantitySold}</div>
        `;
    
    container.appendChild(item);
  });
}

// ==================== INDEXEDDB HELPER FUNCTIONS ====================

// Add a record to a store
function addRecord(storeName, record) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(record);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

// Get a record from a store
function getRecord(storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

// Update a record in a store
function updateRecord(storeName, record) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(record);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

// Delete a record from a store
function deleteRecord(storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

// ==================== PWA SETUP ====================

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(registration => {
      console.log('ServiceWorker registration successful');
    }).catch(err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);