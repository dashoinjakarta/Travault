
import { supabase } from './supabase';
import { UserProfile } from '../types';

export const getUserProfile = async (): Promise<UserProfile | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error) {
        console.warn("Error fetching profile:", error);
        return null;
    }

    return data as UserProfile;
};
