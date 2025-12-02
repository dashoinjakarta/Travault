import { createClient } from "@supabase/supabase-js";

// Credentials provided by the user
const SUPABASE_URL = "https://bdfayakplqywlqhqoulv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkZmF5YWtwbHF5d2xxaHFvdWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2OTQ3MzksImV4cCI6MjA4MDI3MDczOX0.xoj-3R-um90SUaI9f0w5WZe_KtfzNg-EampnABjBC6Y";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
