import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Spinner } from './UI';

export const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setError(error.message);
            } else {
                navigate('/');
            }
        } catch (err) {
            setError('An unexpected error occurred.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4 transition-colors duration-200">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">Travault</h1>
                    <h2 className="mt-6 text-2xl font-bold text-slate-900 dark:text-slate-100">Welcome back</h2>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Sign in to access your secure documents</p>
                </div>
                
                <Card className="p-8 space-y-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    {error && (
                        <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 px-4 py-3 rounded-lg text-sm flex items-center">
                            {error}
                        </div>
                    )}
                    
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                            <input 
                                type="email" 
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                                placeholder="nomad@example.com"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                                <a href="#" className="text-xs font-medium text-blue-600 hover:text-blue-500">Forgot password?</a>
                            </div>
                            <input 
                                type="password" 
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                                placeholder="••••••••"
                            />
                        </div>

                        <Button type="submit" variant="blue" className="w-full justify-center py-2.5" disabled={loading}>
                            {loading ? <Spinner /> : 'Sign In'}
                        </Button>
                    </form>

                    <div className="text-center text-sm pt-2">
                        <span className="text-slate-600 dark:text-slate-400">Don't have an account? </span>
                        <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">Sign up</Link>
                    </div>
                </Card>
            </div>
        </div>
    );
};