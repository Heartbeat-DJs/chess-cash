'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import SiteNav from '@/components/layout/SiteNav';
import { useAuth } from '@/context/AuthContext';
import styles from './login.module.css';

type Mode = 'signin' | 'register';

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

function LoginInner() {
    const { user, loading, login, register, logout } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [mode, setMode] = useState<Mode>('signin');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    const next = searchParams.get('next');
    const destination = next && next.startsWith('/') ? next : '/online';

    function switchMode(m: Mode) {
        if (m === mode) return;
        setMode(m);
        setError(null);
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (pending) return;

        const name = username.trim();
        if (!USERNAME_RE.test(name)) {
            setError('Usernames are 3–20 characters: letters, numbers, and underscores only.');
            return;
        }
        if (password.length < 6) {
            setError('Passwords need at least 6 characters.');
            return;
        }

        setError(null);
        setPending(true);
        try {
            if (mode === 'signin') {
                await login(name, password);
            } else {
                await register(name, password);
            }
            router.push(destination);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
            setPending(false);
        }
    }

    // ── Already a member at the table ─────────────────────────────
    if (!loading && user) {
        return (
            <main className={styles.main}>
                <div className={styles.card}>
                    <div className={styles.crest}>♔</div>
                    <h1 className={styles.title}>You&rsquo;re already at the table, {user.username}</h1>
                    <p className={styles.subtitle}>The house never forgets a member.</p>

                    <div className={styles.memberMeta}>
                        <span>♖ {user.rating}</span>
                        <span className={styles.metaDivider} aria-hidden="true">·</span>
                        <span>${(user.credits / 100).toFixed(2)} balance</span>
                    </div>

                    <div className={styles.signedActions}>
                        <Link href="/online" className={`btn btn-gold btn-lg ${styles.fullBtn}`}>
                            Enter the Club Floor
                        </Link>
                        <button
                            type="button"
                            className={`btn btn-outline ${styles.fullBtn}`}
                            onClick={() => void logout()}
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    // ── Membership desk ───────────────────────────────────────────
    return (
        <main className={styles.main}>
            <div className={styles.card}>
                <div className={styles.crest}>♔</div>
                <h1 className={styles.title}>Take Your Seat</h1>
                <p className={styles.subtitle}>Members play for keeps.</p>

                <div className={styles.tabs} role="tablist" aria-label="Sign in or create account">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={mode === 'signin'}
                        className={`${styles.tab} ${mode === 'signin' ? styles.tabActive : ''}`}
                        onClick={() => switchMode('signin')}
                    >
                        Sign In
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={mode === 'register'}
                        className={`${styles.tab} ${mode === 'register' ? styles.tabActive : ''}`}
                        onClick={() => switchMode('register')}
                    >
                        Create Account
                    </button>
                </div>

                {error && (
                    <div className={styles.errorBanner} role="alert">
                        <span className={styles.errorIcon} aria-hidden="true">✕</span>
                        <span>{error}</span>
                    </div>
                )}

                <form className={styles.form} onSubmit={handleSubmit} noValidate>
                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="cc-username">Username</label>
                        <input
                            id="cc-username"
                            className="input"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="e.g. DukeOfE4"
                            autoComplete="username"
                            maxLength={20}
                            disabled={pending}
                        />
                        {mode === 'register' && (
                            <span className={styles.hint}>3–20 characters — letters, numbers, underscores.</span>
                        )}
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="cc-password">Password</label>
                        <input
                            id="cc-password"
                            className="input"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                            disabled={pending}
                        />
                        {mode === 'register' && (
                            <span className={styles.hint}>At least 6 characters.</span>
                        )}
                    </div>

                    <button type="submit" className={`btn btn-gold btn-lg ${styles.submit}`} disabled={pending}>
                        {pending ? 'Working…' : mode === 'signin' ? 'Sign In' : 'Join the Club'}
                    </button>
                </form>

                <div className={styles.perk}>
                    <span className={styles.perkIcon} aria-hidden="true">✦</span>
                    <span className={styles.perkText}>
                        Membership is free. Fund your wallet when you&rsquo;re ready to play for real stakes.
                    </span>
                </div>

                <p className={styles.switchLine}>
                    {mode === 'signin' ? (
                        <>
                            First visit?{' '}
                            <button type="button" className={styles.switchLink} onClick={() => switchMode('register')}>
                                Create your account
                            </button>
                        </>
                    ) : (
                        <>
                            Already a member?{' '}
                            <button type="button" className={styles.switchLink} onClick={() => switchMode('signin')}>
                                Sign in
                            </button>
                        </>
                    )}
                </p>
            </div>
        </main>
    );
}

export default function LoginPage() {
    return (
        <div className={styles.page}>
            <SiteNav />
            <Suspense fallback={null}>
                <LoginInner />
            </Suspense>
        </div>
    );
}
