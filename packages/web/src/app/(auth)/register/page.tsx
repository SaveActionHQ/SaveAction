'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';
import { ApiClientError } from '@/lib/api';

const passwordRequirements = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number', test: (p: string) => /\d/.test(p) },
];

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    password: '',
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const passwordStrength = React.useMemo(() => {
    return passwordRequirements.filter((req) => req.test(formData.password))
      .length;
  }, [formData.password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.name) {
      newErrors.name = 'Name is required';
    }
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (passwordStrength < passwordRequirements.length) {
      newErrors.password = 'Password does not meet all requirements';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    try {
      await register(formData.name, formData.email, formData.password);
      router.push('/projects');
    } catch (error) {
      if (error instanceof ApiClientError) {
        // Handle specific error codes
        switch (error.code) {
          case 'EMAIL_EXISTS':
          case 'DUPLICATE_EMAIL':
            setErrors({ email: 'An account with this email already exists' });
            break;
          case 'WEAK_PASSWORD':
            setErrors({ password: 'Password is too weak' });
            break;
          case 'VALIDATION_ERROR':
            setErrors({ form: error.message || 'Please check your input' });
            break;
          default:
            setErrors({ form: error.message || 'Registration failed. Please try again.' });
        }
      } else {
        setErrors({ form: 'An unexpected error occurred. Please try again.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-0 shadow-none sm:border sm:shadow-sm">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
        <CardDescription>
          Start automating your browser tests today
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.form && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {errors.form}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name" required>
              Full Name
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                className="pl-10"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                error={errors.name}
                disabled={isLoading}
                autoComplete="name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" required>
              Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                className="pl-10"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                error={errors.email}
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" required>
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a password"
                className="pl-10 pr-10"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                error={errors.password}
                disabled={isLoading}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                <span className="sr-only">
                  {showPassword ? 'Hide password' : 'Show password'}
                </span>
              </button>
            </div>

            {/* Password Strength Indicator */}
            {formData.password && (
              <div className="space-y-2 pt-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={cn(
                        'h-1.5 flex-1 rounded-full transition-colors',
                        passwordStrength >= level
                          ? passwordStrength >= 3
                            ? 'bg-success'
                            : passwordStrength >= 2
                              ? 'bg-warning'
                              : 'bg-destructive'
                          : 'bg-muted'
                      )}
                    />
                  ))}
                </div>
                <ul className="space-y-1 text-xs">
                  {passwordRequirements.map((req) => (
                    <li
                      key={req.label}
                      className={cn(
                        'flex items-center gap-1.5',
                        req.test(formData.password)
                          ? 'text-success'
                          : 'text-muted-foreground'
                      )}
                    >
                      <Check
                        className={cn(
                          'h-3 w-3',
                          !req.test(formData.password) && 'opacity-0'
                        )}
                      />
                      {req.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <Button type="submit" className="w-full" isLoading={isLoading}>
            {!isLoading && (
              <>
                Create account
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By creating an account, you agree to our{' '}
            <Link href="/terms" className="underline hover:text-foreground">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
