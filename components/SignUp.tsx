import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Spinner } from './UI';

export const SignUp: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        
        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) {
                setError(error.message);
            } else {
                // If email confirmation is enabled, you might show a "Check your email" message
                // For now we assume auto-confirm or direct login flow
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
                    <h2 className="mt-6 text-2xl font-bold text-slate-900 dark:text-slate-100">Create your account</h2>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Start organizing your travel documents today</p>
                </div>
                
                <Card className="p-8 space-y-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    {error && (
                        <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}
                    
                    <form onSubmit={handleSignUp} className="space-y-5">
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
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
                            <input 
                                type="password" 
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                                placeholder="Create a strong password"
                                minLength={6}
                            />
                        </div>

                        <Button type="submit" variant="blue" className="w-full justify-center py-2.5" disabled={loading}>
                            {loading ? <Spinner /> : 'Sign Up'}
                        </Button>
                    </form>

                    <div className="text-center text-sm pt-2">
                        <span className="text-slate-600 dark:text-slate-400">Already have an account? </span>
                        <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">Sign in</Link>
                    </div>
                </Card>
            </div>
        </div>
    );
};