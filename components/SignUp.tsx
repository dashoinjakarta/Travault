
import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Spinner } from './UI';
import { Check } from 'lucide-react';

// --- Static Data Lists ---

// Languages in their native form
const LANGUAGES = [
    "Bahasa Indonesia", 
    "Bahasa Melayu", 
    "Dansk",
    "Deutsch", 
    "English", 
    "Español", 
    "Français", 
    "Italiano", 
    "Magyar",
    "Nederlands",
    "Norsk",
    "Polski",
    "Português", 
    "Română",
    "Suomi",
    "Svenska",
    "Tiếng Việt", 
    "Türkçe", 
    "Čeština",
    "Ελληνικά",
    "Русский", 
    "Українська",
    "العربية", 
    "हिन्दी", 
    "ไทย", 
    "中文", 
    "日本語", 
    "한국어"
].sort();

// Comprehensive Country Codes sorted Numerically
const COUNTRY_CODES = [
    { code: "+1", country: "USA/Canada" },
    { code: "+7", country: "Russia/Kazakhstan" },
    { code: "+20", country: "Egypt" },
    { code: "+27", country: "South Africa" },
    { code: "+30", country: "Greece" },
    { code: "+31", country: "Netherlands" },
    { code: "+32", country: "Belgium" },
    { code: "+33", country: "France" },
    { code: "+34", country: "Spain" },
    { code: "+36", country: "Hungary" },
    { code: "+39", country: "Italy" },
    { code: "+40", country: "Romania" },
    { code: "+41", country: "Switzerland" },
    { code: "+43", country: "Austria" },
    { code: "+44", country: "UK" },
    { code: "+45", country: "Denmark" },
    { code: "+46", country: "Sweden" },
    { code: "+47", country: "Norway" },
    { code: "+48", country: "Poland" },
    { code: "+49", country: "Germany" },
    { code: "+51", country: "Peru" },
    { code: "+52", country: "Mexico" },
    { code: "+54", country: "Argentina" },
    { code: "+55", country: "Brazil" },
    { code: "+56", country: "Chile" },
    { code: "+57", country: "Colombia" },
    { code: "+58", country: "Venezuela" },
    { code: "+60", country: "Malaysia" },
    { code: "+61", country: "Australia" },
    { code: "+62", country: "Indonesia" },
    { code: "+63", country: "Philippines" },
    { code: "+64", country: "New Zealand" },
    { code: "+65", country: "Singapore" },
    { code: "+66", country: "Thailand" },
    { code: "+81", country: "Japan" },
    { code: "+82", country: "South Korea" },
    { code: "+84", country: "Vietnam" },
    { code: "+86", country: "China" },
    { code: "+90", country: "Turkey" },
    { code: "+91", country: "India" },
    { code: "+92", country: "Pakistan" },
    { code: "+93", country: "Afghanistan" },
    { code: "+94", country: "Sri Lanka" },
    { code: "+95", country: "Myanmar" },
    { code: "+98", country: "Iran" },
    { code: "+212", country: "Morocco" },
    { code: "+213", country: "Algeria" },
    { code: "+216", country: "Tunisia" },
    { code: "+234", country: "Nigeria" },
    { code: "+254", country: "Kenya" },
    { code: "+351", country: "Portugal" },
    { code: "+353", country: "Ireland" },
    { code: "+354", country: "Iceland" },
    { code: "+358", country: "Finland" },
    { code: "+372", country: "Estonia" },
    { code: "+380", country: "Ukraine" },
    { code: "+420", country: "Czechia" },
    { code: "+852", country: "Hong Kong" },
    { code: "+855", country: "Cambodia" },
    { code: "+886", country: "Taiwan" },
    { code: "+966", country: "Saudi Arabia" },
    { code: "+971", country: "UAE" },
    { code: "+972", country: "Israel" }
].sort((a, b) => parseInt(a.code.replace('+', '')) - parseInt(b.code.replace('+', '')));

// Comprehensive Nationalities List
const NATIONALITIES = [
    "Afghan", "Albanian", "Algerian", "American", "Andorran", "Angolan", "Argentine", "Armenian", "Australian", "Austrian", 
    "Azerbaijani", "Bahamian", "Bahraini", "Bangladeshi", "Barbadian", "Belarusian", "Belgian", "Belizean", "Beninese", "Bhutanese", 
    "Bolivian", "Bosnian", "Brazilian", "British", "Bruneian", "Bulgarian", "Burkinabe", "Burmese", "Burundian", 
    "Cambodian", "Cameroonian", "Canadian", "Cape Verdean", "Central African", "Chadian", "Chilean", "Chinese", "Colombian", 
    "Comoran", "Congolese", "Costa Rican", "Croatian", "Cuban", "Cypriot", "Czech", "Danish", "Djiboutian", "Dominican", 
    "Dutch", "East Timorese", "Ecuadorian", "Egyptian", "Emirati", "Equatorial Guinean", "Eritrean", "Estonian", "Ethiopian", 
    "Fijian", "Filipino", "Finnish", "French", "Gabonese", "Gambian", "Georgian", "German", "Ghanaian", "Greek", 
    "Grenadian", "Guatemalan", "Guinean", "Guyanese", "Haitian", "Honduran", "Hungarian", "Icelandic", "Indian", "Indonesian", 
    "Iranian", "Iraqi", "Irish", "Israeli", "Italian", "Ivorian", "Jamaican", "Japanese", "Jordanian", "Kazakh", 
    "Kenyan", "Kiribati", "Korean (North)", "Korean (South)", "Kuwaiti", "Kyrgyz", "Laotian", "Latvian", "Lebanese", "Liberian", 
    "Libyan", "Liechtensteiner", "Lithuanian", "Luxembourgish", "Macedonian", "Malagasy", "Malawian", "Malaysian", "Maldivian", 
    "Malian", "Maltese", "Marshallese", "Mauritanian", "Mauritian", "Mexican", "Micronesian", "Moldovan", "Monacan", "Mongolian", 
    "Montenegrin", "Moroccan", "Mozambican", "Namibian", "Nauruan", "Nepalese", "New Zealander", "Nicaraguan", "Nigerien", 
    "Nigerian", "Norwegian", "Omani", "Pakistani", "Palauan", "Palestinian", "Panamanian", "Papua New Guinean", "Paraguayan", 
    "Peruvian", "Polish", "Portuguese", "Qatari", "Romanian", "Russian", "Rwandan", "Saint Lucian", "Salvadoran", "Sammarinese", 
    "Sao Tomean", "Saudi", "Scottish", "Senegalese", "Serbian", "Seychellois", "Sierra Leonean", "Singaporean", "Slovak", 
    "Slovenian", "Solomon Islander", "Somali", "South African", "Spanish", "Sri Lankan", "Sudanese", "Surinamese", "Swazi", 
    "Swedish", "Swiss", "Syrian", "Taiwanese", "Tajik", "Tanzanian", "Thai", "Togolese", "Tongan", "Trinidadian", "Tunisian", 
    "Turkish", "Turkmen", "Tuvaluan", "Ugandan", "Ukrainian", "Uruguayan", "Uzbek", "Vanuatuan", "Venezuelan", "Vietnamese", 
    "Welsh", "Yemenite", "Zambian", "Zimbabwean"
].sort();

export const SignUp: React.FC = () => {
    // Form State
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [nationality, setNationality] = useState("American");
    const [language, setLanguage] = useState('English');
    
    // Phone Split
    const [countryCode, setCountryCode] = useState('+1');
    const [localNumber, setLocalNumber] = useState('');
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [registrationSuccess, setRegistrationSuccess] = useState(false);
    
    const navigate = useNavigate();

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            setLoading(false);
            return;
        }

        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    // This data is stored in auth.users.raw_user_meta_data
                    // And copied to the 'profiles' table via the SQL trigger
                    data: {
                        first_name: firstName,
                        last_name: lastName,
                        nationality: nationality,
                        language: language,
                        phone_country_code: countryCode,
                        phone_local_number: localNumber
                    }
                }
            });

            if (error) {
                setError(error.message);
            } else {
                setRegistrationSuccess(true);
            }
        } catch (err) {
            setError('An unexpected error occurred.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (registrationSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4 py-12 transition-colors duration-200">
                <div className="w-full max-w-md space-y-6">
                    <div className="text-center">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">Travault</h1>
                    </div>
                    
                    <Card className="p-8 space-y-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                            <Check className="w-8 h-8" />
                        </div>
                        
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Check your inbox</h2>
                            <p className="mt-2 text-slate-600 dark:text-slate-400">
                                We've sent a confirmation link to <br/>
                                <span className="font-medium text-slate-900 dark:text-slate-200">{email}</span>
                            </p>
                        </div>

                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Please click the link in the email to verify your account. You won't be able to log in until you verify.
                        </p>
                        
                        <Button variant="blue" className="w-full justify-center" onClick={() => navigate('/login')}>
                            Go to Login
                        </Button>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4 py-12 transition-colors duration-200">
            <div className="w-full max-w-md space-y-6">
                <div className="text-center">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">Travault</h1>
                    <h2 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-100">Create your account</h2>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Join thousands of organized nomads</p>
                </div>
                
                <Card className="p-8 space-y-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    {error && (
                        <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}
                    
                    <form onSubmit={handleSignUp} className="space-y-4">
                        {/* Name Fields */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">First Name</label>
                                <input 
                                    type="text" 
                                    required
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    placeholder="Jane"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Last Name</label>
                                <input 
                                    type="text" 
                                    required
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    placeholder="Doe"
                                />
                            </div>
                        </div>

                        {/* Demographics */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Nationality</label>
                                <select 
                                    value={nationality}
                                    onChange={(e) => setNationality(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                >
                                    {NATIONALITIES.map(nat => (
                                        <option key={nat} value={nat}>{nat}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Preferred Language</label>
                                <select
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                >
                                    {LANGUAGES.map(lang => (
                                        <option key={lang} value={lang}>{lang}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Phone Number Split */}
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Phone Number</label>
                            <div className="flex gap-2">
                                <select 
                                    value={countryCode}
                                    onChange={(e) => setCountryCode(e.target.value)}
                                    className="w-[120px] px-2 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                >
                                    {COUNTRY_CODES.map(item => (
                                        <option key={item.code} value={item.code}>
                                            {item.code} ({item.country})
                                        </option>
                                    ))}
                                </select>
                                <input 
                                    type="tel" 
                                    required
                                    value={localNumber}
                                    onChange={(e) => setLocalNumber(e.target.value)}
                                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    placeholder="123 456 7890"
                                />
                            </div>
                        </div>

                        {/* Auth */}
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                            <input 
                                type="email" 
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="nomad@example.com"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
                                <input 
                                    type="password" 
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    placeholder="Password"
                                    minLength={6}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Confirm Password</label>
                                <input 
                                    type="password" 
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                                        confirmPassword && password !== confirmPassword 
                                        ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' 
                                        : 'border-slate-300 dark:border-slate-600'
                                    }`}
                                    placeholder="Confirm"
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <Button type="submit" variant="blue" className="w-full justify-center py-2.5 mt-2" disabled={loading}>
                            {loading ? <Spinner /> : 'Create Account'}
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
