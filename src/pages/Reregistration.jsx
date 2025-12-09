import React, { useEffect, useRef, useState } from "react";
import { useAlert } from "../components/AlertContext";
import { useNavigate } from "react-router-dom";
import { getAllData, deleteData, putData } from "../utils/db";
import { reRegister, sendOTP } from "../utils/service";
import { motion, AnimatePresence } from 'framer-motion';
import PasswordInput from '../components/PasswordComponent.jsx';
import { encryptText } from '../utils/cryptoUtils.js';

export default function Reregistration() {
    const [form, setForm] = useState({
        firstname: '',
        middlename: '',
        surname: '',
        email: '',
        password: '',
        school: ''
    });
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [otp, setOtp] = useState(Array(6).fill(''));
    const refs = useRef([]);
    const [inputRefs, setInputRefs] = useState([]);
    
    const { showAlert } = useAlert();
    const navigate = useNavigate();

    useEffect(() => {
        showAlert("Please know that this feature is only recommended if you lost your email because it will take 12hours for the new account to be activated. This is to prevent impersonation.", "info", { closable: true });
    }, []);


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

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        setSuccess(false);
    
        try {
            const { firstname, middlename, surname, email, password, school } = form;
            if (!firstname || !middlename || !surname || !email || !password) {
                setError('All fields are required');
                setLoading(false);
                return;
            }
            if (password !== confirmPassword) {
                setError('Passwords do not match');
                setLoading(false);
                return;
            }

            const subject = 'WeSigned Account re-registration - Email verification';
            const type = 'reReg';
            const payload = { email, type, subject };
            const res = await sendOTP(payload);
            if (!res?.data?.ok) {
            showAlert(res?.data?.message || 'Failed to send OTP', 'error');
            setLoading(false);
            return;
            }
            showAlert('OTP sent. Enter it to complete registration.', 'success');
            setShowOtpInput(true);
        } catch (err) {
            console.error("ERROR", err.response ? err.response.data : err);
            if (err.response) showAlert(err.response.data.message, 'warning');
            setLoading(false);
        }
            
        setLoading(false);
        setError('');
    };


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



    const handleVerifyOtp = async () => {
        setLoading(true);
        try {
            const otpValue = otp.join("");
            console.log(`OTP: ${otpValue}`);
            const res = await verIfyOTP(otpValue);
            console.log(res);
            if (res.data.success) {
                const { firstname, middlename, surname, email, password, school } = form;
                const payload = { firstname, middlename, surname, email, password, school };
                const reRegRes = await reRegister(payload);

                if (reRegRes.data.ok) {
                    const userId = reRegRes.data.userId;
                    const encryptedUserId = await encryptText(userId);
                    const encryptedPassword = await encryptText(password);
                    payload.password = encryptedPassword;
                    payload.userId = encryptedUserId;
                    const user = payload;
                    console.log("Payload", payload);
                    console.log("User", user);
                    await putData('pendingUser', { ...user, createdAt: Date.now(), status: "pending" });
                    setSuccess(true);
                    showAlert(reRegRes.data.message, 'success');
                    setTimeout(() => {
                        navigate('/');
                    }, 1500);
                } else {
                    setError('Registration failed!');
                    setLoading(false);
                }   
            } else {
                showAlert(res.data.message, 'error');
                setLoading(false);
          }
        } catch (err) {
          if (err.response) {
            showAlert(err.response.data.message, 'error');
            setLoading(false); 
          }
        }
        clearOtp();
        setError('');
        setShowOtpInput(false);
        setOtp(Array(6).fill(""));
        setForm({ firstname: '', middlename: '', surname: '', email: '', password: '', school: '' });
        setConfirmPassword('');
        setLoading(false);
    };
    


    const fadeIn = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-sky-100 to-indigo-200 px-2 sm:px-4">
            <motion.div
                className="w-full max-w-md sm:max-w-lg md:max-w-xl bg-white/90 rounded-2xl shadow-2xl p-4 sm:p-8 relative overflow-hidden"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
            >
                {/* Loading Spinner Overlay */}
                <AnimatePresence>
                    {loading && (
                        <motion.div
                        className="absolute inset-0 bg-white/70 flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        >
                            <Spinner />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Success Check Overlay */}
                <AnimatePresence>
                    {success && (
                        <motion.div
                        className="absolute inset-0 bg-white/80 flex items-center justify-center"
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
                            <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-12 w-12 text-[#94c04c]"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Logo Section */}
                <motion.div
                className="flex flex-col items-center mb-6 sm:mb-8"
                initial="hidden"
                animate="visible"
                variants={fadeIn}
                transition={{ delay: 0.2 }}
                >
                    <img
                        src="/images/logo.png"
                        alt="WeSigned log"
                        className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 pt-3 -mt-6 object-contain"
                    />
                    <h2 className="mt-3 sm:mt-4 text-xl sm:text-2xl md:text-3xl font-bold text-indigo-500 tracking-wide text-center">
                        Re-register Account.
                    </h2>
                </motion.div>

                {/* Error Box */}
                {error && (
                    <motion.div
                        className="mb-4 p-2 text-sm text-red-600 bg-red-100 rounded-lg text-center"
                        initial="hidden"
                        animate="visible"
                        variants={fadeIn}
                    >
                        {error}
                    </motion.div>
                )}

                {/* Form */}
                <motion.form
                className="space-y-4 sm:space-y-5"
                onSubmit={handleSubmit}
                autoComplete="off"
                initial="hidden"
                animate="visible"
                variants={fadeIn}
                transition={{ delay: 0.3 }}
                >
                    {['firstname', 'middlename', 'surname'].map((field) => (
                        <div key={field}>
                            <label className="block text-md font-medium text-indigo-700 mb-1">
                                {field.charAt(0).toUpperCase() + field.slice(1)}
                            </label>
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
                        <label className="block text-md font-medium text-indigo-700 mb-1">School <span className='text-gray-400'> (optional) </span></label>
                        <input
                            type="text"
                            name='school'
                            className="w-full px-3 sm:px-4 py-2 rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-indigo-50 text-indigo-900 text-base sm:text-lg"
                            placeholder="Your School Name."
                            value={form.school}
                            onChange={handleChange}
                        />
                    </div>
                    <div>
                        <label className="block text-md font-medium text-indigo-700 mb-1">Password</label>
                        <PasswordInput
                            name="password"
                            placeholder='Password'
                            value={form.password}
                            onChange={handleChange}
                            autoComplete="new-password"
                        />
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
                    
                    <motion.button
                        type="submit"
                        disabled={loading}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-full py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-sky-400 text-white font-semibold text-base sm:text-lg shadow-md hover:from-indigo-600 hover:to-sky-500 transition-all hover:cursor-pointer"
                    >
                        Reregister
                    </motion.button>
                </motion.form>
            </motion.div>

            <AnimatePresence>
                {(showOtpInput) && (
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

                        <h2 className="text-lg font-semibold mb-2">Having issues logging in?</h2>

                        {/* Multi-digit OTP Input */}
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
                                <button onClick={handleResendOtp} disabled={loading} className="flex-1 border rounded-lg mt-2 px-4 py-2">
                                    Resend
                                </button>
                            </div>
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
      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
    />
  );
};