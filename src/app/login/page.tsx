'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

type FormValues = {
  username: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get('callbackUrl') || '/stats';

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>();

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setError(null);

    const result = await signIn('credentials', {
      username: data.username,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      setError('Invalid username or password');
      setIsLoading(false);
    } else {
      router.push(callbackUrl);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden">
      {/* Animated background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--bg-primary)',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(59,130,246,0.10), transparent)',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 40% 40% at 80% 80%, rgba(139,92,246,0.06), transparent)',
          zIndex: 0,
        }}
      />

      {/* Floating orbs */}
      <motion.div
        animate={{ y: [0, -20, 0], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
          top: '10%',
          left: '15%',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <motion.div
        animate={{ y: [0, 15, 0], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        style={{
          position: 'absolute',
          width: 250,
          height: 250,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)',
          bottom: '15%',
          right: '10%',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Login card */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, padding: '0 16px' }}
      >
        <div className="gradient-border" style={{ borderRadius: 20 }}>
          <div
            style={{
              background: 'rgba(13, 17, 23, 0.92)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderRadius: 20,
              padding: '40px 36px 36px',
              border: '1px solid rgba(255,255,255,0.07)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset',
            }}
          >
            {/* Logo / Header */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              style={{ textAlign: 'center', marginBottom: 36 }}
            >
              {/* Icon mark */}
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background:
                    'linear-gradient(135deg, rgba(59,130,246,0.25) 0%, rgba(139,92,246,0.20) 100%)',
                  border: '1px solid rgba(59,130,246,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 18px',
                  boxShadow: '0 0 30px rgba(59,130,246,0.15)',
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 3v18h18"
                    stroke="rgba(59,130,246,0.9)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M7 16l4-4 4 4 4-6"
                    stroke="rgba(139,92,246,0.9)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h1
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: 6,
                  letterSpacing: '-0.02em',
                }}
              >
                Portfolio Tracker
              </h1>
              <p style={{ fontSize: 13.5, color: 'var(--text-muted)', fontWeight: 400 }}>
                Sign in to your account
              </p>
            </motion.div>

            {/* Form */}
            <motion.form
              onSubmit={handleSubmit(onSubmit)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              {/* Username */}
              <div>
                <label
                  htmlFor="username"
                  style={{
                    display: 'block',
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: 7,
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                  }}
                >
                  Username
                </label>
                <div style={{ position: 'relative' }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: 13,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                      pointerEvents: 'none',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle
                        cx="12"
                        cy="7"
                        r="4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    placeholder="Enter your username"
                    {...register('username', { required: 'Username is required' })}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${errors.username ? 'rgba(244,63,94,0.5)' : 'rgba(255,255,255,0.09)'}`,
                      borderRadius: 10,
                      padding: '11px 12px 11px 38px',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                      outline: 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'rgba(59,130,246,0.5)';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.10)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = errors.username
                        ? 'rgba(244,63,94,0.5)'
                        : 'rgba(255,255,255,0.09)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
                <AnimatePresence>
                  {errors.username && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      style={{ color: 'var(--accent-red)', fontSize: 12, marginTop: 5 }}
                    >
                      {errors.username.message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  style={{
                    display: 'block',
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: 7,
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                  }}
                >
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: 13,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                      pointerEvents: 'none',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <rect
                        x="3"
                        y="11"
                        width="18"
                        height="11"
                        rx="2"
                        ry="2"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M7 11V7a5 5 0 0 1 10 0v4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    {...register('password', { required: 'Password is required' })}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${errors.password ? 'rgba(244,63,94,0.5)' : 'rgba(255,255,255,0.09)'}`,
                      borderRadius: 10,
                      padding: '11px 42px 11px 38px',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                      outline: 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'rgba(59,130,246,0.5)';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.10)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = errors.password
                        ? 'rgba(244,63,94,0.5)'
                        : 'rgba(255,255,255,0.09)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  {/* Show/hide password toggle */}
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <line
                          x1="1"
                          y1="1"
                          x2="23"
                          y2="23"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="3"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                </div>
                <AnimatePresence>
                  {errors.password && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      style={{ color: 'var(--accent-red)', fontSize: 12, marginTop: 5 }}
                    >
                      {errors.password.message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Error message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    style={{
                      background: 'rgba(244,63,94,0.10)',
                      border: '1px solid rgba(244,63,94,0.25)',
                      borderRadius: 10,
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10" stroke="rgba(244,63,94,0.9)" strokeWidth="2" />
                      <line
                        x1="12"
                        y1="8"
                        x2="12"
                        y2="12"
                        stroke="rgba(244,63,94,0.9)"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <line
                        x1="12"
                        y1="16"
                        x2="12.01"
                        y2="16"
                        stroke="rgba(244,63,94,0.9)"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span style={{ color: 'rgba(244,63,94,0.9)', fontSize: 13.5 }}>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit button */}
              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={!isLoading ? { scale: 1.01 } : {}}
                whileTap={!isLoading ? { scale: 0.99 } : {}}
                style={{
                  marginTop: 4,
                  width: '100%',
                  padding: '12px 24px',
                  borderRadius: 10,
                  border: 'none',
                  background: isLoading
                    ? 'rgba(59,130,246,0.3)'
                    : 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 9,
                  boxShadow: isLoading ? 'none' : '0 4px 24px rgba(59,130,246,0.30)',
                  transition: 'background 0.2s, box-shadow 0.2s',
                }}
              >
                {isLoading ? (
                  <>
                    <Spinner />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 12h14M12 5l7 7-7 7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </>
                )}
              </motion.button>
            </motion.form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Spinner() {
  return (
    <motion.svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      animate={{ rotate: 360 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="2.5"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </motion.svg>
  );
}
