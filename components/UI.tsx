import React from 'react';

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'blue' }> = ({ 
    className = '', 
    variant = 'primary', 
    ...props 
}) => {
    const baseStyles = "px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900";
    
    const variants = {
        primary: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500",
        blue: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500",
        secondary: "bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 focus:ring-slate-500",
        danger: "bg-rose-500 hover:bg-rose-600 text-white focus:ring-rose-500",
        ghost: "bg-transparent hover:bg-slate-800 text-slate-400"
    };

    return (
        <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props} />
    );
};

export const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = '', onClick }) => (
    <div onClick={onClick} className={`bg-slate-800 rounded-xl shadow-lg border border-slate-700/50 p-5 ${className} ${onClick ? 'cursor-pointer hover:border-blue-500/50 transition-colors' : ''}`}>
        {children}
    </div>
);

export const Badge: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = 'bg-slate-700 text-slate-300' }) => (
    <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${color}`}>
        {children}
    </span>
);

export const Spinner: React.FC = () => (
    <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);