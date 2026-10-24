'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { seamSignIn } from '@/auth/actions';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Alert from '@mui/material/Alert';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PortfolioIcon from '@/components/PortfolioIcon';

type FormValues = {
  username: string;
  password: string;
  rememberMe: boolean;
  showPassword: boolean;
};

const fieldLabelSx = {
  display: 'block',
  fontSize: 12.5,
  fontWeight: 500,
  color: 'text.secondary',
  mb: '7px',
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
} as const;

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get('callbackUrl') || '/stats';
  const [isNavigating, setIsNavigating] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    mode: 'onSubmit',
    defaultValues: { username: '', password: '', rememberMe: false, showPassword: false },
  });

  const showPassword = watch('showPassword');
  const isBusy = isSubmitting || isNavigating;

  const onSubmit = async (data: FormValues) => {
    const result = await seamSignIn({
      username: data.username,
      password: data.password,
      rememberMe: data.rememberMe,
      callbackUrl,
    });

    if (result?.error) {
      setError('root', { message: 'Invalid username or password' });
      return;
    }

    // Lock the form in a loading state for the duration of the hard navigation.
    // isSubmitting resets to false when the promise resolves, so we use a
    // separate flag that stays true until the page unloads.
    setIsNavigating(true);

    // Use a hard navigation so the fresh session cookie is sent with the
    // request and the middleware recognises the authenticated session.
    const destination = result?.url ?? callbackUrl;

    window.location.href = destination;
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Animated background */}
      <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'background.default', zIndex: 0 }} />
      <Box
        sx={(theme) => ({
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 70% 60% at 50% 40%, ${theme.palette.primaryGlow}, transparent)`,
          zIndex: 0,
        })}
      />
      <Box
        sx={(theme) => ({
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 40% 40% at 80% 80%, ${theme.palette.primaryGlow}, transparent)`,
          zIndex: 0,
        })}
      />

      {/* Login card */}
      <Box
        component={motion.div}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        sx={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, px: 2 }}
      >
        <Box className="gradient-border" sx={{ borderRadius: '20px' }}>
          <Box
            sx={(theme) => ({
              bgcolor: 'background.paper',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderRadius: '20px',
              p: '40px 36px 36px',
              border: 1,
              borderColor: 'divider',
              boxShadow: `0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px ${theme.palette.divider} inset`,
            })}
          >
            {/* Logo / Header */}
            <Box
              component={motion.div}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              sx={{ textAlign: 'center', mb: 4.5 }}
            >
              <Box
                role="button"
                tabIndex={0}
                aria-label="Portfolio Tracker"
                onClick={() => router.push('/')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push('/'); }}
                sx={(theme) => ({
                  width: 52,
                  height: 52,
                  borderRadius: '14px',
                  bgcolor: theme.palette.primaryGlow,
                  border: 1,
                  borderColor: theme.palette.borderAccent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: '18px',
                  boxShadow: `0 0 30px ${theme.palette.primaryGlow}`,
                  cursor: 'pointer',
                  '&:hover': { opacity: 0.85 },
                })}
              >
                <PortfolioIcon size={26} />
              </Box>
              <Typography
                sx={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'text.primary',
                  mb: 0.75,
                  letterSpacing: '-0.02em',
                }}
              >
                Portfolio Tracker
              </Typography>
              <Typography sx={{ fontSize: 13.5, color: 'text.disabled', fontWeight: 400 }}>
                Sign in to your account
              </Typography>
            </Box>

            {/* Form */}
            <Box
              component={motion.form}
              onSubmit={handleSubmit(onSubmit)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
            >
              {/* Username */}
              <Box>
                <Typography component="label" htmlFor="username" sx={fieldLabelSx}>
                  Username
                </Typography>
                <Controller
                  name="username"
                  control={control}
                  rules={{ required: 'Username is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      id="username"
                      placeholder="Enter your username"
                      autoComplete="username"
                      autoCapitalize="none"
                      disabled={isBusy}
                      error={!!errors.username}
                      helperText={errors.username?.message}
                      variant="outlined"
                      size="small"
                      fullWidth
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PersonOutlinedIcon sx={{ fontSize: 18 }} />
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />
              </Box>

              {/* Password */}
              <Box>
                <Typography component="label" htmlFor="password" sx={fieldLabelSx}>
                  Password
                </Typography>
                <Controller
                  name="password"
                  control={control}
                  rules={{ required: 'Password is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      autoComplete={showPassword ? 'off' : 'current-password'}
                      disabled={isBusy}
                      error={!!errors.password}
                      helperText={errors.password?.message}
                      variant="outlined"
                      size="small"
                      fullWidth
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockOutlinedIcon sx={{ fontSize: 18 }} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setValue('showPassword', !showPassword)}
                              tabIndex={-1}
                              size="small"
                              edge="end"
                              sx={{ mr: '-4px' }}
                            >
                              {showPassword
                                ? <VisibilityOffIcon sx={{ fontSize: 18 }} />
                                : <VisibilityIcon sx={{ fontSize: 18 }} />
                              }
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />
              </Box>

              {/* Error message */}
              <Collapse in={!!errors.root?.message}>
                <Alert
                  severity="error"
                  icon={<ErrorOutlineIcon sx={{ fontSize: 16 }} />}
                >
                  {errors.root?.message}
                </Alert>
              </Collapse>

              {/* Remember me */}
              <Controller
                name="rememberMe"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        {...field}
                        checked={field.value}
                        size="small"
                      />
                    }
                    label="Remember me"
                    sx={{ margin: 0, marginTop: '-4px' }}
                  />
                )}
              />

              {/* Submit button */}
              <Button
                component={motion.button}
                type="submit"
                color="primary"
                disabled={isBusy}
                whileHover={!isBusy ? { scale: 1.01 } : {}}
                whileTap={!isBusy ? { scale: 0.99 } : {}}
                variant="contained"
                fullWidth
                disableRipple={isBusy}
                sx={{ marginTop: '4px', gap: '9px' }}
              >
                {(isBusy) ? (
                  <>
                    <CircularProgress size={16} thickness={5} sx={{ color: 'rgba(255,255,255,0.85)' }} />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowForwardIcon sx={{ fontSize: 16 }} />
                  </>
                )}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
