"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.browserClient = browserClient;
exports.serverClient = serverClient;
exports.adminClient = adminClient;
var ssr_1 = require("@supabase/ssr");
var supabase_js_1 = require("@supabase/supabase-js");
var url = process.env.NEXT_PUBLIC_SUPABASE_URL;
var anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
var serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
function browserClient() {
    return (0, ssr_1.createBrowserClient)(url, anonKey);
}
function serverClient() {
    return (0, supabase_js_1.createClient)(url, anonKey);
}
function adminClient() {
    return (0, supabase_js_1.createClient)(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}
