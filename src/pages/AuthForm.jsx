import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  putData,
  getAllData,
  deleteData,
  isStoreEmpty,
} from '../utils/db.js';
import {
  signup,
  login,
  sendOTP,
  verIfyOTP,
  updatePassword,
  regLocal,
} from '../utils/service.js';
import { useNavigate } from 'react-router-dom';
import { encryptText, decryptText } from '../utils/cryptoUtils.js';
import PasswordInput from '../components/PasswordComponent.jsx';
import { useAlert } from '../components/AlertContext.jsx';

function AuthForm() {
  // form states
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({
    firstname: '',
    middlename: '',
    surname: '',
    email: '',
    password: '',
    school: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [success, setSuccess] = useState(false);

  // OTP and flows
  const [showFallback, setShowFallback] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState(Array(6).fill(''));
  const [inputRefs, setInputRefs] = useState([]);
  const refs = useRef([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPasswordInput, setShowNewPasswordInput] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [showRegLocal, setShowRegLocal] = useState(false);

  // pending action holds the action to perform after OTP verification
  // e.g. { type: 'signup'|'login'|'regLocal'|'forgot', payload: {...}, subject: '...' }
  const [pendingAction, setPendingAction] = useState(null);

  const navigate = useNavigate();
  const { showAlert } = useAlert();

  useEffect(() => {
    // keep refs array length in sync with otp length
    setInputRefs((r) => {
      const arr = Array(otp.length)
        .fill()
        .map((_, i) => r[i] || React.createRef());
      refs.current = arr;
      return arr;
    });
  }, [otp.length]);

  // helpers
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const resetForm = () => {
    setForm({ firstname: '', middlename: '', surname: '', email: '', password: '', school: '' });
    setConfirmPassword('');
  };

  // Send OTP wrapper: always send object with email & subject (subject optional)
  const sendOtpToEmail = async (email, type, subject = '') => {
    try {
      const payload = { email, subject, type };
      const res = await sendOTP(payload);
      return res;
    } catch (err) {
      throw err;
    }
  };

  // submit handler now only validates input and sends OTP, sets pendingAction
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading2(true);

    if (!isLogin) {
      // signup validation
      const { firstname, middlename, surname, email, password } = form;
      if (!firstname || !middlename || !surname || !email || !password) {
        setError('All fields are required');
        setLoading2(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setLoading2(false);
        return;
      }

      try {
        // ensure device has no user (offline) before signup
        const empty = await isStoreEmpty('user');
        if (!empty) {
          showAlert('An account already exists on this device. Please login instead.', 'error');
          setLoading2(false);
          return;
        }

        // send OTP and set pendingAction to signup
        const subject = 'WeSigned Signup - Email verification';
        const type = 'signup';
        const res = await sendOtpToEmail(form.email, type, subject);
        if (!res?.data?.ok) {
          showAlert(res?.data?.message || 'Failed to send OTP', 'error');
          setLoading2(false);
          return;
        }

        showAlert('OTP sent. Enter it to complete registration.', 'success');
        setPendingAction({ type: 'signup', payload: { ...form }, subject });
        setShowOtpInput(true);
      } catch (err) {
        console.error('SIGNUP_PREP_ERROR', err);
        if (err?.response?.data?.message) showAlert(err.response.data.message, 'error');
      } finally {
        setLoading2(false);
      }
    } else {
      // login validation
      const { email, password } = form;
      if (!email || !password) {
        setError('All fields are required');
        setLoading(false);
        return;
      }

      try {
        const subject = 'WeSigned Login - Email verification';
        const type = 'login';
        const res = await sendOtpToEmail(email, type, subject);
        if (!res?.data?.ok) {
          showAlert(res?.data?.message || 'Failed to send OTP', 'error');
          setLoading2(false);
          return;
        }

        showAlert('OTP sent. Enter it to continue.', 'success');
        // save the payload -- we'll actually call login after OTP verified
        setPendingAction({ type: 'login', payload: { email, password }, subject });
        setShowOtpInput(true);
      } catch (err) {
        console.error('LOGIN_PREP_ERROR', err);
        if (err?.response?.data?.message) showAlert(err.response.data.message, 'error');
      } finally {
        setLoading2(false);
      }
    }
  };

  // OTP input handlers
  const handleOTPChange = (value, index) => {
    if (!/^\d?$/.test(value)) return; // only allow single digit numbers
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // focus next
    if (value && index < otp.length - 1) {
      refs.current[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      refs.current[index - 1].current?.focus();
    }
    // allow left/right arrow navigation
    if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1].current?.focus();
    }
    if (e.key === 'ArrowRight' && index < otp.length - 1) {
      refs.current[index + 1].current?.focus();
    }
  };

  const clearOtp = () => {
    setOtp(Array(6).fill(''));
    refs.current[0]?.current?.focus();
  };

  // Called when user clicks "verify code"
  const handleVerifyOtp = async () => {
    setLoading(true);
    setError('');
    try {
      const otpValue = otp.join('');
      if (otpValue.length !== 6) {
        showAlert('Please enter the 6-digit code', 'error');
        setLoading(false);
        return;
      }

      const res = await verIfyOTP(otpValue);
      if (!res?.data?.success) {
        showAlert(res?.data?.message || 'OTP verification failed', 'error');
        setLoading(false);
        return;
      }

      showAlert('Code verified', 'success');

      const { type, payload } = pendingAction;

      if (type === 'signup') {
        // perform signup now
        try {
          const signupRes = await signup(payload);
          if (signupRes?.data?.ok) {
            const userId = signupRes.data.userID || signupRes.data.userId || '';
            const token = signupRes.data.token || '';
            const encryptedUserId = await encryptText(userId);
            const encryptedPassword = await encryptText(payload.password);

            const storedUser = { ...payload, password: encryptedPassword, userId: encryptedUserId };
            await putData('user', storedUser);
            localStorage.setItem('token', token);
            setSuccess(true);
            showAlert('Registration successful!', 'success');
            setTimeout(() => navigate('/dashboard'), 1200);
          } else {
            showAlert(signupRes.data.message || 'Registration failed', 'error');
          }
        } catch (err) {
          console.error('SIGNUP_ERROR', err);
          if (err?.response?.data?.message) showAlert(err.response.data.message, 'error');
        } finally {
          setPendingAction(null);
          setShowOtpInput(false);
          clearOtp();
          setLoading(false);
          resetForm();
        }
      } else if (type === 'login') {
        // perform login now
        try {
          const loginRes = await login(payload);
          if (loginRes?.data?.ok) {
            const userId = loginRes.data.userId;
            const userData = loginRes.data.user;
            const token = loginRes.data.token;
            const isEmpty = await isStoreEmpty('user');

            if (isEmpty && userData) {
              showAlert(
                "Can't find your registration data on this device. Looks like you cleared your offline Data — we'll help you re-register.",
                'warning',
                { closable: true }
              );
              // present fallback for local re-registration
              setShowFallback(true);
              setShowRegLocal(true);
      
            } else if (!isEmpty) {
              // check device user matches
              const existingUsers = await getAllData('user');
              const existingUser = existingUsers.find((u) => u.email === payload.email);
              if (!existingUser) {
                showAlert("This is not the registered device.", 'warning');
                setLoading(false);
                return;
              }
              const decryptedId = await decryptText(existingUser.userId);
              if (decryptedId !== userId) {
                showAlert("This is not the registered device.", 'warning');
                setLoading(false);
                return;
              }
              localStorage.setItem('token', token);
              setSuccess(true);
              setTimeout(() => navigate('/dashboard'), 1200);
            } else {
              // fallback: simply set token and navigate
              localStorage.setItem('token', token);
              setSuccess(true);
              setTimeout(() => navigate('/dashboard'), 1200);
            }
          } else {
            showAlert(loginRes.data.message || 'Login failed', 'error');
          }
        } catch (err) {
          console.error('LOGIN_ERROR', err);
          if (err?.response?.data?.message) {
            showAlert(err.response.data.message, 'warning');
          } else {
            showAlert('Login failed', 'error');
          }
        } finally {
          setPendingAction(null);
          setShowOtpInput(false);
          clearOtp();
          setLoading(false);
          resetForm();
        }
      } else if (type === 'regLocal') {
        // register locally after OTP verification
        try {
          const regRes = await regLocal(payload);
          if (regRes?.data?.ok) {
            const { user, userId, userPassword } = regRes.data;
            const encryptedUserId = await encryptText(userId);
            const encryptedPassword = await encryptText(userPassword);
            const stored = { ...user, password: encryptedPassword, userId: encryptedUserId };
            await putData('pendingUser', { ...stored, createdAt: Date.now(), status: 'pending' });
            showAlert(regRes.data.message || 'Local registration pending', 'success');
          } else {
            showAlert(regRes.data.message || 'Local registration failed', 'error');
          }
        } catch (err) {
          console.error('REGLOCAL_ERROR', err);
          if (err?.response?.data?.message) showAlert(err.response.data.message, 'error');
        } finally {
          setPendingAction(null);
          setShowFallback(false);
          setShowOtpInput(false);
          clearOtp();
          setLoading(false);
        }
      } else if (type === 'forgot'){
        setShowNewPasswordInput(true);
        setShowOtpInput(false);
        clearOtp();
        setLoading(false);
      } else {
        // unknown pendingAction type
        setPendingAction(null);
        setShowOtpInput(false);
        clearOtp();
        setLoading(false);
      }
    } catch (err) {
      console.error('OTP_VERIFY_ERROR', err);
      if (err?.response?.data?.message) showAlert(err.response.data.message, 'error');
      setLoading(false);
    }
  };

  // resend OTP for the current pendingAction or general use
  const handleResendOtp = async () => {
    if (!pendingAction && !form.email) {
      showAlert('No email to resend OTP to', 'error');
      return;
    }

    setLoading(true);
    try {
      const email = form.email || pendingAction?.payload?.email;
      const subject = pendingAction?.subject || '';
      const res = await sendOtpToEmail(email, subject);
      if (res?.data?.ok) {
        showAlert('OTP resent', 'success');
        clearOtp();
      } else {
        showAlert(res?.data?.message || 'Failed to resend OTP', 'error');
      }
    } catch (err) {
      console.error('RESEND_OTP_ERROR', err);
      if (err?.response?.data?.message) showAlert(err.response.data.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // forgot password flow: send OTP then set pendingAction to 'forgot'
  const handleForgotPasswordFlow = async () => {
    setError('');
    setLoading(true);
    try {
      const existingUsers = await getAllData('user');
      const existingUser = existingUsers?.find((u) => u.email === form.email);
      if (!existingUser) {
        showAlert('Email not registered locally on this device.', 'error');
        setLoading(false);
        return;
      }
      const subject = 'WeSigned - Password reset';
      const type = 'forgot';
      const res = await sendOtpToEmail(form.email, type, subject);
      if (!res?.data?.ok) {
        showAlert(res?.data?.message || 'Failed to send OTP', 'error');
        setLoading(false);
        return;
      }
      showAlert('OTP sent. Enter code to proceed to reset password.', 'success');
      setPendingAction({ type: 'forgot', payload: { email: form.email }, subject });
      setShowOtpInput(true);
    } catch (err) {
      console.error('FORGOT_FLOW_ERROR', err);
      if (err?.response?.data?.message) showAlert(err.response.data.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // after OTP verified for forgot flow, user enters new password and calls this
  const handleUpdatePassword = async () => {
    setLoading(true);
    try {
      if (newPassword !== confirmNewPassword) {
        showAlert('Passwords do not match.', 'error');
        setLoading(false);
        return;
      }
      if (!form.email) {
        showAlert('No email provided', 'error');
        setLoading(false);
        return;
      }

      const res = await updatePassword(form.email, newPassword);
      if (res?.data?.ok) {
        // update local storage if user exists locally
        const existingUsers = await getAllData('user');
        const existingUser = existingUsers.find((u) => u.email === form.email);
        if (!existingUser) {
          showAlert('User not found locally', 'error');
          setLoading(false);
          return;
        }
        const encryptedPassword = await encryptText(newPassword);
        existingUser.password = encryptedPassword;
        await putData('user', existingUser);
        showAlert(res.data.message || 'Password updated', 'success');
      } else {
        showAlert(res.data.message || 'Failed to update password', 'error');
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error('UPDATE_PASSWORD_ERROR', err);
      if (err?.response?.data?.message) showAlert(err.response.data.message, 'error');
      setLoading(false);
      return;
    }

    // cleanup
    setShowNewPasswordInput(false);
    setShowFallback(false);
    setForm((prev) => ({ ...prev, email: '' }));
    setNewPassword('');
    setConfirmNewPassword('');
    setForgotPassword(false);
    setPendingAction(null);
    setLoading(false);
  };

  // local registration after OTP (if you want to keep previous regLocal flow)
  const handleLocalRegStart = async () => {
    // For reregistration/local registration: send OTP first then handle in handleVerifyOtp (regLocal)
    if (!form.email || !form.password) {
      showAlert('Email and password required for local registration', 'error');
      return;
    }
    setLoading(true);
    try {
      const subject = 'WeSigned - Local registration';
      const type = 'regLocal';
      const res = await sendOtpToEmail(form.email, type, subject);
      if (!res?.data?.ok) {
        showAlert(res?.data?.message || 'Failed to send OTP', 'error');
        setLoading(false);
        return;
      }
      showAlert('OTP sent. Enter code to register locally.', 'success');
      setPendingAction({ type: 'regLocal', payload: { email: form.email, password: form.password, ...form }});
      setShowOtpInput(true);
      setShowRegLocal(false);
    } catch (err) {
      console.error('LOCAL_REG_START_ERROR', err);
      if (err?.response?.data?.message) showAlert(err.response.data.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // small UI helpers & transitions
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-sky-100 to-indigo-200 px-2 sm:px-4">
      <motion.div
        className="w-full max-w-md sm:max-w-lg md:max-w-xl bg-white/90 rounded-2xl shadow-2xl p-4 sm:p-8 relative overflow-hidden"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* Loading Overlay */}
        <AnimatePresence>
          {loading2 && (
            <motion.div
              className="absolute inset-0 bg-white/70 flex items-center justify-center z-[9999]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Spinner />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Overlay */}
        <AnimatePresence>
          {success && (
            <motion.div
              className="absolute inset-0 bg-white/80 flex items-center justify-center z-[9998]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="bg-green-100 rounded-full p-6"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-[#94c04c]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Logo */}
        <motion.div className="flex flex-col items-center mb-6 sm:mb-8" initial="hidden" animate="visible" variants={fadeIn} transition={{ delay: 0.2 }}>
          <img src="/images/logo.png" alt="WeSigned logo" className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 pt-3 -mt-6 object-contain" />
          <h2 className="mt-3 sm:mt-4 text-xl sm:text-2xl md:text-3xl font-bold text-indigo-500 tracking-wide text-center">
            {isLogin ? 'Welcome Back!' : 'Create an Account'}
          </h2>
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div className="mb-4 p-2 text-sm text-red-600 bg-red-100 rounded-lg text-center" initial="hidden" animate="visible" variants={fadeIn}>
            {error}
          </motion.div>
        )}

        {/* Form */}
        <motion.form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit} autoComplete="off" initial="hidden" animate="visible" variants={fadeIn} transition={{ delay: 0.3 }}>
          {!isLogin && (
            <>
              {['firstname', 'middlename', 'surname'].map((field) => (
                <div key={field}>
                  <label className="block text-md font-medium text-indigo-700 mb-1">{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                  <input
                    type="text"
                    name={field}
                    className="w-full px-3 sm:px-4 py-2 rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-indigo-50 text-indigo-900 text-base sm:text-lg"
                    placeholder={`Your ${field}`}
                    value={form[field]}
                    onChange={handleChange}
                  />
                </div>
              ))}
            </>
          )}

          <div>
            <label className="block text-md font-medium text-indigo-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              className="w-full px-3 sm:px-4 py-2 rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-indigo-50 text-indigo-900 text-base sm:text-lg"
              placeholder="you@email.com"
              value={form.email}
              autoComplete="email"
              onChange={handleChange}
            />
          </div>

          {isLogin && (
            <div>
              <label className="block text-md font-medium text-indigo-700 mb-1">Password</label>
              <PasswordInput name="password" placeholder="Password" value={form.password} onChange={handleChange} autoComplete="current-password" />
            </div>
          )}

          {!isLogin && (
            <>
              <div>
                <label className="block text-md font-medium text-indigo-700 mb-1">
                  School <span className="text-gray-400"> (optional) </span>
                </label>
                <input
                  type="text"
                  name="school"
                  className="w-full px-3 sm:px-4 py-2 rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-indigo-50 text-indigo-900 text-base sm:text-lg"
                  placeholder="Your School Name."
                  value={form.school}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-md font-medium text-indigo-700 mb-1">Password</label>
                <PasswordInput name="password" placeholder="Password" value={form.password} onChange={handleChange} autoComplete="new-password" />
              </div>

              <div>
                <label className="block text-md font-medium text-indigo-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  className="w-full px-3 sm:px-4 py-2 rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-indigo-50 text-indigo-900 text-base sm:text-lg"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </>
          )}

          <button type="submit" disabled={loading2} className="hover:scale-105 active:scale-95 w-full py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-sky-400 text-white font-semibold text-base sm:text-lg shadow-md transition-all cursor-pointer">
            {isLogin ? 'Login' : 'Sign Up'}
          </button>
        </motion.form>

        {/* Switch Auth Mode */}
        <motion.div className="mt-4 sm:mt-6 text-center" initial="hidden" animate="visible" variants={fadeIn} transition={{ delay: 0.4 }}>
          <button className="text-indigo-600 hover:underline font-medium cursor-pointer" onClick={() => setIsLogin((prev) => !prev)} type="button">
            {isLogin ? (
              <>
                Don't have an account? <span className="text-[#94c04c] hover:underline">Sign Up</span>
              </>
            ) : (
              <>
                Already have an account? <span className="text-[#94c04c] hover:underline">Login</span>
              </>
            )}
          </button>

          {isLogin && (
            <>
              <hr className="mt-4 text-gray-500 text-[20px] font-bold" />
              <div className="flex justify-between">
                <button
                  className="block mt-4 text-[#669b11] hover:underline font-medium cursor-pointer"
                  onClick={() => {
                    setShowFallback(true);
                    setForgotPassword(true);
                  }}
                  type="button"
                >
                  Forgot Password?
                </button>
                <button className="block mt-4 text-[#669b11] hover:underline font-medium cursor-pointer" onClick={() => navigate('/reregistration')} type="button">
                  Re-register
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>

      {/* Fallback / OTP Modal */}
      <AnimatePresence>
        {(showFallback || showOtpInput) && (
          <>
            <motion.div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />

            <motion.div
              className="fixed z-50 top-1/2 left-1/2 bg-white rounded-2xl shadow-lg p-4 sm:p-6 w-11/12 max-w-xs sm:max-w-sm text-center transform -translate-x-1/2 -translate-y-1/2"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              {loading && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-2xl z-50">
                  <Spinner />
                </div>
              )}

              {(!showNewPasswordInput && !showOtpInput) && !showRegLocal && (
                <>
                  <h2 className="text-lg font-semibold mb-2">Forgot Password!</h2>

                  <p className="text-sm text-gray-600 mb-4">
                    Don’t worry, we’ll help you regain access shortly.
                    <span className="text-sm text-indigo-500">{' '}Enter your Email to proceed.</span>
                  </p>

                  <div className="mb-4 text-left">
                    <label className="block text-md font-medium text-indigo-700 mb-1">Email</label>
                    <input
                      type="email"
                      name="email"
                      className="w-full px-3 sm:px-4 py-2 rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-indigo-50 text-indigo-900 text-base sm:text-lg"
                      placeholder="you@email.com"
                      value={form.email}
                      autoComplete="email"
                      onChange={handleChange}
                    />
                  </div>

                  <div className="flex gap-2">
                    <button onClick={handleForgotPasswordFlow} disabled={loading} className="flex-1 bg-gradient-to-r from-[#273c72] to-[#94c04c] hover:from-[#23376b] hover:to-[#669b11] transition-all mt-2 font-semibold text-white px-4 py-2 rounded-lg hover:cursor-pointer text-base sm:text-lg">
                      Send OTP
                    </button>
                    <button onClick={() => { setShowFallback(false); setForgotPassword(false); }} disabled={loading} className="flex-1 border rounded-lg mt-2 px-4 py-2 cursor-pointer hover:bg-black hover:text-gray-200">
                      Cancel
                    </button>
                  </div>
                </>
              )}

              {/* Multi-digit OTP Input */}
              {showOtpInput && (
                <>
                  <h2 className="text-lg font-semibold mb-2">Code Verification!</h2>
                  <p className="text-sm text-gray-600 mb-2">Enter the 6-digit code sent to <span className="font-medium">{form.email}</span></p>
                  <div className="flex justify-center gap-2 mb-4">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => {
                          if (!refs.current[index]) refs.current[index] = React.createRef();
                          refs.current[index].current = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength="1"
                        value={digit}
                        onChange={(e) => handleOTPChange(e.target.value.replace(/\D/g, ''), index)}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        className="w-8 h-10 sm:w-10 sm:h-12 border rounded-lg text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={handleVerifyOtp} disabled={loading} className="flex-1 bg-gradient-to-r from-[#273c72] to-[#94c04c] hover:from-[#23376b] hover:to-[#669b11] transition-all mt-2 font-semibold text-white px-4 py-2 rounded-lg hover:cursor-pointer text-base sm:text-lg">
                      Verify Code
                    </button>
                    <button onClick={handleResendOtp} disabled={loading} className="flex-1 border rounded-lg mt-2 px-4 py-2 cursor-pointer hover:bg-black hover:text-gray-200">
                      Resend
                    </button>
                  </div>
                </>
              )}

              {showNewPasswordInput && (
                <>
                  <h2 className="text-lg font-semibold mb-2">Forgot Password!</h2>
                  <div className="mb-4 text-left">
                    <label className="block text-md font-medium text-indigo-700 mb-1">New Password</label>
                    <PasswordInput name="newPassword" placeholder="Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
                  </div>
                  <div className="mb-4 text-left">
                    <label className="block text-md font-medium text-indigo-700 mb-1">Confirm New Password</label>
                    <input type="password" name="confirmNewPassword" className="w-full px-3 sm:px-4 py-2 rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-indigo-50 text-indigo-900 text-base sm:text-lg" placeholder="Confirm new password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} />
                  </div>

                  <button onClick={handleUpdatePassword} disabled={loading} className="bg-gradient-to-r from-[#273c72] to-[#94c04c] hover:from-[#23376b] hover:to-[#669b11] transition-all mt-2 text-white px-4 py-2 rounded-lg w-full hover:cursor-pointer text-base sm:text-lg">
                    Update Password
                  </button>
                </>
              )}

              {showRegLocal && (
                <>
                  <h2 className="text-lg font-semibold mb-2">Update Local Data!</h2>
                  <div className="flex flex-col gap-2 mb-4 text-left">
                    <div>
                      <label className="block text-md font-medium text-indigo-700 mb-1">Email</label>
                      <input
                        type="email"
                        name="email"
                        className="w-full px-3 sm:px-4 py-2 rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-indigo-50 text-indigo-900 text-base sm:text-lg"
                        placeholder="you@email.com"
                        value={form.email}
                        autoComplete="email"
                        onChange={handleChange}
                      />
                    </div>

                    <div>
                      <label className="block text-md font-medium text-indigo-700 mb-1">Password</label>
                      <input
                        type="password"
                        name="password"
                        className="w-full px-3 sm:px-4 py-2 rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-indigo-50 text-indigo-900 text-base sm:text-lg"
                        placeholder="your account password"
                        value={form.password}
                        onChange={handleChange}
                      />
                    </div>
                    
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleLocalRegStart} disabled={loading} className="flex-1 bg-gradient-to-r from-[#273c72] to-[#94c04c] hover:from-[#23376b] hover:to-[#669b11] transition-all mt-2 font-semibold text-white px-4 py-2 rounded-lg hover:cursor-pointer text-base sm:text-lg">
                      Send OTP
                    </button>
                    <button onClick={() => { setShowFallback(false); setShowRegLocal(false); }} disabled={loading} className="flex-1 border rounded-lg mt-2 px-4 py-2 cursor-pointer hover:bg-black hover:text-gray-200">
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

const Spinner = () => {
  return (
    <motion.div
      className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-500 rounded-full"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
    />
  );
};

export default AuthForm;
