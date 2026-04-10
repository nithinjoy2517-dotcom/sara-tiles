console.log("APP.JS STARTING - VERSION 2026");
const { useState, useEffect, useContext, createContext, useRef, useCallback } = React;
const AppContext = createContext();

// â”€â”€ GLOBAL VALIDATION UTILITIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const validate = (rules) => {
  const errors = {};
  rules.forEach(({ field, value, checks }) => {
    for (const check of checks) {
      if (check.test(value)) { errors[field] = check.msg; break; }
    }
  });
  return errors; // {} if all valid
};

const RULES = {
  required: (v) => !v || String(v).trim() === '',
  email: (v) => v && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v),
  phone: (v) => v && !/^\d{10}$/.test(v),
  minLen: (n) => (v) => v && String(v).trim().length < n,
  maxLen: (n) => (v) => v && String(v).trim().length > n,
  positive: (v) => v !== '' && v !== undefined && (isNaN(v) || parseFloat(v) <= 0),
  nonNegative: (v) => v !== '' && v !== undefined && (isNaN(v) || parseFloat(v) < 0),
  pincode: (v) => v && !/^\d{6}$/.test(v),
  url: (v) => v && !/^https?:\/\/.+/.test(v),
  password: (v) => v && String(v).length < 6,
};

function FieldError({ errors, field }) {
  if (!errors || !errors[field]) return null;
  return (
    <div style={{ color: '#ef4444', fontSize: '11px', fontWeight: 600, marginTop: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
      <i className="fas fa-exclamation-circle"></i> {errors[field]}
    </div>
  );
}

function useFormValidation() {
  const [errors, setErrors] = useState({});
  const hasError = (field) => !!errors[field];
  const inputStyle = (field, base = {}) => ({
    ...base,
    border: errors[field] ? '1.5px solid #ef4444' : (base.border || '1.5px solid #e2e8f0'),
    outline: 'none',
    transition: 'border 0.2s',
  });
  const clearError = (field) => setErrors(prev => { const n = {...prev}; delete n[field]; return n; });
  return { errors, setErrors, hasError, inputStyle, clearError };
}
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AppProvider({ children }) {
  // Professional State Initialization
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('sara_user')) || null);
  const [page, setPage] = useState('home');
  const [cart, setCart] = useState(() => {
    const u = JSON.parse(localStorage.getItem('sara_user'));
    const key = u && u.id ? `sara_cart_${u.id}` : 'sara_guest_cart';
    return JSON.parse(localStorage.getItem(key) || '[]');
  });
  const [toast, setToast] = useState(null);

  // Persistence Engine - STRICT USER ISOLATION
  useEffect(() => {
    // Determine the key based on the CURRENT user state in this closure
    const currentKey = user && user.id ? `sara_cart_${user.id}` : 'sara_guest_cart';
    
    // Safety Guard: We ONLY write to the key that matches the user state
    // This prevents "bleeding" during the 10ms window when user state and cart state are switching
    localStorage.setItem(currentKey, JSON.stringify(cart));
  }, [cart, user]);

  const login = (userData) => {
    // 1. Snapshot Guest Cart
    const guestCart = JSON.parse(localStorage.getItem('sara_guest_cart') || '[]');
    // 2. Load Target User Cart
    const userCart = JSON.parse(localStorage.getItem(`sara_cart_${userData.id}`) || '[]');

    // 3. Perform Professional Merge
    const merged = [...userCart];
    guestCart.forEach(gItem => {
      const exists = merged.find(u => u.id === gItem.id);
      if (exists) exists.qty += gItem.qty;
      else merged.push(gItem);
    });

    // 4. Atomic Storage Update
    localStorage.setItem(`sara_cart_${userData.id}`, JSON.stringify(merged));
    localStorage.removeItem('sara_guest_cart');
    localStorage.setItem('sara_user', JSON.stringify(userData));

    // 5. Atomic State Update
    setCart(merged);
    setUser(userData);
    setPage('dashboard');
  };

  const updateUser = (userData) => {
    const newUser = { ...user, ...userData };
    localStorage.setItem('sara_user', JSON.stringify(newUser));
    setUser(newUser);
  };

  const logout = () => {
    // Switch to Guest Cart IMMEDIATELY to vacate user-specific memory
    const guestCart = JSON.parse(localStorage.getItem('sara_guest_cart') || '[]');
    setCart(guestCart);
    
    // Clear the server session and local user state
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    localStorage.removeItem('sara_user');
    setUser(null);
    setPage('home');
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const addToCart = (product, quantity = 1) => {
    const qCount = parseInt(quantity);
    if (isNaN(qCount) || qCount <= 0) return;

    const exists = cart.find(i => i.id === product.id);
    const newTotal = (exists ? exists.qty : 0) + qCount;

    if (newTotal > product.stock_quantity) {
      showToast(`Cannot add more ${product.name}. Only ${product.stock_quantity} available in stock.`, 'error');
      return;
    }

    setCart(prev => {
      const existsInPrev = prev.find(i => i.id === product.id);
      if (existsInPrev) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + qCount } : i);
      return [...prev, { ...product, qty: qCount }];
    });
    showToast(`${product.name} added to your workspace portfolio.`);
  };

  const [isLoginOpen, setLoginOpen] = useState(false);
  const [isRegisterOpen, setRegisterOpen] = useState(false);
  const [isInquiryOpen, setInquiryOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);

  return (
    <AppContext.Provider value={{
      user, login, logout, updateUser, page, setPage,
      cart, setCart, addToCart, toast, showToast,
      isLoginOpen, setLoginOpen, isRegisterOpen, setRegisterOpen,
      isInquiryOpen, setInquiryOpen, selectedService, setSelectedService
    }}>
      {children}
    </AppContext.Provider>
  );
}

// â”€â”€ Components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Navbar() {
  const { user, page, setPage, logout, setLoginOpen, setRegisterOpen } = useContext(AppContext);
  // Navbar is transparent on home page, solid elsewhere
  const navClass = page === 'home' ? 'navbar' : 'navbar solid';
  return (
    <nav className={navClass}>
      <div className="container">
        <a href="#" className="nav-brand" onClick={() => setPage('home')}>Sara<span>.</span></a>
        <div className="nav-links">
          <a href="#" onClick={(e) => { e.preventDefault(); setPage('home'); }} className={page === 'home' ? 'active' : ''}>Home</a>
          <a href="#" onClick={(e) => { e.preventDefault(); setPage('products'); }} className={page === 'products' ? 'active' : ''}>Products</a>
          <a href="#" onClick={(e) => { e.preventDefault(); setPage('services'); }} className={page === 'services' ? 'active' : ''}>Services</a>
          {user ? (
            <React.Fragment>
              <a href="#" onClick={(e) => { e.preventDefault(); setPage('dashboard'); }} className="btn btn-outline btn-sm">Dashboard</a>
              <a href="#" onClick={(e) => { e.preventDefault(); logout(); }}>Logout</a>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <a href="#" onClick={(e) => { e.preventDefault(); setLoginOpen(true); }}>Login</a>
              <a href="#" onClick={(e) => { e.preventDefault(); setRegisterOpen(true); }} className="btn btn-primary btn-sm">Sign Up</a>
            </React.Fragment>
          )}
        </div>
      </div>
    </nav>
  );
}

// â”€â”€ PAGES â”€â”€

function HomePage() {
  const { setPage } = useContext(AppContext);
  return (
    <React.Fragment>
      <section className="hero">
        <div className="container">
          <h1>Building Strong Foundations with <span>Excellence.</span></h1>
          <p>Empowering your structural and landscaping projects with premium construction materials. From sturdy TMT bars to elegant paving tiles, build your vision with Sara Construction.</p>
          <div className="hero-buttons">
            <button className="btn btn-primary" onClick={() => setPage('products')}>Explore Materials</button>
            <button className="btn btn-outline" onClick={() => setPage('services')}>Our Services</button>
          </div>
        </div>
      </section>

      <section className="section container">
        <h2 className="section-title">Why Choose Sara?</h2>
        <p className="section-subtitle">Since 2010, providing the best in paving and exterior design.</p>
        <div className="grid">
          {[
            { icon: 'fas fa-th-large', title: 'Quality Paving', desc: 'Durable, interlocking blocks for all surfaces.' },
            { icon: 'fas fa-tree', title: 'Landscaping', desc: 'Full architectural landscape design services.' },
            { icon: 'fas fa-square', title: 'Elevation Tiles', desc: 'Weather-proof tiles for external wall cladding.' },
          ].map((v, i) => (
            <div key={i} className="card">
              <div className="card-icon"><i className={v.icon}></i></div>
              <h3>{v.title}</h3>
              <p>{v.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </React.Fragment>
  );
}

function LoginModal() {
  const { login, setLoginOpen, setRegisterOpen, isLoginOpen, setPage, showToast } = useContext(AppContext);
  const { errors, setErrors, inputStyle } = useFormValidation();
  if (!isLoginOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    const errs = validate([
      { field: 'email', value: email, checks: [
        { test: RULES.required, msg: 'Email is required' },
        { test: RULES.email, msg: 'Enter a valid email address' }
      ]},
      { field: 'password', value: password, checks: [
        { test: RULES.required, msg: 'Password is required' },
        { test: RULES.password, msg: 'Password must be at least 6 characters' }
      ]}
    ]);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const data = { email, password };
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) showToast(d.error, 'error');
        else {
          login(d);
          showToast(`Welcome back, ${d.name}!`);
          setLoginOpen(false);
        }
      })
      .catch(() => showToast('Login failed!', 'error'));
  };

  return (
    <div className="modal-overlay" onClick={() => setLoginOpen(false)}>
      <div className="auth-card" onClick={e => e.stopPropagation()}>
        <div className="auth-image">
          <h3>Welcome Back.</h3>
          <p>Sign in to track your orders, manage your profile, and explore premium construction materials for your projects.</p>
        </div>
        <div className="auth-form-container">
          <button className="modal-close" onClick={() => setLoginOpen(false)}>âœ•</button>
          <div className="auth-header">
            <h2>Login to <span>Sara.</span></h2>
            <p>Enter your details below to continue.</p>
          </div>
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label>Email</label>
              <input name="email" type="email" placeholder="Enter your email" style={inputStyle('email')} onChange={() => setErrors(p => ({...p, email: undefined}))} />
              <FieldError errors={errors} field="email" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input name="password" type="password" placeholder="Enter your password" style={inputStyle('password')} onChange={() => setErrors(p => ({...p, password: undefined}))} />
              <FieldError errors={errors} field="password" />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Login securely</button>
          </form>
          <p style={{ marginTop: '25px', textAlign: 'center', fontSize: '14px', color: 'var(--clr-text-secondary)' }}>
            Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); setLoginOpen(false); setRegisterOpen(true); }} style={{ color: 'var(--clr-orange)', fontWeight: '600' }}>Register here</a>
          </p>
        </div>
      </div>
    </div>
  );
}

function RegisterModal() {
  const { setRegisterOpen, setLoginOpen, isRegisterOpen, showToast } = useContext(AppContext);
  const [address, setAddress] = useState('');
  const { errors, setErrors, inputStyle } = useFormValidation();

  if (!isRegisterOpen) return null;

  const detectLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser', 'error');
      return;
    }
    showToast('Detecting location...', 'info');
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`)
        .then(r => r.json())
        .then(data => {
          if (data && data.display_name) {
            setAddress(data.display_name);
            showToast('Precise location detected!');
          } else {
            setAddress(`GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
            showToast('Coordinates captured.');
          }
        })
        .catch(() => {
          setAddress(`GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          showToast('GPS coordinates captured.');
        });
    }, () => {
      showToast('Please allow location access to use this feature.', 'error');
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    const errs = validate([
      { field: 'name', value: f.name.value, checks: [
        { test: RULES.required, msg: 'Full name is required' },
        { test: RULES.minLen(2), msg: 'Name must be at least 2 characters' }
      ]},
      { field: 'email', value: f.email.value, checks: [
        { test: RULES.required, msg: 'Email is required' },
        { test: RULES.email, msg: 'Enter a valid email address' }
      ]},
      { field: 'phone', value: f.phone.value, checks: [
        { test: RULES.required, msg: 'Phone number is required' },
        { test: RULES.phone, msg: 'Enter a valid phone number' }
      ]},
      { field: 'pincode', value: f.pincode.value, checks: [
        { test: RULES.required, msg: 'PIN code is required' },
        { test: RULES.pincode, msg: 'Enter a valid 6-digit PIN code' }
      ]},
      { field: 'password', value: f.password.value, checks: [
        { test: RULES.required, msg: 'Password is required' },
        { test: RULES.password, msg: 'Password must be at least 6 characters' }
      ]},
      { field: 'address', value: address, checks: [
        { test: RULES.required, msg: 'Address is required' }
      ]}
    ]);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const data = {
      name: f.name.value, email: f.email.value, password: f.password.value,
      phone: f.phone.value, address, pincode: f.pincode.value
    };
    fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) showToast(d.error, 'error');
        else {
          showToast(d.message);
          setRegisterOpen(false);
          setLoginOpen(true);
        }
      })
      .catch(() => showToast('Registration failed!', 'error'));
  };

  return (
    <div className="modal-overlay" onClick={() => setRegisterOpen(false)}>
      <div className="auth-card" onClick={e => e.stopPropagation()}>
        <div className="auth-image">
          <h3>Join Sara Construction.</h3>
          <p>Create an account to discover premium paving, architectural landscaping services, and track your builds.</p>
        </div>
        <div className="auth-form-container" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
          <button className="modal-close" onClick={() => setRegisterOpen(false)}>âœ•</button>
          <div className="auth-header">
            <h2>Create <span>Account.</span></h2>
            <p>Start building your dream project today.</p>
          </div>
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="form-group">
                <label>Full Name</label>
                <input name="name" type="text" placeholder="e.g., John Doe" style={inputStyle('name')} onChange={() => setErrors(p => ({...p, name: undefined}))} />
                <FieldError errors={errors} field="name" />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input name="email" type="email" placeholder="name@example.com" style={inputStyle('email')} onChange={() => setErrors(p => ({...p, email: undefined}))} />
                <FieldError errors={errors} field="email" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="form-group">
                <label>Phone Number</label>
                <input name="phone" type="tel" placeholder="+91 ..." style={inputStyle('phone')} onChange={() => setErrors(p => ({...p, phone: undefined}))} />
                <FieldError errors={errors} field="phone" />
              </div>
              <div className="form-group">
                <label>Pin Code</label>
                <input name="pincode" type="text" placeholder="6-digit PIN" style={inputStyle('pincode')} onChange={() => setErrors(p => ({...p, pincode: undefined}))} />
                <FieldError errors={errors} field="pincode" />
              </div>
            </div>
            <div className="form-group">
              <label>Password</label>
              <input name="password" type="password" placeholder="At least 6 characters" style={inputStyle('password')} onChange={() => setErrors(p => ({...p, password: undefined}))} />
              <FieldError errors={errors} field="password" />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ margin: 0 }}>Address</label>
                <button type="button" onClick={detectLocation} style={{ background: 'rgba(255, 152, 0, 0.1)', border: 'none', color: 'var(--clr-orange)', fontSize: '11px', fontWeight: 800, cursor: 'pointer', padding: '6px 12px', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '6px', transition: '0.2s' }}>
                  <i className="fas fa-location-crosshairs"></i> Get Location
                </button>
              </div>
              <textarea name="address" value={address} onChange={e => { setAddress(e.target.value); setErrors(p => ({...p, address: undefined})); }} placeholder="Full delivery address" rows="2" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: errors.address ? '1.5px solid #ef4444' : '1.5px solid var(--clr-border)', outline: 'none', fontFamily: 'inherit', fontSize: '15px' }}></textarea>
              <FieldError errors={errors} field="address" />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Create Account</button>
          </form>
          <p style={{ marginTop: '25px', textAlign: 'center', fontSize: '14px', color: 'var(--clr-text-secondary)' }}>
            Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); setRegisterOpen(false); setLoginOpen(true); }} style={{ color: 'var(--clr-orange)', fontWeight: '600' }}>Login</a>
          </p>
        </div>
      </div>
    </div>
  );
}

function InquiryModal() {
  const { isInquiryOpen, setInquiryOpen, selectedService, showToast, user } = useContext(AppContext);
  const [loading, setLoading] = useState(false);
  const { errors, setErrors, inputStyle } = useFormValidation();

  if (!isInquiryOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = fd.get('name'), email = fd.get('email'), phone = fd.get('phone'), message = fd.get('message');
    const errs = validate([
      { field: 'name', value: name, checks: [{ test: RULES.required, msg: 'Name is required' }, { test: RULES.minLen(2), msg: 'Name must be at least 2 characters' }] },
      { field: 'email', value: email, checks: [{ test: RULES.required, msg: 'Email is required' }, { test: RULES.email, msg: 'Enter a valid email address' }] },
      { field: 'phone', value: phone, checks: [{ test: RULES.required, msg: 'Phone is required' }, { test: RULES.phone, msg: 'Enter a valid phone number' }] },
      { field: 'message', value: message, checks: [{ test: RULES.required, msg: 'Please describe your requirements' }, { test: RULES.minLen(10), msg: 'Message must be at least 10 characters' }] },
    ]);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    const data = {
      name, email, phone,
      subject: `Service Inquiry: ${selectedService?.name || 'General'}`,
      message
    };

    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(r => r.json())
      .then(d => {
        showToast(d.message || 'Inquiry sent successfully!');
        setInquiryOpen(false);
      })
      .catch(() => showToast('Failed to send inquiry.', 'error'))
      .finally(() => setLoading(false));
  };

  return (
    <div className="modal-overlay" onClick={() => setInquiryOpen(false)}>
      <div className="auth-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px' }}>
        <div className="auth-image" style={{ background: 'linear-gradient(rgba(8, 51, 68, 0.85), rgba(8, 51, 68, 0.85)), url(https://images.unsplash.com/photo-1503387762-592dea58ef21?q=80&w=2000&auto=format&fit=crop)' }}>
          <h3>Request a Consultation.</h3>
          <p>Our experts are ready to help you plan and execute your architectural vision with precision and quality.</p>
          {selectedService && (
            <div style={{ marginTop: '30px', padding: '20px', background: 'rgba(255,255,255,0.1)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)' }}>
              <small style={{ textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 }}>Selected Service</small>
              <h4 style={{ margin: '10px 0 0 0', fontSize: '1.2rem' }}>{selectedService.name}</h4>
              <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', opacity: 0.9 }}>{selectedService.price_range}</p>
            </div>
          )}
        </div>
        <div className="auth-form-container">
          <button className="modal-close" onClick={() => setInquiryOpen(false)}>âœ•</button>
          <div className="auth-header">
            <h2>Service <span>Inquiry.</span></h2>
            <p>Fill out the form below and we'll get back to you within 24 hours.</p>
          </div>
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#666', marginBottom: '8px', display: 'block' }}>Your Name</label>
                <input name="name" type="text" defaultValue={user?.name || ''} placeholder="Full name" onChange={() => setErrors(p => ({...p, name: undefined}))} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: errors.name ? '1.5px solid #ef4444' : '1px solid #ddd' }} />
                <FieldError errors={errors} field="name" />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#666', marginBottom: '8px', display: 'block' }}>Email Address</label>
                <input name="email" type="email" defaultValue={user?.email || ''} placeholder="Email" onChange={() => setErrors(p => ({...p, email: undefined}))} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: errors.email ? '1.5px solid #ef4444' : '1px solid #ddd' }} />
                <FieldError errors={errors} field="email" />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: '15px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#666', marginBottom: '8px', display: 'block' }}>Phone Number</label>
              <input name="phone" type="tel" defaultValue={user?.phone || ''} placeholder="+91 00000 00000" onChange={() => setErrors(p => ({...p, phone: undefined}))} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: errors.phone ? '1.5px solid #ef4444' : '1px solid #ddd' }} />
              <FieldError errors={errors} field="phone" />
            </div>
            <div className="form-group" style={{ marginTop: '15px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#666', marginBottom: '8px', display: 'block' }}>How can we help?</label>
              <textarea name="message" placeholder="Describe your project requirements, estimated area, or any specific questions..." rows="4" onChange={() => setErrors(p => ({...p, message: undefined}))} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: errors.message ? '1.5px solid #ef4444' : '1px solid #ddd', fontFamily: 'inherit' }}></textarea>
              <FieldError errors={errors} field="message" />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '20px', padding: '15px' }}>
              {loading ? 'Sending Inquiry...' : 'Send Inquiry Request'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function ProductsPage() {
  const [products, setProducts] = useState([]);
  const { addToCart, setPage } = useContext(AppContext);

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(setProducts);
  }, []);

  return (
    <section className="section container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <h2 style={{ textAlign: 'left' }}>Building Materials</h2>
          <p style={{ color: 'var(--clr-text-secondary)' }}>Premium quality Bricks, Cement, TMT and Pavers.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setPage('cart')}><i className="fas fa-shopping-cart"></i> View Cart</button>
      </div>
      <div className="grid">
        {products.map(p => (
          <div key={p.id} className="card product-card" style={{ padding: '0', overflow: 'hidden' }}>
            <div className="card-image" style={{ height: '220px', width: '100%', background: '#f1f5f9' }}>
              {p.image_url ? (
                <img src={(p.image_url.startsWith('http') || p.image_url.startsWith('/') ? p.image_url : '/' + p.image_url) + (p.image_url.includes('?') ? '&v=2' : '?v=2')} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/400x300?text=Image+Not+Found'; }} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <i className="fas fa-box-open" style={{ fontSize: '2.5rem', color: 'var(--clr-orange)' }}></i>
                </div>
              )}
            </div>
            <div style={{ padding: '25px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--clr-orange)' }}>{p.category_name}</span>
                <span style={{ fontSize: '12px', color: 'var(--clr-text-secondary)' }}>â˜… {p.rating}</span>
              </div>

              <h3 style={{ margin: '8px 0', fontSize: '1.2rem' }}>{p.name}</h3>
              <p style={{ fontSize: '13px', color: 'var(--clr-text-secondary)', marginBottom: '15px', height: '40px', overflow: 'hidden' }}>{p.description}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--clr-kadal)' }}>₹{p.price} <span style={{ fontSize: '12px', color: 'var(--clr-text-secondary)', fontWeight: 400 }}>/ {p.unit}</span></div>
                {p.stock_quantity > 0 ? (
                  <button className="btn btn-outline btn-sm" onClick={() => addToCart(p)}>
                    <i className="fas fa-plus"></i> Add
                  </button>
                ) : (
                  <button className="btn btn-sm" disabled style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#94a3b8', cursor: 'not-allowed' }}>
                    Out of Stock
                  </button>
                )}
              </div>
              {p.stock_quantity > 0 && p.stock_quantity < 10 && (
                <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700, marginTop: '10px' }}>
                  Only {p.stock_quantity} remaining!
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ServicesPage() {
  const [services, setServices] = useState([]);
  const { setInquiryOpen, setSelectedService } = useContext(AppContext);

  useEffect(() => {
    fetch('/api/services').then(r => r.json()).then(setServices);
  }, []);

  return (
    <div style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', minHeight: '100vh', padding: '100px 20px', fontFamily: '"Outfit", sans-serif' }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '80px', animation: 'fadeInDown 0.8s ease' }}>
          <span style={{ color: 'var(--clr-orange)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '3px', fontSize: '14px', marginBottom: '15px', display: 'block' }}>Elite Solutions</span>
          <h1 style={{ fontSize: '52px', fontWeight: 900, color: 'var(--clr-kadal)', marginBottom: '20px', letterSpacing: '-1px' }}>Our Professional Services</h1>
          <p style={{ fontSize: '18px', color: '#64748b', maxWidth: '700px', margin: '0 auto', lineHeight: 1.6, fontWeight: 500 }}>
            From landscape design to technical installations, we provide end-to-end support for your construction and renovation projects with certified experts.
          </p>
          <div style={{ width: '80px', height: '4px', background: 'var(--clr-orange)', margin: '30px auto', borderRadius: '2px' }}></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '30px' }}>
          {services.map((s, idx) => (
            <div key={s.id} className="service-card" style={{ 
              background: '#fff', 
              padding: '45px', 
              borderRadius: '30px', 
              boxShadow: '0 10px 30px rgba(0,0,0,0.03)', 
              border: '1px solid #f1f5f9',
              transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              position: 'relative',
              overflow: 'hidden',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              animation: `fadeInUp 0.6s ease forwards ${idx * 0.1}s`,
              opacity: 0
            }}>
              <style>{`
                .service-card:hover { transform: translateY(-12px); boxShadow: 0 20px 40px rgba(8, 51, 68, 0.08); borderColor: rgba(249, 115, 22, 0.2); }
                .service-card::after { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 5px; background: var(--clr-orange); opacity: 0; transition: 0.3s; }
                .service-card:hover::after { opacity: 1; }
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeInDown { from { opacity: 0; transform: translateY(-30px); } to { opacity: 1; transform: translateY(0); } }
              `}</style>

              <div style={{ width: '70px', height: '70px', background: 'rgba(8, 51, 68, 0.03)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '30px', color: 'var(--clr-kadal)', fontSize: '28px' }}>
                <i className={idx % 2 === 0 ? 'fas fa-drafting-compass' : 'fas fa-hard-hat'}></i>
              </div>

              <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--clr-kadal)', marginBottom: '15px' }}>{s.name}</h3>
              <p style={{ color: '#64748b', fontSize: '15px', lineHeight: 1.7, marginBottom: '30px', flex: 1 }}>{s.description}</p>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '25px', marginTop: 'auto' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Starting From</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--clr-orange)' }}>{s.price_range}</div>
                </div>
                <button
                  onClick={() => { setSelectedService(s); setInquiryOpen(true); }}
                  style={{ background: 'var(--clr-kadal)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '15px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', transition: '0.3s', display: 'flex', alignItems: 'center', gap: '8px' }}
                  onMouseOver={(e) => e.target.style.background = 'var(--clr-orange)'}
                  onMouseOut={(e) => e.target.style.background = 'var(--clr-kadal)'}
                >
                  Inquire Now <i className="fas fa-arrow-right" style={{ fontSize: '12px' }}></i>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '80px', background: 'var(--clr-kadal)', borderRadius: '40px', padding: '60px', color: '#fff', position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
          <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ fontSize: '32px', fontWeight: 900, marginBottom: '15px' }}>Need a Custom Construction Plan?</h2>
            <p style={{ fontSize: '17px', opacity: 0.8, maxWidth: '600px', margin: '0 auto 35px auto', lineHeight: 1.6 }}>Our engineers are ready to discuss your specific requirements and Provide a detailed project roadmap.</p>
            <button 
              onClick={() => setInquiryOpen(true)}
              style={{ background: '#fff', color: 'var(--clr-kadal)', border: 'none', padding: '16px 40px', borderRadius: '20px', fontWeight: 800, fontSize: '16px', cursor: 'pointer', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}
            >
              Consult with Our Team
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartPage() {
  const { cart, setCart, user, setPage, showToast } = useContext(AppContext);
  const total = cart.reduce((acc, i) => acc + (i.price * i.qty), 0);
  const [address, setAddress] = useState(user?.address || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [paymentMethod, setPaymentMethod] = useState('razorpay'); // 'razorpay' or 'cash'
  const [allProducts, setAllProducts] = useState([]);
  const [step, setStep] = useState(1);

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(setAllProducts);
  }, []);

  useEffect(() => {
    if (user) {
      if (!address && user.address) setAddress(user.address);
      if (!phone && user.phone) setPhone(user.phone);
    }
  }, [user]);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser', 'error');
      return;
    }
    showToast('Detecting location...', 'info');
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`)
        .then(r => r.json())
        .then(data => {
          if (data && data.display_name) {
            setAddress(data.display_name);
            showToast('Precise location detected!');
          } else {
            setAddress(`GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
            showToast('Coordinates captured.');
          }
        })
        .catch(() => {
          setAddress(`GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          showToast('GPS coordinates captured.');
        });
    }, () => {
      showToast('Please allow location access to use this feature.', 'error');
    });
  };

  const cartIssues = cart.filter(item => {
    const p = allProducts.find(ap => ap.id === item.id);
    return p && p.stock_quantity < item.qty;
  });

  const handleCheckout = (e) => {
    if (e) e.preventDefault();
    if (!user) { showToast('Please login to checkout!', 'error'); setPage('login'); return; }
    if (cart.length === 0 || cartIssues.length > 0) return;
    if (!address || !phone) { showToast('Please fill out delivery details to proceed.', 'error'); return; }

    const finalAmount = total * 1.18;

    if (paymentMethod === 'razorpay') {
      // 1. Create Razorpay Order in Backend
      fetch('/api/payments/create_order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: finalAmount })
      })
        .then(r => r.json())
        .then(order => {
          if (order.error) {
            showToast("Payment initialization failed: " + order.error, "error");
            return;
          }

          // 2. Configure Razorpay Options
          const options = {
            key: order.key_id,
            amount: order.amount,
            currency: order.currency,
            name: "Sara Construction",
            description: "Secure Payment for Building Materials",
            order_id: order.id,
            handler: function (response) {
              // 3. Payment Success - Finalize Construction Order
              const orderData = {
                user_id: user.id,
                total: finalAmount,
                address: `${address} | Phone: ${phone}`,
                items: cart,
                payment_id: response.razorpay_payment_id
              };

              fetch('/api/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
              })
                .then(r => r.json())
                .then(d => {
                  if (d.success) {
                    showToast(`Payment Verified! Order #100${d.id} confirmed.`);
                    setCart([]);
                    setPage(user && user.role === 'customer' ? 'dashboard' : 'home');
                  } else {
                    showToast(d.message || 'Payment received but order sync failed! Please contact support.', 'error');
                  }
                });
            },
            prefill: {
              name: user.name,
              email: user.email,
              contact: phone
            },
            theme: {
              color: "#083344" // Sara Construction Brand Color
            },
            modal: {
              ondismiss: function () {
                showToast("Payment cancelled by user.", "info");
              }
            }
          };

          const rzp = new window.Razorpay(options);
          rzp.on('payment.failed', function (response) {
            showToast("Payment Failed: " + response.error.description, "error");
          });
          rzp.open();
        })
        .catch(() => showToast('Checkout failed! Network Error.', 'error'));
    } else {
      // Cash on Delivery Path
      const orderData = {
        user_id: user.id,
        total: finalAmount,
        address: `${address} | Phone: ${phone}`,
        items: cart,
        payment_id: 'CASH_ON_DELIVERY'
      };

      fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      })
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            showToast(`Order #100${d.id} placed successfully (COD)!`);
            setCart([]);
            setPage(user && user.role === 'customer' ? 'dashboard' : 'home');
          } else {
            showToast(d.message || 'Order creation failed!', 'error');
          }
        })
        .catch(() => showToast('Checkout failed! Network Error.', 'error'));
    }
  };

  const updateQty = (id, delta) => {
    const item = cart.find(i => i.id === id);
    const product = allProducts.find(p => p.id === id);

    if (item && product) {
      const newQty = item.qty + delta;
      if (newQty > product.stock_quantity && delta > 0) {
        showToast(`Only ${product.stock_quantity} items available in stock.`, 'error');
        return;
      }
      if (newQty <= 0) return;

      setCart(prev => prev.map(i => i.id === id ? { ...i, qty: newQty } : i));
    }
  };

  const removeItem = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const tax = total * 0.18;
  const finalTotal = total + tax;

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '40px 20px 100px 20px', fontFamily: '"Outfit", sans-serif' }}>
      <div style={{ maxWidth: '1250px', margin: '0 auto' }}>

        {/* --- Professional Progress Stepper --- */}
        {cart.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '50px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: step >= 1 ? 'var(--clr-kadal)' : '#fff', color: step >= 1 ? '#fff' : '#94a3b8', border: step >= 1 ? 'none' : '2px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', transition: '0.3s' }}>{step > 1 ? <i className="fas fa-check"></i> : '1'}</div>
                <span style={{ fontWeight: 700, color: step >= 1 ? 'var(--clr-kadal)' : '#94a3b8', fontSize: '15px' }}>Review Cart</span>
              </div>
              <div style={{ width: '60px', height: '2px', background: step >= 2 ? 'var(--clr-kadal)' : '#e2e8f0', transition: '0.3s' }}></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: step >= 2 ? 'var(--clr-kadal)' : '#fff', color: step >= 2 ? '#fff' : '#94a3b8', border: step >= 2 ? 'none' : '2px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', transition: '0.3s' }}>{step > 2 ? <i className="fas fa-check"></i> : '2'}</div>
                <span style={{ fontWeight: 600, color: step >= 2 ? 'var(--clr-kadal)' : '#94a3b8', fontSize: '15px' }}>Delivery Details</span>
              </div>
              <div style={{ width: '60px', height: '2px', background: step >= 3 ? 'var(--clr-kadal)' : '#e2e8f0', transition: '0.3s' }}></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: step >= 3 ? 'var(--clr-kadal)' : '#fff', color: step >= 3 ? '#fff' : '#94a3b8', border: step >= 3 ? 'none' : '2px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', transition: '0.3s' }}>3</div>
                <span style={{ fontWeight: 600, color: step >= 3 ? 'var(--clr-kadal)' : '#94a3b8', fontSize: '15px' }}>Secure Payment</span>
              </div>
            </div>
          </div>
        )}

        {/* --- Header Section --- */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
          <div>
            <span style={{ color: 'var(--clr-orange)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', fontSize: '12px', display: 'block', marginBottom: '8px' }}>Your Shopping Experience</span>
            <h1 style={{ color: 'var(--clr-kadal)', fontSize: '42px', fontWeight: 900, margin: 0, lineHeight: 1 }}>Checkout<span style={{ color: 'var(--clr-orange)' }}>.</span></h1>
          </div>
          <button
            onClick={() => setPage(user && user.role === 'customer' ? 'dashboard' : 'products')}
            style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '12px 24px', borderRadius: '14px', color: 'var(--clr-kadal)', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.3s ease', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 15px rgba(0,0,0,0.06)'; }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)'; }}
          >
            <i className="fas fa-chevron-left" style={{ fontSize: '12px' }}></i> Continue Selection
          </button>
        </div>

        {cart.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '120px 40px', background: '#fff', borderRadius: '30px', boxShadow: '0 20px 60px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
            <div style={{ width: '120px', height: '120px', background: 'rgba(8, 51, 68, 0.03)', borderRadius: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 40px auto' }}>
              <i className="fas fa-shopping-bag" style={{ fontSize: '3.5rem', color: 'var(--clr-kadal)', opacity: 0.2 }}></i>
            </div>
            <h2 style={{ color: 'var(--clr-kadal)', fontSize: '28px', fontWeight: 800, marginBottom: '15px' }}>Your selection portfolio is empty</h2>
            <p style={{ color: '#94a3b8', marginBottom: '40px', fontSize: '16px', maxWidth: '400px', margin: '0 auto 40px auto', lineHeight: 1.6 }}>Start adding premium construction materials to your project workspace to proceed with procurement.</p>
            <button className="btn btn-primary" onClick={() => setPage(user && user.role === 'customer' ? 'dashboard' : 'products')} style={{ padding: '18px 45px', fontSize: '1.1rem', borderRadius: '15px' }}>Explore Catalog</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 440px', gap: '40px', alignItems: 'start', animation: 'fadeIn 0.4s ease-out' }}>

            {/* --- Left Column: Dynamic Step Content --- */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>

              {step === 1 && (
                <div style={{ background: '#fff', borderRadius: '24px', padding: '40px', border: '1px solid #f1f5f9', boxShadow: '0 10px 40px rgba(0,0,0,0.02)', animation: 'slideRight 0.3s ease-out' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
                    <h2 style={{ fontSize: '22px', color: 'var(--clr-kadal)', fontWeight: 800, margin: 0 }}>Project Materials <span style={{ color: '#94a3b8', fontSize: '16px', fontWeight: 500, marginLeft: '10px' }}>({cart.length} items)</span></h2>
                    <span style={{ color: '#22c55e', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fas fa-shield-check"></i> Quality Verified
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                    {cart.map((i, index) => (
                      <div key={i.id} style={{ display: 'flex', gap: '30px', padding: '30px 0', borderBottom: index === cart.length - 1 ? 'none' : '1px solid #f1f5f9', transition: 'all 0.3s ease' }}>
                        <div style={{ width: '140px', height: '140px', borderRadius: '20px', overflow: 'hidden', background: '#f8fafc', flexShrink: 0, border: '1px solid #f1f5f9', position: 'relative' }}>
                          <img
                            src={i.image_url ? ((i.image_url.startsWith('http') || i.image_url.startsWith('/') ? i.image_url : '/' + i.image_url) + '?v=2') : 'https://placehold.co/400x300?text=Sara+Material'}
                            alt={i.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--clr-orange)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', display: 'block' }}>{i.category_name || 'Material'}</span>
                              <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', fontWeight: 800, color: 'var(--clr-kadal)', letterSpacing: '-0.5px' }}>{i.name}</h3>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <span style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 600 }}>Unit Price: ₹{parseFloat(i.price).toLocaleString()} / {i.unit}</span>
                                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#e2e8f0' }}></span>
                              </div>
                                {(() => {
                                  const p = allProducts.find(ap => ap.id === i.id);
                                  const isOut = p && p.stock_quantity === 0;
                                  const isLow = p && p.stock_quantity > 0 && p.stock_quantity < i.qty;
                                  
                                  if (isOut) return (
                                    <div style={{ background: '#fef2f2', color: '#dc2626', padding: '6px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 900, border: '1px solid #fee2e2', display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                                      <i className="fas fa-ban"></i> CRITICAL: OUT OF STOCK
                                    </div>
                                  );
                                  
                                  if (isLow) return (
                                    <div style={{ background: '#fffbeb', color: '#b45309', padding: '6px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 900, border: '1px solid #fef3c7', display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                                      <i className="fas fa-clock"></i> INSUFFICIENT STOCK: Only {p.stock_quantity} available
                                    </div>
                                  );
                                  
                                  return (
                                    <div style={{ color: '#059669', fontSize: '13px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                                      <i className="fas fa-check-circle"></i> Item Verified & In-Stock
                                    </div>
                                  );
                                })()}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 900, color: 'var(--clr-kadal)', fontSize: '24px', letterSpacing: '-0.5px' }}>
                                ₹{(i.price * i.qty).toLocaleString()}
                              </div>
                              {(() => {
                                const p = allProducts.find(ap => ap.id === i.id);
                                if (p && p.stock_quantity < i.qty) return <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 800, textTransform: 'uppercase', marginTop: '5px' }}>Action Required</div>;
                                return null;
                              })()}
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '25px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '6px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                              <button onClick={() => updateQty(i.id, -1)} style={{ background: '#fff', border: '1px solid #e2e8f0', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', color: 'var(--clr-kadal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 900, transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }} onMouseOver={e => e.currentTarget.style.borderColor = 'var(--clr-orange)'} onMouseOut={e => e.currentTarget.style.borderColor = '#e2e8f0'}>-</button>
                              <div style={{ padding: '0 20px', fontWeight: 800, color: 'var(--clr-kadal)', fontSize: '16px', minWidth: '40px', textAlign: 'center' }}>{i.qty}</div>
                              <button onClick={() => updateQty(i.id, 1)} style={{ background: '#fff', border: '1px solid #e2e8f0', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', color: 'var(--clr-kadal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 900, transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }} onMouseOver={e => e.currentTarget.style.borderColor = 'var(--clr-orange)'} onMouseOut={e => e.currentTarget.style.borderColor = '#e2e8f0'}>+</button>
                            </div>
                            <button
                              onClick={() => removeItem(i.id)}
                              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 15px', borderRadius: '10px', transition: 'all 0.2s' }}
                              onMouseOver={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fff1f2'; }}
                              onMouseOut={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}
                            >
                              <i className="far fa-trash-alt"></i> Remove Item
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div style={{ background: '#fff', borderRadius: '24px', padding: '40px', border: '1px solid #f1f5f9', boxShadow: '0 10px 40px rgba(0,0,0,0.02)', animation: 'slideRight 0.3s ease-out' }}>
                  <h2 style={{ fontSize: '22px', color: 'var(--clr-kadal)', fontWeight: 800, borderBottom: '1px solid #f1f5f9', paddingBottom: '20px', margin: '0 0 30px 0' }}>Procurement & Site Logistics</h2>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginBottom: '30px' }}>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Purchaser Identity</label>
                      <div style={{ padding: '16px 20px', background: '#f8fafc', borderRadius: '14px', fontSize: '15px', fontWeight: 700, color: 'var(--clr-kadal)', border: '1px solid #f1f5f9' }}>{user?.name || 'Guest User'}</div>
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Contact Email</label>
                      <div style={{ padding: '16px 20px', background: '#f8fafc', borderRadius: '14px', fontSize: '15px', fontWeight: 700, color: 'var(--clr-kadal)', border: '1px solid #f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email || 'N/A'}</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <label style={{ display: 'block', margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Site Delivery Address</label>
                      <button type="button" onClick={detectLocation} style={{ background: 'rgba(8, 51, 68, 0.05)', border: 'none', color: 'var(--clr-kadal)', fontSize: '11px', fontWeight: 800, cursor: 'pointer', padding: '8px 16px', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(8, 51, 68, 0.1)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(8, 51, 68, 0.05)'}>
                        <i className="fas fa-location-arrow"></i> Use Precise GPS
                      </button>
                    </div>
                    <textarea
                      placeholder="Specify full site address including landmarks..."
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      required
                      rows="4"
                      style={{ width: '100%', padding: '20px', borderRadius: '18px', border: '1px solid #e2e8f0', background: '#fcfdfe', fontFamily: 'inherit', fontSize: '15px', transition: 'all 0.3s ease', outline: 'none', resize: 'none', lineHeight: 1.6 }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--clr-orange)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(249, 115, 22, 0.1)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                    ></textarea>
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '12px', fontSize: '12px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Primary Contact Phone</label>
                    <div style={{ position: 'relative', maxWidth: '350px' }}>
                      <i className="fas fa-phone" style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '14px' }}></i>
                      <input type="tel" placeholder="+91 00000 00000" value={phone} onChange={e => setPhone(e.target.value)} required style={{ width: '100%', padding: '18px 18px 18px 45px', borderRadius: '15px', border: '1px solid #e2e8f0', background: '#fcfdfe', fontFamily: 'inherit', fontSize: '16px', transition: 'all 0.3s ease', outline: 'none', fontWeight: 700, color: 'var(--clr-kadal)' }} onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--clr-orange)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(249, 115, 22, 0.1)'; }} onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }} />
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div style={{ background: '#fff', borderRadius: '24px', padding: '40px', border: '1px solid #f1f5f9', boxShadow: '0 10px 40px rgba(0,0,0,0.02)', animation: 'slideRight 0.3s ease-out' }}>
                  <h2 style={{ fontSize: '22px', color: 'var(--clr-kadal)', fontWeight: 800, borderBottom: '1px solid #f1f5f9', paddingBottom: '20px', margin: '0 0 30px 0' }}>Select Settlement Methodology</h2>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {[
                      { id: 'razorpay', label: 'Instant Online Payment', icon: 'fa-credit-card', desc: 'Secure credit/debit card, UPI, or Net Banking' },
                      { id: 'cash', label: 'Verified Cash on Delivery', icon: 'fa-truck-ramp-box', desc: 'Pay during physical delivery at your construction site' }
                    ].map(p => (
                      <div
                        key={p.id}
                        onClick={() => setPaymentMethod(p.id)}
                        style={{
                          padding: '25px',
                          borderRadius: '20px',
                          border: `2.5px solid ${paymentMethod === p.id ? 'var(--clr-orange)' : '#f1f5f9'}`,
                          cursor: 'pointer',
                          background: paymentMethod === p.id ? 'rgba(249, 115, 22, 0.03)' : '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '20px',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          transform: paymentMethod === p.id ? 'translateY(-2px)' : 'translateY(0)',
                          boxShadow: paymentMethod === p.id ? '0 10px 25px rgba(249, 115, 22, 0.1)' : 'none'
                        }}
                      >
                        <div style={{ width: '50px', height: '50px', borderRadius: '15px', background: paymentMethod === p.id ? 'var(--clr-orange)' : '#f8fafc', color: paymentMethod === p.id ? '#fff' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', transition: '0.3s' }}>
                          <i className={`fas ${p.icon}`}></i>
                        </div>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '17px', fontWeight: 800, color: 'var(--clr-kadal)' }}>{p.label}</h4>
                          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>{p.desc}</p>
                        </div>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: `2px solid ${paymentMethod === p.id ? 'var(--clr-orange)' : '#e2e8f0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.3s' }}>
                          {paymentMethod === p.id && <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--clr-orange)' }}></div>}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: '40px', padding: '25px', background: 'rgba(34, 197, 94, 0.05)', borderRadius: '20px', border: '1px dashed #22c55e', display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <div style={{ fontSize: '30px', color: '#22c55e' }}><i className="fas fa-user-shield"></i></div>
                    <div>
                      <h4 style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>Secure Transaction Guarantee</h4>
                      <p style={{ margin: 0, fontSize: '13px', color: '#166534', fontWeight: 500, lineHeight: 1.4 }}>Your financial data is protected by industry-standard 256-bit encryption and ISO-certified security protocols.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Trust Badges */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                {[
                  { icon: 'fa-truck-fast', title: 'On-site Delivery', desc: 'Secure transit to your site' },
                  { icon: 'fa-certificate', title: 'Quality Assured', desc: 'Tested structural materials' },
                  { icon: 'fa-lock', title: 'Secure Payment', desc: '256-bit SSL encrypted' }
                ].map((b, idx) => (
                  <div key={idx} style={{ background: '#fff', padding: '20px', borderRadius: '20px', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.01)' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(249, 115, 22, 0.08)', color: 'var(--clr-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                      <i className={`fas ${b.icon}`}></i>
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--clr-kadal)' }}>{b.title}</h4>
                      <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* --- Right Column: Financial Summary & Navigation --- */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', position: 'sticky', top: '40px' }}>

              {/* Order Summary Card */}
              <div style={{ background: 'var(--clr-kadal)', borderRadius: '24px', padding: '35px', color: '#fff', boxShadow: '0 20px 50px rgba(8, 51, 68, 0.15)', overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'rgba(255,255,255,0.03)', borderRadius: '50%' }}></div>
                <h2 style={{ fontSize: '20px', color: '#fff', fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '20px', margin: '0 0 25px 0' }}>Order Summary</h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.7)', fontSize: '15px' }}>
                    <span>Subtotal</span>
                    <span style={{ fontWeight: 700, color: '#fff' }}>₹{total.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.7)', fontSize: '15px' }}>
                    <span>Taxation (GST 18%)</span>
                    <span style={{ fontWeight: 700, color: '#fff' }}>₹{tax.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.7)', fontSize: '15px' }}>
                    <span>Logistics & Handling</span>
                    <span style={{ fontWeight: 800, color: '#22c55e' }}>COMPLIMENTARY</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '30px 0 0 0', borderTop: '2px dashed rgba(255,255,255,0.1)', paddingTop: '25px', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.8)', fontSize: '16px' }}>Net Total</span>
                  <span style={{ fontWeight: 900, color: '#fff', fontSize: '32px', letterSpacing: '-1px' }}>₹{finalTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* Navigation Logic */}
              <div style={{ background: '#fff', borderRadius: '24px', padding: '30px', boxShadow: '0 10px 40px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>

                {cartIssues.length > 0 && step === 1 && (
                  <div style={{ background: '#fff1f2', border: '1px solid #ffe4e6', color: '#e11d48', padding: '18px', borderRadius: '15px', fontSize: '13px', marginBottom: '25px', display: 'flex', gap: '12px' }}>
                    <i className="fas fa-circle-exclamation" style={{ marginTop: '2px' }}></i>
                    <span>Please adjust quantities for materials with insufficient stock.</span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {step === 1 && (
                    <button
                      onClick={() => setStep(2)}
                      disabled={cartIssues.length > 0}
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center', padding: '20px', fontSize: '16px', fontWeight: 800, borderRadius: '15px', opacity: cartIssues.length > 0 ? 0.6 : 1 }}
                    >
                      Proceed to Delivery Details
                      <i className="fas fa-arrow-right" style={{ marginLeft: '12px' }}></i>
                    </button>
                  )}

                  {step === 2 && (
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        onClick={() => setStep(1)}
                        style={{ padding: '18px', borderRadius: '15px', border: '1px solid #e2e8f0', background: '#fff', color: 'var(--clr-kadal)', fontWeight: 700, cursor: 'pointer', transition: '0.2s' }}
                        onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseOut={e => e.currentTarget.style.background = '#fff'}
                      >
                        <i className="fas fa-arrow-left"></i>
                      </button>
                      <button
                        onClick={() => {
                          if (!address || !phone) {
                            showToast('Please provide delivery details.', 'error');
                            return;
                          }
                          setStep(3);
                        }}
                        className="btn btn-primary"
                        style={{ flex: 1, justifyContent: 'center', padding: '18px', fontSize: '16px', fontWeight: 800, borderRadius: '15px' }}
                      >
                        Proceed to Payment
                        <i className="fas fa-arrow-right" style={{ marginLeft: '12px' }}></i>
                      </button>
                    </div>
                  )}

                  {step === 3 && (
                    <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                      <button
                        onClick={handleCheckout}
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center', padding: '22px', fontSize: '18px', fontWeight: 800, borderRadius: '18px', boxShadow: '0 10px 30px rgba(249, 115, 22, 0.25)' }}
                      >
                        {paymentMethod === 'razorpay' ? 'Secure Final Payment' : 'Confirm Order (COD)'}
                        <i className={`fas ${paymentMethod === 'razorpay' ? 'fa-lock-shield' : 'fa-circle-check'}`} style={{ marginLeft: '12px' }}></i>
                      </button>
                      <button
                        onClick={() => setStep(2)}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', fontWeight: 700, cursor: 'pointer', padding: '10px' }}
                      >
                        <i className="fas fa-arrow-left" style={{ marginRight: '8px' }}></i> Return to Delivery Details
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'center', marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <i className="fas fa-shield-halved" style={{ color: '#22c55e' }}></i> ISO 9001:2015 Standards
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
    </div>
    </div >
  );
}


function ProfileView({ user, updateUser, showToast }) {
  const [formData, setFormData] = useState({
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    address: user.address || '',
    pincode: user.pincode || ''
  });
  const [loading, setLoading] = useState(false);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser', 'error');
      return;
    }
    showToast('Detecting location...', 'info');
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`)
        .then(r => r.json())
        .then(data => {
          if (data && data.display_name) {
            setFormData(prev => ({ ...prev, address: data.display_name }));
            showToast('Precise location detected!');
          } else {
            setFormData(prev => ({ ...prev, address: `GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}` }));
            showToast('Coordinates captured.');
          }
        })
        .catch(() => {
          setFormData(prev => ({ ...prev, address: `GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}` }));
          showToast('GPS coordinates captured.');
        });
    }, () => {
      showToast('Please allow location access to use this feature.', 'error');
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    fetch('/api/customer/profile/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...formData, id: user.id })
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          if (d.user) updateUser(d.user);
          else updateUser(formData);
          showToast('Profile updated successfully!');
        } else {
          showToast(d.message || 'Update failed', 'error');
        }
      })
      .catch(() => showToast('Update failed!', 'error'))
      .finally(() => setLoading(false));
  };

  return (
    <div style={{ maxWidth: '800px', animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ background: '#fff', borderRadius: '24px', padding: '40px', border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '25px', marginBottom: '40px', paddingBottom: '30px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: 'var(--clr-kadal)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 800 }}>
            {formData.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--clr-kadal)', margin: 0 }}>{formData.name}</h2>
            <p style={{ color: '#94a3b8', margin: '4px 0 0 0', fontSize: '14px', fontWeight: 500 }}>Customer account ID: #CUS-{100 + user.id}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
          <div style={{ gridColumn: 'span 1' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Full Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Your full name"
              style={{ width: '100%', padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '15px', color: 'var(--clr-kadal)', fontWeight: 500, outline: 'none', transition: 'all 0.2s' }}
              onFocus={(e) => e.target.style.borderColor = 'var(--clr-orange)'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>
          <div style={{ gridColumn: 'span 1' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email Address</label>
            <input
              type="email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              placeholder="name@example.com"
              style={{ width: '100%', padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '15px', color: 'var(--clr-kadal)', fontWeight: 500, outline: 'none', transition: 'all 0.2s' }}
              onFocus={(e) => e.target.style.borderColor = 'var(--clr-orange)'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>
          <div style={{ gridColumn: 'span 1' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone Number</label>
            <input
              type="tel"
              placeholder="+91 00000 00000"
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
              style={{ width: '100%', padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '15px', color: 'var(--clr-kadal)', fontWeight: 500, outline: 'none', transition: 'all 0.2s' }}
              onFocus={(e) => e.target.style.borderColor = 'var(--clr-orange)'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>
          <div style={{ gridColumn: 'span 1' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pin Code</label>
            <input
              type="text"
              placeholder="6-digit PIN"
              value={formData.pincode}
              onChange={e => setFormData({ ...formData, pincode: e.target.value })}
              style={{ width: '100%', padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '15px', color: 'var(--clr-kadal)', fontWeight: 500, outline: 'none', transition: 'all 0.2s' }}
              onFocus={(e) => e.target.style.borderColor = 'var(--clr-orange)'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Shipping Address</label>
              <button type="button" onClick={detectLocation} style={{ background: 'rgba(255, 152, 0, 0.1)', border: 'none', color: 'var(--clr-orange)', fontSize: '11px', fontWeight: 800, cursor: 'pointer', padding: '6px 12px', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '6px', transition: '0.2s' }}>
                <i className="fas fa-location-crosshairs"></i> Detect Location
              </button>
            </div>
            <textarea
              rows="3"
              placeholder="House No, Street, City, State, ZIP"
              value={formData.address}
              onChange={e => setFormData({ ...formData, address: e.target.value })}
              style={{ width: '100%', padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '15px', color: 'var(--clr-kadal)', fontWeight: 500, outline: 'none', transition: 'all 0.2s', resize: 'none' }}
              onFocus={(e) => e.target.style.borderColor = 'var(--clr-orange)'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>
          <div style={{ gridColumn: 'span 2', marginTop: '10px' }}>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: '15px 40px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(249, 115, 22, 0.2)', width: 'auto', justifyContent: 'center' }}>
              {loading ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// â”€â”€ DASHBOARDS â”€â”€

function CustomerDashboard() {
  const { user, showToast, addToCart, setPage, logout, cart, updateUser, setSelectedService, setInquiryOpen, isInquiryOpen } = useContext(AppContext);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);

  const [activeCategory, setActiveCategory] = useState('all');
  const [sortOption, setSortOption] = useState('name_asc');
  const [activeView, setActiveView] = useState('shop');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [calcModalOpen, setCalcModalOpen] = useState(false);
  const [calcSqft, setCalcSqft] = useState('');
  const [qtyModalOpen, setQtyModalOpen] = useState(false);
  const [qtyValue, setQtyValue] = useState('1');
  const [expandedOrders, setExpandedOrders] = useState({});
  const [orderDetails, setOrderDetails] = useState({});
  const [editingOrder, setEditingOrder] = useState(null);
  const [editAddress, setEditAddress] = useState('');
  const [inquiries, setInquiries] = useState([]);
  const [loadingInquiries, setLoadingInquiries] = useState(false);

  const toggleOrderDetails = (orderId) => {
    if (expandedOrders[orderId]) {
      setExpandedOrders({ ...expandedOrders, [orderId]: false });
    } else {
      if (!orderDetails[orderId]) {
        fetch(`/api/customer/order_items/${orderId}`)
          .then(r => r.json())
          .then(items => {
            setOrderDetails({ ...orderDetails, [orderId]: items });
            setExpandedOrders({ ...expandedOrders, [orderId]: true });
          });
      } else {
        setExpandedOrders({ ...expandedOrders, [orderId]: true });
      }
    }
  };

  useEffect(() => {
    fetch(`/api/customer/orders/${user.id}`).then(r => r.json()).then(setOrders);
    fetch('/api/products').then(r => r.json()).then(setProducts);
    fetch('/api/categories').then(r => r.json()).then(setCategories);
    fetch('/api/services').then(r => r.json()).then(setServices);
  }, []);

  useEffect(() => {
    if (activeView !== 'inquiries' || isInquiryOpen) return;
    setLoadingInquiries(true);
    fetch('/api/customer/inquiries', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setInquiries(Array.isArray(data) ? data : []);
      })
      .catch(() => setInquiries([]))
      .finally(() => setLoadingInquiries(false));
  }, [activeView, isInquiryOpen]);

  // Auto-fetch line items for every order when orders list loads
  useEffect(() => {
    if (orders.length === 0) return;
    const fetches = orders.map(o =>
      fetch(`/api/customer/order_items/${o.id}`)
        .then(r => r.json())
        .then(items => ({ id: o.id, items }))
    );
    Promise.all(fetches).then(results => {
      const details = {};
      results.forEach(({ id, items }) => { details[id] = items; });
      setOrderDetails(details);
    });
  }, [orders]);

  let filteredProducts = products;

  if (activeCategory !== 'all') {
    filteredProducts = filteredProducts.filter(p => p.category_slug === activeCategory || p.category_name.toLowerCase() === activeCategory.toLowerCase());
  }

  if (sortOption === 'price_asc') {
    filteredProducts.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
  } else if (sortOption === 'price_desc') {
    filteredProducts.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
  } else if (sortOption === 'name_asc') {
    filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortOption === 'name_desc') {
    filteredProducts.sort((a, b) => b.name.localeCompare(a.name));
  }

  return (
    <div className="customer-dash" style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', width: '100%' }}>
      {/* --- Vertical Sidebar --- */}
      <aside style={{ width: '280px', background: '#fff', borderRight: '1px solid #e2e8f0', padding: '40px 24px', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', zIndex: 100 }}>
        <div style={{ marginBottom: '40px' }}>
          <a href="#" onClick={(e) => { e.preventDefault(); setPage('home'); }} style={{ fontSize: '24px', fontWeight: '800', color: 'var(--clr-kadal)', textDecoration: 'none', fontFamily: 'Outfit' }}>
            Sara<span style={{ color: 'var(--clr-orange)' }}>.</span>
          </a>
        </div>

        <h2 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '1.2px', marginBottom: '20px', fontWeight: 800 }}>Browse Store</h2>
        <nav className="sidebar-scroll-dark" style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' }}>
          <button
            onClick={() => { setActiveCategory('all'); setActiveView('shop'); }}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', background: activeCategory === 'all' && activeView === 'shop' ? 'rgba(8, 51, 68, 0.05)' : 'transparent', color: activeCategory === 'all' && activeView === 'shop' ? 'var(--clr-kadal)' : '#64748b', border: 'none', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', textAlign: 'left', fontSize: '14px' }}
          >
            <i className="fas fa-th-large" style={{ width: '20px' }}></i> All Materials
          </button>
          {categories.map(c => {
            const catValue = c.slug || c.name;
            const isActive = activeCategory === catValue && activeView === 'shop';
            return (
              <button
                key={c.id}
                onClick={() => { setActiveCategory(catValue); setActiveView('shop'); }}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', background: isActive ? 'rgba(8, 51, 68, 0.05)' : 'transparent', color: isActive ? 'var(--clr-kadal)' : '#64748b', border: 'none', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', textAlign: 'left', fontSize: '14px' }}
              >
                <i className="fas fa-circle" style={{ fontSize: '6px', width: '20px', textAlign: 'center', opacity: isActive ? 1 : 0.3 }}></i> {c.name}
              </button>
            );
          })}
        </nav>

        <button
          onClick={() => setActiveView('services')}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', background: activeView === 'services' ? 'rgba(8, 51, 68, 0.05)' : 'transparent', color: activeView === 'services' ? 'var(--clr-kadal)' : '#64748b', border: 'none', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', textAlign: 'left', fontSize: '14px', marginTop: '10px', width: '100%' }}
        >
          <i className="fas fa-hand-sparkles" style={{ width: '20px' }}></i> Expert Services
        </button>

        <div style={{ marginTop: 'auto', paddingTop: '40px' }}>
          <h2 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '1.2px', marginBottom: '20px', fontWeight: 800 }}>Account</h2>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>

            <button
              onClick={() => { setPage('home'); setTimeout(logout, 100); }}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', textAlign: 'left', fontSize: '14px', marginTop: '10px' }}
            >
              <i className="fas fa-power-off" style={{ width: '20px' }}></i> Logout
            </button>
          </nav>
        </div>
      </aside>

      {/* --- Main Area --- */}
      <main style={{ flex: 1, padding: '40px 60px', height: '100vh', overflowY: 'auto' }}>
        {/* Top Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '60px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--clr-kadal)', margin: 0, fontFamily: 'Outfit' }}>
              {activeView === 'shop' ? 'Materials Catalog' : activeView === 'product_detail' ? 'Product Details' : activeView === 'orders' ? 'Order History' : activeView === 'services' ? 'Expert Services' : activeView === 'inquiries' ? 'My Inquiries' : 'My Profile'}
            </h1>
            <p style={{ color: '#94a3b8', margin: '4px 0 0 0', fontSize: '14px' }}>Welcome back, {user.name}</p>
          </div>

          {activeView === 'orders' && (
            <button
              onClick={() => window.open(`/api/customer/statement/${user.id}`, '_blank')}
              style={{ background: 'var(--clr-orange)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(249, 115, 22, 0.2)', transition: '0.3s' }}
            >
              <i className="fas fa-file-invoice"></i> Download Statement
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {/* Orders Button */}
            <button
              onClick={() => setActiveView('orders')}
              style={{ background: activeView === 'orders' ? 'rgba(8, 51, 68, 0.05)' : '#fff', border: '1px solid #e2e8f0', padding: '10px 18px', borderRadius: '12px', cursor: 'pointer', color: activeView === 'orders' ? 'var(--clr-kadal)' : '#64748b', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, transition: 'all 0.2s', fontSize: '14px' }}
            >
              <i className="fas fa-receipt"></i> Orders
            </button>

            {/* Inquiries Button */}
            <button
              onClick={() => setActiveView('inquiries')}
              style={{ background: activeView === 'inquiries' ? 'rgba(8, 51, 68, 0.05)' : '#fff', border: '1px solid #e2e8f0', padding: '10px 18px', borderRadius: '12px', cursor: 'pointer', color: activeView === 'inquiries' ? 'var(--clr-kadal)' : '#64748b', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, transition: 'all 0.2s', fontSize: '14px' }}
            >
              <i className="fas fa-envelope"></i> Inquiries
            </button>

            {/* Cart Button */}
            <button onClick={() => setPage('cart')} style={{ background: '#fff', border: '1px solid #e2e8f0', height: '45px', padding: '0 18px', borderRadius: '12px', cursor: 'pointer', color: 'var(--clr-kadal)', position: 'relative', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.2s', fontWeight: 600, fontSize: '14px' }}>
              <i className="fas fa-shopping-bag" style={{ fontSize: '18px' }}></i>
              <span>Cart</span>
              {cart && cart.length > 0 && (
                <span style={{ background: 'var(--clr-orange)', color: '#fff', fontSize: '10px', fontWeight: '800', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', marginLeft: '5px' }}>
                  {cart.length}
                </span>
              )}
            </button>

            {/* Profile Button */}
            <button
              onClick={() => setActiveView('profile')}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', background: activeView === 'profile' ? 'rgba(8, 51, 68, 0.05)' : '#fff', border: '1px solid #e2e8f0', padding: '6px 6px 6px 16px', borderRadius: '12px', color: activeView === 'profile' ? 'var(--clr-kadal)' : '#64748b', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <span>{user.name.split(' ')[0]}</span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--clr-kadal)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
                <i className="fas fa-user-circle"></i>
              </div>
            </button>
          </div>
        </header>

        {activeView === 'shop' ? (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--clr-kadal)', margin: 0 }}>
                {activeCategory === 'all' ? 'All Materials' : categories.find(c => (c.slug || c.name) === activeCategory)?.name}
              </h2>

              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>{filteredProducts.length} Items found</span>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 14px' }}>
                  <i className="fas fa-sliders" style={{ color: '#94a3b8', fontSize: '12px', marginRight: '10px' }}></i>
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                    style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', fontWeight: 600, color: 'var(--clr-kadal)', cursor: 'pointer' }}
                  >
                    <option value="name_asc">Sort: A-Z</option>
                    <option value="name_desc">Sort: Z-A</option>
                    <option value="price_asc">Price: Low-High</option>
                    <option value="price_desc">Price: High-Low</option>
                  </select>
                </div>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '100px 20px', background: '#fff', borderRadius: '20px', border: '1px dashed #e2e8f0' }}>
                <i className="fas fa-search" style={{ fontSize: '3rem', color: '#e2e8f0', marginBottom: '20px' }}></i>
                <h3 style={{ fontSize: '18px', color: 'var(--clr-kadal)', marginBottom: '8px' }}>No items found in this category</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px' }}>Try exploring our other premium materials.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px' }}>
                {filteredProducts.map(p => {
                  const pData = products.find(prod => prod.id === p.id) || p;
                  const qty = pData.stock_quantity;
                  return (
                    <div key={p.id} className="shop-item" onClick={() => { setSelectedProduct(pData); setActiveView('product_detail'); }} style={{ background: '#fff', borderRadius: '20px', overflow: 'hidden', transition: 'all 0.3s ease', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}>
                      <div style={{ width: '100%', height: '260px', position: 'relative', overflow: 'hidden' }}>
                        {p.image_url ? (
                          <img
                            src={(p.image_url.startsWith('http') || p.image_url.startsWith('/') ? p.image_url : '/' + p.image_url) + '?v=2'}
                            alt={p.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/400x300?text=No+Image'; }}
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className="fas fa-cube" style={{ fontSize: '3rem', color: '#e2e8f0' }}></i>
                          </div>
                        )}
                        {qty < 10 && qty > 0 && <span style={{ position: 'absolute', top: '15px', right: '15px', background: '#ef4444', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>Low Stock</span>}
                      </div>

                      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--clr-orange)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{p.category_name}</p>
                        <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--clr-kadal)', marginBottom: '8px', lineHeight: 1.3 }}>{p.name}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                          <span style={{ fontSize: '12px', padding: '4px 8px', background: qty > 0 ? '#f0fdf4' : '#fef2f2', color: qty > 0 ? '#16a34a' : '#ef4444', borderRadius: '6px', fontWeight: 700 }}>
                            <i className={`fas ${qty > 0 ? 'fa-check-circle' : 'fa-times-circle'}`} style={{ marginRight: '4px' }}></i>
                            {qty > 0 ? `In Stock: ${qty} ${p.unit || 'units'}` : 'Out of Stock'}
                          </span>
                        </div>

                        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--clr-kadal)' }}>₹{parseFloat(p.price).toFixed(2)}</span>
                            <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '4px' }}>/ {p.unit || 'sqft'}</span>
                          </div>
                          <button
                            disabled={qty <= 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProduct(p);
                              const unit = (p.unit || '').toLowerCase();
                              if (p.category_name === 'Paving Stones') {
                                setCalcModalOpen(true);
                              } else if (['kilogram', 'kg', 'bag', 'piece', 'pieces'].includes(unit)) {
                                setQtyValue('1');
                                setQtyModalOpen(true);
                              } else {
                                addToCart(p, 1);
                              }
                            }}
                            style={{ background: qty > 0 ? 'var(--clr-kadal)' : '#e2e8f0', color: '#fff', border: 'none', width: '38px', height: '38px', borderRadius: '10px', cursor: qty > 0 ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
                          >
                            <i className={`fas ${qty > 0 ? (p.category_name === 'Paving Stones' ? 'fa-calculator' : (['kilogram', 'kg', 'bag', 'piece', 'pieces'].includes((p.unit || '').toLowerCase()) ? 'fa-layer-group' : 'fa-plus')) : 'fa-times'}`}></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeView === 'product_detail' && selectedProduct ? (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <button onClick={() => setActiveView('shop')} style={{ background: 'none', border: 'none', color: 'var(--clr-orange)', fontWeight: 700, cursor: 'pointer', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fas fa-arrow-left"></i> Back to Gallery
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', background: '#fff', borderRadius: '30px', padding: '50px', boxShadow: '0 10px 40px rgba(0,0,0,0.02)', border: '1px solid #f1f5f9' }}>
              <div style={{ borderRadius: '20px', overflow: 'hidden', background: '#f8fafc', height: '500px' }}>
                {selectedProduct.image_url ? (
                  <img src={selectedProduct.image_url + '?v=2'} alt={selectedProduct.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fas fa-cube" style={{ fontSize: '5rem', color: '#e2e8f0' }}></i>
                  </div>
                )}
              </div>

              <div>
                <span style={{ background: 'rgba(249, 115, 22, 0.1)', color: 'var(--clr-orange)', padding: '6px 15px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>{selectedProduct.category_name}</span>
                <h2 style={{ fontSize: '36px', fontWeight: 800, color: 'var(--clr-kadal)', margin: '20px 0 10px 0' }}>{selectedProduct.name}</h2>
                <div style={{ fontSize: '20px', color: '#94a3b8', marginBottom: '30px' }}>â­ {selectedProduct.rating || '4.5'} <span style={{ fontSize: '14px', marginLeft: '10px' }}>(120+ verified orders)</span></div>

                <div style={{ padding: '25px', background: '#f8fafc', borderRadius: '15px', marginBottom: '30px' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#64748b', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>Product Description</h4>
                  <p style={{ color: 'var(--clr-kadal)', lineHeight: 1.6, margin: 0 }}>{selectedProduct.description || 'Premium quality building material sourced directly for durability and aesthetic appeal. Perfect for structural integrity and modern architectural designs.'}</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '30px', marginBottom: '40px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '13px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '5px' }}>Price Per {selectedProduct.unit || 'Unit'}</span>
                    <span style={{ fontSize: '32px', fontWeight: 900, color: 'var(--clr-kadal)' }}>₹{parseFloat(selectedProduct.price).toFixed(2)}</span>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '13px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '5px' }}>Availability</span>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: selectedProduct.stock_quantity > 0 ? '#22c55e' : '#ef4444' }}>
                      {selectedProduct.stock_quantity > 0 ? `${selectedProduct.stock_quantity} ${selectedProduct.unit || 'units'} available` : 'Out of Stock'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '20px' }}>
                  {selectedProduct.category_name === 'Paving Stones' ? (
                    <button onClick={() => setCalcModalOpen(true)} className="btn btn-primary" style={{ flex: 1, padding: '18px', fontSize: '16px', fontWeight: 800, borderRadius: '15px' }}>
                      <i className="fas fa-calculator"></i> Calculate Area & Add
                    </button>
                  ) : ['kilogram', 'kg', 'bag', 'piece', 'pieces'].includes((selectedProduct.unit || '').toLowerCase()) ? (
                    <button onClick={() => { setQtyValue('1'); setQtyModalOpen(true); }} className="btn btn-primary" style={{ flex: 1, padding: '18px', fontSize: '16px', fontWeight: 800, borderRadius: '15px' }}>
                      <i className="fas fa-cart-plus"></i> Select {['kilogram', 'kg'].includes((selectedProduct.unit || '').toLowerCase()) ? 'Weight' : 'Quantity'}
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '15px', flex: 1 }}>
                      <input
                        type="number"
                        defaultValue="1"
                        id="bulk-qty"
                        min="1"
                        style={{ width: '80px', padding: '15px', borderRadius: '15px', border: '2px solid #e2e8f0', fontSize: '18px', fontWeight: 700, textAlign: 'center', outline: 'none' }}
                      />
                      <button
                        onClick={() => {
                          const val = document.getElementById('bulk-qty').value;
                          addToCart(selectedProduct, val);
                        }}
                        className="btn btn-primary"
                        style={{ flex: 1, padding: '18px', fontSize: '16px', fontWeight: 800, borderRadius: '15px' }}
                      >
                        <i className="fas fa-shopping-bag"></i> Add to Cart
                      </button>
                    </div>
                  )}
                  <button style={{ width: '60px', height: '60px', borderRadius: '15px', border: '2px solid #e2e8f0', background: '#fff', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', cursor: 'pointer' }}>
                    <i className="far fa-heart"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : activeView === 'orders' ? (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '100px 20px', background: '#fff', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.04)' }}>
                <i className="fas fa-box-open" style={{ fontSize: '5rem', color: '#e0e0e0', marginBottom: '20px' }}></i>
                <h3 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--clr-kadal)', marginBottom: '10px' }}>No orders found</h3>
                <p style={{ color: '#888', marginBottom: '30px' }}>You haven't placed any orders with us yet.</p>
                <button className="btn btn-primary" onClick={() => setActiveView('shop')} style={{ padding: '12px 30px' }}>Start Shopping</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '30px' }}>
                {orders.map((o) => (
                  <div key={o.id} id={`order-card-${o.id}`} style={{ background: '#fff', borderRadius: '24px', transition: 'all 0.3s ease', border: '1px solid #f1f5f9', boxShadow: expandedOrders[o.id] ? '0 15px 45px rgba(0,0,0,0.06)' : '0 4px 20px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                    
                    {/* Professional Invoice Header */}
                    <div style={{ background: 'linear-gradient(135deg, var(--clr-kadal) 0%, #0a4a5c 100%)', padding: '40px 40px 30px 40px', color: '#fff', position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                          <img src="/img/logo_premium.png" alt="Sara Construction" style={{ width: '80px', height: '40px', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
                          <div>
                            <h1 style={{ fontSize: '28px', fontWeight: '900', margin: '0 0 4px 0', fontFamily: 'Outfit' }}>Sara<span style={{ color: 'var(--clr-orange)' }}>.</span></h1>
                            <p style={{ fontSize: '12px', opacity: 0.8, margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Construction & Landscaping</p>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '11px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Invoice Number</div>
                          <div style={{ fontSize: '20px', fontWeight: '800' }}>#INV-{1000 + o.id}</div>
                          <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '8px' }}>{new Date(o.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                          {o.items_info && (
                            <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px', fontStyle: 'italic' }}>{o.items_info}</div>
                          )}
                        </div>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '30px' }}>
                        <div>
                          <h4 style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', opacity: 0.8 }}>From</h4>
                          <div style={{ fontSize: '14px', lineHeight: 1.5 }}>
                            <div style={{ fontWeight: '700' }}>Sara Construction Pvt Ltd</div>
                            <div>123 Industrial Parkway</div>
                            <div>Ernakulam, Kerala 682039</div>
                            <div>+91 800-SARA-APP</div>
                            <div>support@saraconstruction.com</div>
                          </div>
                        </div>
                        <div>
                          <h4 style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', opacity: 0.8 }}>Bill To</h4>
                          <div style={{ fontSize: '14px', lineHeight: 1.5 }}>
                            <div style={{ fontWeight: '700' }}>{user.name}</div>
                            <div>{user.email}</div>
                            <div>{user.phone}</div>
                          </div>
                        </div>
                        <div>
                          <h4 style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', opacity: 0.8 }}>Order Status</h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ 
                              padding: '8px 16px', borderRadius: '50px', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', 
                              background: o.status === 'delivered' ? '#dcfce7' : o.status === 'cancelled' ? '#fef2f2' : o.status === 'shipped' ? '#dbeafe' : '#fff7ed', 
                              color: o.status === 'delivered' ? '#16a34a' : o.status === 'cancelled' ? '#ef4444' : o.status === 'shipped' ? '#2563eb' : '#ea580c',
                              border: `2px solid ${o.status === 'delivered' ? '#bbf7d0' : o.status === 'cancelled' ? '#fee2e2' : o.status === 'shipped' ? '#bfdbfe' : '#fed7aa'}`
                            }}>
                              <i className={`fas fa-${o.status === 'delivered' ? 'check-circle' : o.status === 'cancelled' ? 'times-circle' : o.status === 'shipped' ? 'truck' : 'clock'} mr-1`} style={{ marginRight: '6px' }}></i>
                              {o.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Order Details Section */}
                    <div style={{ padding: '40px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '40px' }}>
                        
                        {/* Products Table */}
                        <div>
                          <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--clr-kadal)', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <i className="fas fa-shopping-bag" style={{ color: 'var(--clr-orange)' }}></i>
                            Order Items
                          </h3>
                          
                          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                            <div style={{ background: '#f8fafc', padding: '15px 20px', borderBottom: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '60px 2fr 1fr 1fr 1fr', gap: '15px', fontSize: '13px', fontWeight: '800', color: 'var(--clr-kadal)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              <div>Image</div>
                              <div>Product</div>
                              <div>Quantity</div>
                              <div>Unit Price</div>
                              <div>Total</div>
                            </div>
                            
                            {orderDetails[o.id] && orderDetails[o.id].length > 0 ? (
                              orderDetails[o.id].map((item, idx) => (
                                <div key={idx} style={{ padding: '20px', display: 'grid', gridTemplateColumns: '60px 2fr 1fr 1fr 1fr', gap: '15px', alignItems: 'center', borderBottom: idx < orderDetails[o.id].length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                  <div style={{ width: '50px', height: '50px', borderRadius: '8px', overflow: 'hidden', background: '#f8fafc' }}>
                                    <img 
                                      src={item.image_url ? (item.image_url.startsWith('/') ? item.image_url : '/' + item.image_url) + '?v=2' : 'https://placehold.co/100x100?text=Material'} 
                                      alt={item.name} 
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                      onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/100x100?text=Material'; }}
                                    />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--clr-kadal)', marginBottom: '4px' }}>{item.name}</div>
                                    <div style={{ fontSize: '12px', color: '#64748b' }}>{item.category_name || 'Building Material'}</div>
                                  </div>
                                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--clr-kadal)' }}>{item.quantity} {item.unit || 'Units'}</div>
                                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--clr-kadal)' }}>₹{parseFloat(item.unit_price).toLocaleString()}</div>
                                  <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--clr-kadal)' }}>₹{parseFloat(item.total_price).toLocaleString()}</div>
                                </div>
                              ))
                            ) : (
                              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                                No items found for this order.
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Order Summary & Actions */}
                        <div>
                          <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '25px', marginBottom: '25px' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--clr-kadal)', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Order Summary</h4>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px' }}>
                              <span style={{ color: '#64748b' }}>Subtotal</span>
                              <span style={{ fontWeight: '600', color: 'var(--clr-kadal)' }}>₹{parseFloat(o.total_amount).toLocaleString()}</span>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px' }}>
                              <span style={{ color: '#64748b' }}>GST (SGST + CGST)</span>
                              <span style={{ fontWeight: '600', color: 'var(--clr-kadal)' }}>Included</span>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px' }}>
                              <span style={{ color: '#64748b' }}>Shipping</span>
                              <span style={{ fontWeight: '600', color: 'var(--clr-kadal)' }}>Free</span>
                            </div>
                            
                            <div style={{ height: '1px', background: '#e2e8f0', margin: '15px 0' }}></div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '800', color: 'var(--clr-kadal)' }}>
                              <span>Grand Total</span>
                              <span>₹{parseFloat(o.total_amount).toLocaleString()}</span>
                            </div>
                          </div>

                          {/* Shipping Address */}
                          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '25px', marginBottom: '25px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                              <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--clr-kadal)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="fas fa-map-marker-alt" style={{ color: 'var(--clr-orange)' }}></i>
                                Shipping Address
                              </h4>
                              {o.status === 'pending' && (
                                <button
                                  onClick={() => {
                                    setEditingOrder(editingOrder === o.id ? null : o.id);
                                    setEditAddress(o.shipping_address);
                                  }}
                                  style={{ background: 'none', border: 'none', color: 'var(--clr-orange)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                                >
                                  <i className={`fas fa-${editingOrder === o.id ? 'times' : 'edit'}`} style={{ marginRight: '6px' }}></i>
                                  {editingOrder === o.id ? 'Cancel' : 'Edit'}
                                </button>
                              )}
                            </div>
                            
                            {editingOrder === o.id ? (
                              <div>
                                <textarea
                                  value={editAddress}
                                  onChange={(e) => setEditAddress(e.target.value)}
                                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', lineHeight: 1.5, marginBottom: '15px', fontFamily: 'inherit', resize: 'vertical' }}
                                  rows="3"
                                  placeholder="Enter new shipping address"
                                />
                                <div style={{ display: 'flex', gap: '10px' }}>
                                  <button
                                    onClick={() => {
                                      fetch(`/api/customer/update_address/${o.id}`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        credentials: 'include',
                                        body: JSON.stringify({ address: editAddress })
                                      })
                                      .then(r => r.json())
                                      .then(d => {
                                        if (d.success) {
                                          showToast('Address updated successfully!');
                                          setEditingOrder(null);
                                          // Refresh orders
                                          fetch(`/api/customer/orders/${user.id}`).then(r => r.json()).then(setOrders);
                                        } else {
                                          showToast('Failed to update address', 'error');
                                        }
                                      });
                                    }}
                                    style={{ background: 'var(--clr-kadal)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                                  >
                                    Save Changes
                                  </button>
                                  <button
                                    onClick={() => setEditingOrder(null)}
                                    style={{ background: '#f1f5f9', color: '#64748b', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: '14px', lineHeight: 1.6, color: '#64748b' }}>
                                {o.shipping_address}
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: 'grid', gap: '12px' }}>
                            <button
                              onClick={() => window.open(`/api/customer/invoice/${o.id}`, '_blank')}
                              style={{ background: 'var(--clr-kadal)', color: '#fff', border: 'none', padding: '14px', borderRadius: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: '0.3s' }}
                              onMouseOver={(e) => e.target.style.background = '#0a4a5c'}
                              onMouseOut={(e) => e.target.style.background = 'var(--clr-kadal)'}
                            >
                              <i className="fas fa-file-pdf"></i> Download Invoice
                            </button>
                            
                            <button
                              onClick={() => {
                                const el = document.getElementById(`order-card-${o.id}`);
                                if (!el) { window.print(); return; }
                                const printWindow = window.open('', '_blank', 'width=900,height=700');
                                printWindow.document.write(`
                                  <!DOCTYPE html>
                                  <html>
                                    <head>
                                      <title>Invoice #INV-${1000 + o.id} - Sara Construction</title>
                                      <link rel="stylesheet" href="/styles.css">
                                      <style>
                                        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap');
                                        body { font-family: 'Outfit', sans-serif; margin: 0; padding: 0; background: #fff; }
                                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                                        button { display: none !important; }
                                        @page { size: A4; margin: 10mm; }
                                        @media print { button { display: none !important; } }
                                      </style>
                                    </head>
                                    <body>${el.innerHTML}</body>
                                  </html>
                                `);
                                printWindow.document.close();
                                printWindow.onload = () => {
                                  printWindow.focus();
                                  printWindow.print();
                                };
                              }}
                              style={{ background: '#fff', color: 'var(--clr-kadal)', border: '2px solid #e2e8f0', padding: '14px', borderRadius: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: '0.3s' }}
                              onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                              onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
                            >
                              <i className="fas fa-print"></i> Print Invoice
                            </button>

                            <button
                              onClick={() => setActiveView('shop')}
                              style={{ background: 'var(--clr-orange)', color: '#fff', border: 'none', padding: '14px', borderRadius: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: '0.3s' }}
                              onMouseOver={(e) => e.target.style.background = '#ea580c'}
                              onMouseOut={(e) => e.target.style.background = 'var(--clr-orange)'}
                            >
                              <i className="fas fa-shopping-bag"></i> Shop More
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeView === 'services' ? (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '30px' }}>
              {services.map(s => (
                <div key={s.id} style={{ background: '#fff', borderRadius: '24px', padding: '35px', border: '1px solid #f1f5f9', transition: 'all 0.3s ease', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'rgba(8, 51, 68, 0.05)', color: 'var(--clr-kadal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '25px' }}>
                    <i className="fas fa-tools"></i>
                  </div>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--clr-kadal)', marginBottom: '12px' }}>{s.name}</h3>
                  <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6, marginBottom: '25px', flex: 1 }}>{s.description}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--clr-orange)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.price_range}</span>
                    <button
                      onClick={() => { setSelectedService(s); setInquiryOpen(true); }}
                      style={{ background: 'var(--clr-kadal)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', transition: '0.2s', fontSize: '13px' }}
                    >
                      Book Consultation
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeView === 'inquiries' ? (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, var(--clr-kadal), #0a4a5c)', borderRadius: '24px', padding: '30px', marginBottom: '25px', color: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 900 }}>My Enquiries</h2>
                  <p style={{ margin: '6px 0 0 0', opacity: 0.7, fontSize: '14px' }}>Track all your service enquiries and get responses</p>
                </div>
                <button
                  onClick={() => setInquiryOpen(true)}
                  style={{ background: 'var(--clr-orange)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '14px', cursor: 'pointer', fontWeight: 800, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <i className="fas fa-plus"></i> New Enquiry
                </button>
              </div>
              <div style={{ display: 'flex', gap: '20px', marginTop: '25px' }}>
                {[{label: 'Total Sent', val: inquiries.length, icon: 'fa-paper-plane'}, {label: 'Open', val: inquiries.filter(i=>i.status==='new'||i.status==='in_progress').length, icon: 'fa-clock'}, {label: 'Answered', val: inquiries.filter(i=>i.status==='replied').length, icon: 'fa-check-circle'}].map((stat,idx) => (
                  <div key={idx} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: '14px', padding: '15px', backdropFilter: 'blur(10px)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <i className={`fas ${stat.icon}`} style={{ opacity: 0.8 }}></i>
                      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', opacity: 0.7 }}>{stat.label}</div>
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: 900, marginTop: '8px' }}>{stat.val}</div>
                  </div>
                ))}
              </div>
            </div>

            {loadingInquiries ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--clr-kadal)', marginBottom: '15px', display: 'block' }}></i>
                Loading your enquiries...
              </div>
            ) : inquiries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', background: '#fff', borderRadius: '24px', border: '1px solid #f1f5f9' }}>
                <div style={{ width: '80px', height: '80px', background: 'rgba(8,51,68,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
                  <i className="fas fa-envelope-open-text" style={{ fontSize: '2rem', color: 'var(--clr-kadal)' }}></i>
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--clr-kadal)', margin: '0 0 8px 0' }}>No Enquiries Yet</h3>
                <p style={{ color: '#64748b', margin: '0 0 20px 0', fontSize: '14px' }}>Have a question or need a consultation? Submit an enquiry and we will respond shortly.</p>
                <button onClick={() => setInquiryOpen(true)} style={{ background: 'var(--clr-kadal)', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '14px', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>Submit Your First Enquiry</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {inquiries.map(inq => {
                  const statusConfig = {
                    new: { bg: '#fef3c7', color: '#92400e', label: 'Awaiting Response', icon: 'fa-hourglass-half' },
                    read: { bg: '#dbeafe', color: '#1e40af', label: 'Read by Team', icon: 'fa-eye' },
                    in_progress: { bg: '#ede9fe', color: '#6d28d9', label: 'Being Handled', icon: 'fa-spinner' },
                    replied: { bg: '#d1fae5', color: '#065f46', label: 'Replied', icon: 'fa-check-double' },
                    cancelled: { bg: '#fee2e2', color: '#991b1b', label: 'Closed', icon: 'fa-times-circle' },
                  };
                  const cfg = statusConfig[inq.status] || statusConfig.new;
                  return (
                    <div key={inq.id} style={{ background: '#fff', borderRadius: '20px', overflow: 'hidden', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.025)', transition: 'box-shadow 0.2s' }}>
                      <div style={{ display: 'flex', alignItems: 'stretch' }}>
                        <div style={{ width: '6px', background: inq.priority === 'high' ? '#ef4444' : inq.priority === 'normal' ? 'var(--clr-orange)' : '#94a3b8', flexShrink: 0 }}></div>
                        <div style={{ flex: 1, padding: '22px 25px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <div>
                              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--clr-kadal)', marginBottom: '4px' }}>{inq.subject || 'General Enquiry'}</div>
                              <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span><i className="far fa-calendar" style={{ marginRight: '4px' }}></i>{new Date(inq.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                <span><i className="far fa-clock" style={{ marginRight: '4px' }}></i>{new Date(inq.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                            <span style={{ padding: '6px 14px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, background: cfg.bg, color: cfg.color, display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                              <i className={`fas ${cfg.icon}`}></i> {cfg.label}
                            </span>
                          </div>
                          <p style={{ margin: '0 0 12px 0', color: '#475569', fontSize: '14px', lineHeight: 1.6, background: '#f8fafc', padding: '12px 15px', borderRadius: '10px' }}>{inq.message}</p>
                          {inq.remarks && (
                            <div style={{ background: 'rgba(8,51,68,0.04)', border: '1px solid rgba(8,51,68,0.1)', borderRadius: '10px', padding: '12px 15px', marginBottom: '12px' }}>
                              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--clr-kadal)', textTransform: 'uppercase', marginBottom: '5px' }}><i className="fas fa-reply" style={{ marginRight: '5px' }}></i>Team Response</div>
                              <p style={{ margin: 0, color: '#334155', fontSize: '14px', lineHeight: 1.5 }}>{inq.remarks}</p>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                              onClick={() => { setSelectedService(null); setInquiryOpen(true); }}
                              style={{ padding: '8px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: 'var(--clr-kadal)', fontWeight: 700, cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              <i className="fas fa-reply"></i> Follow Up
                            </button>
                            {inq.status === 'replied' && (
                              <span style={{ padding: '8px 14px', borderRadius: '10px', background: '#d1fae5', color: '#065f46', fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <i className="fas fa-check"></i> This enquiry has been resolved
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <ProfileView user={user} updateUser={updateUser} showToast={showToast} />
        )}
      </main>

      {calcModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '40px', borderRadius: '24px', maxWidth: '450px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.1)', animation: 'fadeIn 0.3s ease-out' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 10px 0', color: 'var(--clr-kadal)', fontSize: '22px', fontWeight: 800 }}>Paving Area Calculator</h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '25px', lineHeight: 1.5 }}>Enter the total square feet required for your project. The quantity added to cart will match the sqft you enter.</p>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '1px' }}>Total Area (Sq Ft)</label>
              <input
                type="number"
                value={calcSqft}
                onChange={(e) => setCalcSqft(e.target.value)}
                autoFocus
                placeholder="e.g. 500"
                style={{ width: '100%', padding: '18px', borderRadius: '15px', border: '2px solid #e2e8f0', fontSize: '20px', fontWeight: 800, color: 'var(--clr-kadal)', outline: 'none' }}
              />
            </div>

            {calcSqft > 0 && (
              <div style={{ background: 'rgba(8, 51, 68, 0.03)', padding: '20px', borderRadius: '15px', marginBottom: '25px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Order Quantity:</div>
                <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--clr-orange)', margin: '5px 0' }}>{calcSqft} <span style={{ fontSize: '16px' }}>Sq Ft</span></div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Estimated Price: ₹{(parseFloat(calcSqft) * selectedProduct.price).toLocaleString()}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '15px' }}>
              <button
                className="btn btn-primary"
                disabled={!calcSqft || calcSqft <= 0}
                onClick={() => {
                  addToCart(selectedProduct, parseFloat(calcSqft));
                  setCalcModalOpen(false);
                  setCalcSqft('');
                }}
                style={{ flex: 1, padding: '15px', justifyContent: 'center', borderRadius: '12px', fontSize: '15px', fontWeight: 800 }}
              >
                Add {calcSqft > 0 ? calcSqft : ''} Sq Ft to Cart
              </button>
              <button
                onClick={() => { setCalcModalOpen(false); setCalcSqft(''); }}
                style={{ padding: '15px 25px', border: 'none', background: '#f1f5f9', color: '#64748b', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', transition: '0.2s' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {qtyModalOpen && selectedProduct && (
        <div className="modal-overlay" style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '40px', borderRadius: '24px', maxWidth: '400px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.1)', animation: 'fadeIn 0.3s ease-out' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 10px 0', color: 'var(--clr-kadal)', fontSize: '22px', fontWeight: 800 }}>Add to Cart</h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: 700 }}>{selectedProduct.name}</span>
              <span style={{ color: 'var(--clr-orange)', fontWeight: 800 }}>₹{parseFloat(selectedProduct.price).toLocaleString()} / {selectedProduct.unit}</span>
            </p>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '1px' }}>
                {['kilogram', 'kg'].includes((selectedProduct.unit || '').toLowerCase()) ? 'How many kilogram need?' :
                  (selectedProduct.unit || '').toLowerCase() === 'bag' ? 'How many bag needed?' :
                    'How many pieces needed?'}
              </label>
              <input
                type="number"
                value={qtyValue}
                onChange={(e) => setQtyValue(e.target.value)}
                autoFocus
                min="1"
                style={{ width: '100%', padding: '18px', borderRadius: '15px', border: '2px solid #e2e8f0', fontSize: '22px', fontWeight: 800, color: 'var(--clr-kadal)', outline: 'none', textAlign: 'center' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  addToCart(selectedProduct, qtyValue);
                  setQtyModalOpen(false);
                }}
                style={{ flex: 1, padding: '15px', justifyContent: 'center', borderRadius: '12px', fontSize: '15px', fontWeight: 800 }}
              >
                Confirm & Add
              </button>
              <button
                onClick={() => setQtyModalOpen(false)}
                style={{ padding: '15px 25px', border: 'none', background: '#f1f5f9', color: '#64748b', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', transition: '0.2s' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StaffDashboard() {
  const { user, logout, showToast, updateUser } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState('reports');
  const [stats, setStats] = useState({ orders: 0, pending: 0, inquiries: 0, revenue: 0 });

  // Notification State
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [dismissedIds, setDismissedIds] = useState(() => JSON.parse(localStorage.getItem('sara_dismissed_notifs') || '[]'));

  // Data State
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [reportPeriod, setReportPeriod] = useState('all'); // all, today, month, year, financial_year
  const [reportData, setReportData] = useState({
    daily_sales: [],
    monthly_sales: [],
    top_customers: [],
    product_performance: [],
    category_sales: [],
    low_stock: []
  });

  // UI State
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  // Inquiry filter state (must be at component level - hooks cannot be inside IIFE/nested fn)
  const [inqSearch, setInqSearch] = useState('');
  const [inqStatusFilter, setInqStatusFilter] = useState('');
  const [inqPriorityFilter, setInqPriorityFilter] = useState('');
  const [replyModal, setReplyModal] = useState(null);
  const [replyText, setReplyText] = useState('');

  // Modal State
  const [modalType, setModalType] = useState(null); // 'product', 'category', 'subcategory', 'courier', 'courier_partner', 'inquiry_view', 'report_generator', 'courier_login'
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [courierLoginForm, setCourierLoginForm] = useState({ email: '', password: '', courier_id: null, courier_name: '' });
  const [courierAccounts, setCourierAccounts] = useState({}); // { courierId: { has_account, user } }


  useEffect(() => {
    fetchStats();
    if (activeTab === 'reports') {
      loadTabData('reports', reportPeriod);
    } else {
      loadTabData(activeTab);
    }
  }, [activeTab]);

  const fetchStats = () => {
    fetch('/api/admin/stats').then(r => r.json()).then(d => {
      setStats({
        orders: d.total_orders || 0,
        pending: d.pending || 0,
        inquiries: 0, // Will be updated below
        revenue: d.revenue || 0
      });
    });
    fetch('/api/staff/inquiries').then(r => r.json()).then(d => {
      setStats(prev => ({ ...prev, inquiries: d.length }));
    });
  };

  const fetchNotifications = () => {
    fetch('/api/notifications', { credentials: 'include' }).then(r => r.json()).then(d => {
      const all = d.notifications || [];
      const dismissed = JSON.parse(localStorage.getItem('sara_dismissed_notifs') || '[]');
      const active = all.filter(n => !dismissed.includes(n.id));
      setNotifications(active);
      setUnreadCount(active.length);
    }).catch(() => {});
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // poll every 60s
    return () => clearInterval(interval);
  }, []);

  const dismissNotification = (id) => {
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    localStorage.setItem('sara_dismissed_notifs', JSON.stringify(updated));
    setNotifications(prev => prev.filter(n => n.id !== id));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const clearAllNotifications = () => {
    const ids = notifications.map(n => n.id);
    const updated = [...dismissedIds, ...ids];
    setDismissedIds(updated);
    localStorage.setItem('sara_dismissed_notifs', JSON.stringify(updated));
    setNotifications([]);
    setUnreadCount(0);
    setShowNotifPanel(false);
  };

  const loadTabData = (tab, period = 'all') => {
    setLoading(true);
    const endpoints = {
      orders: '/api/admin/orders',
      delivery: '/api/admin/orders',
      products: '/api/products',
      categories: '/api/categories',
      inquiries: '/api/staff/inquiries',
      customers: '/api/admin/users',
      couriers: '/api/admin/couriers',
      reports: '/api/admin/sales',
      purchases: '/api/staff/purchases'
    };

    if (tab === 'couriers') {
      fetch('/api/admin/couriers').then(r => r.json()).then(list => {
        setCouriers(list);
        // Check account status for each courier
        list.forEach(c => {
          fetch(`/api/admin/couriers/${c.id}/account_status`).then(r => r.json()).then(d => {
            setCourierAccounts(prev => ({ ...prev, [c.id]: d }));
          });
        });
        setLoading(false);
      });
    } else if (tab === 'categories') {
      Promise.all([
        fetch('/api/categories').then(r => r.json()),
        fetch('/api/subcategories').then(r => r.json())
      ]).then(([cats, subs]) => {
        setCategories(cats);
        setSubcategories(subs);
        setLoading(false);
      });
    } else if (tab === 'delivery') {
      Promise.all([
        fetch('/api/admin/orders').then(r => r.json()),
        fetch('/api/admin/couriers').then(r => r.json())
      ]).then(([ord, cou]) => {
        setOrders(ord);
        setCouriers(cou);
        setLoading(false);
      });
    } else if (tab === 'purchases') {
      Promise.all([
        fetch('/api/staff/purchases').then(r => r.json()),
        fetch('/api/admin/vendors').then(r => r.json()),
        fetch('/api/products').then(r => r.json())
      ]).then(([pur, ven, pro]) => {
        setPurchases(pur);
        setVendors(ven);
        setProducts(pro);
        setLoading(false);
      });
    } else {
      let url = endpoints[tab] || endpoints.orders;
      if (tab === 'reports' && period) {
        url = `/api/admin/sales?period=${period}`;
      }
      fetch(url)
        .then(r => r.json())
        .then(data => {
          if (tab === 'orders') setOrders(data);
          else if (tab === 'products') setProducts(data);
          else if (tab === 'inquiries') setInquiries(data);
          else if (tab === 'customers') setCustomers(data);
          else if (tab === 'couriers') setCouriers(data);
          else if (tab === 'reports') {
            console.log("Reports data received:", data);
            setReportData(data);
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  };

  // --- ACTIONS ---

  const handleStatusUpdate = (id, type, newStatus) => {
    let url = type === 'order' ? `/api/admin/order/${id}/status` : `/api/admin/inquiries/${id}/status`;
    fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    }).then(r => r.json()).then(res => {
      if (res.success) {
        showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} status updated!`);
        loadTabData(activeTab);
        fetchStats();
      }
    });
  };

  const handleDelete = (type, id) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) return;
    let url = '';
    if (type === 'product') url = `/api/products/${id}`;
    else if (type === 'category') url = `/api/categories/${id}`;
    else if (type === 'subcategory') url = `/api/subcategories/${id}`;
    else if (type === 'inquiry') url = `/api/admin/inquiries/${id}`;
    else if (type === 'courier_partner') url = `/api/admin/couriers/${id}`;

    fetch(url, { method: 'DELETE' }).then(r => r.json()).then(res => {
      if (res.success) {
        showToast(`${type} deleted successfully`);
        loadTabData(activeTab);
      } else {
        showToast(res.message || 'Error deleting item', 'error');
      }
    });
  };

  const toggleCourierStatus = (id) => {
    fetch(`/api/admin/couriers/${id}/toggle_status`, { method: 'PUT', credentials: 'include' })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          showToast(`Courier partner is now ${res.new_status}`);
          setCouriers(prev => prev.map(c => c.id === id ? { ...c, status: res.new_status } : c));
        } else {
          showToast(res.message || 'Error toggling status', 'error');
        }
      });
  };

  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) {
      showToast('No data available for export', 'error');
      return;
    }
    const headers = Object.keys(data[0]).join(',') + '\n';
    const rows = data.map(row => {
      return Object.values(row).map(val => {
        let str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      }).join(',');
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();

    // â”€â”€ Validation per modal type â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let errs = {};
    if (modalType === 'product') {
      errs = validate([
        { field: 'name', value: formData.name, checks: [{ test: RULES.required, msg: 'Product name is required' }, { test: RULES.minLen(2), msg: 'Name too short' }] },
        { field: 'category_id', value: formData.category_id, checks: [{ test: RULES.required, msg: 'Please select a category' }] },
      ]);
    } else if (modalType === 'category') {
      errs = validate([
        { field: 'name', value: formData.name, checks: [{ test: RULES.required, msg: 'Category name is required' }] },
      ]);
    } else if (modalType === 'subcategory') {
      errs = validate([
        { field: 'name', value: formData.name, checks: [{ test: RULES.required, msg: 'Sub-category name is required' }] },
        { field: 'category_id', value: formData.category_id, checks: [{ test: RULES.required, msg: 'Please select a parent category' }] },
      ]);
    } else if (modalType === 'courier_partner') {
      errs = validate([
        { field: 'name', value: formData.name, checks: [{ test: RULES.required, msg: 'Company name is required' }] },
        { field: 'phone', value: formData.phone, checks: [{ test: RULES.required, msg: 'Phone number is required' }, { test: RULES.phone, msg: 'Enter a valid phone number' }] },
        { field: 'website', value: formData.website, checks: [{ test: (v) => v && RULES.url(v), msg: 'Website must start with http:// or https://' }] },
      ]);
    } else if (modalType === 'courier') {
      errs = validate([
        { field: 'courier_partner_id', value: formData.courier_partner_id, checks: [{ test: RULES.required, msg: 'Please select a courier partner' }] },
      ]);
    } else if (modalType === 'new_purchase') {
      if (!formData.vendor_id) errs.vendor_id = 'Please select a vendor';
      const badItems = (formData.items || []).filter(it => !it.product_id || !it.quantity || parseFloat(it.quantity) <= 0 || !it.unit_price || parseFloat(it.unit_price) <= 0);
      if (badItems.length > 0) errs.items = 'All items must have a product, quantity > 0, and unit price > 0';
      if ((formData.items || []).length === 0) errs.items = 'Add at least one item to the purchase';
    }
    if (Object.keys(errs).length) {
      showToast(Object.values(errs)[0], 'error');
      return;
    }
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    let url = '';
    let method = editingItem ? 'PUT' : 'POST';

    if (modalType === 'product') url = editingItem ? `/api/products/${editingItem.id}` : '/api/products';
    else if (modalType === 'category') url = editingItem ? `/api/categories/${editingItem.id}` : '/api/categories';
    else if (modalType === 'subcategory') url = editingItem ? `/api/subcategories/${editingItem.id}` : '/api/subcategories';
    else if (modalType === 'courier') {
      url = `/api/admin/order/${editingItem.id}/courier`;
      method = 'PUT';
    } else if (modalType === 'courier_partner') {
      url = editingItem ? `/api/admin/couriers/${editingItem.id}` : '/api/admin/couriers';
    } else if (modalType === 'new_purchase') {
      url = '/api/staff/purchases';
      method = 'POST';
      formData.total_amount = formData.items.reduce((acc, curr) => acc + (parseFloat(curr.quantity || 0) * parseFloat(curr.unit_price || 0)), 0);
    }

    const isMultipart = modalType === 'product' && formData.image_file;
    let options = {};

    if (isMultipart) {
      const data = new FormData();
      Object.entries(formData).forEach(([k, v]) => data.append(k, v));
      options = { method, body: data };
    } else {
      options = {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      };
    }

    fetch(url, options).then(r => r.json()).then(res => {
      if (res.success) {
        showToast(`Successfully saved ${modalType}`);

        // Professional Logic: If we just assigned a courier to a confirmed/processing order, mark it as SHIPPED
        if (modalType === 'courier' && (editingItem.status === 'confirmed' || editingItem.status === 'processing')) {
          handleStatusUpdate(editingItem.id, 'order', 'shipped');
        }

        setModalType(null);
        setEditingItem(null);
        setFormData({});
        loadTabData(activeTab);
      } else {
        showToast(res.message || 'Error saving', 'error');
      }
    });
  };

  // --- RENDERING HELPERS ---

  const navItem = (id, icon, label) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        width: '100%', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '14px',
        background: activeTab === id ? 'rgba(255,107,0,0.1)' : 'transparent',
        color: activeTab === id ? 'var(--clr-orange)' : '#cbd5e1',
        border: 'none', borderLeft: `4px solid ${activeTab === id ? 'var(--clr-orange)' : 'transparent'}`,
        cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left', fontSize: '15px', fontWeight: activeTab === id ? 700 : 500
      }}
    >
      <i className={`fas ${icon}`} style={{ width: '20px', fontSize: '18px' }}></i>
      {label}
    </button>
  );

  const StatusPill = ({ status, type }) => {
    const colors = {
      pending: { bg: '#fff7ed', text: '#c2410c' },
      confirmed: { bg: '#ecfdf5', text: '#047857' },
      processing: { bg: '#eff6ff', text: '#1d4ed8' },
      shipped: { bg: '#fdf4ff', text: '#a21caf' },
      delivered: { bg: '#f0fdf4', text: '#15803d' },
      cancelled: { bg: '#fef2f2', text: '#b91c1c' },
      new: { bg: '#fff7ed', text: '#c2410c' },
      replied: { bg: '#f0fdf4', text: '#15803d' },
      in_progress: { bg: '#eff6ff', text: '#1d4ed8' }
    };
    const color = colors[status.toLowerCase()] || { bg: '#f1f5f9', text: '#475569' };
    return (
      <span style={{
        padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
        background: color.bg, color: color.text, textTransform: 'uppercase', letterSpacing: '0.5px'
      }}>
        {status}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f5f9' }}>
      <style>{`
        @media print {
          .no-print, aside, header > div:last-child { display: none !important; }
          main { margin-left: 0 !important; padding: 0 !important; width: 100% !important; }
          .card-glass { border: 1px solid #e2e8f0 !important; box-shadow: none !important; }
          body { background: white !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border-bottom: 1px solid #eee !important; }
          @page { margin: 1.5cm; }
        }
        aside nav::-webkit-scrollbar { width: 5px; }
        aside nav::-webkit-scrollbar-track { background: transparent; }
        aside nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); borderRadius: 10px; }
        aside nav::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        .sidebar-scroll-light::-webkit-scrollbar { width: 5px; }
        .sidebar-scroll-light::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll-light::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); borderRadius: 10px; }
        .sidebar-scroll-light::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.1); }
        .sidebar-scroll-dark::-webkit-scrollbar { width: 5px; }
        .sidebar-scroll-dark::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll-dark::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); borderRadius: 10px; }
        .sidebar-scroll-dark::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.1); }
      `}</style>
      {/* SIDEBAR */}
      <aside style={{
        width: '280px', background: 'linear-gradient(180deg, var(--clr-kadal) 0%, #061e26 100%)', color: '#fff',
        position: 'fixed', left: 0, top: 0, height: '100vh', zIndex: 100,
        boxShadow: '10px 0 30px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ padding: '45px 30px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ fontSize: '26px', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-1px', fontFamily: "'Outfit', sans-serif" }}>
            SARA<span style={{ color: 'var(--clr-orange)' }}>.</span>
          </h2>
          <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '20px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 10px #22c55e' }}></div>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Staff Portal</span>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '20px 15px', overflowY: 'auto' }}>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', padding: '0 15px 15px 15px' }}>Core Management</div>
          {navItem('orders', 'fa-shopping-cart', 'Orders')}
          {navItem('delivery', 'fa-truck-fast', 'Logistics')}
          {navItem('purchases', 'fa-file-invoice-dollar', 'Stock Intake')}
          {navItem('couriers', 'fa-shipping-fast', 'Courier Partners')}

          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', padding: '25px 15px 15px 15px' }}>Catalog & Clients</div>
          {navItem('products', 'fa-box-open', 'Products')}
          {navItem('categories', 'fa-layer-group', 'Categories')}
          {navItem('inquiries', 'fa-headset', 'Inquiries')}
          {navItem('customers', 'fa-users', 'Customers')}

          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', padding: '25px 15px 15px 15px' }}>Analytics & Reports</div>
          {navItem('reports', 'fa-chart-pie', 'Business Reports')}

          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', padding: '25px 15px 15px 15px' }}>Configuration</div>
          {navItem('profile', 'fa-user-shield', 'My Account Profile')}
        </nav>

        <div style={{ padding: '30px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
            <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--clr-orange), var(--clr-orange-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 15px rgba(249, 115, 22, 0.3)' }}>
              <i className="fas fa-user-shield" style={{ fontSize: '20px', color: '#fff' }}></i>
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>{user.name}</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Administrator</div>
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px', background: 'rgba(239,68,68,0.08)',
              color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', fontWeight: 700, cursor: 'pointer', transition: '0.3s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
            }}
          >
            <i className="fas fa-power-off"></i> Secure Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main style={{ marginLeft: '280px', flex: 1, padding: '40px' }}>
        {/* TOP BAR */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '50px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 900, color: 'var(--clr-kadal)', margin: 0, fontFamily: "'Outfit', sans-serif" }}>
              {activeTab === 'orders' ? 'Order Management' :
                activeTab === 'delivery' ? 'Logistics & Courier' :
                  activeTab === 'products' ? 'Product Management' :
                    activeTab === 'categories' ? 'Catalog Settings' :
                      activeTab === 'couriers' ? 'Courier Partners' :
                        activeTab === 'inquiries' ? 'Service Enquiries' :
                          activeTab === 'reports' ? 'Business Intelligence' :
                            activeTab === 'purchases' ? 'Stock Intake Audit' : 'Customer Directory'}
            </h1>
            <p style={{ color: '#64748b', fontSize: '15px', marginTop: '8px', fontWeight: 500 }}>
              <i className="far fa-calendar-alt" style={{ marginRight: '8px', color: 'var(--clr-orange)' }}></i>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div style={{ position: 'relative', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0' }}>
              <i className="fas fa-search" style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}></i>
              <input
                placeholder="Search records..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '16px 20px 16px 50px', borderRadius: '16px', border: 'none',
                  width: '320px', outline: 'none', fontSize: '14px', background: 'transparent'
                }}
              />
            </div>
            {(activeTab === 'products' || activeTab === 'categories' || activeTab === 'couriers') && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setEditingItem(null);
                  setFormData({});
                  setModalType(activeTab === 'products' ? 'product' : activeTab === 'categories' ? 'category' : 'courier_partner');
                }}
                style={{ height: '54px', padding: '0 30px', borderRadius: '16px' }}
              >
                <i className="fas fa-plus"></i> NEW ENTRY
              </button>
            )}

            {/* â”€â”€ Notification Bell â”€â”€ */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNotifPanel(p => !p)}
                style={{
                  position: 'relative', width: '54px', height: '54px', borderRadius: '16px',
                  background: showNotifPanel ? 'var(--clr-kadal)' : '#fff',
                  border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', transition: '0.2s'
                }}
              >
                <i className="fas fa-bell" style={{ fontSize: '18px', color: showNotifPanel ? '#fff' : unreadCount > 0 ? 'var(--clr-kadal)' : '#94a3b8' }}></i>
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: '-6px', right: '-6px',
                    background: '#ef4444', color: '#fff', borderRadius: '50%',
                    width: '20px', height: '20px', fontSize: '11px', fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'pulse 2s infinite', boxShadow: '0 0 0 3px rgba(239,68,68,0.2)'
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown Panel */}
              {showNotifPanel && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setShowNotifPanel(false)}></div>
                  <div style={{
                    position: 'absolute', top: '64px', right: 0, width: '400px',
                    background: '#fff', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
                    border: '1px solid #f1f5f9', zIndex: 999, animation: 'fadeIn 0.2s ease-out',
                    maxHeight: '520px', display: 'flex', flexDirection: 'column'
                  }}>
                    {/* Panel Header */}
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--clr-kadal)' }}>Notifications</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{unreadCount} active alert{unreadCount !== 1 ? 's' : ''}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button onClick={fetchNotifications} style={{ background: '#f8fafc', border: 'none', width: '30px', height: '30px', borderRadius: '8px', cursor: 'pointer', color: '#64748b' }}>
                          <i className="fas fa-sync-alt" style={{ fontSize: '12px' }}></i>
                        </button>
                        {notifications.length > 0 && (
                          <button onClick={clearAllNotifications} style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: '#64748b', cursor: 'pointer' }}>
                            Clear All
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Notification List */}
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                      {notifications.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
                          <i className="fas fa-check-circle" style={{ fontSize: '2.5rem', color: '#22c55e', marginBottom: '12px', display: 'block' }}></i>
                          <div style={{ fontSize: '15px', fontWeight: 700 }}>All caught up!</div>
                          <div style={{ fontSize: '13px', marginTop: '4px' }}>No new alerts right now.</div>
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div key={n.id} style={{ padding: '16px 20px', borderBottom: '1px solid #f8fafc', display: 'flex', gap: '14px', alignItems: 'flex-start', transition: '0.15s' }}
                            onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseOut={e => e.currentTarget.style.background = '#fff'}>
                            {/* Icon */}
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: n.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <i className={`fas ${n.icon}`} style={{ color: n.color, fontSize: '15px' }}></i>
                            </div>
                            {/* Content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--clr-kadal)', marginBottom: '3px' }}>{n.title}</div>
                              <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>{n.message}</div>
                              {n.time && (
                                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                                  {new Date(n.time).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                              <button
                                onClick={() => { setActiveTab(n.action_tab); setShowNotifPanel(false); dismissNotification(n.id); }}
                                style={{ marginTop: '8px', background: n.bg, color: n.color, border: 'none', padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                              >
                                View â†’ {n.action_tab.charAt(0).toUpperCase() + n.action_tab.slice(1)}
                              </button>
                            </div>
                            {/* Dismiss */}
                            <button onClick={() => dismissNotification(n.id)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '14px', padding: '2px', flexShrink: 0 }}>
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={logout}
              style={{
                background: '#fff', border: '1px solid #fee2e2', color: '#ef4444',
                padding: '0 20px', height: '54px', borderRadius: '16px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700,
                fontSize: '14px', transition: '0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.background = '#fef2f2'}
              onMouseOut={e => e.currentTarget.style.background = '#fff'}
            >
              <i className="fas fa-power-off"></i> Logout
            </button>
          </div>
        </header>

        {/* STATS CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '30px', marginBottom: '50px' }}>
          {[
            { label: 'Total Orders', value: stats.orders, icon: 'fa-shopping-bag', color: '#0ea5e9', gradient: 'linear-gradient(135deg, #0ea5e9, #6366f1)' },
            { label: 'Pending Dispatch', value: stats.pending, icon: 'fa-clock', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #fb923c)' },
            { label: 'New Inquiries', value: stats.inquiries, icon: 'fa-envelope', color: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899, #f43f5e)' },
            { label: 'Total Revenue', value: `₹${stats.revenue.toLocaleString()}`, icon: 'fa-wallet', color: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #059669)' }
          ].map((stat, i) => (
            <div key={i} className="card-glass" style={{
              background: '#fff', padding: '30px', borderRadius: '24px', border: '1px solid #e2e8f0',
              display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 10px 20px rgba(0,0,0,0.02)',
              position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '18px', background: stat.gradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', boxShadow: `0 10px 20px ${stat.color}30` }}>
                <i className={`fas ${stat.icon}`}></i>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '5px' }}>{stat.label}</div>
                <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--clr-kadal)', fontFamily: "'Outfit', sans-serif" }}>{stat.value}</div>
              </div>
              <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', opacity: 0.03, fontSize: '80px', transform: 'rotate(-15deg)' }}>
                <i className={`fas ${stat.icon}`}></i>
              </div>
            </div>
          ))}
        </div>

        {/* TAB CONTENT */}
        <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '30px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          {loading ? (
            <div style={{ padding: '100px', textAlign: 'center' }}>
              <i className="fas fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: 'var(--clr-orange)' }}></i>
              <p style={{ marginTop: '15px', color: '#94a3b8', fontWeight: 500 }}>Loading latest data...</p>
            </div>
          ) : (
            <React.Fragment>
              {activeTab === 'orders' && (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ border: 'none', minWidth: '800px' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Order Reference</th>
                        <th style={{ textAlign: 'left' }}>Customer Information</th>
                        <th style={{ textAlign: 'left' }}>Date</th>
                        <th style={{ textAlign: 'right' }}>Order Value</th>
                        <th style={{ textAlign: 'center' }}>Fulfillment Status</th>
                        <th style={{ textAlign: 'center' }}>Management</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.filter(o => o.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) || o.id.toString().includes(searchTerm)).map(o => (
                        <tr key={o.id} style={{ transition: '0.2s' }}>
                          <td style={{ textAlign: 'left', fontWeight: 'bold' }}>
                            <div style={{ padding: '8px 12px', background: 'rgba(15, 23, 42, 0.04)', borderRadius: '10px', display: 'inline-block', color: 'var(--clr-kadal)', fontSize: '14px' }}>
                              #INV-2026-{1000 + o.id}
                            </div>
                          </td>
                          <td style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: 800, color: 'var(--clr-kadal)', fontSize: '15px' }}>{o.customer_name}</div>
                            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{o.customer_email}</div>
                          </td>
                          <td style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: 600, color: '#64748b', fontSize: '13px' }}>{new Date(o.created_at).toLocaleDateString('en-GB')}</div>
                            <div style={{ fontSize: '11px', color: '#cbd5e1' }}>{new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, color: 'var(--clr-orange)', fontSize: '16px' }}>₹{parseFloat(o.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <StatusPill status={o.status} />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                              <select
                                value={o.status}
                                onChange={(e) => handleStatusUpdate(o.id, 'order', e.target.value)}
                                style={{
                                  padding: '8px 12px', borderRadius: '12px', border: '1.2px solid #e2e8f0', background: '#fff',
                                  fontSize: '12px', fontWeight: 700, color: '#475569', outline: 'none', cursor: 'pointer', transition: '0.2s'
                                }}
                              >
                                <option value="pending">Mark Pending</option>
                                <option value="confirmed">Confirm Order</option>
                                <option value="processing">Start Processing</option>
                                <option value="shipped">Set as Shipped</option>
                                <option value="delivered">Mark Delivered</option>
                                <option value="cancelled">Cancel Order</option>
                              </select>
                              <button style={{ width: '38px', height: '38px', borderRadius: '12px', border: 'none', background: 'rgba(15, 23, 42, 0.05)', color: 'var(--clr-kadal)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                <i className="fas fa-file-invoice"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'delivery' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                  {/* Group 1: Pending Dispatch */}
                  <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
                      <div style={{ padding: '8px 15px', background: '#fff7ed', color: '#ea580c', borderRadius: '12px', fontWeight: 800, fontSize: '12px', textTransform: 'uppercase' }}>Shipment Queue</div>
                      <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--clr-kadal)' }}>Awaiting Dispatch</h3>
                      <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, #e2e8f0, transparent)' }}></div>
                    </div>
                    <div style={{ background: '#fff', borderRadius: '24px', padding: '20px', boxShadow: '0 10px 40px rgba(0,0,0,0.02)', border: '1px solid #f1f5f9' }}>
                      <table className="data-table" style={{ border: 'none' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left' }}>Order</th>
                            <th style={{ textAlign: 'left' }}>Destination</th>
                            <th style={{ textAlign: 'left' }}>Customer</th>
                            <th style={{ textAlign: 'center' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.filter(o => o.status === 'pending' || o.status === 'confirmed' || (o.status === 'processing' && !o.courier_partner_id)).map(o => (
                            <tr key={o.id}>
                              <td style={{ textAlign: 'left', fontWeight: 800, color: 'var(--clr-orange)' }}>#100{o.id}</td>
                              <td style={{ textAlign: 'left', fontSize: '13px', color: '#64748b', maxWidth: '250px' }}>{o.shipping_address}</td>
                              <td style={{ textAlign: 'left' }}>
                                <div style={{ fontWeight: 700, fontSize: '14px' }}>{o.customer_name}</div>
                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{o.customer_phone}</div>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  className="btn btn-primary"
                                  onClick={() => {
                                    setEditingItem(o);
                                    setFormData({ courier_partner_id: '', tracking_id: '', estimated_delivery: '', dispatch_notes: '' });
                                    setModalType('courier');
                                  }}
                                  style={{ padding: '8px 20px', fontSize: '12px', borderRadius: '10px' }}
                                >
                                  Assign Courier
                                </button>
                              </td>
                            </tr>
                          ))}
                          {orders.filter(o => o.status === 'pending' || o.status === 'confirmed' || (o.status === 'processing' && !o.courier_partner_id)).length === 0 && (
                            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontStyle: 'italic' }}>No orders currently awaiting dispatch.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {/* Group 2: In Transit */}
                  <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
                      <div style={{ padding: '8px 15px', background: '#eff6ff', color: '#2563eb', borderRadius: '12px', fontWeight: 800, fontSize: '12px', textTransform: 'uppercase' }}>Active Shipments</div>
                      <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--clr-kadal)' }}>In Transit & Out for Delivery</h3>
                      <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, #e2e8f0, transparent)' }}></div>
                    </div>
                    <div style={{ background: '#fff', borderRadius: '24px', padding: '20px', boxShadow: '0 10px 40px rgba(0,0,0,0.02)', border: '1px solid #f1f5f9' }}>
                      <table className="data-table" style={{ border: 'none' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left' }}>Order</th>
                            <th style={{ textAlign: 'left' }}>Courier Details</th>
                            <th style={{ textAlign: 'left' }}>Tracking</th>
                            <th style={{ textAlign: 'center' }}>Est. Arrival</th>
                            <th style={{ textAlign: 'center' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.filter(o => o.courier_partner_id && o.status !== 'delivered' && o.status !== 'cancelled').map(o => (
                            <tr key={o.id}>
                              <td style={{ textAlign: 'left', fontWeight: 800, color: 'var(--clr-kadal)' }}>#100{o.id}</td>
                              <td style={{ textAlign: 'left' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--clr-kadal)', fontWeight: 700, fontSize: '14px' }}>
                                  <i className="fas fa-truck" style={{ color: 'var(--clr-orange)' }}></i> {o.partner_name}
                                </div>
                                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Mode: Standard Express</div>
                              </td>
                              <td style={{ textAlign: 'left' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <code style={{ background: '#f8fafc', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', color: '#475569', border: '1px solid #e2e8f0', fontWeight: 700 }}>{o.tracking_id}</code>
                                  <button
                                    onClick={() => { navigator.clipboard.writeText(o.tracking_id); showToast('Tracking ID Copied!'); }}
                                    style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', transition: '0.2s' }}
                                    title="Copy Tracking ID"
                                  >
                                    <i className="far fa-copy"></i>
                                  </button>
                                </div>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {o.estimated_delivery ? (
                                  <div style={{ color: 'var(--clr-kadal)', fontWeight: 700, fontSize: '13px' }}>
                                    {new Date(o.estimated_delivery).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                  </div>
                                ) : <span style={{ color: '#cbd5e1' }}>---</span>}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                                  <button
                                    onClick={() => handleStatusUpdate(o.id, 'order', 'delivered')}
                                    style={{ background: '#dcfce7', color: '#16a34a', border: 'none', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer' }}
                                    title="Mark as Delivered"
                                  >
                                    <i className="fas fa-check-circle"></i>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingItem(o);
                                      setFormData({ ...o, estimated_delivery: o.estimated_delivery ? new Date(o.estimated_delivery).toISOString().split('T')[0] : '' });
                                      setModalType('courier');
                                    }}
                                    style={{ background: '#f1f5f9', color: '#64748b', border: 'none', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer' }}
                                  >
                                    <i className="fas fa-edit"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'products' && (
                <table className="data-table" style={{ border: 'none' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Product</th>
                      <th style={{ textAlign: 'left' }}>Category</th>
                      <th style={{ textAlign: 'right' }}>Cost Rate</th>
                      <th style={{ textAlign: 'right' }}>Selling Rate</th>
                      <th style={{ textAlign: 'center' }}>Stock</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                      <tr key={p.id}>
                        <td style={{ textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <img src={p.image_url.startsWith('http') ? p.image_url : `/${p.image_url}`} style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover', background: '#f1f5f9' }} />
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--clr-kadal)' }}>{p.name}</div>
                              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Unit: {p.unit}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'left' }}><span style={{ padding: '4px 10px', background: '#f8fafc', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#64748b' }}>{p.category_name}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#64748b' }}>₹{parseFloat(p.cost_price || 0).toLocaleString()}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--clr-orange)' }}>₹{parseFloat(p.price || 0).toLocaleString()}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.stock_quantity > 10 ? '#22c55e' : '#ef4444' }}></div>
                            <span style={{ fontWeight: 600 }}>{p.stock_quantity}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                            <button
                              onClick={() => {
                                setEditingItem(p);
                                setFormData({ ...p });
                                setModalType('product');
                              }}
                              style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            <button
                              onClick={() => handleDelete('product', p.id)}
                              style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === 'categories' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '30px' }}>
                  {categories.map(cat => (
                    <div key={cat.id} style={{ padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '18px' }}>{cat.name}</h3>
                          <code style={{ fontSize: '11px', color: 'var(--clr-orange)' }}>/{cat.slug}</code>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => {
                              setEditingItem(cat);
                              setFormData({ ...cat });
                              setModalType('category');
                            }}
                            style={{ background: '#fff', border: '1px solid #e2e8f0', width: '32px', height: '32px', borderRadius: '8px', color: '#64748b' }}
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button
                            onClick={() => {
                              setEditingItem(null);
                              setFormData({ category_id: cat.id });
                              setModalType('subcategory');
                            }}
                            style={{ background: 'var(--clr-kadal)', color: '#fff', border: 'none', padding: '0 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}
                          >
                            + Sub
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {subcategories.filter(s => s.category_id === cat.id).map(sub => (
                          <div key={sub.id} style={{
                            padding: '6px 12px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0',
                            fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px'
                          }}>
                            {sub.name}
                            <i
                              className="fas fa-times"
                              style={{ cursor: 'pointer', color: '#94a3b8', fontSize: '10px' }}
                              onClick={() => handleDelete('subcategory', sub.id)}
                            ></i>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'inquiries' && (() => {
                const filteredInquiries = inquiries.filter(i => {
                  const matchSearch = !inqSearch || [i.name,i.email,i.subject,i.message].some(f => f?.toLowerCase().includes(inqSearch.toLowerCase()));
                  const matchStatus = !inqStatusFilter || i.status === inqStatusFilter;
                  return matchSearch && matchStatus;
                });

                const handleReplySubmit = () => {
                  if (!replyText.trim()) { showToast('Please enter a reply message', 'error'); return; }
                  fetch(`/api/admin/inquiries/${replyModal.id}/reply`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ remarks: replyText })
                  }).then(r => r.json()).then(res => {
                    if (res.success) {
                      showToast('Reply recorded. Inquiry marked as Replied.');
                      setReplyModal(null);
                      setReplyText('');
                      loadTabData('inquiries');
                    } else showToast(res.message || 'Error', 'error');
                  });
                };

                const priorityStyle = { high: { bg: '#fef2f2', color: '#991b1b', label: 'High' }, normal: { bg: '#fff7ed', color: '#9a3412', label: 'Normal' }, low: { bg: '#f0fdf4', color: '#166534', label: 'Low' } };
                const statusStyle = { new: { bg: '#fef3c7', color: '#92400e' }, read: { bg: '#dbeafe', color: '#1e40af' }, in_progress: { bg: '#ede9fe', color: '#6d28d9' }, replied: { bg: '#d1fae5', color: '#065f46' }, cancelled: { bg: '#fee2e2', color: '#991b1b' } };

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>

                    {/* Reply Modal */}
                    {replyModal && (
                      <div className="modal-overlay" style={{ zIndex: 3000 }} onClick={() => setReplyModal(null)}>
                        <div style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '560px', boxShadow: '0 25px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                          <div style={{ background: 'linear-gradient(135deg, var(--clr-kadal), #0a4a5c)', padding: '28px 30px', color: '#fff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Reply to Enquiry</h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', opacity: 0.75 }}>From: {replyModal.name} â€” {replyModal.email}</p>
                              </div>
                              <button onClick={() => setReplyModal(null)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px' }}>âœ•</button>
                            </div>
                          </div>
                          <div style={{ padding: '25px 30px' }}>
                            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '15px', marginBottom: '20px' }}>
                              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Original Message</div>
                              <div style={{ fontWeight: 700, color: 'var(--clr-kadal)', marginBottom: '6px' }}>{replyModal.subject}</div>
                              <p style={{ margin: 0, color: '#475569', fontSize: '14px', lineHeight: 1.5 }}>{replyModal.message}</p>
                            </div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>Your Internal Reply / Notes</label>
                            <textarea
                              value={replyText}
                              onChange={e => setReplyText(e.target.value)}
                              placeholder="Record the response given to the customer via phone/email, or add internal notes..."
                              rows={5}
                              style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '14px', lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                            />
                            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                              <button onClick={handleReplySubmit} style={{ flex: 2, padding: '14px', borderRadius: '12px', border: 'none', background: 'var(--clr-kadal)', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <i className="fas fa-check"></i> Mark as Replied
                              </button>
                              <button onClick={() => setReplyModal(null)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'transparent', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Stats Bar */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
                      {[
                        { label: 'Total', val: inquiries.length, icon: 'fa-comments', bg: 'linear-gradient(135deg, var(--clr-kadal), #0a4a5c)', color: '#fff' },
                        { label: 'New / Unread', val: inquiries.filter(i=>i.status==='new').length, icon: 'fa-inbox', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
                        { label: 'In Progress', val: inquiries.filter(i=>i.status==='in_progress').length, icon: 'fa-spinner', bg: '#ede9fe', color: '#6d28d9', border: '#ddd6fe' },
                        { label: 'Replied', val: inquiries.filter(i=>i.status==='replied').length, icon: 'fa-check-double', bg: '#d1fae5', color: '#065f46', border: '#a7f3d0' },
                      ].map((s, idx) => (
                        <div key={idx} style={{ background: s.bg, borderRadius: '18px', padding: '18px 20px', border: s.border ? `1px solid ${s.border}` : 'none', boxShadow: idx === 0 ? '0 8px 20px rgba(8,51,68,0.2)' : 'none' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '11px', fontWeight: 800, color: s.color, textTransform: 'uppercase', opacity: idx===0?0.8:1 }}>{s.label}</div>
                            <i className={`fas ${s.icon}`} style={{ color: s.color, opacity: 0.5 }}></i>
                          </div>
                          <div style={{ fontSize: '28px', fontWeight: 900, color: s.color, marginTop: '8px' }}>{s.val}</div>
                        </div>
                      ))}
                    </div>

                    {/* Filters & Search */}
                    <div style={{ background: '#fff', borderRadius: '20px', padding: '20px 25px', border: '1px solid #f1f5f9', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                        <i className="fas fa-search" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '13px' }}></i>
                        <input value={inqSearch} onChange={e=>setInqSearch(e.target.value)} placeholder="Search by name, email, subject..." style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                      <select value={inqStatusFilter} onChange={e=>setInqStatusFilter(e.target.value)} style={{ padding: '11px 18px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer', outline: 'none', background: '#fff' }}>
                        <option value="">All Status</option>
                        <option value="new">New</option>
                        <option value="read">Read</option>
                        <option value="in_progress">In Progress</option>
                        <option value="replied">Replied</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <button onClick={() => exportToCSV(inquiries, 'Enquiries')} style={{ padding: '11px 18px', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#334155', fontWeight: 700, cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fas fa-download"></i> Export
                      </button>
                      {(inqSearch || inqStatusFilter) && <button onClick={() => { setInqSearch(''); setInqStatusFilter(''); }} style={{ padding: '11px 16px', borderRadius: '12px', border: 'none', background: '#fef2f2', color: '#ef4444', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>Clear</button>}
                    </div>

                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Showing {filteredInquiries.length} of {inquiries.length} enquiries</div>

                    {/* Inquiry Cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {filteredInquiries.map(inq => {
                        const stCfg = statusStyle[inq.status] || { bg: '#f1f5f9', color: '#475569' };
                        const prCfg = priorityStyle[inq.priority] || priorityStyle.normal;
                        return (
                          <div key={inq.id} style={{ background: '#fff', borderRadius: '20px', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.025)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex' }}>
                              <div style={{ flex: 1, padding: '22px 25px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                                  <div style={{ flex: 1, marginRight: '20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px', flexWrap: 'wrap' }}>
                                      <span style={{ padding: '3px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', background: stCfg.bg, color: stCfg.color }}>{inq.status?.replace('_',' ')}</span>
                                    </div>
                                    <h3 style={{ margin: '0 0 5px 0', fontSize: '17px', fontWeight: 800, color: 'var(--clr-kadal)', lineHeight: 1.4 }}>{inq.subject || 'General Enquiry'}</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '18px', fontSize: '13px', color: '#64748b' }}>
                                      <span><i className="fas fa-user" style={{ marginRight: '5px', color: '#94a3b8' }}></i><strong style={{ color: '#334155' }}>{inq.name}</strong></span>
                                      <a href={`mailto:${inq.email}`} style={{ color: 'var(--clr-orange)', textDecoration: 'none', fontWeight: 600 }}>{inq.email}</a>
                                      {inq.phone && <a href={`tel:${inq.phone}`} style={{ color: '#334155', textDecoration: 'none', fontWeight: 600 }}><i className="fas fa-phone-alt" style={{ marginRight: '4px', color: '#94a3b8' }}></i>{inq.phone}</a>}
                                    </div>
                                  </div>
                                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>{new Date(inq.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(inq.created_at).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}</div>
                                  </div>
                                </div>
                                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                                  <p style={{ margin: 0, color: '#475569', fontSize: '14px', lineHeight: 1.6, fontStyle: 'italic' }}>" {inq.message} "</p>
                                </div>
                                {inq.remarks && (
                                  <div style={{ background: 'rgba(8,51,68,0.04)', border: '1px solid rgba(8,51,68,0.08)', borderRadius: '10px', padding: '12px 15px', marginBottom: '14px' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--clr-kadal)', textTransform: 'uppercase', marginBottom: '5px' }}><i className="fas fa-sticky-note" style={{ marginRight: '5px' }}></i>Internal Notes / Reply</div>
                                    <p style={{ margin: 0, color: '#334155', fontSize: '13px', lineHeight: 1.5 }}>{inq.remarks}</p>
                                  </div>
                                )}
                                <div style={{ display: 'flex', gap: '10px', paddingTop: '15px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
                                  <button onClick={() => { setReplyModal(inq); setReplyText(inq.remarks || ''); }} style={{ padding: '9px 18px', borderRadius: '10px', border: 'none', background: 'var(--clr-kadal)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px' }}>
                                    <i className="fas fa-reply"></i> {inq.remarks ? 'Update Reply' : 'Reply & Close'}
                                  </button>
                                  <a href={`mailto:${inq.email}?subject=Re: ${encodeURIComponent(inq.subject || 'Your Enquiry')}`} style={{ padding: '9px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#334155', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px', textDecoration: 'none' }}>
                                    <i className="far fa-envelope"></i> Email Client
                                  </a>
                                  <select value={inq.status} onChange={e => handleStatusUpdate(inq.id, 'inquiry', e.target.value)} style={{ padding: '9px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '12px', fontWeight: 700, color: '#64748b', outline: 'none', cursor: 'pointer' }}>
                                    <option value="new">Set: New</option>
                                    <option value="read">Set: Read</option>
                                    <option value="in_progress">Set: In Progress</option>
                                    <option value="replied">Set: Replied</option>
                                    <option value="cancelled">Set: Cancelled</option>
                                  </select>
                                  <button onClick={() => handleDelete('inquiry', inq.id)} style={{ marginLeft: 'auto', width: '38px', height: '38px', borderRadius: '10px', border: 'none', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: '13px' }}>
                                    <i className="fas fa-trash"></i>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {filteredInquiries.length === 0 && <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', background: '#fff', borderRadius: '20px', border: '1px solid #f1f5f9' }}>No enquiries match the current filters.</div>}
                    </div>
                  </div>
                );
              })()}

              {activeTab === 'customers' && (
                <table className="data-table" style={{ border: 'none' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Customer ID</th>
                      <th style={{ textAlign: 'left' }}>Name</th>
                      <th style={{ textAlign: 'left' }}>Contact Details</th>
                      <th style={{ textAlign: 'left' }}>Location</th>
                      <th style={{ textAlign: 'center' }}>Joined Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.email.toLowerCase().includes(searchTerm.toLowerCase())).map(c => (
                      <tr key={c.id}>
                        <td style={{ textAlign: 'left', fontWeight: 800 }}>#CUS-{100 + c.id}</td>
                        <td style={{ textAlign: 'left', fontWeight: 700, color: 'var(--clr-kadal)' }}>{c.name}</td>
                        <td style={{ textAlign: 'left' }}>
                          <div>{c.email}</div>
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>{c.phone || 'N/A'}</div>
                        </td>
                        <td style={{ textAlign: 'left', fontSize: '13px', maxWidth: '300px' }}>{c.address || 'Not Provided'}</td>
                        <td style={{ textAlign: 'center' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === 'couriers' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '25px' }}>
                  {couriers.map(c => {
                    const activeShipments = orders.filter(o => o.courier_partner_id === c.id && o.status !== 'delivered').length;
                    return (
                      <div key={c.id} style={{ background: '#fff', borderRadius: '20px', padding: '25px', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(249, 115, 22, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className="fas fa-shipping-fast" style={{ color: 'var(--clr-orange)', fontSize: '20px' }}></i>
                          </div>
                          <button 
                            onClick={() => toggleCourierStatus(c.id)}
                            title={`Click to ${c.status === 'active' ? 'Deactivate' : 'Activate'}`}
                            style={{ 
                              padding: '6px 14px', borderRadius: '20px', fontSize: '10px', fontWeight: 800, 
                              textTransform: 'uppercase', cursor: 'pointer', border: 'none', transition: '0.2s',
                              background: c.status === 'active' ? '#dcfce7' : '#fee2e2', 
                              color: c.status === 'active' ? '#166534' : '#991b1b',
                              boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                            }}
                          >
                            <i className={`fas fa-${c.status === 'active' ? 'check-circle' : 'times-circle'}`} style={{ marginRight: '5px' }}></i>
                            {c.status}
                          </button>
                        </div>
                        <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: 800, color: 'var(--clr-kadal)' }}>{c.name}</h3>
                        <a href={c.website} target="_blank" style={{ fontSize: '12px', color: 'var(--clr-orange)', fontWeight: 600, textDecoration: 'none' }}>
                          <i className="fas fa-external-link-alt" style={{ marginRight: '5px' }}></i> Business Website
                        </a>

                        <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '15px', margin: '20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>Active Loads</div>
                            <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--clr-kadal)' }}>{activeShipments}</div>
                          </div>
                          <div style={{ width: '35px', height: '35px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                            <i className="fas fa-box" style={{ fontSize: '14px', color: '#cbd5e1' }}></i>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#64748b' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <i className="fas fa-user-tie" style={{ width: '15px' }}></i> {c.contact_person}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <i className="fas fa-phone-alt" style={{ width: '15px' }}></i> {c.phone}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '25px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
                          <button
                            onClick={() => { setEditingItem(c); setFormData({ ...c }); setModalType('courier_partner'); }}
                            style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: 'var(--clr-kadal)', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
                          >
                            Settings
                          </button>
                          {courierAccounts[c.id]?.has_account ? (
                            <div style={{ flex: 1, padding: '10px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <i className="fas fa-check-circle"></i> Account Active
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setCourierLoginForm({ email: '', password: '', courier_id: c.id, courier_name: c.name });
                                setModalType('courier_login');
                              }}
                              style={{ flex: 1, padding: '10px', borderRadius: '10px', background: 'var(--clr-kadal)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                              <i className="fas fa-user-plus"></i> Create Login
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete('courier_partner', c.id)}
                            style={{ width: '40px', borderRadius: '10px', border: 'none', background: '#fef2f2', color: '#ef4444', cursor: 'pointer' }}
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {couriers.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: '#94a3b8', fontWeight: 600 }}>No courier partners in database.</div>}
                </div>
              )}
              {activeTab === 'purchases' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: 'var(--clr-kadal)' }}>Stock Intake Management</h2>
                      <p style={{ margin: '5px 0 0 0', color: '#64748b', fontWeight: 500 }}>Log purchases from vendors to automatically update warehouse stock</p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingItem(null);
                        setFormData({ vendor_id: '', items: [{ product_id: '', quantity: 1, unit_price: 0, selling_price: 0 }], total_amount: 0 });
                        setModalType('new_purchase');
                      }}
                      className="btn btn-primary"
                      style={{ padding: '12px 25px', borderRadius: '15px' }}
                    >
                      <i className="fas fa-plus-circle"></i> Record New Intake
                    </button>
                  </div>

                  {/* PROFESSIONAL ADDITION: OUT OF STOCK WATCHLIST */}
                  {products.filter(p => (p.stock_quantity || 0) <= 0).length > 0 && (
                    <div style={{ background: '#fff', padding: '25px', borderRadius: '20px', border: '1.5px solid #fee2e2', boxShadow: '0 10px 30px rgba(220, 38, 38, 0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '40px', height: '40px', background: '#dc2626', color: '#fff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                            <i className="fas fa-exclamation-triangle"></i>
                          </div>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#991b1b' }}>Critical Out of Stock</h3>
                            <p style={{ margin: 0, fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>Action required: Replenish these items immediately</p>
                          </div>
                        </div>
                        <div style={{ background: '#fef2f2', color: '#dc2626', padding: '6px 15px', borderRadius: '30px', fontSize: '12px', fontWeight: 800 }}>{products.filter(p => (p.stock_quantity || 0) <= 0).length} ITEMS MISSING</div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                        {products.filter(p => (p.stock_quantity || 0) <= 0).map(p => (
                          <div 
                            key={p.id} 
                            onClick={() => {
                              setEditingItem(null);
                              setFormData({ vendor_id: '', items: [{ product_id: p.id, quantity: 1, unit_price: p.cost_price || p.price || 0, selling_price: p.price || 0 }], total_amount: p.cost_price || p.price });
                              setModalType('new_purchase');
                            }}
                            style={{ cursor: 'pointer', transition: '0.2s', padding: '15px', background: '#fffcfc', borderRadius: '15px', border: '1px solid #fee2e2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            onMouseOver={e => e.currentTarget.style.boxShadow = '0 5px 15px rgba(220, 38, 38, 0.08)'}
                            onMouseOut={e => e.currentTarget.style.boxShadow = 'none'}
                          >
                            <div style={{ fontWeight: 700, color: '#7f1d1d', fontSize: '14px' }}>{p.name}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                              <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>Last Rate</span>
                              <span style={{ fontSize: '13px', fontWeight: 800, color: '#dc2626' }}>₹{parseFloat(p.cost_price || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ background: '#fff', borderRadius: '24px', padding: '10px', boxShadow: '0 10px 40px rgba(0,0,0,0.02)', border: '1px solid #f1f5f9' }}>
                    <table className="data-table" style={{ border: 'none' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Intake ID</th>
                          <th style={{ textAlign: 'left' }}>Vendor</th>
                          <th style={{ textAlign: 'left' }}>Items Replenished</th>
                          <th style={{ textAlign: 'left' }}>Date</th>
                          <th style={{ textAlign: 'right' }}>Total Value</th>
                          <th style={{ textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchases.map(p => (
                          <tr key={p.id}>
                            <td style={{ textAlign: 'left', fontWeight: 800 }}>
                              <div style={{ padding: '8px 12px', background: 'rgba(15, 23, 42, 0.04)', borderRadius: '10px', display: 'inline-block', color: 'var(--clr-kadal)', fontSize: '13px' }}>
                                #PRC-{p.id}
                              </div>
                            </td>
                            <td style={{ textAlign: 'left', fontWeight: 700, color: 'var(--clr-kadal)' }}>{p.vendor_name}</td>
                            <td style={{ textAlign: 'left' }}>
                              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.items_info}>
                                {p.items_info || 'N/A'}
                              </div>
                            </td>
                            <td style={{ textAlign: 'left' }}>
                              <div style={{ fontWeight: 600, color: '#64748b', fontSize: '13px' }}>{new Date(p.created_at).toLocaleDateString('en-GB')}</div>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--clr-orange)', fontSize: '16px' }}>₹{parseFloat(p.total_amount).toLocaleString('en-IN')}</td>
                            <td style={{ textAlign: 'center' }}>
                              <StatusPill status={p.status} />
                            </td>
                          </tr>
                        ))}
                        {purchases.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', fontStyle: 'italic' }}>No stock intake logs found in database.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'reports' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                  {/* Report Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: 'var(--clr-kadal)' }}>Intelligence Overview</h2>
                      <p style={{ margin: '5px 0 0 0', color: '#64748b', fontWeight: 500 }}>Comprehensive sales, inventory, and performance metrics</p>
                    </div>
                    <div className="no-print" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 15px' }}>
                        <i className="fas fa-calendar-alt" style={{ color: '#94a3b8', fontSize: '14px', marginRight: '10px' }}></i>
                        <select
                          value={reportPeriod}
                          onChange={(e) => {
                            setReportPeriod(e.target.value);
                            loadTabData('reports', e.target.value);
                          }}
                          style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', fontWeight: 700, color: 'var(--clr-kadal)', cursor: 'pointer' }}
                        >
                          <option value="all">Full History</option>
                          <option value="today">Today's Performance</option>
                          <option value="month">This Month</option>
                          <option value="year">Current Year</option>
                          <option value="financial_year">Financial Year (Apr-Mar)</option>
                        </select>
                      </div>
                      <button
                        onClick={() => {
                          setFormData({ type: 'overview', period: reportPeriod });
                          setModalType('report_generator');
                        }}
                        style={{ background: 'var(--clr-orange)', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: 700, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s', boxShadow: '0 4px 12px rgba(249, 115, 22, 0.2)' }}
                      >
                        <i className="fas fa-file-pdf"></i> Generate Professional Report
                      </button>
                    </div>
                  </div>

                  {/* KPI Summaries */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '25px' }}>
                    <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', padding: '30px', borderRadius: '24px', color: '#fff' }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, opacity: 0.6, textTransform: 'uppercase', marginBottom: '10px' }}>Monthly Revenue</div>
                      <div style={{ fontSize: '28px', fontWeight: 900 }}>₹{reportData.monthly_sales?.[0]?.revenue?.toLocaleString() || '0'}</div>
                      <div style={{ fontSize: '12px', marginTop: '10px', color: '#10b981', fontWeight: 700 }}>{reportData.monthly_sales?.[0]?.orders || 0} Successful Orders</div>
                    </div>
                    <div style={{ background: '#fff', padding: '30px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px' }}>Avg Order Value</div>
                      <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--clr-kadal)' }}>₹{reportData.daily_sales?.[0]?.avg_order_value?.toFixed(2) || '0'}</div>
                      <div style={{ fontSize: '12px', marginTop: '10px', color: '#10b981', fontWeight: 700 }}>+8.2% Growth</div>
                    </div>
                    <div style={{ background: 'linear-gradient(135deg, #059669, #10b981)', padding: '30px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 20px rgba(16, 185, 129, 0.2)' }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, opacity: 0.8, textTransform: 'uppercase', marginBottom: '10px' }}>Projected Gross Profit</div>
                      <div style={{ fontSize: '28px', fontWeight: 900 }}>₹{reportData.daily_sales?.reduce((acc, curr) => acc + (curr.profit || 0), 0).toLocaleString() || '0'}</div>
                      <div style={{ fontSize: '12px', marginTop: '10px', fontWeight: 700, padding: '4px 8px', background: 'rgba(255,255,255,0.15)', borderRadius: '6px', display: 'inline-block' }}>Real-time Margin Analysis</div>
                    </div>
                  </div>

                  {/* Deep Analytics Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '30px' }}>
                    {/* Top Products */}
                    <div style={{ background: '#fff', padding: '30px', borderRadius: '24px', border: '1px solid #f1f5f9' }}>
                      <h3 style={{ margin: '0 0 25px 0', fontSize: '18px', fontWeight: 800 }}>Top Growth Products</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {reportData.product_performance?.slice(0, 5).map((p, idx) => (
                          <div key={p.id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', fontWeight: 700 }}>
                              <span>{p.name}</span>
                              <span style={{ color: 'var(--clr-orange)' }}>{p.units} Units</span>
                            </div>
                            <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', background: 'var(--clr-kadal)', width: `${(p.units / reportData.product_performance[0].units) * 100}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Low Stock Watchlist */}
                    <div style={{ background: '#fff', padding: '30px', borderRadius: '24px', border: '1px solid #fee2e2' }}>
                      <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 800, color: '#991b1b' }}>Low Stock Watchlist</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {reportData.low_stock?.map(item => (
                          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: '#fffcfc', borderRadius: '15px', border: '1px solid #fee2e2' }}>
                            <span style={{ fontWeight: 700, fontSize: '14px' }}>{item.name}</span>
                            <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 800, background: '#fef2f2', padding: '4px 8px', borderRadius: '8px' }}>{item.stock} left</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Revenue by Category */}
                  <div style={{ background: '#fff', padding: '30px', borderRadius: '24px', border: '1px solid #f1f5f9' }}>
                    <h3 style={{ margin: '0 0 25px 0', fontSize: '18px', fontWeight: 800 }}>Category Revenue Distribution</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                      {reportData.category_sales?.map(cat => (
                        <div key={cat.name} style={{ padding: '20px', background: '#f8fafc', borderRadius: '16px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>{cat.name}</div>
                          <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--clr-kadal)', marginTop: '5px' }}>₹{cat.revenue.toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sales Table */}
                  <div style={{ background: '#fff', padding: '30px', borderRadius: '24px', border: '1px solid #f1f5f9' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 800 }}>Daily Sales Audit Log</h3>
                    <table className="data-table" style={{ border: 'none' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Date</th>
                          <th style={{ textAlign: 'center' }}>Orders</th>
                          <th style={{ textAlign: 'right' }}>Revenue Generated</th>
                          <th style={{ textAlign: 'right' }}>AOV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.daily_sales?.map(d => (
                          <tr key={d.date}>
                            <td style={{ textAlign: 'left', fontWeight: 700 }}>{new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                            <td style={{ textAlign: 'center' }}><span style={{ padding: '4px 12px', background: '#f1f5f9', borderRadius: '20px', fontWeight: 800 }}>{d.orders}</span></td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--clr-kadal)' }}>₹{d.revenue.toLocaleString()}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--clr-orange)' }}>₹{d.avg_order_value.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'profile' && (
                <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '30px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: 'var(--clr-kadal)' }}>Account Intelligence</h2>
                      <p style={{ margin: '5px 0 0 0', color: '#64748b', fontWeight: 500 }}>Management portal for your professional credentials</p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '30px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div style={{ background: '#fff', borderRadius: '24px', padding: '40px', textAlign: 'center', border: '1px solid #f1f5f9', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
                        <div style={{ width: '100px', height: '100px', borderRadius: '30px', background: 'linear-gradient(135deg, var(--clr-orange), #fb923c)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', color: '#fff', boxShadow: '0 15px 30px rgba(249, 115, 22, 0.2)' }}>
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>{user.name}</h3>
                        <p style={{ color: '#94a3b8', fontSize: '14px', margin: '5px 0 20px 0' }}>{user.role} Analyst</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
                          <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px', fontSize: '13px' }}>
                            <span style={{ color: '#94a3b8', display: 'block', textTransform: 'uppercase', fontSize: '10px', fontWeight: 800 }}>Primary Email</span>
                            <span style={{ fontWeight: 700 }}>{user.email}</span>
                          </div>
                          <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px', fontSize: '13px' }}>
                            <span style={{ color: '#94a3b8', display: 'block', textTransform: 'uppercase', fontSize: '10px', fontWeight: 800 }}>System ID</span>
                            <span style={{ fontWeight: 700 }}>#SARA-{user.id}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ background: '#fff', borderRadius: '24px', padding: '40px', border: '1px solid #f1f5f9', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
                      <h3 style={{ margin: '0 0 30px 0', fontSize: '20px', fontWeight: 800 }}>Update Professional Details</h3>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.target);
                        const data = Object.fromEntries(fd);
                        setLoading(true);
                        fetch('/api/user/update-profile', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify(data)
                        }).then(r => r.json()).then(res => {
                          setLoading(false);
                          if (res.success) {
                            showToast(res.message);
                            if (res.user) updateUser(res.user);
                          } else {
                            showToast(res.message, 'error');
                          }
                        });
                      }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div className="form-group">
                          <label>Full Name</label>
                          <input required name="name" defaultValue={user.name} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1.5px solid #e2e8f0' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                          <div className="form-group">
                            <label>Email Address</label>
                            <input required name="email" defaultValue={user.email} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1.5px solid #e2e8f0' }} />
                          </div>
                          <div className="form-group">
                            <label>Phone Number</label>
                            <input name="phone" defaultValue={user.phone} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1.5px solid #e2e8f0' }} />
                          </div>
                        </div>
                        <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9' }} />
                        <div className="form-group">
                          <label>New Secret Password (Leave blank to keep current)</label>
                          <input type="password" name="password" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1.5px solid #e2e8f0' }} />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ padding: '18px', borderRadius: '12px', fontWeight: 800, fontSize: '15px' }}>
                          {loading ? 'Processing...' : 'Apply Secure Updates'}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}

            </React.Fragment>
          )}
        </div>
      </main>

      {/* MODAL SYSTEM */}
      {modalType && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(8,51,68,0.6)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: modalType === 'new_purchase' ? '850px' : '500px', borderRadius: '24px', padding: '40px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--clr-kadal)', margin: 0 }}>
                {editingItem ? 'Edit ' : (modalType === 'new_purchase' ? 'Record ' : 'Create New ')}
                {modalType === 'new_purchase' ? 'Stock Intake' :
                 modalType === 'courier_partner' ? 'Courier Partner' :
                 modalType === 'report_generator' ? 'Report' :
                 modalType.charAt(0).toUpperCase() + modalType.slice(1)}
              </h2>
              <button onClick={() => setModalType(null)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', color: '#64748b' }}>âœ•</button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {modalType === 'product' && (
                <React.Fragment>
                  <div className="form-group">
                    <label>Product Name (Title)</label>
                    <input required name="name" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Premium Vitrified Tiles" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="form-group">
                      <label>Category</label>
                      <select required value={formData.category_id || ''} onChange={e => setFormData({ ...formData, category_id: e.target.value, subcategory_id: '' })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid #e2e8f0' }}>
                        <option value="">Select Category...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Subcategory (Optional)</label>
                      <select value={formData.subcategory_id || ''} onChange={e => setFormData({ ...formData, subcategory_id: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid #e2e8f0' }}>
                        <option value="">None</option>
                        {subcategories.filter(s => String(s.category_id) === String(formData.category_id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Measurement Unit</label>
                    <select required value={formData.unit || 'sqft'} onChange={e => setFormData({ ...formData, unit: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid #e2e8f0' }}>
                      <option value="sqft">SqFt (Square Feet)</option>
                      <option value="piece">Piece (Each)</option>
                      <option value="bag">Bag</option>
                      <option value="kg">Kg</option>
                      <option value="bundle">Bundle</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Product Description</label>
                    <textarea value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Enter detailed product description..." rows="4" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }}></textarea>
                  </div>
                  <div className="form-group">
                    <label>Product Image</label>
                    <input type="file" accept="image/*" onChange={e => setFormData({ ...formData, image_file: e.target.files[0] })} style={{ border: 'none', padding: 0 }} />
                    <small style={{ color: '#94a3b8' }}>Leave empty to use default image</small>
                  </div>
                </React.Fragment>
              )}

               {modalType === 'category' && (
                <React.Fragment>
                  <div className="form-group">
                    <label>Category Name</label>
                    <input required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Wall Tiles" />
                  </div>
                  <div className="form-group">
                    <label>URL Slug</label>
                    <input required value={formData.slug || ''} onChange={e => setFormData({ ...formData, slug: e.target.value })} placeholder="e.g. wall-tiles" />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} rows="3" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }}></textarea>
                  </div>
                </React.Fragment>
              )}

              {modalType === 'subcategory' && (
                <React.Fragment>
                  <div className="form-group">
                    <label>Parent Category ID</label>
                    <input disabled value={formData.category_id || ''} />
                  </div>
                  <div className="form-group">
                    <label>Subcategory Name</label>
                    <input required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Ceramic Wall Tiles" />
                  </div>
                  <div className="form-group">
                    <label>URL Slug</label>
                    <input required value={formData.slug || ''} onChange={e => setFormData({ ...formData, slug: e.target.value })} placeholder="e.g. ceramic-wall" />
                  </div>
                </React.Fragment>
              )}

              {modalType === 'courier' && (
                <React.Fragment>
                  <h4 style={{ margin: '0 0 15px 0' }}>Assign Logistics for Order #100{editingItem.id}</h4>
                  <div className="form-group">
                    <label>Select Courier Partner</label>
                    <select required value={formData.courier_partner_id || ''} onChange={e => setFormData({ ...formData, courier_partner_id: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid #e2e8f0' }}>
                      <option value="">Choose partner...</option>
                      {couriers.filter(c => c.status === 'active').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Tracking Number</label>
                    <input value={formData.tracking_id || ''} onChange={e => setFormData({ ...formData, tracking_id: e.target.value })} placeholder="Leave blank to auto-generate (SARA-YYMM-00XX)" />
                    <small style={{ color: '#94a3b8', fontSize: '11px' }}><i className="fas fa-magic"></i> If left blank, a unique SARA reference will be assigned.</small>
                  </div>
                  <div className="form-group">
                    <label>Estimated Delivery Date</label>
                    <input required type="date" min="2026-03-26" max="2026-04-16" value={formData.estimated_delivery || ''} onChange={e => setFormData({ ...formData, estimated_delivery: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Dispatch Notes (Internal)</label>
                    <textarea value={formData.dispatch_notes || ''} onChange={e => setFormData({ ...formData, dispatch_notes: e.target.value })} placeholder="e.g. Fragile items, leave at gate..." style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', minHeight: '80px' }}></textarea>
                  </div>
                </React.Fragment>
              )}

              {modalType === 'new_purchase' && (
                <React.Fragment>
                  <div className="form-group">
                    <label>Select Vendor</label>
                    <select required value={formData.vendor_id || ''} onChange={e => setFormData({ ...formData, vendor_id: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid #e2e8f0' }}>
                      <option value="">Choose a Vendor...</option>
                      {vendors.map(v => <option key={v.id} value={v.id}>{v.name} - {v.city}</option>)}
                    </select>
                  </div>

                  <div style={{ margin: '20px 0', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <label style={{ fontWeight: 800 }}>Items Purchased</label>
                      <button type="button" onClick={() => {
                        const newItems = [...(formData.items || [])];
                        newItems.push({ product_id: '', quantity: 1, unit_price: 0, selling_price: 0 });
                        setFormData({ ...formData, items: newItems });
                      }} style={{ background: 'none', border: 'none', color: 'var(--clr-orange)', fontWeight: 700, cursor: 'pointer' }}>+ Add Item</button>
                    </div>

                    {(formData.items || []).map((item, index) => {
                      const selectedProd = products.find(p => p.id == item.product_id);
                      return (
                        <div key={index} style={{ background: '#f8fafc', padding: '20px', borderRadius: '18px', marginBottom: '15px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: '15px', alignItems: 'flex-end' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8' }}>Product</label>
                              <select required value={item.product_id} onChange={e => {
                                const newItems = [...formData.items];
                                newItems[index].product_id = e.target.value;
                                const prod = products.find(p => p.id == e.target.value);
                                if (prod) {
                                  newItems[index].unit_price = prod.cost_price || prod.price || 0;
                                  newItems[index].selling_price = prod.price || 0;
                                }
                                setFormData({ ...formData, items: newItems });
                              }} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontWeight: 700 }}>
                                <option value="">Select Target Product...</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.stock_quantity <= 0 ? 'OUT OF STOCK' : p.stock_quantity})</option>)}
                              </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8' }}>Unit</label>
                              <div style={{ padding: '12px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', fontWeight: 700, color: '#64748b', textAlign: 'center' }}>
                                {selectedProd?.unit || '-'}
                              </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8' }}>Qty ({selectedProd?.unit || 'Units'})</label>
                              <input required type="number" value={item.quantity} onChange={e => {
                                const newItems = [...formData.items];
                                newItems[index].quantity = e.target.value;
                                setFormData({ ...formData, items: newItems });
                              }} style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px' }} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8' }}>Purch. Rate</label>
                              <input required type="number" step="0.01" value={item.unit_price} onChange={e => {
                                const newItems = [...formData.items];
                                newItems[index].unit_price = e.target.value;
                                setFormData({ ...formData, items: newItems });
                              }} style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px' }} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8' }}>Selling Rate</label>
                              <input required type="number" step="0.01" value={item.selling_price} onChange={e => {
                                const newItems = [...formData.items];
                                newItems[index].selling_price = e.target.value;
                                setFormData({ ...formData, items: newItems });
                              }} style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px' }} />
                            </div>
                            <button type="button" onClick={() => {
                              const newItems = formData.items.filter((_, i) => i !== index);
                              setFormData({ ...formData, items: newItems });
                            }} style={{ width: '40px', height: '40px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '10px', cursor: 'pointer' }}><i className="fas fa-trash-alt"></i></button>
                          </div>
                          
                          {selectedProd && (
                            <div style={{ marginTop: '12px', display: 'flex', gap: '20px', padding: '10px 15px', background: 'rgba(255,255,255,0.5)', borderRadius: '10px', fontSize: '12px' }}>
                              <div style={{ color: '#64748b' }}>
                                <i className="fas fa-warehouse" style={{ marginRight: '6px' }}></i>
                                Current Stock: <span style={{ fontWeight: 800, color: selectedProd.stock_quantity <= 0 ? '#dc2626' : 'var(--clr-kadal)' }}>{selectedProd.stock_quantity} {selectedProd.unit}</span>
                              </div>
                              <div style={{ color: '#64748b' }}>
                                <i className="fas fa-tag" style={{ marginRight: '6px' }}></i>
                                Last Purch. Rate: <span style={{ fontWeight: 800, color: 'var(--clr-kadal)' }}>₹{parseFloat(selectedProd.cost_price || 0).toLocaleString()}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ background: 'var(--clr-kadal)', padding: '20px', borderRadius: '15px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, opacity: 0.8 }}>TOTAL ESTIMATED VALUE</div>
                    <div style={{ fontSize: '24px', fontWeight: 900 }}>₹{
                      (formData.items || []).reduce((acc, curr) => acc + (parseFloat(curr.quantity || 0) * parseFloat(curr.unit_price || 0)), 0).toLocaleString()
                    }</div>
                  </div>
                </React.Fragment>
              )}

              {modalType === 'report_generator' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                  <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                    <div style={{ width: '60px', height: '60px', background: 'rgba(249, 115, 22, 0.1)', color: 'var(--clr-orange)', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px', fontSize: '24px' }}>
                      <i className="fas fa-file-invoice"></i>
                    </div>
                    <h3 style={{ margin: 0, color: 'var(--clr-kadal)', fontWeight: 800 }}>Intelligence Engine</h3>
                    <p style={{ margin: '5px 0 0 0', color: '#94a3b8', fontSize: '13px' }}>Configure your professional document parameters</p>
                  </div>

                  <div className="form-group">
                    <label style={{ color: 'var(--clr-kadal)', fontWeight: 700 }}>Choose Report Module</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                      {[
                        { id: 'overview', label: 'Executive Overview', icon: 'fa-globe-americas' },
                        { id: 'sales', label: 'Financial / Sales', icon: 'fa-file-invoice-dollar' },
                        { id: 'inventory', label: 'Stock & Inventory', icon: 'fa-boxes-stacked' },
                        { id: 'customers', label: 'Client Insights', icon: 'fa-user-tie' }
                      ].map(type => (
                        <div
                          key={type.id}
                          onClick={() => setFormData({ ...formData, type: type.id })}
                          style={{
                            padding: '15px', borderRadius: '15px', border: `2px solid ${formData.type === type.id ? 'var(--clr-orange)' : '#f1f5f9'}`,
                            background: formData.type === type.id ? 'rgba(249, 115, 22, 0.05)' : '#fff', cursor: 'pointer', transition: '0.2s',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textAlign: 'center'
                          }}
                        >
                          <i className={`fas ${type.icon}`} style={{ color: formData.type === type.id ? 'var(--clr-orange)' : '#94a3b8' }}></i>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: formData.type === type.id ? 'var(--clr-orange)' : '#64748b', textTransform: 'uppercase' }}>{type.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label style={{ color: 'var(--clr-kadal)', fontWeight: 700 }}>Analysis Period</label>
                    <select
                      value={formData.period || 'all'}
                      onChange={e => setFormData({ ...formData, period: e.target.value })}
                      style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: '#f8fafc', fontWeight: 700, color: 'var(--clr-kadal)' }}
                    >
                      <option value="all">Full Historical Data</option>
                      <option value="today">Today's Real-time Activity</option>
                      <option value="month">Last 30 Days (MTD)</option>
                      <option value="year">Annual Summary</option>
                      <option value="financial_year">Financial Year (FY)</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const url = `/api/admin/reports/download?type=${formData.type || 'overview'}&period=${formData.period || 'all'}`;
                      window.open(url, '_blank');
                      showToast("Document compilation successful!");
                      setModalType(null);
                    }}
                    style={{ background: 'var(--clr-kadal)', color: '#fff', border: 'none', padding: '18px', borderRadius: '15px', fontWeight: 800, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 10px 20px rgba(8,51,68,0.2)' }}
                  >
                    <i className="fas fa-cloud-download-alt"></i> Compile & Download PDF
                  </button>
                </div>
              )}

              {modalType === 'courier_partner' && (
                <React.Fragment>
                  <div className="form-group">
                    <label>Courier Company Name</label>
                    <input required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. FedEx, BlueDart" />
                  </div>
                  <div className="form-group">
                    <label>Contact Person</label>
                    <input value={formData.contact_person || ''} onChange={e => setFormData({ ...formData, contact_person: e.target.value })} placeholder="Manager Name" />
                  </div>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+91 ..." />
                  </div>
                  <div className="form-group">
                    <label>Website URL</label>
                    <input value={formData.website || ''} onChange={e => setFormData({ ...formData, website: e.target.value })} placeholder="https://..." />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select value={formData.status || 'active'} onChange={e => setFormData({ ...formData, status: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid #e2e8f0' }}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </React.Fragment>
              )}

              {modalType !== 'report_generator' && (
                <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Save Changes</button>
                  <button type="button" className="btn btn-outline" onClick={() => setModalType(null)} style={{ flex: 1, justifyContent: 'center', borderColor: '#e2e8f0', color: '#64748b' }}>Cancel</button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* â”€â”€ Create Courier Login Modal â”€â”€ */}
      {modalType === 'courier_login' && (
        <div className="modal-overlay" style={{ zIndex: 2000 }} onClick={() => setModalType(null)}>
          <div style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '460px', boxShadow: '0 25px 60px rgba(0,0,0,0.15)', animation: 'fadeIn 0.3s ease-out' }} onClick={e => e.stopPropagation()}>
            <div style={{ background: 'linear-gradient(135deg, var(--clr-kadal), #0a4a5c)', padding: '30px', borderRadius: '24px 24px 0 0', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '46px', height: '46px', background: 'var(--clr-orange)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                  <i className="fas fa-user-lock"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Create Courier Login</h3>
                  <p style={{ margin: 0, fontSize: '13px', opacity: 0.7, marginTop: '3px' }}>{courierLoginForm.courier_name}</p>
                </div>
              </div>
            </div>
            <div style={{ padding: '30px' }}>
              <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6, marginBottom: '25px', background: '#f8fafc', padding: '14px', borderRadius: '10px', borderLeft: '3px solid var(--clr-orange)' }}>
                <i className="fas fa-info-circle" style={{ marginRight: '8px', color: 'var(--clr-orange)' }}></i>
                Creates a <strong>Courier Partner account</strong>. The courier uses these credentials to log in to their dedicated shipment dashboard.
              </p>
              <div className="form-group">
                <label>Login Email</label>
                <input type="email" required placeholder="courier@company.com" value={courierLoginForm.email} onChange={e => setCourierLoginForm({ ...courierLoginForm, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="text" required placeholder="Set a secure password" value={courierLoginForm.password} onChange={e => setCourierLoginForm({ ...courierLoginForm, password: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button
                  onClick={() => {
                    if (!courierLoginForm.email || !courierLoginForm.password) { showToast('Please fill in both email and password', 'error'); return; }
                    fetch(`/api/admin/couriers/${courierLoginForm.courier_id}/create_account`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                      body: JSON.stringify({ email: courierLoginForm.email, password: courierLoginForm.password })
                    }).then(r => r.json()).then(d => {
                      if (d.success) {
                        showToast(`âœ… Login created for ${courierLoginForm.courier_name}!`);
                        setCourierAccounts(prev => ({ ...prev, [courierLoginForm.courier_id]: { has_account: true } }));
                        setModalType(null);
                      } else { showToast(d.message || 'Failed to create account', 'error'); }
                    });
                  }}
                  style={{ flex: 1, background: 'var(--clr-kadal)', color: '#fff', border: 'none', padding: '13px', borderRadius: '12px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <i className="fas fa-user-plus"></i> Create Account
                </button>
                <button onClick={() => setModalType(null)} style={{ padding: '13px 20px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



function AdminDashboard() {
  const { user, logout, showToast, updateUser } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({ users: 0, orders: 0, revenue: 0, products: 0, total_orders: 0, order_growth: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [staff, setStaff] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [reportPeriod, setReportPeriod] = useState('all'); // all, today, month, year, financial_year
  const [reportData, setReportData] = useState({ daily_sales: [], top_customers: [], product_performance: [], category_sales: [], low_stock: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [formData, setFormData] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [courierAccounts, setCourierAccounts] = useState({});
  const [courierLoginForm, setCourierLoginForm] = useState({ email: '', password: '', courier_id: null, courier_name: '' });

  const handleFormChange = (e) => {
    if (e.target.type === 'file') {
      setFormData({ ...formData, [e.target.name]: e.target.files[0] });
    } else {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    }
  };

  const handleModalSubmit = (e) => {
    if (e) e.preventDefault();
    
    // Client-side Validation logic
    // Strict Validations
    const email = formData.staff_email || formData.email || formData.email_id;
    if (email && RULES.email(email)) { showToast('Please enter a valid email address (no special symbols except @ and .)', 'error'); return; }
    
    const phone = formData.staff_ph || formData.phone || formData.phone_number;
    if (phone && RULES.phone(phone)) { showToast('Phone number must be exactly 10 digits', 'error'); return; }

    if (modalType === 'staff') {
      if (!email) { showToast('Email is required', 'error'); return; }
      if (!editingId && (!formData.password || formData.password.length < 6)) { 
        showToast('Password must be at least 6 characters', 'error'); return; 
      }
    }

    if (modalType === 'product') {
      if (!formData.name) { showToast('Product name is required', 'error'); return; }
    }

    if (modalType === 'vendor') {
      if (!formData.name || !email) { showToast('Company name and email are required', 'error'); return; }
    }

    let url = '';
    let method = editingId ? 'PUT' : 'POST';

    if (modalType === 'staff') url = editingId ? `/api/admin/staff/${editingId}` : '/api/admin/staff';
    else if (modalType === 'product') url = editingId ? `/api/products/${editingId}` : '/api/products';
    else if (modalType === 'category') url = editingId ? `/api/categories/${editingId}` : '/api/categories';
    else if (modalType === 'subcategory') url = editingId ? `/api/subcategories/${editingId}` : '/api/subcategories';
    else if (modalType === 'vendor') url = editingId ? `/api/admin/vendors/${editingId}` : '/api/admin/vendors';
    else if (modalType === 'courier_partner') url = editingId ? `/api/admin/couriers/${editingId}` : '/api/admin/couriers';


    let options = {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    };

    if (formData.image_file) {
      const form = new FormData();
      for (const [key, value] of Object.entries(formData)) {
        if (value !== null && value !== undefined) {
          form.append(key, value);
        }
      }
      options = { method: method, body: form };
    }

    fetch(url, {
      ...options,
      credentials: 'include'
    }).then(r => r.json()).then(res => {
      if (!res.success) {
        showToast(res.message || "Error saving record", 'error');
      } else {
        setShowModal(false);
        setFormData({});
        setEditingId(null);
        showToast(editingId ? "Update successful!" : "Created successfully!");
        loadTab(activeTab);
      }
    }).catch(err => {
      showToast("System encountered an error. Please try again.", 'error');
      console.error(err);
    });
  };

  const openEditModal = (type, item) => {
    setModalType(type);
    setFormData(item);
    setEditingId(item.id);
    setShowModal(true);
  };

  const openAddModal = (type) => {
    setModalType(type);
    setFormData({});
    setEditingId(null);
    setShowModal(true);
  };

  const handleDelete = (type, id) => {
    if (!window.confirm(`Are you sure you want to completely delete this ${type}?`)) return;
    let url = '';
    if (type === 'product') url = `/api/products/${id}`;
    if (type === 'category') url = `/api/categories/${id}`;
    if (type === 'subcategory') url = `/api/subcategories/${id}`;
    if (type === 'staff') url = `/api/admin/staff/${id}`;
    if (type === 'vendor') url = `/api/admin/vendors/${id}`;
    if (type === 'inquiry') url = `/api/admin/inquiries/${id}`;
    if (type === 'courier_partner') url = `/api/admin/couriers/${id}`;

    fetch(url, { method: 'DELETE', credentials: 'include' }).then(r => r.json()).then(res => {
      if (res.success) {
        showToast(`${type} removed successfully`);
        loadTab(activeTab);
      } else {
        showToast("Delete failed: " + (res.message || "Unknown error"), 'error');
      }
    }).catch(err => {
      showToast("Network Error: " + err, 'error');
    });
  };

  const toggleCourierStatus = (id) => {
    fetch(`/api/admin/couriers/${id}/toggle_status`, { method: 'PUT', credentials: 'include' })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          showToast(`Courier partner is now ${res.new_status}`);
          setCouriers(prev => prev.map(c => c.id === id ? { ...c, status: res.new_status } : c));
        } else {
          showToast(res.message || 'Error toggling status', 'error');
        }
      });
  };

  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]).join(',') + '\n';
    const rows = data.map(row => {
      return Object.values(row).map(val => {
        let str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      }).join(',');
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  useEffect(() => {
    fetch('/api/admin/stats', { credentials: 'include' }).then(r => r.json()).then(setStats);
    fetch('/api/admin/orders', { credentials: 'include' }).then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        setAllOrders(data);
        setRecentOrders(data.slice(0, 5));
      }
    });
  }, []);

  const loadTab = (tab, period = 'all') => {
    setActiveTab(tab);
    const opts = { credentials: 'include' };
    if (tab === 'dashboard') {
      fetch('/api/admin/stats', opts).then(r => r.json()).then(setStats);
      fetch('/api/admin/orders', opts).then(r => r.json()).then(setRecentOrders);
    } else if (tab === 'reports') {
      fetch(`/api/admin/sales?period=${period}`, opts).then(r => r.json()).then(setReportData);
    } else if (tab === 'orders') {
      fetch('/api/admin/orders', opts).then(r => r.json()).then(setAllOrders);
    } else if (tab === 'products') {
      fetch('/api/products', opts).then(r => r.json()).then(setProducts);
    } else if (tab === 'customers') {
      fetch('/api/admin/users', opts).then(r => r.json()).then(setCustomers);
    } else if (tab === 'vendors') {
      fetch('/api/admin/vendors', opts).then(r => r.json()).then(setVendors);
    } else if (tab === 'staff') {
      fetch('/api/admin/staff', opts).then(r => r.json()).then(setStaff);
    } else if (tab === 'categories') {
      fetch('/api/categories', opts).then(r => r.json()).then(setCategories);
      fetch('/api/subcategories', opts).then(r => r.json()).then(setSubcategories);
    } else if (tab === 'inquiries') {
      fetch('/api/staff/inquiries', opts).then(r => r.json()).then(setInquiries);
    } else if (tab === 'couriers') {
      fetch('/api/admin/couriers', opts).then(r => r.json()).then(list => {
        setCouriers(list);
        if (Array.isArray(list)) {
          list.forEach(c => {
            fetch(`/api/admin/couriers/${c.id}/account_status`, opts).then(r => r.json()).then(d => {
              setCourierAccounts(prev => ({ ...prev, [c.id]: d }));
            });
          });
        }
      });
    }
  };

  const toggleCustomerActive = (customerId, active) => {
    fetch(`/api/admin/user/${customerId}/activate`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ active })
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(res => {
        if (res.success) {
          setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, is_active: res.is_active } : c));
          setSelectedCustomer(prev => prev && prev.id === customerId ? { ...prev, is_active: res.is_active } : prev);
          showToast(`Customer ${res.is_active ? 'activated' : 'deactivated'}`);
        } else {
          showToast(res.message || 'Failed to update customer status', 'error');
        }
      })
      .catch((err) => {
        console.error('Error updating customer:', err);
        showToast('Unable to update customer status. Please try again.', 'error');
      });
  };

  const toggleStaffActive = (staffId, active) => {
    fetch(`/api/admin/user/${staffId}/activate`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ active })
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(res => {
        if (res.success) {
          setStaff(prev => prev.map(s => s.id === staffId ? { ...s, is_active: res.is_active } : s));
          showToast(`Staff member ${res.is_active ? 'activated' : 'deactivated'}`);
        } else {
          showToast(res.message || 'Failed to update staff status', 'error');
        }
      })
      .catch((err) => {
        console.error('Error updating staff:', err);
        showToast('Unable to update staff status. Please try again.', 'error');
      });
  };

  const handleSearch = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.length > 1) {
      fetch(`/api/admin/search?query=${encodeURIComponent(q)}`)
        .then(r => r.json())
        .then(setSearchResults);
    } else {
      setSearchResults(null);
    }
  };

  const updateOrderStatus = (id, newStatus) => {
    fetch(`/api/admin/order/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: newStatus })
    }).then(r => r.json()).then(res => {
      if (res.success) { showToast("Order status updated"); loadTab(activeTab); }
      else showToast(res.message, 'error');
    });
  };

  const updateInquiry = (id, updates) => {
    fetch(`/api/admin/inquiries/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates)
    }).then(() => { showToast("Inquiry updated"); loadTab(activeTab); });
  };

  const StatusPill = ({ status }) => {
    const colors = {
      pending: { bg: '#fff7ed', text: '#c2410c' },
      confirmed: { bg: '#ecfdf5', text: '#047857' },
      processing: { bg: '#eff6ff', text: '#1d4ed8' },
      shipped: { bg: '#fdf4ff', text: '#a21caf' },
      delivered: { bg: '#f0fdf4', text: '#15803d' },
      cancelled: { bg: '#fef2f2', text: '#b91c1c' },
      new: { bg: '#fff7ed', text: '#c2410c' },
      replied: { bg: '#f0fdf4', text: '#15803d' },
      in_progress: { bg: '#eff6ff', text: '#1d4ed8' }
    };
    const color = colors[status.toLowerCase()] || { bg: '#f1f5f9', text: '#475569' };
    return (
      <span style={{
        padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
        background: color.bg, color: color.text, textTransform: 'uppercase', letterSpacing: '0.5px'
      }}>
        {status}
      </span>
    );
  };

  const navItem = (id, icon, label) => (
    <button
      onClick={() => loadTab(id)}
      style={{
        width: '100%', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '14px',
        background: activeTab === id ? 'rgba(255,107,0,0.1)' : 'transparent',
        color: activeTab === id ? 'var(--clr-orange)' : '#cbd5e1',
        border: 'none', borderLeft: `4px solid ${activeTab === id ? 'var(--clr-orange)' : 'transparent'}`,
        cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left', fontSize: '15px', fontWeight: activeTab === id ? 700 : 500
      }}
    >
      <i className={`fas ${icon}`} style={{ width: '20px', fontSize: '18px' }}></i>
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f5f9' }}>
      <style>{`
        aside nav::-webkit-scrollbar { width: 5px; }
        aside nav::-webkit-scrollbar-track { background: transparent; }
        aside nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); borderRadius: 10px; }
        aside nav::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>

      {/* SIDEBAR */}
      <aside style={{
        width: '280px', background: 'linear-gradient(180deg, var(--clr-kadal) 0%, #061e26 100%)', color: '#fff',
        position: 'fixed', left: 0, top: 0, height: '100vh', zIndex: 100,
        boxShadow: '10px 0 30px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ padding: '45px 30px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ fontSize: '26px', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-1px', fontFamily: "'Outfit', sans-serif" }}>
            SARA<span style={{ color: 'var(--clr-orange)' }}>.</span>
          </h2>
          <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '20px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--clr-orange)', boxShadow: '0 0 10px var(--clr-orange)' }}></div>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Admin Central</span>
          </div>
        </div>

        <nav className="sidebar-scroll-dark" style={{ flex: 1, padding: '20px 15px', overflowY: 'auto' }}>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', padding: '0 15px 15px 15px' }}>Store & Catalog</div>
          {navItem('dashboard', 'fa-tachometer-alt', 'Dashboard')}
          {navItem('orders', 'fa-shopping-cart', 'Orders')}
          {navItem('products', 'fa-box-open', 'Products')}
          {navItem('categories', 'fa-layer-group', 'Categories')}

          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', padding: '25px 15px 15px 15px' }}>Users & CRM</div>
          {navItem('customers', 'fa-users', 'Customers')}
          {navItem('vendors', 'fa-handshake', 'Vendors')}
          {navItem('staff', 'fa-user-tie', 'Staff Directory')}
          {navItem('inquiries', 'fa-headset', 'Service Inquiries')}
          {navItem('couriers', 'fa-shipping-fast', 'Courier Partners')}

          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', padding: '25px 15px 15px 15px' }}>Analytics</div>
          {navItem('reports', 'fa-chart-pie', 'Intelligence Hub')}
          {navItem('profile', 'fa-user-shield', 'Profile & Settings')}
        </nav>

        <div style={{ padding: '30px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
            <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--clr-orange), #ffb74d)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 15px rgba(249, 115, 22, 0.3)' }}>
              <i className="fas fa-crown" style={{ fontSize: '20px', color: '#fff' }}></i>
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>{user.name}</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>System Owner</div>
            </div>
          </div>
          <button onClick={logout} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <i className="fas fa-power-off"></i> Secure Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main style={{ marginLeft: '280px', flex: 1, padding: '40px' }}>
        {/* TOP BAR */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '50px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 900, color: 'var(--clr-kadal)', margin: 0, fontFamily: "'Outfit', sans-serif" }}>
              {activeTab === 'dashboard' ? 'Admin Overview' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1) + ' Management'}
            </h1>
            <p style={{ color: '#64748b', fontSize: '15px', marginTop: '8px', fontWeight: 500 }}>
              <i className="far fa-calendar-alt" style={{ marginRight: '8px', color: 'var(--clr-orange)' }}></i>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div style={{ position: 'relative', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0' }}>
              <i className="fas fa-search" style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}></i>
              <input value={searchQuery} onChange={handleSearch} placeholder="Deep Search Store Data..." style={{ padding: '16px 20px 16px 50px', borderRadius: '16px', border: 'none', width: '320px', outline: 'none', background: 'transparent' }} />
            </div>
          </div>
        </header>

        {/* Tab Content Wrapper */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          {activeTab === 'dashboard' && (
            <div>
              <div style={{ marginBottom: '30px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--clr-kadal)', margin: 0 }}>System Summary</h2>
                <p style={{ color: '#64748b', fontSize: '14px' }}>Real-time status of Sara Construction Store</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '30px', marginBottom: '50px' }}>
                {[
                  { label: 'Total Orders', value: stats.total_orders, icon: 'fa-shopping-bag', color: '#0ea5e9', gradient: 'linear-gradient(135deg, #0ea5e9, #6366f1)' },
                  { label: 'Products', value: stats.products, icon: 'fa-cube', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #fb923c)' },
                  { label: 'Customers', value: stats.customers, icon: 'fa-users', color: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899, #f43f5e)' },
                  { label: 'Total Revenue', value: `₹${stats.revenue.toLocaleString()}`, icon: 'fa-wallet', color: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #059669)' }
                ].map((stat, i) => (
                  <div key={i} style={{ background: '#fff', padding: '30px', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 10px 20px rgba(0,0,0,0.02)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '18px', background: stat.gradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                      <i className={`fas ${stat.icon}`}></i>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '5px' }}>{stat.label}</div>
                      <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--clr-kadal)', fontFamily: "'Outfit', sans-serif" }}>{stat.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ background: '#fff', borderRadius: '24px', padding: '25px', border: '1px solid #f1f5f9', boxShadow: '0 10px 40px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                   <div>
                    <h3 style={{ margin: 0, color: 'var(--clr-kadal)', fontSize: '18px', fontWeight: 800 }}>Recent Orders</h3>
                    <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Latest transactions across the store</p>
                  </div>
                  <button onClick={() => setPage('dashboard')} className="btn btn-outline" style={{ fontSize: '12px', padding: '8px 15px' }}>View All Activity</button>
                </div>
                <table className="data-table" style={{ border: 'none' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Order ID</th>
                      <th style={{ textAlign: 'left' }}>Customer</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.length === 0 ? <tr><td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No recent orders found.</td></tr> : recentOrders.map(o => (
                      <tr key={o.id}>
                        <td style={{ textAlign: 'left', fontWeight: 800 }}>#INV-{1000 + o.id}</td>
                        <td style={{ textAlign: 'left', fontWeight: 700 }}>{o.customer_name}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--clr-orange)' }}>₹{parseFloat(o.total_amount).toLocaleString()}</td>
                        <td style={{ textAlign: 'center' }}><StatusPill status={o.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: ORDERS */}
          {activeTab === 'orders' && (
            <div style={{ background: '#fff', borderRadius: '24px', padding: '25px', border: '1px solid #f1f5f9', boxShadow: '0 10px 40px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--clr-kadal)' }}>Order Management</h2>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Monitor and fulfill customer requests</p>
                </div>
                <button onClick={() => loadTab('orders')} className="btn btn-primary" style={{ padding: '12px 20px', borderRadius: '12px' }}>
                  <i className="fas fa-sync-alt"></i> Refresh Data
                </button>
              </div>
              <table className="data-table" style={{ border: 'none' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Order ID</th>
                    <th style={{ textAlign: 'left' }}>Customer</th>
                    <th style={{ textAlign: 'left' }}>Date</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'center' }}>Management</th>
                  </tr>
                </thead>
                <tbody>
                  {allOrders.map(o => (
                    <tr key={o.id}>
                      <td style={{ textAlign: 'left', fontWeight: 800 }}>#INV-{1000 + o.id}</td>
                      <td style={{ textAlign: 'left', fontWeight: 700 }}>{o.customer_name}</td>
                      <td style={{ textAlign: 'left', fontSize: '13px' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--clr-orange)' }}>₹{parseFloat(o.total_amount).toLocaleString()}</td>
                      <td style={{ textAlign: 'center' }}>
                        <select 
                          value={o.status} 
                          onChange={(e) => updateOrderStatus(o.id, e.target.value)} 
                          style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          <option value="pending">Pending</option>
                          <option value="processing">Processing</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }}>Details</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: PRODUCTS */}
          {activeTab === 'products' && (
            <div style={{ background: '#fff', borderRadius: '24px', padding: '25px', border: '1px solid #f1f5f9', boxShadow: '0 10px 40px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--clr-kadal)' }}>Catalog Management</h2>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Manage your product inventory and pricing</p>
                </div>
                <button onClick={() => openAddModal('product')} className="btn btn-primary" style={{ padding: '12px 20px', borderRadius: '12px' }}>
                  <i className="fas fa-plus"></i> Add New Product
                </button>
              </div>
              <table className="data-table" style={{ border: 'none' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Product Info</th>
                    <th style={{ textAlign: 'left' }}>Category</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                    <th style={{ textAlign: 'center' }}>Stock</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td style={{ textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <img 
                            src={p.image_url ? ((p.image_url.startsWith('http') || p.image_url.startsWith('/') ? p.image_url : '/' + p.image_url) + (p.image_url.includes('?') ? '&v=2' : '?v=2')) : 'https://placehold.co/400x300?text=Image'} 
                            style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '12px', border: '1px solid #f1f5f9' }} 
                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/400x300?text=Image'; }} 
                          />
                          <div>
                            <div style={{ fontWeight: 800, color: 'var(--clr-kadal)', fontSize: '15px' }}>{p.name}</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>#SKU-{2026 + p.id}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        <span style={{ padding: '4px 12px', borderRadius: '20px', background: '#f1f5f9', fontSize: '11px', fontWeight: 700, color: '#64748b' }}>{p.category_name}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--clr-orange)', fontSize: '15px' }}>₹{parseFloat(p.price).toLocaleString()}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, color: p.stock_quantity <= 5 ? '#ef4444' : 'var(--clr-kadal)' }}>
                          {p.stock_quantity} units
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                          <button onClick={() => openEditModal('product', p)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: '#eff6ff', color: '#2563eb', cursor: 'pointer' }}><i className="fas fa-edit"></i></button>
                          <button onClick={() => handleDelete('product', p.id)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: '#fef2f2', color: '#ef4444', cursor: 'pointer' }}><i className="fas fa-trash"></i></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: CUSTOMERS */}
          {activeTab === 'customers' && (
            <div style={{ background: '#fff', borderRadius: '24px', padding: '25px', border: '1px solid #f1f5f9', boxShadow: '0 10px 40px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--clr-kadal)' }}>Customer Directory</h2>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>View and manage registered clients</p>
                </div>
              </div>
              <table className="data-table" style={{ border: 'none' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Client Info</th>
                    <th style={{ textAlign: 'left' }}>Contact Details</th>
                    <th style={{ textAlign: 'left' }}>Primary Address</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => (
                    <tr key={c.id}>
                      <td style={{ textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--clr-kadal)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800 }}>
                            {c.name.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, color: 'var(--clr-kadal)' }}>{c.name}</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>ID: #C-{500 + c.id}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>{c.email}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{c.phone || 'No Phone'}</div>
                      </td>
                      <td style={{ textAlign: 'left', fontSize: '13px', color: '#64748b', maxWidth: '300px' }} title={c.address}>{c.address || 'N/A'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          onClick={() => {
                            setSelectedCustomer(c);
                            const orders = Array.isArray(allOrders) ? allOrders.filter(o => o.user_id === c.id) : [];
                            setCustomerOrders(orders);
                          }}
                          className="btn btn-outline" 
                          style={{ padding: '8px 16px', fontSize: '12px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid #e2e8f0', background: '#fff', color: 'var(--clr-kadal)' }}
                        >
                          <i className="fas fa-user-circle"></i> Profile ({Array.isArray(allOrders) ? allOrders.filter(o => o.user_id === c.id).length : 0})
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: VENDORS */}
          {activeTab === 'vendors' && (
            <div style={{ background: '#fff', borderRadius: '24px', padding: '25px', border: '1px solid #f1f5f9', boxShadow: '0 10px 40px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--clr-kadal)' }}>Supply Network</h2>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Manage your verified product vendors</p>
                </div>
                <button onClick={() => openAddModal('vendor')} className="btn btn-primary" style={{ padding: '12px 20px', borderRadius: '12px' }}>
                  <i className="fas fa-plus"></i> Partner Intake
                </button>
              </div>
              <table className="data-table" style={{ border: 'none' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Vendor Info</th>
                    <th style={{ textAlign: 'left' }}>Primary Contact</th>
                    <th style={{ textAlign: 'left' }}>Location</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map(v => (
                    <tr key={v.id}>
                      <td style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 800, color: 'var(--clr-kadal)', fontSize: '15px' }}>{v.name}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>ID: #VND-{v.id}</div>
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>{v.email}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{v.phone}</div>
                      </td>
                      <td style={{ textAlign: 'left', fontSize: '13px', color: '#64748b' }}>
                        <i className="fas fa-map-marker-alt" style={{ marginRight: '6px', color: 'var(--clr-orange)' }}></i>
                        {v.city}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                          <button onClick={() => openEditModal('vendor', v)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: '#f8fafc', color: 'var(--clr-kadal)', cursor: 'pointer' }}><i className="fas fa-edit"></i></button>
                          <button onClick={() => handleDelete('vendor', v.id)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: '#fef2f2', color: '#ef4444', cursor: 'pointer' }}><i className="fas fa-trash"></i></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: STAFF */}
          {activeTab === 'staff' && (
            <div style={{ background: '#fff', borderRadius: '24px', padding: '25px', border: '1px solid #f1f5f9', boxShadow: '0 10px 40px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--clr-kadal)' }}>Staff Directory</h2>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Control access and roles for your team</p>
                </div>
                <button onClick={() => openAddModal('staff')} className="btn btn-primary" style={{ padding: '12px 20px', borderRadius: '12px' }}>
                  <i className="fas fa-user-plus"></i> Register Member
                </button>
              </div>
              <table className="data-table" style={{ border: 'none' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Member Info</th>
                    <th style={{ textAlign: 'left' }}>Role</th>
                    <th style={{ textAlign: 'left' }}>Contact</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No staff members registered in the directory.</td></tr>
                  ) : staff.map(s => (
                    <tr key={s.id}>
                      <td style={{ textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', color: 'var(--clr-kadal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                            {s.name.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, color: 'var(--clr-kadal)', fontSize: '15px' }}>{s.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Store Operation Specialist</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        <span style={{ padding: '4px 12px', borderRadius: '20px', background: '#f0fdf4', color: '#16a34a', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', border: '1px solid #bbf7d0' }}>
                          {s.staff_role}
                        </span>
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>{s.email}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{s.phone || 'Contact not provided'}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', background: s.is_active ? '#dcfce7' : '#fee2e2', color: s.is_active ? '#166534' : '#991b1b' }}>
                          {s.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                          <button onClick={() => toggleStaffActive(s.id, !s.is_active)} title={s.is_active ? 'Deactivate Member' : 'Activate Member'} style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: s.is_active ? '#fef2f2' : '#dcfce7', color: s.is_active ? '#ef4444' : '#16a34a', cursor: 'pointer' }}><i className={`fas fa-${s.is_active ? 'lock' : 'unlock'}`}></i></button>
                          <button onClick={() => openEditModal('staff', s)} title="Edit Member" style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: '#eff6ff', color: '#2563eb', cursor: 'pointer' }}><i className="fas fa-user-edit"></i></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: CATEGORIES */}
          {activeTab === 'categories' && (
            <div style={{ background: '#fff', borderRadius: '24px', padding: '25px', border: '1px solid #f1f5f9', boxShadow: '0 10px 40px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--clr-kadal)' }}>Structure & Catalog</h2>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Organize your store's material hierarchy</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => openAddModal('subcategory')} className="btn btn-outline" style={{ padding: '10px 15px', fontSize: '12px' }}>
                    <i className="fas fa-plus"></i> Subcategory
                  </button>
                  <button onClick={() => openAddModal('category')} className="btn btn-primary" style={{ padding: '10px 15px', fontSize: '12px' }}>
                    <i className="fas fa-plus"></i> Main Category
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                {/* Categories Column */}
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--clr-kadal)', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fas fa-layer-group" style={{ color: 'var(--clr-orange)' }}></i> Primary Categories
                  </h3>
                  <table className="data-table" style={{ border: 'none' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Category Name</th>
                        <th style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map(c => (
                        <tr key={c.id}>
                          <td style={{ textAlign: 'left', fontWeight: 700, color: 'var(--clr-kadal)' }}>{c.name}</td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '5px' }}>
                              <button onClick={() => openEditModal('category', c)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: '#f8fafc', color: 'var(--clr-kadal)', cursor: 'pointer' }}><i className="fas fa-edit" style={{ fontSize: '11px' }}></i></button>
                              <button onClick={() => handleDelete('category', c.id)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: '#fef2f2', color: '#ef4444', cursor: 'pointer' }}><i className="fas fa-trash" style={{ fontSize: '11px' }}></i></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Subcategories Column */}
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--clr-kadal)', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fas fa-indent" style={{ color: 'var(--clr-orange)' }}></i> Nested Subcategories
                  </h3>
                  <table className="data-table" style={{ border: 'none' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Subcategory</th>
                        <th style={{ textAlign: 'left' }}>Parent</th>
                        <th style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subcategories.map(s => (
                        <tr key={s.id}>
                          <td style={{ textAlign: 'left', fontWeight: 600 }}>{s.name}</td>
                          <td style={{ textAlign: 'left' }}>
                            <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>{s.category_name}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '5px' }}>
                              <button onClick={() => openEditModal('subcategory', s)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: '#f8fafc', color: 'var(--clr-kadal)', cursor: 'pointer' }}><i className="fas fa-edit" style={{ fontSize: '11px' }}></i></button>
                              <button onClick={() => handleDelete('subcategory', s.id)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: '#fef2f2', color: '#ef4444', cursor: 'pointer' }}><i className="fas fa-trash" style={{ fontSize: '11px' }}></i></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: INQUIRIES */}
          {activeTab === 'inquiries' && (
            <div style={{ background: '#fff', borderRadius: '24px', padding: '25px', border: '1px solid #f1f5f9', boxShadow: '0 10px 40px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--clr-kadal)' }}>Service Inquiries</h2>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Technical requests and project consultations</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ background: '#eff6ff', color: '#2563eb', padding: '6px 15px', borderRadius: '20px', fontSize: '12px', fontWeight: 800 }}>TOTAL: {inquiries.length}</div>
                </div>
              </div>
              <table className="data-table" style={{ border: 'none' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Client</th>
                    <th style={{ textAlign: 'left' }}>Technical Inquiry</th>
                    <th style={{ textAlign: 'left' }}>Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inquiries.map(i => (
                    <tr key={i.id}>
                      <td style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 800, color: 'var(--clr-kadal)' }}>{i.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{i.email}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{i.phone}</div>
                        <a href={`mailto:${i.email}?subject=Re: ${encodeURIComponent(i.subject)}`} style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--clr-orange)', textDecoration: 'none', fontWeight: 800 }}>
                          <i className="fas fa-envelope"></i> QUICK REPLY
                        </a>
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 700, color: 'var(--clr-orange)', fontSize: '13px' }}>{i.subject}</div>
                        <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px', maxWidth: '300px', whiteSpace: 'normal', fontStyle: 'italic', fontWeight: 500 }}>"{i.message}"</div>
                        <div style={{ fontSize: '10px', color: '#cbd5e1', marginTop: '6px', fontWeight: 800, textTransform: 'uppercase' }}>Log: {new Date(i.created_at).toLocaleString()}</div>
                      </td>
                      <td style={{ textAlign: 'left' }}>
                         <select
                          value={i.status}
                          onChange={(e) => updateInquiry(i.id, { status: e.target.value })}
                          style={{
                            padding: '8px 12px', borderRadius: '10px', border: '1.2px solid #e2e8f0',
                            background: i.status === 'new' ? '#fff7ed' : i.status === 'replied' ? '#f0fdf4' : '#f8fafc',
                            color: i.status === 'new' ? '#ea580c' : i.status === 'replied' ? '#16a34a' : '#475569',
                            fontSize: '11px', fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase', width: '100%'
                          }}
                        >
                          <option value="new">Action Required</option>
                          <option value="in_progress">Processing</option>
                          <option value="replied">Resolved</option>
                          <option value="cancelled">Dismissed</option>
                        </select>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button onClick={() => handleDelete('inquiry', i.id)} style={{ width: '36px', height: '36px', borderRadius: '10px', border: 'none', background: '#fef2f2', color: '#ef4444', cursor: 'pointer' }}>
                          <i className="fas fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {inquiries.length === 0 && <tr><td colSpan="4" style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>No inquiries currently in queue.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          {activeTab === 'couriers' && (
            <div style={{ background: '#fff', borderRadius: '24px', padding: '35px', border: '1px solid #f1f5f9', boxShadow: '0 10px 40px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '26px', fontWeight: 900, color: 'var(--clr-kadal)' }}>Logistics & Courier Intelligence</h2>
                  <p style={{ margin: 0, fontSize: '14px', color: '#64748b', fontWeight: 500 }}>Global shipment partners and delivery network management</p>
                </div>
                <button 
                  onClick={() => openAddModal('courier_partner')}
                  style={{ background: 'var(--clr-kadal)', color: '#fff', border: 'none', padding: '12px 25px', borderRadius: '14px', fontWeight: 800, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 10px 20px rgba(8,51,68,0.15)' }}
                >
                  <i className="fas fa-plus"></i> Register New Partner
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '30px' }}>
                {couriers.map(c => (
                  <div key={c.id} style={{ background: '#f8fafc', borderRadius: '24px', padding: '30px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                      <div style={{ width: '54px', height: '54px', borderRadius: '18px', background: 'var(--clr-kadal)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', boxShadow: '0 8px 15px rgba(8,51,68,0.2)' }}>
                        <i className="fas fa-truck-fast"></i>
                      </div>
                      <button 
                         onClick={() => toggleCourierStatus(c.id)}
                         title={`Click to ${c.status === 'active' ? 'Deactivate' : 'Activate'}`}
                         style={{ 
                           padding: '6px 14px', borderRadius: '20px', fontSize: '10px', fontWeight: 800, 
                           textTransform: 'uppercase', cursor: 'pointer', border: 'none', transition: '0.2s',
                           background: c.status === 'active' ? '#dcfce7' : '#fee2e2', 
                           color: c.status === 'active' ? '#166534' : '#991b1b',
                           boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                         }}
                       >
                         <i className={`fas fa-${c.status === 'active' ? 'check-circle' : 'times-circle'}`} style={{ marginRight: '5px' }}></i>
                         {c.status}
                       </button>
                    </div>

                    <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 900, color: 'var(--clr-kadal)' }}>{c.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '25px', color: 'var(--clr-orange)', fontSize: '12px', fontWeight: 700 }}>
                      <i className="fas fa-link"></i> <a href={c.website} target="_blank" style={{ color: 'inherit', textDecoration: 'none' }}>Visit Corporate Website</a>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '30px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#475569', fontWeight: 500 }}>
                        <i className="fas fa-user-tie" style={{ color: '#94a3b8' }}></i> {c.contact_person}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#475569', fontWeight: 500 }}>
                        <i className="fas fa-phone" style={{ color: '#94a3b8' }}></i> {c.phone}
                      </div>
                    </div>

                    <div style={{ marginTop: 'auto', display: 'flex', gap: '10px' }}>
                      <button onClick={() => openEditModal('courier_partner', c)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: '#fff', color: 'var(--clr-kadal)', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}>Manage</button>
                      <button onClick={() => handleDelete('courier_partner', c.id)} style={{ padding: '12px', background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: '12px', cursor: 'pointer', width: '45px' }}><i className="fas fa-trash-alt"></i></button>
                    </div>

                    <div style={{ marginTop: '20px', padding: '15px', borderRadius: '15px', background: courierAccounts[c.id]?.has_account ? 'rgba(34,197,94,0.05)' : 'rgba(249,115,22,0.05)', border: `1px dashed ${courierAccounts[c.id]?.has_account ? '#bbf7d0' : '#fed7aa'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: courierAccounts[c.id]?.has_account ? '#166534' : '#ea580c', textTransform: 'uppercase' }}>Login Account</div>
                      {courierAccounts[c.id]?.has_account ? (
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#166534' }}><i className="fas fa-check-circle"></i> ESTABLISHED</div>
                      ) : (
                        <button 
                          onClick={() => { setCourierLoginForm({ email: '', password: '', courier_id: c.id, courier_name: c.name }); setModalType('courier_login'); setShowModal(true); }}
                          style={{ background: 'var(--clr-orange)', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: 800, cursor: 'pointer' }}
                        >
                          CREATE ACCOUNT
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {couriers.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '80px 40px', color: '#94a3b8', fontStyle: 'italic', background: '#f8fafc', borderRadius: '24px', border: '2px dashed #e2e8f0', fontWeight: 600 }}>Zero logistics partners established.</div>}
              </div>
            </div>
          )}

          {/* TAB: PROFILE */}
          {activeTab === 'profile' && (
            <div style={{ background: '#fff', borderRadius: '24px', padding: '40px', border: '1px solid #f1f5f9', boxShadow: '0 10px 40px rgba(0,0,0,0.02)', maxWidth: '800px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '25px', marginBottom: '40px', paddingBottom: '30px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'linear-gradient(135deg, var(--clr-orange), #ffb74d)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 900, boxShadow: '0 10px 20px rgba(249, 115, 22, 0.2)' }}>
                  {user.name.charAt(0)}
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: 'var(--clr-kadal)' }}>{user.name}</h2>
                  <p style={{ margin: '5px 0 0 0', color: '#64748b', fontWeight: 600 }}>System Administrator & Owner</p>
                  <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                    <span style={{ padding: '4px 10px', background: '#f0fdf4', color: '#16a34a', borderRadius: '20px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Verified</span>
                    <span style={{ padding: '4px 10px', background: '#eff6ff', color: '#2563eb', borderRadius: '20px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Full Access</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '10px', fontSize: '13px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Full Display Name</label>
                  <input type="text" readOnly value={user.name} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 700, fontColor: 'var(--clr-kadal)' }} />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '10px', fontSize: '13px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>System Role</label>
                  <input type="text" readOnly value="Administrator" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 700, fontColor: 'var(--clr-kadal)' }} />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '10px', fontSize: '13px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Primary Email</label>
                  <input type="email" readOnly value={user.email} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 700, fontColor: 'var(--clr-kadal)' }} />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '10px', fontSize: '13px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Security Level</label>
                  <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontWeight: 800, fontSize: '12px' }}>
                    <i className="fas fa-shield-alt" style={{ marginRight: '8px' }}></i> Level 10 (Critical Authorization)
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '40px', padding: '25px', borderRadius: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--clr-kadal)' }}>Two-Factor Authentication</h4>
                  <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#64748b' }}>Enhanced security for your admin account is currently active.</p>
                </div>
                <button className="btn btn-outline" style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '12px', fontWeight: 700 }}>Settings</button>
              </div>
            </div>
          )}


          {/* TAB: REPORTS */}
          {activeTab === 'reports' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              {/* Report Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: 'var(--clr-kadal)' }}>Business Intelligence</h2>
                  <p style={{ margin: '5px 0 0 0', color: '#64748b', fontWeight: 500 }}>Global store performance and sales analytics</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 15px' }}>
                    <i className="fas fa-calendar-alt" style={{ color: '#94a3b8', fontSize: '14px', marginRight: '10px' }}></i>
                    <select
                      value={reportPeriod}
                      onChange={(e) => {
                        setReportPeriod(e.target.value);
                        loadTab('reports', e.target.value);
                      }}
                      style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', fontWeight: 700, color: 'var(--clr-kadal)', cursor: 'pointer' }}
                    >
                      <option value="all">Full History</option>
                      <option value="today">Today's Performance</option>
                      <option value="month">This Month</option>
                      <option value="year">Current Year</option>
                      <option value="financial_year">Financial Year (Apr-Mar)</option>
                    </select>
                  </div>
                  <button
                    onClick={() => {
                      setFormData({ type: 'overview', period: reportPeriod });
                      setModalType('report_generator');
                      setShowModal(true);
                    }}
                    style={{ background: 'var(--clr-orange)', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: 700, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s', boxShadow: '0 4px 12px rgba(249, 115, 22, 0.2)' }}
                  >
                    <i className="fas fa-file-pdf"></i> Generate Professional Report
                  </button>
                </div>
              </div>

              {/* KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', padding: '25px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <div style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px' }}><i className="fas fa-chart-line"></i></div>
                    <span style={{ fontSize: '12px', fontWeight: 700, opacity: 0.8 }}>EST. REVENUE</span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 900 }}>₹{reportData.daily_sales?.reduce((acc, d) => acc + d.revenue, 0).toLocaleString() || '0.00'}</div>
                  <div style={{ fontSize: '11px', marginTop: '10px', opacity: 0.7 }}>Across {reportData.daily_sales?.reduce((acc, d) => acc + d.orders, 0) || 0} transactions</div>
                </div>

                <div style={{ background: 'linear-gradient(135deg, #059669, #10b981)', padding: '25px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <div style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px' }}><i className="fas fa-hand-holding-usd"></i></div>
                    <span style={{ fontSize: '12px', fontWeight: 700, opacity: 0.8 }}>NET PROFIT</span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 900 }}>₹{reportData.daily_sales?.reduce((acc, d) => acc + d.profit, 0).toLocaleString() || '0.00'}</div>
                  <div style={{ fontSize: '11px', marginTop: '10px', opacity: 0.7 }}>Margins looking healthy</div>
                </div>

                <div style={{ background: '#fff', padding: '25px', borderRadius: '24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <div style={{ padding: '8px', background: '#fff7ed', color: '#ea580c', borderRadius: '10px' }}><i className="fas fa-shopping-bag"></i></div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>AVG ORDER VALUE</span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--clr-kadal)' }}>
                    ₹{(() => {
                      const totalRev = reportData.daily_sales?.reduce((acc, d) => acc + d.revenue, 0) || 0;
                      const totalOrders = reportData.daily_sales?.reduce((acc, d) => acc + d.orders, 0) || 0;
                      return totalOrders > 0 ? (totalRev / totalOrders).toFixed(2) : '0.00';
                    })()}
                  </div>
                  <div style={{ fontSize: '11px', marginTop: '10px', color: '#10b981', fontWeight: 700 }}>Stable trajectory</div>
                </div>

                <div style={{ background: '#fff', padding: '25px', borderRadius: '24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <div style={{ padding: '8px', background: '#ecfdf5', color: '#059669', borderRadius: '10px' }}><i className="fas fa-users"></i></div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>CLIENT RETENTION</span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--clr-kadal)' }}>84.2%</div>
                  <div style={{ fontSize: '11px', marginTop: '10px', color: '#10b981', fontWeight: 700 }}>High Loyalty Level</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
                {/* Product Performance */}
                <div style={{ background: '#fff', padding: '30px', borderRadius: '24px', border: '1px solid #f1f5f9' }}>
                  <h3 style={{ margin: '0 0 25px 0', fontSize: '18px', fontWeight: 800 }}>Top Selling Products</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {reportData.product_performance?.map((p, idx) => (
                      <div key={p.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--clr-kadal)' }}>{p.name}</span>
                          <span style={{ fontWeight: 800 }}>{p.units} Units Sold</span>
                        </div>
                        <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                          <div style={{ 
                            position: 'absolute', top: 0, left: 0, height: '100%', 
                            background: idx === 0 ? 'var(--clr-orange)' : 'var(--clr-kadal)', 
                            width: `${reportData.product_performance?.[0]?.units > 0 ? (p.units / reportData.product_performance[0].units) * 100 : 0}%` 
                          }}></div>
                        </div>
                      </div>
                    ))}
                    {reportData.product_performance?.length === 0 && <p style={{ color: '#94a3b8' }}>No sales data available yet.</p>}
                  </div>
                </div>

                {/* Top Customers */}
                <div style={{ background: '#fff', padding: '30px', borderRadius: '24px', border: '1px solid #f1f5f9' }}>
                  <h3 style={{ margin: '0 0 25px 0', fontSize: '18px', fontWeight: 800 }}>Premium Customers</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {reportData.top_customers?.map((c, idx) => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px', borderRadius: '15px', background: idx === 0 ? 'rgba(249, 115, 22, 0.05)' : '#f8fafc' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: idx === 0 ? 'var(--clr-orange)' : '#e2e8f0', color: idx === 0 ? '#fff' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '12px' }}>
                          {idx + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '14px' }}>{c.name}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{c.orders} Orders Placed</div>
                        </div>
                        <div style={{ fontWeight: 800, color: 'var(--clr-kadal)', fontSize: '13px' }}>₹{c.spent.toLocaleString()}</div>
                      </div>
                    ))}
                    {reportData.top_customers?.length === 0 && <p style={{ color: '#94a3b8' }}>No customer data yet.</p>}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '30px' }}>
                {/* Sales by Category */}
                <div style={{ background: '#fff', padding: '30px', borderRadius: '24px', border: '1px solid #f1f5f9' }}>
                  <h3 style={{ margin: '0 0 25px 0', fontSize: '18px', fontWeight: 800 }}>Revenue by Category</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {reportData.category_sales?.map(cat => (
                      <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ width: '100px', fontSize: '13px', fontWeight: 700, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</div>
                        <div style={{ flex: 1, height: '12px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
                          <div style={{ 
                            height: '100%', background: 'var(--clr-kadal)', 
                            width: `${reportData.category_sales?.[0]?.revenue > 0 ? (cat.revenue / reportData.category_sales[0].revenue) * 100 : 0}%` 
                          }}></div>
                        </div>
                        <div style={{ width: '80px', textAlign: 'right', fontSize: '13px', fontWeight: 800 }}>₹{cat.revenue.toLocaleString()}</div>
                      </div>
                    ))}
                    {reportData.category_sales?.length === 0 && <p style={{ color: '#94a3b8' }}>No category data available.</p>}
                  </div>
                </div>

                {/* Low Stock Watchlist */}
                <div style={{ background: '#fff', padding: '30px', borderRadius: '24px', border: '1px solid #fef2f2', boxShadow: '0 4px 15px rgba(220, 38, 38, 0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#991b1b' }}>Low Stock Watchlist</h3>
                    <div style={{ background: '#fef2f2', color: '#dc2626', padding: '4px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: 800 }}>CRITICAL</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {reportData.low_stock?.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', background: '#fffcfc', borderRadius: '15px', border: '1px solid #fee2e2' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: '#7f1d1d' }}>{item.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '12px', color: '#991b1b', fontWeight: 800 }}>{item.stock} left</span>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#dc2626', boxShadow: '0 0 5px rgba(220, 38, 38, 0.5)' }}></div>
                        </div>
                      </div>
                    ))}
                    {reportData.low_stock?.length === 0 && <p style={{ color: '#059669', fontWeight: 700, textAlign: 'center' }}>All items well stocked! âœ…</p>}
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div style={{ background: '#fff', padding: '30px', borderRadius: '24px', border: '1px solid #f1f5f9' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 800 }}>Recent Sales Log</h3>
                <table className="data-table" style={{ border: 'none' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Date</th>
                      <th style={{ textAlign: 'center' }}>Orders</th>
                      <th style={{ textAlign: 'right' }}>Daily Revenue</th>
                      <th style={{ textAlign: 'right' }}>AOV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.daily_sales?.map(d => (
                      <tr key={d.date}>
                        <td style={{ textAlign: 'left', fontWeight: 600 }}>{new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td style={{ textAlign: 'center' }}><span style={{ padding: '4px 10px', background: '#f1f5f9', borderRadius: '20px', fontSize: '12px', fontWeight: 800 }}>{d.orders}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--clr-kadal)' }}>₹{d.revenue.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#64748b' }}>₹{d.avg_order_value.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
    </div>
      </main >

      {/* â”€â”€ ADMIN MODAL â”€â”€ */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, animation: 'fadeIn 0.3s ease' }}>
          <style>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes modalSlideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            .admin-input { width: 100%; padding: 12px 16px; border: 1.5px solid #e2e8f0; borderRadius: '12px', fontSize: '14px', transition: '0.2s', outline: 'none' }
            .admin-input:focus { border-color: var(--clr-orange); box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.1); }
          `}</style>
          <div style={{ background: '#fff', width: '90%', maxWidth: modalType === 'new_purchase' ? '850px' : '600px', borderRadius: '30px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', animation: 'modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '30px 40px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--clr-kadal)' }}>
                  {editingId ? 'Edit' : (modalType === 'new_purchase' ? 'Record' : 'Create New')} {
                    modalType === 'new_purchase' ? 'Stock Intake' :
                    modalType === 'courier_partner' ? 'Courier Partner' :
                    modalType === 'courier_login' ? 'Courier Login Access' :
                    modalType.charAt(0).toUpperCase() + modalType.slice(1)
                  }
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Please provide accurate data for the system</p>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: '#fff', border: '1px solid #e2e8f0', width: '36px', height: '36px', borderRadius: '10px', cursor: 'pointer', color: '#64748b' }}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleModalSubmit} style={{ padding: '40px', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                {/* Dynamic Form Fields based on modalType */}
                {(modalType === 'product') && (
                  <React.Fragment>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Product Title</label>
                      <input name="name" value={formData.name || ''} onChange={handleFormChange} placeholder="e.g. Ultra Cement 50KG" className="admin-input" required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Category</label>
                      <select name="category_id" value={formData.category_id || ''} onChange={e => {
                        handleFormChange(e);
                        setFormData(prev => ({ ...prev, subcategory_id: '' }));
                      }} className="admin-input" required>
                        <option value="">Select Category</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Subcategory (Optional)</label>
                      <select name="subcategory_id" value={formData.subcategory_id || ''} onChange={handleFormChange} className="admin-input">
                        <option value="">None</option>
                        {subcategories.filter(s => String(s.category_id) === String(formData.category_id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Measurement Unit</label>
                      <select name="unit" value={formData.unit || 'sqft'} onChange={handleFormChange} className="admin-input" required>
                        <option value="sqft">SqFt (Square Feet)</option>
                        <option value="piece">Piece (Each)</option>
                        <option value="bag">Bag</option>
                        <option value="kg">Kg</option>
                        <option value="bundle">Bundle</option>
                      </select>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Product Description</label>
                      <textarea name="description" value={formData.description || ''} onChange={handleFormChange} placeholder="Enter detailed product description..." style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' }} />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Product Image</label>
                      <input type="file" name="image_file" onChange={handleFormChange} className="admin-input" accept="image/*" />
                    </div>
                  </React.Fragment>
                )}

                {(modalType === 'staff') && (
                  <React.Fragment>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>First Name</label>
                      <input name="staff_fname" value={formData.staff_fname || formData.name?.split(' ')[0] || ''} onChange={handleFormChange} placeholder="John" className="admin-input" required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Last Name</label>
                      <input name="staff_lname" value={formData.staff_lname || formData.name?.split(' ').slice(1).join(' ') || ''} onChange={handleFormChange} placeholder="Doe" className="admin-input" required />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Email Address</label>
                      <input type="email" name="staff_email" value={formData.staff_email || formData.email || ''} onChange={handleFormChange} placeholder="staff@saraconstruction.com" className="admin-input" required />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Phone Number</label>
                      <input name="staff_ph" value={formData.staff_ph || formData.phone || ''} onChange={handleFormChange} placeholder="+91 0000000000" className="admin-input" />
                    </div>
                    {!editingId && (
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Temporary Password</label>
                        <input type="password" name="password" value={formData.password || ''} onChange={handleFormChange} placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" className="admin-input" required minLength={6} />
                      </div>
                    )}
                  </React.Fragment>
                )}

                {(modalType === 'vendor') && (
                  <React.Fragment>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Company Name</label>
                      <input name="name" value={formData.name || ''} onChange={handleFormChange} placeholder="Global Steel Supplies" className="admin-input" required />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Official Email</label>
                      <input type="email" name="email" value={formData.email || ''} onChange={handleFormChange} placeholder="contact@vendor.com" className="admin-input" required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Mobile/Landline</label>
                      <input name="phone" value={formData.phone || ''} onChange={handleFormChange} placeholder="+91 ..." className="admin-input" required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Primary City</label>
                      <input name="city" value={formData.city || ''} onChange={handleFormChange} placeholder="e.g. Bangalore" className="admin-input" required />
                    </div>
                  </React.Fragment>
                )}

                {(modalType === 'category' || modalType === 'subcategory') && (
                  <React.Fragment>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Name</label>
                      <input name="name" value={formData.name || ''} onChange={handleFormChange} placeholder="e.g. Bricks & Tiles" className="admin-input" required />
                    </div>
                    {modalType === 'subcategory' && (
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Parent Category</label>
                        <select name="category_id" value={formData.category_id || ''} onChange={handleFormChange} className="admin-input" required>
                          <option value="">Select Parent</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    )}
                  </React.Fragment>
                )}

                {modalType === 'courier_partner' && (
                  <React.Fragment>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Company Identity</label>
                      <input name="name" value={formData.name || ''} onChange={handleFormChange} placeholder="e.g. FedEx India" className="admin-input" required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Primary Contact</label>
                      <input name="contact_person" value={formData.contact_person || ''} onChange={handleFormChange} placeholder="Manager Name" className="admin-input" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Business Phone</label>
                      <input name="phone" value={formData.phone || ''} onChange={handleFormChange} placeholder="+91 ..." className="admin-input" />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Tracking/Corporate URL</label>
                      <input name="website" value={formData.website || ''} onChange={handleFormChange} placeholder="https://..." className="admin-input" />
                    </div>
                  </React.Fragment>
                )}

                {modalType === 'courier_login' && (
                  <React.Fragment>
                    <div style={{ gridColumn: 'span 2', background: '#f8fafc', padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0', marginBottom: '10px' }}>
                      <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                        <i className="fas fa-shield-halved" style={{ color: 'var(--clr-orange)', marginRight: '8px' }}></i>
                        Establishing encrypted access for <strong>{courierLoginForm.courier_name}</strong>. This account will grant access to the specialized courier portal.
                      </p>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>System Username (Email)</label>
                      <input type="email" value={courierLoginForm.email} onChange={e => setCourierLoginForm({ ...courierLoginForm, email: e.target.value })} placeholder="courier@saraconstruction.com" className="admin-input" required />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Access Token (Password)</label>
                      <input type="text" value={courierLoginForm.password} onChange={e => setCourierLoginForm({ ...courierLoginForm, password: e.target.value })} placeholder="Create a strong password" className="admin-input" required />
                    </div>
                    <div style={{ gridColumn: 'span 2', marginTop: '10px' }}>
                       <button
                        type="button"
                        onClick={() => {
                          if (!courierLoginForm.email || !courierLoginForm.password) { showToast('Email and password required', 'error'); return; }
                          fetch(`/api/admin/couriers/${courierLoginForm.courier_id}/create_account`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                            body: JSON.stringify({ email: courierLoginForm.email, password: courierLoginForm.password })
                          }).then(r => r.json()).then(d => {
                            if (d.success) {
                              showToast(`Access established for ${courierLoginForm.courier_name}!`);
                              setCourierAccounts(prev => ({ ...prev, [courierLoginForm.courier_id]: { has_account: true } }));
                              setShowModal(false);
                            } else { showToast(d.message || 'Access creation failed', 'error'); }
                          });
                        }}
                        style={{ width: '100%', padding: '16px', borderRadius: '15px', border: 'none', background: 'var(--clr-kadal)', color: '#fff', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                      >
                        <i className="fas fa-key"></i> Provision Access Account
                      </button>
                    </div>
                  </React.Fragment>
                )}

                {modalType === 'report_generator' && (
                  <React.Fragment>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Report Focus Area</label>
                      <select name="type" value={formData.type || 'overview'} onChange={handleFormChange} className="admin-input">
                        <option value="overview">Executive Overview (Business Health)</option>
                        <option value="sales">Financial Performance Details</option>
                        <option value="inventory">Inventory & Stock Audit</option>
                        <option value="customers">CRM & Client Engagement</option>
                        <option value="logistics">Supply Chain & Logistics</option>
                        <option value="vendors">Vendor Network Analysis</option>
                        <option value="staff">Staff Access & Operations</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Timeline Scope</label>
                      <select name="period" value={formData.period || 'all'} onChange={handleFormChange} className="admin-input">
                        <option value="all">Lifetime Data</option>
                        <option value="today">Today Only</option>
                        <option value="month">This Month (MTD)</option>
                        <option value="year">This Year (YTD)</option>
                        <option value="financial_year">Financial Year</option>
                        <option value="custom">Custom Range</option>
                      </select>
                    </div>
                    {formData.period === 'custom' && (
                      <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Start Date</label>
                          <input type="date" name="start_date" value={formData.start_date || ''} onChange={handleFormChange} className="admin-input" />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>End Date</label>
                          <input type="date" name="end_date" value={formData.end_date || ''} onChange={handleFormChange} className="admin-input" />
                        </div>
                      </div>
                    )}
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Export Format</label>
                      <select name="format" value={formData.format || 'pdf'} onChange={handleFormChange} className="admin-input">
                        <option value="pdf">Professional PDF (with Charts)</option>
                        <option value="excel">Data Sheet (Excel)</option>
                      </select>
                    </div>
                  </React.Fragment>
                )}
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '16px', borderRadius: '15px', border: '1px solid #e2e8f0', background: 'transparent', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}>Discard</button>
                {modalType === 'report_generator' ? (
                  <a 
                    href={`/api/admin/reports/download?type=${formData.type || 'overview'}&period=${formData.period || 'all'}&format=${formData.format || 'pdf'}${formData.period === 'custom' ? `&start_date=${formData.start_date || ''}&end_date=${formData.end_date || ''}` : ''}`}
                    target="_blank"
                    style={{ flex: 2, padding: '16px', borderRadius: '15px', border: 'none', background: 'var(--clr-orange)', color: '#fff', fontWeight: 800, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}
                    onClick={() => setShowModal(false)}
                  >
                    Generate & Download {formData.format?.toUpperCase() || 'PDF'}
                  </a>
                ) : (
                  <button type="submit" style={{ flex: 2, padding: '16px', borderRadius: '15px', border: 'none', background: 'var(--clr-orange)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                    {editingId ? 'Update Record' : 'Create Registry'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER PROFILE MODAL */}
      {selectedCustomer && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, animation: 'fadeIn 0.3s ease' }}>
          <div style={{ background: '#fff', width: '90%', maxWidth: '900px', borderRadius: '30px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', animation: 'modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {/* Header */}
            <div style={{ padding: '30px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--clr-kadal)', color: '#fff' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>Customer Profile: {selectedCustomer.name}</h3>
                <p style={{ margin: '5px 0 0 0', opacity: 0.8, fontSize: '13px' }}>{selectedCustomer.email} | ID: #C-{500 + selectedCustomer.id}</p>
                <div style={{ marginTop: '12px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', background: selectedCustomer.is_active ? '#dcfce7' : '#fee2e2', color: selectedCustomer.is_active ? '#166534' : '#991b1b' }}>
                    {selectedCustomer.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    onClick={() => toggleCustomerActive(selectedCustomer.id, !selectedCustomer.is_active)}
                    style={{ padding: '7px 14px', borderRadius: '12px', border: 'none', background: selectedCustomer.is_active ? '#ef4444' : 'var(--clr-orange)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    {selectedCustomer.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCustomer(null)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: '40px', height: '40px', borderRadius: '12px', cursor: 'pointer', fontSize: '20px' }}
              >×</button>
            </div>

            {/* Body */}
            <div style={{ padding: '30px', overflowY: 'auto', flex: 1 }}>
              {/* Customer Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginBottom: '25px' }}>
                <div style={{ background: '#f8fafc', padding: '18px 20px', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Contact Details</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--clr-kadal)' }}>{selectedCustomer.name}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{selectedCustomer.phone || 'No phone provided'}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{selectedCustomer.email}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '18px 20px', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Address</div>
                  <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.5, minHeight: '64px' }}>{selectedCustomer.address || 'No address on record'}</div>
                  <div style={{ marginTop: '12px', fontSize: '11px', color: '#94a3b8' }}>Joined: {new Date(selectedCustomer.created_at).toLocaleDateString()}</div>
                </div>
              </div>

              {/* Order History */}
              <div style={{ marginTop: '25px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--clr-kadal)', marginBottom: '15px' }}>Order History</h4>
                {customerOrders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', background: '#f8fafc', borderRadius: '16px', color: '#94a3b8' }}>
                    <i className="fas fa-shopping-bag" style={{ fontSize: '2rem', marginBottom: '10px', display: 'block', opacity: 0.3 }}></i>
                    <p>No orders placed yet</p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ textAlign: 'left', padding: '12px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Order ID</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Amount</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Date</th>
                        <th style={{ textAlign: 'center', padding: '12px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Status</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerOrders.map(o => (
                        <tr key={o.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '14px 12px', fontSize: '13px', fontWeight: 700, color: 'var(--clr-kadal)' }}>#INV-{1000 + o.id}</td>
                          <td style={{ padding: '14px 12px', fontSize: '13px', fontWeight: 700, color: 'var(--clr-orange)' }}>₹{parseFloat(o.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td style={{ padding: '14px 12px', fontSize: '12px', color: '#64748b' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                            <span style={{ 
                              padding: '4px 10px', 
                              borderRadius: '12px', 
                              fontSize: '11px', 
                              fontWeight: 800, 
                              textTransform: 'uppercase',
                              background: o.status === 'delivered' ? '#dcfce7' : o.status === 'cancelled' ? '#fee2e2' : o.status === 'shipped' ? '#dbeafe' : '#fef9c3',
                              color: o.status === 'delivered' ? '#166534' : o.status === 'cancelled' ? '#991b1b' : o.status === 'shipped' ? '#1e40af' : '#854d0e'
                            }}>
                              {o.status}
                            </span>
                          </td>
                          <td style={{ padding: '14px 12px', fontSize: '12px', color: '#64748b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.shipping_address}>{o.shipping_address || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '20px 30px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setSelectedCustomer(null)} 
                style={{ padding: '10px 25px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', color: 'var(--clr-kadal)', fontWeight: 700, cursor: 'pointer' }}
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
}

// â”€â”€ COURIER DASHBOARD â”€â”€

function CourierDashboard() {
  const { user, logout, showToast } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({ total: 0, pending: 0, shipped: 0, delivered: 0, revenue: 0 });
  const [shipments, setShipments] = useState([]);
  const [profile, setProfile] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);
  const [editTracking, setEditTracking] = useState({});

  useEffect(() => {
    fetch('/api/courier/dashboard', { credentials: 'include' }).then(r => r.json()).then(setStats);
    fetch('/api/courier/shipments', { credentials: 'include' }).then(r => r.json()).then(setShipments);
    fetch('/api/courier/profile', { credentials: 'include' }).then(r => r.json()).then(setProfile);
  }, []);

  const updateShipmentStatus = (orderId, newStatus, trackingId) => {
    setUpdatingId(orderId);
    fetch(`/api/courier/shipment/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: newStatus, tracking_id: trackingId || undefined })
    }).then(r => r.json()).then(d => {
      if (d.success) {
        showToast('Shipment status updated!');
        setShipments(prev => prev.map(s => s.id === orderId ? { ...s, status: newStatus, tracking_id: trackingId || s.tracking_id } : s));
        fetch('/api/courier/dashboard', { credentials: 'include' }).then(r => r.json()).then(setStats);
      } else {
        showToast(d.message || 'Update failed', 'error');
      }
      setUpdatingId(null);
    });
  };

  const filtered = shipments.filter(s => {
    const matchSearch = s.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      String(s.id).includes(search) || (s.tracking_id || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const statusColor = (st) => {
    if (st === 'delivered') return { bg: '#dcfce7', color: '#16a34a', border: '#bbf7d0' };
    if (st === 'shipped') return { bg: '#dbeafe', color: '#2563eb', border: '#bfdbfe' };
    if (st === 'cancelled') return { bg: '#fee2e2', color: '#ef4444', border: '#fee2e2' };
    if (st === 'confirmed') return { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' };
    return { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' };
  };

  const navItems = [
    { id: 'overview', icon: 'fa-tachometer-alt', label: 'Overview' },
    { id: 'shipments', icon: 'fa-truck', label: 'My Shipments' },
    { id: 'profile', icon: 'fa-building', label: 'Company Profile' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Outfit', sans-serif" }}>

      {/* â”€â”€ Sidebar â”€â”€ */}
      <aside style={{ width: '270px', background: 'var(--clr-kadal)', display: 'flex', flexDirection: 'column', padding: '0', flexShrink: 0 }}>
        {/* Brand */}
        <div style={{ padding: '35px 30px 25px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#fff', fontFamily: 'Outfit' }}>
            Sara<span style={{ color: 'var(--clr-orange)' }}>.</span>
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '4px' }}>Courier Portal</div>
        </div>

        {/* User Info */}
        <div style={{ padding: '20px 30px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ width: '44px', height: '44px', background: 'var(--clr-orange)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>
            {user.name?.charAt(0).toUpperCase()}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{user.name}</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>{user.email}</div>
          <span style={{ display: 'inline-block', marginTop: '8px', padding: '3px 10px', background: 'rgba(255,152,0,0.15)', border: '1px solid rgba(255,152,0,0.3)', borderRadius: '20px', fontSize: '10px', fontWeight: 800, color: 'var(--clr-orange)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Courier Partner
          </span>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '20px 15px' }}>
          {navItems.map(it => (
            <button key={it.id} onClick={() => setActiveTab(it.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 18px', borderRadius: '12px',
              background: activeTab === it.id ? 'rgba(255,255,255,0.1)' : 'transparent',
              border: activeTab === it.id ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
              color: activeTab === it.id ? '#fff' : 'rgba(255,255,255,0.45)',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginBottom: '4px', transition: '0.2s', fontFamily: 'Outfit'
            }}>
              {activeTab === it.id && <div style={{ width: '3px', height: '18px', background: 'var(--clr-orange)', borderRadius: '2px', position: 'absolute', left: '15px' }}></div>}
              <i className={`fas ${it.icon}`} style={{ fontSize: '16px', color: activeTab === it.id ? 'var(--clr-orange)' : undefined }}></i>
              {it.label}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding: '20px 15px 30px' }}>
          <button onClick={logout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 18px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', color: '#f87171', cursor: 'pointer', fontSize: '14px', fontWeight: 600, fontFamily: 'Outfit' }}>
            <i className="fas fa-sign-out-alt"></i> Logout
          </button>
        </div>
      </aside>

      {/* â”€â”€ Main Content â”€â”€ */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>

        {/* â”€â”€ OVERVIEW â”€â”€ */}
        {activeTab === 'overview' && (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{ marginBottom: '35px' }}>
              <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--clr-kadal)', margin: 0 }}>Welcome back, {user.name.split(' ')[0]}! ðŸ‘‹</h1>
              <p style={{ color: '#94a3b8', marginTop: '6px', fontSize: '15px' }}>Here's your delivery performance at a glance.</p>
            </div>

            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px', marginBottom: '40px' }}>
              {[
                { label: 'Total Assigned', value: stats.total, icon: 'fa-box', color: '#6366f1', bg: '#eef2ff' },
                { label: 'Pending Pickup', value: stats.pending, icon: 'fa-clock', color: '#ea580c', bg: '#fff7ed' },
                { label: 'In Transit', value: stats.shipped, icon: 'fa-truck', color: '#2563eb', bg: '#dbeafe' },
                { label: 'Delivered', value: stats.delivered, icon: 'fa-check-circle', color: '#16a34a', bg: '#dcfce7' },
                { label: 'Revenue Handled', value: `₹${parseFloat(stats.revenue || 0).toLocaleString()}`, icon: 'fa-rupee-sign', color: '#0891b2', bg: '#e0f2fe' },
              ].map((card, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: '20px', padding: '24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                  <div style={{ width: '44px', height: '44px', background: card.bg, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                    <i className={`fas ${card.icon}`} style={{ color: card.color, fontSize: '18px' }}></i>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--clr-kadal)', lineHeight: 1 }}>{card.value}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{card.label}</div>
                </div>
              ))}
            </div>

            {/* Recent Shipments Preview */}
            <div style={{ background: '#fff', borderRadius: '20px', padding: '30px', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--clr-kadal)', margin: 0 }}>Recent Shipments</h3>
                <button onClick={() => setActiveTab('shipments')} style={{ background: 'var(--clr-kadal)', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>View All</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Order ID', 'Customer', 'Tracking ID', 'Address', 'Status'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shipments.slice(0, 5).map(s => {
                    const sc = statusColor(s.status);
                    return (
                      <tr key={s.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 700, color: 'var(--clr-kadal)' }}>ORD-{s.id}</td>
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748b' }}>{s.customer_name}</td>
                        <td style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 600, color: '#64748b', fontFamily: 'monospace' }}>{s.tracking_id || 'â€”'}</td>
                        <td style={{ padding: '14px 16px', fontSize: '12px', color: '#94a3b8', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.shipping_address}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{s.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {shipments.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No shipments assigned yet.</div>}
            </div>
          </div>
        )}

        {/* â”€â”€ SHIPMENTS â”€â”€ */}
        {activeTab === 'shipments' && (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{ marginBottom: '30px' }}>
              <h1 style={{ fontSize: '26px', fontWeight: 900, color: 'var(--clr-kadal)', margin: 0 }}>My Shipments</h1>
              <p style={{ color: '#94a3b8', marginTop: '6px' }}>Manage and update your assigned deliveries.</p>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ðŸ”  Search by customer, order ID, or tracking..." style={{ flex: 1, padding: '11px 18px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', outline: 'none', fontFamily: 'Outfit' }} />
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '11px 18px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', background: '#fff', cursor: 'pointer', fontFamily: 'Outfit' }}>
                <option value="all">All Statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="shipped">In Transit</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Shipment Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {filtered.map(s => {
                const sc = statusColor(s.status);
                const isUpdating = updatingId === s.id;
                return (
                  <div key={s.id} style={{ background: '#fff', borderRadius: '20px', border: '1px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                    {/* Card Header */}
                    <div style={{ padding: '20px 25px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ width: '42px', height: '42px', background: 'var(--clr-kadal)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                          <i className="fas fa-truck" style={{ fontSize: '16px' }}></i>
                        </div>
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--clr-kadal)' }}>Order #ORD-{s.id}</div>
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>{new Date(s.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                        </div>
                      </div>
                      <span style={{ padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{s.status}</span>
                    </div>

                    {/* Card Body */}
                    <div style={{ padding: '25px', display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '25px' }}>
                      {/* Customer */}
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Customer</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--clr-kadal)' }}>{s.customer_name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>{s.customer_email}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.customer_phone || 'â€”'}</div>
                      </div>

                      {/* Delivery */}
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Delivery Address</div>
                        <div style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>{s.shipping_address}</div>
                        {s.estimated_delivery && <div style={{ fontSize: '12px', color: 'var(--clr-orange)', fontWeight: 700, marginTop: '6px' }}><i className="fas fa-calendar-alt" style={{ marginRight: '5px' }}></i>By {new Date(s.estimated_delivery).toLocaleDateString()}</div>}
                      </div>

                      {/* Tracking + Actions */}
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Tracking ID</div>
                        <input
                          value={editTracking[s.id] !== undefined ? editTracking[s.id] : (s.tracking_id || '')}
                          onChange={e => setEditTracking({ ...editTracking, [s.id]: e.target.value })}
                          placeholder="Enter tracking ID"
                          style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontFamily: 'monospace', outline: 'none', marginBottom: '12px' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {s.status !== 'shipped' && s.status !== 'delivered' && s.status !== 'cancelled' && (
                            <button
                              disabled={isUpdating}
                              onClick={() => updateShipmentStatus(s.id, 'shipped', editTracking[s.id])}
                              style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '9px', borderRadius: '9px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', opacity: isUpdating ? 0.6 : 1 }}
                            >
                              <i className="fas fa-truck"></i> Mark as Shipped
                            </button>
                          )}
                          {s.status === 'shipped' && (
                            <button
                              disabled={isUpdating}
                              onClick={() => updateShipmentStatus(s.id, 'delivered', editTracking[s.id])}
                              style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '9px', borderRadius: '9px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', opacity: isUpdating ? 0.6 : 1 }}
                            >
                              <i className="fas fa-check-circle"></i> Mark as Delivered
                            </button>
                          )}
                          {s.tracking_id !== editTracking[s.id] && editTracking[s.id] !== undefined && (
                            <button
                              disabled={isUpdating}
                              onClick={() => updateShipmentStatus(s.id, s.status, editTracking[s.id])}
                              style={{ background: 'var(--clr-kadal)', color: '#fff', border: 'none', padding: '9px', borderRadius: '9px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              <i className="fas fa-save"></i> Save Tracking
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {s.dispatch_notes && (
                      <div style={{ padding: '12px 25px', background: '#fffbeb', borderTop: '1px solid #fef3c7', fontSize: '13px', color: '#92400e' }}>
                        <i className="fas fa-sticky-note" style={{ marginRight: '8px' }}></i>
                        <strong>Dispatch Notes:</strong> {s.dispatch_notes}
                      </div>
                    )}
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '80px', background: '#fff', borderRadius: '20px', color: '#94a3b8' }}>
                  <i className="fas fa-truck" style={{ fontSize: '4rem', marginBottom: '20px', display: 'block', opacity: 0.3 }}></i>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>No shipments found</div>
                  <div style={{ fontSize: '14px', marginTop: '8px' }}>Try adjusting your search or filter.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* â”€â”€ PROFILE â”€â”€ */}
        {activeTab === 'profile' && (
          <div style={{ animation: 'fadeIn 0.4s ease-out', maxWidth: '700px' }}>
            <div style={{ marginBottom: '30px' }}>
              <h1 style={{ fontSize: '26px', fontWeight: 900, color: 'var(--clr-kadal)', margin: 0 }}>Company Profile</h1>
              <p style={{ color: '#94a3b8', marginTop: '6px' }}>Your courier partner details registered with Sara Construction.</p>
            </div>

            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, var(--clr-kadal), #0a4a5c)', padding: '35px 40px', color: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                  <div style={{ width: '64px', height: '64px', background: 'var(--clr-orange)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: 900, color: '#fff' }}>
                    {user.name?.charAt(0)}
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 900 }}>{profile?.company?.name || user.name}</h2>
                    <div style={{ fontSize: '13px', opacity: 0.7, marginTop: '4px' }}>Registered Courier Partner</div>
                    <span style={{ display: 'inline-block', marginTop: '8px', padding: '3px 12px', background: profile?.company?.status === 'active' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)', border: `1px solid ${profile?.company?.status === 'active' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`, borderRadius: '20px', fontSize: '11px', fontWeight: 800, color: profile?.company?.status === 'active' ? '#4ade80' : '#f87171', textTransform: 'uppercase' }}>
                      {profile?.company?.status || 'Active'}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '35px 40px' }}>
                {[
                  { label: 'Contact Person', value: profile?.company?.contact_person || user.name, icon: 'fa-user' },
                  { label: 'Email Address', value: profile?.user?.email || user.email, icon: 'fa-envelope' },
                  { label: 'Phone Number', value: profile?.company?.phone || user.phone || 'â€”', icon: 'fa-phone' },
                  { label: 'Website', value: profile?.company?.website || 'â€”', icon: 'fa-globe' },
                ].map((field, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '18px', padding: '18px 0', borderBottom: i < 3 ? '1px solid #f1f5f9' : 'none' }}>
                    <div style={{ width: '40px', height: '40px', background: '#f8fafc', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className={`fas ${field.icon}`} style={{ color: 'var(--clr-kadal)', fontSize: '15px' }}></i>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{field.label}</div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--clr-kadal)', marginTop: '3px' }}>{field.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}



      </main>
    </div>
  );
}

// â”€â”€ MAIN APP â”€â”€

function App() {
  const { user, page, setPage, toast, setLoginOpen } = useContext(AppContext);

  const renderContent = () => {
    if (page === 'home') return <HomePage />;
    if (page === 'products') return <ProductsPage />;
    if (page === 'services') return <ServicesPage />;
    if (page === 'cart') return <CartPage />;

    if (page === 'dashboard') {
      if (!user) {
        setPage('home');
        setTimeout(() => setLoginOpen(true), 10);
        return null;
      }

      // If user is a customer, render ONLY the CustomerDashboard (no sidebar)
      if (user.role === 'customer') {
        return (
          <div style={{ width: '100vw', minHeight: '100vh', background: '#fff' }}>
            <CustomerDashboard />
          </div>
        );
      }

      // Admin Dashboard full screen view
      if (user.role === 'admin') {
        return <AdminDashboard />;
      }

      // For Staff, wrap in the dark sidebar layout (if we want to keep staff small)
      // Otherwise staff dashboard handles it.
      if (user.role === 'staff') {
        return <StaffDashboard />;
      }

      if (user.role === 'courier') {
        return <CourierDashboard />;
      }
    }
    return <section className="section container"><h1>{page.toUpperCase()} PAGE</h1><p>Functionality coming soon...</p></section>;
  };


  return (
    <div className="app-root">
      {page !== 'dashboard' && <Navbar />}
      {renderContent()}
      <LoginModal />
      <RegisterModal />
      <InquiryModal />
      {toast && <div className={`toast toast-${toast.type}`}><i className="fas fa-info-circle"></i> {toast.message}</div>}
    </div>
  );
}

// Mount
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<AppProvider><App /></AppProvider>);
